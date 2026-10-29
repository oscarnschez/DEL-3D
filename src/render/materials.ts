import * as THREE from 'three';
import type { FinishId } from './textures/procedural';
import { finishTextures } from './textures/library';
import { SHARED } from './resources';

/**
 * Biblioteca de materiales PBR por acabado industrial. Una instancia por acabado; las piezas
 * clonan el material una sola vez (ver <Part>) para resaltar/atenuar individualmente.
 *
 * Mapas: cada acabado usa un juego procedural (normal + ORM [oclusión, rugosidad, metalicidad]
 * y, en el escape, color base con pátina térmica) aplicado con proyección TRIPLANAR en
 * coordenadas de objeto. Así la escala del grano (mm por rasgo) es la misma en piezas torneadas,
 * extruidas o tubulares, cuyas coordenadas UV no son comparables entre sí.
 *
 * La oclusión ambiental a gran escala (entre piezas) la aporta el postprocesado N8AO en los
 * perfiles ALTO y ULTRA; el canal R del ORM sólo representa microcavidades del acabado.
 */

/** Uniform global: activa el sombreado de sección (caras interiores rayadas) cuando hay un corte activo. */
export const sectionUniform = { value: 0 };
export const sectionColor = { value: new THREE.Color('#9c3b30') };

interface PatchSpec {
  /** Repeticiones de la textura por metro (proyección triplanar). Sin valor: sin mapas. */
  tri?: number;
  /** Rayado de sección en caras traseras (cortes). */
  section?: boolean;
}

const patchOf = new WeakMap<THREE.Material, PatchSpec>();

function triChunks(): { header: string; map: string; rough: string; metal: string; ao: string; normal: string } {
  const C = THREE.ShaderChunk;
  return {
    header: /* glsl */ `
uniform float uTriScale;
varying vec3 vTriPos;
varying vec3 vTriN;
varying vec3 vTriM0;
varying vec3 vTriM1;
varying vec3 vTriM2;
vec3 triW() {
  vec3 n = abs(normalize(vTriN));
  n = n * n * n * n;
  return n / (n.x + n.y + n.z);
}
vec4 triSample(sampler2D t, vec3 w) {
  return texture2D(t, vTriPos.zy * uTriScale) * w.x + texture2D(t, vTriPos.xz * uTriScale) * w.y + texture2D(t, vTriPos.xy * uTriScale) * w.z;
}
`,
    map: C.map_fragment.replace('texture2D( map, vMapUv )', 'triSample( map, triW() )'),
    rough: C.roughnessmap_fragment.replace('texture2D( roughnessMap, vRoughnessMapUv )', 'triSample( roughnessMap, triW() )'),
    metal: C.metalnessmap_fragment.replace('texture2D( metalnessMap, vMetalnessMapUv )', 'triSample( metalnessMap, triW() )'),
    ao: C.aomap_fragment.replace('texture2D( aoMap, vAoMapUv )', 'triSample( aoMap, triW() )'),
    normal: /* glsl */ `
#ifdef USE_NORMALMAP
{
  vec3 nO = normalize(vTriN);
  vec3 w = triW();
  vec3 tx = texture2D(normalMap, vTriPos.zy * uTriScale).xyz * 2.0 - 1.0;
  vec3 ty = texture2D(normalMap, vTriPos.xz * uTriScale).xyz * 2.0 - 1.0;
  vec3 tz = texture2D(normalMap, vTriPos.xy * uTriScale).xyz * 2.0 - 1.0;
  tx.xy *= normalScale; ty.xy *= normalScale; tz.xy *= normalScale;
  // mezcla «whiteout»: cada plano perturba la normal de objeto en sus dos ejes
  vec3 nX = vec3(tx.xy + nO.zy, abs(tx.z) * nO.x);
  vec3 nY = vec3(ty.xy + nO.xz, abs(ty.z) * nO.y);
  vec3 nZ = vec3(tz.xy + nO.xy, abs(tz.z) * nO.z);
  vec3 nP = normalize(nX.zyx * w.x + nY.xzy * w.y + nZ * w.z);
  mat3 triM = mat3(vTriM0, vTriM1, vTriM2);
  normal = normalize(normal + faceDirection * (triM * (nP - nO)));
}
#endif
`,
  };
}

let TRI: ReturnType<typeof triChunks> | null = null;

/**
 * Instala (o reinstala tras un `clone()`, que no copia `onBeforeCompile`) los parches de shader
 * del material. La clave de programa depende sólo de qué parches lleva, de modo que todas las
 * piezas con el mismo acabado comparten programa.
 */
export function installPatches(m: THREE.Material, spec: PatchSpec): void {
  patchOf.set(m, spec);
  const tri = spec.tri !== undefined;
  const section = !!spec.section;
  if (section) m.side = THREE.DoubleSide;
  if (!tri && !section) return;
  const triScale = { value: spec.tri ?? 1 };
  m.onBeforeCompile = (shader) => {
    if (tri) {
      TRI ??= triChunks();
      shader.uniforms.uTriScale = triScale;
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', 'varying vec3 vTriPos;\nvarying vec3 vTriN;\nvarying vec3 vTriM0;\nvarying vec3 vTriM1;\nvarying vec3 vTriM2;\nvoid main() {')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vTriPos = transformed;
          vTriN = objectNormal;
          mat3 triM = normalMatrix;
          #ifdef USE_INSTANCING
            triM = normalMatrix * mat3(instanceMatrix);
          #endif
          vTriM0 = triM[0]; vTriM1 = triM[1]; vTriM2 = triM[2];`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', `${TRI.header}\nvoid main() {`)
        .replace('#include <map_fragment>', TRI.map)
        .replace('#include <roughnessmap_fragment>', TRI.rough)
        .replace('#include <metalnessmap_fragment>', TRI.metal)
        .replace('#include <aomap_fragment>', TRI.ao)
        .replace('#include <normal_fragment_maps>', TRI.normal);
    }
    if (section) {
      shader.uniforms.uSection = sectionUniform;
      shader.uniforms.uSectionColor = sectionColor;
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'uniform float uSection;\nuniform vec3 uSectionColor;\nvoid main() {')
        .replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>
          if (uSection > 0.5 && !gl_FrontFacing) {
            float h = step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y) / 9.0));
            gl_FragColor = vec4(mix(uSectionColor * 0.55, uSectionColor, h), gl_FragColor.a);
          }`,
        );
    }
  };
  const key = `tri${tri ? 1 : 0}-sec${section ? 1 : 0}`;
  m.customProgramCacheKey = () => key;
}

/** Parches del material base (para reinstalarlos en sus clones). */
export function patchesOf(m: THREE.Material): PatchSpec {
  return patchOf.get(m) ?? {};
}

/**
 * Prepara un material clonado para la vista de sección: con un corte activo, las caras
 * interiores se pintan con rayado de sección, imitando el relleno de corte de un CAD.
 * `hollow`: la pieza se modela como volumen sin cavidades (bloque sin cilindros, culata sin
 * cámaras), así que el corte la deja abierta en lugar de rellenarla y tapar el interior.
 */
export function patchSection(clone: THREE.Material, base: THREE.Material, hollow = false): void {
  installPatches(clone, { ...patchesOf(base), section: !hollow });
}

type Std = THREE.MeshStandardMaterialParameters;
type Phys = THREE.MeshPhysicalMaterialParameters;

interface FinishOpts {
  finish?: FinishId;
  /** Repeticiones por metro. */
  scale?: number;
  normalScale?: number;
  /** Usar el mapa de color del acabado (sólo `patina`). */
  colorMap?: boolean;
}

let cached: { lib: ReturnType<typeof build>; detail: boolean } | null = null;

function build(detail: boolean) {
  const make = <T extends THREE.MeshStandardMaterial>(m: T, o: FinishOpts): T => {
    if (detail && o.finish) {
      const T = finishTextures(o.finish);
      m.normalMap = T.normal;
      m.normalScale = new THREE.Vector2(o.normalScale ?? 1, o.normalScale ?? 1);
      m.roughnessMap = T.orm;
      m.metalnessMap = T.orm;
      m.aoMap = T.orm;
      m.aoMapIntensity = 1;
      if (o.colorMap) m.map = T.color;
      installPatches(m, { tri: o.scale ?? 6 });
    } else installPatches(m, {});
    SHARED.add(m);
    return m;
  };
  const std = (p: Std, o: FinishOpts = {}) => make(new THREE.MeshStandardMaterial(p), o);
  const phys = (p: Phys, o: FinishOpts = {}) => make(new THREE.MeshPhysicalMaterial(p), o);

  return {
    /** Hierro fundido pintado (bloque, culata, carcasas). Pintura = dieléctrico con laca satinada; el color se asigna por motor. */
    paintedIron: phys({ color: '#5b636c', metalness: 0, roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.45 }, { finish: 'paint', scale: 5, normalScale: 0.8 }),
    /** Hierro fundido sin pintar (camisas, tapas de bancada, carcasa central del turbo). */
    rawIron: std({ color: '#5d6064', metalness: 0.75, roughness: 0.72 }, { finish: 'cast', scale: 6, normalScale: 1 }),
    /** Aluminio fundido (múltiple de admisión, carcasas de bomba, compresor, tapas de levas). */
    aluminumCast: std({ color: '#adb2b7', metalness: 0.92, roughness: 0.5 }, { finish: 'aluminum', scale: 7, normalScale: 0.9 }),
    /** Aleación del pistón: zonas mecanizadas. */
    pistonAlloy: std({ color: '#b9bec3', metalness: 0.9, roughness: 0.36 }, { finish: 'machined', scale: 22, normalScale: 0.6 }),
    /** Acero forjado (bielas, brazos del cigüeñal). */
    forgedSteel: std({ color: '#6c7278', metalness: 0.9, roughness: 0.5 }, { finish: 'forged', scale: 9, normalScale: 0.9 }),
    /** Acero mecanizado/rectificado (muñones, ejes, rodillos). */
    machinedSteel: phys({ color: '#c8cdd2', metalness: 1, roughness: 0.22 }, { finish: 'machined', scale: 28, normalScale: 0.5 }),
    /** Acero mecanizado con película de aceite lubricante (árbol de levas, muñones bañados). */
    oiledSteel: phys({ color: '#bfc4c8', metalness: 1, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.08 }, { finish: 'machined', scale: 28, normalScale: 0.5 }),
    /** Acero templado oscuro (engranes, resortes, anillos). */
    darkSteel: std({ color: '#2f3337', metalness: 0.85, roughness: 0.42 }, { finish: 'forged', scale: 14, normalScale: 0.6 }),
    /** Válvulas: vástago con cromado duro (acabado típico). */
    valveSteel: std({ color: '#d4d7da', metalness: 1, roughness: 0.1 }),
    /** Bronce (casquillos de pie de biela y de balancín). */
    bronze: std({ color: '#a37a44', metalness: 1, roughness: 0.32 }, { finish: 'machined', scale: 30, normalScale: 0.4 }),
    /** Cobre (camisas de inyector). */
    copper: std({ color: '#b5703c', metalness: 1, roughness: 0.3 }, { finish: 'machined', scale: 30, normalScale: 0.4 }),
    /** Chapa estampada pintada de negro (cárter, amortiguador). */
    blackPaint: phys({ color: '#1b1e22', metalness: 0, roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.5 }, { finish: 'paint', scale: 6, normalScale: 0.6 }),
    /** Tapa de balancines: pintura con laca más brillante; el color se asigna por motor. */
    coverPaint: phys({ color: '#2b3036', metalness: 0, roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.22 }, { finish: 'paint', scale: 5, normalScale: 0.5 }),
    /** Acero inoxidable (tubos de EGR, bajante, protectores térmicos). */
    heatShield: std({ color: '#a7abaf', metalness: 1, roughness: 0.34 }, { finish: 'sheet', scale: 18, normalScale: 0.7 }),
    /** Acero inoxidable cepillado (envolvente del postratamiento, enfriador de EGR). */
    stainless: std({ color: '#b6babe', metalness: 1, roughness: 0.27 }, { finish: 'sheet', scale: 14, normalScale: 0.6 }),
    /** Hierro de escape con pátina térmica moderada (óxido pardo). */
    exhaustIron: std({ color: '#ffffff', metalness: 0.4, roughness: 0.86 }, { finish: 'patina', scale: 6, normalScale: 1.1, colorMap: true }),
    rubber: std({ color: '#121315', metalness: 0, roughness: 0.86 }, { finish: 'rubber', scale: 30, normalScale: 0.6 }),
    /** Manguera de caucho (EPDM/silicona) negra. */
    hose: std({ color: '#17191c', metalness: 0, roughness: 0.72 }, { finish: 'rubber', scale: 24, normalScale: 0.7 }),
    /** Juntas (fibra/acero multicapa vistas de canto). */
    gasket: std({ color: '#3a3733', metalness: 0.3, roughness: 0.82 }, { finish: 'cast', scale: 40, normalScale: 0.5 }),
    /** Plástico técnico (poliamida negra: actuadores, conectores). */
    plastic: std({ color: '#1d2023', metalness: 0, roughness: 0.55 }, { finish: 'rubber', scale: 40, normalScale: 0.3 }),
    /** Tornillería (instanciada: sin mapas de detalle). */
    bolt: std({ color: '#3a3e43', metalness: 0.95, roughness: 0.34 }),
    /** Piezas zincadas (tapones, poleas). */
    zinc: std({ color: '#a2aab0', metalness: 1, roughness: 0.38 }, { finish: 'forged', scale: 16, normalScale: 0.4 }),
    /** Núcleo del intercooler: aletas de aluminio (líneas densas). */
    intercoolerCore: std({ color: '#8b9197', metalness: 0.9, roughness: 0.55 }, { finish: 'sheet', scale: 60, normalScale: 2.2 }),
    filterBlue: phys({ color: '#1e4fa0', metalness: 0, roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.2 }, { finish: 'paint', scale: 8, normalScale: 0.3 }),
    filterOrange: phys({ color: '#c06a18', metalness: 0, roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.2 }, { finish: 'paint', scale: 8, normalScale: 0.3 }),
    glassCoolant: phys({ color: '#2f7bff', transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0, transmission: 0 }),
  };
}

export type MaterialLib = ReturnType<typeof build>;
export type MaterialKey = keyof MaterialLib;

/** Material de cada acabado (para la ficha de la pieza y la documentación). */
export const FINISH_LABEL: Partial<Record<MaterialKey, string>> = {
  paintedIron: 'Hierro fundido pintado',
  rawIron: 'Hierro fundido',
  aluminumCast: 'Aluminio fundido',
  pistonAlloy: 'Aleación de pistón mecanizada',
  forgedSteel: 'Acero forjado',
  machinedSteel: 'Acero rectificado',
  oiledSteel: 'Acero rectificado con película de aceite',
  darkSteel: 'Acero templado',
  valveSteel: 'Acero cromado',
  bronze: 'Bronce',
  copper: 'Cobre',
  blackPaint: 'Chapa pintada',
  coverPaint: 'Pintura con laca',
  heatShield: 'Acero inoxidable',
  stainless: 'Acero inoxidable cepillado',
  exhaustIron: 'Hierro de escape con pátina térmica',
  rubber: 'Caucho',
  hose: 'Manguera de caucho',
  gasket: 'Junta',
  plastic: 'Plástico técnico',
  bolt: 'Acero tratado',
  zinc: 'Acero zincado',
  intercoolerCore: 'Aletas de aluminio',
};

/**
 * Biblioteca para el nivel de detalle pedido. Cambiar `detail` (perfil RENDIMIENTO ↔ resto)
 * crea materiales nuevos: el motor se vuelve a montar con ellos.
 */
export function getMaterials(detail = currentDetail): MaterialLib {
  if (!cached || cached.detail !== detail) cached = { lib: build(detail), detail };
  return cached.lib;
}

let currentDetail = true;
export function setMaterialDetail(detail: boolean): void {
  currentDetail = detail;
}

/** Clona un material de la biblioteca conservando sus parches de shader (`clone()` no copia `onBeforeCompile`). */
export function cloneMaterial<T extends THREE.Material>(base: T): T {
  const c = base.clone() as T;
  installPatches(c, patchesOf(base));
  return c;
}
