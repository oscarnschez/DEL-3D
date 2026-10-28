import { useEffect, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { parsePartKey, partKey, type PartId } from '@/engines/parts';
import { patchSection } from '@/render/materials';
import { disposeMaterialLater } from '@/render/resources';
import { useEngine } from '@/render/engine/useEngine';
import { thermal, useThermalTick } from '@/core/thermal/state';
import { thermalColor, type ThermalKey } from '@/core/thermal/partTemps';
import { reducedMotion } from '@/state/settings';
import { visualStateFor } from './selection';
import { explodeOffset, explodeSpec, inExplodeGroup, stepProgress, type Vec3 } from './explode';
import { useViewEnv, type ViewParams } from './viewEnv';

/** Volúmenes simplificados sin cavidades internas: el corte los abre en vez de rayarlos. */
const HOLLOW = new Set<PartId>(['block', 'head', 'valveCover', 'oilPan']);
/** Piezas que se retiran con la cubierta «Admisión, escape y turbo». */
const AIR_PIPING = new Set<PartId>(['intakeManifold', 'exhaustManifold', 'intercooler', 'egr', 'turbo', 'aftertreatment']);
/** Piezas exteriores: son las únicas que proyectan sombra con el motor cerrado. */
const EXTERIOR = new Set<PartId>([
  'block',
  'head',
  'valveCover',
  'oilPan',
  'intakeManifold',
  'exhaustManifold',
  'turbo',
  'intercooler',
  'egr',
  'aftertreatment',
  'flywheel',
  'damper',
  'waterPump',
  'thermostat',
  'oilFilter',
  'fuelFilter',
  'fuelPump',
  'fuelRail',
  'oilPump',
]);

interface PartProps {
  id: PartId;
  index?: number;
  /** Carcasas/cubiertas: se vuelven transparentes con el control de transparencia y en rayos X. */
  shell?: boolean;
  children: ReactNode;
  position?: [number, number, number];
}

// Resalte sobrio: azul tecnológico y ámbar industrial de la paleta, con intensidad baja.
const HILITE = new THREE.Color('#4DA3D9');
const RELATED = new THREE.Color('#E3A34C');
const BLACK = new THREE.Color('#000000');
const TMP = { r: 0, g: 0, b: 0 };

interface MatData {
  color0: THREE.Color | null;
  emissive0: THREE.Color;
  opacity0: number;
  transparent0: boolean;
}

const matData = new WeakMap<THREE.Material, MatData>();

/** ¿Hay interior a la vista? (entonces las piezas internas también proyectan sombra) */
function interiorVisible(v: ViewParams): boolean {
  return v.mode !== 'exterior' && v.mode !== 'termica' ? true : v.transparency > 0.05 || v.explode > 0 || Object.values(v.removed).some(Boolean);
}

/**
 * Envoltorio de una pieza seleccionable. Gestiona: hover, clic, estado visual (resaltado,
 * atenuado, aislado, oculto, transparente, térmico), cubiertas retiradas y despiece.
 * Los materiales se clonan una vez por pieza al montar para modificarse individualmente, y se
 * liberan al desmontar.
 */
export function Part({ id, index, shell, children, position }: PartProps) {
  const outer = useRef<THREE.Group>(null);
  const key = partKey(id, index);
  const { L, modeled } = useEngine();
  const env = useViewEnv();
  const progress = useRef(0);
  const offset = useRef<Vec3>([0, 0, 0]);
  const clones = useRef<THREE.Material[]>([]);
  /** Un clon por material base dentro de la pieza (las subpiezas comparten estado visual). */
  const cloneOf = useRef(new Map<THREE.Material, THREE.Material>());

  useEffect(() => {
    modeled.add(id);
  }, [id, modeled]);

  useEffect(() => {
    const apply = () => {
      const g = outer.current;
      if (!g) return;
      const sel = env.selection.getState();
      const v = env.view.getState();
      const vs = visualStateFor(id, index, sel);
      const removed =
        (id === 'valveCover' && v.removed.valveCover) ||
        (id === 'head' && v.removed.head) ||
        (id === 'oilPan' && v.removed.oilPan) ||
        (id === 'block' && v.removed.block) ||
        (AIR_PIPING.has(id) && v.removed.manifolds);
      g.visible = !(vs === 'hidden' || vs === 'isolatedOut' || removed);
      const hovered = sel.hovered === key;
      const thermalMode = v.mode === 'termica';
      let opacity = 1;
      if (vs === 'dimmed') opacity = 0.15;
      else if (vs === 'ghost') opacity = 0.2;
      else if (shell && vs !== 'selected' && vs !== 'related') opacity = 1 - v.transparency;
      if (v.mode === 'rayosx' && !shell && vs === 'normal') opacity = 0.62;
      const emissive = vs === 'selected' ? HILITE : vs === 'related' ? RELATED : hovered ? HILITE : null;
      const emissiveIntensity = vs === 'selected' ? 0.32 : vs === 'related' ? 0.24 : hovered ? 0.12 : 0;
      const cast = EXTERIOR.has(id) || interiorVisible(v);
      g.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh || mesh.userData.noPart) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const next = mats.map((m) => {
          let mm = matData.has(m) ? m : cloneOf.current.get(m);
          let d = mm ? matData.get(mm) : undefined;
          if (!mm || !d) {
            mm = m.clone();
            cloneOf.current.set(m, mm);
            patchSection(mm, m, HOLLOW.has(id));
            const std = mm as THREE.MeshStandardMaterial;
            d = {
              color0: std.color ? std.color.clone() : null,
              emissive0: std.emissive ? std.emissive.clone() : BLACK.clone(),
              opacity0: mm.opacity,
              transparent0: mm.transparent,
            };
            matData.set(mm, d);
            clones.current.push(mm);
          }
          const std = mm as THREE.MeshStandardMaterial;
          if (std.emissive) {
            if (thermalMode) {
              const tk = (mesh.userData.thermal as ThermalKey | undefined) ?? id;
              thermalColor(thermal.temps[tk] ?? thermal.temps[id], TMP);
              std.emissive.setRGB(TMP.r, TMP.g, TMP.b);
              std.emissiveIntensity = emissive ? 1.15 : 0.9;
              if (std.color && d.color0) std.color.copy(d.color0).multiplyScalar(0.06);
            } else {
              if (std.color && d.color0) std.color.copy(d.color0);
              if (emissive) {
                std.emissive.copy(emissive);
                std.emissiveIntensity = emissiveIntensity;
              } else {
                std.emissive.copy(d.emissive0);
                std.emissiveIntensity = 1;
              }
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
        mesh.castShadow = cast && opacity > 0.6;
        mesh.receiveShadow = true;
      });
    };
    apply();
    const raf = requestAnimationFrame(apply);
    const u1 = env.selection.subscribe(apply);
    const u2 = env.view.subscribe((s, p) => {
      if (s.transparency !== p.transparency || s.removed !== p.removed || s.mode !== p.mode || (s.explode > 0) !== (p.explode > 0)) apply();
    });
    const u3 = useThermalTick.subscribe(() => {
      if (env.view.getState().mode === 'termica') apply();
    });
    return () => {
      cancelAnimationFrame(raf);
      u1();
      u2();
      u3();
    };
  }, [id, index, key, shell, env]);

  // Liberación diferida de los materiales clonados (conserva los programas para el motor siguiente).
  useEffect(
    () => () => {
      for (const m of clones.current) disposeMaterialLater(m);
      clones.current = [];
      cloneOf.current.clear();
    },
    [],
  );

  const spec = explodeSpec(id, L);
  useFrame((_, dt) => {
    const g = outer.current;
    if (!g) return;
    const v = env.view.getState();
    const sel = env.selection.getState().selected;
    const selId = sel ? parsePartKey(sel).id : null;
    const target = inExplodeGroup(v.explodeGroup, id, selId) ? v.explode : 0;
    if (progress.current !== target) progress.current = reducedMotion() ? target : stepProgress(progress.current, target, Math.min(dt, 0.1));
    else if (progress.current === 0 && g.position.x === (position?.[0] ?? 0) && g.position.y === (position?.[1] ?? 0) && g.position.z === (position?.[2] ?? 0)) return;
    const o = explodeOffset(spec, progress.current, offset.current);
    g.position.set((position?.[0] ?? 0) + o[0], (position?.[1] ?? 0) + o[1], (position?.[2] ?? 0) + o[2]);
  });

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    env.selection.getState().hover(key);
    document.body.style.cursor = 'pointer';
  };
  const onOut = () => {
    if (env.selection.getState().hovered === key) env.selection.getState().hover(null);
    document.body.style.cursor = '';
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 5) return; // fue un arrastre de cámara
    env.selection.getState().select(key);
  };

  return (
    <group ref={outer} name={key} userData={{ partKey: key }} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
      {children}
    </group>
  );
}
