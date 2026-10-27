import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/state/store';
import { getEngine } from '@/engines/catalog';
import { PARTS, SYSTEMS, parsePartKey } from '@/engines/parts';
import { useSelection } from '@/interaction/selection';
import { ORIGIN_HELP, ORIGIN_LABEL, readings } from '@/core/telemetry/model';
import { sim } from '@/core/simulation/clock';
import { cameraApi } from '@/camera/CameraRig';
import { useSimSnapshot } from './useSimSnapshot';
import { CycleDial } from './CycleDial';

type Tab = 'ficha' | 'pieza' | 'datos';

export function RightPanel() {
  const [tab, setTab] = useState<Tab>('datos');
  const selected = useSelection((s) => s.selected);
  useEffect(() => {
    if (selected) setTab('pieza');
  }, [selected]);
  return (
    <aside className="panel right">
      <div className="tabs">
        <button className={`tab ${tab === 'ficha' ? 'on' : ''}`} onClick={() => setTab('ficha')}>
          Ficha técnica
        </button>
        <button className={`tab ${tab === 'pieza' ? 'on' : ''}`} onClick={() => setTab('pieza')}>
          Pieza
        </button>
        <button className={`tab ${tab === 'datos' ? 'on' : ''}`} onClick={() => setTab('datos')}>
          Datos
        </button>
      </div>
      <div className="panel-body">
        {tab === 'ficha' && <SpecSheet />}
        {tab === 'pieza' && <PartSheet />}
        {tab === 'datos' && <Dashboard />}
      </div>
    </aside>
  );
}

export function StatusBadge({ s }: { s: string }) {
  const label: Record<string, string> = { verificado: 'VERIFICADO', aproximado: 'APROXIMADO' };
  return <span className={`badge ${s}`}>{label[s] ?? s.toUpperCase()}</span>;
}

function SpecSheet() {
  const def = getEngine(useApp((s) => s.engineId));
  const src = (id?: string) => def.sources.find((s) => s.id === id);
  return (
    <>
      <div className="brand">{def.manufacturer}</div>
      <h3 style={{ margin: '2px 0 2px' }}>{def.model}</h3>
      <div className="muted" style={{ fontSize: 12 }}>
        {def.variant} · {def.year}
      </div>
      {def.assets.provisional && (
        <div className="card" style={{ marginTop: 10, borderColor: 'rgba(255,138,42,.45)' }}>
          <span className="badge provisional">GEOMETRÍA PROVISIONAL</span>
          <p>La representación 3D es procedural y aproximada: respeta la arquitectura y la cinemática declaradas, pero no reproduce planos ni CAD del fabricante.</p>
        </div>
      )}
      <div className="section-title">Especificaciones</div>
      {def.specs.map((s) => {
        const so = src(s.sourceId);
        return (
          <div className="spec" key={s.key + s.label}>
            <span className="k">{s.label}</span>
            <StatusBadge s={s.status} />
            <span className="v">{s.value}</span>
            {s.note && <span className="n">{s.note}</span>}
            {so && (
              <span className="n">
                Fuente:{' '}
                <a href={so.url} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>
                  {so.title}
                </a>
              </span>
            )}
          </div>
        );
      })}
      <div className="section-title">Parámetros de simulación</div>
      <div className="kv">
        <span>Diámetro × carrera</span>
        <span className="mono">
          {(def.geometry.bore * 1000).toFixed(0)} × {(def.geometry.stroke * 1000).toFixed(0)} mm
        </span>
      </div>
      <div className="kv">
        <span>Biela (c-c)</span>
        <span className="mono">{(def.geometry.rodLength * 1000).toFixed(0)} mm</span>
      </div>
      <div className="kv">
        <span>Relación λ = r/l</span>
        <span className="mono">{(def.geometry.stroke / 2 / def.geometry.rodLength).toFixed(3)}</span>
      </div>
      <div className="kv">
        <span>Orden de encendido</span>
        <span className="mono">{def.firingOrder.join('-')}</span>
      </div>
      <div className="kv">
        <span>Reglaje (AAA/RCA/AAE/RCE)</span>
        <span className="mono">
          {def.valvetrain.timing.ivoBTDC}/{def.valvetrain.timing.ivcABDC}/{def.valvetrain.timing.evoBBDC}/{def.valvetrain.timing.evcATDC}°
        </span>
      </div>
      <div className="kv">
        <span>Distribución</span>
        <span>
          {def.valvetrain.camLocation === 'overhead' ? 'Árbol(es) en cabeza' : 'Árbol en bloque'} · {def.valvetrain.valvesPerCylinder} válv./cil. · tren {def.valvetrain.gearTrain === 'front' ? 'frontal' : 'trasero'}
        </span>
      </div>
      <p className="muted" style={{ fontSize: 11, lineHeight: 1.5 }}>
        Longitud de biela, reglaje de válvulas y altura de compresión: <StatusBadge s={def.geometry.derivedStatus} /> salvo que la ficha indique lo contrario.
      </p>
      <div className="section-title">Inyección y aire</div>
      <p className="muted" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 0 }}>{def.injection.description}</p>
      <p className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>{def.air.description}</p>
      {def.notes.length > 0 && (
        <>
          <div className="section-title">Notas</div>
          {def.notes.map((n, i) => (
            <p key={i} className="muted" style={{ fontSize: 12, lineHeight: 1.5, margin: '0 0 6px' }}>
              • {n}
            </p>
          ))}
        </>
      )}
      <div className="section-title">Fuentes</div>
      {def.sources.map((s) => (
        <div className="src" key={s.id}>
          <a href={s.url} target="_blank" rel="noreferrer">
            {s.title}
          </a>{' '}
          <span className="muted">(consultado {s.accessed})</span>
        </div>
      ))}
    </>
  );
}

function PartSheet() {
  const sel = useSelection();
  const app = useApp();
  if (!sel.selected && !sel.systemSel)
    return (
      <div className="empty">
        Seleccione una pieza en el visor 3D o en el explorador de componentes.
        <br />
        <br />
        Pase el cursor para resaltar; haga clic para enfocar y ver su ficha.
      </div>
    );
  if (sel.systemSel) {
    const s = SYSTEMS[sel.systemSel];
    return (
      <>
        <div className="brand">Conjunto completo</div>
        <h3 style={{ margin: '2px 0 8px', color: s.color }}>{s.label}</h3>
        <button className={`btn sm ${sel.isolate ? 'on' : ''}`} onClick={() => sel.set({ isolate: !sel.isolate })}>
          Aislar conjunto
        </button>
        <div className="section-title">Piezas</div>
        {Object.entries(PARTS)
          .filter(([, p]) => p.system === sel.systemSel)
          .map(([id, p]) => (
            <span key={id} className="chip" onClick={() => sel.select(id)}>
              {p.name}
            </span>
          ))}
      </>
    );
  }
  const { id, index } = parsePartKey(sel.selected!);
  const info = PARTS[id];
  const sys = SYSTEMS[info.system];
  const watchMotion = () => {
    sel.set({ isolate: true, showRelated: true });
    app.set({ running: true, paused: false, timeScale: 0.1 });
  };
  return (
    <>
      <div className="row">
        <span className="swatch" style={{ background: sys.color }} />
        <span className="brand">{sys.label}</span>
      </div>
      <h3 style={{ margin: '4px 0 2px' }}>
        {info.name}
        {index !== undefined && <span className="muted"> · cilindro {index}</span>}
      </h3>
      <div className="row wrap" style={{ gap: 6, margin: '10px 0' }}>
        <button className={`btn sm ${sel.isolate ? 'on' : ''}`} onClick={() => sel.set({ isolate: !sel.isolate })}>
          Aislar
        </button>
        <button className={`btn sm ${sel.showRelated ? 'on' : ''}`} onClick={() => sel.set({ showRelated: !sel.showRelated })}>
          Mostrar relacionadas
        </button>
        <button className="btn sm" onClick={() => sel.toggleGhost(id)}>
          Transparente
        </button>
        <button
          className="btn sm"
          onClick={() => {
            sel.toggleHidden(id);
            sel.select(null);
          }}
        >
          Ocultar
        </button>
        <button className="btn sm" onClick={() => cameraApi.focusByName(sel.selected!)}>
          Enfocar
        </button>
        {info.moving && (
          <button className="btn sm amber on" onClick={watchMotion}>
            ▶ Ver movimiento
          </button>
        )}
        <button className="btn sm" onClick={() => sel.restore()}>
          Restaurar
        </button>
      </div>
      <div className="section-title">Función</div>
      <p style={{ lineHeight: 1.55, margin: 0 }}>{info.function}</p>
      {info.motion && (
        <>
          <div className="section-title">Movimiento</div>
          <p style={{ lineHeight: 1.55, margin: 0 }}>{info.motion}</p>
        </>
      )}
      <div className="section-title">Relación con otros componentes</div>
      {info.related.map((r) => (
        <span key={r} className="chip" onClick={() => sel.select(index !== undefined && PARTS[r].perCylinder ? `${r}:${index}` : r)}>
          <span className="swatch" style={{ background: SYSTEMS[PARTS[r].system].color }} />
          {PARTS[r].name}
        </span>
      ))}
    </>
  );
}

function Dashboard() {
  const def = getEngine(useApp((s) => s.engineId));
  const snap = useSimSnapshot(12);
  const rs = readings(def, snap);
  const get = (k: string) => rs.find((r) => r.key === k)!;
  const show = ['torque', 'power', 'boost', 'oilP', 'fuelP', 'coolant', 'oilT', 'fuel', 'load'];
  const phase = get('phase');
  return (
    <>
      <div className="row" style={{ justifyContent: 'center' }}>
        <CycleDial size={170} />
      </div>
      <div className="gauges" style={{ marginTop: 6 }}>
        <Gauge r={get('rpm')} big />
        <div className="gauge">
          <span className={`badge simulado`} title={ORIGIN_HELP.simulado}>
            SIM
          </span>
          <div className="lbl">Cilindro en combustión</div>
          <div className="val">{get('cyl').value}</div>
          <div className="muted" style={{ fontSize: 10 }}>
            Orden {def.firingOrder.join('-')}
          </div>
        </div>
        <div className="gauge">
          <span className={`badge simulado`} title={ORIGIN_HELP.simulado}>
            SIM
          </span>
          <div className="lbl">Ángulo de cigüeñal</div>
          <div className="val">
            {snap.angle.toFixed(1)}
            <small>°</small>
          </div>
          <div className="muted" style={{ fontSize: 10 }}>{phase.text} (cil. 1)</div>
        </div>
        {show.map((k) => (
          <Gauge key={k} r={get(k)} />
        ))}
      </div>
      <div className="section-title">Gráfica en tiempo real</div>
      <LiveChart />
      <div className="section-title">Origen de los valores</div>
      {(['simulado', 'estimado', 'demostrativo'] as const).map((o) => (
        <div key={o} className="row" style={{ alignItems: 'flex-start', marginBottom: 6 }}>
          <span className={`badge ${o}`}>{ORIGIN_LABEL[o]}</span>
          <span className="muted" style={{ fontSize: 11, lineHeight: 1.4 }}>
            {ORIGIN_HELP[o]}
          </span>
        </div>
      ))}
    </>
  );
}

function Gauge({ r, big }: { r: ReturnType<typeof readings>[number]; big?: boolean }) {
  const pct = Math.max(0, Math.min(1, (r.value - r.min) / (r.max - r.min)));
  return (
    <div className={`gauge ${big ? 'big' : ''}`}>
      <span className={`badge ${r.origin}`} title={ORIGIN_HELP[r.origin]}>
        {ORIGIN_LABEL[r.origin]}
      </span>
      <div className="lbl">{r.label}</div>
      <div className="val" style={big ? { fontSize: 26 } : undefined}>
        {r.value.toFixed(r.decimals ?? 0)}
        <small>{r.unit}</small>
      </div>
      <div className="bar">
        <i style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

/** Gráfica de RPM, par y sobrealimentación (últimos 20 s). */
function LiveChart() {
  const ref = useRef<HTMLCanvasElement>(null);
  const def = getEngine(useApp((s) => s.engineId));
  useEffect(() => {
    const hist: { rpm: number; tq: number; boost: number }[] = [];
    let raf = 0;
    let last = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 100) return;
      last = t;
      const rs = readings(def, sim);
      hist.push({ rpm: sim.rpm / (def.rpm.max + 200), tq: rs[5].value / (def.nominal.torqueNm * 1.05), boost: rs[8].value / 320 });
      if (hist.length > 200) hist.shift();
      const c = ref.current;
      if (!c) return;
      const w = (c.width = c.clientWidth * devicePixelRatio);
      const h = (c.height = c.clientHeight * devicePixelRatio);
      const g = c.getContext('2d')!;
      g.clearRect(0, 0, w, h);
      g.strokeStyle = 'rgba(120,140,160,.12)';
      for (let k = 1; k < 4; k++) {
        g.beginPath();
        g.moveTo(0, (h * k) / 4);
        g.lineTo(w, (h * k) / 4);
        g.stroke();
      }
      const line = (key: 'rpm' | 'tq' | 'boost', color: string) => {
        g.strokeStyle = color;
        g.lineWidth = 1.5 * devicePixelRatio;
        g.beginPath();
        hist.forEach((p, i) => {
          const x = (i / 199) * w;
          const y = h - 4 - p[key] * (h - 8);
          if (i === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        });
        g.stroke();
      };
      line('boost', '#a78bfa');
      line('tq', '#ffb000');
      line('rpm', '#36e0c8');
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [def]);
  return (
    <>
      <canvas ref={ref} className="chart" />
      <div className="row" style={{ gap: 12, fontSize: 10, marginTop: 4 }}>
        <span className="row" style={{ gap: 4 }}>
          <span className="swatch" style={{ background: '#36e0c8' }} />
          RPM
        </span>
        <span className="row" style={{ gap: 4 }}>
          <span className="swatch" style={{ background: '#ffb000' }} />
          Par (est.)
        </span>
        <span className="row" style={{ gap: 4 }}>
          <span className="swatch" style={{ background: '#a78bfa' }} />
          Sobrealim. (demo)
        </span>
      </div>
    </>
  );
}
