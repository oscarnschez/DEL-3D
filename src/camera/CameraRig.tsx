import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CameraControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import type CameraControlsImpl from 'camera-controls';
import { useSelection } from '@/interaction/selection';

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

/** API imperativa de cámara usada por la interfaz y los recorridos. */
export const cameraApi = {
  controls: null as CameraControlsImpl | null,
  scene: null as THREE.Scene | null,
  setView(v: ViewPreset, smooth = true) {
    const c = this.controls;
    if (!c) return;
    const p = PRESETS[v];
    void c.setLookAt(p[0], p[1], p[2], TARGET.x, TARGET.y, TARGET.z, smooth);
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
      smoothTime={0.45}
      draggingSmoothTime={0.12}
      dollyToCursor
      infinityDolly={false}
    />
  );
}
