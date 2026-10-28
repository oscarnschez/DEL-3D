import { useEffect, useMemo, type DependencyList } from 'react';
import * as THREE from 'three';

/**
 * Gestión de recursos de GPU de la geometría procedural.
 *
 * R3F libera lo que crea a partir de JSX (`<sphereGeometry>`), pero no las geometrías y materiales
 * creados con `useMemo` y pasados como props: antes de la Etapa 4 cada cambio de motor o de modo
 * dejaba ~360 búferes WebGL sin liberar. `useDisposable` libera lo que crea su fábrica cuando
 * cambian las dependencias o se desmonta el componente.
 *
 * Las geometrías se liberan de inmediato. Los materiales se liberan con retardo: liberar el último
 * material que usa un programa WebGL borra el programa, y el motor que se monta a continuación
 * (con materiales del mismo tipo) tendría que recompilarlo, congelando la interfaz.
 */

const MATERIAL_DELAY_MS = 4000;
const stats = { geometries: 0, materials: 0 };

/** Contadores de recursos liberados (para la verificación automatizada). */
export function disposalStats() {
  return { ...stats };
}

export function disposeMaterialLater(m: THREE.Material): void {
  setTimeout(() => {
    m.dispose();
    stats.materials++;
  }, MATERIAL_DELAY_MS);
}

/** Libera recursivamente geometrías y materiales contenidos en `v` (objetos, arreglos, mapas). */
export function disposeDeep(v: unknown, seen = new Set<unknown>(), depth = 0): void {
  if (!v || typeof v !== 'object' || seen.has(v) || depth > 4) return;
  seen.add(v);
  if (v instanceof THREE.BufferGeometry) {
    v.dispose();
    stats.geometries++;
    return;
  }
  if (v instanceof THREE.Material) {
    if (!SHARED.has(v)) disposeMaterialLater(v);
    return;
  }
  if (v instanceof THREE.Object3D || v instanceof THREE.Texture) return; // no se tocan nodos ni texturas compartidas
  if (Array.isArray(v)) {
    for (const x of v) disposeDeep(x, seen, depth + 1);
    return;
  }
  if (Object.getPrototypeOf(v) === Object.prototype) for (const x of Object.values(v)) disposeDeep(x, seen, depth + 1);
}

/** Materiales de la biblioteca compartida: nunca se liberan desde un componente. */
export const SHARED = new WeakSet<THREE.Material>();

const pending = new Map<unknown, ReturnType<typeof setTimeout>>();

/**
 * `useMemo` que libera lo que creó al cambiar las dependencias o al desmontar.
 * La liberación se aplaza un instante y se cancela si el mismo valor se vuelve a montar
 * (doble montaje de React StrictMode en desarrollo).
 */
export function useDisposable<T>(factory: () => T, deps: DependencyList): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(factory, deps);
  useEffect(() => {
    const t = pending.get(value);
    if (t !== undefined) {
      clearTimeout(t);
      pending.delete(value);
    }
    return () => {
      pending.set(
        value,
        setTimeout(() => {
          pending.delete(value);
          disposeDeep(value);
        }, 0),
      );
    };
  }, [value]);
  return value;
}
