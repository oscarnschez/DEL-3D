import { useApp, type ViewMode } from '@/state/store';
import { getEngine } from '@/engines/catalog';
import { Scene } from '@/render/Scene';
import { cameraApi, VIEW_LABEL, type ViewPreset } from '@/camera/CameraRig';
import { CycleDial } from './CycleDial';
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
];

export function Viewport() {
  const mode = useApp((s) => s.mode);
  const setMode = useApp((s) => s.setMode);
  const caption = useApp((s) => s.caption);
  const def = getEngine(useApp((s) => s.engineId));
  return (
    <main className="viewport">
      <Scene />
      <div className="overlay modes" role="tablist" aria-label="Modos de visualización">
        {MODES.map((m, i) => (
          <button key={m.id} className={`mode-btn ${mode === m.id ? 'on' : ''}`} onClick={() => setMode(m.id)} title={m.label}>
            <span className="num">{String(i + 1).padStart(2, '0')}</span>
            <span className="txt">{m.label.toUpperCase()}</span>
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
