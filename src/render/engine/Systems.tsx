import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Part } from '@/interaction/Part';
import { sim } from '@/core/simulation/clock';
import { DEG } from '@/core/kinematics/crank';
import type { EngineLayout } from '@/engines/derive';
import { getMaterials } from '../materials';
import { extrudeX, gearGeometry, journalGeometry, lathe, pipeGeometry, polyShape, roundedRectShape } from '../geometry/builders';
import { useEngine } from './useEngine';
import { shellDims } from './Structure';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Puntos de referencia de los sistemas auxiliares, compartidos con las trayectorias de fluidos. */
export function auxLayout(L: EngineLayout) {
  const d = shellDims(L);
  const portY = L.deckY + 0.0015 + (L.headTopY - L.deckY - 0.0015) * 0.45;
  const rearBias = L.def.air.turbo === 'series' ? 0.0 : 0.12;
  const turbo = V(rearBias * (L.blockLength / 1.08), L.deckY - 0.04, d.headHalf + 0.22);
  return {
    d,
    portY,
    railZ: -(d.headHalf + 0.035),
    railY: L.deckY + L.headHeight * 0.55,
    plenumZ: -(d.headHalf + 0.07),
    plenumY: portY + 0.01,
    exCollZ: d.headHalf + 0.075,
    exCollY: portY - 0.005,
    turbo,
    cooler: V(L.front - 0.6, 0.28, 0),
    hpPump: V(L.front + 0.14, L.deckY - 0.19, -(d.deckHalf + 0.07)),
    fuelFilters: [V(-0.02, 0.06, -(d.crankHalf + 0.09)), V(0.1, 0.06, -(d.crankHalf + 0.09))],
    oilFilter: V(-0.2, 0.0, -(d.crankHalf + 0.085)),
    oilPump: V(L.front + 0.07, -L.r - 0.06, 0),
    waterPump: V(L.front - 0.07, 0.2, d.deckHalf * 0.5),
    thermostat: V(L.front + 0.01, L.camY - 0.03, d.headHalf * 0.45),
    after: V(L.rear - 0.05, -0.1, d.crankHalf + 0.72),
    egrCooler: V(-0.05, L.camY + 0.03, d.headHalf + 0.075),
  };
}

export function FuelSystem() {
  const { L, states } = useEngine();
  const M = getMaterials();
  const A = useMemo(() => auxLayout(L), [L]);
  const geo = useMemo(() => {
    const tipY = L.deckY - 0.003;
    const topY = L.deckY + L.headHeight * 0.95;
    const h = topY - tipY;
    const injector = lathe(
      [
        [0, 0],
        [0.0035, 0.0005],
        [0.0045, 0.006],
        [0.0075, 0.012],
        [0.0075, h * 0.45],
        [0.0105, h * 0.47],
        [0.0105, h * 0.75],
        [0.0125, h * 0.77],
        [0.0125, h * 0.92],
        [0.008, h * 0.95],
        [0.008, h],
        [0, h],
      ],
      24,
    );
    const quill = pipeGeometry([V(0, A.railY - tipY, -0.008), V(0, A.railY - tipY, A.railZ)], 0.0045, 8, 8);
    const eui = L.def.injection.system === 'eui';
    // riel común (acumulador) o, en inyectores-bomba (EUI), galería de baja presión
    const rail = journalGeometry(eui ? 0.007 : 0.013, L.blockLength * 0.92, 20);
    const pump = lathe([[0, -0.07], [0.045, -0.07], [0.05, -0.05], [0.05, 0.05], [0.035, 0.07], [0, 0.07]], 28);
    pump.rotateZ(-Math.PI / 2);
    const filter = lathe(
      [
        [0, 0],
        [0.035, 0],
        [0.042, 0.01],
        [0.042, 0.17],
        [0.045, 0.175],
        [0.045, 0.19],
        [0, 0.19],
      ],
      32,
    );
    const hp = pipeGeometry(
      [A.hpPump.clone().add(V(0.05, 0.03, 0)), V(A.hpPump.x + 0.12, A.railY - 0.04, A.railZ - 0.02), V(L.cylX[0] - 0.05, A.railY, A.railZ)],
      0.005,
      48,
      8,
    );
    const low = pipeGeometry(
      [
        A.fuelFilters[0].clone().add(V(0, 0.19, 0)),
        A.fuelFilters[0].clone().add(V(0, 0.26, 0.02)),
        A.hpPump.clone().add(V(0.06, -0.02, -0.02)),
      ],
      0.006,
      40,
      8,
    );
    return { injector, quill, rail, pump, filter, hp, low, tipY, eui };
  }, [L, A]);
  const needles = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    needles.current.forEach((m, i) => {
      if (!m) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      // indicador de evento de inyección en el cuerpo del inyector
      mat.emissiveIntensity = states[i].injection * 2.5;
    });
  });
  const injGlow = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2b2f33', emissive: '#ffd23f', emissiveIntensity: 0, metalness: 0.6, roughness: 0.4 }), []);
  return (
    <>
      {L.cylX.map((x, i) => (
        <Part key={i} id="injector" index={i + 1} explodeScale={0.25}>
          <group position={[x, geo.tipY, 0]}>
            <mesh geometry={geo.injector} material={M.zinc} />
            <mesh ref={(m) => (needles.current[i] = m)} material={injGlow} position={[0, (L.headHeight * 0.95 + 0.003) * 0.6, 0]} userData={{ noPart: true }}>
              <cylinderGeometry args={[0.0108, 0.0108, 0.02, 20]} />
            </mesh>
            <mesh geometry={geo.quill} material={geo.eui ? M.hose : M.machinedSteel} />
          </group>
        </Part>
      ))}
      <Part id="fuelRail">
        <mesh geometry={geo.rail} material={M.forgedSteel} position={[0, A.railY, A.railZ]} />
        {!geo.eui && <mesh geometry={geo.hp} material={M.machinedSteel} />}
      </Part>
      <Part id="fuelPump">
        <mesh geometry={geo.pump} material={M.aluminumCast} position={[A.hpPump.x, A.hpPump.y, A.hpPump.z]} />
        <mesh geometry={geo.low} material={M.hose} />
      </Part>
      <Part id="fuelFilter">
        <mesh geometry={geo.filter} material={M.filterOrange} position={A.fuelFilters[0]} />
        <mesh geometry={geo.filter} material={M.filterOrange} position={A.fuelFilters[1]} />
        <mesh position={[A.fuelFilters[0].x + 0.06, A.fuelFilters[0].y + 0.2, A.fuelFilters[0].z + 0.01]}>
          <boxGeometry args={[0.2, 0.025, 0.06]} />
          <primitive object={M.aluminumCast} attach="material" />
        </mesh>
      </Part>
    </>
  );
}

export function AirSystem() {
  const { L } = useEngine();
  const M = getMaterials();
  const A = useMemo(() => auxLayout(L), [L]);
  const geo = useMemo(() => {
    const d = A.d;
    // múltiple de admisión: plenum + runners
    const plenum = extrudeX(roundedRectShape(0.07, 0.085, 0.03), L.blockLength * 0.95, 0.005, 10);
    const runner = pipeGeometry([V(0, A.plenumY, A.plenumZ + 0.02), V(0, A.portY, -d.headHalf - 0.01)], 0.022, 6, 14);
    // múltiple de escape: tubos por cilindro hacia el colector seccionado
    const exPipes: THREE.BufferGeometry[] = L.cylX.map((x) =>
      pipeGeometry([V(x, A.portY, d.headHalf + 0.012), V(x, A.portY - 0.005, d.headHalf + 0.045), V(x + 0.03, A.exCollY, A.exCollZ)], 0.022, 16, 12),
    );
    const coll = journalGeometry(0.032, L.blockLength / 3 - 0.012, 24);
    const flange = extrudeX(roundedRectShape(0.06, 0.055, 0.012), 0.012, 0.002, 4);
    const T = A.turbo;
    const toTurbine = pipeGeometry([V(L.cylX[3] + 0.03, A.exCollY, A.exCollZ), V(T.x + 0.06, A.exCollY - 0.02, A.exCollZ + 0.06), V(T.x + 0.085, T.y + 0.02, T.z - 0.07)], 0.034, 30, 14);
    // aire de carga: compresor → intercooler → múltiple
    const C = A.cooler;
    const hot = pipeGeometry(
      [V(T.x - 0.1, T.y + 0.05, T.z + 0.02), V(T.x - 0.25, T.y + 0.18, T.z + 0.02), V(L.front - 0.15, T.y + 0.22, 0.25), V(C.x + 0.06, C.y + 0.18, 0.3)],
      0.04,
      64,
      16,
    );
    const cold = pipeGeometry(
      [V(C.x + 0.06, C.y + 0.18, -0.3), V(L.front - 0.15, A.plenumY + 0.04, -0.3), V(L.front - 0.02, A.plenumY, A.plenumZ), V(L.front + 0.04, A.plenumY, A.plenumZ)],
      0.04,
      64,
      16,
    );
    const inlet = pipeGeometry([V(T.x - 0.12, T.y, T.z), V(T.x - 0.3, T.y, T.z + 0.02), V(T.x - 0.45, T.y + 0.12, T.z + 0.1)], 0.055, 24, 16);
    const down = pipeGeometry([V(T.x + 0.12, T.y, T.z), V(T.x + 0.22, T.y - 0.05, T.z + 0.1), A.after.clone().add(V(-0.47, 0.0, 0))], 0.05, 40, 16);
    // intercooler: núcleo con tanques
    const core = extrudeX(roundedRectShape(0.82, 0.52, 0.01), 0.06, 0.002, 4);
    const tank = extrudeX(roundedRectShape(0.08, 0.56, 0.03), 0.09, 0.004, 6);
    // EGR: enfriador y válvula
    const egrCooler = journalGeometry(0.045, 0.42, 24);
    const egrPipe = pipeGeometry(
      [V(L.cylX[0] + 0.03, A.exCollY, A.exCollZ), V(A.egrCooler.x - 0.23, A.egrCooler.y - 0.03, A.egrCooler.z), V(A.egrCooler.x - 0.21, A.egrCooler.y, A.egrCooler.z)],
      0.022,
      24,
      10,
    );
    const egrOut = pipeGeometry(
      [V(A.egrCooler.x + 0.21, A.egrCooler.y, A.egrCooler.z), V(A.egrCooler.x + 0.26, A.egrCooler.y + 0.08, 0.0), V(L.front + 0.12, A.egrCooler.y + 0.09, A.plenumZ), V(L.front + 0.12, A.plenumY + 0.04, A.plenumZ)],
      0.022,
      48,
      10,
    );
    return { plenum, runner, exPipes, coll, flange, toTurbine, hot, cold, inlet, down, core, tank, egrCooler, egrPipe, egrOut };
  }, [L, A]);
  const d = A.d;
  return (
    <>
      <Part id="intakeManifold" shell>
        <mesh geometry={geo.plenum} material={M.aluminumCast} position={[0, A.plenumY, A.plenumZ]} />
        {L.cylX.map((x, i) => (
          <mesh key={i} geometry={geo.runner} material={M.aluminumCast} position={[x, 0, 0]} />
        ))}
      </Part>
      <Part id="exhaustManifold" shell>
        {geo.exPipes.map((g, i) => (
          <mesh key={i} geometry={g} material={M.exhaustIron} />
        ))}
        {[0, 1, 2].map((k) => (
          <mesh key={k} geometry={geo.coll} material={M.exhaustIron} position={[(k - 1) * (L.blockLength / 3), A.exCollY, A.exCollZ]} />
        ))}
        {L.cylX.map((x, i) => (
          <mesh key={`f${i}`} geometry={geo.flange} material={M.exhaustIron} position={[x, A.portY, d.headHalf + 0.012]} />
        ))}
        <mesh geometry={geo.toTurbine} material={M.exhaustIron} />
      </Part>
      <Turbo />
      <Part id="intercooler">
        <mesh geometry={geo.core} material={M.intercoolerCore} position={A.cooler} rotation={[0, 0, 0]} />
        <mesh geometry={geo.tank} material={M.aluminumCast} position={[A.cooler.x, A.cooler.y, 0.45]} />
        <mesh geometry={geo.tank} material={M.aluminumCast} position={[A.cooler.x, A.cooler.y, -0.45]} />
        <mesh geometry={geo.hot} material={M.hose} />
        <mesh geometry={geo.cold} material={M.hose} />
      </Part>
      {L.def.air.egr && (
        <Part id="egr">
          <mesh geometry={geo.egrCooler} material={M.zinc} position={A.egrCooler} />
          <mesh geometry={geo.egrPipe} material={M.heatShield} />
          <mesh geometry={geo.egrOut} material={M.heatShield} />
        </Part>
      )}
      <Part id="aftertreatment" explodeScale={0.3}>
        <mesh geometry={geo.down} material={M.heatShield} />
        <Aftertreatment />
      </Part>
      <Part id="turbo">
        <mesh geometry={geo.inlet} material={M.hose} />
      </Part>
    </>
  );
}

/** Turbocompresor: carcasa del compresor, carcasa central y turbina; rotor visible en la entrada. */
function Turbo() {
  const { L } = useEngine();
  const M = getMaterials();
  const A = useMemo(() => auxLayout(L), [L]);
  const geo = useMemo(() => {
    const volute = (R: number, r: number) => {
      // voluta de sección creciente alrededor del eje X
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 64; k++) {
        const a = (k / 64) * Math.PI * 2;
        pts.push(V(0, Math.cos(a) * R, Math.sin(a) * R));
      }
      const curve = new THREE.CatmullRomCurve3(pts, true);
      const g = new THREE.TubeGeometry(curve, 64, r, 16, true);
      return g;
    };
    const compVol = volute(0.075, 0.032);
    const turbVol = volute(0.07, 0.036);
    const compShroud = lathe([[0.05, -0.04], [0.06, -0.03], [0.062, 0.03], [0.04, 0.035], [0.038, 0.06], [0.044, 0.07]], 40);
    compShroud.rotateZ(Math.PI / 2);
    const center = lathe([[0, -0.03], [0.04, -0.03], [0.05, -0.015], [0.05, 0.015], [0.04, 0.03], [0, 0.03]], 32);
    center.rotateZ(-Math.PI / 2);
    // álabes del compresor
    const blade = extrudeX(polyShape([[0, 0.008], [0.0015, 0.008], [0.0015, 0.044], [0, 0.044]]), 0.035, 0, 1);
    const hub = lathe([[0, -0.02], [0.012, -0.02], [0.008, 0.015], [0, 0.02]], 20);
    hub.rotateZ(Math.PI / 2);
    const T = A.turbo;
    const interstage = pipeGeometry([V(T.x + 0.09, T.y - 0.19, T.z - 0.03), V(T.x + 0.12, T.y - 0.1, T.z - 0.02), V(T.x + 0.07, T.y - 0.04, T.z)], 0.028, 24, 12);
    const compoundShaft = pipeGeometry(
      [V(T.x + 0.2, T.y - 0.07, T.z - 0.05), V(T.x + 0.24, T.y - 0.12, T.z - 0.09), V(L.rear - 0.02, 0.12, A.d.crankHalf + 0.02), V(L.rear + 0.03, 0.08, A.d.crankHalf - 0.03)],
      0.025,
      40,
      12,
    );
    return { compVol, turbVol, compShroud, center, blade, hub, interstage, compoundShaft };
  }, [A, L]);
  const rotors = useRef<(THREE.Group | null)[]>([]);
  useFrame(() => {
    rotors.current.forEach((r, k) => r && (r.rotation.x = sim.turboAngle * (k === 0 ? 1 : 0.7)));
  });
  const T = A.turbo;
  const air = L.def.air;
  const unit = (k: number, pos: [number, number, number], scale: number) => (
    <group key={k} position={pos} scale={scale}>
      <mesh geometry={geo.compVol} material={M.aluminumCast} position={[-0.06, 0, 0]} />
      <mesh geometry={geo.compShroud} material={M.aluminumCast} position={[-0.075, 0, 0]} />
      <mesh geometry={geo.center} material={M.rawIron} />
      <mesh geometry={geo.turbVol} material={M.exhaustIron} position={[0.07, 0, 0]} />
      {air.turbo === 'vgt' && k === 0 && (
        // actuador de la geometría variable
        <mesh position={[0.07, 0.085, 0.06]} material={M.blackPaint}>
          <boxGeometry args={[0.07, 0.04, 0.05]} />
        </mesh>
      )}
      <group ref={(g) => (rotors.current[k] = g)} position={[-0.1, 0, 0]}>
        <mesh geometry={geo.hub} material={M.machinedSteel} />
        {Array.from({ length: 12 }, (_, j) => (
          <mesh key={j} geometry={geo.blade} material={M.aluminumCast} rotation={[(j / 12) * Math.PI * 2, 0.35, 0]} />
        ))}
      </group>
    </group>
  );
  return (
    <Part id="turbo">
      {unit(0, [T.x, T.y, T.z], 1)}
      {air.turbo === 'series' && (
        <>
          {/* etapa de alta presión (más pequeña) bajo la de baja presión */}
          {unit(1, [T.x + 0.02, T.y - 0.19, T.z - 0.03], 0.72)}
          <mesh geometry={geo.interstage} material={M.exhaustIron} />
        </>
      )}
      {air.turboCompound && (
        <>
          {/* turbina de potencia del turbo-compound y transmisión al tren de engranajes */}
          <mesh geometry={geo.turbVol} material={M.exhaustIron} position={[T.x + 0.2, T.y - 0.07, T.z]} scale={0.85} />
          <mesh geometry={geo.compoundShaft} material={M.aluminumCast} />
        </>
      )}
    </Part>
  );
}

function Aftertreatment() {
  const { L } = useEngine();
  const M = getMaterials();
  const A = useMemo(() => auxLayout(L), [L]);
  const geo = useMemo(() => {
    const can = lathe(
      [
        [0, -0.48],
        [0.06, -0.48],
        [0.16, -0.42],
        [0.17, -0.4],
        [0.17, 0.4],
        [0.16, 0.42],
        [0.06, 0.48],
        [0, 0.48],
      ],
      48,
    );
    can.rotateZ(-Math.PI / 2);
    const band = journalGeometry(0.175, 0.025, 48);
    return { can, band };
  }, []);
  return (
    <group position={A.after}>
      <mesh geometry={geo.can} material={M.zinc} />
      {[-0.25, 0.05, 0.3].map((x) => (
        <mesh key={x} geometry={geo.band} material={M.darkSteel} position={[x, 0, 0]} />
      ))}
      <group position={[0, 0.2, 0]}>
        {[-0.22, 0.02, 0.27].map((x, i) => (
          <mesh key={x} position={[x, 0, 0]}>
            <boxGeometry args={[0.08, 0.025, 0.05]} />
            <meshStandardMaterial color={['#3fa9ff', '#9aa3ad', '#a78bfa'][i]} metalness={0.2} roughness={0.6} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export function LubeSystem() {
  const { L, angle } = useEngine();
  const M = getMaterials();
  const A = useMemo(() => auxLayout(L), [L]);
  const gear = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => {
    const pump = extrudeX(roundedRectShape(0.09, 0.07, 0.02), 0.07, 0.004, 6);
    const pg = gearGeometry(0.03, 20, 0.02);
    const pickup = pipeGeometry([V(A.oilPump.x, A.oilPump.y - 0.03, 0), V(A.oilPump.x + 0.05, L.sumpBottomY + 0.06, 0), V(L.blockLength * 0.22, L.sumpBottomY + 0.035, 0)], 0.014, 32, 10);
    const strainer = lathe([[0, 0], [0.045, 0], [0.045, 0.01], [0.02, 0.02], [0, 0.02]], 28);
    const canister = lathe([[0, 0], [0.05, 0], [0.055, 0.01], [0.055, 0.2], [0.05, 0.21], [0, 0.21]], 36);
    canister.rotateX(Math.PI);
    const cooler = extrudeX(roundedRectShape(0.035, 0.12, 0.01), 0.42, 0.004, 4);
    return { pump, pg, pickup, strainer, canister, cooler };
  }, [L, A]);
  useFrame(() => {
    if (gear.current) gear.current.rotation.x = -angle.value * DEG * 1.4;
  });
  const d = A.d;
  return (
    <>
      <Part id="oilPump">
        <mesh geometry={geo.pump} material={M.aluminumCast} position={A.oilPump} />
        <mesh ref={gear} geometry={geo.pg} material={M.darkSteel} position={[A.oilPump.x - 0.045, A.oilPump.y, 0]} />
        <mesh geometry={geo.pickup} material={M.machinedSteel} />
        <mesh geometry={geo.strainer} material={M.darkSteel} position={[L.blockLength * 0.22, L.sumpBottomY + 0.012, 0]} />
      </Part>
      <Part id="oilFilter">
        <mesh geometry={geo.cooler} material={M.aluminumCast} position={[A.oilFilter.x + 0.15, A.oilFilter.y + 0.05, -(d.crankHalf + 0.03)]} />
        <mesh geometry={geo.canister} material={M.filterBlue} position={[A.oilFilter.x, A.oilFilter.y, A.oilFilter.z]} />
        <mesh geometry={geo.canister} material={M.filterBlue} position={[A.oilFilter.x - 0.12, A.oilFilter.y, A.oilFilter.z]} />
      </Part>
    </>
  );
}

export function CoolingSystem() {
  const { L, angle } = useEngine();
  const M = getMaterials();
  const A = useMemo(() => auxLayout(L), [L]);
  const pulley = useRef<THREE.Group>(null);
  const geo = useMemo(() => {
    const vol = lathe([[0, -0.04], [0.07, -0.04], [0.085, -0.02], [0.085, 0.03], [0.06, 0.045], [0, 0.045]], 40);
    vol.rotateZ(-Math.PI / 2);
    const p = lathe([[0, -0.015], [0.065, -0.015], [0.065, 0.015], [0, 0.015]], 40);
    p.rotateZ(-Math.PI / 2);
    const tstat = extrudeX(roundedRectShape(0.06, 0.06, 0.02), 0.08, 0.004, 6);
    const outlet = pipeGeometry([V(A.thermostat.x - 0.04, A.thermostat.y, A.thermostat.z), V(A.thermostat.x - 0.2, A.thermostat.y + 0.03, A.thermostat.z), V(A.cooler.x + 0.12, A.thermostat.y + 0.02, 0.25)], 0.028, 32, 12);
    const inlet = pipeGeometry([V(A.waterPump.x - 0.05, A.waterPump.y - 0.05, A.waterPump.z), V(A.waterPump.x - 0.2, A.waterPump.y - 0.15, A.waterPump.z), V(A.cooler.x + 0.12, 0.08, 0.25)], 0.03, 32, 12);
    return { vol, p, tstat, outlet, inlet };
  }, [A]);
  useFrame(() => {
    if (pulley.current) pulley.current.rotation.x = angle.value * DEG * 1.3;
  });
  return (
    <>
      <Part id="waterPump">
        <mesh geometry={geo.vol} material={M.aluminumCast} position={A.waterPump} />
        <group ref={pulley} position={[A.waterPump.x - 0.07, A.waterPump.y, A.waterPump.z]}>
          <mesh geometry={geo.p} material={M.zinc} />
          {[0, 1, 2, 3].map((k) => (
            <mesh key={k} material={M.bolt} position={[-0.016, Math.cos((k * Math.PI) / 2) * 0.03, Math.sin((k * Math.PI) / 2) * 0.03]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.006, 0.006, 0.01, 6]} />
            </mesh>
          ))}
        </group>
        <mesh geometry={geo.inlet} material={M.hose} />
      </Part>
      <Part id="thermostat">
        <mesh geometry={geo.tstat} material={M.aluminumCast} position={A.thermostat} />
        <mesh geometry={geo.outlet} material={M.hose} />
      </Part>
    </>
  );
}

/** Cubierta frontal de distribución y carcasa del volante (parte de la estructura). */
export function Housings() {
  const { L } = useEngine();
  const M = getMaterials();
  const geo = useMemo(() => {
    const d = shellDims(L);
    const topY = L.kind === 'ohv' ? L.camY : L.camY;
    const zR = L.kind === 'ohv' ? 0.06 : L.camZ + 0.11;
    const zL = L.kind === 'ohv' ? -L.camZ - 0.09 : -L.camZ - 0.11;
    const pts: [number, number][] =
      L.kind === 'ohv'
        ? [
            [-0.11, -L.r - 0.02],
            [0.11, -L.r - 0.02],
            [zR + 0.04, 0.06],
            [zR, topY + 0.1],
            [zL, topY + 0.1],
            [zL, topY - 0.08],
            [-0.12, 0.0],
          ]
        : [
            [-0.11, -L.r - 0.02],
            [0.11, -L.r - 0.02],
            [0.12, 0.12],
            [zR, topY - 0.1],
            [zR, topY + 0.1],
            [zL, topY + 0.1],
            [zL, topY - 0.1],
            [-0.12, 0.12],
          ];
    const cover = extrudeX(polyShape(pts), 0.03, 0.006, 4);
    const bell = lathe(
      [
        [L.bore * 2.05, -0.08],
        [L.bore * 2.15, -0.06],
        [L.bore * 2.15, 0.06],
        [L.bore * 1.6, 0.075],
        [L.bore * 1.55, 0.06],
        [L.bore * 2.05, -0.05],
      ],
      64,
    );
    bell.rotateZ(-Math.PI / 2);
    return { cover, bell, d };
  }, [L]);
  const paint = useMemo(() => {
    const m = getMaterials().paintedIron.clone();
    m.color.set(L.def.style.block);
    return m;
  }, [L.def.style.block]);
  const front = L.def.valvetrain.gearTrain === 'front';
  const fwX = L.rear + (front ? 0.035 : 0.075);
  return (
    <>
      <Part id="block" shell>
        <mesh geometry={geo.cover} material={paint} position={[front ? L.front - 0.045 : L.rear + 0.04, 0, 0]} />
        <mesh geometry={geo.bell} material={M.aluminumCast} position={[fwX + 0.02, 0, 0]} />
        {!front && <mesh geometry={geo.cover} material={paint} position={[L.front - 0.02, 0, 0]} scale={[0.5, 0.6, 0.8]} />}
      </Part>
    </>
  );
}
