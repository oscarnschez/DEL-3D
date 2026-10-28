import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useApp, type FlowSystem } from '@/state/store';
import { sim } from '@/core/simulation/clock';
import { useEngine } from '../engine/useEngine';
import { flowPaths, type FlowPath } from './paths';
import { flowParticleMaterial, flowTubeMaterial } from '../fxMaterials';

const SYSTEMS: FlowSystem[] = ['lubricacion', 'combustible', 'refrigeracion', 'aire'];

/** Sistemas de fluidos superponibles; cada uno se activa con su interruptor. */
export function Flows() {
  const flows = useApp((s) => s.flows);
  return (
    <>
      {SYSTEMS.map((s) => (flows[s] ? <FlowSystemView key={s} system={s} /> : null))}
    </>
  );
}

function FlowSystemView({ system }: { system: FlowSystem }) {
  const { L } = useEngine();
  const paths = useMemo(() => flowPaths(L, system), [L, system]);
  return (
    <group name={`flow-${system}`}>
      {paths.map((p) => (
        <FlowLine key={p.id} path={p} system={system} />
      ))}
    </group>
  );
}

const M4 = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const P = new THREE.Vector3();
const S = new THREE.Vector3();
const C = new THREE.Color();

function gradient(colors: THREE.Color[], t: number, out: THREE.Color) {
  if (colors.length === 1) return out.copy(colors[0]);
  const f = t * (colors.length - 1);
  const i = Math.min(colors.length - 2, Math.floor(f));
  return out.copy(colors[i]).lerp(colors[i + 1], f - i);
}

/** Conducto traslúcido + partículas instanciadas que recorren la curva. */
function FlowLine({ path, system }: { path: FlowPath; system: FlowSystem }) {
  const { L, states } = useEngine();
  const { curve, tube, count, length } = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(path.points, false, 'catmullrom', 0.3);
    const length = curve.getLength();
    const tube = new THREE.TubeGeometry(curve, Math.max(8, Math.round(length * 120)), system === 'aire' ? 0.012 : 0.0065, 8, false);
    const count = Math.max(4, Math.round(length * (system === 'aire' ? 70 : 90)));
    return { curve, tube, count, length };
  }, [path, system]);
  const tubeMat = useMemo(() => flowTubeMaterial(path.colors[Math.floor(path.colors.length / 2)]), [path.colors]);
  const pGeo = useMemo(() => new THREE.SphereGeometry(system === 'aire' ? 0.0085 : 0.0058, 8, 6), [system]);
  const pMat = useMemo(() => flowParticleMaterial(), []);
  const cols = useMemo(() => path.colors.map((c) => new THREE.Color(c)), [path.colors]);
  const ref = useRef<THREE.InstancedMesh>(null);
  const offset = useRef(Math.random());
  const injCyl = path.pulsed ? Number(path.id.replace('iny', '')) : -1;

  useFrame((_, dt) => {
    const im = ref.current;
    if (!im) return;
    const app = useApp.getState();
    const rpmF = sim.rpm / L.def.rpm.ratedPower;
    let speed = (0.12 + 0.5 * rpmF) * path.speed * (sim.rpm > 1 ? 1 : 0);
    if (injCyl >= 0) speed *= 0.3 + 3 * states[injCyl].injection;
    if (!app.paused) offset.current = (offset.current + (speed * dt * app.timeScale) / length) % 1;
    for (let k = 0; k < count; k++) {
      const t = (k / count + offset.current) % 1;
      curve.getPointAt(t, P);
      S.setScalar(injCyl >= 0 ? 0.6 + states[injCyl].injection : 1);
      M4.compose(P, Q, S);
      im.setMatrixAt(k, M4);
      gradient(cols, t, C);
      im.setColorAt(k, C);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  });

  return (
    <>
      <mesh geometry={tube} material={tubeMat} renderOrder={3} />
      <instancedMesh ref={ref} args={[pGeo, pMat, count]} frustumCulled={false} renderOrder={4} />
    </>
  );
}
