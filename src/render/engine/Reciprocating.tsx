import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Part } from '@/interaction/Part';
import { DEG } from '@/core/kinematics/crank';
import { getMaterials } from '../materials';
import { useDisposable } from '../resources';
import {
  crankWebShape,
  extrudeX,
  gearGeometry,
  journalGeometry,
  lathe,
  pistonGeometry,
  ringsGeometry,
  rodGeometry,
  wristPinGeometry,
} from '../geometry/builders';
import { useEngine } from './useEngine';

/** Cigüeñal completo: muñones de bancada, muñequillas a 120°, brazos con contrapesos, nariz y brida. */
export function Crankshaft() {
  const { L, angle } = useEngine();
  const M = getMaterials();
  const ref = useRef<THREE.Group>(null);
  const geo = useDisposable(() => {
    const mainLen = L.bore * 0.3;
    const pinLen = L.bore * 0.42;
    const webT = (L.pitch - mainLen - pinLen) / 2 - 0.001;
    const web = extrudeX(crankWebShape(L.r, L.mainJournalRadius, L.pinRadius, L.r * 1.12), webT, 0.003, 8);
    return {
      main: journalGeometry(L.mainJournalRadius, mainLen + 0.004),
      pin: journalGeometry(L.pinRadius, pinLen + 0.004),
      web,
      webT,
      mainLen,
      pinLen,
      nose: journalGeometry(L.mainJournalRadius * 0.7, L.bore),
      flange: lathe([[0, -0.012], [L.mainJournalRadius * 1.5, -0.012], [L.mainJournalRadius * 1.55, 0], [L.mainJournalRadius * 1.5, 0.012], [0, 0.012]], 48).rotateZ(
        -Math.PI / 2,
      ),
      gear: gearGeometry(L.bore * 0.32, 36, L.bore * 0.18),
      tail: journalGeometry(L.mainJournalRadius * 0.85, 0.07),
    };
  }, [L]);

  useFrame(() => {
    if (ref.current) ref.current.rotation.x = angle.value * DEG;
  });

  return (
    <Part id="crankshaft">
      <group ref={ref}>
        {/* muñones de bancada: uno entre cada par de cilindros y en los extremos (n + 1) */}
        {Array.from({ length: L.n + 1 }, (_, k) => (
          <mesh key={`m${k}`} geometry={geo.main} material={M.machinedSteel} position={[L.cylX[0] - L.pitch / 2 + k * L.pitch, 0, 0]} />
        ))}
        {L.cylX.map((x, i) => {
          const off = -L.pinOffsets[i] * DEG;
          const dx = geo.pinLen / 2 + geo.webT / 2 + 0.0005;
          return (
            <group key={i} position={[x, 0, 0]} rotation={[off, 0, 0]}>
              <mesh geometry={geo.pin} material={M.machinedSteel} position={[0, L.r, 0]} />
              <mesh geometry={geo.web} material={M.forgedSteel} position={[-dx, 0, 0]} />
              <mesh geometry={geo.web} material={M.forgedSteel} position={[dx, 0, 0]} />
            </group>
          );
        })}
        <mesh geometry={geo.nose} material={M.machinedSteel} position={[L.cylX[0] - L.pitch / 2 - L.bore * 0.55, 0, 0]} />
        <mesh geometry={geo.gear} material={M.darkSteel} position={[L.def.valvetrain.gearTrain === 'front' ? L.front - 0.018 : L.rear + 0.012, 0, 0]} />
        <mesh geometry={geo.tail} material={M.machinedSteel} position={[L.rear + 0.01, 0, 0]} />
        <mesh geometry={geo.flange} material={M.machinedSteel} position={[L.rear + (L.def.valvetrain.gearTrain === 'rear' ? 0.025 : -0.015), 0, 0]} />
      </group>
    </Part>
  );
}

/** Pistones, anillos, bulones y bielas de todos los cilindros con cinemática exacta. */
export function PistonsAndRods() {
  const { L, states } = useEngine();
  const M = getMaterials();
  const g = L.def.geometry;
  const geo = useDisposable(() => {
    const wristR = L.bore * 0.19;
    return {
      piston: pistonGeometry(L.bore, g.compressionHeight),
      rings: ringsGeometry(L.bore, g.compressionHeight),
      pin: wristPinGeometry(L.bore),
      rod: rodGeometry(L.l, L.pinRadius, wristR, L.bore * 0.38),
      bolt: (() => {
        const b = journalGeometry(0.0065, 0.07, 12);
        b.rotateZ(Math.PI / 2);
        return b;
      })(),
    };
  }, [L, g.compressionHeight]);
  const pistons = useRef<(THREE.Group | null)[]>([]);
  const rods = useRef<(THREE.Group | null)[]>([]);

  useFrame(() => {
    for (let i = 0; i < L.n; i++) {
      const s = states[i];
      const p = pistons.current[i];
      if (p) p.position.y = s.pistonY;
      const r = rods.current[i];
      if (r) {
        r.position.set(0, s.pinY, s.pinZ);
        r.rotation.x = s.rodRot;
      }
    }
  });

  return (
    <>
      {L.cylX.map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          <Part id="piston" index={i + 1}>
            <group ref={(el) => (pistons.current[i] = el)}>
              <mesh geometry={geo.piston} material={M.pistonAlloy} />
              <mesh geometry={geo.pin} material={M.machinedSteel} />
            </group>
          </Part>
          <Part id="rings" index={i + 1}>
            <RingFollower index={i} geometry={geo.rings} />
          </Part>
          <Part id="rod" index={i + 1}>
            <group ref={(el) => (rods.current[i] = el)}>
              <mesh geometry={geo.rod} material={M.forgedSteel} />
              {[-1, 1].map((sgn) => (
                <mesh key={sgn} geometry={geo.bolt} material={M.bolt} position={[0, -0.006, sgn * (L.pinRadius + 0.006)]} />
              ))}
            </group>
          </Part>
        </group>
      ))}
    </>
  );
}

function RingFollower({ index, geometry }: { index: number; geometry: THREE.BufferGeometry }) {
  const { states } = useEngine();
  const M = getMaterials();
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (ref.current) ref.current.position.y = states[index].pistonY;
  });
  return <mesh ref={ref} geometry={geometry} material={M.darkSteel} />;
}

/** Volante con corona dentada en la parte trasera del cigüeñal. */
export function Flywheel() {
  const { L, angle } = useEngine();
  const M = getMaterials();
  const ref = useRef<THREE.Group>(null);
  const geo = useDisposable(() => {
    const R = L.bore * 1.95;
    const disc = lathe(
      [
        [0, -0.03],
        [R * 0.35, -0.03],
        [R * 0.4, -0.038],
        [R * 0.92, -0.038],
        [R * 0.95, -0.03],
        [R * 0.95, 0.03],
        [R * 0.6, 0.03],
        [R * 0.55, 0.02],
        [R * 0.2, 0.02],
        [0, 0.02],
      ],
      72,
    );
    disc.rotateZ(-Math.PI / 2);
    const ring = gearGeometry(R * 0.985, 120, 0.028, 0.93);
    return { disc, ring, R };
  }, [L]);
  useFrame(() => {
    if (ref.current) ref.current.rotation.x = angle.value * DEG;
  });
  const x = L.rear + (L.def.valvetrain.gearTrain === 'rear' ? 0.075 : 0.035);
  return (
    <Part id="flywheel">
      <group ref={ref} position={[x, 0, 0]}>
        <mesh geometry={geo.disc} material={M.machinedSteel} />
        <mesh geometry={geo.ring} material={M.darkSteel} position={[0.012, 0, 0]} />
        {Array.from({ length: 8 }, (_, k) => {
          const a = (k / 8) * Math.PI * 2;
          return (
            <mesh key={k} material={M.bolt} position={[-0.035, Math.cos(a) * geo.R * 0.25, Math.sin(a) * geo.R * 0.25]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.008, 0.008, 0.012, 6]} />
            </mesh>
          );
        })}
      </group>
    </Part>
  );
}

/** Amortiguador de vibraciones torsionales y polea en la nariz del cigüeñal. */
export function Damper() {
  const { L, angle } = useEngine();
  const M = getMaterials();
  const ref = useRef<THREE.Group>(null);
  const geo = useDisposable(() => {
    const R = L.bore * 1.25;
    const body = lathe(
      [
        [0, -0.045],
        [R * 0.3, -0.045],
        [R * 0.32, -0.04],
        [R, -0.04],
        [R, 0.04],
        [R * 0.3, 0.04],
        [R * 0.25, 0.06],
        [0, 0.06],
      ],
      64,
    );
    body.rotateZ(-Math.PI / 2);
    // poleas acanaladas (banda poly-V)
    const grooves: [number, number][] = [];
    const Rp = R * 0.78;
    grooves.push([0, -0.03]);
    for (let k = 0; k <= 8; k++) grooves.push([k % 2 ? Rp - 0.004 : Rp, -0.03 + k * 0.0045]);
    grooves.push([0, 0.006]);
    const pulley = lathe(grooves, 64);
    pulley.rotateZ(-Math.PI / 2);
    return { body, pulley };
  }, [L]);
  useFrame(() => {
    if (ref.current) ref.current.rotation.x = angle.value * DEG;
  });
  return (
    <Part id="damper">
      <group ref={ref} position={[L.front - L.bore * 0.9, 0, 0]}>
        <mesh geometry={geo.body} material={M.blackPaint} />
        <mesh geometry={geo.pulley} material={M.zinc} position={[0.075, 0, 0]} />
      </group>
    </Part>
  );
}
