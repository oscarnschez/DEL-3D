import { useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
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
export function warmupShaders(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): Promise<unknown> {
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

  const done = gl.compileAsync(scene, camera);

  // La compilación ya se lanzó (síncrona); se restaura el estado antes del siguiente frame.
  scene.remove(fx);
  for (const m of flipped) {
    m.transparent = false;
    m.needsUpdate = true;
  }
  // Los materiales temporales no se liberan: `dispose()` borraría también los programas compilados.
  return done.finally(() => geo.dispose());
}

/**
 * Lanza el precalentamiento cuando la escena está lista (materiales de pieza clonados y
 * entorno generado). `token` vuelve a lanzarlo, p. ej. al cambiar de motor.
 */
export function ShaderWarmup({ token }: { token: string }) {
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
      void warmupShaders(gl, scene, camera);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [gl, scene, camera, token]);
  return null;
}
