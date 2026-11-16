# El Último Escaño · actualización de encuestas

## Estado y alcance

**Publicación pública bloqueada.** Se permite una revisión protegida sin encuestas
ni derivados: [protocolo de revisión](PROTECTED_REVIEW.md). La política de
`config/publication_policy.json` conserva pendientes las tres verificaciones de
publicación pública. La actualización y la publicación son procesos separados.

Se conservan la ingesta histórica (`polls.py`), el esquema canónico (`poll_schema.py`), sus Parquet y el explorador analítico. El nuevo proceso incremental añade verificaciones primarias sin alterar los experimentos ni atribuir fechas a las filas históricas por inferencia.

### Conectores inspeccionados

- **CIS:** fichas originales de estudios, PDFs de estimación y fichas técnicas, y notas expresamente fechadas. Condiciones de reutilización y `robots.txt` revisados el 14/11/2026 y capturados. Se atribuye la fuente y no se afirma respaldo institucional. El adaptador distingue explícitamente las columnas «voto directo», «margen» y «estimación»: solo esta última alimenta las tarjetas de estimaciones.
- **RTVE, feed de elecciones:** detección de metadatos únicamente. La consulta real quedó bloqueada por `robots.txt`; se registra y respeta el bloqueo.
- **GAD3, feed público:** detección de metadatos únicamente. La consulta real de robots devolvió HTTP 403. No se elude el bloqueo.
- Las demás encuestadoras del catálogo anterior siguen pendientes de permisos y adaptación. No se afirma una cobertura exhaustiva de los sondeos recientes.

La revisión inicial dispone de tres publicaciones primarias del CIS (12/11, 14/10 y 14/09 de 2026), ordenadas por su fecha de difusión explícita. La nota del 12/11 contiene estimaciones parciales: solo se muestran las candidaturas que cita. Si una ventana de campo no se puede normalizar con certeza, se conserva el texto original o queda sin fecha ISO; nunca se sustituye publicación por fin de campo. El tamaño de muestra de una ficha se toma de la ficha técnica enlazada, aunque otra pieza de difusión use un redondeo diferente.

## Ejecución desde la raíz

```powershell
python -m pip install -r requirements.txt
python -m src.electoral.poll_updates
```

El proceso:

1. Calcula la fecha de Madrid mediante el calendario existente. Durante la restricción editorial no hace consultas ni genera nuevos snapshots de fuentes.
2. Consulta robots, verifica los hosts HTTPS revisados y limita tiempos, redirecciones y tamaño de las respuestas. No atraviesa autenticación, paywalls ni CAPTCHA.
3. Descubre nuevas fichas/notas del CIS; los feeds de medios y otras casas solo generan candidatos de revisión.
4. Extrae únicamente formatos revisados y valida tipo, fechas, muestras, etiquetas, porcentajes finitos y suma. Los fallos quedan registrados por fuente/documento.
5. Identifica duplicados por casa, tipo y ventana de campo. Sin ventana utiliza fecha de publicación y valores. Una misma URL/fecha/tipo permite reconocer revisiones, conservando el hash previo. Estimación e intención directa no se fusionan.
6. Conserva `data/poll_updates/verified.json` como último registro válido; una fuente caída no lo vacía.
7. Regenera `latest_polls.json`, los JSON del archivo histórico y el estado editorial de la web. No publica ni despliega.

### Snapshots auditables

- `data/poll_updates/raw/<sha256>.bin`: respuesta real original (HTML, robots o PDF).
- `data/poll_updates/runs/<instante>-<id>.json`: resultados de cada ejecución, errores, procedencia, bytes, hashes y enlaces a snapshots.
- `data/poll_updates/verified.json`: publicaciones normalizadas verificadas, con documento de estimación y ficha técnica cuando existen.
- `data/poll_updates/latest_run.json`: último informe.

Los snapshots están **fuera de `web/public`**. La preparación de la web comprueba que el hash primario y los documentos declarados existan y coincidan antes de incluir una tarjeta. No inventa snapshots retrospectivos diarios.

Reprocesar una ejecución sin nuevas consultas ni modificar su fecha real de recuperación:

```powershell
python -m src.electoral.poll_updates --replay "data/poll_updates/runs/<ejecucion>.json"
```

Regenerar únicamente los JSON a partir de lo ya verificado:

```powershell
python -m src.electoral.poll_updates --offline
```

## Automatización en GitHub

`.github/workflows/poll-review.yml` incluye ejecución manual y horario a las **07:17, 13:17 y 19:17 UTC**. Está preparada, **deshabilitada por defecto** mediante `POLL_UPDATES_ENABLED`, y exige que el repositorio sea privado. Un repositorio público omite el trabajo para evitar difundir snapshots mediante artefactos o cachés del servicio.

Tras revisar el producto, el propietario puede habilitar `POLL_UPDATES_ENABLED=true` en un repositorio privado. Los runners de GitHub realizan las consultas y preservan el registro con una caché incremental y artefactos de revisión de 7 días; no dependen del ordenador local. El workflow solo tiene `contents: read`: no hace commits, push, Pages ni despliegues. Durante veda no restaura/sube cachés ni artefactos de sondeos. Antes de activar el horario se deben retirar también artefactos antiguos que aún sean accesibles; esa retirada no la puede garantizar un job aislado.

## Veda, estáticos, cachés y rutas anteriores

`npm run prepare:data` es un paso explícito fuera de Vercel: calcula el reloj
actual y regenera los JSON que deben revisarse y versionarse. `npm run build`
valida esos artefactos y rechaza un snapshot de otro periodo editorial. Vercel
usa ahora `build:review`, una exportación histórica sin archivos de encuestas ni
derivados en ningún periodo. La preparación completa durante la restricción
(24–28/11/2026) y la jornada electoral según la política editorial:

- `polls_2023.json`, `polls_2026.json` y `latest_polls.json` contienen listas vacías.
- `campaign.json` no contiene series, distribuciones ni snapshots de estimaciones.
- Los JSON originales se conservan en el archivo científico, fuera de la raíz servida.
- Una exportación de encuestas no clasificada bajo otra URL bloquea la preparación del build; no se borra silenciosamente.
- Los antiguos exploradores consumen esos mismos archivos vacíos. Ocultar React no es la medida de retirada.

**Esto no elimina versiones que ya estén en un CDN, navegador, hosting, Git público o artefacto anterior.** Por ese motivo la publicación sigue bloqueada. Deben existir retirada programada previa a la veda, purga verificable del CDN y rutas antiguas, política de caché adecuada y control de todos los artefactos accesibles. Un sitio estático publicado antes de la veda no se retira automáticamente por sí mismo.

`npm run build:public` y los builds **completos** en Vercel/Netlify/`PUBLIC_RELEASE`
fallan hasta que sean verdaderas las tres condiciones de
`config/publication_policy.json`: autorización, retirada de cachés comprobada y
retirada de URLs anteriores comprobada. El build de revisión no publica los
artefactos sujetos a esos controles; las tres condiciones siguen a `false`.

## Pruebas

```powershell
python -m pytest tests/test_poll_updates.py -q
```

Cubren columnas de estimación/intención, campos ausentes, fechas futuras, porcentajes inválidos, duplicados, revisiones, fallos con retención del último dato válido, robots con comodines, retirada de JSON y campaña, rutas antiguas no clasificadas y bloqueo de difusión.
