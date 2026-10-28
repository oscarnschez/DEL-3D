import type { EngineDefinition } from '@/engines/schema';
import { parsePartKey, type PartKey, type PartId } from '@/engines/parts';

/**
 * Pieza equivalente en el otro motor: sólo la MISMA categoría de pieza (mismo PartId) y sólo si
 * está modelada allí. Nunca se inventan equivalencias entre piezas distintas.
 * Conserva el número de cilindro si el otro motor lo tiene.
 */
export function equivalentPart(key: PartKey | null, otherParts: Set<PartId>): PartKey | null {
  if (!key) return null;
  const { id, index } = parsePartKey(key);
  if (!otherParts.has(id)) return null;
  return index === undefined ? id : `${id}:${index}`;
}

/** Advertencias de comparabilidad (años, variantes, datos ausentes o aproximados). */
export function comparisonWarnings(a: EngineDefinition, b: EngineDefinition): string[] {
  const out: string[] = [];
  if (a.id === b.id) out.push('Está comparando el mismo motor consigo mismo.');
  const ya = String(a.year);
  const yb = String(b.year);
  if (ya !== yb) out.push(`Años o generaciones distintos (${a.model}: ${ya} · ${b.model}: ${yb}): las cifras pueden corresponder a calibraciones o normas de emisiones diferentes.`);
  if (a.variant !== b.variant) out.push('Variantes distintas: compare potencia y par sólo dentro del mismo tipo de aplicación (camión de carretera, vocacional…).');
  const approx = [a, b].filter((d) => d.specs.some((s) => s.status === 'aproximado')).map((d) => d.model);
  if (approx.length) out.push(`Algunos datos son aproximados (${approx.join(', ')}): ver insignia de cada fila.`);
  return out;
}
