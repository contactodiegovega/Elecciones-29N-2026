"""FASE 3 — Figuras: backtest, residuos, encuestas 2023 y piloto PSOE."""
from __future__ import annotations

import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

plt.rcParams.update({"figure.dpi": 150, "font.size": 9, "axes.grid": True,
                     "grid.alpha": 0.3, "figure.autolayout": False})
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from colors import get_party_color  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
TAB3 = ROOT / "reports" / "tables" / "phase3"
FIG3 = ROOT / "reports" / "figures" / "phase3"
FIG3.mkdir(parents=True, exist_ok=True)
SRC = ("Fuentes: Interior (resultados), Wikipedia CC BY-SA (encuestas, revs "
       "1380368158/1375363334). Mediciones retrospectivas, no pronósticos.")


def savefig(fig, name):
    fig.tight_layout(rect=[0, 0.09, 1, 0.96])
    fig.savefig(FIG3 / name)
    plt.close(fig)
    print("[ml-fig]", name)


def fig_mae():
    M = pd.read_csv(TAB3 / "turnout_backtest.csv")
    piv = M.pivot_table(index="test_election", columns="model", values="MAE_pp")
    order = ["last_election", "mean3", "trend1", "ridge", "elasticnet", "hgbr"]
    order = [c for c in order if c in piv.columns]
    fig, ax = plt.subplots(figsize=(11, 5.4))
    x = range(len(piv.index))
    for i, m in enumerate(order):
        ax.plot(list(x), piv[m].values, marker="o", label=m, linewidth=1.8)
    ax.set_xticks(list(x))
    ax.set_xticklabels([str(t)[:7] for t in piv.index], rotation=30, ha="right")
    ax.set_title("Backtest participación: MAE (pp) por elección retenida y modelo")
    ax.set_ylabel("MAE en puntos porcentuales (52 provincias)")
    ax.legend(fontsize=8, ncol=3)
    fig.text(0.01, 0.01, SRC + " Expanding window; preproceso ajustado solo en train. "
             "n=6 elecciones de test.", fontsize=7, wrap=True)
    savefig(fig, "m3_01_mae_by_election.png")


def fig_resid():
    P = pd.read_csv(TAB3 / "turnout_predictions_oos.csv")
    sub = P[P["model"].isin(["ridge", "last_election"])].copy()
    fig, axes = plt.subplots(1, 2, figsize=(11, 5), sharey=True)
    for ax, m in zip(axes, ["ridge", "last_election"]):
        s = sub[sub["model"] == m]
        ax.scatter(s["y_true"], s["error_pp"], s=10, alpha=0.4)
        ax.axhline(0, color="black", linewidth=1)
        ax.set_title(f"Residuos vs observado — {m} (6 elecciones OOS)")
        ax.set_xlabel("Participación observada (%)")
    axes[0].set_ylabel("Error (pp)")
    fig.text(0.01, 0.01, SRC + " 1.872 predicciones fuera de muestra.", fontsize=7, wrap=True)
    savefig(fig, "m3_02_residuals.png")


def fig_pollerr():
    d = pd.read_csv(TAB3 / "poll_2023_diagnostics.csv")
    d = d[d["party_id"].isin(["PP", "PSOE", "VOX"])].copy()
    d = d[d["days_to"] <= 120]  # ventana de campaña: más allá se mezcla cambio de opinión con error
    fig, ax = plt.subplots(figsize=(11, 5.4))
    for p in ["PP", "PSOE", "VOX"]:
        s = d[d["party_id"] == p].sort_values("days_to")
        ax.scatter(s["days_to"], s["poll_error_pp"], s=16, alpha=0.6,
                   color=get_party_color(p)[0], label=p)
    ax.axhline(0, color="black", linewidth=1)
    ax.set_title("Error de sondeo vs oficial 2023 por anticipación (solo estimated_vote comparable)")
    ax.set_xlabel("Días hasta la elección (fin de campo)")
    ax.set_ylabel("pp estimados − oficiales")
    ax.legend(fontsize=9)
    fig.text(0.01, 0.01, SRC + " Entidad comparable FAM; Sumar excluido por perímetro (ver EDA_PHASE2). "
             "Ventana ≤120 días: más allá, el error mezcla cambio real de opinión.", fontsize=7, wrap=True)
    savefig(fig, "m3_03_poll_error_2023.png")


def fig_psoe():
    M = pd.read_csv(TAB3 / "party_psoe_backtest.csv")
    piv = M.pivot_table(index="test_election", columns="model", values="MAE_pp")
    fig, ax = plt.subplots(figsize=(10, 5))
    for m in piv.columns:
        ax.plot(piv.index.astype(str), piv[m].values, marker="o", label=m, linewidth=1.8)
    ax.set_title("Piloto PSOE provincial: MAE (pp) baseline vs Ridge (5 elecciones OOS)")
    ax.set_ylabel("MAE en puntos porcentuales")
    ax.legend(fontsize=8)
    plt.setp(ax.get_xticklabels(), rotation=30, ha="right")
    fig.text(0.01, 0.01, SRC + " Serie comparable 16 ciclos; resto de partidos solo descriptivo.",
             fontsize=7, wrap=True)
    savefig(fig, "m3_04_psoe_pilot.png")


if __name__ == "__main__":
    fig_mae()
    fig_resid()
    fig_pollerr()
    fig_psoe()
