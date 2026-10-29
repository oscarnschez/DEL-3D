/**
 * Estado mutable de la simulación. Se integra una vez por frame en SimulationDriver
 * y lo leen las piezas en su useFrame. React no se re-renderiza por cambios aquí.
 */
export interface SimState {
  /** Ángulo del cigüeñal en grados, normalizado a [0, 720). Fuente de verdad de toda la cinemática. */
  angle: number;
  /** RPM reales actuales (con inercia de arranque/parada). */
  rpm: number;
  /** Ángulo acumulado del rotor del turbo (rad). */
  turboAngle: number;
  /** Velocidad del turbo (rpm, modelo educativo). */
  turboRpm: number;
  /** Tiempo de simulación transcurrido (s, escalado). */
  time: number;
  /** Temperatura de refrigerante (°C, modelo demostrativo). */
  coolantTemp: number;
  /** Temperatura de aceite (°C, modelo demostrativo). */
  oilTemp: number;
  /** Carga actual filtrada (0–1). */
  load: number;
  /**
   * Revoluciones de cigüeñal acumuladas, sin envolver. Base temporal común de los efectos
   * (flujos, remolino, partículas): avanza con el reloj, se detiene en pausa y se mueve con el
   * avance manual (también hacia atrás), así los efectos son coherentes con la cinemática.
   */
  revs: number;
  /** Temperatura de gases de escape estimada (°C, modelo educativo con inercia). */
  egt: number;
}

export const sim: SimState = {
  angle: 0,
  rpm: 0,
  turboAngle: 0,
  turboRpm: 0,
  time: 0,
  coolantTemp: 24,
  oilTemp: 24,
  load: 0.4,
  revs: 0,
  egt: 24,
};

/** Gira el cigüeñal `deltaDeg` grados (positivo = sentido de giro), manteniendo `revs` coherente. */
export function advanceCrank(deltaDeg: number): void {
  const a = (sim.angle + deltaDeg) % 720;
  sim.angle = a < 0 ? a + 720 : a;
  sim.revs += deltaDeg / 360;
}

/** Lleva el cigüeñal a `angleDeg` (0–720) por el camino más corto (arrastre de la línea de tiempo). */
export function setCrankAngle(angleDeg: number): void {
  let d = (angleDeg - sim.angle) % 720;
  if (d >= 360) d -= 720;
  if (d < -360) d += 720;
  advanceCrank(d);
}

export function resetSim(): void {
  sim.angle = 0;
  sim.rpm = 0;
  sim.turboAngle = 0;
  sim.turboRpm = 0;
  sim.time = 0;
  sim.revs = 0;
}

/** Integración del régimen: respuesta de primer orden hacia el objetivo. */
export function stepRpm(current: number, target: number, dt: number, running: boolean): number {
  if (running) {
    const tau = current < target ? 0.55 : 0.8;
    return current + (target - current) * (1 - Math.exp(-dt / tau));
  }
  const next = current * Math.exp(-dt / 0.7) - 40 * dt;
  return next < 5 ? 0 : next;
}

/** Grados de cigüeñal recorridos en dt segundos a `rpm`. */
export function degreesFor(rpm: number, dt: number): number {
  return rpm * 6 * dt;
}
