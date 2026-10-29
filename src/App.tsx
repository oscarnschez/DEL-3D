import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { TopBar } from '@/ui/TopBar';
import { LeftPanel } from '@/ui/LeftPanel';
import { RightPanel } from '@/ui/RightPanel';
import { BottomBar } from '@/ui/BottomBar';
import { Viewport } from '@/ui/Viewport';
import { SettingsModal } from '@/ui/SettingsModal';
import { HelpModal, useShortcuts } from '@/ui/shortcuts';
import { Toasts, toast } from '@/ui/toasts';
import { Icon } from '@/ui/icons';
import { useApp } from '@/state/store';
import { useSettings } from '@/state/settings';
import { PROFILES } from '@/render/quality/profiles';
import { LIGHTING } from '@/render/lighting';
import { getEngine } from '@/engines/catalog';
import { t, useT } from '@/i18n';

const Comparator = lazy(() => import('@/ui/Comparator'));

/** Avisos de cambios que el usuario no provocó directamente o que conviene confirmar. */
function useChangeToasts() {
  useEffect(() => {
    const u1 = useSettings.subscribe((s, p) => {
      if (s.profile !== p.profile) toast(`${t('toast.profile')}: ${PROFILES[s.profile].label} · ${s.profileReason}`, 'info');
      if (s.lighting !== p.lighting) toast(`${t('toast.lighting')}: ${LIGHTING[s.lighting].label}`, 'ok');
    });
    const u2 = useApp.subscribe((s, p) => {
      if (s.engineId !== p.engineId) {
        const d = getEngine(s.engineId);
        toast(`${t('toast.engine')}: ${d.manufacturer} ${d.model}`, 'ok');
      }
    });
    return () => {
      u1();
      u2();
    };
  }, []);
}

export default function App() {
  const tr = useT();
  const [hideLeft, setHideLeft] = useState(false);
  const [hideRight, setHideRight] = useState(false);
  const [dialog, setDialog] = useState<'settings' | 'help' | null>(null);
  const showComparator = useApp((s) => s.showComparator);
  const uiMode = useSettings((s) => s.uiMode);
  const lang = useSettings((s) => s.lang);
  const openHelp = useCallback(() => setDialog('help'), []);
  const close = useCallback(() => setDialog(null), []);
  useShortcuts(openHelp);
  useChangeToasts();
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const cls = ['app', `ui-${uiMode}`, hideLeft && 'collapsed-left', hideRight && 'collapsed-right', !hideLeft && 'show-left', !hideRight && 'show-right'].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      <TopBar onToggleLeft={() => setHideLeft((v) => !v)} onToggleRight={() => setHideRight((v) => !v)} onSettings={() => setDialog('settings')} onHelp={openHelp} />
      <LeftPanel />
      <Viewport />
      <RightPanel />
      <BottomBar />
      {uiMode === 'limpia' && (
        <div className="overlay clean-exit" style={{ position: 'fixed' }}>
          <button className="btn" onClick={() => useSettings.getState().set({ uiMode: 'ingenieria' })} title="Esc">
            <Icon name="eye" size={15} /> {tr('ui.restore')}
          </button>
        </div>
      )}
      {showComparator && (
        <Suspense fallback={null}>
          <Comparator />
        </Suspense>
      )}
      {dialog === 'settings' && <SettingsModal onClose={close} />}
      {dialog === 'help' && <HelpModal onClose={close} />}
      <Toasts />
    </div>
  );
}
