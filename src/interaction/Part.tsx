import { useEffect, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { PARTS, partKey, type PartId } from '@/engines/parts';
import { useApp } from '@/state/store';
import { patchSection } from '@/render/materials';
import { useSelection, visualStateFor } from './selection';

interface PartProps {
  id: PartId;
  index?: number;
  /** Carcasas/cubiertas: se vuelven transparentes con el control de transparencia y en rayos X. */
  shell?: boolean;
  /** Distancia característica del despiece (m). */
  explodeScale?: number;
  children: ReactNode;
  position?: [number, number, number];
}

const HILITE = new THREE.Color('#2ad4ff');
const RELATED = new THREE.Color('#ffb000');
const HOVER = new THREE.Color('#5fb8ff');
const BLACK = new THREE.Color('#000000');

interface MatData {
  base: THREE.Material;
  emissive0: THREE.Color;
  opacity0: number;
  transparent0: boolean;
}

/**
 * Envoltorio de una pieza seleccionable. Gestiona: hover, clic, estado visual (resaltado,
 * atenuado, aislado, oculto, transparente), cubiertas retiradas y desplazamiento de despiece.
 * Los materiales se clonan una vez por pieza al montar para poder modificarse individualmente.
 */
export function Part({ id, index, shell, explodeScale = 0.45, children, position }: PartProps) {
  const outer = useRef<THREE.Group>(null);
  const key = partKey(id, index);
  const explodeCurrent = useRef(0);

  useEffect(() => {
    const apply = () => {
      const g = outer.current;
      if (!g) return;
      const sel = useSelection.getState();
      const app = useApp.getState();
      const vs = visualStateFor(id, index, sel);
      const removed =
        (id === 'valveCover' && app.removed.valveCover) ||
        (id === 'head' && app.removed.head) ||
        (id === 'oilPan' && app.removed.oilPan) ||
        (id === 'block' && app.removed.block) ||
        ((id === 'intakeManifold' || id === 'exhaustManifold') && app.removed.manifolds);
      g.visible = !(vs === 'hidden' || vs === 'isolatedOut' || removed);
      const hovered = sel.hovered === key;
      let opacity = 1;
      if (vs === 'dimmed') opacity = 0.12;
      else if (vs === 'ghost') opacity = 0.22;
      else if (shell && vs !== 'selected' && vs !== 'related') opacity = 1 - app.transparency;
      if (app.mode === 'rayosx' && !shell && vs === 'normal') opacity = 0.55;
      const emissive = vs === 'selected' ? HILITE : vs === 'related' ? RELATED : hovered ? HOVER : null;
      const emissiveIntensity = vs === 'selected' ? 0.55 : vs === 'related' ? 0.35 : hovered ? 0.22 : 0;
      g.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh || mesh.userData.noPart) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const next = mats.map((m) => {
          let d = m.userData.partData as MatData | undefined;
          let mm = m;
          if (!d || m.userData.owner !== g.uuid) {
            mm = m.clone();
            patchSection(mm);
            const std = mm as THREE.MeshStandardMaterial;
            d = {
              base: m,
              emissive0: std.emissive ? std.emissive.clone() : BLACK.clone(),
              opacity0: mm.opacity,
              transparent0: mm.transparent,
            };
            mm.userData = { partData: d, owner: g.uuid };
          }
          const std = mm as THREE.MeshStandardMaterial;
          if (std.emissive) {
            if (emissive) {
              std.emissive.copy(emissive);
              std.emissiveIntensity = emissiveIntensity;
            } else {
              std.emissive.copy(d.emissive0);
              std.emissiveIntensity = 1;
            }
          }
          const o2 = Math.min(d.opacity0, opacity);
          const wantTransparent = d.transparent0 || o2 < 0.999;
          if (mm.transparent !== wantTransparent) {
            mm.transparent = wantTransparent;
            mm.needsUpdate = true;
          }
          mm.opacity = o2;
          mm.depthWrite = o2 > 0.6;
          return mm;
        });
        mesh.material = Array.isArray(mesh.material) ? next : next[0];
        mesh.castShadow = opacity > 0.6;
        mesh.receiveShadow = true;
      });
    };
    apply();
    const raf = requestAnimationFrame(apply);
    const u1 = useSelection.subscribe(apply);
    const u2 = useApp.subscribe((s, p) => {
      if (s.transparency !== p.transparency || s.removed !== p.removed || s.mode !== p.mode) apply();
    });
    return () => {
      cancelAnimationFrame(raf);
      u1();
      u2();
    };
  }, [id, index, key, shell]);

  const dir = PARTS[id].explode;
  useFrame((_, dt) => {
    const g = outer.current;
    if (!g) return;
    const app = useApp.getState();
    const active = app.explodeGroup === 'todo' || app.explodeGroup === PARTS[id].system;
    const target = active ? app.explode : 0;
    explodeCurrent.current += (target - explodeCurrent.current) * (1 - Math.exp(-dt * 6));
    const e = explodeCurrent.current * explodeScale;
    g.position.set(
      (position?.[0] ?? 0) + dir[0] * e,
      (position?.[1] ?? 0) + dir[1] * e,
      (position?.[2] ?? 0) + dir[2] * e,
    );
  });

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    useSelection.getState().hover(key);
    document.body.style.cursor = 'pointer';
  };
  const onOut = () => {
    if (useSelection.getState().hovered === key) useSelection.getState().hover(null);
    document.body.style.cursor = '';
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 5) return; // fue un arrastre de cámara
    useSelection.getState().select(key);
  };

  return (
    <group ref={outer} name={key} userData={{ partKey: key }} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
      {children}
    </group>
  );
}
