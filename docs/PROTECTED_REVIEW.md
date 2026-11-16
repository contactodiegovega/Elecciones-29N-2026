# Revisión protegida y evidencias de publicación

## Controles: definición, comprobación y evidencias pendientes

Los booleanos se definen en `config/publication_policy.json`. Los comprueban
`validatePublication()` en `web/scripts/check-data.cjs` (Node) y
`assert_public_release()` en `src/electoral/web_publication.py` (preparación Python).
El modo público de Node se activa con `--release`, `VERCEL`, `NETLIFY` o
`PUBLIC_RELEASE`. `next.config.ts` repite la comprobación para evitar saltarla
invocando directamente `next build`. **Los tres booleanos siguen a `false`.**

| Control | Evidencia necesaria antes de cambiarlo | Estado |
| --- | --- | --- |
| `public_release_authorized` | Aprobación explícita del responsable para una publicación **pública**: commit/digest de artefactos, dominios, contenido, fecha/periodo, responsable y decisión registrada. Autorizar esta revisión privada no equivale a autorizar publicación. | Pendiente |
| `cache_withdrawal_verified` | Inventario de cachés/CDN/hosts, ensayo de retirada, ejecución antes del límite, cabeceras y pruebas anónimas con/sin caché en distintos puntos. Resultado y fecha para cada URL; revocar acceso a despliegues viejos, no solo cambiar un alias. Documentar las copias de navegador/terceros que no pueden retirarse. | Pendiente |
| `legacy_urls_withdrawal_verified` | Inventario de dominios personalizados, alias de rama, URLs inmutables de todos los despliegues, rutas heredadas, JSON, GitHub Pages/releases/artifacts/cachés y enlaces compartidos. Probar que cada vía queda protegida, eliminada o devuelve 404/410 sin mediciones. | Pendiente |

Una captura del panel o un booleano no sustituye las pruebas de acceso. Conservar
actas y respuestas HTTP en almacenamiento privado con responsable, instante UTC,
URL, resultado esperado/real, ID de despliegue, commit y SHA-256 del artefacto.
No incluir cookies, tokens de bypass ni snapshots de encuestas en actas públicas.

## Dos compilaciones con propósitos distintos

- `npm run build` / `npm run build:public`: aplicación completa. En publicación
  continúan exigiendo política y periodo editorial coherente. No existe un
  `SKIP_PUBLICATION_CHECK` ni una declaración de protección basada en una variable.
- `npm run build:review`: exportación Next.js aislada en `.review-build/`.
  `vercel.json` usa este comando. No ejecuta el build de publicación ni marca sus
  verificaciones como completadas. Copia los resultados auditados a `.next/` y
  `out/`, que consume el adaptador Next.js de Vercel.

La revisión usa **lista de permitidos**, no una lista parcial de datos que ocultar:

- JSON de resultados oficiales históricos, fichas provinciales, catálogo,
  participación, demografía, colores, taxonomía y geometría.
- `data/simulator.json` es **solo una proyección del atlas**: códigos, nombres,
  escaños oficiales por provincia y escaños/colores de partidos de 2023. Se excluyen
  todos los campos de votos base, encuestas y escenarios del archivo original.
- No copia `polls_*.json`, `latest_polls.json`, `campaign.json`, `poll_sources.json`,
  `publication_status.json`, `ml*.json`, `model_registry.json` ni `oos_map.json`.
  No copia `data/processed`, `data/poll_updates`, PDFs, snapshots ni archivos dotenv.
- `/encuestas`, `/campana`, `/simulador`, `/laboratorio-ml`, `/metodologia` y
  `/metodologia/modelos` muestran un aviso sin mediciones. `/prediccion` lleva al
  aviso de modelos. Las rutas provinciales antiguas siguen mostrando historia.
- Originales y funcionalidades completas se conservan en el repositorio. Los
  componentes excluidos no se importan desde las páginas sustituidas. La
  exportación se audita para recursos inesperados y hashes de evidencia filtrados
  en HTML, Flight o JavaScript. No se generan mapas de código del navegador.
- `out/review-manifest.json` identifica el modo y los hashes de los recursos. Su
  `protection_verified: false` es intencionado: el artefacto no puede demostrar
  la configuración del panel ni el estado futuro de la infraestructura.

El aviso se muestra en todas las páginas. `robots.txt` y `X-Robots-Tag` impiden
indexación solicitada; **no son autenticación**. La ausencia física de encuestas
y derivados se mantiene todo el año, también en veda, sin depender del reloj.

## Protección Vercel: configuración aplicada y comprobación

Se consultó por API el proyecto `elecciones-29n-2026`
(`prj_deIfXdW81RlB8IrG4VT2HOBrtwJy`). Tenía Standard Protection
(`all_except_custom_domains`). Se aplicó `config/vercel-review-protection.json`
mediante PATCH y una lectura posterior confirmó:

```json
{ "ssoProtection": { "deploymentType": "all" } }
```

Esta configuración protege dominios de producción, previews y URLs de despliegue.
No certifica por sí sola las tres condiciones de publicación pública.

Pasos exactos para comprobar/mantener manualmente:

1. Vercel → proyecto → **Settings → Deployment Protection**.
2. **Vercel Authentication** activado, alcance **All Deployments**, guardar.
   No elegir Standard Protection: excluye dominios de producción.
3. Revisar **Exceptions**, Trusted Sources, enlaces compartidos, accesos
   concedidos y bypass de automatización. Revocar los que no estén justificados.
   No introducir claves de bypass en variables `NEXT_PUBLIC_*`, URLs o Git.
4. Revisar **Settings → Domains** y todos los alias del despliegue. En una sesión
   anónima sin cookies ni cabeceras de bypass, pedir `/`, `/encuestas`,
   `/data/latest_polls.json`, `/data/provinces/24.json`, un JS y una ruta heredada.
   Deben exigir autenticación (401/403 o redirección de login), nunca devolver el
   recurso. Repetir en dominio de producción, rama y URL inmutable.
5. Con cuenta autorizada, comprobar la calculadora y mapa; las URLs de JSON
   excluidos deben devolver **404**, no un JSON con datos ni un fallback HTML 200.
6. Verificar que las respuestas del nuevo despliegue tienen `Cache-Control:
   private, no-store`, `CDN-Cache-Control: no-store` y protección de indexación.
   Vercel puede consumir cabeceras de CDN: comprobar también `x-vercel-cache` y
   repetir solicitudes. Las cabeceras no purgan retroactivamente otros despliegues.
7. No desactivar All Deployments para solucionar un error de acceso. Abrir el
   despliegue autenticándose con una cuenta autorizada.

Documentación oficial consultada: [Deployment Protection](https://vercel.com/docs/deployment-protection)
y [Vercel Authentication](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication).

### Verificación automatizada del despliegue

`node web/scripts/verify-review.cjs <hostname.vercel.app>` comprueba el acceso
anónimo y, con un bypass de auditoría en la variable de proceso
`REVIEW_PROTECTION_BYPASS`, los hashes de los 78 recursos, `no-store`, los diez
JSON excluidos (404), los seis avisos de rutas, noindex y la protección de un
chunk JS. No registra el secreto ni lo incluye en el bundle. La variable debe
existir solo durante la auditoría y borrarse después.

`vercel curl` puede crear automáticamente un bypass persistente en el proyecto.
Los creados para esta comprobación deben revocarse al terminar mediante
`vercel project protection disable <proyecto> --protection-bypass
--protection-bypass-secret <secreto>` (usar el valor desde un gestor/variable,
nunca registrarlo en Git o en el acta). No usar `--sso`: desactivaría la protección.
Releer por API que `ssoProtection.deploymentType` siga siendo `all`.

## Veda: procedimiento operativo y verificación

El calendario existente fija la restricción en **24–28/11/2026 Europe/Madrid** y
oculta también las encuestas en la jornada del 29/11. La revisión sin mediciones
puede permanecer protegida durante todo ese periodo.

Antes del 24/11 a las 00:00 de Madrid (23/11 a las 23:00 UTC):

1. Responsable y suplente confirman el inventario de todos los hosts y artefactos.
2. Mantener/activar All Deployments **antes** de tocar alias. Revocar accesos de
   distribución y bypass no necesarios; no confiar en el nombre Preview.
3. Desplegar y comprobar la revisión auditada. Conservar el manifiesto y hash del
   commit. Desactivar cualquier promoción o rollback automático hacia builds
   completos antiguos. No promover un artefacto que no sea la revisión auditada.
4. Retirar o proteger versiones antiguas en Deployments, incluidos dominios
   inmutables, y comprobarlas una a una. Si se decide eliminarlas, registrar IDs,
   resultado y URLs; no borrar sin inventario ni registro del responsable.
5. Revisar cachés/artefactos de Actions, releases, Pages, mirrors y almacenamiento.
   El repositorio fue reportado privado por la integración Vercel; verificar sus
   permisos en GitHub, sin asumir que copias anteriores fueran privadas.
6. Ejecutar solicitudes anónimas y autorizadas a los JSON y rutas heredadas.
   Guardar resultados antes del límite y repetir tras el cambio de periodo.
7. Si cualquier host devuelve mediciones, mantener el bloqueo y retirar/proteger
   esa vía. Una página React vacía no demuestra retirada de JSON o bundles.

No hay actualmente un cron de retirada con acceso administrativo: este protocolo
requiere ejecución y verificación del responsable. El workflow de encuestas no
retira despliegues ni purga un CDN. La revisión estática no borra copias que un
tercero haya guardado; esa limitación debe figurar en la decisión de publicación.
Después de la veda, no reactivar automáticamente la publicación: revisar política,
fuentes, snapshot editorial, inventario y autorización para el periodo siguiente.
