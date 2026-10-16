# Viabilidad ML — FASE 1 (NO entrenar modelos; sin estimaciones del 29N)

## Objetivos retrospectivos candidatos

(a) **Variación de la participación provincial entre elecciones consecutivas**
(Δ pp por provincia, p. ej. 2019-11 → 2023-07 ya calculado en
`data/processed/eda_delta_participacion_provincias.csv`). Es el objetivo más viable:
variable continua, definida en las 16 elecciones × 52 provincias (n = 832 filas,
15 transiciones nacionales, 780 pares provincia-transición con CERA completo).
(b) **Error histórico de estimación de voto**: **no evaluable en esta fase** — no hay
historial verificable de encuestas preelectorales recopilado. Requiere archivo de
encuestas con fecha de publicación, ficha técnica y ámbito (fase 2+).

No se afirma que el 29N-2026 sea predecible con precisión desde correlaciones históricas.
No se genera ninguna estimación de resultado, ganador ni probabilidad.

## Variables disponibles y faltantes

| Variable | Cobertura | Frecuencia | Unidad | Uso / riesgo |
|---|---|---|---|---|
| electores, votantes, válidos, nulos, blancos, candidaturas | 1977–2023 (16) | por elección | provincia (52) | base del objetivo (a) |
| votos/escaños por etiqueta exacta | 1977–2023 | por elección | provincia × etiqueta | series no comparables sin mapeo curado (ver EDA) |
| desglose CERA | 1986–2023 (13) | por elección | provincia × etiqueta | covariable; ausente 1977–1982 |
| población INE 67988 (total/sexo) | 2021–2025 | anual | prov./CCAA/nacional | **insuficiente**: solo solapa 2 elecciones; sin edad |
| escaños por candidatura/provincia | 1977–2023 | por elección | provincia × etiqueta | útil para calibrar regla D'Hondt, no como feature ingenua |
| encuestas preelectorales | — | — | — | **faltante** (bloquea objetivo b) |
| indicadores económicos fechados pre-elección | — | — | — | **faltantes** (paro/IPC provinciales con fecha de publicación) |
| composición demográfica (edad) | — | — | — | **faltante** (censo por edad, series INE largas) |

## Baseline propuesto

**Persistencia del último valor observado**: predecir para la elección *t* el valor de *t−1*
en la misma unidad territorial y con la misma definición (misma etiqueta o mismo agregado).
Solo comparable si territorios y definiciones coinciden (atención a etiquetas 2000/2008/2011).

## Validación: cortes temporales por elección completa

- **Jamás** train/test aleatorio por provincia mezclando una misma elección (fuga espacial y
  contemporánea: todas las provincias comparten el ciclo).
- Esquema: *leave-future-out* por bloques de elección (entrenar con elecciones < *t*,
  evaluar en *t*), rodando *t* = 2004, 2008, 2011, 2015, 2016, 2019-04, 2019-11, 2023
  (8 folds prospectivos como máximo).
- Advertencia de tamaño efectivo: **n = 16 ciclos** a nivel nacional; a nivel provincial
  n = 832 pero correlacionados intra-elección. Intervalos de incertidumbre obligatorios;
  cualquier "precisión" con n = 16 es frágil.

## Métricas propuestas (unidades explícitas)

- **MAE y RMSE en puntos porcentuales** para Δ de participación provincial; comparar contra
  baseline de persistencia y contra media histórica, **por elección** (no solo pooled).
- Para voto por candidatura (cuando exista mapeo curado): MAE/RMSE en pp sobre votos a
  candidaturas + calibración de escaños vía D'Hondt simulado vs real.
- Reportar siempre n efectivo (elecciones y provincias) junto a la métrica.

## Siguiente datos necesarios (fase 2+)

1. Archivo de encuestas preelectorales con fecha de campo/publicación y ficha (para objetivo b).
2. Mapeo curado y versionado de etiquetas → formaciones comparables (documentar cada fusión).
3. Series INE largas de población por provincia/edad/sexo (p. ej. Cifras de Población 1971–) y
   censo electoral por edad si existe.
4. Indicadores económicos provinciales con fecha de publicación anterior a cada elección.
5. Resultados municipales/sección (si se publican) solo si el coste de ingesta lo justifica.
