# OPENCODE · FASE 4 — ENRIQUECIMIENTO DE DATOS, EDA EXPLICATIVO Y REVALIDACIÓN

## Contexto del proyecto

Proyecto: **Observatorio Electoral España 2026**. Prioridad: **Data Science y Machine Learning**; React se abordará después. Esta fase trata exclusivamente de análisis retrospectivo, fiabilidad de fuentes, mejora de datasets y comprobación científica de si nuevas variables aportan valor medible. **No construir predicciones, probabilidades de victoria ni estimaciones electorales para el 29/11/2026.** No construir React, APIs de producción ni simuladores prospectivos.

Antes de modificar código, LEE y AUDITA el repositorio real y los entregables de fases anteriores, especialmente:
- `docs/PHASE3_DATA_AUDIT.md`, `docs/PHASE3_FEASIBILITY.md`, `docs/PHASE3_BACKTEST_REPORT.md`, `docs/MODEL_CARD.md` (o sus rutas existentes).
- `docs/ML_DATASET_DESIGN.md`, `docs/PARTY_TAXONOMY.md`, `docs/PARTY_COLORS.md`, `docs/POLL_SOURCES_PENDING.md`.
- `src/electoral/features.py`, `src/electoral/ml/`, `src/electoral/taxonomy.py`, `src/electoral/colors.py`, `config/ml_phase3.json`, tests y datasets existentes.

**Estado reportado de Fase 3, no asumido como verificado hasta inspeccionarlo:** 16 elecciones históricas, 15 transiciones / 780 observaciones provinciales, 6 elecciones de test fuera de muestra; 1.232 sondeos recopilados pero una sola elección general etiquetada para contraste de encuestas (2023); 477/1.778 etiquetas de partidos normalizadas; 45 tests OK. La Fase 3 señaló que los modelos complejos no mejoraban de manera consistente al baseline y descartó un corrector de encuestas por falta de ciclos independientes. Conserva esos hallazgos: **NO cambies criterios para forzar una mejora de métricas**.

## Principios innegociables

1. **Todos los partidos, siempre.** Mantener todas las candidaturas originales, minoritarias, regionales, históricas y sin escaños. Nunca imponer un top-N en los datos canónicos ni perder registros al hacer joins, agrupaciones o gráficos; se puede ofrecer una selección visual + opción “todos”. No renombrar, fusionar ni asignar partidos automáticamente sin evidencia reproducible; conservar original y mapeo versionado, con estado explícito `unmapped`, `pending_review`, `confirmed`.
2. **Colores por partido coherentes.** Reutilizar `get_party_color()` y el registro existente sin romperlo: PP azul, PSOE rojo, VOX verde y los colores verificados/identificativos del resto. Un fallback debe ser determinista y distinto de los corporativos reservados; paletas accesibles y leyendas completas.
3. **Solo datos reales, con procedencia.** No generar encuestas sintéticas ni rellenar años con datos inventados; no usar datos retrospectivamente revisados como si hubieran sido observables en su fecha salvo para EDA expresamente etiquetado.
4. **Evitar filtración temporal.** Cada fila de entrenamiento debe tener `as_of_date`, fecha de referencia de dato, `published_at`/`available_at` cuando sea verificable; solo permitir datos publicados antes de la elección o del corte temporal. Si no se puede demostrar cuándo se conoció un dato, excluirlo del ML o declararlo solo descriptivo.
5. **No mezclar conceptos:** población ≠ población española ≠ población en edad electoral ≠ censo ≠ votantes; renta ≠ salario; paro EPA ≠ paro registrado; `direct_intention` ≠ `estimated_vote`.
6. **Comparaciones neutrales.** No producir recomendaciones de voto, juicios sobre partidos, ganadores previstos, probabilidades de victoria, optimización electoral ni inferencias sobre preferencias políticas personales. La relación entre edad/renta/paro agregados y un resultado electoral es ecológica: no permite inferir cómo vota un individuo ni demostrar causalidad.
7. **Una misión cerrada.** Inspeccionar, implementar, ejecutar pruebas, documentar, entregar un resumen y DETENERSE. No comenzar la Fase 5 ni solicitar autorización entre subtareas ordinarias; registrar bloqueos reales.

## Objetivo técnico

Mejorar el corpus histórico con variables demográficas y económicas verificadas por provincia, hacer EDA explicativo más profundo, evaluar cobertura temporal, y repetir el backtest de participación **solo** si hay nuevas features válidas con historial suficiente y disponibles en el momento correspondiente. El resultado ideal no es “ganar MAE”, sino un diagnóstico honesto sobre señal estadística, sesgos y límites de generalización.

## A. Auditoría inicial obligatoria

- Ejecuta `python -m pytest tests/ -q` y las rutinas mínimas de lectura sin borrar nada, registrando resultados y entorno en `docs/PHASE4_BASELINE_AUDIT.md`.
- Resume el esquema real y cardinalidades de las tablas, integridad de 52 provincias, años disponibles, porcentajes/votos/escaños, 1.778 etiquetas y estado de mappings; verifica con consultas que las candidaturas minoritarias sobreviven.
- Comprueba las 45 pruebas anteriores (o el total real que encuentres), dependencias y entradas reproducibles. No sobreescribir reportes de la Fase 3: todos los nuevos artefactos bajo `/phase4/`.
- Crea inventario de fuentes y un pequeño plan de ingesta; usa rutas existentes si las hay y evita reestructurar el código innecesariamente.

## B. Fuentes que debes INVESTIGAR Y VERIFICAR (no dar por utilizables sin comprobar)

Prioriza fuentes oficiales de España, con cobertura provincial y fecha de publicación identificable. Revisa metadatos y disponibilidad real antes de descargar. Candidatas:

1. **INE, población provincial por edad, sexo y nacionalidad, tabla 67217 (Censo de Población)**
   - Catálogo: https://datos.gob.es/es/catalogo/ea0042823-poblacion-por-sexo-edad-ano-a-ano-y-nacionalidad-espanola-extranjera-identificador-api-67217
   - CSV indicado por catálogo: https://www.ine.es/jaxiT3/files/t/csv_bdsc/67217.csv
   - Investiga años cubiertos, cambios metodológicos y disponibilidad histórica antes de proponer uso en folds antiguos.
2. **INE, población histórica provincial por edad, nacionalidad y sexo**: tablas 36780 y antigua serie del Padrón Continuo.
   - https://datos.gob.es/es/catalogo/ea0042823-poblacion-espanoles-extranjeros-por-edad-ano-a-ano-y-sexo-identificador-api-36780
   - https://www.ine.es/jaxiT3/files/t/csv_bdsc/36780.csv
   - https://datos.gob.es/es/catalogo/ea0042823-poblacion-por-provincias-edad-ano-a-ano-espanoles-extranjeros-sexo-y-ano-identificador-api-t20-e245-p08-l0_ant-03003-px
   - Cuidado con series sustituidas, cortes, revisión y descarga pesada.
3. **INE, población total provincial histórica**: tabla 2852 y tabla 67988 ya incluida en el proyecto.
   - https://datos.gob.es/es/catalogo/ea0042823-poblacion-por-provincias-y-sexo-anual-cifras-oficiales-de-poblacion-de-los-municipios-espanoles-revision-del-padron-municipal-identificador-api-28521
   - https://www.ine.es/jaxiT3/files/t/csv_bdsc/2852.csv
   - Comparar coberturas, metodologías y coherencia, sin mezclar series diferentes a ciegas.
4. **INE, renta provincial (Atlas de Distribución de Renta de los Hogares)**: tabla 53687.
   - https://datos.gob.es/es/catalogo/ea0042823-distribucion-por-fuente-de-ingresos-adrh-identificador-api-53687
   - https://www.ine.es/jaxiT3/files/t/csv_bdsc/53687.csv
   - Verifica periodo, tipo de renta y retardo de publicación. NO uses renta del propio año si fue publicada tras las elecciones.
5. **INE, tasas EPA de actividad, paro y empleo provincial, tabla 72989**.
   - https://datos.gob.es/es/catalogo/ea0042823-tasas-de-actividad-paro-y-empleo-por-provincia-y-sexo-epa-identificador-api-72989
   - https://www.ine.es/jaxiT3/files/t/csv_bdsc/72989.csv
   - Trimestral, muestra finita y posibles cambios de definición; usar última publicación previa a cada corte, nunca trimestre publicado después.
6. **INE API y fechas de publicaciones**:
   - https://www.ine.es/OpenAPI/index.html
   - https://www.ine.es/dyngs/DAB/index.htm?cid=1100
   - https://www.ine.es/dyngs/DAB/index.htm?cid=1103
   - Investiga qué campos de fechas se pueden demostrar automáticamente y cuáles requieren metadatos manuales.
7. **CIS (opcional, auditoría de factibilidad, NO inventar datos)**:
   - https://www.cis.es/catalogo-estudios/resultados-definidos/barometros
   - https://www.cis.es/es/catalogo-estudios/fid/acceso-a-datos
   - Comprueba condiciones, formatos y calidad; NO simules microdatos, no eludas login, no transcribas sin autorización. Si está bloqueado, añade `PENDING` y continúa con las fuentes oficiales disponibles.

Para cada fuente: institución, URL real, indicador y unidad, granularidad, primer/último año disponible, fecha(s) de publicación conocida(s), revisión metodológica, licencia/atribución, tamaño, método de ingesta, checksum o hash, estado `usable_for_ML`, `EDA_only` o `blocked`, y motivo. Construye `reports/tables/phase4/source_coverage.csv` y `docs/PHASE4_SOURCE_CATALOG.md`.

Si una fuente falla o no cubre histórico suficiente, documenta el hecho y no sustituyas por números ficticios. Descargas con timeouts, retry/backoff acotados, caché, detección de codificación/separador, logs informativos y sin reproducir un bucle infinito.

## C. Dataset enriquecido con integridad temporal

- Crear módulo nuevo o extender el existente con mínima intrusión: `src/electoral/enrichment.py` y, si ayuda, `src/electoral/temporal_join.py` (adaptar estructura existente).
- Salida en `data/processed/phase4/` (Parquet recomendado), más tabla de cobertura y diccionario de datos.
- Clave canónica estricta: `election_id`, `election_date`, `province_code` (INE/Interior crosswalk verificado), `as_of_date`; conservar IDs de origen y fuente.
- Features candidatas SOLO si validadas: `% de población residente 18–29`, `30–44`, `45–64`, `65+` (aclarando que residente no implica derecho a voto); evolución interanual; población española/extranjera; tasa EPA de paro y empleo; renta neta por persona/hogar con unidad exacta. Evitar proxies engañosos y duplicidad perfecta de variables.
- Diferenciar datos de hecho disponibles pre-elección de valores retrospectivos: `reference_period_end`, `release_date_verified`, `available_at`, `vintage_status`, `is_ml_eligible`, `reason_if_excluded`.
- No ffill ciego entre cambios metodológicos ni mezclar niveles municipal/provincial sin justificación; para anual/trimestral elegir último dato **publicado** antes de `as_of_date`; nunca usar día de elección por defecto como publicación.
- Registrar ausencia y cobertura por provincia, elección y feature; no diseñar imputación que use test. Los años sin cobertura son nulos justificados; el ML debe excluir esas features o reducir explícitamente el periodo.
- Agregaciones territoriales con pesos y denominadores documentados; comparar con controles oficiales; tener cuidado con Ceuta y Melilla.
- Generar un diagnóstico `docs/PHASE4_TEMPORAL_INTEGRITY.md` y `reports/tables/phase4/feature_coverage.csv`.

## D. Calidad de las candidaturas y análisis descriptivo

- Mantener todas las etiquetas originales (mínimo de no regresión: las mismas de Fase 2/3 si provienen del mismo snapshot). Preparar un **backlog de normalización revisable** ordenado por impacto en votos no mapeados, con año, provincia, nombre, votos y propuesta solo si es inequívoca; no hacer mapeos arbitrarios.
- Reportar cobertura **por votos, por filas y por elección**; nunca usar 36 normalizados como si agotaran las 1.778 etiquetas originales.
- Analizar evolución del censo frente a la población (indicadores distintos), participación, abstención, voto en número y porcentaje, y variaciones provinciales. Conservar opciones “principales” y “todos”. Etiquetar las categorías `Otros/No normalizados` y permitir explorar la composición sin eliminar partidos.
- Evitar comparar sin advertencias coaliciones/partidos cuyo perímetro cambió; con un solo voto de un partido nuevo no inferir estabilidad histórica.
- Producir 8–12 gráficos PNG y tablas completas (las figuras son opcionales si falta cobertura, pero documenta por qué). Aplicar `get_party_color()` y no introducir nuevas tonalidades no verificadas para partidos con identidad ya establecida.
- Elaborar `docs/EDA_PHASE4.md` con **al menos 8 hallazgos respaldados por datos reales**, magnitud, periodo, geografía, limitación e interpretación no causal. Incluir ejemplos de sesgo ecológico y cobertura temporal.

## E. Machine Learning: revalidación, no búsqueda de victoria

- Mantener **los mismos folds históricos** y los baselines de Fase 3 cuando sean comparables; fijar manifiesto de splits. Las provincias de un mismo proceso electoral se mantienen juntas en cada test; no tratar 52 filas de una elección como 52 elecciones independientes.
- Si y solo si hay features con `available_at <= as_of_date` en suficientes folds, repetir experimento de participación con baseline (última participación y otros baselines preexistentes), Ridge y 1 o 2 modelos pre-registrados de Fase 3. No búsqueda exhaustiva de hiperparámetros ni probar decenas de variantes hasta ganar.
- Preprocesamiento, codificación, escalado e imputación ajustados **solo en train**. No usar 2026 como target. No entrenar corrector de sondeos con una sola elección etiquetada. No entrenar modelos por partido sin independencia suficiente.
- Comparar fase3 vs fase4 con el **mismo subconjunto de elecciones**: MAE/RMSE por elección, media macro y ponderada, diferencia vs baseline y cantidad de elecciones en las que el método mejora. Si el nuevo dataset elimina años, reportar separadamente comparaciones no equivalentes.
- Presentar ablation de bloques demográficos / renta / paro **solo** si cobertura y potencia mínimas lo justifican, con resultado exploratorio claramente identificado.
- Reportar incertidumbre cualitativa y variabilidad entre elecciones; no dar intervalos de confianza engañosamente estrechos al bootstrapear provincias como independientes. Mencionar n de ciclos reales.
- Revalidar guardias contra leakage con datos sintéticos en tests (un campo post-elección nunca debe entrar a entrenamiento), independencia folds, cobertura, deterministic seed, no regresión en candidaturas y colores.
- Si NO hay dataset suficientemente completo para un backtest válido, NO forzar entrenamiento. Entregar un informe de **NO GO razonado** y conservar el backtest Fase 3 como referencia.

## F. Estructura de entregables esperada

Ajustar los nombres al repositorio existente sin romper interfaces:

- `docs/PHASE4_BASELINE_AUDIT.md`
- `docs/PHASE4_SOURCE_CATALOG.md`
- `docs/PHASE4_TEMPORAL_INTEGRITY.md`
- `docs/EDA_PHASE4.md`
- `docs/PHASE4_ML_REVALIDATION.md` (con GO / NO GO justificado)
- `docs/PHASE4_SUMMARY.md`
- `reports/tables/phase4/` (auditorías, cobertura, datasets resumen, métricas)
- `reports/figures/phase4/` (gráficos)
- `data/raw/` fuentes originales cacheadas + provenance
- `data/processed/phase4/` datasets enriquecidos
- `src/electoral/` módulos acotados a la fase
- `tests/test_phase4.py`
- `config/ml_phase4.json` si hubo experimentos nuevos
- Actualizar `README.md` con reproducción en PowerShell, dependencias y citas de fuentes.

## G. Criterios de aceptación (verificar antes de decir “FASE 4 terminada”)

1. Ejecutar y mostrar el comando exacto `python -m pytest tests/ -q`; todas las pruebas previas siguen pasando y hay pruebas nuevas sobre datasets y leakage.
2. Registros de candidaturas no disminuyen frente al snapshot de entrada (salvo artefactos documentados ya excluidos) y la vista `Todos` conserva la totalidad.
3. Se informa para cada feature de cobertura por elección, integridad temporal, unidad, fuente, y elegibilidad o no en ML.
4. Las nuevas fuentes han sido efectivamente descargadas y validadas, o están marcadas con fallo documentado; sin datos ficticios.
5. Los informes EDA tienen resultados reales, referencias claras y gráficos legibles, corporativos y neutrales.
6. Los modelos son comparados con los baselines en folds cronológicos o se informa correctamente que no hay datos suficientes. No prometer mejora de MAE.
7. Las salidas anteriores de Fase 1/2/3 permanecen intactas, salvo corrección con prueba y explicación explícita.
8. No hay pronóstico electoral 29N, ni modelo de partidos entrenado sin validación, ni React, ni endpoints web.

## H. Resumen final que debes devolver al usuario

Al terminar, presenta un único resumen con:
- fuentes incorporadas + rango de años real y archivos descargados;
- número de filas, provincias, elecciones, indicadores y porcentaje de cobertura temporal;
- estado de preservación de TODOS los partidos + tasa de normalización, por filas y votos;
- 5–8 descubrimientos EDA cuantificados y con limitaciones;
- comparación métrica Fase 3 / Fase 4 o NO GO si no procede;
- tests (comando + número real aprobado), fallos resueltos, fuentes pendientes;
- rutas de ficheros generados y pasos exactos de reproducción;
- recomendación del contenido para la siguiente fase (web de visualización histórica y laboratorio de modelos retrospectivos).

**DETENTE AL COMPLETAR LA FASE 4.** No adelantes la fase React ni introduzcas afirmaciones predictivas no validadas.
