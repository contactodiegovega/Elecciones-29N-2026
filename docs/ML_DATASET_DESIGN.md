# Diseño de datasets ML — FASE 2 (sin entrenar; backtest futuro en FASE 3)

## Tablas

| Fichero | Filas | Contenido |
|---|---|---|
| `turnout_features.parquet` | 780 | 15 transiciones × 52 prov: `prev_turnout`, `delta_prev`, `mean_last3`, `electores_growth_prev`, `cera_share_prev`, `n_prev_elections` |
| `turnout_targets.parquet` | 780 | `target_turnout` separado (no dentro de features) |
| `party_evolution_features.parquet` | 10 764 | (target, prov, partido presente en t−1): `prev_share`, `delta_share_prev`, `prev_votes/seats`, `n_prev_present` |
| `party_targets.parquet` | 10 764 | `target_share/votes`, `present_in_target` |
| `poll_features.parquet` | 10 316 | 3 397 pre-2023 + 6 919 ciclo-2026: `estimate_pct`, `estimate_type`, `days_to_election`, `sample_size` |

| `poll_targets.parquet` | 1 346 | `poll_error_pp` vs oficial PP/PSOE/VOX 2023 |
## Reglas de corte (`as_of_date`)

- `as_of_date` = fecha de la última elección con datos usados (turnout/party) o fin de
  campo del propio sondeo (polls). Siempre `< target_election_date` (test).
- `feature_available_at` = `data_published_at` = `as_of_date` (Interior publica el mismo
  día; INE anual con retardo no usado como feature salvo año ya publicado).
- Encuestas sin `published_at` en origen → corte conservador por fin de campo; nunca se
  usa un sondeo con campo posterior al corte aunque se publique antes.
- Ausencia en t−1 (partido) → sin fila (no 0). CERA 1977–82 → `cera_share_prev = null`.
- Población solo 2021–25: NO entra como feature (fuga de disponibilidad histórica).

## Targets históricos y baselines

1. `target_turnout` (provincia): baseline = `prev_turnout` (persistencia). Métrica: MAE/RMSE
   en pp por elección.
2. `target_share` (provincia × partido comparable): baseline = `prev_share`. Solo partidos
   con presencia en t−1; perímetro Sumar-2023 documentado en EDA_PHASE2 §5.
3. `poll_error_pp` (sondeo × PP/PSOE/VOX vs oficial 2023): baseline = 0 (error medio nulo);
   MAE observado 1,73 / 3,81 / 1,11 pp. Solo `estimated_vote` comparable con `estimated_vote`.

## Validación futura (FASE 3)

- Bloques por elección completa, expanding window: entrenar con elecciones < t, evaluar en
  t ∈ {2004, 2008, 2011, 2015, 2016, 2019-04, 2019-11, 2023}. Jamás split aleatorio
  intra-elección.
- n efectivo: 15 transiciones (turnout), 10 764 filas correlacionadas intra-elección
  (party), 1 346 errores de sondeo (polls, 140 sondeos únicos en ventana ≤30 días pre-2023). Incertidumbre
  obligatoria.
- Advertencias: etiquetas 2000/2011/2015 no comparables sin mapeo (ya aplicado a nivel
  partido); inferencia ecológica provincia→individuo prohibida; el ciclo 2026 aporta
  features sin target (elección futura).

## Carencias antes de entrenar (veredicto §10 del resumen)

Suficiente para backtest de participación y de error de sondeos; insuficiente para voto
por partido nuevo (n=16 ciclos, perímetros cambiantes) y para cualquier modelo con
demografía/economía (covariables ausentes).
