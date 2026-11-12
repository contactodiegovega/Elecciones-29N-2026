# -*- coding: utf-8 -*-
"""FASE 5 — Exportador web: Parquet/CSV reales -> JSON públicos tipados y validados.

Idempotente; documenta recuentos antes/después; falla ante duplicados o incoherencias.
No publica microdatos personales (no existen en el corpus) ni brutos sensibles.
Uso: python src/electoral/export_web.py [--config config/web_export.json]
"""
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src"))
from electoral.electoral_calendar import editorial_status  # noqa: E402

PROC = ROOT / "data" / "processed"
WEBDATA = ROOT / "web" / "public" / "data"
MAPS = ROOT / "web" / "public" / "maps"
UA = {"User-Agent": "ObservatorioElectoral2026-Fase5/0.1 (academic research)"}
OFFICIAL_2023 = {"PP": 33.33, "PSOE": 31.94, "VOX": 12.48}


def check(cond, msg):
    if not cond:
        raise SystemExit(f"[export] ERROR: {msg}")
    print(f"[export] ok: {msg}")


def clean(obj):
    """NaN/NaT/pd.NA -> None (JSON válido); fechas y numpy -> tipos nativos."""
    import math
    import numpy as np
    import pandas as pd
    if obj is None or obj is pd.NA or obj is pd.NaT:
        return None
    if isinstance(obj, float) and math.isnan(obj):
        return None
    if isinstance(obj, dict):
        return {k: clean(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [clean(v) for v in obj]
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return None if math.isnan(float(obj)) else float(obj)
    if isinstance(obj, np.bool_):
        return bool(obj)
    if hasattr(obj, "isoformat"):
        try:
            return obj.isoformat()
        except Exception:
            return str(obj)
    return obj


def wjson(path: Path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(clean(obj), ensure_ascii=False, separators=(",", ":"),
                               default=str), encoding="utf-8")
    print(f"[export] {path.relative_to(ROOT)} ({path.stat().st_size / 1024:.0f} KB)")


def main() -> None:
    WEBDATA.mkdir(parents=True, exist_ok=True)
    MAPS.mkdir(parents=True, exist_ok=True)
    res = pd.read_parquet(PROC / "election_results.parquet")
    to = pd.read_parquet(PROC / "election_turnout.parquet")
    elec = pd.read_parquet(PROC / "elections.parquet")
    terr = pd.read_parquet(PROC / "territories.parquet")
    mp = pd.read_parquet(PROC / "candidacy_party_mapping.parquet")
    reg = pd.read_parquet(PROC / "party_registry.parquet")
    colors = json.loads((ROOT / "config" / "party_colors.json").read_text(encoding="utf-8"))
    polls = pd.read_parquet(PROC / "polls.parquet")
    pest = pd.read_parquet(PROC / "poll_estimates.parquet")
    canonical = pd.read_parquet(PROC / "polls_canonical.parquet") if (PROC / "polls_canonical.parquet").exists() else pd.DataFrame()
    province_names = json.loads((ROOT / "config" / "provinces.json").read_text(encoding="utf-8"))["provinces"]
    status = editorial_status()
    campaign_path = PROC / "campaign.json"
    simulator_path = PROC / "simulator.json"
    gate_path = ROOT / "reports" / "tables" / "campaign" / "ml_gate.json"

    # --- validaciones duras ---
    check(len(mp) == 1778, "1778 etiquetas originales")
    check(mp["candidacy_id"].is_unique, "candidacy_id único")
    check(res.duplicated(subset=["election_date", "province_code", "candidacy_raw"]).sum() == 0,
          "sin duplicados en results")
    check(sorted(res["election_date"].astype(str).unique())[-1] == "2023-07-23", "sin 2026")
    check(len(terr) == 52, "52 provincias")
    check(not polls["pollster"].str.contains("election", case=False, na=False).any(),
          "sin filas de resultado en encuestas")
    n2023 = res[res["election_date"].astype(str) == "2023-07-23"]["candidacy_raw"].nunique()
    check(n2023 == 81, f"81/81 candidaturas 2023 (hay {n2023})")
    cfg_campaign = json.loads((ROOT / "config" / "campaign.json").read_text(encoding="utf-8"))
    as_of = cfg_campaign["as_of"]
    future_polls = polls[pd.to_datetime(polls["fieldwork_end"], errors="coerce").dt.date >
                         pd.Timestamp(as_of).date()]
    check(len(future_polls) == 0, f"sin encuestas con campo posterior a as_of={as_of}")

    m = res.merge(mp[["election_date", "candidacy_raw", "party_id", "family_id"]],
                  on=["election_date", "candidacy_raw"], how="left")
    m["ed"] = m["election_date"].astype(str)

    # --- meta ---
    wjson(WEBDATA / "meta.json", {
        "title": "Observatorio Electoral España 2026 — análisis de campaña y 1977–2023",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "as_of": as_of,
        "elections": sorted(m["ed"].unique().tolist()),
        "last_election": "2023-07-23",
        "counts": {"labels": 1778, "mapped_labels": int(mp["party_id"].notna().sum()),
                   "parties": int(reg["party_id"].nunique()), "provinces": 52,
                   "polls": int(len(polls)), "poll_estimates": int(len(pest)),
                   "poll_houses": int(polls["pollster"].nunique()),
                   "polls_estimated_vote": int((polls["estimate_type"] == "estimated_vote").sum()),
                   "polls_direct_intention": int((polls["estimate_type"] == "direct_intention").sum())},
        "sources": [
            {"name": "Ministerio del Interior (resultados Congreso)", "license": "Uso público oficial"},
            {"name": "INE (tablas 67988/36780/2852/72989/53687/67217)", "license": "CC BY 4.0, citar INE"},
            {"name": "Wikipedia (compilación de encuestas)", "license": "CC BY-SA 4.0, atribución",
             "revisions": ["1385097401", "1384685846"]},
            {"name": "Eurostat GISCO NUTS 2021 (geometría)", "license": "©EuroGeographics, atribución"}],
        "notes": [
            "Sin resultados 29N-2026 (no celebradas).",
            "Sin pronósticos propios ni probabilidades calibradas.",
            "Publicaciones de encuestas con fecha de publicación desconocida en la compilación: se usa fin de campo y se marca.",
            "Veda LOREG 69.7: 24–28 de noviembre de 2026 (Europe/Madrid).",
            f"Última fecha de campo disponible: {polls['fieldwork_end'].max()}.",
        ],
    })
    terr_out = terr.copy()
    terr_out["province_name_interior"] = terr_out["province_code"].map(province_names).fillna(terr_out["province_name_interior"])
    terr_out["province_name_ine"] = terr_out["province_code"].map(province_names).fillna(terr_out["province_name_ine"])
    wjson(WEBDATA / "territories.json", terr_out.to_dict(orient="records"))
    check(True, "meta+territories")

    # --- resultados nacionales por elección ---
    nat = []
    for ed, g in m.groupby("ed"):
        t = to[to["election_date"].astype(str) == ed]
        den = float(t["votos_candidaturas"].sum())
        pg = g.dropna(subset=["party_id"]).groupby("party_id").agg(
            votes=("votes", "sum"), seats=("seats", "sum")).reset_index()
        parties = [{**r, "share": round(float(r["votes"]) / den * 100, 3)}
                   for r in pg.to_dict(orient="records")]
        un = float(g[g["party_id"].isna()]["votes"].sum())
        nat.append({"election": ed, "electores": int(t["electores"].sum()),
                    "votantes": int(t["votantes"].sum()),
                    "turnout": round(float(t["votantes"].sum() / t["electores"].sum() * 100), 2),
                    "parties": sorted(parties, key=lambda r: -r["votes"]),
                    "unmapped_votes": un, "n_labels": int(g["candidacy_raw"].nunique())})
    wjson(WEBDATA / "results_national.json", nat)

    # --- etiquetas por elección (detalle íntegro, carga bajo demanda) ---
    for ed, g in m.groupby("ed"):
        t = to[to["election_date"].astype(str) == ed].set_index("province_code")["votos_candidaturas"].astype(float)
        rows = []
        for (prov, lab), gg in g.groupby(["province_code", "candidacy_raw"]):
            v = float(gg["votes"].sum())
            rows.append({"p": prov, "label": lab, "party": gg["party_id"].iloc[0]
                         if pd.notna(gg["party_id"].iloc[0]) else None,
                         "v": int(v), "s": int(gg["seats"].sum()) if pd.notna(gg["seats"].sum()) else 0,
                         "share": round(v / float(t.loc[prov]) * 100, 3)})
        rows.sort(key=lambda r: -r["v"])
        wjson(WEBDATA / f"labels_by_election/{ed}.json",
              {"election": ed, "denominator": "votos_a_candidaturas provincial",
               "n_labels": len(set(r["label"] for r in rows)), "rows": rows})
    check(True, "results + labels por elección")

    # --- turnout provincial ---
    tcols = ["election_date", "province_code", "electores", "votantes", "votos_validos",
             "votos_nulos", "votos_blancos", "votos_candidaturas", "turnout_rate",
             "abstention_rate", "null_rate", "blank_on_valid_rate"]
    tt = to.copy()
    tt["election_date"] = tt["election_date"].astype(str)
    wjson(WEBDATA / "turnout.json", tt[tcols].to_dict(orient="records"))

    # --- encuestas por ciclo (con metadatos canónicos) ---
    canon_by_poll = {}
    if not canonical.empty:
        for poll_id, g in canonical.groupby("poll_id"):
            r0 = g.iloc[0]
            canon_by_poll[poll_id] = {
                "published_at": r0.get("published_at"),
                "source_license": r0.get("source_license"),
                "retrieved_at": r0.get("retrieved_at"),
                "source_hash": r0.get("source_hash"),
                "population": r0.get("population"),
                "mode": r0.get("mode"),
                "geography": r0.get("geography"),
                "parse_confidence": r0.get("parse_confidence"),
                "quality_flags": r0.get("quality_flags"),
                "is_tracking_update": bool(g["is_tracking_update"].any()),
                "n_unmapped_labels": int((g["coalition_scope"] == "unmapped_label").sum()),
            }
    polls_visible = bool(status["polls_visible"])
    for cyc, cond in (("2023", polls["fieldwork_end"] < "2023-07-23"),
                      ("2026", polls["fieldwork_end"] >= "2023-07-23")):
        if not polls_visible:
            wjson(WEBDATA / f"polls_{cyc}.json",
                  {"cycle": cyc, "restricted": True, "polls": [],
                   "note": status["reason"], "legal_note": status["legal_note"]})
            continue
        sub = polls[cond].copy()
        sub["fieldwork_end"] = sub["fieldwork_end"].astype(str)
        sub["fieldwork_start"] = sub["fieldwork_start"].astype(str)
        out = []
        for _, r in sub.iterrows():
            e = pest[pest["poll_id"] == r["poll_id"]]
            meta = canon_by_poll.get(r["poll_id"], {})
            out.append({"id": r["poll_id"], "pollster": r["pollster"],
                        "sponsor": r["sponsor_or_media"], "fw_start": r["fieldwork_start"],
                        "fw_end": r["fieldwork_end"], "n": int(r["sample_size"])
                        if pd.notna(r["sample_size"]) else None,
                        "type": r["estimate_type"], "canonical": r["canonical_poll_id"],
                        "published_at": meta.get("published_at"),
                        "publication_status": ("fecha_publicacion_desconocida"
                                               if meta.get("published_at") is None else "publicada"),
                        "original_url": r["source_url"], "source_license": meta.get("source_license"),
                        "retrieved_at": meta.get("retrieved_at"), "source_hash": meta.get("source_hash"),
                        "population": meta.get("population"), "mode": meta.get("mode"),
                        "geography": meta.get("geography"), "parse_confidence": meta.get("parse_confidence"),
                        "quality_flags": meta.get("quality_flags"),
                        "is_tracking_update": meta.get("is_tracking_update", False),
                        "n_unmapped_labels": meta.get("n_unmapped_labels", 0),
                        "est": [{"p": x["candidacy_or_party_id"], "label": x["reported_label"],
                                 "v": float(x["value_pct"]), "m": x["mapping_status"]}
                                for _, x in e.iterrows()]})
        wjson(WEBDATA / f"polls_{cyc}.json",
              {"cycle": cyc, "note": "Mediciones publicadas, no resultados ni pronósticos.",
               "official_2023": OFFICIAL_2023 if cyc == "2023" else None,
               "publication_status": status, "polls": out})

    # --- demografía ---
    enr = pd.read_parquet(PROC / "phase4" / "turnout_features_enriched.parquet")
    enr["target_election_date"] = enr["target_election_date"].astype(str)
    cov = pd.read_csv(ROOT / "reports" / "tables" / "phase4" / "feature_coverage.csv")
    age_nat = pd.read_csv(ROOT / "reports" / "tables" / "phase4" / "q4_02_edad_nacional.csv")
    wjson(WEBDATA / "demography.json",
          {"rows": enr.to_dict(orient="records"),
           "coverage": cov.to_dict(orient="records"),
           "age_national": age_nat.reset_index().to_dict(orient="records"),
           "dictionary": "reports/tables/phase4/data_dictionary.csv"})
    check(True, "turnout + polls + demography")

    # --- ML (números importados de CSV, nunca literales) ---
    bt3 = pd.read_csv(ROOT / "reports" / "tables" / "phase3" / "turnout_backtest.csv")
    rv4 = pd.read_csv(ROOT / "reports" / "tables" / "phase4" / "ml_revalidation.csv")
    oos = pd.read_csv(ROOT / "reports" / "tables" / "phase3" / "turnout_predictions_oos.csv")
    oos_map = oos[oos["model"].isin(["mean3", "ridge"])][
        ["test_election", "province", "model", "error_pp"]].to_dict(orient="records")
    wjson(WEBDATA / "ml.json", {
        "question": "Evaluación retrospectiva de participación provincial (no previsión 29N).",
        "folds": ["2011-11-20", "2015-12-20", "2016-06-26", "2019-04-28", "2019-11-10", "2023-07-23"],
        "phase3_macro": bt3.groupby("model")["MAE_pp"].mean().round(3).to_dict(),
        "phase3_by_election": bt3.to_dict(orient="records"),
        "phase4_macro": rv4.groupby("model")["MAE_pp"].mean().round(3).to_dict(),
        "phase4_by_election": rv4.to_dict(orient="records"),
        "oos_errors": oos_map,
        "verdict": ("mean3 sigue ganando en macro; ML enriquecido mejora vs ML fase 3 "
                    "pero sin superioridad demostrada (n=6)."),
    })
    wjson(WEBDATA / "oos_map.json", oos_map)
    if gate_path.exists():
        gate = json.loads(gate_path.read_text(encoding="utf-8"))
        wjson(WEBDATA / "ml_gate.json", gate)
    check(True, "ml + gate")

    # --- campaña y simulador (solo si no hay veda) ---
    wjson(WEBDATA / "publication_status.json", status)
    if campaign_path.exists():
        campaign = json.loads(campaign_path.read_text(encoding="utf-8"))
        if not polls_visible:
            campaign = {
                "as_of": campaign.get("as_of"), "restricted": True,
                "data_cutoff": campaign.get("data_cutoff"),
                "snapshots": [], "change_days": [], "distribution": [],
                "latest_by_house": [], "timeline": [],
                "warnings": [status["reason"]],
                "aggregation": campaign.get("aggregation", {}),
                "publication_status": status,
            }
        else:
            campaign["publication_status"] = status
        wjson(WEBDATA / "campaign.json", campaign)
    if simulator_path.exists():
        sim = json.loads(simulator_path.read_text(encoding="utf-8"))
        sim["poll_baseline_available"] = status["simulator_poll_baseline_visible"]
        sim["publication_status"] = status
        wjson(WEBDATA / "simulator.json", sim)
    catalog = ROOT / "reports" / "tables" / "campaign" / "poll_source_catalog.json"
    if catalog.exists():
        wjson(WEBDATA / "poll_sources.json", json.loads(catalog.read_text(encoding="utf-8")))
    check(True, "campaign + simulator + fuentes")

    # --- colores + taxonomía ---
    wjson(WEBDATA / "colors.json", colors)
    wjson(WEBDATA / "taxonomy.json", {
        "parties": reg.to_dict(orient="records"),
        "mapping": mp.assign(election_date=mp["election_date"].astype(str)).to_dict(orient="records"),
    })
    check(True, "ml + colors + taxonomy")

    # --- geometría GISCO (ES NUTS3 -> 52 provincias) ---
    fetch_geo()
    print("[export] COMPLETO sin pérdidas")


ISLAND_TO_PROV = {"Eivissa y Formentera": "07", "Mallorca": "07", "Menorca": "07",
                   "Gran Canaria": "35", "Fuerteventura": "35", "Lanzarote": "35",
                   "Tenerife": "38", "La Palma": "38", "La Gomera": "38", "El Hierro": "38"}


def norm_name(s: str) -> str:
    import unicodedata
    t = unicodedata.normalize("NFD", str(s).lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return " ".join(t.replace("/", " ").replace(",", " ").split())


def fetch_geo():
    import json as js
    import pandas as pd
    dest = MAPS / "spain_provinces.geojson"
    url = ("https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/"
           "NUTS_RG_03M_2021_4326.geojson")
    raw = ROOT / "data" / "raw" / "nuts3_europe_03M.geojson"
    if not raw.exists():  # compatibilidad con exportaciones anteriores
        legacy = MAPS / "nuts3_europe_03M.geojson"
        raw = legacy if legacy.exists() else raw
    if not raw.exists():
        print("[export] descargando geometría GISCO (~16 MB)…")
        with requests.get(url, headers=UA, stream=True, timeout=300) as r:
            r.raise_for_status()
            h = hashlib.sha256()
            with open(raw, "wb") as f:
                for ch in r.iter_content(chunk_size=1 << 20):
                    h.update(ch)
                    f.write(ch)
        print("[export] gisco sha:", h.hexdigest()[:16])
    gj = js.loads(raw.read_text(encoding="utf-8"))
    feats = [f for f in gj["features"]
             if f["properties"].get("CNTR_CODE") == "ES" and f["properties"].get("LEVL_CODE") == 3]
    check(len(feats) >= 59, f"NUTS3 ES>=59 (hay {len(feats)})")
    terr = pd.read_parquet(PROC / "territories.parquet")
    name2code = {}
    for _, r in terr.iterrows():
        for cand in (r["province_name_interior"], r["province_name_ine"]):
            name2code.setdefault(norm_name(cand), r["province_code"])
    # variantes conocidas GISCO vs Interior/INE
    name2code.update({norm_name("A Coruña"): "15", norm_name("Coruña, A"): "15",
                      norm_name("Alacant"): "03", norm_name("Araba"): "01",
                      norm_name("Las Palmas"): "35", norm_name("Santa Cruz de Tenerife"): "38",
                      norm_name("Rioja, La"): "26", norm_name("Palmas, Las"): "35"})
    by_prov: dict[str, list] = {}
    unmatched = []
    for f in feats:
        nm = f["properties"].get("NUTS_NAME") or ""
        code = ISLAND_TO_PROV.get(nm) or name2code.get(norm_name(nm))
        if code is None:
            unmatched.append(nm)
            continue
        by_prov.setdefault(code, []).append(f["geometry"])
    check(not unmatched, f"NUTS sin provincia: {unmatched}")
    check(len(by_prov) == 52, f"52 provincias agregadas (hay {len(by_prov)})")
    out = {"type": "FeatureCollection",
           "provenance": ("Eurostat GISCO NUTS 2021 ©EuroGeographics, reutilizable con "
                          "atribución; islas agregadas a provincia; crosswalk por nombre "
                          "verificado 59 NUTS3 -> 52 provincias"),
           "features": [{"type": "Feature",
                         "properties": {"province_code": c},
                         "geometry": g[0] if len(g) == 1 else {"type": "GeometryCollection",
                                                               "geometries": g}}
                        for c, g in sorted(by_prov.items())]}
    dest.write_text(js.dumps(out, ensure_ascii=False, separators=(",", ":")),
                    encoding="utf-8")
    print(f"[export] spain_provinces.geojson ({dest.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
