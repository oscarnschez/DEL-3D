import { useEffect } from 'react';
import { useApp, type ViewMode } from '@/state/store';
import { getEngine } from '@/engines/catalog';
import { deriveLayout, type EngineLayout } from '@/engines/derive';
import { auxLayout } from '@/render/engine/Systems';
import { cameraApi } from './CameraRig';

interface Shot {
  pos: [number, number, number];
  target: [number, number, number];
  caption: string;
  hold: number; // s tras completar la transición
  mode?: ViewMode;
  timeScale?: number;
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
];

let runId = 0;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Reproduce el recorrido activo (`tour` en el store) con transiciones suaves de cámara. */
export function TourPlayer() {
  const tour = useApp((s) => s.tour);
  useEffect(() => {
    if (!tour) return;
    const def = TOURS.find((t) => t.id === tour);
    if (!def) return;
    const id = ++runId;
    const app = useApp.getState();
    const L = deriveLayout(getEngine(app.engineId));
    void auxLayout(L);
    const shots = def.shots(L);
    (async () => {
      if (!app.running) app.set({ running: true, paused: false });
      for (const s of shots) {
        if (id !== runId) return;
        if (s.mode && useApp.getState().mode !== s.mode) useApp.getState().setMode(s.mode);
        if (s.timeScale) useApp.getState().set({ timeScale: s.timeScale });
        useApp.getState().set({ caption: s.caption });
        await sleep(60);
        await cameraApi.lookAt(s.pos, s.target, true);
        await sleep(s.hold * 1000);
      }
      if (id === runId) useApp.getState().set({ tour: null, caption: null });
    })();
    return () => {
      runId++;
    };
  }, [tour]);
  return null;
}
