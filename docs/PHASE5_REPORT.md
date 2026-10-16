# Reporte FASE 5 — web Next.js del Observatorio

## 1. Archivos (añadidos; fases 1–4 intactas salvo `export_web.py`)

`web/{package.json,tsconfig,next.config.ts(postcss,tailwind,vitest,eslint)}`,
`app/{layout,page,globals.css,icon.svg,robots.ts}`,
`app/{historico,territorio,partidos,encuestas,demografia,laboratorio-ml,metodologia}/page.tsx`,
`components/{EChart,ui}.tsx`, `lib/{types,data,utils,web.test}.ts`,
`public/data/*.json` (33) + `labels_by_election/*.json` (16) + `maps/spain_provinces.geojson`;
`src/electoral/export_web.py` (+saneado NaN, demografía ampliada, raw GISCO en `data/raw/`);
`config/web_export.json`; docs `PHASE5_{DATA_CONTRACT,DATA_QA,PROGRESS}`.

## 2. Regeneración y arranque local (probados en PowerShell)

```powershell
python src/electoral/export_web.py   # idempotente, falla ante incoherencias
Set-Location web; npm install
npm run lint; npm run typecheck; npm test; npm run build
npm run dev    # http://localhost:3000
```

## 3. Datasets web y cobertura

33 JSON + 16 por elección (~11 MB) + GeoJSON 314 KB. Invariantes verificados por el
exportador y 8 tests: 1.778 etiquetas, **81/81 en 2023**, 52 provincias, 16 elecciones,
sin 2026, 0 filas de resultado en encuestas, ML = CSV fase 3/4.

## 4. Rutas (8, datos reales)

`/` portada con serie top+Todos y KPIs · `/historico` métricas, cambios A→B y tabla
completa exportable · `/territorio` mapa GISCO navegable + ficha provincial íntegra ·
`/partidos` catálogo 1.778 + comparador ×5 + verificación de mapeo ·
`/encuestas` ciclos 2023/2026, tipos separados, réplicas marcadas ·
`/demografia` 11 indicadores con vintage + dispersión (r ecológica) ·
`/laboratorio-ml` folds, MAE f3/f4, mapa OOS, veredicto mean3 ·
`/metodologia` fuentes, unidades, vintage y porqués.

## 5. Tests y build (resultados verdaderos)

- `pytest`: 53 passed. `tsc`: limpio. `eslint`: limpio (2 avisos corregidos:
  ref-en-render, `??` inalcanzable). `vitest`: **8 passed** (colores, 81/81, 16
  elecciones, 832 turnout, encuestas, ML). `next build`: OK, 8 rutas estáticas.
- QA servida en estático (`out/` + http.server): 8/8 rutas 200, JSON y GeoJSON 200.
- E2E Playwright: **no ejecutado** (pendiente manual: flujos críticos, 375/768/1366px,
  teclado, contraste). Capturas: pendientes.

## 6. ML y pronósticos

Importado de CSV; veredicto visible: mean3 gana. Sin predicciones 29N en ninguna ruta.

## 7. Limitaciones y deuda

- Sin E2E; sin capturas verificadas; mapa con zoom global (Ceuta/Melilla pequeñas,
  tabla como alternativa accesible).
- `nuts3_europe_03M.geojson` (16 MB) fuera de `public/` (en `data/raw/`, ignorado).
- Vulnerabilidades documentadas en `PHASE6_LICENSES.md` (echarts/postcss, sin
  exposición real; requieren breaking changes).
