import { beforeEach, describe, expect, it } from 'vitest';
import { advanceCrank, degreesFor, resetSim, setCrankAngle, sim, stepRpm } from './clock';

describe('reloj de simulación', () => {
  beforeEach(() => resetSim());

  it('avance hacia delante y hacia atrás mantiene ángulo en [0,720) y revoluciones coherentes', () => {
    advanceCrank(700);
    expect(sim.angle).toBeCloseTo(700);
    advanceCrank(40);
    expect(sim.angle).toBeCloseTo(20);
    expect(sim.revs).toBeCloseTo(740 / 360);
    advanceCrank(-50);
    expect(sim.angle).toBeCloseTo(690);
    expect(sim.revs).toBeCloseTo(690 / 360);
  });

  it('arrastre de la línea de tiempo: camino más corto', () => {
    setCrankAngle(10);
    expect(sim.revs).toBeCloseTo(10 / 360);
    setCrankAngle(700); // de 10 a 700: −30° (no +690°)
    expect(sim.angle).toBeCloseTo(700);
    expect(sim.revs).toBeCloseTo(-20 / 360);
  });

  it('régimen: respuesta de primer orden y parada completa', () => {
    let r = 0;
    for (let i = 0; i < 600; i++) r = stepRpm(r, 1200, 1 / 60, true);
    expect(r).toBeGreaterThan(1150);
    for (let i = 0; i < 600; i++) r = stepRpm(r, 0, 1 / 60, false);
    expect(r).toBe(0);
  });

  it('grados por intervalo a régimen dado', () => {
    expect(degreesFor(600, 1)).toBeCloseTo(3600);
  });
});
