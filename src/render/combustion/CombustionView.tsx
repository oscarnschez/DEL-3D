import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useSettings } from '@/state/settings';
import { PROFILES } from '../quality/profiles';
import { useDisposable } from '../resources';
import { Html } from '@react-three/drei';
import { useApp } from '@/state/store';
import { gasState, tempColor } from '@/core/kinematics/thermo';
import { wrapDeg } from '@/core/kinematics/crank';
import { phaseOf, PHASE_LABEL } from '@/core/kinematics/cycle';
import { cameraApi } from '@/camera/CameraRig';
import { useEngine } from '../engine/useEngine';
import { auxLayout } from '../engine/Systems';
import { chamberParticleMaterial, flameVolumeMaterial, gasColumnMaterial, sprayShaderMaterial } from '../fxMaterials';

const tmp = { r: 0, g: 0, b: 0 };
const M4 = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const P = new THREE.Vector3();
const S = new THREE.Vector3();
const C = new THREE.Color();
const DOWN = new THREE.Vector3(0, -1, 0);
const DIR = new THREE.Vector3();
const CAM = new THREE.Vector3();
/** Relación de remolino (vueltas del aire por vuelta de cigüeñal), valor típico educativo. */
const SWIRL_RATIO = 1.5;

/** Luz de la llama, compartida con <ChamberLight>. */
const chamberLight: { current: THREE.PointLight | null } = { current: null };

/**
 * Luz puntual de la llama, montada siempre (intensidad 0 fuera del modo combustión).
 * Añadir o quitar una luz cambia el número de luces de la escena y obliga a Three.js a
 * recompilar los shaders de todos los materiales iluminados: eso congelaba la app al entrar
 * en COMBUSTIÓN.
 */
export function ChamberLight() {
  return (
    <pointLight
      ref={(l) => {
        chamberLight.current = l;
      }}
      color="#ff8a2a"
      distance={0.35}
      decay={2}
      intensity={0}
    />
  );
}

/** Masa relativa de gas en el cilindro (para hacer entrar/salir partículas). */
function massFraction(phi: number): number {
  const p = wrapDeg(phi, 720);
  if (p >= 180 && p < 360) return 1 - 0.9 * ((p - 180) / 180);
  if (p >= 360 && p < 540) return 0.1 + 0.9 * ((p - 360) / 180);
  return 1;
}

/**
 * Visualización de la cámara de combustión: columna de gas coloreada por temperatura en
 * todos los cilindros y, en el cilindro observado, partículas de aire/gases con remolino,
 * chorros de combustible, frente de llama por autoignición y escape. Representación educativa.
 */
export function CombustionView() {
  const mode = useApp((s) => s.mode);
  const focus = useApp((s) => s.focusCylinder);
  const showColumns = mode === 'combustion' || mode === 'interior' || mode === 'rayosx' || mode === 'combustible' || mode === 'aire';
  return (
    <>
      {showColumns && <GasColumns />}
      {(mode === 'combustion' || mode === 'combustible') && <SprayAll />}
      {mode === 'combustion' && <ChamberDetail cyl={focus} />}
    </>
  );
}

function GasColumns() {
  const { L, states, clock: sim } = useEngine();
  const geo = useDisposable(() => {
    const g = new THREE.CylinderGeometry(L.bore / 2 - 0.0015, L.bore / 2 - 0.0015, 1, 40, 1, true);
    g.translate(0, 0.5, 0);
    return g;
  }, [L]);
  const mats = useDisposable(() => L.cylX.map(() => gasColumnMaterial()), [L]);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    const boost = Math.min(2.8, 2.8 * sim.load * Math.min(1, sim.rpm / L.def.rpm.ratedPower) ** 1.3);
    for (let i = 0; i < L.n; i++) {
      const m = refs.current[i];
      if (!m) continue;
      const s = states[i];
      const crown = s.pistonY + L.def.geometry.compressionHeight;
      m.position.y = crown;
      m.scale.y = Math.max(0.001, L.deckY - crown);
      const gs = gasState(L, s.phi, sim.load, boost);
      tempColor(gs.T, tmp);
      mats[i].color.setRGB(tmp.r, tmp.g, tmp.b);
      mats[i].opacity = 0.18 + 0.4 * Math.min(1, (gs.T - 290) / 1600);
    }
  });
  return (
    <>
      {L.cylX.map((x, i) => (
        <mesh key={i} ref={(m) => (refs.current[i] = m)} geometry={geo} material={mats[i]} position={[x, 0, 0]} renderOrder={5} />
      ))}
    </>
  );
}

/** Chorros de combustible: 7 orificios, ángulo incluido ~150° (valor típico, educativo). */
function SprayAll() {
  const { L, states, clock } = useEngine();
  const holes = 7;
  const geo = useDisposable(() => {
    const g = new THREE.ConeGeometry(0.0065, 1, 12, 6, true);
    g.translate(0, -0.5, 0); // ápice en el origen, eje −Y
    return g;
  }, []);
  const mat = useDisposable(() => sprayShaderMaterial(), []);
  const ref = useRef<THREE.InstancedMesh>(null);
  const tilt = (75 * Math.PI) / 180; // desde el eje del inyector
  useFrame(() => {
    const im = ref.current;
    if (!im) return;
    mat.uniforms.uTime.value = clock.revs;
    let k = 0;
    for (let i = 0; i < L.n; i++) {
      const inj = states[i].injection;
      const len = inj > 0.01 ? L.bore * 0.34 * Math.min(1, 0.4 + inj) : 0;
      for (let h = 0; h < holes; h++) {
        const az = (h / holes) * Math.PI * 2 + 0.2;
        DIR.set(Math.sin(tilt) * Math.cos(az), -Math.cos(tilt), Math.sin(tilt) * Math.sin(az));
        Q.setFromUnitVectors(DOWN, DIR);
        P.set(L.cylX[i], L.deckY - 0.004, 0);
        S.set(1 + inj, len || 1e-5, 1 + inj);
        M4.compose(P, Q, S);
        im.setMatrixAt(k++, M4);
      }
    }
    im.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geo, mat, L.n * holes]} frustumCulled={false} renderOrder={6} />;
}

function ChamberDetail({ cyl }: { cyl: number }) {
  const { L, states, clock: sim } = useEngine();
  const steps = PROFILES[useSettings((st) => st.profile)].flameSteps;
  const i = Math.max(0, Math.min(L.n - 1, cyl - 1));
  const A = useMemo(() => auxLayout(L), [L]);
  const N = 420;
  const seeds = useMemo(() => {
    let s = 12345;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: N }, () => ({ rho: Math.sqrt(rnd()), th: rnd() * Math.PI * 2, h: rnd(), rank: rnd(), j: rnd() }));
  }, []);
  const ref = useRef<THREE.InstancedMesh>(null);
  const flame = useRef<THREE.Mesh>(null);
  const label = useRef<HTMLDivElement>(null);
  const geo = useDisposable(() => new THREE.SphereGeometry(1, 6, 4), []);
  const mat = useDisposable(() => chamberParticleMaterial(), []);
  const flameMat = useDisposable(() => flameVolumeMaterial(), []);

  // apagar la luz de combustión al salir del modo
  useEffect(
    () => () => {
      if (chamberLight.current) chamberLight.current.intensity = 0;
    },
    [],
  );

  // al salir del modo se vuelve al encuadre previo (salvo que un recorrido controle la cámara)
  useEffect(() => {
    const c = cameraApi.controls;
    if (!c) return;
    const pos = c.getPosition(new THREE.Vector3());
    const target = c.getTarget(new THREE.Vector3());
    return () => {
      if (useApp.getState().tour || cameraApi.controls !== c) return;
      void c.setLookAt(pos.x, pos.y, pos.z, target.x, target.y, target.z, true);
    };
  }, []);

  // acercamiento cinematográfico al cilindro observado
  useEffect(() => {
    const x = L.cylX[i];
    void cameraApi.lookAt([x + 0.42, L.deckY + 0.05, 0.3], [x, L.deckY - 0.035, 0], true);
  }, [i, L]);

  useFrame(({ camera }) => {
    const im = ref.current;
    if (!im) return;
    const s = states[i];
    const x = L.cylX[i];
    const crown = s.pistonY + L.def.geometry.compressionHeight;
    const H = L.deckY - crown;
    const boost = Math.min(2.8, 2.8 * sim.load * Math.min(1, sim.rpm / L.def.rpm.ratedPower) ** 1.3);
    const gs = gasState(L, s.phi, sim.load, boost);
    const phase = phaseOf(s.phi);
    const m = massFraction(s.phi);
    // remolino (swirl) inducido por los conductos de admisión: función de las revoluciones
    const swirl = sim.revs * Math.PI * 2 * SWIRL_RATIO;
    const R = L.bore / 2 - 0.004;
    for (let k = 0; k < N; k++) {
      const sd = seeds[k];
      let scale = 0.0022;
      if (sd.rank < m) {
        const th = sd.th + swirl * (0.6 + 0.4 * sd.rho);
        const jitter = Math.sin(sim.revs * 9 + sd.j * 40) * 0.002;
        P.set(x + Math.cos(th) * sd.rho * R + jitter, crown + 0.002 + sd.h * (H - 0.004), Math.sin(th) * sd.rho * R);
        // color: aire fresco (azul) → mezcla → gases quemados por temperatura
        const burnedP = sd.j < gs.burned;
        if (burnedP) tempColor(gs.T, tmp);
        else tempColor(Math.min(gs.T, 900), tmp);
        C.setRGB(tmp.r, tmp.g, tmp.b);
      } else if (sd.rank < m + 0.18 && (phase === 'admision' || phase === 'escape')) {
        // partículas entrando por la válvula de admisión o saliendo por la de escape
        const u = (sd.rank - m) / 0.18; // 0 = en la válvula, 1 = lejos en el puerto
        const zSide = phase === 'admision' ? -1 : 1;
        const vz = zSide * L.valveZ;
        const portZ = zSide * (A.d.headHalf + 0.02);
        P.set(x + (sd.th / Math.PI - 1) * L.valvePairDx * 0.5, L.deckY + 0.004 + u * (A.portY - L.deckY), vz + u * (portZ - vz));
        tempColor(phase === 'admision' ? 330 : gs.T, tmp);
        C.setRGB(tmp.r, tmp.g, tmp.b);
      } else {
        scale = 0;
        P.set(x, crown, 0);
      }
      S.setScalar(scale);
      M4.compose(P, Q.identity(), S);
      im.setMatrixAt(k, M4);
      im.setColorAt(k, C);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    // llama volumétrica: nace en el borde de los chorros (cámara omega) y se expande con la fracción quemada
    const fl = flame.current;
    if (fl) {
      const grow = 0.45 + 0.55 * gs.burned;
      fl.position.set(x, crown + Math.min(H, L.bore * 0.2) * 0.45, 0);
      fl.scale.set(L.bore * 0.48 * grow, Math.max(0.002, Math.min(H * 0.55 + 0.004, L.bore * 0.2)), L.bore * 0.48 * grow);
      fl.updateMatrixWorld();
      const u = flameMat.uniforms;
      u.uTime.value = sim.revs;
      u.uBurn.value = gs.burned;
      u.uHeat.value = Math.min(1, s.combustion * 1.2);
      u.uSwirl.value = swirl;
      u.uSteps.value = steps;
      u.uCam.value.copy(fl.worldToLocal(CAM.copy(camera.position)));
      fl.visible = s.combustion > 0.002;
    }
    const light = chamberLight.current;
    if (light) {
      light.position.set(x, crown + 0.02, 0);
      light.intensity = s.combustion * 1.4;
    }
    if (label.current) {
      label.current.innerHTML = `<b>Cilindro ${i + 1}</b> · ${PHASE_LABEL[phase]}<br/>φ = ${s.phi.toFixed(0)}° · T ≈ ${gs.T.toFixed(0)} K · p ≈ ${gs.p.toFixed(1)} bar<br/><span class="muted">Modelo termodinámico educativo</span>`;
    }
  });

  return (
    <>
      <instancedMesh ref={ref} args={[geo, mat, N]} frustumCulled={false} renderOrder={7} />
      <mesh ref={flame} material={flameMat} renderOrder={8} frustumCulled={false}>
        <icosahedronGeometry args={[1, 2]} />
      </mesh>
      <Html position={[L.cylX[i], L.deckY + 0.16, -0.05]} center className="chamber-label" zIndexRange={[20, 0]}>
        <div ref={label} />
      </Html>
    </>
  );
}
