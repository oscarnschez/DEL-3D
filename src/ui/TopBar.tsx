import { useApp } from '@/state/store';
import { useSettings, type LightingPreset, type UiMode } from '@/state/settings';
import { getEngine } from '@/engines/catalog';
import { useSelection } from '@/interaction/selection';
import { cameraApi } from '@/camera/CameraRig';
import { MAIN_TOURS, TOURS } from '@/camera/tours';
import { LIGHTING } from '@/render/lighting';
import { useWarmup } from '@/render/warmup';
import { useT } from '@/i18n';
import { Icon, LogoMark } from './icons';

function StatusPill() {
  const t = useT();
  const running = useApp((s) => s.running);
  const paused = useApp((s) => s.paused);
  const tour = useApp((s) => s.tour);
  const ready = useWarmup((s) => s.done !== null);
  const [cls, label] = !ready
    ? ['loading', t('status.loading')]
    : tour
      ? ['tour', t('status.tour')]
      : paused
        ? ['paused', t('status.paused')]
        : running
          ? ['running', t('status.running')]
          : ['', t('status.stopped')];
  return (
    <span className={`status-pill ${cls}`} role="status">
      <i /> {label}
    </span>
  );
}

export function TopBar({ onToggleLeft, onToggleRight, onSettings, onHelp }: { onToggleLeft: () => void; onToggleRight: () => void; onSettings: () => void; onHelp: () => void }) {
  const t = useT();
  const app = useApp();
  const lighting = useSettings((s) => s.lighting);
  const lang = useSettings((s) => s.lang);
  const uiMode = useSettings((s) => s.uiMode);
  const setS = useSettings((s) => s.set);
  const def = getEngine(app.engineId);
  return (
    <header className="topbar">
      <button className="btn icon" onClick={onToggleLeft} title={`${t('left.catalog')} / ${t('left.components')}`} aria-label={t('left.catalog')}>
        <Icon name="menu" />
      </button>
      <div className="logo">
        <LogoMark />
        <div className="logo-text">
          DIESEL ENGINE LAB <span style={{ color: 'var(--blue)' }}>3D</span>
          <small>{t('app.subtitle').toUpperCase()}</small>
        </div>
      </div>
      <div className="engine-id">
        <b>
          {def.manufacturer} {def.model}
        </b>
        <span>
          {def.variant} · {def.year}
        </span>
      </div>
      <StatusPill />
      <div className="top-tools">
        <select className="sel-tour" value={app.tour ?? ''} onChange={(e) => app.set({ tour: e.target.value || null, caption: null, tourPaused: false })} title={t('top.tours')} aria-label={t('top.tours')}>
          <option value="">{t('top.tours')}…</option>
          <optgroup label="Recorridos principales">
            {MAIN_TOURS.map((id) => TOURS.find((x) => x.id === id)!).map((tr) => (
              <option key={tr.id} value={tr.id}>
                {tr.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Más recorridos">
            {TOURS.filter((x) => !MAIN_TOURS.includes(x.id)).map((tr) => (
              <option key={tr.id} value={tr.id}>
                {tr.label}
              </option>
            ))}
          </optgroup>
        </select>
        <button className={`btn ${app.showComparator ? 'on' : ''}`} onClick={() => app.set({ showComparator: true })} title={t('top.compare')}>
          <Icon name="compare" size={15} /> <span className="lbl">{t('top.compare')}</span>
        </button>
        <button className={`btn ${app.labels ? 'on' : ''}`} onClick={() => app.set({ labels: !app.labels })} title={`${t('top.labels')} (L)`}>
          <Icon name="tag" size={15} /> <span className="lbl">{t('top.labels')}</span>
        </button>
        <select className="sel-light" value={lighting} onChange={(e) => setS({ lighting: e.target.value as LightingPreset })} title={LIGHTING[lighting].description} aria-label={t('set.lighting')}>
          {(Object.keys(LIGHTING) as LightingPreset[]).map((p) => (
            <option key={p} value={p}>
              {LIGHTING[p].label}
            </option>
          ))}
        </select>
        <select className="sel-ui" value={uiMode} onChange={(e) => setS({ uiMode: e.target.value as UiMode })} title={`${t('top.uimode')} (P / C)`} aria-label={t('top.uimode')}>
          <option value="ingenieria">{t('ui.ingenieria')}</option>
          <option value="presentacion">{t('ui.presentacion')}</option>
          <option value="limpia">{t('ui.limpia')}</option>
        </select>
        <select className="lang-sel" value={lang} onChange={(e) => setS({ lang: e.target.value as 'es' | 'en' })} title={t('top.lang')} aria-label={t('top.lang')}>
          <option value="es">ES</option>
          <option value="en">EN</option>
        </select>
        <button
          className="btn icon"
          onClick={() => {
            useSelection.getState().restore();
            app.setMode('exterior');
            cameraApi.reset();
          }}
          title={`${t('top.reset.title')} (R)`}
          aria-label={t('top.reset')}
        >
          <Icon name="reset" />
        </button>
        <button className="btn icon" onClick={onHelp} title={`${t('top.help')} (?)`} aria-label={t('top.help')}>
          <Icon name="help" />
        </button>
        <button className="btn icon" onClick={onSettings} title={t('top.settings')} aria-label={t('top.settings')}>
          <Icon name="gear" />
        </button>
        <button
          className="btn icon"
          title={t('top.fullscreen')}
          aria-label={t('top.fullscreen')}
          onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())}
        >
          <Icon name="fullscreen" />
        </button>
        <button className="btn icon" onClick={onToggleRight} title={`${t('right.sheet')} / ${t('right.data')}`} aria-label={t('right.sheet')}>
          <Icon name="panel" />
        </button>
      </div>
    </header>
  );
}
