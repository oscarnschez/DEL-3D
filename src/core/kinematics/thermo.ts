import { DEG, cylinderVolume, wrapDeg } from './crank';
import type { EngineLayout } from '@/engines/derive';

/**
 * Modelo termodinámico EDUCATIVO del gas en el cilindro (no es una simulación validada):
 * compresión/expansión politrópica (n = 1.35) más una liberación de calor tipo Wiebe
 * alrededor del PMS de encendido. Sirve para colorear la cámara y mostrar tendencias.
 */
export interface GasState {
  /** Temperatura (K). */
  T: number;
  /** Presión (bar, absoluta). */
  p: number;
  /** Fracción de gases quemados (0–1). */
  burned: number;
}

const N_POLY = 1.35;

function wiebe(theta: number, start: number, dur: number): number {
  if (theta <= start) return 0;
  const x = Math.min(1, (theta - start) / dur);
  return 1 - Math.exp(-5 * x ** 2.2);
}

export function gasState(L: EngineLayout, phi: number, load: number, boostBar: number): GasState {
  const g = L.def.geometry;
  const p = wrapDeg(phi, 720);
  // ángulo de muñequilla correspondiente (PMS en φ = 0 y 360)
  const vol = (ph: number) => cylinderVolume((ph % 360) * DEG, g.bore, L.r, L.l, g.compressionRatio);
  const pIntake = 1 + boostBar;
  const Tintake = 315 + 25 * boostBar; // tras el intercooler
  const Vbdc = vol(180);
  const soi = -L.def.injection.event.soiBTDC;
  const start = soi + 5;
  const dur = 45 + 25 * load;
  // admisión: φ 360–540 (presión ≈ múltiple)
  if (p >= 360 && p < 540) return { T: Tintake, p: pIntake, burned: Math.max(0, 1 - (p - 360) / 40) * 0.15 };
  // compresión: 540–720 politrópica desde PMI
  const compress = (ph: number) => {
    const V = vol(ph);
    return { T: Tintake * (Vbdc / V) ** (N_POLY - 1), p: pIntake * (Vbdc / V) ** N_POLY };
  };
  if (p >= 540) {
    const c = compress(p);
    // la combustión empieza ligeramente antes del PMS
    const rel = p - 720;
    const xb = wiebe(rel, start, dur);
    const dT = xb * (900 + 900 * load);
    return { T: c.T + dT, p: c.p * (1 + dT / c.T), burned: xb };
  }
  // expansión 0–180 y escape 180–360
  const atTdc = compress(719.999);
  const xb = wiebe(p, start, dur);
  const dT = xb * (900 + 900 * load);
  const Tpeak = atTdc.T + dT;
  const ppeak = atTdc.p * (1 + dT / atTdc.T);
  const Vtdc = vol(0);
  if (p < 180) {
    const V = vol(p);
    const ratio = Vtdc / V;
    return { T: Tpeak * ratio ** (N_POLY - 1), p: ppeak * ratio ** N_POLY, burned: xb };
  }
  // escape: la presión cae rápidamente al abrir la válvula; temperatura cae gradualmente
  const Tevo = Tpeak * (Vtdc / Vbdc) ** (N_POLY - 1);
  const t = (p - 180) / 180;
  return { T: Tevo * (1 - 0.25 * t), p: 1 + boostBar * 0.9 + 1.5 * (1 - t) ** 4, burned: 1 - 0.2 * t };
}

/** Rampa de color por temperatura (K) para la visualización térmica. */
export function tempColor(T: number, out: { r: number; g: number; b: number }): void {
  const stops: [number, [number, number, number]][] = [
    [290, [0.12, 0.35, 1.0]],
    [500, [0.1, 0.85, 0.95]],
    [800, [0.95, 0.85, 0.2]],
    [1300, [1.0, 0.45, 0.08]],
    [2000, [1.0, 0.12, 0.04]],
    [2600, [1.0, 0.9, 0.8]],
  ];
  if (T <= stops[0][0]) {
    [out.r, out.g, out.b] = stops[0][1];
    return;
  }
  for (let i = 1; i < stops.length; i++) {
    if (T <= stops[i][0]) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      const k = (T - t0) / (t1 - t0);
      out.r = c0[0] + (c1[0] - c0[0]) * k;
      out.g = c0[1] + (c1[1] - c0[1]) * k;
      out.b = c0[2] + (c1[2] - c0[2]) * k;
      return;
    }
  }
  [out.r, out.g, out.b] = stops[stops.length - 1][1];
}
