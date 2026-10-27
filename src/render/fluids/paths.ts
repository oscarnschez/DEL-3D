import * as THREE from 'three';
import type { EngineLayout } from '@/engines/derive';
import type { FlowSystem } from '@/state/store';
import { auxLayout } from '../engine/Systems';

/** Trayectoria de un fluido: puntos, rampa de color (por recorrido) y velocidad relativa. */
export interface FlowPath {
  id: string;
  points: THREE.Vector3[];
  colors: string[];
  speed: number;
  /** Etiqueta del tramo (para la leyenda / recorridos). */
  label?: string;
  /** Si el flujo es pulsante con los eventos de inyección (combustible). */
  pulsed?: boolean;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/**
 * Recorridos educativos de cada sistema, construidos a partir del layout del motor.
 * No son simulaciones CFD: representan el orden y la dirección del flujo.
 */
export function flowPaths(L: EngineLayout, system: FlowSystem): FlowPath[] {
  const A = auxLayout(L);
  const d = A.d;
  const mainsX = Array.from({ length: L.n + 1 }, (_, k) => L.cylX[0] - L.pitch / 2 + k * L.pitch);
  switch (system) {
    case 'lubricacion': {
      const amber = ['#ffcf4a', '#ffb000', '#e08a00'];
      const galZ = -(d.crankHalf - 0.025);
      const galY = 0.05;
      const sump = V(L.blockLength * 0.22, L.sumpBottomY + 0.03, 0);
      const out: FlowPath[] = [
        {
          id: 'succion',
          label: 'Cárter → bomba → filtro',
          points: [sump, V(A.oilPump.x + 0.05, L.sumpBottomY + 0.06, 0), A.oilPump.clone(), V(A.oilPump.x, galY - 0.04, galZ), V(A.oilFilter.x + 0.05, A.oilFilter.y + 0.02, A.oilFilter.z + 0.04), V(A.oilFilter.x, A.oilFilter.y - 0.1, A.oilFilter.z)],
          colors: amber,
          speed: 1,
        },
        {
          id: 'galeria',
          label: 'Galería principal',
          points: [V(A.oilFilter.x, A.oilFilter.y - 0.1, A.oilFilter.z), V(A.oilFilter.x - 0.12, galY, galZ), V(L.front + 0.04, galY, galZ), V(L.front + 0.02, galY, galZ), ...mainsX.map((x) => V(x, galY, galZ)), V(L.rear - 0.02, galY, galZ)],
          colors: amber,
          speed: 1,
        },
      ];
      mainsX.forEach((x, k) =>
        out.push({ id: `bancada${k}`, label: 'Cojinetes de bancada', points: [V(x, galY, galZ), V(x, 0.03, -0.05), V(x, -L.mainJournalRadius - 0.004, -0.01), V(x, -L.mainJournalRadius * 0.6, L.mainJournalRadius * 0.9)], colors: amber, speed: 0.8 }),
      );
      L.cylX.forEach((x, i) => {
        out.push({
          id: `chorro${i}`,
          label: 'Enfriamiento de pistones',
          points: [V(x - 0.02, galY, galZ), V(x - 0.01, 0.1, -0.05), V(x, L.l - L.r + 0.04, -0.02)],
          colors: amber,
          speed: 1.4,
        });
        // muñón → muñequilla por los taladros del cigüeñal
        out.push({ id: `munequilla${i}`, label: 'Lubricación de muñequillas', points: [V(x - L.pitch / 2, 0, 0), V(x - 0.02, L.r * 0.5, 0), V(x, L.r, 0)], colors: amber, speed: 0.6 });
      });
      out.push(
        {
          id: 'culata',
          label: 'Subida a culata: árboles de levas y balancines',
          points: [V(L.front + 0.03, galY, galZ), V(L.front + 0.03, L.deckY - 0.02, -(d.deckHalf - 0.02)), V(L.front + 0.04, L.camY - 0.01, -L.rockerPivotZ), V(L.rear - 0.04, L.rockerPivotY, -L.rockerPivotZ)],
          colors: amber,
          speed: 1,
        },
        {
          id: 'culataEsc',
          label: 'Árbol de levas de escape',
          points: [V(L.front + 0.04, L.camY - 0.01, -L.rockerPivotZ), V(L.front + 0.05, L.camY - 0.01, 0), V(L.front + 0.06, L.rockerPivotY, L.rockerPivotZ), V(L.rear - 0.04, L.rockerPivotY, L.rockerPivotZ)],
          colors: amber,
          speed: 1,
        },
        {
          id: 'turbo',
          label: 'Alimentación del turbocompresor',
          points: [V(0, galY, galZ), V(0.02, L.crankcaseBottomY + 0.02, 0), V(A.turbo.x - 0.02, L.crankcaseBottomY + 0.05, d.crankHalf + 0.02), V(A.turbo.x, A.turbo.y + 0.08, A.turbo.z), V(A.turbo.x, A.turbo.y, A.turbo.z)],
          colors: amber,
          speed: 1.2,
        },
        {
          id: 'retornoTurbo',
          label: 'Retorno del turbo al cárter',
          points: [V(A.turbo.x, A.turbo.y - 0.05, A.turbo.z), V(A.turbo.x, L.crankcaseBottomY - 0.02, d.crankHalf + 0.03), V(A.turbo.x - 0.05, L.sumpBottomY + 0.04, 0.08)],
          colors: ['#e08a00', '#b06a00'],
          speed: 0.7,
        },
        {
          id: 'retornoCulata',
          label: 'Retorno por gravedad al cárter',
          points: [V(L.rear - 0.04, L.camY, 0), V(L.rear - 0.03, L.deckY - 0.1, d.deckHalf - 0.02), V(L.rear - 0.03, 0.0, d.crankHalf - 0.02), V(L.blockLength * 0.3, L.sumpBottomY + 0.04, 0.03)],
          colors: ['#e08a00', '#b06a00'],
          speed: 0.6,
        },
      );
      return out;
    }
    case 'refrigeracion': {
      const out: FlowPath[] = [];
      const jacketY = L.deckY - 0.08;
      const side = (s: number) => {
        const pts: THREE.Vector3[] = [V(L.front + 0.02, jacketY, s * (d.deckHalf - 0.01))];
        L.cylX.forEach((x) => {
          pts.push(V(x - L.pitch * 0.45, jacketY, s * (d.deckHalf - 0.012)));
          pts.push(V(x, jacketY + 0.01, s * (L.bore / 2 + 0.017)));
        });
        pts.push(V(L.rear - 0.03, jacketY, s * (d.deckHalf - 0.012)));
        return pts;
      };
      out.push(
        { id: 'bomba', label: 'Bomba de agua → bloque', points: [V(A.waterPump.x - 0.05, A.waterPump.y - 0.05, A.waterPump.z), A.waterPump.clone(), V(L.front + 0.02, jacketY, d.deckHalf - 0.01)], colors: ['#2f7bff', '#3a8bff'], speed: 1 },
        { id: 'camisaEsc', label: 'Camisas de agua (lado escape)', points: side(1), colors: ['#3a8bff', '#6c7bff', '#c05cff'], speed: 0.8 },
        { id: 'cruce', label: 'Paso al lado de admisión', points: [V(L.front + 0.02, jacketY, d.deckHalf - 0.01), V(L.front + 0.025, jacketY - 0.03, 0), V(L.front + 0.02, jacketY, -(d.deckHalf - 0.01))], colors: ['#3a8bff'], speed: 0.8 },
        { id: 'camisaAdm', label: 'Camisas de agua (lado admisión)', points: side(-1), colors: ['#3a8bff', '#6c7bff', '#c05cff'], speed: 0.8 },
      );
      L.cylX.forEach((x, i) =>
        [-1, 1].forEach((s) =>
          out.push({ id: `subida${i}${s}`, label: 'Paso bloque → culata', points: [V(x + L.pitch * 0.38, jacketY, s * (d.deckHalf - 0.02)), V(x + L.pitch * 0.38, L.deckY + 0.045, s * 0.06)], colors: ['#c05cff', '#ff4d6d'], speed: 0.6 }),
        ),
      );
      out.push(
        {
          id: 'culata',
          label: 'Culata → termostato',
          points: [V(L.rear - 0.05, L.deckY + 0.045, 0.06), ...L.cylX.slice().reverse().map((x) => V(x, L.deckY + 0.05, 0.02 * Math.sign(x || 1))), V(L.front + 0.02, L.deckY + 0.06, 0.04), V(A.thermostat.x, A.thermostat.y, A.thermostat.z)],
          colors: ['#ff4d6d', '#ff6a3d'],
          speed: 1,
        },
        {
          id: 'radiador',
          label: 'Termostato → radiador → bomba',
          points: [A.thermostat.clone(), V(A.thermostat.x - 0.2, A.thermostat.y + 0.03, A.thermostat.z), V(A.cooler.x + 0.1, A.thermostat.y + 0.02, 0.25), V(A.cooler.x + 0.04, 0.3, 0.1), V(A.cooler.x + 0.04, 0.1, -0.1), V(A.cooler.x + 0.12, 0.08, 0.25), V(A.waterPump.x - 0.2, A.waterPump.y - 0.15, A.waterPump.z), V(A.waterPump.x - 0.05, A.waterPump.y - 0.05, A.waterPump.z)],
          colors: ['#ff6a3d', '#7a6bff', '#2f7bff'],
          speed: 1.1,
        },
      );
      if (L.def.air.egr)
        out.push({
          id: 'egr',
          label: 'Enfriador EGR',
          points: [V(L.front + 0.05, jacketY + 0.05, d.deckHalf), V(A.egrCooler.x - 0.2, A.egrCooler.y - 0.05, A.egrCooler.z + 0.04), V(A.egrCooler.x + 0.2, A.egrCooler.y, A.egrCooler.z + 0.04), V(A.egrCooler.x + 0.25, L.deckY + 0.05, 0.06)],
          colors: ['#3a8bff', '#ff4d6d'],
          speed: 0.9,
        });
      out.push({
        id: 'aceite',
        label: 'Enfriador de aceite',
        points: [V(L.front + 0.04, jacketY - 0.05, -(d.deckHalf - 0.01)), V(A.oilFilter.x + 0.3, A.oilFilter.y + 0.06, -(d.crankHalf + 0.03)), V(A.oilFilter.x, A.oilFilter.y + 0.06, -(d.crankHalf + 0.03))],
        colors: ['#3a8bff', '#6c7bff'],
        speed: 0.7,
      });
      return out;
    }
    case 'combustible': {
      const yellow = ['#ffe27a', '#ffd23f'];
      const tank = V(L.rear + 0.25, -0.15, -(d.crankHalf + 0.4));
      const [f1, f2] = A.fuelFilters;
      const out: FlowPath[] = [
        { id: 'tanque', label: 'Tanque → bomba de transferencia → filtro primario', points: [tank, V(L.rear, -0.12, -(d.crankHalf + 0.25)), V(f1.x + 0.05, f1.y - 0.06, f1.z - 0.06), V(f1.x, f1.y + 0.02, f1.z)], colors: ['#c9a227', '#ffd23f'], speed: 0.7 },
        { id: 'filtros', label: 'Filtro primario → secundario', points: [V(f1.x, f1.y + 0.19, f1.z), V((f1.x + f2.x) / 2, f1.y + 0.21, f1.z + 0.01), V(f2.x, f2.y + 0.19, f2.z)], colors: yellow, speed: 0.7 },
        { id: 'bomba', label: 'Filtro → bomba de alta presión', points: [V(f2.x, f2.y + 0.19, f2.z), V(f2.x - 0.05, f2.y + 0.27, f2.z + 0.03), A.hpPump.clone()], colors: yellow, speed: 0.8 },
      ];
      if (L.def.injection.system === 'eui') {
        out.push({
          id: 'galeria',
          label: 'Galería de combustible en la culata (baja presión)',
          points: [A.hpPump.clone(), V(A.hpPump.x, L.deckY + 0.03, A.railZ), V(L.cylX[0], A.railY, A.railZ), V(L.cylX[L.n - 1], A.railY, A.railZ)],
          colors: yellow,
          speed: 0.9,
        });
      } else {
        out.push({
          id: 'alta',
          label: 'Bomba → riel común (alta presión)',
          points: [A.hpPump.clone().add(V(0.05, 0.03, 0)), V(A.hpPump.x + 0.12, A.railY - 0.04, A.railZ - 0.02), V(L.cylX[0] - 0.05, A.railY, A.railZ), V(L.cylX[L.n - 1] + 0.04, A.railY, A.railZ)],
          colors: ['#ffd23f', '#ff9f1a'],
          speed: 1.4,
        });
      }
      L.cylX.forEach((x, i) =>
        out.push({ id: `iny${i}`, label: 'Inyector', points: [V(x, A.railY, A.railZ), V(x, A.railY, -0.01), V(x, L.deckY + 0.01, 0), V(x, L.deckY - 0.004, 0)], colors: ['#ff9f1a', '#ffe27a'], speed: 0.7, pulsed: true }),
      );
      out.push({ id: 'retorno', label: 'Retorno al tanque', points: [V(L.cylX[L.n - 1] + 0.05, A.railY, A.railZ), V(L.rear + 0.05, A.railY - 0.1, A.railZ - 0.05), V(L.rear + 0.2, -0.05, -(d.crankHalf + 0.35)), tank], colors: ['#c9a227', '#8a6d10'], speed: 0.5 });
      return out;
    }
    case 'aire': {
      const T = A.turbo;
      const C = A.cooler;
      const out: FlowPath[] = [
        { id: 'entrada', label: 'Filtro de aire → compresor', points: [V(T.x - 0.45, T.y + 0.12, T.z + 0.1), V(T.x - 0.3, T.y, T.z + 0.02), V(T.x - 0.12, T.y, T.z), V(T.x - 0.06, T.y + 0.075, T.z)], colors: ['#7fc8ff', '#3fa9ff'], speed: 1.2 },
        {
          id: 'carga',
          label: 'Compresor → intercooler → múltiple',
          points: [V(T.x - 0.1, T.y + 0.05, T.z + 0.02), V(T.x - 0.25, T.y + 0.18, T.z + 0.02), V(L.front - 0.15, T.y + 0.22, 0.25), V(C.x + 0.06, C.y + 0.18, 0.3), V(C.x + 0.04, C.y + 0.1, 0.0), V(C.x + 0.06, C.y + 0.18, -0.3), V(L.front - 0.15, A.plenumY + 0.04, -0.3), V(L.front - 0.02, A.plenumY, A.plenumZ), V(L.cylX[L.n - 1], A.plenumY, A.plenumZ)],
          colors: ['#ff9f43', '#ff7a1a', '#36e0c8', '#3fa9ff'],
          speed: 1.3,
        },
      ];
      L.cylX.forEach((x, i) =>
        out.push({ id: `adm${i}`, label: 'Admisión a cilindro', points: [V(x, A.plenumY, A.plenumZ), V(x, A.portY, -d.headHalf), V(x, L.deckY + 0.01, -L.valveZ), V(x, L.deckY - 0.03, -L.valveZ * 0.6)], colors: ['#3fa9ff', '#36e0c8'], speed: 1.0 }),
      );
      L.cylX.forEach((x, i) =>
        out.push({ id: `esc${i}`, label: 'Escape del cilindro', points: [V(x, L.deckY - 0.02, L.valveZ * 0.6), V(x, L.deckY + 0.01, L.valveZ), V(x, A.portY, d.headHalf + 0.012), V(x + 0.03, A.exCollY, A.exCollZ)], colors: ['#ff4d2a', '#ff7a1a'], speed: 1.0 }),
      );
      out.push(
        { id: 'colector', label: 'Colector → turbina', points: [V(L.cylX[0], A.exCollY, A.exCollZ), V(L.cylX[3] + 0.03, A.exCollY, A.exCollZ), V(T.x + 0.06, A.exCollY - 0.02, A.exCollZ + 0.06), V(T.x + 0.085, T.y + 0.02, T.z - 0.07), V(T.x + 0.07, T.y, T.z)], colors: ['#ff4d2a', '#ff7a1a'], speed: 1.2 },
        { id: 'colector2', label: 'Colector (cilindros 4–6)', points: [V(L.cylX[L.n - 1] + 0.03, A.exCollY, A.exCollZ), V(L.cylX[3] + 0.03, A.exCollY, A.exCollZ)], colors: ['#ff4d2a'], speed: 1.2 },
        { id: 'post', label: 'Turbina → postratamiento → escape', points: [V(T.x + 0.12, T.y, T.z), V(T.x + 0.22, T.y - 0.05, T.z + 0.1), A.after.clone().add(V(-0.47, 0, 0)), A.after.clone(), A.after.clone().add(V(0.5, 0, 0)), A.after.clone().add(V(0.7, 0.1, 0.05))], colors: ['#ff7a1a', '#c97b5a', '#9aa3ad'], speed: 1.0 },
      );
      if (L.def.air.egr)
        out.push({
          id: 'egr',
          label: 'Recirculación EGR (enfriada)',
          points: [V(L.cylX[0] + 0.03, A.exCollY, A.exCollZ), V(A.egrCooler.x - 0.21, A.egrCooler.y, A.egrCooler.z), V(A.egrCooler.x + 0.21, A.egrCooler.y, A.egrCooler.z), V(A.egrCooler.x + 0.26, A.egrCooler.y + 0.08, 0), V(L.front + 0.12, A.egrCooler.y + 0.09, A.plenumZ), V(L.front + 0.12, A.plenumY, A.plenumZ)],
          colors: ['#ff4d2a', '#a78bfa', '#7fc8ff'],
          speed: 0.6,
        });
      return out;
    }
  }
}
