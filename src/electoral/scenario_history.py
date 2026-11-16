"""Offline, auditable 2019-Nov / 2023 provincial comparisons. No inferred voter flows."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = "https://infoelectoral.interior.gob.es/es/elecciones-celebradas/area-de-descargas/"


def comparable_labels(previous: list, current: list, taxonomy: dict, policy: dict) -> list[str]:
    kinds = {p["party_id"]: p["kind"] for p in taxonomy["parties"]}
    old = {r["label"]: r for r in previous}
    return sorted(r["label"] for r in current if r["label"] in old
                  and r["party"] is not None and r["party"] == old[r["label"]]["party"]
                  and kinds.get(r["party"]) == "party"
                  and r["party"] not in policy["excluded_party_ids"]
                  and not any(part in r["label"].upper() for part in policy["excluded_label_fragments"]))


def export_history(public: Path = ROOT / "web/public/data") -> None:
    load = lambda name: json.loads((public / name).read_text(encoding="utf-8"))
    policy = json.loads((ROOT / "config/scenario_identities.json").read_text(encoding="utf-8"))
    taxonomy, colors = load("taxonomy.json"), load("colors.json")
    color_by_party = {r["party_id"]: r["hex_color"] for r in colors["parties"]}
    labels = load("labels_by_election/2019-11-10.json")["rows"]
    turnout = {r["province_code"]: r for r in load("turnout.json") if r["election_date"] == "2019-11-10"}
    dest = public / "scenario_history"
    dest.mkdir(parents=True, exist_ok=True)
    total = 0
    for province in load("provinces/index.json"):
        code = province["code"]
        current = load(f"provinces/{code}.json")
        rows = [r for r in labels if r["p"] == code and (r["v"] > 0 or r["s"] > 0)]
        t = turnout[code]
        seats = sum(r["s"] for r in rows)
        if not rows or seats < 1 or sum(r["v"] for r in rows) + t["votos_blancos"] != t["votos_validos"]:
            raise ValueError(f"Historia incompleta: {code}")
        total += seats
        payload = {"code": code, "previous": {"election": "2019-11-10", "seats": seats,
                   "rows": rows, "turnout": t, "colors": {r["label"]: color_by_party.get(r["party"], "#737373") for r in rows}},
                   "comparable": comparable_labels(rows, current["rows"], taxonomy, policy),
                   "identityPolicy": policy, "source": SOURCE,
                   "artifacts": ["labels_by_election/2019-11-10.json", f"provinces/{code}.json", "turnout.json"]}
        (dest / f"{code}.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    if total != 350:
        raise ValueError("El histórico debe sumar 350 diputados.")
    print("[scenario-history] 52 comparaciones oficiales 2019-Nov / 2023; sin equivalencias de coaliciones.")


if __name__ == "__main__":
    export_history()
