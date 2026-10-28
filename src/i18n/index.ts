import { useSettings } from '@/state/settings';
import { es, type MessageKey } from './es';
import { en } from './en';

export type { MessageKey };
export const MESSAGES = { es, en } as const;

/** Traducción fuera de React (lee el idioma actual). */
export function t(key: MessageKey): string {
  return MESSAGES[useSettings.getState().lang][key];
}

/** Hook de traducción: re-renderiza al cambiar de idioma. */
export function useT(): (key: MessageKey) => string {
  const lang = useSettings((s) => s.lang);
  return (key) => MESSAGES[lang][key];
}
