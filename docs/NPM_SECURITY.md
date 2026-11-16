# Auditoría npm y correcciones

Auditoría del 16/11/2026 de `web/package-lock.json`: **15 entradas** (11 moderadas,
2 altas, 2 críticas). Las entradas incluyen paquetes afectados transitivamente;
no equivalen a 15 fallos independientes de la aplicación. No se usó `--force`.

| Paquetes / avisos | Exposición comprobada | Corrección |
| --- | --- | --- |
| `tinypool`, `vitest` — GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr (críticas) | Cadena de pruebas/dev, no dependencia de runtime ni servidor desplegado. Gadgets de contaminación de prototipo/RCE; no se deben ejecutar pruebas de código no confiable. | Migración dirigida de Vitest 3 a **4.1.12**: elimina Tinypool y corrige el mocker. Suite ejecutada. No salto indiscriminado a Vitest 5. |
| `@vitest/mocker` — GHSA-82fw-gwwq-j7x9, GHSA-qxg6-89mg-rqv8 | Servidor de pruebas/mocks, no usado por la exportación estática. | 4.1.12 con Vitest. |
| `echarts` — GHSA-fgmj-fm8m-jvvx | Sí se distribuye al navegador; XSS en la biblioteca. | **6.1.0** (corrección disponible fuera de la rama 5). Mapas/gráficos se comprueban con TypeScript y navegador. |
| `zod` — GHSA-mrhx-c7xc-m3w5 (alta) | Validación en navegador de JSON descargados. Los recursos son propios, pero la librería vulnerable sí formaba parte de producción. | **4.6.7**. Adaptación explícita de `z.record(clave, valor)`; contratos de datos probados. |
| `postcss`, `next` — GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q, GHSA-fxqj-rqcc-2cmp, GHSA-r28c-9q8g-f849 | PostCSS anidado en Next figuraba como dependencia de producción. La aplicación exporta estáticos, no acepta CSS de usuarios en un servidor; exposición principal durante compilación. | Override acotado `next → postcss ^8.5.23`, resuelto a **8.5.33**. Next se mantiene en rama **15**, lockfile **15.5.29**. Build probado. |
| `postcss-selector-parser` — GHSA-rj75-hqrm-r3gf | Herramientas de estilos en build, no parser remoto del sitio estático. | Actualización compatible de transitivas con `npm audit fix` sin force. |
| `minimatch` y cadena `@typescript-eslint/*`, `typescript-eslint` — GHSA-g3hv-75wg-m249 | Herramientas de lint/compilación, no bundle cliente. Siete entradas transitivas del mismo aviso. | Override **solo bajo `@typescript-eslint/typescript-estree`** a `minimatch ^11.0.1`. ESLint ejecutado para comprobar compatibilidad del uso de API. No se cambió minimatch de otros consumidores. |

Resultado tras instalar: **`npm audit` = 0 vulnerabilidades**. La comprobación
`npm audit --omit=dev` debe mantenerse junto a la completa; clasificar como dev no
elimina riesgos de CI. Los avisos dependen de la base de advisories en la fecha
de ejecución, no son garantía perpetua.

Repetir en `web/`: `npm ci`, `npm audit`, `npm audit --omit=dev`, `npm run lint`,
`npm run typecheck`, `npm test`, `npm run build` y `npm run build:review`.
El build público con `VERCEL=1` debe seguir fallando sin autorización; el de
revisión debe terminar sin copiar encuestas, derivados ni evidencias.

La migración a ECharts 6 detectó y corrigió una incompatibilidad real en mapas
revelados dentro de contenedores sin dimensiones: se evita inicializar o
redimensionar la transformación geográfica a cero y se cancela el observer/RAF
al desmontar el gráfico. Los 8 E2E de la aplicación completa pasan después de la
corrección, incluido cambiar entre Ceuta y Melilla y filtrar series de encuestas.
La suite original se conserva como `tests/application.spec.ts`: se materializó
como archivo normal porque OneDrive exponía `ux.spec.ts` como enlace y Playwright
dejaba de descubrirlo.
