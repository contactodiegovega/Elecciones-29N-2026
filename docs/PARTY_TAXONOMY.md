# Taxonomía de partidos/candidaturas (FASE 2)

Versión: `2026-10-16.v1` (columna `taxonomy_version`). Generado por `src/electoral/taxonomy.py`.
Tablas: `data/processed/party_registry.parquet` (36 partidos),
`data/processed/candidacy_party_mapping.parquet` (1 778 filas = 100 % de etiquetas),
`data/processed/party_coverage.parquet` (848 filas: 16 nacional + 832 provincia),
`data/processed/mapping_coverage.csv`.

## Principios

- **Original primero**: cada etiqueta oficial conserva `candidacy_id = fecha::etiqueta`.
  Nada se borra ni se renombra; el mapeo es una capa aditiva.
- **Sin matching difuso**: reglas explícitas sobre la etiqueta **completa**
  (una misma sigla tiene hasta 22 nombres: IU 22, PSOE 20, PP 15).
- **Sin fusiones automáticas prohibidas**: UCD/AP/PP e IU/Podemos/Sumar NO se unifican.
  Las confluencias (En Comú, En Marea, Unidas Podemos, Unidad Popular…) quedan
  `unmapped` con justificación, pendientes de revisión manual documentada.
- **Coaliciones con identidad propia**: UPN-PP, Navarra Suma, CiU, DL, Compromís tienen
  `party_id` propio y no heredan color ni serie de sus integrantes.

## Cobertura del mapeo (% de votos por elección)

| Elección | % votos mapeado | | Elección | % votos mapeado |
|---|---|---|---|---|
| 1977 | 88,16 | | 2004 | 93,61 |
| 1979 | 89,85 | | 2008 | 92,87 |
| 1982 | 96,28 | | 2011 | 87,94 |
| 1986 | 94,66 | | 2015 | 84,32 |
| 1989 | 92,21 | | 2016 | 77,37 |
| 1993 | 92,33 | | 2019-04 | 84,62 |
| 1996 | 91,87 | | 2019-11 | 88,89 |
| 2000 | 92,65 | | 2023 | 94,54 |

477/1 778 etiquetas con partido (los 36 partidos del registro tienen al menos una);
el resto (1 301) son minoritarias históricas y
confluencias no fusionables automáticamente. El voto no mapeado concentra:
confluencias Podemos/IU 2015–2019 (correctamente sin fusionar: 2016 al 77 %),
minoritarios históricos 1977–1979 y Ruiz-Mateos 1989.

## Casos ambiguos revisados manualmente

- `PSOE-A` (1989, 1,79 M): variante andaluza → PSOE (medium).
- `PSOE-H` sector histórico 1977 → PSOE (medium, escisión documentada, no continuidad plena).
- `ERC-CatSí / ERC-Sobiranistes` → ERC (medium, coaliciones lideradas por ERC).
- `EUPV`, `IU-CA`, `IU/EU` → IU (medium, federaciones territoriales).
- Etiquetas con `SOCIALISTA` que NO son PSOE: `IU-VERDES-SOCIALISTAS INDEPENDIENTES`
  (excluida por regla), `CIUDADANOS EN BLANCO/CENB` ≠ `CS`, `CCD` ≠ `CS`.
- `UPN-PP` (Navarra, incluye 0,38 M históricos) → coalición propia, no suma a PP ni UPN.
- `CUP-PR` → CUP; `EH Bildu` (con espacio, la sigla contiene espacio) → BILDU por
  presencia de `BILDU` en la etiqueta.

## Vista analítica opcional `family_id`

Solo `FAM_PP` (etiquetas encabezadas por PP, 1989–2023, excluye UPN-PP/Unidad Popular) y
`FAM_PSOE` (etiquetas socialistas, 1977–2023). Uso opcional con advertencia; jamás
sustituye a `candidacy_raw`. Resto: `null`.
