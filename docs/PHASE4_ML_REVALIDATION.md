# Revalidación ML — FASE 4 (GO del experimento; NO GO de superioridad)

Mismos 6 folds y modelos pre-registrados que fase 3 (`config/ml_phase4.json`, semilla 42).
Features: 6 fase-3 + 15 nuevas (edad, extranjería, padrón, EPA, ADRH) con vintage
verificado. Imputación mediana solo-train (ADRH ausente en folds 2011–2016: columnas
descartadas por el imputador, documentado).

## Fase 3 vs fase 4 (mismo subconjunto, MAE pp)

| Elección | mean3 (f3) | ridge f3 → f4 | hgbr f3 → f4 |
|---|---|---|---|
| 2011-11-20 | 4,36 | 5,25 → 3,31 | 4,43 → 4,31 |
| 2015-12-20 | 3,88 | 5,80 → 3,43 | 2,87 → 2,19 |
| 2016-06-26 | 4,56 | 4,43 → 2,14 | 1,68 → 1,45 |
| 2019-04-28 | 3,18 | 5,19 → 6,35 | 7,27 → 5,94 |
| 2019-11-10 | 3,66 | 2,87 → 4,77 | 5,31 → 5,53 |
| 2023-07-23 | 1,73 | 2,31 → 2,81 | 3,08 → 2,68 |
| **Macro** | **3,56** | 4,31 → **3,80** | 4,11 → **3,68** |

Mejoras fase4 vs fase3-homólogo: ridge 4/6 elecciones, hgbr 5/6. Contra `mean3`:
fase 4 gana en 2/6 (2016, 2019N-ridge). **Veredicto: las nuevas features aportan señal
medible (−0,4/−0,5 pp macro vs ML fase 3) pero NO superan al baseline `mean3` (3,56):
superioridad NO demostrada con n=6.**

## Ablación exploratoria (Ridge, macro MAE)

full 3,80 · sin edad 3,55 · sin ADRH 3,72 · sin EPA 3,98. El bloque EPA es el que más
aporta; el de edad añade ruido con n pequeño. Exploratorio: bloques correlacionados,
n=6.

## Veredicto GO / NO GO

- Experimento: **GO** (backtest válido, sin fuga, reproducible).
- Mejora sobre baseline: **NO GO** (no forzar; conservar backtest fase 3 como referencia).
- Corrector de sondeos: **NO GO** (reiterado: 1 elección etiquetada).
- Modelos por partido nuevos: **NO GO** (sin independencia suficiente).

## Incertidumbre

n=6 elecciones de test: sin intervalos por bloques; 2019A domina el macro (6,35);
toda diferencia <1 pp macro puede ser ruido de ciclo. Tablas OOS íntegras en
`reports/tables/phase4/ml_predictions_oos_phase4.csv` (624 filas).
