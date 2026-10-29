import type { EngineGeometry, EngineValvetrain, Source } from '../schema';

/** Fuente compartida para el orden de encendido estándar de los I6 de 4 tiempos. */
export const SRC_I6: Source = {
  id: 'i6-firing',
  title: 'Straight-six engine — orden de encendido 1-5-3-6-2-4 (Wikipedia)',
  url: 'https://en.wikipedia.org/wiki/Straight-six_engine',
  accessed: '2026-10-27',
};

/**
 * Dimensiones internas que los fabricantes no publican (biela, paso entre cilindros,
 * altura de compresión, holgura). Se derivan de diámetro y carrera con proporciones típicas
 * de diésel pesado (λ = r/l ≈ 0.3) y se marcan como aproximadas.
 */
export function approxGeometry(boreMm: number, strokeMm: number, compressionRatio: number): EngineGeometry {
  const bore = boreMm / 1000;
  const stroke = strokeMm / 1000;
  return {
    bore,
    stroke,
    rodLength: Math.round((stroke / 2 / 0.305) * 1000) / 1000,
    cylinderPitch: Math.round(bore * 1.245 * 1000) / 1000,
    compressionHeight: Math.round(bore * 0.63 * 1000) / 1000,
    deckClearance: 0.002,
    compressionRatio,
    derivedStatus: 'aproximado',
  };
}

/** Reglaje y alzadas educativos (no publicados por los fabricantes). */
export const GENERIC_VALVES: Pick<EngineValvetrain, 'timing' | 'timingStatus' | 'maxLiftIntake' | 'maxLiftExhaust'> = {
  timing: { ivoBTDC: 15, ivcABDC: 35, evoBBDC: 45, evcATDC: 15 },
  timingStatus: 'aproximado',
  maxLiftIntake: 0.014,
  maxLiftExhaust: 0.0135,
};

export const lbft = (v: number) => Math.round(v * 1.35582);
export const hp = (v: number) => Math.round(v * 0.7457);

/** Fuentes secundarias sobre los colores de pintura de fábrica por marca (no son del fabricante). */
export const SRC_PAINT_SLASHGEAR: Source = {
  id: 'paint-slashgear',
  title: 'SlashGear — How The Color Of Your Diesel Engine Can Help Tell You Who Made It',
  url: 'https://www.slashgear.com/1984705/how-diesel-engine-color-reveals-who-made-it/',
  accessed: '2026-10-28',
};

export const SRC_PAINT_TPI: Source = {
  id: 'paint-tpi',
  title: 'Truck Parts Inventory — The Colors of Diesel',
  url: 'https://insider.truckpartsinventory.com/the-colors-of-diesel/',
  accessed: '2026-10-28',
};
