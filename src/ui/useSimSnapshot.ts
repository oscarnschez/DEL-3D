import { useEffect, useRef, useState } from 'react';
import { sim, type SimState } from '@/core/simulation/clock';

const changed = (a: SimState, b: SimState) =>
  a.angle !== b.angle || a.rpm !== b.rpm || a.load !== b.load || a.coolantTemp !== b.coolantTemp || a.oilTemp !== b.oilTemp || a.egt !== b.egt || a.turboRpm !== b.turboRpm;

/**
 * Copia muestreada del estado de simulación para la interfaz (~15 Hz, sin re-render por frame).
 * Si nada cambió (motor detenido, pausa) no re-renderiza: la interfaz queda en reposo.
 */
export function useSimSnapshot(hz = 15): SimState {
  const [snap, setSnap] = useState<SimState>({ ...sim });
  const last = useRef(snap);
  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden || !changed(sim, last.current)) return;
      last.current = { ...sim };
      setSnap(last.current);
    }, 1000 / hz);
    return () => clearInterval(id);
  }, [hz]);
  return snap;
}

/**
 * Actualización imperativa de la interfaz de alta frecuencia: llama a `write` en cada frame de
 * animación (como mucho a `hz`) para que escriba directamente en el DOM (textContent, style),
 * sin pasar por React.
 */
export function useSimWriter(write: (s: SimState) => void, hz = 30): void {
  const fn = useRef(write);
  fn.current = write;
  useEffect(() => {
    let raf = 0;
    let lastT = 0;
    let lastAngle = NaN;
    let lastRpm = NaN;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - lastT < 1000 / hz) return;
      lastT = t;
      if (sim.angle === lastAngle && sim.rpm === lastRpm) return;
      lastAngle = sim.angle;
      lastRpm = sim.rpm;
      fn.current(sim);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [hz]);
}
