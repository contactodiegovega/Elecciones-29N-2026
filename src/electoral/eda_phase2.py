"""FASE 2 — EDA avanzado: 12 figuras + tablas. Solo datos reales.

- Todos los partidos en tablas (sin umbrales); gráficos con top-N explícito + Otros.
- Colores corporativos vía colors.get_party_color; casas encuestadoras en neutros.
- Salidas: reports/figures/phase2/*.png, reports/tables/phase2/*.csv
"""
from __future__ import annotations

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
from colors import get_party_color, FALLBACK_PALETTE  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
PROC = ROOT / "data" / "processed"
FIG = ROOT / "reports" / "figures" / "phase2"
TAB = ROOT / "reports" / "tables" / "phase2"
FIG.mkdir(parents=True, exist_ok=True)
TAB.mkdir(parents=True, exist_ok=True)

SRC_ELEC = "Fuente: Ministerio del Interior, Elecciones-Congreso.xlsx (consulta 2026-10-16)"
SRC_WIKI = ("Fuente encuestas: Wikipedia (CC BY-SA 4.0, atribución), revs 1380368158/1375363334 "
            "(consulta 2026-10-16)")
MARKERS = ["o", "s", "D", "^", "v", "P", "X", "*", "h", "+"]
HOUSE_COLORS = ["#333333", "#666666", "#999999", "#1F77B4", "#9467BD", "#8C564B",
                "#E377C2", "#7F7F7F", "#BCBD22", "#17BECF", "#A0522D", "#2CA02C"]


def cap(extra: str = "") -> str:
    base = SRC_ELEC + " | " + SRC_WIKI
    return (base + " " + extra).strip()


def savefig(fig, name: str):
    fig.tight_layout(rect=[0, 0.09, 1, 0.96])
    fig.savefig(FIG / name)
    plt.close(fig)
    print("[eda2]", name)


def load():
    res = pd.read_parquet(PROC / "election_results.parquet")
    mp = pd.read_parquet(PROC / "candidacy_party_mapping.parquet")
    to = pd.read_parquet(PROC / "election_turnout.parquet")
    terr = pd.read_parquet(PROC / "territories.parquet")
    pop = pd.read_parquet(PROC / "population.parquet")
    polls = pd.read_parquet(PROC / "polls.parquet")
    est = pd.read_parquet(PROC / "poll_estimates.parquet")
    res = res.merge(mp[["election_date", "candidacy_raw", "party_id", "family_id"]],
                    on=["election_date", "candidacy_raw"], how="left")
    res["ed"] = pd.to_datetime(res["election_date"])
    to["ed"] = pd.to_datetime(to["election_date"])
    return res, to, terr, pop, polls, est


def nat_party(res: pd.DataFrame, to: pd.DataFrame):
    g = res.groupby(["ed", "party_id"], as_index=False)["votes"].sum()
    un = res[res["party_id"].isna()].groupby("ed", as_index=False)["votes"].sum()
    un["party_id"] = "__UNMAPPED__"
    g = pd.concat([g, un], ignore_index=True)
    den = to.groupby("ed", as_index=False)["votos_candidaturas"].sum()
    g = g.merge(den, on="ed", how="left")
    g["share"] = (g["votes"].astype(float) / g["votos_candidaturas"].astype(float) * 100).round(3)
    seats = res.groupby(["ed", "party_id"], as_index=False)["seats"].sum()
    g = g.merge(seats, on=["ed", "party_id"], how="left")
    return g


def color_of(party: str) -> str:
    if party == "__UNMAPPED__":
        return "#B0B0B0"
    c, _src = get_party_color(party)
    return c


def topn_2023(g: pd.DataFrame, n: int = 6):
    d = pd.Timestamp("2023-07-23")
    t = g[(g["ed"] == d) & (g["party_id"] != "__UNMAPPED__")].sort_values("votes", ascending=False)
    return t["party_id"].head(n).tolist()


# ---- 1. evolución top-N + Otros (tabla: TODOS) ----
def fig01(g: pd.DataFrame):
    top = topn_2023(g)
    piv = g.pivot_table(index="ed", columns="party_id", values="votes", aggfunc="sum")
    # Presencia real por (elección, partido): ausente -> NaN (nunca 0 histórico inventado)
    pres = g.groupby(["ed", "party_id"])["votes"].sum().unstack()
    pres = pres.notna() & (pres.fillna(0) > 0)
    piv = piv.where(pres, np.nan)
    n_labels_otros = 0
    other_cols = [c for c in piv.columns if c not in top and c != "__UNMAPPED__"]
    others = piv[other_cols].sum(axis=1, min_count=1)
    if "__UNMAPPED__" in piv.columns:
        others = others.add(piv["__UNMAPPED__"], fill_value=0)
        n_labels_otros = len(other_cols)
    fig, ax = plt.subplots(figsize=(11, 5.6))
    for i, p in enumerate(top):
        ax.plot(piv.index, piv[p] / 1e6, label=p, color=color_of(p),
                marker=MARKERS[i % len(MARKERS)], linewidth=2)
    ax.plot(piv.index, others / 1e6, label=f"Otros ({len(other_cols)} partidos + no mapeados)",
            color="#B0B0B0", linestyle="--", linewidth=1.2)
    ax.set_title("Votos nacionales por partido (top-6 de 2023 + Otros) — 1977–2023")
    ax.set_ylabel("Millones de votos (partido mapeado)")
    ax.legend(fontsize=7, ncol=2)
    fig.text(0.01, 0.01, cap(f"| Top-6 = mayor voto nacional en 2023-07 ({','.join(top)}). "
             "Huecos = partido sin presencia mapeada (p. ej. PP antes de 1989, VOX antes de 2014). "
             "Otros = resto incl. no mapeados (desglose íntegro en p2_01_series_todos.csv)."), fontsize=7, wrap=True)
    savefig(fig, "p2_01_topN_votos.png")
    piv.assign(otros=others).round(0).astype("Int64").to_csv(TAB / "p2_01_series_todos.csv")


# ---- 2. cuota + escaños comparables ----
def fig02(g: pd.DataFrame):
    fams = {"FAM_PP": "PP (etiquetas)", "FAM_PSOE": "PSOE (etiquetas)"}
    fig, (a1, a2) = plt.subplots(2, 1, figsize=(11, 7), sharex=True)
    edates = sorted(g["ed"].unique())
    for fam, lab in fams.items():
        s = g[g["party_id"].isin({"PP"} if fam == "FAM_PP" else {"PSOE"})].copy()
        s = s.groupby("ed", as_index=False).agg(votes=("votes", "sum"), seats=("seats", "sum"),
                                                 votos_candidaturas=("votos_candidaturas", "first"))
        s["share"] = s["votes"].astype(float) / s["votos_candidaturas"].astype(float) * 100
        col = color_of("PP" if fam == "FAM_PP" else "PSOE")
        a1.plot(s["ed"], s["share"], label=lab, color=col, marker="o", linewidth=2)
        a2.plot(s["ed"], s["seats"], label=lab, color=col, marker="o", linewidth=2)
    v = g[g["party_id"] == "VOX"].groupby("ed", as_index=False).agg(
        votes=("votes", "sum"), seats=("seats", "sum"), votos_candidaturas=("votos_candidaturas", "first"))
    v["share"] = v["votes"].astype(float) / v["votos_candidaturas"].astype(float) * 100
    a1.plot(v["ed"], v["share"], label="VOX", color=color_of("VOX"), marker="D", linewidth=2)
    a2.plot(v["ed"], v["seats"], label="VOX", color=color_of("VOX"), marker="D", linewidth=2)
    for ax in (a1, a2):
        for x, txt in [(pd.Timestamp("2000-03-12"), "PSOE→\nProgresistas"),
                       (pd.Timestamp("2011-11-20"), "PP→P.P."),
                       (pd.Timestamp("2015-12-20"), "confluencias")]:
            ax.axvline(x, color="#999999", linestyle=":", linewidth=1)
        ax.legend(fontsize=8)
    a1.set_title("Cuota de voto y escaños de series comparables (con rupturas de sigla señaladas)")
    a1.set_ylabel("% sobre votos a candidaturas")
    a2.set_ylabel("Escaños (350/elect.)")
    a2.text(pd.Timestamp("2000-03-12"), 5, "PSOE→Progresistas", fontsize=7)
    a2.text(pd.Timestamp("2011-11-20"), 5, "PP→P.P.", fontsize=7)
    a2.text(pd.Timestamp("2015-12-20"), 5, "confluencias", fontsize=7)
    fig.text(0.01, 0.01, cap("| PP/PSOE = suma de etiquetas del partido (ver PARTY_TAXONOMY). "
             "Rupturas: series por etiqueta exacta no comparables sin este mapeo."), fontsize=7, wrap=True)
    savefig(fig, "p2_02_cuota_escanos.png")


# ---- 3. cambios 2019N→2023 ----
def fig03(g: pd.DataFrame):
    a, b = pd.Timestamp("2019-11-10"), pd.Timestamp("2023-07-23")
    pa = g[(g["ed"] == a) & (g["party_id"] != "__UNMAPPED__")].set_index("party_id")
    pb = g[(g["ed"] == b) & (g["party_id"] != "__UNMAPPED__")].set_index("party_id")
    common = [p for p in pb.index if p in pa.index]
    rows = [{"party": p, "dvotos": float(pb.loc[p, "votes"] - pa.loc[p, "votes"]) / 1e6,
             "dpp": float(pb.loc[p, "share"] - pa.loc[p, "share"])} for p in common]
    df = pd.DataFrame(rows).sort_values("dpp")
    only_b = [p for p in pb.index if p not in pa.index]
    fig, (x1, x2) = plt.subplots(1, 2, figsize=(11, 5.6))
    x1.barh(df["party"], df["dvotos"], color=[color_of(p) for p in df["party"]])
    x1.set_title("Δ votos 2019N→2023 (millones)")
    x2.barh(df["party"], df["dpp"], color=[color_of(p) for p in df["party"]])
    x2.set_title("Δ cuota 2019N→2023 (puntos %)")
    fig.suptitle("Cambio entre elecciones por partido (presentes en ambas; resto: no comparable)")
    note = "No comparables (ausentes en 2019N o 2023): " + (", ".join(sorted(set(only_b))) or "—")
    fig.text(0.01, 0.01, cap("| Denominador pp: votos a candidaturas de cada ciclo. " + note + "."), fontsize=7, wrap=True)
    savefig(fig, "p2_03_cambios_2019_2023.png")
    df.to_csv(TAB / "p2_03_cambios.csv", index=False)


# ---- 4. ranking 2023 (tabla: 81) ----
def fig04(res: pd.DataFrame):
    d = res[res["ed"] == pd.Timestamp("2023-07-23")].groupby(
        ["candidacy_raw", "party_id"], as_index=False, dropna=False).agg(votos=("votes", "sum"), escanos=("seats", "sum"))
    den = float(d["votos"].sum())
    d["pct"] = (d["votos"].astype(float) / den * 100).round(2)
    d = d.sort_values("votos", ascending=False).reset_index(drop=True)
    d.to_csv(TAB / "p2_04_ranking_2023_todos.csv", index=False)
    t15 = d.head(15).iloc[::-1]
    fig, ax = plt.subplots(figsize=(11, 6))
    ax.barh(t15["candidacy_raw"].str.slice(0, 44),
            t15["votos"] / 1e6, color=[color_of(p) for p in t15["party_id"]])
    ax.set_title("Ranking 2023 por votos observados (top-15; tabla íntegra: 81 candidaturas)")
    ax.set_xlabel("Millones de votos (etiqueta exacta)")
    fig.text(0.01, 0.01, cap("| Ranking descriptivo de votos observados, sin valoración. "
             "Tabla completa en p2_04_ranking_2023_todos.csv."), fontsize=7, wrap=True)
    savefig(fig, "p2_04_ranking_2023.png")


# ---- 5. concentración territorial ----
def fig05(res: pd.DataFrame, to: pd.DataFrame):
    d = pd.Timestamp("2023-07-23")
    den = to[to["ed"] == d].set_index("province_code")["votos_candidaturas"].astype(float)
    parties = ["PP", "PSOE", "VOX", "SUMAR", "ERC", "JUNTS", "PNV", "BILDU", "BNG", "CC"]
    sub = res[(res["ed"] == d) & (res["party_id"].isin(parties))].copy()
    sub["share_prov"] = sub.apply(lambda r: float(r["votes"] or 0) / float(den.get(r["province_code"], 0)) * 100
                                  if den.get(r["province_code"]) else np.nan, axis=1)
    fig, ax = plt.subplots(figsize=(11, 5.6))
    data = [sub[sub["party_id"] == p]["share_prov"].dropna().values for p in parties]
    bp = ax.boxplot(data, tick_labels=parties, patch_artist=True)
    for patch, p in zip(bp["boxes"], parties):
        patch.set_facecolor(color_of(p))
        patch.set_alpha(0.7)
    ax.set_title("Dispersión provincial de cuota de voto 2023 (52 provincias por partido)")
    ax.set_ylabel("% sobre votos a candidaturas de la provincia")
    fig.text(0.01, 0.01, cap("| Fuerzas territoriales (ERC/JUNTS/PNV/BILDU/BNG/CC) concentradas: "
             "mediana baja, máximos altos. No inferir voto individual desde agregados."), fontsize=7, wrap=True)
    savefig(fig, "p2_05_concentracion_territorial.png")
    sub.groupby("party_id")["share_prov"].describe().round(2).to_csv(TAB / "p2_05_dispersion_prov.csv")


# ---- 6. participación: distribución + censo ----
def fig06(to: pd.DataFrame):
    fig, ax = plt.subplots(figsize=(11, 5.6))
    eds = sorted(to["ed"].unique())
    data = [pd.to_numeric(to[to["ed"] == e]["turnout_rate"], errors="coerce").dropna().values for e in eds]
    ax.boxplot(data, tick_labels=[pd.Timestamp(e).strftime("%Y") for e in eds])
    ax.set_title("Participación provincial por elección (distribución + deriva del censo)")
    ax.set_ylabel("% votantes/electores por provincia")
    ax2 = ax.twinx()
    nat = to.groupby("ed", as_index=False)[["electores", "votantes"]].sum()
    ax2.plot(range(1, len(eds) + 1), nat["electores"] / 1e6, color="#333333", marker="o",
             linewidth=1.5, label="Censo (M)")
    ax2.set_ylabel("Millones (censo)")
    ax2.legend(fontsize=8, loc="upper left")
    fig.text(0.01, 0.01, cap("| Cajas: 52 provincias. El censo crece +59 % (1977→2023): "
             "el mismo % equivale a más votos según el ciclo."), fontsize=7, wrap=True)
    savefig(fig, "p2_06_turnout_distribucion.png")


# ---- 7. turnout vs población ----
def fig07(to: pd.DataFrame, pop: pd.DataFrame):
    d = pd.Timestamp("2023-07-23")
    t = to[to["ed"] == d][["province_code", "turnout_rate"]].copy()
    t["turnout_rate"] = pd.to_numeric(t["turnout_rate"], errors="coerce")
    q = pop[(pop["geo_level"] == "province") & (pop["year"] == 2023) & (pop["sexo"] == "Total")]
    m = t.merge(q[["province_code", "population"]], on="province_code", how="inner")
    m["population"] = m["population"].astype(float)
    r = m[["turnout_rate", "population"]].corr().iloc[0, 1]
    fig, ax = plt.subplots(figsize=(10, 5.4))
    ax.scatter(m["population"] / 1e6, m["turnout_rate"], color="#333333", s=40)
    for _, row in m.iterrows():
        if row["turnout_rate"] > 72 or row["turnout_rate"] < 60:
            ax.annotate(row["province_code"], (row["population"] / 1e6, row["turnout_rate"]), fontsize=6)
    ax.set_xscale("log")
    ax.set_title(f"Participación 2023 vs población provincial (r = {r:.2f}, n = {len(m)}; solo descriptivo)")
    ax.set_xlabel("Población 2023 (millones, esc. log; INE 67988)")
    ax.set_ylabel("% participación (Interior)")
    fig.text(0.01, 0.01, cap("| Correlación ecológica provincial; no implica causa individual. "
             "Referencias temporales distintas (padrón 1-ene vs elección 23-jul)."), fontsize=7, wrap=True)
    savefig(fig, "p2_07_turnout_vs_poblacion.png")
    m.to_csv(TAB / "p2_07_turnout_pob.csv", index=False)


# ---- helpers encuestas ----
HOUSE_MARK = {}
def house_style(house: str, party_color: str, top_houses: list[str]):
    if house in top_houses:
        i = top_houses.index(house)
        return {"color": HOUSE_COLORS[i % len(HOUSE_COLORS)], "marker": MARKERS[i % len(MARKERS)]}
    return {"color": "#BBBBBB", "marker": "."}


OFFICIAL_2023 = {"PP": 33.33, "PSOE": 31.94, "VOX": 12.48, "SUMAR+": 12.43}


def fig08(polls: pd.DataFrame, est: pd.DataFrame):
    e = est[(est["estimate_type"] == "estimated_vote") & (est["mapping_status"] == "mapped")].copy()
    e = e.merge(polls[["poll_id", "pollster", "fieldwork_end"]], on="poll_id", how="inner")
    e["fw"] = pd.to_datetime(e["fieldwork_end"])
    e = e[(e["fw"] >= "2024-01-01") & (e["fw"] <= "2026-10-11")]
    top_houses = e["pollster"].value_counts().head(8).index.tolist()
    fig, axes = plt.subplots(3, 1, figsize=(11, 8), sharex=True)
    for ax, party in zip(axes, ["PP", "PSOE", "VOX"]):
        s = e[e["candidacy_or_party_id"] == party].sort_values("fw")
        for house, g in s.groupby("pollster"):
            st = house_style(house, color_of(party), top_houses)
            ax.scatter(g["fw"], g["value_pct"], label=house if house in top_houses else None,
                       s=28, alpha=0.85, **st)
        ax.axhline(OFFICIAL_2023[party], color=color_of(party), linestyle="--", linewidth=1.5,
                   label=f"Resultado oficial 2023 ({OFFICIAL_2023[party]} %)")
        ax.set_title(f"{party} en encuestas (estimación de voto, 2024–2026) — color partido, símbolo por casa")
        ax.set_ylabel("% voto estimado")
        ax.legend(fontsize=6, ncol=5)
    axes[-1].set_xlabel("Fin de trabajo de campo (fecha de publicación desconocida en origen)")
    fig.text(0.01, 0.01, cap("| Cada punto = un sondeo nacional-Congreso. Resto de casas en gris. "
             "Oficial 2023 Interior (FAM/entidad comparable; Sumar ver p2_11)."), fontsize=7, wrap=True)
    savefig(fig, "p2_08_polls_serie.png")


def fig09(polls: pd.DataFrame, est: pd.DataFrame):
    e = est[(est["estimate_type"] == "estimated_vote") & (est["mapping_status"] == "mapped")].copy()
    e = e.merge(polls[["poll_id", "pollster", "fieldwork_end"]], on="poll_id", how="inner")
    e["fw"] = pd.to_datetime(e["fieldwork_end"])
    e = e[(e["fw"] >= "2025-01-01")]
    rows = []
    for (house, party), g in e[e["candidacy_or_party_id"].isin(["PP", "PSOE", "VOX"])].groupby(["pollster", "candidacy_or_party_id"]):
        if len(g) >= 3:
            rows.append({"casa": house, "partido": party, "media": round(float(g["value_pct"].mean()), 2),
                         "n": len(g), "sd": round(float(g["value_pct"].std()), 2)})
    df = pd.DataFrame(rows)
    df.to_csv(TAB / "p2_09_house_effects.csv", index=False)
    houses = sorted(df["casa"].unique(), key=lambda h: -len(df[df["casa"] == h]))
    x = np.arange(len(houses))
    fig, ax = plt.subplots(figsize=(12, 5.6))
    for i, party in enumerate(["PP", "PSOE", "VOX"]):
        s = df[df["partido"] == party].set_index("casa")
        vals = [s.loc[h, "media"] if h in s.index else np.nan for h in houses]
        ax.bar(x + (i - 1) * 0.25, vals, width=0.25, label=party, color=color_of(party))
    ax.set_xticks(x)
    ax.set_xticklabels(houses, rotation=45, ha="right", fontsize=7)
    ax.set_title("Media por casa 2025–2026 (estimación de voto; n≥3; posible house effect, sin atribuir intención)")
    ax.set_ylabel("% medio estimado")
    ax.legend(fontsize=8)
    fig.text(0.01, 0.01, cap("| Mismo tipo (estimated_vote) y ámbito (nacional-Congreso). n y sd en "
             "p2_09_house_effects.csv. Diferencias ≠ sesgo deliberado."), fontsize=7, wrap=True)
    savefig(fig, "p2_09_house_effects.png")


def fig10(polls: pd.DataFrame):
    p = polls.copy()
    p["fw"] = pd.to_datetime(p["fieldwork_end"], errors="coerce")
    p = p[p["fw"].notna()]
    p["trim"] = p["fw"].dt.to_period("Q").astype(str)
    mat = p.groupby(["pollster", "trim"]).size().unstack(fill_value=0)
    mat = mat.loc[p["pollster"].value_counts().head(16).index]
    fig, ax = plt.subplots(figsize=(12, 6))
    im = ax.imshow(mat.values, aspect="auto", cmap="Blues")
    ax.set_xticks(range(len(mat.columns)))
    ax.set_xticklabels(mat.columns, rotation=45, ha="right", fontsize=7)
    ax.set_yticks(range(len(mat.index)))
    ax.set_yticklabels(mat.index, fontsize=8)
    ax.set_title("Cobertura de sondeos por casa y trimestre (nacional-Congreso; ambas fuentes)")
    fig.colorbar(im, ax=ax, label="n sondeos")
    fig.text(0.01, 0.01, cap("| Huecos = sin sondeo compilado (no cero). Tipos mezclados: ver p2_12 para "
             "distinguir estimated_vote vs direct_intention."), fontsize=7, wrap=True)
    savefig(fig, "p2_10_cobertura.png")
    mat.to_csv(TAB / "p2_10_cobertura.csv")


def fig11(polls: pd.DataFrame, est: pd.DataFrame):
    cutoff = pd.Timestamp("2023-07-23")
    e = est[(est["estimate_type"] == "estimated_vote") & (est["mapping_status"] == "mapped")].copy()
    e = e.merge(polls[["poll_id", "pollster", "fieldwork_end", "sample_size"]], on="poll_id", how="inner")
    e["fw"] = pd.to_datetime(e["fieldwork_end"])
    e = e[(e["fw"] >= cutoff - pd.Timedelta(days=30)) & (e["fw"] < cutoff)]
    comp = {"PP": ("PP", 33.33), "PSOE": ("PSOE", 31.94), "VOX": ("VOX", 12.48)}
    rows = []
    for _, r in e.iterrows():
        if r["candidacy_or_party_id"] in comp:
            _p, off = comp[r["candidacy_or_party_id"]]
            rows.append({"casa": r["pollster"], "partido": r["candidacy_or_party_id"],
                         "estim": float(r["value_pct"]), "error": round(float(r["value_pct"]) - off, 2),
                         "fw": r["fw"].date().isoformat(), "n": r["sample_size"]})
    df = pd.DataFrame(rows)
    df.to_csv(TAB / "p2_11_error_2023.csv", index=False)
    rng = np.random.default_rng(42)
    houses = sorted(df["casa"].unique())
    hy = {h: i for i, h in enumerate(houses)}
    fig, ax = plt.subplots(figsize=(11, max(5.6, 0.34 * len(houses) + 2)))
    for party in ["PP", "PSOE", "VOX"]:
        s = df[df["partido"] == party].copy()
        s["y"] = s["casa"].map(hy) + rng.uniform(-0.22, 0.22, size=len(s))
        ax.scatter(s["error"], s["y"], color=color_of(party),
                   marker={"PP": "o", "PSOE": "s", "VOX": "D"}[party], s=42, alpha=0.8,
                   label=f"{party} (MAE {s['error'].abs().mean():.2f} pp, n={len(s)})")
    ax.set_yticks(range(len(houses)))
    ax.set_yticklabels(houses, fontsize=7)
    ax.axvline(0, color="black", linewidth=1)
    ax.axvline(0, color="black", linewidth=1)
    ax.set_title("Error de estimación vs resultado oficial 2023 por casa (sondeos ≤30 días antes)")
    ax.set_xlabel("pp estimados − oficiales (oficial: PP 33,33 / PSOE 31,94 / VOX 12,48)")
    ax.legend(fontsize=8)
    fig.text(0.01, 0.01, cap("| Oficial Interior (entidad comparable FAM; denominador votos a candidaturas). "
             "Sumar excluido aquí por comparabilidad de perímetro (ver EDA_PHASE2)."), fontsize=7, wrap=True)
    savefig(fig, "p2_11_error_2023.png")


def fig12(polls: pd.DataFrame, est: pd.DataFrame):
    e = est[(est["mapping_status"] == "mapped") &
            (est["candidacy_or_party_id"].isin(["PP", "PSOE"]))].copy()
    e = e.merge(polls[["poll_id", "pollster", "fieldwork_end"]], on="poll_id", how="inner")
    e = e[e["pollster"] == "CIS"].copy()
    e["fw"] = pd.to_datetime(e["fieldwork_end"])
    e = e[(e["fw"] >= "2023-08-01")]
    fig, axes = plt.subplots(2, 1, figsize=(11, 6.4), sharex=True)
    for ax, party in zip(axes, ["PP", "PSOE"]):
        for et, m in [("estimated_vote", "o"), ("direct_intention", "x")]:
            s = e[(e["candidacy_or_party_id"] == party) & (e["estimate_type"] == et)].sort_values("fw")
            ax.scatter(s["fw"], s["value_pct"], label=et, color=color_of(party), marker=m, s=36)
        ax.set_title(f"CIS: estimación vs intención directa ({party}) — no mezclar ni equivaler")
        ax.set_ylabel("%")
        ax.legend(fontsize=8)
    axes[-1].set_xlabel("Fin de campo (CIS mensual; barómetros 2023–2026)")
    fig.text(0.01, 0.01, cap("| Intención directa y estimación CIS son universos distintos; "
             "comparar solo dentro del mismo tipo."), fontsize=7, wrap=True)
    savefig(fig, "p2_12_cis_tipos.png")


def main():
    res, to, terr, pop, polls, est = load()
    g = nat_party(res, to)
    fig01(g)
    fig02(g)
    fig03(g)
    fig04(res)
    fig05(res, to)
    fig06(to)
    fig07(to, pop)
    fig08(polls, est)
    fig09(polls, est)
    fig10(polls)
    fig11(polls, est)
    fig12(polls, est)
    print("[eda2] tablas:", sorted(p.name for p in TAB.glob("*.csv")))


if __name__ == "__main__":
    main()
