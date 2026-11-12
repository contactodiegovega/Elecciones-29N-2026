# -*- coding: utf-8 -*-
"""Esquema canónico de encuestas y auditoría por fuente.

No modifica la ingesta histórica: normaliza `polls.parquet` + `poll_estimates.parquet`
a un contrato explícito, marca duplicados/réplicas/trackers y produce auditoría.
Si faltan campos, quedan nulos con un `quality_flag`; nunca se rellenan a 0.

Uso:
  python src/electoral/poll_schema.py
"""
from __future__ import annotations

import hashlib
import json
from datetime import date, datetime, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
PROC = ROOT / "data" / "processed"
REPORTS = ROOT / "reports" / "tables" / "campaign"
CONFIG = ROOT / "config"

CANONICAL_COLUMNS = [
    "poll_id", "source_id", "house", "publisher", "original_url", "published_at",
    "fieldwork_start", "fieldwork_end", "sample_size", "population", "mode",
    "geography", "poll_type", "sample_error_declared", "party_id", "party_original",
    "share_pct", "coalition_scope", "is_duplicate", "duplicate_of",
    "is_tracking_update", "is_hypothetical", "source_license", "retrieved_at",
    "source_hash", "parse_confidence", "quality_flags",
]

VALID_POLL_TYPES = {"estimated_vote", "direct_intention", "other"}


def _iso_date(value) -> str | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    s = str(value)[:10]
    if len(s) == 10 and s[4] == "-" and s[7] == "-":
        return s
    return None


def _confidence(flags: str) -> float:
    f = set(x for x in str(flags).split(";") if x)
    if any(x.startswith("unparsed") for x in f):
        return 0.3
    if "month_precision" in f:
        return 0.6
    if "possible_replica" in f:
        return 0.5
    if "year_from_section" in f or "no_pubdate_use_fieldwork" in f:
        return 0.85
    return 0.9


def _tracking_flags(polls: pd.DataFrame) -> pd.Series:
    """Marca actualizaciones de tracker: misma casa/tipo, ventanas solapadas y
    muestra no decreciente. Es una heurística documentada, no una equivalencia."""
    flags = pd.Series(False, index=polls.index, dtype=bool)
    work = polls.copy()
    work["_start"] = pd.to_datetime(work["fieldwork_start"], errors="coerce")
    work["_end"] = pd.to_datetime(work["fieldwork_end"], errors="coerce")
    for (_house, _type), g in work.groupby(["pollster", "estimate_type"], dropna=False):
        g = g.sort_values(["_end", "_start"])
        prev_end = None
        prev_n = None
        for idx, row in g.iterrows():
            if prev_end is not None and pd.notna(row["_start"]) and row["_start"] <= prev_end:
                n = row["sample_size"]
                if pd.isna(prev_n) or pd.isna(n) or float(n) >= float(prev_n):
                    flags.loc[idx] = True
            if pd.notna(row["_end"]):
                prev_end = row["_end"]
            if pd.notna(row["sample_size"]):
                prev_n = row["sample_size"]
    return flags


def build_canonical(as_of: date | None = None) -> pd.DataFrame:
    polls = pd.read_parquet(PROC / "polls.parquet")
    est = pd.read_parquet(PROC / "poll_estimates.parquet")
    audit = pd.read_csv(PROC / "polls_audit.csv", dtype=str) if (PROC / "polls_audit.csv").exists() else pd.DataFrame()
    hash_by_source = {}
    if not audit.empty and "source_id" in audit.columns and "sha256" in audit.columns:
        hash_by_source = dict(zip(audit["source_id"], audit["sha256"]))

    tracking = _tracking_flags(polls)
    rows = []
    by_poll = {k: g for k, g in est.groupby("poll_id")}
    for idx, p in polls.iterrows():
        if p.get("estimate_type") not in VALID_POLL_TYPES:
            continue
        flags = [x for x in str(p.get("quality_flag") or "").split(";") if x]
        if pd.isna(p.get("published_at")) and "fecha_publicacion_desconocida" not in flags:
            flags.append("fecha_publicacion_desconocida")
        if p.get("scope") and p.get("scope") != "national-Congress":
            flags.append("scope_no_nacional")
        source_id = str(p.get("page_id") or "unknown")
        g = by_poll.get(p["poll_id"], pd.DataFrame())
        if g.empty:
            continue
        for _, e in g.iterrows():
            if e.get("estimate_type") != p.get("estimate_type"):
                continue
            mapped = e.get("candidacy_or_party_id")
            status = e.get("mapping_status")
            if status == "unmapped_label":
                scope = "unmapped_label"
            elif status == "other_kept":
                scope = "reported_other"
            elif status == "nonvote_kept":
                scope = "nonvote"
            else:
                scope = None
            rows.append({
                "poll_id": p["poll_id"],
                "source_id": source_id,
                "house": p.get("pollster"),
                "publisher": p.get("sponsor_or_media"),
                "original_url": p.get("source_url"),
                "published_at": _iso_date(p.get("published_at")),
                "fieldwork_start": _iso_date(p.get("fieldwork_start")),
                "fieldwork_end": _iso_date(p.get("fieldwork_end")),
                "sample_size": int(p["sample_size"]) if pd.notna(p.get("sample_size")) else None,
                "population": p.get("sample_universe"),
                "mode": p.get("sample_mode"),
                "geography": p.get("scope"),
                "poll_type": p.get("estimate_type"),
                "sample_error_declared": None,
                "party_id": mapped if status == "mapped" else None,
                "party_original": e.get("reported_label"),
                "share_pct": float(e["value_pct"]) if pd.notna(e.get("value_pct")) else None,
                "coalition_scope": scope,
                "is_duplicate": bool(p.get("canonical_poll_id") != p["poll_id"]),
                "duplicate_of": None if p.get("canonical_poll_id") == p["poll_id"] else p.get("canonical_poll_id"),
                "is_tracking_update": bool(tracking.get(idx, False)),
                "is_hypothetical": False,
                "source_license": p.get("license_status"),
                "retrieved_at": p.get("retrieved_at"),
                "source_hash": hash_by_source.get(f"polls_{source_id}") or p.get("data_version"),
                "parse_confidence": _confidence(";".join(flags)),
                "quality_flags": ";".join(flags) or "ok",
            })
    df = pd.DataFrame(rows, columns=CANONICAL_COLUMNS)
    validate_canonical(df, as_of=as_of)
    return df


def validate_canonical(df: pd.DataFrame, as_of: date | None = None) -> None:
    if df.empty:
        raise ValueError("esquema canónico vacío")
    bad_share = df[df["share_pct"].notna() & ((df["share_pct"] < 0) | (df["share_pct"] > 100))]
    if not bad_share.empty:
        raise ValueError(f"{len(bad_share)} filas con share_pct fuera de [0,100]")
    bad_type = df[~df["poll_type"].isin(VALID_POLL_TYPES)]
    if not bad_type.empty:
        raise ValueError(f"poll_type inválido: {sorted(bad_type['poll_type'].unique())}")
    both = df.dropna(subset=["fieldwork_start", "fieldwork_end"]).copy()
    both["_s"] = pd.to_datetime(both["fieldwork_start"], errors="coerce")
    both["_e"] = pd.to_datetime(both["fieldwork_end"], errors="coerce")
    both = both.dropna(subset=["_s", "_e"])
    bad_dates = both[both["_s"] > both["_e"]]
    if not bad_dates.empty:
        raise ValueError(f"{len(bad_dates)} filas con fieldwork_start > fieldwork_end")
    if as_of is not None:
        future = both[pd.to_datetime(both["fieldwork_end"]).dt.date > as_of]
        if not future.empty:
            raise ValueError(f"{len(future)} filas con fieldwork_end posterior a as_of={as_of}")
        pub = df.dropna(subset=["published_at"])
        future_pub = pub[pd.to_datetime(pub["published_at"]).dt.date > as_of]
        if not future_pub.empty:
            raise ValueError(f"{len(future_pub)} filas publicadas después de as_of={as_of}")


def source_audit(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for (source_id, house, publisher, poll_type), g in df.groupby(
            ["source_id", "house", "publisher", "poll_type"], dropna=False):
        rows.append({
            "source_id": source_id,
            "house": house,
            "publisher": publisher,
            "poll_type": poll_type,
            "n_measurements": int(len(g)),
            "n_polls": int(g["poll_id"].nunique()),
            "latest_fieldwork_end": g["fieldwork_end"].max(),
            "latest_published_at": g["published_at"].max(),
            "original_url": g["original_url"].dropna().iloc[0] if g["original_url"].notna().any() else None,
            "source_license": g["source_license"].dropna().iloc[0] if g["source_license"].notna().any() else None,
            "n_duplicates": int(g["is_duplicate"].sum()),
            "n_tracking_updates": int(g["is_tracking_update"].sum()),
            "n_unmapped_labels": int((g["coalition_scope"] == "unmapped_label").sum()),
            "unknown_publication": bool(g["quality_flags"].str.contains("fecha_publicacion_desconocida").any()),
            "quality_flags": ";".join(sorted({f for flags in g["quality_flags"].dropna() for f in flags.split(";") if f}))[:300],
        })
    out = pd.DataFrame(rows).sort_values(["latest_fieldwork_end", "house"], ascending=[False, True])
    return out


def main() -> None:
    PROC.mkdir(parents=True, exist_ok=True)
    REPORTS.mkdir(parents=True, exist_ok=True)
    as_of = None
    if (CONFIG / "campaign.json").exists():
        cfg = json.loads((CONFIG / "campaign.json").read_text(encoding="utf-8"))
        as_of = date.fromisoformat(cfg.get("as_of", "2026-11-12"))
    df = build_canonical(as_of=as_of)
    df.to_parquet(PROC / "polls_canonical.parquet", index=False)
    audit = source_audit(df)
    audit.to_csv(REPORTS / "poll_source_audit.csv", index=False)
    catalog = json.loads((CONFIG / "poll_sources.json").read_text(encoding="utf-8")) if (CONFIG / "poll_sources.json").exists() else {"sources": []}
    catalog["generated_at"] = datetime.now(timezone.utc).isoformat()
    catalog["coverage"] = json.loads(audit.to_json(orient="records", force_ascii=False))
    catalog["totals"] = {
        "measurements": int(len(df)),
        "polls": int(df["poll_id"].nunique()),
        "houses": int(df["house"].nunique()),
        "unknown_publication_measurements": int(df["quality_flags"].str.contains("fecha_publicacion_desconocida").sum()),
    }
    (REPORTS / "poll_source_catalog.json").write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
    digest = hashlib.sha256(df.to_csv(index=False).encode("utf-8")).hexdigest()
    (REPORTS / "poll_schema_manifest.json").write_text(json.dumps({
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "as_of": as_of.isoformat() if as_of else None,
        "rows": len(df),
        "polls": int(df["poll_id"].nunique()),
        "sha256": digest,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[poll_schema] {len(df)} filas canónicas, {df['poll_id'].nunique()} encuestas, "
          f"{df['house'].nunique()} casas; auditoría en {REPORTS.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
