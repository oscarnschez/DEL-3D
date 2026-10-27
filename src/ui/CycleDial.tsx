import { useApp } from '@/state/store';
import { getEngine } from '@/engines/catalog';
import { deriveLayout } from '@/engines/derive';
import { firingAngles, localCycleAngle, phaseOf, PHASE_COLOR, PHASE_LABEL, type StrokePhase } from '@/core/kinematics/cycle';
import { DEG, pistonDisplacement } from '@/core/kinematics/crank';
import { valveLiftFraction } from '@/core/kinematics/valvetrain';
import { useSimSnapshot } from './useSimSnapshot';
import { useMemo } from 'react';

const R = 70;
const C = 90;

function arc(a0: number, a1: number, r: number): string {
  // ángulos de ciclo 0–720 mapeados a 0–360° del dial; 0 arriba, sentido horario
  const p = (a: number) => {
    const t = ((a / 720) * 360 - 90) * DEG;
    return [C + r * Math.cos(t), C + r * Math.sin(t)];
  };
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  const large = a1 - a0 > 360 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

/** Indicador circular de 720° del cilindro observado: fase, ventanas de válvulas e inyección, posición del pistón. */
export function CycleDial({ size = 180 }: { size?: number }) {
  const engineId = useApp((s) => s.engineId);
  const focus = useApp((s) => s.focusCylinder);
  const def = getEngine(engineId);
  const L = useMemo(() => deriveLayout(def), [def]);
  const snap = useSimSnapshot(30);
  const fa = firingAngles(def.firingOrder);
  const phi = localCycleAngle(snap.angle, fa[focus - 1]);
  const phase = phaseOf(phi);
  const t = ((phi / 720) * 360 - 90) * DEG;
  const disp = pistonDisplacement((phi % 360) * DEG, L.r, L.l) / (2 * L.r);
  const inj = def.injection.event;
  const ivo = L.intake.open;
  const evo = L.exhaust.open;
  const phases: [StrokePhase, number, number][] = [
    ['expansion', 0, 180],
    ['escape', 180, 360],
    ['admision', 360, 540],
    ['compresion', 540, 720],
  ];
  return (
    <svg width={size} height={size + 44} viewBox={`0 0 ${C * 2} ${C * 2 + 44}`} style={{ display: 'block' }}>
      <circle cx={C} cy={C} r={R + 12} fill="rgba(10,12,15,.85)" stroke="rgba(120,140,160,.25)" />
      {phases.map(([p, a, b]) => (
        <path key={p} d={arc(a + 0.5, b - 0.5, R)} stroke={PHASE_COLOR[p]} strokeWidth={10} fill="none" opacity={p === phase ? 1 : 0.35} />
      ))}
      {/* ventanas de válvulas */}
      <path d={arc(ivo, ivo + L.intake.duration, R - 11)} stroke="#3fa9ff" strokeWidth={3} fill="none" opacity={0.9} />
      <path d={arc(evo, evo + L.exhaust.duration, R - 16)} stroke="#c0c6cc" strokeWidth={3} fill="none" opacity={0.9} />
      {/* inyección alrededor del PMS de encendido (0/720) */}
      <path d={arc(720 - inj.soiBTDC, 719.9, R + 9)} stroke="#ffd23f" strokeWidth={3} fill="none" />
      <path d={arc(0.1, inj.duration - inj.soiBTDC, R + 9)} stroke="#ffd23f" strokeWidth={3} fill="none" />
      {[0, 180, 360, 540].map((a) => {
        const tt = ((a / 720) * 360 - 90) * DEG;
        return (
          <g key={a}>
            <line x1={C + (R - 22) * Math.cos(tt)} y1={C + (R - 22) * Math.sin(tt)} x2={C + (R + 6) * Math.cos(tt)} y2={C + (R + 6) * Math.sin(tt)} stroke="rgba(255,255,255,.35)" />
            <text x={C + (R + 20) * Math.cos(tt)} y={C + (R + 20) * Math.sin(tt) + 3} fontSize={8} fill="#8b96a3" textAnchor="middle" fontFamily="JetBrains Mono">
              {a === 0 ? 'PMS' : a === 360 ? 'PMS' : 'PMI'}
            </text>
          </g>
        );
      })}
      <line x1={C} y1={C} x2={C + (R + 4) * Math.cos(t)} y2={C + (R + 4) * Math.sin(t)} stroke="#fff" strokeWidth={2} />
      <circle cx={C} cy={C} r={3} fill="#fff" />
      {/* pistón: barra vertical con posición relativa */}
      <rect x={C - 7} y={C - 30} width={14} height={60} rx={3} fill="none" stroke="rgba(255,255,255,.2)" />
      <rect x={C - 6} y={C - 29 + disp * 46} width={12} height={12} rx={2} fill={PHASE_COLOR[phase]} />
      <text x={C} y={C * 2 + 14} fontSize={11} fill="#dfe5ec" textAnchor="middle" fontWeight={600}>
        Cilindro {focus} · {PHASE_LABEL[phase]}
      </text>
      <text x={C} y={C * 2 + 30} fontSize={9} fill="#8b96a3" textAnchor="middle" fontFamily="JetBrains Mono">
        φ {phi.toFixed(0)}° · adm {Math.round(valveLiftFraction(phi, L.intake) * 100)}% · esc {Math.round(valveLiftFraction(phi, L.exhaust) * 100)}%
      </text>
    </svg>
  );
}
