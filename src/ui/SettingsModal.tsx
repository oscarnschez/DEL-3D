import { useEffect, useRef } from 'react';
import { useSettings, type LightingPreset } from '@/state/settings';
import { PROFILE_HELP, PROFILES, type ProfileChoice } from '@/render/quality/profiles';
import { LIGHTING } from '@/render/lighting';
import { useT } from '@/i18n';
import { Icon } from './icons';

const CHOICES: ProfileChoice[] = ['auto', 'ultra', 'alto', 'equilibrado', 'rendimiento'];

/** Diálogo de configuración. Todo lo que muestra está conectado: cada control cambia algo real. */
export function SettingsModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const s = useSettings();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('select, input, button')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal dialog" role="dialog" aria-modal="true" aria-label={t('set.title')} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <Icon name="gear" />
          <b>{t('set.title')}</b>
          <span className="spacer" />
          <button className="btn icon" onClick={onClose} title={t('set.close')} aria-label={t('set.close')}>
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">
          <div className="section-title">{t('set.graphics')}</div>
          <label className="field">
            <span>{t('set.profile')}</span>
            <select value={s.profileChoice} onChange={(e) => s.set({ profileChoice: e.target.value as ProfileChoice })}>
              {CHOICES.map((c) => (
                <option key={c} value={c}>
                  {c === 'auto' ? t('set.auto') : PROFILES[c].label}
                </option>
              ))}
            </select>
          </label>
          <p className="hint-text">{PROFILE_HELP[s.profileChoice]}</p>
          <p className="hint-text">
            {t('set.current')}: <b>{PROFILES[s.profile].label}</b> · {s.profileReason}
          </p>
          <div className="field">
            <span>{t('set.lighting')}</span>
            <div className="seg">
              {(Object.keys(LIGHTING) as LightingPreset[]).map((p) => (
                <button key={p} className={s.lighting === p ? 'on' : ''} onClick={() => s.set({ lighting: p })} title={LIGHTING[p].description}>
                  {LIGHTING[p].label}
                </button>
              ))}
            </div>
          </div>
          <p className="hint-text">{LIGHTING[s.lighting].description}</p>
          <label className="field check">
            <input type="checkbox" checked={s.perfHud} onChange={(e) => s.set({ perfHud: e.target.checked })} />
            <span>{t('set.perf')}</span>
          </label>

          <div className="section-title">{t('set.camera')}</div>
          <label className="field">
            <span>
              {t('set.rotate')} <b className="mono">{s.rotateSpeed.toFixed(1)}×</b>
            </span>
            <input type="range" min={0.3} max={2} step={0.1} value={s.rotateSpeed} onChange={(e) => s.set({ rotateSpeed: Number(e.target.value) })} />
          </label>
          <label className="field">
            <span>
              {t('set.zoom')} <b className="mono">{s.zoomSpeed.toFixed(1)}×</b>
            </span>
            <input type="range" min={0.3} max={2} step={0.1} value={s.zoomSpeed} onChange={(e) => s.set({ zoomSpeed: Number(e.target.value) })} />
          </label>
          <div className="field">
            <span>{t('set.labels')}</span>
            <div className="seg">
              {(['baja', 'media', 'alta'] as const).map((d) => (
                <button key={d} className={s.labelDensity === d ? 'on' : ''} onClick={() => s.set({ labelDensity: d })}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="section-title">{t('set.motion')}</div>
          <label className="field">
            <span>
              {t('set.vibration')} <b className="mono">{Math.round(s.vibration * 100)}%</b>
            </span>
            <input type="range" min={0} max={1} step={0.05} value={s.vibration} onChange={(e) => s.set({ vibration: Number(e.target.value) })} />
          </label>
          <div className="field">
            <span>{t('set.reduced')}</span>
            <div className="seg">
              {(
                [
                  ['sistema', t('set.reduced.sys')],
                  ['reducido', t('set.reduced.on')],
                  ['completo', t('set.reduced.off')],
                ] as const
              ).map(([v, l]) => (
                <button key={v} className={s.motion === v ? 'on' : ''} onClick={() => s.set({ motion: v })}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span>
              {t('set.tour')} <b className="mono">{s.tourDuration.toFixed(1)}×</b>
            </span>
            <input type="range" min={0.5} max={2} step={0.1} value={s.tourDuration} onChange={(e) => s.set({ tourDuration: Number(e.target.value) })} />
          </label>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={() => s.reset()}>
            <Icon name="reset" size={14} /> {t('set.reset')}
          </button>
          <span className="spacer" />
          <button className="btn primary" onClick={onClose}>
            {t('set.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
