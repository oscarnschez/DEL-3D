import { create } from 'zustand';
import { PROFILES, profileFromQuery, type GraphicsProfile, type ProfileChoice } from '@/render/quality/profiles';

/**
 * Preferencias del usuario (persisten en localStorage). Separadas del estado de la vista
 * (`useApp`) y del estado de simulación de alta frecuencia (`sim`).
 */

export type LightingPreset = 'estudio' | 'laboratorio' | 'cine';
export type Lang = 'es' | 'en';
export type UiMode = 'ingenieria' | 'presentacion' | 'limpia';
export type MotionPref = 'sistema' | 'reducido' | 'completo';

export interface Settings {
  profileChoice: ProfileChoice;
  lighting: LightingPreset;
  lang: Lang;
  /** Sensibilidad de rotación de cámara (0.3–2). */
  rotateSpeed: number;
  /** Sensibilidad de zoom (0.3–2). */
  zoomSpeed: number;
  /** Amplitud de la vibración visual del motor (0 = apagada, 1 = máxima, siempre sutil). */
  vibration: number;
  motion: MotionPref;
  uiMode: UiMode;
  /** Factor de duración de los recorridos cinematográficos (0.5–2). */
  tourDuration: number;
  perfHud: boolean;
  /** Etiquetas 3D: densidad máxima en pantalla. */
  labelDensity: 'baja' | 'media' | 'alta';
}

export const DEFAULT_SETTINGS: Settings = {
  profileChoice: 'auto',
  lighting: 'estudio',
  lang: 'es',
  rotateSpeed: 1,
  zoomSpeed: 1,
  vibration: 0,
  motion: 'sistema',
  uiMode: 'ingenieria',
  tourDuration: 1,
  perfHud: false,
  labelDensity: 'media',
};

const KEY = 'del3d.settings.v1';

const clamp = (v: unknown, lo: number, hi: number, def: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def);
const oneOf = <T extends string>(v: unknown, opts: readonly T[], def: T): T => (typeof v === 'string' && (opts as readonly string[]).includes(v) ? (v as T) : def);

/** Valida un objeto leído del almacenamiento: descarta claves desconocidas y valores fuera de rango. */
export function sanitizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  return {
    profileChoice: oneOf(r.profileChoice, ['auto', 'ultra', 'alto', 'equilibrado', 'rendimiento'] as const, d.profileChoice),
    lighting: oneOf(r.lighting, ['estudio', 'laboratorio', 'cine'] as const, d.lighting),
    lang: oneOf(r.lang, ['es', 'en'] as const, d.lang),
    rotateSpeed: clamp(r.rotateSpeed, 0.3, 2, d.rotateSpeed),
    zoomSpeed: clamp(r.zoomSpeed, 0.3, 2, d.zoomSpeed),
    vibration: clamp(r.vibration, 0, 1, d.vibration),
    motion: oneOf(r.motion, ['sistema', 'reducido', 'completo'] as const, d.motion),
    uiMode: oneOf(r.uiMode, ['ingenieria', 'presentacion', 'limpia'] as const, d.uiMode),
    tourDuration: clamp(r.tourDuration, 0.5, 2, d.tourDuration),
    perfHud: typeof r.perfHud === 'boolean' ? r.perfHud : d.perfHud,
    labelDensity: oneOf(r.labelDensity, ['baja', 'media', 'alta'] as const, d.labelDensity),
  };
}

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

function storage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadSettings(s: StorageLike | null = storage()): Settings {
  try {
    const txt = s?.getItem(KEY);
    return sanitizeSettings(txt ? JSON.parse(txt) : null);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(v: Settings, s: StorageLike | null = storage()): void {
  try {
    s?.setItem(KEY, JSON.stringify(v));
  } catch {
    /* almacenamiento no disponible (modo privado, cuota): la app sigue funcionando sin persistir */
  }
}

interface SettingsState extends Settings {
  /** Perfil efectivo (resuelto desde `auto` o elegido). */
  profile: GraphicsProfile;
  /** Motivo del perfil efectivo (para mostrarlo en Configuración). */
  profileReason: string;
  /** El sistema pide movimiento reducido (media query). */
  systemReducedMotion: boolean;
  set: (p: Partial<Settings>) => void;
  setProfile: (p: GraphicsProfile, reason: string) => void;
  reset: () => void;
}

const query = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const forced = profileFromQuery(query.get('calidad'));
const initial = loadSettings();

export const useSettings = create<SettingsState>((set, get) => ({
  ...initial,
  profile: forced ?? (initial.profileChoice === 'auto' ? 'equilibrado' : initial.profileChoice),
  profileReason: forced ? 'Forzado por el parámetro de URL «calidad»' : initial.profileChoice === 'auto' ? 'Pendiente de detección' : 'Elegido por el usuario',
  systemReducedMotion: typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  set: (p) => {
    set(p);
    const s = get();
    if (p.profileChoice && p.profileChoice !== 'auto') set({ profile: p.profileChoice, profileReason: 'Elegido por el usuario' });
    saveSettings(pickSettings(s));
  },
  setProfile: (profile, profileReason) => set({ profile, profileReason }),
  reset: () => {
    set({ ...DEFAULT_SETTINGS });
    saveSettings(DEFAULT_SETTINGS);
  },
}));

export function pickSettings(s: Settings): Settings {
  return sanitizeSettings(s);
}

/** ¿Debe reducirse el movimiento (vibración, transiciones de cámara largas, recorridos automáticos)? */
export function reducedMotion(s: Pick<SettingsState, 'motion' | 'systemReducedMotion'> = useSettings.getState()): boolean {
  return s.motion === 'reducido' || (s.motion === 'sistema' && s.systemReducedMotion);
}

export const profileConfig = () => PROFILES[useSettings.getState().profile];

/** El perfil vino forzado por la URL (scripts de verificación). */
export const profileForcedByUrl = forced !== null;
