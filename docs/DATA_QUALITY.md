# Calidad de datos — FASE 1

Tests: `tests/test_quality.py` — **15 passed** (`python -m pytest tests/ -q`).
Las divergencias reales no se ocultan: se cuantifican abajo.

## Resultado: 15/15 en verde, 0 `not_evaluable` convertidos en `passed`

(El caso `electores = CER + CERA` en elecciones sin CERA se evalúa como rama separada:
identidad exacta donde hay CERA + `assert` de nulls donde no la hay.)

## Controles y evidencia

| # | Control | Resultado |
|---|---|---|
| 1 | Sin filas 2026 (no inventar el 29N) | passed: 16 comicios, 1977 → 2023 |
| 2 | Cobertura elecciones | passed: 16 fechas exactas |
| 3 | 52 provincias, códigos texto 2 dígitos | passed (`01`…`52`, ceros conservados) |
| 4 | Claves únicas en `election_results` | passed: 0 duplicados en 92 456 filas |
| 5 | Votos/escaños/CERA no negativos | passed |
| 6 | Tasas en [0, 100] | passed (rango observado 41,36–87,62) |
| 7 | Votantes ≤ electores | passed (832/832) |
| 8 | `votantes = válidos + nulos`; `válidos = candidaturas + blancos` | passed exacto (diff máx = 0) |
| 9 | `electores = CER + CERA` (solo con CERA) + nulls sin CERA | passed; 156 nulls = 3 elecciones × 52 prov (1977, 1979, 1982) |
| 10 | Σ votos candidaturas ≈ `votos a candidaturas` | passed con tolerancia: 824/832 exactos; 8 desajustes (ver tabla) |
| 11 | CERA ⊆ total (prohibido sumar) | passed: 0 casos con CERA > total |
| 12 | Σ escaños nacionales = 350 | passed en las 16 elecciones |
| 13 | `election_turnout` 16×52 sin huecos | passed: 832 filas, 0 duplicados |
| 14 | Población 2021–2025, 52 provincias, ≥ 0 | passed (limitación: sin 1977–2020) |
| 15 | Etiquetas originales preservadas | passed |

## Divergencias reales documentadas (no ocultas)

Σ votos por (elección, provincia) vs `Votos a candidaturas` discrepa en **8/832 celdas (0,96 %)**, todas con |rel| < 1 %:

| Elección | Provincia | Σ etiquetas | Oficial | Diff |
|---|---|---|---|---|
| 1993-06-06 | 05 Ávila | 113 337 | 113 319 | +18 |
| 1993-06-06 | 10 Cáceres | 258 076 | 258 080 | −4 |
| 1993-06-06 | 18 Granada | 462 498 | 462 478 | +20 |
| 1993-06-06 | 20 Gipuzkoa | 363 240 | 363 248 | −8 |
| 1993-06-06 | 21 Huelva | 247 689 | 246 656 | **+1 033 (0,42 %)** |
| 2000-03-12 | 19 Guadalajara | 100 878 | 100 887 | −9 |
| 2000-03-12 | 36 Pontevedra | 526 032 | 526 039 | −7 |
| 2008-03-09 | 30 Murcia | 760 864 | 760 861 | +3 |

Hipótesis: micro-diferencias de etiquetado en origen (p. ej. candidaturas con misma etiqueta
contadas de forma distinta en el agregado). No se ha "corregido" nada: los Parquet conservan
ambos valores y el test fija el umbral (|rel| < 1 %, < 5 % de celdas).

## Riesgos de doble recuento identificados y mitigados

1. **CERA**: `Votos CERA (X)` es subconjunto del total `Votos (X)` (verificado Madrid 2023:
   Electores 5 224 561 = CER 4 848 057 + CERA 376 504). Va en tabla separada
   (`election_results_cera`, 73 684 filas). Test 11 lo blinda.
2. **Etiquetas repetidas intra-elección** (156 grupos, p. ej. PP-2015 en 45 filas = variantes
   provinciales de coalición con idéntica etiqueta): se **suman** por (elección, provincia, etiqueta)
   antes de unir votos↔escaños (evita explosión cartesiana). Sin esta agregación, el cruce
   producía 943 176 filas falsas; tras ella, 92 456. Σ escaños = 350 en las 16 elecciones lo valida.
3. **Agregados nacionales vs provinciales**: `election_turnout` es provincial; los nacionales se
   agregan por suma en EDA (tasas recalculadas, nunca promediadas).
4. **Etiquetas que cambian entre elecciones** (PP `P.P.` vs `PP` en 2011; PSOE-Progresistas en 2000):
   series por etiqueta exacta NO son comparables sin un mapeo curado (ver `docs/EDA.md`).
   No se fusiona nada automáticamente.
