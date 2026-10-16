"""FASE 3 — Comprobaciones de fuga temporal reutilizables (pipeline + tests)."""
from __future__ import annotations

import pandas as pd

KEY_COLUMNS = {"target_election_date", "as_of_date", "province_code", "party_id",
               "poll_id", "pollster", "feature_available_at", "data_published_at",
               "estimate_type", "days_to_election", "sample_size", "n_prev_present",
               "n_prev_elections", "train_last_election", "test_election", "province",
               "model", "config_stamp", "run_stamp"}
FORBIDDEN_IN_FEATURES = ("target_turnout", "target_share", "target_votes", "y_true",
                         "y_pred", "error_pp", "votes_tgt", "share_tgt", "present_in_target")


def check_frame(feat: pd.DataFrame, target_col: str | None = None) -> list[str]:
    """Devuelve lista de violaciones (vacía = OK). Lanza ValueError si hay fuga."""
    problems = []
    if "as_of_date" in feat.columns and "target_election_date" in feat.columns:
        bad = pd.to_datetime(feat["as_of_date"]) >= pd.to_datetime(feat["target_election_date"])
        if bool(bad.any()):
            problems.append(f"as_of >= target en {int(bad.sum())} filas")
    for c in ("feature_available_at", "data_published_at"):
        if c in feat.columns and "as_of_date" in feat.columns:
            col = pd.to_datetime(feat[c], errors="coerce").dropna()
            asof = pd.to_datetime(feat.loc[col.index, "as_of_date"])
            if bool((col > asof).any()):
                problems.append(f"{c} posterior a as_of_date")
    leak_cols = [c for c in feat.columns
                 if c in FORBIDDEN_IN_FEATURES or
                 (c.startswith("target_") and c not in KEY_COLUMNS)]
    if target_col:
        leak_cols = [c for c in leak_cols if c != target_col]
    if leak_cols:
        problems.append(f"columnas con futuro en features: {leak_cols}")
    if problems:
        raise ValueError("FUGA TEMPORAL: " + "; ".join(problems))
    return problems


def check_fold(train_ed: pd.Series, test_ed) -> None:
    """Todo test posterior al fin de train; una elección = un fold (verificado por el llamante)."""
    if not bool((pd.to_datetime(train_ed) < pd.to_datetime(test_ed)).all()):
        raise ValueError("fold temporal inválido: train no estrictamente anterior al test")
