import { thermal, useThermalTick } from '@/core/thermal/state';
import { THERMAL_MAX, THERMAL_MIN, thermalColor, thermalScalePos } from '@/core/thermal/partTemps';
import type { ThermalKey } from '@/core/thermal/partTemps';

const TICKS = [20, 50, 100, 200, 400, 650];

/** Degradado CSS que reproduce exactamente la paleta de la vista térmica (misma escala). */
const GRADIENT = (() => {
  const c = { r: 0, g: 0, b: 0 };
  const stops: string[] = [];
  for (let k = 0; k <= 16; k++) {
    // posición lineal en la barra → temperatura con la misma escala logarítmica que los colores
    const u = k / 16;
    const t = (10 ** u - 1) / 9;
    thermalColor(THERMAL_MIN + t * (THERMAL_MAX - THERMAL_MIN), c);
    stops.push(`rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}) ${(u * 100).toFixed(1)}%`);
  }
  return `linear-gradient(90deg, ${stops.join(',')})`;
})();

const READINGS: { key: ThermalKey; label: string }[] = [
  { key: 'exhaustManifold', label: 'Múltiple de escape (EGT)' },
  { key: 'turboTurbine', label: 'Turbina' },
  { key: 'pistonCrown', label: 'Corona del pistón' },
  { key: 'turboCompressor', label: 'Salida del compresor' },
  { key: 'oilPan', label: 'Aceite (cárter)' },
  { key: 'thermostat', label: 'Refrigerante (termostato)' },
];

/**
 * Leyenda de la VISTA TÉRMICA. Las temperaturas son estimaciones de un modelo educativo con
 * inercia térmica (calentamiento desde frío, carga y régimen): no son mediciones de un motor real.
 */
export function ThermalLegend() {
  useThermalTick((s) => s.version);
  const t = thermal.temps;
  return (
    <div className="overlay thermal-legend" role="group" aria-label="Escala de la vista térmica">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <b>Vista térmica</b>
        <span className="badge estimado" title="Modelo simplificado: valores estimados, no medidos">ESTIMADO</span>
      </div>
      <div className="thermal-bar" style={{ background: GRADIENT }}>
        {READINGS.slice(0, 4).map((r) => (
          <span key={r.key} className="thermal-mark" style={{ left: `${thermalScalePos(t[r.key]) * 100}%` }} title={`${r.label}: ${t[r.key].toFixed(0)} °C`} />
        ))}
      </div>
      <div className="thermal-ticks">
        {TICKS.map((v) => (
          <span key={v} style={{ left: `${thermalScalePos(v) * 100}%` }}>
            {v}
          </span>
        ))}
        <span className="unit">°C</span>
      </div>
      <table className="thermal-table">
        <tbody>
          {READINGS.map((r) => (
            <tr key={r.key}>
              <td>{r.label}</td>
              <td className="num">≈ {t[r.key].toFixed(0)} °C</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="muted small">
        Temperaturas superficiales <b>simuladas</b> con un modelo educativo (calentamiento, carga y régimen). No son mediciones: no hay sensores reales conectados.
      </div>
    </div>
  );
}
