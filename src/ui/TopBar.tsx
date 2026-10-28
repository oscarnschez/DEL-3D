import { useApp } from '@/state/store';
import { useSettings } from '@/state/settings';
import type { ProfileChoice } from '@/render/quality/profiles';
import { getEngine } from '@/engines/catalog';
import { useSelection } from '@/interaction/selection';
import { cameraApi } from '@/camera/CameraRig';
import { TOURS } from '@/camera/tours';

export function TopBar({ onToggleLeft, onToggleRight }: { onToggleLeft: () => void; onToggleRight: () => void }) {
  const app = useApp();
  const def = getEngine(app.engineId);
  return (
    <header className="topbar">
      <button className="btn icon" onClick={onToggleLeft} title="Mostrar/ocultar panel izquierdo">
        ☰
      </button>
      <div className="logo">
        <div className="logo-mark" />
        <div>
          DIESEL ENGINE LAB <span style={{ color: 'var(--blue)' }}>3D</span>
          <small>LABORATORIO VIRTUAL</small>
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
      <div className="top-tools">
        <select
          value={app.tour ?? ''}
          onChange={(e) => app.set({ tour: e.target.value || null, caption: null })}
          title="Recorridos cinematográficos"
        >
          <option value="">🎬 Recorridos…</option>
          {TOURS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        {app.tour && (
          <button className="btn" onClick={() => app.set({ tour: null, caption: null })}>
            ■ Detener recorrido
          </button>
        )}
        <button className={`btn ${app.showComparator ? 'on' : ''}`} onClick={() => app.set({ showComparator: true })}>
          ⇄ Comparador
        </button>
        <button className={`btn ${app.labels ? 'on' : ''}`} onClick={() => app.set({ labels: !app.labels })}>
          Etiquetas
        </button>
        <select value={useSettings.getState().profileChoice} onChange={(e) => useSettings.getState().set({ profileChoice: e.target.value as ProfileChoice })} title="Calidad gráfica">
          <option value="auto">Automático</option>
          <option value="ultra">Ultra</option>
          <option value="alto">Alto</option>
          <option value="equilibrado">Equilibrado</option>
          <option value="rendimiento">Rendimiento</option>
        </select>
        <select value={useSettings.getState().lighting} onChange={(e) => useSettings.getState().set({ lighting: e.target.value as 'estudio' })} title="Iluminación">
          <option value="estudio">Estudio</option>
          <option value="laboratorio">Laboratorio</option>
          <option value="cine">Cine</option>
        </select>
        <button
          className="btn"
          onClick={() => {
            useSelection.getState().restore();
            app.setMode('exterior');
            cameraApi.reset();
          }}
          title="Restaurar vista y motor original"
        >
          ↺ Restaurar
        </button>
        <button
          className="btn icon"
          title="Pantalla completa"
          onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())}
        >
          ⛶
        </button>
        <button className="btn icon" onClick={onToggleRight} title="Mostrar/ocultar panel derecho">
          ☷
        </button>
      </div>
    </header>
  );
}
