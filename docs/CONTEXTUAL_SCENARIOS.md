# Escenarios con contexto electoral

## Por qué se sustituyó el criterio anterior

Un mínimo D’Hondt responde a «¿qué número entero, manteniendo los demás votos
constantes, garantiza otro diputado?». No responde a «¿qué cambios se han observado?»
ni a «¿es plausible que esta candidatura reciba esos votos?». Escoger tarjetas
solo por cruzar ese límite destacaba incrementos enormes en listas pequeñas,
sin una justificación de comportamiento electoral. La tarjeta de «un voto menos»
repetía la frontera matemática y aportaba poco contexto.

La calculadora de mínimos se conserva, identificada como **Umbral matemático**,
en **¿Cuántos votos harían falta exactamente?**. No alimenta las tarjetas actuales.

## Tres conceptos separados

### 1. Cambio histórico observado

Se comparan **10 de noviembre de 2019** y **23 de julio de 2023** por provincia.
Ambos repartos son resultados oficiales reproducidos por el motor D’Hondt.
Se muestran votos, cuotas sobre voto **válido**, participación y escaños.
Cada convocatoria conserva su blanco, nulos, censo y asignación provincial.

Una tarjeta individual solo se genera si existe una correspondencia conservadora:

- Etiqueta original completa idéntica y mismo partido registrado.
- Registro de tipo `party`, nunca equivalencia por familia política.
- Exclusiones de composición explícitas y versionadas.
- Las listas renombradas, no mapeadas y coaliciones no se enlazan automáticamente.
  Por ejemplo, ni UPL/U.P.L. ni las dos denominaciones de PACMA se comparan
  individualmente en esta primera versión; sus votos sí permanecen en los repartos.
- SUMAR no se equipara a Unidas Podemos. Navarra Suma, PP en solitario y
  otras coaliciones conservan sus etiquetas y resultados propios.

Política: `config/scenario_identities.json`. Referencia: `data/reference/party_registry.csv`
y `docs/PARTY_TAXONOMY.md`. Esta regla favorece trazabilidad sobre cobertura y no
constituye una reconstrucción exhaustiva de todas las alianzas históricas.

Los dos resultados completos cambiaron simultáneamente. Una variación de votos
agregados no identifica quién cambió de partido, quién se abstuvo o qué causó un
cambio de diputado. Tampoco implica que un movimiento histórico vaya a repetirse.

### 2. Simulación ilustrativa

La base son los votos y diputados oficiales de **2023**. Las escalas comunes son
**0,5, 1 y 2 puntos del voto válido provincial de referencia**:

`cantidad = round(voto_válido_2023 × escala / 100)`

Se recalculan total válido, elegibilidad, cocientes, reparto, último adjudicado y
primer excluido. La tarjeta muestra la equivalencia entera y su porcentaje real
tras redondear. No se busca el mínimo ni se exige que cambie ningún escaño.

| Modo | Supuesto | Total válido y participación |
|---|---|---|
| Añadir | Votos nuevos a una lista; blanco, nulos y censo constantes | Aumentan; no se admite en tarjetas superar el censo |
| Transferir | Restar y sumar la misma cantidad entre dos listas | Se conservan; se excluye el par si el origen no dispone de votos suficientes |
| Redistribuir | El destino recibe votos de todas las otras listas, proporcionalmente a sus votos | Se conservan; reparto entero de las retiradas por restos mayores |

Los restos de redistribución empatados se ordenan por etiqueta, con diferencia
máxima de redondeo de un voto respecto a la proporción. Es una convención
reproducible, no evidencia sobre trasvases reales. No se usa una encuesta para
elegir donantes o beneficiarios.

La generación es simétrica para todas las listas y todos los pares ordenados.
El orden de exposición es alfabético por sigla. La entrada muestra dos ejemplos
—uno observado y uno ilustrativo— sin clasificación por conveniencia o desenlace.

**Límite inicial adicional:** ninguna lista afectada cambia más del **10 % de sus
votos originales** en una simulación destacada. Es un criterio editorial didáctico,
no un umbral científico de plausibilidad, y se aplica igualmente a todas las listas.
Evita que un punto provincial destaque por defecto una multiplicación enorme de
una candidatura pequeña. Una casilla permite ampliar expresamente el catálogo,
identificado siempre como ejercicio hipotético, con su magnitud relativa visible.
Este límite no se aplica a hechos históricos observados, que pueden ser mayores.

**No confundir magnitudes:** sumar el equivalente al 1 % del total original no
aumenta necesariamente en un punto la cuota final de la lista, porque al añadir
votos crece el denominador. Se muestran por separado:

- `cambio_votos / voto_válido_referencia × 100`;
- `cambio_votos / votos_originales_candidatura × 100`;
- `(votos_después / válido_después − votos_antes / válido_antes) × 100`.

El `share` heredado de las tablas originales usa otro denominador (voto a
candidaturas); las tarjetas calculan expresamente la cuota sobre voto válido.

### 3. Umbral matemático

El acceso secundario permite consultar mínimos adicionales o transferencias
mínimas, comprobados con el entero anterior. Los sorteos no se cuentan como
ganancias garantizadas. La tabla se abre con **Ver cálculo**.

La calculadora admite cualquier lista de la referencia y cifras libres. Al abrir
un caso histórico carga el resultado de 2019 como base y el de 2023 completo como
comparación observada, incluidas listas distintas, blanco y escaños. Al editarlo,
la etiqueta cambia a **Escenario hipotético**. Los ajustes del censo/nulos se
explican respecto a la referencia; no se presenta esa simulación como un hecho.

## Fuentes y trazabilidad

Los datos proceden del corpus oficial existente, sin nuevas imputaciones:

- `web/public/data/labels_by_election/2019-11-10.json`;
- `web/public/data/labels_by_election/2023-07-23.json` y `provinces/01..52.json`;
- `web/public/data/turnout.json`;
- fichas derivadas `web/public/data/scenario_history/01..52.json`;
- [Interior: resultados definitivos y descargas](https://infoelectoral.interior.gob.es/es/elecciones-celebradas/area-de-descargas/);
- [JEC / BOE: resultados 2023](https://www.boe.es/diario_boe/txt.php?id=BOE-A-2023-18907);
- [LOREG, artículo 163](https://www.boe.es/buscar/act.php?id=BOE-A-1985-11672#a163).

Cada tarjeta conserva fuentes, artefactos, magnitud, justificación y, si corresponde,
versión de la política de identidad. Una base incompleta, incoherente con el
reparto oficial, de otra provincia o sin trazabilidad no produce tarjetas.
No se eliminan candidaturas del motor por carecer de equivalencia histórica.

### Contexto de encuestas

Se conserva el archivo y la infraestructura fuera de la superficie pública.
Se consultó la fuente primaria [CIS: Barómetro de octubre 2026, estudio 3582](https://www.cis.es/es/estudios/barometro-de-octubre-2026)
el **16 de noviembre de 2026**. Su ficha distingue:

- Fecha de estudio catalogada: **1 de octubre de 2026**; no se interpreta como
  una fecha completa de trabajo de campo.
- Fecha de avance: **14 de octubre**.
- Fecha de publicación: **20 de octubre**.
- Metadato metodológico: **entrevista telefónica CATI**.

La consulta de esa ficha no valida representatividad provincial, diseño completo,
microdatos ni márgenes provinciales. No se ha incorporado a las tarjetas ningún
sondeo provincial validado y no se afirma que no exista ninguno. No se transforman
mediciones nacionales en votos de León ni de otra provincia; tampoco se atribuye
un modelo de terceros al proyecto. No se difunden aquí cifras de sondeos ni se
modifican los controles de publicación, licencias o restricciones legales.

## Ejemplos verificados de León

| Tipo | Cambio | Resultado |
|---|---|---|
| Histórico observado | PP: 74.672 votos (2019-Nov) → 101.605 (2023), **+26.933**; cuota sobre válido 28,43 % → 36,92 % (**+8,49 pp**) | Reparto completo: PSOE 2, PP 1, VOX 1 → PP 2, PSOE 2. No se atribuye el cambio a una única causa |
| Ilustrativo: añadir | **2.752 votos a PP**, aproximadamente 1 % de 275.240 votos válidos y +2,71 % de sus votos originales | Válido: 277.992; cuota final del PP 37,54 % (aumento de unos 0,62 pp). PP 2, PSOE 2: no cambia |
| Ilustrativo: transferir | **2.752 de PSOE a PP**, aproximadamente 1 % de la base válida | Total válido 275.240; PP 2, PSOE 2: no cambia. Es un supuesto, no una observación de trasvases |
| Ilustrativo: redistribuir | **1.376 a PP**, retirados proporcionalmente de las otras listas (escala 0,5) | Total válido 275.240; PP 2, PSOE 2: no cambia |

La participación oficial de León fue 61,50 % en 2019-Nov y 65,67 % en 2023;
el voto válido pasó de 262.679 a 275.240. Esos hechos son contexto histórico,
no probabilidades de un resultado futuro.

Contrastes calculados con la misma escala ilustrativa, sin buscar un mínimo:

| Provincia | Adición del equivalente a 1 punto del voto válido 2023 | Reparto |
|---|---|---|
| Madrid | +36.087 a PSOE, manteniendo las demás listas y el blanco | PP 16 → 15; PSOE 10 → 11; SUMAR 6 y VOX 5 sin cambios |
| Soria | +508 a PP | PP 1, PSOE 1: sin cambios |
| Ceuta | +333 a PP | PP conserva el diputado; se aplica mayoría, no barrera del 3 % |
| Melilla | +273 a PP | PP conserva el diputado; se aplica mayoría |

Las adiciones aumentan el total válido; estos ejemplos no son trasvases ni
recomendaciones. La elección de provincias muestra distintos tamaños de
circunscripción, no una clasificación de candidaturas por conveniencia.

Para imprimir otros ejemplos de las fichas versionadas, desde `web/`:

```powershell
$env:CONTEXT_EXAMPLES='1'
npx vitest run lib/contextual-scenarios.test.ts --reporter=verbose --disableConsoleIntercept
```

## Verificación y revisión local

- Python: **86 tests pasan**, incluidas las 52 fichas y las exclusiones de identidad.
- Vitest: **63 tests pasan**, con reconstrucción de las 52 provincias en ambos años,
  integridad de candidaturas, cuotas, total válido y participación, adiciones,
  transferencias, redistribución, neutralidad, límites y exclusión de datos incompletos.
- TypeScript, ESLint y build de producción verificados.
- Playwright: **8 pruebas de la web normal y 2 de la revisión protegida pasan**.
  Comprueba historia/hipótesis, carga directa de tarjetas, valores,
  filtros, redistribución, tabla, mínimos, móvil y recuperación de datos ajenos.
- El build de revisión protegida pasa y audita **130 recursos**. Su lista permitida
  incorpora las 52 fichas históricas; las encuestas permanecen retiradas y el
  control de publicación sigue intacto.

El primer intento de Vitest agotó los 5 segundos del test de copia/auditoría bajo
I/O concurrente; se acotó ese test a 30 segundos y pasó en la ejecución posterior.
También se corrigió un import de transferencia detectado por TypeScript antes del
build. No se contabilizan esos intentos como éxitos.

Capturas de la página:
[escritorio](screenshots/contexto-escenarios-desktop.png) ·
[móvil](screenshots/contexto-escenarios-mobile.png).

```powershell
# Desde la raíz
npm --prefix web run dev
# http://localhost:3000/que-pasaria-si

# Regeneración offline de las comparaciones históricas
python -m src.electoral.scenario_history
```

No se ha publicado ni desplegado esta modificación. El método no estima
probabilidades, no contiene recomendaciones y no es un modelo de flujos
individuales de voto. La cobertura histórica actual es 2019-Nov → 2023;
otros periodos requieren revisar sus identidades y supuestos antes de incorporarlos.
