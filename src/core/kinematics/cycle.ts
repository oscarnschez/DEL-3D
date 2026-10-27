import { wrapDeg } from './crank';

/** Fases nominales del ciclo de cuatro tiempos, por ángulo local φ (0 = PMS de encendido). */
export type StrokePhase = 'expansion' | 'escape' | 'admision' | 'compresion';

export const PHASE_LABEL: Record<StrokePhase, string> = {
  admision: 'Admisión',
  compresion: 'Compresión',
  expansion: 'Combustión / expansión',
  escape: 'Escape',
};

export const PHASE_COLOR: Record<StrokePhase, string> = {
  admision: '#3fa9ff',
  compresion: '#36e0c8',
  expansion: '#ff8a2a',
  escape: '#9aa3ad',
};

/**
 * Ángulo de encendido (grados, 0–720) de cada cilindro a partir del orden de encendido.
 * Supone encendido equiespaciado (720/N), como en todo motor de 4 tiempos en línea de 6 cilindros.
 * Devuelve un arreglo indexado por número de cilindro − 1.
 */
export function firingAngles(firingOrder: number[]): number[] {
  const n = firingOrder.length;
  const interval = 720 / n;
  const out = new Array<number>(n).fill(0);
  firingOrder.forEach((cyl, idx) => {
    out[cyl - 1] = idx * interval;
  });
  return out;
}

/** Ángulo local de ciclo φ ∈ [0,720) del cilindro con ángulo de encendido `fireAngle`. */
export function localCycleAngle(crankDeg: number, fireAngle: number): number {
  return wrapDeg(crankDeg - fireAngle, 720);
}

export function phaseOf(phi: number): StrokePhase {
  const p = wrapDeg(phi, 720);
  if (p < 180) return 'expansion';
  if (p < 360) return 'escape';
  if (p < 540) return 'admision';
  return 'compresion';
}

/** Cilindro (1-based) cuyo ángulo local está más cerca de su PMS de encendido dentro de la ventana de combustión. */
export function cylinderInCombustion(crankDeg: number, fireAngles: number[], windowDeg = 120): number {
  let best = 1;
  let bestPhi = Infinity;
  fireAngles.forEach((fa, i) => {
    const phi = localCycleAngle(crankDeg, fa);
    // ventana: desde ~20° antes del PMS (inicio de inyección) hasta windowDeg después
    const shifted = wrapDeg(phi + 20, 720);
    if (shifted < windowDeg + 20 && shifted < bestPhi) {
      bestPhi = shifted;
      best = i + 1;
    }
  });
  return best;
}

/** Siguiente ángulo de cigüeñal (> current) en que algún cilindro alcanza un límite de fase. */
export function nextPhaseBoundary(crankDeg: number, fireAngles: number[]): number {
  let next = Infinity;
  for (const fa of fireAngles) {
    for (let b = 0; b < 720; b += 180) {
      const target = fa + b;
      let delta = wrapDeg(target - crankDeg, 720);
      if (delta < 1e-6) delta = 720;
      next = Math.min(next, delta);
    }
  }
  return crankDeg + next;
}
