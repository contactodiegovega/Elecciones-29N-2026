"""Prepare static files with a fresh editorial clock; public releases fail closed.

Local preview is allowed. This cannot purge already deployed CDN/browser/GitHub
artifacts, so public deployment remains blocked until that operational capability
and the user's authorization are explicitly recorded.
"""
from __future__ import annotations

import argparse
import json
import os
from datetime import date, datetime, timezone
from pathlib import Path

import pandas as pd

from .electoral_calendar import editorial_status
from .poll_updates import ROOT, STORE, write_json as write_audit_json


def write_json(path: Path, value) -> None:
    # Public payloads stay compact; private review manifests remain readable.
    write_audit_json(path, value, compact=True)


def json_value(value):
    if isinstance(value, dict):
        return {k: json_value(v) for k, v in value.items()}
    if isinstance(value, list):
        return [json_value(v) for v in value]
    if value is None or pd.isna(value):
        return None
    if hasattr(value, "item"):
        return value.item()
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def export_archive(public: Path, status: dict, root: Path = ROOT, primary: list[dict] | None = None) -> None:
    if not status["polls_visible"]:
        for cycle in ("2023", "2026"):
            write_json(public / f"polls_{cycle}.json", {"cycle": cycle, "restricted": True, "polls": [], "note": status["reason"]})
        return
    proc = root / "data" / "processed"
    polls = pd.read_parquet(proc / "polls.parquet")
    estimates = pd.read_parquet(proc / "poll_estimates.parquet")
    canonical = pd.read_parquet(proc / "polls_canonical.parquet")
    meta = {pid: g.iloc[0].to_dict() for pid, g in canonical.groupby("poll_id")}
    by_poll = {pid: g.to_dict("records") for pid, g in estimates.groupby("poll_id")}
    cycles = {"2023": [], "2026": []}
    for p in polls.to_dict("records"):
        end = str(p.get("fieldwork_end") or "")
        cycle = "2023" if end < "2023-07-23" else "2026"
        m = meta.get(p["poll_id"], {})
        item = {"id": p["poll_id"], "pollster": p["pollster"], "sponsor": p.get("sponsor_or_media"),
                "fw_start": p.get("fieldwork_start"), "fw_end": p.get("fieldwork_end"),
                "n": int(p["sample_size"]) if pd.notna(p.get("sample_size")) else None,
                "type": p["estimate_type"], "canonical": p["canonical_poll_id"],
                "published_at": m.get("published_at"), "publication_status": "historical_archive_unverified",
                "original_url": p.get("source_url"), "source_license": m.get("source_license"),
                "retrieved_at": m.get("retrieved_at"), "source_hash": m.get("source_hash"),
                "quality_flags": m.get("quality_flags"), "is_tracking_update": bool(m.get("is_tracking_update", False)),
                "population": m.get("population"), "mode": m.get("mode"), "geography": m.get("geography"),
                "est": [{"p": e.get("candidacy_or_party_id"), "label": e["reported_label"], "v": float(e["value_pct"]), "m": e["mapping_status"]} for e in by_poll.get(p["poll_id"], [])]}
        cycles[cycle].append(json_value(item))
    for verified in primary or []:
        cycle = "2023" if verified["published_at"] < "2023-07-23" else "2026"
        duplicate = next((p for p in cycles[cycle] if verified.get("fw_end") and
                          p["pollster"].casefold() == verified["pollster"].casefold() and p["type"] == verified["type"] and
                          p.get("fw_start") == verified.get("fw_start") and p.get("fw_end") == verified.get("fw_end")), None)
        record = {**verified}
        if duplicate:
            record["canonical"] = duplicate["canonical"]
            record["quality_flags"] = (record.get("quality_flags") or "") + ";possible_replica"
        cycles[cycle].append(record)
    for cycle, items in cycles.items():
        write_json(public / f"polls_{cycle}.json", {"cycle": cycle, "restricted": False, "polls": items, "note": "Archivo de mediciones. Las fechas de publicación no verificadas no se usan en Últimas encuestas."})


def assert_public_release(policy: dict, status: dict) -> None:
    required = ("public_release_authorized", "cache_withdrawal_verified", "legacy_urls_withdrawal_verified")
    missing = [key for key in required if policy.get(key) is not True]
    if missing or not status["polls_visible"]:
        raise RuntimeError("PUBLICACIÓN BLOQUEADA: revisión local únicamente. Pendiente: " + ", ".join(missing or ["restricción editorial vigente"]))


def prepare_web(public: Path = ROOT / "web" / "public" / "data", store: Path = STORE,
                now: datetime | None = None, root: Path = ROOT) -> dict:
    now = now or datetime.now(timezone.utc)
    status = editorial_status(now)
    public.mkdir(parents=True, exist_ok=True)
    write_json(public / "publication_status.json", status)
    registry = json.loads((store / "verified.json").read_text(encoding="utf-8")) if (store / "verified.json").exists() else []
    if status["polls_visible"]:
        from .poll_updates import digest, validate_poll
        from datetime import date
        # Ignore an impossible/future archived verification instead of exposing it.
        checked = []
        for poll in registry:
            try:
                validate_poll(poll, date.fromisoformat(status["today_madrid"]))
                snapshot = store / "raw" / f"{poll['source_hash']}.bin"
                if not snapshot.exists() or digest(snapshot.read_bytes()) != poll["source_hash"]:
                    continue
                documents = poll.get("document_evidence", [])
                if any(not (store / "raw" / f"{d['sha256']}.bin").exists() or digest((store / "raw" / f"{d['sha256']}.bin").read_bytes()) != d["sha256"] for d in documents):
                    continue
                if poll.get("publication_status") == "verified_primary":
                    checked.append(poll)
            except (ValueError, KeyError, TypeError):
                continue
    else:
        checked = []
    checked.sort(key=lambda p: (p["published_at"], p["id"]), reverse=True)
    export_archive(public, status, root, checked)
    run = json.loads((store / "latest_run.json").read_text(encoding="utf-8")) if (store / "latest_run.json").exists() else {}
    latest = {"generated_at": now.isoformat(), "restricted": not status["polls_visible"], "polls": checked[:6],
              "total_verified": len(checked), "last_update": run.get("retrieved_at"),
              "sources": [{"id": s["id"], "status": s["status"]} for s in run.get("sources", [])] if status["polls_visible"] else [],
              "note": "Solo publicaciones primarias con fecha explícita. Cobertura limitada a conectores revisados; no se sustituyen por fechas de campo." if status["polls_visible"] else status["reason"]}
    write_json(public / "latest_polls.json", latest)
    catalog_path = public / "poll_sources.json"
    if catalog_path.exists():
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
        source_config = json.loads((root / "config" / "poll_sources.json").read_text(encoding="utf-8"))
        catalog["active_connectors"] = source_config["active_connectors"]
        catalog["official"] = source_config["official"]
        write_json(catalog_path, catalog)
    meta_path = public / "meta.json"
    if meta_path.exists():
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        meta["title"] = "El Último Escaño — reparto provincial, historia y encuestas"
        write_json(meta_path, meta)
    campaign = root / "data" / "processed" / "campaign.json"
    if status["polls_visible"] and campaign.exists():
        write_json(public / "campaign.json", json.loads(campaign.read_text(encoding="utf-8")))
    else:
        write_json(public / "campaign.json", {"as_of": status["today_madrid"], "snapshots": [], "warnings": [status["reason"]], "latest_by_house": [], "distribution": [], "timeline": [], "change_days": []})
    # Unknown old poll exports are not silently served or destroyed. Block build
    # until their owner classifies them. Canonical data remains in data/processed.
    allowed = {"polls_2023.json", "polls_2026.json", "latest_polls.json", "poll_sources.json", "campaign.json"}
    for path in public.rglob("*"):
        if path.is_file() and any(word in path.name.lower() for word in ("poll", "encuesta", "snapshot", "campaign")) and path.name not in allowed:
            raise RuntimeError(f"Exportación de encuestas no clasificada: {path.name}. Publicación bloqueada.")
    print(f"[web] JSON regenerados; reloj Madrid {status['today_madrid']}; restringido={not status['polls_visible']}; últimas verificadas={len(checked)}")
    return latest


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--release", action="store_true")
    args = parser.parse_args()
    if args.release or os.getenv("VERCEL") or os.getenv("NETLIFY") or os.getenv("PUBLIC_RELEASE"):
        assert_public_release(json.loads((ROOT / "config" / "publication_policy.json").read_text(encoding="utf-8")), editorial_status())
    prepare_web()


if __name__ == "__main__":
    main()
