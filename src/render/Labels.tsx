import { useMemo } from 'react';
import { Html } from '@react-three/drei';
import { useApp } from '@/state/store';
import { PARTS, type PartId } from '@/engines/parts';
import { useSelection } from '@/interaction/selection';
import { useEngine } from './engine/useEngine';
import { auxLayout } from './engine/Systems';

/** Etiquetas técnicas flotantes (modo TÉCNICO y recorridos cinematográficos). */
export function Labels() {
  const show = useApp((s) => s.labels || s.tour !== null);
  const { L } = useEngine();
  const items = useMemo(() => {
    const A = auxLayout(L);
    const list: [PartId, [number, number, number]][] = [
      ['valveCover', [L.cylX[1], A.d.coverTop + 0.04, 0]],
      ['head', [L.cylX[4], L.deckY + 0.06, -A.d.headHalf - 0.02]],
      ['block', [L.cylX[2], 0.15, -A.d.crankHalf - 0.02]],
      ['oilPan', [L.cylX[4], L.sumpBottomY + 0.02, A.d.crankHalf * 0.8]],
      ['crankshaft', [L.cylX[0], -0.02, 0]],
      ['piston', [L.cylX[2], L.deckY - 0.05, 0]],
      ['camshaft', [L.cylX[3], L.camY, L.camZ]],
      ['rockers', [L.cylX[1], L.rockerPivotY + 0.02, -L.rockerPivotZ]],
      ['turbo', [A.turbo.x, A.turbo.y + 0.11, A.turbo.z]],
      ['intakeManifold', [L.cylX[0], A.plenumY + 0.06, A.plenumZ]],
      ['exhaustManifold', [L.cylX[5], A.exCollY - 0.05, A.exCollZ]],
      ['flywheel', [L.rear + 0.06, L.bore * 1.9, 0]],
      ['damper', [L.front - L.bore * 0.9, L.bore * 1.25, 0]],
      ['intercooler', [A.cooler.x, A.cooler.y + 0.3, 0]],
      ['aftertreatment', [A.after.x, A.after.y + 0.22, A.after.z]],
      ['fuelRail', [L.cylX[4], A.railY + 0.02, A.railZ]],
      ['oilFilter', [A.oilFilter.x, A.oilFilter.y + 0.03, A.oilFilter.z - 0.05]],
      ['waterPump', [A.waterPump.x, A.waterPump.y + 0.09, A.waterPump.z]],
    ];
    return list;
  }, [L]);
  if (!show) return null;
  return (
    <>
      {items.map(([id, p]) => (
        <Html key={id} position={p} center distanceFactor={1.6} zIndexRange={[10, 0]} className="tag3d">
          <button className="tag3d-btn" onClick={() => useSelection.getState().select(id)}>
            <span className="dot" />
            {PARTS[id].name}
          </button>
        </Html>
      ))}
    </>
  );
}
