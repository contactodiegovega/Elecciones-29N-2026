"""Controles de calidad FASE 1 sobre Parquet construidos desde fuentes oficiales.

Convención: cuando una verificación no se puede evaluar (p. ej. CERA en 1977-1982),
se marca como no evaluable (skip) en lugar de 'passed'.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
PROC = ROOT / "data" / "processed"


@pytest.fixture(scope="session")
def elections(): return pd.read_parquet(PROC / "elections.parquet")

@pytest.fixture(scope="session")
def territories(): return pd.read_parquet(PROC / "territories.parquet")

@pytest.fixture(scope="session")
def results(): return pd.read_parquet(PROC / "election_results.parquet")

@pytest.fixture(scope="session")
def results_cera(): return pd.read_parquet(PROC / "election_results_cera.parquet")

@pytest.fixture(scope="session")
def turnout(): return pd.read_parquet(PROC / "election_turnout.parquet")

@pytest.fixture(scope="session")
def population(): return pd.read_parquet(PROC / "population.parquet")


def test_no_2026_results(elections):
    """No debe existir ninguna fila de la elección 29N-2026 (aún no celebrada)."""
    dates = pd.to_datetime(elections.iloc[:, 0]).dt.date.astype(str)
    assert not any(d.startswith("2026") for d in dates)


def test_elections_coverage(elections):
    assert len(elections) == 16
    years = sorted(pd.to_datetime(elections.iloc[:, 0]).dt.year.tolist())
    assert years[0] == 1977 and years[-1] == 2023


def test_territories_codes(territories):
    assert len(territories) == 52
    codes = territories["province_code"].tolist()
    assert all(isinstance(c, str) and len(c) == 2 and c.isdigit() for c in codes)
    assert territories["province_code"].is_unique
    assert "01" in codes and "52" in codes  # ceros a la izquierda conservados


def test_results_keys_unique(results):
    dup = results.duplicated(subset=["election_date", "province_code", "candidacy_raw"]).sum()
    assert dup == 0, f"{dup} claves duplicadas en election_results"


def test_results_non_negative(results, results_cera):
    assert (results["votes"].dropna() >= 0).all()
    assert (results["seats"].dropna() >= 0).all()
    assert (results_cera["votes_cera"].dropna() >= 0).all()


def test_turnout_rates_range(turnout):
    for col in ["turnout_rate", "abstention_rate", "null_rate", "blank_on_valid_rate"]:
        s = pd.to_numeric(turnout[col], errors="coerce").dropna()
        assert ((s >= 0) & (s <= 100)).all(), f"{col} fuera de [0,100]"


def test_votantes_lte_electores(turnout):
    bad = turnout[turnout["votantes"].astype("float64") > turnout["electores"].astype("float64")]
    assert len(bad) == 0, f"{len(bad)} casos con votantes > electores"


def test_turnout_identities_exact(turnout):
    d1 = (turnout["votantes"].astype("float64") - turnout["votos_validos"].astype("float64")
          - turnout["votos_nulos"].astype("float64")).abs()
    assert (d1 == 0).all(), "votantes != validos + nulos"
    d2 = (turnout["votos_validos"].astype("float64") - turnout["votos_candidaturas"].astype("float64")
          - turnout["votos_blancos"].astype("float64")).abs()
    assert (d2 == 0).all(), "validos != candidaturas + blancos"


def test_electores_cer_cera_identity(turnout, elections):
    """electores = CER + CERA solo evaluable cuando hay CERA (1977-1982: not_evaluable)."""
    cera_dates = set(elections[elections["has_cera"]].iloc[:, 0].astype(str))
    sub = turnout[turnout["election_date"].astype(str).isin(cera_dates)]
    if len(sub) == 0:
        pytest.skip("not_evaluable: ninguna elección con CERA")
    d = (sub["electores"].astype("float64") - sub["electores_cer"].astype("float64")
         - sub["electores_cera"].astype("float64")).abs()
    assert (d == 0).all()
    nocera = turnout[~turnout["election_date"].astype(str).isin(cera_dates)]
    assert nocera["electores_cera"].isna().all(), "CERA debería ser null antes de su existencia"


def test_votes_sum_matches_candidaturas(results, turnout):
    """Suma provincial de votos de candidaturas ≈ votos_a_candidaturas (tolerancia documentada)."""
    s = results.groupby(["election_date", "province_code"])["votes"].sum().reset_index()
    m = s.merge(turnout[["election_date", "province_code", "votos_candidaturas"]],
                on=["election_date", "province_code"])
    m["diff"] = m["votes"].astype("float64") - m["votos_candidaturas"].astype("float64")
    m["rel"] = m["diff"].abs() / m["votos_candidaturas"].astype("float64")
    nmismatch = int((m["diff"] != 0).sum())
    assert nmismatch / len(m) < 0.05, f"demasiados desajustes: {nmismatch}/{len(m)}"
    assert float(m["rel"].max()) < 0.01, f"desajuste relativo máx {m['rel'].max()}"


def test_cera_is_subset_not_double_count(results_cera, turnout):
    """El desglose CERA nunca supera el total (subconjunto; prohibido sumar ambos)."""
    s = results_cera.groupby(["election_date", "province_code"])["votes_cera"].sum().reset_index()
    m = s.merge(turnout[["election_date", "province_code", "votos_candidaturas"]],
                on=["election_date", "province_code"])
    bad = m[m["votes_cera"].astype("float64") > m["votos_candidaturas"].astype("float64")]
    assert len(bad) == 0, f"CERA > total en {len(bad)} casos (doble recuento u otro error)"


def test_seats_total_350(results):
    tot = results.groupby("election_date")["seats"].sum(numeric_only=True)
    assert len(tot) == 16
    assert (tot == 350).all(), f"escaños nacionales != 350: {tot.to_dict()}"


def test_turnout_full_coverage(turnout):
    assert len(turnout) == 16 * 52
    assert turnout.duplicated(subset=["election_date", "province_code"]).sum() == 0


def test_population_coverage(population):
    prov = population[population["geo_level"] == "province"]
    assert sorted(map(int, prov["year"].unique())) == [2021, 2022, 2023, 2024, 2025]
    assert prov["province_code"].nunique() == 52
    assert (prov["population"].dropna() >= 0).all()
    # limitación conocida: sin serie histórica 1977-2020 en esta tabla
    assert prov["year"].min() > 2020


def test_candidacy_labels_preserved(results):
    """Siglas originales conservadas; no hay fusión automática (PP-2015 y PP-2023 coexisten)."""
    assert results["candidacy_raw"].str.contains("PARTIDO POPULAR - PP").any()
