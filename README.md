# Observatorio Electoral España 2026 — FASES 1–5 (web incluida; fase 6 lista para desplegar)

Qué resuelve: explorar 16 elecciones generales al Congreso (1977–2023, 52
circunscripciones, 1.778 candidaturas), demografía/paro/renta provinciales con vintage,
1.232 sondeos fechados y la evaluación retrospectiva honesta de modelos de
participación (el baseline `mean3`, 3,56 pp macro, sigue ganando). Sin pronósticos del 29N.

## Web local (Next.js estático, desde `web/`)

```powershell
Set-Location web
npm install
npm run dev      # http://localhost:3000
```

## Pipeline completo (PowerShell, desde la raíz)

```powershell
# 1) Dependencias
python -m pip install -r requirements.txt

# 2) FASE 1: descarga + auditoría
python src/electoral/download.py

# 3) FASE 1: tablas limpias
python src/electoral/build_tables.py

# 4) FASE 2: taxonomía de partidos y cobertura
python src/electoral/taxonomy.py

# 5) FASE 2: colores corporativos (exporta data/processed/party_colors.json)
python src/electoral/colors.py

# 6) FASE 2: ingesta de encuestas (Wikipedia CC BY-SA; valida plantilla manual)
python src/electoral/polls.py
python src/electoral/polls.py --validate data/templates/polls_manual_template.csv

# 7) EDA fase 1 (5 figuras, regeneradas con colores corporativos) + EDA fase 2 (12 figuras)
python src/electoral/eda.py
python src/electoral/eda_phase2.py

# 8) FASE 2: features con corte temporal (sin entrenar)
python src/electoral/features.py

# 9) FASE 3: backtest participación (baselines + Ridge/ElasticNet/HGBR, expanding window)
python src/electoral/ml/backtest.py

# 10) FASE 3: diagnóstico encuestas 2023 (descriptivo; NO se entrena corrector) + piloto PSOE
python src/electoral/ml/poll_diagnostics.py
python src/electoral/ml/party_pilot.py

# 11) FASE 3: figuras (4 PNG en reports/figures/phase3/)
python src/electoral/ml/figures.py

# 12) Tests (45: 15 fase 1 + 18 fase 2 + 12 fase 3)
python -m pytest tests/ -q

# 13) FASE 4: enriquecimiento INE (padrón/EPA/renta/censo) + EDA + revalidación ML
python src/electoral/enrichment.py
python src/electoral/eda_phase4.py
python src/electoral/ml/revalidate.py

# 14) Tests finales fase 4 (53 en total)
python -m pytest tests/ -q

# 15) FASE 5: exportar datos web + validar + compilar
python src/electoral/export_web.py
Set-Location web
npm run lint; npm run typecheck; npm test; npm run build

# 16) CLI de consulta de TODAS las candidaturas (top-N, Todos, búsqueda, filtros, export)
python src/electoral/query.py --election 2023-07-23 --top 6
python src/electoral/query.py --election 2023-07-23 --top 0 --out todas_2023.csv
python src/electoral/query.py --search "BILDU" --top 0
```

## Árbol del proyecto

```
src/electoral/        # download, build_tables, taxonomy, colors, polls, eda,
                      # eda_phase2, features, query (+ __init__.py)
                      # ml/: backtest, poll_diagnostics, party_pilot, figures, leakage
config/               # party_colors.json (colores) + ml_phase3.json (semilla, folds, modelos)
data/raw/             # brutos sin modificar (Excel Interior, CSV INE, HTML encuestas)
data/processed/       # 20 parquet + audits, coverage, CSV resumen
data/reference/       # party_registry.csv
data/templates/       # polls_manual_template.csv (cargas manuales futuras)
notebooks/            # 01_exploracion_fase1.ipynb (opcional; los scripts bastan)
reports/figures/      # 5 PNG fase 1 (con colores corporativos)
reports/figures/phase2/  # 12 PNG fase 2
reports/figures/phase3/  # 4 PNG fase 3 (backtest y diagnóstico)
reports/figures/phase4/  # 12 PNG fase 4 (10 EDA + 2 revalidación)
reports/tables/phase2/   # 8 CSV íntegros (todas las candidaturas)
reports/tables/phase3/   # OOS + diagnósticos (ver § ML)
reports/tables/phase4/   # cobertura, diccionario, EDA, métricas revalidación
docs/                 # SOURCES, DATA_QUALITY, EDA, ML_FEASIBILITY (fase 1) +
                      # PHASE2_BASELINE_AUDIT, PARTY_TAXONOMY, PARTY_COLORS,
                      # POLL_SOURCES_PENDING, EDA_PHASE2, ML_DATASET_DESIGN +
                      # PHASE3_DATA_AUDIT, PHASE3_FEASIBILITY, PHASE3_BACKTEST_REPORT,
                      # PHASE3_MODEL_CARD +
                      # PHASE4_BASELINE_AUDIT, PHASE4_SOURCE_CATALOG,
                      # PHASE4_TEMPORAL_INTEGRITY, EDA_PHASE4, PHASE4_ML_REVALIDATION,
                      # PHASE4_SUMMARY
tests/                # test_quality.py (15) + test_phase2.py (18) + test_phase3.py (12)
                      # + test_phase4.py (8) = 53
```

## Resultados ML — FASE 3 (retrospectivo; detalle en `docs/PHASE3_BACKTEST_REPORT.md`)

| Modelo | Macro MAE (pp) | Ponderado censo |
|---|---|---|
| mean3 (baseline) | **3,56** | **3,38** |
| elasticnet | 3,64 | 3,34 |
| last_election | 4,00 | 3,95 |
| hgbr | 4,11 | 3,97 |
| ridge | 4,31 | 4,12 |
| trend1 | 6,89 | 6,77 |

6 elecciones retenidas (2011→2023), 1 872 predicciones OOS. **El ML no demuestra valor
sobre baselines simples.** Piloto PSOE: prev_share 3,48 < ridge 4,88. Encuestas 2023:
solo diagnóstico (1 elección etiquetada → NO GO a corrector).

Revalidación FASE 4 (mismos folds, +15 features INE con vintage): ridge 4,31→**3,80**,
hgbr 4,11→**3,68** (mejoran en 4–5/6 elecciones vs ML fase 3) pero `mean3` (3,56) sigue
ganando. Detalle en `docs/PHASE4_ML_REVALIDATION.md`.

## Tablas nuevas FASE 2 (`data/processed/*.parquet`)

| Tabla | Filas | Contenido |
|---|---|---|
| `party_registry` | 36 | catálogo curado de partidos/coaliciones |
| `candidacy_party_mapping` | 1 778 | (elección, etiqueta) → partido/familia opcional + confianza |
| `party_coverage` | 848 | candidaturas/votos/% cubierto por elección y provincia |
| `polls` | 1 232 | 36 casas, campo 2019→2026, con licencia y flags |
| `poll_estimates` | 12 945 | % por partido + indecisos/abstención; huecos sin fila |
| `turnout_features` / `turnout_targets` | 780 | features solo pasado + targets separados |
| `party_evolution_features` / `party_targets` | 10 764 | idem por (provincia, partido) |
| `poll_features` / `poll_targets` | 10 316 / 1 346 | idem por sondeo (targets solo pre-2023) |

## Supuestos registrados

- Etiquetas repetidas intra-elección se **suman** (Σ escaños = 350 × 16 lo valida);
  `Votos CERA` ⊂ `Votos` en tabla separada; tasas recalculadas, nunca promediadas.
- Mapeo a partido por reglas explícitas sobre etiqueta completa (nunca solo sigla);
  confluencias IU/Podemos/Sumar y UCD/AP/PP **no fusionadas**; `family_id` opcional solo
  PP/PSOE.
- Encuestas: compilación Wikipedia CC BY-SA con atribución; `published_at` desconocido →
  cortes por fin de campo; escaños/victory/hipotéticos/subnacionales excluidos y listados.
- Descarga de Interior con fallback TLS sin verificación (SHA/tamaño registrados).
