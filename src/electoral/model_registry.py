# -*- coding: utf-8 -*-
"""Registro reproducible de versiones experimentales del modelo.

No entrena nada: congela en un JSON pÃºblico las versiones ya ejecutadas y
auditadas (fases 3 y 4), sus cortes, entradas, configuraciÃ³n, mÃ©tricas y el
veredicto del gate. Evita que la web invente versiones o mÃ©tricas.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / "config"
REPORTS = ROOT / "reports" / "tables"
DEST = ROOT / "web" / "public" / "data" / "model_registry.json"

LABELS = {
    "mean3": "Media de las 3 Ãºltimas elecciones",
    "last_election": "Repetir la elecciÃ³n anterior",
    "trend1": "Tendencia lineal de una elecciÃ³n",
    "ridge": "Ridge (6 variables base)",
    "elasticnet": "ElasticNet (6 variables base)",
    "hgbr": "Gradient boosting (6 variables base)",
    "ridge_full": "Ridge + demografÃ­a, EPA y rentas",
    "hgbr_full": "Gradient boosting + demografÃ­a, EPA y rentas",
}
NOTES = {
    "mean3": "Referencia simple y mejor resultado macro. No usa ML.",
    "last_election": "Baseline ingenuo: repite la participaciÃ³n previa.",
    "trend1": "Baseline de tendencia; falla en ciclos atÃ­picos.",
    "ridge": "Modelo regularizado con las 6 variables de fase 3.",
    "elasticnet": "SelecciÃ³n L1/L2 con las 6 variables de fase 3.",
    "hgbr": "Ãrboles de boosting con las 6 variables de fase 3.",
    "ridge_full": "AÃ±ade 15 covariables socioeconÃ³micas con vintage verificado.",
    "hgbr_full": "Mejor ML de fase 4, pero no supera a mean3.",
}


def main() -> None:
    phase3_cfg = json.loads((CONFIG / "ml_phase3.json").read_text(encoding="utf-8"))
    phase4_cfg = json.loads((CONFIG / "ml_phase4.json").read_text(encoding="utf-8"))
    bt3 = pd.read_csv(REPORTS / "phase3" / "turnout_backtest.csv")
    rv4 = pd.read_csv(REPORTS / "phase4" / "ml_revalidation.csv")
    gate = json.loads((REPORTS / "campaign" / "ml_gate.json").read_text(encoding="utf-8"))
    ml = json.loads((ROOT / "web" / "public" / "data" / "ml.json").read_text(encoding="utf-8"))

    versions = []
    for model in ["mean3", "last_election", "trend1", "ridge", "elasticnet", "hgbr"]:
        rows = bt3[bt3["model"] == model]
        versions.append({
            "version_id": f"f3-{model}",
            "label": LABELS[model],
            "phase": "Fase 3",
            "created_at": "2026-10-16",
            "target": "turnout_pct",
            "data_cutoff": "rolling-origin: entrena hasta la elecciÃ³n anterior y evalÃºa 2011â†’2023",
            "inputs": phase3_cfg["features"],
            "config": {"seed": phase3_cfg["seed"], "recent_k": phase3_cfg["recent_k"],
                       **phase3_cfg["models"].get(model, {})},
            "metrics": {
                "mae_macro_pp": float(ml["phase3_macro"][model]),
                "by_election": rows[["test_election", "MAE_pp", "RMSE_pp", "bias_pp"]].to_dict(orient="records"),
                "n_folds": int(rows["test_election"].nunique()),
            },
            "status": "baseline" if model in ("mean3", "last_election", "trend1") else "experimental",
            "note": NOTES[model],
        })

    for model in ["ridge_full", "hgbr_full"]:
        rows = rv4[rv4["model"] == model]
        versions.append({
            "version_id": f"f4-{model}",
            "label": LABELS[model],
            "phase": "Fase 4",
            "created_at": "2026-10-16",
            "target": "turnout_pct",
            "data_cutoff": "mismos 6 folds; covariables con vintage publicado antes del corte",
            "inputs": phase4_cfg["base_features"] + phase4_cfg["new_features"],
            "config": {"seed": phase4_cfg["seed"], **phase4_cfg["ridge" if model == "ridge_full" else "hgbr"]},
            "metrics": {
                "mae_macro_pp": float(ml["phase4_macro"][model]),
                "by_election": rows[["test_election", "MAE_pp", "RMSE_pp", "bias_pp"]].to_dict(orient="records"),
                "n_folds": int(rows["test_election"].nunique()),
            },
            "status": "experimental",
            "note": NOTES[model],
        })

    versions.sort(key=lambda v: (v["phase"], v["metrics"]["mae_macro_pp"]))
    best_baseline = min(
        (v for v in versions if v["status"] == "baseline"),
        key=lambda v: v["metrics"]["mae_macro_pp"],
    )
    best_experimental = min(
        (v for v in versions if v["status"] == "experimental"),
        key=lambda v: v["metrics"]["mae_macro_pp"],
    )

    out = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "as_of": "2026-11-12",
        "target_election": "2026-11-29",
        "question": "Â¿Podemos estimar el voto y los escaÃ±os del 29N con datos disponibles antes de la votaciÃ³n?",
        "status": "no_go",
        "public_projection_allowed": bool(gate["public_projection_allowed"]),
        "headline": "Sin estimaciÃ³n experimental publicable",
        "reason": gate["party_projection_2026"]["reason"],
        "scope_note": "Las versiones registradas estiman participaciÃ³n provincial, no escaÃ±os por partido. No se presenta ninguna como predicciÃ³n del 29N.",
        "best_baseline": {"version_id": best_baseline["version_id"], "mae_macro_pp": best_baseline["metrics"]["mae_macro_pp"]},
        "best_experimental": {"version_id": best_experimental["version_id"], "mae_macro_pp": best_experimental["metrics"]["mae_macro_pp"]},
        "gate": gate,
        "versions": versions,
        "projection_2026": None,
        "required_to_reopen": [
            "Resultados oficiales de 2026 para validar (no existen antes del 29N).",
            "MÃ¡s elecciones con sondeos etiquetados y comparables (mÃ­nimo 3 para un corrector).",
            "Un modelo que supere al baseline en evaluaciones independientes, no solo en un fold.",
            "RevisiÃ³n jurÃ­dica y editorial antes de publicar cualquier proyecciÃ³n.",
        ],
        "sources": [
            {"name": "Ministerio del Interior (resultados y participaciÃ³n)", "license": "Uso pÃºblico oficial"},
            {"name": "INE (padrÃ³n, EPA, ADRH)", "license": "CC BY 4.0, citar INE"},
            {"name": "CompilaciÃ³n de encuestas (Wikipedia)", "license": "CC BY-SA 4.0, atribuciÃ³n"},
            {"name": "ConfiguraciÃ³n y artefactos del repositorio", "license": "Ver docs/PHASE3_MODEL_CARD.md y docs/PHASE4_ML_REVALIDATION.md"},
        ],
    }
    DEST.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"[registry] {DEST.relative_to(ROOT)} ({len(versions)} versiones, {out['status']})")


if __name__ == "__main__":
    main()

