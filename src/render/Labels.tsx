import { useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useApp } from '@/state/store';
import { useSettings } from '@/state/settings';
import { PARTS, parsePartKey, type PartId } from '@/engines/parts';
import { useSelection } from '@/interaction/selection';
import { useEngine } from './engine/useEngine';
import { auxLayout } from './engine/Systems';

interface LabelItem {
  /** Pieza que se selecciona al pulsar la etiqueta. */
  id: PartId;
  /** Nombre del objeto de escena que sigue la etiqueta (para el despiece). */
  follow: string;
  text: string;
  sub?: string;
  pos: THREE.Vector3;
  /** Prioridad al despejar etiquetas solapadas (mayor = se conserva antes). */
  prio: number;
}

const MAX: Record<'baja' | 'media' | 'alta', number> = { baja: 6, media: 11, alta: 22 };
const V = new THREE.Vector3();
const C = new THREE.Vector3();
const D = new THREE.Vector3();
const BOX = new THREE.Box3();

/**
 * Etiquetas técnicas con despeje automático: se proyectan a pantalla ~20 veces por segundo y se
 * escriben directamente en el DOM. Se ocultan si quedan detrás del motor, si su pieza está oculta,
 * si se solapan con otra de mayor prioridad o si tapan la pieza seleccionada. Son pulsables.
 */
export function Labels() {
  const show = useApp((s) => s.labels || s.tour !== null);
  const density = useSettings((s) => s.labelDensity);
  const { L } = useEngine();
  const gl = useThree((s) => s.gl);
  const items = useMemo<LabelItem[]>(() => {
    const A = auxLayout(L);
    const it = (id: PartId, p: [number, number, number], prio: number, follow: string = id, text = PARTS[id].name, sub?: string): LabelItem => ({ id, follow, text, sub, pos: new THREE.Vector3(...p), prio });
    // módulos del postratamiento a lo largo de la carcasa (orden DOC → DPF → SCR, esquemático)
    const af = (dx: number) => [A.after.x + dx, A.after.y + 0.2, A.after.z] as [number, number, number];
    return [
      it('valveCover', [L.cylX[1], A.d.coverTop + 0.04, 0], 7),
      it('head', [L.cylX[4], L.deckY + 0.06, -A.d.headHalf - 0.02], 8),
      it('block', [L.cylX[2], 0.15, -A.d.crankHalf - 0.02], 9),
      it('oilPan', [L.cylX[4], L.sumpBottomY + 0.02, A.d.crankHalf * 0.8], 6),
      it('crankshaft', [L.cylX[0], -0.02, 0], 9),
      it('piston', [L.cylX[2], L.deckY - 0.05, 0], 9, 'piston:3'),
      it('camshaft', [L.cylX[3], L.camY, L.camZ], 7),
      it('rockers', [L.cylX[1], L.rockerPivotY + 0.02, -L.rockerPivotZ], 5),
      it('turbo', [A.turbo.x, A.turbo.y + 0.11, A.turbo.z], 9),
      it('intakeManifold', [L.cylX[0], A.plenumY + 0.06, A.plenumZ], 7),
      it('exhaustManifold', [L.cylX[5], A.exCollY - 0.05, A.exCollZ], 8),
      it('flywheel', [L.rear + 0.06, L.bore * 1.9, 0], 6),
      it('damper', [L.front - L.bore * 0.9, L.bore * 1.25, 0], 5),
      it('intercooler', [A.cooler.x, A.cooler.y + 0.3, 0], 6),
      it('aftertreatment', af(-0.37), 4, 'aftertreatment', 'DOC', 'Catalizador de oxidación'),
      it('aftertreatment', af(-0.1), 5, 'aftertreatment', 'DPF', 'Filtro de partículas'),
      it('aftertreatment', af(0.18), 4, 'aftertreatment', 'SCR', 'Reducción catalítica (urea)'),
      it('fuelRail', [L.cylX[4], A.railY + 0.02, A.railZ], 6),
      it('oilFilter', [A.oilFilter.x, A.oilFilter.y + 0.03, A.oilFilter.z - 0.05], 4),
      it('waterPump', [A.waterPump.x, A.waterPump.y + 0.09, A.waterPump.z], 4),
    ];
  }, [L]);
  const anchor = useRef<THREE.Group>(null);
  const els = useRef<(HTMLButtonElement | null)[]>([]);
  const acc = useRef(1);
  const placed = useMemo(() => [] as [number, number, number, number][], []);

  useFrame(({ camera, scene, size }, dt) => {
    acc.current += dt;
    if (!show || acc.current < 0.05) return;
    acc.current = 0;
    const g = anchor.current;
    if (!g) return;
    const sel = useSelection.getState();
    const app = useApp.getState();
    const max = MAX[density];
    // centro del motor (para descartar etiquetas en la cara opuesta a la cámara)
    C.set(0, 0.15, 0).applyMatrix4(g.matrixWorld);
    D.copy(camera.position).sub(C).normalize();
    // rectángulo en pantalla de la pieza seleccionada: no se tapa con etiquetas
    let selRect: [number, number, number, number] | null = null;
    if (sel.selected) {
      const o = scene.getObjectByName(sel.selected);
      if (o) {
        const b = BOX.setFromObject(o);
        if (!b.isEmpty()) {
          let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
          for (let k = 0; k < 8; k++) {
            V.set(k & 1 ? b.max.x : b.min.x, k & 2 ? b.max.y : b.min.y, k & 4 ? b.max.z : b.min.z).project(camera);
            const sx = (V.x * 0.5 + 0.5) * size.width;
            const sy = (-V.y * 0.5 + 0.5) * size.height;
            x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy);
          }
          selRect = [x0, y0, x1, y1];
        }
      }
    }
    const order = items.map((_, i) => i).sort((a, b) => {
      const pa = items[a].follow === sel.selected || items[a].id === sel.selected ? 100 : items[a].prio;
      const pb = items[b].follow === sel.selected || items[b].id === sel.selected ? 100 : items[b].prio;
      return pb - pa;
    });
    placed.length = 0;
    for (const i of order) {
      const el = els.current[i];
      if (!el) continue;
      const it = items[i];
      const isSel = sel.selected !== null && parsePartKey(sel.selected).id === it.id;
      const obj = scene.getObjectByName(it.follow);
      V.copy(it.pos);
      if (obj) V.add(obj.position); // desplazamiento del despiece
      V.applyMatrix4(g.matrixWorld);
      // ¿detrás del motor? (anclaje en la cara opuesta a la cámara)
      const back = (V.x - C.x) * D.x + (V.y - C.y) * D.y + (V.z - C.z) * D.z < -0.12 && !isSel;
      V.project(camera);
      const hiddenPart = sel.hidden.has(it.id) || (obj !== undefined && obj !== null && !obj.visible);
      const removed = (it.id === 'valveCover' && app.removed.valveCover) || (it.id === 'head' && app.removed.head) || (it.id === 'oilPan' && app.removed.oilPan) || (it.id === 'block' && app.removed.block);
      let visible = V.z < 1 && Math.abs(V.x) < 1.05 && Math.abs(V.y) < 1.05 && !back && !hiddenPart && !removed && placed.length < max;
      const x = (V.x * 0.5 + 0.5) * size.width;
      const y = (-V.y * 0.5 + 0.5) * size.height;
      const w = it.text.length * 6.6 + (it.sub ? Math.min(150, it.sub.length * 5.4) : 0) + 30;
      const r: [number, number, number, number] = [x - w / 2, y - 12, x + w / 2, y + 12];
      if (visible) {
        for (const p of placed) if (r[0] < p[2] && r[2] > p[0] && r[1] < p[3] && r[3] > p[1]) visible = false;
        if (visible && selRect && !isSel && r[0] < selRect[2] && r[2] > selRect[0] && r[1] < selRect[3] && r[3] > selRect[1]) visible = false;
      }
      if (visible) placed.push(r);
      el.style.display = visible ? '' : 'none';
      if (visible) {
        el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
        el.classList.toggle('sel', isSel);
      }
    }
  });

  const host = gl.domElement.parentElement;
  return (
    <group ref={anchor}>
      {show &&
        host &&
        createPortal(
          <div className="label-layer" aria-label="Etiquetas de piezas">
            {items.map((it, i) => (
              <button
                key={`${it.follow}-${it.text}`}
                ref={(el) => {
                  els.current[i] = el;
                }}
                className="tag3d-btn"
                style={{ display: 'none' }}
                onClick={() => useSelection.getState().select(it.follow.includes(':') ? it.follow : it.id)}
                title={it.sub ? `${it.text}: ${it.sub}` : PARTS[it.id].function}
              >
                <span className="dot" />
                {it.text}
                {it.sub && <small>{it.sub}</small>}
              </button>
            ))}
          </div>,
          host,
        )}
    </group>
  );
}
