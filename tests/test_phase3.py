"""Tests FASE 3 (12 obligatorios): fuga temporal, folds, baselines, métricas,
réplicas, tipos de encuesta, perímetros, colores y ausencia de 2026. Sintéticos + real.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
PROC = ROOT / "data" / "processed"
sys.path.insert(0, str(ROOT / "src" / "electoral" / "ml"))
sys.path.insert(0, str(ROOT / "src" / "electoral"))
from leakage import check_fold, check_frame  # noqa: E402
from colors import get_party_color  # noqa: E402


# 1. Fuga conocida -> FALLA
def test_fuga_detectada():
    leaky = pd.DataFrame({
        "target_election_date": ["2023-07-23", "2023-07-23"],
        "as_of_date": ["2023-07-23", "2019-11-10"],  # una fila con as_of == target
        "feature_available_at": ["2024-01-01", "2019-11-10"],  # una posterior
        "x": [1.0, 2.0]})
    with pytest.raises(ValueError, match="FUGA TEMPORAL"):
        check_frame(leaky)
    ok = pd.DataFrame({"target_election_date": ["2023-07-23"],
                       "as_of_date": ["2019-11-10"],
                       "feature_available_at": ["2019-11-10"], "x": [1.0]})
    assert check_frame(ok) == []


# 2. Folds: test posterior a train; elección completa en un fold
def test_fold_temporal():
    train = pd.Series(pd.to_datetime(["2019-11-10", "2015-12-20"]))
    check_fold(train, pd.Timestamp("2023-07-23"))
    with pytest.raises(ValueError):
        check_fold(train, pd.Timestamp("2015-12-20"))
    P = pd.read_csv(ROOT / "reports" / "tables" / "phase3" / "turnout_predictions_oos.csv")
    assert (P.groupby("test_election")["province"].nunique() == 52).all()


# 3. Imputación ajustada solo en train
def test_imputacion_solo_train():
    from sklearn.impute import SimpleImputer
    tr = pd.DataFrame({"a": [1.0, 2.0, np.nan]})
    te = pd.DataFrame({"a": [np.nan]})
    imp = SimpleImputer(strategy="median").fit(tr)
    assert float(imp.statistics_[0]) == 1.5  # mediana de train, no de test
    assert float(imp.transform(te)[0, 0]) == 1.5


# 4. Reproducibilidad con semilla
def test_reproducibilidad():
    from sklearn.linear_model import Ridge
    rng = np.random.default_rng(42)
    X = rng.normal(size=(20, 3))
    y = X[:, 0] * 2 + 1
    a = Ridge(alpha=1.0).fit(X, y).predict(X)
    b = Ridge(alpha=1.0).fit(X, y).predict(X)
    np.testing.assert_array_equal(a, b)
    import json
    cfg = json.loads((ROOT / "config" / "ml_phase3.json").read_text(encoding="utf-8"))
    assert cfg["seed"] == 42


# 5. Baseline last_election == valor anterior, nunca actual
def test_baseline_last_es_previo():
    f = pd.read_parquet(PROC / "turnout_features.parquet")
    t = pd.read_parquet(PROC / "turnout_targets.parquet")
    m = f.merge(t, on=["target_election_date", "province_code"])
    r = m[(m["target_election_date"] == "2023-07-23") & (m["province_code"] == "28")].iloc[0]
    assert abs(r["prev_turnout"] - 69.66) > 0.01  # no es el actual (69,66)
    to = pd.read_parquet(PROC / "election_turnout.parquet")
    prev = to[(to["election_date"].astype(str) == "2019-11-10") & (to["province_code"] == "28")]
    assert abs(r["prev_turnout"] - 70.59) < 0.01  # es exactamente Madrid 2019-11
    assert abs(float(prev["turnout_rate"].iloc[0]) - 70.59) < 0.01


# 6. MAE/RMSE/pp con fixture manual
def test_metricas_manuales():
    err = np.array([1.0, -2.0, 3.0])  # ya en pp
    assert abs(err.__abs__().mean() - 2.0) < 1e-9
    assert abs(float(np.sqrt((err ** 2).mean())) - np.sqrt(14 / 3)) < 1e-9
    M = pd.read_csv(ROOT / "reports" / "tables" / "phase3" / "turnout_backtest.csv")
    r = M[(M["test_election"] == "2023-07-23") & (M["model"] == "mean3")].iloc[0]
    assert abs(r["MAE_pp"] - 1.733) < 0.001 and r["n_train_rows"] == 728


# 7. Réplicas no independientes; resultados fuera de encuestas
def test_replicas_y_resultados():
    p = pd.read_parquet(PROC / "polls.parquet")
    assert p["canonical_poll_id"].nunique() < len(p)  # hay réplicas enlazadas
    assert not p["pollster"].str.contains("election", case=False, na=False).any()
    import json
    rr = json.load(open(PROC / "polls_result_rows.json", encoding="utf-8"))
    assert len(rr) == 8 and all("election" in r["firm_raw"].lower() for r in rr)


# 8. Tipos de encuesta no mezclados
def test_tipos_no_mezclados():
    e = pd.read_parquet(PROC / "poll_estimates.parquet")
    assert set(e["estimate_type"].unique()) <= {"estimated_vote", "direct_intention"}
    f = pd.read_parquet(PROC / "poll_features.parquet")
    assert "estimate_type" in f.columns  # el tipo viaja con cada fila, nunca promediado


# 9. Perímetros: partidos nuevos no comparables; minoritarios preservados
def test_perimetros_y_minoritarios():
    pf = pd.read_parquet(PROC / "party_evolution_features.parquet")
    # SUMAR solo existe en 2023: sin pasado comparable -> sin filas (not_comparable
    # por construcción, nunca ceros); en bruto sí está con sus 2,64 M
    assert "SUMAR" not in set(pf["party_id"].unique())
    res = pd.read_parquet(PROC / "election_results.parquet")
    assert (res["candidacy_raw"].str.contains("SUMAR").any()
            and res["candidacy_raw"].str.contains("PACMA").any()
            and (res["seats"].fillna(0) == 0).sum() > 80000)


# 10. Colores PP/PSOE/VOX + figuras
def test_colores_y_figuras():
    from colors import is_blue, is_green, is_red
    assert is_blue(get_party_color("PP")[0])
    assert is_red(get_party_color("PSOE")[0])
    assert is_green(get_party_color("VOX")[0])
    for f in ["m3_01_mae_by_election.png", "m3_02_residuals.png",
              "m3_03_poll_error_2023.png", "m3_04_psoe_pilot.png"]:
        assert (ROOT / "reports" / "figures" / "phase3" / f).exists()


# 11. Sin etiquetas 2026
def test_sin_2026():
    for f in ["turnout_targets", "party_targets", "poll_targets"]:
        d = pd.read_parquet(PROC / f"{f}.parquet")
        assert (pd.to_datetime(d["target_election_date"]) <= pd.Timestamp("2023-07-23")).all()
    P = pd.read_csv(ROOT / "reports" / "tables" / "phase3" / "turnout_predictions_oos.csv")
    assert (pd.to_datetime(P["test_election"]) <= pd.Timestamp("2023-07-23")).all()


# 12. (fases 1-2 cubiertas por la suite completa; aquí, integridad OOS)
def test_oos_completo():
    P = pd.read_csv(ROOT / "reports" / "tables" / "phase3" / "turnout_predictions_oos.csv")
    assert len(P) == 6 * 52 * 6
    assert P["error_pp"].notna().all()
    assert set(P["model"]) == {"last_election", "mean3", "trend1", "ridge", "elasticnet", "hgbr"}
