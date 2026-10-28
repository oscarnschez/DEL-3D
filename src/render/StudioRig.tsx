import { memo, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Grid } from '@react-three/drei';
import { useSettings } from '@/state/settings';
import { PROFILES } from './quality/profiles';
import { backgroundFor, environmentFor, LIGHTING } from './lighting';

const FLOOR_Y = -0.32;

/** Textura radial para el «suelo infinito» de estudio (se desvanece hacia el fondo). */
function floorTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  return t;
}

/**
 * Iluminación de estudio con tres escenarios intercambiables en caliente. Número de luces fijo;
 * el escenario sólo cambia parámetros (sin recompilar shaders). Entornos HDR precalculados.
 */
export const StudioRig = memo(function StudioRig() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const preset = useSettings((s) => s.lighting);
  const profile = useSettings((s) => s.profile);
  const P = PROFILES[profile];
  const def = LIGHTING[preset];
  const hemi = useRef<THREE.HemisphereLight>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const fill = useRef<THREE.DirectionalLight>(null);
  const rim = useRef<THREE.DirectionalLight>(null);
  const rim2 = useRef<THREE.DirectionalLight>(null);
  const top = useRef<THREE.SpotLight>(null);
  const floorMat = useMemo(() => new THREE.MeshBasicMaterial({ map: floorTexture(), transparent: true, depthWrite: false, color: '#2a323b' }), []);
  const shadowMat = useMemo(() => new THREE.ShadowMaterial({ opacity: 0.5 }), []);
  const exposure = useRef(def.exposure);

  // Precalcula los tres entornos al inicio: el primer cambio de escenario es instantáneo.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      for (const p of Object.keys(LIGHTING) as (keyof typeof LIGHTING)[]) environmentFor(gl, p);
    });
    return () => cancelAnimationFrame(id);
  }, [gl]);

  useEffect(() => {
    scene.environment = environmentFor(gl, preset);
    scene.environmentIntensity = def.envIntensity;
    scene.background = backgroundFor(preset);
    if (scene.fog) (scene.fog as THREE.Fog).color.set(def.background[1]);
    const apply = (l: THREE.DirectionalLight | THREE.SpotLight | null, d: { position: [number, number, number]; color: string; intensity: number }) => {
      if (!l) return;
      l.position.set(...d.position);
      l.color.set(d.color);
      l.intensity = d.intensity;
    };
    apply(key.current, def.key);
    apply(fill.current, def.fill);
    apply(rim.current, def.rim);
    apply(rim2.current, def.rim2);
    apply(top.current, def.top);
    if (top.current) {
      top.current.angle = def.top.angle;
      top.current.penumbra = def.top.penumbra;
    }
    if (hemi.current) {
      hemi.current.color.set(def.hemi.sky);
      hemi.current.groundColor.set(def.hemi.ground);
      hemi.current.intensity = def.hemi.intensity;
    }
    shadowMat.opacity = def.shadowOpacity;
    floorMat.color.set(preset === 'laboratorio' ? '#59636e' : preset === 'cine' ? '#141a20' : '#262e37');
    floorMat.opacity = preset === 'laboratorio' ? 0.35 : 0.55;
  }, [gl, scene, preset, def, shadowMat, floorMat]);

  // Transición suave de exposición entre escenarios.
  useFrame((_, dt) => {
    exposure.current += (def.exposure - exposure.current) * (1 - Math.exp(-dt * 4));
    gl.toneMappingExposure = exposure.current;
  });

  useEffect(() => {
    const l = key.current;
    if (!l) return;
    l.shadow.mapSize.set(P.shadowMapSize, P.shadowMapSize);
    l.shadow.map?.dispose();
    l.shadow.map = null as unknown as THREE.WebGLRenderTarget;
    l.shadow.needsUpdate = true;
  }, [P.shadowMapSize]);

  return (
    <>
      <fog attach="fog" args={[def.background[1], 5, 13]} />
      <hemisphereLight ref={hemi} args={[def.hemi.sky, def.hemi.ground, def.hemi.intensity]} />
      <directionalLight
        ref={key}
        position={def.key.position}
        intensity={def.key.intensity}
        castShadow
        shadow-mapSize={[P.shadowMapSize, P.shadowMapSize]}
        shadow-camera-left={-1.7}
        shadow-camera-right={1.7}
        shadow-camera-top={1.7}
        shadow-camera-bottom={-1.7}
        shadow-camera-near={0.5}
        shadow-camera-far={9}
        shadow-bias={-0.0003}
        shadow-normalBias={0.015}
        shadow-radius={4}
      />
      <directionalLight ref={fill} position={def.fill.position} intensity={def.fill.intensity} />
      <directionalLight ref={rim} position={def.rim.position} intensity={def.rim.intensity} />
      <directionalLight ref={rim2} position={def.rim2.position} intensity={def.rim2.intensity} />
      <spotLight ref={top} position={def.top.position} angle={def.top.angle} penumbra={def.top.penumbra} intensity={def.top.intensity} decay={0} />
      <mesh rotation-x={-Math.PI / 2} position={[0, FLOOR_Y - 0.001, 0]} material={floorMat} scale={7} renderOrder={-1}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, FLOOR_Y, 0]} receiveShadow material={shadowMat}>
        <planeGeometry args={[12, 12]} />
      </mesh>
      <Grid
        visible={def.grid}
        userData={{ warm: true }}
        position={[0, FLOOR_Y + 0.001, 0]}
        args={[12, 12]}
        cellSize={0.1}
        cellThickness={0.6}
        cellColor="#4a5560"
        sectionSize={0.5}
        sectionThickness={1}
        sectionColor="#6b7a88"
        fadeDistance={7}
        fadeStrength={1.5}
        infiniteGrid
      />
    </>
  );
});
