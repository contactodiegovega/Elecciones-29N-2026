# -*- coding: utf-8 -*-
"""FASE 4 — Revalidación: mismos 6 folds y modelos pre-registrados, features enriquecidas.

Comparación fase3 vs fase4 en idéntico subconjunto. Sin tuning. Ablation exploratoria.
"""
import hashlib
import json
import sys
import warnings
from pathlib import Path

# ADRH solo existe desde vintage 2017: en folds 2011/2015/2016 el train no tiene ningún
# valor y el imputador descarta esas columnas (documentado en el informe, no es un error).
warnings.filterwarnings("ignore", message="Skipping features without any observed values.*",
                        category=UserWarning)

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, str(Path(__file__).resolve().parent))
from leakage import check_fold  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
PROC = ROOT / "data" / "processed"
TAB4 = ROOT / "reports" / "tables" / "phase4"
FIG4 = ROOT / "reports" / "figures" / "phase4"


def main() -> None:
    cfg = json.loads((ROOT / "config" / "ml_phase4.json").read_text(encoding="utf-8"))
    stamp = hashlib.md5(json.dumps(cfg, sort_keys=True).encode()).hexdigest()[:10]
    seed = cfg["seed"]
    feats = pd.read_parquet(PROC / "phase4" / "turnout_features_enriched.parquet")
    targs = pd.read_parquet(PROC / "turnout_targets.parquet")
    df = feats.merge(targs, on=["target_election_date", "province_code"], how="inner")
    df["target_election_date"] = pd.to_datetime(df["target_election_date"])
    tests = [pd.Timestamp(d) for d in cfg["folds"]]
    FE = cfg["base_features"] + cfg["new_features"]

    def make(kind):
        if kind == "ridge_full":
            return Pipeline([("imp", SimpleImputer(strategy="median")), ("sc", StandardScaler()),
                             ("est", Ridge(alpha=cfg["ridge"]["alpha"]))])
        return Pipeline([("imp", SimpleImputer(strategy="median")),
                         ("est", HistGradientBoostingRegressor(
                             max_iter=cfg["hgbr"]["max_iter"],
                             max_leaf_nodes=cfg["hgbr"]["max_leaf_nodes"],
                             min_samples_leaf=cfg["hgbr"]["min_samples_leaf"],
                             learning_rate=cfg["hgbr"]["learning_rate"], random_state=seed))])

    preds, mrows = [], []
    for te in tests:
        train = df[df["target_election_date"] < te].copy()
        test = df[df["target_election_date"] == te].copy()
        check_fold(train["target_election_date"], te)
        assert len(test) == 52
        for name in cfg["models"]:
            mdl = make(name)
            mdl.fit(train[FE], train["target_turnout"].astype(float))
            yhat = np.asarray(mdl.predict(test[FE]), dtype=float)
            yt = test["target_turnout"].astype(float).values
            err = yhat - yt
            for prov, a, b, e in zip(test["province_code"], yt, yhat, err):
                preds.append({"test_election": te.date().isoformat(), "province": prov,
                              "model": name, "y_true": round(float(a), 2),
                              "y_pred": round(float(b), 2), "error_pp": round(float(e), 2),
                              "n_train_rows": len(train), "config_stamp": stamp,
                              "run_stamp": cfg["run_stamp"]})
            ae = np.abs(err)
            mrows.append({"test_election": te.date().isoformat(), "model": name,
                          "MAE_pp": round(float(ae.mean()), 3),
                          "RMSE_pp": round(float(np.sqrt((err ** 2).mean())), 3),
                          "bias_pp": round(float(err.mean()), 3),
                          "n_train_rows": len(train)})
    P = pd.DataFrame(preds)
    M = pd.DataFrame(mrows)
    P.to_csv(TAB4 / "ml_predictions_oos_phase4.csv", index=False)
    M.to_csv(TAB4 / "ml_revalidation.csv", index=False)

    # comparación fase3 vs fase4 (mismos folds)
    M3 = pd.read_csv(ROOT / "reports" / "tables" / "phase3" / "turnout_backtest.csv")
    comp = M3[M3["model"].isin(["last_election", "mean3", "ridge", "hgbr"])].copy()
    comp["fase"] = "fase3"
    M["fase"] = "fase4"
    piv3 = comp.pivot_table(index="test_election", columns="model", values="MAE_pp")
    piv4 = M.pivot_table(index="test_election", columns="model", values="MAE_pp")

    # ablation exploratoria (Ridge, quita un bloque)
    abl = []
    for block, cols in cfg["ablation_blocks"].items():
        FE2 = [c for c in FE if c not in cols]
        for te in tests:
            train = df[df["target_election_date"] < te]
            test = df[df["target_election_date"] == te]
            mdl = Pipeline([("imp", SimpleImputer(strategy="median")), ("sc", StandardScaler()),
                            ("est", Ridge(alpha=cfg["ridge"]["alpha"]))])
            mdl.fit(train[FE2], train["target_turnout"].astype(float))
            err = np.asarray(mdl.predict(test[FE2])) - test["target_turnout"].astype(float).values
            abl.append({"test_election": te.date().isoformat(), "ablation": block,
                        "MAE_pp": round(float(np.abs(err).mean()), 3)})
    A = pd.DataFrame(abl)
    A.to_csv(TAB4 / "ml_ablation.csv", index=False)

    print("[reval] fase4 macro:", M.groupby("model")["MAE_pp"].mean().round(3).to_dict())
    print("[reval] fase3 macro (ref):",
          M3[M3["model"].isin(["last_election", "mean3", "ridge", "hgbr"])].groupby("model")["MAE_pp"].mean().round(3).to_dict())
    print("[reval] ablation macro:", A.groupby("ablation")["MAE_pp"].mean().round(3).to_dict())

    # figuras
    plt.rcParams.update({"figure.dpi": 150, "font.size": 9, "axes.grid": True, "grid.alpha": 0.3})
    fig, ax = plt.subplots(figsize=(11, 5.4))
    x = range(len(piv4.index))
    for m in ["ridge_full", "hgbr_full"]:
        ax.plot(list(x), piv4[m].values, marker="o", label=f"{m} (fase4)")
    for m in ["ridge", "hgbr", "mean3"]:
        ax.plot(list(x), piv3[m].values, marker="x", linestyle="--", label=f"{m} (fase3)")
    ax.set_xticks(list(x))
    ax.set_xticklabels([str(t)[:7] for t in piv4.index], rotation=30, ha="right")
    ax.set_title("Revalidación: MAE por elección, fase 3 vs fase 4 (mismos folds)")
    ax.set_ylabel("MAE (pp)")
    ax.legend(fontsize=8)
    fig.text(0.01, 0.01, "Fuentes: Interior + INE. Sin tuning; imputación mediana solo-train.",
             fontsize=7, wrap=True)
    fig.tight_layout(rect=[0, 0.09, 1, 0.96])
    fig.savefig(FIG4 / "r4_01_revalidacion.png")
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(10, 5))
    pivA = A.pivot_table(index="test_election", columns="ablation", values="MAE_pp")
    for c in pivA.columns:
        ax.plot(pivA.index.astype(str), pivA[c].values, marker="o", label=f"Ridge sin {c}")
    ax.plot(piv4.index.astype(str), piv4["ridge_full"].values, marker="s",
            label="Ridge full (fase4)", linewidth=2, color="black")
    plt.setp(ax.get_xticklabels(), rotation=30, ha="right")
    ax.set_title("Ablación exploratoria por bloques (Ridge)")
    ax.set_ylabel("MAE (pp)")
    ax.legend(fontsize=8)
    fig.text(0.01, 0.01, "Exploratorio: n=6 elecciones; quitar bloques correlacionados puede no mover MAE.",
             fontsize=7, wrap=True)
    fig.tight_layout(rect=[0, 0.09, 1, 0.96])
    fig.savefig(FIG4 / "r4_02_ablation.png")
    plt.close(fig)
    print("[reval] figs ok")


if __name__ == "__main__":
    main()
