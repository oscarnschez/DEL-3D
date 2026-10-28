import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, createPortal, useFrame, useThree } from '@react-three/fiber';
import CameraControlsImpl from 'camera-controls';
import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { useApp, type CutMode } from '@/state/store';
import { useSettings } from '@/state/settings';
import { ENGINES, getEngine } from '@/engines/catalog';
import type { EngineDefinition, SpecKey } from '@/engines/schema';
import { PARTS, parsePartKey, type PartId } from '@/engines/parts';
import { EngineModel } from '@/render/engine/EngineModel';
import { SimulationDriver } from '@/core/simulation/SimulationDriver';
import { createSelectionStore, type SelectionStore } from '@/interaction/selection';
import { ViewEnvContext, type ViewEnv, type ViewParams } from '@/interaction/viewEnv';
import { environmentFor, LIGHTING } from '@/render/lighting';
import { sectionUniform } from '@/render/materials';
import { fitDistance } from '@/camera/CameraRig';
import { comparisonWarnings, equivalentPart } from './compare';
import { StatusBadge } from './RightPanel';
import { Icon } from './icons';

CameraControlsImpl.install({ THREE });

const ROWS: { key: SpecKey; label: string }[] = [
  { key: 'displacement', label: 'Cilindrada' },
  { key: 'configuration', label: 'Configuración' },
  { key: 'boreStroke', label: 'Diámetro × carrera' },
  { key: 'power', label: 'Potencia nominal' },
  { key: 'torque', label: 'Par máximo' },
  { key: 'rpmRange', label: 'Rango de RPM' },
  { key: 'compressionRatio', label: 'Relación de compresión' },
  { key: 'injection', label: 'Inyección' },
  { key: 'aspiration', label: 'Sobrealimentación' },
  { key: 'valvetrain', label: 'Distribución' },
  { key: 'emissions', label: 'Emisiones / postratamiento' },
  { key: 'firingOrder', label: 'Orden de encendido' },
  { key: 'weight', label: 'Peso en seco' },
];

function cell(def: EngineDefinition, key: SpecKey) {
  const s = def.specs.find((x) => x.key === key);
  if (!s)
    return (
      <span className="muted" title="El fabricante no publica este dato en las fuentes registradas, o no se pudo verificar">
        No disponible
      </span>
    );
  const src = def.sources.find((x) => x.id === s.sourceId);
  return (
    <>
      <div className="mono">{s.value}</div>
      <StatusBadge s={s.status} />
      {src && (
        <div className="src" style={{ marginTop: 3 }}>
          <a href={src.url} target="_blank" rel="noreferrer">
            {src.title}
          </a>
        </div>
      )}
    </>
  );
}

/** Estado de vista independiente de cada lado (transparencia, corte, despiece). */
interface SideView extends ViewParams {
  cut: CutMode;
  cutOffset: number;
  set: (p: Partial<SideView>) => void;
}
type SideStore = UseBoundStore<StoreApi<SideView>>;
const createSide = (): SideStore =>
  create<SideView>((set) => ({
    mode: 'exterior',
    transparency: 0,
    removed: { valveCover: false, head: false, oilPan: false, block: false, manifolds: false },
    explode: 0,
    explodeGroup: 'todo',
    cut: 'none',
    cutOffset: 0,
    set: (p) => set(p),
  }));

const NO_CUT = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e4);
function sidePlane(v: SideView, out: THREE.Plane): THREE.Plane {
  if (v.cut === 'longitudinal') return out.set(new THREE.Vector3(0, 0, -1), v.cutOffset * 0.3);
  if (v.cut === 'transversal') return out.set(new THREE.Vector3(-1, 0, 0), v.cutOffset * 0.6);
  return out.copy(NO_CUT);
}

interface Side {
  def: EngineDefinition;
  store: SideStore;
  selection: SelectionStore;
  env: ViewEnv;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  el: HTMLDivElement | null;
  controls: CameraControlsImpl | null;
  plane: THREE.Plane;
}

/**
 * Dos vistas en un solo contexto WebGL: cada motor vive en su propia escena y se dibuja en su
 * mitad del lienzo con su cámara y su plano de corte (siempre un plano: sin recompilar shaders).
 */
function DualRenderer({ sides, sync, onReady }: { sides: [Side, Side]; sync: { rotate: boolean; zoom: boolean }; onReady: () => void }) {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const lighting = useSettings((s) => s.lighting);
  const leader = useRef(0);
  const ready = useRef(false);

  useEffect(() => {
    const env = environmentFor(gl, lighting);
    for (const s of sides) {
      s.scene.environment = env;
      s.scene.environmentIntensity = LIGHTING[lighting].envIntensity;
      s.scene.background = new THREE.Color(LIGHTING[lighting].background[1]);
    }
    gl.toneMappingExposure = LIGHTING[lighting].exposure;
  }, [gl, lighting, sides]);

  // controles de cámara de cada mitad (los eventos llegan a su capa transparente)
  useEffect(() => {
    const made: CameraControlsImpl[] = [];
    sides.forEach((s, i) => {
      if (!s.el) return;
      const c = new CameraControlsImpl(s.camera, s.el);
      c.minDistance = 0.3;
      c.maxDistance = 8;
      c.smoothTime = 0.3;
      c.addEventListener('controlstart', () => (leader.current = i));
      s.controls = c;
      made.push(c);
    });
    return () => {
      made.forEach((c) => c.dispose());
      sides.forEach((s) => (s.controls = null));
    };
  }, [sides]);

  // encuadre inicial de cada motor y precompilación antes de mostrar
  useEffect(() => {
    ready.current = false;
    let cancelled = false;
    let frames = 0;
    let raf = 0;
    const tick = () => {
      if (cancelled) return;
      if (++frames < 4) {
        raf = requestAnimationFrame(tick);
        return;
      }
      for (const s of sides) {
        const box = new THREE.Box3().setFromObject(s.scene, true);
        const sph = box.getBoundingSphere(new THREE.Sphere());
        // relación de aspecto real de cada mitad antes de encuadrar
        if (s.el && s.el.clientHeight > 0) s.camera.aspect = s.el.clientWidth / s.el.clientHeight;
        s.camera.updateProjectionMatrix();
        const d = fitDistance(sph.radius, s.camera.fov, s.camera.aspect, 1.12);
        const dir = new THREE.Vector3(-1.25, 0.75, 1.35).normalize().multiplyScalar(d);
        void s.controls?.setLookAt(sph.center.x + dir.x, sph.center.y + dir.y, sph.center.z + dir.z, sph.center.x, sph.center.y, sph.center.z, false);
      }
      void Promise.all(sides.map((s) => gl.compileAsync(s.scene, s.camera))).then(() => {
        if (cancelled) return;
        ready.current = true;
        onReady();
      });
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [gl, sides, onReady]);

  useFrame((_, dt) => {
    const [a, b] = sides;
    const L = sides[leader.current];
    const F = sides[1 - leader.current];
    // sincronización: el lado que se manipuló por última vez manda
    if (L.controls && F.controls) {
      if (sync.rotate) void F.controls.rotateTo(L.controls.azimuthAngle, L.controls.polarAngle, false);
      if (sync.zoom) void F.controls.dollyTo(L.controls.distance, false);
    }
    const w = size.width / 2;
    gl.autoClear = false;
    gl.setScissorTest(true);
    gl.clear();
    [a, b].forEach((s, i) => {
      s.controls?.update(dt);
      s.camera.aspect = w / size.height;
      s.camera.updateProjectionMatrix();
      gl.setViewport(i * w, 0, w, size.height);
      gl.setScissor(i * w, 0, w, size.height);
      const v = s.store.getState();
      gl.clippingPlanes = [sidePlane(v, s.plane)];
      sectionUniform.value = v.cut === 'none' ? 0 : 1;
      if (ready.current) gl.render(s.scene, s.camera);
      else gl.clear();
    });
    gl.setScissorTest(false);
  }, 1);
  return null;
}

/** Lado del comparador: motor en su escena, con su entorno de vista y su selección. */
function SideScene({ side, onParts }: { side: Side; onParts: (p: PartId[]) => void }) {
  return createPortal(
    <ViewEnvContext.Provider value={side.env}>
      <hemisphereLight args={['#c9d6e3', '#1b1f24', 0.45]} />
      <directionalLight position={[-2.2, 3.6, 2.4]} intensity={2.2} />
      <directionalLight position={[1.8, 2.2, -3]} intensity={1.1} />
      <EngineModel key={side.def.id} def={side.def} onParts={onParts} />
    </ViewEnvContext.Provider>,
    side.scene,
  );
}

const RAY = new THREE.Raycaster();
const NDC = new THREE.Vector2();

function SideControls({ side, label, other, otherParts }: { side: Side; label: string; other: EngineDefinition; otherParts: Set<PartId> }) {
  const v = side.store();
  const sel = side.selection();
  const part = sel.selected ? parsePartKey(sel.selected).id : null;
  return (
    <div className="cmp-side">
      <div className="cmp-side-head">
        <b>{label}</b>
        <span className="muted small">
          {side.def.variant} · {side.def.year}
        </span>
      </div>
      <div className="row wrap cmp-tools">
        <span className="ctrl-label">Transp.</span>
        <input type="range" min={0} max={0.95} step={0.01} value={v.transparency} onChange={(e) => v.set({ transparency: Number(e.target.value) })} aria-label={`Transparencia ${label}`} />
        <span className="ctrl-label">Corte</span>
        <select value={v.cut} onChange={(e) => v.set({ cut: e.target.value as CutMode })} aria-label={`Corte ${label}`}>
          <option value="none">Sin corte</option>
          <option value="longitudinal">Longitudinal</option>
          <option value="transversal">Transversal</option>
        </select>
        {v.cut !== 'none' && <input type="range" min={-1} max={1} step={0.01} value={v.cutOffset} onChange={(e) => v.set({ cutOffset: Number(e.target.value) })} aria-label={`Posición del corte ${label}`} />}
        <span className="ctrl-label">Despiece</span>
        <input type="range" min={0} max={1} step={0.01} value={v.explode} onChange={(e) => v.set({ explode: Number(e.target.value) })} aria-label={`Despiece ${label}`} />
        <button
          className="btn sm icon"
          title="Restaurar este lado"
          aria-label={`Restaurar ${label}`}
          onClick={() => {
            v.set({ transparency: 0, cut: 'none', cutOffset: 0, explode: 0 });
            sel.restore();
          }}
        >
          <Icon name="reset" size={13} />
        </button>
      </div>
      {part && (
        <div className="cmp-part">
          <b>{PARTS[part].name}</b>
          {otherParts.has(part) ? (
            <span className="muted small"> · equivalente resaltado en {other.manufacturer} {other.model}</span>
          ) : (
            <span className="small" style={{ color: 'var(--amber)' }}>
              {' '}
              · No disponible en el modelo de {other.manufacturer} {other.model}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Comparador de dos motores: vistas sincronizables, controles por lado y tabla de fichas. */
export default function Comparator() {
  const ids = useApp((s) => s.compareIds);
  const set = useApp((s) => s.set);
  const a = getEngine(ids[0]);
  const b = getEngine(ids[1]);
  const pairKey = `${a.id}|${b.id}`;
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const ready = readyKey === pairKey;
  const markReady = useCallback(() => setReadyKey(pairKey), [pairKey]);
  const [sync, setSync] = useState({ rotate: true, zoom: false });
  const [parts, setParts] = useState<[Set<PartId>, Set<PartId>]>([new Set(), new Set()]);
  const elA = useRef<HTMLDivElement>(null);
  const elB = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const sides = useMemo<[Side, Side]>(() => {
    const mk = (def: EngineDefinition, el: HTMLDivElement | null): Side => {
      const store = createSide();
      const selection = createSelectionStore();
      return { def, store, selection, env: { view: store, selection }, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(36, 1, 0.01, 50), el, controls: null, plane: new THREE.Plane() };
    };
    return [mk(a, elA.current), mk(b, elB.current)];
    // las capas de eventos existen tras el primer render (mounted)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, b, mounted]);

  // selección equivalente: la misma pieza (mismo PartId) en el otro motor, sólo si está modelada allí
  useEffect(() => {
    const [sa, sb] = sides;
    let busy = false;
    const link = (from: Side, to: Side, toParts: Set<PartId>) =>
      from.selection.subscribe((s, p) => {
        if (busy || s.selected === p.selected) return;
        busy = true;
        to.selection.getState().select(equivalentPart(s.selected, toParts));
        busy = false;
      });
    const u1 = link(sa, sb, parts[1]);
    const u2 = link(sb, sa, parts[0]);
    return () => {
      u1();
      u2();
    };
  }, [sides, parts]);

  // el lienzo principal se detiene mientras el comparador está abierto (un solo render activo)
  const onParts0 = useCallback((p: PartId[]) => setParts((x) => [new Set(p), x[1]]), []);
  const onParts1 = useCallback((p: PartId[]) => setParts((x) => [x[0], new Set(p)]), []);

  const pick = (side: Side, e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    NDC.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    RAY.setFromCamera(NDC, side.camera);
    const plane = side.plane;
    const hit = RAY.intersectObject(side.scene, true).find((h) => {
      // ignora lo recortado por el plano de corte y lo invisible
      if (plane.distanceToPoint(h.point) < 0) return false;
      let o: THREE.Object3D | null = h.object;
      while (o) {
        if (!o.visible) return false;
        o = o.parent;
      }
      return true;
    });
    let o: THREE.Object3D | null = hit?.object ?? null;
    while (o && !o.userData.partKey) o = o.parent;
    side.selection.getState().select((o?.userData.partKey as string | undefined) ?? null);
  };
  const down = useRef({ x: 0, y: 0 });
  const warnings = comparisonWarnings(a, b);

  return (
    <div className="modal-back" onClick={() => set({ showComparator: false })}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Comparador de motores" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <Icon name="compare" />
          <h3>COMPARADOR</h3>
          <select value={ids[0]} onChange={(e) => set({ compareIds: [e.target.value, ids[1]] })} aria-label="Motor izquierdo">
            {ENGINES.map((e) => (
              <option key={e.id} value={e.id}>
                {e.manufacturer} {e.model} ({e.year})
              </option>
            ))}
          </select>
          <span className="muted">vs</span>
          <select value={ids[1]} onChange={(e) => set({ compareIds: [ids[0], e.target.value] })} aria-label="Motor derecho">
            {ENGINES.map((e) => (
              <option key={e.id} value={e.id}>
                {e.manufacturer} {e.model} ({e.year})
              </option>
            ))}
          </select>
          <span className="spacer" />
          <label className="row small" title="Girar ambas vistas a la vez">
            <input type="checkbox" checked={sync.rotate} onChange={(e) => setSync((s) => ({ ...s, rotate: e.target.checked }))} /> Sincronizar rotación
          </label>
          <label className="row small" title="Mismo acercamiento en ambas vistas">
            <input type="checkbox" checked={sync.zoom} onChange={(e) => setSync((s) => ({ ...s, zoom: e.target.checked }))} /> Sincronizar zoom
          </label>
          <button className="btn" onClick={() => set({ showComparator: false })}>
            <Icon name="close" size={14} /> Cerrar
          </button>
        </div>
        <div className="cmp-body">
          <div className="cmp-view">
            <Canvas dpr={[1, 1.5]} gl={{ antialias: true, localClippingEnabled: true, stencil: false }} shadows={false} onCreated={({ gl }) => (gl.toneMapping = THREE.NeutralToneMapping)}>
              <SimulationDriver />
              {mounted && sides[0].el && (
                <>
                  <SideScene side={sides[0]} onParts={onParts0} />
                  <SideScene side={sides[1]} onParts={onParts1} />
                  <DualRenderer key={pairKey} sides={sides} sync={sync} onReady={markReady} />
                </>
              )}
            </Canvas>
            <div className="cmp-hit">
              {[elA, elB].map((ref, i) => (
                <div
                  key={i}
                  ref={ref}
                  onPointerDown={(e) => (down.current = { x: e.clientX, y: e.clientY })}
                  onClick={(e) => Math.hypot(e.clientX - down.current.x, e.clientY - down.current.y) < 5 && pick(sides[i], e)}
                />
              ))}
            </div>
            {!ready && (
              <div className="cmp-loading">
                <span className="spinner" /> Preparando vista 3D…
              </div>
            )}
            <div className="cmp-sides">
              <SideControls side={sides[0]} label={`${a.manufacturer} ${a.model}`} other={b} otherParts={parts[1]} />
              <SideControls side={sides[1]} label={`${b.manufacturer} ${b.model}`} other={a} otherParts={parts[0]} />
            </div>
          </div>
          <div className="cmp-table">
            {warnings.length > 0 && (
              <div className="cmp-warn" role="note">
                <Icon name="warn" size={15} />
                <div>
                  {warnings.map((w) => (
                    <div key={w}>{w}</div>
                  ))}
                </div>
              </div>
            )}
            <table>
              <thead>
                <tr>
                  <th />
                  <td>
                    <b>
                      {a.manufacturer} {a.model}
                    </b>
                    <div className="muted" style={{ fontSize: 11 }}>
                      {a.variant} · {a.year}
                    </div>
                  </td>
                  <td>
                    <b>
                      {b.manufacturer} {b.model}
                    </b>
                    <div className="muted" style={{ fontSize: 11 }}>
                      {b.variant} · {b.year}
                    </div>
                  </td>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.key}>
                    <th>{r.label}</th>
                    <td>{cell(a, r.key)}</td>
                    <td>{cell(b, r.key)}</td>
                  </tr>
                ))}
                <tr>
                  <th>Arquitectura (modelo 3D provisional)</th>
                  <td>
                    {a.valvetrain.camshafts === 2 ? 'DOHC' : 'SOHC'} · tren {a.valvetrain.gearTrain === 'front' ? 'frontal' : 'trasero'} · {a.air.turbo}
                  </td>
                  <td>
                    {b.valvetrain.camshafts === 2 ? 'DOHC' : 'SOHC'} · tren {b.valvetrain.gearTrain === 'front' ? 'frontal' : 'trasero'} · {b.air.turbo}
                  </td>
                </tr>
                <tr>
                  <th>Notas de cada fuente</th>
                  <td className="muted" style={{ lineHeight: 1.5 }}>
                    {a.notes.slice(0, 3).map((n, i) => (
                      <div key={i}>• {n}</div>
                    ))}
                  </td>
                  <td className="muted" style={{ lineHeight: 1.5 }}>
                    {b.notes.slice(0, 3).map((n, i) => (
                      <div key={i}>• {n}</div>
                    ))}
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="hint-text">
              Haga clic en una pieza de cualquiera de los dos motores: se resalta la pieza del mismo tipo en el otro, sólo si existe en su modelo. No se establecen equivalencias entre piezas de tipos distintos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
