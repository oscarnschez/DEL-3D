import * as THREE from 'three';

/**
 * Materiales de efectos (combustión y fluidos). Se definen aquí para que el precalentamiento de
 * shaders (ver `warmup.ts`) compile exactamente las mismas variantes que usan los componentes.
 */

/** Columna de gas por cilindro, coloreada por temperatura. */
export const gasColumnMaterial = () =>
  new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });

/** Partículas de gas en la cámara (instanciadas, color por instancia). */
export const chamberParticleMaterial = () => new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.9, depthWrite: false });

const NOISE_GLSL = /* glsl */ `
  float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float n3(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm3(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * n3(p); p *= 2.03; a *= 0.5; } return s; }
`;

/**
 * Llama volumétrica (raymarching en un elipsoide unidad). Uniformes:
 *  uTime  — base temporal = revoluciones del cigüeñal (sincronizada con la cinemática)
 *  uBurn  — fracción quemada (0–1), uHeat — intensidad de liberación de calor (0–1)
 *  uSwirl — ángulo de remolino, uSteps — pasos (según perfil), uCam — cámara en espacio objeto.
 * Representación educativa: difusión turbulenta con núcleo caliente y borde más frío; sin «bola de fuego».
 */
export const flameVolumeMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBurn: { value: 0 },
      uHeat: { value: 0 },
      uSwirl: { value: 0 },
      uSteps: { value: 24 },
      uCam: { value: new THREE.Vector3() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vObj;
      void main() { vObj = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uBurn, uHeat, uSwirl, uSteps;
      uniform vec3 uCam;
      varying vec3 vObj;
      ${NOISE_GLSL}
      vec3 ramp(float t) {
        // borde rojo-anaranjado (hollín incandescente) → núcleo amarillo claro
        vec3 c = mix(vec3(0.55, 0.08, 0.01), vec3(1.0, 0.42, 0.06), smoothstep(0.0, 0.45, t));
        return mix(c, vec3(1.0, 0.86, 0.55), smoothstep(0.55, 1.0, t));
      }
      void main() {
        vec3 ro = uCam;
        vec3 rd = normalize(vObj - uCam);
        float b = dot(ro, rd);
        float c = dot(ro, ro) - 1.0;
        float h = b * b - c;
        if (h < 0.0 || uHeat < 0.002) discard;
        h = sqrt(h);
        float t0 = max(-b - h, 0.0);
        float t1 = -b + h;
        float dt = (t1 - t0) / uSteps;
        vec3 acc = vec3(0.0);
        float trans = 1.0;
        float cs = cos(uSwirl), sn = sin(uSwirl);
        for (int i = 0; i < 48; i++) {
          if (float(i) >= uSteps || trans < 0.03) break;
          vec3 p = ro + rd * (t0 + (float(i) + 0.5) * dt);
          float r = length(p);
          vec3 q = vec3(cs * p.x - sn * p.z, p.y, sn * p.x + cs * p.z);
          // los chorros parten del eje: la llama ocupa un toro que se expande con la fracción quemada
          float radial = length(q.xz);
          float front = 0.25 + 0.7 * uBurn;
          float shell = 1.0 - smoothstep(0.0, 0.35 + 0.3 * uBurn, abs(radial - front * 0.75));
          float n = fbm3(q * 3.2 + vec3(0.0, uTime * 1.7, uTime * 0.6));
          float d = max(0.0, shell * (n - 0.32) * 2.2) * (1.0 - smoothstep(0.75, 1.0, r)) * uHeat;
          float temp = clamp(n * 1.3 * shell, 0.0, 1.0);
          float a = 1.0 - exp(-d * dt * 9.0);
          acc += trans * a * ramp(temp) * (0.6 + 1.4 * temp);
          trans *= 1.0 - a;
        }
        gl_FragColor = vec4(acc, 1.0 - trans);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    toneMapped: false,
  });

/**
 * Chorro de combustible atomizado: cono con desintegración en gotas (ruido de alta frecuencia que
 * avanza con el chorro) y opacidad que cae hacia la punta (evaporación). `uTime` = revoluciones.
 */
export const sprayShaderMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      ${NOISE_GLSL}
      void main() {
        // uv.y: 1 en el orificio → 0 en la punta del chorro
        float along = 1.0 - vUv.y;
        float drops = n3(vec3(vUv.x * 40.0, along * 60.0 - uTime * 90.0, 0.0));
        float core = smoothstep(0.0, 0.25, vUv.y);
        float a = mix(0.85, 0.15, along) * (along < 0.35 ? 1.0 : smoothstep(0.35, 0.75, drops));
        a *= 1.0 - smoothstep(0.85, 1.0, along);
        vec3 col = mix(vec3(0.95, 0.82, 0.45), vec3(1.0, 0.95, 0.75), core);
        gl_FragColor = vec4(col * a, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

/** Conductos de un circuito, fusionados en una sola malla con color por vértice. */
export const flowTubeMergedMaterial = () =>
  new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.16, depthWrite: false, toneMapped: false });

/**
 * Partículas de fluido con sombreado esférico barato (resalte especular falso) para que el aceite
 * se lea como gotas brillantes y el aire como una nube tenue. Color por instancia.
 */
export const flowDropMaterial = () => {
  const m = new THREE.MeshBasicMaterial({ toneMapped: false });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvN = normalize(normalMatrix * mat3(instanceMatrix) * normal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vN;')
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\nfloat facing = clamp(vN.z, 0.0, 1.0);\ndiffuseColor.rgb *= 0.55 + 0.45 * facing;\ndiffuseColor.rgb += vec3(0.6) * pow(clamp(dot(vN, normalize(vec3(-0.4, 0.6, 1.0))), 0.0, 1.0), 24.0);',
      );
  };
  m.customProgramCacheKey = () => 'flowDrop';
  return m;
};
