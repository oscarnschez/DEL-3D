/**
 * Cinemática exacta del mecanismo biela-manivela (slider-crank) en línea.
 * Todas las funciones son puras; ángulos en radianes salvo que se indique lo contrario.
 */

export const DEG = Math.PI / 180;

/** Normaliza un ángulo en grados a [0, period). */
export function wrapDeg(angle: number, period = 720): number {
  const a = angle % period;
  return a < 0 ? a + period : a;
}

/**
 * Altura del bulón del pistón sobre el eje del cigüeñal.
 * @param alpha ángulo de la muñequilla medido desde el PMS (rad)
 * @param r radio de manivela (= carrera / 2)
 * @param l longitud de biela (centro a centro)
 */
export function pistonPinHeight(alpha: number, r: number, l: number): number {
  const s = Math.sin(alpha);
  return r * Math.cos(alpha) + Math.sqrt(l * l - r * r * s * s);
}

/** Desplazamiento del pistón desde el PMS (0 en PMS, 2r en PMI). */
export function pistonDisplacement(alpha: number, r: number, l: number): number {
  return r + l - pistonPinHeight(alpha, r, l);
}

/**
 * Ángulo de la biela respecto al eje del cilindro (rad).
 * Positivo cuando la muñequilla está desplazada hacia +Z.
 */
export function rodAngle(alpha: number, r: number, l: number): number {
  return Math.asin((r * Math.sin(alpha)) / l);
}

/** Velocidad del pistón (m/s) para una velocidad angular ω (rad/s); positiva hacia arriba. */
export function pistonVelocity(alpha: number, r: number, l: number, omega: number): number {
  const s = Math.sin(alpha);
  const c = Math.cos(alpha);
  const root = Math.sqrt(l * l - r * r * s * s);
  return -omega * (r * s + (r * r * s * c) / root);
}

/** Volumen instantáneo del cilindro (m³) dados diámetro, carrera, biela y relación de compresión. */
export function cylinderVolume(alpha: number, bore: number, r: number, l: number, compressionRatio: number): number {
  const area = (Math.PI * bore * bore) / 4;
  const swept = area * 2 * r;
  const clearance = swept / (compressionRatio - 1);
  return clearance + area * pistonDisplacement(alpha, r, l);
}
