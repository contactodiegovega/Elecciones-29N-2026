# Progreso FASE 6 (notas de recuperación)

## 6A Pulido (2026-10-16)
- Favicon propio (`icon.svg`), OG/Twitter sin dominio inventado, `robots.ts`.
- Sitemap descartado (sin dominio público aún; se añadirá tras el deploy).

## 6B Auditoría (2026-10-16)
- Sin secretos en repo; `data/raw` y caches ignorados; bruto GISCO 16 MB fuera de `public/`.
- `PHASE6_LICENSES.md`: CC BY 4.0 (INE), CC BY-SA (encuestas), ©EuroGeographics (mapa).
- Vulnerabilidades (echarts/postcss) solo subsanables con breaking changes: sin exposición
  real, documentadas, no bloquean.
- `README.md` principal y `web/README.md` actualizados (sin URL inventada).

## 6C Despliegue (2026-10-16) → READY_TO_DEPLOY
- Sin `gh`/`vercel`/`netlify` ni remoto Git: imposible push/despliegue automático.
- Guía paso a paso en `docs/PHASE6_DEPLOY_GUIDE.md` (Root Directory `web`).
- Build estático `web/out/` verificado localmente (8/8 rutas + JSON + mapa, HTTP 200).

## 6D QA (2026-10-16)
- pytest 53, tsc, eslint, vitest 8, build OK. E2E Playwright pendiente (manual).
