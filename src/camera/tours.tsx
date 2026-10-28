import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { useFrame, useThree } from '@react-three/fiber';
import { useApp, type CutMode, type ViewMode } from '@/state/store';
import { useSettings, reducedMotion } from '@/state/settings';
import { getEngine } from '@/engines/catalog';
import { deriveLayout, type EngineLayout } from '@/engines/derive';
import type { PartKey } from '@/engines/parts';
import type { ExplodeGroup } from '@/interaction/explode';
import { useSelection } from '@/interaction/selection';
import { toast } from '@/ui/toasts';
import { cameraApi } from './CameraRig';

export interface Shot {
  pos: [number, number, number];
  target: [number, number, number];
  caption: string;
  /** Segundos de permanencia tras la transición (se multiplican por la duración configurada). */
  hold: number;
  mode?: ViewMode;
  timeScale?: number;
  /** Pieza resaltada en el plano (null la quita). */
  select?: PartKey | null;
  /** Etiquetas visibles durante el plano. */
  labels?: boolean;
  explode?: number;
  explodeGroup?: ExplodeGroup;
  cut?: CutMode;
  /** Motor en marcha (por defecto se enciende al empezar el recorrido). */
  running?: boolean;
}

export interface TourDef {
  id: string;
  label: string;
  shots: (L: EngineLayout) => Shot[];
}

export const TOURS: TourDef[] = [
  {
    id: 'presentacion',
    label: 'Presentación general',
    shots: (L) => [
      { pos: [-1.5, 0.9, 1.6], target: [0, 0.2, 0], caption: 'Motor diésel de seis cilindros en línea: vista general', hold: 2.5, mode: 'exterior' },
      { pos: [0.2, 0.6, 1.9], target: [0, 0.25, 0], caption: 'Lado de escape: múltiple seccionado y turbocompresor', hold: 2.5 },
      { pos: [1.7, 0.5, -0.9], target: [0, 0.25, 0], caption: 'Lado de admisión: múltiple, riel de combustible y filtros', hold: 2.5 },
      { pos: [-1.6, 0.3, 0.3], target: [L.front, 0.2, 0], caption: 'Frente: amortiguador de vibraciones y distribución', hold: 2.5 },
    ],
  },
  {
    id: 'interior',
    label: 'Interior mecánico',
    shots: (L) => [
      { pos: [-1.1, 0.75, 1.05], target: [0, L.deckY - 0.12, 0], caption: 'Con el bloque transparente: tren alternativo, distribución y cigüeñal en un solo ciclo', hold: 3, mode: 'interior', timeScale: 0.1 },
      { pos: [L.cylX[1] + 0.4, L.deckY + 0.02, 0.5], target: [L.cylX[1], L.deckY - 0.1, 0], caption: 'Pistón y biela: la biela convierte el movimiento alternativo en giro', hold: 3.5, select: 'rod:2', labels: true },
      { pos: [L.cylX[3] + 0.1, L.camY + 0.32, -0.45], target: [L.cylX[3], L.camY, L.camZ], caption: 'Árbol de levas a media velocidad del cigüeñal: abre y cierra las válvulas', hold: 3.5, select: 'camshaft' },
      { pos: [L.cylX[2] + 0.45, -0.05, 0.6], target: [L.cylX[2], 0, 0], caption: 'Cigüeñal: muñequillas, contrapesos y apoyos de bancada', hold: 3.5, select: 'crankshaft' },
    ],
  },
  {
    id: 'cilindros',
    label: 'Acercamiento a los cilindros',
    shots: (L) => [
      { pos: [-0.9, 0.9, 0.9], target: [0, L.deckY - 0.1, 0], caption: 'Interior: pistones, bielas y cigüeñal sincronizados', hold: 2, mode: 'interior', timeScale: 0.1 },
      { pos: [L.cylX[0] - 0.3, L.deckY + 0.05, 0.45], target: [L.cylX[1], L.deckY - 0.12, 0], caption: 'Movimiento alternativo de los pistones en sus camisas', hold: 3 },
      { pos: [L.cylX[2] + 0.5, 0.1, 0.55], target: [L.cylX[2], 0.05, 0], caption: 'Bielas: articulación entre pistón y muñequilla', hold: 3 },
    ],
  },
  {
    id: 'bloque',
    label: 'Viaje al interior del bloque',
    shots: (L) => [
      { pos: [L.rear + 0.6, 0.25, 0.25], target: [L.cylX[3], 0.2, 0], caption: 'Corte longitudinal del bloque', hold: 2, mode: 'tecnico' },
      { pos: [L.cylX[3] + 0.35, 0.22, 0.3], target: [L.cylX[2], 0.15, 0], caption: 'Camisas húmedas y conjunto pistón-biela', hold: 3, timeScale: 0.1 },
      { pos: [L.cylX[2] + 0.3, -0.05, 0.25], target: [L.cylX[1], 0, 0], caption: 'Bancadas, muñones y contrapesos', hold: 3 },
    ],
  },
  {
    id: 'cigueñal',
    label: 'Seguimiento del cigüeñal',
    shots: (L) => [
      { pos: [-0.8, -0.1, 0.8], target: [0, 0, 0], caption: 'Cigüeñal: seis muñequillas a 120°, orden 1-5-3-6-2-4', hold: 2, mode: 'interior', timeScale: 0.05 },
      { pos: [L.front - 0.5, 0.05, 0.05], target: [0, 0, 0], caption: 'Vista axial: los pares 1-6, 2-5 y 3-4 comparten muñequilla en fase', hold: 4 },
      { pos: [L.rear + 0.4, 0.15, 0.6], target: [L.rear, 0, 0], caption: 'Volante: inercia que suaviza las pulsaciones de par', hold: 2.5 },
    ],
  },
  {
    id: 'inyeccion',
    label: 'Proceso de inyección',
    shots: (L) => [
      { pos: [L.cylX[0] - 0.2, L.deckY + 0.35, -0.55], target: [L.cylX[1], L.deckY, -0.1], caption: 'Sistema de combustible: alimentación, filtros, alta presión e inyectores', hold: 3, mode: 'combustible', timeScale: 0.1 },
      { pos: [L.cylX[2] + 0.35, L.deckY + 0.1, 0.25], target: [L.cylX[2], L.deckY - 0.02, 0], caption: 'Inyección directa a alta presión cerca del PMS', hold: 4, timeScale: 0.03 },
    ],
  },
  {
    id: 'combustion',
    label: 'Combustión en detalle',
    shots: (L) => [
      { pos: [L.cylX[0] + 0.55, L.deckY + 0.12, 0.42], target: [L.cylX[0], L.deckY - 0.08, 0], caption: 'Cámara de combustión del cilindro 1: autoignición por compresión', hold: 8, mode: 'combustion', timeScale: 0.03 },
    ],
  },
  {
    id: 'lubricacion',
    label: 'Recorrido de lubricación',
    shots: (L) => [
      { pos: [-0.6, -0.1, -1.1], target: [0, 0, 0], caption: 'Aceite: cárter → bomba → filtro/enfriador → galería principal', hold: 3, mode: 'lubricacion', timeScale: 1 },
      { pos: [0.9, 0.0, 0.7], target: [0, 0, 0], caption: 'Cojinetes de bancada, muñequillas y chorros de enfriamiento de pistones', hold: 3 },
      { pos: [-0.3, L.camY + 0.4, -0.6], target: [0, L.camY, 0], caption: 'Subida a la culata: árboles de levas y balancines', hold: 3 },
    ],
  },
  {
    id: 'turbo',
    label: 'Recorrido por el turbocompresor',
    shots: () => [
      { pos: [0.2, 0.9, 1.5], target: [0.1, 0.35, 0.3], caption: 'Admisión y escape: turbocompresor e intercooler', hold: 3, mode: 'aire', timeScale: 1 },
      { pos: [0.0, 0.55, 0.95], target: [0.1, 0.4, 0.4], caption: 'La turbina mueve el compresor con la energía del escape', hold: 3 },
    ],
  },
  {
    id: 'despiece',
    label: 'Despiece animado',
    shots: (L) => [
      { pos: [-1.5, 0.95, 1.55], target: [0, 0.2, 0], caption: 'Motor ensamblado', hold: 2, mode: 'exterior', running: false },
      { pos: [-1.3, 1.25, 1.2], target: [0, L.deckY + 0.1, 0], caption: 'Culata y distribución: tapa, culata, levas, balancines e inyectores', hold: 3.5, explodeGroup: 'culata', explode: 1, labels: true },
      { pos: [-1.2, 0.6, 1.4], target: [0, L.deckY - 0.1, 0], caption: 'Pistones y bielas fuera de sus camisas', hold: 3.5, explodeGroup: 'piston-biela', explode: 1 },
      { pos: [-2.0, 1.1, 2.0], target: [0, 0.15, 0], caption: 'Despiece completo: cada conjunto se separa por etapas en su dirección de montaje', hold: 4.5, explodeGroup: 'todo', explode: 1 },
      { pos: [-1.5, 0.95, 1.55], target: [0, 0.2, 0], caption: 'Reensamblado: cada pieza vuelve exactamente a su posición', hold: 3, explode: 0, labels: false },
    ],
  },
];

/** Recorridos que pide la Etapa 4, en el orden en que se ofrecen. */
export const MAIN_TOURS = ['presentacion', 'interior', 'combustion', 'lubricacion', 'turbo', 'despiece'];

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
