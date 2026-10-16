# Resumen — FASE 4: enriquecimiento, EDA explicativo y revalidación

## Fuentes incorporadas (descargas reales en `data/raw/`, SHA en `source_coverage.csv`)

| Fuente | Tamaño | Rango real | Uso |
|---|---|---|---|
| INE 36780 (padrón por edad) | 121,1 MB | 1-ene 2003–2022 | ML (bandas 18–29/30–44/45–64/65+, extranjería) |
| INE 2852 (pob. total) | 0,1 MB | 1996–2021 | ML (total + fallback) + EDA comparativa |
| INE 72989 (EPA trim.) | 2,9 MB | 2002T1–2026T2 | ML (paro/actividad/empleo, vintage fin+45d) |
| INE 53687 (ADRH renta) | 0,3 MB | 2015–2023 | ML (5 mix renta, lag asumido, forales parciales) |
| INE 67217 (censo edad) | 25,7 MB | 2021–2025 | EDA_only (n=1 para ML) |
| CIS barómetros/FID | — | — | blocked/PENDING (sin transcripción automática) |

## Corpus: 780 filas × 52 provincias × 15 transiciones; 16 elecciones; 21 indicadores
enriquecidos con cobertura documentada (`feature_coverage.csv`); 1979–1996 con nulos
justificados (sin serie).

## Partidos: 1 778 etiquetas intactas, 479/36 mapeadas (75–99 % voto); `Todos` 81/81 en
2023. Backlog: resueltos CD-1979→AP y PSP-US-1977→PSOE (inequívocos); resto (confluencias
Podemos/IU) correctamente sin fusionar. Colores PP/PSOE/VOX + registro intactos.

## EDA (10 PNG + 9 hallazgos en `docs/EDA_PHASE4.md`)

Envejecimiento 45–64: 22,5→30,2 % (2003–22); extranjería 2,8–21,9 % provincial; paro
2023T1 6,7–30,8 %; bache salarial 2020; turnout-paro r=−0,38 y turnout-65+ r=+0,19
(ecológicos); censo/padrón 78,9 %.

## ML: GO del experimento, NO GO de superioridad

Ridge 4,31→3,80 y HGBR 4,11→3,68 macro (mejoran vs ML fase 3 en 4–5/6 elecciones),
pero `mean3` (3,56) sigue ganando. Ablación: EPA aporta más; edad añade ruido con n=6.
Sin fuga (corregida en `features.py`), mismos folds, sin tuning, sin 2026, sin corrector
de sondeos, sin modelos por partido nuevos.

## Tests: 53 passed (`python -m pytest tests/ -q`). Sin React ni pronósticos.

## Para fase 5 (web histórica + laboratorio)

Exponer: series 1977–2023 con `Todos`/búsqueda, mapa de errores OOS por provincia y
elección, comparador baseline-vs-ML con n visible, y panel de vintage por feature.
Requisito previo: panel edad×provincia×elección y renta per cápita con vintage.
