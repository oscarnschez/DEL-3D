import { describe, expect, it } from 'vitest';
import { createSelectionStore, visualStateFor } from './selection';

const base = { selected: null, hidden: new Set<never>(), ghosted: new Set<never>(), isolate: false, showRelated: false, systemSel: null };

describe('selección', () => {
  it('sin selección todo es normal; las piezas ocultas o transparentes se respetan', () => {
    expect(visualStateFor('piston', 1, base)).toBe('normal');
    expect(visualStateFor('turbo', undefined, { ...base, hidden: new Set(['turbo'] as const) })).toBe('hidden');
    expect(visualStateFor('turbo', undefined, { ...base, ghosted: new Set(['turbo'] as const) })).toBe('ghost');
  });

  it('pieza seleccionada, relacionadas y entorno atenuado / transparente / aislado', () => {
    const s = { ...base, selected: 'piston:2' };
    expect(visualStateFor('piston', 2, s)).toBe('selected');
    expect(visualStateFor('piston', 3, s)).toBe('dimmed');
    expect(visualStateFor('rod', 2, { ...s, showRelated: true })).toBe('related');
    expect(visualStateFor('rod', 3, { ...s, showRelated: true })).toBe('dimmed');
    expect(visualStateFor('block', undefined, { ...s, surround: 'transparente' })).toBe('faded');
    expect(visualStateFor('block', undefined, { ...s, isolate: true })).toBe('isolatedOut');
  });

  it('selección de un sistema completo', () => {
    const s = { ...base, systemSel: 'lubricacion' as const };
    expect(visualStateFor('oilPump', undefined, s)).toBe('selected');
    expect(visualStateFor('turbo', undefined, s)).toBe('dimmed');
  });

  it('stores independientes (vista principal y cada lado del comparador) y restauración', () => {
    const a = createSelectionStore();
    const b = createSelectionStore();
    a.getState().select('turbo');
    a.getState().toggleHidden('block');
    expect(b.getState().selected).toBeNull();
    a.getState().restore();
    expect(a.getState().selected).toBeNull();
    expect(a.getState().hidden.size).toBe(0);
  });
});
