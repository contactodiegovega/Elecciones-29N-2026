"""Incremental primary-source poll updates. Snapshots are outside the web root.

Reuses the existing canonical poll types and historical archive. CIS is the
reviewed numeric adapter; media/pollster RSS feeds are discovery-only. Failure
of one source never replaces the last valid data with an empty collection.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import re
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit

import requests
from bs4 import BeautifulSoup
from pypdf import PdfReader

from .electoral_calendar import editorial_status
from .polls import PARTY_MAP

ROOT = Path(__file__).resolve().parents[2]
STORE = ROOT / "data" / "poll_updates"
UA = "ElUltimoEscano/1.0 (public-data research; source attribution)"
MONTHS = {"enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
          "julio": 7, "agosto": 8, "septiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12}


def write_json(path: Path, value, *, compact: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # Atomic replacement, never an empty/truncated last-valid registry.
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=None if compact else 2,
                               separators=(",", ":") if compact else None, allow_nan=False), encoding="utf-8")
    temp.replace(path)


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def robots_allowed(text: str, url: str) -> bool:
    """RFC-style path matching including * and $, unlike RobotFileParser's prefix-only matching."""
    groups, agents, rules = [], [], []
    for raw in text.splitlines() + ["User-agent: __end__"]:
        line = raw.split("#", 1)[0].strip()
        if ":" not in line:
            continue
        key, value = [v.strip() for v in line.split(":", 1)]
        if key.lower() == "user-agent":
            if rules:
                groups.append((agents, rules)); agents, rules = [], []
            agents.append(value.lower())
        elif key.lower() in {"allow", "disallow"} and value:
            rules.append((key.lower() == "allow", value))
    specific = [r for a, r in groups if any(x != "*" and x in UA.lower() for x in a)]
    selected = specific or [r for a, r in groups if "*" in a]
    path = unquote(urlsplit(url).path) + ("?" + urlsplit(url).query if urlsplit(url).query else "")
    matches = []
    for rule_set in selected:
        for allow, pattern in rule_set:
            end = pattern.endswith("$")
            pattern = pattern.rstrip("$")
            regex = "^" + re.escape(unquote(pattern)).replace(r"\*", ".*") + ("$" if end else "")
            if re.search(regex, path):
                matches.append((len(pattern.replace("*", "")), allow))
    return max(matches, default=(0, True))[1]


class Fetcher:
    def __init__(self, store: Path, now: datetime):
        self.store, self.now = store, now
        self.session = requests.Session()
        self.session.headers["User-Agent"] = UA
        self.robot_cache, self.cache, self.receipts = {}, {}, []

    def get(self, url: str, source: dict, robots: bool = True) -> bytes:
        for _ in range(5):
            parsed = urlsplit(url)
            if parsed.scheme != "https" or parsed.hostname not in source["allowed_hosts"] or parsed.username:
                raise ValueError("URL o redirección fuera de los hosts HTTPS revisados")
            if url in self.cache:
                return self.cache[url]
            if robots:
                origin = f"https://{parsed.netloc}"
                if origin not in self.robot_cache:
                    raw = self.get(origin + "/robots.txt", source, robots=False)
                    self.robot_cache[origin] = raw.decode("utf-8", errors="replace")
                if not robots_allowed(self.robot_cache[origin], url):
                    raise ValueError("robots.txt no permite esta consulta")
            response = self.session.get(url, timeout=(10, 25), allow_redirects=False, stream=True)
            if response.is_redirect:
                url = urljoin(url, response.headers["Location"])
                response.close()
                continue
            response.raise_for_status()
            parts, size = [], 0
            try:
                for part in response.iter_content(65536):
                    size += len(part)
                    if size > 8 * 1024 * 1024:
                        raise ValueError("Documento mayor que el límite de 8 MiB")
                    parts.append(part)
            finally:
                response.close()
            raw = b"".join(parts)
            sha = digest(raw)
            path = self.store / "raw" / f"{sha}.bin"
            path.parent.mkdir(parents=True, exist_ok=True)
            if not path.exists():
                path.write_bytes(raw)
            self.receipts.append({"url": url, "source": source["id"], "sha256": sha, "bytes": size,
                                  "retrieved_at": self.now.isoformat(), "snapshot": f"raw/{sha}.bin"})
            self.cache[url] = raw
            return raw
        raise ValueError("Demasiadas redirecciones")


class SnapshotFetcher:
    """Reparse exact audited bytes, with their original retrieval clock, offline."""
    mode = "snapshot_replay"

    def __init__(self, store: Path, manifest: dict):
        self.store, self.manifest = store, manifest
        self.receipts = manifest["requests"]

    def get(self, url: str, source: dict, **kwargs):
        record = next((r for r in self.receipts if r["url"] == url), None)
        if record is None and url.endswith("/robots.txt"):
            record = next((r for r in self.receipts if r["source"] == source["id"] and r["url"].endswith("/robots.txt")), None)
        if not record:
            failure = next((s.get("error") for s in self.manifest.get("sources", []) if s["id"] == source["id"]), None)
            raise ValueError("Snapshot sin respuesta válida: " + (failure or url))
        raw = (self.store / "raw" / f"{record['sha256']}.bin").read_bytes()
        if digest(raw) != record["sha256"]:
            raise ValueError("El snapshot no coincide con su SHA-256")
        if source["kind"] == "rss_discovery" and record["url"].endswith("robots.txt"):
            raise ValueError("Se requiere la respuesta del feed; no se sustituye por robots.txt")
        return raw


def estimate_rows(text: str) -> list[dict]:
    """CIS table: explicitly distinguish direct vote, margin and estimate columns."""
    if "estimaci" not in text.lower():
        raise ValueError("El documento no identifica una estimación de voto")
    rows = []
    multi_column = "voto directo" in text.lower() and "margen" in text.lower() and "estimaci" in text.lower()
    number = r"\d{1,3}(?:[,.]\d{1,2})?"
    for line in text.splitlines():
        pattern = (rf"\s*(.+?)\s+{number}\s+[±+]\s*{number}\s+({number})\s*"
                   if multi_column else r"\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ][\wÁÉÍÓÚÜÑáéíóúüñ .+()/–—-]{0,85}?)\s+(\d{1,3}[,.]\d{1,2})\s*%?\s*")
        match = re.fullmatch(pattern, line)
        if not match:
            continue
        label, value = match.groups()
        label = " ".join(label.split()).strip().rstrip("*").strip()
        if any(x in label.lower() for x in ["estimaci", "voto válido", "total", "abstenci", "n.s.", "n.c."]):
            continue
        mapped = PARTY_MAP.get(label.upper(), PARTY_MAP.get(label))
        if label.lower() == "otros partidos":
            mapped = (label, "poll_reported_other")
        elif label.lower() == "en blanco":
            mapped = (label, "poll_blank")
        rows.append({"p": mapped[1] if mapped else None, "label": label,
                     "v": float(value.replace(",", ".")), "m": "mapped" if mapped and mapped[1] else "unmapped_label"})
    # Reject wrong tables instead of guessing the column or fabricating a series.
    if not {"PP", "PSOE", "VOX"}.issubset({r["p"] for r in rows}):
        raise ValueError("No se reconoce una tabla de estimación CIS con PP, PSOE y VOX")
    return rows


def technical_data(text: str) -> dict:
    compact = " ".join(text.split())
    fw = re.search(r"[Dd]el?\s+(\d{1,2})\s+al\s+(\d{1,2})\s+de\s+(\w+)\s+de\s+(20\d{2})", compact)
    sample = re.search(r"[Rr]ealizada[s]?\s*[:：]?\s*([\d.]+)\s*(?:entrevistas|\.)", compact)
    result = {"fw_start": None, "fw_end": None, "n": int(sample[1].replace(".", "")) if sample else None}
    if fw and fw[3].lower() in MONTHS:
        result["fw_start"] = date(int(fw[4]), MONTHS[fw[3].lower()], int(fw[1])).isoformat()
        result["fw_end"] = date(int(fw[4]), MONTHS[fw[3].lower()], int(fw[2])).isoformat()
    return result


def cis_study(url: str, raw: bytes, source: dict, fetcher: Fetcher) -> dict:
    soup = BeautifulSoup(raw, "lxml")
    text = soup.get_text(" ", strip=True)
    title = soup.find("h1")
    title_text = title.get_text(" ", strip=True) if title else ""
    if not any(x in title_text.lower() for x in ["barómetro", "preelectoral", "elecciones generales"]):
        raise ValueError("No es un estudio electoral admitido")
    release = re.search(r"Fecha de avance\s+(\d{2}/\d{2}/\d{4})", text)
    if not release:
        release = re.search(r"Fecha de publicación\s+(\d{2}/\d{2}/\d{4})", text)
    if not release:
        raise ValueError("Falta fecha explícita de publicación o avance")
    published = datetime.strptime(release[1], "%d/%m/%Y").date().isoformat()
    links = soup.find_all("a", href=True)
    estimate = next((urljoin(url, a["href"]) for a in links if re.search(r"estimaci.n\s+(?:de\s+)?voto", a.get_text(" ", strip=True), re.I)), None)
    tech = next((urljoin(url, a["href"]) for a in links if "ficha técnica" in a.get_text(" ", strip=True).lower()), None)
    if not estimate:
        raise ValueError("Sin documento de estimación de voto; no se confunde intención con estimación")
    pdf = fetcher.get(estimate, source)
    pdf_text = "\n".join(p.extract_text(extraction_mode="layout") or "" for p in PdfReader(io.BytesIO(pdf)).pages)
    estimates = estimate_rows(pdf_text)
    technical = {"fw_start": None, "fw_end": None, "n": None}
    evidence = [{"role": "estimate", "url": estimate, "sha256": digest(pdf)}]
    if tech:
        tech_raw = fetcher.get(tech, source)
        technical = technical_data("\n".join(p.extract_text() or "" for p in PdfReader(io.BytesIO(tech_raw)).pages))
        evidence.append({"role": "technical", "url": tech, "sha256": digest(tech_raw)})
    return {"pollster": "CIS", "sponsor": "Centro de Investigaciones Sociológicas", "published_at": published,
            "type": "estimated_vote", "original_url": url, "est": estimates, **technical,
            "estimate_url": estimate, "technical_url": tech, "source_hash": digest(raw),
            "publication_evidence": {"url": url, "kind": "explicit_study_release", "value": release[1]},
            "document_evidence": evidence, "quality_flags": "primary_source;estimate_pdf", "title": title_text}


def cis_news(url: str, raw: bytes) -> dict:
    soup = BeautifulSoup(raw, "lxml")
    text = soup.get_text(" ", strip=True)
    pub = re.search(r"Madrid,\s*(\d{1,2})\s+(\w+)\s+(20\d{2})", text)
    if not pub or pub[2].lower() not in MONTHS:
        raise ValueError("La nota no tiene una fecha de publicación explícita")
    paragraph = next((p.get_text(" ", strip=True) for p in soup.find_all("p") if "estimación de voto" in p.get_text(" ", strip=True).lower() and "PSOE" in p.get_text()), "")
    pairs = re.findall(r"\b(PSOE|PP|VOX|Sumar|Frente Amplio|Podemos|ERC|Junts|EH Bildu|PNV|BNG|UPN)\b[^\d%]{0,90}(\d{1,2},\d+)\s*%", paragraph, re.I)
    if len(pairs) < 3:
        raise ValueError("Nota sin una estimación reconocible; requiere revisión")
    rows = []
    for label, value in pairs:
        mapped = PARTY_MAP.get(label.upper())
        rows.append({"p": mapped[1] if mapped else None, "label": label, "v": float(value.replace(",", ".")), "m": "mapped" if mapped and mapped[1] else "unmapped_label"})
    sample = re.search(r"total de\s+([\d.]+)\s+entrevistas", text)
    fieldwork_text = re.search(r"realizada entre los días\s+[^.]{1,90}?(?=,|\.)", text, re.I)
    return {"pollster": "CIS", "sponsor": "Centro de Investigaciones Sociológicas",
            "published_at": date(int(pub[3]), MONTHS[pub[2].lower()], int(pub[1])).isoformat(),
            "fw_start": None, "fw_end": None, "n": int(sample[1].replace(".", "")) if sample else None,
            "type": "estimated_vote", "original_url": url, "est": rows, "source_hash": digest(raw),
            "publication_evidence": {"url": url, "kind": "explicit_dated_news", "value": pub[0]},
            "quality_flags": "primary_source;partial_estimates;fieldwork_not_parsed",
            "fieldwork_text": fieldwork_text[0] if fieldwork_text else None,
            "title": soup.find("h1").get_text(" ", strip=True)}


def validate_poll(poll: dict, as_of: date) -> None:
    if poll.get("type") not in {"estimated_vote", "direct_intention"}:
        raise ValueError("Tipo de encuesta desconocido")
    published = date.fromisoformat(poll["published_at"])
    if published > as_of or not poll.get("publication_evidence") or not re.fullmatch(r"[a-f0-9]{64}", poll.get("source_hash", "")):
        raise ValueError("Publicación futura o sin evidencia/hash verificable")
    for field in ("fw_start", "fw_end"):
        if poll.get(field) and date.fromisoformat(poll[field]) > published:
            raise ValueError("Trabajo de campo posterior a la publicación")
    if poll.get("fw_start") and poll.get("fw_end") and poll["fw_start"] > poll["fw_end"]:
        raise ValueError("Ventana de campo invertida")
    if poll.get("n") is not None and (type(poll["n"]) is not int or poll["n"] < 1):
        raise ValueError("Muestra inválida")
    rows = poll.get("est", [])
    if len(rows) < 2 or len({r["label"].upper() for r in rows}) != len(rows):
        raise ValueError("Estimaciones ausentes o etiquetas duplicadas")
    if any(isinstance(r["v"], bool) or not isinstance(r["v"], (int, float)) or not math.isfinite(r["v"]) or not 0 <= r["v"] <= 100 for r in rows):
        raise ValueError("Porcentaje fuera de rango")
    if sum(r["v"] for r in rows) > 100.5:
        raise ValueError("La suma supera el 100 % más tolerancia de redondeo")
    if not poll.get("original_url", "").startswith("https://"):
        raise ValueError("Falta URL primaria HTTPS")


def identity(poll: dict) -> str:
    # Fieldwork + house + type detects syndicated duplicates. Without fieldwork,
    # use the primary publication date AND values; never merge different waves.
    key = [poll["pollster"].casefold(), poll["type"], poll.get("fw_start"), poll.get("fw_end")]
    if not poll.get("fw_end"):
        key += [poll["published_at"], sorted((r["label"].casefold(), r["v"]) for r in poll["est"])]
    return digest(json.dumps(key, ensure_ascii=False).encode())[:20]


def merge_polls(existing: list[dict], incoming: list[dict], as_of: date):
    result = {p["id"]: p for p in existing}
    seen = {identity(p): p["id"] for p in existing}
    by_url = {(unquote(p["original_url"]), p["published_at"], p["type"]): p["id"] for p in existing}
    events = []
    for item in incoming:
        validate_poll(item, as_of)
        key = identity(item)
        pid = "primary-" + key
        known_id = seen.get(key) or by_url.get((unquote(item["original_url"]), item["published_at"], item["type"]))
        if known_id:
            current = result[known_id]
            events.append({"status": "duplicate" if current["source_hash"] == item["source_hash"] else "revision", "url": item["original_url"], "id": current["id"]})
            if current["source_hash"] != item["source_hash"]:
                result[current["id"]] = {**item, "id": current["id"], "canonical": current["id"], "previous_hash": current["source_hash"]}
            else:
                result[current["id"]] = {**current, **item, "id": current["id"], "canonical": current["id"]}
        else:
            result[pid] = {**item, "id": pid, "canonical": pid}
            seen[key] = pid
            events.append({"status": "new", "id": pid, "url": item["original_url"]})
        by_url[(unquote(item["original_url"]), item["published_at"], item["type"])] = known_id or pid
    return sorted(result.values(), key=lambda p: (p["published_at"], p["id"]), reverse=True), events


def run_update(config: dict, store: Path = STORE, now: datetime | None = None, fetcher=None) -> dict:
    now = now or datetime.now(timezone.utc)
    state = editorial_status(now)
    manifest = {"retrieved_at": now.isoformat(), "mode": getattr(fetcher, "mode", "live"), "restricted": not state["polls_visible"], "sources": [], "events": [], "requests": []}
    # During restriction no network, no raw snapshots and no artifacts to diffuse.
    if not state["polls_visible"]:
        manifest["note"] = "Actualización detenida durante restricción editorial; no se difunden snapshots."
    else:
        fetcher = fetcher or Fetcher(store, now)
        existing = json.loads((store / "verified.json").read_text(encoding="utf-8")) if (store / "verified.json").exists() else []
        incoming = []
        for source in config["sources"]:
            try:
                raw = fetcher.get(source["url"], source)
                soup = BeautifulSoup(raw, "xml" if source["kind"] == "rss_discovery" else "lxml")
                if source["kind"] == "rss_discovery":
                    discovered = [{"title": x.title.get_text() if x.title else None, "url": x.link.get_text() if x.link else None,
                                   "published_text": x.pubDate.get_text() if x.pubDate else None} for x in soup.find_all("item")[:20]]
                    manifest["sources"].append({"id": source["id"], "status": "discovery_only", "publications": discovered, "numeric_extraction": False})
                    continue
                if not source.get("extraction_permitted") or not source.get("terms_url") or not source.get("reviewed_at"):
                    raise ValueError("Extracción no autorizada en el catálogo de fuentes")
                # Persist the actual terms evidence alongside every run.
                fetcher.get(source["terms_url"], source)
                discovered = []
                for a in soup.find_all("a", href=True):
                    href = urljoin(source["url"], a["href"])
                    title = a.get_text(" ", strip=True).lower()
                    if (("/es/estudios/" in href and any(x in title for x in ["barómetro de", "preelectoral elecciones generales"])) or
                            ("/es/w/" in href and "avance-de-resultados" not in href and any(x in title for x in ["votos", "estimación de voto", "barómetro de"]))):
                        discovered.append(href)
                urls = list(dict.fromkeys(discovered + source.get("seed_urls", [])))[:config.get("max_studies_per_run", 6)]
                count = 0
                for url in urls:
                    try:
                        body = fetcher.get(url, source)
                        poll = cis_news(url, body) if "/w/" in url and "avance-de-resultados" not in url else cis_study(url, body, source, fetcher)
                        poll.update({"source_id": source["id"], "source_license": source["license"], "retrieved_at": now.isoformat(), "publication_status": "verified_primary", "geography": "national-Congress"})
                        validate_poll(poll, date.fromisoformat(state["today_madrid"]))
                        incoming.append(poll); count += 1
                    except Exception as error:
                        manifest["events"].append({"status": "needs_review", "url": url, "error": str(error)})
                manifest["sources"].append({"id": source["id"], "status": "ok" if count else "no_verified_records", "verified": count})
            except Exception as error:
                manifest["sources"].append({"id": source["id"], "status": "failed", "error": str(error)})
        combined, events = merge_polls(existing, incoming, date.fromisoformat(state["today_madrid"]))
        manifest["events"] += events
        manifest["requests"] = fetcher.receipts
        if incoming:
            write_json(store / "verified.json", combined)
        manifest["verified_total"] = len(combined)
    run_id = now.strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex[:8]
    write_json(store / "runs" / f"{run_id}.json", manifest)
    write_json(store / "latest_run.json", manifest)
    return manifest


def main():
    parser = argparse.ArgumentParser(description="Actualiza encuestas para revisión, sin desplegar")
    parser.add_argument("--offline", action="store_true", help="Solo regenera JSON desde el registro verificado")
    parser.add_argument("--replay", type=Path, help="Reprocesa un manifiesto y sus snapshots sin red ni cambiar su fecha de recuperación")
    args = parser.parse_args()
    if not args.offline:
        config = json.loads((ROOT / "config" / "poll_updates.json").read_text(encoding="utf-8"))
        if args.replay:
            original = json.loads(args.replay.read_text(encoding="utf-8"))
            result = run_update(config, now=datetime.fromisoformat(original["retrieved_at"]), fetcher=SnapshotFetcher(STORE, original))
        else:
            result = run_update(config)
        print(json.dumps({k: v for k, v in result.items() if k not in {"requests", "events"}}, ensure_ascii=False, indent=2))
    from .web_publication import prepare_web
    prepare_web()


if __name__ == "__main__":
    main()
