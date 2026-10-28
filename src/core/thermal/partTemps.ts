import type { PartId } from '@/engines/parts';

/**
 * Modelo térmico EDUCATIVO de componentes para la vista THERMAL VIEW.
 *
 * No es un análisis térmico industrial validado ni hay datos medidos: son estimaciones de orden
 * de magnitud a partir del estado de la simulación (temperaturas demostrativas de refrigerante y
 * aceite, carga y régimen) con rangos típicos de diésel pesado descritos en la literatura general:
 *  - gases de escape antes de la turbina: ~150–250 °C en ralentí, ~500–650 °C a plena carga;
 *  - corona del pistón de aluminio/acero: ~200–350 °C a plena carga;
 *  - válvula de escape: la pieza móvil más caliente, cercana a la temperatura de escape;
 *  - aire de carga tras el intercooler: ~40–60 °C.
 * Todos los valores se marcan en la interfaz como ESTIMADOS.
 */

export interface ThermalInputs {
  running: boolean;
  /** Carga 0–1. */
  load: number;
  /** Régimen relativo a la potencia nominal (0–1+). */
  rpmN: number;
  coolantTemp: number;
  oilTemp: number;
  /** Temperatura de gases de escape estimada (°C), con inercia (ver SimulationDriver). */
  egt: number;
  ambient?: number;
}

/** Clave térmica: una pieza o una zona de pieza (p. ej. lado compresor/turbina del turbo). */
export type ThermalKey = PartId | 'turboCompressor' | 'turboTurbine' | 'pistonCrown';

/** Temperatura objetivo de los gases de escape (°C) para la carga y el régimen. */
export function egtTarget(running: boolean, load: number, rpmN: number, ambient = 22): number {
  if (!running) return ambient;
  return 160 + 470 * Math.min(1, load) ** 0.85 * (0.55 + 0.45 * Math.min(1, rpmN));
}

/** Estimación de temperatura (°C) de cada zona. */
export function partTemperatures(i: ThermalInputs): Record<ThermalKey, number> {
  const amb = i.ambient ?? 22;
  // factor de calentamiento 0 (frío) – 1 (temperatura de régimen), a partir del refrigerante
  const w = Math.min(1, Math.max(0, (i.coolantTemp - amb) / (88 - amb)));
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const ch = Math.max(amb, i.coolantTemp);
  const oil = Math.max(amb, i.oilTemp);
  const egt = Math.max(amb, i.egt);
  const crown = lerp(oil, 200 + 140 * i.load, i.running ? w : 0);
  const boostN = i.running ? i.load * Math.min(1, i.rpmN) : 0;
  const compressorOut = amb + 150 * boostN;
  const chargeAir = lerp(amb, amb + 15 + 30 * boostN, w);
  return {
    block: ch + 4,
    liner: ch + (i.running ? 15 + 25 * i.load : 0) * w,
    head: ch + (i.running ? 12 + 25 * i.load : 0) * w,
    valveCover: oil - 6,
    piston: lerp(oil, 150 + 110 * i.load, i.running ? w : 0),
    pistonCrown: crown,
    rings: lerp(oil, 140 + 80 * i.load, i.running ? w : 0),
    rod: oil + 8,
    crankshaft: oil + 6,
    mainBearings: oil + 10,
    camshaft: oil + 4,
    intakeValves: lerp(oil, 220 + 120 * i.load, i.running ? w : 0),
    exhaustValves: lerp(oil, Math.min(egt + 40, 300 + 380 * i.load), i.running ? w : 0),
    rockers: oil + 2,
    timingGears: oil,
    injector: ch + 18 * w,
    fuelRail: amb + 30 * w,
    fuelPump: amb + 25 * w,
    fuelFilter: amb + 15 * w,
    intakeManifold: chargeAir,
    exhaustManifold: egt,
    turbo: (egt + compressorOut) / 2,
    turboTurbine: egt - 30 * boostN,
    turboCompressor: compressorOut,
    intercooler: (compressorOut + chargeAir) / 2,
    egr: egt * 0.6,
    oilPump: oil,
    oilPan: oil - 4,
    oilFilter: oil - 2,
    waterPump: ch - 6,
    thermostat: ch,
    flywheel: amb + 20 * w,
    damper: amb + 30 * w,
    aftertreatment: Math.max(amb, egt - 70),
  };
}

/** Escala de la vista térmica (°C). */
export const THERMAL_MIN = 20;
export const THERMAL_MAX = 650;

/** Paleta tipo «ironbow» de cámara termográfica (negro azulado → violeta → rojo → naranja → amarillo claro). */
const STOPS: [number, [number, number, number]][] = [
  [0, [0.05, 0.06, 0.16]],
  [0.15, [0.18, 0.1, 0.48]],
  [0.35, [0.62, 0.12, 0.52]],
  [0.55, [0.9, 0.25, 0.18]],
  [0.75, [1.0, 0.56, 0.08]],
  [0.9, [1.0, 0.85, 0.3]],
  [1, [1.0, 0.98, 0.85]],
];

export function thermalColor(tempC: number, out: { r: number; g: number; b: number }): void {
  const t = Math.min(1, Math.max(0, (tempC - THERMAL_MIN) / (THERMAL_MAX - THERMAL_MIN)));
  // escala logarítmica suave: separa mejor las piezas a 20–120 °C (la mayoría)
  const u = Math.log1p(9 * t) / Math.log(10);
  for (let i = 1; i < STOPS.length; i++) {
    if (u <= STOPS[i][0]) {
      const [t0, c0] = STOPS[i - 1];
      const [t1, c1] = STOPS[i];
      const k = (u - t0) / (t1 - t0);
      out.r = c0[0] + (c1[0] - c0[0]) * k;
      out.g = c0[1] + (c1[1] - c0[1]) * k;
      out.b = c0[2] + (c1[2] - c0[2]) * k;
      return;
    }
  }
  [out.r, out.g, out.b] = STOPS[STOPS.length - 1][1];
}

/** Posición (0–1) de una temperatura en la barra de la leyenda, con la misma escala que los colores. */
export function thermalScalePos(tempC: number): number {
  const t = Math.min(1, Math.max(0, (tempC - THERMAL_MIN) / (THERMAL_MAX - THERMAL_MIN)));
  return Math.log1p(9 * t) / Math.log(10);
}
