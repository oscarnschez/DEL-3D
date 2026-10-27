import { createContext, useContext } from 'react';
import type { EngineLayout } from '@/engines/derive';
import type { CylinderState } from '@/core/kinematics/engineState';

export interface EngineCtx {
  L: EngineLayout;
  /** Estados por cilindro, recalculados una vez por frame por <KinematicsDriver>. */
  states: CylinderState[];
  /** Ángulo de cigüeñal usado para `states` (grados). */
  angle: { value: number };
}

export const EngineContext = createContext<EngineCtx | null>(null);

export function useEngine(): EngineCtx {
  const c = useContext(EngineContext);
  if (!c) throw new Error('useEngine fuera de <EngineModel>');
  return c;
}
