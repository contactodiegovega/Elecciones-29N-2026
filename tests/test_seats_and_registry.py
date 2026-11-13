import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _json(path: str):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def test_official_seats_2026_match_boe_and_keep_350():
    cfg = _json("config/official_seats_2026.json")
    assert cfg["source_id"] == "BOE-A-2026-20742"
    assert cfg["total_seats"] == 350
    assert len(cfg["seats_2026"]) == 52
    assert sum(cfg["seats_2026"].values()) == 350
    assert sum(cfg["seats_2023"].values()) == 350
    assert cfg["seats_2026"]["28"] == 38 and cfg["seats_2023"]["28"] == 37
    assert cfg["seats_2026"]["11"] == 8 and cfg["seats_2023"]["11"] == 9
    changed = {k for k in cfg["seats_2026"] if cfg["seats_2026"][k] != cfg["seats_2023"][k]}
    assert changed == {"11", "28"}


def test_simulator_uses_2026_distribution_and_still_validates_2023():
    sim = _json("web/public/data/simulator.json")
    assert sim["total_seats"] == 350
    assert sum(p["seats"] for p in sim["provinces"]) == 350
    assert all(p["seats"] == p["seats_2026"] for p in sim["provinces"])
    assert all(p["seats_change"] == p["seats_2026"] - p["seats_2023"] for p in sim["provinces"])
    assert sim["validation"]["ok"] is True
    assert sim["validation"]["seats_allocated"] == 350
    assert sim["validation"]["seat_mismatches"] == []
    assert sim["seat_distribution"]["source_id"] == "BOE-A-2026-20742"


def test_model_registry_is_frozen_and_not_publicable():
    reg = _json("web/public/data/model_registry.json")
    assert reg["status"] == "no_go"
    assert reg["public_projection_allowed"] is False
    assert reg["projection_2026"] is None
    assert len(reg["versions"]) == 8
    assert all(v["target"] == "turnout_pct" for v in reg["versions"])
    assert reg["best_baseline"]["version_id"] == "f3-mean3"
    assert reg["best_baseline"]["mae_macro_pp"] < reg["best_experimental"]["mae_macro_pp"]
    assert "2026" in reg["reason"]
