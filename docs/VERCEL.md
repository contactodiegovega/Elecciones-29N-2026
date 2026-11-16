# Despliegue en Vercel

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

## Compilación

`vercel.json` se encuentra en la raíz del repositorio y configura el servicio
`web` con raíz `web/`. Su instalación ejecuta:

```sh
python -m pip install -r requirements-build.txt && npm ci
```

Vercel debe disponer de Python >=3.12 y Node.js 22.x en el entorno de build.
`web/requirements-build.txt` instala únicamente las dependencias de preparación
de la web; el entrenamiento y los análisis científicos no se ejecutan en Vercel.

`npm run build` ejecuta primero `prepare:data`, que llama a
`python -m src.electoral.web_publication` desde la raíz, actualizando el reloj
editorial y los JSON de encuestas sin descargar fuentes nuevas. Después, Next.js
produce la exportación en `web/out/`. El adaptador Next.js de Vercel gestiona el
resultado; no hay que sobrescribir Output Directory en el panel.

Los demás datasets públicos se generan antes de incorporarlos a Git mediante
el pipeline documentado en el README. Cada cambio de datos necesita una nueva
compilación/despliegue; la web estática no ejecuta Python al recibir peticiones.
El reloj editorial también queda fijado en el build: los cambios de periodo
requieren regenerar y gestionar las versiones ya publicadas.

## Bloqueo de publicación existente

Actualmente **un build en Vercel se detendrá intencionadamente**:
`config/publication_policy.json` contiene los tres controles a `false`.
Tanto el preparador como `next.config.ts` comprueban la publicación al detectar
`VERCEL`, incluso en Preview.

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
| `PYTHON` | Opcional para los scripts Node: ejecutable Python, por defecto `python`. La instalación configurada requiere que `python` esté disponible. |
| `PUBLIC_RELEASE` | Opcional local: cualquier valor no vacío activa el control de publicación. Preferir `npm run check:release`. |
| `POLL_UPDATES_ENABLED=true` | Variable de repositorio en GitHub Actions, solo si se quieren actualizaciones programadas de revisión en un repositorio privado. |

No hay bindings ni variables de servicio que establecer. La integración Git de
Vercel no necesita `VERCEL_TOKEN` en GitHub Actions.

## GitHub y Vercel

1. Revisar y confirmar el nombre `web`, su exposición en `/` y la ausencia de
   servicios internos/bindings. Resolver el bloqueo de publicación antes de publicar.
2. Incorporar los cambios y los datos actualizados a la rama que se vaya a desplegar.
3. Instalar la integración de Vercel para GitHub y conceder acceso al repositorio.
4. Importar el repositorio como **un único proyecto**, con Root Directory en la
   **raíz del repositorio (`.`)**, no en `web`: `vercel.json` define la raíz del servicio.
   Permitir la detección de Services y evitar overrides globales de framework,
   instalación, build y salida. Seleccionar Node.js 22.x.
5. Elegir explícitamente la rama de producción y los permisos/visibilidad de
   Preview. El control de publicación actual también se aplica a Preview.
6. Tras la confirmación y autorización, desplegar y comprobar rutas profundas,
   `/data/provinces/24.json`, `/maps/spain_provinces.geojson`, calculadora y gráficos.
   Añadir el dominio propio cuando se haya verificado la instalación.

El workflow `.github/workflows/poll-review.yml` solo prepara revisión privada:
no sube cambios al repositorio ni despliega. Sus cachés y artefactos no llegan
automáticamente al checkout de Vercel. Los datos revisados que se quieran
publicar deben incorporarse a Git y generar un nuevo despliegue.

## Verificación local

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

### Resultado de la revisión (16 de noviembre de 2026)

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
