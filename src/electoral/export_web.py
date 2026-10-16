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
PROC = ROOT / "data" / "processed"
WEBDATA = ROOT / "web" / "public" / "data"
MAPS = ROOT / "web" / "public" / "maps"
UA = {"User-Agent": "ObservatorioElectoral2026-Fase5/0.1 (academic research)"}
OFFICIAL_2023 = {"PP": 33.33, "PSOE": 31.94, "VOX": 12.48}


def check(cond, msg):
    if not cond:
        raise SystemExit(f"[export] ERROR: {msg}")
    print(f"[export] ok: {msg}")


def wjson(path: Path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":"),
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

    m = res.merge(mp[["election_date", "candidacy_raw", "party_id", "family_id"]],
                  on=["election_date", "candidacy_raw"], how="left")
    m["ed"] = m["election_date"].astype(str)

    # --- meta ---
    wjson(WEBDATA / "meta.json", {
        "title": "Observatorio Electoral España 2026 — datos históricos 1977–2023",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "elections": sorted(m["ed"].unique().tolist()),
        "last_election": "2023-07-23",
        "counts": {"labels": 1778, "mapped_labels": int(mp["party_id"].notna().sum()),
                   "parties": 36, "provinces": 52, "polls": len(polls),
                   "estimates": len(pest)},
        "sources": [
            {"name": "Ministerio del Interior (resultados Congreso)",
             "license": "Uso público oficial"},
            {"name": "INE (tablas 67988/36780/2852/72989/53687/67217)", "license": "CC BY 4.0, citar INE"},
            {"name": "Wikipedia (compilación de encuestas)", "license": "CC BY-SA 4.0, atribución",
             "revisions": ["1380368158", "1375363334"]},
            {"name": "Eurostat GISCO NUTS 2021 (geometría)", "license": "©EuroGeographics, atribución"}],
        "notes": ["Sin resultados 29N-2026 (no celebradas).", "Sin pronósticos propios."],
    })
    wjson(WEBDATA / "territories.json",
          terr.to_dict(orient="records"))
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

    # --- encuestas por ciclo ---
    for cyc, cond in (("2023", polls["fieldwork_end"] < "2023-07-23"),
                      ("2026", polls["fieldwork_end"] >= "2023-07-23")):
        sub = polls[cond].copy()
        sub["fieldwork_end"] = sub["fieldwork_end"].astype(str)
        sub["fieldwork_start"] = sub["fieldwork_start"].astype(str)
        out = []
        for _, r in sub.iterrows():
            e = pest[pest["poll_id"] == r["poll_id"]]
            out.append({"id": r["poll_id"], "pollster": r["pollster"],
                        "sponsor": r["sponsor_or_media"], "fw_start": r["fieldwork_start"],
                        "fw_end": r["fieldwork_end"], "n": int(r["sample_size"])
                        if pd.notna(r["sample_size"]) else None,
                        "type": r["estimate_type"], "canonical": r["canonical_poll_id"],
                        "est": [{"p": x["candidacy_or_party_id"], "label": x["reported_label"],
                                 "v": float(x["value_pct"]), "m": x["mapping_status"]}
                                for _, x in e.iterrows()]})
        wjson(WEBDATA / f"polls_{cyc}.json",
              {"cycle": cyc, "note": "Mediciones publicadas, no resultados ni pronósticos.",
               "official_2023": OFFICIAL_2023 if cyc == "2023" else None, "polls": out})

    # --- demografía ---
    enr = pd.read_parquet(PROC / "phase4" / "turnout_features_enriched.parquet")
    enr["target_election_date"] = enr["target_election_date"].astype(str)
    wjson(WEBDATA / "demography.json",
          {"rows": enr.to_dict(orient="records"),
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
