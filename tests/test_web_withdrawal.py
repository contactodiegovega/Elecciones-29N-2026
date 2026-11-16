import json
from pathlib import Path

from src.electoral.web_artifacts import WITHDRAWN, archive_path, atlas_only

ROOT = Path(__file__).resolve().parents[1]


def test_regeneration_routes_every_retired_artifact_outside_public():
    for name in WITHDRAWN:
        assert archive_path(ROOT / "web/public/data" / name) == ROOT / "web/archive/data" / name
        assert not (ROOT / "web/public/data" / name).exists()
        assert (ROOT / "web/archive/data" / name).is_file()
    historical = ROOT / "web/public/data/provinces/24.json"
    assert archive_path(historical) == historical


def test_public_atlas_excludes_all_scenario_and_poll_inputs():
    scientific = json.loads((ROOT / "web/archive/data/simulator.json").read_text(encoding="utf-8"))
    public = json.loads((ROOT / "web/public/data/simulator.json").read_text(encoding="utf-8"))
    assert public == atlas_only(scientific)
    assert sum(p["seats_2023"] for p in public["provinces"]) == 350
    assert "baseline_votes" in scientific["provinces"][0]
    assert "baseline_votes" not in public["provinces"][0]
