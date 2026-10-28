/**
 * Perfiles de calidad gráfica. Funciones puras (sin DOM) para poder probarlas.
 *
 * Cambiar de perfil es una acción explícita del usuario: puede recompilar shaders (sombras,
 * mapas, postprocesado forman parte de la clave de programa), así que la interfaz lo anuncia.
 */

export type GraphicsProfile = 'ultra' | 'alto' | 'equilibrado' | 'rendimiento';
export type ProfileChoice = 'auto' | GraphicsProfile;

export const PROFILE_ORDER: GraphicsProfile[] = ['rendimiento', 'equilibrado', 'alto', 'ultra'];

export interface ProfileConfig {
  label: string;
  /** Rango de densidad de píxeles [mín, máx] para AdaptiveDpr. */
  dpr: [number, number];
  shadows: boolean;
  shadowMapSize: number;
  /** Resolución de las texturas procedurales (px por lado). */
  textureSize: number;
  /** Mapeo triplanar de normal/rugosidad/AO; sin él los materiales usan sólo color y factores. */
  detailMaps: boolean;
  /** Multiplicador de densidad de partículas (fluidos, combustión). */
  particles: number;
  /** Oclusión ambiental en pantalla (N8AO). */
  ao: boolean;
  /** Antialiasing SMAA en postprocesado (con postprocesado activo, el MSAA del lienzo no aplica). */
  smaa: boolean;
  /** Resplandor sutil de zonas muy brillantes (llama, metal caliente). */
  bloom: boolean;
  /** Muestras del raymarching de la llama. */
  flameSteps: number;
  /** Factor de teselado de las piezas procedurales (1 = completo). */
  detail: number;
  /** Resolución de dibujo dinámica según rendimiento medido. */
  dynamicResolution: boolean;
}

export const PROFILES: Record<GraphicsProfile, ProfileConfig> = {
  ultra: {
    label: 'Ultra',
    dpr: [1, 2],
    shadows: true,
    shadowMapSize: 4096,
    textureSize: 1024,
    detailMaps: true,
    particles: 1.5,
    ao: true,
    smaa: true,
    bloom: true,
    flameSteps: 48,
    detail: 1,
    dynamicResolution: false,
  },
  alto: {
    label: 'Alto',
    dpr: [1, 1.75],
    shadows: true,
    shadowMapSize: 2048,
    textureSize: 512,
    detailMaps: true,
    particles: 1,
    ao: true,
    smaa: true,
    bloom: false,
    flameSteps: 32,
    detail: 1,
    dynamicResolution: false,
  },
  equilibrado: {
    label: 'Equilibrado',
    dpr: [0.85, 1.5],
    shadows: true,
    shadowMapSize: 1024,
    textureSize: 512,
    detailMaps: true,
    particles: 0.7,
    ao: false,
    smaa: false,
    bloom: false,
    flameSteps: 20,
    detail: 0.75,
    dynamicResolution: true,
  },
  rendimiento: {
    label: 'Rendimiento',
    dpr: [0.6, 1],
    shadows: false,
    shadowMapSize: 512,
    textureSize: 256,
    detailMaps: false,
    particles: 0.4,
    ao: false,
    smaa: false,
    bloom: false,
    flameSteps: 12,
    detail: 0.5,
    dynamicResolution: true,
  },
};

export const PROFILE_HELP: Record<ProfileChoice, string> = {
  auto: 'Elige un perfil prudente según las capacidades detectadas y ajusta tras medir los FPS reales.',
  ultra: 'Texturas 1024 px, sombras 4096, oclusión ambiental, antialiasing SMAA, resplandor y más partículas.',
  alto: 'Texturas 512 px, sombras 2048, oclusión ambiental y SMAA.',
  equilibrado: 'Sombras 1024, sin postprocesado, menos partículas y resolución dinámica.',
  rendimiento: 'Prioriza la fluidez: sin sombras ni mapas de detalle, partículas reducidas y resolución dinámica.',
};

/** Capacidades relevantes del dispositivo (todas opcionales: el navegador puede ocultarlas). */
export interface DeviceCaps {
  /** Cadena del renderizador WebGL (WEBGL_debug_renderer_info), si está disponible. */
  renderer?: string;
  webgl2: boolean;
  maxTextureSize?: number;
  cores?: number;
  memoryGB?: number;
  mobile?: boolean;
  /** Píxeles físicos de la pantalla (ancho × alto × dpr²). */
  screenPixels?: number;
}

const SOFTWARE = /swiftshader|llvmpipe|software|microsoft basic render/i;

/**
 * Perfil inicial prudente a partir de capacidades. No depende sólo del nombre de la GPU:
 * combina núcleos, memoria, WebGL2, tamaño de pantalla y móvil, y sólo usa el nombre para
 * detectar render por software (que siempre fuerza RENDIMIENTO).
 */
export function initialProfile(c: DeviceCaps): GraphicsProfile {
  if (c.renderer && SOFTWARE.test(c.renderer)) return 'rendimiento';
  if (!c.webgl2) return 'rendimiento';
  let score = 0;
  if ((c.cores ?? 4) >= 8) score += 1;
  if ((c.cores ?? 4) <= 2) score -= 1;
  if ((c.memoryGB ?? 8) >= 8) score += 1;
  if ((c.memoryGB ?? 8) <= 2) score -= 1;
  if ((c.maxTextureSize ?? 4096) >= 16384) score += 1;
  if (c.mobile) score -= 2;
  if ((c.screenPixels ?? 2e6) > 6e6) score -= 1; // 4K: muchos píxeles por frame
  // Prudente: nunca arranca en ULTRA; se sube tras medir.
  if (score >= 2) return 'alto';
  if (score >= 0) return 'equilibrado';
  return 'rendimiento';
}

/**
 * Ajuste tras medir el rendimiento real (FPS medios en una ventana estable).
 * Devuelve el perfil sugerido; sólo baja o sube un escalón cada vez para evitar oscilaciones.
 */
export function adjustForFps(current: GraphicsProfile, fps: number): GraphicsProfile {
  const i = PROFILE_ORDER.indexOf(current);
  if (fps < 30 && i > 0) return PROFILE_ORDER[i - 1];
  if (fps > 58 && i < PROFILE_ORDER.length - 2) return PROFILE_ORDER[i + 1]; // sube como máximo a ALTO
  return current;
}

/** Perfil a partir del parámetro de URL `calidad` (compatibilidad con `alta/media/baja` de etapas previas). */
export function profileFromQuery(q: string | null): GraphicsProfile | null {
  if (!q) return null;
  const map: Record<string, GraphicsProfile> = {
    ultra: 'ultra',
    alto: 'alto',
    alta: 'alto',
    equilibrado: 'equilibrado',
    media: 'equilibrado',
    rendimiento: 'rendimiento',
    baja: 'rendimiento',
  };
  return map[q.toLowerCase()] ?? null;
}
