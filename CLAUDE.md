# DIESEL ENGINE LAB 3D — Convenciones técnicas

Simulador técnico interactivo de motores diésel de tractocamión. React 19 + TypeScript (strict) + Vite + Three.js + React Three Fiber (R3F) + drei + zustand + GSAP.

## Comandos

- `npm run dev` — servidor de desarrollo (http://localhost:5173)
- `npm run build` — verificación de tipos (`tsc --noEmit`) + build de producción
- `npm test` — pruebas unitarias (vitest): cinemática, catálogo, reloj, perfiles, configuración, despiece, selección, térmica, recorridos, comparador
- `npm run typecheck` — sólo tipos

Antes de dar por terminado un cambio: `npm test && npm run build` deben pasar, y la app debe verificarse en navegador (ver `scripts/verify.mjs`, usa Playwright preinstalado). Capturas sueltas: `scripts/shot.mjs` y `scripts/shots.mjs` (lanzarlas de una en una: varias instancias de Chromium con SwiftShader agotan la memoria).

## Arquitectura (src/)

```
core/
  kinematics/   Funciones puras: biela-manivela, perfiles de leva, fases del ciclo de 4 tiempos.
  simulation/   Reloj de simulación (ángulo de cigüeñal y `revs`) separado del render; estado mutable por frame.
  telemetry/    Modelo simplificado de instrumentos (valores demostrativos/estimados, nunca "telemetría real").
  thermal/      Temperaturas estimadas por pieza (vista térmica) y su escala de color.
engines/
  schema.ts     Tipos EngineDefinition: geometría, distribución, inyección, turbo, fichas, fuentes.
  catalog/      Una definición por motor (x15.ts, dd15.ts, …). Agregar un motor = agregar un archivo + registrarlo.
  derive.ts     Deriva el layout mecánico (offsets de muñequillas, posiciones) desde la definición.
render/
  Scene.tsx     Canvas, cortes, sombras bajo demanda, postprocesado, precalentamiento.
  StudioRig.tsx / lighting.ts  Escenarios de iluminación (luces fijas, entornos HDR procedurales cacheados).
  materials.ts  Materiales PBR compartidos con parches triplanares (una instancia por tipo).
  textures/     Mapas de detalle procedurales generados en un Web Worker.
  quality/      Perfiles gráficos (ULTRA…RENDIMIENTO) y perfil automático; perf.tsx mide FPS/draw calls reales.
  resources.ts  `useDisposable`: libera geometrías/materiales creados con memo (materiales con retardo).
  geometry/     Constructores procedurales (lathe/extrude) memoizados por dimensiones.
  engine/       Piezas del motor como componentes R3F. Las piezas móviles leen el ángulo en useFrame.
  fluids/       Partículas instanciadas sobre trayectorias (aceite, combustible, refrigerante, aire/escape).
  combustion/   Visualización del interior del cilindro.
camera/         Rig de cámara, vistas predefinidas, enfoque automático y recorridos cinematográficos.
interaction/    Selección, hover, aislamiento, ocultación, despiece por grupos (explode.ts), entorno de vista (viewEnv.ts).
state/          Stores zustand: vista (store.ts) y preferencias persistentes (settings.ts).
ui/             Barra superior, paneles, barra inferior, tablero, dial de 720°, comparador, diálogos, avisos.
i18n/           Textos de la interfaz: es.ts (principal) y en.ts; `useT()` para traducir.
```

## Reglas de simulación

- **El ángulo del cigüeñal es la única fuente de verdad.** Todo lo móvil (pistones, bielas, levas, balancines, válvulas, inyección, turbo, partículas sincronizadas) se calcula como función pura del ángulo `θ` (grados, 0–720). Nada se anima con tweens independientes.
- Los efectos (fluidos, remolino, llama, chorros) usan `sim.revs` (revoluciones acumuladas) como base temporal: se detienen en pausa y siguen el avance manual. Mover el cigüeñal a mano siempre con `advanceCrank`/`setCrankAngle`, nunca escribiendo `sim.angle`.
- El reloj vive en `core/simulation/clock.ts` (`sim` mutable). Se integra una vez por frame en `SimulationDriver` (prioridad de useFrame -1); los componentes leen `sim.angle` en su propio useFrame. React **no** re-renderiza por frame; la UI se refresca con muestreo (~15 Hz).
- Convención angular: `θ = 0` es PMS de compresión (encendido) del cilindro 1. Cilindro `i` tiene `fireAngle_i`; su ángulo local de ciclo es `φ = (θ − fireAngle_i) mod 720`. `φ ∈ [0,180)` expansión, `[180,360)` escape, `[360,540)` admisión, `[540,720)` compresión (fases nominales; las válvulas usan su propio reglaje).
- Biela-manivela exacta: `y = r·cosα + √(l² − r²·sin²α)`, ángulo de biela `β = asin(r·sinα / l)`.
- Árbol de levas a ½ velocidad del cigüeñal. El perfil del lóbulo se genera a partir de la misma ley de alzada que mueve la válvula, así el contacto es geométricamente consistente.
- Unidades de escena: metros. Eje X = eje del cigüeñal (cilindro 1 al frente, X negativo), Y = arriba, Z = lateral (admisión en −Z, escape en +Z).

## Datos técnicos

- Nunca inventar especificaciones. Cada dato de ficha lleva `fuente` y `estado`: `'verificado'` (con URL a fuente oficial o técnica) o `'aproximado'` (estimación declarada).
- Telemetría del tablero: cada indicador declara su `origen`: `'simulado'` (exacto por la cinemática), `'estimado'` (modelo simplificado), `'demostrativo'` (ilustrativo). La UI muestra la insignia correspondiente.
- La geometría 3D actual es **procedural y provisional**; la UI lo indica siempre. Los modelos GLB fieles se integrarán vía `EngineDefinition.assets` respetando licencias.

## Estilo de código

- TypeScript estricto, sin `any`. Componentes funcionales; hooks para lógica de frame.
- Geometrías y materiales se crean con `useMemo` y se reutilizan; usar instancing para piezas repetidas (tornillos, partículas).
- No crear objetos en `useFrame` (reutilizar vectores/matrices temporales).
- Identificadores de código en inglés; textos visibles en español vía `i18n/es.ts` o literales en español.
- Evitar recompilaciones de shaders en caliente (congelan la app varios segundos en GPUs reales): no montar/desmontar luces (cambiar `intensity`), no cambiar el número de `gl.clippingPlanes` (siempre hay uno; `NO_CUT` cuando no hay corte), y definir los materiales de efectos nuevos en `render/fxMaterials.ts` y añadirlos a `render/warmup.tsx`. `node scripts/profile.mjs` cuenta los programas compilados en cada cambio de modo: debe dar 0.
- Cada pieza seleccionable se registra con un `PartId` de `engines/parts.ts` (nombre, sistema, función, relaciones).
- Geometrías y materiales creados con memo: usar `useDisposable` (render/resources.ts), no `useMemo`, para que se liberen. Clonar materiales con `cloneMaterial` (conserva los parches de shader).
- Las piezas leen vista y selección de `useViewEnv()` (no de los stores globales) para funcionar también en el comparador.
- Interfaz de alta frecuencia (RPM, cursores): escribir en el DOM con `useSimWriter`, no con estado de React.
- Textos nuevos de la interfaz: añadir la clave en `i18n/es.ts` y `i18n/en.ts`.
