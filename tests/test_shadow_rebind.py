"""
test_shadow_rebind.py — KN097 Shadow Graceful Session-Rebind test suite
=======================================================================
Covers Phases 1-5 of the graceful-rebind implementation in the_shadow/lifecycle.py.
"""
from __future__ import annotations

import json
import os
import platform
import signal
import sys
import threading
import time
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from the_shadow.lifecycle import (
    SESSION_ID_PATTERN,
    ShadowLifecycle,
    ShadowState,
)


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture()
def tmp_session_file(tmp_path: Path) -> Path:
    """A writable current_session_name.txt in a temp dir."""
    f = tmp_path / "current_session_name.txt"
    f.write_text("BP013", encoding="utf-8")
    return f


@pytest.fixture()
def tmp_federation_dir(tmp_path: Path) -> Path:
    d = tmp_path / "federation"
    d.mkdir()
    return d


@pytest.fixture()
def tmp_eblet_root(tmp_path: Path) -> Path:
    # Base directory only — session subdir is created by ShadowLifecycle.start() (KN098).
    d = tmp_path / "eblets"
    d.mkdir(parents=True)
    return d


def _make_lc(
    scribe_id: str = "R11_shadow_alpha",
    lighthouse_position: int = 1,
    session_id: str = "BP013",
    *,
    session_file: Path,
    eblet_root: Path,
    poll_interval_s: float = 0.1,
) -> ShadowLifecycle:
    """Build a ShadowLifecycle wired to temp paths with a fast poll interval."""
    lc = ShadowLifecycle(
        scribe_id=scribe_id,
        lighthouse_position=lighthouse_position,
        session_id=session_id,
        heartbeat_interval_s=9999,
        bishop_check_interval_s=9999,
        eblet_root=eblet_root,
        session_poll_interval_s=poll_interval_s,
        session_file_path=session_file,
    )
    # Patch IronTabletAttach.write so tests don't touch real disk
    lc._attach = MagicMock()
    lc._attach.write = MagicMock()
    lc._attach.read = MagicMock(return_value=None)
    return lc


# ── Phase 1: SESSION_ID_PATTERN ────────────────────────────────────────────────


def test_session_id_pattern_valid():
    for s in ("BP001", "BP013", "BP012", "BP9999"):
        assert SESSION_ID_PATTERN.match(s), f"Expected {s!r} to match"


def test_session_id_pattern_invalid():
    for s in ("", " ", "KN097", "bp013", "BP", "BP_013", "012"):
        assert not SESSION_ID_PATTERN.match(s), f"Expected {s!r} NOT to match"


# ── Phase 2: initial session from flag ────────────────────────────────────────


def test_session_id_initially_from_flag(tmp_session_file, tmp_eblet_root):
    lc = _make_lc(
        session_id="BP013",
        session_file=tmp_session_file,
        eblet_root=tmp_eblet_root,
    )
    assert lc._state.session_id == "BP013"
    lc.start()
    time.sleep(0.05)
    lc.stop()
    lc.wait_for_stop(timeout=2.0)
    # Session must still be BP013 (file also says BP013)
    assert lc._state.session_id == "BP013"


# ── Phase 2+3: file change triggers rebind ────────────────────────────────────


def test_file_change_triggers_rebind(tmp_session_file, tmp_eblet_root, tmp_path):
    boundary_jsonl = tmp_path / "federation" / "session_boundary.jsonl"

    lc = _make_lc(
        session_id="BP013",
        session_file=tmp_session_file,
        eblet_root=tmp_eblet_root,
        poll_interval_s=0.1,
    )

    with patch("the_shadow.lifecycle.SESSION_BOUNDARY_JSONL", boundary_jsonl), \
         patch("the_shadow.lifecycle.FEDERATION_DIR", boundary_jsonl.parent):
        lc.start()
        time.sleep(0.15)  # let monitor do first poll (no rebind — same session)

        # Write new session to the file
        tmp_session_file.write_text("BP012", encoding="utf-8")
        time.sleep(0.4)  # wait ≥ 2 × poll_interval

        lc.stop()
        lc.wait_for_stop(timeout=2.0)

    assert lc._state.session_id == "BP012", (
        f"Expected BP012, got {lc._state.session_id!r}"
    )

    # Boundary marker must have been written
    assert boundary_jsonl.exists(), "session_boundary.jsonl not created"
    lines = boundary_jsonl.read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) >= 1, "No boundary marker lines written"
    marker = json.loads(lines[-1])
    assert marker["previous_session_id"] == "BP013"
    assert marker["new_session_id"] == "BP012"
    assert marker["trigger"] == "current_session_name_change"
    assert "rebind_latency_ms" in marker
    assert marker["rebind_latency_ms"] >= 0


# ── Phase 2: invalid session rejected ─────────────────────────────────────────


@pytest.mark.parametrize("bad_value", ["", "   ", "KN097", "notabpsession", "BP"])
def test_invalid_session_rejected(bad_value, tmp_session_file, tmp_eblet_root):
    lc = _make_lc(
        session_id="BP013",
        session_file=tmp_session_file,
        eblet_root=tmp_eblet_root,
        poll_interval_s=0.1,
    )
    lc.start()
    time.sleep(0.15)

    tmp_session_file.write_text(bad_value, encoding="utf-8")
    time.sleep(0.35)

    lc.stop()
    lc.wait_for_stop(timeout=2.0)

    assert lc._state.session_id == "BP013", (
        f"Daemon should NOT rebind on invalid value {bad_value!r}; "
        f"got {lc._state.session_id!r}"
    )


# ── Phase 2: concurrent rebinds serialized ────────────────────────────────────


def test_concurrent_rebinds_serialized(tmp_session_file, tmp_eblet_root, tmp_path):
    """5 rapid rewrites must not produce a torn state_id."""
    boundary_jsonl = tmp_path / "federation" / "session_boundary.jsonl"

    lc = _make_lc(
        session_id="BP001",
        session_file=tmp_session_file,
        eblet_root=tmp_eblet_root,
        poll_interval_s=0.05,
    )

    sequence = [f"BP{100 + i}" for i in range(5)]

    with patch("the_shadow.lifecycle.SESSION_BOUNDARY_JSONL", boundary_jsonl), \
         patch("the_shadow.lifecycle.FEDERATION_DIR", boundary_jsonl.parent):
        lc.start()
        time.sleep(0.1)

        for val in sequence:
            tmp_session_file.write_text(val, encoding="utf-8")
            time.sleep(0.06)  # just over one poll cycle each

        time.sleep(0.3)
        lc.stop()
        lc.wait_for_stop(timeout=3.0)

    # Final session must be one of the valid BP values — not torn / empty
    assert SESSION_ID_PATTERN.match(lc._state.session_id), (
        f"State torn or invalid: {lc._state.session_id!r}"
    )


# ── Phase 3: rebind_latency_ms field present ──────────────────────────────────


def test_rebind_latency_recorded(tmp_session_file, tmp_eblet_root, tmp_path):
    boundary_jsonl = tmp_path / "federation" / "session_boundary.jsonl"

    lc = _make_lc(
        session_id="BP013",
        session_file=tmp_session_file,
        eblet_root=tmp_eblet_root,
        poll_interval_s=0.1,
    )

    with patch("the_shadow.lifecycle.SESSION_BOUNDARY_JSONL", boundary_jsonl), \
         patch("the_shadow.lifecycle.FEDERATION_DIR", boundary_jsonl.parent):
        lc.start()
        time.sleep(0.15)
        tmp_session_file.write_text("BP012", encoding="utf-8")
        time.sleep(0.4)
        lc.stop()
        lc.wait_for_stop(timeout=2.0)

    assert boundary_jsonl.exists()
    line = json.loads(
        boundary_jsonl.read_text(encoding="utf-8").strip().splitlines()[-1]
    )
    assert "rebind_latency_ms" in line
    assert isinstance(line["rebind_latency_ms"], int)
    assert line["rebind_latency_ms"] >= 0


# ── Phase 4: heartbeat picks up new tag ───────────────────────────────────────


def test_heartbeat_reflects_new_session_after_rebind(
    tmp_session_file, tmp_eblet_root, tmp_path
):
    boundary_jsonl = tmp_path / "federation" / "session_boundary.jsonl"

    lc = _make_lc(
        session_id="BP013",
        session_file=tmp_session_file,
        eblet_root=tmp_eblet_root,
        poll_interval_s=0.1,
    )

    heartbeat_calls: list[str] = []

    original_write = lc._attach.write

    def capture_write(path, content, **kwargs):
        heartbeat_calls.append(content)

    lc._attach.write = capture_write

    with patch("the_shadow.lifecycle.SESSION_BOUNDARY_JSONL", boundary_jsonl), \
         patch("the_shadow.lifecycle.FEDERATION_DIR", boundary_jsonl.parent):
        lc.start()
        time.sleep(0.15)
        tmp_session_file.write_text("BP012", encoding="utf-8")
        time.sleep(0.4)
        lc.stop()
        lc.wait_for_stop(timeout=2.0)

    # At least one heartbeat after rebind must show BP012
    post_rebind = [c for c in heartbeat_calls if "BP012" in c]
    assert post_rebind, (
        "No heartbeat with BP012 found after rebind. "
        f"Captured: {heartbeat_calls}"
    )


# ── Phase 5: SIGHUP triggers re-read (POSIX only) ─────────────────────────────


@pytest.mark.skipif(
    not hasattr(signal, "SIGHUP"),
    reason="SIGHUP not available on this platform (Windows)",
)
def test_sighup_triggers_reread(tmp_session_file, tmp_eblet_root, tmp_path):
    boundary_jsonl = tmp_path / "federation" / "session_boundary.jsonl"

    lc = _make_lc(
        session_id="BP013",
        session_file=tmp_session_file,
        eblet_root=tmp_eblet_root,
        poll_interval_s=9999,
    )

    with patch("the_shadow.lifecycle.SESSION_BOUNDARY_JSONL", boundary_jsonl), \
         patch("the_shadow.lifecycle.FEDERATION_DIR", boundary_jsonl.parent):
        lc.start()
        time.sleep(0.15)

        # Write new session but poll interval is huge — won't fire naturally
        tmp_session_file.write_text("BP012", encoding="utf-8")
        time.sleep(0.1)
        assert lc._state.session_id == "BP013", "Sanity check: no poll rebind yet"

        # Trigger SIGHUP manually on the current process
        os.kill(os.getpid(), signal.SIGHUP)
        time.sleep(0.2)

        lc.stop()
        lc.wait_for_stop(timeout=2.0)

    assert lc._state.session_id == "BP012", (
        f"SIGHUP should have triggered rebind to BP012; got {lc._state.session_id!r}"
    )


# ── Phase 2: previous_session_ids history ─────────────────────────────────────


# ── Error path coverage ───────────────────────────────────────────────────────


def test_heartbeat_write_failure_logged(tmp_session_file, tmp_eblet_root, capsys):
    lc = _make_lc(
        session_id="BP013",
        session_file=tmp_session_file,
        eblet_root=tmp_eblet_root,
    )
    lc._attach.write.side_effect = OSError("disk full")
    lc._write_heartbeat()
    captured = capsys.readouterr()
    assert "heartbeat write failed" in captured.err


def test_boundary_marker_oserror_logged(tmp_session_file, tmp_eblet_root, tmp_path, capsys):
    lc = _make_lc(
        session_id="BP013",
        session_file=tmp_session_file,
        eblet_root=tmp_eblet_root,
    )
    # Place a directory at the JSONL path so open() raises IsADirectoryError
    fed_dir = tmp_path / "federation"
    fed_dir.mkdir()
    jsonl_as_dir = fed_dir / "session_boundary.jsonl"
    jsonl_as_dir.mkdir()
    with patch("the_shadow.lifecycle.SESSION_BOUNDARY_JSONL", jsonl_as_dir), \
         patch("the_shadow.lifecycle.FEDERATION_DIR", fed_dir):
        lc._write_boundary_marker("BP013", "BP012", 10)
    captured = capsys.readouterr()
    assert "boundary marker write failed" in captured.err


def test_force_session_reread_missing_file(tmp_eblet_root, tmp_path, capsys):
    missing = tmp_path / "no_file.txt"
    lc = _make_lc(
        session_id="BP013",
        session_file=missing,
        eblet_root=tmp_eblet_root,
    )
    lc._force_session_reread()
    captured = capsys.readouterr()
    assert "unreadable" in captured.err
    assert lc._state.session_id == "BP013"


def test_force_session_reread_invalid_pattern(tmp_eblet_root, tmp_path, capsys):
    f = tmp_path / "session.txt"
    f.write_text("NOTAVALID", encoding="utf-8")
    lc = _make_lc(
        session_id="BP013",
        session_file=f,
        eblet_root=tmp_eblet_root,
    )
    lc._force_session_reread()
    captured = capsys.readouterr()
    assert "invalid value" in captured.err
    assert lc._state.session_id == "BP013"


def test_force_session_reread_triggers_rebind(tmp_eblet_root, tmp_path):
    """_force_session_reread must rebind when file contains a different BP session."""
    session_file = tmp_path / "session.txt"
    session_file.write_text("BP012", encoding="utf-8")
    boundary_jsonl = tmp_path / "federation" / "session_boundary.jsonl"

    lc = _make_lc(
        session_id="BP013",
        session_file=session_file,
        eblet_root=tmp_eblet_root,
    )

    with patch("the_shadow.lifecycle.SESSION_BOUNDARY_JSONL", boundary_jsonl), \
         patch("the_shadow.lifecycle.FEDERATION_DIR", boundary_jsonl.parent):
        boundary_jsonl.parent.mkdir(parents=True, exist_ok=True)
        lc._force_session_reread()

    assert lc._state.session_id == "BP012"
    assert boundary_jsonl.exists()
    marker = json.loads(boundary_jsonl.read_text(encoding="utf-8").strip())
    assert marker["previous_session_id"] == "BP013"
    assert marker["new_session_id"] == "BP012"
    assert marker["rebind_latency_ms"] == 0


def test_force_session_reread_same_session_is_noop(tmp_session_file, tmp_eblet_root, tmp_path):
    """_force_session_reread when file == current session must not call _do_rebind."""
    lc = _make_lc(
        session_id="BP013",
        session_file=tmp_session_file,
        eblet_root=tmp_eblet_root,
    )
    boundary_jsonl = tmp_path / "federation" / "session_boundary.jsonl"
    with patch("the_shadow.lifecycle.SESSION_BOUNDARY_JSONL", boundary_jsonl), \
         patch("the_shadow.lifecycle.FEDERATION_DIR", boundary_jsonl.parent):
        lc._force_session_reread()
    assert not boundary_jsonl.exists(), "No rebind should occur when session unchanged"


def test_monitor_loop_stat_oserror(tmp_eblet_root, tmp_path, capsys):
    """Monitor loop logs warning and continues when session file is unreadable."""
    missing = tmp_path / "no_session_file.txt"
    lc = _make_lc(
        session_id="BP013",
        session_file=missing,
        eblet_root=tmp_eblet_root,
        poll_interval_s=0.1,
    )
    lc.start()
    time.sleep(0.35)
    lc.stop()
    lc.wait_for_stop(timeout=2.0)
    captured = capsys.readouterr()
    assert "session file unreadable" in captured.err
    assert lc._state.session_id == "BP013"


def test_monitor_loop_file_disappears_after_stat(tmp_eblet_root, capsys):
    """If file vanishes between stat and read_text, loop logs and continues."""
    mock_session_path = MagicMock(spec=Path)
    stat_results = [MagicMock(st_mtime=1000.0), MagicMock(st_mtime=1001.0)]
    mock_session_path.stat.side_effect = [
        stat_results[0],
        stat_results[1],
        OSError("gone"),
        OSError("gone"),
    ]
    # read_text always fails (simulates file gone after stat)
    mock_session_path.read_text.side_effect = OSError("file vanished")

    lc = ShadowLifecycle(
        scribe_id="R11_shadow_alpha",
        lighthouse_position=1,
        session_id="BP013",
        heartbeat_interval_s=9999,
        bishop_check_interval_s=9999,
        eblet_root=tmp_eblet_root,
        session_poll_interval_s=0.1,
        session_file_path=mock_session_path,
    )
    lc._attach = MagicMock()

    lc.start()
    time.sleep(0.35)
    lc.stop()
    lc.wait_for_stop(timeout=2.0)

    captured = capsys.readouterr()
    assert "disappeared after stat" in captured.err


# ── Lifecycle helpers ──────────────────────────────────────────────────────────


def test_stop_and_is_alive(tmp_session_file, tmp_eblet_root):
    lc = _make_lc(
        session_id="BP013",
        session_file=tmp_session_file,
        eblet_root=tmp_eblet_root,
    )
    lc.start()
    assert lc.is_alive()
    lc.stop()
    lc.wait_for_stop(timeout=2.0)
    assert not lc.is_alive()


def test_get_state(tmp_session_file, tmp_eblet_root):
    lc = _make_lc(
        session_id="BP013",
        session_file=tmp_session_file,
        eblet_root=tmp_eblet_root,
    )
    state = lc.get_state()
    assert isinstance(state, ShadowState)
    assert state.session_id == "BP013"
    assert state.lighthouse_position == 1


def test_previous_session_ids_capped_at_16(
    tmp_session_file, tmp_eblet_root, tmp_path, monkeypatch
):
    # KN099: explicit tmp_path isolation so _do_rebind writes boundary markers
    # to tmp_path/federation/session_boundary.jsonl, not the prod ledger.
    # The autouse _isolate_prod_paths fixture in conftest.py already covers this,
    # but the explicit monkeypatch here documents the dependency and provides a
    # defence-in-depth layer if conftest isolation were ever removed.
    import the_shadow.lifecycle as _lc
    fed_dir = tmp_path / "federation"
    monkeypatch.setattr(_lc, "FEDERATION_DIR", fed_dir)
    monkeypatch.setattr(_lc, "SESSION_BOUNDARY_JSONL", fed_dir / "session_boundary.jsonl")

    lc = _make_lc(
        session_id="BP001",
        session_file=tmp_session_file,
        eblet_root=tmp_eblet_root,
    )
    # Drive 20 rebinds directly via _do_rebind
    for i in range(20):
        lc._do_rebind(f"BP{i:03d}", f"BP{i + 1:03d}", 0)

    assert len(lc._state.previous_session_ids) <= 16, (
        f"previous_session_ids should be capped at 16; "
        f"got {len(lc._state.previous_session_ids)}"
    )


# ── Integration: 8-position cohort rebind ─────────────────────────────────────


def test_8_position_cohort_rebind(tmp_path):
    """Spawn 8 short-lifetime lifecycle objects, flip session file, assert all rebind."""
    session_file = tmp_path / "current_session_name.txt"
    session_file.write_text("BP013", encoding="utf-8")
    boundary_jsonl = tmp_path / "federation" / "session_boundary.jsonl"

    greek_letters = [
        "alpha", "beta", "gamma", "delta",
        "epsilon", "zeta", "eta", "theta",
    ]
    lifecycles: list[ShadowLifecycle] = []

    for i, greek in enumerate(greek_letters, start=1):
        eblet_root = tmp_path / "eblets" / f"pos{i}"
        eblet_root.mkdir(parents=True)
        lc = ShadowLifecycle(
            scribe_id=f"R11_shadow_{greek}",
            lighthouse_position=i,
            session_id="BP013",
            heartbeat_interval_s=9999,
            bishop_check_interval_s=9999,
            eblet_root=eblet_root,
            session_poll_interval_s=0.1,
            session_file_path=session_file,
        )
        lc._attach = MagicMock()
        lc._attach.write = MagicMock()
        lc._attach.read = MagicMock(return_value=None)
        lifecycles.append(lc)

    with patch("the_shadow.lifecycle.SESSION_BOUNDARY_JSONL", boundary_jsonl), \
         patch("the_shadow.lifecycle.FEDERATION_DIR", boundary_jsonl.parent):
        boundary_jsonl.parent.mkdir(parents=True, exist_ok=True)

        for lc in lifecycles:
            lc.start()

        time.sleep(0.2)  # let first poll settle

        # Flip session
        session_file.write_text("BP012", encoding="utf-8")
        time.sleep(0.5)  # ≥ 2 × poll_interval

        for lc in lifecycles:
            lc.stop()
        for lc in lifecycles:
            lc.wait_for_stop(timeout=3.0)

    # All 8 must have rebind to BP012
    for lc in lifecycles:
        assert lc._state.session_id == "BP012", (
            f"{lc.scribe_id} did not rebind; still {lc._state.session_id!r}"
        )

    # Boundary marker file must have 8 lines (one per daemon)
    assert boundary_jsonl.exists(), "session_boundary.jsonl not created"
    lines = [
        l for l in boundary_jsonl.read_text(encoding="utf-8").strip().splitlines() if l
    ]
    assert len(lines) == 8, (
        f"Expected 8 boundary marker lines; got {len(lines)}"
    )
    for raw in lines:
        marker = json.loads(raw)
        assert marker["new_session_id"] == "BP012"
        assert marker["previous_session_id"] == "BP013"
