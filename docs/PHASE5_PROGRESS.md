# Progreso FASE 5 (notas de recuperación)

## 5A Auditoría/contrato/export — COMPLETO (2026-10-16)
- 53 tests Python en verde; Node 24.20.0 / npm 11.19.0.
- `docs/PHASE5_DATA_CONTRACT.md`, `src/electoral/export_web.py`,
  `config/web_export.json`, `docs/PHASE5_DATA_QA.md`.
- `web/public/data/*.json` + `web/public/maps/spain_provinces.geojson` generados
  (GISCO NUTS 2021 ©EuroGeographics, sha f21c64c40c4bfc9e).
- Decisión: sin backend Python (artefactos estáticos versionados); sin shadcn
  (componentes propios ligeros para controlar bundle); ECharts como única librería
  de gráficos; mapa ECharts + GeoJSON propio.

## 5B — siguiente: shell + portada + histórico.
