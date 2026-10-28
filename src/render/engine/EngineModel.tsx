import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { create } from 'zustand';
import { deriveLayout } from '@/engines/derive';
import type { EngineDefinition } from '@/engines/schema';
import type { PartId } from '@/engines/parts';
import { computeStates, createStates } from '@/core/kinematics/engineState';
import { DEG } from '@/core/kinematics/crank';
import { sim as mainClock, type SimState } from '@/core/simulation/clock';
import { reducedMotion, useSettings } from '@/state/settings';
import { EngineContext, type EngineCtx } from './useEngine';
import { Crankshaft, Damper, Flywheel, PistonsAndRods } from './Reciprocating';
import { Block, CylinderHead, Liners, MainBearingCaps, OilPan, ValveCover } from './Structure';
import { Camshafts, TimingGears, ValvesAndRockers } from './Valvetrain';
import { AirSystem, CoolingSystem, FuelSystem, Housings, LubeSystem } from './Systems';

interface Props {
  def: EngineDefinition;
  /** Reloj que mueve este motor (el principal, o uno propio en el comparador). */
  clock?: SimState;
  /** Publica las piezas modeladas en `useModelInfo` (sólo la vista principal). */
  publish?: boolean;
  children?: React.ReactNode;
}

/** Piezas modeladas en el motor de la vista principal: la interfaz habilita sólo herramientas compatibles. */
export const useModelInfo = create<{ engineId: string | null; parts: PartId[] }>(() => ({ engineId: null, parts: [] }));

/**
 * Motor completo. Calcula una vez por frame el estado cinemático de todos los cilindros
 * a partir del ángulo del reloj (prioridad −1, después del reloj) y lo comparte por contexto.
 */
export function EngineModel({ def, clock = mainClock, publish = false, children }: Props) {
  const ctx = useMemo<EngineCtx>(() => {
    const L = deriveLayout(def);
    return { L, states: createStates(L.n), angle: { value: 0 }, modeled: new Set(), clock };
  }, [def, clock]);
  const shake = useRef<THREE.Group>(null);

  useFrame(() => {
    ctx.angle.value = clock.angle;
    computeStates(ctx.L, ctx.angle.value, clock.load, ctx.states);
    // Vibración visual opcional: balanceo sutil a la frecuencia de encendido (3.er orden en un I6),
    // aplicado al conjunto completo. No modifica la cinemática ni el estado de la simulación.
    const g = shake.current;
    if (!g) return;
    const s = useSettings.getState();
    const amp = s.vibration > 0 && !reducedMotion(s) && clock.rpm > 50 ? s.vibration : 0;
    if (amp === 0) {
      if (g.rotation.x !== 0 || g.position.y !== 0) {
        g.rotation.x = 0;
        g.position.y = 0;
      }
      return;
    }
    const orders = (ctx.L.n / 2) * clock.angle * DEG; // n/2 encendidos por vuelta
    // más visible en ralentí (los soportes filtran más a alto régimen)
    const k = amp * (0.35 + 0.65 * Math.min(1, def.rpm.idle / Math.max(1, clock.rpm)));
    g.rotation.x = 0.0011 * k * Math.sin(orders);
    g.position.y = 0.00035 * k * Math.sin(orders + 1.1);
  }, -1);

  useEffect(() => {
    if (!publish) return;
    useModelInfo.setState({ engineId: def.id, parts: [...ctx.modeled] });
    return () => useModelInfo.setState({ engineId: null, parts: [] });
  }, [publish, ctx, def.id]);

  return (
    <EngineContext.Provider value={ctx}>
      <group name={`engine-${def.id}`}>
        <group ref={shake}>
          <Block />
          <Housings />
          <Liners />
          <MainBearingCaps />
          <CylinderHead />
          <ValveCover />
          <OilPan />
          <Crankshaft />
          <PistonsAndRods />
          <Flywheel />
          <Damper />
          <Camshafts />
          <ValvesAndRockers />
          <TimingGears />
          <FuelSystem />
          <AirSystem />
          <LubeSystem />
          <CoolingSystem />
          {children}
        </group>
      </group>
    </EngineContext.Provider>
  );
}
