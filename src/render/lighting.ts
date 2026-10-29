import * as THREE from 'three';
import type { LightingPreset } from '@/state/settings';

/**
 * Escenarios de iluminación. Todos usan el MISMO conjunto de luces (sólo cambian intensidad,
 * color y posición): añadir o quitar luces cambia la clave de los shaders y obligaría a
 * recompilar todos los materiales (congelamiento). El entorno HDR de cada escenario se genera
 * en tiempo real a partir de paneles emisivos (equivalente a una fotografía de estudio con
 * softboxes) y se prefiltra con PMREM; no se usan HDRI fotográficos externos.
 */

export type Vec3 = [number, number, number];

interface DirLight {
  position: Vec3;
  color: string;
  intensity: number;
}

/** Panel emisivo del entorno (softbox, tira de luz, aro). */
export interface Panel {
  form: 'rect' | 'ring' | 'disc';
  position: Vec3;
  /** Rotación de Euler (rad). */
  rotation?: Vec3;
  scale: [number, number];
  color: string;
  intensity: number;
}

export interface LightingDef {
  label: string;
  description: string;
  /** Degradado radial del fondo [centro, borde]. */
  background: [string, string];
  /** Opacidad de la sombra de contacto sobre el suelo. */
  shadowOpacity: number;
  grid: boolean;
  exposure: number;
  envIntensity: number;
  hemi: { sky: string; ground: string; intensity: number };
  key: DirLight;
  fill: DirLight;
  rim: DirLight;
  rim2: DirLight;
  top: DirLight & { angle: number; penumbra: number };
  env: Panel[];
  /** Color del fondo del entorno (lo que se refleja donde no hay paneles). */
  envBase: string;
  vignette: number;
}

export const LIGHTING: Record<LightingPreset, LightingDef> = {
  estudio: {
    label: 'Estudio industrial',
    description: 'Fondo oscuro, softbox cenital y tiras laterales: reflejos controlados para ver el motor completo.',
    background: ['#1a222b', '#080b0f'],
    shadowOpacity: 0.55,
    grid: false,
    exposure: 1.0,
    envIntensity: 1.0,
    hemi: { sky: '#c9d6e3', ground: '#1b1f24', intensity: 0.35 },
    key: { position: [-2.2, 3.6, 2.4], color: '#fff6ec', intensity: 2.4 },
    fill: { position: [2.8, 1.4, 1.8], color: '#dbe7f3', intensity: 0.55 },
    rim: { position: [1.8, 2.2, -3.0], color: '#e8f1ff', intensity: 1.4 },
    rim2: { position: [-2.6, 1.6, -2.4], color: '#cfe0f2', intensity: 0.6 },
    top: { position: [0, 3.2, 0.6], color: '#ffffff', intensity: 0, angle: 0.6, penumbra: 1 },
    envBase: '#0b0e12',
    env: [
      { form: 'rect', position: [0, 4, 0.5], rotation: [Math.PI / 2, 0, 0], scale: [5, 2.4], color: '#ffffff', intensity: 3.2 },
      { form: 'rect', position: [-4, 1.2, 0], rotation: [0, Math.PI / 2, 0], scale: [4, 0.6], color: '#eef4ff', intensity: 2.2 },
      { form: 'rect', position: [4, 1.2, 0], rotation: [0, -Math.PI / 2, 0], scale: [4, 0.6], color: '#eef4ff', intensity: 1.8 },
      { form: 'rect', position: [0, 1.5, -4], rotation: [0, 0, 0], scale: [3, 0.5], color: '#dfe9f5', intensity: 1.4 },
      { form: 'rect', position: [0, -3, 0], rotation: [-Math.PI / 2, 0, 0], scale: [8, 8], color: '#20252b', intensity: 0.5 },
    ],
    vignette: 0.35,
  },
  laboratorio: {
    label: 'Laboratorio técnico',
    description: 'Luz neutra y uniforme, fondo gris medio y rejilla de referencia: para inspeccionar piezas, cortes y mecanismos.',
    background: ['#3a434d', '#232a31'],
    shadowOpacity: 0.32,
    grid: true,
    exposure: 1.05,
    envIntensity: 1.25,
    hemi: { sky: '#eef2f6', ground: '#4a525b', intensity: 0.9 },
    key: { position: [-1.6, 4.2, 1.6], color: '#ffffff', intensity: 1.7 },
    fill: { position: [2.4, 2.4, 2.0], color: '#f4f7fa', intensity: 1.0 },
    rim: { position: [1.5, 2.5, -2.8], color: '#ffffff', intensity: 0.7 },
    rim2: { position: [-2.2, 2.0, -2.2], color: '#ffffff', intensity: 0.5 },
    top: { position: [0, 3.5, 0], color: '#ffffff', intensity: 0, angle: 0.7, penumbra: 1 },
    envBase: '#5a636d',
    env: [
      { form: 'rect', position: [0, 4, 0], rotation: [Math.PI / 2, 0, 0], scale: [8, 8], color: '#ffffff', intensity: 2.0 },
      { form: 'rect', position: [-4, 1.5, 0], rotation: [0, Math.PI / 2, 0], scale: [6, 3], color: '#ffffff', intensity: 1.3 },
      { form: 'rect', position: [4, 1.5, 0], rotation: [0, -Math.PI / 2, 0], scale: [6, 3], color: '#ffffff', intensity: 1.3 },
      { form: 'rect', position: [0, 1.5, 4], rotation: [0, Math.PI, 0], scale: [6, 3], color: '#ffffff', intensity: 1.1 },
      { form: 'rect', position: [0, 1.5, -4], rotation: [0, 0, 0], scale: [6, 3], color: '#ffffff', intensity: 1.1 },
    ],
    vignette: 0,
  },
  cine: {
    label: 'Presentación cinematográfica',
    description: 'Contraluces cálido y frío, clave estrecha y fondo casi negro: contraste dramático pero controlado.',
    background: ['#121820', '#030405'],
    shadowOpacity: 0.7,
    grid: false,
    exposure: 0.95,
    envIntensity: 0.75,
    hemi: { sky: '#8fa3b8', ground: '#0b0d10', intensity: 0.12 },
    key: { position: [-1.4, 3.8, 2.6], color: '#fff1de', intensity: 2.0 },
    fill: { position: [2.6, 0.8, 2.2], color: '#9fb7d1', intensity: 0.18 },
    rim: { position: [2.4, 1.8, -2.6], color: '#ffc37a', intensity: 2.6 },
    rim2: { position: [-2.8, 1.4, -2.0], color: '#7fb2e6', intensity: 2.0 },
    top: { position: [0.3, 3.4, 0.4], color: '#ffffff', intensity: 9, angle: 0.42, penumbra: 0.85 },
    envBase: '#030405',
    env: [
      { form: 'rect', position: [3.5, 1.2, -3], rotation: [0, -Math.PI / 4, 0], scale: [0.5, 4], color: '#ffd29a', intensity: 4 },
      { form: 'rect', position: [-3.5, 1.2, -3], rotation: [0, Math.PI / 4, 0], scale: [0.5, 4], color: '#a8cfff', intensity: 3.4 },
      { form: 'rect', position: [0, 4, 0.8], rotation: [Math.PI / 2, 0, 0], scale: [2.2, 1.2], color: '#ffffff', intensity: 2.2 },
      { form: 'ring', position: [0, 1.4, 4], rotation: [0, Math.PI, 0], scale: [1.4, 1.4], color: '#ffffff', intensity: 0.8 },
    ],
    vignette: 0.6,
  },
};

const cache = new Map<string, THREE.Texture>();

/**
 * Entorno HDR prefiltrado (PMREM) del escenario. Se genera una vez por escenario y renderizador
 * y se reutiliza: cambiar de escenario sólo reasigna `scene.environment`.
 */
export function environmentFor(gl: THREE.WebGLRenderer, preset: LightingPreset): THREE.Texture {
  const k = `${preset}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const def = LIGHTING[preset];
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(def.envBase);
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  for (const p of def.env) {
    const g = p.form === 'rect' ? new THREE.PlaneGeometry(1, 1) : p.form === 'ring' ? new THREE.RingGeometry(0.42, 0.5, 48) : new THREE.CircleGeometry(0.5, 48);
    // color × intensidad > 1: el cubemap es de media precisión (HDR), así que conserva la energía
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(p.color).multiplyScalar(p.intensity), side: THREE.DoubleSide, toneMapped: false });
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(...p.position);
    if (p.rotation) mesh.rotation.set(...p.rotation);
    mesh.scale.set(p.scale[0], p.scale[1], 1);
    scene.add(mesh);
    geos.push(g);
    mats.push(m);
  }
  const pmrem = new THREE.PMREMGenerator(gl);
  const rt = pmrem.fromScene(scene, 0.02, 0.1, 100);
  pmrem.dispose();
  geos.forEach((g) => g.dispose());
  mats.forEach((m) => m.dispose());
  cache.set(k, rt.texture);
  return rt.texture;
}

/** Fondo: degradado radial en un canvas pequeño (pantalla completa, sin coste de geometría). */
const bgCache = new Map<LightingPreset, THREE.Texture>();
export function backgroundFor(preset: LightingPreset): THREE.Texture {
  const hit = bgCache.get(preset);
  if (hit) return hit;
  const [inner, outer] = LIGHTING[preset].background;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 110, 10, 128, 128, 190);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  bgCache.set(preset, t);
  return t;
}
