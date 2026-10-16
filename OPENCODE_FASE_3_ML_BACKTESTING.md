# OPENCODE — FASE 3: MACHINE LEARNING RETROSPECTIVO, BACKTESTING Y VALIDACIÓN ESTADÍSTICA

## 0. Rol, contexto y alcance

Actúa como un equipo senior de **Data Science, estadística, ML engineering y QA** especializado en series temporales y validación histórica. Estás dentro del repositorio existente de **Observatorio Electoral España 2026**. La prioridad es la **calidad científica de los datos, el control de fugas temporales, la reproducibilidad y la interpretación honesta de los errores**, no entrenar muchos algoritmos por apariencia.

Esta es **SOLO LA FASE 3**. No desarrolles React, dashboards web, FastAPI, simulador de escaños ni pronósticos de una elección futura. No presentes un ganador futuro, porcentajes de voto o probabilidades de victoria como resultados del proyecto. El objetivo es medir retrospectivamente lo que habría sido posible conocer *antes* de cada elección celebrada.

Lee primero, si existen, y respeta el repositorio real:
- `PROMPT_OPENCODE_OBSERVATORIO_ELECTORAL_2026.md` (visión del proyecto).
- `OPENCODE_FASE_1_DATOS_EDA.md` y `OPENCODE_FASE_2_ENCUESTAS_EDA_AVANZADO.md`.
- `README.md`.
- `docs/PHASE2_BASELINE_AUDIT.md`, `docs/ML_DATASET_DESIGN.md`, `docs/EDA_PHASE2.md`, `docs/PARTY_TAXONOMY.md`, `docs/PARTY_COLORS.md`, `docs/POLL_SOURCES_PENDING.md`.
- `src/electoral/`, `tests/`, datos reales en `data/processed/` y `data/raw/` y las dependencias actuales.

**Este prompt tiene prioridad para el alcance de FASE 3.** No reconstruyas el proyecto ni borres los resultados de las fases anteriores. Si observas problemas, aplica cambios mínimos, testados y documentados. Trabaja y contesta en español.

### Estado comunicado por el usuario al finalizar FASE 2 (NO lo des por verificado hasta auditar)
- 16 elecciones (1977–2023), 52 provincias.
- 1.778 etiquetas de candidaturas originales; 36 partidos normalizados; 477 etiquetas mapeadas; cobertura por voto mapeado del 75–99 % según elección.
- Opción `Todos` con 81/81 candidaturas para 2023; candidaturas minoritarias y territoriales preservadas.
- Colores: PP azul `#1B5FCC`, PSOE rojo `#E30613`, VOX verde `#5CB531`, registro central y `get_party_color()`.
- 1.232 sondeos extraídos (774 del ciclo 2026, 458 del ciclo 2023); 12.945 estimaciones, 36 casas, fechas de campo 2019-12-12 a 2026-10-11. Se han distinguido `estimated_vote` (832 sondeos) y `direct_intention` (400 sondeos).
- 8 filas de resultados electorales identificadas y apartadas de encuestas.
- Tablas de features: participación 780 filas, evolución de partidos 8.736, encuestas 10.316, targets de encuestas 1.346.
- 33 tests superados en fase 2.

**Advertencia central que debes confirmar:** las encuestas de campo comienzan en diciembre de 2019. Por tanto, de las elecciones generales ya celebradas, estas series parecen permitir contrastar principalmente **2023**; las observaciones de 2026 aún no disponen de resultado electoral. Que existan miles de filas o centenares de sondeos NO equivale a contar con muchas elecciones históricas independientes. No anuncies validación generalizada de modelos de voto ni entrenes/calibres contra 2023 y evalúes otra vez contra 2023 como si fuese una prueba fuera de muestra.

## 1. Principios no negociables

1. **Todas las candidaturas se conservan**: incluye históricas, territoriales, minoritarias y con cero escaños. Los gráficos pueden mostrar por defecto un subconjunto objetivo y ofrecer `Todos`, pero no alteran ni filtran destructivamente las tablas canónicas. Conserva `original_name`, `candidacy_id` y mapeos trazables. No hagas imputaciones silenciosas de voto cero.
2. **Colores partidarios consistentes**: reutiliza el registro y `get_party_color()`; PP siempre azul, PSOE rojo, VOX verde. Otros colores según catálogo con provisionales identificados; nunca redefines arbitrariamente el color por orden de leyenda. Compatibilidad con gráficos en fondo claro/oscuro y diferenciación adicional sin depender exclusivamente del color.
3. **No mezclar unidades**: voto porcentual, puntos porcentuales, censo, electores, participación, muestras de encuestas y número de escaños son magnitudes distintas. Indica denominador, nivel territorial y fuente.
4. **Datos y métricas reales**: sin resultados, estadísticas, tests ni datasets inventados. Los tests unitarios pueden usar fixtures sintéticos explícitamente marcados como tales, pero ningún ejemplo sintético debe mezclarse con un output analítico real.
5. **Reproducibilidad**: ejecución reproducible desde PowerShell, dependencias versionadas de forma razonable, semillas fijas cuando proceda, configuración central y tablas de predicciones históricas fuera de muestra.
6. **Sin pronósticos electorales futuros** en esta fase. Solo resultados históricos observados, simulaciones hipotéticas claramente identificadas (si ya existieran; no crear ahora) y backtests de elecciones pasadas.
7. **Interpretabilidad y límites** por encima de complejidad. Si no existe muestra independiente suficiente para un modelo, escribe `NO VIABLE CON ESTOS DATOS` y explica la razón, en vez de forzar un entrenamiento.

## 2. Auditoría de arranque — primero inspecciona y ejecuta

Antes de cambiar código:
- Inspecciona árbol, scripts, esquemas Parquet/CSV, número de filas, años/ciclos realmente disponibles y tests. Ejecuta `python -m pytest tests/ -q` y registra sus resultados efectivos.
- Comprueba que las **33 pruebas existentes** siguen pasando, si están disponibles.
- Reconcilia tablas y fechas de `polls`, `poll_estimates`, `poll_features`, `poll_targets`, `turnout_features` y `party_evolution_features`.
- Verifica la trazabilidad de las encuestas: ID estable de sondeo, fuente, fecha de campo, fecha de publicación, ámbito, casa, tipo (`estimated_vote` o `direct_intention`), partido/candidatura y resultado histórico asociado solo cuando sea válido.
- Compara las filas de resultados apartadas con las originales: deben estar excluidas completamente del conjunto de encuestas. Detecta encuestas republicadas y duplicados técnicos; no cuentes réplicas como observaciones independientes.
- Revisa el estado de taxonomía: 477 de 1.778 etiquetas mapeadas puede ser suficiente para algunas series principales, **pero no para afirmar que todos los partidos están normalizados**. Evalúa cobertura de votos por elección/territorio; las series incompletas se etiquetan como tales, y nunca se suman como total nacional de todos los partidos.
- Distingue cobertura histórica de votos de los partidos mapeados de conservación íntegra de las filas originales. Ninguna de las dos implica la otra.
- Audita fechas de disponibilidad de TODAS las features utilizadas, incluidas las transformaciones, publicaciones estadísticas y valores económicos/demográficos si existen.

Genera `docs/PHASE3_DATA_AUDIT.md` con el estado real, muestras efectivas por elección, cobertura, campos críticos, fuentes y bloqueos. Este archivo debe reflejar ejecuciones y datos realmente observados.

## 3. Decisión de viabilidad por tarea (gates obligatorios)

Crea una matriz en `docs/PHASE3_FEASIBILITY.md` para estos tres trabajos, con **GO / GO CON RESERVAS / NO GO** y razones verificables:

**A. Participación provincial en elecciones históricas** (trabajo principal): un histórico de elecciones por provincia puede ser útil si se valida por elección completa, con features disponibles antes de la elección objetivo. Es el primer experimento.

**B. Error/dispersión de encuestas frente al resultado de 2023** (trabajo secundario): hacer evaluación descriptiva retrospectiva por partido, casa y anticipación temporal de encuesta, **no fingir que existe una validación cruzada entre muchas elecciones independientes**. Solo entrenar un corrector de sesgo/house-effect si hay al menos varias elecciones etiquetadas independientes antes de la elección usada como test; con los datos comunicados, probablemente NO se cumple. Un ajuste entrenado y evaluado contra el mismo resultado de 2023 no tiene validez predictiva fuera de muestra.

**C. Voto por partido / cambio en cuota provincial** (exploratorio, condicionado): el alto número de filas no compensa la escasez de ciclos ni rupturas de partidos/coaliciones. Solo modelar retrospectivamente una entidad **históricamente comparable** con suficiente profundidad y splits temporales defendibles; de lo contrario, dejar análisis descriptivo y un plan de datos faltantes. No agrupar PP/AP/UCD ni IU/Podemos/Sumar como si fueran una única entidad.

Para cualquier línea NO GO: documenta qué fuentes o cuántas elecciones etiquetadas adicionales harían falta. No ejecutes un modelo sofisticado por cumplir una lista.

## 4. Experimento principal: participación histórica por provincia

### 4.1 Preparar target y features
- Objetivo recomendado: participación provincial observada en **porcentaje**, o cambio en **puntos porcentuales** respecto a la elección general anterior, documentando cuál eliges y su conversión.
- Unidad analítica: `(election_id, province_code)` con 52 circunscripciones, y únicamente ciclos celebrados cuya serie sea comparable. Evita duplicaciones por partido o por joins demográficos.
- Features permitidas: participaciones anteriores de la misma provincia, medias/variabilidad histórica construidas solo con pasado, censo conocido para el corte cuando la publicación esté justificada, cambios de electores si se pueden conocer a tiempo, rasgos geográficos estables y otras variables cuya fecha de disponibilidad esté acreditada. Si una feature no tiene procedencia temporal documentada, exclúyela.
- Nunca incluyas participación de la elección objetivo, votos contemporáneos, variables derivadas del resultado de esa elección, año objetivo codificado como acceso encubierto al resultado, estadísticas calculadas sobre toda la serie o datos publicados con posterioridad al corte.
- Define claramente si los porcentajes incluyen Ceuta/Melilla y cómo se trata cualquier reforma o interrupción de comparabilidad.
- Maneja `NaN` en pipelines ajustados SOLO sobre train. No sustituyas missing por cero salvo que cero tenga significado auténtico.

### 4.2 Baselines obligatorios
Implementa como mínimo:
1. `last_election`: participación de la elección anterior en la misma provincia.
2. `historical_mean` o `recent_k_mean`: media de las últimas K elecciones de la provincia, con K configurable y datos estrictamente anteriores.
3. Un baseline simple adicional motivado (por ejemplo tendencia histórica por provincia, si tiene sentido).

Compara al menos con:
- `Ridge`/`ElasticNet` con pipeline de preprocesamiento;
- `HistGradientBoostingRegressor` o `RandomForestRegressor` con hiperparámetros conservadores;
- Otros algoritmos solo si aportan una hipótesis estadística clara y no requieren complejidad/infraestructura desproporcionada.

No es obligatorio usar XGBoost/LightGBM ni redes neuronales. Evita tuning masivo cuando el número de ciclos independientes es pequeño.

### 4.3 Backtesting temporal estricto
- **Nunca** uses `train_test_split` aleatorio entre provincias de la misma elección para simular predicción futura.
- Implementa **expanding-window backtesting**: para cada elección de prueba, entrena solamente con elecciones anteriores, ajusta preprocesado y cualquier hiperparámetro sin mirar resultados de test y evalúa sobre TODAS las provincias de la elección de prueba.
- Prueba varias elecciones históricas sucesivas (mínimo 3 si la cobertura temporal lo permite), documenta exactamente qué elecciones forman train/validation/test. Si no hay suficientes, informa la limitación.
- No entrenes con una provincia de una elección y pruebes con otra provincia de esa misma elección como evidencia de extrapolación temporal.
- Si haces tuning, nested temporal CV o holdout temporal exclusivamente dentro de train; configura `random_state` y registra parámetros elegidos.
- Genera `predictions_oos` con `train_last_election`, `test_election`, `province`, `model`, `y_true`, `y_pred`, `error_pp`, `n_train_elections`, `n_train_rows`, `as_of_date`, y sello de ejecución/configuración.

### 4.4 Métricas y evaluación
- MAE (puntos porcentuales), RMSE (puntos porcentuales), sesgo medio firmado, mediana de error absoluto y distribución de errores.
- Métricas **por elección retenida**, agregación macro (cada elección cuenta una vez), y si procede comparación ponderada por censo con denominador explícito.
- Para muestras correlacionadas, no interpretes las 52 provincias como 52 elecciones independientes. Intervalos de incertidumbre por bloques de elecciones solo cuando el número de bloques lo permita; no inventes precisión con bootstrap por filas.
- Tabla de mejoras/deterioros contra `last_election` y `recent_k_mean`, especialmente en las elecciones retenidas. Si ML no supera baselines de forma consistente, declara que no añade valor demostrado.
- Diagnósticos por provincia/elección, residual vs valor observado, historial de MAE y dependencia de los ciclos.
- Análisis de importancia de variables solo sobre splits apropiados, usando permutation importance sobre holdout cuando exista; no inferir causalidad ni motivaciones individuales a partir de datos agregados.

## 5. Encuestas: análisis retrospectivo y gate de modelado

- Comprueba el número de **elecciones generales ya celebradas** con encuestas previas, comparables, fechadas y con target oficial. No confundas 1.346 filas de targets con 1.346 eventos independientes.
- Mantén separados `estimated_vote` y `direct_intention`; nunca los promedies directamente como una sola variable sin metodología validada.
- Excluye completamente filas de resultado incrustadas entre encuestas.
- Calcula diferencias en puntos porcentuales respecto al resultado oficial de elecciones celebradas, solo cuando la candidatura/coalición, territorio y denominador sean equiparables. Los partidos nuevos o perímetros distintos se señalan `not_comparable`.
- Tablas de error bruto de sondeos por partido, casa, periodo hasta elección y tipo de encuesta. Diferencia estimaciones, intención directa y resultados oficiales. Evita presentar diferencias simples entre intención directa y estimación como «sesgo» de casa sin controlar la metodología.
- Si solo hay **una elección objetivo etiquetada (2023)**, **NO entrenes un corrector de sesgo generalizable** ni declares backtesting multi-elección. Genera únicamente un diagnóstico retrospectivo 2023 con cobertura y límites. Deja diseño para modelos futuros y requisitos de datos para hacerlos defendibles.
- Si descubres varias elecciones etiquetadas verificadas y comparables, plantea un verdadero leave-one-election-out/rolling origin y documenta en detalle su validez. No transformes ciclos 2023 y 2026 en dos elecciones etiquetadas cuando 2026 todavía no tiene resultado.
- Si citas números sobre encuestas, conserva encuesta original, fuente, fechas, tipo y fecha de consulta; no atribuyas automáticamente permisos de reutilización de Wikipedia a las fuentes primarias ni ignores atribución/licencias de una recopilación secundaria.

## 6. Evolución de voto por partidos: análisis sin pérdida de minoritarios

- Parte de todas las candidaturas oficiales. El catálogo normalizado es una **vista** parcial mientras existan etiquetas no mapeadas.
- Si planteas regresión retrospectiva para alguna serie comparable, justifica con datos: número de elecciones etiquetadas, continuidad histórica, cambios de alianzas, cobertura territorial, y al menos varios tests de elecciones completas con entrenamiento en el pasado.
- Permite que partidos principales destaquen en gráficos **sin eliminar ningún partido** del dataset o de exportaciones. Incluye agrupación visual `Otros` solo con desglose íntegro accesible.
- Si la evidencia no permite un modelo defendible, **no entrenes**: describe el obstáculo en `docs/PHASE3_FEASIBILITY.md` y crea una propuesta concreta de ampliar datos.

## 7. Ingeniería, estructura y artefactos

Adáptate a las rutas existentes. Propuesta de entregables:
- `src/electoral/ml/` o equivalente con preparación, baselines, backtest, métricas, visualización y comprobación de leakage, sin refactorizaciones innecesarias de fases 1–2.
- `config/ml_phase3.yaml` o JSON equivalente: seed, fechas de holdout, features, modelos, hiperparámetros y umbrales de suficiencia de datos.
- `data/processed/ml_phase3/` para tablas derivadas verificables y claves temporales, si es coherente con el repositorio.
- `reports/tables/phase3/turnout_backtest.csv`, `turnout_predictions_oos.csv`, `poll_2023_diagnostics.csv` cuando las tablas puedan elaborarse con datos reales.
- `reports/figures/phase3/`: error por elección, modelo vs baseline, residuos, y gráfico de encuestas de 2023 con distinción de tipos y fuentes. Reutiliza colores corporativos por partido en todas las figuras sobre voto.
- `docs/PHASE3_DATA_AUDIT.md`, `docs/PHASE3_FEASIBILITY.md`, `docs/PHASE3_BACKTEST_REPORT.md`, `docs/PHASE3_MODEL_CARD.md` y actualización puntual de `README.md`.
- Guardado opcional de pipelines/modelos con versiones y metadatos, **solo si tienen valor para reproducir el backtest**. No serialices entrenamientos que necesiten datos futuros o secretos.
- Scripts/CLI de ejecución modular: comprobar inputs → construir features elegibles → baselines → backtest → diagnósticos de encuestas → informe/gráficos → tests.

Los informes deben diferenciar **mediciones de laboratorio retrospectivas** de proyecciones, documentar por qué una mejora aparente puede deberse a pocos ciclos, comparar con baselines y explicar qué parte se puede comunicar de forma honesta en portfolio.

## 8. Pruebas obligatorias

Añade tests sin romper los existentes:
1. Un ejemplo fabricado en tests con fuga conocida debe FALLAR por incluir una feature publicada después de `as_of_date` o resultado objetivo.
2. Garantiza que todo `test_election_date` sea posterior a la última fecha de entrenamiento y que todas las provincias de una elección estén en el mismo fold.
3. Preprocesado, imputación, escalado y selección de variables se ajustan solo a training en cada fold.
4. Reproducibilidad con misma semilla/configuración y determinismo cuando sea factible.
5. Baseline `last_election` coincide exactamente con el valor histórico anterior, nunca con el actual.
6. MAE/RMSE y conversiones a puntos porcentuales correctos con fixtures manualmente comprobables.
7. Un mismo sondeo republicado no debe contarse varias veces como evento independiente; filas de resultados no se incorporan a encuestas.
8. Intención directa y estimación de voto no se mezclan silenciosamente.
9. Partido nuevo / coalición con perímetro alterado no se considera comparable automáticamente; partidos minoritarios preservados.
10. Colores PP/PSOE/VOX semánticamente correctos y todas las figuras electorales respetan el registro central.
11. Resultados reales de 2026 NO se asumen existentes ni se incorporan como etiquetas de entrenamiento.
12. Los tests de fases 1 y 2 siguen pasando.

Ejecuta realmente `python -m pytest tests/ -q`; registra el número final de tests, fallos, advertencias y comandos de reproducción en Windows PowerShell. No escribas «tests passed» sin ejecutar.

## 9. Criterios de aceptación

La FASE 3 solo se puede declarar completada cuando:
- Existe auditoría de datos real y matriz de viabilidad para participación, encuestas y voto por partido.
- Hay al menos un baseline y un ML (cuando viable) evaluados **exclusivamente sobre elecciones históricas completas no usadas en entrenamiento**; errores guardados por elección y provincia.
- El informe señala explícitamente si el ML supera o no los baselines, con MAE/RMSE reales, limitaciones y tamaño efectivo de muestra en elecciones, no solo filas.
- Existe diagnóstico honesto de encuestas 2023, sin inventar que se puede validar en 2026 antes del resultado.
- No se pierde ninguna candidatura oficial válida ni se cambian arbitrariamente colores de partido.
- Reproducción PowerShell, docs, gráficos y tests ejecutados.

Si una subtarea no es viable, el criterio es **documentar NO GO con pruebas y no producir falsas métricas**, no inventar resultados. En particular, un modelo para voto por partido NO es obligatorio si faltan ciclos comparables.

## 10. Orden exacto de ejecución y respuesta final

Trabaja en este orden:
1. Inspección de repositorio, auditoría de datos y baseline de 33 tests.
2. Matriz de viabilidad por tarea y listado de riesgos temporales.
3. Features válidas de participación y baselines.
4. Backtesting temporal con ML conservador, métricas y comparación.
5. Diagnóstico de encuestas pre-2023 y gate de corrección de sesgos.
6. Evaluación de viabilidad (sin forzar modelo) de series de voto por partido.
7. Gráficos, informes, tests finales, README y comandos PowerShell.
8. Resumen final y **DETENTE**, sin fase 4 ni React.

La respuesta final en español debe incluir:
- Archivos nuevos/modificados.
- Auditoría de los datos, número real de **elecciones independientes** por experimento y limitaciones.
- Tabla por elección del backtest de participación: baseline(s), modelos, MAE y RMSE; seleccionar para mostrar el modelo con mejores métricas de backtest es válido como evaluación técnica, pero no como juicio político.
- Diagnóstico de encuestas, explicando cuántas elecciones con target se pueden evaluar y por qué se entrenó o no una corrección.
- Qué experimentos obtienen `GO`, `GO CON RESERVAS` o `NO GO` y por qué.
- Pruebas ejecutadas y resultados.
- Comandos exactos para reproducir en PowerShell.
- Próximas necesidades de datos o calidad para mejorar el trabajo.

**DETENTE al finalizar la FASE 3. No hagas predicciones de resultados futuros ni crees la web todavía.**
