import { generateFinish, type FinishId } from './procedural';

/** Genera los mapas procedurales fuera del hilo principal para no bloquear la interfaz. */
const ctx = self as unknown as { onmessage: ((e: MessageEvent) => void) | null; postMessage(m: unknown, t: Transferable[]): void };
ctx.onmessage = (e: MessageEvent<{ id: FinishId; size: number; job: number }>) => {
  const { id, size, job } = e.data;
  const set = generateFinish(id, size);
  const transfer = [set.normal.buffer, set.orm.buffer, ...(set.color ? [set.color.buffer] : [])] as ArrayBuffer[];
  ctx.postMessage({ id, job, set }, transfer);
};
