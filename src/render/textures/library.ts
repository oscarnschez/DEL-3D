import * as THREE from 'three';
import { create } from 'zustand';
import { FINISHES, generateFinish, type FinishId, type TextureSet } from './procedural';

/**
 * Biblioteca de texturas procedurales. Los objetos `DataTexture` existen desde el principio con
 * un contenido neutro de 1×1 (normal plana, ORM = 1), para que los materiales se creen con sus
 * mapas y el shader no tenga que recompilarse cuando llegan los datos generados en el worker:
 * sólo se sustituye la imagen.
 */

export interface FinishTextures {
  normal: THREE.DataTexture;
  orm: THREE.DataTexture;
  color: THREE.DataTexture;
}

interface TexStatus {
  done: number;
  total: number;
  size: number;
  error: string | null;
}

export const useTextureStatus = create<TexStatus>(() => ({ done: 0, total: FINISHES.length, size: 0, error: null }));

function placeholder(rgba: [number, number, number, number], colorSpace: THREE.ColorSpace): THREE.DataTexture {
  const t = new THREE.DataTexture(new Uint8Array(rgba), 1, 1, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = colorSpace;
  t.needsUpdate = true;
  return t;
}

const lib = Object.fromEntries(
  FINISHES.map((id) => [
    id,
    {
      normal: placeholder([128, 128, 255, 255], THREE.NoColorSpace),
      orm: placeholder([255, 255, 255, 255], THREE.NoColorSpace),
      color: placeholder([255, 255, 255, 255], THREE.SRGBColorSpace),
    },
  ]),
) as Record<FinishId, FinishTextures>;

export function finishTextures(id: FinishId): FinishTextures {
  return lib[id];
}

function assign(t: THREE.DataTexture, data: Uint8Array, size: number, anisotropy: number) {
  // La textura conserva su identidad (los materiales no cambian), pero cambia de tamaño:
  // se libera la reserva de GPU anterior y se vuelve a subir.
  t.dispose();
  t.image = { data, width: size, height: size } as unknown as typeof t.image;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = anisotropy;
  t.needsUpdate = true;
}

function apply(id: FinishId, set: TextureSet, anisotropy: number) {
  const L = lib[id];
  assign(L.normal, set.normal, set.size, anisotropy);
  assign(L.orm, set.orm, set.size, anisotropy);
  if (set.color) assign(L.color, set.color, set.size, anisotropy);
}

let job = 0;
let worker: Worker | null = null;

/**
 * Genera (o regenera con otra resolución) todas las texturas. Usa un Web Worker; si el entorno
 * no lo permite, genera en el hilo principal en trozos para no bloquear la interfaz.
 */
export function generateTextures(size: number, anisotropy = 8): void {
  const current = ++job;
  useTextureStatus.setState({ done: 0, total: FINISHES.length, size, error: null });
  const onSet = (id: FinishId, set: TextureSet) => {
    if (current !== job) return;
    apply(id, set, anisotropy);
    useTextureStatus.setState((s) => ({ done: s.done + 1 }));
  };
  try {
    if (!worker) worker = new Worker(new URL('./textures.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: FinishId; job: number; set: TextureSet }>) => {
      if (e.data.job === current) onSet(e.data.id, e.data.set);
    };
    worker.onerror = () => {
      worker = null;
      fallback(current, size, onSet);
    };
    for (const id of FINISHES) worker.postMessage({ id, size, job: current });
  } catch {
    fallback(current, size, onSet);
  }
}

function fallback(current: number, size: number, onSet: (id: FinishId, s: TextureSet) => void) {
  let i = 0;
  const next = () => {
    if (current !== job || i >= FINISHES.length) return;
    const id = FINISHES[i++];
    try {
      onSet(id, generateFinish(id, size));
    } catch (err) {
      useTextureStatus.setState({ error: `No se pudieron generar las texturas (${String(err)}); se usan acabados sin microdetalle.` });
      return;
    }
    setTimeout(next, 0);
  };
  next();
}
