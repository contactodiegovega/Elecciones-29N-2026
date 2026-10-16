"""FASE 3 — Backtesting temporal estricto (expanding window por elección completa).

- Sin train_test_split aleatorio intra-elección. Preproceso ajustado SOLO en train.
- predictions_oos con train_last_election, test_election, province, model, y_true,
  y_pred, error_pp, n_train_elections, n_train_rows, as_of_date + sello de config.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import ElasticNet, Ridge
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from leakage import check_fold

ROOT = Path(__file__).resolve().parents[3]
PROC = ROOT / "data" / "processed"
TAB3 = ROOT / "reports" / "tables" / "phase3"
TAB3.mkdir(parents=True, exist_ok=True)


def load_config() -> dict:
    cfg = json.loads((ROOT / "config" / "ml_phase3.json").read_text(encoding="utf-8"))
    return cfg


def config_stamp(cfg: dict) -> str:
    return hashlib.md5(json.dumps(cfg, sort_keys=True).encode()).hexdigest()[:10]


def build_models(cfg: dict, seed: int) -> dict[str, object]:
    num = cfg["features"]
    pre_lin = Pipeline([("imp", SimpleImputer(strategy="median")), ("sc", StandardScaler())])
    pre_tree = Pipeline([("imp", SimpleImputer(strategy="median"))])

    def wrap(pre, est):
        return Pipeline([("pre", pre), ("est", est)])

    p = cfg["models"]
    return {
        "ridge": wrap(pre_lin, Ridge(alpha=p["ridge"]["alpha"])),
        "elasticnet": wrap(pre_lin, ElasticNet(alpha=p["elasticnet"]["alpha"],
                                               l1_ratio=p["elasticnet"]["l1_ratio"],
                                               random_state=seed, max_iter=5000)),
        "hgbr": wrap(pre_tree, HistGradientBoostingRegressor(
            max_iter=p["hgbr"]["max_iter"], max_leaf_nodes=p["hgbr"]["max_leaf_nodes"],
            min_samples_leaf=p["hgbr"]["min_samples_leaf"],
            learning_rate=p["hgbr"]["learning_rate"], random_state=seed)),
    }


def baseline_last(df: pd.DataFrame) -> pd.Series:
    return df["prev_turnout"]


def baseline_mean_k(df: pd.DataFrame, k: int) -> pd.Series:
    return df["mean_last3"] if k == 3 else df["prev_turnout"]


def baseline_trend(df: pd.DataFrame) -> pd.Series:
    # Extrapolación lineal ingenua: prev + delta_prev (tendencia de 1 tramo)
    out = df["prev_turnout"] + df["delta_prev"].fillna(0)
    return out


def run_backtest() -> tuple[pd.DataFrame, pd.DataFrame]:
    cfg = load_config()
    seed = cfg["seed"]
    feats = pd.read_parquet(PROC / "turnout_features.parquet")
    targs = pd.read_parquet(PROC / "turnout_targets.parquet")
    df = feats.merge(targs, on=["target_election_date", "province_code"], how="inner")
    df["target_election_date"] = pd.to_datetime(df["target_election_date"])
    tests = [pd.Timestamp(d) for d in cfg["test_elections"]]
    assert all(t in set(df["target_election_date"]) for t in tests), "test election sin target"
    assert len(tests) >= cfg["min_test_elections"]

    models = build_models(cfg, seed)
    preds, mrows = [], []
    for te in tests:
        train = df[df["target_election_date"] < te].copy()
        test = df[df["target_election_date"] == te].copy()
        check_fold(train["target_election_date"], te)
        assert train["target_election_date"].max() < te
        assert len(test) == 52, f"{te.date()}: {len(test)} provincias (esperado 52)"
        Xtr, ytr = train[cfg["features"]], train["target_turnout"].astype(float)
        Xte, yte = test[cfg["features"]], test["target_turnout"].astype(float)
        asof = test["as_of_date"].iloc[0]
        n_elec = int(train["target_election_date"].nunique())

        def record(model, yhat):
            err = yhat - yte.values
            for prov, yt, yp, e in zip(test["province_code"], yte.values, yhat, err):
                preds.append({"train_last_election": train["target_election_date"].max().date().isoformat(),
                              "test_election": te.date().isoformat(), "province": prov, "model": model,
                              "y_true": round(float(yt), 2), "y_pred": round(float(yp), 2),
                              "error_pp": round(float(e), 2),
                              "n_train_elections": n_elec, "n_train_rows": len(train),
                              "as_of_date": asof, "config_stamp": config_stamp(cfg),
                              "run_stamp": cfg["run_stamp"]})
            ae = np.abs(err)
            mrows.append({"test_election": te.date().isoformat(), "model": model,
                          "MAE_pp": round(float(ae.mean()), 3),
                          "RMSE_pp": round(float(np.sqrt((err ** 2).mean())), 3),
                          "bias_pp": round(float(err.mean()), 3),
                          "MedAE_pp": round(float(np.median(ae)), 3),
                          "n_train_elections": n_elec, "n_train_rows": len(train)})

        record("last_election", baseline_last(test).astype(float).values)
        record(f"mean{cfg['recent_k']}", baseline_mean_k(test, cfg["recent_k"]).astype(float).values)
        record("trend1", baseline_trend(test).astype(float).values)
        for name, mdl in models.items():
            mdl.fit(Xtr, ytr)
            record(name, np.asarray(mdl.predict(Xte), dtype=float))

    P = pd.DataFrame(preds)
    M = pd.DataFrame(mrows)
    P.to_csv(TAB3 / "turnout_predictions_oos.csv", index=False)
    M.to_csv(TAB3 / "turnout_backtest.csv", index=False)
    print(f"[ml] OOS: {len(P)} predicciones, {M['test_election'].nunique()} elecciones de test")
    print(M.pivot_table(index="test_election", columns="model", values="MAE_pp").round(3).to_string())
    return P, M


if __name__ == "__main__":
    run_backtest()
