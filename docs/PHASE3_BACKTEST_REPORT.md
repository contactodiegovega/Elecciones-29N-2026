# Informe de backtesting — FASE 3 (mediciones retrospectivas, no pronósticos)

Configuración: `config/ml_phase3.json` (semilla 42). Tablas OOS en
`reports/tables/phase3/`, figuras en `reports/figures/phase3/`.

## A. Participación provincial (%, 6 elecciones retenidas, 1 872 predicciones OOS)

| Elección test | last_election | mean3 | trend1 | ridge | elasticnet | hgbr | n_train |
|---|---|---|---|---|---|---|---|
| 2011-11-20 | 5,65 | 4,36 | 5,63 | 5,25 | 5,12 | 4,43 | 9 (468) |
| 2015-12-20 | **1,44** | 3,88 | 5,72 | 5,80 | 3,21 | 2,87 | 10 (520) |
| 2016-06-26 | 2,93 | 4,56 | 3,38 | 4,43 | 3,81 | **1,68** | 11 (572) |
| 2019-04-28 | 5,05 | **3,18** | 7,98 | 5,19 | 3,37 | 7,27 | 12 (624) |
| 2019-11-10 | 5,88 | 3,66 | 10,93 | **2,87** | 3,76 | 5,31 | 13 (676) |
| 2023-07-23 | 3,04 | **1,73** | 7,67 | 2,31 | 2,59 | 3,08 | 14 (728) |
| **Macro (media)** | 4,00 | **3,56** | 6,89 | 4,31 | 3,64 | 4,11 | — |
| **Ponderado censo** | 3,95 | **3,38** | 6,77 | 4,12 | 3,34 | 3,97 | — |

MAE en puntos porcentuales (RMSE, sesgo y MedAE por elección en `turnout_backtest.csv`).

**Conclusión honesta**: ningún modelo ML supera de forma consistente a los baselines
(`mean3` gana en macro y ponderado; `last_election` gana 2015; `ridge` gana 2019-11;
`hgbr` gana 2016 pero colapsa en 2019-04 con 7,27). Con n=6 elecciones de test, las
diferencias mean3 (3,56) vs elasticnet (3,64) no son evidencia de valor añadido del ML:
**sin valor demostrado**. Los choques de ciclo (repetición 2019, julio-2023) dominan.
`trend1` es el peor (6,89): extrapolar tendencias de participación falla sistemáticamente.

## B. Encuestas pre-2023 (diagnóstico, sin modelo: NO GO documentado)

1 346 errores contra oficial 2023 (PP 449, PSOE 448, VOX 449; 449 sondeos únicos,
386 canónicos). Por ventana (`poll_2023_by_window.csv`): el MAE crece con la anticipación
(p. ej. PSOE ≤7d 3,88 → >90d 10,20); VOX se sobreestima en campaña (+1,45 de sesgo) y el
PSOE se infraestima (−4,94). `direct_intention` está a ~10–15 pp del oficial: es otro
universo, no un sesgo (nunca promediado con `estimated_vote`). No se entrena corrector:
una sola elección etiquetada.

## C. Piloto PSOE provincial (GO con reservas)

| Elección | prev_share | ridge_psoe |
|---|---|---|
| 2015-12-20 | 5,85 | 5,18 |
| 2016-06-26 | **0,86** | 2,94 |
| 2019-04-28 | **6,03** | 8,26 |
| 2019-11-10 | **1,35** | 2,94 |
| 2023-07-23 | **3,29** | 5,10 |
| Macro | **3,48** | 4,88 |

Ridge pierde contra persistencia en 4/5 elecciones: **tampoco hay valor demostrado**.
Resto de partidos: solo descriptivo (VOX 3 ciclos, SUMAR 1; perímetros 2015–19 sin
fusionar). Plan de datos: ≥2–3 ciclos más por entidad, demografía por edad y economía
fechada pre-elección.

## Limitaciones (para portfolio, decir solo esto)

- n=6 elecciones de test (participación) y n=1 elección etiquetada (encuestas):
  intervalos por bloques inviables; toda mejora aparente puede ser ruido de ciclo.
- 52 provincias correlacionadas intra-elección: nunca 52 experimentos independientes.
- Sin demografía/economía fechada: el techo de estos baselines es estructural.
