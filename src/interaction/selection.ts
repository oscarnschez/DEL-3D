import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { PARTS, parsePartKey, type PartId, type PartKey, type SystemId } from '@/engines/parts';

export interface SelectionState {
  selected: PartKey | null;
  hovered: PartKey | null;
  hidden: Set<PartId>;
  ghosted: Set<PartId>;
  isolate: boolean;
  showRelated: boolean;
  /** Selección de un sistema completo (resalta todas sus piezas). */
  systemSel: SystemId | null;
  /** Ver el movimiento individual: sólo la pieza seleccionada y las relacionadas se animan resaltadas. */
  select: (k: PartKey | null) => void;
  hover: (k: PartKey | null) => void;
  toggleHidden: (id: PartId) => void;
  toggleGhost: (id: PartId) => void;
  set: (p: Partial<SelectionState>) => void;
  restore: () => void;
}

export type SelectionStore = UseBoundStore<StoreApi<SelectionState>>;

/** Crea un store de selección (el principal y uno por motor en el comparador). */
export const createSelectionStore = (): SelectionStore => create<SelectionState>((set) => ({
  selected: null,
  hovered: null,
  hidden: new Set(),
  ghosted: new Set(),
  isolate: false,
  showRelated: false,
  systemSel: null,
  select: (k) => set({ selected: k, systemSel: null }),
  hover: (k) => set({ hovered: k }),
  toggleHidden: (id) =>
    set((s) => {
      const h = new Set(s.hidden);
      if (h.has(id)) h.delete(id);
      else h.add(id);
      return { hidden: h };
    }),
  toggleGhost: (id) =>
    set((s) => {
      const g = new Set(s.ghosted);
      if (g.has(id)) g.delete(id);
      else g.add(id);
      return { ghosted: g };
    }),
  set: (p) => set(p),
  restore: () =>
    set({ selected: null, hovered: null, hidden: new Set(), ghosted: new Set(), isolate: false, showRelated: false, systemSel: null }),
}));

export const useSelection = createSelectionStore();

export type PartVisualState = 'normal' | 'selected' | 'related' | 'dimmed' | 'isolatedOut' | 'hidden' | 'ghost';

/** Estado visual de una pieza según la selección actual (función pura, usada por <Part>). */
export function visualStateFor(
  id: PartId,
  index: number | undefined,
  s: Pick<SelectionState, 'selected' | 'hidden' | 'ghosted' | 'isolate' | 'showRelated' | 'systemSel'>,
): PartVisualState {
  if (s.hidden.has(id)) return 'hidden';
  if (s.systemSel) {
    return PARTS[id].system === s.systemSel ? 'selected' : s.isolate ? 'isolatedOut' : 'dimmed';
  }
  if (s.selected) {
    const sel = parsePartKey(s.selected);
    const isSel = sel.id === id && (sel.index === undefined || index === undefined || sel.index === index);
    if (isSel) return 'selected';
    const related = PARTS[sel.id].related.includes(id) && (sel.index === undefined || index === undefined || sel.index === index);
    if (s.showRelated && related) return 'related';
    return s.isolate ? 'isolatedOut' : 'dimmed';
  }
  if (s.ghosted.has(id)) return 'ghost';
  return 'normal';
}
