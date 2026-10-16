# Auditoría de datos — FASE 3 (ejecuciones reales, 2026-10-16)

33/33 tests previos en verde antes de modificar nada. Trazabilidad verificada abajo.

## Estado reconciliado

| Tabla | Forma | Claves temporales | Observaciones |
|---|---|---|---|
| `turnout_features` / `turnout_targets` | 780 / 780 | 15 transiciones (target 1979-03-01 → 2023-07-23), `as_of` = elección previa | `as_of < target` 100 %; CERA null 1977–82 heredado |
| `party_evolution_features` / `party_targets` | 10 764 / 10 764 (8 736 con presencia en target) | 16 ciclos; filas si presencia en t−1 (sin ceros); target null si ausente en t |
| `polls` | 1 232 (983 canónicas) | campo 2019-12-12 → 2026-10-11 | 249 réplicas enlazadas por `canonical_poll_id` (mismo sondeo en tablas estimate/preference); no son independientes |
| `poll_estimates` | 12 945 | 832 `estimated_vote` + 400 `direct_intention` (a nivel sondeo) | tipos jamás mezclados en el mismo corte |
| `poll_features` | 10 316 | 3 397 pre-2023 + 6 919 ciclo-2026 | ciclo-2026 sin target (elección futura) |
| `poll_targets` | 1 346 | **solo `2023-07-23`** (PP 449, VOX 449, PSOE 448) | UNA única elección etiquetada |
| `polls_result_rows` | 8 | 2023 generales ×4, europeas 2024, locales 2023, nov-2019 | 0 filas de resultado dentro de `polls` (verificado) |
| `published_at` | 1 232/1 232 null | — | origen no la publica; cortes por fin de campo (conservador, declarado) |

## Muestras efectivas por experimento (elecciones independientes, no filas)

- Participación: **15 transiciones** (1979→2023) × 52 provincias correlacionadas intra-elección.
- Encuestas: **1 elección etiquetada (2023)**; 1 346 errores anidados en ~449 sondeos × 3 partidos.
- Voto por partido: **16 ciclos** con perímetros cambiantes (mapeo 479/1 778 etiquetas;
  75–99 % del voto por elección). El catálogo es una vista parcial: series incompletas se
  etiquetan como tales y nunca se suman como total nacional.

## Campos críticos y bloqueos

- **Fuga detectada y corregida en `features.py` (auditoría fase 3)**: `delta_prev`,
  `electores_growth_prev` y `cera_share_prev` usaban valores de la elección objetivo;
  ahora desplazados a pasado estricto (verificado Madrid-2023: delta −4,87 = transición
  2019A→2019N, no 2019N→2023). `party_*`: filas ancladas en presencia en t−1 con target
  opcional (la existencia de la fila ya no revela presencia en t).

- `canonical_poll_id`: 983/1 232 (réplicas no independientes).
- `mapping_status`: `mapped` / `unmapped_label` / `other_kept` / `nonvote_kept`; huecos sin fila (nunca 0).
- Sin demografía por edad/renta ni economía fechada pre-elección: fuera de features.
- 29N-2026: sin resultados; sus 774 sondeos del ciclo son features sin target.
- Licencias: compilación Wikipedia CC BY-SA con atribución; no se transfieren permisos de
  las fuentes primarias a terceros.
