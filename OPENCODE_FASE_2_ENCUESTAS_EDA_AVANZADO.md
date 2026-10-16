# OPENCODE — FASE 2: EDA AVANZADO, TODAS LAS CANDIDATURAS, ENCUESTAS Y PREPARACIÓN PARA ML

## Rol, contexto y jerarquía de instrucciones

Actúa como un equipo senior de **Data Engineering, Data Science, estadística electoral, visualización y QA**. Estás trabajando dentro del repositorio local ya desarrollado para **Observatorio Electoral España 2026**.

**Estado declarado por el usuario:** la FASE 1 (datos oficiales, calidad y EDA inicial) está terminada. Antes de modificar nada, **inspecciona y ejecuta sus artefactos reales**. No asumas que sus outputs existen, que funcionan o que contienen todas las columnas esperadas: compruébalo. Conserva cuanto funcione y corrige solo los problemas necesarios. No recrees el repositorio desde cero.

Lee primero si existen:
1. `PROMPT_OPENCODE_OBSERVATORIO_ELECTORAL_2026.md` (visión general)
2. `OPENCODE_FASE_1_DATOS_EDA.md` (criterios ya tratados)
3. `README.md`, `docs/SOURCES.md`, `docs/DATA_QUALITY.md`, `docs/EDA.md`, `docs/ML_FEASIBILITY.md`, el diccionario y los scripts reales.

**Este archivo prevalece sobre el orden de ejecución del prompt general. IMPLEMENTA SOLO LA FASE 2 y DETENTE.** No crees todavía la web React, la API FastAPI, la simulación D'Hondt ni modelos electorales destinados a estimar resultados de una elección futura. No publiques probabilidades propias de victoria ni ganadores previstos. La futura etapa de ML se centrará en evaluación retrospectiva verificable.

Fecha de referencia de partida del proyecto: 16-10-2026. Las generales previstas el 29-11-2026 aún NO tienen resultados. Distingue rigurosamente resultados oficiales históricos, datos demográficos, observaciones de encuestas y escenarios hipotéticos.

## OBJETIVO DE ESTA FASE

Pasar de un EDA inicial a un **laboratorio electoral sólido y reproducible** con:
- cobertura y análisis de **TODOS los partidos/candidaturas que figuren en los resultados oficiales**, incluidos minoritarios, regionales, históricos y candidaturas sin escaños;
- atención especial en los principales en la visualización, **sin excluir o borrar a los demás**;
- colores identificativos coherentes por partido, contrastados y documentados;
- una base de **encuestas publicadas y verificadas**, con su procedencia y metodología; y
- un dataset de características históricas con fechas correctas, que permita evaluar modelos retrospectivos en FASE 3.

### REQUISITO INNEGOCIABLE 1 — TODOS LOS PARTIDOS

**No aplicar umbrales mínimos de votos, porcentajes o escaños al ETL original ni a las tablas analíticas canónicas.** Cada candidatura oficial que exista en las fuentes debe permanecer identificada. No descartar las que logran 0 escaños. No convertir un resultado ausente en 0 votos.

- Mantén `candidacy_id`, `party_id` cuando la identificación esté respaldada, `original_name`, `original_acronym`, `election_id`, `territory_code`, `source_id`, además de votos/escaños disponibles.
- Diferencia candidatura de partido y coalición; una coalición puede competir bajo nombres y componentes diferentes según elección y territorio. **No unificar automáticamente** UCD/AP/PP, IU/Podemos/Sumar, ni coaliciones regionales. Si hay series agrupadas históricas, que sean **vistas opcionales** con diccionario de correspondencias, vigencia, fuente y advertencias, preservando siempre el original.
- Los partidos pequeños y territoriales tienen que poder explorarse. Añade una opción `Todos`, búsqueda por nombre/sigla, filtros por año/provincia/CCAA, selector de hasta N series y exportación íntegra de tablas conforme a licencias.
- En los gráficos comparativos evita ruido mostrando por defecto los **5–6 partidos de mayor voto nacional en la elección seleccionada** (o un criterio objetivo explícito). Permite también incluir las principales fuerzas de la provincia, formaciones con escaño y cualquier candidatura buscada. La lista destacada se recalcula por elección: nunca se fija para toda la historia basándose solo en los partidos actuales.
- El agrupador gráfico `Otros` es opcional, SOLO para representación; se calcula a partir de las filas originales y nunca sustituye ni elimina dichas filas. Ofrece el desglose accesible de `Otros`.
- Los filtros, gráficos y tablas deben tratar a todas las candidaturas de forma neutral y con las mismas definiciones estadísticas.

### REQUISITO INNEGOCIABLE 2 — COLORES IDENTIFICATIVOS

En **todos los gráficos existentes y futuros**, cada partido con identidad verificada debe utilizar de manera consistente su color corporativo/identificativo, independientemente del orden de la leyenda.

Referencias inequívocas de usuario:
- **PP = azul**.
- **PSOE = rojo**.
- **VOX = verde**.

También hay que investigar y documentar las gamas identificativas de otros partidos/coaliciones, por ejemplo Sumar, Podemos, IU, ERC, Junts, PNV, EH Bildu, BNG, Coalición Canaria, UPN, PACMA, Ciudadanos, CUP, etc., cuando estén presentes en los datos. No presupongas que la misma entidad o el mismo tono se mantiene de forma idéntica durante 50 años.

Implementa un **registro centralizado versionable de colores**, por ejemplo `config/party_colors.json` o `data/reference/party_branding.csv`, con como mínimo:
`party_id | display_name | hex_color | color_name | source_url | verification_status | notes | valid_from | valid_to`.

- Verifica el tono con identidad visual oficial cuando esté disponible. Si no hay código HEX oficial, selecciona uno visualmente representativo, marcándolo `representative` o `provisional` y registrando la fuente; nunca afirmes que un HEX inventado es corporativo oficial.
- La regla semántica PP azul/PSOE rojo/VOX verde debe cumplirse por test, con independencia del HEX exacto.
- Si faltan colores de candidaturas pequeñas: usa un color neutral de reserva **determinista** (no aleatorio entre ejecuciones), con etiqueta de color pendiente y nunca reasignes colores corporativos ajenos por azar.
- Para coaliciones cuya identidad visual no coincide con partidos integrantes, mantén registro propio y no heredes un color automáticamente.
- Prepara una función reutilizable `get_party_color(party_id, election_date=None)` que puedan consumir Plotly/Matplotlib y más adelante la API y React. Exporta un JSON de solo lectura desde la fuente central.
- Combinaciones de colores parecidos deben distinguirse además por grosor de línea, marcadores, etiquetado directo o patrones. No uses el color como único medio de transmitir información; garantiza buen contraste y versiones legibles en fondo claro/oscuro.
- Para porcentajes, votos absolutos y escaños del mismo partido, conservar color; distinguir **la métrica** por eje, anotación, tipo de gráfico, no por sustituir el color del partido.
- Comprueba con tests que el orden de partidos en un dataframe no altere su color.
- Aplica esta norma tanto a los gráficos del EDA inicial que sea necesario regenerar como a TODOS los nuevos gráficos de FASE 2. Deja una sección `Guía cromática electoral` en la documentación para la futura web.

## 1. AUDITORÍA INICIAL DE FASE 1 (OBLIGATORIA, ANTES DE DESARROLLAR)

1. Explora el árbol del repositorio, dependencias, comandos Python y outputs. Ejecuta los pipelines y los tests disponibles (o documenta bloqueos verificables).
2. Registra en `docs/PHASE2_BASELINE_AUDIT.md`: tablas, filas, cobertura, elecciones, territorios, número de candidaturas originales, tipos de datos, faltantes y problemas heredados.
3. Verifica especialmente si la tabla de FASE 1 contiene **todas las candidaturas**. Si se habían filtrado partidos por porcentaje o escaños, repara el pipeline y vuelve a generar salidas sin pérdida.
4. Verifica el alcance de los datos demográficos y electorales; no mezcles municipios, provincias y total nacional ni dupliques el censo por cada partido tras los joins.
5. Guarda el estado previo y la metodología de los cambios. No borres datos `raw/`, notebooks, README, commits ni análisis existentes.

## 2. NORMALIZACIÓN DE CANDIDATURAS, PARTIDOS Y TERRITORIOS

- Crea un catálogo trazable `party_registry` y una tabla `candidacy_party_mapping` con confianza/justificación, alias y fechas de validez; no confíes solo en matching difuso de siglas. Cualquier coincidencia ambigua va a revisión manual documentada.
- Un mismo acrónimo puede referirse a entidades diferentes a lo largo del tiempo; distintas siglas también pueden referirse al mismo partido, pero la relación requiere evidencia.
- Identifica separadamente: candidaturas originales, partidos con relación comprobada, coaliciones y agrupaciones analíticas de uso opcional. Documenta continuidad/discontinuidad histórica.
- Crea una tabla de controles de cobertura `party_coverage` por elección y por provincia (número de candidaturas, total de votos y porcentaje cubierto). Todo porcentaje de cobertura debe indicar denominador.
- Distingue correctamente unidades de porcentaje: sobre votos válidos, votos a candidaturas, electores u otras definiciones documentadas. El EDA debe poder indicar cuál utiliza.
- Usa claves de territorio textuales que conserven ceros y evita conteos nacionales dobles. No infieras votos provinciales de porcentajes nacionales.

## 3. INGESTA Y REGISTRO DE ENCUESTAS (PRIORIDAD ALTA)

Investiga y consume **fuentes primarias verificables** y condiciones de uso antes de reutilizar datos. Empieza por CIS y amplía a encuestadoras y medios que publiquen datos explotables legalmente. Recursos de exploración:
- CIS: https://www.cis.es/es/estudios/catalogo y https://www.cis.es/es/catalogo-estudios/fid/acceso-a-datos
- CIS, estudiar fichas, tablas y microdatos disponibles, diferenciando estimación de voto e intención directa.
- Contraste editorial: https://www.ondacero.es/elecciones/generales/encuestas/
- Investigar fichas publicadas de 40dB, Sigma Dos, Sociométrica, GAD3, NC Report, DYM, Invymark, GESOP, Target Point, Celeste-Tel, Ipsos, IMOP y otras si existe acceso público reutilizable.

**NO supongas** que un artículo de prensa es una API ni que un agregador autoriza redistribuir todos sus datos. No eludir paywalls, captchas ni `robots.txt`, y no realizar scraping masivo contrario a condiciones. No inventar porcentajes o fichas.

Esquema mínimo:
- `polls`: `poll_id`, `pollster`, `sponsor_or_media`, `source_url`, `methodology_url`, `fieldwork_start`, `fieldwork_end`, `published_at`, `sample_size`, `sample_universe`, `sample_mode`, `scope`, `question_type`, `data_version`, `license_status`, `retrieved_at`, `quality_flag`.
- `poll_estimates`: `poll_id`, `candidacy_or_party_id`, `reported_label`, `value_pct`, `estimate_type` (`direct_intention`, `estimated_vote`, `other_explicit`), `original_value`, `source_url`, `mapping_status`.

Normas:
- Granularidad de cada encuesta explícita: generales al Congreso, total estatal o territorio indicado; no mezclar autonómicas, europeas ni municipales con generales.
- Fecha de campo y fecha de publicación SON distintas. Jamás usar en un backtest una encuesta publicada después de la fecha de corte, incluso si el trabajo de campo terminó antes.
- Para cada sondeo, preservar casa encuestadora, patrocinador, tamaño muestral y metodología, incluso cuando falten campos (dejar `null`, no inventar).
- Una categoría publicada como `Otros` o `Resto` se conserva como `poll_reported_other`, sin repartir artificialmente entre partidos.
- Si una casa encuesta solo PP/PSOE/VOX/etc., los demás NO se convierten en cero: `not_reported`.
- No mezclar porcentajes de intención directa con estimaciones de voto ni presentar como equivalentes sondeos con universos distintos.
- Revisar duplicados de la misma encuesta replicada por múltiples medios, identificando `canonical_poll_id` y URLs secundarias.
- Registrar licencias o permisos: `reusable`, `attribution_required`, `manual_review`, `restricted`, `unknown`.
- Para fuentes sin ingesta legal automatizable: crear `data/templates/polls_manual_template.csv`, un validador y `docs/POLL_SOURCES_PENDING.md` con URL, acción pendiente y prioridad. No poblar con estimaciones ficticias.
- Guardar proveniencia/hash del original cuando la descarga sea lícita, fecha de consulta y versión.
- **Cobertura incompleta es aceptable si está cuantificada y explicada**. No declarar la base «todas las encuestas» si solo se pudo validar una fracción.

## 4. EDA AVANZADO REPRODUCIBLE: NARRATIVA Y GRÁFICOS

Implementa scripts CLI y notebooks claros, con outputs en `reports/figures/phase2/` y tablas en `reports/tables/phase2/`. Exporta PNG/SVG o HTML según el caso, usando una librería de gráficos compatible con el repo y **el registro cromático** anterior. Nada de mockups: usa solo datos reales comprobados.

**Gráficos/investigaciones obligatorias según disponibilidad:**
1. Evolución histórica nacional de votos absolutos por candidatura/partido con selección `top N` + `Todos` + búsqueda. No cortar candidaturas en los datos aunque la visualización muestre menos.
2. Evolución de cuota de voto (% con denominador claro) y escaños para candidaturas comparables; señalar rupturas de siglas/coaliciones.
3. Cambio entre dos elecciones en votos y puntos porcentuales para PP, PSOE, VOX y otras principales *cuando estuvieran presentes*, así como opción de cualquier candidatura. Si no existía un partido, indicar no comparable, no inventar 0 histórico.
4. Ranking descriptivo **de votos o escaños observados**, por elección y territorio, incluyendo todas las candidaturas en tabla; evitar rankings evaluativos de partidos.
5. Concentración territorial y contrastes entre provincias, incluidas fuerzas territoriales; no inferir comportamiento individual a partir de agregados.
6. Participación, abstención, electores, crecimiento poblacional y dispersión provincial con metodología temporal explícita. Describir efectos matemáticos de cambios de denominador.
7. Participación frente a indicadores demográficos/económicos disponibles y comparables; medidas de asociación, gráficos de dispersión, tamaño de muestra y advertencias de causalidad.
8. Serie de encuestas por casa y por partido, distinguiendo `estimated_vote` vs `direct_intention` y fechas de publicación/campo.
9. Comparación de dispersión entre encuestadoras solo para periodos, tipos de estimación y ámbitos comparables, documentando posibles «house effects» sin atribuir intenciones políticas.
10. Calidad y cobertura: heatmaps/tablas por partido, provincia, año, encuestadora, datos ausentes y tipos de fuente.
11. Si hay encuestas históricas anteriores a alguna elección ya celebrada: gráficos de distancia de cada observación respecto del resultado oficial (con comparabilidad de candidatura y ámbito). Si no existen datos históricos suficientes, documentarlo y no fabricar curvas.

Cada gráfico y tabla debe ofrecer: título descriptivo, ámbito geográfico, fecha/periodo, eje y unidad, denominador, fuente, fecha de consulta y nota sobre series no comparables. Tablas grandes en CSV/Parquet accesibles; las imágenes son un subconjunto visual.

Crea `docs/EDA_PHASE2.md` con **al menos 8 hallazgos descriptivos verificables** y su cifra reproducible, gráfico/tabla correspondiente, hipótesis a contrastar y limitaciones. Si una dimensión carece de datos, registra ese hueco como pregunta de investigación; no inventar hallazgos para llegar a ocho.

## 5. FEATURES HISTÓRICAS Y PREPARACIÓN DE MACHINE LEARNING — SIN ENTRENAR MODELOS AÚN

Construye un pipeline de características históricas **solo con datos conocidos en cada fecha de corte** (`as_of_date`) y añade tests de ausencia de fuga temporal.

Datasets propuestos:
- `turnout_features.parquet`: elección, provincia, censo conocido, participación en elecciones anteriores, cambios demográficos publicados a fecha válida, contexto económico histórico si está disponible antes de cada elección.
- `party_evolution_features.parquet`: evolución retrospectiva por candidatura/partido comparable y provincia, cobertura, participación previa, ausencia/presencia del partido en la elección y cambio medible cuando sea semánticamente válido. No crear una fila con target futuro conocido en las features.
- `poll_features.parquet`: cortes históricos, encuestadora, partido/ámbito, fecha publicación, días hasta elección, estimación/intención directa y metadatos. Solo si realmente hay cobertura válida.

Define a nivel de código y en `docs/ML_DATASET_DESIGN.md`:
- `as_of_date`, `target_election_date`, `feature_available_at`, `data_published_at`, fechas de vigencia y reglas de censura;
- target(s) históricos: cambio de participación provincial, error de una encuesta histórica respecto a resultado posterior, cambios de voto de candidaturas comparables, solo con suficiente cobertura;
- estrategia de train/validation/test por **elección completa** y *rolling/expanding window*, sin split aleatorio de provincias dentro de la misma elección para simular capacidad predictiva temporal;
- baselines propuestos (última participación conocida, última cuota de voto de entidad históricamente comparable, valor publicado de encuesta), condiciones de aplicabilidad y métricas MAE/RMSE en puntos porcentuales;
- tamaños muestrales efectivos, faltantes, partidos nuevos, cambios de denominación y advertencias de inferencia ecológica;
- propuesta de modelado centrada en backtesting, incertidumbre y capacidad de generalización, sin presentar un resultado futuro como predicción confiable.

**No entrenes modelos complejos todavía.** El resultado de esta fase es comprobar si existe información suficiente y una buena metodología para entrenar/evaluar en FASE 3.

## 6. TESTS Y CALIDAD MÍNIMA

Añade tests automatizados para:
- Conservación de **todas las filas válidas** de candidaturas originales desde raw a processed; ninguna desaparece por tener pocos votos o ningún escaño (comparar recuentos tras exclusiones de duplicados justificadas).
- Coherencia sumas de votos por partido respecto a resultado/candidatura original sin dobles conteos; separación de nivel nacional/provincial.
- No duplicación de censo/población al unir con resultados por candidatura.
- Identificación de siglas ambiguas, mapping versionado y coaliciones diferenciadas.
- Registro de color estable y lookup por fecha; PP azul, PSOE rojo, VOX verde; formato HEX válido; fallback determinista; estabilidad al ordenar dataframe.
- Encuestas: porcentajes entre 0–100 cuando corresponda; fuente y fechas válidas; no utilizar `null` como 0; distinguir direct intention de estimated vote; detectar duplicados por encuesta republicada.
- Prohibición de introducir en las features información publicada DESPUÉS de `as_of_date`.
- Consistencia del cálculo de cambios en **puntos porcentuales** y cambios absolutos.
- Capacidad de listar todas las candidaturas aun cuando una gráfica muestre `top N`.

Usa fixtures de tests explícitamente sintéticos e independientes de la red, y al menos un test de integración con datos reales solo cuando estén disponibles. Ejecuta `pytest` y registra comando, número de tests, fallos y warnings. Si algo no es evaluable, indícalo como `not_evaluable`.

## 7. ENTREGABLES Y DOCUMENTACIÓN

Adapta nombres a la estructura real del repo, pero genera equivalentes funcionales de:

- `docs/PHASE2_BASELINE_AUDIT.md` — inspección comprobada de fase 1;
- `docs/PARTY_TAXONOMY.md` — originales, alianzas, alias, reglas de conciliación y casos ambiguos;
- `config/party_colors.json` + `docs/PARTY_COLORS.md` — colores verificables y guía para gráficos/React;
- `data/processed/party_coverage.parquet` — auditoría de candidaturas y territorios;
- `data/processed/polls.parquet` y `data/processed/poll_estimates.parquet` — SOLO cuando se hayan validado fuentes reales;
- `data/templates/polls_manual_template.csv` + validador, si hay fuentes pendientes;
- `docs/POLL_SOURCES_PENDING.md` — fuentes y condiciones de ingesta;
- `docs/EDA_PHASE2.md` — hallazgos, gráficos, tablas y limitaciones;
- `docs/ML_DATASET_DESIGN.md` — features/cortes temporales y diseño del futuro backtest;
- `reports/figures/phase2/`, `reports/tables/phase2/` — gráficos y tablas reproducibles;
- CLI para auditoría, ingestión de encuestas, regeneración de gráficos y features;
- Tests `pytest` para lo anterior;
- `README.md` actualizado con comandos **PowerShell** exactos y funcionamiento con las dependencias actuales.

No agregar paquetes o infraestructura pesada sin motivo. No sobreescribir artefactos válidos de FASE 1. No subir microdatos de uso restringido al repositorio público.

## 8. CRITERIOS DE ACEPTACIÓN Y ORDEN DE TRABAJO

1. **Inspección real** del repositorio, outputs de FASE 1 y estado de `pytest`.
2. Reparación, si hace falta, de la conservación de todas las candidaturas.
3. Catálogo de partidos, alias, coaliciones, colores verificados y función cromática central.
4. EDA profundo de voto y participación de TODOS los partidos; visualizaciones legibles destacando los principales.
5. Auditoría y recopilación legal de encuestas reales, sin rellenar huecos ficticios.
6. EDA de encuestas, cobertura y comparación de casas cuando exista material suficiente.
7. Features históricas con cortes temporales y documentación de validación futura.
8. Ejecutar tests, regenerar outputs reales y actualizar README.

**No des por finalizada la fase si los resultados oficiales disponibles pierden candidaturas minoritarias, si PP/PSOE/VOX cambian arbitrariamente de color o si la ingesta de encuestas afirma tener datos que realmente no verificó.** Si alguna fuente externa falla, informa cobertura y bloqueos; completa el resto de forma funcional.

## 9. RESPUESTA FINAL OBLIGATORIA DE OPENCODE — Y DETENTE

Al terminar, presenta en español:
1. Árbol de archivos modificados/añadidos y descripción breve.
2. Cobertura real: número de elecciones, provincias, candidaturas originales, partidos normalizados, rango temporal y diferencias respecto a fase 1.
3. Demostración de que **todos los partidos** permanecen: consultas/ejemplos incluidos minoritarios y regionales; explica cualquier exclusión legítima por registros corruptos o duplicados.
4. Tabla de colores aplicada, al menos PP, PSOE y VOX, otros relevantes, con URL que justifique cada color o marca de provisionalidad.
5. Encuestas disponibles de verdad: encuestadoras, número de sondeos distintos, fecha mínima/máxima, valores capturados, licencias y pendientes.
6. Gráficos generados (rutas), 8 hallazgos sustentados si existen datos suficientes y limitaciones.
7. Tablas de features creadas, corte temporal y evaluación de leakage.
8. Tests realmente ejecutados: comandos, conteos y errores o bloqueos.
9. Comandos PowerShell exactos para reproducir todo.
10. Recomendación técnica sobre la factibilidad de la **FASE 3: ML retrospectivo**, indicando las carencias de datos antes de entrenar.

**DETENTE al terminar esta FASE 2. No crees aún React ni entrenes modelos complejos, no uses datos ficticios y no generes pronósticos propios de ganadores/resultados futuros.**
