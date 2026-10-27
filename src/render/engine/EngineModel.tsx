import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { deriveLayout } from '@/engines/derive';
import type { EngineDefinition } from '@/engines/schema';
import { computeStates, createStates } from '@/core/kinematics/engineState';
import { sim } from '@/core/simulation/clock';
import { EngineContext, type EngineCtx } from './useEngine';
import { Crankshaft, Damper, Flywheel, PistonsAndRods } from './Reciprocating';
import { Block, CylinderHead, Liners, MainBearingCaps, OilPan, ValveCover } from './Structure';
import { Camshafts, TimingGears, ValvesAndRockers } from './Valvetrain';
import { AirSystem, CoolingSystem, FuelSystem, Housings, LubeSystem } from './Systems';

interface Props {
  def: EngineDefinition;
  /** Desfase angular para vistas comparativas (normalmente 0). */
  angleOffset?: number;
  children?: React.ReactNode;
}

/**
 * Motor completo. Calcula una vez por frame el estado cinemático de todos los cilindros
 * a partir de `sim.angle` (prioridad −1, después del reloj) y lo comparte por contexto.
 */
export function EngineModel({ def, angleOffset = 0, children }: Props) {
  const ctx = useMemo<EngineCtx>(() => {
    const L = deriveLayout(def);
    return { L, states: createStates(L.n), angle: { value: 0 } };
  }, [def]);

  useFrame(() => {
    ctx.angle.value = sim.angle + angleOffset;
    computeStates(ctx.L, ctx.angle.value, sim.load, ctx.states);
  }, -1);

  return (
    <EngineContext.Provider value={ctx}>
      <group name={`engine-${def.id}`}>
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
    </EngineContext.Provider>
  );
}
