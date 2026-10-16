# EDA explicativo — FASE 4 (datos reales; ecológico, no causal)

Figuras: `reports/figures/phase4/q4_01–q4_10.png` · Tablas: `reports/tables/phase4/q4_*.csv`.
Denominadores y fuentes en cada gráfico. Colores de partido solo vía `get_party_color()`.

## 9 hallazgos (magnitud, periodo, geografía, límite)

1. **Censo ≠ padrón, cuantificado** (q4_01): censo 2023 = 37,47 M frente a padrón
   1-ene-2022 = 47,48 M (ratio 78,9 %; la diferencia son menores + extranjeros sin voto
   + CERA incluido solo en el censo). *Límite*: fechas distintas (23-jul vs 1-ene).
2. **Envejecimiento residente 2003→2022** (q4_02): 45–64 pasa de 22,48 % a 30,16 %;
   18–29 cae de 18,68 % a 12,46 %; 65+ sube de 17,03 % a 19,97 %. *Límite*: residente ≠
   elector (los tramos jóvenes incluyen menores sin voto).
3. **Extranjería heterogénea** (q4_03): media provincial 9,94 % (2022), rango
   2,79 % (Córdoba) – 21,89 % (Almería); mediana 9,77 %. Nacional al alza 2003–2022.
4. **Paro EPA disperso** (q4_04): 2023T1 de 6,67 % a 30,8 % por provincia; la mediana
   nacional culmina ~2013 y desciende después. *Límite*: muestra finita; ≠ paro registrado.
5. **Renta por fuentes estable salvo 2020** (q4_05): salario 57–59 % de la renta de los
   hogares 2015–2023, con bache 2020 (57,02 % salario, 4,92 % prestaciones por desempleo
   vs 2,25 % en 2019). Por provincia (2021): salario 50,5–67,1 %. *Límite*: % por fuente
   ≠ nivel de renta; forales incompletos pre-2020.
6. **Turnout 2023 vs paro: r = −0,38** (q4_06, n=52): provincias con más paro participan
   menos, pero es correlación ecológica sin controles. *Sesgo ecológico explícito*: no
   dice nada de cómo vota una persona en paro.
7. **Turnout 2023 vs % 65+: r = +0,19** (q4_07, n=52): asociación débil; la edad
   residente no explica la participación provincial por sí sola.
8. **Todos los partidos visibles, mapeo parcial honesto** (q4_08/q4_09): top-6 2023 +
   resto incl. 50 etiquetas no mapeadas con desglose íntegro; voto mapeado 77–99 % por
   elección (mínimo 2016 por confluencias no fusionables). 36 normalizados ≠ 1 778.
9. **Backlog con criterio** (q4_10): el top sin mapear lo dominan confluencias
   Podemos/IU 2015–2019 (1,35 M la mayor: correctamente NO fusionadas). Resueltos en
   fase 4 por inequívocos: CD-1979→AP (1,03 M) y PSP-US-1977→PSOE (0,82 M); 1979 sube
   al 91,15 % mapeado.

## Preguntas abiertas (huecos, no hallazgos)

- ¿Cuánto del Δ de participación explica la composición por edad una vez controlado el
  ciclo? Requiere panel provincial×edad×elección (fase 5).
- Renta neta per cápita provincial con vintage (ADRH solo da mix de fuentes).
- Microdatos CIS para auditar cocinas (PENDING).
