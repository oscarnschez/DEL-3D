# DIESEL ENGINE LAB 3D

Laboratorio virtual de ingeniería: simulador técnico, visual e interactivo de motores diésel de tractocamión.
React 19 + TypeScript + Vite + Three.js + React Three Fiber. Interfaz en español.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # cinemática, catálogo, reloj, perfiles, despiece, selección, recorridos, comparador…
npm run build    # tipos + build de producción
```

Scripts de verificación en navegador (Playwright preinstalado, render por software):

```bash
node scripts/verify.mjs http://localhost:5173/?calidad=baja verify-out   # capturas de modos y funciones
node scripts/profile.mjs                                                  # programas WebGL compilados por acción (debe dar 0)
node scripts/bench.mjs http://localhost:4173/ 6                           # draw calls, triángulos y FPS por escenario
```

## Qué hace

- **Motor I6 animado con cinemática exacta**: pistón-biela-cigüeñal calculado desde el ángulo del cigüeñal, ciclo de 720°, orden de encendido 1-5-3-6-2-4, árboles de levas a ½ velocidad con lóbulos generados a partir de la ley de alzada de cada válvula, balancines, puentes, resortes, tren de engranajes 2:1.
- **Tres arquitecturas de distribución** según el motor: DOHC (Detroit DD15), SOHC con balancín de dedo (Cummins X15, Volvo D13, Mack MP8, CAT C15) y OHV con taqués y varillas (PACCAR MX-13).
- **Controles**: encendido/apagado con inercia, RPM, carga, pausa, cámara lenta (hasta 0.03×), paso a paso (1°, 5°, 15° o siguiente fase), rotación manual arrastrando la línea de tiempo, selección de cilindro.
- **10 modos**: exterior, interior, combustión (cámara con partículas, chorros, autoignición, colores térmicos y dial de 720°), lubricación, combustible, refrigeración, admisión y escape, despiece, rayos X y técnico.
- **Herramientas**: cortes longitudinal/transversal/por cilindro/plano libre con rayado de sección, transparencia, despiece con slider, cubiertas retirables, aislar, ocultar, mostrar relacionadas, ver movimiento.
- **Catálogo multimarca** con fichas técnicas citadas: cada dato se marca como **VERIFICADO** (con enlace a la fuente) o **APROXIMADO**.
- **Tablero** con insignias de origen: SIM (exacto por cinemática), EST (modelo simplificado), DEMO (ilustrativo).
- **Comparador** de dos motores con rotación (y zoom opcional) sincronizados, transparencia, corte y despiece por lado, resalte de piezas equivalentes (sólo del mismo tipo) y advertencias de año o variante.
- **Recorridos cinematográficos** (presentación, interior mecánico, combustión, lubricación, turbo, despiece animado y otros cuatro) con pausa, reanudación, salto entre planos, cancelación y duración configurable.

### Etapa 4 (acabado profesional)

- **Materiales PBR** con mapas de detalle procedurales (fundición, pintura, aluminio, mecanizado, forja, chapa, caucho, pátina) proyectados en triplanar; juntas, abrazaderas, bujes y camisas visibles.
- **Tres escenarios de iluminación** (Estudio industrial, Laboratorio técnico, Presentación cinematográfica) con entorno HDR procedural, intercambiables sin recargar ni recompilar.
- **Combustión cinematográfica**: chorros atomizados por shader, llama volumétrica (raymarching) que nace en el borde de los chorros, remolino ligado a las revoluciones. **Vista térmica** con escala, lecturas e insignia de valores estimados.
- **Fluidos** de un circuito en dos draw calls, sincronizados con las revoluciones del cigüeñal (se detienen en pausa y retroceden con el avance manual).
- **Interfaz**: paleta nueva, iconos SVG, estado del motor, carga y errores, avisos, configuración persistente, español/inglés, atajos de teclado (`?`), modos ingeniería/presentación/limpio, movimiento reducido.
- **Exploración**: encuadre automático, sensibilidad de cámara, doble clic para encuadrar, colisión con el bloque, etiquetas con despeje, tarjeta de selección con acciones, despiece por conjunto o pieza, plano de corte libre orientable.
- **Perfiles gráficos** ULTRA/ALTO/EQUILIBRADO/RENDIMIENTO y automático (capacidades + FPS medidos), monitor de rendimiento medido, liberación de recursos al cambiar de motor.
- Detalle técnico, mediciones y pendientes: `STAGE4_AUDIT.md` y `STAGE4_RESULTS.md`.

## Limitaciones declaradas

- La geometría 3D es **procedural y provisional**: respeta la arquitectura, las cotas publicadas y la cinemática, pero no reproduce CAD del fabricante. La UI lo indica siempre. Se pueden incorporar GLB con licencia mediante `EngineDefinition.assets`.
- Biela, paso entre cilindros, reglaje de válvulas y calado de inyección no son publicados por los fabricantes: son valores típicos marcados como aproximados.
- Los flujos de fluidos y la termodinámica de la cámara son representaciones educativas, no CFD.
- La vista térmica muestra temperaturas **estimadas** por un modelo educativo, no mediciones.
- El entorno HDR es procedural (no hay HDRI fotográficos en el repositorio) y los FPS sólo se han medido con render por software: falta validar los perfiles altos en una GPU real.

Ver `CLAUDE.md` para la arquitectura y las convenciones.
