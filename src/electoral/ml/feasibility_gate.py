# -*- coding: utf-8 -*-
"""Puerta de factibilidad ML: GO/NO-GO explícito antes de publicar proyecciones.

Criterios mínimos (no negociables):
  1. Varias elecciones generales retenidas e independientes.
  2. Comparación fuera de muestra contra baseline simple.
  3. Sin fuga temporal y con tamaño efectivo declarado.
  4. El modelo complejo debe mejorar de forma consistente, no solo una vez.

Uso: python src/electoral/ml/feasibility_gate.py
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[3]
PROC = ROOT / "data" / "processed"
REPORTS = ROOT / "reports" / "tables" / "campaign"


def main() -> None:
    REPORTS.mkdir(parents=True, exist_ok=True)
    targets = pd.read_parquet(PROC / "poll_targets.parquet")
    n_elections = int(targets["target_election_date"].astype(str).nunique())
    n_rows = int(len(targets))
    bt = pd.read_csv(ROOT / "reports" / "tables" / "phase3" / "turnout_backtest.csv")
    macro = bt.groupby("model")["MAE_pp"].mean().sort_values()
    best = str(macro.index[0])
    best_mae = float(macro.iloc[0])
    mean3 = float(macro.get("mean3", float("nan")))
    rv = pd.read_csv(ROOT / "reports" / "tables" / "phase4" / "ml_revalidation.csv")
    macro4 = rv.groupby("model")["MAE_pp"].mean().sort_values()
    gate = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "poll_correction": {
            "labeled_elections": n_elections,
            "labeled_rows": n_rows,
            "minimum_elections_required": 3,
            "verdict": "NO-GO" if n_elections < 3 else "GO",
            "reason": ("Solo hay una elección general con encuestas etiquetadas (2023). "
                       "No es posible una validación totalmente fuera de muestra de un corrector."
                       if n_elections < 3 else "Cobertura suficiente para revisar."),
        },
        "turnout_projection": {
            "baseline_best": best,
            "baseline_best_macro_mae_pp": round(best_mae, 3),
            "mean3_macro_mae_pp": round(mean3, 3) if mean3 == mean3 else None,
            "phase4_best": str(macro4.index[0]),
            "phase4_best_macro_mae_pp": round(float(macro4.iloc[0]), 3),
            "verdict": "NO-GO" if best == "mean3" else "REVIEW",
            "reason": ("El baseline simple sigue ganando; ningún modelo complejo demuestra "
                       "superioridad consistente fuera de muestra."
                       if best == "mean3" else "Revisar antes de publicar."),
        },
        "party_projection_2026": {
            "verdict": "NO-GO",
            "reason": ("No existen resultados de 2026 para validar; el histórico por partido "
                       "no permite una proyección provincial calibrada. Se mantiene el "
                       "agregado descriptivo y el simulador hipotético."),
        },
        "public_projection_allowed": False,
        "allowed_products": ["agregado descriptivo de encuestas", "simulador hipotético de escenarios",
                             "backtesting retrospectivo", "metodología y límites"],
        "forbidden_products": ["pronóstico de ganador", "probabilidad calibrada de victoria",
                               "proyección provincial presentada como resultado esperado"],
    }
    (REPORTS / "ml_gate.json").write_text(json.dumps(gate, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(gate, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
