import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useApp, type FlowSystem } from '@/state/store';
import { useSettings } from '@/state/settings';
import { PROFILES } from '../quality/profiles';
import { useEngine } from '../engine/useEngine';
import { useDisposable } from '../resources';
import { mergeGeometries } from '../geometry/builders';
import { flowPaths, type FlowPath } from './paths';
import { flowDropMaterial, flowTubeMergedMaterial } from '../fxMaterials';

const SYSTEMS: FlowSystem[] = ['lubricacion', 'combustible', 'refrigeracion', 'aire'];

/**
 * Metros recorridos por el fluido en cada revolución de cigüeñal (escala visual). El caudal de
 * las bombas mecánicas es proporcional al régimen, así que el avance se expresa por revolución:
 * las partículas son función del reloj común (`revs`), se detienen en pausa, siguen la cámara
 * lenta y retroceden con el avance manual hacia atrás.
 */
const M_PER_REV = 0.022;
/** Muestras por trayecto para la tabla de posiciones/colores (evita `getPointAt` por partícula). */
const LUT = 128;

/** Sistemas de fluidos superponibles; cada uno se activa con su interruptor. */
export function Flows() {
  const flows = useApp((s) => s.flows);
  return (
    <>
      {SYSTEMS.map((s) => (flows[s] ? <FlowSystemView key={s} system={s} /> : null))}
    </>
  );
}

interface Line {
  path: FlowPath;
  length: number;
  count: number;
  first: number;
  phase0: number;
  injCyl: number;
  /** LUT: posiciones (xyz) y colores (rgb) a lo largo del trayecto, LUT+1 muestras. */
  pos: Float32Array;
  col: Float32Array;
}

const M4 = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const P = new THREE.Vector3();
const S = new THREE.Vector3();
const C = new THREE.Color();
const C2 = new THREE.Color();

function gradient(colors: THREE.Color[], t: number, out: THREE.Color) {
  if (colors.length === 1) return out.copy(colors[0]);
  const f = t * (colors.length - 1);
  const i = Math.min(colors.length - 2, Math.floor(f));
  return out.copy(colors[i]).lerp(colors[i + 1], f - i);
}

/**
 * Un circuito completo en dos draw calls: todos los conductos fusionados (color por vértice) y
 * todas las partículas en un único InstancedMesh.
 */
function FlowSystemView({ system }: { system: FlowSystem }) {
  const { L, states, clock } = useEngine();
  const profile = useSettings((s) => s.profile);
  const density = PROFILES[profile].particles;
  const air = system === 'aire';

  const data = useDisposable(() => {
    const paths = flowPaths(L, system);
    const tubes: THREE.BufferGeometry[] = [];
    const lines: Line[] = [];
    let total = 0;
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const path of paths) {
      const curve = new THREE.CatmullRomCurve3(path.points, false, 'catmullrom', 0.3);
      const length = curve.getLength();
      const tube = new THREE.TubeGeometry(curve, Math.max(8, Math.round(length * 120)), air ? 0.012 : 0.0065, 8, false);
      tube.deleteAttribute('uv');
      // color por vértice = rampa del trayecto según la posición a lo largo del tubo
      const cols = path.colors.map((c) => new THREE.Color(c));
      const n = tube.attributes.position.count;
      const vc = new Float32Array(n * 3);
      const ring = 9;
      const segs = n / ring - 1;
      for (let v = 0; v < n; v++) {
        gradient(cols, Math.floor(v / ring) / segs, C);
        vc.set([C.r, C.g, C.b], v * 3);
      }
      tube.setAttribute('color', new THREE.BufferAttribute(vc, 3));
      tubes.push(tube);
      const pos = new Float32Array((LUT + 1) * 3);
      const col = new Float32Array((LUT + 1) * 3);
      for (let k = 0; k <= LUT; k++) {
        curve.getPointAt(k / LUT, P);
        pos.set([P.x, P.y, P.z], k * 3);
        gradient(cols, k / LUT, C);
        col.set([C.r, C.g, C.b], k * 3);
      }
      const count = Math.max(3, Math.round(length * (air ? 70 : 90) * density));
      lines.push({ path, length, count, first: total, phase0: rnd(), injCyl: path.pulsed ? Number(path.id.replace('iny', '')) : -1, pos, col });
      total += count;
    }
    const tube = mergeGeometries(tubes)!;
    tubes.forEach((t) => t.dispose());
    return { lines, total, tube, drop: new THREE.SphereGeometry(air ? 0.0085 : 0.0058, 10, 8) };
  }, [L, system, density, air]);

  const mats = useDisposable(() => ({ tube: flowTubeMergedMaterial(), drop: flowDropMaterial() }), []);
  const ref = useRef<THREE.InstancedMesh>(null);

  useFrame(() => {
    const im = ref.current;
    if (!im) return;
    const revs = clock.revs;
    const running = clock.rpm > 1;
    for (const ln of data.lines) {
      const pulse = ln.injCyl >= 0 ? states[ln.injCyl].injection : 0;
      // avance = función pura de las revoluciones; el combustible de alta presión late con la inyección
      const off = (((ln.phase0 + (revs * M_PER_REV * ln.path.speed) / ln.length) % 1) + 1) % 1;
      for (let k = 0; k < ln.count; k++) {
        const t = (k / ln.count + off) % 1;
        const f = t * LUT;
        const i = Math.min(LUT - 1, Math.floor(f));
        const u = f - i;
        const a = i * 3;
        const b = a + 3;
        P.set(ln.pos[a] + (ln.pos[b] - ln.pos[a]) * u, ln.pos[a + 1] + (ln.pos[b + 1] - ln.pos[a + 1]) * u, ln.pos[a + 2] + (ln.pos[b + 2] - ln.pos[a + 2]) * u);
        // aire: tamaño ligeramente variable (nube); detenido: partículas más pequeñas (fluido en reposo)
        const sz = (ln.injCyl >= 0 ? 0.6 + pulse : air ? 0.8 + 0.4 * ((k * 0.618) % 1) : 1) * (running ? 1 : 0.7);
        S.setScalar(sz);
        M4.compose(P, Q, S);
        im.setMatrixAt(ln.first + k, M4);
        C.setRGB(ln.col[a], ln.col[a + 1], ln.col[a + 2]);
        C2.setRGB(ln.col[b], ln.col[b + 1], ln.col[b + 2]);
        im.setColorAt(ln.first + k, C.lerp(C2, u));
      }
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  });

  return (
    <group name={`flow-${system}`}>
      <mesh geometry={data.tube} material={mats.tube} renderOrder={3} />
      <instancedMesh key={data.total} ref={ref} args={[data.drop, mats.drop, data.total]} frustumCulled={false} renderOrder={4} />
    </group>
  );
}
