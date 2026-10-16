# OPENCODE — CIERRE CONJUNTO DE FASE 5 + FASE 6
## Observatorio Electoral 2026 | Recuperación, web, QA, portfolio y publicación

**MANDATO PRINCIPAL:** Continúa el repositorio EXISTENTE `Elecciones 29N 2026`. No crees otro proyecto, no repitas fases terminadas y no sustituyas datos científicos. Tu trabajo es **terminar todo lo pendiente de la FASE 5, comprobarlo y después ejecutar la FASE 6 (pulido, documentación, seguridad, GitHub y despliegue si las credenciales y permisos lo permiten)**. Ejecuta código, corrige errores, comprueba resultados y deja un informe verificable. No te limites a planificar.

**Fecha de contexto: 16 de octubre de 2026.** Las elecciones del 29N aún no se han celebrado. El observatorio no debe presentar resultados oficiales futuros ni predicciones propias de ganadores o reparto de escaños en 2026. Las encuestas publicadas se muestran como mediciones fechadas y con metodología; el ML existente es de evaluación RETROSPECTIVA.

## 0. ESTADO RECUPERADO TRAS INTERRUPCIÓN — NO VOLVER A HACERLO

El informe de recuperación inmediatamente anterior indica:

- Rama `main`, commits históricos hasta `a3a3e69`; cambios de fases 3–4 sin commit y `web/` en archivos untracked. **El código sigue en disco**. No uses `git reset --hard`, `git clean -fd`, checkout destructivo ni borrados masivos.
- Python 3.14.4, scikit-learn 1.9.1, Node 24.20.0, npm 11.19.0, `web/node_modules` ya instalado. Verifica versiones reales antes de actuar.
- **5A COMPLETO:** `docs/PHASE5_DATA_CONTRACT.md`, `src/electoral/export_web.py`, `config/web_export.json`, `docs/PHASE5_DATA_QA.md`, 33 JSON públicos y un GeoJSON GISCO; checkpoint `docs/PHASE5_PROGRESS.md`.
- **5B PARCIAL:** `web/app/page.tsx`, `web/app/historico/page.tsx`, `web/app/territorio/page.tsx` existentes, requieren terminar/depurar.
- **5C PARCIAL:** `/territorio` tiene errores de TypeScript; faltan `/partidos` y `/encuestas`.
- **5D PENDIENTE:** faltan `/demografia`, `/laboratorio-ml`, `/metodologia`.
- **5E PENDIENTE:** faltan tests frontend, lint verificado, build correcto, reporte final.
- **Errores TS reportados:** `GeoJSON.FeatureCollection` sin tipos en `territorio/page.tsx:20` y `lib/data.ts:40` (posible `@types/geojson`), y `??` inalcanzable en `territorio/page.tsx:75`. `npm run build` falla en typecheck; no tratar como error de Python.
- **Tests Python:** `python -m pytest tests/ -q` dio **53 passed**. Datasets reportados intactos: `election_results` 92.456 filas, `mapping` 1.778, `polls` 1.232, `turnout_features_enriched` 780, CSV ML phase 3–4.
- **Pruebas web:** `package.json` declara `test: vitest run` pero no hay tests ni configuración Vitest.
- **Tamaño GISCO:** archivo `nuts3_europe_03M.geojson` ~16 MB bajo `web/public/`: analizar optimización segura sin cambiar geometrías arbitrariamente.

**Verifica primero cada dato anterior sobre el repositorio.** Es un informe, no una excusa para suponer que algo está correcto. Lee el prompt de fase 5 previo `OPENCODE_FASE_5_WEB_NEXTJS_OBSERVATORIO_ELECTORAL.md`: sus reglas de producto, datos, páginas y accesibilidad siguen vigentes salvo que este documento concrete el cierre y despliegue.

## 1. PRINCIPIOS OBLIGATORIOS

1. **Conservación exhaustiva:** todas las candidaturas originales: 1.778 etiquetas históricas y las 81/81 de 2023 cuando existan en los datasets. Distingue `candidacy_original` de `party_normalized`; normalización parcial es normal. No conviertas «Otros» en una eliminación de filas; debe poderse buscar y filtrar cualquier candidatura original. Principales destacados por comodidad sin ocultar minoritarios, regionales ni coaliciones.
2. **Colores oficiales existentes:** toma exclusivamente el registro de `get_party_color()`/export del proyecto. PP `#1B5FCC`, PSOE `#E30613`, VOX `#5CB531`; respeta vigencias, provisional y fallback. No crees paleta arbitraria que cambie los colores de partido. Identificación nunca basada solo en color.
3. **Datos trazables y medidos:** no mocks, no datos sintéticos publicados, no hardcode de métricas ML. Unidad, periodo, territorio, vintage, fuente y licencia visibles en gráficos/tablas. Diferencia votos, voto %, participación %, puntos porcentuales, habitantes y electores. No fuerces nulos a cero.
4. **Neutralidad política:** sin recomendaciones de voto, rankings valorativos o conclusiones sobre partidos, sin probabilidades de victoria ni predicción de resultados 2026. Sondeos por encuestadora fechados y separados de intención directa / estimación. Análisis de correlaciones ecológicas no causal.
5. **Ciencia reproducible:** preservar fuentes y pipelines fases 1–4; los 53 tests Python son mínimo histórico, no un número que se deba falsear. Modelo simple `mean3` y modelos Ridge/HGBR reflejados con sus valores reales y validación por fold; no proclamar mejoras que los experimentos no prueban.
6. **Web profesional:** diseño editorial de periodismo de datos, no plantilla genérica. Excelente contraste, navegación intuitiva, mobile-first, densidad visual adecuada, gráficos legibles e interactivos, sin florituras que dificulten el análisis. Interfaz íntegramente en español.
7. **Seguridad e integridad:** nada de credenciales, `.env`, claves, `node_modules`, `.next`, `venv` o datos personales en GitHub. Nunca escribir tokens en archivos. No borrar archivos no rastreados sin permiso.
8. **Ejecución responsable:** trabaja en checkpoints, valida antes de seguir y registra progreso en `docs/PHASE5_PROGRESS.md` y posteriormente en `docs/PHASE6_PROGRESS.md`. No anuncies éxito si pruebas o publicación han fallado.

## 2. CHECKPOINT 0 — PROTECCIÓN Y REPRODUCCIÓN ANTES DE CAMBIOS

- Inspecciona `git status --short`, `git log -5 --oneline`, `.gitignore`, tamaños de archivos nuevos, `web/package.json` y estructura. No re-inicialices Git. Detecta secretos y ficheros muy grandes con cuidado; solo muestra rutas, nunca valores de secretos.
- Crea un **punto de recuperación LOCAL** por commits selectivos y lógicos: fases 3–4, estado recuperado de fase 5, nuevos avances. Puedes usar rama de trabajo `feature/cierre-web` si no perjudica los cambios existentes. Explica exactamente qué haces; no uses `git add .` ciegamente. Evita commits de Parquet bruto enorme, caches, artefactos temporales o credenciales; decide qué artefactos públicos son necesarios para el deploy estático y documenta el criterio.
- Si no puedes crear commits por config de Git/archivos inseguros, no bloquees código: explica qué falta y mantén los archivos intactos. **No hagas `push` todavía** sin revisar qué se hará público.
- Repite `python -m pytest tests/ -q` y anota resultado. Verifica que export de fase 5 sigue funcionando sin cambiar datasets originales.

## 3. CHECKPOINT 5B/5C — DESBLOQUEO DE COMPILACIÓN Y PÁGINAS HISTÓRICAS

**Primero desbloquear el proyecto:**

- Arregla los dos errores de tipos GeoJSON (`@types/geojson` u otra solución tipada correcta); elimina `??` inalcanzable sin alterar la lógica real. Evita `any`/`@ts-ignore` para esconder fallos.
- Comprueba `npx tsc --noEmit` en `web/` y `npm run build` hasta que pasen. Con `output: 'export'`, no introduzcas características que requieran servidor Node en runtime. Comprueba que `web/out/` se genera al compilar.
- Corrige los problemas reales de la portada, `/historico` y `/territorio`: carga JSON validada, nombres correctos, leyendas, filtros, estados vacíos, coherencia de unidades, mapa real de provincias y Ceuta/Melilla. Al cambiar de provincia/año/partido deben cambiar los datos sin errores.

**Termina 5C:**

- `/partidos`: catálogo/buscador completo, selector original/normalizado, comparador multi-partido con colores correctos, coaliciones explícitas, opción Todos, export del subconjunto mostrado. Comprobar 81/81 de 2023 y posibilidad de recuperar cualquier etiqueta original de las 1.778 del periodo, aunque no todas sean partidos normalizados. Evitar renderizar 1.778 series simultáneamente: virtualización/paginación/UI progresiva sin ocultarlas.
- `/encuestas`: evolución real por encuestadora/partido/fecha; filtrar 2023 vs 2026, distinguir estimación de voto e intención directa, no mezclar; indicar réplicas vs encuestas independientes y publicar fuentes/fechas/licencias. No presentar sondeos 2026 como resultados electorales o proyección propia.
- Estilo de mapa: comprobar si GeoJSON GISCO NUTS3 europeo sirve exactamente para nuestras provincias españolas y 52 circunscripciones; no asignar códigos por posición ni asumir que geometrías NUTS3 son todas equivalentes a las provincias sin validación. Optimizar filtrando a la zona pertinente y simplificando con tolerancia documentada y topología cuidada; conserva original/fuente/licencia y confirma geometrías e islas, Ceuta y Melilla. Medir tamaños antes/después, sin cifras inventadas.

## 4. CHECKPOINT 5D — COMPLETAR LAS 3 PÁGINAS CIENTÍFICAS

**`/demografia`**

- Selector edad × provincia × elección/año, representación de la distribución por edad realmente disponible, población, desempleo (EPA), renta con denominador correcto y panel visible de `vintage_ref` y `vintage_status`.
- Distingue población total, nacionalidad, censo, y electores cuando proceda. Renta **per cápita solamente si la fuente contiene esa variable**. Mantén nulos justificables en periodos o territorios no cubiertos. No hacer forward fill anacrónico.
- Scatterplots de correlaciones con muestra, unidad y aviso «correlación no implica causalidad»; no hacer afirmaciones sobre comportamientos individuales a partir de promedios provinciales.

**`/laboratorio-ml`**

- Backtesting retrospectivo de participación con resultados importados de los CSV reales de fase 3–4, seis folds de elecciones retenidas, MAE macro y por fold, baseline `mean3` frente a Ridge/HGBR sin proclamar superioridad infundada.
- Mapa de error fuera de muestra OOS por provincia y elección si existe la salida de predicciones; nunca representar datos entrenados como test.
- Explicar leakage, `as_of_date`, vintage y muestras no independientes, y por qué no se ha validado un corrector de encuestas ni un pronóstico de voto para 2026.
- Metadatos de dataset/modelos, fechas, tamaños muestrales y limitaciones en lenguaje comprensible.

**`/metodologia`**

- Lista de fuentes oficiales (Interior, INE, CIS cuando aplica), encuestas externas y sus atribuciones reales, derechos de reutilización, diferencias de estimación/resultado, criterios de normalización de candidaturas y colores.
- Explica exclusiones, valores faltantes, réplicas y cobertura de vintage. Publica fecha real del dataset y explica que las encuestas son una fotografía de la fecha medida, no una recomendación.
- Enlaza repositorio solo si se conoce su URL auténtica; ningún enlace inventado. Contacto solo si existe dato autorizado.

## 5. CHECKPOINT 5E — TESTS Y CIERRE FUNCIONAL (PUERTA OBLIGATORIA)

**No pasar a despliegue si falla esta puerta.**

1. Añade Vitest y tests reales, o adapta el script a una suite genuina. Pruebas para: validación Zod de JSON; colores PP/PSOE/VOX contra registro; 81/81 candidaturas 2023; 1.778 etiquetas sin perder; distinción candidacy original/normalizado; folds/MAE desde CSV; sondeos y réplicas; datos electorales 2026 inexistentes; descarga de subconjuntos si es relevante.
2. Añade/ajusta `npm run lint` con ESLint realmente instalado y una configuración razonable; no silencies avisos importantes sin explicación. `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build` deben ser ejecutados con sus salidas documentadas, sin afirmaciones ficticias.
3. `python -m pytest tests/ -q` y ejecución controlada del exportador `python src/electoral/export_web.py` si el CLI real lo permite. Repetir el build con los datos exportados y detectar regresiones.
4. Verifica las ocho rutas `/`, `/historico`, `/territorio`, `/partidos`, `/encuestas`, `/demografia`, `/laboratorio-ml`, `/metodologia`; deep links, filtros, navegación, enlaces, descarga CSV, móvil 375px, tableta 768px, portátil 1366px, errores/empty states, teclado, contrastes. Utiliza Playwright si viable o especifica qué comprobaciones manuales quedan pendientes; no marques E2E como ejecutado sin haberlo hecho.
5. Revisa dimensiones y tamaño de `public/`, carga de mapa y bundles. Evita dependencias de red inesperadas al navegar, recursos rotos y referencias a `localhost`. No elimines datos con la excusa de mejorar rendimiento.
6. Genera `docs/PHASE5_REPORT.md` con rutas creadas, capacidades, QA cuantitativo, tests exactos, errores conocidos, inventario de artefactos y captura de cómo arrancar en PowerShell. Actualiza `docs/PHASE5_PROGRESS.md` a COMPLETA **solo si** se cumplen los criterios.
7. Crea commit local de cierre de la fase 5, preservando trazabilidad. Si no se cumplen requisitos, termina con lista concreta de fallos y no empieces el despliegue.

## 6. CHECKPOINT 6A — POLIDO DE PORTFOLIO Y PRODUCTO FINAL

Después de superar 5E:

- Inspecciona visualmente toda la web y mejora tipografía, espaciados, jerarquía, densidad de información, navegación, tablas, mapa, microcopys, tooltips, estados sin datos y responsive. Proyecto profesional, no landing vacía o «dashboard de juguete».
- Crea metadatos SEO y Open Graph (títulos, descripción y social preview solo con activos reales); sitemap/robots cuando sea compatible con export estático. Icono y favicon originales sencillos, sin suplantar marcas de partidos ni usar escudos oficiales sin licencia.
- Todas las cifras deben venir de datos reales; poner fecha de corte de datos y advertencia de vigencia visible. Redacción apolítica y clara. Una sección «Sobre el proyecto» puede destacar metodología, ETL, Python, tests, ML temporal, fuentes y repositorio.
- Incluye feedback de navegación básico y acceso por teclado. Si hay funciones no implementadas, elimínalas o márcalas como no disponibles: nunca botones decorativos que simulen funcionar.
- No añadas analítica, cookies de terceros, formularios que capturen datos ni rastreadores solo por estética. Si se integra algo externo, documenta requisitos legales y consentimiento cuando aplique.
- Confirma que la app es realmente estática y que todos los JSON/mapas funcionan desde una URL pública, sin backend local ni rutas absolutas a disco. Next.js `output: 'export'` debe seguir vigente salvo justificación comprobada y aprobada.

## 7. CHECKPOINT 6B — AUDITORÍA DE PUBLICACIÓN / GIT

- Revisa `.gitignore`, secretos (solo reporta existencia/ruta, jamás contenido), tamaños, licencias y reutilización de sondeos externos. Los datos históricos pueden ser públicos, pero no presupongas que las encuestas de medios o los mapas tienen la misma licencia. Incluye atribución explícita y enlaces de fuentes.
- Verifica legalidad/atribución de las fuentes secundarias y requerimientos de redistribución. Si una licencia no permite publicar datasets redistribuidos, evita incluir ese archivo público en el deploy y muestra solo lo lícito; deja auditoría en `docs/PHASE6_LICENSES.md`.
- Audita dependencias y corrige vulnerabilidades aplicables sin upgrades masivos que rompan la app. Documenta vulnerabilidades que no puedan resolverse sin riesgo y su exposición real.
- Escribe `README.md` principal orientado a reclutadores: qué resuelve, screenshots **reales si disponibles**, arquitectura, fuentes, comandos de instalación y reproducción Windows PowerShell, resultados ML sin exagerarlos, limitaciones, estructura, roadmap y demo URL **solo si existe**.
- Añade `web/README.md` con ejecución local, generación de export JSON, build y despliegue estático.
- Construye un commit local de versión candidata (`release`/`feat` convencional) y comprueba que el historial y el estado de Git son coherentes. **Antes de cualquier push público** comprueba explícitamente que el repositorio remoto es el esperado y que no vas a publicar ficheros sensibles o restringidos. No hagas `git push --force`.

## 8. CHECKPOINT 6C — DESPLIEGUE REAL SI EL ENTORNO LO PERMITE

**Objetivo preferente:** web estática en Vercel enlazada al repositorio GitHub, aprovechando Next.js con `output: 'export'`. Usa la configuración existente en vez de crear una segunda aplicación o backend innecesario. La documentación oficial de Next.js indica que `next build` genera `out/` para export estático y que ciertas funciones de servidor no están soportadas: valida compatibilidad antes de proceder.

Proceso:

1. Comprueba `web/next.config.ts`, `web/package.json`, `web/out/`, y cualquier archivo de configuración de Vercel ya existente. No generes configuraciones duplicadas; evita rutas hardcoded a `localhost`.
2. Comprueba el remoto real de Git (`git remote -v`) y que la cuenta/repo de GitHub realmente pertenecen al usuario. Si está disponible el inicio de sesión y permisos necesarios, verifica el repositorio antes de subir nada. Si falta autorización, **no inventes URL**: detente únicamente en el paso que la requiera y explica los clics o comandos exactos al usuario.
3. Si tienes autorización real para `push`, publica la rama acordada con commits seguros; nunca sobrescribas historia remota mediante force push. Si no hay autorización, deja el commit listo para que el usuario lo publique.
4. En Vercel, configura `Root Directory = web`, framework Next.js y comandos efectivos según `package.json`; usa deploy desde GitHub preferiblemente, sin comprar servicios ni usar dominio de pago. Evita forzar un `Output Directory` incompatible con la detección del framework: valida el resultado que genera `output: 'export'`.
5. Publica solo después de validar localmente; visita la URL pública real cuando puedas y comprueba portada + 7 rutas, assets JS/CSS, JSON públicos, mapa, carga móvil, enlaces y que los datos de encuestas y fechas no sean inventados. Si no puedes abrir la URL, di «despliegue iniciado, verificación pública pendiente», no «desplegado y verificado».
6. Si el entorno no dispone de GitHub/Vercel autenticado o requiere una autorización que no puedes obtener, **deja el despliegue listo**: `docs/PHASE6_DEPLOY_GUIDE.md` paso a paso para Windows/VS Code y lista de configuración. Estado final = `READY_TO_DEPLOY`, no `DEPLOYED`.
7. Guarda la URL de producción solo si existe y fue comprobada. Nunca simules enlaces, logs de CI ni capturas.

## 9. CHECKPOINT 6D — QA FINAL DE PRODUCCIÓN Y ENTREGA

- Pruebas: Python, TypeScript, ESLint, Vitest, build producción, cobertura básica de páginas, enlaces internos, filtro `Todos`, responsividad y accesibilidad. Guardar comandos y resultados exactos.
- Asegura páginas con datos no vacíos, formato correcto de puntos porcentuales, denominadores, desagregación provincial, filtros funcionales, fechas de observación y fuentes. Comprueba no haber creado pronósticos de elecciones 2026.
- Confronta las métricas del laboratorio de ML frente a `reports/tables/phase4` y el número de folds; no copies sin comprobar.
- Verifica que no se han roto fases 1–4. Si algún test falla, registra y corrige o declara bloqueo con evidencia.
- Entrega `docs/PHASE6_REPORT.md` con: estado `DEPLOYED_AND_VERIFIED` o `READY_TO_DEPLOY` o `BLOCKED`, URL auténtica si existe, commit/hash/branch, 8 rutas, resumen de QA, fuentes/licencias, velocidad/tamaño, decisiones de arquitectura, riesgos y pasos pendientes.
- Actualiza `README.md` y `docs/PHASE5_PROGRESS.md`/`docs/PHASE6_PROGRESS.md` acorde a hechos. Si hiciste push, registra rama y commit enviados.

## 10. CÓMO TRABAJAR SIN PERDER LA SESIÓN

**Obligatorio al terminar CADA checkpoint:** añadir en `docs/PHASE5_PROGRESS.md` o `docs/PHASE6_PROGRESS.md`: fecha/hora, tareas completadas, comandos ejecutados, fallos, ficheros tocados, commit cuando exista y siguiente tarea concreta. Evita comentarios genéricos «todo ok». Guarda cambios con frecuencia y deja instrucciones de recuperación ante límite de tokens/cierre súbito.

No sigas escribiendo sin ejecutar pruebas. Si te encuentras con un bloqueo externo (login, permisos de GitHub/Vercel, licencia no resuelta) completa todo lo que no dependa de ese bloqueo y termina con el paso exacto que debe realizar el usuario.

## 11. DEFINICIÓN DE TERMINADO — NO NEGOCIABLE

- **5 COMPLETA:** 8 rutas funcionales y conectadas con datos reales; mapa, partidos, encuestas, demografía y laboratorio ML; responsive; `npm run build` + typecheck + lint + tests web + `pytest` OK; etiquetas, licencias y colores correctos; documentos fase 5.
- **6 COMPLETA:** fase 5 cumple, Git seguro y documentado, app pulida, repo listo, build desplegado, URL pública **verificada** en todas las rutas, informe de fase 6. Si falta login, el estado correcto es `READY_TO_DEPLOY` (no decir «fase 6 completada»).

## 12. FORMATO DE LA RESPUESTA FINAL QUE DARÁS AL USUARIO

1. Checkpoints 5B–5E y 6A–6D con completado/pendiente/bloqueado.
2. Resumen por cada una de las 8 rutas.
3. Lista breve de archivos añadidos/modificados y commits.
4. Tabla de comandos y resultados **realmente ejecutados** (`pytest`, `npx tsc`, lint, test, build, E2E si hay).
5. Estado exacto del despliegue y URL únicamente si real.
6. Pasos cortos de Windows PowerShell para ejecutar localmente y, si hace falta, autorizar GitHub/Vercel.
7. Limitaciones técnicas y científicas que siguen vigentes.

**EMPIEZA AHORA por inspección y checkpoint 0; luego arregla errores TS; termina fase 5; pasa a fase 6 únicamente tras validación. No vuelvas a preguntarme detalles que ya constan en el repositorio.**
