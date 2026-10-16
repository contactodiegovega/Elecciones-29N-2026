# Model Card — Backtest electoral retrospectivo (FASE 3)

## Identificación
- Modelos: baselines (`last_election`, `mean3`, `trend1`) + Ridge (α=1), ElasticNet
  (α=1, l1=0,5), HGBR (200 árboles, hojas≤15, lr=0,05). Sin tuning (n pequeño).
- Configuración: `config/ml_phase3.json`, semilla 42, sello en cada predicción OOS.
- Datos: Interior 1977–2023 (16 ciclos), encuestas Wikipedia CC BY-SA 2019–2026.

## Uso previsto y fuera de uso
- Previsto: medir retrospectivamente qué error habría tenido cada método *antes* de cada
  elección celebrada (laboratorio, portfolio metodológico).
- Fuera de uso: predecir el 29N-2026, atribuir causalidad, inferir voto individual desde
  agregados provinciales, comparar casas por intención directa vs estimación.

## Datos de evaluación
- Participación: expanding window, 6 elecciones retenidas completas (2011→2023),
  1 872 predicciones OOS; preproceso (mediana) ajustado solo en train.
- Encuestas: 1 elección etiquetada (2023); descriptivo, sin modelo.
- PSOE: 5 elecciones retenidas, 520 predicciones OOS.

## Métricas y resultado
- Turnout macro MAE: mean3 3,56 ≈ elasticnet 3,64 < last 4,00 < hgbr 4,11 < ridge 4,31.
- PSOE macro MAE: prev_share 3,48 < ridge 4,88.
- **Veredicto: el ML no demuestra valor sobre baselines simples con estos datos.**

## Limitaciones y riesgos
- Fuga auditada y corregida en features (delta/growth/CERA usaban el target).
- n=6 tests: sin intervalos por bloques; ciclos atípicos dominan.
- 29N-2026 excluido como etiqueta; sus sondeos son features sin target.
- Colores PP/PSOE/VOX del registro central; resto provisionales identificados.

## Reproducción
Ver comandos PowerShell en `README.md` (módulo `src/electoral/ml/`).
