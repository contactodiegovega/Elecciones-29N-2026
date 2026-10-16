"""FASE 2 — Features históricas con corte temporal (sin entrenar modelos).

- Cada fila de features solo usa información conocida en `as_of_date`.
- Los targets van en tablas SEPARADAS (features nunca contienen el futuro).
- Elecciones como bloques: 16 comicios 1977-2023; CERA/población con su fecha real.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
PROC = ROOT / "data" / "processed"


def elections_list(to: pd.DataFrame) -> list:
    eds = sorted(pd.to_datetime(to["election_date"].unique()))
    return eds


def build_turnout(to: pd.DataFrame):
    eds = elections_list(to)
    idx = {e: i for i, e in enumerate(eds)}
    t = to.copy()
    t["ed"] = pd.to_datetime(t["election_date"])
    t["t_idx"] = t["ed"].map(idx)
    t["turnout"] = pd.to_numeric(t["votantes"], errors="coerce") / pd.to_numeric(t["electores"], errors="coerce") * 100
    t["cera_share"] = pd.to_numeric(t["electores_cera"], errors="coerce") / pd.to_numeric(t["electores"], errors="coerce") * 100
    t = t.sort_values(["province_code", "t_idx"])
    # Todo lo "prev" se desplaza una posición: solo pasado estricto respecto al target.
    # (delta/growth/cera sin desplazar usarían el censo y el resultado objetivo: fuga.)
    t["electores_growth"] = (t.groupby("province_code")["electores"].pct_change(fill_method=None) * 100).shift(1)
    t["prev_turnout"] = t.groupby("province_code")["turnout"].shift(1)
    t["delta_prev"] = t.groupby("province_code")["turnout"].diff().shift(1)
    t["cera_share_prev_raw"] = t.groupby("province_code")["cera_share"].shift(1)
    t["mean_last3"] = t.groupby("province_code")["turnout"].transform(
        lambda s: s.shift(1).rolling(3, min_periods=1).mean())
    t["n_prev"] = t.groupby("province_code").cumcount()
    t["prev_ed"] = t["t_idx"].map(lambda i: eds[i - 1].date().isoformat() if i > 0 else None)
    f = t[t["t_idx"] > 0].copy()
    feat = pd.DataFrame({
        "target_election_date": f["ed"].dt.date.astype(str),
        "as_of_date": f["prev_ed"],
        "province_code": f["province_code"],
        "prev_turnout": f["prev_turnout"].round(2),
        "delta_prev": f["delta_prev"].round(2),
        "mean_last3": f["mean_last3"].round(2),
        "electores_growth_prev": pd.to_numeric(f["electores_growth"], errors="coerce").round(2),
        "cera_share_prev": pd.to_numeric(f["cera_share_prev_raw"], errors="coerce").round(2),
        "n_prev_elections": f["n_prev"],
        "feature_available_at": f["prev_ed"],
        "data_published_at": f["prev_ed"],
    })
    targ = pd.DataFrame({
        "target_election_date": f["ed"].dt.date.astype(str),
        "province_code": f["province_code"],
        "target_turnout": f["turnout"].round(2),
    })
    feat.to_parquet(PROC / "turnout_features.parquet", index=False)
    targ.to_parquet(PROC / "turnout_targets.parquet", index=False)
    print(f"[features] turnout: {len(feat)} features + {len(targ)} targets", flush=True)


def build_party(res: pd.DataFrame, to: pd.DataFrame):
    eds = elections_list(to)
    idx = {e: i for i, e in enumerate(eds)}
    r = res.copy()
    r["ed"] = pd.to_datetime(r["election_date"])
    r["t_idx"] = r["ed"].map(idx)
    den = to.groupby(to["election_date"].astype(str))["votos_candidaturas"].sum()
    r["den"] = r["election_date"].astype(str).map(den).astype(float)
    r["share"] = r["votes"].astype(float) / r["den"] * 100
    key = ["province_code", "party_id"]
    # Agrega etiquetas -> partido por (provincia, partido, elección): un partido puede
    # llevar 2+ etiquetas en una provincia (p. ej. PSOE+PSC en Cataluña). Suma, sin duplicar.
    base = (r.dropna(subset=["party_id"]).groupby(key + ["t_idx", "ed"], as_index=False)
            .agg(votes=("votes", "sum"), seats=("seats", "sum")))
    denprov = to.assign(ed=pd.to_datetime(to["election_date"]), t_idx=to["election_date"].map(
        lambda d: idx[pd.to_datetime(d)]))
    denprov = denprov.groupby(["province_code", "t_idx"], as_index=False)["votos_candidaturas"].sum()
    base = base.merge(denprov, on=["province_code", "t_idx"], how="left")
    base["share"] = base["votes"].astype(float) / base["votos_candidaturas"].astype(float) * 100
    assert base.duplicated(subset=key + ["t_idx"]).sum() == 0
    base["prev_idx"] = base["t_idx"] - 1
    # Lado izquierdo = presencias en t-1 (todo lo predecible con pasado); el target t
    # se une de forma OPCIONAL: la fila existe aunque el partido falte en t.
    nmax = max(idx.values())
    mask = base["t_idx"] < nmax
    nprev = base.groupby(key)["t_idx"].transform(lambda s: s.rank(method="first")).astype(int)
    base = base.drop(columns=["prev_idx"])  # evita duplicar etiqueta al renombrar t_idx
    left = base[mask].rename(
        columns={"t_idx": "prev_idx", "share": "share_prev",
                 "votes": "votes_prev", "seats": "seats_prev"})[
                     key + ["prev_idx", "share_prev", "votes_prev", "seats_prev"]].copy()
    left["n_prev_present"] = nprev[mask].values
    left["target_idx"] = left["prev_idx"] + 1
    p1 = left.merge(base[key + ["t_idx"]].assign(share_tgt=base["share"].values,
                                                             votes_tgt=base["votes"].values),
                    left_on=key + ["target_idx"], right_on=key + ["t_idx"],
                    how="left")
    p1["prev2_idx"] = p1["prev_idx"] - 1
    p2 = p1.merge(base[key + ["t_idx"]].assign(share_prev2=base["share"].values),
                  left_on=key + ["prev2_idx"], right_on=key + ["t_idx"],
                  suffixes=("", "_dup"), how="left")
    asof = p2["prev_idx"].map(lambda i: eds[int(i)].date().isoformat())
    tgt = p2["target_idx"].map(lambda i: eds[int(i)].date().isoformat())
    feat = pd.DataFrame({
        "target_election_date": tgt,
        "as_of_date": asof,
        "province_code": p2["province_code"], "party_id": p2["party_id"],
        "prev_share": p2["share_prev"].round(3),
        "delta_share_prev": (p2["share_prev"] - p2["share_prev2"]).round(3),
        "prev_votes": pd.to_numeric(p2["votes_prev"], errors="coerce").astype("Int64"),
        "prev_seats": pd.to_numeric(p2["seats_prev"], errors="coerce").astype("Int64"),
        "n_prev_present": p2["n_prev_present"].astype(int),
        "feature_available_at": asof, "data_published_at": asof,
    })
    targ = pd.DataFrame({
        "target_election_date": tgt,
        "province_code": p2["province_code"], "party_id": p2["party_id"],
        "target_share": p2["share_tgt"].round(3),
        "target_votes": pd.to_numeric(p2["votes_tgt"], errors="coerce").astype("Int64"),
        "present_in_target": p2["share_tgt"].notna(),
    })
    feat.to_parquet(PROC / "party_evolution_features.parquet", index=False)
    targ.to_parquet(PROC / "party_targets.parquet", index=False)
    print(f"[features] party: {len(feat)} features + {len(targ)} targets", flush=True)


def build_polls(polls: pd.DataFrame, est: pd.DataFrame, res: pd.DataFrame, to: pd.DataFrame):
    official = {"PP": 33.33, "PSOE": 31.94, "VOX": 12.48}
    den23 = float(to[to["election_date"].astype(str) == "2023-07-23"]["votos_candidaturas"].sum())
    fam23 = res[res["election_date"].astype(str) == "2023-07-23"].groupby("party_id")["votes"].sum()
    official_cal = {p: round(float(fam23[p]) / den23 * 100, 2) for p in official if p in fam23}
    print("[features] oficial 2023 recalibrado:", official_cal)
    e = est[est["mapping_status"] == "mapped"].merge(
        polls[["poll_id", "pollster", "fieldwork_start", "fieldwork_end", "sample_size"]],
        on="poll_id", how="inner")
    e["fw_end"] = pd.to_datetime(e["fieldwork_end"], errors="coerce")
    e = e[e["fw_end"].notna()]
    feat_rows, targ_rows = [], []
    target = pd.Timestamp("2023-07-23")
    past = e[e["fw_end"] < target]
    for _, r in past.iterrows():
        feat_rows.append({
            "target_election_date": "2023-07-23", "as_of_date": r["fw_end"].date().isoformat(),
            "poll_id": r["poll_id"], "pollster": r["pollster"], "party_id": r["candidacy_or_party_id"],
            "estimate_pct": float(r["value_pct"]), "estimate_type": r["estimate_type"],
            "days_to_election": int((target - r["fw_end"]).days),
            "sample_size": int(r["sample_size"]) if pd.notna(r["sample_size"]) else None,
            "feature_available_at": r["fw_end"].date().isoformat(),
            "data_published_at": None,  # desconocida en origen; corte conservador por fin de campo
        })
        if r["candidacy_or_party_id"] in official_cal:
            targ_rows.append({"target_election_date": "2023-07-23", "poll_id": r["poll_id"],
                              "party_id": r["candidacy_or_party_id"],
                              "poll_error_pp": round(float(r["value_pct"]) - official_cal[r["candidacy_or_party_id"]], 2)})
    # ciclo 2026: features sin target (elección futura sin resultado)
    fut = e[e["fw_end"] >= target]
    for _, r in fut.iterrows():
        feat_rows.append({
            "target_election_date": "2026-11-29", "as_of_date": r["fw_end"].date().isoformat(),
            "poll_id": r["poll_id"], "pollster": r["pollster"], "party_id": r["candidacy_or_party_id"],
            "estimate_pct": float(r["value_pct"]), "estimate_type": r["estimate_type"],
            "days_to_election": int((pd.Timestamp("2026-11-29") - r["fw_end"]).days),
            "sample_size": int(r["sample_size"]) if pd.notna(r["sample_size"]) else None,
            "feature_available_at": r["fw_end"].date().isoformat(), "data_published_at": None,
        })
    feat = pd.DataFrame(feat_rows)
    targ = pd.DataFrame(targ_rows)
    feat.to_parquet(PROC / "poll_features.parquet", index=False)
    targ.to_parquet(PROC / "poll_targets.parquet", index=False)
    print(f"[features] polls: {len(feat)} features ({len(past)} pre-2023, {len(fut)} ciclo-2026), {len(targ)} targets")


def main():
    to = pd.read_parquet(PROC / "election_turnout.parquet")
    res = pd.read_parquet(PROC / "election_results.parquet")
    mp = pd.read_parquet(PROC / "candidacy_party_mapping.parquet")
    res = res.merge(mp[["election_date", "candidacy_raw", "party_id"]],
                    on=["election_date", "candidacy_raw"], how="left")
    polls = pd.read_parquet(PROC / "polls.parquet")
    est = pd.read_parquet(PROC / "poll_estimates.parquet")
    build_turnout(to)
    build_party(res, to)
    build_polls(polls, est, res, to)


if __name__ == "__main__":
    main()
