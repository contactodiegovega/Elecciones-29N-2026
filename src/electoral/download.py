"""Descarga de fuentes oficiales FASE 1 con auditoría trazable."""
from __future__ import annotations

import csv
import hashlib
import sys
from datetime import datetime, timezone
from pathlib import Path
import urllib.request
import ssl

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"

SOURCES = [
    {
        "id": "interior_congreso_xlsx",
        "url": "https://descargas.interior.gob.es/datasets/resultados_electorales/Elecciones-Congreso.xlsx",
        "filename": "Elecciones-Congreso.xlsx",
        "provider": "Ministerio del Interior",
        "desc": "Excel oficial resultados Congreso",
    },
    {
        "id": "ine_poblacion_67988",
        "url": "https://www.ine.es/jaxiT3/files/t/csv_bdsc/67988.csv",
        "filename": "ine_67988_poblacion_provincial.csv",
        "provider": "INE",
        "desc": "Población provincial anual por sexo (tabla 67988)",
    },
]

# Fuentes solo de contexto / verificación HEAD (no descarga binaria)
CONTEXT_SOURCES = [
    {"id": "datos_gob_catalogo", "url": "https://datos.gob.es/es/catalogo/e00003801-resultados-electorales", "provider": "datos.gob.es"},
    {"id": "infoelectoral_descargas", "url": "https://infoelectoral.interior.gob.es/es/elecciones-celebradas/area-de-descargas/", "provider": "Ministerio del Interior"},
    {"id": "ine_datosabiertos", "url": "https://www.ine.es/datosabiertos/", "provider": "INE"},
    {"id": "boe_2026_contexto", "url": "https://boe.es/diario_boe/txt.php?id=BOE-A-2026-20742", "provider": "BOE"},
]


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def download_url(url: str, dest: Path) -> dict:
    """Descarga con fallback SSL (verify off) solo si falla la verificación estricta."""
    import requests
    import warnings

    ssl_mode = "strict"
    try:
        with requests.get(url, stream=True, timeout=60) as r:
            r.raise_for_status()
            total = 0
            with open(dest, "wb") as f:
                for chunk in r.iter_content(chunk_size=1024 * 256):
                    if chunk:
                        f.write(chunk)
                        total += len(chunk)
            return {"ok": True, "bytes": total, "ssl_mode": ssl_mode,
                    "content_type": r.headers.get("Content-Type", "")}
    except requests.exceptions.SSLError as e:
        warnings.filterwarnings("ignore")
        try:
            with requests.get(url, stream=True, timeout=60, verify=False) as r:
                r.raise_for_status()
                total = 0
                with open(dest, "wb") as f:
                    for chunk in r.iter_content(chunk_size=1024 * 256):
                        if chunk:
                            f.write(chunk)
                            total += len(chunk)
            ssl_mode = "insecure-fallback (cert chain no verificado por el entorno Python)"
            return {"ok": True, "bytes": total, "ssl_mode": ssl_mode,
                    "content_type": r.headers.get("Content-Type", ""), "ssl_warning": str(e)[:200]}
        except Exception as e2:
            return {"ok": False, "error": f"SSL-fallback failed: {e2}", "ssl_mode": ssl_mode}
    except Exception as e:
        return {"ok": False, "error": str(e)[:500], "ssl_mode": ssl_mode}


def probe_url(url: str) -> dict:
    import requests
    try:
        r = requests.head(url, allow_redirects=True, timeout=20)
        return {"ok": r.status_code < 400, "status": r.status_code}
    except Exception as e:
        # reintento con verify=False para diagnóstico
        try:
            import warnings
            warnings.filterwarnings("ignore")
            r = requests.head(url, allow_redirects=True, timeout=20, verify=False)
            return {"ok": r.status_code < 400, "status": r.status_code, "note": f"only-with-verify-False; err: {e}"[:300]}
        except Exception as e2:
            return {"ok": False, "error": str(e2)[:300]}


def main() -> int:
    RAW.mkdir(parents=True, exist_ok=True)
    PROCESSED.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc).isoformat()
    rows: list[dict] = []

    for s in SOURCES:
        dest = RAW / s["filename"]
        print(f"[download] {s['id']} <- {s['url']}")
        res = download_url(s["url"], dest)
        entry = {
            "source_id": s["id"],
            "provider": s["provider"],
            "url": s["url"],
            "filename": s["filename"],
            "query_date_utc": now,
            "download_ok": res.get("ok", False),
            "bytes": res.get("bytes", ""),
            "sha256": sha256_of(dest) if res.get("ok") and dest.exists() else "",
            "content_type": res.get("content_type", ""),
            "ssl_mode": res.get("ssl_mode", ""),
            "error": res.get("error", "") or res.get("ssl_warning", ""),
            "license_note": "Uso público oficial; verificar condiciones en web del proveedor",
        }
        rows.append(entry)
        print(f"  -> ok={entry['download_ok']} bytes={entry['bytes']} sha256={entry['sha256'][:16] if entry['sha256'] else ''}...")

    for s in CONTEXT_SOURCES:
        print(f"[probe] {s['id']} <- {s['url']}")
        res = probe_url(s["url"])
        rows.append({
            "source_id": s["id"],
            "provider": s["provider"],
            "url": s["url"],
            "filename": "",
            "query_date_utc": now,
            "download_ok": "",
            "bytes": "",
            "sha256": "",
            "content_type": "",
            "ssl_mode": "",
            "error": "",
            "license_note": "Solo contexto/verificación HEAD; BOE-2026 NO contiene resultados (fecha convocatoria)",
            "probe_ok": res.get("ok", ""),
            "probe_status": res.get("status", res.get("error", "")),
        })

    audit_path = PROCESSED / "source_audit.csv"
    fieldnames = ["source_id", "provider", "url", "filename", "query_date_utc",
                  "download_ok", "bytes", "sha256", "content_type", "ssl_mode",
                  "error", "license_note", "probe_ok", "probe_status"]
    # Conserva filas de otros módulos (p. ej. polls_*) para invariancia al orden de ejecución
    if audit_path.exists():
        try:
            prev = list(csv.DictReader(open(audit_path, encoding="utf-8")))
            mine = {r["source_id"] for r in rows}
            rows = rows + [r for r in prev if r.get("source_id") not in mine]
        except Exception as e:
            print(f"[audit] aviso: no se pudo conservar auditoría previa ({e})")
    with open(audit_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    print(f"[audit] {audit_path} ({len(rows)} fuentes)")
    failed = [r for r in rows if r.get("download_ok") is False]
    if failed:
        print(f"[warn] {len(failed)} descargas fallidas: {[r['source_id'] for r in failed]}")
    return 0 if not failed else 2


if __name__ == "__main__":
    sys.exit(main())
