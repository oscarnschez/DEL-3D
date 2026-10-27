# DIESEL ENGINE LAB 3D

Laboratorio virtual de ingeniería: simulador técnico, visual e interactivo de motores diésel de tractocamión.
React 19 + TypeScript + Vite + Three.js + React Three Fiber. Interfaz en español.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # cinemática, interferencias y catálogo
npm run build    # tipos + build de producción
```

## Qué hace

- **Motor I6 animado con cinemática exacta**: pistón-biela-cigüeñal calculado desde el ángulo del cigüeñal, ciclo de 720°, orden de encendido 1-5-3-6-2-4, árboles de levas a ½ velocidad con lóbulos generados a partir de la ley de alzada de cada válvula, balancines, puentes, resortes, tren de engranajes 2:1.
- **Tres arquitecturas de distribución** según el motor: DOHC (Detroit DD15), SOHC con balancín de dedo (Cummins X15, Volvo D13, Mack MP8, CAT C15) y OHV con taqués y varillas (PACCAR MX-13).
- **Controles**: encendido/apagado con inercia, RPM, carga, pausa, cámara lenta (hasta 0.03×), paso a paso (1°, 5°, 15° o siguiente fase), rotación manual arrastrando la línea de tiempo, selección de cilindro.
- **10 modos**: exterior, interior, combustión (cámara con partículas, chorros, autoignición, colores térmicos y dial de 720°), lubricación, combustible, refrigeración, admisión y escape, despiece, rayos X y técnico.
- **Herramientas**: cortes longitudinal/transversal/por cilindro/plano libre con rayado de sección, transparencia, despiece con slider, cubiertas retirables, aislar, ocultar, mostrar relacionadas, ver movimiento.
- **Catálogo multimarca** con fichas técnicas citadas: cada dato se marca como **VERIFICADO** (con enlace a la fuente) o **APROXIMADO**.
- **Tablero** con insignias de origen: SIM (exacto por cinemática), EST (modelo simplificado), DEMO (ilustrativo).
- **Comparador** lado a lado con cámara y ángulo de cigüeñal sincronizados, y **recorridos cinematográficos**.

## Limitaciones declaradas

- La geometría 3D es **procedural y provisional**: respeta la arquitectura, las cotas publicadas y la cinemática, pero no reproduce CAD del fabricante. La UI lo indica siempre. Se pueden incorporar GLB con licencia mediante `EngineDefinition.assets`.
- Biela, paso entre cilindros, reglaje de válvulas y calado de inyección no son publicados por los fabricantes: son valores típicos marcados como aproximados.
- Los flujos de fluidos y la termodinámica de la cámara son representaciones educativas, no CFD.

Ver `CLAUDE.md` para la arquitectura y las convenciones.
