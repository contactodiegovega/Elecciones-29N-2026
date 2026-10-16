"""Registro centralizado de colores identificativos por partido (FASE 2).

- Fuente editable: config/party_colors.json
- get_party_color(party_id, election_date=None): lookup con validez temporal + fallback
  determinista (hash md5 -> paleta, estable entre ejecuciones; nunca aleatorio).
- La regla semántica PP=azul / PSOE=rojo / VOX=verde se comprueba por test (tono, no HEX).
"""
from __future__ import annotations

import colorsys
import hashlib
import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / "config" / "party_colors.json"
PROCESSED = ROOT / "data" / "processed"

# Paleta neutra de reserva (Paul Tol / tab20 reorder, sin corporativos)
FALLBACK_PALETTE = [
    "#696969", "#8C564B", "#7F7F7F", "#BCBD22", "#17BECF", "#9E9E9E",
    "#607D8B", "#795548", "#9CCC65", "#4DD0E1", "#BA68C8", "#7986CB",
]


def load_registry() -> dict:
    return json.loads(CONFIG.read_text(encoding="utf-8"))


def _in_range(entry: dict, when: date | None) -> bool:
    if when is None:
        return True
    vf, vt = entry.get("valid_from"), entry.get("valid_to")
    if vf and str(when) < vf:
        return False
    if vt and str(when) > vt:
        return False
    return True


def get_party_color(party_id: str | None, election_date=None) -> tuple[str, str]:
    """Devuelve (hex, origen) con origen en {registry, fallback}.

    election_date acepta date/str/None. Fuera de vigencia -> fallback determinista.
    """
    when = None
    if election_date is not None:
        when = election_date if isinstance(election_date, date) else date.fromisoformat(str(election_date)[:10])
    if party_id:
        for e in load_registry()["parties"]:
            if e["party_id"] == party_id and _in_range(e, when):
                return (e["hex_color"], "registry")
    key = str(party_id or "UNKNOWN")
    idx = int(hashlib.md5(key.encode("utf-8")).hexdigest(), 16) % len(FALLBACK_PALETTE)
    return (FALLBACK_PALETTE[idx], "fallback")


def is_blue(hex_color: str) -> bool:
    return _hue_family(hex_color) == "blue"


def is_red(hex_color: str) -> bool:
    return _hue_family(hex_color) == "red"


def is_green(hex_color: str) -> bool:
    return _hue_family(hex_color) == "green"


def _hue_family(hex_color: str) -> str:
    h, *_ = colorsys.rgb_to_hsv(*[int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)])
    h *= 360
    if h < 15 or h >= 345:
        return "red"
    if 80 <= h < 165:
        return "green"
    if 200 <= h < 260:
        return "blue"
    return "other"


def export_readonly() -> Path:
    PROCESSED.mkdir(parents=True, exist_ok=True)
    data = load_registry()
    out = {"generated_from": "config/party_colors.json", "entries": len(data["parties"]), "parties": data["parties"]}
    dest = PROCESSED / "party_colors.json"
    dest.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    return dest


if __name__ == "__main__":
    dest = export_readonly()
    print("[colors] export:", dest)
    for p in ["PP", "PSOE", "VOX"]:
        print(" ", p, get_party_color(p))
