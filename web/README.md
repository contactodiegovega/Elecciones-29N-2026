# Web del Observatorio Electoral (Next.js, estática)

## Ejecutar localmente (PowerShell, desde `web/`)

```powershell
npm install
npm run dev      # http://localhost:3000
```

## Regenerar datos (desde la raíz del repo)

```powershell
python src/electoral/simulator.py     # escaños oficiales 2026 (RD 806/2026)
python src/electoral/export_web.py    # JSON públicos + model_registry.json
```

## Secciones

- `/` portada y estado editorial.
- `/prediccion` registro de versiones del modelo y gate NO-GO (sin proyección 2026).
- `/encuestas` sondeos por casa, tipo y fecha; estimación e intención separadas.
- `/diputados` los 350 escaños provincia a provincia, con el cambio oficial de 2026.
- `/analisis` índice de histórico, participación, demografía, modelos, simulador y metodología.
- `/territorio`, `/campana`, `/partidos`: versiones anteriores, accesibles desde «Más análisis».

## Validar y desplegar

```powershell
npm run lint; npm run typecheck; npm test; npm run build
```

El build genera `web/out/` (export estático, sin servidor). En Vercel: Root Directory
`web`, framework Next.js, sin variables de entorno. Detalle: `docs/PHASE6_DEPLOY_GUIDE.md`.
