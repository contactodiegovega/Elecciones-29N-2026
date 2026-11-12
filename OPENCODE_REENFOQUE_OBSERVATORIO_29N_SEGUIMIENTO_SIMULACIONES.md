# OpenCode — Reenfoque del Observatorio Electoral 29N

**Fecha de referencia:** 2026-11-12 (Europe/Madrid)  
**Repositorio:** el proyecto ya existente `Elecciones 29N 2026` (Next.js/React, Python, EDA y ML de fases 1–6)  
**Tipo de trabajo:** rediseño funcional, enriquecimiento de encuestas, simulador de escenarios y seguimiento temporal. NO crear un repositorio nuevo.

## Misión

Convertir el proyecto en una **herramienta de análisis político y de seguimiento de la campaña electoral** de las elecciones generales españolas del **29 de noviembre de 2026**. El objetivo es que se pueda entender cómo cambian las mediciones publicadas por encuestadoras, explorar escenarios alternativos de voto y escaños y contrastar experimentalmente modelos estadísticos con datos históricos reales. Preservar la neutralidad política: no recomendar voto ni realizar valoraciones de partidos.

El usuario pide expresamente dos modificaciones prioritarias:

1. **Página «Evolución del voto»: mostrar SOLO PP y PSOE** en su gráfico principal, con colores PP `#1B5FCC` y PSOE `#E30613`. No confundir PP con AP antes de 1989: mantener la diferencia histórica y documentar la continuidad si se menciona. Mantener selecciones de `% de voto`, `votos absolutos` y `escaños` cuando tengan datos contrastados, además de fuentes y fechas. Todos los partidos siguen íntegros en datos, atlas, encuestas, catálogo y simulaciones.
2. **Nueva prioridad de producto: análisis de campaña, recopilación verificable de encuestas de medios, evolución diaria, escenarios de simulación y laboratorio ML riguroso**. Diseñar sistemas para seguir la evolución a lo largo de la campaña; no fabricar un resultado electoral ni publicar como fiable un modelo que no puede validarse.

## Contexto heredado (auditar, no asumir ciegamente)

El repositorio existente ya tiene ocho rutas (`/`, `/historico`, `/territorio`, `/partidos`, `/encuestas`, `/demografia`, `/laboratorio-ml`, `/metodologia`), archivos exportados desde Python a Next.js, catálogos históricos y experimentos de ML. El último informe de OpenCode declaró 16 elecciones (1977–2023), 1.778 etiquetas de candidaturas, 1.232 sondeos capturados hasta entonces, 53 tests Python y 8 tests web; seis elecciones en el backtest de participación y baseline `mean3` con MAE macro de 3,56 puntos. Estos números son **históricos del proyecto**, no deben reutilizarse como si fueran auditoría actual: verificarlos antes de mostrarlos.

En fases anteriores se concluyó: (a) los modelos complejos para participación no superaron de forma consistente al baseline simple; (b) el dataset de encuestas con resultado electoral etiquetado contiene básicamente una elección general (2023), insuficiente para validar un corrector de encuestas con prueba totalmente fuera de muestra; (c) las coaliciones y partidos históricos requieren perímetros explícitos. **No borrar ni reescribir los experimentos** para aparentar un modelo predictivo eficaz.

## Normas inflexibles

- **No eliminar ninguna candidatura ni partido de los datos canónicos.** El filtro PP/PSOE afecta solo a la visualización de la pestaña de evolución histórica.
- **No inventar encuestas, muestras, votos, escaños, intervalos de confianza, valores faltantes, validaciones ni links.** Distinguir claramente `resultado oficial`, `medición publicada`, `agregado descriptivo`, `escenario hipotético`, `experimento ML`.
- **No publicar una predicción de resultado/ganador como avalada científicamente** sin evidencia de calibración y validación retrospectiva realmente fuera de muestra. Ante datos insuficientes mostrar métricas y límites, y usar escenarios configurables y un agregado descriptivo de mediciones.
- Fuente, URL, empresa, medio, fecha de campo y publicación, tipo de medición y licencia por cada encuesta. Conservar original y derivados, con `as_of` y trazabilidad.
- Respetar `robots.txt`, términos y licencias; sin bypass de paywalls, CAPTCHA, autenticación ni protecciones anti-bot. No copiar artículos enteros. Si falta licencia/datos, registrarlo y usar importación manual/cita de fuente cuando sea legalmente posible.
- Prohibición LOREG 69.7 de publicar/difundir/reproducir sondeos electorales durante los cinco días anteriores a la votación (24–28 de noviembre 2026). Implementar guardia de calendario **Europe/Madrid** que suspenda la exposición pública de sondeos y salidas derivadas de ellos durante ese periodo, incluido refresco automático o snapshots públicos, sujeto a revisión jurídica. Se pueden seguir mostrando resultados electorales históricos y metodología. No eludir esta restricción mediante proyecciones propias reetiquetadas.
- Evitar filtraciones temporales: `fieldwork_end <= as_of`, y `published_at <= as_of` cuando se conozca; cualquier publicación ausente implica estado `fecha_publicacion_desconocida` y no entrada automática en un snapshot histórico que no pueda justificarla.
- Sin `git reset --hard`, `force push`, borrado masivo ni secretos en commits. Realizar checkpoint inicial, modificar incrementalmente y correr tests existentes.

## Paso 0 — Inspección y baseline (sin refactor todavía)

- `git status`, rama, últimos commits, configuración Next y scripts Python, rutas, tests.
- Verificar `python -m pytest tests/ -q` y los scripts web existentes (`npm run lint`, `npm test`, `npm run build`) sin modificar código. Documentar resultados de referencia.
- Examinar esquema real de resultados, encuestas, registros de candidaturas, colores, exportaciones web y `as_of`.
- Crear `docs/CAMPAIGN_REFOCUS_BASELINE.md` con estado, riesgos, servicios necesarios, dependencias, fuentes actuales y primer checkpoint Git sin sobrescribir cambios.

## Paso 1 — Experiencia centrada en análisis político

Mantener compatibilidad con URLs ya publicadas y reorganizar la navegación de forma clara. Arquitectura visual sugerida:

- `/` **Panorama de campaña**: fecha de actualización, resumen de encuestas observadas y comparativa temporal de mediciones, fuentes y advertencias; evitar mensajes partidistas y etiquetas de «ganador previsto».
- `/historico` (etiqueta de UI «Evolución del voto») **SOLO PP y PSOE** en el gráfico principal, con selector %/votos/escaños, tooltips y años de elección; puntos ausentes como ausentes, nunca interpolar sin etiquetarlo. PP comienza como tal en 1989; AP antes de 1989 no se dibuja como PP sin una opción explícita y documentada, que no debe añadirse por defecto.
- `/encuestas` **Radar de encuestas**: lista completa, todas las formaciones disponibles, filtros por empresa, medio, fecha, partido, modalidad; detalle con ficha técnica y fuente; sin mezclar intención directa con estimación de voto ni mezclar originales con réplicas.
- `/campana` **Evolución de la campaña**: evolución por fecha, distribución de resultados entre encuestadoras, dispersión entre fuentes, comparación de ventanas de tiempo, identificación de nuevas olas y revisión de duplicados; snapshot fechado del universo de datos.
- `/simulador` **Escenarios**: controles hipotéticos editables y distribución de escaños por circunscripción. Nunca hacer pasar un escenario del usuario por resultado anticipado.
- `/laboratorio-ml` **Laboratorio ML**: experimentos, límites, backtesting, métricas y comparación con baseline. Mostrar «experimental/no validado» donde corresponda.
- `/territorio`, `/partidos`, `/demografia`, `/metodologia` permanecen accesibles y útiles, con prioridad secundaria en navegación si ayuda a reducir complejidad.

Diseño editorial de alta calidad, responsive, accesible, uso de colores registrales por partido, carga rápida y referencias visibles. Nada de gráficos vacíos, datos ficticios o textos definitivos donde falten fuentes.

## Paso 2 — Pipeline de encuestas nuevas (prioridad científica)

Investigar, comprobar y documentar enlaces originarios y disponibilidad de sondeos de empresas/medios como **CIS, 40dB (El País/SER), Sigma Dos (El Mundo), GAD3 (ABC), Sociométrica (El Español), NC Report (La Razón), DYM (20minutos/Henneo), IMOP Insights (El Confidencial), GESOP, Target Point, Celeste-Tel, Sondaxe, Ateneo del Dato**, y otras fuentes verificables. No asumir existencia ni permisos de API o scraping para cada una.

Fuentes oficiales para contraste:
- BOE convocatoria: https://boe.es/buscar/doc.php?id=BOE-A-2026-20742
- Interior resultados abiertos: https://infoelectoral.interior.gob.es/en/elecciones-celebradas/datos-abiertos/
- CIS: localizar estudios originales con fichas/microdatos disponibles en su repositorio.
- LOREG 69: https://www.boe.es/buscar/act.php?id=BOE-A-1985-11672

Agregadores secundarios para búsqueda y contrastes (no sustituir publicación original):
- https://www.ondacero.es/elecciones/generales/encuestas/
- https://mapaelectoral.es/encuestas/
- https://politicheck.es/29n-encuestas

Implementar conectores por fuente **solo cuando su formato y permisos lo permitan**, separando `fetch -> parse -> validate -> normalize -> deduplicate -> publish`. Preferir feeds, ficheros estructurados, API oficial o datos descargables; scraping HTML suave si es legítimo. Un fallo no debe paralizar todas las fuentes; emitir logs de errores y cobertura.

**Esquema canónico mínimo** para cada encuesta:
`poll_id`, `source_id`, `house`, `publisher`, `original_url`, `published_at`, `fieldwork_start`, `fieldwork_end`, `sample_size`, `population`, `mode`, `geography`, `poll_type` (`estimated_vote`/`direct_intention`/`other`), `sample_error_declared`, `party_id`, `party_original`, `share_pct`, `coalition_scope`, `is_duplicate`, `duplicate_of`, `is_tracking_update`, `is_hypothetical`, `source_license`, `retrieved_at`, `source_hash`, `parse_confidence`, `quality_flags`.

Validaciones: `0 <= share <= 100`, fechas consistentes, suma compatible con partidos informados (no normalizar al 100% automáticamente si faltan «otros»), unidades, desambiguación coaliciones, no duplicados entre resumen de medio y fuente original, duplicados por republicación, mismo sondeo en varios medios, paneles acumulativos, no tratar estimación vs intención directa como equivalentes, no usar filas de resultado electoral como encuestas. Si datos incompletos, `pending_review`, sin inclusión automática en agregado.

Exponer auditoría por fuente: cobertura, último sondeo de campo, último sondeo publicado, errores y permisos. Conservar snapshots inmutables por fecha para mostrar qué datos se conocían realmente ese día.

## Paso 3 — Tracking descriptivo y evolución fechada

Crear un resumen estadístico reproducible de los sondeos, **no confundirlo con una predicción electoral**:

1. Mostrar última medición disponible por casa y distribución entre casas, con tamaño muestral y fecha de trabajo de campo cuando exista.
2. Series de mediana no ponderada y media de encuestadoras (una última ola independiente por casa para evitar sobrerrepresentación); como análisis de sensibilidad, agregados con decaimiento temporal y ponderaciones documentadas.
3. No hacer que una empresa que publica cada dos días cuente más por publicar con mayor frecuencia; seguir réplicas y trackers de muestra superpuesta.
4. Mantener partidos regionales y categorías residuales coherentes; no asignar votos de «otros» de manera arbitraria.
5. Diferenciar movimiento observado en publicaciones de cambio real de preferencias; bandas de variabilidad entre sondeos no son necesariamente intervalos de probabilidad de un resultado electoral.
6. Guardar cada snapshot por día y producir diferencias con el anterior (`delta`, fuente de cada cambio, nuevas encuestas incorporadas, modificaciones de cálculo/versiones).
7. Anotaciones de publicación (ficha de fuente, sin especular que un evento político causó un cambio).

Si no hay sondeos nuevos, informar «sin nuevas encuestas», conservar snapshot sin movimiento falso. Manual refresh y actualización programable, con fecha de última verificación efectiva y logs visibles.

## Paso 4 — Simulador de escenarios (separado del seguimiento de encuestas)

Crear un motor provincial de reparto de escaños para el Congreso con reglas españolas verificadas en LOREG y anexo de BOE 806/2026; verificar número de escaños por provincia y singularidades de Ceuta/Melilla. Implementar D'Hondt cuando proceda y umbral legal provincial correcto. Incluir tests de reparto con elecciones históricas y fixtures oficiales; la suma debe ser 350, salvo error explícito y test fallido.

Entrada del usuario:
- escenario editable de porcentajes de todas las formaciones, no solo PP/PSOE;
- ajustes por provincia o supuestos explícitos de distribución territorial;
- participación y volatilidad como parámetros opcionales, con advertencias sobre ausencia de microdatos;
- escenario base seleccionable: resultados históricos o sondeo publicado (si legalmente disponible), etiquetando siempre el origen;
- semilla reproducible, número de iteraciones configurable y límites de rendimiento.

Simulación Monte Carlo: muestras bajo hipótesis explícitas de variación y correlación; sin construir probabilidades calibradas de victoria o certidumbre estadística no respaldadas. Mostrar abanico de **escaños posibles bajo los supuestos del usuario**, distribución por provincias, sensibilidad a cambios y trazabilidad de parámetros. No etiquetar «predicción del 29N» como hecho, no mostrar ganador probable ni afirmar un nivel de probabilidad de una fuerza política.

## Paso 5 — Investigación de ML rigurosa (sin inventar evidencia)

Objetivo: preparar un módulo de análisis predictivo experimental e investigar si datos publicados permiten estimaciones con valor adicional frente a los baselines. Antes de autorizar cualquier proyección pública exigir:

- Ampliar si es viable la cobertura histórica de encuestas de **varias elecciones generales independientes**; auditar periodos y comparabilidad.
- Establecer baseline por última encuesta por casa, media/mediana de casas y, donde proceda, voto previo con límites explicados.
- Features disponibles antes del `as_of`: calendario, retraso de campo, tamaño muestral, tendencias históricas con suficiente cobertura, población/economía solo si sus fechas de publicación son comprobables. No usar resultados de 2026 (no existen todavía).
- Esquema de validación por elección retenida / rolling-origin, grupo por elección/encuestadora/réplica donde corresponda, sin fuga temporal; comparar MAE/RMSE/calibración con baseline y diagnóstico por partido y horizonte.
- Distinguir efecto de casa de ruido real, no forzar estimación de sesgos con un único ciclo etiquetado.
- Reportar tamaño efectivo independiente y amplitud de intervalos; no inferir rendimiento a partir de miles de filas dependientes de la misma elección.
- Experimentos opcionales: Ridge, Bayesian hierarchical/simple trend, HGBR/gradient boosting **solo si el número de elecciones y cobertura lo justifican**. Ablación y evaluación de robustez. Un modelo complejo que no mejore al baseline no se promociona.
- Si es imposible validar un pronóstico de resultados por partido en 2026, registrar un **NO-GO justificado**, conservar agregado descriptivo de encuestas y simulador hipotético; permitir reexaminar el GO cuando aparezcan datos históricos comparables.

Guardar reportes, código, configuración, seeds y métricas, además de un `model_card`. Nunca reinterpretar una simulación como predicción validada.

## Paso 6 — Actualización diaria y cumplimiento editorial

Arquitectura actual con Next static export: no crear un servidor dedicado si no hace falta. Proponer GitHub Actions o tarea programada local para `ingest -> validate -> snapshot -> export JSON -> build -> smoke tests`, con idempotencia, cache, logs, hashes y posibilidad de revisión manual antes de publicar. Actualizar solo cuando haya novedades verificadas. Conservar snapshot anterior si fallan fuentes.

Implementar un calendario editorial para las elecciones del 29N: 13–27 de noviembre campaña oficial, 24–28 restricción legal de publicación de encuestas. Configurable y probado. **Fail closed:** si la fecha entra en zona restringida, el sitio público oculta paneles de sondeos y derivados de sondeos hasta que haya revisión jurídica; la ingesta interna no autoriza difusión pública. Usar Europe/Madrid sin confundir UTC. Marcar claramente «datos de última actualización», «fuentes» y «fecha de campo».

## Paso 7 — QA y entrega

- Tests Python y Next.js: lint/typecheck/build, tests web, tests de scraper con fixtures guardados (sin tráfico en tests), no-regresión de 1.778 etiquetas y cobertura original; nuevo test histórico solo PP/PSOE y PP sin datos inventados antes de 1989; tests de deduplicación de encuestas, tracking que no mezcla tipos, calendario de veda, modelos sin fuga, escáner de secretos, D'Hondt por provincia y suma 350; prueba de error de fuente.
- QA manual responsive y accesibilidad básica; inspección visual de cada ruta y comprobación de que la navegación y la carga del mapa funcionan.
- No borrar rutas históricas, no publicar `node_modules`, `.next`, cookies, secretos o datasets con permisos inciertos.
- Commits de checkpoint, reporte final `docs/CAMPAIGN_REFOCUS_REPORT.md`, actualización README, manual de fuentes y `docs/CAMPAIGN_DAILY_RUNBOOK.md`.
- Si no hay acceso autorizado a GitHub/Vercel, marcar `READY_TO_DEPLOY` con comandos exactos y sin inventar URL.
- Detenerse al terminar el trabajo técnico y dar resumen con resultados reales, número de nuevas encuestas verificadas, estado del tracking, estado legal y validación del simulador y experimentos.

## Criterios de aceptación visibles

1. La pestaña «Evolución del voto» solo enseña PP azul y PSOE rojo, con fuentes y cifras históricas reales, sin atribuir AP al PP antes de 1989.
2. Los demás partidos siguen consultables en `/partidos`, `/encuestas`, territorio y simulador; ninguna etiqueta original se pierde.
3. El radar de encuestas tiene fuentes primarias, control de duplicados, tipos separados y fechas con procedencia.
4. El seguimiento de campaña puede reconstruir, con snapshots inmutables, qué sondeos estaban publicados en cada fecha y explicar cambios en el agregado.
5. El simulador produce **escenarios hipotéticos** reproducibles de escaños por circunscripción y valida el total de escaños.
6. El laboratorio ML informa honestamente si la capacidad predictiva no puede probarse fuera de muestra; no publica estimaciones como resultados ciertos.
7. El sitio contempla la restricción LOREG 69.7 y no publica sondeos ni derivados durante el periodo restringido sin revisión jurídica.
8. Build y tests pasan; docs y README actualizados; git limpio o cambios intencionados documentados.

## Mensaje final esperado de OpenCode

Explicar: qué había, qué se modificó, en qué rutas, fuentes activas y descartadas, encuestas **nuevas y verificadas**, cobertura de fechas y partidos, funcionamiento del simulador, qué se puede y no se puede afirmar del ML, tests efectivamente ejecutados, pasos manuales pendientes y comandos para ejecutar web y refresco de datos. No reportar como éxito tareas no ejecutadas.
