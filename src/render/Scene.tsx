import { memo, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor, Stats } from '@react-three/drei';
import { EffectComposer, N8AO, SMAA, ToneMapping, Vignette, Bloom } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useApp } from '@/state/store';
import { useSettings } from '@/state/settings';
import { getEngine } from '@/engines/catalog';
import { deriveLayout } from '@/engines/derive';
import { SimulationDriver } from '@/core/simulation/SimulationDriver';
import { sim } from '@/core/simulation/clock';
import { updateThermal } from '@/core/thermal/state';
import { CameraRig } from '@/camera/CameraRig';
import { TourPlayer } from '@/camera/tours';
import { useSelection } from '@/interaction/selection';
import { EngineModel } from './engine/EngineModel';
import { sectionUniform, setMaterialDetail } from './materials';
import { ChamberLight, CombustionView } from './combustion/CombustionView';
import { ShaderWarmup } from './warmup';
import { cutEdgeMaterial, cutGizmoMaterial } from './fxMaterials';
import { Flows } from './fluids/Flows';
import { Labels } from './Labels';
import { StudioRig } from './StudioRig';
import { AutoProfile, PerfProbe } from './perf';
import { PROFILES } from './quality/profiles';
import { LIGHTING } from './lighting';
import { generateTextures } from './textures/library';

/** Plano que no recorta nada: mantiene constante el número de planos de corte. */
const NO_CUT = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e4);

/** Normal del plano de corte dinámico a partir de su orientación (grados). */
export function dynamicCutNormal(yawDeg: number, pitchDeg: number, out = new THREE.Vector3()): THREE.Vector3 {
  const y = (yawDeg * Math.PI) / 180;
  const p = (pitchDeg * Math.PI) / 180;
  return out.set(-Math.cos(p) * Math.cos(y), Math.sin(p), -Math.cos(p) * Math.sin(y)).normalize();
}

/**
 * Planos de corte globales (renderer.clippingPlanes) según la herramienta activa.
 * Siempre hay exactamente un plano: el número de planos forma parte de la clave de cada shader,
 * así que pasar de 0 a 1 recompilaba todos los materiales de la escena (congelamiento al entrar
 * en COMBUSTIÓN, TÉCNICO o al usar el corte).
 */
function CutController() {
  const gl = useThree((s) => s.gl);
  const cut = useApp((s) => s.cut);
  const offset = useApp((s) => s.cutOffset);
  const yaw = useApp((s) => s.cutYaw);
  const pitch = useApp((s) => s.cutPitch);
  const focus = useApp((s) => s.focusCylinder);
  const engineId = useApp((s) => s.engineId);
  const L = useMemo(() => deriveLayout(getEngine(engineId)), [engineId]);
  useEffect(() => {
    let plane = NO_CUT;
    if (cut === 'longitudinal') plane = new THREE.Plane(new THREE.Vector3(0, 0, -1), offset * 0.3);
    else if (cut === 'transversal') plane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), (L.cylX[focus - 1] ?? 0) + offset * L.pitch * 0.5);
    else if (cut === 'cilindro') plane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), L.cylX[focus - 1] ?? 0);
    else if (cut === 'libre') plane = new THREE.Plane(dynamicCutNormal(yaw, pitch), offset * 0.45);
    gl.clippingPlanes = [plane];
    sectionUniform.value = plane === NO_CUT ? 0 : 1;
  }, [cut, offset, yaw, pitch, focus, gl, L]);
  return null;
}

/**
 * Indicador del plano de corte libre: rectángulo tenue con contorno, desplazado 2 mm hacia el lado
 * visible para no quedar recortado por el propio plano. Siempre montado (se precompila).
 */
function CutGizmo() {
  const cut = useApp((s) => s.cut);
  const offset = useApp((s) => s.cutOffset);
  const yaw = useApp((s) => s.cutYaw);
  const pitch = useApp((s) => s.cutPitch);
  const ref = useRef<THREE.Group>(null);
  const res = useMemo(() => {
    const plane = new THREE.PlaneGeometry(1.9, 1.3);
    const edges = new THREE.EdgesGeometry(plane);
    return { plane, edges, fill: cutGizmoMaterial(), edge: cutEdgeMaterial() };
  }, []);
  useEffect(
    () => () => {
      res.plane.dispose();
      res.edges.dispose();
    },
    [res],
  );
  useEffect(() => {
    const g = ref.current;
    if (!g) return;
    const n = dynamicCutNormal(yaw, pitch);
    const c = offset * 0.45;
    // plano n·p + c = 0 → punto más cercano al origen: −c·n; +2 mm hacia el lado conservado (n·p + c > 0)
    g.position.copy(n).multiplyScalar(-c + 0.002);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  }, [offset, yaw, pitch]);
  return (
    <group ref={ref} visible={cut === 'libre'} userData={{ warm: true }}>
      <mesh geometry={res.plane} material={res.fill} renderOrder={9} />
      <lineSegments geometry={res.edges} material={res.edge} renderOrder={9} />
    </group>
  );
}

/**
 * Mapa de sombras bajo demanda: con el motor cerrado sólo proyectan sombra las piezas exteriores,
 * que no se mueven, así que basta con recalcularlo cuando algo cambia. Con el interior a la vista
 * (cortes, rayos X, despiece…) se actualiza cada frame.
 */
function ShadowScheduler() {
  const gl = useThree((s) => s.gl);
  const dirty = useRef(60);
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    const mark = () => (dirty.current = 45);
    const u1 = useApp.subscribe(mark);
    const u2 = useSelection.subscribe(mark);
    const u3 = useSettings.subscribe(mark);
    return () => {
      u1();
      u2();
      u3();
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl]);
  useFrame(() => {
    const a = useApp.getState();
    const continuous = a.cut !== 'none' || a.explode > 0 || a.transparency > 0.05 || a.mode !== 'exterior' || Object.values(a.removed).some(Boolean);
    if (continuous || dirty.current > 0) {
      gl.shadowMap.needsUpdate = true;
      if (dirty.current > 0) dirty.current--;
    }
  });
  return null;
}

/** Temperaturas estimadas de las piezas a 4 Hz (vista térmica y tablero). */
function ThermalDriver() {
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.25) return;
    acc.current = 0;
    const a = useApp.getState();
    updateThermal(sim, a.running, getEngine(a.engineId).rpm.ratedPower);
  });
  return null;
}

/** Postprocesado de los perfiles altos: oclusión ambiental, resplandor, viñeta, antialiasing. */
function PostFx() {
  const profile = useSettings((s) => s.profile);
  const lighting = useSettings((s) => s.lighting);
  const P = PROFILES[profile];
  const vignette = LIGHTING[lighting].vignette;
  if (!P.ao && !P.smaa && !P.bloom) return null;
  const fx: React.JSX.Element[] = [];
  if (P.ao) fx.push(<N8AO key="ao" aoRadius={0.12} distanceFalloff={0.6} intensity={2.4} quality={profile === 'ultra' ? 'high' : 'medium'} halfRes={profile !== 'ultra'} />);
  if (P.bloom) fx.push(<Bloom key="bloom" intensity={0.35} luminanceThreshold={0.92} luminanceSmoothing={0.1} mipmapBlur />);
  fx.push(<ToneMapping key="tm" mode={ToneMappingMode.NEUTRAL} />);
  // la viñeta se mantiene montada (intensidad 0 si el escenario no la usa) para no rehacer los pases
  fx.push(<Vignette key="vig" offset={0.32} darkness={vignette} />);
  if (P.smaa) fx.push(<SMAA key="smaa" />);
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {fx}
    </EffectComposer>
  );
}

/** Genera las texturas procedurales con la resolución del perfil. */
function TextureGenerator() {
  const profile = useSettings((s) => s.profile);
  const P = PROFILES[profile];
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    if (P.detailMaps) generateTextures(P.textureSize, Math.min(8, gl.capabilities.getMaxAnisotropy()));
  }, [P.detailMaps, P.textureSize, gl]);
  return null;
}

/** Memorizado: el padre (<Viewport>) se re-renderiza con cada cambio de modo o de subtítulo. */
export const Scene = memo(function Scene({ onError }: { onError?: (msg: string) => void }) {
  const engineId = useApp((s) => s.engineId);
  const comparing = useApp((s) => s.showComparator);
  const profile = useSettings((s) => s.profile);
  const P = PROFILES[profile];
  const def = getEngine(engineId);
  const [dpr, setDpr] = useState(P.dpr[1]);
  useEffect(() => setDpr(P.dpr[1]), [P.dpr]);
  // los materiales con/sin mapas de detalle son programas distintos: se crean antes de montar el motor
  setMaterialDetail(P.detailMaps);
  return (
    <Canvas
      // con el comparador abierto la vista principal no se dibuja (un único render activo)
      frameloop={comparing ? 'never' : 'always'}
      shadows={P.shadows ? 'soft' : false}
      dpr={dpr}
      camera={{ position: [-1.2, 0.9, 1.3], fov: 38, near: 0.01, far: 50 }}
      gl={{ antialias: !P.smaa, powerPreference: 'high-performance', localClippingEnabled: true, preserveDrawingBuffer: false, stencil: false }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.toneMappingExposure = 1;
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          onError?.('Se perdió el contexto gráfico (WebGL). Suele ocurrir por falta de memoria de vídeo o un reinicio del controlador: recargue la página o elija el perfil RENDIMIENTO.');
        });
      }}
      onPointerMissed={(e) => {
        if (e.type === 'click') useSelection.getState().select(null);
      }}
    >
      <PerfProbe />
      <AutoProfile />
      {P.dynamicResolution && (
        <PerformanceMonitor bounds={() => [45, 58]} flipflops={4} onChange={({ factor }) => setDpr(Math.round((P.dpr[0] + (P.dpr[1] - P.dpr[0]) * factor) * 100) / 100)} />
      )}
      <TextureGenerator />
      <SimulationDriver />
      <ThermalDriver />
      <StudioRig />
      <ChamberLight />
      <CutController />
      <CutGizmo />
      <ShadowScheduler />
      <Suspense fallback={null}>
        <EngineModel key={`${def.id}-${P.detailMaps ? 'd' : 'n'}`} def={def} publish>
          <CombustionView />
          <Flows />
          <Labels />
        </EngineModel>
      </Suspense>
      <ShaderWarmup token={`${def.id}-${profile}`} postFx={P.ao || P.smaa || P.bloom} />
      <CameraRig />
      <TourPlayer />
      <PostFx />
      {import.meta.env.DEV && new URLSearchParams(location.search).has('stats') && <Stats />}
    </Canvas>
  );
});
