# Observatorio Electoral España 2026 — FASE 1 + FASE 2

Foco: **Data Science / ML**. Análisis histórico del Congreso (1977–2023) + encuestas
nacionales 2019–2026. El 29N-2026 aún no tiene resultados: **no se inventa ninguna fila
de 2026 ni pronósticos**. Alcance: FASE 1 (`OPENCODE_FASE_1_DATOS_EDA.md`) y FASE 2
(`OPENCODE_FASE_2_ENCUESTAS_EDA_AVANZADO.md`): sin web, sin API, sin modelos entrenados.

## Requisitos

- Windows + VS Code + PowerShell, **Python 3.12+** (probado con 3.14.4).
- Sin venv obligatorio; instalar dependencias con pip.

## Instalación y ejecución (PowerShell, desde la raíz del repo)

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

# 9) Tests (33: 15 fase 1 + 18 fase 2)
python -m pytest tests/ -q

# 10) CLI de consulta de TODAS las candidaturas (top-N, Todos, búsqueda, filtros, export)
python src/electoral/query.py --election 2023-07-23 --top 6
python src/electoral/query.py --election 2023-07-23 --top 0 --out todas_2023.csv
python src/electoral/query.py --search "BILDU" --top 0
```

## Árbol del proyecto

```
src/electoral/        # download, build_tables, taxonomy, colors, polls, eda,
                      # eda_phase2, features, query (+ __init__.py)
config/               # party_colors.json (registro cromático central)
data/raw/             # brutos sin modificar (Excel Interior, CSV INE, HTML encuestas)
data/processed/       # 20 parquet + audits, coverage, CSV resumen
data/reference/       # party_registry.csv
data/templates/       # polls_manual_template.csv (cargas manuales futuras)
notebooks/            # 01_exploracion_fase1.ipynb (opcional; los scripts bastan)
reports/figures/      # 5 PNG fase 1 (con colores corporativos)
reports/figures/phase2/  # 12 PNG fase 2
reports/tables/phase2/   # 8 CSV íntegros (todas las candidaturas)
docs/                 # SOURCES, DATA_QUALITY, EDA, ML_FEASIBILITY (fase 1) +
                      # PHASE2_BASELINE_AUDIT, PARTY_TAXONOMY, PARTY_COLORS,
                      # POLL_SOURCES_PENDING, EDA_PHASE2, ML_DATASET_DESIGN
tests/                # test_quality.py (15) + test_phase2.py (18)
```

## Tablas nuevas FASE 2 (`data/processed/*.parquet`)

| Tabla | Filas | Contenido |
|---|---|---|
| `party_registry` | 36 | catálogo curado de partidos/coaliciones |
| `candidacy_party_mapping` | 1 778 | (elección, etiqueta) → partido/familia opcional + confianza |
| `party_coverage` | 848 | candidaturas/votos/% cubierto por elección y provincia |
| `polls` | 1 232 | 36 casas, campo 2019→2026, con licencia y flags |
| `poll_estimates` | 12 945 | % por partido + indecisos/abstención; huecos sin fila |
| `turnout_features` / `turnout_targets` | 780 | features solo pasado + targets separados |
| `party_evolution_features` / `party_targets` | 8 320 | idem por (provincia, partido) |
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
