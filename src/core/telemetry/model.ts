import type { EngineDefinition } from '@/engines/schema';
import { cylinderInCombustion, firingAngles, localCycleAngle, phaseOf, PHASE_LABEL } from '@/core/kinematics/cycle';
import type { SimState } from '@/core/simulation/clock';

/** Origen de un valor del tablero. */
export type Origin = 'simulado' | 'estimado' | 'demostrativo' | 'especificacion';

export const ORIGIN_LABEL: Record<Origin, string> = {
  simulado: 'SIM',
  estimado: 'EST',
  demostrativo: 'DEMO',
  especificacion: 'ESPEC',
};

export const ORIGIN_HELP: Record<Origin, string> = {
  simulado: 'Exacto según la cinemática de la simulación (no es una medición).',
  estimado: 'Estimado con un modelo simplificado; orden de magnitud realista, no telemetría.',
  demostrativo: 'Valor ilustrativo para explicar tendencias; no proviene de un motor real.',
  especificacion: 'Dato de especificación publicado por el fabricante (ver fuentes).',
};

export interface Reading {
  key: string;
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  origin: Origin;
  decimals?: number;
  text?: string;
}

/** Curva de par normalizada genérica (0–1) en función del régimen. Modelo educativo. */
export function torqueFraction(rpm: number, def: EngineDefinition): number {
  const { idle, peakTorque, ratedPower, max } = def.rpm;
  if (rpm <= idle) return 0.55 * (rpm / idle);
  if (rpm < peakTorque) return 0.55 + 0.45 * ((rpm - idle) / (peakTorque - idle)) ** 0.7;
  if (rpm <= ratedPower) {
    // meseta de par que cae hasta la potencia nominal
    const pRated = (def.nominal.powerKw * 1000) / ((ratedPower * Math.PI) / 30) / def.nominal.torqueNm;
    return 1 + (pRated - 1) * ((rpm - peakTorque) / (ratedPower - peakTorque)) ** 1.6;
  }
  const pRated = (def.nominal.powerKw * 1000) / ((ratedPower * Math.PI) / 30) / def.nominal.torqueNm;
  return Math.max(0, pRated * (1 - (rpm - ratedPower) / (max - ratedPower + 1)));
}

/** Lecturas del tablero a partir del estado de simulación. */
export function readings(def: EngineDefinition, s: SimState): Reading[] {
  const fa = firingAngles(def.firingOrder);
  const rpm = s.rpm;
  const load = s.load;
  const torque = def.nominal.torqueNm * torqueFraction(rpm, def) * load;
  const powerKw = (torque * rpm * Math.PI) / 30 / 1000;
  // BSFC supuesto ~205 g/kWh (orden típico de diésel pesado moderno), densidad 0.835 kg/L
  const bsfc = 205 + 60 * (1 - load) ** 2;
  const fuelLh = rpm > 50 ? (powerKw * bsfc) / 1000 / 0.835 + (rpm / def.rpm.max) * 2.2 : 0;
  const rpmN = Math.min(1, rpm / def.rpm.ratedPower);
  const boost = rpm > 50 ? 280 * load * rpmN ** 1.3 : 0; // kPa manométricos (máx ~280 kPa)
  const oilP = rpm > 50 ? Math.min(450, 140 + 200 * rpmN) * (1 - (s.oilTemp - 20) / 400) : 0;
  const isCR = def.injection.system !== 'eui';
  const fuelP = rpm > 50 ? (isCR ? 60 + 180 * (0.4 * rpmN + 0.6 * load) : 600 * (0.2 + 0.8 * rpmN)) : 0; // MPa riel / kPa alimentación
  const combCyl = cylinderInCombustion(s.angle, fa);
  const phi1 = localCycleAngle(s.angle, fa[0]);
  return [
    { key: 'rpm', label: 'Régimen', value: rpm, unit: 'rpm', min: 0, max: def.rpm.max + 200, origin: 'simulado' },
    { key: 'angle', label: 'Ángulo de cigüeñal', value: s.angle, unit: '°', min: 0, max: 720, origin: 'simulado', decimals: 1 },
    { key: 'cyl', label: 'Cilindro en combustión', value: combCyl, unit: '', min: 1, max: def.cylinders, origin: 'simulado' },
    { key: 'phase', label: 'Etapa (cil. 1)', value: phi1, unit: '°', min: 0, max: 720, origin: 'simulado', text: PHASE_LABEL[phaseOf(phi1)] },
    { key: 'load', label: 'Carga simulada', value: load * 100, unit: '%', min: 0, max: 100, origin: 'simulado' },
    { key: 'torque', label: 'Par estimado', value: torque, unit: 'N·m', min: 0, max: def.nominal.torqueNm * 1.05, origin: 'estimado' },
    { key: 'power', label: 'Potencia estimada', value: powerKw, unit: 'kW', min: 0, max: def.nominal.powerKw * 1.05, origin: 'estimado' },
    { key: 'fuel', label: 'Consumo estimado', value: fuelLh, unit: 'L/h', min: 0, max: 90, origin: 'estimado', decimals: 1 },
    { key: 'boost', label: 'Presión de sobrealimentación', value: boost, unit: 'kPa', min: 0, max: 320, origin: 'demostrativo' },
    { key: 'oilP', label: 'Presión de aceite', value: oilP, unit: 'kPa', min: 0, max: 500, origin: 'demostrativo' },
    {
      key: 'fuelP',
      label: isCR ? 'Presión de riel' : 'Presión de alimentación',
      value: fuelP,
      unit: isCR ? 'MPa' : 'kPa',
      min: 0,
      max: isCR ? 260 : 700,
      origin: 'demostrativo',
    },
    { key: 'coolant', label: 'Temp. refrigerante', value: s.coolantTemp, unit: '°C', min: 0, max: 120, origin: 'demostrativo' },
    { key: 'oilT', label: 'Temp. de aceite', value: s.oilTemp, unit: '°C', min: 0, max: 130, origin: 'demostrativo' },
  ];
}
