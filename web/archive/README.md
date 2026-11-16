# Archivo retirado de la interfaz

`data/` conserva byte a byte los antiguos JSON de sondeos y la base del simulador
nacional. `pages/` conserva las implementaciones del laboratorio nacional y de
campaña. Este directorio está fuera de `public/` y no se importa desde las rutas.
Los datasets, conectores y pipelines científicos en la raíz siguen disponibles.

`scripts/withdraw-public.cjs` retira los recursos regenerados antes de arrancar
Next y antes del build. De `simulator.json` solo deja el catálogo de asignaciones
y colores que necesita el atlas. El check de datos rechaza sondeos públicos.
Las URL `/encuestas`, `/campana` y `/prediccion` responden sin contenido retirado;
`/simulador` conduce a `/que-pasaria-si`.

La retirada local no certifica la purga de un despliegue anterior. Siguen siendo
obligatorios los controles de autorización, caché y URL antiguas del proyecto.
