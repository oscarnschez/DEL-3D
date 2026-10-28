import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { create } from 'zustand';
import { useSettings, profileForcedByUrl } from '@/state/settings';
import { adjustForFps, initialProfile, PROFILES, type DeviceCaps } from './quality/profiles';

/**
 * Medición de rendimiento real (no supuesto): FPS, tiempo de frame, draw calls, triángulos y
 * recursos vivos de la GPU, leídos de `renderer.info`. Se expone en `window.__delPerf` para los
 * scripts de verificación y en el HUD opcional.
 */
export interface PerfSample {
  fps: number;
  frameMs: number;
  /** Percentil 95 del tiempo de frame en la ventana. */
  frameP95: number;
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  dpr: number;
  renderer: string;
}

export const perf: PerfSample = { fps: 0, frameMs: 0, frameP95: 0, calls: 0, triangles: 0, geometries: 0, textures: 0, programs: 0, dpr: 1, renderer: '' };

/** Copia para la interfaz, actualizada a 2 Hz (nunca por frame). */
export const usePerf = create<PerfSample>(() => ({ ...perf }));

if (typeof window !== 'undefined') (window as unknown as { __delPerf: PerfSample }).__delPerf = perf;

/** Capacidades del dispositivo para el perfil inicial. */
export function deviceCaps(gl: WebGLRenderingContext | WebGL2RenderingContext): DeviceCaps {
  let renderer: string | undefined;
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
  } catch {
    renderer = undefined;
  }
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    renderer,
    webgl2: typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext,
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
    cores: nav.hardwareConcurrency,
    memoryGB: nav.deviceMemory,
    mobile: /Mobi|Android|iPhone|iPad/i.test(nav.userAgent),
    screenPixels: screen.width * screen.height * devicePixelRatio ** 2,
  };
}

export function PerfProbe() {
  const gl = useThree((s) => s.gl);
  const frames = useRef<number[]>([]);
  const last = useRef(performance.now());
  const lastPub = useRef(0);

  useEffect(() => {
    gl.info.autoReset = false;
    perf.renderer = deviceCaps(gl.getContext()).renderer ?? 'desconocido';
    return () => {
      gl.info.autoReset = true;
    };
  }, [gl]);

  // Prioridad −3: se ejecuta al inicio del frame, cuando `info` contiene el frame anterior completo
  // (con postprocesado hay varios render por frame; por eso el reinicio es manual).
  useFrame(() => {
    const now = performance.now();
    const f = frames.current;
    f.push(now - last.current);
    last.current = now;
    if (f.length > 120) f.shift();
    perf.calls = gl.info.render.calls;
    perf.triangles = gl.info.render.triangles;
    gl.info.reset();
    if (now - lastPub.current > 500) {
      lastPub.current = now;
      const sorted = [...f].sort((a, b) => a - b);
      const avg = f.reduce((s, x) => s + x, 0) / Math.max(1, f.length);
      perf.frameMs = avg;
      perf.fps = 1000 / Math.max(1, avg);
      perf.frameP95 = sorted[Math.floor(sorted.length * 0.95)] ?? avg;
      perf.geometries = gl.info.memory.geometries;
      perf.textures = gl.info.memory.textures;
      perf.programs = gl.info.programs?.length ?? 0;
      perf.dpr = gl.getPixelRatio();
      usePerf.setState({ ...perf });
    }
  }, -3);
  return null;
}

/**
 * Perfil automático: arranca con un perfil prudente según capacidades y, tras medir unos
 * segundos de funcionamiento estable, sube o baja un escalón si los FPS reales lo justifican.
 * Sólo actúa con la opción «Automático» y como mucho dos veces por sesión.
 */
export function AutoProfile() {
  const gl = useThree((s) => s.gl);
  const choice = useSettings((s) => s.profileChoice);
  useEffect(() => {
    if (choice !== 'auto' || profileForcedByUrl) return;
    const caps = deviceCaps(gl.getContext());
    const p0 = initialProfile(caps);
    const soft = caps.renderer && /swiftshader|llvmpipe|software/i.test(caps.renderer);
    useSettings.getState().setProfile(p0, soft ? `Render por software detectado (${caps.renderer})` : `Capacidades: ${caps.cores ?? '?'} núcleos, WebGL${caps.webgl2 ? '2' : '1'}`);
    if (soft) return;
    let adjustments = 0;
    const timer = setInterval(() => {
      if (document.hidden || adjustments >= 2) return;
      const cur = useSettings.getState().profile;
      if (perf.fps <= 0) return;
      const next = adjustForFps(cur, perf.fps);
      if (next !== cur) {
        adjustments++;
        useSettings.getState().setProfile(next, `Ajuste automático: ${perf.fps.toFixed(0)} FPS medidos con ${PROFILES[cur].label}`);
      }
    }, 8000);
    return () => clearInterval(timer);
  }, [gl, choice]);
  return null;
}
