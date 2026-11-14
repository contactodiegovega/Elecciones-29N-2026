from copy import deepcopy
from datetime import date, datetime, timezone
import json
from pathlib import Path

import pytest

from src.electoral.poll_updates import (cis_news, digest, estimate_rows, identity, merge_polls,
                                       robots_allowed, run_update, technical_data, validate_poll, write_json)
from src.electoral.web_publication import assert_public_release, prepare_web
from src.electoral.electoral_calendar import editorial_status

ROOT = Path(__file__).resolve().parents[1]
NOW = datetime(2026, 11, 14, 12, tzinfo=timezone.utc)


def poll(**changes):
    record = {"id": "primary-example", "canonical": "primary-example", "pollster": "Casa de prueba", "sponsor": None,
              "type": "estimated_vote", "published_at": "2026-11-12", "fw_start": "2026-11-01", "fw_end": "2026-11-10", "n": 1000,
              "source_hash": "a" * 64, "original_url": "https://example.org/poll", "publication_evidence": {"kind": "dated_source"},
              "publication_status": "verified_primary", "est": [{"p": "PP", "label": "PP", "v": 30, "m": "mapped"}, {"p": "PSOE", "label": "PSOE", "v": 29, "m": "mapped"}]}
    return {**record, **changes}


def test_pdf_estimate_uses_estimation_not_direct_intention_column():
    rows = estimate_rows("Voto directo en la encuesta    Margen teórico    Estimación de voto CIS\nPSOE    25,3   ±1,2    34\nPP     14,7   ±1,2    22,2\nVOX   11,6   ±0,9    17,1\nEn blanco    3,2   ±0,5    0,3\nVoto nulo   1,9   ±0,4")
    assert [(r["label"], r["v"]) for r in rows] == [("PSOE", 34), ("PP", 22.2), ("VOX", 17.1), ("En blanco", 0.3)]
    with pytest.raises(ValueError):
        estimate_rows("Intención directa\nPP 31,0\nPSOE 29,0\nVOX 15,0")


def test_technical_data_does_not_fabricate_missing_values():
    assert technical_data("Realizada: 5.025 entrevistas. Del 1 al 8 de octubre de 2026") == {"n": 5025, "fw_start": "2026-10-01", "fw_end": "2026-10-08"}
    assert technical_data("Sin información de campo") == {"n": None, "fw_start": None, "fw_end": None}


@pytest.mark.parametrize("change", [
    {"published_at": "2026-11-15"}, {"publication_evidence": None}, {"source_hash": "unknown"},
    {"fw_end": "2026-11-13"}, {"fw_start": "2026-11-11"}, {"n": -1}, {"type": "invented"},
    {"est": [{"label": "PP", "v": 120}, {"label": "PSOE", "v": 1}]},
    {"est": [{"label": "PP", "v": 70}, {"label": "PSOE", "v": 60}]},
    {"est": [{"label": "PP", "v": float("nan")}, {"label": "PSOE", "v": 1}]},
    {"est": [{"label": "PP", "v": 1}, {"label": "PP", "v": 2}]},
])
def test_invalid_poll_is_rejected(change):
    with pytest.raises((ValueError, TypeError)):
        validate_poll(poll(**change), NOW.date())


def test_duplicate_and_type_separation():
    original = poll()
    merged, events = merge_polls([original], [deepcopy(original)], NOW.date())
    assert len(merged) == 1
    assert events[0]["status"] == "duplicate"
    intention = poll(type="direct_intention")
    assert identity(original) != identity(intention)
    merged, _ = merge_polls([original], [intention], NOW.date())
    assert len(merged) == 2


def test_revised_data_retains_previous_hash():
    update = poll(source_hash="b" * 64, est=[{"p": "PP", "label": "PP", "v": 31, "m": "mapped"}, {"p": "PSOE", "label": "PSOE", "v": 29, "m": "mapped"}])
    merged, events = merge_polls([poll()], [update], NOW.date())
    assert len(merged) == 1
    assert events[0]["status"] == "revision"
    assert merged[0]["previous_hash"] == "a" * 64


def test_primary_news_date_is_not_fieldwork_date():
    raw = b'<h1>Survey</h1><p>Madrid, 12 noviembre 2026</p><p>La estimaci\xc3\xb3n de voto del PSOE alcanza el 33,3%, PP 25,5% y VOX 18,4%.</p>'
    result = cis_news("https://www.cis.es/es/w/example", raw)
    assert result["published_at"] == "2026-11-12"
    assert result["fw_end"] is None
    assert result["source_hash"] == digest(raw)


def test_robots_respects_wildcards_and_specific_allow():
    text = "User-Agent: *\nDisallow: /private/*\nDisallow: /*?token=*\nAllow: /private/public$"
    assert not robots_allowed(text, "https://example.org/private/a")
    assert robots_allowed(text, "https://example.org/private/public")
    assert not robots_allowed(text, "https://example.org/data?token=secret")
    assert robots_allowed(text, "https://example.org/studies")


def test_failure_keeps_last_valid_registry_and_creates_a_real_run(tmp_path):
    write_json(tmp_path / "verified.json", [poll()])
    class FailedFetcher:
        receipts = []
        def get(self, *args, **kwargs):
            raise RuntimeError("HTTP 503")
    result = run_update({"sources": [{"id": "failed", "url": "https://example.org/feed"}]}, tmp_path, NOW, FailedFetcher())
    assert result["sources"][0]["status"] == "failed"
    assert json.loads((tmp_path / "verified.json").read_text())[0]["id"] == "primary-example"
    assert len(list((tmp_path / "runs").glob("*.json"))) == 1


def test_moratorium_does_not_fetch_sources(tmp_path):
    class NeverFetch:
        def get(self, *args, **kwargs):
            raise AssertionError("No network in moratorium")
    result = run_update({"sources": [{"id": "example"}]}, tmp_path, datetime(2026, 11, 25, tzinfo=timezone.utc), NeverFetch())
    assert result["restricted"]
    assert result["requests"] == []


def test_static_json_and_old_campaign_are_empty_during_restriction(tmp_path):
    public = tmp_path / "public"
    store = tmp_path / "store"
    write_json(store / "verified.json", [poll()])
    write_json(public / "campaign.json", {"as_of": "2026-11-12", "snapshots": [{"parties": {"PP": 33}}]})
    prepare_web(public, store, datetime(2026, 11, 25, tzinfo=timezone.utc), ROOT)
    for file in ["polls_2023.json", "polls_2026.json", "latest_polls.json"]:
        assert json.loads((public / file).read_text())["polls"] == []
    assert json.loads((public / "campaign.json").read_text())["snapshots"] == []
    assert json.loads((store / "verified.json").read_text())[0]["est"]
    # A legacy export cannot slip through under an old URL.
    write_json(public / "polls_old.json", {"polls": [poll()]})
    with pytest.raises(RuntimeError, match="no clasificada"):
        prepare_web(public, store, datetime(2026, 11, 25, tzinfo=timezone.utc), ROOT)


def test_public_release_blocked_until_authorization_and_cache_withdrawal():
    status = editorial_status(NOW)
    with pytest.raises(RuntimeError, match="PUBLICACIÓN BLOQUEADA"):
        assert_public_release(json.loads((ROOT / "config/publication_policy.json").read_text()), status)
    policy = {k: True for k in ["public_release_authorized", "cache_withdrawal_verified", "legacy_urls_withdrawal_verified"]}
    assert_public_release(policy, status)
    with pytest.raises(RuntimeError):
        assert_public_release(policy, editorial_status(datetime(2026, 11, 25, tzinfo=timezone.utc)))
    assert not editorial_status(datetime(2026, 11, 29, 12, tzinfo=timezone.utc))["polls_visible"]


def test_no_primary_card_without_the_matching_snapshot(tmp_path, monkeypatch):
    import src.electoral.web_publication as module
    monkeypatch.setattr(module, "export_archive", lambda *args: None)
    public, store = tmp_path / "public", tmp_path / "store"
    item = poll()
    write_json(store / "verified.json", [item])
    assert prepare_web(public, store, NOW)["polls"] == []
    raw = b"An actual captured source response"
    item["source_hash"] = digest(raw)
    (store / "raw").mkdir()
    (store / "raw" / f"{item['source_hash']}.bin").write_bytes(raw)
    write_json(store / "verified.json", [item])
    assert len(prepare_web(public, store, NOW)["polls"]) == 1
    (store / "raw" / f"{item['source_hash']}.bin").write_bytes(b"tampered")
    assert prepare_web(public, store, NOW)["polls"] == []
