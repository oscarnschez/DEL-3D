import * as THREE from 'three';

/**
 * Materiales de efectos (combustión y fluidos). Se definen aquí para que el precalentamiento de
 * shaders (ver `warmup.ts`) compile exactamente las mismas variantes que usan los componentes.
 */

/** Columna de gas por cilindro, coloreada por temperatura. */
export const gasColumnMaterial = () =>
  new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });

/** Chorros de combustible (instanciados, sin color por instancia). */
export const sprayMaterial = () =>
  new THREE.MeshBasicMaterial({ color: '#ffe27a', transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });

/** Partículas de gas en la cámara (instanciadas, color por instancia). */
export const chamberParticleMaterial = () => new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.9, depthWrite: false });

/** Frente de llama. */
export const flameMaterial = () =>
  new THREE.MeshBasicMaterial({ color: '#ff7a1a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });

/** Conducto traslúcido de un circuito de fluido. */
export const flowTubeMaterial = (color: THREE.ColorRepresentation) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, depthWrite: false, toneMapped: false });

/** Partículas de fluido (instanciadas, color por instancia). */
export const flowParticleMaterial = () => new THREE.MeshBasicMaterial({ toneMapped: false });
