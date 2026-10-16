# -*- coding: utf-8 -*-
"""FASE 4 — Enriquecimiento demográfico/económico con integridad temporal.

Entradas: data/raw/ine_*.csv (fase 4) + tablas fase 1-3.
Salidas: data/processed/phase4/*.parquet + reports/tables/phase4/feature_coverage.csv.
"""
import hashlib
import re
import sys
from datetime import date
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from temporal_join import vintage_adrh, vintage_epa, vintage_padron  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
PROC = ROOT / "data" / "processed"
P4 = PROC / "phase4"
TAB4 = ROOT / "reports" / "tables" / "phase4"
P4.mkdir(parents=True, exist_ok=True)
TAB4.mkdir(parents=True, exist_ok=True)

ELECTIONS = [date(1977, 6, 15), date(1979, 3, 1), date(1982, 10, 28), date(1986, 6, 22),
             date(1989, 10, 29), date(1993, 6, 6), date(1996, 3, 3), date(2000, 3, 12),
             date(2004, 3, 14), date(2008, 3, 9), date(2011, 11, 20), date(2015, 12, 20),
             date(2016, 6, 26), date(2019, 4, 28), date(2019, 11, 10), date(2023, 7, 23)]

BANDS = [(0, 17, "00-17"), (18, 29, "18-29"), (30, 44, "30-44"),
         (45, 64, "45-64"), (65, 200, "65+")]


def sha_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for ch in iter(lambda: f.read(1 << 20), b""):
            h.update(ch)
    return h.hexdigest()


def num_es(s) -> float | None:
    """'1.001.062' -> 1001062 ; '60,6' -> 60.6 ; '..'/'' -> None."""
    if s is None:
        return None
    t = str(s).strip()
    if t in ("", "..", "...", "-", "nan", "None"):
        return None
    t = t.replace(".", "").replace(",", ".")
    try:
        return float(t)
    except ValueError:
        return None


def prov_code(raw) -> str | None:
    if pd.isna(raw):
        return None
    m = re.match(r"^\s*(\d{1,2})\s+", str(raw))
    return m.group(1).zfill(2) if m else None


def age_int(label) -> int | None:
    m = re.match(r"^\s*(\d+)", str(label))
    return int(m.group(1)) if m else None


def band_of(a: int | None) -> str | None:
    if a is None:
        return None
    for lo, hi, name in BANDS:
        if lo <= a <= hi:
            return name
    return None


def build_padron():
    """36780: bandas de edad + nacionalidad por provincia y 1-ene (2003-2022)."""
    rows = []
    for ch in pd.read_csv(RAW / "ine_36780_padron_edad.csv", sep=";", encoding="utf-8-sig",
                          usecols=["Provincias", "Españoles/Extranjeros", "Edad (año a año)",
                                   "Sexo", "Periodo", "Total"], chunksize=500000,
                          dtype=str, keep_default_na=False):
        ch = ch[(ch["Sexo"] == "Total")]
        ch["province_code"] = ch["Provincias"].map(prov_code)
        ch = ch[ch["province_code"].notna()]
        ch["year"] = ch["Periodo"].str.extract(r"(\d{4})").astype(int)
        ch["age"] = ch["Edad (año a año)"].map(age_int)
        ch["band"] = ch["Edad (año a año)"].apply(
            lambda s: "all" if str(s).startswith("Todas") else band_of(age_int(s)))
        ch["pop"] = ch["Total"].map(num_es)
        rows.append(ch[["year", "province_code", "Españoles/Extranjeros", "band", "pop"]])
    df = pd.concat(rows, ignore_index=True)
    df = df.rename(columns={"Españoles/Extranjeros": "nac"})
    df.to_parquet(P4 / "padron_age.parquet", index=False)
    print("[enrich] padron_age:", df.shape, df["year"].min(), "->", df["year"].max())
    return df


def build_pop2852():
    df = pd.read_csv(RAW / "ine_2852_pob_total.csv", sep=";", encoding="utf-8-sig", dtype=str)
    df = df[df["Sexo"] == "Total"]
    df["province_code"] = df["Provincias"].map(prov_code)
    df = df[df["province_code"].notna()]
    df["year"] = df["Periodo"].astype(int)
    df["pop"] = df["Total"].map(num_es)
    out = df[["year", "province_code", "pop"]].copy()
    out.to_parquet(P4 / "pop_total_2852.parquet", index=False)
    print("[enrich] pop2852:", out.shape, out["year"].min(), "->", out["year"].max())
    return out


def build_epa():
    df = pd.read_csv(RAW / "ine_72989_epa_tasas.csv", sep=";", encoding="utf-8-sig", dtype=str)
    df = df[df["Sexo"] == "Ambos sexos"]
    df["province_code"] = df["Provincias"].map(prov_code)
    df = df[df["province_code"].notna()]
    df["val"] = df["Total"].map(num_es)
    piv = df.pivot_table(index=["Periodo", "province_code"], columns="Tasas",
                         values="val", aggfunc="first").reset_index()
    ren = {"Tasa de actividad": "activity_rate", "Tasa de empleo de la población": "employment_rate",
           "Tasa de paro de la población": "unemployment_rate"}
    piv = piv.rename(columns={k: v for k, v in ren.items() if k in piv.columns})
    piv = piv.rename(columns={"Periodo": "quarter"})
    piv.to_parquet(P4 / "epa_quarterly.parquet", index=False)
    print("[enrich] epa:", piv.shape, piv["quarter"].min(), "->", piv["quarter"].max())
    return piv


def build_adrh(terr: pd.DataFrame):
    df = pd.read_csv(RAW / "ine_53687_renta_adrh.csv", sep=";", encoding="utf-8-sig", dtype=str)
    df = df[df["Provincias"].notna() & (df["Provincias"] != "")]
    # crosswalk por nombre normalizado -> código (verificado 1:1 abajo)
    norm = lambda s: re.sub(r"\s+", " ", str(s).lower().replace("á", "a").replace("é", "e")
                            .replace("í", "i").replace("ó", "o").replace("ú", "u")).strip()
    name2code = {}
    for _, r in terr.iterrows():
        for cand in (r["province_name_interior"], r["province_name_ine"]):
            name2code.setdefault(norm(cand), r["province_code"])
    extra = {"palmas, las": "35", "santa cruz de tenerife": "38", "coruña, a": "15",
             "rioja, la": "26", "alicante/alacant": "03", "castellón/castelló": "12",
             "valencia/valéncia": "46", "balears, illes": "07", "araba/álava": "01",
             "avila": "05", "caceres": "10", "cadiz": "11", "cordoba": "14",
             "leon": "24", "malaga": "29", "almeria": "04"}
    name2code.update(extra)
    df["province_code"] = df["Provincias"].map(lambda s: name2code.get(norm(s)))
    unmatched = sorted(df[df["province_code"].isna()]["Provincias"].unique())
    assert not unmatched, f"provincias ADRH sin código: {unmatched}"
    df["val"] = df["Total"].map(num_es)
    piv = df.pivot_table(index=["Periodo", "province_code"],
                         columns="Distribución por fuente de ingresos",
                         values="val", aggfunc="first").reset_index()
    ren = {"Fuente de ingreso: salario": "adrh_wages", "Fuente de ingreso: pensiones": "adrh_pensions",
           "Fuente de ingreso: prestaciones por desempleo": "adrh_unemp_benefits",
           "Fuente de ingreso: otras prestaciones": "adrh_other_benefits",
           "Fuente de ingreso: otros ingresos": "adrh_other_income"}
    piv = piv.rename(columns={k: v for k, v in ren.items() if k in piv.columns})
    piv = piv.rename(columns={"Periodo": "year"})
    piv["year"] = piv["year"].astype(int)
    piv.to_parquet(P4 / "adrh_annual.parquet", index=False)
    print("[enrich] adrh:", piv.shape, piv["year"].min(), "->", piv["year"].max(),
          "| provincias:", piv["province_code"].nunique())
    return piv


def build_censo67217():
    rows = []
    for ch in pd.read_csv(RAW / "ine_67217_censo_edad.csv", sep=";", encoding="utf-8-sig",
                          usecols=["Provincias", "Sexo", "Edad", "Periodo", "Total"],
                          chunksize=200000, dtype=str, keep_default_na=False):
        ch = ch[(ch["Sexo"] == "Total")]
        ch["province_code"] = ch["Provincias"].map(prov_code)
        ch = ch[ch["province_code"].notna()]
        ch["year"] = ch["Periodo"].astype(int)
        ch["band"] = ch["Edad"].apply(
            lambda s: "all" if str(s).startswith("Todas") else band_of(age_int(s)))
        ch["pop"] = ch["Total"].map(num_es)
        rows.append(ch[["year", "province_code", "band", "pop"]])
    df = pd.concat(rows, ignore_index=True)
    df.to_parquet(P4 / "censo_age.parquet", index=False)
    print("[enrich] censo67217:", df.shape, df["year"].min(), "->", df["year"].max())
    return df


def build_enriched_turnout(padron, pop2852, epa, adrh):
    base = pd.read_parquet(PROC / "turnout_features.parquet")
    base["target_date"] = pd.to_datetime(base["target_election_date"]).dt.date
    # agregados padrón por (año, provincia): bandas + nacionalidad (denominador = suma bandas)
    pa = padron[padron["band"].notna() & (padron["band"] != "all")].copy()
    band = pa[pa["nac"] == "Total"].groupby(["year", "province_code", "band"])["pop"].sum().unstack(fill_value=0)
    tot = band.sum(axis=1)
    nac = pa.groupby(["year", "province_code", "nac"])["pop"].sum().unstack(fill_value=0)
    p2852 = pop2852.set_index(["year", "province_code"])["pop"]
    p2852_years = sorted(pop2852["year"].unique().tolist())
    epa_idx = epa.set_index(["quarter", "province_code"])
    adrh_idx = adrh.set_index(["year", "province_code"])

    new_cols = ["share_18_29", "share_30_44", "share_45_64", "share_65plus", "share_foreign",
                "pop_growth_yoy", "pop_total_2852", "unemployment_rate", "activity_rate",
                "employment_rate", "adrh_wages", "adrh_pensions", "adrh_unemp_benefits",
                "adrh_other_benefits", "adrh_other_income"]
    vint = []
    for c in new_cols:
        base[c] = float("nan")
    base["vintage_ref"] = ""
    base["vintage_status"] = ""
    for i, r in base.iterrows():
        ed = r["target_date"]
        prov = r["province_code"]
        y_p, note_p, st_p = vintage_padron(ed)
        q_e, note_e, st_e = vintage_epa(ed)
        y_a, note_a, st_a = vintage_adrh(ed)
        try:
            T = float(tot.loc[(y_p, prov)])
            if T > 0:
                row_b = band.loc[(y_p, prov)]
                for col, b in [("share_18_29", "18-29"), ("share_30_44", "30-44"),
                               ("share_45_64", "45-64"), ("share_65plus", "65+")]:
                    base.at[i, col] = round(float(row_b.get(b, 0)) / T * 100, 2)
                base.at[i, "share_foreign"] = round(float(nac.loc[(y_p, prov)].get("Extranjera", 0)) / T * 100, 2)
                if (y_p - 1, prov) in tot.index:
                    Tprev = float(tot.loc[(y_p - 1, prov)])
                    if Tprev > 0:
                        base.at[i, "pop_growth_yoy"] = round((T - Tprev) / Tprev * 100, 2)
        except KeyError:
            pass
        # 2852 termina en 2021: último año disponible <= vintage (documentado; p. ej.
        # vintage 2022 -> 2021). Sigue siendo anterior a la elección: sin fuga.
        y2852 = max([y for y in p2852_years if y <= y_p], default=None)
        if y2852 is not None:
            try:
                base.at[i, "pop_total_2852"] = float(p2852.loc[(y2852, prov)])
            except KeyError:
                pass
        try:
            row = epa_idx.loc[(q_e, prov)]
            for col, src in [("unemployment_rate", "unemployment_rate"),
                             ("activity_rate", "activity_rate"),
                             ("employment_rate", "employment_rate")]:
                v = row.get(src)
                base.at[i, col] = round(float(v), 2) if pd.notna(v) else float("nan")
        except KeyError:
            pass
        if y_a in set(adrh["year"].unique()):
            try:
                row = adrh_idx.loc[(y_a, prov)]
                for col in ["adrh_wages", "adrh_pensions", "adrh_unemp_benefits",
                            "adrh_other_benefits", "adrh_other_income"]:
                    v = row.get(col)
                    base.at[i, col] = round(float(v), 2) if pd.notna(v) else float("nan")
            except KeyError:
                pass
        base.at[i, "vintage_ref"] = f"padron:{y_p}|epa:{q_e}|adrh:{y_a}"
        base.at[i, "vintage_status"] = f"{st_p}/{st_e}/{st_a}"
    base = base.drop(columns=["target_date"])
    base.to_parquet(P4 / "turnout_features_enriched.parquet", index=False)

    cov = []
    for ed, g in base.groupby("target_election_date"):
        row = {"target_election_date": ed, "n": len(g)}
        for c in new_cols:
            row[c] = int(g[c].notna().sum())
        row["vintage_ref"] = g["vintage_ref"].iloc[0]
        cov.append(row)
    pd.DataFrame(cov).to_csv(TAB4 / "feature_coverage.csv", index=False)
    print("[enrich] enriched:", base.shape)
    return base


def main() -> None:
    terr = pd.read_parquet(PROC / "territories.parquet")
    padron = build_padron()
    pop2852 = build_pop2852()
    epa = build_epa()
    adrh = build_adrh(terr)
    build_censo67217()
    build_enriched_turnout(padron, pop2852, epa, adrh)


if __name__ == "__main__":
    main()
