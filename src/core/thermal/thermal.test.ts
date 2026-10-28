import { describe, expect, it } from 'vitest';
import { egtTarget, partTemperatures, thermalColor, thermalScalePos, THERMAL_MAX, THERMAL_MIN } from './partTemps';

const cold = { running: false, load: 0, rpmN: 0, coolantTemp: 22, oilTemp: 22, egt: 22 };
const hot = { running: true, load: 1, rpmN: 1, coolantTemp: 88, oilTemp: 100, egt: egtTarget(true, 1, 1) };

describe('modelo térmico educativo', () => {
  it('motor frío: todo a temperatura ambiente', () => {
    const t = partTemperatures(cold);
    for (const v of Object.values(t)) expect(v).toBeLessThan(40);
  });

  it('a plena carga el escape es lo más caliente y el refrigerante queda cerca de 90 °C', () => {
    const t = partTemperatures(hot);
    expect(t.exhaustManifold).toBeGreaterThan(t.head);
    expect(t.turboTurbine).toBeGreaterThan(t.turboCompressor);
    expect(t.pistonCrown).toBeGreaterThan(t.piston);
    expect(t.thermostat).toBeGreaterThan(80);
    expect(t.thermostat).toBeLessThan(100);
  });

  it('la temperatura de escape objetivo crece con la carga', () => {
    expect(egtTarget(true, 1, 1)).toBeGreaterThan(egtTarget(true, 0.2, 1));
    expect(egtTarget(false, 1, 1)).toBeLessThan(50);
  });

  it('escala: límites, monotonía y colores válidos', () => {
    expect(thermalScalePos(THERMAL_MIN)).toBe(0);
    expect(thermalScalePos(THERMAL_MAX)).toBeCloseTo(1);
    expect(thermalScalePos(9999)).toBeCloseTo(1);
    let prev = -1;
    for (let t = 0; t <= 700; t += 25) {
      const p = thermalScalePos(t);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
      const c = { r: 0, g: 0, b: 0 };
      thermalColor(t, c);
      for (const v of [c.r, c.g, c.b]) expect(v >= 0 && v <= 1).toBe(true);
    }
  });
});
