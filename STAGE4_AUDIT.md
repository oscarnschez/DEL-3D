# DIESEL ENGINE LAB 3D — Auditoría inicial de la Etapa 4

Fecha: 2026-10-28 · Rama de trabajo: `claude/project-thread-6dgtgs`

Versión de referencia auditada: rama del PR #2 (colores de fábrica, `13fa269`) **fusionada** con la del PR #3
(precompilación de shaders, `3678af3`). Ambos PRs seguían abiertos sin fusionar en `main`; la Etapa 4 se construye
sobre su unión para no revertir ninguno. Todo lo descrito abajo se comprobó leyendo el código y ejecutándolo
(no a partir del README).

Condiciones de medición: contenedor en la nube sin GPU, Chromium con **SwiftShader (render por software)**,
4 núcleos de CPU, ventana 1280×720 (bench) o 1000×640 (sonda de recursos). Los FPS absolutos de este entorno
**no** representan una GPU real; sirven sólo para comparar antes/después. Las cifras de draw calls, triángulos,
mallas, materiales y búferes no dependen de la GPU y sí son comparables.

---

## 1. Estado actual

### Arquitectura general (comprobada)

| Capa | Archivos | Estado |
|---|---|---|
| Reloj de simulación | `core/simulation/clock.ts`, `SimulationDriver.tsx` | Funciona. Ángulo de cigüeñal único (`sim.angle`, 0–720°) integrado una vez por frame con `dt` limitado a 1/20 s, inercia de RPM, `timeScale`, pausa. |
| Cinemática | `core/kinematics/*` | Funciones puras correctas: biela-manivela exacta, fases de 720°, reglaje → eventos de válvula, inyección y combustión educativas, modelo térmico educativo del gas (politrópica + Wiebe). 29 pruebas. |
| Catálogo | `engines/catalog/*` (7 motores) | Cummins X15, Detroit DD15, Volvo D13, Mack MP8, CAT C15, PACCAR MX-13 y un I6 de referencia. Cada dato lleva `verificado` + fuente o `aproximado`. 29 pruebas. Pintura del PR #2 presente y citada. |
| Layout derivado | `engines/derive.ts` | Deriva cotas de escena desde la definición. Tres arquitecturas: DOHC (DD15), SOHC con balancín de dedo, OHV con varillas (MX-13). |
| Render | `render/Scene.tsx`, `render/engine/*`, `render/geometry/builders.ts` | Geometría 100 % procedural (lathe/extrude/tube). Una malla React por subpieza. |
| Materiales | `render/materials.ts` | 24 materiales Standard/Physical compartidos; 3 texturas de ruido generadas en canvas (256 px) usadas como `roughnessMap`/`bumpMap`. Sin mapas normal, metalness ni AO. |
| Efectos | `render/combustion/CombustionView.tsx`, `render/fluids/*`, `render/fxMaterials.ts` | Columnas de gas coloreadas por temperatura, chorros cónicos instanciados, 420 esferas instanciadas en la cámara, una esfera de «frente de llama», flujos con tubo traslúcido + esferas instanciadas por trayectoria. |
| Interacción | `interaction/Part.tsx`, `selection.ts` | Selección, hover, aislar, ocultar, fantasma, relacionadas, cubiertas retirables, despiece con dirección fija por pieza. |
| Cámara | `camera/CameraRig.tsx`, `tours.tsx` | `CameraControls` (drei) con 7 vistas, enfoque por caja envolvente, 8 recorridos secuenciales con `setTimeout`. |
| UI | `ui/*`, `ui/styles.css` | Barra superior, panel izquierdo (catálogo, componentes, sistemas), panel derecho (ficha, pieza, datos), barra inferior (marcha, RPM, carga, paso, velocidad, corte, despiece, transparencia, cilindro, línea de 720°), dial de ciclo SVG, comparador modal. |

### Línea base medida (antes de cualquier cambio de la Etapa 4)

`npm test`: **58/58** pruebas superadas. `npm run build`: correcto (three 704 kB, r3f/drei 463 kB, app 155 kB sin gzip).

Escena por defecto (Cummins X15, calidad `baja`, sin sombras), sonda `scene.traverse`:

| Métrica | Valor |
|---|---|
| Mallas | 387 |
| Materiales distintos | 382 (casi uno por malla: cada `<Part>` clona sus materiales) |
| Geometrías distintas | 124 |
| Triángulos visibles | 314 792 |
| Programas WebGL | 50 |

Triángulos por conjunto (los mayores): árbol de levas 37 k (lóbulos con 240 puntos), válvulas de admisión 34.8 k y de
escape 34.8 k (los resortes de tubo helicoidal dominan), cigüeñal 31.7 k, bielas 24.9 k, engranajes 19.7 k,
balancines 19.6 k (48 mallas), pistones 18.6 k.

Bench (`scripts/bench.mjs`, build de producción, SwiftShader):

| Escenario | Calidad alta: draw calls / triángulos por frame | Calidad baja: draw calls / triángulos |
|---|---|---|
| Reposo exterior | 762 / 628 k (incluye pase de sombras) | 383 / 314 k |
| Rayos X | 462 / 462 k | 460 / 458 k |
| FPS | 0.4–1.5 FPS en SwiftShader (no representativo de GPU) | 0.3–0.9 FPS |

Tiempo hasta el primer frame con escena: ~1.9 s (preview local).

---

## 2. Problemas detectados

### Rendimiento y recursos (verificados con medición)

1. **Fuga de recursos al cambiar de motor.** Los búferes WebGL vivos pasan de 511 a 2 645 tras 6 cambios de motor
   (+≈360 por cambio, nunca se liberan). Las geometrías creadas con `useMemo` y pasadas como `geometry={…}` no las
   libera R3F, y los ~380 materiales clonados por `<Part>` tampoco.
2. **Draw calls altas**: ~380 mallas independientes; el pase de sombras las duplica (762). Muchas son piezas estáticas
   del mismo material dentro de una pieza (salientes del bloque, nervaduras, tapas, álabes del turbo, colectores) que
   podrían fusionarse.
3. **Sombras de piezas internas**: todas las piezas proyectan sombra (`castShadow`), incluidas válvulas y pistones
   ocultos dentro del bloque, y el mapa de sombras se recalcula cada frame aunque el exterior no se mueva.
4. **Teselado excesivo** en resortes (tubo helicoidal), lóbulos de leva (240 puntos), corona del volante (120 dientes)
   y esferas de partículas (cada partícula es una esfera de ~40 triángulos).
5. **Re-renderizados de React**: 726 mutaciones de DOM en 3 s **con el motor detenido** (≈240/s). `BottomBar` y
   `TopBar` se suscriben al store completo (`useApp()`), y el tablero, el dial (dos instancias a 30 Hz) y la barra
   inferior re-renderizan por muestreo aunque nada cambie.
6. **Flujos**: cada trayectoria es un tubo + un `InstancedMesh` (2 draw calls por trayectoria, ~30 en lubricación) y
   se evalúa `curve.getPointAt` por partícula y por frame en CPU.
7. **Perfiles gráficos**: sólo `alta/media/baja`, que cambian `dpr` y sombras. No hay detección automática ni medición.

### Simulación y animación

8. **Los efectos no usan el reloj común**: las partículas de fluidos avanzan con `dt` real propio (no con el `dt`
   limitado del reloj), arrancan con `Math.random()` y no se mueven con el avance manual (paso a paso, arrastre de la
   línea de tiempo). El remolino de la cámara también integra `dt` propio. Pausa, avance manual y reproducción no
   producen resultados consistentes entre sí.
9. **Despiece**: interpolación exponencial por `dt`, dirección fija recta por pieza, sin escalonamiento; en despiece
   completo los pistones suben a la vez que la culata y pueden cruzarla. No hay despiece por conjunto mecánico (sólo
   por «sistema» de la ficha), ni individual, ni curva de animación controlada.
10. **No existe vibración visual** del motor.

### Visuales

11. **Materiales**: un solo ruido de canvas (bump + roughness) compartido por casi todo; sin normal maps, sin
    variación de metalness, sin acabados diferenciados (inoxidable, caucho, plástico técnico, juntas, película de
    aceite). Texturas en coordenadas UV de cada constructor (escala inconsistente entre piezas extruidas y torneadas).
12. **Iluminación**: un único montaje fijo (hemisférica + 2 direccionales + spot azul + entorno de Lightformers).
    Sin escenarios, sin control de exposición por escenario, tone mapping ACES (desatura los colores de pintura de
    fábrica del PR #2). Sombras PCF por defecto.
13. **Combustión**: chorros como conos sólidos, llama como una esfera aditiva uniforme (precisamente la «bola de
    fuego» que hay que evitar), partículas esféricas.
14. **Selección**: resalte emisivo cian saturado (0.55) y naranja para relacionadas; puede resultar llamativo.
15. **Etiquetas 3D**: `Html` de drei sin gestión de superposición ni de oclusión; 18 etiquetas siempre visibles en
    modo técnico.
16. **Geometría decorativa engañosa**: tres cajas de colores sobre el postratamiento (`Aftertreatment`) no
    representan ningún componente real.

### Interfaz y UX

17. Paleta con azul/cian/ámbar saturados y brillos (`box-shadow` neón en logo, botón de encendido, cursor).
18. Iconos con emoji/caracteres (🎬, ⛶, ☰, ☷) inconsistentes entre sistemas operativos.
19. No hay selector de idioma, ni configuración, ni atajos de teclado, ni persistencia de preferencias, ni
    `prefers-reduced-motion`, ni sensibilidad de cámara, ni modos presentación/ingeniería/vista limpia.
20. No hay estados de carga/error: si WebGL falla, la pantalla queda vacía.
21. Los recorridos usan `setTimeout`: no se pueden pausar ni reanudar, la duración no es configurable y un
    arrastre del usuario compite con la cámara del recorrido.
22. Comparador: una sola cámara compartida (sin sincronización configurable), sin controles individuales, sin
    transparencia/corte, sin selección de componentes equivalentes, sin aviso de variantes de años distintos.
23. Telemetría: faltan RPM estimadas del turbo, cilindro activo destacado, gráfica presión–ángulo, eventos de
    inyección y de válvulas en gráfica; la gráfica existente no se puede pausar ni inspeccionar.
24. `CLAUDE.md` menciona `i18n/es.ts`, que **no existe**.

---

## 3. Recursos gráficos disponibles

| Recurso | Disponibilidad |
|---|---|
| Modelos GLB/CAD de fabricante | **Ninguno.** `EngineDefinition.assets.glb` está vacío en los 7 motores. No se encontraron modelos con licencia que permita su inclusión. |
| Texturas de material (fotográficas) | **Ninguna** en el repositorio. |
| Entornos HDRI | **Ninguno.** La descarga desde Poly Haven (CC0) está bloqueada por el proxy del contenedor (HTTP 403). |
| Generación procedural | Disponible: texturas en canvas, geometría procedural, entorno HDR renderizado en tiempo real con Lightformers (cubemap de media precisión, valores > 1). |
| Dependencias npm | El registro npm es accesible (p. ej. `@react-three/postprocessing`, `postprocessing`, `n8ao`). |

Consecuencia: todos los motores conservan su **representación procedural provisional**. Las mejoras visuales se
basan en materiales y texturas procedurales, iluminación e iluminación de entorno generadas en tiempo real; ningún
motor pasa a considerarse «modelo exacto».

---

## 4. Funcionalidades que deben conservarse

- Reloj único por ángulo de cigüeñal; toda la cinemática como función pura de `θ` (CLAUDE.md).
- Biela-manivela exacta, tres arquitecturas de distribución, lóbulos de leva generados con la ley de alzada.
- Orden de encendido, fases, inyección piloto/principal, modelo térmico educativo y sus insignias (SIM/EST/DEMO).
- Los 10 modos de visualización, cortes (longitudinal/transversal/cilindro/libre) con rayado, transparencia,
  cubiertas retirables, aislar/ocultar/fantasma/relacionadas, ver movimiento.
- Catálogo de 7 motores con fichas y fuentes; insignias VERIFICADO/APROXIMADO y aviso de GEOMETRÍA PROVISIONAL.
- Colores de fábrica del PR #2 con su nota de respaldo (Volvo D13 gris provisional).
- Precompilación de shaders del PR #3: número constante de luces y de planos de corte, materiales de efectos en
  `fxMaterials.ts` + `warmup.tsx`, `scripts/profile.mjs` con 0 programas nuevos por cambio de modo.
- Los 8 recorridos existentes, comparador con tabla de fichas, dial de 720°, línea de tiempo arrastrable,
  paso a paso (1°, 5°, 15°, fase), cámara lenta hasta 0.03×.

## 5. Mejoras previstas (por bloque)

| Bloque | Mejoras |
|---|---|
| 2 Modelos | Biblioteca PBR por acabado (hierro fundido pintado/crudo, acero mecanizado/forjado, aluminio fundido, inoxidable, cobre, bronce, caucho, plástico técnico, juntas, mangueras, cromo, hierro de escape con pátina térmica, película de aceite) con mapas normal/roughness/metalness procedurales, mapeo triplanar en coordenadas de objeto, resolución según perfil. Detalles reales: abrazaderas de manguera, junta de tapa de válvulas, casquillo de bronce del pie de biela, camisa de cobre del inyector. Eliminar las cajas decorativas del postratamiento. |
| 3 Iluminación | Tres escenarios (Estudio industrial, Laboratorio técnico, Presentación cinematográfica) con número fijo de luces, entorno HDR procedural por escenario, sombras suaves, exposición por escenario, tone mapping neutro (Khronos PBR Neutral) que respeta la pintura, oclusión ambiental en pantalla en perfiles altos. |
| 4 Animación/efectos | Acumulador común de revoluciones en el reloj (`sim.revs`) para que flujos, remolino y partículas respondan a pausa, cámara lenta y avance manual; vibración visual opcional; inyección por gotas en shader, llama volumétrica por raymarching con gradiente térmico, escape con densidad decreciente; vista térmica educativa con escala; flujos con un solo sistema de partículas por circuito y materiales propios por fluido. |
| 5 Interfaz | Paleta pedida, identidad (logotipo geométrico SVG, iconos SVG propios), barra superior/paneles/barra inferior según la distribución pedida, selector de idioma (ES/EN para la interfaz), configuración persistente, pantalla completa, estados de carga/error, atajos, `prefers-reduced-motion`, modos presentación/ingeniería/vista limpia. |
| 6 Exploración | Sensibilidad de cámara, límites para no perder el motor, enfoque con doble clic, resalte sobrio, etiqueta de pieza seleccionada con acciones, etiquetas con anti-superposición y ocultación por orientación, despiece por conjuntos/sistema/individual con trayectorias escalonadas y retorno exacto, corte dinámico orientable, aislamiento. |
| 7 Cinemáticas/comparador | Motor de recorridos con reloj propio (pausa, reanudar, cancelar, duración configurable, pausa automática si el usuario mueve la cámara) y los 6 recorridos pedidos; comparador con dos vistas, sincronización opcional de rotación y zoom, relojes individuales, transparencia/corte, componentes equivalentes por tipo y aviso de variantes. |
| 8 Optimización | Perfiles ULTRA/ALTO/EQUILIBRADO/RENDIMIENTO + automático (capacidades + medición de FPS), fusión de geometría estática por pieza y material, sombras sólo de piezas exteriores y mapa de sombras bajo demanda, menos teselado, liberación de recursos al cambiar de motor, UI de alta frecuencia con actualizaciones imperativas, HUD de rendimiento. |
| 9 Validación | Pruebas unitarias nuevas (reloj, perfiles, persistencia, despiece, selección, sincronización de cámaras, recursos, recorridos, modelo térmico) y verificación en navegador con capturas, sonda de recursos y bench antes/después. |

## 6. Dependencias o recursos externos necesarios

- **Modelos GLB/CAD con licencia** de cada fabricante (no disponibles): necesarios para cualquier afirmación de
  fidelidad geométrica. Pendiente de Oscar.
- **HDRI fotográficos** (opcional): Poly Haven (CC0) sería apto, pero el contenedor no puede descargarlos. Se usa un
  entorno HDR procedural. Puede añadirse después sin cambiar la arquitectura.
- **GPU real** para medir FPS y validar la calidad visual de ULTRA/ALTO (sólo hay SwiftShader). Pendiente de Oscar.
- Dependencias npm nuevas previstas: `postprocessing`, `@react-three/postprocessing`, `n8ao` (MIT), sólo para
  oclusión ambiental y antialiasing en perfiles altos.

## 7. Criterios para verificar las mejoras

| Criterio | Cómo se verifica |
|---|---|
| Cinemática intacta | Las 58 pruebas existentes siguen pasando; nuevas pruebas de reloj (pausa, avance, revoluciones). |
| Sin recompilaciones al cambiar de modo / escenario | `scripts/profile.mjs`: 0 programas nuevos al cambiar de modo y de escenario de iluminación. |
| Sin fugas al cambiar de motor | Sonda de recursos: los búferes WebGL vivos tras 6 cambios de motor vuelven al nivel inicial (±10 %). |
| Menos draw calls y triángulos | Bench antes/después con el mismo escenario y perfil. |
| UI sin re-render ocioso | Mutaciones de DOM en 3 s con el motor detenido: objetivo < 50. |
| Despiece reversible | Prueba unitaria: posición en progreso 0 = posición original exacta; navegador: captura ensamblado/despiezado/ensamblado. |
| Efectos en reloj común | Prueba unitaria: posición de partículas como función de `sim.revs`; navegador: paso a paso mueve los flujos. |
| Funciones disponibles según motor | Botones sin componente (p. ej. EGR inexistente) deshabilitados con explicación. |
| Visual | Capturas de cada modo, escenario y perfil (SwiftShader), revisadas manualmente. |
| Rendimiento en GPU real | **Pendiente**: no medible en este entorno; se documenta el procedimiento (HUD de rendimiento + `scripts/bench.mjs`). |
