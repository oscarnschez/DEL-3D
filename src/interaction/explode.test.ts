import { describe, expect, it } from 'vitest';
import { availableGroups, EXPLODE_GROUPS, explodeOffset, explodeSpec, inExplodeGroup, stepProgress, type Vec3 } from './explode';
import { PARTS, type PartId } from '@/engines/parts';
import { ENGINES } from '@/engines/catalog';
import { deriveLayout } from '@/engines/derive';

const ids = Object.keys(PARTS) as PartId[];

describe('despiece', () => {
  it('retorno exacto: con progreso 0 ninguna pieza queda desplazada', () => {
    for (const def of ENGINES) {
      const L = deriveLayout(def);
      for (const id of ids) {
        const o = explodeOffset(explodeSpec(id, L), 0, [9, 9, 9] as Vec3);
        expect(o).toEqual([0, 0, 0]);
      }
    }
  });

  it('con progreso 1 las piezas se separan y la trayectoria es continua', () => {
    const L = deriveLayout(ENGINES[0]);
    for (const id of ['valveCover', 'head', 'piston', 'turbo', 'oilPan'] as PartId[]) {
      const spec = explodeSpec(id, L);
      const end = explodeOffset(spec, 1, [0, 0, 0]);
      expect(Math.hypot(...end)).toBeGreaterThan(0.01);
      let prev = explodeOffset(spec, 0, [0, 0, 0]);
      for (let p = 0.01; p <= 1.0001; p += 0.01) {
        const cur = explodeOffset(spec, p, [0, 0, 0]);
        expect(Math.hypot(cur[0] - prev[0], cur[1] - prev[1], cur[2] - prev[2])).toBeLessThan(0.05);
        prev = cur;
      }
    }
  });

  it('el avance del progreso es lineal, simétrico y termina exactamente', () => {
    let p = 0;
    for (let i = 0; i < 200 && p !== 1; i++) p = stepProgress(p, 1, 1 / 60);
    expect(p).toBe(1);
    for (let i = 0; i < 200 && p !== 0; i++) p = stepProgress(p, 0, 1 / 60);
    expect(p).toBe(0);
  });

  it('grupos: completo, por sistema e individual', () => {
    expect(inExplodeGroup('todo', 'turbo', null)).toBe(true);
    expect(inExplodeGroup('turbo', 'turbo', null)).toBe(true);
    expect(inExplodeGroup('turbo', 'piston', null)).toBe(false);
    expect(inExplodeGroup('individual', 'piston', 'piston')).toBe(true);
    expect(inExplodeGroup('individual', 'rod', 'piston')).toBe(false);
    expect(availableGroups(['piston', 'rod'])).toEqual(['todo', 'piston-biela', 'individual']);
    for (const g of EXPLODE_GROUPS) for (const p of g.parts) expect(PARTS[p]).toBeDefined();
  });
});
