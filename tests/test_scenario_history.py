import json
from pathlib import Path

from src.electoral.scenario_history import comparable_labels

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "web/public/data"


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def test_all_history_payloads_are_complete_and_do_not_invent_candidacies():
    original = load(PUBLIC / "labels_by_election/2019-11-10.json")["rows"]
    policy = load(ROOT / "config/scenario_identities.json")
    taxonomy = load(PUBLIC / "taxonomy.json")
    total = 0
    for i in range(1, 53):
        code = f"{i:02}"
        payload = load(PUBLIC / f"scenario_history/{code}.json")
        snapshot = payload["previous"]
        rows = [r for r in original if r["p"] == code and (r["v"] > 0 or r["s"] > 0)]
        assert snapshot["rows"] == rows
        assert sum(r["v"] for r in rows) + snapshot["turnout"]["votos_blancos"] == snapshot["turnout"]["votos_validos"]
        assert sum(r["s"] for r in rows) == snapshot["seats"]
        assert payload["identityPolicy"] == policy
        current = load(PUBLIC / f"provinces/{code}.json")
        assert payload["comparable"] == comparable_labels(rows, current["rows"], taxonomy, policy)
        assert payload["source"].startswith("https://infoelectoral.interior.gob.es/")
        assert len(payload["artifacts"]) == 3
        total += snapshot["seats"]
    assert total == 350


def test_no_coalition_matching_by_party_id_or_family_and_no_renaming_inference():
    policy = load(ROOT / "config/scenario_identities.json")
    taxonomy = {"parties": [{"party_id": "PP", "kind": "party"}, {"party_id": "SUMAR", "kind": "coalition"}]}
    rows = [{"label": "PARTIDO POPULAR - PP", "party": "PP"}, {"label": "PP-PAR", "party": "PP"}, {"label": "SUMAR", "party": "SUMAR"}]
    assert comparable_labels(rows, rows, taxonomy, policy) == ["PARTIDO POPULAR - PP"]
    assert comparable_labels(rows, [{"label": "NUEVO NOMBRE", "party": "PP"}], taxonomy, policy) == []
