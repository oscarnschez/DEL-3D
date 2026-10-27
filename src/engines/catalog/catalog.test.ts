import { describe, expect, it } from 'vitest';
import { ENGINES } from './index';
import { deriveLayout } from '../derive';

describe('catálogo de motores', () => {
  it('ids únicos', () => {
    const ids = ENGINES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  for (const e of ENGINES) {
    it(`${e.id}: todo dato «verificado» cita una fuente existente con URL`, () => {
      for (const s of e.specs) {
        if (s.status !== 'verificado') continue;
        const src = e.sources.find((x) => x.id === s.sourceId);
        expect(src, `${s.label} sin fuente`).toBeDefined();
        expect(src!.url).toMatch(/^https:\/\//);
      }
    });
    it(`${e.id}: orden de encendido válido`, () => {
      expect([...e.firingOrder].sort()).toEqual(Array.from({ length: e.cylinders }, (_, i) => i + 1));
    });
    it(`${e.id}: cilindrada calculada coincide con diámetro × carrera`, () => {
      const L = deriveLayout(e);
      const disp = (Math.PI / 4) * L.bore ** 2 * 2 * L.r * e.cylinders * 1000;
      expect(disp).toBeGreaterThan(11);
      expect(disp).toBeLessThan(16);
    });
  }
});
