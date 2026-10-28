import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useT } from '@/i18n';
import { Icon } from './icons';
import { useApp, type CutMode, type StepSize } from '@/state/store';
import { getEngine } from '@/engines/catalog';
import { firingAngles, localCycleAngle, nextPhaseBoundary, phaseOf, PHASE_COLOR, PHASE_LABEL, type StrokePhase } from '@/core/kinematics/cycle';
import { wrapDeg } from '@/core/kinematics/crank';
import { advanceCrank, setCrankAngle, sim } from '@/core/simulation/clock';
import { useSimWriter } from './useSimSnapshot';

const SPEEDS = [1, 0.5, 0.25, 0.1, 0.03];

/** Lectura de régimen y estado: se escribe directamente en el DOM a 20 Hz. */
function RpmReadout({ idle }: { idle: number }) {
  const running = useApp((s) => s.running);
  const num = useRef<HTMLSpanElement>(null);
  const st = useRef<HTMLDivElement>(null);
  const write = (s: { rpm: number }) => {
    if (num.current) num.current.textContent = String(Math.round(s.rpm));
    if (st.current) st.current.textContent = running ? (s.rpm < idle * 0.9 ? 'Arrancando' : 'En marcha') : s.rpm > 0 ? 'Deteniéndose' : 'Detenido';
  };
  useSimWriter(write, 20);
  useEffect(() => write(sim));
  return (
    <div>
      <div className="rpm-read">
        <span ref={num}>0</span>
        <small>rpm</small>
      </div>
      <div ref={st} className="ctrl-label" style={{ textAlign: 'right' }} />
    </div>
  );
}

export function BottomBar() {
  const t = useT();
  const app = useApp(
    useShallow((s) => ({
      engineId: s.engineId,
      running: s.running,
      paused: s.paused,
      targetRpm: s.targetRpm,
      load: s.load,
      stepSize: s.stepSize,
      timeScale: s.timeScale,
      cut: s.cut,
      cutOffset: s.cutOffset,
      explode: s.explode,
      transparency: s.transparency,
      focusCylinder: s.focusCylinder,
      set: s.set,
    })),
  );
  const def = getEngine(app.engineId);
  const fa = firingAngles(def.firingOrder);

  const step = (dir: 1 | -1) => {
    useApp.getState().set({ paused: true });
    if (app.stepSize === 'fase') {
      if (dir > 0) advanceCrank(wrapDeg(nextPhaseBoundary(sim.angle, fa) - sim.angle, 720) || 720);
      else advanceCrank(-30);
    } else {
      advanceCrank(dir * app.stepSize);
    }
  };

  return (
    <div className="bottombar">
      <div className="controls">
        <div className="ctrl-group">
          <button
            className={`btn-power btn ${app.running ? 'off' : ''}`}
            onClick={() => app.set({ running: !app.running, paused: false })}
            title={`${app.running ? t('bottom.stop') : t('bottom.start')} (E)`}
          >
            <Icon name={app.running ? 'stop' : 'play'} size={15} /> {(app.running ? t('bottom.stop') : t('bottom.start')).toUpperCase()}
          </button>
          <RpmReadout idle={def.rpm.idle} />
        </div>

        <div className="ctrl-group" style={{ minWidth: 230 }}>
          <div className="grow">
            <div className="row">
              <span className="ctrl-label">{t('bottom.target')}</span>
              <span className="spacer" />
              <span className="mono">{app.targetRpm}</span>
            </div>
            <input
              type="range"
              min={def.rpm.idle}
              max={def.rpm.max}
              step={10}
              value={app.targetRpm}
              onChange={(e) => app.set({ targetRpm: Number(e.target.value) })}
              aria-label="RPM objetivo"
            />
          </div>
          <div style={{ width: 110 }}>
            <div className="row">
              <span className="ctrl-label">{t('bottom.load')}</span>
              <span className="spacer" />
              <span className="mono">{Math.round(app.load * 100)}%</span>
            </div>
            <input type="range" min={0} max={1} step={0.01} value={app.load} onChange={(e) => app.set({ load: Number(e.target.value) })} aria-label="Carga" />
          </div>
        </div>

        <div className="ctrl-group">
          <button className="btn icon" title="Paso atrás (←)" aria-label="Paso atrás" onClick={() => step(-1)}>
            <Icon name="stepBack" />
          </button>
          <button className={`btn ${app.paused ? 'on' : ''}`} onClick={() => app.set({ paused: !app.paused })} title={`${t('bottom.pause')} / ${t('bottom.resume')} (Espacio)`}>
            <Icon name={app.paused ? 'play' : 'pause'} size={14} /> {app.paused ? t('bottom.resume') : t('bottom.pause')}
          </button>
          <button className="btn icon" title="Avance paso a paso (→)" aria-label="Avance paso a paso" onClick={() => step(1)}>
            <Icon name="stepFwd" />
          </button>
          <select value={String(app.stepSize)} onChange={(e) => app.set({ stepSize: (e.target.value === 'fase' ? 'fase' : Number(e.target.value)) as StepSize })} title="Tamaño del paso">
            <option value="1">1°</option>
            <option value="5">5°</option>
            <option value="15">15°</option>
            <option value="fase">Siguiente fase</option>
          </select>
        </div>

        <div className="ctrl-group">
          <span className="ctrl-label">{t('bottom.speed')}</span>
          {SPEEDS.map((s) => (
            <button key={s} className={`btn sm ${app.timeScale === s ? 'on' : ''}`} onClick={() => app.set({ timeScale: s })}>
              {s === 1 ? 'Normal' : `${s}×`}
            </button>
          ))}
          <button className={`btn sm amber ${app.timeScale < 1 ? 'on' : ''}`} onClick={() => app.set({ timeScale: app.timeScale < 1 ? 1 : 0.1 })} title={t('bottom.slowmo')}>
            <Icon name="slow" size={13} /> {t('bottom.slowmo')}
          </button>
        </div>

        <div className="ctrl-group">
          <span className="ctrl-label">{t('bottom.cut')}</span>
          <select value={app.cut} onChange={(e) => app.set({ cut: e.target.value as CutMode })}>
            <option value="none">Sin corte</option>
            <option value="longitudinal">Longitudinal</option>
            <option value="transversal">Transversal</option>
            <option value="cilindro">Por cilindro</option>
            <option value="libre">Plano libre</option>
          </select>
          {(app.cut === 'longitudinal' || app.cut === 'transversal' || app.cut === 'libre') && (
            <input style={{ width: 90 }} type="range" min={-1} max={1} step={0.01} value={app.cutOffset} onChange={(e) => app.set({ cutOffset: Number(e.target.value) })} aria-label="Posición del plano de corte" />
          )}
        </div>

        <div className="ctrl-group">
          <span className="ctrl-label">{t('bottom.explode')}</span>
          <input style={{ width: 90 }} type="range" min={0} max={1} step={0.01} value={app.explode} onChange={(e) => app.set({ explode: Number(e.target.value) })} aria-label="Despiece" />
          <span className="ctrl-label">{t('bottom.transp')}</span>
          <input style={{ width: 80 }} type="range" min={0} max={0.95} step={0.01} value={app.transparency} onChange={(e) => app.set({ transparency: Number(e.target.value) })} aria-label="Transparencia" />
        </div>

        <div className="ctrl-group">
          <span className="ctrl-label">{t('bottom.cyl')}</span>
          {def.firingOrder
            .slice()
            .sort((a, b) => a - b)
            .map((c) => (
              <button key={c} className={`btn sm icon ${app.focusCylinder === c ? 'on' : ''}`} onClick={() => app.set({ focusCylinder: c })} title={`Observar cilindro ${c}`}>
                {c}
              </button>
            ))}
        </div>
      </div>
      <CycleTimeline fireAngles={fa} focus={app.focusCylinder} />
    </div>
  );
}

function bands(fireAngle: number): { phase: StrokePhase; from: number; to: number }[] {
  // segmentos de fase en el eje de ángulo de cigüeñal 0–720 para un cilindro
  const out: { phase: StrokePhase; from: number; to: number }[] = [];
  const order: StrokePhase[] = ['expansion', 'escape', 'admision', 'compresion'];
  for (let k = 0; k < 4; k++) {
    const a = wrapDeg(fireAngle + k * 180, 720);
    const b = a + 180;
    if (b <= 720) out.push({ phase: order[k], from: a, to: b });
    else {
      out.push({ phase: order[k], from: a, to: 720 });
      out.push({ phase: order[k], from: 0, to: b - 720 });
    }
  }
  return out.sort((x, y) => x.from - y.from);
}

/** Línea de tiempo del ciclo de 720°: fases de cada cilindro y cursor arrastrable (rotación manual). */
function CycleTimeline({ fireAngles, focus }: { fireAngles: number[]; focus: number }) {
  const t = useT();
  const wrap = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const info = useRef<HTMLSpanElement>(null);
  const write = (s: { angle: number }) => {
    if (cursor.current) cursor.current.style.left = `${(s.angle / 720) * 100}%`;
    const phi = localCycleAngle(s.angle, fireAngles[focus - 1]);
    const ph = phaseOf(phi);
    if (info.current) {
      info.current.textContent = `Cil. ${focus}: ${PHASE_LABEL[ph]} · φ ${phi.toFixed(0)}°`;
      info.current.style.color = PHASE_COLOR[ph];
    }
  };
  useSimWriter(write, 30);
  useEffect(() => write(sim));
  const drag = (clientX: number) => {
    const r = wrap.current!.getBoundingClientRect();
    const t = Math.max(0, Math.min(0.9999, (clientX - r.left) / r.width));
    setCrankAngle(t * 720);
    useApp.getState().set({ paused: true });
  };
  return (
    <div>
      <div className="row" style={{ marginBottom: 4 }}>
        <span className="ctrl-label">{t('bottom.timeline')}</span>
        <span className="spacer" />
        {(Object.keys(PHASE_LABEL) as StrokePhase[]).map((p) => (
          <span key={p} className="row" style={{ gap: 4, fontSize: 10, color: 'var(--muted)' }}>
            <span className="swatch" style={{ background: PHASE_COLOR[p] }} />
            {PHASE_LABEL[p]}
          </span>
        ))}
        <span ref={info} className="mono" style={{ fontSize: 11 }} />
      </div>
      <div
        className="tl-wrap"
        ref={wrap}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          drag(e.clientX);
        }}
        onPointerMove={(e) => e.buttons === 1 && drag(e.clientX)}
      >
        {fireAngles.map((fa, i) => (
          <div key={i} className={`tl-row ${focus === i + 1 ? 'focus' : ''}`}>
            <span className="tl-cyl">C{i + 1}</span>
            {bands(fa).map((b, k) => (
              <span key={k} style={{ width: `${((b.to - b.from) / 720) * 100}%`, background: PHASE_COLOR[b.phase] }} />
            ))}
          </div>
        ))}
        <div ref={cursor} className="tl-cursor" />
      </div>
      <div className="tl-ticks">
        {[0, 90, 180, 270, 360, 450, 540, 630, 720].map((t) => (
          <span key={t}>{t}°</span>
        ))}
      </div>
    </div>
  );
}
