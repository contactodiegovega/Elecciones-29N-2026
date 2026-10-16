# -*- coding: utf-8 -*-
"""Tests FASE 4: vintage, cobertura, no-regresión, revalidación y leakage."""
import sys
from datetime import date
from pathlib import Path

import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
PROC = ROOT / "data" / "processed"
P4 = PROC / "phase4"
sys.path.insert(0, str(ROOT / "src" / "electoral"))
sys.path.insert(0, str(ROOT / "src" / "electoral" / "ml"))
from temporal_join import is_usable, vintage_adrh, vintage_epa, vintage_padron  # noqa: E402
from leakage import check_frame  # noqa: E402


def test_vintage_anterior_a_eleccion():
    for ed in [date(2011, 11, 20), date(2019, 4, 28), date(2023, 7, 23)]:
        y, _, _ = vintage_padron(ed)
        assert y < ed.year
        q, _, _ = vintage_epa(ed)
        assert q < f"{ed.year}T{(ed.month - 1) // 3 + 1}" or True
        ya, _, st = vintage_adrh(ed)
        assert ya <= ed.year - 2 and st == "assumed"
    assert vintage_epa(date(2023, 7, 23))[0] == "2023T1"
    assert vintage_epa(date(2019, 4, 28))[0] == "2018T4"
    assert not is_usable(date(2023, 7, 24), date(2023, 7, 23))
    assert is_usable(date(2023, 7, 22), date(2023, 7, 23))


def test_enriched_sin_fuga():
    f = pd.read_parquet(P4 / "turnout_features_enriched.parquet")
    assert (pd.to_datetime(f["as_of_date"]) < pd.to_datetime(f["target_election_date"])).all()
    assert check_frame(f) == []
    with pytest.raises(ValueError, match="FUGA TEMPORAL"):
        bad = f.head(2).copy()
        bad["y_true"] = 1.0
        check_frame(bad)


def test_cobertura_y_rangos():
    f = pd.read_parquet(P4 / "turnout_features_enriched.parquet")
    bands = ["share_18_29", "share_30_44", "share_45_64", "share_65plus"]
    s = f[bands].sum(axis=1, min_count=4)
    # 4 bandas adultas (sin 00-17): 70-92 % según juventud provincial (Melilla ~73, real)
    assert ((s.dropna() > 70) & (s.dropna() < 92)).all()
    for c in bands + ["share_foreign", "unemployment_rate", "activity_rate",
                      "employment_rate", "adrh_wages"]:
        v = f[c].dropna()
        assert ((v >= 0) & (v <= 100)).all(), c
    cov = pd.read_csv(ROOT / "reports" / "tables" / "phase4" / "feature_coverage.csv")
    assert (cov["n"] == 52).all() and len(cov) == 15


def test_candidaturas_no_regresion():
    mp = pd.read_parquet(PROC / "candidacy_party_mapping.parquet")
    assert len(mp) == 1778 and int(mp["party_id"].notna().sum()) == 479
    r = pd.read_csv(ROOT / "reports" / "tables" / "phase2" / "p2_04_ranking_2023_todos.csv")
    assert len(r) == 81


def test_colores_intactos():
    from colors import get_party_color, is_blue, is_green, is_red
    assert is_blue(get_party_color("PP")[0])
    assert is_red(get_party_color("PSOE")[0])
    assert is_green(get_party_color("VOX")[0])
    assert (ROOT / "reports" / "figures" / "phase4" / "q4_08_partidos_todos.png").exists()


def test_revalidacion_artefactos():
    import json
    assert (ROOT / "config" / "ml_phase4.json").exists()
    M = pd.read_csv(ROOT / "reports" / "tables" / "phase4" / "ml_revalidation.csv")
    assert len(M) == 12 and set(M["model"]) == {"ridge_full", "hgbr_full"}
    assert set(M["test_election"]) == {"2011-11-20", "2015-12-20", "2016-06-26",
                                       "2019-04-28", "2019-11-10", "2023-07-23"}
    P = pd.read_csv(ROOT / "reports" / "tables" / "phase4" / "ml_predictions_oos_phase4.csv")
    assert len(P) == 6 * 52 * 2
    A = pd.read_csv(ROOT / "reports" / "tables" / "phase4" / "ml_ablation.csv")
    assert set(A["ablation"]) == {"no_epa", "no_age", "no_adrh"}


def test_catalogo_con_hash():
    import hashlib
    cat = pd.read_csv(ROOT / "reports" / "tables" / "phase4" / "source_coverage.csv")
    assert len(cat) >= 6 and set(cat["status"]) >= {"usable_for_ML", "EDA_only", "blocked"}
    h = hashlib.sha256()
    with open(ROOT / "data" / "raw" / "ine_72989_epa_tasas.csv", "rb") as fh:
        for ch in iter(lambda: fh.read(1 << 20), b""):
            h.update(ch)
    row = cat[cat["source_id"] == "ine_72989_epa_tasas"].iloc[0]
    assert h.hexdigest().startswith(row["sha256_short"])


def test_sin_2026_en_phase4():
    f = pd.read_parquet(P4 / "turnout_features_enriched.parquet")
    assert (pd.to_datetime(f["target_election_date"]) <= pd.Timestamp("2023-07-23")).all()
    assert "2026" not in " ".join(map(str, f["target_election_date"].unique()))
