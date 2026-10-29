# DIESEL ENGINE LAB 3D — Resultados de la Etapa 4

Fecha: 2026-10-29 · Rama: `claude/project-thread-6dgtgs` · Base: unión de PR #2 (pintura de fábrica) y PR #3
(precompilación de shaders), ambos conservados. Auditoría y línea base: `STAGE4_AUDIT.md`.

**Entorno de verificación:** contenedor sin GPU, Chromium con SwiftShader (render por software). Las cifras de
draw calls, triángulos, programas y recursos son comparables con una GPU real; los FPS **no** lo son. Falta
validar en una GPU real (ver «Pendientes»).

---

## 1. Cambios por bloque

| Bloque | Qué se hizo | Archivos principales |
|---|---|---|
| 1 Auditoría | Estado real del código, línea base medida, problemas, plan y criterios de verificación. | `STAGE4_AUDIT.md`, `scripts/bench.mjs` |
| 2 Materiales | Biblioteca PBR por acabado con mapas de detalle procedurales (Web Worker) proyectados en triplanar; abrazaderas de manguera, junta de tapa de válvulas, buje de bronce del pie de biela, camisa de cobre del inyector, muñones con película de aceite, pátina de escape sobria. | `render/materials.ts`, `render/textures/*`, `render/engine/Systems.tsx`, `Reciprocating.tsx`, `Structure.tsx`, `Valvetrain.tsx` |
| 3 Iluminación | Tres escenarios (Estudio industrial, Laboratorio técnico, Presentación cinematográfica) con número fijo de luces, entorno HDR procedural cacheado y exposición propia. Cambiar de escenario no recompila. | `render/StudioRig.tsx`, `render/lighting.ts` |
| 4 Animación y efectos | Reloj de revoluciones común (`sim.revs`). Chorros atomizados por shader, llama volumétrica por raymarching que nace del borde de los chorros, remolino ligado a las revoluciones. Vista térmica con leyenda, lecturas e insignia ESTIMADO. Fluidos: un tubo fusionado + un sistema instanciado por circuito, sincronizados con el cigüeñal (se detienen en pausa, retroceden con el avance manual). Gráfica de ciclo (presión estimada, alzada simulada, inyección) en el tablero. | `render/fxMaterials.ts`, `render/combustion/CombustionView.tsx`, `render/fluids/Flows.tsx`, `ui/ThermalLegend.tsx`, `ui/CycleChart.tsx` |
| 5 Interfaz | Paleta pedida, iconos SVG, barra superior nueva (estado, recorridos, iluminación, modo de interfaz, idioma, ayuda, configuración, pantalla completa), estados de carga/error/éxito, avisos, configuración persistente, ES/EN, atajos (`?`), modos ingeniería/presentación/limpio, movimiento reducido. Lecturas de alta frecuencia escritas al DOM sin re-render de React. | `ui/TopBar.tsx`, `ui/BottomBar.tsx`, `ui/SettingsModal.tsx`, `ui/shortcuts.tsx`, `ui/StatusOverlays.tsx`, `ui/toasts.tsx`, `i18n/*`, `ui/styles.css` |
| 6 Exploración | Encuadre automático por motor, sensibilidad de cámara, doble clic para encuadrar, colisión con el bloque cerrado, etiquetas con despeje y densidad configurable, tarjeta de selección con acciones (encuadrar, aislar, atenuar/transparente, relacionadas, ocultar), despiece por conjunto, plano de corte libre orientable con indicador. Al salir de Combustión la cámara vuelve al encuadre previo. | `render/Labels.tsx`, `ui/SelectionCard.tsx`, `camera/CameraRig.tsx`, `camera/fit.ts`, `interaction/*`, `render/Scene.tsx` |
| 7 Recorridos y comparador | Motor de recorridos con reloj propio: pausa, reanudar, salto entre planos, cancelar, duración configurable y pausa automática al tocar la cámara. Seis recorridos pedidos (presentación, interior mecánico, combustión, lubricación, turbo, despiece animado) más los existentes. Comparador: dos vistas en un solo contexto WebGL, rotación y zoom sincronizables, transparencia/corte/despiece por lado, equivalencias sólo entre piezas del mismo tipo, advertencias de año o variante y celdas «No disponible». | `camera/tourDefs.ts`, `camera/tourRun.ts`, `camera/tours.tsx`, `ui/TourBar.tsx`, `ui/Comparator.tsx`, `ui/compare.ts` |
| 8 Perfiles y optimización | Perfiles ULTRA/ALTO/EQUILIBRADO/RENDIMIENTO y automático (capacidades + FPS medidos), monitor de rendimiento, sombras bajo demanda, liberación de recursos al cambiar de motor, precalentamiento de todas las variantes de shader, un solo pase para piezas translúcidas de doble cara, sin sombras de piezas translúcidas. | `render/quality/*`, `render/perf.tsx`, `render/warmup.tsx`, `render/resources.ts`, `interaction/Part.tsx` |
| 9 Validación | 36 pruebas nuevas (94 en total), verificación en navegador con 22 capturas, perfil de compilaciones, sonda de fugas y de DOM, bench antes/después. | `src/**/*.test.ts`, `scripts/verify.mjs`, `scripts/profile.mjs`, `scripts/probe.mjs`, `scripts/bench.mjs` |

## 2. Pruebas ejecutadas

| Prueba | Resultado |
|---|---|
| `npm test` | **94/94** superadas (58 previas + 36 nuevas: configuración, perfiles, despiece, reloj, térmica, selección, recorridos, encuadre, comparador). |
| `npm run build` | Correcto (tipos estrictos + build de producción). |
| `node scripts/verify.mjs …?calidad=baja` | 22 capturas (11 modos, vista térmica, 3 iluminaciones, configuración, inglés, etiquetas, selección, corte libre, recorrido, comparador). 0 errores de página; único aviso: SwiftShader no tiene `KHR_parallel_shader_compile`. Revisadas a mano. |
| `node scripts/profile.mjs` | **0 programas compilados** al cambiar a cualquiera de los 11 modos, a los 3 escenarios de iluminación, etiquetas, recorrido, despiece por grupo, corte libre y comparador. Al cambiar de motor se compilan en segundo plano las variantes nuevas de ese motor (p. ej. 11 en Volvo D13) dentro del precalentamiento asíncrono; seleccionar una pieza después: 0. |
| `node scripts/probe.mjs` | Sin fugas: 129 geometrías y 5 texturas al inicio y tras 12 cambios de motor. Mutaciones del DOM en 3 s: reposo 16, pausa 20 (objetivo < 50), en marcha 147 (lecturas a ~15 Hz). |

## 3. Rendimiento antes/después (build de producción, mismo escenario, SwiftShader)

Draw calls / triángulos por frame (mediana):

| Escenario | Antes, calidad alta | Después, `alta` (= ALTO) | Antes, calidad baja | Después, `baja` (= RENDIMIENTO) |
|---|---|---|---|---|
| Reposo exterior | 762 / 628 k | **582 / 393 k** | 383 / 314 k | 402 / 320 k |
| Combustión | 642 / 571 k | **584 / 537 k** | 263 / 256 k | **163 / 196 k** |
| Lubricación | 642 / 569 k | **503 / 682 k** | 311 / 359 k | **155 / 266 k** |
| Rayos X | 462 / 462 k | 834 / 642 k | 460 / 458 k | **414 / 321 k** |

Notas honestas sobre la tabla:

- En reposo con calidad baja hay +5 % de draw calls: son los detalles nuevos (abrazaderas, juntas, bujes, camisas).
- En ALTO con el motor en marcha, Rayos X sube a 834 draw calls (con el motor detenido mide 582, igual que el
  exterior). La diferencia viene de pases extra por frame (mapa de sombras que se actualiza con piezas en movimiento
  y postprocesado); no la he aislado del todo y queda como siguiente punto de optimización. En RENDIMIENTO, Rayos X
  bajó de 460 a 414.
- Lubricación en ALTO tiene más triángulos porque las gotas de los fluidos ahora tienen volumen sombreado; los draw
  calls del circuito bajaron de ~30 a 2.
- Los FPS en SwiftShader (0.3–4.6) no sirven para juzgar el rendimiento en una GPU real.

## 4. No hecho o parcial (declarado)

- **Fusión de geometría estática** prevista en la auditoría: **no se hizo**. Las piezas siguen siendo una malla por
  subpieza (~400 mallas). Es la siguiente optimización de draw calls; requiere cuidar la selección y el corte.
- **Teselado por perfil**: no se implementó; el campo `detail` del perfil, que no tenía efecto, se eliminó.
- **Validación en GPU real** de FPS y del aspecto de ULTRA/ALTO: pendiente (sólo hay SwiftShader).

## 5. Pendientes que dependen de Oscar o de recursos externos

- Modelos GLB/CAD con licencia de cada fabricante (la geometría sigue siendo procedural y provisional, y así se indica).
- HDRI fotográficos (opcional; ahora el entorno es procedural).
- Color real del Volvo D13 (sigue gris provisional sin fuente, del PR #2).
- Probar en una GPU real y, si lo aprueba, redesplegar el Worker (no se ha redesplegado).
