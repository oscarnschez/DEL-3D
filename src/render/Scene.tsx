import { Suspense, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { AdaptiveDpr, Environment, Grid, Lightformer, PerformanceMonitor, Stats } from '@react-three/drei';
import { useApp } from '@/state/store';
import { getEngine } from '@/engines/catalog';
import { deriveLayout } from '@/engines/derive';
import { SimulationDriver } from '@/core/simulation/SimulationDriver';
import { CameraRig } from '@/camera/CameraRig';
import { TourPlayer } from '@/camera/tours';
import { useSelection } from '@/interaction/selection';
import { EngineModel } from './engine/EngineModel';
import { sectionUniform } from './materials';
import { CombustionView } from './combustion/CombustionView';
import { Flows } from './fluids/Flows';
import { Labels } from './Labels';

/** Planos de corte globales (renderer.clippingPlanes) según la herramienta activa. */
function CutController() {
  const gl = useThree((s) => s.gl);
  const cut = useApp((s) => s.cut);
  const offset = useApp((s) => s.cutOffset);
  const focus = useApp((s) => s.focusCylinder);
  const engineId = useApp((s) => s.engineId);
  const L = useMemo(() => deriveLayout(getEngine(engineId)), [engineId]);
  useEffect(() => {
    let planes: THREE.Plane[] = [];
    if (cut === 'longitudinal') planes = [new THREE.Plane(new THREE.Vector3(0, 0, -1), offset * 0.3)];
    else if (cut === 'transversal') planes = [new THREE.Plane(new THREE.Vector3(-1, 0, 0), offset * (L.blockLength / 2 + 0.1))];
    else if (cut === 'cilindro') planes = [new THREE.Plane(new THREE.Vector3(-1, 0, 0), L.cylX[focus - 1] ?? 0)];
    else if (cut === 'libre') {
      const n = new THREE.Vector3(-1, 0, -1).normalize();
      planes = [new THREE.Plane(n, offset * 0.45)];
    }
    gl.clippingPlanes = planes;
    sectionUniform.value = planes.length ? 1 : 0;
  }, [cut, offset, focus, gl, L]);
  return null;
}

function Studio() {
  return (
    <>
      <color attach="background" args={['#0b0d10']} />
      <fog attach="fog" args={['#0b0d10', 4, 11]} />
      <hemisphereLight args={['#b9d4ff', '#2a2d33', 0.6]} />
      <directionalLight
        position={[-2.5, 4, 2.5]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-1.6}
        shadow-camera-right={1.6}
        shadow-camera-top={1.6}
        shadow-camera-bottom={-1.6}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[3, 1.5, -2]} intensity={0.8} color="#9cc8ff" />
      <spotLight position={[0, 3, -3]} angle={0.5} penumbra={1} intensity={6} color="#3fa9ff" />
      <Environment resolution={256} frames={1} environmentIntensity={1.6}>
        <Lightformer form="rect" intensity={3} position={[0, 4, 0]} rotation-x={Math.PI / 2} scale={[6, 2, 1]} />
        <Lightformer form="rect" intensity={1.5} position={[-4, 1, 0]} rotation-y={Math.PI / 2} scale={[4, 1.2, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[4, 1, 0]} rotation-y={-Math.PI / 2} scale={[4, 1.2, 1]} color="#cfe6ff" />
        <Lightformer form="ring" intensity={2} position={[0, 2, 4]} scale={2} color="#ffd9a8" />
        <Lightformer form="rect" intensity={0.6} position={[0, -3, 0]} rotation-x={-Math.PI / 2} scale={[6, 6, 1]} color="#222" />
      </Environment>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.32, 0]} receiveShadow>
        <planeGeometry args={[12, 12]} />
        <shadowMaterial opacity={0.45} />
      </mesh>
      <Grid
        position={[0, -0.319, 0]}
        args={[12, 12]}
        cellSize={0.1}
        cellThickness={0.6}
        cellColor="#1d2733"
        sectionSize={0.5}
        sectionThickness={1}
        sectionColor="#24425e"
        fadeDistance={7}
        fadeStrength={1.5}
        infiniteGrid
      />
    </>
  );
}

export function Scene() {
  const engineId = useApp((s) => s.engineId);
  const quality = useApp((s) => s.quality);
  const def = getEngine(engineId);
  const dpr: [number, number] = quality === 'alta' ? [1, 2] : quality === 'media' ? [1, 1.5] : [0.75, 1];
  return (
    <Canvas
      shadows={quality !== 'baja'}
      dpr={dpr}
      camera={{ position: [-1.2, 0.9, 1.3], fov: 38, near: 0.01, far: 50 }}
      gl={{ antialias: true, powerPreference: 'high-performance', localClippingEnabled: true, preserveDrawingBuffer: false }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.25;
      }}
      onPointerMissed={(e) => {
        if (e.type === 'click') useSelection.getState().select(null);
      }}
    >
      <PerformanceMonitor />
      <AdaptiveDpr pixelated={false} />
      <SimulationDriver />
      <Studio />
      <CutController />
      <Suspense fallback={null}>
        <EngineModel key={def.id} def={def}>
          <CombustionView />
          <Flows />
          <Labels />
        </EngineModel>
      </Suspense>
      <CameraRig />
      <TourPlayer />
      {import.meta.env.DEV && new URLSearchParams(location.search).has('stats') && <Stats />}
    </Canvas>
  );
}
