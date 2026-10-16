# -*- coding: utf-8 -*-
"""FASE 4 — EDA explicativo: demografía, economía, censo vs padrón y todos los partidos."""
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

plt.rcParams.update({"figure.dpi": 150, "font.size": 9, "axes.grid": True,
                     "grid.alpha": 0.3, "figure.autolayout": False})
sys.path.insert(0, str(Path(__file__).resolve().parent))
from colors import get_party_color  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
PROC = ROOT / "data" / "processed"
P4 = PROC / "phase4"
FIG = ROOT / "reports" / "figures" / "phase4"
TAB = ROOT / "reports" / "tables" / "phase4"
FIG.mkdir(parents=True, exist_ok=True)
SRC = ("Fuentes: INE 36780/2852/72989/53687/67217 (CC BY, citar INE) + Interior "
       "(resultados). Solo descriptivo; correlación ecológica ≠ causa.")


def savefig(fig, name):
    fig.tight_layout(rect=[0, 0.09, 1, 0.96])
    fig.savefig(FIG / name)
    plt.close(fig)
    print("[eda4]", name)


def nat_padron():
    p = pd.read_parquet(P4 / "padron_age.parquet")
    p = p[p["band"] != "all"]
    g = p.groupby(["year", "band"])["pop"].sum().unstack(fill_value=0)
    return (g.div(g.sum(axis=1), axis=0) * 100).round(2), g


def fig01_censo_poblacion():
    to = pd.read_parquet(PROC / "election_turnout.parquet")
    nat = to.groupby("election_date")[["electores", "votantes"]].sum()
    nat.index = pd.to_datetime(nat.index)
    p = pd.read_parquet(P4 / "padron_age.parquet")
    pt = p[(p["band"] == "all") & (p["nac"] == "Total")] if "all" in set(p["band"]) else None
    fig, ax = plt.subplots(figsize=(11, 5.2))
    ax.plot(nat.index, nat["electores"] / 1e6, marker="o", label="Censo electoral (Interior)")
    if pt is not None and len(pt):
        pp = pt.groupby("year")["pop"].sum() / 1e6
        ax.scatter(pd.to_datetime(pp.index.astype(str) + "-01-01"), pp.values,
                   label="Padrón 1-ene total (36780)", color="#E377C2", s=40)
    ax.set_title("Censo electoral vs población residente (millones): indicadores distintos")
    ax.set_ylabel("Millones de personas")
    ax.legend(fontsize=8)
    fig.text(0.01, 0.01, SRC + " Censo = con derecho a voto (CER+CERA); padrón = residentes "
             "(incl. menores y extranjeros sin voto).", fontsize=7, wrap=True)
    savefig(fig, "q4_01_censo_vs_poblacion.png")


def fig02_edad():
    shares, absn = nat_padron()
    fig, ax = plt.subplots(figsize=(11, 5.2))
    for b in ["00-17", "18-29", "30-44", "45-64", "65+"]:
        if b in shares:
            ax.plot(shares.index, shares[b], marker="o", label=b)
    ax.set_title("Estructura de edad nacional, padrón 1-ene 2003–2022 (% residentes)")
    ax.set_ylabel("% sobre población residente")
    ax.legend(fontsize=8)
    fig.text(0.01, 0.01, SRC + " Residente no implica derecho a voto.", fontsize=7, wrap=True)
    savefig(fig, "q4_02_edad_nacional.png")
    shares.to_csv(TAB / "q4_02_edad_nacional.csv")


def fig03_extranjeros():
    p = pd.read_parquet(P4 / "padron_age.parquet")
    t = p[(p["nac"] == "Total")].groupby(["year", "province_code"])["pop"].sum()
    f = p[(p["nac"] == "Extranjera")].groupby(["year", "province_code"])["pop"].sum()
    sh = (f / t * 100).round(2).unstack("province_code")
    last = sh.loc[2022].sort_values()
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(12, 5.4))
    a1.barh(last.index, last.values)
    a1.set_title("% extranjeros por provincia (padrón 1-ene-2022)")
    nat = (p[(p["nac"] == "Extranjera")].groupby("year")["pop"].sum()
           / p[(p["nac"] == "Total")].groupby("year")["pop"].sum() * 100)
    a2.plot(nat.index, nat.values, marker="o", color="#17BECF")
    a2.set_title("% extranjeros nacional 2003–2022")
    a2.set_ylabel("% residentes")
    fig.text(0.01, 0.01, SRC, fontsize=7, wrap=True)
    savefig(fig, "q4_03_extranjeros.png")
    last.to_csv(TAB / "q4_03_extranjeros_2022.csv")


def fig04_paro():
    e = pd.read_parquet(P4 / "epa_quarterly.parquet")
    nat = pd.read_parquet(PROC / "population.parquet")
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(12, 5.4))
    u = e[e["province_code"] == "ES"] if "ES" in set(e["province_code"]) else None
    if u is None:
        tot = e.groupby("quarter")["unemployment_rate"].median()
        a1.plot(range(len(tot)), tot.values, color="#333333")
        a1.set_xticks(range(0, len(tot), 8))
        a1.set_xticklabels([tot.index[i] for i in range(0, len(tot), 8)], rotation=45, fontsize=7)
        a1.set_title("Paro EPA: mediana provincial por trimestre (%)")
    q = "2023T1"
    s = e[e["quarter"] == q][["province_code", "unemployment_rate"]].dropna().sort_values("unemployment_rate")
    a2.barh(s["province_code"], s["unemployment_rate"], color="#666666")
    a2.set_title(f"Paro EPA por provincia ({q}, vintage 2023-07, %)")
    fig.text(0.01, 0.01, SRC + " EPA = encuesta (muestra finita); ≠ paro registrado.", fontsize=7, wrap=True)
    savefig(fig, "q4_04_paro.png")
    s.to_csv(TAB / "q4_04_paro_2023T1.csv", index=False)


def fig05_renta():
    a = pd.read_parquet(P4 / "adrh_annual.parquet")
    cols = ["adrh_wages", "adrh_pensions", "adrh_unemp_benefits", "adrh_other_benefits", "adrh_other_income"]
    cols = [c for c in cols if c in a.columns]
    nat = a.groupby("year")[cols].mean(numeric_only=True)
    fig, (x1, x2) = plt.subplots(1, 2, figsize=(12, 5.4))
    x1.stackplot(nat.index, [nat[c].values for c in cols], labels=cols)
    x1.set_title("Mix de fuentes de renta, media provincial 2015–2023 (% renta hogares)")
    x1.legend(fontsize=7)
    w = a[a["year"] == 2021][["province_code", "adrh_wages"]].dropna().sort_values("adrh_wages")
    x2.barh(w["province_code"], w["adrh_wages"], color="#8C564B")
    x2.set_title("% renta salarial por provincia (ADRH 2021, vintage 2023)")
    fig.text(0.01, 0.01, SRC + " % por fuente ≠ renta neta per cápita; forales incompletos pre-2020.",
             fontsize=7, wrap=True)
    savefig(fig, "q4_05_renta_fuentes.png")
    nat.round(2).to_csv(TAB / "q4_05_renta_nacional.csv")


def scatter_turnout(xcol, title, fname, xlabel):
    to = pd.read_parquet(PROC / "election_turnout.parquet")
    t = to[to["election_date"].astype(str) == "2023-07-23"][["province_code", "turnout_rate"]].copy()
    t["turnout_rate"] = pd.to_numeric(t["turnout_rate"])
    e = pd.read_parquet(P4 / "turnout_features_enriched.parquet")
    m = t.merge(e[e["target_election_date"] == "2023-07-23"][["province_code", xcol]],
                on="province_code", how="inner").dropna()
    r = m[["turnout_rate", xcol]].corr().iloc[0, 1]
    fig, ax = plt.subplots(figsize=(10, 5.2))
    ax.scatter(m[xcol], m["turnout_rate"], color="#333333", s=36)
    for _, row in m.iterrows():
        if row["turnout_rate"] > 71 or row["turnout_rate"] < 60:
            ax.annotate(row["province_code"], (row[xcol], row["turnout_rate"]), fontsize=6)
    ax.set_title(f"{title} (r = {r:.2f}, n = {len(m)}; ecológico, no causal)")
    ax.set_xlabel(xlabel)
    ax.set_ylabel("Participación 2023 (%)")
    fig.text(0.01, 0.01, SRC + " Agregados provinciales: no inferir voto individual.",
             fontsize=7, wrap=True)
    savefig(fig, fname)
    return r, len(m)


def fig08_partidos():
    res = pd.read_parquet(PROC / "election_results.parquet")
    mp = pd.read_parquet(PROC / "candidacy_party_mapping.parquet")
    m = res.merge(mp[["election_date", "candidacy_raw", "party_id"]],
                  on=["election_date", "candidacy_raw"], how="left")
    m["ed"] = pd.to_datetime(m["election_date"])
    g = m.groupby(["ed", "party_id"], as_index=False)["votes"].sum()
    un = m[m["party_id"].isna()].groupby("ed", as_index=False)["votes"].sum()
    un["party_id"] = "__NO MAPEADO__"
    g = pd.concat([g, un], ignore_index=True)
    top = g[g["ed"] == pd.Timestamp("2023-07-23")].sort_values("votes", ascending=False)["party_id"].head(6).tolist()
    piv = g.pivot_table(index="ed", columns="party_id", values="votes", aggfunc="sum")
    others = piv[[c for c in piv.columns if c not in top]].sum(axis=1, min_count=1)
    fig, ax = plt.subplots(figsize=(11, 5.6))
    mk = ["o", "s", "D", "^", "v", "P"]
    for i, p in enumerate(top):
        col = "#B0B0B0" if p == "__NO MAPEADO__" else get_party_color(p)[0]
        ax.plot(piv.index, piv[p] / 1e6, label=p, color=col, marker=mk[i % len(mk)], linewidth=2)
    ax.plot(piv.index, others / 1e6, label="Otros (desglose íntegro en CSV)",
            color="#B0B0B0", linestyle="--")
    ax.set_title("Votos por partido incl. no mapeados (top-6 2023 + resto) — 1977–2023")
    ax.set_ylabel("Millones de votos")
    ax.legend(fontsize=7, ncol=2)
    fig.text(0.01, 0.01, SRC + " Tabla íntegra: p2_01_series_todos.csv (fase 2).", fontsize=7, wrap=True)
    savefig(fig, "q4_08_partidos_todos.png")


def fig09_cobertura():
    cov = pd.read_csv(PROC / "mapping_coverage.csv", index_col=0)
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(12, 5.2))
    a1.bar(range(len(cov)), cov["pct_votes_mapped"], color="#333333")
    a1.set_xticks(range(len(cov)))
    a1.set_xticklabels([str(i)[:4] for i in cov.index], rotation=45, fontsize=7)
    a1.set_title("% voto mapeado por elección")
    a1.set_ylabel("% votos con party_id")
    a2.bar(range(len(cov)), cov["labels_mapped"].values, label="mapeadas", color="#333333")
    a2.bar(range(len(cov)), (cov["labels"] - cov["labels_mapped"]).values,
           bottom=cov["labels_mapped"].values, label="sin mapear", color="#B0B0B0")
    a2.set_xticks(range(len(cov)))
    a2.set_xticklabels([str(i)[:4] for i in cov.index], rotation=45, fontsize=7)
    a2.set_title("Etiquetas mapeadas vs sin mapear")
    a2.legend(fontsize=8)
    fig.text(0.01, 0.01, SRC + " 36 normalizados ≠ 1.778 etiquetas: series parciales, filas íntegras.",
             fontsize=7, wrap=True)
    savefig(fig, "q4_09_cobertura_mapeo.png")


def fig10_backlog():
    res = pd.read_parquet(PROC / "election_results.parquet")
    mp = pd.read_parquet(PROC / "candidacy_party_mapping.parquet")
    un = mp[mp["party_id"].isna()][["election_date", "candidacy_raw"]]
    v = res.merge(un, on=["election_date", "candidacy_raw"], how="inner")
    tot = v.groupby(["election_date", "candidacy_raw"])["votes"].sum().reset_index()
    tot = tot.sort_values("votes", ascending=False).head(20)
    tot.to_csv(TAB / "q4_10_backlog_top20.csv", index=False)
    fig, ax = plt.subplots(figsize=(11, 6))
    ax.barh(tot["candidacy_raw"].str.slice(0, 50), tot["votes"] / 1e3, color="#666666")
    ax.invert_yaxis()
    ax.set_title("Backlog de normalización: top-20 etiquetas sin mapear por votos totales")
    ax.set_xlabel("Miles de votos (todas las elecciones y provincias)")
    fig.text(0.01, 0.01, SRC + " Propuestas solo si inequívocas; confluencias Podemos/IU no fusionables.",
             fontsize=7, wrap=True)
    savefig(fig, "q4_10_backlog.png")


def main():
    fig01_censo_poblacion()
    fig02_edad()
    fig03_extranjeros()
    fig04_paro()
    fig05_renta()
    r1, n1 = scatter_turnout("unemployment_rate", "Participación 2023 vs paro EPA 2023T1",
                             "q4_06_turnout_vs_paro.png", "Tasa de paro EPA (% Ambos sexos)")
    r2, n2 = scatter_turnout("share_65plus", "Participación 2023 vs % 65+ (padrón 2022)",
                             "q4_07_turnout_vs_edad.png", "% residentes 65+")
    print(f"[eda4] r paro={r1:.3f} (n={n1}) | r 65+={r2:.3f} (n={n2})")
    fig08_partidos()
    fig09_cobertura()
    fig10_backlog()
    print("[eda4] tablas:", sorted(p.name for p in TAB.glob("q4_*.csv")))


if __name__ == "__main__":
    main()
