import type { EngineLayout } from '@/engines/derive';
import type { PartId } from '@/engines/parts';

/**
 * Despiece técnico. Cada pieza sigue una trayectoria de dos tramos:
 *  1. «extracción» a lo largo de su eje de montaje (la culata sube, el cárter baja, el volante sale
 *     hacia atrás…), y
 *  2. «separación» lateral para despejar la vista.
 * Las piezas exteriores empiezan antes (`stage` bajo) que las interiores, de modo que nada sale a
 * través de una pieza que aún no se ha retirado (p. ej. los pistones suben cuando la culata ya
 * subió más que ellos). Con progreso 0 el desplazamiento es exactamente cero: las piezas vuelven a
 * su posición original sin error acumulado.
 */

export type Vec3 = [number, number, number];

export interface ExplodeSpec {
  /** Desplazamiento del primer tramo (m). */
  lift: Vec3;
  /** Desplazamiento adicional del segundo tramo (m). */
  spread: Vec3;
  /** Orden de salida 0 (primero) – 1 (último). */
  stage: number;
}

/** Conjuntos de despiece pedidos. La disponibilidad depende de las piezas modeladas en cada motor. */
export type ExplodeGroup = 'todo' | 'culata' | 'piston-biela' | 'ciguenal' | 'lubricacion' | 'combustible' | 'turbo' | 'refrigeracion' | 'individual';

export const EXPLODE_GROUPS: { id: ExplodeGroup; label: string; parts: PartId[] }[] = [
  {
    id: 'todo',
    label: 'Despiece completo',
    parts: [],
  },
  { id: 'culata', label: 'Culata y distribución', parts: ['valveCover', 'head', 'camshaft', 'rockers', 'intakeValves', 'exhaustValves', 'timingGears', 'injector'] },
  { id: 'piston-biela', label: 'Pistones y bielas', parts: ['piston', 'rings', 'rod'] },
  { id: 'ciguenal', label: 'Cigüeñal', parts: ['crankshaft', 'mainBearings', 'flywheel', 'damper'] },
  { id: 'lubricacion', label: 'Sistema de lubricación', parts: ['oilPan', 'oilPump', 'oilFilter'] },
  { id: 'combustible', label: 'Sistema de combustible', parts: ['injector', 'fuelRail', 'fuelPump', 'fuelFilter'] },
  { id: 'turbo', label: 'Turbocompresor', parts: ['turbo'] },
  { id: 'refrigeracion', label: 'Sistema de refrigeración', parts: ['waterPump', 'thermostat'] },
  { id: 'individual', label: 'Pieza seleccionada', parts: [] },
];

/** ¿La pieza participa en el despiece del conjunto? (`individual` se resuelve con la selección). */
export function inExplodeGroup(group: ExplodeGroup, id: PartId, selectedId: PartId | null): boolean {
  if (group === 'todo') return true;
  if (group === 'individual') return selectedId === id;
  return EXPLODE_GROUPS.find((g) => g.id === group)!.parts.includes(id);
}

/** Conjuntos disponibles para las piezas efectivamente modeladas en un motor. */
export function availableGroups(modeled: Iterable<PartId>): ExplodeGroup[] {
  const set = new Set(modeled);
  return EXPLODE_GROUPS.filter((g) => g.id === 'todo' || g.id === 'individual' || g.parts.some((p) => set.has(p))).map((g) => g.id);
}

/** Especificación de despiece de una pieza para el layout de un motor. */
export function explodeSpec(id: PartId, L: EngineLayout): ExplodeSpec {
  const b = L.bore;
  // el tren de distribución sale por el extremo donde está montado
  const gearSide = L.def.valvetrain.gearTrain === 'front' ? -1 : 1;
  const s = (lift: Vec3, spread: Vec3, stage: number): ExplodeSpec => ({ lift, spread, stage });
  switch (id) {
    case 'valveCover':
      return s([0, b * 4.4, 0], [0, b * 0.8, 0], 0);
    case 'camshaft':
      return s([0, b * 3.5, 0], [0, b * 0.4, 0], 0.15);
    case 'rockers':
      return s([0, b * 3.0, 0], [0, b * 0.3, 0], 0.12);
    case 'intakeValves':
      return s([0, b * 1.2, 0], [0, 0, -b * 0.3], 0.5);
    case 'exhaustValves':
      return s([0, b * 1.2, 0], [0, 0, b * 0.3], 0.5);
    case 'injector':
      return s([0, b * 1.6, 0], [0, 0, -b * 1.4], 0.08);
    case 'head':
      return s([0, b * 2.2, 0], [0, 0, 0], 0.35);
    case 'piston':
      return s([0, b * 0.95, 0], [0, 0, 0], 0.6);
    case 'rings':
      return s([0, b * 1.0, 0], [0, b * 0.18, 0], 0.62);
    case 'rod':
      return s([0, b * 0.95, 0], [0, 0, -b * 0.6], 0.6);
    case 'liner':
      return s([0, b * 0.4, 0], [0, 0, 0], 0.8);
    case 'oilPan':
      return s([0, -b * 2.2, 0], [0, 0, 0], 0);
    case 'oilPump':
      return s([0, -b * 1.4, 0], [0, 0, b * 0.5], 0.1);
    case 'mainBearings':
      return s([0, -b * 1.0, 0], [0, 0, 0], 0.3);
    case 'crankshaft':
      return s([0, -b * 1.8, 0], [0, 0, 0], 0.45);
    case 'flywheel':
      return s([b * 1.8, 0, 0], [0, 0, 0], 0.25);
    case 'damper':
      return s([-b * 1.8, 0, 0], [0, 0, 0], 0.1);
    case 'timingGears':
      return s([gearSide * b * 1.2, 0, 0], [0, b * 0.3, 0], 0.2);
    case 'fuelRail':
      return s([0, 0, -b * 1.1], [0, b * 0.5, 0], 0.05);
    case 'fuelPump':
      return s([0, 0, -b * 1.4], [0, -b * 0.2, 0], 0.05);
    case 'fuelFilter':
      return s([0, 0, -b * 1.7], [0, -b * 0.3, 0], 0.05);
    case 'oilFilter':
      return s([0, 0, -b * 1.8], [0, -b * 0.2, 0], 0.05);
    case 'intakeManifold':
      return s([0, 0, -b * 1.5], [0, b * 0.5, 0], 0.02);
    case 'exhaustManifold':
      return s([0, 0, b * 1.5], [0, b * 0.3, 0], 0.02);
    case 'turbo':
      return s([0, b * 0.6, b * 1.6], [0, b * 0.6, 0], 0);
    case 'intercooler':
      return s([-b * 1.6, 0, 0], [0, 0, 0], 0);
    case 'egr':
      return s([0, b * 1.0, b * 0.8], [0, b * 0.4, 0], 0);
    case 'aftertreatment':
      return s([b * 1.0, 0, b * 1.0], [0, b * 0.5, 0], 0);
    case 'waterPump':
      return s([-b * 1.5, 0, 0], [0, b * 0.2, 0], 0.05);
    case 'thermostat':
      return s([-b * 1.2, b * 0.6, 0], [0, b * 0.2, 0], 0.05);
    case 'block':
      return s([0, 0, 0], [0, 0, 0], 1);
  }
}

const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/**
 * Desplazamiento de la pieza para un progreso global p ∈ [0, 1]. Cada pieza recorre su
 * trayectoria dentro de la ventana [stage·0.5, stage·0.5 + 0.5] con aceleración y frenado suaves.
 */
export function explodeOffset(spec: ExplodeSpec, p: number, out: Vec3): Vec3 {
  const t = Math.min(1, Math.max(0, (p - spec.stage * 0.5) / 0.5));
  const a = smooth(t / 0.6);
  const b = smooth((t - 0.45) / 0.55);
  out[0] = spec.lift[0] * a + spec.spread[0] * b;
  out[1] = spec.lift[1] * a + spec.spread[1] * b;
  out[2] = spec.lift[2] * a + spec.spread[2] * b;
  return out;
}

/** Avance del progreso animado hacia el objetivo, a velocidad constante y llegada exacta. */
export function stepProgress(current: number, target: number, dt: number, duration = 1.6): number {
  const d = target - current;
  const max = dt / duration;
  return Math.abs(d) <= max ? target : current + Math.sign(d) * max;
}
