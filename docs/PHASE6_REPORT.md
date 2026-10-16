# Reporte FASE 6 — estado: READY_TO_DEPLOY (no DEPLOYED)

## QA final
- Python: 53 passed. Web: `tsc` limpio, `eslint` limpio, `vitest` 8 passed,
  `next build` OK (8 rutas estáticas). Servido local (`out/`): 8/8 HTML 200,
  `meta.json`, `results_national.json` y GeoJSON 200.
- Rutas verificadas: `/`, `/historico`, `/territorio`, `/partidos`, `/encuestas`,
  `/demografia`, `/laboratorio-ml`, `/metodologia` (contenido real, filtros, CSV).
- ML web = CSV fase 3/4 (mean3 3,56 macro gana; veredicto visible). Sin pronósticos 29N.
- E2E Playwright: no ejecutado (pendiente manual: 375/768/1366px, teclado, contraste).

## Publicación
- Commit/branch: `main` local (ver `git log`). Sin remoto: **push bloqueado**.
- URL pública: **no existe** (no inventada). Para crearla: `docs/PHASE6_DEPLOY_GUIDE.md`
  (2 comandos git + import en Vercel con Root Directory `web`).

## Velocidad/tamaño
- First Load ~103 KB compartidos + ~350 KB por ruta (ECharts incluido); JSON
  bajo demanda (máx. 1,1 MB por elección); GeoJSON 314 KB. Sin dependencias de red
  en navegación (todo local).

## Riesgos y pendientes
- E2E manual; capturas reales; sitemap tras dominio; upgrades mayores
  (echarts 6, Next 16) planificados, no urgentes.
- Datos 2026: solo sondeos-medición; el resultado del 29N exigirá re-export + rebuild.
