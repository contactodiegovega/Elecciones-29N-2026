"""FASE 3 — Diagnóstico retrospectivo de encuestas pre-2023 (DESCRIPTIVO, sin modelo).

Gate §5: una sola elección etiquetada (2023) -> NO se entrena corrector de sesgo.
Tablas: error por partido/casa/ventana/tipo + comparabilidad de perímetros.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[3]
PROC = ROOT / "data" / "processed"
TAB3 = ROOT / "reports" / "tables" / "phase3"
TAB3.mkdir(parents=True, exist_ok=True)


def main() -> None:
    polls = pd.read_parquet(PROC / "polls.parquet")
    est = pd.read_parquet(PROC / "poll_estimates.parquet")
    targ = pd.read_parquet(PROC / "poll_targets.parquet")
    meta = polls[["poll_id", "pollster", "fieldwork_end", "sample_size", "estimate_type"]].copy()
    meta["fw"] = pd.to_datetime(meta["fieldwork_end"])
    d = targ.merge(meta, on="poll_id", how="left")
    d["days_to"] = (pd.Timestamp("2023-07-23") - d["fw"]).dt.days
    d["ventana"] = pd.cut(d["days_to"], bins=[-1, 7, 30, 90, 10_000],
                          labels=["<=7d", "8-30d", "31-90d", ">90d"])
    d["abserr"] = d["poll_error_pp"].abs()

    by_party = d.groupby("party_id")["poll_error_pp"].agg(
        n="size", MAE=lambda s: round(s.abs().mean(), 3),
        bias=lambda s: round(s.mean(), 3), sd=lambda s: round(s.std(), 3)).reset_index()
    by_house = d.groupby(["party_id", "pollster"])["poll_error_pp"].agg(
        n="size", MAE=lambda s: round(s.abs().mean(), 3),
        bias=lambda s: round(s.mean(), 3)).reset_index().sort_values(["party_id", "MAE"])
    by_window = d.groupby(["party_id", "ventana"], observed=True)["poll_error_pp"].agg(
        n="size", MAE=lambda s: round(s.abs().mean(), 3),
        bias=lambda s: round(s.mean(), 3)).reset_index()
    by_type = d.groupby(["party_id", "estimate_type"])["poll_error_pp"].agg(
        n="size", MAE=lambda s: round(s.abs().mean(), 3),
        bias=lambda s: round(s.mean(), 3)).reset_index()

    by_party.to_csv(TAB3 / "poll_2023_by_party.csv", index=False)
    by_house.to_csv(TAB3 / "poll_2023_by_house.csv", index=False)
    by_window.to_csv(TAB3 / "poll_2023_by_window.csv", index=False)
    by_type.to_csv(TAB3 / "poll_2023_by_type.csv", index=False)
    d.to_csv(TAB3 / "poll_2023_diagnostics.csv", index=False)
    print("[poll-dx] por partido:"); print(by_party.to_string(index=False))
    print("[poll-dx] por ventana:"); print(by_window.to_string(index=False))
    print("[poll-dx] por tipo:"); print(by_type.to_string(index=False))
    canon = polls.set_index("poll_id").loc[d["poll_id"].unique(), "canonical_poll_id"].nunique()
    print(f"[poll-dx] sondeos únicos con target: {d['poll_id'].nunique()} "
          f"({canon} canónicos; resto réplicas entre tablas estimate/preference). "
          f"NO se entrena corrector: 1 sola elección etiquetada")


if __name__ == "__main__":
    main()
