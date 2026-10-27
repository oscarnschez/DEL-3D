import { firingAngles } from '@/core/kinematics/cycle';
import { valveEvents, type ValveEvent } from '@/core/kinematics/valvetrain';
import type { EngineDefinition } from './schema';

/** Layout mecánico derivado de una definición; todas las cotas en metros, ejes de escena. */
export interface EngineLayout {
  def: EngineDefinition;
  n: number;
  r: number; // radio de manivela
  l: number; // biela
  bore: number;
  pitch: number;
  /** X de cada cilindro (cilindro 1 al frente = X negativo). */
  cylX: number[];
  /** Ángulo de encendido de cada cilindro (grados 0–720). */
  fireAngles: number[];
  /** Desfase angular de la muñequilla de cada cilindro (grados 0–360). */
  pinOffsets: number[];
  /** Altura de la cara superior del bloque (plano de culata). */
  deckY: number;
  /** Altura de la corona del pistón en PMS. */
  crownTdcY: number;
  headHeight: number;
  /** 'dohc': dos árboles (admisión −Z, escape +Z) con balancines de pivote central. 'sohc': un árbol central sobre balancines de dedo. */
  kind: 'dohc' | 'sohc' | 'ohv';
  /** Ángulo polar (alrededor de X) donde el seguidor toca la leva: 0 = arriba (DOHC), π = abajo (SOHC). */
  followerAngle: number;
  /** Separación en X de los lóbulos de admisión/escape respecto al eje del cilindro (SOHC/OHV). */
  lobeOffset: number;
  /** Cara superior de la culata (asiento de la tapa de válvulas). */
  headTopY: number;
  camY: number;
  camZ: number;
  camBaseRadius: number;
  rollerRadius: number;
  /** Separación lateral de válvulas (± desde el eje del cilindro). */
  valveZ: number;
  /** Distancia entre las dos válvulas de un mismo par (a lo largo de X). */
  valvePairDx: number;
  valveHeadRadius: number;
  /** Cara de la válvula cerrada (asiento). */
  valveSeatY: number;
  valveTipY: number;
  intake: ValveEvent;
  exhaust: ValveEvent;
  /** Balancín: brazo lado leva (a) y lado válvula (b); relación b/a. */
  rockerCamArm: number;
  rockerValveArm: number;
  rockerPivotY: number;
  rockerPivotZ: number;
  blockLength: number;
  crankcaseBottomY: number;
  sumpBottomY: number;
  mainJournalRadius: number;
  pinRadius: number;
  front: number; // X del frente del bloque
  rear: number;
}

export function deriveLayout(def: EngineDefinition): EngineLayout {
  const g = def.geometry;
  const n = def.cylinders;
  const r = g.stroke / 2;
  const l = g.rodLength;
  const pitch = g.cylinderPitch;
  const cylX = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * pitch);
  const fa = firingAngles(def.firingOrder);
  const pinOffsets = fa.map((a) => a % 360);
  const crownTdcY = r + l + g.compressionHeight;
  const deckY = crownTdcY + g.deckClearance;
  const { intake, exhaust } = valveEvents(def.valvetrain.timing, def.valvetrain.maxLiftIntake, def.valvetrain.maxLiftExhaust);
  const bore = g.bore;
  const valveZ = bore * 0.23;
  const camBaseRadius = bore * 0.18;
  const rollerRadius = bore * 0.06;
  const headHeight = bore * 0.85;
  const kind: 'dohc' | 'sohc' | 'ohv' = def.valvetrain.camLocation === 'block' ? 'ohv' : def.valvetrain.camshafts === 2 ? 'dohc' : 'sohc';
  let rockerValveArm: number, rockerCamArm: number, rockerPivotZ: number, camZ: number, camY: number, rockerPivotY: number, valveTipY: number, headTopY: number;
  if (kind === 'dohc') {
    rockerValveArm = bore * 0.37;
    rockerCamArm = bore * 0.3;
    rockerPivotZ = valveZ + rockerValveArm;
    camZ = rockerPivotZ + rockerCamArm;
    camY = deckY + headHeight;
    rockerPivotY = camY + camBaseRadius + rollerRadius;
    valveTipY = rockerPivotY - 0.014;
    headTopY = camY;
  } else if (kind === 'ohv') {
    // árbol en el bloque (lado admisión) + taqués de rodillo + varillas + balancines en eje.
    // Válvulas dispuestas en pares transversales (puentes orientados en Z) a x = ±valveZ.
    rockerValveArm = bore * 0.5;
    rockerCamArm = bore * 0.35;
    rockerPivotZ = -rockerValveArm;
    camZ = rockerValveArm + rockerCamArm;
    camY = r + 0.12;
    headTopY = deckY + headHeight;
    rockerPivotY = headTopY + 0.035;
    valveTipY = rockerPivotY - 0.014;
  } else {
    // balancín de dedo: pivote en z = ±P, rodillo en z = 0 bajo la leva, válvula en ∓valveZ
    const P = bore * 0.44;
    rockerCamArm = P;
    rockerValveArm = P + valveZ;
    rockerPivotZ = P;
    camZ = 0;
    rockerPivotY = deckY + headHeight + 0.012;
    camY = rockerPivotY + rollerRadius + camBaseRadius;
    valveTipY = rockerPivotY - 0.016;
    headTopY = deckY + headHeight - 0.012;
  }
  const blockLength = pitch * n + bore * 0.55;
  return {
    def,
    n,
    r,
    l,
    bore,
    pitch,
    cylX,
    fireAngles: fa,
    pinOffsets,
    deckY,
    crownTdcY,
    headHeight,
    kind,
    followerAngle: kind === 'sohc' ? Math.PI : 0,
    lobeOffset: kind === 'dohc' ? 0 : kind === 'ohv' ? valveZ : bore * 0.16,
    headTopY,
    camY,
    camZ,
    camBaseRadius,
    rollerRadius,
    valveZ,
    valvePairDx: bore * 0.46,
    valveHeadRadius: bore * 0.145,
    valveSeatY: deckY - 0.0008,
    valveTipY,
    intake,
    exhaust,
    rockerCamArm,
    rockerValveArm,
    rockerPivotY,
    rockerPivotZ,
    blockLength,
    crankcaseBottomY: -r - bore * 0.55,
    sumpBottomY: -r - bore * 1.45,
    mainJournalRadius: bore * 0.42,
    pinRadius: bore * 0.33,
    front: -blockLength / 2,
    rear: blockLength / 2,
  };
}
