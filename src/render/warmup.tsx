import { useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { create } from 'zustand';

/** Último precalentamiento terminado (la interfaz lo usa como indicador de «escena lista»). */
export const useWarmup = create<{ done: string | null }>(() => ({ done: null }));
import { chamberParticleMaterial, flameMaterial, flowParticleMaterial, flowTubeMaterial, gasColumnMaterial, sprayMaterial } from './fxMaterials';

/**
 * Precompila las variantes de shader que la app usará más adelante, para que el primer cambio
 * de modo no congele la interfaz.
 *
 * Three.js compila un programa nuevo cuando cambia algo que forma parte de su clave: aquí,
 * `transparent` (al usar transparencia, rayos X, atenuar o aislar piezas) y los materiales de
 * efectos (combustión y fluidos), que sólo se montan en ciertos modos. Compilar ~20 programas
 * PBR de golpe tarda varios segundos en GPUs reales (sobre todo con ANGLE/D3D en Windows).
 *
 * Con `KHR_parallel_shader_compile`, `compileAsync` no bloquea el hilo principal.
 */
export function warmupShaders(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, postFx = false): Promise<unknown> {
  // 1) Variante transparente de cada material de pieza (los de <Part> llevan `partData`).
  const flipped: THREE.Material[] = [];
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (m.userData.partData && !m.transparent) {
        m.transparent = true;
        m.needsUpdate = true;
        flipped.push(m);
      }
    }
  });

  // 2) Materiales de efectos, sobre mallas temporales con los mismos atributos (instanciado, color por instancia).
  const fx = new THREE.Group();
  const geo = new THREE.BoxGeometry(1e-3, 1e-3, 1e-3);
  const instanced = (mat: THREE.Material, colored: boolean) => {
    const im = new THREE.InstancedMesh(geo, mat, 1);
    if (colored) im.setColorAt(0, new THREE.Color());
    return im;
  };
  fx.add(
    new THREE.Mesh(geo, gasColumnMaterial()),
    new THREE.Mesh(geo, flameMaterial()),
    new THREE.Mesh(geo, flowTubeMaterial('#ffffff')),
    instanced(sprayMaterial(), false),
    instanced(chamberParticleMaterial(), true),
    instanced(flowParticleMaterial(), true),
  );
  scene.add(fx);

  // 3) Objetos ocultos que se mostrarán sin recompilar (p. ej. la rejilla del laboratorio).
  const hidden: THREE.Object3D[] = [];
  scene.traverse((o) => {
    if (o.userData.warm && !o.visible) {
      o.visible = true;
      hidden.push(o);
    }
  });

  // Con postprocesado la escena se dibuja en un render target (sin tone mapping y en espacio
  // lineal): la clave de programa cambia, así que se compila contra un target equivalente.
  const prevTarget = gl.getRenderTarget();
  const rt = postFx ? new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType }) : null;
  if (rt) gl.setRenderTarget(rt);
  const done = gl.compileAsync(scene, camera);
  if (rt) gl.setRenderTarget(prevTarget);
  for (const o of hidden) o.visible = false;

  // La compilación ya se lanzó (síncrona); se restaura el estado antes del siguiente frame.
  scene.remove(fx);
  for (const m of flipped) {
    m.transparent = false;
    m.needsUpdate = true;
  }
  // Los materiales temporales no se liberan: `dispose()` borraría también los programas compilados.
  return done.finally(() => {
    geo.dispose();
    rt?.dispose();
  });
}

/**
 * Lanza el precalentamiento cuando la escena está lista (materiales de pieza clonados y
 * entorno generado). `token` vuelve a lanzarlo, p. ej. al cambiar de motor.
 */
export function ShaderWarmup({ token, postFx = false }: { token: string; postFx?: boolean }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    let cancelled = false;
    let frames = 0;
    let raf = 0;
    const tick = () => {
      if (cancelled) return;
      // <Part> clona sus materiales en un efecto y un rAF; el entorno tarda unos frames.
      if (++frames < 3 || !scene.environment) {
        raf = requestAnimationFrame(tick);
        return;
      }
      void warmupShaders(gl, scene, camera, postFx).then(() => useWarmup.setState({ done: token }));
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [gl, scene, camera, token, postFx]);
  return null;
}
