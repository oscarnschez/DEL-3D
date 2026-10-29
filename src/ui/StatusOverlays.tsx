import { Component, useEffect, useState, type ReactNode } from 'react';
import { useWarmup } from '@/render/warmup';
import { usePerf } from '@/render/perf';
import { useTextureStatus } from '@/render/textures/library';
import { useSettings } from '@/state/settings';
import { PROFILES } from '@/render/quality/profiles';
import { useT } from '@/i18n';
import { Icon, LogoMark } from './icons';

/**
 * Pantalla de carga: visible hasta que la escena compiló sus shaders (primer precalentamiento).
 * Muestra las etapas reales (no una barra simulada).
 */
export function LoadingOverlay() {
  const t = useT();
  const done = useWarmup((s) => s.done);
  const tex = useTextureStatus();
  const profile = useSettings((s) => s.profile);
  const detail = PROFILES[profile].detailMaps;
  const texReady = tex.size > 0 && tex.done >= tex.total;
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => setGone(true), 450);
    return () => clearTimeout(id);
  }, [done]);
  if (gone) return null;
  return (
    <div className={`loading ${done ? 'out' : ''}`} aria-busy={!done} aria-live="polite">
      <LogoMark size={46} />
      <div className="loading-title">DIESEL ENGINE LAB 3D</div>
      <div className="loading-step">
        <span className="spinner" /> {t('status.loading')}
      </div>
      <ul className="loading-list">
        <li className="ok">Geometría procedural del motor</li>
        {detail ? (
          <li className={texReady ? 'ok' : ''}>
            Texturas de superficie {texReady ? `(${tex.size} px)` : `${tex.done}/${tex.total}`}
          </li>
        ) : (
          <li className="ok">Texturas de superficie: no se usan en el perfil {PROFILES[profile].label}</li>
        )}
        <li className={done ? 'ok' : ''}>Compilación de materiales</li>
      </ul>
    </div>
  );
}

/** Error irrecuperable de la escena (p. ej. pérdida del contexto WebGL o WebGL no disponible). */
export function ErrorOverlay({ message }: { message: string }) {
  const t = useT();
  return (
    <div className="scene-error" role="alert">
      <Icon name="warn" size={28} />
      <b>{t('err.title')}</b>
      <p>{message}</p>
      <button className="btn primary" onClick={() => location.reload()}>
        {t('err.reload')}
      </button>
    </div>
  );
}

/** Monitor de rendimiento (valores medidos con renderer.info y el tiempo real entre frames). */
export function PerfHud() {
  const t = useT();
  const on = useSettings((s) => s.perfHud);
  const profile = useSettings((s) => s.profile);
  const p = usePerf();
  if (!on) return null;
  return (
    <div className="overlay perf-hud mono" aria-label={t('perf.title')}>
      <div className="perf-title">{t('perf.title')}</div>
      <div>
        FPS <b>{p.fps.toFixed(1)}</b> · {p.frameMs.toFixed(1)} ms (p95 {p.frameP95.toFixed(0)})
      </div>
      <div>
        Draw calls <b>{p.calls}</b> · Tri <b>{(p.triangles / 1000).toFixed(0)}k</b>
      </div>
      <div>
        Geo {p.geometries} · Tex {p.textures} · Prog {p.programs}
      </div>
      <div>
        {PROFILES[profile].label} · DPR {p.dpr.toFixed(2)}
      </div>
      <div className="muted" title={p.renderer}>
        {p.renderer.slice(0, 38)}
      </div>
    </div>
  );
}

/** Captura errores de la escena 3D (p. ej. WebGL no disponible) y muestra el estado de error. */
export class SceneBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: /webgl|context/i.test(msg) ? `Este navegador o equipo no pudo crear un contexto WebGL (${msg}). Active la aceleración por hardware o pruebe otro navegador.` : msg };
  }
  render() {
    return this.state.error ? <ErrorOverlay message={this.state.error} /> : this.props.children;
  }
}
