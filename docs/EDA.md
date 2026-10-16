# EDA — FASE 1 (datos reales 1977–2023)

Figuras en `reports/figures/` (generadas por `src/electoral/eda.py`, solo datos oficiales).
Ejes, unidades, denominadores y fuentes constan en cada gráfico. Tablas resumen en
`data/processed/eda_turnout_national.csv` y `eda_delta_participacion_provincias.csv`.

## Cobertura y datos faltantes

- Resultados Congreso: 16 elecciones (1977-06-15 → 2023-07-23), 52 circunscripciones, 0 huecos
  en participación (832/832 celdas). Sin datos del 29N-2026 (aún no celebrada).
- Población INE 67988: solo 2021–2025 → la comparativa censo–población solo es orientativa
  en 2 elecciones (2019-11 y 2023-07). Sin serie demográfica 1977–2020 ni censo por edad.
- CERA: ausente en 1977/1979/1982 (156 celdas null = 3×52); presente desde 1986.

## 5+ hallazgos (todos vinculados a gráficos/tablas reales)

1. **Participación: máximo en 1982 (79,97 %), mínimo en 2019-11 (66,23 %)** (fig1).
   Rango 1977–2023 ≈ 14 pp. Tras 2008 (73,85 %) la participación no recupera niveles 90/2000
   salvo 2019-04 (71,76 %); 2019-11 y 2023-07 quedan en ~66–67 %. *Pregunta abierta*: ¿cuánto
   del descenso es composición del censo (crece de 23,6 M en 1977 a 37,5 M en 2023) y cuánto
   comportamiento? Requiere censo por edad, no disponible en esta fase.
2. **El censo crece de forma monótona salvo 1979≈1977** (fig2: 23,58 M → 37,47 M, +59 %),
   mientras la población INE 2021–2025 pasa de 47,40 M a 49,13 M. Ratio orientativa
   electores/población 2023 = 37,47/48,09 ≈ **77,9 %** (denominadores distintos: derecho a voto
   vs residentes totales; incluye CERA 2,33 M en 2023). *Pregunta abierta*: serie de población
   1977–2020 y censo por grupos de edad para separar efecto denominador.
3. **Las series por etiqueta exacta NO son comparables entre elecciones** (fig3 + §4).
   Casos medidos: en 2000 el PSOE compite como `PSOE-PROGRESISTAS` (4,90 M) y la etiqueta
   `PSOE` queda en 0,05 M (familia total 7,93 M); en 2011 el PP va sobre todo como
   `PARTIDO POPULAR - P.P.` (7,22 M) y la etiqueta `PP` solo suma 2,24 M de 10,74 M;
   en 2023 el PP exacto suma 7,69 M de 8,16 M (variantes valenciana/catalana aparte) y el
   PSOE exacto 5,58 M de 7,82 M (PSC 1,22 M + PSdeG 0,49 M + PSE-EE 0,29 M aparte).
   **Conclusión metodológica**: cualquier serie temporal por partido exige un mapeo curado
   de etiquetas (fase 2), nunca fusión automática.
4. **% vs absoluto divergen según el ciclo** (fig4): p. ej. la etiqueta exacta del PSOE-2004
   (7,28 M; familia socialista 11,08 M) y la del PP-2008 (5,26 M bajo `PP` exacto; familia
   10,28 M repartida en 4 variantes de sigla) se obtienen con censos de 34,57 M y 35,07 M
   respectivamente; el mismo % en 2023 (censo 37,47 M) equivale a más votos. Comparar ciclos
   exige explicitar denominador (votos a candidaturas nacional del ciclo). *Pregunta abierta*:
   ¿qué parte del récord absoluto de 2008 es denominador y qué parte movilización?
5. **Territorio: 2019-11 → 2023-07 la participación sube de media +1,47 pp pero con fuerte
   heterogeneidad** (fig5, 52 provincias): Lugo +6,25, Soria +6,0, A Coruña +5,9 en cabeza;
   Girona −8,28, Lleida −7,4, Melilla −6,9, Barcelona −6,6 en cola. Patrón descriptivo
   (NO causal): subidas en el noroeste interior, caídas en Cataluña/Melilla.
   *Pregunta abierta*: ¿efecto calendario (julio vs noviembre), clima, o composición CERA?
6. **Fragmentación de etiquetas**: máximo en 2008 (227 etiquetas distintas en liza),
   seguida de 2000 (150) y 1993 (142); 2015 registra 123 y 2023 solo 81. El récord de 2008
   coincide con la dispersión de siglas del PP en 4 variantes (ver §4).
   *Pregunta abierta*: cuantificar concentración (Herfindahl) por elección en fase 2.
7. **Blanco/nulo estables y pequeños**: el blanco oscila entre 0,25 % y 1,58 % sobre válidos
   y el nulo entre 0,50 % y 1,95 % sobre votantes en toda la serie nacional. Sin rupturas
   visibles a nivel nacional. Distribuciones provinciales pendientes de graficar (fase 2).

## Correlaciones solo descriptivas (sin atribuir causa)

- Participación alta coincide con citas de alternancia (1982, 1993, 1996, 2004), pero los datos
  no demuestran causalidad.
- La caída catalana 2019→2023 coincide en el tiempo con el ciclo post-procés y el voto en julio,
  sin que estos datos permitan atribuirla a ningún factor.

## Archivos

| Gráfico | Fichero | Variables |
|---|---|---|
| 1 | `fig1_participacion_abstencion.png` | participación/abstención nacional por elección |
| 2 | `fig2_censo_vs_poblacion.png` | electores 1977–2023 + población INE 2021–2025 |
| 3 | `fig3_votos_absolutos_etiquetas.png` | votos (M) de 4 etiquetas exactas |
| 4 | `fig4_pct_vs_absoluto.png` | % nacional vs millones, por etiqueta y ciclo |
| 5 | `fig5_delta_participacion_provincias.png` | Δ pp participación 2019-11→2023-07, 52 provincias |
