# Web del Observatorio Electoral (Next.js, estática)

## Ejecutar localmente (PowerShell, desde `web/`)

```powershell
npm install
npm run dev      # http://localhost:3000
```

## Regenerar datos (desde la raíz del repo)

```powershell
python src/electoral/export_web.py
```

## Validar y desplegar

```powershell
npm run lint; npm run typecheck; npm test; npm run build
```

El build genera `web/out/` (export estático, sin servidor). En Vercel: Root Directory
`web`, framework Next.js, sin variables de entorno. Detalle: `docs/PHASE6_DEPLOY_GUIDE.md`.
