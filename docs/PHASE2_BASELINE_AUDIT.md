# Auditoría baseline FASE 1 (previa a FASE 2)

Fecha: 2026-10-16. Se re-ejecutó `pytest` (**15 passed**, 6,43 s) y se verificaron los
Parquet existentes. No se asume nada: todo lo de abajo está comprobado.

## Estado de artefactos Fase 1

| Tabla | Forma | Columnas | Cobertura |
|---|---|---|---|
| `elections` | (16, 7) | fecha, codigo, tipo, election_year, has_cera, source, total_seats | 1977-06-15 → 2023-07-23, Σescaños=350 ×16 |
| `territories` | (52, 5) | province_code (texto `01`–`52`), nombres Interior/INE, ccaa | 52 circunscripciones + CCAA |
| `candidacies` | (4 973, 4) | election_date, candidacy_raw, kind, n_province_rows | 1 fila por (elección, etiqueta, kind) |
| `election_results` | (92 456, 6) | election_date, province_code, province_name, candidacy_raw, votes, seats | 16×52×etiquetas; CERA excluido |
| `election_results_cera` | (73 684, 5) | … votes_cera | 1986–2023 (subconjunto) |
| `election_turnout` | (832, 20) | 13 agregados + 4 tasas | 16×52 completo |
| `population` | (1 080, 11) | year, geo_level, territory_*, ccaa_*, province_*, sexo, population | 2021–2025, 3 niveles, 3 sexos |
| Figuras fase 1 | 5 PNG | — | `reports/figures/fig1–fig5` |

## Conservación de TODAS las candidaturas: VERIFICADA (0 pérdidas)

Comparación directa raw → processed: **1 778 / 1 778 pares (fecha, etiqueta) conservados**,
0 ausentes. No se aplicó ningún umbral de votos/escaños en el ETL:
- 81 507 / 92 456 filas con `votes == 0` conservadas (ceros de origen, dispersión provincial real).
- Solo 2 311 filas con `seats > 0`; las **1 274 etiquetas sin escaño permanecen**.
- Matiz honesto: el Excel trae `0` tanto para "no se presentó" como para "0 votos"; la fuente
  no distingue ambos casos, así que se preserva el valor de origen y `party_coverage`
  (fase 2) cuantifica provincias con voto > 0 por candidatura.

## Problemas heredados (se conservan, se documentan, no se reescriben)

1. **Etiquetas repetidas intra-elección** (156 grupos; PP-2015 en 45 filas): sumadas por
   (elección, provincia, etiqueta). Sin ello, explosión cartesiana a 943 176 filas.
2. **Etiquetas inestables entre elecciones** (PP `P.P.`/`PP`; PSOE-Progresistas 2000):
   series por etiqueta exacta no comparables → motiva `candidacy_party_mapping` (fase 2).
3. **8/832 micro-desajustes** Σvotos vs agregado oficial (|rel| < 1 %; Huelva-1993 +1 033).
4. **Población solo 2021–2025**: sin serie 1977–2020 ni edad.
5. **CERA ausente 1977–1982** (156 nulls); `electores = CER + CERA` exacto desde 1986.
6. **Descarga Interior con fallback TLS** sin verificación (SHA/tamaño registrados).
7. Figuras fase 1 con paleta por defecto de matplotlib (sin colores corporativos) →
   **se regeneran en fase 2** con el registro cromático.

## Conclusión

Base sólida y completa. Fase 2 construye encima sin tocar `download.py`/`build_tables.py`
ni los Parquet canónicos: añade catálogos (`party_registry`, mapping, colores, cobertura),
encuestas, EDA avanzado y features. Nada de `raw/`, notebooks o docs fase 1 se borra.
