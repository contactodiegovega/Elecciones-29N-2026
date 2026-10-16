# Integridad temporal — FASE 4

Módulo: `src/electoral/temporal_join.py`. Cada fila enriquecida lleva `vintage_ref`
(referencia usada) y `vintage_status` (`rule`/`assumed`).

## Reglas aplicadas (conservadoras, sin metadatos de release por vintage)

- Padrón 1-ene (36780) y 2852: referencia = año(elec)−1 (publicado por RD en diciembre
  previo). Excepción documentada: 2852 termina en 2021 → último ≤ vintage (2023 usa 2021).
- EPA: último trimestre con fin+45d < elección (p. ej. 2023-07-23 → 2023T1; 2019-04-28 → 2018T4).
- ADRH: referencia ≤ año−2 con `assumed` (retardo ~2a no verificable automáticamente).
- 67217: sin vintage verificable → `EDA_only`, nunca feature.

## Cobertura por elección (`feature_coverage.csv`)

- 1979–1996: todo nulo justificado (sin padrón/EPA/ADRH) → el ML excluye esas features
  o reduce periodo (ver revalidación: mismos 6 folds 2011→2023, todos con padrón+EPA).
- 2000: solo 2852. 2004–2007: padrón+EPA (sin growth-2004: falta 2002).
- 2019A/2019N: ADRH 2017 parcial (Álava/Navarra + pensiones forales ausentes: régimen
  fiscal distinto, hueco metodológico real, imputación solo-mediana-en-train).
- 2023: completo (padrón 2022, EPA 2023T1, ADRH 2021, 2852→2021).
- Sin ffill entre cambios metodológicos; sin mezclar niveles; Ceuta/Melilla con sus
  códigos 51/52 en todas las series (ADRH crosswalk verificado 52/52).

## Guardia de tests

`temporal_join.is_usable(release, as_of)` + `ml/leakage.check_frame` (fase 3):
un campo post-corte nunca entra a entrenamiento (test sintético con fuga falla).
