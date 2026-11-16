# El Último Escaño — rediseño y verificación

## Experiencia implementada

- **Inicio** abre León 2023, sin geolocalización. Muestra reparto oficial, último
  adjudicado, primer excluido y calculadora en la misma página.
- **Provincias** conserva el atlas y el acceso a las 52 fichas.
- **¿Qué pasaría si…?** (`/que-pasaria-si`) muestra cuatro ejemplos iniciales de
  tipos diversos y permite explorar más. Un clic configura el simulador y enfoca
  su encabezado. Las provincias se mantienen en la URL.
- **Aprende más** conserva las claves y preguntas frecuentes; el archivo técnico
  está plegado y D’Hondt se explica en Inicio.

La lección usa la provincia seleccionada, sus votos y sus escaños de **2023**:
1. Asignación provincial y umbral (blanco incluido; nulo excluido).
2. Divisores pulsables y cocientes de las listas admitidas.
3. Cocientes adjudicados, último diputado y siguiente excluido.

La tabla completa permanece plegada. Ceuta y Melilla explican su regla de mayoría.
El color identifica candidaturas y se respeta la preferencia de movimiento reducido.

## Cálculo y neutralidad

Se conserva el motor `web/lib/last-seat.ts` y se amplía con transferencias mínimas.
`web/lib/scenarios.ts` estudia todas las candidaturas y todos los pares ordenados
origen/destino, por orden alfabético. No hay clasificación de conveniencia electoral.
Los tipos son primer diputado, diputado adicional, transferencia y adición sin cambio.
El selector permite estudiar todas las candidaturas originales.

Cada escenario recalcula total válido, elegibilidad, cocientes, reparto, último
adjudicado y primer excluido. La búsqueda binaria comprueba el mínimo entero y el
valor inmediatamente anterior. La transferencia nunca supera los votos de origen.
Los empates de cocientes se resuelven por votos totales; la igualdad que requiere
sorteo se muestra como incierta. No se presenta el orden de pantalla como ganador
oficial del sorteo. Una adición sin cambio se deriva de esa frontera, evitando el
empate previo, y se comprueba contra **todo** el reparto original.

Modos del simulador:
- Añadir: cambia una candidatura y aumenta el total válido.
- Transferir: resta y suma la misma cantidad; conserva el total.
- Editar: permite modificar libremente las candidaturas, conservando el blanco
  salvo edición explícita en controles avanzados.

Los resultados son comparaciones matemáticas con 2023, nunca probabilidades,
predicciones de 2026 ni recomendaciones. Si un escenario manual deja sin votos
elegibles, se avisa de que no es posible cubrir todos los escaños; no se inventan.

## Ejemplos reproducidos

Solo se indican candidaturas con escaños. Las demás permanecen en el cálculo.
En las adiciones todas las otras candidaturas y el blanco se mantienen constantes.
Estos ejemplos proceden del motor y sus verificaciones automáticas.

| Provincia (escaños 2023) | Supuesto | Antes | Después |
|---|---|---|---|
| León (4) | Añadir 10.839 votos a VOX | PP 2, PSOE 2 | PP 2, PSOE 1, VOX 1 |
| León (4) | Añadir 45.804 a España Vaciada | PP 2, PSOE 2 | PP 2, PSOE 1, España Vaciada 1 |
| León (4) | Transferir 34.966 de PP a España Vaciada | PP 2, PSOE 2 | PP 1, PSOE 2, España Vaciada 1 |
| Albacete (4) | Añadir 37.781 a Frente Obrero | PP 2, PSOE 2 | PP 2, PSOE 1, FO 1 |
| Madrid (37) | Añadir 109.804 a FE de las JONS | PP 16, PSOE 10, SUMAR 6, VOX 5 | PP 15, PSOE 10, SUMAR 6, VOX 5, FE de las JONS 1 |
| Soria (2) | Añadir 14.899 a Frente Obrero | PP 1, PSOE 1 | PP 1, FO 1 |
| Ceuta (1) | Añadir 12.866 a Frente Obrero | PP 1 | FO 1 |
| Melilla (1) | Transferir 6.075 de PP a CpM | PP 1 | CpM 1 |

El resultado oficial de León se reconstruye con PP 101.605 y PSOE 92.578 votos:
el último cociente es PSOE 92.578 / 2 = **46.289**. El primero excluido es VOX
35.451 / 1 = **35.451**. Añadir 10.838 a VOX mantiene el reparto; con 10.839 gana
su primer diputado. La diferencia entre cocientes (10.838) no era el mínimo.

La selección de ejemplos del registro automático usa la primera candidatura de
cada tipo por orden alfabético; la tabla incluye también el caso de León contrastado
en navegador. No son escenarios elegidos por probabilidad o utilidad política.

Para imprimir ejemplos desde los datos versionados:

```powershell
# Desde web/
$env:SCENARIO_EXAMPLES='1'
npx vitest run lib/scenarios.test.ts --reporter=verbose --disableConsoleIntercept
```

Fuentes: [Interior](https://infoelectoral.interior.gob.es/es/elecciones-celebradas/area-de-descargas/),
[JEC / BOE 2023](https://www.boe.es/diario_boe/txt.php?id=BOE-A-2023-18907),
[LOREG, artículo 163](https://www.boe.es/buscar/act.php?id=BOE-A-1985-11672#a163).

## Retirada pública y conservación científica

Los JSON de sondeos y campaña se han trasladado sin alterar su contenido a
`web/archive/data/`. Las páginas del laboratorio nacional y campaña se conservan
en `web/archive/pages/`. Los datasets, snapshots, conectores y experimentos de la
raíz permanecen. Los exportadores Python ya clasifican los recursos retirados para
que regenerarlos no los vuelva a exponer, incluso con un servidor local abierto.

El mapa recibe un `simulator.json` reducido a asignaciones y colores; la versión
completa sigue en el archivo. El check rechaza la presencia de los cinco JSON
retirados en `public/`. Se han revisado enlaces y rutas antiguas: no quedan enlaces
públicos a Encuestas, campaña o predicción. La revisión protegida conserva su
lista permitida, auditoría de recursos, noindex y controles de acceso existentes.

No se ha desplegado ni enviado a remoto. `npm run check:release` sigue fallando
de forma prevista por `public_release_authorized`, `cache_withdrawal_verified`
y `legacy_urls_withdrawal_verified`. La purga de un despliegue anterior y la
verificación externa de su protección requieren autorización y siguen pendientes.

## Comprobaciones realizadas

| Comprobación | Resultado final |
|---|---|
| Python: `python -m pytest tests/ -q` | 84 tests pasan |
| Vitest: `npm test` | 57 tests pasan |
| TypeScript: `npm run typecheck` | Pasa |
| ESLint: `npm run lint` | Pasa |
| Producción: `npm run build` | Pasa |
| Revisión aislada: `npm run build:review` | Pasa; 78 recursos auditados |
| Playwright normal (Edge) | 7 tests pasan |
| Playwright revisión protegida | 2 tests pasan |
| `npm run check:release` | Bloqueado, conforme a la política existente |

Las pruebas cubren reproducción de las 52 provincias y 350 diputados, asignación
histórica, todas las candidaturas, umbral incluido el blanco, D’Hondt, mínimos,
transferencias y conservación del total, empate/sorteo, Ceuta/Melilla y escenarios
sin cambio. Se contrasta la búsqueda de transferencias con enumeración exhaustiva
en casos pequeños. En navegador: navegación, datos, divisores, tarjetas, los tres
modos, reinicio, recuperación de fallos de carga y móvil sin desbordamiento.

Incidencias resueltas durante la comprobación: caché generada de Next en OneDrive
(`EINVAL/readlink`), selector de test ambiguo por el anunciador de rutas de Next,
y una vista previa antigua en el puerto habitual. Playwright ahora inicia su propio
servidor en 4187, sin reutilizar procesos ajenos. Se verificó expresamente que la
suite normal no estuviera comprobando la revisión protegida antigua. No quedan
tests fallidos ni bloqueados en la entrega. Vite avisa de una futura incompatibilidad
del cargador de configuración; no afecta al resultado actual.

## Capturas y uso local

- [Inicio escritorio](screenshots/redesign-inicio-desktop.png)
- [Inicio móvil](screenshots/redesign-inicio-mobile.png)
- [Escenarios escritorio](screenshots/redesign-escenarios-desktop.png)
- [Escenarios móvil](screenshots/redesign-escenarios-mobile.png)

```powershell
# Desde la raíz del repositorio
npm --prefix web run dev
# http://localhost:3000
# http://localhost:3000/que-pasaria-si
```

La elección de los nuevos escenarios está acotada a **2023**, identificada siempre
en el selector. La asignación de 2026 del atlas y de los controles avanzados se
etiqueta aparte; no se usa para generar las tarjetas históricas.
