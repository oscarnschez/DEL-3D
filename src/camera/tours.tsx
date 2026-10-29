import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { useFrame, useThree } from '@react-three/fiber';
import { useApp } from '@/state/store';
import { useSettings, reducedMotion } from '@/state/settings';
import { getEngine } from '@/engines/catalog';
import { deriveLayout } from '@/engines/derive';
import { useSelection } from '@/interaction/selection';
import { toast } from '@/ui/toasts';
import { cameraApi } from './CameraRig';
import { TOURS, type Shot } from './tourDefs';
import { jumpRun, startRun, stepRun, type TourRun } from './tourRun';

export { MAIN_TOURS, TOURS, type Shot, type TourDef } from './tourDefs';
export { jumpRun, startRun, stepRun, type TourRun } from './tourRun';

/** Progreso visible del recorrido (se actualiza al cambiar de plano y a 8 Hz durante la permanencia). */
export const useTourProgress = create<{ index: number; total: number; frac: number; label: string }>(() => ({ index: 0, total: 0, frac: 0, label: '' }));
/** Petición de salto desde la interfaz. */
export const tourControl = { jump: null as number | null };

/** Reproduce el recorrido activo (`tour` en el store). Pausa, reanudación, salto y cancelación. */
export function TourPlayer() {
  const tour = useApp((s) => s.tour);
  const gl = useThree((s) => s.gl);
  const run = useRef<TourRun | null>(null);
  const shots = useRef<Shot[]>([]);
  const moving = useRef(false);
  const pub = useRef(0);
  const prev = useRef<{ labels: boolean; smooth: number } | null>(null);

  useEffect(() => {
    if (!tour) return;
    const def = TOURS.find((t) => t.id === tour);
    if (!def) return;
    const app = useApp.getState();
    shots.current = def.shots(deriveLayout(getEngine(app.engineId)));
    run.current = startRun(shots.current.length);
    prev.current = { labels: app.labels, smooth: cameraApi.controls?.smoothTime ?? 0.45 };
    useSelection.getState().select(null);
    app.set({ tourPaused: false, running: true, paused: false });
    useTourProgress.setState({ index: 0, total: shots.current.length, frac: 0, label: def.label });
    // cualquier interacción del usuario con la vista pone el recorrido en pausa
    const onUser = () => {
      const a = useApp.getState();
      if (a.tour && !a.tourPaused) {
        a.set({ tourPaused: true });
        toast('Recorrido en pausa por interacción con la vista: pulse Reanudar para continuar.', 'info');
      }
    };
    const el = gl.domElement;
    el.addEventListener('pointerdown', onUser);
    el.addEventListener('wheel', onUser, { passive: true });
    return () => {
      el.removeEventListener('pointerdown', onUser);
      el.removeEventListener('wheel', onUser);
      run.current = null;
      if (cameraApi.controls && prev.current) cameraApi.controls.smoothTime = prev.current.smooth;
      const a = useApp.getState();
      a.set({ caption: null, labels: prev.current?.labels ?? false, tourPaused: false });
      useTourProgress.setState({ index: 0, total: 0, frac: 0, label: '' });
    };
  }, [tour, gl]);

  useFrame((_, dt) => {
    const r0 = run.current;
    if (!r0) return;
    const app = useApp.getState();
    const factor = useSettings.getState().tourDuration;
    let r = r0;
    if (tourControl.jump !== null) {
      r = jumpRun(r, tourControl.jump);
      tourControl.jump = null;
    }
    const shot = shots.current[r.index];
    if (r.phase === 'enter' && shot) {
      if (shot.mode && app.mode !== shot.mode) app.setMode(shot.mode);
      const a = useApp.getState();
      const patch: Parameters<typeof a.set>[0] = { caption: shot.caption };
      if (shot.timeScale !== undefined) patch.timeScale = reducedMotion() ? Math.min(shot.timeScale, 0.25) : shot.timeScale;
      if (shot.labels !== undefined) patch.labels = shot.labels;
      if (shot.explodeGroup !== undefined) patch.explodeGroup = shot.explodeGroup;
      if (shot.explode !== undefined) patch.explode = shot.explode;
      if (shot.cut !== undefined) patch.cut = shot.cut;
      if (shot.running !== undefined) patch.running = shot.running;
      a.set(patch);
      if (shot.select !== undefined) useSelection.getState().select(shot.select);
      const c = cameraApi.controls;
      if (c) c.smoothTime = 0.45 * factor;
      moving.current = true;
      void Promise.resolve(cameraApi.lookAt(shot.pos, shot.target, !reducedMotion())).finally(() => {
        moving.current = false;
      });
      useTourProgress.setState({ index: r.index, frac: 0 });
    }
    const next = stepRun(r, Math.min(dt, 0.1), { paused: app.tourPaused, moving: moving.current, hold: (shot?.hold ?? 0) * factor });
    run.current = next;
    pub.current += dt;
    if (next.phase === 'hold' && pub.current > 0.12) {
      pub.current = 0;
      useTourProgress.setState({ frac: Math.min(1, next.held / Math.max(0.001, (shot?.hold ?? 1) * factor)) });
    }
    if (next.phase === 'done') {
      run.current = null;
      useApp.getState().set({ tour: null });
      useSelection.getState().select(null);
      toast('Recorrido terminado', 'ok');
    }
  });
  return null;
}
