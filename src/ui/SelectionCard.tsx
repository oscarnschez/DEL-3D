import { useSelection } from '@/interaction/selection';
import { PARTS, SYSTEMS, parsePartKey } from '@/engines/parts';
import { cameraApi } from '@/camera/CameraRig';
import { useApp } from '@/state/store';
import { Icon } from './icons';

/** Tarjeta de la selección actual con sus acciones (encuadrar, aislar, entorno, relaciones, ocultar). */
export function SelectionCard() {
  const sel = useSelection();
  const tour = useApp((s) => s.tour);
  if (tour || (!sel.selected && !sel.systemSel)) return null;
  const part = sel.selected ? parsePartKey(sel.selected) : null;
  const info = part ? PARTS[part.id] : null;
  const sys = info ? SYSTEMS[info.system] : sel.systemSel ? SYSTEMS[sel.systemSel] : null;
  const title = info ? `${info.name}${part?.index ? ` · cilindro ${part.index}` : ''}` : (sys?.label ?? '');
  return (
    <div className="overlay sel-card" role="region" aria-label="Selección">
      <div className="row">
        {sys && <span className="swatch" style={{ background: sys.color }} />}
        <div className="grow">
          <b>{title}</b>
          <div className="muted small">{info ? sys?.label : 'Sistema completo'}</div>
        </div>
        <button className="btn icon sm" onClick={() => sel.select(null)} title="Quitar selección (Esc)" aria-label="Quitar selección">
          <Icon name="close" size={14} />
        </button>
      </div>
      <div className="row wrap sel-actions">
        {sel.selected && (
          <button className="btn sm" onClick={() => cameraApi.focusByName(sel.selected!)} title="Encuadrar (F · doble clic)">
            <Icon name="focus" size={13} /> Encuadrar
          </button>
        )}
        <button className={`btn sm ${sel.isolate ? 'on' : ''}`} onClick={() => sel.set({ isolate: !sel.isolate })} title="Aislar (I)">
          <Icon name="isolate" size={13} /> Aislar
        </button>
        {!sel.isolate && (
          <div className="seg mini-seg" title="Cómo se muestra el resto del motor">
            <button className={sel.surround === 'atenuado' ? 'on' : ''} onClick={() => sel.set({ surround: 'atenuado' })}>
              Atenuar
            </button>
            <button className={sel.surround === 'transparente' ? 'on' : ''} onClick={() => sel.set({ surround: 'transparente' })}>
              Transparente
            </button>
          </div>
        )}
        {info && info.related.length > 0 && (
          <button className={`btn sm ${sel.showRelated ? 'on' : ''}`} onClick={() => sel.set({ showRelated: !sel.showRelated })} title="Resaltar piezas relacionadas">
            <Icon name="link" size={13} /> Relacionadas
          </button>
        )}
        {part && (
          <button
            className="btn sm"
            onClick={() => {
              sel.toggleHidden(part.id);
              sel.select(null);
            }}
            title="Ocultar esta pieza (se restaura con «Restaurar»)"
          >
            <Icon name="eyeOff" size={13} /> Ocultar
          </button>
        )}
      </div>
      {info && sel.showRelated && (
        <div className="row wrap" style={{ marginTop: 6 }}>
          {info.related.map((r) => (
            <span key={r} className="chip" onClick={() => sel.select(r)}>
              {PARTS[r].name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
