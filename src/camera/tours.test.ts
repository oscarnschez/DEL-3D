import { describe, expect, it } from 'vitest';
import { jumpRun, startRun, stepRun } from './tourRun';
import { MAIN_TOURS, TOURS } from './tourDefs';
import { ENGINES } from '@/engines/catalog';
import { deriveLayout } from '@/engines/derive';
import { PARTS, parsePartKey } from '@/engines/parts';
import { fitDistance } from './fit';

const go = { paused: false, moving: false, hold: 1 };

describe('recorridos: reproducción', () => {
  it('enter → move (espera a la cámara) → hold → siguiente → done', () => {
    let r = startRun(2);
    r = stepRun(r, 0.1, go);
    expect(r.phase).toBe('move');
    r = stepRun(r, 0.1, { ...go, moving: true });
    expect(r.phase).toBe('move');
    r = stepRun(r, 0.1, go);
    expect(r.phase).toBe('hold');
    r = stepRun(r, 0.6, go);
    expect(r.phase).toBe('hold');
    r = stepRun(r, 0.6, go);
    expect(r).toMatchObject({ index: 1, phase: 'enter' });
    for (let i = 0; i < 10; i++) r = stepRun(r, 0.6, go);
    expect(r.phase).toBe('done');
  });

  it('en pausa no avanza y al reanudar continúa donde estaba', () => {
    let r = stepRun(stepRun(startRun(3), 0, go), 0, go);
    r = stepRun(r, 0.5, go);
    const held = r.held;
    for (let i = 0; i < 50; i++) r = stepRun(r, 1, { ...go, paused: true });
    expect(r.held).toBe(held);
    r = stepRun(r, 0.6, go);
    expect(r.index).toBe(1);
  });

  it('la duración configurada escala la permanencia', () => {
    let fast = stepRun(stepRun(startRun(2), 0, go), 0, go);
    let slow = fast;
    fast = stepRun(fast, 1.2, { ...go, hold: 1 * 0.5 });
    slow = stepRun(slow, 1.2, { ...go, hold: 1 * 2 });
    expect(fast.index).toBe(1);
    expect(slow.index).toBe(0);
  });

  it('saltos acotados y recorrido vacío', () => {
    expect(jumpRun(startRun(4), 9).index).toBe(3);
    expect(jumpRun(startRun(4), -2).index).toBe(0);
    expect(startRun(0).phase).toBe('done');
  });
});

describe('recorridos: definiciones', () => {
  it('existen los seis recorridos requeridos', () => {
    for (const id of MAIN_TOURS) expect(TOURS.find((t) => t.id === id)).toBeDefined();
  });

  it('todos los planos son válidos para todos los motores', () => {
    for (const def of ENGINES) {
      const L = deriveLayout(def);
      for (const t of TOURS) {
        const shots = t.shots(L);
        expect(shots.length).toBeGreaterThan(0);
        for (const s of shots) {
          for (const v of [...s.pos, ...s.target]) expect(Number.isFinite(v)).toBe(true);
          expect(s.hold).toBeGreaterThan(0);
          expect(s.caption.length).toBeGreaterThan(5);
          if (s.select) expect(PARTS[parsePartKey(s.select).id]).toBeDefined();
        }
      }
    }
  });

  it('el despiece animado termina reensamblado (despiece 0)', () => {
    const shots = TOURS.find((t) => t.id === 'despiece')!.shots(deriveLayout(ENGINES[0]));
    expect(shots[shots.length - 1].explode).toBe(0);
  });
});

describe('cámara', () => {
  it('distancia de encuadre: mayor con objetos grandes y pantallas estrechas', () => {
    expect(fitDistance(1, 38, 1.6)).toBeLessThan(fitDistance(2, 38, 1.6));
    expect(fitDistance(1, 38, 0.6)).toBeGreaterThan(fitDistance(1, 38, 1.6));
    // la esfera cabe: distancia ≥ radio / sin(fov/2)
    expect(fitDistance(1, 38, 2, 1)).toBeCloseTo(1 / Math.sin((19 * Math.PI) / 180), 6);
  });
});
