import { useT } from '@/i18n';
import { useState } from 'react';
import { useApp, type FlowSystem } from '@/state/store';
import { ENGINES } from '@/engines/catalog';
import { PARTS, SYSTEMS, type PartId, type SystemId } from '@/engines/parts';
import { useSelection } from '@/interaction/selection';
import { resetSim } from '@/core/simulation/clock';

type Tab = 'catalogo' | 'componentes' | 'sistemas';

export function LeftPanel() {
  const t = useT();
  const [tab, setTab] = useState<Tab>('catalogo');
  return (
    <aside className="panel left">
      <div className="tabs">
        <button className={`tab ${tab === 'catalogo' ? 'on' : ''}`} onClick={() => setTab('catalogo')}>
          {t('left.catalog')}
        </button>
        <button className={`tab ${tab === 'componentes' ? 'on' : ''}`} onClick={() => setTab('componentes')}>
          {t('left.components')}
        </button>
        <button className={`tab ${tab === 'sistemas' ? 'on' : ''}`} onClick={() => setTab('sistemas')}>
          {t('left.systems')}
        </button>
      </div>
      <div className="panel-body">
        {tab === 'catalogo' && <Catalog />}
        {tab === 'componentes' && <Explorer />}
        {tab === 'sistemas' && <Systems />}
      </div>
    </aside>
  );
}

function Catalog() {
  const engineId = useApp((s) => s.engineId);
  const set = useApp((s) => s.set);
  const makers = Array.from(new Set(ENGINES.map((e) => e.manufacturer)));
  return (
    <>
      {makers.map((m) => (
        <div key={m}>
          <div className="section-title">{m}</div>
          {ENGINES.filter((e) => e.manufacturer === m).map((e) => (
            <div
              key={e.id}
              className={`card clickable ${engineId === e.id ? 'sel' : ''}`}
              onClick={() => {
                if (e.id === engineId) return;
                useSelection.getState().restore();
                resetSim();
                set({ engineId: e.id, targetRpm: e.rpm.idle, running: false, paused: false });
              }}
            >
              <div className="row">
                <div className="grow">
                  <div className="brand">{e.manufacturer}</div>
                  <h4>{e.model}</h4>
                </div>
                {e.assets.provisional && <span className="badge provisional">PROVISIONAL</span>}
              </div>
              <p>
                {e.variant} · {e.year}
              </p>
            </div>
          ))}
        </div>
      ))}
      <p className="muted" style={{ fontSize: 11, lineHeight: 1.5 }}>
        Para agregar un motor: crear un archivo en <span className="mono">src/engines/catalog/</span> con su definición (geometría, distribución, inyección, fichas y fuentes) y registrarlo en <span className="mono">index.ts</span>.
      </p>
    </>
  );
}

function Explorer() {
  const sel = useSelection();
  const bySystem = Object.entries(SYSTEMS).map(([sid, s]) => ({
    sid: sid as SystemId,
    s,
    parts: (Object.keys(PARTS) as PartId[]).filter((p) => PARTS[p].system === sid),
  }));
  return (
    <>
      <div className="row wrap" style={{ marginBottom: 8, gap: 6 }}>
        <button className="btn sm" onClick={() => sel.restore()}>
          ↺ Restaurar motor
        </button>
        <button className={`btn sm ${sel.isolate ? 'on' : ''}`} onClick={() => sel.set({ isolate: !sel.isolate })} disabled={!sel.selected && !sel.systemSel}>
          Aislar
        </button>
        <button className={`btn sm ${sel.showRelated ? 'on' : ''}`} onClick={() => sel.set({ showRelated: !sel.showRelated })} disabled={!sel.selected}>
          Relacionadas
        </button>
      </div>
      {bySystem.map(({ sid, s, parts }) => (
        <div key={sid}>
          <div className="section-title">
            <span className="swatch" style={{ background: s.color }} />
            <span style={{ cursor: 'pointer' }} onClick={() => sel.set({ systemSel: sel.systemSel === sid ? null : sid, selected: null })} title="Seleccionar conjunto completo">
              {s.label}
            </span>
          </div>
          {parts.map((p) => {
            const isSel = sel.selected?.split(':')[0] === p;
            return (
              <div key={p} className={`part-row ${isSel ? 'sel' : ''}`} onClick={() => sel.select(p)}>
                <span className="swatch" style={{ background: s.color, opacity: 0.6 }} />
                <span className="name">{PARTS[p].name}</span>
                {PARTS[p].moving && <span className="badge simulado" title="Pieza móvil">MÓVIL</span>}
                <button
                  className={`mini ${sel.ghosted.has(p) ? 'on' : ''}`}
                  title="Transparente"
                  onClick={(e) => {
                    e.stopPropagation();
                    sel.toggleGhost(p);
                  }}
                >
                  ◐
                </button>
                <button
                  className={`mini ${sel.hidden.has(p) ? 'on' : ''}`}
                  title="Ocultar"
                  onClick={(e) => {
                    e.stopPropagation();
                    sel.toggleHidden(p);
                  }}
                >
                  {sel.hidden.has(p) ? '⊘' : '◉'}
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

const FLOW_INFO: Record<FlowSystem, { label: string; desc: string; color: string }> = {
  lubricacion: { label: 'Lubricación', desc: 'Cárter → bomba → filtro → galerías → cojinetes, levas y turbo', color: '#ffb000' },
  combustible: { label: 'Combustible', desc: 'Tanque → filtros → alta presión → inyectores', color: '#ffd23f' },
  refrigeracion: { label: 'Refrigeración', desc: 'Bomba → camisas → culata → termostato → radiador', color: '#2f7bff' },
  aire: { label: 'Admisión y escape', desc: 'Compresor → intercooler → cilindros → turbina → postratamiento', color: '#3fa9ff' },
};

function Systems() {
  const flows = useApp((s) => s.flows);
  const toggleFlow = useApp((s) => s.toggleFlow);
  const removed = useApp((s) => s.removed);
  const toggleCover = useApp((s) => s.toggleCover);
  const running = useApp((s) => s.running);
  return (
    <>
      <div className="section-title">Flujos superponibles</div>
      {(Object.keys(FLOW_INFO) as FlowSystem[]).map((f) => (
        <div key={f} className={`toggle ${flows[f] ? 'on' : ''}`} onClick={() => toggleFlow(f)}>
          <span className="swatch" style={{ background: FLOW_INFO[f].color }} />
          <span className="t">
            {FLOW_INFO[f].label}
            <small>{FLOW_INFO[f].desc}</small>
          </span>
          <span className="sw" />
        </div>
      ))}
      {!running && <p className="muted" style={{ fontSize: 11 }}>Los fluidos circulan en proporción al régimen: encienda el motor para verlos en movimiento.</p>}
      <p className="muted" style={{ fontSize: 11, lineHeight: 1.5 }}>Representaciones educativas animadas de los recorridos, no simulaciones CFD.</p>
      <div className="section-title">Retirar cubiertas</div>
      {(
        [
          ['valveCover', 'Tapa de válvulas'],
          ['head', 'Culata'],
          ['oilPan', 'Cárter'],
          ['block', 'Bloque y carcasas'],
          ['manifolds', 'Admisión, escape y turbo'],
        ] as const
      ).map(([k, label]) => (
        <div key={k} className={`toggle ${removed[k] ? 'on' : ''}`} onClick={() => toggleCover(k)}>
          <span className="t">{label}</span>
          <span className="sw" />
        </div>
      ))}
    </>
  );
}
