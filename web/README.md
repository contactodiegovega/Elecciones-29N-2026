# El Último Escaño · web Next.js

Una sola experiencia en Inicio: **León 2023**, reparto oficial, último diputado y calculadora integrada. Otra provincia se abre con `/?province=28`; sin parámetro, o con uno inválido, se utiliza León (24). No se usa geolocalización.

## Abrir localmente

Desde `web/`, en PowerShell:

```powershell
npm install
npm run dev
# http://localhost:3000
```

Revisión de la exportación de producción, exclusivamente en localhost:

```powershell
npm run build
npm run preview
# http://127.0.0.1:4173
```

El build solo usa Node.js y valida los artefactos versionados antes de compilar.
La regeneración explícita con `npm run prepare:data` utiliza Python fuera de
Vercel. Véase [despliegue y preparación aislada](../docs/VERCEL.md).

Vercel ejecuta `npm run build:review`: exportación aislada con resultados
históricos, calculadora y mapas, sin archivos de encuestas/derivados. Mantener
Vercel Authentication en All Deployments. [Controles y evidencias pendientes](../docs/PROTECTED_REVIEW.md).

## Cuatro secciones

- `/`: buscador de 52 circunscripciones, mapa opcional, historia provincial, calculadora inmediata y D’Hondt en tres pasos. Añadir, transferir y editar votos, antes/después y mínimos enteros. León es el ejemplo inicial.
- `/provincias`: mapa, asignación oficial de 350 diputados en 2026 y comparación con 2023. Acceso directo a la provincia en Inicio.
- `/que-pasaria-si`: dos tarjetas iniciales: un cambio histórico observado (2019-Nov → 2023) y una simulación ilustrativa acotada sobre 2023. Filtros de tipo, modo, escala y candidatura, con exploración progresiva. Cada tarjeta configura la calculadora directamente, con su referencia histórica, blanco y asignación correctos. Las escalas ilustrativas son 0,5, 1 y 2 puntos del voto válido de referencia; añadir, transferir y redistribuir tienen supuestos distintos.
- `/aprende`: «Aprende más»: circunscripciones, asignación de diputados, mayoría absoluta, último escaño, interpretación de supuestos y preguntas frecuentes. Histórico, participación, demografía, modelos y metodología permanecen como recursos secundarios.

Los enlaces antiguos `/tu-provincia` y `/ultimo-escano` redirigen a Inicio conservando `province`. `/diputados` redirige a Provincias, `/analisis` mantiene el índice educativo y `/simulador` conduce a `/que-pasaria-si`. `/encuestas`, `/campana` y `/prediccion` ya no sirven su contenido. No se eliminan datasets ni el pipeline científico.

## Datos y matemática

`src/electoral/province_data.py` genera 52 fichas pequeñas en `public/data/provinces/` a partir de los artefactos históricos existentes. León se renderiza con su ficha inicial; las demás se cargan al seleccionarlas. El mapa y sus recursos pesados son opcionales.

`lib/last-seat.ts` calcula con candidaturas originales, sin agrupar familias políticas. El umbral incluye el blanco y excluye el nulo. Ceuta y Melilla usan mayoría. Los cocientes se comparan con productos cruzados; prima el total de votos y el empate exacto se marca como pendiente de sorteo.

Los mínimos mantienen constantes los demás votos y el blanco, actualizan el umbral y buscan el primer entero que garantiza un diputado más. Se comprueba el valor hallado y el anterior. Un sorteo no se presenta como una ganancia garantizada. Las transferencias conservan el total y rechazan cantidades superiores al origen.

`lib/contextual-scenarios.ts` genera las tarjetas vigentes, sin buscar votos mínimos ni forzar cambios de escaño. Se muestran magnitud sobre voto válido, cambio relativo de la candidatura, cuota final y fuente. La selección inicial usa el mismo límite didáctico del 10 % de votos originales para cada lista afectada; puede ampliarse explícitamente. No es una medida de plausibilidad. La redistribución usa proporciones y restos mayores, conservando el total. `lib/scenarios.ts` conserva los ejercicios matemáticos anteriores fuera de las tarjetas públicas.

`src/electoral/scenario_history.py` genera 52 fichas históricas a partir de los resultados oficiales ya existentes. Solo enlaza etiquetas completas idénticas de partidos registrados, con exclusiones de composición explícitas en `config/scenario_identities.json`. No equipara SUMAR/Unidas Podemos ni coaliciones por `family_id` o por un `party_id` genérico. [Método, fuentes y límites](../docs/CONTEXTUAL_SCENARIOS.md).

León 2023: 4 diputados; PP 101.605 votos y 2 escaños, PSOE 92.578 y 2. Último: PSOE, 92.578/2 = 46.289. Siguiente: VOX, 35.451/1 = 35.451. Las otras candidaturas aparecen con sus votos originales. La asignación de 2026 se etiqueta por separado.

Fuentes: [Interior](https://infoelectoral.interior.gob.es/es/elecciones-celebradas/area-de-descargas/), [JEC/BOE 2023](https://www.boe.es/diario_boe/txt.php?id=BOE-A-2023-18907) y [RD 806/2026](https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-20742).

## Encuestas, actualización y difusión

[Documentación del pipeline y las restricciones](../docs/POLL_UPDATES.md). La cobertura primaria inicial es CIS; los bloqueos de otros conectores quedan registrados. No se completa ningún dato ausente ni se confunde fecha de campo con publicación.

`npm run prepare:data` regenera JSON y el reloj editorial como paso explícito,
antes de versionarlos. Los exportadores envían los JSON de sondeos y campaña a
`archive/data/`, fuera de `public/`; conservan las restricciones editoriales originales.
`scripts/withdraw-public.cjs` retira además los archivos antiguos o regenerados por
versiones anteriores antes de dev/build. El simulador nacional completo se conserva
en el archivo; su versión pública solo contiene asignaciones y colores para el mapa.
`npm run build` valida esos artefactos sin ejecutar Python;
rechaza un snapshot de otro periodo editorial. **La publicación pública está
bloqueada**: `build:public` y los builds en Vercel exigen autorización y capacidad
verificada para retirar cachés y URLs anteriores. No hay despliegue automático
en el workflow de encuestas.

## Verificar

```powershell
# Desde la raíz
python -m pytest tests -q

# Desde web/
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Playwright utiliza Edge en Windows y Chromium en otros sistemas. En Linux, instalarlo previamente con `npx playwright install chromium`. El servidor local de pruebas se inicia una sola vez por ejecución y se cierra al terminar. No se reinician procesos ajenos.
Las pruebas usan un puerto exclusivo, `4187`, y rechazan reutilizar servidores existentes.
Para comprobar la revisión protegida: `npm run build:review` y después
`$env:REVIEW_E2E='1'; npm run test:e2e` (PowerShell).

Capturas de revisión:

```powershell
$env:CAPTURE_DOCS='1'
npm run test:e2e
```

Se guardan en [docs/screenshots](../docs/screenshots/). El informe HTML de Playwright queda en `playwright-report/` y las trazas de fallos en `test-results/`, ambos ignorados por Git.

Si OneDrive impide limpiar una caché con `EINVAL readlink`, conservar la carpeta generada con otro nombre antes de compilar. No hace falta tocar los datasets ni arrancar servidores repetidamente.
