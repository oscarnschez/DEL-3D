/** Registro de componentes seleccionables: nombre técnico, sistema, función y relaciones. */

export type SystemId =
  | 'estructura'
  | 'tren-alternativo'
  | 'distribucion'
  | 'combustible'
  | 'aire'
  | 'lubricacion'
  | 'refrigeracion'
  | 'postratamiento';

export const SYSTEMS: Record<SystemId, { label: string; color: string }> = {
  estructura: { label: 'Estructura', color: '#9aa3ad' },
  'tren-alternativo': { label: 'Tren alternativo', color: '#ff8a2a' },
  distribucion: { label: 'Distribución', color: '#36e0c8' },
  combustible: { label: 'Combustible', color: '#ffd23f' },
  aire: { label: 'Admisión y escape', color: '#3fa9ff' },
  lubricacion: { label: 'Lubricación', color: '#ffb000' },
  refrigeracion: { label: 'Refrigeración', color: '#2f7bff' },
  postratamiento: { label: 'Postratamiento', color: '#a78bfa' },
};

export type PartId =
  | 'block'
  | 'liner'
  | 'head'
  | 'valveCover'
  | 'piston'
  | 'rings'
  | 'rod'
  | 'crankshaft'
  | 'mainBearings'
  | 'camshaft'
  | 'intakeValves'
  | 'exhaustValves'
  | 'rockers'
  | 'timingGears'
  | 'injector'
  | 'fuelRail'
  | 'fuelPump'
  | 'fuelFilter'
  | 'intakeManifold'
  | 'exhaustManifold'
  | 'turbo'
  | 'intercooler'
  | 'egr'
  | 'oilPump'
  | 'oilPan'
  | 'oilFilter'
  | 'waterPump'
  | 'thermostat'
  | 'flywheel'
  | 'damper'
  | 'aftertreatment';

export interface PartInfo {
  name: string;
  system: SystemId;
  function: string;
  /** Descripción de su movimiento, si es móvil. */
  motion?: string;
  related: PartId[];
  /** Dirección de despiece (unitaria aprox.) y distancia relativa. */
  explode: [number, number, number];
  moving?: boolean;
  /** Pieza repetida por cilindro. */
  perCylinder?: boolean;
}

export const PARTS: Record<PartId, PartInfo> = {
  block: {
    name: 'Bloque del motor',
    system: 'estructura',
    function: 'Estructura principal de hierro fundido que aloja las camisas de cilindro, los apoyos de bancada del cigüeñal, las galerías de aceite y las camisas de agua.',
    related: ['liner', 'crankshaft', 'head', 'oilPan', 'mainBearings'],
    explode: [0, 0, 0],
  },
  liner: {
    name: 'Camisas de cilindro',
    system: 'estructura',
    function: 'Camisas húmedas reemplazables: forman la superficie de deslizamiento del pistón y están en contacto directo con el refrigerante.',
    related: ['block', 'piston', 'rings', 'waterPump'],
    explode: [0, 0.35, 0],
    perCylinder: true,
  },
  head: {
    name: 'Culata',
    system: 'estructura',
    function: 'Cierra los cilindros por arriba; contiene los conductos de admisión y escape, asientos de válvula, alojamiento de inyectores y pasajes de refrigerante.',
    related: ['block', 'intakeValves', 'exhaustValves', 'injector', 'camshaft', 'valveCover'],
    explode: [0, 1.1, 0],
  },
  valveCover: {
    name: 'Tapa de válvulas',
    system: 'estructura',
    function: 'Cubierta superior que protege el tren de válvulas y contiene el aceite de lubricación de la distribución.',
    related: ['head', 'rockers', 'camshaft'],
    explode: [0, 2.2, 0],
  },
  piston: {
    name: 'Pistón',
    system: 'tren-alternativo',
    function: 'Recibe la presión de combustión en su corona (con cámara tipo omega) y la transmite a la biela a través del bulón.',
    motion: 'Movimiento alternativo vertical. Su posición es y = r·cos α + √(l² − r²·sin² α), exacta para cada ángulo del cigüeñal.',
    related: ['rings', 'rod', 'liner', 'crankshaft'],
    explode: [0, 0.75, 0],
    moving: true,
    perCylinder: true,
  },
  rings: {
    name: 'Anillos del pistón',
    system: 'tren-alternativo',
    function: 'Anillo de compresión superior, segundo anillo y anillo de control de aceite: sellan la cámara y regulan la película de aceite en la camisa.',
    motion: 'Se desplazan con el pistón.',
    related: ['piston', 'liner'],
    explode: [0, 0.9, 0],
    moving: true,
    perCylinder: true,
  },
  rod: {
    name: 'Biela',
    system: 'tren-alternativo',
    function: 'Une el pistón con la muñequilla del cigüeñal. Convierte el movimiento alternativo en giratorio.',
    motion: 'Movimiento articulado: pie con traslación vertical, cabeza en trayectoria circular; ángulo β = asin(r·sin α / l).',
    related: ['piston', 'crankshaft', 'mainBearings'],
    explode: [0, 0.35, -0.6],
    moving: true,
    perCylinder: true,
  },
  crankshaft: {
    name: 'Cigüeñal y contrapesos',
    system: 'tren-alternativo',
    function: 'Eje de acero forjado con siete apoyos de bancada y seis muñequillas a 120°. Transforma el empuje de los pistones en par motor; los contrapesos equilibran las fuerzas rotativas.',
    motion: 'Rotación continua. En un I6 las muñequillas 1-6, 2-5 y 3-4 comparten fase; con el orden 1-5-3-6-2-4 hay un encendido cada 120°.',
    related: ['rod', 'piston', 'flywheel', 'damper', 'timingGears', 'mainBearings'],
    explode: [0, -0.9, 0],
    moving: true,
  },
  mainBearings: {
    name: 'Bancadas y cojinetes',
    system: 'estructura',
    function: 'Tapas de bancada y casquillos de fricción que soportan el cigüeñal; reciben aceite a presión desde la galería principal.',
    related: ['crankshaft', 'block', 'oilPump'],
    explode: [0, -0.55, 0],
  },
  camshaft: {
    name: 'Árbol de levas',
    system: 'distribucion',
    function: 'Abre las válvulas en el momento preciso del ciclo. Gira a la mitad de la velocidad del cigüeñal (un giro cada 720° de cigüeñal).',
    motion: 'Rotación a ½ de la velocidad del cigüeñal. El perfil de cada lóbulo se genera con la ley de alzada de su válvula.',
    related: ['rockers', 'intakeValves', 'exhaustValves', 'timingGears'],
    explode: [0, 1.75, 0],
    moving: true,
  },
  intakeValves: {
    name: 'Válvulas de admisión',
    system: 'distribucion',
    function: 'Dos por cilindro. Permiten la entrada de aire sobrealimentado durante la admisión.',
    motion: 'Movimiento lineal según la ley de alzada; abren antes del PMS de cruce y cierran después del PMI.',
    related: ['rockers', 'camshaft', 'head', 'intakeManifold'],
    explode: [0, 1.35, -0.25],
    moving: true,
    perCylinder: true,
  },
  exhaustValves: {
    name: 'Válvulas de escape',
    system: 'distribucion',
    function: 'Dos por cilindro. Liberan los gases quemados hacia el múltiple de escape y la turbina.',
    motion: 'Movimiento lineal; abren antes del PMI de expansión y cierran después del PMS de cruce (traslape).',
    related: ['rockers', 'camshaft', 'head', 'exhaustManifold'],
    explode: [0, 1.35, 0.25],
    moving: true,
    perCylinder: true,
  },
  rockers: {
    name: 'Balancines y puentes de válvula',
    system: 'distribucion',
    function: 'Seguidores de rodillo que transmiten el perfil de la leva a las válvulas, multiplicando la alzada; un puente acciona cada par de válvulas.',
    motion: 'Oscilan alrededor de su pivote siguiendo el lóbulo de leva.',
    related: ['camshaft', 'intakeValves', 'exhaustValves'],
    explode: [0, 1.55, 0],
    moving: true,
    perCylinder: true,
  },
  timingGears: {
    name: 'Engranajes de distribución',
    system: 'distribucion',
    function: 'Tren de engranajes que sincroniza cigüeñal, árbol de levas, bomba de alta presión y bomba de aceite. Relación cigüeñal:levas = 2:1.',
    motion: 'Rotación sincronizada con relaciones fijas.',
    related: ['crankshaft', 'camshaft', 'fuelPump', 'oilPump'],
    explode: [-1, 0, 0],
    moving: true,
  },
  injector: {
    name: 'Inyectores',
    system: 'combustible',
    function: 'Pulverizan el combustible a muy alta presión directamente en la cámara del pistón cerca del PMS. Un motor diésel no usa bujías: la mezcla se autoinflama por la temperatura del aire comprimido.',
    motion: 'Apertura de la aguja en eventos de inyección piloto y principal.',
    related: ['fuelRail', 'fuelPump', 'head', 'piston'],
    explode: [0, 1.6, 0.0],
    perCylinder: true,
  },
  fuelRail: {
    name: 'Riel / líneas de alta presión',
    system: 'combustible',
    function: 'Acumulador de combustible a alta presión que alimenta a todos los inyectores.',
    related: ['fuelPump', 'injector', 'fuelFilter'],
    explode: [0, 0.6, -1],
  },
  fuelPump: {
    name: 'Bomba de combustible',
    system: 'combustible',
    function: 'Bomba de alta presión accionada por engranaje; eleva la presión del combustible filtrado para la inyección.',
    related: ['fuelRail', 'fuelFilter', 'timingGears'],
    explode: [0, -0.2, -1.2],
    moving: true,
  },
  fuelFilter: {
    name: 'Filtros de combustible',
    system: 'combustible',
    function: 'Filtro primario con separador de agua y filtro secundario de alta eficiencia que protegen el sistema de inyección.',
    related: ['fuelPump', 'fuelRail'],
    explode: [0, -0.4, -1.5],
  },
  intakeManifold: {
    name: 'Múltiple de admisión',
    system: 'aire',
    function: 'Distribuye el aire comprimido y enfriado a cada cilindro.',
    related: ['intercooler', 'intakeValves', 'egr', 'head'],
    explode: [0, 0.6, -1.4],
  },
  exhaustManifold: {
    name: 'Múltiple de escape',
    system: 'aire',
    function: 'Colecta los gases de escape de los seis cilindros y los conduce a la turbina; suele ser seccionado para absorber la dilatación térmica.',
    related: ['turbo', 'exhaustValves', 'egr'],
    explode: [0, 0.4, 1.4],
  },
  turbo: {
    name: 'Turbocompresor',
    system: 'aire',
    function: 'La turbina aprovecha la energía de los gases de escape para mover el compresor, que sobrealimenta el aire de admisión.',
    motion: 'Rotor a muy alta velocidad (decenas de miles de rpm), función del caudal de escape; se muestra a velocidad visual reducida.',
    related: ['exhaustManifold', 'intercooler', 'intakeManifold', 'oilPump'],
    explode: [0, 0.9, 2],
    moving: true,
  },
  intercooler: {
    name: 'Intercooler (enfriador de aire de carga)',
    system: 'aire',
    function: 'Intercambiador aire-aire montado al frente del vehículo; reduce la temperatura del aire comprimido para aumentar su densidad.',
    related: ['turbo', 'intakeManifold'],
    explode: [-1.5, 0, 0],
  },
  egr: {
    name: 'Sistema EGR',
    system: 'aire',
    function: 'Recircula una fracción enfriada de gases de escape hacia la admisión para reducir la formación de NOx.',
    related: ['exhaustManifold', 'intakeManifold', 'waterPump'],
    explode: [0, 1.2, 0.8],
  },
  oilPump: {
    name: 'Bomba de aceite',
    system: 'lubricacion',
    function: 'Bomba de engranajes que aspira aceite del cárter a través del tubo de succión y lo envía a presión al filtro y a las galerías.',
    related: ['oilPan', 'oilFilter', 'mainBearings', 'timingGears'],
    explode: [0, -1.4, 0.3],
    moving: true,
  },
  oilPan: {
    name: 'Cárter de aceite',
    system: 'lubricacion',
    function: 'Depósito inferior del aceite del motor; recibe el retorno por gravedad de todos los puntos de lubricación.',
    related: ['oilPump', 'block'],
    explode: [0, -1.8, 0],
  },
  oilFilter: {
    name: 'Filtro y enfriador de aceite',
    system: 'lubricacion',
    function: 'Retiene partículas del aceite y lo enfría con refrigerante antes de enviarlo a las galerías principales.',
    related: ['oilPump', 'mainBearings'],
    explode: [0, -0.3, -1.6],
  },
  waterPump: {
    name: 'Bomba de agua',
    system: 'refrigeracion',
    function: 'Bomba centrífuga accionada por banda o engranaje que hace circular el refrigerante por bloque, culata, enfriadores y radiador.',
    related: ['thermostat', 'liner', 'head', 'egr'],
    explode: [-1.4, 0.2, 0],
    moving: true,
  },
  thermostat: {
    name: 'Termostato y salida de refrigerante',
    system: 'refrigeracion',
    function: 'Regula el paso del refrigerante al radiador para mantener la temperatura de trabajo.',
    related: ['waterPump', 'head'],
    explode: [-1.2, 1, 0],
  },
  flywheel: {
    name: 'Volante del motor',
    system: 'tren-alternativo',
    function: 'Masa de inercia que suaviza las pulsaciones de par y lleva la corona dentada del motor de arranque y el acoplamiento del embrague.',
    motion: 'Gira solidario al cigüeñal.',
    related: ['crankshaft'],
    explode: [1.4, 0, 0],
    moving: true,
  },
  damper: {
    name: 'Amortiguador de vibraciones',
    system: 'tren-alternativo',
    function: 'Amortiguador viscoso en la nariz del cigüeñal que reduce las vibraciones torsionales.',
    motion: 'Gira solidario al cigüeñal.',
    related: ['crankshaft', 'waterPump'],
    explode: [-1.6, -0.2, 0],
    moving: true,
  },
  aftertreatment: {
    name: 'Postratamiento (DOC + DPF + SCR)',
    system: 'postratamiento',
    function: 'Catalizador de oxidación, filtro de partículas y reducción catalítica selectiva con urea (DEF) para cumplir la normativa de emisiones.',
    related: ['turbo', 'exhaustManifold'],
    explode: [1.2, 0.6, 1.2],
  },
};

export type PartKey = string; // `${PartId}` o `${PartId}:${cilindro}`

export function partKey(id: PartId, index?: number): PartKey {
  return index === undefined ? id : `${id}:${index}`;
}

export function parsePartKey(key: PartKey): { id: PartId; index?: number } {
  const [id, idx] = key.split(':');
  return { id: id as PartId, index: idx === undefined ? undefined : Number(idx) };
}
