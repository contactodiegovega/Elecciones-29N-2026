# Despliegue en Vercel

## Modo vigente: revisión protegida

`vercel.json` ejecuta **`npm run build:review`**, no el build de publicación.
Construye Next.js en un directorio aislado con 78 recursos históricos permitidos,
sin JSON de encuestas/derivados ni páginas que los importen. Genera un manifiesto
auditable y copia la exportación a `out/`. Los originales se conservan.

Se ha aplicado y releído por API **Vercel Authentication → All Deployments**
(`ssoProtection.deploymentType=all`) en el proyecto. Las tres autorizaciones de
publicación siguen pendientes. Los builds completos de publicación siguen
bloqueados. Véase [protocolo y evidencias](PROTECTED_REVIEW.md) y
[auditoría de dependencias](NPM_SECURITY.md).

Para revisar localmente: `npm run build:review`; en PowerShell, después:
`$env:REVIEW_E2E='1'; npm run test:e2e`. Quitar esa variable para probar la web completa.

## Arquitectura comprobada

- Único servicio desplegable: **`web`**, Next.js en `web/`, público en `/`.
- `web/next.config.ts` utiliza `output: "export"`. Vercel construye Next.js y sirve
  los archivos estáticos. No se debe usar `next start` para esta exportación.
- Python es un pipeline de preparación de datos, no una API HTTP. No existe un
  servicio `app`, una API `/api` ni comunicación servidor a servidor que requiera bindings.
- `web/lib/data.ts` y `ProvinceExplorer.tsx` solicitan `/data/...`; los mapas usan
  `/maps/spain_provinces.geojson`. El catch-all público apunta a `web`, conservando
  estas rutas y las de `/_next/`.
- Los JSON de `web/public/data/`, las 52 fichas provinciales y el GeoJSON están
  versionados. Los parquet de `data/processed/` y las evidencias verificadas de
  `data/poll_updates/` también están en Git. No se necesitan los brutos ignorados
  de `data/raw/` para compilar la web.

## Instalación y compilación completa (distinta de la revisión)

`vercel.json` se encuentra en la raíz del repositorio y configura el servicio
`web` con raíz `web/`. Su instalación ejecuta:

```sh
npm ci
```

Vercel solo necesita Node.js (seleccionar 22.x). No se instala ni ejecuta Python,
pip o uv en el build. Esto evita `externally-managed-environment`: no se modifica
el Python gestionado de Vercel. El entrenamiento y la preparación de datasets
se ejecutan previamente, fuera del despliegue.

`npm run build` ejecuta primero `check:data`, un script Node que comprueba los
JSON necesarios, todas las elecciones del catálogo, las 52 fichas, los 350
escaños de ambos repartos y las 52 geometrías del mapa. No modifica datasets.
Valida también que el snapshot editorial siga siendo coherente con el periodo
actual de Madrid; si cambia el periodo, exige regenerarlo. Después, Next.js
produce la exportación en `web/out/`. El adaptador Next.js de Vercel gestiona el
resultado; no hay que sobrescribir Output Directory en el panel.

Los demás datasets públicos se generan antes de incorporarlos a Git mediante
el pipeline documentado en el README. Cada cambio de datos necesita una nueva
compilación/despliegue; la web estática no ejecuta Python al recibir peticiones.
El reloj editorial corresponde al snapshot preparado: los cambios de periodo
requieren regenerar, versionar y gestionar las versiones ya publicadas. Un sitio
estático ya desplegado no se actualiza automáticamente al cambiar la fecha.

Para regenerar antes de publicar (desde `web/`, en un entorno local con Python):

```sh
uv venv .venv-data
uv pip install --python .venv-data/bin/python -r requirements-build.txt
PYTHON=.venv-data/bin/python npm run prepare:data
```

En PowerShell/Windows, usar `.venv-data/Scripts/python.exe` en los dos últimos
comandos; asignar `$env:PYTHON = '.venv-data/Scripts/python.exe'` antes de ejecutar
`npm run prepare:data`. Este entorno está aislado y no modifica Python global.
El exportador completo sigue documentado en el README. Revisar y versionar los
JSON resultantes antes de hacer push; Vercel usa los artefactos del checkout.

## Bloqueo de publicación existente

Actualmente **un build de publicación completa se detendrá intencionadamente**:
`config/publication_policy.json` contiene los tres controles a `false`.
Tanto el validador Node como `next.config.ts` comprueban la publicación al detectar
`VERCEL`, incluso en Preview. La compilación de revisión no ejecuta ese camino:
exporta únicamente el catálogo histórico permitido y no autoriza una publicación
completa. Eliminar pip no concede los controles pendientes de esta política.

Antes de habilitar un despliegue, el responsable debe autorizar la publicación y
verificar la retirada de cachés y URLs antiguas, registrando los hechos en:

- `public_release_authorized`
- `cache_withdrawal_verified`
- `legacy_urls_withdrawal_verified`

Además, el calendario editorial debe permitir publicar. El comando
`npm run check:release` permite comprobar estas condiciones localmente.
La configuración de despliegue no concede esa autorización.

## Variables de entorno

| Variable | Dónde / uso |
| --- | --- |
| Ninguna obligatoria de aplicación | No hay secretos, URL de API ni variables `NEXT_PUBLIC_*` que configurar. |
| `VERCEL` | La inyecta Vercel. Activa el control de publicación; no asignarla manualmente. |
| `PYTHON` | Solo para `npm run prepare:data` fuera de Vercel: ejecutable Python, por defecto `python`. No se usa al compilar Next.js. |
| `PUBLIC_RELEASE` | Opcional local: cualquier valor no vacío activa el control de publicación. Preferir `npm run check:release`. |
| `POLL_UPDATES_ENABLED=true` | Variable de repositorio en GitHub Actions, solo si se quieren actualizaciones programadas de revisión en un repositorio privado. |

No hay bindings ni variables de servicio que establecer. La integración Git de
Vercel no necesita `VERCEL_TOKEN` en GitHub Actions.

## GitHub y Vercel

1. El servicio sigue siendo `web` en `/`, sin servicios internos/bindings.
   Mantener All Deployments para revisar. Resolver el bloqueo de publicación
   antes de cualquier publicación completa en abierto.
2. Incorporar los cambios y los datos actualizados a la rama que se vaya a desplegar.
3. Instalar la integración de Vercel para GitHub y conceder acceso al repositorio.
4. Importar el repositorio como **un único proyecto**, con Root Directory en la
   **raíz del repositorio (`.`)**, no en `web`: `vercel.json` define la raíz del servicio.
   Permitir la detección de Services y evitar overrides globales de framework,
   instalación, build y salida. Seleccionar Node.js 22.x.
5. La integración usa `main`. Mantener Vercel Authentication para **All
   Deployments**, no solo Preview, y comprobar acceso anónimo a cada dominio.
6. Tras la confirmación y autorización, desplegar y comprobar rutas profundas,
   `/data/provinces/24.json`, `/maps/spain_provinces.geojson`, calculadora y gráficos.
   Añadir el dominio propio cuando se haya verificado la instalación.

El workflow `.github/workflows/poll-review.yml` solo prepara revisión privada:
no sube cambios al repositorio ni despliega. Sus cachés y artefactos no llegan
automáticamente al checkout de Vercel. Los datos revisados que se quieran
publicar deben incorporarse a Git y generar un nuevo despliegue.

## Verificación local

### Corrección de `externally-managed-environment`

Comprobado tras eliminar Python del build:

- Instalación limpia: `npm ci --no-audit --no-fund` correcta.
- `npm run build` tras esa instalación: correcto, 24 páginas estáticas generadas.
- Python: 82 tests; Vitest: 54 tests; Playwright sobre la exportación: 8 tests.
- ESLint y TypeScript correctos.
- Simulando `VERCEL=1`, el build falla explícitamente por los tres controles
  pendientes de `publication_policy.json`, sin invocar Python. Este bloqueo
  independiente debe resolverse antes de que el despliegue remoto pueda terminar.

Después del despliegue, comprobar respuestas HTTP 200 y JSON (no HTML de error)
en `/data/meta.json`, `/data/provinces/index.json`, `/data/provinces/24.json`,
`/data/latest_polls.json`, `/data/polls_2026.json` y
`/maps/spain_provinces.geojson`. En el navegador, abrir `/`, cambiar de provincia
y transferir votos; abrir `/provincias` y seleccionar Ceuta/Melilla; abrir
`/encuestas`, desplegar la exploración y cambiar filtros. Revisar Network y
Console para detectar 404, errores de contrato o fallos de JavaScript.

Desde la raíz:

```sh
python -m pytest tests -q
```

Desde `web/`:

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run check:release
```

Los E2E sirven la exportación real `out/` y prueban mapas canvas, gráficos,
52 fichas, calculadora, rutas antiguas, recuperación de errores y móvil.
`check:release` fallará mientras la política actual bloquee publicar.

Para comprobar el enrutamiento de Services y los comandos de desarrollo desde
la raíz, usar `npx vercel@latest dev --local` (o `vercel dev` con proyecto vinculado).
No es un despliegue. El control de publicación puede bloquearlo si el CLI inyecta
`VERCEL`; debe respetarse la misma política.

### Resultado de la revisión inicial (16 de noviembre de 2026, anterior a la corrección de pip)

- Python: **82 tests correctos**.
- Vitest: **41 tests correctos**; lint y TypeScript correctos.
- `npm run build`: compilación optimizada y exportación estática correctas,
  con 24 páginas generadas. La preparación actualizó los dos JSON del reloj
  editorial (`latest_polls.json` y `publication_status.json`).
- Playwright sobre `out/`: **8 tests correctos** en la ejecución completa final.
  El gráfico de encuestas tuvo inicialmente un timeout de 5 segundos; pasó
  tanto en ejecución aislada como al repetir la suite completa.
- `npm run check:release`: bloqueo esperado por los tres controles pendientes.
- `vercel dev --local`: CLI 65.16.0 reconoce `web` como Next.js y acepta la
  configuración de Services. El arranque local no pudo completarse en esta
  carpeta Windows/OneDrive: `EPERM: operation not permitted, watch`. Queda
  pendiente probar el enrutamiento del CLI en un entorno sin ese bloqueo del
  watcher y comprobar el despliegue remoto una vez autorizado.

Las pruebas locales de la exportación validan la aplicación y sus recursos;
no equivalen a una comprobación del CDN de Vercel. No se ha desplegado.
