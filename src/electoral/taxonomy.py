"""FASE 2 — Taxonomía de candidaturas/partidos y cobertura.

- party_registry: catálogo curado (party_id, display_name, scope, kind, notes).
- candidacy_party_mapping: (election_date, candidacy_raw) -> party_id / family_id opcional,
  con confianza y justificación. Sin matching difuso: reglas explícitas sobre la etiqueta
  completa (nunca solo por sigla: IU tiene 22 nombres, PSOE 20, PP 15).
- party_coverage: (elección[, provincia]): n candidaturas, votos, % cubierto + denominador.
- Las tablas canónicas de Fase 1 NO se modifican; todo es aditivo.
"""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
PROC = ROOT / "data" / "processed"
REF = ROOT / "data" / "reference"

TAXONOMY_VERSION = "2026-10-16.v1"

# party_id, display_name, scope, kind, notes
REGISTRY: list[tuple] = [
    ("PP", "Partido Popular", "national", "party", "Incluye variantes de sigla P.P./PP y coaliciones electorales encabezadas por el PP (PP-PAR, PP-FORO)."),
    ("PSOE", "Partido Socialista Obrero Español (+ federaciones PSC/PSdeG/PSE-EE/PSIB/PSN)", "national", "party", "Federaciones territoriales con sigla propia mapeadas al partido por continuidad orgánica documentada."),
    ("VOX", "Vox", "national", "party", "Etiqueta estable VOX - VOX."),
    ("SUMAR", "Sumar", "national", "coalition", "Plataforma/coalición 2023; variantes territoriales con sigla SUMAR."),
    ("PODEMOS", "Podemos", "national", "party", "Etiqueta PODEMOS estable desde 2015."),
    ("IU", "Izquierda Unida", "national", "coalition", "Solo siglas exactas IU/I.U.; confluencias 2015-2016 NO fusionadas."),
    ("ERC", "Esquerra Republicana de Catalunya", "regional", "party", "Sigla ERC estable."),
    ("JUNTS", "Junts per Catalunya", "regional", "coalition", "Incluye variantes JxCAT/JUNTS-JxCAT."),
    ("PNV", "Partido Nacionalista Vasco (EAJ-PNV)", "regional", "party", "Sigla PNV/EAJ-PNV."),
    ("BILDU", "EH Bildu", "regional", "coalition", "Siglas EH Bildu/BILDU."),
    ("BNG", "Bloque Nacionalista Galego", "regional", "party", "Siglas BNG/B.N.G."),
    ("CC", "Coalición Canaria", "regional", "coalition", "Siglas CC/CCa y nombre COALICIÓN CANARIA."),
    ("UPN", "Unión del Pueblo Navarro", "regional", "party", "Siglas UPN/U.P.N. en solitario."),
    ("UPN_PP", "UPN-PP (coalición)", "regional", "coalition", "Coalición UPN+PP en Navarra; identidad propia, no heredada."),
    ("PACMA", "Partido Animalista (PACMA)", "national", "party", "Sigla PACMA estable (con/sin coletilla medioambiental)."),
    ("CS", "Ciudadanos", "national", "party", "Siglas C's/Cs."),
    ("CUP", "Candidatura d'Unitat Popular", "regional", "coalition", "Siglas CUP/CUP-PR."),
    ("UPYD", "Unión Progreso y Democracia", "national", "party", "Sigla UPYD."),
    ("UCD", "Unión de Centro Democrático", "national", "party", "1977-1982. Sin continuidad con PP (documentado)."),
    ("AP", "Alianza Popular / Federación AP", "national", "coalition", "1977-1989. Sin fusión automática con PP."),
    ("CDS", "Centro Democrático y Social", "national", "party", "1979-1993."),
    ("PCE", "Partido Comunista de España", "national", "party", "Sigla PCE; sin fusión automática con IU."),
    ("CIU", "Convergència i Unió", "regional", "coalition", "Coalición catalana CDC+UDC 1979-2015; identidad propia."),
    ("HB", "Herri Batasuna", "regional", "coalition", "Sigla HB 1979-1996."),
    ("PA", "Partido Andalucista", "regional", "party", "Sigla PA."),
    ("UV", "Unió Valenciana", "regional", "party", "Sigla UV."),
    ("PAR", "Partido Aragonés", "regional", "party", "Sigla PAR (variantes de nombre)."),
    ("EA", "Eusko Alkartasuna", "regional", "party", "Sigla EA."),
    ("EE", "Euskadiko Ezkerra", "regional", "party", "Sigla EE."),
    ("IC", "Iniciativa per Catalunya", "regional", "coalition", "Sigla IC."),
    ("PSUC", "Partit Socialista Unificat de Catalunya", "regional", "party", "Histórico 1977-1986."),
    ("FN", "Fuerza Nueva", "national", "party", "Histórico 1977-1982."),
    ("CDC", "Convergència Democràtica de Catalunya", "regional", "party", "2015-2016 tras CiU."),
    ("DL", "Democràcia i Llibertat", "regional", "coalition", "Coalición CDC-led 2015."),
    ("NAMAS", "Navarra Suma", "regional", "coalition", "Coalición UPN+Cs+PP 2019; identidad propia."),
    ("COMPROMIS", "Compromís", "regional", "coalition", "Coalición valenciana; sigla COMPROMÍS."),
]


def acronym_of(label: str) -> str:
    s = str(label).replace("’", "'").replace("‘", "'")
    return s.rsplit("-", 1)[-1].strip()


def map_label(label: str) -> tuple[str | None, str, str]:
    """Devuelve (party_id, confidence, justification). Reglas sobre etiqueta completa."""
    up = str(label).upper()
    ac = acronym_of(label).upper()

    def start(prefixes):
        return up.startswith(prefixes)

    if start(("PARTIDO POPULAR", "PARTIT POPULAR", "PARTIT POPULAR-PARTIDO")) and "UNIDAD POPULAR" not in up and "UNITAT POPULAR" not in up:
        return ("PP", "high", "rule: etiqueta encabezada por PARTIDO/PARTIT POPULAR (incluye P.P./PP, PP-PAR, PP-FORO)")
    if start(("PARTIDO SOCIALISTA OBRERO", "PARTIT DELS SOCIALISTES", "PARTIT SOCIALISTA OBRER",
              "PARTIDO DOS SOCIALISTAS", "PARTIDO DE LOS SOCIALISTAS", "PARTIDO SOCIALISTA DE")) \
            and "INDEPENDIENTES" not in up and "VERDES-SOCIALISTAS" not in up:
        return ("PSOE", "high", "rule: partido/federación socialista (PSOE/PSC/PSdeG/PSE-EE/PSIB/PSN/NCa)")
    if ac.startswith("PSOE") or "PSOE-" in up:
        return ("PSOE", "medium", "rule: sigla PSOE* (variantes PSOE-A, PSOE-H histórico, PSOE-PROGR., PSOE-NCa)")
    if ac == "VOX" or up == "VOX - VOX":
        return ("VOX", "high", "rule: sigla VOX")
    if ac == "SUMAR" or ac.startswith("SUMAR "):
        return ("SUMAR", "high", "rule: sigla SUMAR (variantes territoriales)")
    if ac == "ECP" and "SUMAR" in up:
        return ("SUMAR", "medium", "rule: lista catalana de Sumar (SUMAR-ECP)")
    if up.startswith("PODEMOS"):
        return ("PODEMOS", "high", "rule: etiqueta PODEMOS")
    if ac in ("IU", "I.U."):
        return ("IU", "high", "rule: sigla exacta IU (confluencias con otro nombre no fusionadas)")
    if ac in ("IU-CA", "IU/EU", "EUPV"):
        return ("IU", "medium", "rule: federación territorial de IU (IU-CA Andalucía, IU/EU-EUPV Valenciana)")
    if "ESQUERRA REPUBLICANA" in up:
        conf = "high" if ac == "ERC" else "medium"
        return ("ERC", conf, "rule: Esquerra Republicana (sigla ERC o coalicion ERC-led: CatSi, Sobiranistes)")
    if "BILDU" in up:
        return ("BILDU", "high", "rule: etiqueta contiene BILDU (EH Bildu)")
    if ac.upper() == "CIU" or "CONVERGENCIA I UNIO" in up or "CONVERG" in up and "UNI" in up and "CONVERGENCIA" in up:
        return ("CIU", "high", "rule: Convergència i Unió (variantes CIU/CiU)")
    if ac == "HB" or "HERRI BATASUNA" in up:
        return ("HB", "high", "rule: Herri Batasuna")
    if ac == "PA" and "ANDALUCISTA" in up:
        return ("PA", "high", "rule: Partido Andalucista")
    if ac == "UV":
        return ("UV", "high", "rule: Unió Valenciana")
    if ac == "PAR":
        return ("PAR", "high", "rule: Partido Aragonés")
    if ac == "EA" and "ALKARTASUNA" in up:
        return ("EA", "high", "rule: Eusko Alkartasuna")
    if ac == "EE":
        return ("EE", "high", "rule: Euskadiko Ezkerra")
    if ac == "IC":
        return ("IC", "high", "rule: Iniciativa per Catalunya")
    if ac == "PSUC":
        return ("PSUC", "high", "rule: PSUC histórico")
    if ac == "FN":
        return ("FN", "high", "rule: Fuerza Nueva")
    if ac == "CDC" or (up.startswith("CONVERG") and "DEMOCR" in up and "CATALUNYA" in up):
        return ("CDC", "high", "rule: Convergència Democràtica de Catalunya")
    if ac == "DL":
        return ("DL", "medium", "rule: Democràcia i Llibertat (coalición 2015)")
    if ac == "NA+":
        return ("NAMAS", "high", "rule: Navarra Suma (coalición 2019)")
    if ac.upper().startswith("COMPROM"):
        return ("COMPROMIS", "medium", "rule: Compromís (sigla COMPROMÍS; confluencias Podemos aparte)")
    if ac == "ERC":
        return ("ERC", "high", "rule: sigla ERC")
    if "JUNTS" in up or ac in ("JXCAT",):
        return ("JUNTS", "medium", "rule: JUNTS/JxCAT (revisión: cambios de denominación documentados)")
    if ac in ("PNV", "EAJ-PNV") or "EAJ-PNV" in up or "NACIONALISTA VASCO" in up:
        return ("PNV", "high", "rule: PNV/EAJ-PNV")
    if ac in ("EH BILDU", "BILDU", "EH-BILDU"):
        return ("BILDU", "high", "rule: sigla EH Bildu")
    if ac in ("BNG", "B.N.G."):
        return ("BNG", "high", "rule: sigla BNG")
    if ac in ("CC", "CCa") or "CANARIA" in up:
        return ("CC", "high", "rule: sigla CC/CCa o CANARIA en etiqueta (Coalición Canaria)")
    if "UPN-PP" in up or "UPN PP" in up:
        return ("UPN_PP", "high", "rule: coalición UPN-PP 1989-2016 (identidad propia)")
    if ac == "UPN-PP":
        return ("UPN_PP", "high", "rule: coalición UPN-PP (identidad propia)")
    if ac == "CUP-PR":
        return ("CUP", "high", "rule: sigla CUP-PR")
    if "-" in ac:
        return (None, "coalition_pending", "sigla compuesta de coalición (p. ej. CC-AP, IU-UPeC): revisión manual pendiente; etiqueta conservada")
    if ac in ("UPN", "U.P.N."):
        return ("UPN", "high", "rule: sigla UPN en solitario")
    if ac == "PACMA":
        return ("PACMA", "high", "rule: sigla PACMA")
    if ac in ("C'S", "CS", "C,S"):
        return ("CS", "high" if ac != "C,S" else "medium", "rule: sigla C's/Cs (variante C,S documentada)")
    if ac in ("CDS", "CDS."):
        return ("CDS", "high", "rule: sigla CDS")
    if ac in ("CUP", "CUP-PR"):
        return ("CUP", "high", "rule: sigla CUP")
    if ac == "UPYD":
        return ("UPYD", "high", "rule: sigla UPYD")
    if ac == "UCD":
        return ("UCD", "high", "rule: sigla UCD")
    if up.startswith(("ALIANZA POPULAR", "FEDERACION DE PARTIDOS DE ALIANZA POPULAR")):
        conf = "high" if ac == "AP" else "medium"
        return ("AP", conf, "rule: Alianza Popular (sigla AP o coalición AP-led: AP-PDP…)")
    if up.startswith("COALICION POPULAR") and ("AP-" in ac or "AP-PDP" in up):
        return ("AP", "medium", "rule: Coalición Popular 1986 (AP-PDP-PL, AP-led)")
    if ac == "AP":
        return ("AP", "high", "rule: sigla AP")
    if ac == "PCE":
        if "PSUC" in up:
            return ("PCE", "medium", "rule: lista conjunta PSUC-PCE 1977-1979 (comunistas catalanes)")
        return ("PCE", "high", "rule: sigla PCE")
    return (None, "unmapped", "sin regla verificada; se conserva la etiqueta original sin asignar partido")


def family_of(label: str, party_id: str | None) -> tuple[str | None, str]:
    """Vista analítica OPCIONAL (nunca sustituye al original). Solo PP y PSOE, documentados."""
    up = str(label).upper()
    if party_id == "PP":
        return ("FAM_PP", "agrupación opcional de etiquetas encabezadas por PP; vigencia 1989-2023; excluye UPN-PP y Unidad Popular")
    if party_id == "PSOE":
        return ("FAM_PSOE", "agrupación opcional de etiquetas socialistas PSOE/PSC/PSdeG/PSE-EE/PSIB/PSN; vigencia 1977-2023")
    if party_id == "UPN_PP":
        return (None, "")
    return (None, "")


def main() -> None:
    REF.mkdir(parents=True, exist_ok=True)
    res = pd.read_parquet(PROC / "election_results.parquet")
    turnout = pd.read_parquet(PROC / "election_turnout.parquet")

    labels = res[["election_date", "candidacy_raw"]].drop_duplicates().copy()
    labels["candidacy_id"] = labels["election_date"].astype(str) + "::" + labels["candidacy_raw"]
    mapped = labels["candidacy_raw"].map(map_label)
    labels["party_id"] = [m[0] for m in mapped]
    labels["confidence"] = [m[1] for m in mapped]
    labels["justification"] = [m[2] for m in mapped]
    fam = [family_of(l, p) for l, p in zip(labels["candidacy_raw"], labels["party_id"])]
    labels["family_id"] = [f[0] for f in fam]
    labels["family_note"] = [f[1] for f in fam]
    labels["taxonomy_version"] = TAXONOMY_VERSION
    labels["valid_from"] = labels["election_date"]
    labels["valid_to"] = labels["election_date"]
    labels.to_parquet(PROC / "candidacy_party_mapping.parquet", index=False)

    reg = pd.DataFrame(REGISTRY, columns=["party_id", "display_name", "scope", "kind", "notes"])
    reg["taxonomy_version"] = TAXONOMY_VERSION
    reg.to_parquet(PROC / "party_registry.parquet", index=False)
    reg.to_csv(REF / "party_registry.csv", index=False)

    # cobertura por elección y provincia + nacional
    votes_prov = res.groupby(["election_date", "province_code"], as_index=False).agg(
        n_candidacies=("candidacy_raw", "nunique"),
        n_with_votes=("votes", lambda s: int((s.fillna(0) > 0).sum())),
        total_votes=("votes", "sum"))
    denom = turnout[["election_date", "province_code", "votos_candidaturas"]].copy()
    cov = votes_prov.merge(denom, on=["election_date", "province_code"], how="left")
    cov["denominator"] = "votos_a_candidaturas (Interior, misma elección y provincia)"
    cov["pct_covered"] = (cov["total_votes"].astype(float) / cov["votos_candidaturas"].astype(float) * 100).round(3)
    cov["level"] = "province"

    nat = res.groupby(["election_date"], as_index=False).agg(
        n_candidacies=("candidacy_raw", "nunique"),
        n_with_votes=("votes", lambda s: int((s.fillna(0) > 0).sum())),
        total_votes=("votes", "sum"))
    nat_d = turnout.groupby(["election_date"], as_index=False)["votos_candidaturas"].sum()
    nat = nat.merge(nat_d, on="election_date", how="left")
    nat["denominator"] = "votos_a_candidaturas (Interior, nacional)"
    nat["pct_covered"] = (nat["total_votes"].astype(float) / nat["votos_candidaturas"].astype(float) * 100).round(3)
    nat["level"] = "national"
    nat["province_code"] = pd.NA
    cov = pd.concat([cov, nat], ignore_index=True)
    cov.to_parquet(PROC / "party_coverage.parquet", index=False)

    # informe de cobertura del mapeo (votos mapeados por elección)
    mv = res.merge(labels[["election_date", "candidacy_raw", "party_id"]],
                   on=["election_date", "candidacy_raw"], how="left")
    mv["mapped"] = mv["party_id"].notna()
    rep = mv.groupby(mv["election_date"].astype(str)).apply(
        lambda g: pd.Series({
            "labels": g["candidacy_raw"].nunique(),
            "labels_mapped": g[g["mapped"]]["candidacy_raw"].nunique(),
            "votes_total": float(g["votes"].fillna(0).sum()),
            "votes_mapped": float(g[g["mapped"]]["votes"].fillna(0).sum()),
        }), include_groups=False)
    rep["pct_votes_mapped"] = (rep["votes_mapped"] / rep["votes_total"] * 100).round(2)
    rep.to_csv(PROC / "mapping_coverage.csv")
    print("[taxonomy] labels:", len(labels), "| mapped:", int(labels["party_id"].notna().sum()))
    print(rep[["labels", "labels_mapped", "pct_votes_mapped"]].to_string())
    print("[taxonomy] coverage rows:", len(cov))


if __name__ == "__main__":
    main()
