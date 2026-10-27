import type { InjectionEvent, ValveTiming } from '@/core/kinematics/valvetrain';

/** Estado de respaldo de un dato técnico. */
export type DataStatus = 'verificado' | 'aproximado';

export interface Source {
  id: string;
  title: string;
  url: string;
  /** Fecha de consulta (AAAA-MM-DD). */
  accessed: string;
}

/** Entrada de la ficha técnica mostrada al usuario. */
export interface SpecEntry {
  key: SpecKey;
  label: string;
  value: string;
  status: DataStatus;
  /** id de Source; obligatorio si status = 'verificado'. */
  sourceId?: string;
  note?: string;
}

export type SpecKey =
  | 'displacement'
  | 'configuration'
  | 'boreStroke'
  | 'power'
  | 'torque'
  | 'rpmRange'
  | 'compressionRatio'
  | 'injection'
  | 'aspiration'
  | 'valvetrain'
  | 'emissions'
  | 'firingOrder'
  | 'weight'
  | 'other';

export type InjectionSystem =
  | 'common-rail' // riel común de alta presión
  | 'amplified-common-rail' // riel común con amplificación en el inyector
  | 'eui'; // inyector-bomba electrónico accionado por leva

export type TurboLayout =
  | 'vgt' // turbo de geometría variable
  | 'wastegate' // turbo de geometría fija con wastegate
  | 'fixed' // turbo de geometría fija sin wastegate
  | 'asymmetric' // turbo de carcasa asimétrica
  | 'series' // dos turbos en serie
  | 'turbo-compound'; // turbo + turbina de potencia acoplada al cigüeñal

export type Aftertreatment = 'DOC' | 'DPF' | 'SCR' | 'ASC';

/** Geometría base usada por la simulación (metros). */
export interface EngineGeometry {
  bore: number;
  stroke: number;
  /** Longitud de biela centro a centro. Rara vez publicada: normalmente 'aproximado'. */
  rodLength: number;
  /** Distancia entre ejes de cilindros. */
  cylinderPitch: number;
  /** Altura de compresión del pistón (bulón a corona). */
  compressionHeight: number;
  /** Holgura entre corona en PMS y la cara de la culata. */
  deckClearance: number;
  compressionRatio: number;
  /** Estado del conjunto de dimensiones no publicadas (biela, paso, altura de compresión). */
  derivedStatus: DataStatus;
}

export interface EngineValvetrain {
  camLocation: 'overhead' | 'block';
  camshafts: 1 | 2;
  valvesPerCylinder: 4 | 2;
  timing: ValveTiming;
  timingStatus: DataStatus;
  maxLiftIntake: number;
  maxLiftExhaust: number;
  /** Ubicación del tren de engranajes de distribución. */
  gearTrain: 'front' | 'rear';
  /** Freno de motor (compresión) integrado. */
  engineBrake?: string;
}

export interface EngineInjection {
  system: InjectionSystem;
  event: InjectionEvent;
  /** Recorrido del combustible, en orden, para la visualización. */
  fuelPath: string[];
  description: string;
}

export interface EngineAir {
  turbo: TurboLayout;
  /** Turbina de potencia acoplada mecánicamente al cigüeñal. */
  turboCompound?: boolean;
  egr: boolean;
  aftertreatment: Aftertreatment[];
  description: string;
}

export interface EngineStyle {
  /** Color de la pintura del bloque (representación aproximada). */
  block: string;
  head: string;
  cover: string;
  accent: string;
  /** Rasgos de diseño exterior que la geometría procedural reproduce. */
  coverStyle: 'ribbed' | 'smooth' | 'split' | 'stepped';
}

export interface EngineDefinition {
  id: string;
  manufacturer: string;
  model: string;
  /** Variante / familia de calibración representada. */
  variant: string;
  /** Año o rango de años de modelo representado. */
  year: string;
  cylinders: number;
  layout: 'inline';
  firingOrder: number[];
  firingOrderStatus: DataStatus;
  geometry: EngineGeometry;
  valvetrain: EngineValvetrain;
  injection: EngineInjection;
  air: EngineAir;
  rpm: { idle: number; max: number; ratedPower: number; peakTorque: number; status: DataStatus };
  /** Valores nominales usados por el modelo del tablero. */
  nominal: { powerKw: number; torqueNm: number; status: DataStatus };
  specs: SpecEntry[];
  sources: Source[];
  style: EngineStyle;
  /** Recursos 3D. Si `glb` es undefined, se usa la geometría procedural provisional. */
  assets: { glb?: string; license?: string; provisional: boolean };
  notes: string[];
}
