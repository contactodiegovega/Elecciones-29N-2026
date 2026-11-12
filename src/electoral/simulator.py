# -*- coding: utf-8 -*-
"""Motor de escenarios provinciales para el Congreso (D'Hondt, umbral 3 %).

No es una predicción. Reparte escaños bajo supuestos explícitos del usuario.
Valida el método con las candidaturas oficiales de 2023 (suma 350 y 0 discrepancias).

Uso:
  python src/electoral/simulator.py
  python src/electoral/simulator.py --validate-only
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
PROC = ROOT / "data" / "processed"
CONFIG = ROOT / "config"
REPORTS = ROOT / "reports" / "tables" / "campaign"
TOTAL_SEATS = 350
THRESHOLD = 0.03
BASELINE_ELECTION = "2023-07-23"


def load_province_names() -> dict[str, str]:
    path = CONFIG / "provinces.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8")).get("provinces", {})


def d_hondt(votes: dict[str, float], seats: int, threshold: float = THRESHOLD,
            valid_votes: float | None = None) -> dict[str, int]:
    """Reparto D'Hondt con umbral legal sobre votos válidos de la circunscripción."""
    if seats < 0:
        raise ValueError("seats no puede ser negativo")
    clean = {str(k): float(v) for k, v in votes.items() if v is not None and float(v) > 0}
    known = {k: v for k, v in clean.items() if v > 0}
    if not known or seats == 0:
        return {k: 0 for k in votes}
    denom = float(valid_votes) if valid_votes else sum(known.values())
    eligible = {k: v for k, v in known.items() if denom > 0 and v / denom >= threshold}
    if not eligible:
        return {k: 0 for k in votes}
    result = {k: 0 for k in votes}
    # Desempate determinista por identificador.
    order = {k: i for i, k in enumerate(sorted(eligible))}
    for _ in range(seats):
        winner = max(eligible, key=lambda k: (eligible[k] / (result[k] + 1), -order[k]))
        result[winner] += 1
    return result


def _load_election(election: str = BASELINE_ELECTION) -> tuple[pd.DataFrame, pd.DataFrame]:
    res = pd.read_parquet(PROC / "election_results.parquet")
    res = res[res["election_date"].astype(str) == election].copy()
    to = pd.read_parquet(PROC / "election_turnout.parquet")
    to = to[to["election_date"].astype(str) == election].copy()
    mp = pd.read_parquet(PROC / "candidacy_party_mapping.parquet")
    mp = mp[mp["election_date"].astype(str) == election][["candidacy_raw", "party_id"]]
    res = res.merge(mp, on="candidacy_raw", how="left")
    res["party_key"] = res["party_id"].fillna("OTROS")
    return res, to


def validate_historical(election: str = BASELINE_ELECTION) -> dict:
    """Valida D'Hondt con las candidaturas originales (sin agregación por partido)."""
    res, to = _load_election(election)
    valid_by_prov = to.set_index("province_code")["votos_validos"].astype(float).to_dict()
    mismatches = []
    allocated_total = 0
    for province, g in res.groupby("province_code"):
        seats = int(g["seats"].sum())
        votes = {str(r.candidacy_raw): float(r.votes) for r in g.itertuples()}
        got = d_hondt(votes, seats, THRESHOLD, valid_by_prov.get(province))
        allocated_total += sum(got.values())
        for r in g.itertuples():
            if int(got.get(str(r.candidacy_raw), 0)) != int(r.seats):
                mismatches.append({
                    "province": province, "candidacy": r.candidacy_raw,
                    "official": int(r.seats), "d_hondt": int(got.get(str(r.candidacy_raw), 0)),
                })
    return {
        "election": election,
        "method": "D'Hondt por provincia con candidaturas originales; umbral 3 % de votos válidos",
        "seats_allocated": int(allocated_total),
        "seats_expected": TOTAL_SEATS,
        "mismatches": mismatches,
        "ok": allocated_total == TOTAL_SEATS and not mismatches,
    }


def build_baseline(election: str = BASELINE_ELECTION) -> dict:
    res, to = _load_election(election)
    names = load_province_names()
    reg = pd.read_parquet(PROC / "party_registry.parquet")
    display = dict(zip(reg["party_id"], reg["display_name"]))
    colors = json.loads((CONFIG / "party_colors.json").read_text(encoding="utf-8"))["parties"]
    color_map = {c["party_id"]: c["hex_color"] for c in colors}

    national_votes = res.groupby("party_key")["votes"].sum().astype(float)
    national_seats = res.groupby("party_key")["seats"].sum().astype(int)
    total_valid = float(to["votos_validos"].sum())
    parties = []
    for pid, votes in national_votes.sort_values(ascending=False).items():
        parties.append({
            "party_id": pid,
            "display_name": display.get(pid, "Otros / sin mapear" if pid == "OTROS" else pid),
            "hex_color": color_map.get(pid, "#777777"),
            "national_votes": int(votes),
            "national_share": round(votes / total_valid * 100, 3) if total_valid else None,
            "seats_2023_official": int(national_seats.get(pid, 0)),
        })

    provinces = []
    for province, g in res.groupby("province_code"):
        t = to[to["province_code"] == province]
        valid = float(t["votos_validos"].iloc[0]) if len(t) else None
        turnout = float(t["turnout_rate"].iloc[0]) if len(t) and pd.notna(t["turnout_rate"].iloc[0]) else None
        votes = {k: float(v) for k, v in g.groupby("party_key")["votes"].sum().items()}
        seats = int(g["seats"].sum())
        share = {k: round(v / valid * 100, 4) if valid else None for k, v in votes.items()}
        provinces.append({
            "province_code": province,
            "province_name": names.get(province, province),
            "seats": seats,
            "valid_votes": int(valid) if valid is not None else None,
            "turnout_rate": round(turnout, 2) if turnout is not None else None,
            "baseline_votes": {k: int(v) for k, v in votes.items()},
            "baseline_shares": share,
            "seats_2023_official": {k: int(v) for k, v in g.groupby("party_key")["seats"].sum().items() if v},
        })
    provinces.sort(key=lambda p: p["province_code"])
    return {
        "election_date": "2026-11-29",
        "baseline_election": election,
        "total_seats": TOTAL_SEATS,
        "threshold_pct": THRESHOLD * 100,
        "provinces": provinces,
        "parties": parties,
        "national_valid_votes": int(total_valid),
        "validation": validate_historical(election),
        "assumptions": [
            "Reparto D'Hondt por circunscripción con umbral legal del 3 % de votos válidos.",
            "Ceuta y Melilla reparten 1 escaño cada una; el umbral no altera el resultado.",
            "El escenario parte de los porcentajes nacionales introducidos por el usuario.",
            "La distribución territorial usa el patrón de voto de 2023 y un swing proporcional por partido.",
            "Las formaciones sin voto en 2023 se reparten proporcionalmente a los votos válidos provinciales.",
            "Los escaños son hipotéticos: no son una predicción ni una probabilidad calibrada.",
        ],
        "caveats": [
            "La agregación por partido puede agrupar coaliciones con siglas distintas; el detalle de validación usa candidaturas originales.",
            "No se modelan pactos postelectorales, investidura ni coaliciones de gobierno.",
            "La volatilidad y la participación son parámetros opcionales del usuario, no estimaciones.",
        ],
    }


def scenario_seats(national_shares: dict[str, float], baseline: dict,
                   threshold: float = THRESHOLD) -> dict:
    """Reparte escaños para un escenario nacional reproducible."""
    shares = {k: max(0.0, float(v)) for k, v in national_shares.items()}
    if sum(shares.values()) > 100.5:
        raise ValueError("la suma de porcentajes no puede superar 100")
    provinces = baseline["provinces"]
    total_valid = float(baseline["national_valid_votes"])
    nat_baseline = {p["party_id"]: float(p["national_votes"]) for p in baseline["parties"]}
    target = {k: (v / 100.0) * total_valid for k, v in shares.items()}
    per_province = []
    totals = {k: 0 for k in shares}
    for prov in provinces:
        votes = {}
        for party, share in shares.items():
            bnat = nat_baseline.get(party, 0.0)
            if bnat > 0:
                votes[party] = float(prov["baseline_votes"].get(party, 0)) * (target[party] / bnat)
            elif total_valid > 0:
                votes[party] = target[party] * (float(prov["valid_votes"] or 0) / total_valid)
            else:
                votes[party] = 0.0
        got = d_hondt(votes, int(prov["seats"]), threshold, prov["valid_votes"])
        for party, n in got.items():
            totals[party] += n
        per_province.append({
            "province_code": prov["province_code"],
            "province_name": prov["province_name"],
            "seats": prov["seats"],
            "allocation": {k: v for k, v in got.items() if v},
            "votes": {k: round(v, 1) for k, v in votes.items()},
        })
    return {
        "total_seats_allocated": int(sum(totals.values())),
        "seat_totals": dict(sorted(totals.items(), key=lambda kv: -kv[1])),
        "provinces": per_province,
        "assumptions_note": "Escenario hipotético; no es una predicción ni una probabilidad.",
    }


def monte_carlo(national_shares: dict[str, float], baseline: dict, iterations: int = 500,
                volatility: float = 0.08, seed: int = 42, threshold: float = THRESHOLD) -> dict:
    """Distribución de escaños bajo supuestos de variación; no calibrada."""
    if iterations < 1 or iterations > 5000:
        raise ValueError("iterations debe estar entre 1 y 5000")
    rng = np.random.default_rng(seed)
    parties = [k for k, v in national_shares.items() if v > 0]
    base = np.array([float(national_shares[k]) for k in parties], dtype=float)
    draws = []
    for _ in range(iterations):
        noise = rng.lognormal(mean=0.0, sigma=max(0.0, volatility), size=len(base))
        perturbed = base * noise
        if perturbed.sum() <= 0:
            continue
        perturbed = perturbed / perturbed.sum() * 100.0
        result = scenario_seats(dict(zip(parties, perturbed)), baseline, threshold)
        draws.append(result["seat_totals"])
    if not draws:
        raise ValueError("sin iteraciones válidas")
    out = {}
    for party in parties:
        vals = np.array([d.get(party, 0) for d in draws], dtype=float)
        out[party] = {
            "p05": int(round(float(np.quantile(vals, 0.05)))),
            "p25": int(round(float(np.quantile(vals, 0.25)))),
            "median": int(round(float(np.quantile(vals, 0.50)))),
            "p75": int(round(float(np.quantile(vals, 0.75)))),
            "p95": int(round(float(np.quantile(vals, 0.95)))),
            "mean": round(float(vals.mean()), 2),
            "min": int(vals.min()),
            "max": int(vals.max()),
        }
    return {
        "iterations": len(draws),
        "seed": seed,
        "volatility": volatility,
        "distribution": out,
        "note": "Banda de escenarios bajo supuestos del usuario; no es un intervalo de confianza calibrado.",
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="Simulador provincial D'Hondt")
    ap.add_argument("--validate-only", action="store_true")
    ap.add_argument("--scenario", help="JSON con {party: porcentaje}")
    args = ap.parse_args()
    baseline = build_baseline()
    val = baseline["validation"]
    print(f"[simulator] validación {val['election']}: {val['seats_allocated']} escaños, "
          f"{len(val['mismatches'])} discrepancias, ok={val['ok']}")
    if not val["ok"]:
        raise SystemExit("[simulator] la validación histórica ha fallado")
    if args.validate_only:
        return
    REPORTS.mkdir(parents=True, exist_ok=True)
    (PROC / "simulator.json").write_text(json.dumps({
        **baseline,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (REPORTS / "simulator_validation.json").write_text(
        json.dumps(val, ensure_ascii=False, indent=2), encoding="utf-8")
    if args.scenario:
        shares = json.loads(Path(args.scenario).read_text(encoding="utf-8"))
        result = scenario_seats(shares, baseline)
        print(json.dumps(result, ensure_ascii=False, indent=2)[:4000])
    print(f"[simulator] artefacto en data/processed/simulator.json")


if __name__ == "__main__":
    main()
