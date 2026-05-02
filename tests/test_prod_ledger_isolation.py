"""
test_prod_ledger_isolation.py — KN099 isolation regression tests
=================================================================
Regression tests confirming that pytest fixtures fully isolate any
boundary-marker writes from the production ledger at
~/.claude/state/federation/session_boundary.jsonl.

Two tests:
  1. test_fixture_isolates_boundary_writes
     Exercises a fixture that triggers _do_rebind and asserts the prod ledger
     hash is unchanged before vs after.

  2. test_no_alpha_zero_latency_in_prod_ledger
     Reads the prod ledger and asserts there are no R11_shadow_alpha entries
     with rebind_latency_ms == 0 (the contamination pattern from KN097 dev cycle).
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from the_shadow.lifecycle import ShadowLifecycle


# ── Helpers ──────────────────────────────────────────────────────────────────

_PROD_LEDGER = (
    Path.home() / ".claude" / "state" / "federation" / "session_boundary.jsonl"
)


def _prod_hash() -> str:
    """Return SHA-256 of the current prod ledger, or empty string if absent."""
    if not _PROD_LEDGER.exists():
        return "<absent>"
    return hashlib.sha256(_PROD_LEDGER.read_bytes()).hexdigest()


def _make_isolated_lc(
    session_id: str = "BP013",
    *,
    session_file: Path,
    eblet_root: Path,
) -> ShadowLifecycle:
    lc = ShadowLifecycle(
        scribe_id="R11_shadow_alpha",
        lighthouse_position=1,
        session_id=session_id,
        heartbeat_interval_s=9999,
        bishop_check_interval_s=9999,
        eblet_root=eblet_root,
        session_poll_interval_s=9999,
        session_file_path=session_file,
    )
    lc._attach = MagicMock()
    lc._attach.write = MagicMock()
    lc._attach.read = MagicMock(return_value=None)
    return lc


# ── Test 1: fixture isolation ─────────────────────────────────────────────────


def test_fixture_isolates_boundary_writes(tmp_path: Path) -> None:
    """
    A fixture that triggers _do_rebind must not modify the prod ledger.

    Setup:   snapshot prod ledger hash
    Body:    invoke _do_rebind 5 times (simulating the KN097 contamination scenario)
    Assert:  prod ledger hash unchanged
    """
    hash_before = _prod_hash()

    session_file = tmp_path / "current_session_name.txt"
    session_file.write_text("BP013", encoding="utf-8")
    eblet_root = tmp_path / "eblets"
    eblet_root.mkdir()

    lc = _make_isolated_lc(
        session_id="BP013",
        session_file=session_file,
        eblet_root=eblet_root,
    )

    # Drive 5 rebinds — the exact scenario that contaminated the prod ledger in KN097.
    # The autouse _isolate_prod_paths fixture in conftest.py ensures SESSION_BOUNDARY_JSONL
    # is redirected to tmp_path before this runs.
    for i in range(15, 20):
        lc._do_rebind(f"BP{i:03d}", f"BP{i + 1:03d}", 0)

    hash_after = _prod_hash()

    assert hash_before == hash_after, (
        "ISOLATION FAILURE: prod ledger was modified during test! "
        f"Before={hash_before[:16]}... After={hash_after[:16]}..."
    )

    # Boundary markers must have gone to the tmp_path ledger, NOT prod
    tmp_fed = tmp_path / "federation"
    if tmp_fed.exists():
        tmp_ledger = tmp_fed / "session_boundary.jsonl"
        if tmp_ledger.exists():
            lines = tmp_ledger.read_text(encoding="utf-8").strip().splitlines()
            assert len(lines) == 5, (
                f"Expected 5 boundary markers in tmp ledger; got {len(lines)}"
            )
            for raw in lines:
                marker = json.loads(raw)
                assert marker["scribe_id"] == "R11_shadow_alpha"
                assert marker["rebind_latency_ms"] == 0


# ── Test 2: prod-ledger purity regression ────────────────────────────────────


def test_no_alpha_zero_latency_in_prod_ledger() -> None:
    """
    Regression: prod ledger must contain no R11_shadow_alpha entries with
    rebind_latency_ms == 0 (the specific contamination signature from
    test_previous_session_ids_capped_at_16 in KN097 dev cycle).
    """
    if not _PROD_LEDGER.exists():
        pytest.skip("Prod ledger absent — nothing to check")

    contaminating: list[dict] = []
    for raw in _PROD_LEDGER.read_text(encoding="utf-8").splitlines():
        raw = raw.strip()
        if not raw:
            continue
        try:
            obj = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if (
            obj.get("scribe_id") == "R11_shadow_alpha"
            and obj.get("rebind_latency_ms") == 0
        ):
            contaminating.append(obj)

    assert not contaminating, (
        f"Prod ledger contains {len(contaminating)} contaminating line(s) "
        f"(R11_shadow_alpha + rebind_latency_ms==0). "
        f"Run the KN099 cleanup script to remove them. "
        f"First offender: {contaminating[0]}"
    )
