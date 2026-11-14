"""Small, reproducible initial payloads for the province calculator. No network."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def export_provinces(public: Path = ROOT / "web" / "public" / "data") -> None:
    load = lambda name: json.loads((public / name).read_text(encoding="utf-8"))
    sim = load("simulator.json")
    rows = load("labels_by_election/2023-07-23.json")["rows"]
    turnout = {r["province_code"]: r for r in load("turnout.json") if r["election_date"] == "2023-07-23"}
    colors = {p["party_id"]: p["hex_color"] for p in sim["parties"]}
    dest = public / "provinces"
    dest.mkdir(parents=True, exist_ok=True)
    index = []
    for p in sim["provinces"]:
        code = p["province_code"]
        item = {"code": code, "name": p["province_name"], "seats2023": p["seats_2023"], "seats2026": p["seats_2026"]}
        actual = [r for r in rows if r["p"] == code and (r["v"] > 0 or r["s"] > 0)]
        actual.sort(key=lambda r: -r["v"])
        if sum(r["v"] for r in actual) + turnout[code]["votos_blancos"] != turnout[code]["votos_validos"]:
            raise ValueError(f"Denominador provincial incoherente: {code}")
        payload = {**item, "election": "2023-07-23", "turnout": turnout[code], "rows": actual,
                   "colors": {r["label"]: colors.get(r["party"], "#737373") for r in actual}}
        (dest / f"{code}.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        index.append(item)
    if len(index) != 52 or sum(p["seats2023"] for p in index) != 350 or sum(p["seats2026"] for p in index) != 350:
        raise ValueError("Se requieren 52 circunscripciones y 350 diputados en cada convocatoria.")
    (dest / "index.json").write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("[provinces] 52 payloads; León (24) preparado para renderizado inicial.")


if __name__ == "__main__":
    export_provinces()
