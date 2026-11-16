"""Classify retired web artifacts without changing the scientific payloads."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WITHDRAWN = {"polls_2023.json", "polls_2026.json", "latest_polls.json", "poll_sources.json", "campaign.json"}


def archive_path(path: Path, root: Path = ROOT) -> Path:
    if path.parent.resolve() == (root / "web/public/data").resolve() and path.name in WITHDRAWN:
        return root / "web/archive/data" / path.name
    return path


def atlas_only(sim: dict) -> dict:
    return {
        "provinces": [{key: p[key] for key in ("province_code", "province_name", "seats", "seats_2023", "seats_2026")} for p in sim["provinces"]],
        "parties": [{key: p[key] for key in ("party_id", "seats_2023_official", "hex_color")} for p in sim["parties"]],
    }
