"""FASE 4 — Reglas de vintage: qué referencia puede usarse en cada corte.

Solo se permite lo PUBLICADO antes de la elección/corte. Sin metadatos de release
por vintage en origen, se aplican reglas conservadoras documentadas:
- Padrón 1-ene (36780/2852): se publica por RD en diciembre del año de referencia
  -> referencia válida: año < año de elección (vintage_status='rule').
- EPA trimestral: publicado ~30-45 días tras fin de trimestre -> último trimestre con
  fin+45d < elección (vintage_status='rule').
- ADRH anual: retardo ~2 años (asumido, verificar manualmente) -> referencia <= año-2
  (vintage_status='assumed').
- Censo 67217: fecha de publicación no verificable por vintage -> EDA_only.
"""
from __future__ import annotations

import calendar
from datetime import date

EPA_LAG_DAYS = 45
ADRH_LAG_YEARS = 2


def vintage_padron(election: date) -> tuple[int, str, str]:
    ref = election.year - 1
    return (ref, f"1-ene-{ref} (publ. dic-{ref}, anterior a {election.isoformat()})", "rule")


def vintage_epa(election: date) -> tuple[str, str, str]:
    y, q = election.year, (election.month - 1) // 3 + 1
    for _ in range(40):  # retrocede hasta encontrar trimestre publicado a tiempo
        q -= 1
        if q == 0:
            q, y = 4, y - 1
        month_end = q * 3
        last = calendar.monthrange(y, month_end)[1]
        from datetime import timedelta
        if date(y, month_end, last) + timedelta(days=EPA_LAG_DAYS) < election:
            tag = f"{y}T{q}"
            return (tag, f"trimestre {tag} (fin+{EPA_LAG_DAYS}d < {election.isoformat()})", "rule")
    raise ValueError("sin trimestre EPA válido")


def vintage_adrh(election: date) -> tuple[int, str, str]:
    ref = election.year - ADRH_LAG_YEARS
    return (ref, f"año {ref} (lag {ADRH_LAG_YEARS}a ASUMIDO, verificar manualmente)", "assumed")


def is_usable(release: date, as_of: date) -> bool:
    """Guarda real: un dato solo entra a train/test si se publicó antes del corte."""
    return release < as_of
