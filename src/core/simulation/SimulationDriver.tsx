import { useFrame } from '@react-three/fiber';
import { useApp } from '@/state/store';
import { getEngine } from '@/engines/catalog';
import { advanceCrank, degreesFor, sim, stepRpm } from './clock';
import { egtTarget } from '@/core/thermal/partTemps';

/**
 * Integra el reloj de simulación una vez por frame (prioridad −2: antes que cualquier pieza).
 * El render lee `sim`; la simulación nunca lee del render.
 */
export function SimulationDriver() {
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20); // evita saltos tras pestañas inactivas
    const app = useApp.getState();
    const def = getEngine(app.engineId);
    const scaled = dt * app.timeScale;
    // régimen con inercia (en tiempo de simulación)
    const target = app.running ? app.targetRpm : 0;
    sim.rpm = stepRpm(sim.rpm, target, app.paused ? 0 : scaled, app.running);
    sim.load += (app.load - sim.load) * (1 - Math.exp(-scaled / 0.8));
    if (!app.paused) {
      advanceCrank(degreesFor(sim.rpm, scaled));
      sim.time += scaled;
      // turbo: velocidad educativa proporcional a caudal (rpm × carga); visual reducida ×1/400
      const turboTarget = (sim.rpm / def.rpm.max) * (0.35 + 0.65 * sim.load) * 120000;
      sim.turboRpm += (turboTarget - sim.turboRpm) * (1 - Math.exp(-scaled / 1.5));
      sim.turboAngle += ((sim.turboRpm / 60) * Math.PI * 2 * scaled) / 400;
      // térmico demostrativo: calienta con el motor en marcha, termostato ~88 °C
      const heat = app.running ? 20 + 72 * Math.min(1, 0.35 + 0.65 * sim.load) : 20;
      const tTarget = Math.min(heat + 14 * sim.load, app.running ? 88 + 8 * sim.load : 20);
      sim.coolantTemp += (tTarget - sim.coolantTemp) * (1 - Math.exp(-scaled / 25));
      sim.oilTemp += (tTarget + 10 * sim.load - sim.oilTemp) * (1 - Math.exp(-scaled / 40));
      // gases de escape: responden en segundos a carga y régimen (modelo educativo)
      sim.egt += (egtTarget(sim.rpm > 50, sim.load, sim.rpm / def.rpm.ratedPower) - sim.egt) * (1 - Math.exp(-scaled / 6));
    }
  }, -2);
  return null;
}
