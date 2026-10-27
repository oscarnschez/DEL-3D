import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Constructores de geometría procedural. Todas las funciones devuelven BufferGeometry
 * nuevas; los componentes las memoizan por dimensiones. Cotas en metros.
 */

/**
 * Lathe con orientación garantizada: las caras frontales y las normales apuntan hacia
 * afuera del sólido (necesario para el rayado de sección en caras interiores).
 */
export function lathe(profile: [number, number][], segments = 48): THREE.BufferGeometry {
  const build = (pts: [number, number][]) =>
    new THREE.LatheGeometry(
      pts.map(([x, y]) => new THREE.Vector2(Math.max(0, x), y)),
      segments,
    );
  let g = build(profile);
  if (!outwardWinding(g)) {
    g.dispose();
    g = build([...profile].reverse());
  }
  fixNormalsOutward(g);
  return g;
}

/** ¿El triángulo en el vértice de mayor radio está orientado hacia afuera? */
function outwardWinding(g: THREE.BufferGeometry): boolean {
  const pos = g.getAttribute('position');
  const idx = g.getIndex()!;
  let best = -1;
  let bestR = -1;
  for (let t = 0; t < idx.count; t += 3) {
    const a = idx.getX(t);
    const r = Math.hypot(pos.getX(a), pos.getZ(a));
    if (r > bestR) {
      bestR = r;
      best = t;
    }
  }
  const va = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(best));
  const vb = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(best + 1));
  const vc = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(best + 2));
  const n = new THREE.Vector3().subVectors(vb, va).cross(new THREE.Vector3().subVectors(vc, va));
  const centroid = va.add(vb).add(vc).divideScalar(3);
  const radial = new THREE.Vector3(centroid.x, 0, centroid.z);
  return n.dot(radial) >= 0;
}

function fixNormalsOutward(g: THREE.BufferGeometry): void {
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  let best = 0;
  let bestR = -1;
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getZ(i));
    if (r > bestR) {
      bestR = r;
      best = i;
    }
  }
  const radial = nor.getX(best) * pos.getX(best) + nor.getZ(best) * pos.getZ(best);
  if (radial < 0) {
    for (let i = 0; i < nor.count; i++) nor.setXYZ(i, -nor.getX(i), -nor.getY(i), -nor.getZ(i));
    nor.needsUpdate = true;
  }
}

/** Extruye una forma 2D (u → Z de escena, v → Y de escena) a lo largo del eje X, centrada. */
export function extrudeX(shape: THREE.Shape, length: number, bevel = 0.002, curveSegments = 24): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(1e-4, length - 2 * bevel),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments,
  });
  g.translate(0, 0, -(length - 2 * bevel) / 2);
  g.rotateY(-Math.PI / 2);
  return g;
}

/** Forma rectangular con esquinas redondeadas (centrada en cx, cy). */
export function roundedRectShape(w: number, h: number, r: number, cx = 0, cy = 0): THREE.Shape {
  const s = new THREE.Shape();
  const x = cx - w / 2;
  const y = cy - h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Forma a partir de una lista de puntos [u, v]. */
export function polyShape(pts: [number, number][]): THREE.Shape {
  const s = new THREE.Shape();
  pts.forEach(([u, v], i) => (i === 0 ? s.moveTo(u, v) : s.lineTo(u, v)));
  s.closePath();
  return s;
}

// ───────────────────────── Tren alternativo ─────────────────────────

/** Pistón con cámara omega en la corona, ranuras de anillos y falda. y = 0 en el eje del bulón. */
export function pistonGeometry(bore: number, compressionHeight: number): THREE.BufferGeometry {
  const R = bore / 2 - 0.0003;
  const ch = compressionHeight;
  const skirt = -ch * 0.62;
  const inner = R - bore * 0.075;
  const bowlR = bore * 0.33;
  const bowlD = bore * 0.15;
  const g = (k: number) => R - 0.0035 * k;
  const ringTop = ch - bore * 0.07;
  const rw = bore * 0.022; // altura de ranura
  const p: [number, number][] = [
    [0, ch - bore * 0.16],
    [inner, ch - bore * 0.16],
    [inner, skirt + 0.004],
    [inner + 0.004, skirt],
    [R - 0.001, skirt],
    [R, skirt + 0.002],
    [R, ringTop - 3.2 * rw - bore * 0.05],
    // ranura de anillo de aceite
    [g(1.3), ringTop - 3.2 * rw - bore * 0.05],
    [g(1.3), ringTop - 2.2 * rw - bore * 0.05],
    [R, ringTop - 2.2 * rw - bore * 0.05],
    [R, ringTop - 2.2 * rw],
    // segundo anillo
    [g(1), ringTop - 2.2 * rw],
    [g(1), ringTop - 1.2 * rw],
    [R, ringTop - 1.2 * rw],
    [R, ringTop - rw * 0.9],
    // anillo de fuego
    [g(1), ringTop - rw * 0.9],
    [g(1), ringTop],
    [R, ringTop],
    [R, ch - 0.0015],
    [R - 0.0015, ch],
    // corona y cámara omega
    [bowlR + 0.004, ch],
    [bowlR, ch - 0.004],
    [bowlR - 0.002, ch - bowlD * 0.45],
    [bowlR * 0.82, ch - bowlD],
    [bowlR * 0.45, ch - bowlD * 0.92],
    [bowlR * 0.12, ch - bowlD * 0.45],
    [0, ch - bowlD * 0.35],
  ];
  return lathe(p, 56);
}

/** Juego de anillos (tres), geometría de los anillos en sus ranuras. */
export function ringsGeometry(bore: number, compressionHeight: number): THREE.BufferGeometry {
  const R = bore / 2 - 0.0002;
  const ringTop = compressionHeight - bore * 0.07;
  const rw = bore * 0.022;
  const mk = (y0: number, y1: number, depth: number) =>
    lathe([[R - depth, y0], [R, y0], [R, y1], [R - depth, y1]], 56);
  return mergeGeometries([
    mk(ringTop - rw * 0.85, ringTop - 0.0004, 0.0032),
    mk(ringTop - 2.15 * rw, ringTop - 1.25 * rw, 0.0032),
    mk(ringTop - 3.15 * rw - bore * 0.05, ringTop - 2.25 * rw - bore * 0.05, 0.0042),
  ])!;
}

/** Bulón del pistón, a lo largo de Z. */
export function wristPinGeometry(bore: number): THREE.BufferGeometry {
  const r = bore * 0.19;
  const ri = r * 0.55;
  const L = bore * 0.82;
  const g = lathe([[ri, -L / 2], [r, -L / 2], [r, L / 2], [ri, L / 2]], 32);
  g.rotateX(Math.PI / 2);
  return g;
}

/** Biela: perfil con cabeza y pie redondeados y vástago cónico, extruida a lo largo de X. Cabeza en el origen, pie en (0, l). */
export function rodGeometry(l: number, pinRadius: number, wristRadius: number, width: number): THREE.BufferGeometry {
  const Rb = pinRadius + 0.012;
  const Rs = wristRadius + 0.009;
  const w1 = Rb * 0.62;
  const w2 = Rs * 0.62;
  const s = new THREE.Shape();
  const hb = Math.sqrt(Rb * Rb - w1 * w1);
  const hs = Math.sqrt(Rs * Rs - w2 * w2);
  const a0 = Math.atan2(hb, w1);
  // contorno: cabeza (inferior) en sentido horario
  s.moveTo(w1, hb);
  s.absarc(0, 0, Rb, a0, Math.PI - a0, true);
  // vástago izquierdo hacia el pie
  s.lineTo(-w2, l - hs);
  const as = Math.atan2(-hs, -w2);
  s.absarc(0, l, Rs, as, Math.atan2(-hs, w2), true);
  s.lineTo(w1, hb);
  const big = new THREE.Path();
  big.absarc(0, 0, pinRadius + 0.0005, 0, Math.PI * 2, false);
  const small = new THREE.Path();
  small.absarc(0, l, wristRadius + 0.0005, 0, Math.PI * 2, false);
  s.holes.push(big, small);
  const geo = extrudeX(s, width, 0.0025, 40);
  // nervadura central (sección en I): un relieve más delgado y largo
  const rib = new THREE.Shape();
  rib.moveTo(w1 * 0.35, hb + 0.005);
  rib.lineTo(w2 * 0.35, l - hs - 0.004);
  rib.lineTo(-w2 * 0.35, l - hs - 0.004);
  rib.lineTo(-w1 * 0.35, hb + 0.005);
  rib.closePath();
  const ribGeo = extrudeX(rib, width * 1.35, 0.0015, 4);
  return mergeGeometries([geo, ribGeo])!;
}

/** Contrapeso/brazo del cigüeñal (unión de muñón, muñequilla y masa opuesta), muñequilla en +Y. */
export function crankWebShape(r: number, mainR: number, pinR: number, cwR: number): THREE.Shape {
  const N = 160;
  const radii: number[] = [];
  for (let i = 0; i < N; i++) {
    const psi = (i / N) * Math.PI * 2; // 0 = dirección de la muñequilla
    const a = pinR * 1.3;
    let R = mainR * 1.25;
    const disc = a * a - r * r * Math.sin(psi) ** 2;
    if (disc >= 0 && Math.cos(psi) > 0) R = Math.max(R, r * Math.cos(psi) + Math.sqrt(disc));
    const dOpp = Math.abs(((psi - Math.PI + Math.PI) % (Math.PI * 2)) - Math.PI);
    const half = 1.15;
    if (dOpp < half) R = Math.max(R, cwR * (1 - 0.18 * Math.pow(dOpp / half, 6)));
    radii.push(R);
  }
  // suavizado circular (filetes de fundición)
  const smooth = radii.map((_, i) => {
    let sum = 0;
    for (let k = -4; k <= 4; k++) sum += radii[(i + k + N) % N];
    return sum / 9;
  });
  const s = new THREE.Shape();
  smooth.forEach((R, i) => {
    const psi = (i / N) * Math.PI * 2;
    const u = R * Math.sin(psi);
    const v = R * Math.cos(psi);
    if (i === 0) s.moveTo(u, v);
    else s.lineTo(u, v);
  });
  s.closePath();
  return s;
}

/** Cilindro (muñón) a lo largo de X con chaflanes. */
export function journalGeometry(radius: number, length: number, segments = 40): THREE.BufferGeometry {
  const c = Math.min(0.0015, length * 0.1);
  const g = lathe(
    [
      [0, -length / 2],
      [radius - c, -length / 2],
      [radius, -length / 2 + c],
      [radius, length / 2 - c],
      [radius - c, length / 2],
      [0, length / 2],
    ],
    segments,
  );
  g.rotateZ(-Math.PI / 2);
  return g;
}

// ───────────────────────── Distribución ─────────────────────────

/**
 * Lóbulo de leva generado a partir de la ley de alzada de la leva (no de la válvula):
 * radio(γ) = base + alzadaLeva. `liftAt(γ)` recibe el ángulo polar local del lóbulo (rad,
 * convención de rotación alrededor de X: y = cos γ, z = sin γ). Extruido a lo largo de X.
 */
export function camLobeGeometry(base: number, width: number, liftAt: (gamma: number) => number): THREE.BufferGeometry {
  const N = 240;
  const s = new THREE.Shape();
  for (let i = 0; i < N; i++) {
    const gma = (i / N) * Math.PI * 2;
    const R = base + liftAt(gma);
    // y = R cos γ, z = R sin γ  →  shape u = z, v = y (extrudeX mapea u→Z, v→Y)
    const u = R * Math.sin(gma);
    const v = R * Math.cos(gma);
    if (i === 0) s.moveTo(u, v);
    else s.lineTo(u, v);
  }
  s.closePath();
  return extrudeX(s, width, 0.0008, 4);
}

/** Válvula: cabeza con asiento a 45°, cuello y vástago. y = 0 en la cara de la cabeza; vástago hacia +Y. */
export function valveGeometry(headR: number, stemLength: number): THREE.BufferGeometry {
  const st = headR * 0.2;
  return lathe(
    [
      [0, 0],
      [headR - 0.0015, 0],
      [headR, 0.0015],
      [headR, 0.003],
      [headR - 0.004, 0.007],
      [st * 2.2, 0.014],
      [st * 1.3, 0.024],
      [st, 0.034],
      [st, stemLength - 0.006],
      [st * 0.85, stemLength - 0.0045],
      [st * 0.85, stemLength - 0.003],
      [st, stemLength - 0.0015],
      [st, stemLength],
      [0, stemLength],
    ],
    28,
  );
}

/** Resorte de válvula helicoidal (TubeGeometry). Altura unitaria en Y: escalar en Y para comprimir. */
export function springGeometry(radius: number, wire: number, turns = 6.5): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  const N = Math.ceil(turns * 24);
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = t * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, t, Math.sin(a) * radius));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), N, wire, 6, false);
}

/** Engrane recto (perfil trapezoidal aproximado al involuta) extruido a lo largo de X. */
export function gearGeometry(radius: number, teeth: number, width: number, bore = 0.2): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const m = (2 * radius) / teeth;
  const ra = radius + m;
  const rf = radius - 1.25 * m;
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const da = (Math.PI * 2) / teeth;
    const pts: [number, number][] = [
      [rf, a0],
      [rf, a0 + da * 0.12],
      [ra, a0 + da * 0.3],
      [ra, a0 + da * 0.5],
      [rf, a0 + da * 0.68],
    ];
    pts.forEach(([r, a], k) => {
      const u = r * Math.sin(a);
      const v = r * Math.cos(a);
      if (i === 0 && k === 0) s.moveTo(u, v);
      else s.lineTo(u, v);
    });
  }
  s.closePath();
  const h = new THREE.Path();
  h.absarc(0, 0, radius * bore, 0, Math.PI * 2, true);
  s.holes.push(h);
  // aligeramientos
  if (radius > 0.05) {
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const hole = new THREE.Path();
      hole.absarc(Math.sin(a) * radius * 0.55, Math.cos(a) * radius * 0.55, radius * 0.16, 0, Math.PI * 2, true);
      s.holes.push(hole);
    }
  }
  return extrudeX(s, width, 0.0008, 6);
}

/** Tubo a lo largo de una polilínea suavizada. */
export function pipeGeometry(points: THREE.Vector3[], radius: number, tubular = 64, radial = 12, tension = 0.5): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', tension);
  return new THREE.TubeGeometry(curve, tubular, radius, radial, false);
}

/** Tornillo de cabeza hexagonal con arandela; eje en +Y, base en y = 0. */
export function boltGeometry(d: number): THREE.BufferGeometry {
  const head = new THREE.CylinderGeometry(d * 0.85, d * 0.85, d * 0.65, 6);
  head.translate(0, d * 0.32 + d * 0.12, 0);
  const washer = new THREE.CylinderGeometry(d * 1.05, d * 1.05, d * 0.12, 20);
  washer.translate(0, d * 0.06, 0);
  return mergeGeometries([head.toNonIndexed(), washer.toNonIndexed()])!;
}

export { mergeGeometries };
