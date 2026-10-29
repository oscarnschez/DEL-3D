import { create } from 'zustand';
import type { ExplodeGroup } from '@/interaction/explode';

export type ViewMode =
  | 'exterior'
  | 'interior'
  | 'combustion'
  | 'lubricacion'
  | 'combustible'
  | 'refrigeracion'
  | 'aire'
  | 'despiece'
  | 'rayosx'
  | 'termica'
  | 'tecnico';

export type FlowSystem = 'lubricacion' | 'combustible' | 'refrigeracion' | 'aire';

export type CutMode = 'none' | 'longitudinal' | 'transversal' | 'cilindro' | 'libre';

export type Covers = { valveCover: boolean; head: boolean; oilPan: boolean; block: boolean; manifolds: boolean };

export type StepSize = 1 | 5 | 15 | 'fase';

interface AppState {
  engineId: string;
  mode: ViewMode;
  // Simulación
  running: boolean;
  paused: boolean;
  targetRpm: number;
  timeScale: number;
  load: number;
  stepSize: StepSize;
  focusCylinder: number;
  // Visualización
  flows: Record<FlowSystem, boolean>;
  cut: CutMode;
  cutOffset: number;
  /** Grado de despiece objetivo (0–1); las piezas se animan hacia él. */
  explode: number;
  explodeGroup: ExplodeGroup;
  /** Orientación del plano de corte dinámico (grados): giro alrededor de Y y de Z. */
  cutYaw: number;
  cutPitch: number;
  transparency: number;
  removed: Covers;
  labels: boolean;
  showComparator: boolean;
  compareIds: [string, string];
  tour: string | null;
  tourPaused: boolean;
  caption: string | null;
  set: (p: Partial<AppState>) => void;
  setMode: (m: ViewMode) => void;
  toggleFlow: (f: FlowSystem) => void;
  toggleCover: (c: keyof Covers) => void;
}

const noFlows: Record<FlowSystem, boolean> = { lubricacion: false, combustible: false, refrigeracion: false, aire: false };

export const useApp = create<AppState>((set) => ({
  engineId: 'cummins-x15',
  mode: 'exterior',
  running: false,
  paused: false,
  targetRpm: 600,
  timeScale: 1,
  load: 0.4,
  stepSize: 15,
  focusCylinder: 1,
  flows: { ...noFlows },
  cut: 'none',
  cutOffset: 0,
  explode: 0,
  explodeGroup: 'todo',
  cutYaw: 45,
  cutPitch: 0,
  transparency: 0,
  removed: { valveCover: false, head: false, oilPan: false, block: false, manifolds: false },
  labels: false,
  showComparator: false,
  compareIds: ['cummins-x15', 'detroit-dd15'],
  tour: null,
  tourPaused: false,
  caption: null,
  set: (p) => set(p),
  setMode: (mode) => {
    // Cada modo define un preset de visualización; el estado de simulación se conserva.
    const flows = { ...noFlows };
    const base = {
      mode,
      flows,
      cut: 'none' as CutMode,
      explode: 0,
      explodeGroup: 'todo' as ExplodeGroup,
      transparency: 0,
      labels: false,
      removed: { valveCover: false, head: false, oilPan: false, block: false, manifolds: false },
    };
    switch (mode) {
      case 'interior':
        set({ ...base, removed: { valveCover: true, head: false, oilPan: true, block: false, manifolds: true }, transparency: 0.82 });
        break;
      case 'combustion':
        set({ ...base, cut: 'cilindro' });
        break;
      case 'lubricacion':
      case 'combustible':
      case 'refrigeracion':
      case 'aire':
        flows[mode] = true;
        set({ ...base, flows, transparency: 0.7 });
        break;
      case 'despiece':
        set({ ...base, explode: 1 });
        break;
      case 'rayosx':
        set({ ...base, transparency: 0.9 });
        break;
      case 'termica':
        set(base);
        break;
      case 'tecnico':
        set({ ...base, labels: true, cut: 'transversal' });
        break;
      default:
        set(base);
    }
  },
  toggleFlow: (f) => set((s) => ({ flows: { ...s.flows, [f]: !s.flows[f] } })),
  toggleCover: (c) => set((s) => ({ removed: { ...s.removed, [c]: !s.removed[c] } })),
}));
