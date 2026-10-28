import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { boltGeometry } from '../geometry/builders';
import { getMaterials } from '../materials';
import { useDisposable } from '../resources';

interface BoltsProps {
  /** Posición y dirección (eje del tornillo) de cada instancia. */
  items: { p: [number, number, number]; dir?: [number, number, number] }[];
  d?: number;
}

const UP = new THREE.Vector3(0, 1, 0);

/** Tornillería instanciada (un draw call por grupo). */
export function Bolts({ items, d = 0.008 }: BoltsProps) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useDisposable(() => boltGeometry(d), [d]);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const s = new THREE.Vector3(1, 1, 1);
    items.forEach((it, i) => {
      v.set(...(it.dir ?? [0, 1, 0])).normalize();
      q.setFromUnitVectors(UP, v);
      m.compose(new THREE.Vector3(...it.p), q, s);
      ref.current!.setMatrixAt(i, m);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    ref.current!.computeBoundingSphere();
  }, [items]);
  return <instancedMesh ref={ref} args={[geo, getMaterials().bolt, items.length]} castShadow />;
}
