import * as THREE from 'three';

/**
 * Materiales PBR compartidos. Las piezas clonan estos materiales una sola vez (ver <Part>)
 * para poder resaltar/atenuar individualmente sin crear materiales por frame.
 */

/** Uniform global: activa el sombreado de sección (caras interiores rayadas) cuando hay un corte activo. */
export const sectionUniform = { value: 0 };
export const sectionColor = { value: new THREE.Color('#c0392b') };

function noiseCanvas(size: number, scale: number, seed: number, contrast: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  // ruido de valor en dos octavas: textura de fundición / arena
  const g = 32;
  const grid = Array.from({ length: g * g }, rnd);
  const at = (x: number, y: number) => grid[((y % g) + g) % g * g + (((x % g) + g) % g)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * g * scale;
      const fy = (y / size) * g * scale;
      const ix = Math.floor(fx);
      const iy = Math.floor(fy);
      const tx = fx - ix;
      const ty = fy - iy;
      const a = at(ix, iy) * (1 - tx) + at(ix + 1, iy) * tx;
      const b = at(ix, iy + 1) * (1 - tx) + at(ix + 1, iy + 1) * tx;
      const v = a * (1 - ty) + b * ty;
      const grain = rnd();
      const val = 128 + ((v - 0.5) * 0.6 + (grain - 0.5) * 0.4) * 255 * contrast;
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.max(0, Math.min(255, val));
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Textura de rectificado: líneas finas anisotrópicas para superficies mecanizadas. */
function brushedCanvas(size: number, seed: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  for (let i = 0; i < size * 3; i++) {
    const y = rnd() * size;
    const v = Math.floor(100 + rnd() * 60);
    ctx.strokeStyle = `rgba(${v},${v},${v},0.35)`;
    ctx.lineWidth = 0.5 + rnd();
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y + (rnd() - 0.5) * 2);
    ctx.stroke();
  }
  return c;
}

let cached: ReturnType<typeof build> | null = null;

function tex(canvas: HTMLCanvasElement, repeat: number): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

function build() {
  const casting = tex(noiseCanvas(256, 2, 7, 1), 3);
  const castingFine = tex(noiseCanvas(256, 6, 11, 0.8), 2);
  const brushed = tex(brushedCanvas(256, 3), 1);

  const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);
  const phys = (p: THREE.MeshPhysicalMaterialParameters) => new THREE.MeshPhysicalMaterial(p);

  return {
    textures: { casting, castingFine, brushed },
    /** Hierro fundido pintado (bloque); el color se sobrescribe por motor. */
    paintedIron: std({ color: '#5b636c', metalness: 0.35, roughness: 0.62, roughnessMap: casting, bumpMap: casting, bumpScale: 0.6 }),
    rawIron: std({ color: '#55585c', metalness: 0.7, roughness: 0.7, roughnessMap: castingFine, bumpMap: castingFine, bumpScale: 0.5 }),
    aluminumCast: std({ color: '#a7adb3', metalness: 0.8, roughness: 0.45, roughnessMap: castingFine, bumpMap: castingFine, bumpScale: 0.3 }),
    pistonAlloy: std({ color: '#b9bec4', metalness: 0.85, roughness: 0.32, roughnessMap: brushed }),
    forgedSteel: std({ color: '#7c8288', metalness: 0.95, roughness: 0.38, roughnessMap: castingFine }),
    machinedSteel: phys({ color: '#c8cdd2', metalness: 1, roughness: 0.18, roughnessMap: brushed, clearcoat: 0.2 }),
    darkSteel: std({ color: '#2e3236', metalness: 0.9, roughness: 0.35 }),
    valveSteel: std({ color: '#9aa0a6', metalness: 1, roughness: 0.25 }),
    bronze: std({ color: '#b08d57', metalness: 1, roughness: 0.3 }),
    copper: std({ color: '#b87333', metalness: 1, roughness: 0.28 }),
    blackPaint: std({ color: '#1d2024', metalness: 0.3, roughness: 0.55, roughnessMap: castingFine }),
    coverPaint: phys({ color: '#2b3036', metalness: 0.4, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
    heatShield: std({ color: '#8c8f93', metalness: 1, roughness: 0.4, bumpMap: castingFine, bumpScale: 1.2 }),
    exhaustIron: std({ color: '#4a3f3a', metalness: 0.6, roughness: 0.85, roughnessMap: casting, bumpMap: casting, bumpScale: 0.8 }),
    rubber: std({ color: '#111214', metalness: 0, roughness: 0.85 }),
    hose: std({ color: '#191b1e', metalness: 0.05, roughness: 0.7 }),
    gasket: std({ color: '#2a2d30', metalness: 0.4, roughness: 0.6 }),
    bolt: std({ color: '#3b3f44', metalness: 0.95, roughness: 0.3 }),
    zinc: std({ color: '#9ba3a8', metalness: 1, roughness: 0.35 }),
    intercoolerCore: std({ color: '#3a3f45', metalness: 0.9, roughness: 0.5 }),
    filterBlue: phys({ color: '#1e4fa0', metalness: 0.3, roughness: 0.35, clearcoat: 0.8 }),
    filterOrange: phys({ color: '#c06a18', metalness: 0.3, roughness: 0.35, clearcoat: 0.8 }),
    glassCoolant: phys({ color: '#2f7bff', transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0, transmission: 0 }),
  };
}

export type MaterialLib = ReturnType<typeof build>;

export function getMaterials(): MaterialLib {
  if (!cached) cached = build();
  return cached;
}

/**
 * Prepara un material clonado para la vista de sección: con un corte activo, las caras
 * interiores se pintan con rayado de sección, imitando el relleno de corte de un CAD.
 */
export function patchSection(m: THREE.Material): void {
  if (m.userData.sectionPatched) return;
  m.userData.sectionPatched = true;
  m.side = THREE.DoubleSide;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uSection = sectionUniform;
    shader.uniforms.uSectionColor = sectionColor;
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform float uSection;\nuniform vec3 uSectionColor;\nvoid main() {')
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        if (uSection > 0.5 && !gl_FrontFacing) {
          float h = step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y) / 9.0));
          gl_FragColor = vec4(mix(uSectionColor * 0.55, uSectionColor, h), gl_FragColor.a);
        }`,
      );
  };
  m.customProgramCacheKey = () => 'section';
}
