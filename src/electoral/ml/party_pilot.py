"""FASE 3 — Piloto voto por partido (GO CON RESERVAS): PSOE provincial, retrospectivo.

PSOE: presencia en los 16 ciclos, perímetro documentado (incl. federaciones).
Expanding window sobre sus últimas 5 elecciones; baseline = prev_share.
Resto de partidos: descriptivo + plan de datos (ver BACKTEST_REPORT).
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from backtest import load_config, config_stamp

from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]
PROC = ROOT / "data" / "processed"
TAB3 = ROOT / "reports" / "tables" / "phase3"


def main() -> None:
    cfg = load_config()
    seed = cfg["seed"]
    feat = pd.read_parquet(PROC / "party_evolution_features.parquet")
    targ = pd.read_parquet(PROC / "party_targets.parquet")
    party = cfg["party_pilot"]["party_id"]
    feats = cfg["party_pilot"]["features"]
    df = (feat[feat["party_id"] == party]
          .merge(targ, on=["target_election_date", "province_code", "party_id"], how="inner"))
    df = df[df["present_in_target"]].copy()
    df["target_election_date"] = pd.to_datetime(df["target_election_date"])
    tests = [pd.Timestamp(d) for d in cfg["party_pilot"]["test_elections"]]
    mdl = Pipeline([("imp", SimpleImputer(strategy="median")), ("sc", StandardScaler()),
                    ("est", Ridge(alpha=1.0))])
    preds, mrows = [], []
    for te in tests:
        train = df[df["target_election_date"] < te]
        test = df[df["target_election_date"] == te]
        assert train["target_election_date"].max() < te and len(test) == 52
        Xtr, ytr = train[feats], train["target_share"].astype(float)
        Xte, yte = test[feats], test["target_share"].astype(float)
        asof = test["as_of_date"].iloc[0]
        base = test["prev_share"].astype(float).values
        mdl.fit(Xtr, ytr)
        yhat = np.asarray(mdl.predict(Xte), dtype=float)
        for prov, yt, yb, yp in zip(test["province_code"], yte.values, base, yhat):
            for model, v in (("prev_share", yb), ("ridge_psoe", yp)):
                preds.append({"train_last_election": train["target_election_date"].max().date().isoformat(),
                              "test_election": te.date().isoformat(), "province": prov, "model": model,
                              "party": party, "y_true": round(float(yt), 3), "y_pred": round(float(v), 3),
                              "error_pp": round(float(v - yt), 3),
                              "n_train_elections": int(train["target_election_date"].nunique()),
                              "n_train_rows": len(train), "as_of_date": asof,
                              "config_stamp": config_stamp(cfg), "run_stamp": cfg["run_stamp"]})
        for model, vals in (("prev_share", base - yte.values), ("ridge_psoe", yhat - yte.values)):
            ae = np.abs(vals)
            mrows.append({"test_election": te.date().isoformat(), "model": model, "party": party,
                          "MAE_pp": round(float(ae.mean()), 3),
                          "RMSE_pp": round(float(np.sqrt((vals ** 2).mean())), 3),
                          "bias_pp": round(float(vals.mean()), 3),
                          "n_train_rows": len(train)})
    P = pd.DataFrame(preds)
    M = pd.DataFrame(mrows)
    P.to_csv(TAB3 / "party_psoe_predictions_oos.csv", index=False)
    M.to_csv(TAB3 / "party_psoe_backtest.csv", index=False)
    print(f"[ml-psoe] OOS: {len(P)} predicciones")
    print(M.pivot_table(index="test_election", columns="model", values="MAE_pp").round(3).to_string())
    print("macro:", M.groupby("model")["MAE_pp"].mean().round(3).to_dict())


if __name__ == "__main__":
    main()
