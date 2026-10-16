"""FASE 2 — CLI de consulta neutral sobre TODAS las candidaturas.

Sin umbrales por defecto salvo --top para visualización; los datos siempre íntegros.
`Otros` solo existe como opción de representación (--otros agrupa fuera del top-N).

Ejemplos (PowerShell):
  python src/electoral/query.py --election 2023-07-23 --top 6
  python src/electoral/query.py --election 2023-07-23 --top 0
  python src/electoral/query.py --search "BILDU" --top 0
  python src/electoral/query.py --election 2015-12-20 --province 08 --top 0 --out out.csv
"""
from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
PROC = ROOT / "data" / "processed"


def load():
    res = pd.read_parquet(PROC / "election_results.parquet")
    mp = pd.read_parquet(PROC / "candidacy_party_mapping.parquet")
    to = pd.read_parquet(PROC / "election_turnout.parquet")
    return (res.merge(mp[["election_date", "candidacy_raw", "party_id", "family_id"]],
                      on=["election_date", "candidacy_raw"], how="left"), to)


def main() -> None:
    ap = argparse.ArgumentParser(description="Consulta todas las candidaturas (sin exclusiones)")
    ap.add_argument("--election", default="2023-07-23", help="Fecha de comicio (o ALL)")
    ap.add_argument("--province", default=None, help="Código provincial (p. ej. 28) o ALL/nacional")
    ap.add_argument("--ccaa", default=None, help="Filtra por nombre de CCAA (requiere --province ALL)")
    ap.add_argument("--search", default=None, help="Subcadena en etiqueta o sigla (insensible a caso)")
    ap.add_argument("--top", type=int, default=6, help="N destacadas por votos (0 = Todas)")
    ap.add_argument("--with-seats", action="store_true", help="Solo candidaturas con escaño")
    ap.add_argument("--otros", action="store_true", help="Agrupa fuera del top-N en fila Otros (representación)")
    ap.add_argument("--out", default=None, help="Exporta la tabla íntegra a CSV")
    a = ap.parse_args()

    res, to = load()
    df = res.copy()
    scope = "nacional"
    if a.election != "ALL":
        df = df[df["election_date"].astype(str) == a.election]
        if len(df) == 0:
            print(f"Elecciones disponibles: {sorted(res['election_date'].astype(str).unique())}")
            raise SystemExit(2)
    if a.province and a.province != "ALL":
        df = df[df["province_code"] == a.province.zfill(2)]
        scope = f"provincia {a.province.zfill(2)}"
    if a.ccaa:
        terr = pd.read_parquet(PROC / "territories.parquet")
        codes = terr[terr["ccaa_name"].str.contains(a.ccaa, case=False, na=False)]["province_code"]
        df = df[df["province_code"].isin(codes)]
        scope = f"CCAA ~{a.ccaa}"
    if a.search:
        q = a.search.lower()
        df = df[df["candidacy_raw"].str.lower().str.contains(q)]
    if a.with_seats:
        df = df[df["seats"].fillna(0) > 0]

    g = df.groupby(["candidacy_raw", "party_id"], as_index=False, dropna=False).agg(
        votos=("votes", "sum"), escanos=("seats", "sum"), provincias=("province_code", "nunique"))
    denom = float(df["votes"].fillna(0).sum())
    g["pct"] = (g["votos"].fillna(0).astype(float) / denom * 100).round(3) if denom else 0.0
    g = g.sort_values("votos", ascending=False).reset_index(drop=True)
    g.insert(0, "rank", g.index + 1)

    crit = (f"top {a.top} por votos nacionales en {a.election}" if a.top > 0
            else "Todas las candidaturas (sin umbral)")
    print(f"[query] ámbito={scope} elección={a.election} denominador(%)=votos a candidaturas ({denom:,.0f}) | criterio: {crit}")
    show = g if a.top <= 0 else g.head(a.top)
    print(show.to_string(index=False))
    if a.otros and a.top > 0 and len(g) > a.top:
        rest = g.iloc[a.top:]
        print(f"Otros: {len(rest)} candidaturas, {rest['votos'].sum():,.0f} votos "
              f"({rest['votos'].sum() / denom * 100:.2f} %), {rest['escanos'].sum():.0f} escaños [solo representación; filas intactas]")
    if a.out:
        g.to_csv(a.out, index=False)
        print(f"[query] exportadas {len(g)} filas -> {a.out}")


if __name__ == "__main__":
    main()
