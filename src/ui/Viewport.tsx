import { useState } from 'react';
import { useApp, type ViewMode } from '@/state/store';
import { useT } from '@/i18n';
import { ErrorOverlay, LoadingOverlay, PerfHud, SceneBoundary } from './StatusOverlays';
import { getEngine } from '@/engines/catalog';
import { Scene } from '@/render/Scene';
import { cameraApi, VIEW_LABEL, type ViewPreset } from '@/camera/CameraRig';
import { CycleDial } from './CycleDial';
import { ThermalLegend } from './ThermalLegend';
import { PHASE_COLOR, PHASE_LABEL } from '@/core/kinematics/cycle';

export const MODES: { id: ViewMode; label: string }[] = [
  { id: 'exterior', label: 'Exterior' },
  { id: 'interior', label: 'Interior' },
  { id: 'combustion', label: 'Combustión' },
  { id: 'lubricacion', label: 'Lubricación' },
  { id: 'combustible', label: 'Combustible' },
  { id: 'refrigeracion', label: 'Refrigeración' },
  { id: 'aire', label: 'Admisión y escape' },
  { id: 'despiece', label: 'Despiece' },
  { id: 'rayosx', label: 'Rayos X' },
  { id: 'tecnico', label: 'Técnico' },
  { id: 'termica', label: 'Vista térmica' },
];

/** Tecla de acceso de cada modo (1…9, 0 y T), la misma que muestra el botón. */
export const modeKey = (i: number, id: ViewMode) => (id === 'termica' ? 'T' : i === 9 ? '0' : String(i + 1));

export function Viewport() {
  const mode = useApp((s) => s.mode);
  const setMode = useApp((s) => s.setMode);
  const caption = useApp((s) => s.caption);
  const def = getEngine(useApp((s) => s.engineId));
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  return (
    <main className="viewport">
      <SceneBoundary>
        <Scene onError={setError} />
      </SceneBoundary>
      <LoadingOverlay />
      {error && <ErrorOverlay message={error} />}
      <PerfHud />
      <div className="overlay modes" role="tablist" aria-label="Modos de visualización">
        {MODES.map((m, i) => (
          <button key={m.id} role="tab" aria-selected={mode === m.id} className={`mode-btn ${mode === m.id ? 'on' : ''}`} onClick={() => setMode(m.id)} title={`${t(`mode.${m.id}`)} (${modeKey(i, m.id)})`}>
            <span className="num">{modeKey(i, m.id)}</span>
            <span className="txt">{t(`mode.${m.id}`).toUpperCase()}</span>
          </button>
        ))}
      </div>
      <div className="overlay views">
        {(Object.keys(VIEW_LABEL) as ViewPreset[]).map((v) => (
          <button key={v} className="btn sm" onClick={() => cameraApi.setView(v)}>
            {VIEW_LABEL[v]}
          </button>
        ))}
      </div>
      {mode === 'combustion' && (
        <div className="overlay dial-overlay">
          <CycleDial size={190} />
          <div className="legend" style={{ position: 'static', marginTop: 6 }}>
            <div className="item">Autoignición por compresión: un motor diésel no tiene bujías.</div>
            <div className="item">
              <span className="swatch" style={{ background: '#ffd23f' }} /> Chorros de combustible (inyección)
            </div>
            <div className="item">
              <span className="swatch" style={{ background: 'linear-gradient(90deg,#1f59ff,#1ad9f2,#f2d933,#ff7314,#ff1f0a)' }} /> Temperatura del gas (azul frío → rojo)
            </div>
            {(['admision', 'compresion', 'expansion', 'escape'] as const).map((p) => (
              <div key={p} className="item">
                <span className="swatch" style={{ background: PHASE_COLOR[p] }} /> {PHASE_LABEL[p]}
              </div>
            ))}
          </div>
        </div>
      )}
      {mode === 'termica' && <ThermalLegend />}
      {caption && <div className="overlay caption">{caption}</div>}
      {def.assets.provisional && (
        <div className="overlay prov">
          <b>GEOMETRÍA PROVISIONAL</b> · Modelo procedural mecánicamente coherente (cinemática exacta), no es una representación fotorrealista ni CAD del fabricante.
        </div>
      )}
      <div className="overlay hint">Arrastrar: orbitar · Rueda: zoom · Clic der./2 dedos: desplazar · Clic: seleccionar pieza</div>
    </main>
  );
}
