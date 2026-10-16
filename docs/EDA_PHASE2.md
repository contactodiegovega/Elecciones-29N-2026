# EDA avanzado — FASE 2 (datos reales 1977–2023 + encuestas 2019–2026)

Figuras: `reports/figures/phase2/p2_01–p2_12.png` · Tablas íntegras: `reports/tables/phase2/`.
Toda serie por partido usa el mapeo versionado (`PARTY_TAXONOMY.md`) y colores del registro
(`PARTY_COLORS.md`). Denominadores y fuentes en cada gráfico. Sin pronósticos del 29N.

## Cobertura

- Resultados: 16 elecciones, 52 provincias, **1 778 etiquetas originales conservadas**
  (464 con partido, 75–99 % del voto por elección); tablas con las 81 candidaturas de 2023.
- Encuestas: **1 232 sondeos** (832 `estimated_vote` + 400 `direct_intention`), 12 945
  estimaciones, campo 2019-12-12 → 2026-10-11, 36 casas, CC BY-SA con atribución.
  Exclusiones legítimas: 24 filas artefacto, celdas de escaños, hipotéticos/victory/subnacionales.

## 10 hallazgos descriptivos verificables

1. **El error retrospectivo 2023 es medible y asimétrico** (p2_11, n=140 sondeos ≤30 días,
   `estimated_vote`): MAE PP **1,73 pp**, PSOE **3,81 pp**, VOX **1,11 pp**. El PSOE fue
   infraestimado de forma generalizada (errores −8 a −2 pp según casa). *Hipótesis*: voto
   tardío/oculto diferencial; *límite*: sin microdatos no se distingue causa.
2. **House effects visibles sin atribuir intención** (p2_09, ciclo 2025–26, mismo tipo y ámbito):
   rango entre casas PP **4,92 pp** (CIS 29,93 n=21 vs DYM 34,85 n=14), VOX **4,54 pp**,
   PSOE 2,34 pp. *Hipótesis*: métodos de cocina/muestreo; *límite*: periodos no idénticos
   por casa y n dispar (3–21).
3. **Estimación ≠ intención directa** (p2_12, CIS mensual): la estimación CIS supera a la
   directa en ~8–12 pp de forma estable 2023–2026 para PP y PSOE. Mezclarlos desplaza
   cualquier media ~10 pp. *Consecuencia*: `poll_features` separa `estimate_type` siempre.
4. **Cambio 2019N→2023 por partido** (p2_03, presentes en ambas): PP **+3,11 M (+12,33 pp)**,
   PSOE +1,03 M (+3,69 pp), VOX −0,60 M (−2,73 pp), ERC −0,41 M (−1,76 pp). No comparables
   (ausentes en un extremo): SUMAR, Cs (desaparece en 2023), CIU, COMPROMIS, PAR, UPN.
5. **Perímetro Sumar 2023**: el partido mapeado suma 2,64 M (10,79 %), pero la entidad
   comparable con las encuestas ("Sumar" 12,3 en compilaciones) incluye la coalición
   valenciana Compromís-Sumar (0,40 M): total **3,04 M = 12,43 %** sobre candidaturas.
   *Consecuencia*: el error de encuestas de Sumar solo es válido contra este perímetro.
6. **Concentración territorial** (p2_05, 2023): BILDU media provincial 1,71 % con máx.
   31,32 %; ERC media 1,18 % máx. 18,81 %; PP media 11,87 % máx. 50,56 %. Las fuerzas
   territoriales viven en pocas provincias. *Límite*: no inferir voto individual (falacia
   ecológica).
7. **Participación y tamaño provincial no correlacionan** (p2_07, n=52, r = **0,02**):
   la participación 2023 (53–72 %) es independiente del logaritmo de población.
   *Pregunta*: ¿qué variables (edad, renta, CERA) sí la explican? Requiere datos fase 3.
8. **Deriva del denominador** (p2_06): el censo crece +59 % 1977→2023 mientras la
   participación oscila 66–80 %; el récord absoluto de voto de un ciclo depende del
   denominador tanto como de la movilización (ver EDA fase 1 §4).
9. **Top-6 2023 + Otros** (p2_01): PP/PSOE/VOX/SUMAR/ERC/COMPROMIS; todas las series
   empiezan donde hay presencia mapeada (PP 1989, VOX 2014, SUMAR 2023) — huecos, no ceros.
   La tabla íntegra (p2_01_series_todos.csv) conserva cada partido/año.
10. **Cobertura de encuestas desigual** (p2_10): 2023 concentra 415 sondeos (campaña),
    2024–2026 ~200/año; CIS (244) y EM-Analytics (203) dominan el conteo; casas pequeñas
    (n<10) solo sirven para dispersión, no para medias estables.

## Limitaciones registradas como preguntas

- Sin `published_at` en origen: los backtests usan fin de campo (conservador) y lo declaran.
- Sin microdatos CIS ni fichas de privadas: imposible reponderar o auditar cocinas.
- Sin demografía por edad/renta provincial comparable: el análisis ecológico queda en r≈0.
- Perímetros 2015–2019 (confluencias) sin fusionar: las series de IU/Podemos/Sumar de esos
  años son etiquetas, no partidos comparables.
