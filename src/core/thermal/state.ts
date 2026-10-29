import { create } from 'zustand';
import { partTemperatures, type ThermalKey } from './partTemps';
import type { SimState } from '@/core/simulation/clock';

/** Últimas temperaturas estimadas por zona (se recalculan a baja frecuencia, no por frame). */
export const thermal: { temps: Record<ThermalKey, number> } = {
  temps: partTemperatures({ running: false, load: 0, rpmN: 0, coolantTemp: 22, oilTemp: 22, egt: 22 }),
};

/** Contador que avisa a las piezas de que hay temperaturas nuevas (vista térmica). */
export const useThermalTick = create<{ version: number }>(() => ({ version: 0 }));

export function updateThermal(s: SimState, running: boolean, ratedRpm: number): void {
  thermal.temps = partTemperatures({ running: running && s.rpm > 50, load: s.load, rpmN: s.rpm / ratedRpm, coolantTemp: s.coolantTemp, oilTemp: s.oilTemp, egt: s.egt });
  useThermalTick.setState((t) => ({ version: t.version + 1 }));
}
