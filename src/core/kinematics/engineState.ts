import type { EngineLayout } from '@/engines/derive';
import { DEG, pistonPinHeight, rodAngle, wrapDeg } from './crank';
import { localCycleAngle } from './cycle';
import { combustionIntensity, injectionIntensity, valveLift } from './valvetrain';

/** Estado cinemático completo de un cilindro para un ángulo de cigüeñal. */
export interface CylinderState {
  /** Ángulo local del ciclo φ (grados, 0 = PMS de encendido). */
  phi: number;
  /** Ángulo de la muñequilla desde su PMS (rad). */
  alpha: number;
  pinY: number;
  pinZ: number;
  /** Altura del bulón del pistón. */
  pistonY: number;
  /** Ángulo de la biela alrededor de X (rad). */
  rodRot: number;
  intakeLift: number;
  exhaustLift: number;
  injection: number;
  combustion: number;
}

export function createStates(n: number): CylinderState[] {
  return Array.from({ length: n }, () => ({
    phi: 0,
    alpha: 0,
    pinY: 0,
    pinZ: 0,
    pistonY: 0,
    rodRot: 0,
    intakeLift: 0,
    exhaustLift: 0,
    injection: 0,
    combustion: 0,
  }));
}

/** Rellena `out` (sin asignar memoria) con el estado de cada cilindro para el ángulo `crankDeg`. */
export function computeStates(L: EngineLayout, crankDeg: number, load: number, out: CylinderState[]): CylinderState[] {
  const inj = L.def.injection.event;
  for (let i = 0; i < L.n; i++) {
    const s = out[i];
    const phi = localCycleAngle(crankDeg, L.fireAngles[i]);
    const alpha = wrapDeg(crankDeg - L.pinOffsets[i], 360) * DEG;
    s.phi = phi;
    s.alpha = alpha;
    s.pinY = L.r * Math.cos(alpha);
    s.pinZ = L.r * Math.sin(alpha);
    s.pistonY = pistonPinHeight(alpha, L.r, L.l);
    // la biela va de la muñequilla (z = r·sinα) al bulón (z = 0): rotación negativa
    s.rodRot = -rodAngle(alpha, L.r, L.l);
    s.intakeLift = valveLift(phi, L.intake);
    s.exhaustLift = valveLift(phi, L.exhaust);
    s.injection = injectionIntensity(phi, inj, load);
    s.combustion = combustionIntensity(phi, inj, load);
  }
  return out;
}

/** Ángulo de rotación del árbol de levas (rad) alrededor de X. */
export function camRotation(crankDeg: number): number {
  return (crankDeg / 2) * DEG;
}

/** Ángulo del balancín (rad) para una alzada de válvula dada: sin ρ = alzadaLeva / a, alzadaLeva = alzada / (b/a). */
export function rockerAngle(L: EngineLayout, valveLiftM: number): number {
  const camLift = (valveLiftM * L.rockerCamArm) / L.rockerValveArm;
  return Math.asin(Math.min(1, camLift / L.rockerCamArm));
}

/** Desplazamiento real del extremo de válvula del balancín para un ángulo ρ. */
export function rockerValveDrop(L: EngineLayout, rho: number): number {
  return L.rockerValveArm * Math.sin(rho);
}
