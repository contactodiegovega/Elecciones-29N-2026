"""Tests FASE 2: colores, taxonomía, encuestas, features sin fuga. Sintéticos + integración real."""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
PROC = ROOT / "data" / "processed"
sys.path.insert(0, str(ROOT / "src" / "electoral"))
from colors import FALLBACK_PALETTE, get_party_color, is_blue, is_green, is_red  # noqa: E402


# ---------- colores ----------
def test_semantica_pp_psoe_vox():
    assert is_blue(get_party_color("PP")[0])
    assert is_red(get_party_color("PSOE")[0])
    assert is_green(get_party_color("VOX")[0])
    assert not is_red(get_party_color("PP")[0])


def test_hex_validos_registro():
    import json, re
    reg = json.loads((ROOT / "config" / "party_colors.json").read_text(encoding="utf-8"))
    assert len(reg["parties"]) >= 30
    for e in reg["parties"]:
        assert re.fullmatch(r"#[0-9A-Fa-f]{6}", e["hex_color"]), e
        for k in ("party_id", "display_name", "verification_status", "source_url"):
            assert e[k], e["party_id"]


def test_fallback_determinista_y_no_corporativo():
    a1, s1 = get_party_color("PARTIDO_INEXISTENTE_XYZ")
    a2, s2 = get_party_color("PARTIDO_INEXISTENTE_XYZ")
    assert (a1, s1) == (a2, s2) and s1 == "fallback"
    assert a1 in FALLBACK_PALETTE
    corps = {get_party_color(p)[0] for p in ("PP", "PSOE", "VOX")}
    assert a1 not in corps  # el fallback jamás reasigna un corporativo ajeno


def test_color_independiente_del_orden_y_con_fecha():
    assert get_party_color("PP") == get_party_color("PP", "2023-07-23")
    assert get_party_color("PP", "1977-06-15") == get_party_color("PP", "2023-07-23")
    c, src = get_party_color("UCD", "2023-07-23")  # fuera de vigencia
    assert src == "fallback"


# ---------- taxonomía / conservación ----------
@pytest.fixture(scope="session")
def mapping():
    return pd.read_parquet(PROC / "candidacy_party_mapping.parquet")


@pytest.fixture(scope="session")
def results():
    return pd.read_parquet(PROC / "election_results.parquet")


def test_todas_las_etiquetas_mapeadas(mapping):
    assert len(mapping) == 1778
    assert mapping["candidacy_id"].is_unique


def test_join_sin_perdidas(results, mapping):
    m = results.merge(mapping[["election_date", "candidacy_raw", "party_id"]],
                      on=["election_date", "candidacy_raw"], how="left", indicator=True)
    assert (m["_merge"] == "both").all()


def test_sin_fusiones_prohibidas(mapping):
    assert not ((mapping["party_id"] == "PP") & (mapping["candidacy_raw"].str.contains("UCD|ALIANZA POPULAR"))).any()
    fam = mapping[mapping["family_id"].notna()]["family_id"].unique().tolist()
    assert set(fam) <= {"FAM_PP", "FAM_PSOE"}


def test_cobertura_sin_dobles_conteos():
    cov = pd.read_parquet(PROC / "party_coverage.parquet")
    nat = cov[cov["level"] == "national"]
    assert ((nat["pct_covered"] > 99) & (nat["pct_covered"] < 101)).all()
    assert len(cov[cov["level"] == "province"]) == 832


def test_censo_no_duplicado_en_join():
    to = pd.read_parquet(PROC / "election_turnout.parquet")
    res = pd.read_parquet(PROC / "election_results.parquet")
    m = res.merge(to[["election_date", "province_code", "electores"]],
                  on=["election_date", "province_code"], how="left")
    g = m.groupby(["election_date", "province_code"])["electores"].nunique()
    assert (g == 1).all()  # el censo no se multiplica por candidatura


def test_listado_todos_topN_otros():
    import subprocess
    r = subprocess.run([sys.executable, "src/electoral/query.py", "--election", "2023-07-23",
                        "--top", "0"], capture_output=True, text=True, cwd=ROOT)
    assert r.returncode == 0
    assert "PARTIDO POPULAR - PP" in r.stdout and "Todas las candidaturas" in r.stdout
    out = ROOT / "data" / "processed" / "_test_todas.csv"
    r2 = subprocess.run([sys.executable, "src/electoral/query.py", "--election", "2023-07-23",
                         "--top", "0", "--out", str(out)], capture_output=True, text=True, cwd=ROOT)
    assert r2.returncode == 0
    try:
        df = pd.read_csv(out)
        assert len(df) == 81  # las 81 etiquetas de 2023, incluidas las 50 sin partido
        assert abs(df["pct"].sum() - 100) < 0.1
    finally:
        out.unlink(missing_ok=True)


# ---------- encuestas ----------
@pytest.fixture(scope="session")
def polls():
    return pd.read_parquet(PROC / "polls.parquet")


@pytest.fixture(scope="session")
def pest():
    return pd.read_parquet(PROC / "poll_estimates.parquet")


def test_polls_rangos_y_tipos(polls, pest):
    assert ((pest["value_pct"] >= 0) & (pest["value_pct"] <= 100)).all()
    assert set(polls["estimate_type"].unique()) <= {"estimated_vote", "direct_intention"}
    assert set(pest["mapping_status"].unique()) <= {"mapped", "unmapped_label", "other_kept", "nonvote_kept"}
    assert polls["poll_id"].is_unique
    assert set(polls["canonical_poll_id"]) <= set(polls["poll_id"])


def test_polls_sin_ceros_ficticios(pest):
    # not_reported = ausencia de fila; los ceros presentes son valores publicados reales
    assert (pest["value_pct"] >= 0).all()
    assert pest["poll_id"].nunique() >= 1000


def test_polls_fila_resultado_no_contamina(polls):
    assert not polls["pollster"].str.upper().isin(
        {"PP", "PSOE", "VOX", "SUMAR", "PODEMOS"}).any()


# ---------- features sin fuga ----------
def test_turnout_sin_fuga():
    f = pd.read_parquet(PROC / "turnout_features.parquet")
    assert (pd.to_datetime(f["as_of_date"]) < pd.to_datetime(f["target_election_date"])).all()
    assert (f["n_prev_elections"] >= 1).all()


def test_party_sin_fuga():
    f = pd.read_parquet(PROC / "party_evolution_features.parquet")
    assert (pd.to_datetime(f["as_of_date"]) < pd.to_datetime(f["target_election_date"])).all()
    assert f["prev_share"].notna().all()


def test_poll_features_corte():
    f = pd.read_parquet(PROC / "poll_features.parquet")
    pre = f[f["target_election_date"] == "2023-07-23"]
    assert (pd.to_datetime(pre["as_of_date"]) < pd.Timestamp("2023-07-23")).all()
    fut = f[f["target_election_date"] == "2026-11-29"]
    assert (pd.to_datetime(fut["as_of_date"]) < pd.Timestamp("2026-11-29")).all()
    assert f["poll_id"].nunique() >= 500


def test_cambios_pp_consistentes():
    df = pd.read_csv(ROOT / "reports" / "tables" / "phase2" / "p2_03_cambios.csv")
    assert (df["dpp"].abs() <= 40).all()  # orden de magnitud sensato en pp
    assert set(df["party"]) >= {"PP", "PSOE", "VOX"}


def test_oficial_2023_calibrado():
    df = pd.read_csv(ROOT / "reports" / "tables" / "phase2" / "p2_11_error_2023.csv")
    assert len(df) >= 300
    assert abs(df[df["partido"] == "PP"]["error"].abs().mean() - 1.73) < 0.05
