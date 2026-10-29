import type { EngineDefinition } from '../schema';
import { approxGeometry, GENERIC_VALVES, hp, SRC_I6, SRC_PAINT_SLASHGEAR, SRC_PAINT_TPI } from './common';

export const catC15: EngineDefinition = {
  id: 'cat-c15',
  manufacturer: 'Caterpillar (CAT)',
  model: 'C15 ACERT',
  variant: 'C15 ACERT (bloque y cotas según Cat; calibración de camión aproximada)',
  year: 'Camión: producción hasta 2010 (aprox.)',
  cylinders: 6,
  layout: 'inline',
  firingOrder: [1, 5, 3, 6, 2, 4],
  firingOrderStatus: 'aproximado',
  geometry: approxGeometry(137.2, 171, 17),
  valvetrain: { camLocation: 'overhead', camshafts: 1, valvesPerCylinder: 4, ...GENERIC_VALVES, gearTrain: 'front' },
  injection: {
    system: 'eui',
    event: { soiBTDC: 10, duration: 24, pilotAdvance: 0 },
    fuelPath: ['Tanque', 'Bomba de transferencia', 'Filtros', 'Galería en la culata', 'Inyector-bomba MEUI (accionado por leva)', 'Cámara'],
    description: 'MEUI: inyector-bomba mecánico con control electrónico. La alta presión se genera en cada inyector, accionado por el árbol de levas; no hay riel de alta presión.',
  },
  air: {
    turbo: 'series',
    egr: true,
    aftertreatment: ['DOC', 'DPF'],
    description: 'Representación de camión ACERT con dos turbos en serie (aproximado). La variante industrial citada usa un solo turbo con posenfriamiento.',
  },
  rpm: { idle: 600, max: 2100, ratedPower: 1800, peakTorque: 1200, status: 'aproximado' },
  nominal: { powerKw: hp(595), torqueNm: 2700, status: 'aproximado' },
  specs: [
    { key: 'displacement', label: 'Cilindrada', value: '15.2 L (928 in³)', status: 'verificado', sourceId: 'c15-cat' },
    { key: 'boreStroke', label: 'Diámetro × carrera', value: '137.2 × 171 mm (5.4 × 6.75 in)', status: 'verificado', sourceId: 'c15-cat' },
    { key: 'injection', label: 'Inyección', value: 'MEUI (inyector-bomba)', status: 'verificado', sourceId: 'c15-cat' },
    { key: 'power', label: 'Potencia (variante petrolera citada)', value: '440–595 bhp a 1,800–2,100 rpm', status: 'verificado', sourceId: 'c15-cat', note: 'Las potencias de camión on-highway no se verificaron.' },
    { key: 'aspiration', label: 'Sobrealimentación', value: 'Turbo con posenfriamiento (variante citada); camión: turbos en serie', status: 'aproximado', sourceId: 'c15-cat' },
    { key: 'configuration', label: 'Configuración', value: '6 cilindros en línea', status: 'aproximado', sourceId: 'i6-firing' },
    { key: 'torque', label: 'Par máximo', value: 'Sin dato verificado', status: 'aproximado', note: 'El par de 2,700 N·m del tablero es una estimación educativa.' },
    { key: 'valvetrain', label: 'Distribución', value: 'Un árbol en cabeza (SOHC) — representación', status: 'aproximado' },
    { key: 'firingOrder', label: 'Orden de encendido', value: '1-5-3-6-2-4', status: 'aproximado', sourceId: 'i6-firing' },
  ],
  sources: [
    { id: 'c15-cat', title: 'Caterpillar — C15 ACERT (Dry Manifold), motores de servicio de pozos', url: 'https://www.cat.com/en_US/products/new/power-systems/oil-and-gas/well-service-engines/18436090.html', accessed: '2026-10-27' },
    SRC_I6,
    SRC_PAINT_SLASHGEAR,
    SRC_PAINT_TPI,
  ],
  style: {
    block: '#e8ae0c', head: '#efb914', cover: '#1c1c1c', accent: '#ffcd11', coverStyle: 'ribbed',
    paint: {
      summary: 'Bloque y culata amarillo Cat; tapa negra',
      status: 'aproximado',
      note: 'El amarillo característico de Cat en sus motores está respaldado por fuentes secundarias coincidentes; no se localizó un documento de Caterpillar que fije el tono del C15 de camión. El hexadecimal se aproxima al amarillo de marca Cat.',
      sourceIds: ['paint-slashgear', 'paint-tpi'],
    },
  },
  assets: { provisional: true },
  notes: [
    'Inyección por inyector-bomba (MEUI): el recorrido del combustible no tiene riel de alta presión.',
    'La cilindrada (15.2 L) y las cotas provienen de Cat; la calibración de camión y los turbos en serie son aproximados.',
    'Sin logotipos de marca en el modelo 3D.',
  ],
};
