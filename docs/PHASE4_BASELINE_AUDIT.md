# Auditoría baseline — FASE 4 (sin borrar nada)

- `python -m pytest tests/ -q`: **45 passed** (11,12 s). Python 3.14.4, sklearn 1.9.1, pandas 3.0.3, matplotlib 3.11.2.
- Tablas fase 1–3 intactas: `election_results` 16 elecciones × 52 provincias;
  `candidacy_party_mapping` **1 778 etiquetas** (36 partidos); `election_turnout` 832 filas;
  `polls` 1 232 (983 canónicas), `poll_estimates` 12 945; features turnout 780, party
  10 764, polls 10 316; `source_audit.csv` 8 fuentes.
- No-regresión candidaturas: consulta 2023 `Todos` = 81/81 (50 sin partido preservadas);
  verificación en `tests/test_phase2.py::test_listado_todos_topN_otros`.
- Dependencias reproducibles: `requirements.txt` + `pyproject.toml` (se añade lo que falte
  en fase 4 solo si se usa).
- Todos los artefactos nuevos de fase 4 van bajo `data/processed/phase4/`,
  `reports/{tables,figures}/phase4/` y `docs/PHASE4_*.md`. Reportes fase 1–3 intactos.
