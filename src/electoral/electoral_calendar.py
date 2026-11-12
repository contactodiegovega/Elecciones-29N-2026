# -*- coding: utf-8 -*-
"""Calendario editorial y guardia LOREG 69.7 (Europe/Madrid).

La difusión de sondeos electorales está prohibida durante los cinco días
anteriores a la votación. Para el 29N-2026: 24, 25, 26, 27 y 28 de noviembre.
El guardián es fail-closed: si la fecha cae en la veda, las capas públicas
ocultan sondeos y derivados hasta revisión jurídica.

Uso:
  python src/electoral/calendar.py
  python src/electoral/calendar.py --at 2026-11-24T12:00:00+01:00
"""
from __future__ import annotations

import argparse
import json
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

MADRID = ZoneInfo("Europe/Madrid")
ELECTION_DATE = date(2026, 11, 29)
CAMPAIGN_START = date(2026, 11, 13)
CAMPAIGN_END = date(2026, 11, 27)
MORATORIUM_START = date(2026, 11, 24)
MORATORIUM_END = date(2026, 11, 28)

LEGAL_NOTE = (
    "LOREG art. 69.7: prohibida la publicación, difusión o reproducción de "
    "sondeos electorales durante los cinco días anteriores a la votación "
    "(24–28 de noviembre de 2026). Guardián fail-closed sujeto a revisión jurídica."
)


def madrid_now(now: datetime | None = None) -> datetime:
    """Normaliza a Europe/Madrid. Naive se interpreta como UTC (nunca como local)."""
    if now is None:
        now = datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    return now.astimezone(MADRID)


def _phase(d: date) -> str:
    if d < CAMPAIGN_START:
        return "pre_campaign"
    if CAMPAIGN_START <= d <= CAMPAIGN_END:
        return "campaign"
    if MORATORIUM_START <= d <= MORATORIUM_END:
        return "moratorium"
    if d == ELECTION_DATE:
        return "election_day"
    return "post_election"


def editorial_status(now: datetime | None = None) -> dict:
    """Estado editorial y visibilidad pública de sondeos/derivados."""
    dt = madrid_now(now)
    d = dt.date()
    restricted = MORATORIUM_START <= d <= MORATORIUM_END
    phase = _phase(d)
    if restricted:
        reason = "Veda legal LOREG 69.7: sondeos y derivados ocultos (fail-closed)."
    elif phase == "election_day":
        reason = "Jornada electoral: sin sondeos ni proyecciones propias en abierto."
    elif phase == "pre_campaign":
        reason = "Precampaña: se muestran mediciones publicadas con su fecha de campo."
    elif phase == "campaign":
        reason = "Campaña oficial: se muestran mediciones publicadas con su fecha de campo."
    else:
        reason = "Postelectoral: histórico disponible; no se publican pronósticos propios."
    return {
        "now_madrid": dt.isoformat(),
        "today_madrid": d.isoformat(),
        "phase": phase,
        "polls_visible": not restricted,
        "poll_derived_visible": not restricted,
        "simulator_poll_baseline_visible": not restricted,
        "restricted": restricted,
        "restriction_start": MORATORIUM_START.isoformat(),
        "restriction_end": MORATORIUM_END.isoformat(),
        "campaign_start": CAMPAIGN_START.isoformat(),
        "campaign_end": CAMPAIGN_END.isoformat(),
        "election_date": ELECTION_DATE.isoformat(),
        "reason": reason,
        "legal_note": LEGAL_NOTE,
    }


def poll_publication_allowed(now: datetime | None = None) -> bool:
    return bool(editorial_status(now)["polls_visible"])


def _parse_at(text: str | None) -> datetime | None:
    if not text:
        return None
    return datetime.fromisoformat(text)


def main() -> None:
    ap = argparse.ArgumentParser(description="Estado editorial LOREG 69.7")
    ap.add_argument("--at", help="Fecha ISO con zona (por defecto ahora)")
    args = ap.parse_args()
    print(json.dumps(editorial_status(_parse_at(args.at)), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
