import type { CutMode, ViewMode } from '@/state/store';
import type { EngineLayout } from '@/engines/derive';
import type { PartKey } from '@/engines/parts';
import type { ExplodeGroup } from '@/interaction/explode';

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
