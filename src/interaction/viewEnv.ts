import { createContext, useContext } from 'react';
import { useApp, type Covers, type ViewMode } from '@/state/store';
import type { ExplodeGroup } from './explode';
import { useSelection, type SelectionStore } from './selection';

/** Parámetros de visualización que leen las piezas (transparencia, cubiertas, despiece…). */
export interface ViewParams {
  mode: ViewMode;
  transparency: number;
  removed: Covers;
  explode: number;
  explodeGroup: ExplodeGroup;
}

export interface ViewStore {
  getState(): ViewParams;
  subscribe(listener: (s: ViewParams, p: ViewParams) => void): () => void;
}

/**
 * Entorno de visualización de un motor: de dónde leen las piezas sus parámetros y su selección.
 * La vista principal usa los stores globales; el comparador crea uno por motor para que cada
 * lado tenga transparencia, despiece y selección propios.
 */
export interface ViewEnv {
  view: ViewStore;
  selection: SelectionStore;
}

export const MAIN_ENV: ViewEnv = { view: useApp, selection: useSelection };

export const ViewEnvContext = createContext<ViewEnv>(MAIN_ENV);

export const useViewEnv = () => useContext(ViewEnvContext);
