import { wrapDeg } from './crank';

/** Reglaje de válvulas en grados de cigüeñal, con la convención usual de catálogo. */
export interface ValveTiming {
  /** Apertura de admisión, grados antes del PMS de cruce. */
  ivoBTDC: number;
  /** Cierre de admisión, grados después del PMI. */
  ivcABDC: number;
  /** Apertura de escape, grados antes del PMI. */
  evoBBDC: number;
  /** Cierre de escape, grados después del PMS de cruce. */
  evcATDC: number;
}

export interface ValveEvent {
  open: number; // φ local de apertura (grados, puede ser <0 o >720 antes de normalizar)
  duration: number; // grados de cigüeñal
  maxLift: number; // m
}

/** Convierte el reglaje en eventos en el ángulo local φ (0 = PMS de encendido, 360 = PMS de cruce). */
export function valveEvents(t: ValveTiming, maxLiftIntake: number, maxLiftExhaust: number) {
  const intake: ValveEvent = {
    open: 360 - t.ivoBTDC,
    duration: t.ivoBTDC + 180 + t.ivcABDC,
    maxLift: maxLiftIntake,
  };
  const exhaust: ValveEvent = {
    open: 180 - t.evoBBDC,
    duration: t.evoBBDC + 180 + t.evcATDC,
    maxLift: maxLiftExhaust,
  };
  return { intake, exhaust };
}

/**
 * Ley de alzada suave (sin² con rampas de velocidad nula en apertura y cierre).
 * Devuelve la alzada de válvula (m) para el ángulo local φ.
 */
export function valveLift(phi: number, ev: ValveEvent): number {
  const t = wrapDeg(phi - ev.open, 720) / ev.duration;
  if (t <= 0 || t >= 1) return 0;
  const s = Math.sin(Math.PI * t);
  return ev.maxLift * s * s;
}

/** Fracción normalizada de alzada (0–1). */
export function valveLiftFraction(phi: number, ev: ValveEvent): number {
  return ev.maxLift > 0 ? valveLift(phi, ev) / ev.maxLift : 0;
}

export interface InjectionEvent {
  /** Inicio de inyección principal, grados antes del PMS de encendido. */
  soiBTDC: number;
  /** Duración de la inyección principal (grados de cigüeñal). */
  duration: number;
  /** Pre-inyección piloto: grados antes del inicio principal (0 = sin piloto). */
  pilotAdvance: number;
}

/** Intensidad de inyección 0–1 en el ángulo local φ. */
export function injectionIntensity(phi: number, inj: InjectionEvent, load = 1): number {
  const p = wrapDeg(phi + 360, 720) - 360; // −360…360 alrededor del PMS de encendido
  const start = -inj.soiBTDC;
  const dur = inj.duration * (0.45 + 0.55 * load);
  let v = 0;
  if (p >= start && p <= start + dur) {
    const t = (p - start) / dur;
    v = Math.min(1, t * 6) * Math.min(1, (1 - t) * 6);
  }
  if (inj.pilotAdvance > 0) {
    const ps = start - inj.pilotAdvance;
    if (p >= ps && p <= ps + 3) v = Math.max(v, 0.45);
  }
  return v;
}

/**
 * Intensidad de combustión (0–1): retraso de autoignición tras el inicio de inyección,
 * pico de liberación de calor y difusión que decae durante la expansión.
 */
export function combustionIntensity(phi: number, inj: InjectionEvent, load = 1): number {
  const p = wrapDeg(phi + 360, 720) - 360;
  const ignition = -inj.soiBTDC + 5; // retraso de encendido ~5° (valor educativo)
  if (p < ignition || p > 110) return 0;
  const t = p - ignition;
  const rise = Math.min(1, t / 8);
  const decay = Math.exp(-t / (28 + 20 * load));
  return Math.min(1, rise * decay * (0.6 + 0.4 * load) * 1.25);
}
