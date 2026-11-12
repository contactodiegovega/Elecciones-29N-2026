# -*- coding: utf-8 -*-
"""Seguimiento descriptivo de campaña con snapshots fechados e inmutables.

No es una predicción. En cada `as_of` se toma la última ola independiente por casa
y se resume la distribución entre casas (mediana/media no ponderadas). Se conserva
la fecha de campo; si la publicación es desconocida se marca explícitamente.

Uso:
  python src/electoral/campaign.py
  python src/electoral/campaign.py --as-of 2026-11-12
"""
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import date, datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
PROC = ROOT / "data" / "processed"
OUT = PROC / "campaign"
SNAPS = OUT / "snapshots_verified_publication"
CONFIG = ROOT / "config"
PRIMARY_TYPE = "estimated_vote"
NATIONAL_PARTIES = ["PP", "PSOE", "VOX", "SUMAR", "PODEMOS", "ERC", "JUNTS", "PNV",
                    "BILDU", "BNG", "CC", "UPN", "COMPROMIS", "CUP", "CS"]


def _cfg() -> dict:
    path = CONFIG / "campaign.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def _date(value) -> date | None:
    if value is None or pd.isna(value):
        return None
    try:
        return pd.Timestamp(value).date()
    except Exception:
        return None


def _clean(obj):
    if obj is None:
        return None
    if isinstance(obj, float) and np.isnan(obj):
        return None
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return None if np.isnan(float(obj)) else float(obj)
    if isinstance(obj, dict):
        return {k: _clean(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_clean(v) for v in obj]
    return obj


def load_measurements() -> tuple[pd.DataFrame, pd.DataFrame]:
    polls = pd.read_parquet(PROC / "polls.parquet")
    est = pd.read_parquet(PROC / "poll_estimates.parquet")
    polls["fw_start_d"] = polls["fieldwork_start"].map(_date)
    polls["fw_end_d"] = polls["fieldwork_end"].map(_date)
    polls["pub_d"] = polls["published_at"].map(_date)
    canonical_path = PROC / "polls_canonical.parquet"
    if canonical_path.exists():
        canonical = pd.read_parquet(canonical_path, columns=["poll_id", "is_tracking_update"])
        tracking = canonical.groupby("poll_id")["is_tracking_update"].any()
        polls["is_tracking_update"] = polls["poll_id"].map(tracking).fillna(False).astype(bool)
    else:
        polls["is_tracking_update"] = False
    est = est[est["mapping_status"] == "mapped"].copy()
    est["party_id"] = est["candidacy_or_party_id"]
    return polls, est


def _eligible(polls: pd.DataFrame, as_of: date, poll_type: str = PRIMARY_TYPE) -> pd.DataFrame:
    p = polls[(polls["estimate_type"] == poll_type) & polls["fw_end_d"].notna()]
    p = p[p["fw_end_d"] <= as_of]
    # Nunca incluir una publicación conocida posterior al corte.
    p = p[p["pub_d"].notna() & (p["pub_d"] <= as_of)]
    return p


def _latest_per_house(p: pd.DataFrame) -> pd.DataFrame:
    if p.empty:
        return p
    x = p.sort_values(["pollster", "fw_end_d", "poll_id"])
    return x.groupby("pollster", as_index=False).tail(1)


def _snapshot(polls: pd.DataFrame, est: pd.DataFrame, as_of: date) -> dict:
    p = _eligible(polls, as_of)
    latest = _latest_per_house(p)
    ids = set(latest["poll_id"])
    e = est[est["poll_id"].isin(ids)]
    parties: dict[str, dict] = {}
    for party, g in e.groupby("party_id"):
        vals = g["value_pct"].astype(float)
        if vals.empty:
            continue
        parties[party] = {
            "n_houses": int(g["poll_id"].nunique()),
            "median": round(float(vals.median()), 3),
            "mean": round(float(vals.mean()), 3),
            "min": round(float(vals.min()), 3),
            "max": round(float(vals.max()), 3),
        }
    return {
        "date": as_of.isoformat(),
        "n_polls": int(len(p)),
        "n_houses": int(latest["pollster"].nunique()),
        "parties": dict(sorted(parties.items(), key=lambda kv: -kv[1]["median"])),
        "inclusion_basis": "fieldwork_end<=as_of y published_at conocido y <=as_of",
    }


def _distribution(polls: pd.DataFrame, est: pd.DataFrame, as_of: date) -> list[dict]:
    p = _eligible(polls, as_of)
    latest = _latest_per_house(p)
    e = est[est["poll_id"].isin(set(latest["poll_id"]))]
    rows = []
    for party, g in e.groupby("party_id"):
        vals = g["value_pct"].astype(float)
        rows.append({
            "party_id": party,
            "n_houses": int(vals.size),
            "min": round(float(vals.min()), 3),
            "p25": round(float(vals.quantile(0.25)), 3),
            "median": round(float(vals.median()), 3),
            "p75": round(float(vals.quantile(0.75)), 3),
            "max": round(float(vals.max()), 3),
            "mean": round(float(vals.mean()), 3),
            "spread": round(float(vals.max() - vals.min()), 3),
        })
    return sorted(rows, key=lambda r: -r["median"])


def _latest_by_house(polls: pd.DataFrame, est: pd.DataFrame, as_of: date) -> list[dict]:
    p = _eligible(polls, as_of)
    latest = _latest_per_house(p)
    out = []
    for _, r in latest.sort_values(["fw_end_d", "pollster"], ascending=[False, True]).iterrows():
        e = est[est["poll_id"] == r["poll_id"]]
        out.append({
            "poll_id": r["poll_id"],
            "house": r["pollster"],
            "publisher": r["sponsor_or_media"],
            "fieldwork_start": r["fw_start_d"].isoformat() if r["fw_start_d"] else None,
            "fieldwork_end": r["fw_end_d"].isoformat() if r["fw_end_d"] else None,
            "published_at": r["pub_d"].isoformat() if pd.notna(r["pub_d"]) else None,
            "publication_status": "fecha_publicacion_desconocida" if pd.isna(r["pub_d"]) else "publicada",
            "sample_size": int(r["sample_size"]) if pd.notna(r["sample_size"]) else None,
            "poll_type": r["estimate_type"],
            "is_tracking_update": bool(r.get("is_tracking_update", False)),
            "is_duplicate": bool(r.get("canonical_poll_id") != r["poll_id"]),
            "estimates": {x["party_id"]: round(float(x["value_pct"]), 3) for _, x in e.iterrows()},
        })
    return out


def _timeline(polls: pd.DataFrame, est: pd.DataFrame, as_of: date, since: date) -> list[dict]:
    p = _eligible(polls, as_of)
    p = p[p["fw_end_d"] >= since]
    e = est[est["poll_id"].isin(set(p["poll_id"]))]
    merged = e.merge(p[["poll_id", "pollster", "fw_end_d", "sample_size", "estimate_type",
                         "canonical_poll_id", "quality_flag", "is_tracking_update"]], on="poll_id", how="inner")
    rows = []
    for _, r in merged.iterrows():
        rows.append({
            "date": r["fw_end_d"].isoformat(),
            "house": r["pollster"],
            "party": r["party_id"],
            "value": round(float(r["value_pct"]), 3),
            "poll_id": r["poll_id"],
            "sample_size": int(r["sample_size"]) if pd.notna(r["sample_size"]) else None,
            "is_duplicate": bool(r["canonical_poll_id"] != r["poll_id"]),
            "tracking_hint": bool(r.get("is_tracking_update", False)),
        })
    return sorted(rows, key=lambda r: (r["date"], r["house"], r["party"]))


def build_campaign(as_of: date, snapshot_start: date) -> dict:
    polls, est = load_measurements()
    dates = [d for d in pd.date_range(snapshot_start, as_of, freq="D").date]
    # Incluye el día de cada nuevo campo dentro del rango, aunque snapshot_start sea posterior.
    eligible = _eligible(polls, as_of)
    change_dates = sorted({d for d in eligible["pub_d"].tolist()
                           if d is not None and snapshot_start <= d <= as_of})
    dates = sorted(set(dates) | set(change_dates) | {as_of})
    snapshots = []
    prev = None
    for d in dates:
        snap = _snapshot(polls, est, d)
        if prev is not None:
            snap["deltas"] = {
                party: round(snap["parties"][party]["median"] - prev["parties"].get(party, {}).get("median", snap["parties"][party]["median"]), 3)
                for party in snap["parties"]
            }
        prev = snap
        snapshots.append(snap)

    change_days = []
    for d in change_dates:
        g = eligible[eligible["pub_d"] == d]
        if len(g):
            change_days.append({
                "date": d.isoformat(),
                "n_new_polls": int(len(g)),
                "houses": sorted(g["pollster"].dropna().unique().tolist()),
            })

    _cutoffs = [d for d in _eligible(polls, as_of)["fw_end_d"].tolist()
                if d is not None]
    cutoff = max(_cutoffs) if _cutoffs else None
    known_pub = polls["pub_d"].notna().sum()
    duplicates = polls[polls["canonical_poll_id"] != polls["poll_id"]]
    warnings = []
    if cutoff is None:
        warnings.append("No hay encuestas con fecha de campo; no se genera agregado.")
    else:
        warnings.append(
            f"Última fecha de campo disponible: {cutoff.isoformat()}. "
            "Si no hay nuevas olas, el agregado no se mueve.")
    if known_pub == 0:
        warnings.append("Las fechas de publicación son desconocidas; estas encuestas se excluyen de los snapshots históricos.")
    warnings.append("Las bandas entre encuestadoras no son intervalos de probabilidad del resultado electoral.")
    warnings.append("Estimación de voto e intención directa se mantienen separadas; este panel usa solo estimated_vote.")

    payload = {
        "as_of": as_of.isoformat(),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "data_cutoff": cutoff.isoformat() if cutoff else None,
        "primary_poll_type": PRIMARY_TYPE,
        "n_polls_total": int(len(polls)),
        "n_polls_primary": int(len(polls[polls["estimate_type"] == PRIMARY_TYPE])),
        "n_houses": int(polls["pollster"].nunique()),
        "n_duplicates": int(len(duplicates)),
        "n_tracking_updates": int(polls["is_tracking_update"].sum()),
        "snapshots": snapshots,
        "change_days": change_days,
        "distribution": _distribution(polls, est, as_of),
        "latest_by_house": _latest_by_house(polls, est, as_of),
        "timeline": _timeline(polls, est, as_of, date(2026, 1, 1)),
        "warnings": warnings,
        "aggregation": {
            "method": "mediana y media no ponderadas de la última ola independiente por casa",
            "one_wave_per_house": True,
            "replicas_excluded_from_aggregate": True,
            "direct_intention_separate": True,
            "not_a_prediction": True,
        },
    }
    return _clean(payload)


def write_outputs(payload: dict) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    SNAPS.mkdir(parents=True, exist_ok=True)
    # Snapshots inmutables: solo se escriben si no existen; si existen, se conserva el original.
    manifest = []
    for snap in payload["snapshots"]:
        blob = json.dumps(snap, ensure_ascii=False, indent=2).encode("utf-8")
        digest = hashlib.sha256(blob).hexdigest()
        dest = SNAPS / f"{snap['date']}.json"
        if not dest.exists():
            dest.write_bytes(blob)
        elif dest.read_bytes() != blob:
            raise ValueError(f"Snapshot inmutable distinto: {dest}; conservar y revisar")
        manifest.append({"date": snap["date"], "sha256": digest,
                         "file": str(dest.relative_to(ROOT)), "immutable": True})
    (OUT / "snapshot_manifest.json").write_text(
        json.dumps({"as_of": payload["as_of"], "snapshots": manifest}, ensure_ascii=False, indent=2),
        encoding="utf-8")
    (OUT / "latest.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    (PROC / "campaign.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
                                        encoding="utf-8")
    print(f"[campaign] as_of={payload['as_of']} snapshots={len(payload['snapshots'])} "
          f"casas={payload['n_houses']} corte={payload['data_cutoff']}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Snapshots descriptivos de campaña")
    ap.add_argument("--as-of", help="Fecha ISO (por defecto config/campaign.json)")
    args = ap.parse_args()
    cfg = _cfg()
    as_of = date.fromisoformat(args.as_of or cfg.get("as_of", "2026-11-12"))
    start = date.fromisoformat(cfg.get("snapshot_start", "2026-06-01"))
    write_outputs(build_campaign(as_of, start))


if __name__ == "__main__":
    main()
