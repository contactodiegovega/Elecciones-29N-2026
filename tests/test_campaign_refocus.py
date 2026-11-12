from datetime import date, datetime, timezone
from pathlib import Path
import sys

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from electoral.campaign import _eligible
from electoral.electoral_calendar import editorial_status
from electoral.polls import parse_fieldwork
from electoral.simulator import d_hondt


def test_unknown_publication_is_not_historical_evidence():
    rows = pd.DataFrame([
        {"estimate_type": "estimated_vote", "fw_end_d": date(2026, 11, 1), "pub_d": None},
        {"estimate_type": "estimated_vote", "fw_end_d": date(2026, 11, 1), "pub_d": date(2026, 11, 3)},
        {"estimate_type": "direct_intention", "fw_end_d": date(2026, 11, 1), "pub_d": date(2026, 11, 2)},
    ])
    assert _eligible(rows, date(2026, 11, 2)).empty
    assert len(_eligible(rows, date(2026, 11, 3))) == 1


def test_moratorium_uses_madrid_day_and_phase():
    assert editorial_status(datetime(2026, 11, 23, 22, 59, tzinfo=timezone.utc))["polls_visible"]
    state = editorial_status(datetime(2026, 11, 23, 23, 0, tzinfo=timezone.utc))
    assert not state["polls_visible"]
    assert state["phase"] == "moratorium"


def test_cross_year_range_uses_end_year():
    start, end, *_ = parse_fieldwork("29 Dec – 5 Jan 2026")
    assert (start, end) == ("2025-12-29", "2026-01-05")


def test_dhondt_threshold_counts_valid_votes():
    assert d_hondt({"A": 600, "B": 300, "C": 20}, 5, valid_votes=1000) == {
        "A": 4, "B": 1, "C": 0
    }
