# Fuentes de encuestas: estado y pendientes (FASE 2)

Ingerido de verdad: **1 232 sondeos** (`polls.parquet`) y **12 945 estimaciones**
(`poll_estimates.parquet`), campo 2019-12-12 → 2026-10-11, 36 casas.
Tipos: 832 `estimated_vote` + 400 `direct_intention`. Licencia: CC BY-SA 4.0
(`attribution_required`). Exclusiones legítimas: 24 filas artefacto (sin encuestadora
ni fecha o partido como "encuestadora") + celdas de escaños (unidad incompatible con %).

## Fuente ingerida (automatizable y legal)

| Fuente | URL | Rev. | Cobertura | Licencia |
|---|---|---|---|---|
| Wikipedia EN, polling 2026 | https://en.wikipedia.org/wiki/Opinion_polling_for_the_2026_Spanish_general_election | 1380368158 | 774 sondeos nac.-Congreso 2023→2026 | CC BY-SA (atribución) |
| Wikipedia EN, polling 2023 | https://en.wikipedia.org/wiki/Opinion_polling_for_the_2023_Spanish_general_election | 1375363334 | 458 sondeos nac.-Congreso 2019→2023 | CC BY-SA (atribución) |

Omitido a propósito y registrado: escenarios hipotéticos, `victory likelihood`,
sondeos subnacionales y 8 filas de resultado oficial apartadas a
`polls_result_rows.json` (2023 generales ×4, europeas 2024, locales 2023, Nov-2019;
la fila 2023 valida el parseo: PP 33,1 / PSOE 31,7 / Vox 12,4 / Sumar 12,3 = oficial
Interior). Sin fecha de
publicación en origen → `published_at = null`; los cortes usan fin de campo
(`quality_flag = no_pubdate_use_fieldwork`).

## Pendientes (no automatizables sin violar condiciones; plantilla en `data/templates/`)

| Fuente | URL | Acción pendiente | Prioridad |
|---|---|---|---|
| CIS, estimación de voto por barómetro (PDF) | https://www.cis.es/es/estudios/barometro-de-diciembre-2023 (y barómetros 2024–2026) | Transcripción manual con ficha (n, método CATI, universo 18+) | alta |
| CIS, condiciones de reutilización | https://www.cis.es/ (Condiciones Reutilización datos del CIS) | Verificar cita obligatoria antes de redistribuir valores | alta |
| CIS, microdatos FID (gratuito) | https://www.cis.es/es/catalogo-estudios/fid/acceso-a-datos | Descarga manual + script de estimación propia | media |
| ElectoGraphica (fichas 40dB/Sigma Dos/…) | https://www.electografica.com/ | Solo contraste puntual (licencia no verificada; no ingerir en bloque) | media |
| Ondacero / prensa (agregadores) | https://www.ondacero.es/elecciones/generales/encuestas/ | Contraste editorial, no fuente de datos | baja |
| Casas (GAD3, Sigma Dos, DYM, 40dB, NC Report…) | webs propias | Solo vía compilación CC citada; sus PDFs son de sus clientes/medios | — |

Validar cualquier carga manual con: `python src/electoral/polls.py --validate data/templates/polls_manual_template.csv`
