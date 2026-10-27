import { describe, expect, it } from 'vitest';
import { DEG, pistonDisplacement, pistonPinHeight, pistonVelocity, rodAngle } from './crank';
import { cylinderInCombustion, firingAngles, localCycleAngle, phaseOf } from './cycle';
import { valveLift } from './valvetrain';
import { computeStates, createStates } from './engineState';
import { deriveLayout } from '@/engines/derive';
import { ENGINES } from '@/engines/catalog';

const r = 0.0825;
const l = 0.27;

describe('biela-manivela', () => {
  it('PMS y PMI exactos', () => {
    expect(pistonPinHeight(0, r, l)).toBeCloseTo(r + l, 10);
    expect(pistonPinHeight(Math.PI, r, l)).toBeCloseTo(l - r, 10);
    expect(pistonDisplacement(Math.PI, r, l)).toBeCloseTo(2 * r, 10);
  });
  it('la biela está vertical en PMS y PMI', () => {
    expect(rodAngle(0, r, l)).toBeCloseTo(0, 12);
    expect(rodAngle(Math.PI, r, l)).toBeCloseTo(0, 12);
  });
  it('la posición a 90° está por debajo de la media carrera (efecto de la biela finita)', () => {
    expect(pistonDisplacement(90 * DEG, r, l)).toBeGreaterThan(r);
  });
  it('la velocidad coincide con la derivada numérica', () => {
    const w = 1800 * (2 * Math.PI) / 60;
    for (const deg of [10, 45, 80, 120, 200, 300]) {
      const a = deg * DEG;
      const h = 1e-6;
      const num = ((pistonPinHeight(a + h, r, l) - pistonPinHeight(a - h, r, l)) / (2 * h)) * w;
      expect(pistonVelocity(a, r, l, w)).toBeCloseTo(num, 4);
    }
  });
});

describe('ciclo de cuatro tiempos I6', () => {
  const fa = firingAngles([1, 5, 3, 6, 2, 4]);
  it('encendido cada 120° con orden 1-5-3-6-2-4', () => {
    expect(fa).toEqual([0, 480, 240, 600, 120, 360]);
  });
  it('muñequillas pareadas 1-6, 2-5, 3-4', () => {
    const off = fa.map((a) => a % 360);
    expect(off[0]).toBe(off[5]);
    expect(off[1]).toBe(off[4]);
    expect(off[2]).toBe(off[3]);
  });
  it('fases del cilindro 1 en un ciclo de 720°', () => {
    expect(phaseOf(localCycleAngle(10, fa[0]))).toBe('expansion');
    expect(phaseOf(localCycleAngle(200, fa[0]))).toBe('escape');
    expect(phaseOf(localCycleAngle(400, fa[0]))).toBe('admision');
    expect(phaseOf(localCycleAngle(600, fa[0]))).toBe('compresion');
  });
  it('secuencia de cilindros en combustión sigue el orden de encendido', () => {
    const seq: number[] = [];
    for (let a = 5; a < 720; a += 120) seq.push(cylinderInCombustion(a, fa));
    expect(seq).toEqual([1, 5, 3, 6, 2, 4]);
  });
});

describe('distribución', () => {
  for (const def of ENGINES) {
    const L = deriveLayout(def);
    it(`${def.id}: válvulas cerradas en compresión/expansión y abiertas en su carrera`, () => {
      expect(valveLift(90, L.exhaust)).toBe(0); // expansión media
      expect(valveLift(630, L.intake)).toBe(0); // compresión
      expect(valveLift(630, L.exhaust)).toBe(0);
      expect(valveLift(450, L.intake)).toBeGreaterThan(0.8 * L.intake.maxLift);
      expect(valveLift(270, L.exhaust)).toBeGreaterThan(0.8 * L.exhaust.maxLift);
    });
    it(`${def.id}: sin interferencia válvula-pistón en todo el ciclo`, () => {
      const st = createStates(L.n);
      let minGap = Infinity;
      for (let a = 0; a < 720; a += 0.25) {
        computeStates(L, a, 1, st);
        for (const s of st) {
          const crown = s.pistonY + def.geometry.compressionHeight;
          const valveFace = Math.min(L.valveSeatY - s.intakeLift, L.valveSeatY - s.exhaustLift);
          minGap = Math.min(minGap, valveFace - crown);
        }
      }
      expect(minGap).toBeGreaterThan(0.0003);
    });
    it(`${def.id}: el contrapeso no toca la falda del pistón en PMI`, () => {
      const skirtBottomAtBDC = L.l - L.r - def.geometry.compressionHeight * 0.62;
      const cwR = L.r * 1.12;
      expect(skirtBottomAtBDC - cwR).toBeGreaterThan(0.005);
    });
  }
});
