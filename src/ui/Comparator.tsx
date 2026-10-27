import { Suspense, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { CameraControls, Environment, Lightformer } from '@react-three/drei';
import { useApp } from '@/state/store';
import { ENGINES, getEngine } from '@/engines/catalog';
import { deriveLayout } from '@/engines/derive';
import type { EngineDefinition, SpecKey } from '@/engines/schema';
import { EngineModel } from '@/render/engine/EngineModel';
import { StatusBadge } from './RightPanel';

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
  if (!s) return <span className="muted">Sin dato publicado verificable</span>;
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

/** Comparador de dos motores con vista 3D lado a lado (misma escala, misma cámara, mismo ángulo de cigüeñal). */
export default function Comparator() {
  const ids = useApp((s) => s.compareIds);
  const set = useApp((s) => s.set);
  const a = getEngine(ids[0]);
  const b = getEngine(ids[1]);
  const gap = useMemo(() => {
    const La = deriveLayout(a);
    const Lb = deriveLayout(b);
    return Math.max(La.blockLength, Lb.blockLength) * 0.5 + 0.55;
  }, [a, b]);
  return (
    <div className="modal-back" onClick={() => set({ showComparator: false })}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>COMPARADOR DE MOTORES</h3>
          <select value={ids[0]} onChange={(e) => set({ compareIds: [e.target.value, ids[1]] })}>
            {ENGINES.map((e) => (
              <option key={e.id} value={e.id}>
                {e.manufacturer} {e.model} ({e.year})
              </option>
            ))}
          </select>
          <span className="muted">vs</span>
          <select value={ids[1]} onChange={(e) => set({ compareIds: [ids[0], e.target.value] })}>
            {ENGINES.map((e) => (
              <option key={e.id} value={e.id}>
                {e.manufacturer} {e.model} ({e.year})
              </option>
            ))}
          </select>
          <span className="spacer" />
          <span className="muted" style={{ fontSize: 11 }}>
            Ambos modelos: misma escala, cámara compartida y ángulo de cigüeñal sincronizado
          </span>
          <button className="btn" onClick={() => set({ showComparator: false })}>
            ✕ Cerrar
          </button>
        </div>
        <div className="cmp-body">
          <div className="cmp-view">
            <Canvas
              shadows
              dpr={[1, 1.75]}
              camera={{ position: [-2.6, 1.3, 0.001], fov: 40, near: 0.01, far: 50 }}
              gl={{ antialias: true }}
              onCreated={({ gl }) => {
                gl.toneMapping = THREE.ACESFilmicToneMapping;
              }}
            >
              <color attach="background" args={['#0b0d10']} />
              <hemisphereLight args={['#b9d4ff', '#1a1c20', 0.4]} />
              <directionalLight position={[-2.5, 4, 2.5]} intensity={2.2} castShadow />
              <Environment resolution={128} frames={1}>
                <Lightformer form="rect" intensity={3} position={[0, 4, 0]} rotation-x={Math.PI / 2} scale={[6, 2, 1]} />
                <Lightformer form="rect" intensity={1.4} position={[-4, 1, 0]} rotation-y={Math.PI / 2} scale={[4, 1.2, 1]} />
                <Lightformer form="rect" intensity={1.2} position={[4, 1, 0]} rotation-y={-Math.PI / 2} scale={[4, 1.2, 1]} />
              </Environment>
              <Suspense fallback={null}>
                <group position={[0, 0, -gap]}>
                  <EngineModel key={`a-${a.id}`} def={a} />
                </group>
                <group position={[0, 0, gap]}>
                  <EngineModel key={`b-${b.id}`} def={b} />
                </group>
              </Suspense>
              <mesh rotation-x={-Math.PI / 2} position={[0, -0.32, 0]} receiveShadow>
                <planeGeometry args={[14, 14]} />
                <shadowMaterial opacity={0.4} />
              </mesh>
              <CameraControls makeDefault minDistance={0.4} maxDistance={8} />
            </Canvas>
            <div className="cmp-names">
              <div>
                {a.manufacturer} {a.model}
              </div>
              <div>
                {b.manufacturer} {b.model}
              </div>
            </div>
          </div>
          <div className="cmp-table">
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
                  <th>Arquitectura (modelo 3D)</th>
                  <td>
                    {a.valvetrain.camshafts === 2 ? 'DOHC' : 'SOHC'} · tren {a.valvetrain.gearTrain === 'front' ? 'frontal' : 'trasero'} · {a.air.turbo}
                  </td>
                  <td>
                    {b.valvetrain.camshafts === 2 ? 'DOHC' : 'SOHC'} · tren {b.valvetrain.gearTrain === 'front' ? 'frontal' : 'trasero'} · {b.air.turbo}
                  </td>
                </tr>
                <tr>
                  <th>Diferencias relevantes</th>
                  <td colSpan={2} className="muted" style={{ lineHeight: 1.5 }}>
                    {[...a.notes.slice(0, 2), ...b.notes.slice(0, 2)].map((n, i) => (
                      <div key={i}>• {n}</div>
                    ))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
