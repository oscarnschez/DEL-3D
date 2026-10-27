import { useEffect, useState } from 'react';
import { sim, type SimState } from '@/core/simulation/clock';

/** Copia muestreada del estado de simulación para la interfaz (~15 Hz, sin re-render por frame). */
export function useSimSnapshot(hz = 15): SimState {
  const [snap, setSnap] = useState<SimState>({ ...sim });
  useEffect(() => {
    const id = setInterval(() => setSnap({ ...sim }), 1000 / hz);
    return () => clearInterval(id);
  }, [hz]);
  return snap;
}
