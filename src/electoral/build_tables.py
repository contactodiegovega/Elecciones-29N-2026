"""Construye tablas analíticas limpias (Parquet) desde los brutos auditados.

Granularidad:
- elections: 1 fila por comicio (fecha).
- territories: 1 fila por circunscripción provincial (52) + Ceuta/Melilla incluidas.
- candidacies: 1 fila por (elección, etiqueta original). NO se fusionan siglas entre elecciones.
- election_results: 1 fila por (elección, provincia, candidatura) con votos totales y escaños.
  Los votos CERA van en election_results_cera (desglose exterior, SUBCONJUNTO; no sumar).
- election_turnout: 1 fila por (elección, provincia) con censo/participación y tasas 0-100.
- population: 1 fila por (año, nivel geo, sexo) desde INE 67988 (cobertura 2021-2025).
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"
REFERENCE = ROOT / "data" / "reference"

XLSX = RAW / "Elecciones-Congreso.xlsx"
INE_CSV = RAW / "ine_67988_poblacion_provincial.csv"

AGGREGATES = [
    "Electores", "Electores CER", "Votantes", "Votos válidos",
    "Votos nulos", "Votos en blanco", "Votos a candidaturas",
    "Electores CERA", "Votantes CERA", "Votos válidos CERA",
    "Votos nulos CERA", "Votos en blanco CERA", "Votos a candidaturas CERA",
]

RE_VOTOS = re.compile(r"^Votos \((.*)\)$")
RE_ESCANOS = re.compile(r"^Escaños \((.*)\)$")
RE_VOTOS_CERA = re.compile(r"^Votos CERA \((.*)\)$")


def parse_province_col(col: str) -> tuple[str, str] | None:
    m = re.match(r"^(\d{1,2})\s*-\s*(.+)$", str(col).strip())
    if not m:
        return None
    return (m.group(1).zfill(2), m.group(2).strip())


def build_electoral() -> dict:
    df = pd.read_excel(XLSX, sheet_name="Congreso", header=3, engine="openpyxl")
    meta = list(df.columns[:4])
    prov_cols = [c for c in df.columns[4:] if parse_province_col(c)]
    prov_map = {c: parse_province_col(c) for c in prov_cols}
    print(f"[build] filas brutas={len(df)} cols_provincia={len(prov_cols)} (esperado 52)")

    df = df.rename(columns={meta[0]: "fecha", meta[1]: "codigo", meta[2]: "tipo", meta[3]: "descripcion"})
    df["fecha"] = pd.to_datetime(df["fecha"]).dt.date

    long = df[["fecha", "codigo", "tipo", "descripcion"] + prov_cols].melt(
        id_vars=["fecha", "codigo", "tipo", "descripcion"],
        value_vars=prov_cols, var_name="prov_col", value_name="valor",
    )
    long["province_code"] = long["prov_col"].map(lambda c: prov_map[c][0])
    long["province_name"] = long["prov_col"].map(lambda c: prov_map[c][1])
    long["valor"] = pd.to_numeric(long["valor"], errors="coerce")

    long["kind"] = "otro"
    long.loc[long["descripcion"].isin(AGGREGATES), "kind"] = "agregado"
    long.loc[long["descripcion"].str.match(RE_VOTOS_CERA, na=False), "kind"] = "votos_cera"
    long.loc[long["descripcion"].str.match(RE_ESCANOS, na=False), "kind"] = "escanos"
    long.loc[long["descripcion"].str.match(RE_VOTOS, na=False), "kind"] = "votos"
    # Nota: el orden importa; 'votos' se asigna después pero RE_VOTOS no casa con 'Votos CERA (...' porque exige cierre exacto... en realidad sí podría casar parcialmente;
    # reasignamos cera al final para corregir.
    long.loc[long["descripcion"].str.match(RE_VOTOS_CERA, na=False), "kind"] = "votos_cera"

    def label(s: str) -> str | None:
        for rx in (RE_VOTOS_CERA, RE_ESCANOS, RE_VOTOS):
            m = rx.match(str(s))
            if m:
                return m.group(1).strip()
        return None

    long["candidacy_raw"] = long["descripcion"].map(label)

    # --- elections ---
    elec = (long.groupby("fecha", as_index=False)
            .agg(codigo=("codigo", "first"), tipo=("tipo", "first")))
    elec["election_year"] = pd.to_datetime(elec["fecha"]).dt.year
    elec["has_cera"] = elec["fecha"].map(
        lambda f: bool(((long["fecha"] == f) & (long["kind"] == "votos_cera")).any()))
    elec["source"] = "Ministerio del Interior (Elecciones-Congreso.xlsx)"
    elec = elec.sort_values("fecha").reset_index(drop=True)

    # total escaños por elección (suma provincial de filas Escaños)
    seats_tot = (long[long["kind"] == "escanos"].groupby("fecha")["valor"].sum().round().astype("Int64"))
    elec["total_seats"] = elec["fecha"].map(seats_tot)

    # --- candidacies (por elección, sin fusionar) ---
    cand = (long[long["kind"].isin(["votos", "escanos", "votos_cera"])]
            .groupby(["fecha", "candidacy_raw", "kind"], as_index=False).size())
    cand = cand.rename(columns={"fecha": "election_date", "size": "n_province_rows"})[["election_date", "candidacy_raw", "kind", "n_province_rows"]]
    cand["election_date"] = pd.to_datetime(cand["election_date"]).dt.date

    # --- election_results (totales; CERA excluido) ---
    # REGLA DE HOMOGENEIZACIÓN EXPLÍCITA: el Excel repite la misma etiqueta para
    # variantes de coalición provinciales (p. ej. PP-2015 aparece en 45 filas, una por
    # variante provincial). Se SUMAN por (elección, provincia, etiqueta). Esto agrega
    # variantes que la fuente no distingue por etiqueta; las siglas originales se
    # conservan intactas en candidacy_raw sin fusiones entre elecciones.
    def agg_kind(kind: str, col: str) -> pd.DataFrame:
        g = (long[long["kind"] == kind]
             .groupby(["fecha", "province_code", "province_name", "candidacy_raw"],
                      as_index=False)["valor"].sum())
        return g.rename(columns={"fecha": "election_date", "valor": col})

    votos = agg_kind("votos", "votes")
    escanos = agg_kind("escanos", "seats")
    res = pd.merge(votos, escanos,
                   on=["election_date", "province_code", "province_name", "candidacy_raw"],
                   how="outer")
    res["election_date"] = pd.to_datetime(res["election_date"]).dt.date
    res["votes"] = res["votes"].astype("Int64")
    res["seats"] = res["seats"].astype("Int64")
    res = res.sort_values(["election_date", "province_code", "candidacy_raw"]).reset_index(drop=True)

    # --- election_results_cera (desglose exterior) ---
    cera = (long[long["kind"] == "votos_cera"]
            .groupby(["fecha", "province_code", "province_name", "candidacy_raw"],
                     as_index=False)["valor"].sum())
    cera = cera.rename(columns={"fecha": "election_date", "valor": "votes_cera"})
    cera["election_date"] = pd.to_datetime(cera["election_date"]).dt.date
    cera["votes_cera"] = cera["votes_cera"].astype("Int64")

    # --- election_turnout ---
    piv = (long[long["kind"] == "agregado"]
           .pivot_table(index=["fecha", "province_code", "province_name"],
                        columns="descripcion", values="valor", aggfunc="first").reset_index())
    colmap = {
        "Electores": "electores", "Electores CER": "electores_cer", "Votantes": "votantes",
        "Votos válidos": "votos_validos", "Votos nulos": "votos_nulos",
        "Votos en blanco": "votos_blancos", "Votos a candidaturas": "votos_candidaturas",
        "Electores CERA": "electores_cera", "Votantes CERA": "votantes_cera",
        "Votos válidos CERA": "votos_validos_cera", "Votos nulos CERA": "votos_nulos_cera",
        "Votos en blanco CERA": "votos_blancos_cera",
        "Votos a candidaturas CERA": "votos_candidaturas_cera",
    }
    piv = piv.rename(columns={k: v for k, v in colmap.items() if k in piv.columns})
    piv = piv.rename(columns={"fecha": "election_date"})
    piv["election_date"] = pd.to_datetime(piv["election_date"]).dt.date
    for c in colmap.values():
        if c not in piv.columns:
            piv[c] = pd.NA
        piv[c] = pd.to_numeric(piv[c], errors="coerce").astype("Int64")

    def rate(num, den):
        out = pd.to_numeric(num, errors="coerce") / pd.to_numeric(den, errors="coerce") * 100
        return out.round(2)

    piv["turnout_rate"] = rate(piv["votantes"], piv["electores"])
    piv["abstention_rate"] = (100 - pd.to_numeric(piv["turnout_rate"], errors="coerce")).round(2)
    piv["null_rate"] = rate(piv["votos_nulos"], piv["votantes"])
    piv["blank_on_valid_rate"] = rate(piv["votos_blancos"], piv["votos_validos"])
    turnout = piv.sort_values(["election_date", "province_code"]).reset_index(drop=True)

    return {"elections": elec, "candidacies": cand, "results": res,
            "results_cera": cera, "turnout": turnout, "prov_map": prov_map}


def build_population(prov_names: dict[str, str]) -> pd.DataFrame:
    df = pd.read_csv(INE_CSV, sep=";", encoding="utf-8-sig")
    df = df.rename(columns={
        "Total Nacional": "_nacional", "Comunidades y Ciudades Autónomas": "ccaa_raw",
        "Provincias": "prov_raw", "Sexo": "sexo", "Periodo": "year", "Total": "population",
    })
    df["population"] = df["population"].astype(str).str.replace(".", "", regex=False).str.replace(",", ".", regex=False)
    df["population"] = pd.to_numeric(df["population"], errors="coerce").astype("Int64")

    def code_of(raw) -> str | None:
        if pd.isna(raw):
            return None
        m = re.match(r"^(\d{1,2})\s+(.+)$", str(raw).strip())
        return m.group(1).zfill(2) if m else None

    def name_of(raw) -> str | None:
        if pd.isna(raw):
            return None
        m = re.match(r"^(\d{1,2})\s+(.+)$", str(raw).strip())
        return m.group(2).strip() if m else str(raw).strip()

    df["ccaa_code"] = df["ccaa_raw"].map(code_of)
    df["ccaa_name"] = df["ccaa_raw"].map(name_of)
    df["province_code"] = df["prov_raw"].map(code_of)
    df["province_name_ine"] = df["prov_raw"].map(name_of)

    def level(r):
        if pd.notna(r["prov_raw"]):
            return "province"
        if pd.notna(r["ccaa_raw"]):
            return "autonomous"
        return "national"

    df["geo_level"] = df.apply(level, axis=1)
    df["territory_code"] = df["province_code"].where(df["geo_level"] == "province",
                                                     df["ccaa_code"].where(df["geo_level"] == "autonomous", "ES"))
    df["territory_name"] = df["province_name_ine"].where(df["geo_level"] == "province",
                                                         df["ccaa_name"].where(df["geo_level"] == "autonomous", "España"))
    out = df[["year", "geo_level", "territory_code", "territory_name",
              "ccaa_code", "ccaa_name", "province_code", "province_name_ine",
              "sexo", "population"]].copy()
    out["source"] = "INE tabla 67988 (csv_bdsc)"
    out = out.sort_values(["year", "geo_level", "territory_code", "sexo"]).reset_index(drop=True)
    return out


def build_territories(prov_map: dict, pop: pd.DataFrame) -> pd.DataFrame:
    prov = pd.DataFrame([{"province_code": code, "province_name_interior": name}
                         for code, name in prov_map.values()]).drop_duplicates()
    cc = (pop[pop["geo_level"] == "province"][["province_code", "province_name_ine", "ccaa_code", "ccaa_name"]]
          .drop_duplicates("province_code"))
    t = prov.merge(cc, on="province_code", how="left")
    t = t.sort_values("province_code").reset_index(drop=True)
    return t


def main() -> None:
    PROCESSED.mkdir(parents=True, exist_ok=True)
    REFERENCE.mkdir(parents=True, exist_ok=True)
    e = build_electoral()
    pop = build_population({c: n for c, n in e["prov_map"].values()})
    terr = build_territories(e["prov_map"], pop)

    e["elections"].to_parquet(PROCESSED / "elections.parquet", index=False)
    terr.to_parquet(PROCESSED / "territories.parquet", index=False)
    e["candidacies"].to_parquet(PROCESSED / "candidacies.parquet", index=False)
    e["results"].to_parquet(PROCESSED / "election_results.parquet", index=False)
    e["results_cera"].to_parquet(PROCESSED / "election_results_cera.parquet", index=False)
    e["turnout"].to_parquet(PROCESSED / "election_turnout.parquet", index=False)
    pop.to_parquet(PROCESSED / "population.parquet", index=False)

    # CSV resumidos prácticos
    e["elections"].to_csv(PROCESSED / "elections.csv", index=False)
    terr.to_csv(PROCESSED / "territories.csv", index=False)
    (e["turnout"].groupby("election_date", as_index=False)
      .agg({c: "sum" for c in ["electores", "votantes", "votos_validos", "votos_nulos",
                               "votos_blancos", "votos_candidaturas"]})
      .to_csv(PROCESSED / "turnout_national.csv", index=False))

    coverage = {
        "elections_n": len(e["elections"]),
        "election_dates": [str(d) for d in e["elections"]["fecha" if "fecha" in e["elections"].columns else "election_date" if "election_date" in e["elections"].columns else e["elections"].columns[0]]],
        "provinces_n": len(terr),
        "results_rows": len(e["results"]),
        "results_cera_rows": len(e["results_cera"]),
        "turnout_rows": len(e["turnout"]),
        "population_rows": len(pop),
        "population_years": sorted(map(int, pop["year"].unique().tolist())),
        "granularity": {
            "elections": "1 fila por comicio (fecha)",
            "territories": "1 fila por circunscripción (52)",
            "candidacies": "1 fila por (elección, etiqueta original); sin fusiones entre elecciones",
            "election_results": "1 fila por (elección, provincia, candidatura); votos totales + escaños; CERA excluido",
            "election_results_cera": "desglose exterior, subconjunto de totales; NO sumar con election_results",
            "election_turnout": "1 fila por (elección, provincia); tasas en % 0-100",
            "population": "1 fila por (año, nivel geo, sexo); cobertura INE 67988: 2021-2025",
        },
    }
    with open(PROCESSED / "coverage.json", "w", encoding="utf-8") as f:
        json.dump(coverage, f, ensure_ascii=False, indent=2)
    print("[build] OK:", {k: v for k, v in coverage.items() if not isinstance(v, (list, dict))})
    print("[build] elecciones:", coverage["election_dates"])
    print("[build] población años:", coverage["population_years"])


if __name__ == "__main__":
    main()
