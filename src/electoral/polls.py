"""FASE 2 — Ingesta de encuestas desde compilaciones verificables (Wikipedia, CC BY-SA 4.0).

- Descarga el HTML crudo a data/raw/ (proveniencia + SHA) y parsea las tablas de
  "Voting intention estimates" (estimate_type=estimated_vote) y "Voting preferences"
  (estimate_type=direct_intention). Ámbito nacional-Congreso; subnacionales omitidas.
- NO se inventa nada: fechas de publicación desconocidas -> null; huecos -> sin fila
  (not_reported, nunca 0); "Otros" -> poll_reported_other sin repartir.
- Licencia: CC BY-SA 4.0 de Wikipedia -> license_status=attribution_required.

Uso:
  python src/electoral/polls.py            # ingiere y genera polls*.parquet
  python src/electoral/polls.py --validate data/templates/polls_manual_template.csv
"""
from __future__ import annotations

import csv
import hashlib
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
PROC = ROOT / "data" / "processed"
TEMPLATES = ROOT / "data" / "templates"

UA = {"User-Agent": "ObservatorioElectoral2026-Fase2/0.1 (academic research; CC BY-SA attribution)"}

PAGES = [
    ("wiki2026", "https://en.wikipedia.org/wiki/Opinion_polling_for_the_2026_Spanish_general_election"),
    ("wiki2023", "https://en.wikipedia.org/wiki/Opinion_polling_for_the_2023_Spanish_general_election"),
]

LICENSE = "CC BY-SA 4.0 (Wikipedia contributors); reuse with attribution; verify at source_url"

MONTHS = {"jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
          "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12}

# alt/title de logo -> (reported_label, party_id|None)
PARTY_MAP = {
    "PP": ("PP", "PP"), "PSOE": ("PSOE", "PSOE"), "VOX": ("Vox", "VOX"), "Vox": ("Vox", "VOX"),
    "SUMAR": ("Sumar", "SUMAR"), "Sumar": ("Sumar", "SUMAR"),
    "PODEMOS": ("Podemos", "PODEMOS"), "Podemos": ("Podemos", "PODEMOS"),
    "ERC": ("ERC", "ERC"), "JUNTS": ("Junts", "JUNTS"), "Junts": ("Junts", "JUNTS"),
    "JXCAT": ("Junts", "JUNTS"), "EH BILDU": ("EH Bildu", "BILDU"), "EH BILDU ": ("EH Bildu", "BILDU"),
    "BILDU": ("EH Bildu", "BILDU"), "PNV": ("PNV", "PNV"), "EAJ-PNV": ("PNV", "PNV"),
    "BNG": ("BNG", "BNG"), "CC": ("CC", "CC"), "CCA": ("CC", "CC"),
    "UPN": ("UPN", "UPN"), "PACMA": ("PACMA", "PACMA"), "CS": ("Cs", "CS"), "Cs": ("Cs", "CS"),
    "CUP": ("CUP", "CUP"), "SALF": ("SALF", None), "SE ACABÓ LA FIESTA": ("SALF", None),
    "PODEMOS-IU": ("Podemos-IU", None), "OTHERS": ("Others", "poll_reported_other"),
    "OTHER": ("Others", "poll_reported_other"), "OTROS": ("Others", "poll_reported_other"),
    "AA": ("Adelante Andalucía", None), "ADELANTE ANDALUCÍA": ("Adelante Andalucía", None),
    "ADELANTE ANDALUCÍA (2021)": ("Adelante Andalucía", None),
    "ALIANÇA CATALANA": ("Aliança Catalana", None), "AC": ("Aliança Catalana", None),
    "ALIANÇA.CAT": ("Aliança Catalana", None),
    "COMPROMÍS": ("Compromís", "COMPROMIS"), "MÉS": ("Més", None), "TERUEL EXISTE": ("Teruel Existe", None),
    "PRC": ("PRC", None), "NC": ("Nueva Canarias", None), "NUEVA CANARIAS": ("Nueva Canarias", None),
    "PDeCAT": ("PDeCAT", None), "PDECAT": ("PDeCAT", None),
    "UNIDAS PODEMOS": ("Unidas Podemos", None), "MÁS PAÍS": ("Más País", None),
    "CC–NCA": ("CC-NC", None), "EV": ("EV (sin atribuir)", None), "FA": ("FA (sin atribuir)", None),
    "ERC–SOBIRANISTES": ("ERC-Sobiranistes", "ERC"),
    "QUESTION": ("Undecided (?)", "poll_undecided"),
    "X MARK": ("Abstention (no votaría)", "poll_abstention"),
}


def download(url: str, dest: Path) -> dict:
    import requests
    r = requests.get(url, headers=UA, timeout=120)
    r.raise_for_status()
    dest.write_bytes(r.content)
    rev = None
    m = re.search(r"wgCurRevisionId[\"']?\s*[:=]\s*(\d+)", r.text)
    if m:
        rev = m.group(1)
    return {"bytes": len(r.content), "rev": rev,
            "sha256": hashlib.sha256(r.content).hexdigest()}


def parse_fieldwork(text: str, default_year: int | None = None):
    """Devuelve (start, end, precision, flag). Fechas ISO o None.

    default_year: año de la sección (las tablas agrupan por año y el campo suele
    omitirlo, p. ej. '10-14 Jul' bajo el epígrafe 2026). Sin año no se inventa fecha.
    """
    t = re.sub(r"\[[^\]]*\]", "", text).replace(" ", " ").strip().rstrip("?").strip()
    flag = ""
    if "exit poll" in t.lower():
        flag = "exit_poll"
    t = t.replace("Exit poll", "").replace("exit poll", "").strip()
    if default_year and re.search(r"[A-Za-z]", t) and not re.search(r"\d{4}", t):
        t = f"{t} {default_year}"
        flag = (flag + ";year_from_section").strip(";")
    import calendar
    m = re.match(r"^(\d{1,2})\s*[\u2013\-–]\s*(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$", t)
    if m:
        d1, d2, mon, y = m.groups()
        mo = MONTHS[mon[:3].lower()]
        return (f"{y}-{mo:02d}-{int(d1):02d}", f"{y}-{mo:02d}-{int(d2):02d}", "day", flag)
    m = re.match(r"^(\d{1,2})\s+([A-Za-z]{3,9})\s*[\u2013\-–]\s*(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$", t)
    if m:
        d1, mo1, d2, mo2, y = m.groups()
        m1 = MONTHS[mo1[:3].lower()]
        m2 = MONTHS[mo2[:3].lower()]
        y1 = int(y)
        y2 = int(y)
        cross_year = m2 < m1
        if cross_year:
            y1 -= 1
            flag = (flag + ";cross_year").strip(";")
        return (f"{y1}-{m1:02d}-{int(d1):02d}",
                f"{y2}-{m2:02d}-{int(d2):02d}", "day", flag)
    m = re.match(r"^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$", t)
    if m:
        d, mon, y = m.groups()
        return (f"{y}-{MONTHS[mon[:3].lower()]:02d}-{int(d):02d}",) * 2 + ("day", flag)
    m = re.match(r"^([A-Za-z]{3,9})\s+(\d{4})$", t)
    if m:
        mon, y = m.groups()
        mo = MONTHS[mon[:3].lower()]
        last = calendar.monthrange(int(y), mo)[1]
        return (f"{y}-{mo:02d}-01", f"{y}-{mo:02d}-{last}", "month", (flag + ";month_precision").strip(";"))
    return (None, None, "unknown", ("unparsed:" + text[:60] + ";" + flag).strip(";"))


def num_or_none(text: str):
    t = re.sub(r"\[[^\]]*\]", "", text).replace(",", "").replace("%", "").strip()
    if t.startswith("?"):
        return None  # solo proyección de escaños (p. ej. '? 31/33'), sin % de voto
    if t in ("", "–", "-", "—", "?", "n/a", "N/A", "Tied"):
        return None
    m = re.search(r"(\d+(?:\.\d+)?)", t)
    return float(m.group(1)) if m else None


PARTY_POLSTERS = {"PP", "PSOE", "VOX", "SUMAR", "PODEMOS", "IU", "ERC", "JUNTS", "JXCAT",
                  "PNV", "BILDU", "EH BILDU", "BNG", "CC", "CCA", "UPN", "PACMA", "CS", "CUP",
                  "CIU", "UPYD", "UCD", "AP", "CDS", "PCE", "GOBIERNO", "GOVERNMENT"}


def int_or_none(text: str):
    v = num_or_none(text)
    return int(v) if v is not None else None


def header_identity(th) -> str:
    img = th.find("img")
    if img is not None:
        for attr in ("alt",):
            if img.get(attr):
                return img[attr].strip()
    a = th.find("a")
    if a is not None and a.get("title"):
        return a["title"].strip()
    return th.get_text(" ", strip=True)


def parse_page(page_id: str, html: str, source_url: str, rev: str, retrieved_at: str):
    soup = BeautifulSoup(html, "lxml")
    polls, estimates, skipped = [], [], []
    path: list[str] = []
    seats_dropped = 0
    for el in soup.find_all(["h2", "h3", "h4", "h5", "h6", "table"]):
        if el.name.startswith("h"):
            level = int(el.name[1])
            title = el.get_text(" ", strip=True)
            # trunca el path al nivel y añade
            path = [p for p in path if p[0] < level] + [(level, title)]
            continue
        if "wikitable" not in (el.get("class") or []):
            continue
        thead = el.find("tr")
        if thead is None:
            continue
        ths = thead.find_all("th")
        head_txt = " ".join(h.get_text(" ", strip=True) for h in ths)
        if "Fieldwork date" not in head_txt or "Sample size" not in head_txt:
            continue
        section = " / ".join(t for _l, t in path)
        low = section.lower()
        yearm = re.findall(r"\b(19\d{2}|20\d{2})\b", section)
        table_year = int(yearm[-1]) if yearm else None
        if "sub-national" in low or "subnational" in low:
            skipped.append(("subnational", head_txt[:60]))
            continue
        if "hypothetical" in low:
            skipped.append(("hypothetical", section[:80]))
            continue
        if "voting intention" in low:
            etype = "estimated_vote"
        elif "voting preference" in low:
            etype = "direct_intention"
        else:
            skipped.append(("other_section:" + section[:80], head_txt[:60]))
            continue
        # columnas de partido
        cols = []
        for th in ths:
            ident = header_identity(th)
            cols.append(ident)
        # localiza columnas base
        def colidx(*names):
            for i, c in enumerate(cols):
                if c in names:
                    return i
            return None
        i_firm = colidx("Polling firm/Commissioner")
        i_fw = colidx("Fieldwork date")
        i_n = colidx("Sample size")
        i_to = colidx("Turnout")
        if i_firm is None or i_fw is None:
            skipped.append(("no_base_cols", section[:80]))
            continue
        party_cols = []
        for i, c in enumerate(cols):
            if i in (i_firm, i_fw, i_n, i_to):
                continue
            if c.lower() == "lead" or c == "":
                continue
            key = c.upper().strip()
            rep = PARTY_MAP.get(key, PARTY_MAP.get(c, (c, None)))
            party_cols.append((i, rep[0], rep[1]))
        for tr in el.find_all("tr")[1:]:
            tds = tr.find_all(["td", "th"])
            if len(tds) <= max(i_firm, i_fw):
                continue
            firm_raw = tds[i_firm].get_text(" / ", strip=True)
            firm_raw = re.sub(r"\[[^\]]*\]", "", firm_raw).strip().rstrip("/").strip()
            if not firm_raw:
                continue
            if "election" in firm_raw.lower() and "polling" not in firm_raw.lower():
                # fila de resultado oficial (generales, europeas u otra cita) -> no es
                # encuesta; se aparta a polls_result_rows.json y se valida aparte
                vals = {}
                for i, rep_label, _pid in party_cols:
                    if i < len(tds):
                        vals[rep_label] = num_or_none(tds[i].get_text(" ", strip=True))
                estimates.append({"__result_row__": True, "firm_raw": firm_raw, "section": section,
                                  "values": vals, "page_id": page_id})
                continue
            parts = [p.strip() for p in re.split(r"\s*/\s*", firm_raw) if p.strip()]
            pollster, sponsor = parts[0], ("/".join(parts[1:]) or None)
            fw_raw = tds[i_fw].get_text(" ", strip=True) if i_fw < len(tds) else ""
            start, end, prec, flag = parse_fieldwork(fw_raw, table_year)
            n = int_or_none(tds[i_n].get_text(" ", strip=True)) if i_n is not None and i_n < len(tds) else None
            to = num_or_none(tds[i_to].get_text(" ", strip=True)) if i_to is not None and i_to < len(tds) else None
            polls.append({
                "pollster": pollster or None, "sponsor_or_media": sponsor,
                "source_url": source_url, "methodology_url": None,
                "fieldwork_start": start, "fieldwork_end": end, "date_precision": prec,
                "published_at": None, "sample_size": n, "sample_universe": None, "sample_mode": None,
                "scope": "national-Congress", "question_type": "general",
                "estimate_type": etype, "section": section, "page_id": page_id,
                "data_version": f"wiki-rev-{rev}", "license_status": "attribution_required",
                "license_note": LICENSE, "retrieved_at": retrieved_at,
                "quality_flag": ";".join(f for f in [flag, "no_pubdate_use_fieldwork"] if f) or "ok",
                "turnout_pct": to, "_firm_raw": firm_raw,
            })
            pid = len(polls)
            for i, rep_label, party_id in party_cols:
                if i >= len(tds):
                    continue
                raw_cell = tds[i].get_text(" ", strip=True)
                v = num_or_none(raw_cell)
                if v is None:
                    continue  # not_reported: sin fila, nunca 0
                if v > 100:
                    seats_dropped += 1
                    continue  # proyección de escaños u otra unidad: incompatible con % de voto
                estimates.append({
                    "poll_idx": pid, "candidacy_or_party_id": party_id,
                    "reported_label": rep_label, "value_pct": v,
                    "estimate_type": etype,
                    "original_value": tds[i].get_text(" ", strip=True)[:40],
                    "source_url": source_url,
                "mapping_status": "mapped" if party_id not in (None, "poll_reported_other", "poll_undecided", "poll_abstention")
                else ("other_kept" if party_id == "poll_reported_other"
                      else ("nonvote_kept" if party_id in ("poll_undecided", "poll_abstention") else "unmapped_label")),
                })
    return polls, estimates, skipped, seats_dropped


def main() -> None:
    mode_validate = len(sys.argv) == 3 and sys.argv[1] == "--validate"
    if mode_validate:
        sys.exit(validate_manual(sys.argv[2]))

    RAW.mkdir(parents=True, exist_ok=True)
    PROC.mkdir(parents=True, exist_ok=True)
    TEMPLATES.mkdir(parents=True, exist_ok=True)
    retrieved_at = datetime.now(timezone.utc).isoformat()
    all_polls, all_est, all_skip, audit_rows = [], [], [], []

    for page_id, url in PAGES:
        dest = RAW / f"{page_id}_polling.html"
        print(f"[polls] descargando {page_id} ...")
        meta = download(url, dest)
        print(f"  -> {meta['bytes']} bytes rev={meta['rev']} sha={meta['sha256'][:16]}...")
        html = dest.read_text(encoding="utf-8", errors="replace")
        polls, est, skipped, dropped = parse_page(page_id, html, url, meta["rev"], retrieved_at)
        print(f"  -> {len(polls)} encuestas, {len(est)} estimaciones (escaños descartados: {dropped})")
        base_n = len(all_polls)
        for k, p in enumerate(polls, start=1):
            p["poll_id"] = f"{page_id}-{base_n + k:04d}"
        # reasigna poll_idx -> poll_id (poll_idx es posicional dentro de esta página)
        for e in est:
            if "__result_row__" not in e:
                e["poll_id"] = polls[e.pop("poll_idx") - 1]["poll_id"]
        all_polls.extend(polls)
        all_est.extend(est)
        all_skip.extend([(page_id, s[0], s[1]) for s in skipped])
        audit_rows.append({"source_id": f"polls_{page_id}", "provider": "Wikipedia contributors",
                           "url": url, "filename": dest.name, "query_date_utc": retrieved_at,
                           "download_ok": True, "bytes": meta["bytes"], "sha256": meta["sha256"],
                           "license_note": LICENSE})

    result_rows = [e for e in all_est if "__result_row__" in e]
    est = [e for e in all_est if "__result_row__" not in e]

    polls_df = pd.DataFrame(all_polls)
    # Exclusión legítima y documentada: filas artefacto (encuestadora ausente/numérica
    # con fecha nula por desalineación de celdas). No son sondeos.
    _p = polls_df["pollster"].str.strip()
    _invalid = polls_df["pollster"].isna() | (_p == "?") | \
        _p.str.fullmatch(r"[0-9.?]+", na=False).fillna(False)
    _party_as_pollster = _p.str.upper().isin(PARTY_POLSTERS)
    # Exclusión legítima: artefactos sin encuestadora ni fecha, o filas donde un
    # partido figura como "encuestadora" (desalineación de la tabla origen).
    bad = (_invalid & polls_df["fieldwork_end"].isna()) | _party_as_pollster
    n_bad = int(bad.sum())
    if n_bad:
        print(f"[polls] excluidas {n_bad} filas artefacto (pollster inválido + sin fecha)")
        bad_ids = set(polls_df.loc[bad, "poll_id"])
        polls_df = polls_df.loc[~bad].reset_index(drop=True)
        est = [x for x in est if x.get("poll_id") not in bad_ids]
    # Exclusión de filas con campo posterior a la fecha de recuperación: no pueden
    # justificarse como mediciones publicadas y romperían el corte temporal.
    _retrieved_day = pd.Timestamp(retrieved_at[:10])
    _fw = pd.to_datetime(polls_df["fieldwork_end"], errors="coerce")
    future = _fw > _retrieved_day
    n_future = int(future.sum())
    if n_future:
        print(f"[polls] excluidas {n_future} filas con fin de campo posterior a retrieved_at={retrieved_at[:10]}")
        future_ids = set(polls_df.loc[future, "poll_id"])
        polls_df = polls_df.loc[~future].reset_index(drop=True)
        est = [x for x in est if x.get("poll_id") not in future_ids]
    # dedup: mismo tipo de medición + (encuestadora, fin de campo, muestra) -> canonica.
    # Estimación de voto e intención directa NUNCA se deduplican entre sí.
    polls_df["_canon_key"] = (polls_df["estimate_type"].fillna("") + "|" +
                              polls_df["pollster"].str.lower().str.strip().fillna("") + "|" +
                              polls_df["fieldwork_end"].fillna("") + "|" +
                              polls_df["sample_size"].fillna(-1).astype(str))
    polls_df["canonical_poll_id"] = polls_df["poll_id"]
    for _key, g in polls_df.groupby("_canon_key"):
        if len(g) > 1 and _key != "|||-1":
            first = g["poll_id"].iloc[0]
            polls_df.loc[g.index, "canonical_poll_id"] = first
            polls_df.loc[g.index[1:], "quality_flag"] = (
                polls_df.loc[g.index[1:], "quality_flag"] + ";possible_replica").str.strip(";")
    polls_df["n_parties_reported"] = polls_df["poll_id"].map(
        pd.DataFrame(est).groupby("poll_id").size() if est else pd.Series(dtype=int)).fillna(0).astype(int)

    est_df = pd.DataFrame(est)
    polls_df.drop(columns=["_firm_raw", "_canon_key"], errors="ignore").to_parquet(PROC / "polls.parquet", index=False)
    if not est_df.empty:
        est_df.to_parquet(PROC / "poll_estimates.parquet", index=False)

    pd.DataFrame(audit_rows).to_csv(PROC / "polls_audit.csv", index=False)
    pd.DataFrame(result_rows).to_json(PROC / "polls_result_rows.json", orient="records", indent=2, force_ascii=False)

    # extiende source_audit.csv
    audit_path = PROC / "source_audit.csv"
    if audit_path.exists():
        base = pd.read_csv(audit_path, dtype=str).to_dict("records")
    else:
        base = []
    known = {r.get("source_id") for r in base}
    for r in audit_rows:
        if r["source_id"] not in known:
            base.append(r)
    pd.DataFrame(base).to_csv(audit_path, index=False)

    write_template()
    print(f"[polls] encuestas: {len(polls_df)} | estimaciones: {len(est_df)} | "
          f"tipos: {polls_df['estimate_type'].value_counts().to_dict() if len(polls_df) else {}}")
    print(f"[polls] filas de resultado oficial detectadas: {len(result_rows)} | tablas omitidas: {len(all_skip)}")
    for s in all_skip[:10]:
        print("  skip:", s)
    # validación contra resultado oficial 2023 (Interior)
    for rr in result_rows:
        if "2023" in rr["firm_raw"]:
            print("[polls] fila resultado 2023:", rr["firm_raw"][:60],
                  {k: v for k, v in rr["values"].items() if k in ("PP", "PSOE", "Vox", "Sumar")})


POLL_TEMPLATE_COLS = ["poll_id", "pollster", "sponsor_or_media", "source_url", "methodology_url",
                      "fieldwork_start", "fieldwork_end", "published_at", "sample_size",
                      "sample_universe", "sample_mode", "scope", "question_type", "estimate_type",
                      "party_or_label", "value_pct", "license_status", "notes"]


def write_template() -> None:
    dest = TEMPLATES / "polls_manual_template.csv"
    if not dest.exists():
        with open(dest, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=POLL_TEMPLATE_COLS)
            w.writeheader()
    print("[polls] plantilla:", dest)


def validate_manual(path: str) -> int:
    errs = []
    try:
        df = pd.read_csv(path, dtype=str)
    except Exception as e:
        print(f"[validate] no se pudo leer: {e}")
        return 2
    if list(df.columns) != POLL_TEMPLATE_COLS:
        errs.append(f"cabecera distinta de la plantilla: {list(df.columns)}")
    for i, r in df.iterrows():
        for c in ("fieldwork_start", "fieldwork_end", "published_at"):
            if r.get(c) and not re.match(r"^\d{4}-\d{2}-\d{2}$", str(r[c]).strip()):
                errs.append(f"fila {i}: {c} sin formato ISO ({r[c]})")
        if r.get("value_pct") and not (0 <= float(r["value_pct"]) <= 100):
            errs.append(f"fila {i}: value_pct fuera de [0,100]")
        if r.get("estimate_type") and r["estimate_type"] not in ("direct_intention", "estimated_vote", "other_explicit"):
            errs.append(f"fila {i}: estimate_type inválido")
    if errs:
        print("[validate] ERRORES:"); [print(" -", e) for e in errs]
        return 1
    print(f"[validate] OK: {len(df)} filas")
    return 0


if __name__ == "__main__":
    main()
