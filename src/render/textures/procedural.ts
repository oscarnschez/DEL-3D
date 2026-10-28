/**
 * Generación procedural de mapas PBR (funciones puras, sin DOM: se ejecutan en un Web Worker
 * y en las pruebas). Todas las texturas son periódicas (se repiten sin costuras).
 *
 * Cada acabado produce:
 *  - normal: mapa de normales en espacio tangente (RGB = XYZ·0.5+0.5).
 *  - orm: R = oclusión de microcavidades, G = factor de rugosidad, B = factor de metalicidad.
 *  - color (opcional): variación de color base (sRGB), p. ej. pátina térmica del escape.
 *
 * Son texturas de microdetalle (grano de fundición, marcas de mecanizado, chapa cepillada…),
 * no fotografías de piezas reales ni marcas de fabricante.
 */

export type FinishId = 'cast' | 'paint' | 'aluminum' | 'machined' | 'forged' | 'sheet' | 'rubber' | 'patina';

export const FINISHES: FinishId[] = ['cast', 'paint', 'aluminum', 'machined', 'forged', 'sheet', 'rubber', 'patina'];

export interface TextureSet {
  size: number;
  normal: Uint8Array;
  orm: Uint8Array;
  color?: Uint8Array;
}

function prng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Ruido de valor periódico (período = `cells` celdas a lo ancho de la textura) con interpolación suave. */
function valueNoise(size: number, cells: number, seed: number, out: Float32Array, amp: number) {
  const rnd = prng(seed);
  const g = new Float32Array(cells * cells);
  for (let i = 0; i < g.length; i++) g[i] = rnd() * 2 - 1;
  const at = (x: number, y: number) => g[((y % cells) + cells) % cells * cells + (((x % cells) + cells) % cells)];
  const k = cells / size;
  for (let y = 0; y < size; y++) {
    const fy = y * k;
    const iy = Math.floor(fy);
    let ty = fy - iy;
    ty = ty * ty * (3 - 2 * ty);
    for (let x = 0; x < size; x++) {
      const fx = x * k;
      const ix = Math.floor(fx);
      let tx = fx - ix;
      tx = tx * tx * (3 - 2 * tx);
      const a = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * tx;
      const b = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * tx;
      out[y * size + x] += (a + (b - a) * ty) * amp;
    }
  }
}

function fbm(size: number, baseCells: number, octaves: number, seed: number, gain = 0.5): Float32Array {
  const h = new Float32Array(size * size);
  let amp = 1;
  let cells = baseCells;
  for (let o = 0; o < octaves && cells <= size; o++) {
    valueNoise(size, cells, seed + o * 101, h, amp);
    amp *= gain;
    cells *= 2;
  }
  return h;
}

/** Ruido blanco (grano de un píxel). */
function grain(seed: number, amp: number, h: Float32Array) {
  const rnd = prng(seed);
  for (let i = 0; i < h.length; i++) h[i] += (rnd() * 2 - 1) * amp;
}

/** Desenfoque de caja periódico (r píxeles), para «rellenar» el grano bajo la pintura. */
function blur(size: number, h: Float32Array, r: number): Float32Array {
  const tmp = new Float32Array(h.length);
  const out = new Float32Array(h.length);
  const w = 2 * r + 1;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += h[y * size + ((x + k + size) % size)];
      tmp[y * size + x] = s / w;
    }
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += tmp[((y + k + size) % size) * size + x];
      out[y * size + x] = s / w;
    }
  return out;
}

/** Líneas paralelas a V (constante en U): marcas de torneado/rectificado o laminado. */
function streaks(size: number, seed: number, density: number, amp: number, h: Float32Array) {
  const rnd = prng(seed);
  const line = new Float32Array(size);
  for (let i = 0; i < size * density; i++) {
    const x = Math.floor(rnd() * size);
    const a = (rnd() * 2 - 1) * amp;
    line[x] += a;
    line[(x + 1) % size] += a * 0.5;
  }
  // variación lenta a lo largo de la línea para que no sea perfectamente uniforme
  const along = fbm(size, 4, 2, seed + 7);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) h[y * size + x] += line[x] * (0.75 + 0.25 * along[y * size + x]);
}

function normalize01(h: Float32Array): Float32Array {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of h) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const d = hi - lo || 1;
  const out = new Float32Array(h.length);
  for (let i = 0; i < h.length; i++) out[i] = (h[i] - lo) / d;
  return out;
}

/** Mapa de normales por diferencias centrales (periódico). `strength` en «pendiente por unidad de altura». */
export function normalFromHeight(size: number, h: Float32Array, strength: number): Uint8Array {
  const out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = h[y * size + ((x - 1 + size) % size)];
      const r = h[y * size + ((x + 1) % size)];
      const u = h[((y - 1 + size) % size) * size + x];
      const d = h[((y + 1) % size) * size + x];
      let nx = (l - r) * strength;
      let ny = (u - d) * strength;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const i = (y * size + x) * 4;
      out[i] = Math.round((nx * 0.5 + 0.5) * 255);
      out[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      out[i + 3] = 255;
    }
  }
  return out;
}

/**
 * ORM a partir de la altura normalizada: las cavidades (altura baja) ocluyen y son algo más rugosas.
 * Rangos expresados como factores multiplicativos de `roughness`/`metalness` del material.
 */
function ormFrom(size: number, h01: Float32Array, ao: number, rough: [number, number], metal: [number, number], extra?: Float32Array): Uint8Array {
  const out = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const v = h01[i];
    const e = extra ? extra[i] : 0.5;
    const o = 1 - ao * (1 - v) ** 2;
    const r = rough[0] + (rough[1] - rough[0]) * (0.6 * (1 - v) + 0.4 * e);
    const m = metal[0] + (metal[1] - metal[0]) * e;
    out[i * 4] = Math.round(Math.min(1, o) * 255);
    out[i * 4 + 1] = Math.round(Math.min(1, Math.max(0, r)) * 255);
    out[i * 4 + 2] = Math.round(Math.min(1, Math.max(0, m)) * 255);
    out[i * 4 + 3] = 255;
  }
  return out;
}

/** Genera el juego de mapas de un acabado. Determinista para un tamaño dado. */
export function generateFinish(id: FinishId, size: number): TextureSet {
  // Las frecuencias se expresan en celdas por textura y se escalan con el tamaño para que el
  // aspecto (milímetros por rasgo) no cambie entre perfiles: sólo cambia la nitidez.
  const s = size / 512;
  const cells = (c: number) => Math.max(2, Math.round(c * s) & ~1);
  switch (id) {
    case 'cast': {
      // fundición en arena: grano fino irregular + ondulación suave
      const h = fbm(size, cells(16), 5, 11, 0.55);
      grain(12, 0.35, h);
      const h01 = normalize01(h);
      const var1 = normalize01(fbm(size, 4, 3, 13));
      return { size, normal: normalFromHeight(size, h01, 3.2 * s), orm: ormFrom(size, h01, 0.35, [0.82, 1], [0.7, 1], var1) };
    }
    case 'paint': {
      // pintura industrial sobre fundición: el grano queda suavizado + leve «piel de naranja»
      const base = fbm(size, cells(16), 5, 11, 0.55);
      grain(12, 0.35, base);
      const filled = blur(size, base, Math.max(1, Math.round(2 * s)));
      const peel = fbm(size, cells(48), 2, 21, 0.5);
      for (let i = 0; i < filled.length; i++) filled[i] += peel[i] * 0.15;
      const h01 = normalize01(filled);
      const var1 = normalize01(fbm(size, 4, 3, 23));
      return { size, normal: normalFromHeight(size, h01, 1.6 * s), orm: ormFrom(size, h01, 0.18, [0.86, 1], [1, 1], var1) };
    }
    case 'aluminum': {
      // aluminio fundido a presión: grano más fino que el hierro
      const h = fbm(size, cells(32), 4, 31, 0.5);
      grain(32, 0.25, h);
      const h01 = normalize01(h);
      const var1 = normalize01(fbm(size, 4, 3, 33));
      return { size, normal: normalFromHeight(size, h01, 2.0 * s), orm: ormFrom(size, h01, 0.22, [0.78, 1], [0.85, 1], var1) };
    }
    case 'machined': {
      // superficie torneada/rectificada: marcas finas paralelas
      const h = new Float32Array(size * size);
      streaks(size, 41, 3, 1, h);
      grain(42, 0.08, h);
      const h01 = normalize01(h);
      const var1 = normalize01(fbm(size, 8, 3, 43));
      return { size, normal: normalFromHeight(size, h01, 1.1 * s), orm: ormFrom(size, h01, 0.05, [0.7, 1], [1, 1], var1) };
    }
    case 'forged': {
      // acero forjado: cascarilla moteada de baja frecuencia
      const h = fbm(size, cells(8), 5, 51, 0.6);
      grain(52, 0.12, h);
      const h01 = normalize01(h);
      const var1 = normalize01(fbm(size, cells(12), 3, 53));
      return { size, normal: normalFromHeight(size, h01, 1.6 * s), orm: ormFrom(size, h01, 0.15, [0.75, 1], [0.88, 1], var1) };
    }
    case 'sheet': {
      // chapa de acero inoxidable cepillada
      const h = new Float32Array(size * size);
      streaks(size, 61, 6, 1, h);
      const h01 = normalize01(h);
      const var1 = normalize01(fbm(size, 4, 3, 63));
      return { size, normal: normalFromHeight(size, h01, 0.6 * s), orm: ormFrom(size, h01, 0.03, [0.75, 1], [1, 1], var1) };
    }
    case 'rubber': {
      // caucho moldeado: microtextura mate
      const h = fbm(size, cells(64), 3, 71, 0.5);
      grain(72, 0.2, h);
      const h01 = normalize01(h);
      return { size, normal: normalFromHeight(size, h01, 0.9 * s), orm: ormFrom(size, h01, 0.12, [0.9, 1], [1, 1]) };
    }
    case 'patina': {
      // hierro de escape con pátina térmica: óxido pardo y tonos de revenido moderados
      const h = fbm(size, cells(16), 5, 81, 0.55);
      grain(82, 0.3, h);
      const h01 = normalize01(h);
      const ox = normalize01(fbm(size, cells(6), 4, 83, 0.55));
      const color = new Uint8Array(size * size * 4);
      for (let i = 0; i < size * size; i++) {
        const o = ox[i];
        // gris hierro → pardo óxido (sRGB), variación contenida (no «chatarra»)
        const r = 0.3 + 0.06 * o;
        const g = 0.29 + 0.025 * o;
        const b = 0.29 - 0.01 * o;
        const k = 0.85 + 0.15 * h01[i];
        color[i * 4] = Math.round(r * k * 255);
        color[i * 4 + 1] = Math.round(g * k * 255);
        color[i * 4 + 2] = Math.round(b * k * 255);
        color[i * 4 + 3] = 255;
      }
      return { size, normal: normalFromHeight(size, h01, 3.0 * s), orm: ormFrom(size, h01, 0.35, [0.85, 1], [0.6, 1], ox), color };
    }
  }
}
