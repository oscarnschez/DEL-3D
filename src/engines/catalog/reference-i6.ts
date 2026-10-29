import type { EngineDefinition } from '../schema';

/**
 * Motor de referencia I6 de 4 tiempos (genérico, no corresponde a ningún fabricante).
 * Sirve como banco de pruebas de la cinemática: dimensiones típicas de la clase 13–15 L,
 * declaradas como aproximadas.
 */
export const referenceI6: EngineDefinition = {
  id: 'ref-i6',
  manufacturer: 'Referencia',
  model: 'I6 genérico 14 L',
  variant: 'Banco de pruebas cinemático',
  year: '—',
  cylinders: 6,
  layout: 'inline',
  firingOrder: [1, 5, 3, 6, 2, 4],
  firingOrderStatus: 'verificado',
  geometry: {
    bore: 0.135,
    stroke: 0.165,
    rodLength: 0.27,
    cylinderPitch: 0.168,
    compressionHeight: 0.085,
    deckClearance: 0.002,
    compressionRatio: 17,
    derivedStatus: 'aproximado',
  },
  valvetrain: {
    camLocation: 'overhead',
    camshafts: 2,
    valvesPerCylinder: 4,
    timing: { ivoBTDC: 15, ivcABDC: 35, evoBBDC: 45, evcATDC: 15 },
    timingStatus: 'aproximado',
    maxLiftIntake: 0.014,
    maxLiftExhaust: 0.0135,
    gearTrain: 'front',
  },
  injection: {
    system: 'common-rail',
    event: { soiBTDC: 8, duration: 26, pilotAdvance: 12 },
    fuelPath: ['Tanque', 'Bomba de transferencia', 'Filtro primario', 'Filtro secundario', 'Bomba de alta presión', 'Riel común', 'Inyectores', 'Cámara de combustión'],
    description: 'Riel común genérico con inyección piloto y principal (valores educativos).',
  },
  air: {
    turbo: 'vgt',
    egr: true,
    aftertreatment: ['DOC', 'DPF', 'SCR'],
    description: 'Turbo de geometría variable, EGR enfriado y postratamiento DOC + DPF + SCR (configuración típica EPA 2010+).',
  },
  rpm: { idle: 600, max: 2100, ratedPower: 1800, peakTorque: 1100, status: 'aproximado' },
  nominal: { powerKw: 336, torqueNm: 2373, status: 'aproximado' },
  specs: [
    { key: 'configuration', label: 'Configuración', value: '6 cilindros en línea, 4 tiempos', status: 'verificado', sourceId: 'i6-firing' },
    { key: 'displacement', label: 'Cilindrada', value: '14.2 L (calculada de 135 × 165 mm)', status: 'aproximado' },
    { key: 'firingOrder', label: 'Orden de encendido', value: '1-5-3-6-2-4', status: 'verificado', sourceId: 'i6-firing', note: 'Orden estándar de los I6 diésel pesados.' },
    { key: 'compressionRatio', label: 'Relación de compresión', value: '17:1', status: 'aproximado' },
    { key: 'injection', label: 'Inyección', value: 'Riel común (genérico)', status: 'aproximado' },
  ],
  sources: [
    {
      id: 'i6-firing',
      title: 'Orden de encendido 1-5-3-6-2-4 de motores de seis cilindros en línea (Wikipedia: Straight-six engine)',
      url: 'https://en.wikipedia.org/wiki/Straight-six_engine',
      accessed: '2026-10-27',
    },
  ],
  style: {
    block: '#5b636c', head: '#6a737c', cover: '#2b3036', accent: '#3fa9ff', coverStyle: 'ribbed',
    paint: { summary: 'Gris genérico (motor de referencia sin fabricante)', status: 'aproximado', note: 'Motor educativo genérico: no representa la pintura de ningún fabricante.', sourceIds: [] },
  },
  assets: { provisional: true },
  notes: [
    'Motor genérico de referencia: no representa ningún producto comercial.',
    'Reglaje de válvulas, longitud de biela e inyección son valores educativos típicos, no de fabricante.',
  ],
};
