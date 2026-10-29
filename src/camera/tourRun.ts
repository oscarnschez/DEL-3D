/**
 * Estado de reproducción de un recorrido (función pura, probada en `tours.test.ts`).
 * enter → (efectos del plano y transición de cámara) → move → hold → siguiente plano.
 */
export interface TourRun {
  total: number;
  index: number;
  phase: 'enter' | 'move' | 'hold' | 'done';
  held: number;
}

export const startRun = (total: number): TourRun => ({ total, index: 0, phase: total > 0 ? 'enter' : 'done', held: 0 });

export function stepRun(r: TourRun, dt: number, o: { paused: boolean; moving: boolean; hold: number }): TourRun {
  if (r.phase === 'done' || o.paused) return r;
  if (r.phase === 'enter') return { ...r, phase: 'move', held: 0 };
  if (r.phase === 'move') return o.moving ? r : { ...r, phase: 'hold', held: 0 };
  const held = r.held + dt;
  if (held < o.hold) return { ...r, held };
  return r.index + 1 >= r.total ? { ...r, phase: 'done', held } : { ...r, index: r.index + 1, phase: 'enter', held: 0 };
}

/** Saltar a otro plano (anterior/siguiente). */
export const jumpRun = (r: TourRun, index: number): TourRun => ({ ...r, index: Math.max(0, Math.min(r.total - 1, index)), phase: 'enter', held: 0 });
