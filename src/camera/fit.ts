/** Distancia a la que una esfera de radio `r` cabe en el encuadre (vertical y horizontal). */
export function fitDistance(r: number, fovDeg: number, aspect: number, margin = 1.08): number {
  const vf = (fovDeg * Math.PI) / 180;
  const hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
  return (r * margin) / Math.sin(Math.min(vf, hf) / 2);
}
