import { useApp } from '@/state/store';
import { tourControl, useTourProgress } from '@/camera/tours';
import { Icon } from './icons';

/** Controles del recorrido en curso: plano actual, progreso, anterior/siguiente, pausa y cancelar. */
export function TourBar() {
  const tour = useApp((s) => s.tour);
  const paused = useApp((s) => s.tourPaused);
  const set = useApp((s) => s.set);
  const p = useTourProgress();
  if (!tour || p.total === 0) return null;
  return (
    <div className="overlay tour-bar" role="region" aria-label={`Recorrido: ${p.label}`}>
      <div className="row">
        <Icon name="film" size={15} />
        <b className="grow">{p.label}</b>
        <span className="mono muted">
          {p.index + 1}/{p.total}
        </span>
      </div>
      <div className="tour-steps">
        {Array.from({ length: p.total }, (_, i) => (
          <span key={i} className={i < p.index ? 'done' : i === p.index ? 'cur' : ''}>
            {i === p.index && <i style={{ width: `${p.frac * 100}%` }} />}
          </span>
        ))}
      </div>
      <div className="row" style={{ gap: 5 }}>
        <button className="btn sm icon" disabled={p.index === 0} onClick={() => (tourControl.jump = p.index - 1)} title="Plano anterior" aria-label="Plano anterior">
          <Icon name="stepBack" size={13} />
        </button>
        <button className={`btn sm ${paused ? 'on' : ''}`} onClick={() => set({ tourPaused: !paused })}>
          <Icon name={paused ? 'play' : 'pause'} size={13} /> {paused ? 'Reanudar' : 'Pausa'}
        </button>
        <button className="btn sm icon" disabled={p.index >= p.total - 1} onClick={() => (tourControl.jump = p.index + 1)} title="Plano siguiente" aria-label="Plano siguiente">
          <Icon name="stepFwd" size={13} />
        </button>
        <span className="spacer" />
        <button className="btn sm" onClick={() => set({ tour: null })} title="Cancelar recorrido (Esc)">
          <Icon name="close" size={13} /> Cancelar
        </button>
      </div>
    </div>
  );
}
