import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CameraControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import type CameraControlsImpl from 'camera-controls';
import { useSelection } from '@/interaction/selection';
import { useSettings, reducedMotion } from '@/state/settings';
import { useApp } from '@/state/store';
import { useModelInfo } from '@/render/engine/EngineModel';
import { fitDistance } from './fit';

export { fitDistance };

export type ViewPreset = 'iso' | 'frente' | 'admision' | 'escape' | 'superior' | 'inferior' | 'trasera';

export const VIEW_LABEL: Record<ViewPreset, string> = {
  iso: 'Isométrica',
  frente: 'Frontal',
  admision: 'Lado admisión',
  escape: 'Lado escape',
  superior: 'Superior',
  inferior: 'Inferior',
  trasera: 'Trasera',
};

const TARGET = new THREE.Vector3(0, 0.22, 0);

const PRESETS: Record<ViewPreset, [number, number, number]> = {
  iso: [-1.25, 0.95, 1.35],
  frente: [-2.0, 0.3, 0.001],
  admision: [0, 0.35, -2.0],
  escape: [0, 0.35, 2.0],
  superior: [0.001, 2.3, 0.001],
  inferior: [0.001, -1.8, 0.4],
  trasera: [2.0, 0.35, 0.001],
};

const _box = new THREE.Box3();
const _sphere = new THREE.Sphere();
const _dir = new THREE.Vector3();

/** API imperativa de cámara usada por la interfaz y los recorridos. */
export const cameraApi = {
  controls: null as CameraControlsImpl | null,
  scene: null as THREE.Scene | null,
  /** Esfera envolvente del motor actual (se recalcula al cargar cada motor). */
  bounds: new THREE.Sphere(TARGET.clone(), 1),
  /** Recalcula la envolvente del motor de la vista principal. */
  measure(engineId: string | null) {
    const root = engineId ? this.scene?.getObjectByName(`engine-${engineId}`) : null;
    if (!root) return false;
    _box.setFromObject(root, true);
    if (_box.isEmpty()) return false;
    _box.getBoundingSphere(_sphere);
    this.bounds.copy(_sphere);
    const c = this.controls;
    if (c) {
      // el objetivo de la cámara no puede alejarse del motor (no se «pierde» la escena)
      const lim = _box.clone().expandByScalar(0.6);
      c.setBoundary(lim);
    }
    return true;
  },
  /** Vista predefinida encuadrando el motor completo según el tamaño del visor. */
  setView(v: ViewPreset, smooth = true) {
    const c = this.controls;
    if (!c) return;
    const cam = c.camera as THREE.PerspectiveCamera;
    const p = PRESETS[v];
    const t = this.bounds.center;
    _dir.set(p[0] - TARGET.x, p[1] - TARGET.y, p[2] - TARGET.z).normalize();
    const d = fitDistance(this.bounds.radius, cam.fov, cam.aspect, 0.8);
    void c.setLookAt(t.x + _dir.x * d, t.y + _dir.y * d, t.z + _dir.z * d, t.x, t.y, t.z, smooth && !reducedMotion());
  },
  lookAt(pos: THREE.Vector3Tuple, target: THREE.Vector3Tuple, smooth = true) {
    return this.controls?.setLookAt(pos[0], pos[1], pos[2], target[0], target[1], target[2], smooth);
  },
  /** Encuadra un objeto de la escena por nombre (las piezas se nombran con su PartKey). */
  focusByName(name: string, padding = 0.18) {
    const obj = this.scene?.getObjectByName(name);
    const c = this.controls;
    if (!obj || !c) return;
    const box = new THREE.Box3().setFromObject(obj, true);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3()).length();
    const pad = Math.max(padding, size * 0.25);
    void c.fitToBox(box, true, { paddingLeft: pad, paddingRight: pad, paddingTop: pad, paddingBottom: pad });
  },
  reset() {
    this.setView('iso');
  },
};

export function CameraRig() {
  const ref = useRef<CameraControlsImpl>(null);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    cameraApi.controls = ref.current;
    cameraApi.scene = scene;
    cameraApi.setView('iso', false);
    return () => {
      cameraApi.controls = null;
    };
  }, [scene]);
  // encuadre automático al cargar cada motor (la envolvente depende del modelo)
  const engineId = useModelInfo((s) => s.engineId);
  useEffect(() => {
    if (!engineId) return;
    const id = requestAnimationFrame(() => {
      if (cameraApi.measure(engineId) && !useApp.getState().tour) cameraApi.setView('iso', true);
    });
    return () => cancelAnimationFrame(id);
  }, [engineId]);
  // sensibilidad configurable (ratón y táctil)
  const rotate = useSettings((s) => s.rotateSpeed);
  const zoom = useSettings((s) => s.zoomSpeed);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.azimuthRotateSpeed = rotate;
    c.polarRotateSpeed = rotate;
    c.dollySpeed = zoom;
    c.truckSpeed = 2 * rotate;
  }, [rotate, zoom]);
  // con el motor cerrado la cámara no atraviesa el bloque: colisión contra una caja interior
  const mode = useApp((s) => s.mode);
  const cut = useApp((s) => s.cut);
  const transparency = useApp((s) => s.transparency);
  const explode = useApp((s) => s.explode);
  useEffect(() => {
    const c = ref.current;
    if (!c || !engineId) return;
    const closed = mode === 'exterior' && cut === 'none' && transparency < 0.05 && explode === 0;
    if (!closed) {
      c.colliderMeshes = [];
      return;
    }
    const root = scene.getObjectByName(`engine-${engineId}`);
    if (!root) return;
    // núcleo del bloque y la culata (sin accesorios), algo reducido para permitir acercarse
    const block = root.getObjectByName('block') ?? root;
    const b = new THREE.Box3().setFromObject(block, true);
    if (b.isEmpty()) return;
    const size = b.getSize(new THREE.Vector3()).multiplyScalar(0.8);
    const center = b.getCenter(new THREE.Vector3());
    const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const mesh = new THREE.Mesh(geo);
    mesh.position.copy(center);
    mesh.updateMatrixWorld(true);
    c.colliderMeshes = [mesh];
    return () => {
      c.colliderMeshes = [];
      geo.dispose();
    };
  }, [engineId, mode, cut, transparency, explode, scene]);
  useEffect(
    () =>
      useSelection.subscribe((s, p) => {
        if (s.selected && s.selected !== p.selected) cameraApi.focusByName(s.selected);
      }),
    [],
  );
  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={0.12}
      maxDistance={7}
      smoothTime={reducedMotion() ? 0.12 : 0.45}
      draggingSmoothTime={0.12}
      dollyToCursor
      infinityDolly={false}
    />
  );
}
