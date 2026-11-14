# El Último Escaño · informe de revisión local

Fecha: **14 de noviembre de 2026**. Estado: **implementado y verificado localmente; no publicado**.

## Producto entregado

- Identidad pública «El Último Escaño»: logo tipográfico, icono, metadatos, encabezado, pie y documentación principal.
- Menú con Inicio, Provincias, Encuestas y Aprende.
- Inicio abre **León (24)** con resultados oficiales de 2023 y calculadora en la misma página. El parámetro `province` permite abrir cualquiera de las 52 circunscripciones. No se usa geolocalización.
- Buscador con teclado, mapa opcional y enlaces compartibles. El mapa y el GeoJSON no son requisitos para la primera carga de Inicio.
- Reparto histórico, último cociente adjudicado y siguiente cociente fuera, con explicación breve. Todos los votos originales están disponibles en la tabla comparativa y el CSV.
- Dos modos simétricos: añadir votos o transferirlos entre candidaturas conservando el total. Comparación antes/después y último diputado del escenario.
- Consulta de mínimos enteros para cualquier candidatura, con los demás votos y el blanco constantes. Se comprueban el mínimo y su predecesor, el umbral y los empates; no se considera garantizado ganar un sorteo.
- Tabla completa de divisores, reglas y metodología dentro de un desplegable. Asignación de 2026 separada de la historia de 2023.
- Provincias muestra el mapa y la asignación oficial de los 350 diputados; Aprende ofrece el ejemplo interactivo de León y preguntas frecuentes. Los recursos científicos son secundarios y permanecen accesibles.
- Encuestas abre con tres publicaciones primarias verificadas y una visualización por sondeo. El archivo, las comparativas y los filtros se cargan al pedirlos. Las posibles réplicas se excluyen por defecto y pueden inspeccionarse.
- Pipeline incremental, snapshots reales, reproducción offline y acción programada preparada para revisión privada, sin publicación.

## León: datos contrastados

Fuente: resultados definitivos del Ministerio del Interior y contraste de escaños con las actas publicadas por la JEC en BOE-A-2023-18907. Se aprovechan los datasets originales ya importados; no se reutilizan datos de otra provincia.

| Dato | León 2023 |
|---|---:|
| Diputados | 4 |
| Censo | 422.917 |
| Votantes | 277.726 |
| Participación | 65,67 % |
| Votos válidos | 275.240 |
| Votos a candidaturas | 273.663 |
| Blanco | 1.577 |
| Nulos | 2.486 |

PP obtuvo 101.605 votos y dos diputados; PSOE, 92.578 y dos. La ficha conserva las doce candidaturas con votos registrados. Orden de adjudicación recalculado: **PP, PSOE, PP, PSOE**.

El último cociente adjudicado fue **PSOE: 92.578 / 2 = 46.289**. El siguiente fue **VOX: 35.451 / 1 = 35.451**. Su diferencia de 10.838 entre cocientes no se presenta como votos necesarios. Los tests comprueban que, manteniendo todo lo demás constante, hacen falta **10.839 votos adicionales** para que esa candidatura obtenga su primer diputado; con 10.838 el empate de cociente se resuelve por el mayor total de votos de PSOE. Este caso se usa únicamente como comprobación matemática, sin recomendar una candidatura.

León tiene también cuatro diputados asignados en 2026, pero esa asignación y los resultados históricos se identifican por separado. En Madrid y Cádiz los tests verifican explícitamente el cambio de asignación.

## Verificación ejecutada

| Comprobación | Resultado final |
|---|---|
| `python -m pytest tests -q` | **82 passed** |
| `python -m pytest tests/test_poll_updates.py -q` después de compactar JSON | **22 passed** |
| `npm run typecheck` | Correcto |
| `npm run lint` | Correcto |
| `npm test` | **41 passed** |
| `npm run build` | Correcto; 24 páginas estáticas generadas |
| `npm run test:e2e` | **8 passed**, Edge/Playwright, sin errores de página |
| Reparto 2023 con candidaturas originales | **52/52 circunscripciones; 350 diputados; sin discrepancias** |
| JSON provinciales sobre HTTP real | **52 respuestas válidas; 350 escaños en cada asignación** |
| Capturas de escritorio y móvil | Generadas y revisadas |

Las pruebas de navegador cubren León inicial, mínimo entero, adición, transferencia, límites inválidos y restablecimiento; URL explícita de Madrid, escenario de 38 diputados, buscador con teclado, rutas anteriores, provincia inválida, mapas reales y Ceuta/Melilla; sondeos verificados, carga diferida y filtros; menú y desbordamiento en móvil; reintento tras HTTP 503 y estado sin encuestas verificadas.

Durante la revisión se detectaron y corrigieron una suspensión al abrir parámetros directamente en la exportación estática y una discrepancia de hidratación en los títulos SVG del hemiciclo. La última ejecución completa de navegador termina con ocho pruebas aprobadas y no hay fallos pendientes de esas pruebas.

El informe de tamaño de Next indica aproximadamente **135 kB de First Load JS para Inicio** y **129 kB para Encuestas**, antes de abrir los análisis ampliados. No se presenta esto como una medición Lighthouse ni como garantía de tiempos de red. Los payloads públicos son compactos y los manifiestos privados permanecen legibles.

## Capturas

- [Inicio · León · escritorio](screenshots/inicio-leon-desktop.png)
- [Inicio · León · móvil](screenshots/inicio-leon-mobile.png)
- [Escenario hipotético de León](screenshots/leon-escenario.png)
- [Últimas encuestas · escritorio](screenshots/encuestas-desktop.png)
- [Últimas encuestas · móvil](screenshots/encuestas-mobile.png)
- [Provincias y mapa](screenshots/provincias-desktop.png)
- [Aprende · móvil](screenshots/aprende-mobile.png)

## Actualización y límites explícitos

La selección inicial de encuestas tiene tres publicaciones del **CIS**, con fechas de difusión explícitas: 12/11, 14/10 y 14/09/2026. Las estimaciones de los dos barómetros se extraen de su columna de estimación, separada de la de intención directa. La nota más reciente solo cita parte de las candidaturas y se señala como parcial. Los valores ausentes no se inventan. Las candidaturas sin un color corporativo verificado usan un color neutro.

RTVE rechazó la consulta según robots y GAD3 devolvió HTTP 403 al consultar robots. Los errores constan en los manifiestos; no se eluden ni se afirma que esas fuentes se estén ingiriendo. La cobertura inicial no es exhaustiva. Nuevos adaptadores necesitan una fuente accesible y extracción revisada.

Los snapshots contienen respuestas realmente recuperadas y sus hashes. Se guardan fuera de la raíz pública, con Git configurado para conservar sus bytes sin normalizar finales de línea. El archivo científico y los tests históricos de Albacete y las demás provincias se mantienen.

El workflow de GitHub está preparado con horario y ejecución manual, pero requiere repositorio privado y habilitación explícita para el horario. No se ha ejecutado en remoto. Solo consulta y crea material privado de revisión; no hace commit, push ni despliegue.

**Publicación bloqueada:** `config/publication_policy.json` mantiene todas las autorizaciones en falso. La retirada de JSON en un nuevo build no purga un CDN, navegador, Git público, hosting ni artefactos anteriores. Debe verificarse esa retirada operativa antes de permitir difusión. El pipeline público falla sin autorización y capacidad comprobada de retirar cachés y URLs previas. Véase [POLL_UPDATES.md](POLL_UPDATES.md).

## Cómo abrir la web

```powershell
# Desde la raíz, si faltan dependencias de Python
python -m pip install -r requirements.txt

# Desde web/
npm install
npm run dev
# http://localhost:3000
```

Para revisar exactamente la exportación de producción:

```powershell
# Desde web/
npm run build
npm run preview
# http://127.0.0.1:4173
```

León: `/?province=24`. Cualquier otra circunscripción: el buscador o `/?province=<código de dos cifras>`.

## Git

Antes de editar se preservó el trabajo pendiente mediante un stash recuperable, reaplicado sin borrarlo: `backup local antes de El Ultimo Escano UX`. Los cambios de este rediseño se guardan en un commit local; su identificador se obtiene con `git log -1 --oneline`. No se hizo push ni se publicó la web.
