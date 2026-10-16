# QA de datos web — FASE 5 (comprobaciones del exportador, 2026-10-16)

Verificado automáticamente en `src/electoral/export_web.py` (falla ante incoherencia):

- 1 778 etiquetas originales (`candidacy_id` único); **81/81 candidaturas 2023**.
- 52 provincias (códigos `01`–`52` con ceros); 16 elecciones (última 2023-07-23, sin 2026).
- 0 duplicados (elección, provincia, etiqueta); coaliciones preservadas (UPN-PP, CiU…).
- 0 filas de resultado oficial dentro de encuestas (8 apartadas en origen).
- 59 NUTS3 GISCO → 52 provincias (islas agregadas, crosswalk verificado, sin huérfanos).
- ML web = CSV fase 3/4 (macro mean3 3,56; 6 folds; 1 872 OOS): sin literales.
- Denominadores: cuota sobre votos a candidaturas del ámbito; turnout sobre electores.
- Nulos como `null` (sin ceros); `published_at` null declarado; vintage por fila.
