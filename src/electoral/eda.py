"""EDA FASE 1: 5 visualizaciones con datos oficiales + tablas resumen.

Reglas: sin inventar datos; etiquetas de candidatura exactas (sin fusiones);
denominadores y fuentes explícitos en cada gráfico.
"""
from __future__ import annotations

from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from colors import get_party_color  # noqa: E402

plt.rcParams.update({"figure.dpi": 150, "font.size": 9, "axes.grid": True,
                     "grid.alpha": 0.3, "figure.autolayout": False})

ROOT = Path(__file__).resolve().parents[2]
PROC = ROOT / "data" / "processed"
FIG = ROOT / "reports" / "figures"
FIG.mkdir(parents=True, exist_ok=True)

SRC_ELEC = "Fuente: Ministerio del Interior, Elecciones-Congreso.xlsx"
SRC_INE = "Fuente: INE tabla 67988"


def nat_turnout() -> pd.DataFrame:
    to = pd.read_parquet(PROC / "election_turnout.parquet")
    g = to.groupby("election_date", as_index=False).agg(
        electores=("electores", "sum"), votantes=("votantes", "sum"),
        validos=("votos_validos", "sum"), nulos=("votos_nulos", "sum"),
        blancos=("votos_blancos", "sum"), candidaturas=("votos_candidaturas", "sum"))
    g["election_date"] = pd.to_datetime(g["election_date"])
    g = g.sort_values("election_date")
    g["participacion"] = (g["votantes"] / g["electores"] * 100).round(2)
    g["abstencion"] = (100 - g["participacion"]).round(2)
    return g


def fig1_participacion(nat: pd.DataFrame):
    fig, ax = plt.subplots(figsize=(10, 5))
    x = nat["election_date"].dt.strftime("%Y-%m")
    ax.plot(x, nat["participacion"], marker="o", label="Participación (%)")
    ax.plot(x, nat["abstencion"], marker="o", label="Abstención (%)")
    ax.set_ylim(0, 100)
    ax.set_title("Participación y abstención nacional — Congreso (1977–2023)")
    ax.set_ylabel("% sobre censo electoral (CER+CERA desde 1986)")
    ax.set_xlabel("Elección")
    plt.setp(ax.get_xticklabels(), rotation=45, ha="right")
    ax.legend()
    fig.text(0.01, 0.01, SRC_ELEC + " | Tasa = votantes / electores × 100.", fontsize=7)
    fig.tight_layout(rect=[0, 0.07, 1, 0.96])
    fig.savefig(FIG / "fig1_participacion_abstencion.png")
    plt.close(fig)


def fig2_censo_poblacion(nat: pd.DataFrame):
    pop = pd.read_parquet(PROC / "population.parquet")
    pnat = pop[(pop["geo_level"] == "national") & (pop["sexo"] == "Total")].copy()
    pnat = pnat.sort_values("year")
    fig, ax = plt.subplots(figsize=(10, 5))
    ax.plot(nat["election_date"], nat["electores"] / 1e6, marker="o",
            label="Censo electoral (electores, incluye CERA desde 1986)")
    ax.scatter(pd.to_datetime(pnat["year"].astype(str) + "-01-01"),
               pnat["population"].astype(float) / 1e6, marker="s",
               label="Población total INE 67988 (serie 2021–2025)")
    ax.set_title("Censo electoral vs población total (millones)")
    ax.set_ylabel("Millones de personas")
    ax.legend(fontsize=8)
    fig.text(0.01, 0.01,
             SRC_ELEC + " | " + SRC_INE + ". Denominadores distintos: censo = con derecho a voto; "
             "INE = población residente total. Comparación directa solo orientativa (2021–2025).",
             fontsize=7, wrap=True)
    fig.tight_layout(rect=[0, 0.07, 1, 0.96])
    fig.savefig(FIG / "fig2_censo_vs_poblacion.png")
    plt.close(fig)


SELECTED = [
    "PARTIDO SOCIALISTA OBRERO ESPAÑOL - PSOE",
    "PARTIDO POPULAR - PP",
    "VOX - VOX",
    "PARTIDO ANIMALISTA CONTRA EL MALTRATO ANIMAL - PACMA",
]

# Etiqueta exacta -> party_id (registro config/party_colors.json; FASE 2)
SELECTED_PARTY = {
    "PARTIDO SOCIALISTA OBRERO ESPAÑOL - PSOE": "PSOE",
    "PARTIDO POPULAR - PP": "PP",
    "VOX - VOX": "VOX",
    "PARTIDO ANIMALISTA CONTRA EL MALTRATO ANIMAL - PACMA": "PACMA",
}

_MARKERS = {"PSOE": "o", "PP": "s", "VOX": "D", "PACMA": "^"}


def _style(party_id: str) -> dict:
    color, _src = get_party_color(party_id)
    return {"color": color, "marker": _MARKERS.get(party_id, "o")}


def national_votes_exact() -> pd.DataFrame:
    res = pd.read_parquet(PROC / "election_results.parquet")
    g = res.groupby(["election_date", "candidacy_raw"], as_index=False)["votes"].sum()
    g["election_date"] = pd.to_datetime(g["election_date"])
    return g


def fig3_votos_absolutos(nv: pd.DataFrame):
    fig, ax = plt.subplots(figsize=(10, 5.2))
    for lab in SELECTED:
        s = nv[nv["candidacy_raw"] == lab].sort_values("election_date")
        if len(s):
            ax.plot(s["election_date"], s["votes"] / 1e6, label=lab[:38],
                    **_style(SELECTED_PARTY[lab]), linestyle="-", linewidth=2)
    ax.set_title("Votos absolutos nacionales por etiqueta exacta (sin fusiones)")
    ax.set_ylabel("Millones de votos (etiqueta exacta)")
    ax.legend(fontsize=7)
    fig.text(0.01, 0.01,
             SRC_ELEC + ". Cada línea = UNA etiqueta literal. Variantes regionales/coaliciones con "
             "distinta etiqueta (p. ej. PSC, PP-PAR) NO incluidas: la serie infraestima el espacio "
             "político donde existen variantes (ver docs/EDA.md).", fontsize=7, wrap=True)
    fig.tight_layout(rect=[0, 0.07, 1, 0.96])
    fig.savefig(FIG / "fig3_votos_absolutos_etiquetas.png")
    plt.close(fig)


def fig4_pct_vs_absoluto(nv: pd.DataFrame, nat: pd.DataFrame):
    tot = nat.set_index("election_date")["candidaturas"].to_dict()
    rows = []
    for lab in SELECTED:
        s = nv[nv["candidacy_raw"] == lab].sort_values("election_date")
        for _, r in s.iterrows():
            d = r["election_date"]
            if d in tot and tot[d]:
                rows.append({"fecha": d, "etiqueta": lab[:30],
                             "votos": float(r["votes"]),
                             "pct": float(r["votes"]) / float(tot[d]) * 100})
    df = pd.DataFrame(rows)
    fig, ax = plt.subplots(figsize=(10, 5.2))
    for lab, s in df.groupby("etiqueta"):
        full = next((k for k in SELECTED_PARTY if k[:30] == lab), None)
        st = _style(SELECTED_PARTY[full]) if full else {"color": "#696969", "marker": "o"}
        ax.scatter(s["pct"], s["votos"] / 1e6, label=lab, color=st["color"], marker=st["marker"], s=60)
        for _, r in s.iterrows():
            ax.annotate(r["fecha"].strftime("%Y"), (r["pct"], r["votos"] / 1e6),
                        fontsize=6, xytext=(3, 3), textcoords="offset points")
    ax.set_title("% de voto vs votos absolutos (etiquetas exactas, ciclos 1977–2023)")
    ax.set_xlabel("% sobre votos a candidaturas (nacional)")
    ax.set_ylabel("Millones de votos")
    ax.legend(fontsize=7)
    fig.text(0.01, 0.01,
             SRC_ELEC + ". Mismo % puede equivaler a distintos votos absolutos según censo y "
             "participación del ciclo; comparar ciclos exige mismo denominador.", fontsize=7)
    fig.tight_layout(rect=[0, 0.07, 1, 0.96])
    fig.savefig(FIG / "fig4_pct_vs_absoluto.png")
    plt.close(fig)


def fig5_provincias():
    to = pd.read_parquet(PROC / "election_turnout.parquet")
    for d in ["2019-11-10", "2023-07-23"]:
        assert d in to["election_date"].astype(str).unique(), f"falta {d}"
    p = to[to["election_date"].astype(str).isin(["2019-11-10", "2023-07-23"])].copy()
    p["turnout_rate"] = pd.to_numeric(p["turnout_rate"], errors="coerce")
    piv = p.pivot_table(index=["province_code", "province_name"], columns="election_date",
                        values="turnout_rate").reset_index()
    piv.columns = ["province_code", "province_name", "t2019", "t2023"]
    piv["delta_pp"] = (piv["t2023"] - piv["t2019"]).round(2)
    piv = piv.sort_values("delta_pp")
    fig, ax = plt.subplots(figsize=(10, 7))
    ax.barh(piv["province_name"], piv["delta_pp"])
    ax.set_title("Cambio de participación por provincia (2023-07 vs 2019-11, puntos %)")
    ax.set_xlabel("Δ puntos porcentuales de participación")
    fig.text(0.01, 0.01,
             SRC_ELEC + ". Tasa provincial = votantes / electores × 100. Elecciones de distinto "
             "ciclo (repetición 2019-N vs 2023); ver EDA.md.", fontsize=7)
    fig.tight_layout(rect=[0, 0.07, 1, 0.96])
    fig.savefig(FIG / "fig5_delta_participacion_provincias.png")
    plt.close(fig)
    piv.to_csv(PROC / "eda_delta_participacion_provincias.csv", index=False)
    return piv


def main():
    nat = nat_turnout()
    nat.to_csv(PROC / "eda_turnout_national.csv", index=False)
    fig1_participacion(nat)
    fig2_censo_poblacion(nat)
    nv = national_votes_exact()
    fig3_votos_absolutos(nv)
    fig4_pct_vs_absoluto(nv, nat)
    piv = fig5_provincias()
    print("[eda] figuras:", sorted(p.name for p in FIG.glob("*.png")))
    print("[eda] participación nacional máx:", nat.loc[nat["participacion"].idxmax()].to_dict())
    print("[eda] participación nacional mín:", nat.loc[nat["participacion"].idxmin()].to_dict())
    print("[eda] delta provincial medio:", round(float(piv["delta_pp"].mean()), 2),
          "| max:", piv.iloc[-1].to_dict(), "| min:", piv.iloc[0].to_dict())


if __name__ == "__main__":
    main()
