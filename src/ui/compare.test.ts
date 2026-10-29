import { describe, expect, it } from 'vitest';
import { comparisonWarnings, equivalentPart } from './compare';
import { ENGINES } from '@/engines/catalog';
import type { PartId } from '@/engines/parts';

describe('comparador', () => {
  it('equivalencias sólo entre piezas del mismo tipo modeladas en ambos motores', () => {
    const other = new Set<PartId>(['turbo', 'piston']);
    expect(equivalentPart('turbo', other)).toBe('turbo');
    expect(equivalentPart('piston:4', other)).toBe('piston:4');
    expect(equivalentPart('egr', other)).toBeNull();
    expect(equivalentPart(null, other)).toBeNull();
  });

  it('advierte de años/variantes distintos y del mismo motor', () => {
    const [a, b] = ENGINES;
    expect(comparisonWarnings(a, a)[0]).toMatch(/mismo motor/);
    const w = comparisonWarnings(a, b);
    if (String(a.year) !== String(b.year)) expect(w.some((x) => /Años/.test(x))).toBe(true);
  });
});
