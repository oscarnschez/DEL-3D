import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings, sanitizeSettings, saveSettings, reducedMotion, type StorageLike } from './settings';

const memory = (): StorageLike & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

describe('configuración persistente', () => {
  it('valores por defecto sin almacenamiento o con JSON inválido', () => {
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
    const m = memory();
    m.setItem('del3d.settings.v1', '{no es json');
    expect(loadSettings(m)).toEqual(DEFAULT_SETTINGS);
  });

  it('guarda y recupera exactamente lo mismo', () => {
    const m = memory();
    const s = { ...DEFAULT_SETTINGS, lighting: 'cine' as const, lang: 'en' as const, rotateSpeed: 1.4, vibration: 0.5, uiMode: 'presentacion' as const, perfHud: true };
    saveSettings(s, m);
    expect(loadSettings(m)).toEqual(s);
  });

  it('descarta valores desconocidos y limita rangos', () => {
    const s = sanitizeSettings({ lighting: 'discoteca', lang: 'fr', rotateSpeed: 99, zoomSpeed: -3, vibration: Number.NaN, tourDuration: 0.1, perfHud: 'sí', extra: 1 });
    expect(s.lighting).toBe(DEFAULT_SETTINGS.lighting);
    expect(s.lang).toBe(DEFAULT_SETTINGS.lang);
    expect(s.rotateSpeed).toBe(2);
    expect(s.zoomSpeed).toBe(0.3);
    expect(s.vibration).toBe(DEFAULT_SETTINGS.vibration);
    expect(s.tourDuration).toBe(0.5);
    expect(s.perfHud).toBe(false);
    expect('extra' in s).toBe(false);
  });

  it('un almacenamiento que falla no rompe la aplicación', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('cuota');
      },
    };
    expect(loadSettings(broken)).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(DEFAULT_SETTINGS, broken)).not.toThrow();
  });

  it('movimiento reducido: sistema, siempre y nunca', () => {
    expect(reducedMotion({ motion: 'sistema', systemReducedMotion: true })).toBe(true);
    expect(reducedMotion({ motion: 'sistema', systemReducedMotion: false })).toBe(false);
    expect(reducedMotion({ motion: 'reducido', systemReducedMotion: false })).toBe(true);
    expect(reducedMotion({ motion: 'completo', systemReducedMotion: true })).toBe(false);
  });
});
