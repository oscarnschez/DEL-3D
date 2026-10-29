import { create } from 'zustand';
import { Icon } from './icons';

export type ToastKind = 'ok' | 'info' | 'warn' | 'error';
interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}

/** Avisos breves (éxito, información, advertencia, error). Se descartan solos a los 3,5 s (error: 7 s). */
export const useToasts = create<{ items: Toast[] }>(() => ({ items: [] }));
let seq = 0;

export function toast(text: string, kind: ToastKind = 'info'): void {
  const id = ++seq;
  // sin duplicados consecutivos (p. ej. varios cambios de perfil seguidos)
  useToasts.setState((s) => ({ items: [...s.items.filter((t) => t.text !== text), { id, kind, text }].slice(-4) }));
  setTimeout(() => useToasts.setState((s) => ({ items: s.items.filter((t) => t.id !== id) })), kind === 'error' ? 7000 : 3500);
}

const ICON = { ok: 'check', info: 'info', warn: 'warn', error: 'warn' } as const;

export function Toasts() {
  const items = useToasts((s) => s.items);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <Icon name={ICON[t.kind]} size={15} />
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}
