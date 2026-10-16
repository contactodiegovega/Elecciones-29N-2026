# Matriz de viabilidad — FASE 3

| Tarea | Veredicto | Razones verificables |
|---|---|---|
| **A. Participación provincial histórica** | **GO** | 15 transiciones 1979→2023 × 52 prov (780 filas), features solo pasado, targets separados, `as_of < target` 100 %. Suficiente para expanding-window con ≥3 elecciones de test. |
| **B. Corrector de sesgo de encuestas generalizable** | **NO GO** | Una única elección etiquetada (2023): entrenar y evaluar contra el mismo 2023 no es fuera de muestra. Se hace solo diagnóstico retrospectivo 2023 (descriptivo, sin modelo). Faltarían ≥2–3 elecciones generales con encuestas comparables fechadas. |
| **C. Voto/cuota por partido provincial** | **GO CON RESERVAS (descriptivo + 1 serie piloto)** | 16 ciclos pero perímetros inestables y profundidad por entidad fina (p. ej. VOX: 3 ciclos; SUMAR: 1). Solo se modela retrospectivamente UNA entidad comparable con historia suficiente (PSOE o PP), con splits por elección completa; el resto queda en análisis descriptivo + plan de datos. Prohibido agrupar PP/AP/UCD o IU/Podemos/Sumar. |

Riesgos temporales: correlación intra-elección (52 prov ≠ 52 experimentos); ciclos
atípicos (repetición 2019, julio-2023) pueden dominar métricas con n=15; `published_at`
ausente → cortes por fin de campo; censo conocido el día de la elección (sin fuga si se
usa como nivel, no como resultado).
