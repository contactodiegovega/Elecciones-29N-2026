# Contrato de datos — FASE 5 (verificado contra Parquet reales)

Generado por `src/electoral/export_web.py` → `web/public/data/*.json` (+ `maps/`).
Todo artefacto es preagregado **sin perder el detalle**: las 1.778 etiquetas y las 81/81
de 2023 viajan íntegras (por elección, carga bajo demanda).

## Claves y correspondencias

- `province_code`: texto 2 dígitos `01`–`52` (Ceuta `51`, Melilla `52`; ceros conservados).
  Crosswalk: `territories.parquet` (Interior ↔ INE). GeoJSON: NUTS3→provincia (§ mapa).
- `election_date`: ISO `YYYY-MM-DD` (16 comicios 1977-06-15 → 2023-07-23). Sin 2026.
- `candidacy_raw` (original) vs `party_id` (normalizado, nullable) vs `family_id`
  (vista opcional solo FAM_PP/FAM_PSOE). `mapping_status` en encuestas:
  `mapped/unmapped_label/other_kept/nonvote_kept`.
- Denominadores: cuota = votos a candidaturas del mismo ámbito; participación =
  votantes/electores; tasas EPA sobre población; renta ADRH = % por fuente.
- Nulos: `null` = no disponible (jamás 0); `published_at` de encuestas siempre null
  en origen (cortes por fin de campo).

## Artefactos públicos (`web/public/data/`)

| Fichero | Origen | Filas | Contenido |
|---|---|---|---|
| `meta.json` | elections + audits | 1 doc | elecciones, conteos, fuentes, licencias, corte |
| `territories.json` | territories | 52 | provincias + CCAA |
| `results_national.json` | results+turnout+mapping | 16 | por elección: censo, turnout, partidos (votos/cuota/escaños), no-mapeado, n_etiquetas |
| `labels_by_election/{fecha}.json` | results+mapping | 16 ficheros | (provincia, etiqueta, partido, votos, escaños, cuota) íntegro |
| `turnout.json` | election_turnout | 832 | (elección, provincia) + tasas |
| `polls_2023.json` / `polls_2026.json` | polls+estimates | 458 / 774 sondeos | series por casa/partido/tipo; réplicas marcadas; result-rows excluidas |
| `demography.json` | phase4 enriched + series | 780 + series | (elección, provincia): 15 indicadores + vintage; + edad nacional y paro nacional |
| `ml.json` | phase3/phase4 CSV | 1 doc | folds, MAE/RMSE macro y por elección f3 vs f4, OOS agregados, piloto PSOE, diagnóstico 2023 |
| `oos_map.json` | predictions_oos f3 | 1 872 | (elección, provincia, modelo, error) para mapa del error |
| `colors.json` | party_colors.json | 36 | registro íntegro (provisional/fallback identificados) |
| `taxonomy.json` | registry+mapping | 36 + 1 778 | catálogo + mapeo completo + cobertura |
| `maps/spain_provinces.geojson` | GISCO NUTS 2021 ©EuroGeographics | 52 | geometría + `province_code`; islas agregadas (documentado) |

## Tipos TS

`web/lib/types.ts` refleja estos JSON (generado a mano a partir de este contrato;
validado en build con `zod`). Unidades en cada campo `_unit` o doc.
