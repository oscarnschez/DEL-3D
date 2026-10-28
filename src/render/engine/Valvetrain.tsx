import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Part } from '@/interaction/Part';
import { DEG, wrapDeg } from '@/core/kinematics/crank';
import { localCycleAngle } from '@/core/kinematics/cycle';
import { valveLift } from '@/core/kinematics/valvetrain';
import { camRotation, rockerAngle } from '@/core/kinematics/engineState';
import type { EngineLayout } from '@/engines/derive';
import { getMaterials } from '../materials';
import { useDisposable } from '../resources';
import { camLobeGeometry, extrudeX, gearGeometry, journalGeometry, lathe, mergeGeometries, roundedRectShape, springGeometry, valveGeometry } from '../geometry/builders';
import { useEngine } from './useEngine';

type Side = 'intake' | 'exhaust';
const sideSign = (s: Side) => (s === 'intake' ? -1 : 1);

/**
 * Geometría de un árbol de levas. El lóbulo de cada cilindro se genera con la misma ley de
 * alzada que mueve la válvula, dividida por la relación del balancín. El seguidor toca la leva
 * en el ángulo polar `L.followerAngle` (0 arriba en DOHC, π abajo en SOHC): ve γ = ángulo − c.
 * `sides` indica qué lóbulos lleva este árbol (DOHC: uno; SOHC: admisión y escape).
 */
function camshaftGeometry(L: EngineLayout, sides: Side[]): THREE.BufferGeometry {
  const ratio = L.rockerValveArm / L.rockerCamArm;
  const parts: THREE.BufferGeometry[] = [];
  const lobeW = L.bore * 0.17;
  for (const side of sides) {
    const ev = side === 'intake' ? L.intake : L.exhaust;
    const dx = sides.length > 1 ? sideSign(side) * L.lobeOffset : 0;
    L.cylX.forEach((x, i) => {
      const lobe = camLobeGeometry(L.camBaseRadius, lobeW, (gamma) => {
        const c = L.followerAngle - gamma;
        const crank = wrapDeg((2 * c) / DEG, 720);
        const phi = localCycleAngle(crank, L.fireAngles[i]);
        return valveLift(phi, ev) / ratio;
      });
      lobe.translate(x + dx, 0, 0);
      parts.push(lobe.index ? lobe.toNonIndexed() : lobe);
    });
  }
  const shaft = journalGeometry(L.camBaseRadius * 0.55, L.blockLength + 0.05, 24).toNonIndexed();
  parts.push(shaft);
  for (let k = 0; k <= L.n; k++) {
    const j = journalGeometry(L.camBaseRadius * 0.62, 0.02, 32).toNonIndexed();
    j.translate(L.cylX[0] - L.pitch / 2 + k * L.pitch, 0, 0);
    parts.push(j);
  }
  return mergeGeometries(parts.map(stripUv))!;
}

function stripUv(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', g.getAttribute('position'));
  out.setAttribute('normal', g.getAttribute('normal'));
  return out;
}

export function Camshafts() {
  const { L, angle } = useEngine();
  const M = getMaterials();
  const shafts = useDisposable(
    () =>
      L.kind === 'dohc'
        ? [
            { geo: camshaftGeometry(L, ['intake']), z: -L.camZ },
            { geo: camshaftGeometry(L, ['exhaust']), z: L.camZ },
          ]
        : [{ geo: camshaftGeometry(L, ['intake', 'exhaust']), z: L.kind === 'ohv' ? -L.camZ : 0 }],
    [L],
  );
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    const c = camRotation(angle.value);
    refs.current.forEach((m) => m && (m.rotation.x = c));
  });
  return (
    <Part id="camshaft">
      {shafts.map((sh, k) => (
        <mesh key={k} ref={(m) => (refs.current[k] = m)} geometry={sh.geo} material={M.machinedSteel} position={[0, L.camY, sh.z]} />
      ))}
    </Part>
  );
}

/** Balancín de rodillo: pivote en el origen, rodillo en z = −a, extremo de válvula en z = +b (lado admisión). */
function rockerGeometry(L: EngineLayout): THREE.BufferGeometry {
  const a = L.rockerCamArm;
  const b = L.rockerValveArm;
  const beam = new THREE.Shape();
  beam.moveTo(-a - 0.006, 0.002);
  beam.lineTo(-a - 0.006, 0.014);
  beam.quadraticCurveTo(0, 0.026, b + 0.006, 0.012);
  beam.lineTo(b + 0.006, -0.002);
  beam.lineTo(b - 0.008, -0.002);
  beam.lineTo(b - 0.01, 0.004);
  beam.lineTo(0.016, 0.006);
  beam.absarc(0, 0, 0.016, 0, Math.PI, true);
  beam.lineTo(-a + 0.012, 0.004);
  beam.lineTo(-a - 0.006, 0.002);
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.0095, 0, Math.PI * 2, true);
  beam.holes.push(hole);
  const body = extrudeX(beam, 0.02, 0.0015, 12);
  const cheek = new THREE.Shape();
  cheek.moveTo(-a - 0.012, 0.008);
  cheek.lineTo(-a + 0.012, 0.008);
  cheek.lineTo(-a + 0.012, -0.004);
  cheek.quadraticCurveTo(-a, -0.012, -a - 0.012, -0.004);
  cheek.closePath();
  const c1 = extrudeX(cheek, 0.004, 0.0005, 6);
  c1.translate(0.012, 0, 0);
  const c2 = extrudeX(cheek, 0.004, 0.0005, 6);
  c2.translate(-0.012, 0, 0);
  // tornillo de ajuste con zapata sobre el puente
  const adj = new THREE.CylinderGeometry(0.0045, 0.0045, 0.022, 10);
  adj.translate(0, 0.012, b);
  const ball = new THREE.SphereGeometry(0.0065, 12, 8);
  ball.translate(0, 0.0025, b);
  return mergeGeometries([body, c1, c2, adj.toNonIndexed(), ball.toNonIndexed()].map(stripUv))!;
}

/** Balancín de dedo (SOHC): pivote en el origen, rodillo en z = −a y zapata de válvula en z = −b (lado admisión). */
function fingerGeometry(L: EngineLayout): THREE.BufferGeometry {
  const a = L.rockerCamArm;
  const b = L.rockerValveArm;
  const beam = new THREE.Shape();
  beam.moveTo(0.012, 0.004);
  beam.lineTo(0.012, 0.014);
  beam.quadraticCurveTo(-b * 0.5, 0.024, -b - 0.008, 0.016);
  beam.lineTo(-b - 0.008, 0.002);
  beam.lineTo(-b + 0.01, 0.004);
  beam.lineTo(-a - 0.012, 0.01);
  beam.lineTo(-a + 0.012, 0.01);
  beam.lineTo(-0.01, 0.006);
  beam.absarc(0, 0, 0.011, Math.PI * 0.85, Math.PI * 0.15, true);
  beam.closePath();
  const body = extrudeX(beam, 0.02, 0.0015, 12);
  const cheek = new THREE.Shape();
  cheek.moveTo(-a - 0.012, 0.012);
  cheek.lineTo(-a + 0.012, 0.012);
  cheek.lineTo(-a + 0.012, -0.004);
  cheek.quadraticCurveTo(-a, -0.012, -a - 0.012, -0.004);
  cheek.closePath();
  const c1 = extrudeX(cheek, 0.004, 0.0005, 6);
  c1.translate(0.012, 0, 0);
  const c2 = extrudeX(cheek, 0.004, 0.0005, 6);
  c2.translate(-0.012, 0, 0);
  const ball = new THREE.SphereGeometry(0.0065, 12, 8);
  ball.translate(0, 0.0005, -b);
  return mergeGeometries([body, c1, c2, ball.toNonIndexed()].map(stripUv))!;
}

export function ValvesAndRockers() {
  const { L, states } = useEngine();
  const M = getMaterials();
  const geo = useDisposable(() => {
    const stem = L.valveTipY - L.valveSeatY;
    const rocker = L.kind === 'dohc' ? rockerGeometry(L) : fingerGeometry(L);
    const rockerEx = rocker.clone();
    rockerEx.rotateY(Math.PI);
    const bridge = extrudeX(roundedRectShape(0.016, 0.01, 0.003), L.valvePairDx + 0.022, 0.0015, 6);
    if (L.kind === 'ohv') bridge.rotateY(Math.PI / 2);
    const liftY0 = L.camY + L.camBaseRadius;
    const pushLen = L.rockerPivotY - 0.006 - (liftY0 + 0.04);
    const pushrod = journalGeometry(0.0045, pushLen, 10);
    pushrod.rotateZ(Math.PI / 2);
    pushrod.translate(0, pushLen / 2, 0);
    const lifter = lathe([[0, 0], [0.011, 0], [0.011, 0.04], [0.006, 0.042], [0, 0.042]], 20);
    const cup = new THREE.SphereGeometry(0.0075, 12, 8);
    const roller = journalGeometry(L.rollerRadius, 0.019, 24);
    const springSeatY = L.deckY + L.headHeight * 0.32;
    const retainer = lathe([[0.004, 0], [0.013, 0], [0.013, 0.003], [0.007, 0.008], [0.004, 0.008]], 20);
    return {
      valveI: valveGeometry(L.valveHeadRadius, stem),
      valveE: valveGeometry(L.valveHeadRadius * 0.93, stem),
      spring: springGeometry(0.0115, 0.0018, 7),
      rocker,
      rockerEx,
      bridge,
      roller,
      retainer,
      springSeatY,
      pushrod,
      lifter,
      cup,
      liftY0,
      shaft: journalGeometry(0.0094, L.blockLength - 0.03, 20),
      post: lathe([[0, 0], [0.011, 0], [0.011, L.rockerPivotY - L.headTopY - 0.008], [0.007, L.rockerPivotY - L.headTopY], [0, L.rockerPivotY - L.headTopY]], 20),
      pedestal: extrudeX(roundedRectShape(0.03, L.rockerPivotY - L.headTopY, 0.004, 0, (L.rockerPivotY - L.headTopY) / 2), 0.018, 0.0015, 4),
    };
  }, [L]);

  type CylRefs = { v: THREE.Group[]; s: THREE.Mesh[]; br: THREE.Mesh[]; rk: THREE.Group[]; lf: THREE.Group[] };
  const refs = useRef<CylRefs[]>([]);
  const reg = (i: number) => {
    if (!refs.current[i]) refs.current[i] = { v: [], s: [], br: [], rk: [], lf: [] };
    return refs.current[i];
  };

  useFrame(() => {
    for (let i = 0; i < L.n; i++) {
      const R = refs.current[i];
      if (!R) continue;
      const lifts = [states[i].intakeLift, states[i].exhaustLift];
      for (let s = 0; s < 2; s++) {
        const lift = lifts[s];
        const y = L.valveSeatY - lift;
        for (let k = 0; k < 2; k++) {
          const v = R.v[s * 2 + k];
          if (v) v.position.y = y;
          const sp = R.s[s * 2 + k];
          if (sp) {
            sp.position.y = geo.springSeatY;
            sp.scale.y = L.valveTipY - 0.016 - lift - geo.springSeatY;
          }
        }
        const br = R.br[s];
        if (br) br.position.y = L.valveTipY + 0.005 - lift;
        const rk = R.rk[s];
        if (rk) {
          const rho = rockerAngle(L, lift);
          // DOHC: admisión gira +ρ (rodillo exterior); SOHC (dedo con pivote opuesto): admisión gira −ρ
          if (L.kind === 'ohv') rk.rotation.x = rho;
          else {
            const sgn = L.kind === 'dohc' ? 1 : -1;
            rk.rotation.x = (s === 0 ? rho : -rho) * sgn;
          }
        }
        const lf = R.lf[s];
        if (lf) lf.position.y = (lift * L.rockerCamArm) / L.rockerValveArm;
      }
    }
  });

  return (
    <>
      {L.cylX.map((x, i) => {
        const R = reg(i);
        return (
          <group key={i} position={[x, 0, 0]}>
            {(['intake', 'exhaust'] as Side[]).map((side, s) => {
              const ohv = L.kind === 'ohv';
              const vx = (k: number) => (ohv ? sideSign(side) * L.valveZ : (k * L.valvePairDx) / 2);
              const vz = (k: number) => (ohv ? (k * L.valvePairDx) / 2 : sideSign(side) * L.valveZ);
              const vg = side === 'intake' ? geo.valveI : geo.valveE;
              return (
                <Part key={side} id={side === 'intake' ? 'intakeValves' : 'exhaustValves'} index={i + 1}>
                  {[-1, 1].map((k, kk) => (
                    <group key={k}>
                      <group ref={(el) => el && (R.v[s * 2 + kk] = el)} position={[vx(k), L.valveSeatY, vz(k)]}>
                        <mesh geometry={vg} material={M.valveSteel} />
                        <mesh geometry={geo.retainer} material={M.darkSteel} position={[0, L.valveTipY - L.valveSeatY - 0.016, 0]} />
                      </group>
                      <mesh
                        ref={(el) => el && (R.s[s * 2 + kk] = el)}
                        geometry={geo.spring}
                        material={M.darkSteel}
                        position={[vx(k), geo.springSeatY, vz(k)]}
                      />
                    </group>
                  ))}
                </Part>
              );
            })}
            <Part id="rockers" index={i + 1}>
              {(['intake', 'exhaust'] as Side[]).map((side, s) => {
                const sg = sideSign(side);
                return (
                  <group key={side}>
                    <mesh
                      ref={(el) => el && (R.br[s] = el)}
                      geometry={geo.bridge}
                      material={M.forgedSteel}
                      position={L.kind === 'ohv' ? [sg * L.valveZ, L.valveTipY, 0] : [0, L.valveTipY, sg * L.valveZ]}
                    />
                    <group
                      ref={(el) => el && (R.rk[s] = el)}
                      position={
                        L.kind === 'dohc'
                          ? [0, L.rockerPivotY, sg * L.rockerPivotZ]
                          : L.kind === 'ohv'
                            ? [sg * L.lobeOffset, L.rockerPivotY, L.rockerPivotZ]
                            : [sg * L.lobeOffset, L.rockerPivotY, -sg * L.rockerPivotZ]
                      }
                    >
                      <mesh geometry={side === 'intake' || L.kind === 'ohv' ? geo.rocker : geo.rockerEx} material={M.forgedSteel} />
                      {L.kind === 'ohv' ? (
                        <mesh geometry={geo.cup} material={M.machinedSteel} position={[0, -0.004, -L.rockerCamArm]} />
                      ) : (
                        <mesh geometry={geo.roller} material={M.machinedSteel} position={[0, 0, sg * L.rockerCamArm]} />
                      )}
                    </group>
                    {L.kind === 'ohv' && (
                      <group ref={(el) => el && (R.lf[s] = el)}>
                        <mesh geometry={geo.lifter} material={M.machinedSteel} position={[sg * L.lobeOffset, geo.liftY0, -L.camZ]} />
                        <mesh geometry={geo.pushrod} material={M.valveSteel} position={[sg * L.lobeOffset, geo.liftY0 + 0.04, -L.camZ]} />
                      </group>
                    )}
                  </group>
                );
              })}
            </Part>
          </group>
        );
      })}
      {L.kind === 'sohc' && (
        <Part id="rockers">
          {L.cylX.map((x) =>
            [-1, 1].map((sg) => <mesh key={`${x}${sg}`} geometry={geo.post} material={M.machinedSteel} position={[x + sg * L.lobeOffset, L.headTopY, -sg * L.rockerPivotZ]} />),
          )}
        </Part>
      )}
      {L.kind !== 'sohc' && <Part id="rockers">
        {(L.kind === 'ohv' ? [1] : [-1, 1]).map((sg) => (
          <group key={sg}>
            <mesh geometry={geo.shaft} material={M.machinedSteel} position={[0, L.rockerPivotY, sg * L.rockerPivotZ]} />
            {Array.from({ length: L.n + 1 }, (_, k) => (
              <mesh
                key={k}
                geometry={geo.pedestal}
                material={M.aluminumCast}
                position={[L.cylX[0] - L.pitch / 2 + k * L.pitch, L.headTopY, sg * L.rockerPivotZ]}
              />
            ))}
          </group>
        ))}
      </Part>}
    </>
  );
}

/** Tren de engranajes de distribución (frontal o trasero según la definición): cigüeñal → intermedios → levas. */
export function TimingGears() {
  const { L, angle } = useEngine();
  const M = getMaterials();
  const train = useDisposable(() => {
    const k = L.bore / 0.135;
    const rC = 0.32 * L.bore; // engrane del cigüeñal (también modelado en el cigüeñal)
    const rCam = 2 * rC; // relación 2:1
    const rTop = 0.06 * k;
    const dz = L.camZ;
    const dist = rCam + rTop;
    const yTop = L.camY - Math.sqrt(Math.max(0, dist * dist - dz * dz));
    const rIdle = (yTop - rTop - rC) / 4; // dos intermedios iguales en línea vertical
    const y1 = rC + rIdle;
    const y2 = y1 + 2 * rIdle;
    const m = 0.0024 * k;
    if (L.kind === 'ohv') {
      // árbol en bloque: cigüeñal → intermedio → leva, colineales (mismo sentido, 2:1)
      const dist = Math.hypot(L.camY, L.camZ);
      const rI = (dist - rC - rCam) / 2;
      const ux = L.camY / dist;
      const uz = -L.camZ / dist;
      const ohv = [
        { r: rI, y: ux * (rC + rI), z: uz * (rC + rI), ratio: -rC / rI },
        { r: rCam, y: L.camY, z: -L.camZ, ratio: 0.5 },
      ];
      return ohv.map((g) => ({ ...g, geo: gearGeometry(g.r, Math.max(12, Math.round((2 * g.r) / m)), L.bore * 0.16) }));
    }
    if (L.kind === 'sohc') {
      // cadena vertical: cigüeñal → tres intermedios → leva (relación total 2:1, mismo sentido que el cigüeñal)
      const rI = (L.camY - rC - rCam) / 6;
      const sohc = [
        { r: rI, y: rC + rI, z: 0, ratio: -rC / rI },
        { r: rI, y: rC + 3 * rI, z: 0, ratio: rC / rI },
        { r: rI, y: rC + 5 * rI, z: 0, ratio: -rC / rI },
        { r: rCam, y: L.camY, z: 0, ratio: 0.5 },
      ];
      return sohc.map((g) => ({ ...g, geo: gearGeometry(g.r, Math.max(12, Math.round((2 * g.r) / m)), L.bore * 0.16) }));
    }
    const gears = [
      { r: rIdle, y: y1, z: 0, ratio: -rC / rIdle },
      { r: rIdle, y: y2, z: 0, ratio: rC / rIdle },
      { r: rTop, y: yTop, z: 0, ratio: -rC / rTop },
      { r: rCam, y: L.camY, z: -dz, ratio: 0.5 },
      { r: rCam, y: L.camY, z: dz, ratio: 0.5 },
    ];
    return gears.map((g) => ({ ...g, geo: gearGeometry(g.r, Math.max(12, Math.round((2 * g.r) / m)), L.bore * 0.16) }));
  }, [L]);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    const th = angle.value * DEG;
    train.forEach((g, i) => {
      const m = refs.current[i];
      if (m) m.rotation.x = th * g.ratio;
    });
  });
  const front = L.def.valvetrain.gearTrain === 'front';
  const x = front ? L.front - 0.018 : L.rear + 0.012;
  return (
    <Part id="timingGears">
      {train.map((g, i) => (
        <mesh key={i} ref={(m) => (refs.current[i] = m)} geometry={g.geo} material={g.r === train[train.length - 1].r && g.y === L.camY ? M.machinedSteel : M.darkSteel} position={[x, g.y, g.z]} />
      ))}
    </Part>
  );
}
