# Guía de despliegue — Vercel (READY_TO_DEPLOY)

Estado: la app compila en estático (`web/out/`) y está lista. Falta autorización
externa: crear repo GitHub + importar en Vercel (sin `gh` local ni remoto configurado).

## 1. Publicar en GitHub (PowerShell, una vez)

```powershell
# desde la raíz del repo
git remote add origin https://github.com/<TU-USUARIO>/observatorio-electoral-2026.git
git push -u origin main
```

Comprobar antes: `git status --short` limpio salvo lo esperado; jamás `.env`/claves
(ver `docs/PHASE6_LICENSES.md`). No usar `--force`.

## 2. Importar en Vercel

1. https://vercel.com/new → Import Git Repository → el repo anterior.
2. **Root Directory = `web`** (obligatorio; el monorepo Python queda fuera del deploy).
3. Framework: Next.js (autodetectado). Build Command: `npm run build` (por defecto).
   No fijar Output Directory (con `output: export` Vercel sirve `out/`).
4. Sin variables de entorno (la app no usa secretos ni APIs).
5. Deploy → abrir la URL `https://<proyecto>.vercel.app` y verificar: portada + 7 rutas,
   JSON en `/data/meta.json`, mapa en `/territorio`, party colors y ausencia de pronósticos.

## 3. Actualizaciones futuras

```powershell
python src/electoral/export_web.py   # regenera web/public/data
git add web/public/data docs; git commit -m "chore: actualizar datos web"; git push
```

Vercel redespliega solo con cada push a `main`.
