import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/state/store';
import { getEngine } from '@/engines/catalog';
import { deriveLayout } from '@/engines/derive';
import { gasState } from '@/core/kinematics/thermo';
import { injectionIntensity, valveLiftFraction } from '@/core/kinematics/valvetrain';
import { localCycleAngle } from '@/core/kinematics/cycle';
import { sim } from '@/core/simulation/clock';

const N = 360; // una muestra cada 2°

/**
 * Diagrama presión–ángulo del cilindro observado con los eventos que lo explican: alzada de
 * válvulas de admisión y escape (simulada, misma ley que mueve las válvulas) e inyección.
 * La presión sale del modelo termodinámico educativo (estimada). Pasar el puntero inspecciona
 * un ángulo; «Congelar» detiene el cursor.
 */
export function CycleChart() {
  const engineId = useApp((s) => s.engineId);
  const focus = useApp((s) => s.focusCylinder);
  const L = useMemo(() => deriveLayout(getEngine(engineId)), [engineId]);
  const ref = useRef<HTMLCanvasElement>(null);
  const [frozen, setFrozen] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const curves = useRef<{ p: Float32Array; ivl: Float32Array; evl: Float32Array; inj: Float32Array; pMax: number; load: number; boost: number } | null>(null);

  useEffect(() => {
    let raf = 0;
    let last = 0;
    let frozenPhi = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 80) return;
      last = t;
      const c = ref.current;
      if (!c || c.clientWidth === 0) return;
      const load = sim.load;
      const boost = Math.min(2.8, 2.8 * load * Math.min(1, sim.rpm / L.def.rpm.ratedPower) ** 1.3);
      // las curvas sólo dependen de carga y sobrealimentación: se recalculan cuando cambian
      const cur = curves.current;
      if (!cur || Math.abs(cur.load - load) > 0.01 || Math.abs(cur.boost - boost) > 0.02) {
        const p = new Float32Array(N);
        const ivl = new Float32Array(N);
        const evl = new Float32Array(N);
        const inj = new Float32Array(N);
        let pMax = 1;
        for (let k = 0; k < N; k++) {
          const phi = (k / N) * 720;
          p[k] = gasState(L, phi, load, boost).p;
          pMax = Math.max(pMax, p[k]);
          ivl[k] = valveLiftFraction(phi, L.intake);
          evl[k] = valveLiftFraction(phi, L.exhaust);
          inj[k] = injectionIntensity(phi, L.def.injection.event, Math.max(load, 0.05));
        }
        curves.current = { p, ivl, evl, inj, pMax, load, boost };
      }
      const cv = curves.current!;
      const w = (c.width = c.clientWidth * devicePixelRatio);
      const h = (c.height = c.clientHeight * devicePixelRatio);
      const g = c.getContext('2d')!;
      const dp = devicePixelRatio;
      g.clearRect(0, 0, w, h);
      const top = 6 * dp;
      const pH = h * 0.66;
      const evH = h - pH - 10 * dp;
      const X = (k: number) => (k / (N - 1)) * w;
      // rejilla: PMS de compresión (0/720) y PMS de cruce (360)
      g.strokeStyle = 'rgba(147,160,173,.18)';
      g.lineWidth = dp;
      for (const a of [180, 360, 540]) {
        g.beginPath();
        g.moveTo((a / 720) * w, 0);
        g.lineTo((a / 720) * w, h);
        g.stroke();
      }
      // eventos: válvulas (áreas) e inyección (barras)
      const band = (arr: Float32Array, color: string) => {
        g.fillStyle = color;
        g.beginPath();
        g.moveTo(0, h);
        for (let k = 0; k < N; k++) g.lineTo(X(k), h - arr[k] * evH);
        g.lineTo(w, h);
        g.closePath();
        g.fill();
      };
      band(cv.ivl, 'rgba(77,163,217,.45)');
      band(cv.evl, 'rgba(147,160,173,.45)');
      g.fillStyle = 'rgba(227,163,76,.9)';
      for (let k = 0; k < N; k++) if (cv.inj[k] > 0.02) g.fillRect(X(k), pH + top, Math.max(dp, w / N), 5 * dp);
      // presión
      g.strokeStyle = '#E3A34C';
      g.lineWidth = 1.6 * dp;
      g.beginPath();
      for (let k = 0; k < N; k++) {
        const y = top + pH - (cv.p[k] / cv.pMax) * (pH - top);
        if (k === 0) g.moveTo(X(k), y);
        else g.lineTo(X(k), y);
      }
      g.stroke();
      // cursor: ángulo actual del cilindro observado (o el congelado / inspeccionado)
      const live = localCycleAngle(sim.angle, L.fireAngles[focus - 1]);
      if (!frozen) frozenPhi = live;
      const phi = hover ?? frozenPhi;
      g.strokeStyle = hover !== null ? '#E8EDF2' : '#37C8D6';
      g.lineWidth = 1.5 * dp;
      g.beginPath();
      g.moveTo((phi / 720) * w, 0);
      g.lineTo((phi / 720) * w, h);
      g.stroke();
      const k = Math.min(N - 1, Math.round((phi / 720) * (N - 1)));
      g.fillStyle = '#E8EDF2';
      g.font = `${10 * dp}px JetBrains Mono, monospace`;
      const txt = `φ ${phi.toFixed(0)}° · p ≈ ${cv.p[k].toFixed(1)} bar`;
      const tx = Math.min(w - g.measureText(txt).width - 4 * dp, Math.max(4 * dp, (phi / 720) * w + 6 * dp));
      g.fillText(txt, tx, 12 * dp);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [L, focus, frozen, hover]);

  return (
    <>
      <canvas
        ref={ref}
        className="chart"
        style={{ height: 120, cursor: 'crosshair' }}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setHover(Math.max(0, Math.min(719.9, ((e.clientX - r.left) / r.width) * 720)));
        }}
        onPointerLeave={() => setHover(null)}
        aria-label={`Diagrama presión–ángulo del cilindro ${focus}`}
        role="img"
      />
      <div className="row wrap" style={{ gap: 10, fontSize: 10, marginTop: 4 }}>
        <span className="row" style={{ gap: 4 }}>
          <span className="swatch" style={{ background: '#E3A34C' }} /> Presión (est.)
        </span>
        <span className="row" style={{ gap: 4 }}>
          <span className="swatch" style={{ background: 'rgba(77,163,217,.8)' }} /> Válv. admisión
        </span>
        <span className="row" style={{ gap: 4 }}>
          <span className="swatch" style={{ background: 'rgba(147,160,173,.8)' }} /> Válv. escape
        </span>
        <span className="row" style={{ gap: 4 }}>
          <span className="swatch" style={{ background: '#E3A34C', height: 4 }} /> Inyección
        </span>
        <span className="spacer" />
        <button className={`btn sm ${frozen ? 'on' : ''}`} onClick={() => setFrozen((f) => !f)} title="Detener el cursor para inspeccionar">
          {frozen ? 'Reanudar' : 'Congelar'}
        </button>
      </div>
      <div className="muted small" style={{ marginTop: 2 }}>
        Cilindro {focus} · eje: φ 0–720° (0 = PMS de encendido) · pase el puntero para inspeccionar
      </div>
    </>
  );
}
