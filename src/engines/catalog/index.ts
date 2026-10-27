import type { EngineDefinition } from '../schema';
import { referenceI6 } from './reference-i6';
import { cumminsX15 } from './cummins-x15';
import { detroitDD15 } from './detroit-dd15';
import { volvoD13 } from './volvo-d13';
import { mackMP8 } from './mack-mp8';
import { catC15 } from './cat-c15';
import { paccarMX13 } from './paccar-mx13';

/** Registro de motores. Para agregar un motor: crear su archivo de definición y añadirlo aquí. */
export const ENGINES: EngineDefinition[] = [cumminsX15, detroitDD15, volvoD13, mackMP8, catC15, paccarMX13, referenceI6];

export function getEngine(id: string): EngineDefinition {
  return ENGINES.find((e) => e.id === id) ?? ENGINES[0];
}
