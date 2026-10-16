# OPENCODE — FASE 1: DATOS OFICIALES, CALIDAD Y EDA

## Contexto

Estamos desarrollando **Observatorio Electoral España 2026**, un proyecto de portfolio cuyo foco prioritario es **Data Science y Machine Learning**. El análisis histórico se centra en elecciones generales al **Congreso de los Diputados desde 1977**. El 29 de noviembre de 2026 hay elecciones generales convocadas, pero **todavía no existen sus resultados**; no inventes filas ni predicciones de esa elección. Fecha de referencia: 16 de octubre de 2026.

Si existe `PROMPT_OPENCODE_OBSERVATORIO_ELECTORAL_2026.md` en el repositorio, léelo como visión general del proyecto. **Esta instrucción tiene prioridad sobre el orden de ejecución del prompt general**: debes realizar **SOLO ESTA FASE 1** y detenerte después de verificar resultados y presentar un informe final. NO crees todavía frontend React, FastAPI, simulador de escaños ni modelos de predicción de 2026. No preguntes por decisiones no esenciales; registra supuestos razonables.

## Misión

Construye una base de análisis **real, trazable y reproducible** sobre evolución del voto, participación, censo electoral y población. Entrega ETL funcional, datasets limpios, controles de calidad, un primer análisis exploratorio con gráficos y una evaluación de viabilidad para futuros modelos de ML. Programa y ejecuta lo que el entorno permita; no te limites a proponer arquitectura.

## Fuentes oficiales iniciales que hay que verificar de verdad

1. Catálogo del Ministerio del Interior: https://datos.gob.es/es/catalogo/e00003801-resultados-electorales
2. Excel oficial del Congreso: https://descargas.interior.gob.es/datasets/resultados_electorales/Elecciones-Congreso.xlsx
3. Información metodológica y series históricas: https://infoelectoral.interior.gob.es/es/elecciones-celebradas/area-de-descargas/
4. INE, datos abiertos y APIs: https://www.ine.es/datosabiertos/
5. Población provincial anual por sexo (ID de tabla 67988, comprobar periodo y metodología): https://www.ine.es/jaxiT3/files/t/csv_bdsc/67988.csv
6. Convocatoria BOE 2026 (solo para contexto de fecha y circunscripciones, NO resultados): https://boe.es/diario_boe/txt.php?id=BOE-A-2026-20742

Explora otras tablas oficiales del INE para censo electoral, habitantes y grupos de edad, priorizando cobertura comparable y fecha de referencia clara. **No supongas** que cualquier URL funciona, que los formatos son estables ni que las columnas contienen todo lo necesario. Comprueba, deja registro y sigue con lo viable si una fuente falla. La recopilación de encuestas privadas y los modelos complejos se dejan para próximas fases.

## Tareas obligatorias

### 1. Inicializar Python reproducible

- Crea un entorno de proyecto adecuado para **Windows + VS Code + PowerShell** y Python 3.12+ cuando esté disponible.
- Añade `README.md` en español con comandos concretos de instalación y ejecución; dependencias en `pyproject.toml` o `requirements.txt`; `.gitignore` que excluya `.venv`, datasets crudos grandes, cachés y secretos.
- Prioriza `pandas`, `pyarrow`, `duckdb`, `matplotlib` o `plotly`, `openpyxl`, `pytest`. Instala únicamente lo necesario en esta fase.
- Estructura sugerida:
  - `src/electoral/` o `pipelines/` para descarga, normalización, validación y tablas analíticas.
  - `data/raw/`, `data/processed/`, `data/reference/`.
  - `notebooks/` para la exploración; **también** scripts ejecutables para reproducir los resultados sin abrir el notebook.
  - `reports/figures/`, `docs/`, `tests/`.

### 2. Ingesta de fuentes reales y auditoría

- Descarga al menos el Excel electoral oficial y una tabla demográfica oficial, siempre que la red y el formato lo permitan.
- Inspecciona **hojas, encabezados, columnas, tipos, valores únicos, granularidad, años y cobertura** antes de diseñar transformaciones.
- Conserva originales sin modificarlos, registra URL, proveedor, fecha de consulta, licencia o condición de uso, hash SHA-256, resultado de descarga y errores.
- Crea `docs/SOURCES.md` y `data/processed/source_audit.csv` con estado verificable de cada fuente. No registres éxito si no pudiste descargar realmente.
- No confundas población, censo y votantes. No asumas que todos los datos tienen granularidad provincial o que hay siempre datos por edad.

### 3. Modelo de datos limpio y comprobable

Genera tablas Parquet (y CSV resumido cuando resulte práctico) a partir de los datos realmente disponibles:

- `elections`: fecha/año de elección, tipo, cámara, origen y estado de resultado.
- `territories`: código INE provincial cuando exista (como texto, conservando ceros), provincia, comunidad autónoma.
- `candidacies`: partido/candidatura original y reglas explícitas de homogeneización.
- `election_results`: año/fecha, territorio, candidatura, votos y escaños disponibles.
- `election_turnout`: electores, votantes, abstenciones, votos válidos, votos en blanco, votos nulos y tasas, solo cuando la fuente permita calcularlos.
- `population`: año de referencia, territorio, población, desgloses disponibles y metodología.

Define y documenta la **granularidad exacta** de cada tabla. No mezcles agregados nacionales con provincias como si fueran observaciones independientes. Evita multiplicar cifras al unir resultados por candidatura con población/participación. Conserva siglas originales por elección; no unas coaliciones o partidos de distinta época automáticamente. Usa `null` para valores desconocidos, nunca cero ficticio.

### 4. Pruebas de calidad obligatorias

Crea tests con `pytest` para:

- claves duplicadas y tipos/códigos incorrectos;
- votos y censos no negativos;
- tasas entre 0 y 100;
- votantes <= electores, cuando los conceptos sean comparables;
- votos de candidaturas que no superen votos válidos cuando ambas magnitudes tengan igual cobertura y unidad;
- identificación de resultados agregados que puedan generar dobles recuentos;
- cobertura de años, provincias, fechas faltantes y discontinuidades;
- coherencia de sumas nacionales/provinciales solo cuando proceda según cobertura, CERA y definiciones.

Los checks no deben ocultar divergencias reales: documenta posibles diferencias de metodología y calidad. Genera `docs/DATA_QUALITY.md` con conteos y ejemplos verificables. Cuando una verificación no se pueda evaluar, informa `not_evaluable`, no `passed`.

### 5. EDA inicial, reproducible y visual

Genera al menos **cinco visualizaciones** con datos oficiales disponibles (si falta alguna variable, sustitúyela por un diagnóstico documentado, no inventes datos):

1. Participación y abstención en el Congreso por elección a nivel nacional.
2. Evolución del censo electoral y comparación con población total, con fechas/denominadores explícitos.
3. Evolución de votos absolutos por candidaturas históricas seleccionadas, sin fusionar coaliciones de manera arbitraria.
4. Diferencia entre porcentaje de voto y votos absolutos en ciclos comparables.
5. Comparativa territorial provincial: participación o cambio de voto entre dos elecciones, cuando la cobertura lo permita.

Incluye tablas resumen, cobertura, distribuciones, datos faltantes y observaciones de EDA. Identifica *correlaciones descriptivas*, sin atribuir causas que los datos no demuestren. Documenta en `docs/EDA.md` un mínimo de 5 hallazgos o preguntas abiertas, siempre vinculados a resultados y gráficos reales. Los ejes, unidades, denominadores y fuentes deben estar claros.

### 6. Preparación para ML (NO entrenar modelos todavía)

Crea `docs/ML_FEASIBILITY.md` con:

- Objetivos retrospectivos candidatos: (a) variación de participación provincial entre elecciones; (b) error histórico de estimación de voto, solo cuando exista historial verificable y suficiente de encuestas.
- Tabla de variables disponibles y faltantes, cobertura histórica, frecuencia, unidad territorial y riesgo de fuga temporal (`data leakage`).
- Baseline propuesto: persistencia del último valor observado, siempre que territorios y definiciones sean comparables.
- Estrategia de validación: **cortes temporales por elección completa**, jamás train/test aleatorio por provincia que mezcle una misma elección.
- Métricas propuestas: MAE y RMSE (indicando unidades), comparativa de baselines y evaluación por elección. Advertir tamaño efectivo pequeño de ciclos electorales.
- Identificación de los siguientes datos necesarios para un ML más profundo (encuestas históricas, indicadores económicos publicados antes de cada elección, composición demográfica relevante).

No afirmes que se puede predecir con precisión el 29N a partir de correlaciones históricas. No generes estimación propia de resultado electoral, ganador o probabilidad de victoria.

## Criterios para dar por terminada la fase

- Existe código ejecutable de ingesta, limpieza y EDA; no solo un notebook estático.
- Se han utilizado y auditado los datos oficiales accesibles; los fallos están registrados.
- Hay tablas Parquet documentadas, con cobertura y granularidad comprobadas.
- Se han ejecutado realmente los tests (`pytest`) o se explican los bloqueos exactos.
- Se han exportado gráficos legibles con datos reales y un documento de hallazgos.
- Hay un informe de viabilidad ML que identifica qué se puede evaluar con rigor y qué falta.
- `README.md` explica comandos PowerShell exactos para reproducirlo en Windows.

## Cierre obligatorio de OpenCode

**DETENTE aquí**. No continúes con fases 2+ ni empieces el frontend. Resume al final:

1. Archivos creados y árbol de carpetas.
2. Fuentes descargadas realmente, su tamaño, cobertura y enlaces que fallaron.
3. Filas de cada dataset y rango temporal; unidad geográfica.
4. Resultados de controles de calidad y tests.
5. Cinco gráficos producidos o razones verificables para no producirlos.
6. Conclusiones de viabilidad ML y problemas a resolver.
7. Comandos exactos para reproducir la ejecución en PowerShell.

**Prioridad absoluta: integridad de datos, trazabilidad y reproducibilidad por encima de cantidad de código o atractivo visual.**
