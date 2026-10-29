import { useEffect } from 'react';
import { useApp } from '@/state/store';
import { useSettings } from '@/state/settings';
import { useSelection } from '@/interaction/selection';
import { cameraApi } from '@/camera/CameraRig';
import { advanceCrank } from '@/core/simulation/clock';
import { useT, t as tr } from '@/i18n';
import { Icon } from './icons';
import { MODES } from './Viewport';
import { toast } from './toasts';

export interface Shortcut {
  keys: string;
  desc: string;
}

export const SHORTCUTS: Shortcut[] = [
  { keys: 'E', desc: 'Encender / apagar el motor' },
  { keys: 'Espacio', desc: 'Pausa / reanudar' },
  { keys: '← →', desc: 'Avanzar o retroceder el cigüeñal 15° (en pausa)' },
  { keys: '1 … 9, 0, T', desc: 'Modos de visualización (T: vista térmica)' },
  { keys: 'F', desc: 'Encuadrar la pieza seleccionada' },
  { keys: 'I', desc: 'Aislar la selección' },
  { keys: 'L', desc: 'Mostrar / ocultar etiquetas' },
  { keys: 'R', desc: 'Restaurar vista, piezas y modo' },
  { keys: 'P', desc: 'Modo presentación' },
  { keys: 'C', desc: 'Interfaz limpia (sólo el motor)' },
  { keys: 'Esc', desc: 'Quitar selección · detener recorrido · salir de interfaz limpia' },
  { keys: '?', desc: 'Esta ayuda' },
];

const isTyping = (e: KeyboardEvent) => {
  const el = e.target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
};

/** Atajos globales. No actúan mientras se escribe en un campo ni con modificadores (Ctrl/Alt/Cmd). */
export function useShortcuts(onHelp: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      const app = useApp.getState();
      const sel = useSelection.getState();
      const st = useSettings.getState();
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const modeIdx = '1234567890'.indexOf(k);
      if (modeIdx >= 0) {
        const m = MODES.filter((x) => x.id !== 'termica')[modeIdx];
        if (m) app.setMode(m.id);
        return;
      }
      switch (k) {
        case 'e':
          app.set({ running: !app.running, paused: false });
          break;
        case ' ':
          e.preventDefault();
          app.set({ paused: !app.paused });
          break;
        case 'ArrowRight':
        case 'ArrowLeft':
          if (!app.paused && app.running) return;
          e.preventDefault();
          app.set({ paused: true });
          advanceCrank(k === 'ArrowRight' ? 15 : -15);
          break;
        case 't':
          app.setMode('termica');
          break;
        case 'f':
          if (sel.selected) cameraApi.focusByName(sel.selected);
          break;
        case 'i':
          if (sel.selected || sel.systemSel) sel.set({ isolate: !sel.isolate });
          break;
        case 'l':
          app.set({ labels: !app.labels });
          break;
        case 'r':
          sel.restore();
          app.setMode('exterior');
          cameraApi.reset();
          break;
        case 'p':
          st.set({ uiMode: st.uiMode === 'presentacion' ? 'ingenieria' : 'presentacion' });
          toast(`${tr('top.uimode')}: ${tr(st.uiMode === 'presentacion' ? 'ui.ingenieria' : 'ui.presentacion')}`);
          break;
        case 'c':
          st.set({ uiMode: st.uiMode === 'limpia' ? 'ingenieria' : 'limpia' });
          break;
        case 'Escape':
          if (app.tour) app.set({ tour: null, caption: null });
          else if (st.uiMode === 'limpia') st.set({ uiMode: 'ingenieria' });
          else sel.select(null);
          break;
        case '?':
        case 'h':
          onHelp();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onHelp]);
}

export function HelpModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal dialog narrow" role="dialog" aria-modal="true" aria-label={t('help.title')} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <Icon name="help" />
          <b>{t('help.title')}</b>
          <span className="spacer" />
          <button className="btn icon" onClick={onClose} aria-label={t('set.close')}>
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">
          <table className="keys">
            <tbody>
              {SHORTCUTS.map((s) => (
                <tr key={s.keys}>
                  <td>
                    <kbd>{s.keys}</kbd>
                  </td>
                  <td>{s.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint-text">Ratón: arrastrar para orbitar, rueda para acercar, botón derecho para desplazar, doble clic sobre una pieza para encuadrarla. Táctil: un dedo orbita, dos dedos acercan y desplazan.</p>
        </div>
      </div>
    </div>
  );
}
