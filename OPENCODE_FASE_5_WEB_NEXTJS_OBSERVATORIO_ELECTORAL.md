# OPENCODE — FASE 5: WEB DEL OBSERVATORIO ELECTORAL

## CONTEXTO, ESTADO Y MANDATO

Continúa el proyecto EXISTENTE **Observatorio Electoral 2026 / Elecciones 29N 2026**. Las fases 1–4 están terminadas según el último informe de desarrollo. Este encargo es **solo la FASE 5: construir una web pública, rigurosa, atractiva, rápida e interactiva** que permita explorar los datos históricos, demográficos, de encuestas y los experimentos retrospectivos de Machine Learning. **NO** entrenes modelos nuevos, **NO** construyas predicciones de las generales de 2026, **NO** inventes datos y **NO** despliegues a producción todavía: el despliegue final corresponde a la fase 6.

### Lo comunicado por la fase 4 — compruébalo sobre el repositorio, no lo trates como verdad si los archivos contradicen el informe

- Elecciones históricas del Congreso: 16 (1977–2023), 52 circunscripciones, 1.778 etiquetas originales de candidaturas, de las que 479 están mapeadas a 36 partidos normalizados. Las demás candidaturas originales **siguen existiendo**, no son basura ni pueden perderse.
- Todas las 81 candidaturas registradas en 2023 están disponibles en la vista «Todos».
- Encuestas: 1.232 registros informados en fase 2; diferencias entre estimación de voto e intención directa; duplicados/réplicas que NO cuentan como encuestas independientes; sin resultados electorales de 2026.
- Fase 4: enriquecimiento con INE (edad, población, EPA, renta ADRH, censo por edad), 21 indicadores y metadatos de vintage; cobertura histórica desigual y nulos legítimos.
- ML: validación temporal retrospectiva de participación. Según el último informe, baseline `mean3` ≈ 3,56 puntos de MAE macro; HGBR ≈ 3,68; Ridge ≈ 3,80. Ningún modelo ha demostrado superioridad consistente. Son **valores orientativos del informe**: extrae y comprueba los números exactos de los CSV, no los codifiques a mano.
- 53 tests Python superados al cierre de fase 4. Repite el resultado y registra cualquier divergencia.
- El repositorio ya contiene `src/electoral/`, `config/`, `docs/`, `data/processed/`, `reports/tables/phase3` y `phase4`, `reports/figures/...`, tests, taxonomía y registro de colores. Comprueba rutas y esquemas reales, que pueden variar.

## PRINCIPIOS INNEGOCIABLES

1. **Primero inspecciona, después programa.** Analiza la estructura existente, esquemas reales de Parquet/CSV, documentación, módulos de taxonomía y colores, y resultados ML. Reutiliza la lógica Python ya implementada.
2. **Todos los partidos y candidaturas** sin excepción, incluidos minoritarios, provinciales, regionales, coaliciones y no mapeados. Los principales pueden venir preseleccionados como conveniencia de navegación, pero siempre debe existir búsqueda, selección múltiple y opción «Todos» (sin filtros implícitos que eliminen datos). Distingue `candidacy_original` de `party_normalized`, y no agregues partidos sin justificación registrada. Muestra porcentaje de cobertura de normalización.
3. **Colores coherentes de partidos**: consume el registro existente de `get_party_color()` y los metadatos de vigencia/colores, nunca generes otra paleta paralela. PP azul `#1B5FCC`, PSOE rojo `#E30613`, VOX verde `#5CB531` según el estado del proyecto; respeta además los otros partidos. Si un color es provisional o fallback, identifícalo. No uses el rojo/azul/verde de los partidos como color dominante de la interfaz: la identidad visual global será neutral. Las leyendas incluirán texto y no dependerán solo del color; accesibilidad y contraste.
4. **Datos y fuentes reales**, con licencias/atribución, periodo, unidad, ámbito, fecha de observación, fecha de corte y vintage. Jamás rellenos silenciosos. Si no hay dato, presenta «Dato no disponible» con explicación breve; no lo sustituyas por cero.
5. **No hacer pronósticos propios de resultados de 2026** ni mostrar ganador probable, reparto futuro de escaños o probabilidades de victoria. No transformar un modelo histórico no validado para 2026 en predicción. La experiencia será histórica, descriptiva y de laboratorio de evaluación retrospectiva. Encuestas recientes se muestran como mediciones publicadas, claramente diferenciadas de resultados y de predicciones.
6. **Rigor estadístico**: diferenciar porcentaje de voto, votos absolutos, censo, participación, abstención, escaños; votantes vs habitantes; correlación ecológica vs causalidad; diferencias porcentuales expresadas en puntos porcentuales, no en porcentajes cuando corresponda.
7. **Sin alterar las fases 1–4** salvo adaptaciones mínimas plenamente justificadas. No eliminar datos, tests o documentos existentes. No actualizar dependencias Python sin necesidad. Los datos originales deben seguir regenerables.
8. **Escritura y UX en español**; responsive real (móvil/tablet/escritorio), teclado, WCAG AA donde sea viable, etiquetas aria, focus visible, loading/empty/error states. Diseño propio, no dashboard genérico de tarjetas gigantes.

## OBJETIVO VISUAL / DIRECCIÓN DE DISEÑO

Construye una experiencia **editorial de periodismo de datos de alta calidad**, elegante y moderna:

- Fondo blanco roto o gris muy claro, títulos en tinta azul-negro, textos legibles, bordes sutiles, mucho aire, jerarquía tipográfica cuidada. Acento UI neutro (p.ej. pizarra/teal moderado) distinto de colores partidistas.
- Inicio con titular rotundo «España en las urnas», subtítulo sobre elecciones generales 1977–2023 y una composición editorial con un gran gráfico histórico interactivo + módulos de hallazgos comprobados, no cifras decorativas.
- Gráficos limpios de calidad periodística: tooltips con unidades, fuentes y año; hover; leyendas activas; opción de mostrar/ocultar series; evitar gráficos 3D, donuts vacíos y animaciones exageradas.
- Mapa provincial de España sólido, navegable y con Ceuta/Melilla legibles (inset si es necesario), sin requerir keys comerciales. Usa geometrías oficiales o de licencia compatible, con códigos territoriales normalizados. No inventes límites. Filtros sincronizados y leyendas de rangos reales.
- Navegación clara superior/lateral según breakpoint; URL con filtros persistentes en query params cuando tenga sentido; botón restablecer filtros; exportar CSV del subconjunto realmente mostrado, con procedencia.
- Mantener estilo coherente entre todas las páginas, con estados de carga cuidados, transiciones discretas y excelente legibilidad en pantallas de portátil.

### Stack recomendado

- **Next.js** App Router + **React** + **TypeScript** + **Tailwind CSS**. Instala versiones actuales estables compatibles después de consultar documentación oficial. No fuerces un pin anticuado.
- Componentes accesibles (por ejemplo shadcn/ui cuando encaje), iconos Lucide, buenas fuentes web sin licencias problemáticas.
- Gráficos: **Apache ECharts** con carga client-side selectiva, incluyendo gráficos temporales, barras comparativas, dispersión, heatmaps y mapas choropleth con GeoJSON; alternativamente una sola librería comparable si existe una razón clara. Evitar mezclar varias librerías para hacer lo mismo.
- Exportador Python desde Parquet/CSV de origen hacia artefactos públicos optimizados, tipados, validados y versionados para el frontend. Preferir preagregación **sin perder el acceso al detalle**. Para fase 5 prioriza una web que corra localmente sin backend Python permanente. Si la arquitectura real necesita API, justifica la decisión e integra lo mínimo sin rehacer el pipeline.
- No depender de secretos, APIs de pago ni servicios de pago para explorar los datos; la fase 6 decidirá hosting y actualizaciones.

## TAREA 0 — AUDITORÍA Y CONTRATO DE DATOS (OBLIGATORIA, ANTES DE UI)

1. Lee `README.md`, docs de fases 2–4, taxonomía, colores, `config/ml_phase3.json`, `config/ml_phase4.json`, cobertura y model cards, código de consultas y generación de features, y resultados CSV/Parquet.
2. Ejecuta `python -m pytest tests/ -q`, registra tests existentes y fallos; no asumas que la cifra 53 siempre será la misma.
3. Escribe `docs/PHASE5_DATA_CONTRACT.md` con inventario real (ubicación, campos, tipos, unidad, claves únicas, periodo, denominador, granularidad, nulos, licencia, versión/corte, transformaciones). Incluye correspondencia código provincial (incluidas Ceuta y Melilla), año/fecha y partido original/normalizado.
4. Define esquemas TypeScript/Zod —o validación equivalente— para los archivos consumidos. No inventes nombres de columnas: crea adaptadores Python a partir de columnas reales. Exporta solo información autorizada por licencias.
5. Implementa `src/electoral/export_web.py` (o equivalente integrado) que regenere los artefactos del frontend a partir de ficheros locales reales, sea idempotente, documente recuentos antes/después y falle claramente ante duplicados o incoherencias graves. Excluye archivos brutos sensibles, no publiques microdatos personales.
6. Escribe `docs/PHASE5_DATA_QA.md` con comprobaciones automáticas: totales de votos/porcentajes razonables sin forzar sumar 100% cuando los denominadores difieran, 81/81 candidaturas 2023, 1.778 etiquetas originales existentes, preservación de coaliciones, seis folds de ML, resultados 2026 ausentes y exportaciones sin duplicaciones involuntarias.
7. No bloquees todo el trabajo si un indicador concreto no se puede renderizar: documéntalo y muéstralo como no disponible, sin fabricarlo.

## PÁGINAS / NAVEGACIÓN — IMPLEMENTAR CON DATOS REALES

### 1) `/` — Portada / Visión general

- Portada «España en las urnas». Descripción neutral: estudio de resultados históricos y calidad de modelos retrospectivos.
- Gran serie histórica interactiva 1977–2023 de voto por partido/candidatura, año y métrica elegida. Selección inicial comprensible (partidos relevantes documentados), opción «Todos» accesible y búsqueda.
- KPIs derivados **del dataset** (última elección finalizada, electores, votantes, participación, escaños, partidos/candidaturas). Etiquetas inequívocas de fecha y fuente. No mezclar habitantes con electores.
- Tres puertas de exploración: Historia, Territorio, Laboratorio ML. Resumen de principales hallazgos ya documentados con sus fuentes, evitando conclusiones causales no justificadas.

### 2) `/historico` — Evolución del voto y de la participación

- Eje temporal de 16 elecciones: voto absoluto, cuota de voto, escaños, turnout, abstención, censo. Métricas separadas y explicación contextual.
- Multiselección/búsqueda de **cualquier candidatura**, filtro entre nombre original y taxonomía normalizada, filtros por ámbito geográfico y año. Opción «Todos» eficiente (scroll/virtualización/paginación según tamaño).
- Cambios entre dos elecciones seleccionadas (pp, votos y escaños) con cuidado cuando cambian partidos/coaliciones; no calcular continuidad ficticia.
- Tabla exportable con todas las candidaturas (incluidas 0 escaños y no mapeadas), ordenable y con cobertura de taxonomía explícita.

### 3) `/territorio` — Atlas provincial

- Mapa España de 52 circunscripciones, elección seleccionable; coloreado por turnout, abstención, censo, votantes, cuota de partido o variación entre comicios si hay comparabilidad.
- Para mapa de una magnitud continua usar escala secuencial/divergente legible; el color corporativo identifica al partido en leyenda/trazos cuando corresponda. No colorear falsamente los 52 territorios por el mismo partido cuando la métrica es económica/demográfica.
- Selección de provincia abre ficha con serie histórica y detalle electoral, partidos minoritarios incluidos. Mapa vinculable por filtros.
- Manejo correcto de códigos provinciales y de geometrías de Ceuta/Melilla, etiquetas y valores faltantes. GeoJSON acreditado.

### 4) `/partidos` — Catálogo y comparador

- Buscador de las 1.778 etiquetas originales, grupo de 36 partidos normalizados reportados (verificar cifra), candidaturas no mapeadas y confluencias/coaliciones.
- Verificación de partido original vs normalización, alias, vigencia y color; nunca reescribir categorías sin taxonomía documentada.
- Comparador de hasta 5 series seleccionadas para claridad, **sin prohibir acceso a las demás**; tabla completa accesible siempre. Atención especial a regionales, extraprovinciales y partidos históricos.
- Página de metodología de la taxonomía y cobertura nacional por elección.

### 5) `/encuestas` — Observatorio de sondeos

- Mostrar series realmente disponibles (2019–2026, comprobar cobertura), por instituto, fecha de campo, tipo de medición, partido, muestra, fuente y periodo; no suponer que todas las casas tienen datos de todas las fechas.
- Distinguir de modo inequívoco **estimación de voto** de **intención directa**; jamás promediarlas, compararlas como si midieran lo mismo ni presentarlas como resultados finales.
- Selector para 2023 (evaluación retrospectiva respecto del resultado oficial) y ciclo 2026 (mediciones publicadas, sin proyección propia); indicar fecha de última observación real del dataset.
- Identificar réplicas/no independientes y evitar contar cada réplica como una encuesta distinta; mostrar metodología de deduplicación y sesgos de cobertura.
- Gráficos de intervalos/dispersiones si las fuentes contienen datos suficientes; no inventar intervalos de confianza. La línea de resultados reales solo en elecciones celebradas.
- Fichas de procedencia con licencia/atribución correcta y enlaces existentes.

### 6) `/demografia` — Población y contexto socioeconómico

- Vista real **edad × provincia × elección** con categorías disponibles del INE; no inventes el tramo 0–17 u otros que no existan, y no uses población total como censo. Permite recorrer el año y la provincia y ver cobertura temporal.
- Panel de renta: **solo «renta per cápita» si esa magnitud existe realmente** en el dataset fuente, con definición/denominador exactos. Si hay renta por hogar u otra medida, usa su nombre correcto. Señala vacíos de cobertura, incluidos territorios forales donde aplique.
- Series de desempleo EPA, población, nacionalidad o indicadores disponibles. Indicadores con unidad (% población, euros, miles, puntos porcentuales, etc.) y fuente verificadas.
- Etiqueta explícita `vintage_ref` / `vintage_status`, fecha disponible en momento electoral vs actualización retrospectiva; nulos justificados, sin forward-fill entre cambios de metodología.
- Correlaciones históricas solo como análisis descriptivo, nunca como causalidad. Dispersión con n unidades y advertencia sobre correlación ecológica.

### 7) `/laboratorio-ml` — Resultados de Machine Learning

- Explicar la pregunta modelada: evaluación **retrospectiva** de participación provincial en elecciones pasadas, no previsión del 29N.
- Comparar `mean3` y los algoritmos ejecutados (Ridge, HGBR u otros que realmente figuren) con valores **importados de reports/tables/phase3/phase4**, nunca literales o simulados.
- Mostrar **6 folds temporales** y sus elecciones de test, MAE por fold, MAE macro y ponderado cuando existan, gráficos comparativos e intervalos solo si se calculan realmente.
- Explicar que 52 observaciones provinciales del mismo ciclo **no son 52 elecciones independientes**, que el número de elecciones es pequeño y que algunos indicadores tienen cobertura limitada.
- Panel «Mapa del error OOS»: por provincia y elección de test, condicionado a que exista CSV de predicciones fuera de muestra; si no, generar desde el backtest reproducible (sin fuga) o mostrar una limitación explícita.
- Panel «Vintage y disponibilidad»: qué variables eran realmente conocidas al `as_of_date` de cada experimento. No utilizar información futura.
- Una nota visible: en el informe de fase 4 el baseline `mean3` tuvo menor MAE macro que los modelos enriquecidos. La web reflejará el resultado real que lea del CSV y **no proclamará como ganador a un algoritmo complejo**.
- Apartado del piloto por partido y de sondeos: explicar que no se validó un corrector prospectivo y por qué; no añadir predicciones de voto para 2026.
- Acompañar gráficos de texto sencillo sobre MAE, validación temporal, overfitting y data leakage.

### 8) `/metodologia` — Transparencia y reproducibilidad

- Origen, fecha de actualización, cobertura, enlaces, licencias, integridad SHA si consta, definiciones, exclusiones, cambios de perímetro de partidos, reglas de normalización, ausencias y limitaciones.
- Explicación sin jerga excesiva de cómo se computan métricas, qué significa cada vintage y por qué no se presentan pronósticos.
- Enlace al repositorio GitHub **solo si su URL real está configurada**; no inventar URL.
- Documentación verificable, sin cifras no comprobadas o capturas de resultados fabricados.

## COMPONENTES COMPARTIDOS

- Selector de elección; selector territorial; buscador de partido/candidatura; multiselección; selector de métrica/unidad; selector de tipo de sondeo; tarjeta de procedencia; leyenda de colores real; gráficos con export CSV/PNG cuando viable; estados de vacío/error; breadcrumbs; controles accesibles.
- Soporta deeplinks (`?election=...&province=...&party=...`) y `reset` de filtros.
- Implementa desambiguación de nombres de partidos históricos sin imponerse sobre etiquetas originales.
- Respetar rendimiento: data slicing/aggregations sin perder «Todos», lazy load de charts, no enviar los 1.232 sondeos enteros a cada página si no son necesarios, memoización razonable, tamaños de bundle controlados.

## ORGANIZACIÓN RECOMENDADA DEL REPOSITORIO

Mantén el proyecto raíz Python. Crea `web/` con app Next.js, por ejemplo:

```
web/
  app/
    page.tsx
    historico/page.tsx
    territorio/page.tsx
    partidos/page.tsx
    encuestas/page.tsx
    demografia/page.tsx
    laboratorio-ml/page.tsx
    metodologia/page.tsx
  components/
  lib/
    data/
    charts/
    colors/
    types/
  public/data/       # SOLO artefactos públicos generados y versionados
  public/maps/       # SOLO geometrías licenciadas
  tests/
  package.json
  README.md
src/electoral/export_web.py
config/web_export.json
reports/tables/phase5/
docs/PHASE5_DATA_CONTRACT.md
docs/PHASE5_DATA_QA.md
docs/PHASE5_DESIGN_DECISIONS.md
docs/PHASE5_REPORT.md
```

Esquema flexible: adáptalo al repositorio real, explica cambios. El proyecto debe arrancar de forma sencilla en **PowerShell (Windows + VS Code)**.

## ORDEN DE EJECUCIÓN PARA CONTROLAR TIEMPO Y TOKENS

Trabaja en checkpoints verificables, con commits lógicos si el repositorio está limpio y Git configurado; no hagas push sin permiso:

1. **5A Auditoría/contrato/export**: comprueba 53 tests, genera data contract, export reproducible, QA de cobertura. Escribe un breve checkpoint en `docs/PHASE5_PROGRESS.md`.
2. **5B Shell visual + Historia + Todos**: crea `web/`, sistema visual, navegación, portada e histórico con tablas completas. Prioriza que un usuario pueda acceder a 81/81 candidaturas de 2023.
3. **5C Territorio + Partidos + Encuestas**: mapa real, taxonomía/colores, medidas correctamente separadas.
4. **5D Demografía + Laboratorio ML + Metodología**: incluye los dos paneles prerrequisito de fase 4 (edad×provincia×elección y renta bien definida con vintage) y comparativa honesta de modelos.
5. **5E Validación**: lint, TypeScript, build de producción, tests Python + tests web, test de navegación y filtros, documentación, capturas solo si el entorno permite verificar la app real. No avances a fase 6.

Si el entorno se queda sin tokens o se interrumpe, **deja notas de recuperación** precisas en `docs/PHASE5_PROGRESS.md` y termina el checkpoint en curso. Nunca declares la fase terminada si no has ejecutado los tests y el build.

## TESTS Y CRITERIOS DE ACEPTACIÓN (NO NEGOCIABLES)

### Datos

- `python -m pytest tests/ -q` sin regresiones frente a fase 4.
- Test de export sin pérdida de etiquetas/candidaturas originales; **al menos 81/81 de 2023**, manteniendo demás años. Test de distinción original-normalizado y de las coaliciones.
- Test de colores: PP azul, PSOE rojo, VOX verde exactamente desde el registro; verificaciones de que fallback no sobrescribe esos colores.
- Test de 2026: datos electorales finales inexistentes; no se produce CSV de predicciones futuras; las encuestas se etiquetan como mediciones.
- Test de serie demográfica, variables vintage y ausentes. Sin nulos convertidos a cero por defecto.
- Test ML: métricas representadas iguales a ficheros de informes, elección de fold y n correcto, exclusión de observaciones in-sample en el mapa OOS.
- Test de sondeos: intención directa vs estimación separadas, réplicas identificadas, filas de resultados oficiales no cuentan como encuestas.

### Web

- `npm install` (o gestor elegido), `npm run lint` (si existe), comprobación TS, `npm run build`, tests unitarios pertinentes y al menos pruebas manuales documentadas de los flujos críticos. Prioriza Playwright si está disponible; no mientas sobre tests E2E si no se ejecutan.
- Las **8 rutas** funcionan con datos reales; busca una candidatura minoritaria, añádela al gráfico y comprueba sus datos; escoge provincia y año; cambia unidad y vuelve a CSV; inspecciona MAE por fold; comprueba 2026 sin pronósticos.
- Responsive: verifica 375px, 768px y escritorio; evita overflow, tablas ilegibles y gráficos invisibles. Cuidado con contrastes y semántica accesible.
- Errores claros si falta artefacto generado; no fallback a mocks silenciosos.
- Verifica el tamaño de los artefactos públicos, performance razonable, atribuciones visibles y fuente real de geometría.

### Entregables finales

En `docs/PHASE5_REPORT.md` documenta:

1. Árbol de archivos añadidos/modificados y por qué.
2. Cómo regenerar los datos y lanzar la web en PowerShell (comandos **probados**).
3. Inventario y tamaño de datasets web; conteos antes/después; cobertura de 52 provincias y 1.778 etiquetas originales.
4. Captura o explicación de cada ruta con funcionalidades reales, y qué falta si no se implementó.
5. Lista de tests y build con resultados verdaderos.
6. Validación del ML y ausencia de nuevas predicciones.
7. Limitaciones, deuda técnica y tareas concretas de **fase 6: despliegue**.
8. Estado de 5A–5E; todo incumplimiento marcado PENDING.

## DEFINICIÓN DE «TERMINADO»

La fase 5 solo termina si la web compila, arranca localmente, muestra datos reales, permite consultar **todas las candidaturas** de forma accesible, usa el registro de colores, muestra mapas/encuestas/demografía con fechas/vintage, expone los modelos de ML como **backtesting histórico** y no como pronóstico, no rompe los 53 tests Python previos y tiene documentación para repetir los resultados. Si algo no cumple, indícalo claramente y no afirmes falsamente «completada».

**AHORA IMPLEMENTA LA FASE 5. No te quedes en un plan; inspecciona, desarrolla, ejecuta, corrige y entrega el informe. No hagas fase 6 ni despliegue público todavía.**
