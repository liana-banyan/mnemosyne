"""
test_heartbeat_eblet_dir.py — KN098 Heartbeat-Eblet Directory Parameterization tests
======================================================================================
Covers Phase 5 of KN098:
  - Heartbeat write for session BP015 lands in BP015/ directory
  - After rebind chain BP013 → BP012 → BP015, three distinct session directories exist
  - Concurrent 8-daemon write to same session directory does not race
"""
from __future__ import annotations

import json
import threading
import time
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from the_shadow.lifecycle import SESSION_BOUNDARY_JSONL, FEDERATION_DIR, ShadowLifecycle


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture()
def tmp_session_file(tmp_path: Path) -> Path:
    f = tmp_path / "current_session_name.txt"
    f.write_text("BP015", encoding="utf-8")
    return f


@pytest.fixture()
def tmp_eblet_base(tmp_path: Path) -> Path:
    """Base eblet directory — session subdirs are created by ShadowLifecycle."""
    d = tmp_path / "eblets"
    d.mkdir()
    return d


def _make_lc(
    scribe_id: str = "R11_shadow_alpha",
    lighthouse_position: int = 1,
    session_id: str = "BP015",
    *,
    session_file: Path,
    eblet_base: Path,
    poll_interval_s: float = 0.05,
    mock_attach: bool = True,
) -> ShadowLifecycle:
    lc = ShadowLifecycle(
        scribe_id=scribe_id,
        lighthouse_position=lighthouse_position,
        session_id=session_id,
        heartbeat_interval_s=9999,
        bishop_check_interval_s=9999,
        eblet_root=eblet_base,
        session_poll_interval_s=poll_interval_s,
        session_file_path=session_file,
    )
    if mock_attach:
        lc._attach = MagicMock()
        lc._attach.write = MagicMock()
        lc._attach.read = MagicMock(return_value=None)
    return lc


# ── Test 1: per-session directory routing ─────────────────────────────────────


def test_heartbeat_path_uses_session_directory(tmp_session_file, tmp_eblet_base):
    """heartbeat_path property must point into the session-scoped subdirectory."""
    lc = _make_lc(
        session_id="BP015",
        session_file=tmp_session_file,
        eblet_base=tmp_eblet_base,
    )
    expected_dir = tmp_eblet_base / "BP015"
    assert lc.heartbeat_path.parent == expected_dir, (
        f"heartbeat_path should be under {expected_dir}; "
        f"got {lc.heartbeat_path.parent}"
    )
    assert lc.heartbeat_path.name == "heartbeat_R11_shadow_alpha.eblet.md"


def test_heartbeat_write_lands_in_session_directory(tmp_session_file, tmp_eblet_base):
    """
    Real (non-mocked) heartbeat write for session BP015 must create the file
    inside tmp_eblet_base/BP015/ — not in any hardcoded subdirectory.
    """
    lc = _make_lc(
        session_id="BP015",
        session_file=tmp_session_file,
        eblet_base=tmp_eblet_base,
        mock_attach=False,  # use real IronTabletAttach writes
    )
    lc._write_heartbeat()

    expected_file = tmp_eblet_base / "BP015" / "heartbeat_R11_shadow_alpha.eblet.md"
    assert expected_file.exists(), (
        f"Heartbeat file not found at {expected_file}. "
        f"Contents of base dir: {list(tmp_eblet_base.rglob('*'))}"
    )
    content = expected_file.read_text(encoding="utf-8")
    assert "BP015" in content, "Heartbeat content must include session BP015"

    # No stale BP011 directory should have been created
    stale_dir = tmp_eblet_base / "BP011"
    assert not stale_dir.exists(), "BP011 directory must not be created for BP015 session"


def test_start_creates_session_directory(tmp_session_file, tmp_eblet_base):
    """ShadowLifecycle.start() must mkdir the session-scoped directory."""
    lc = _make_lc(
        session_id="BP015",
        session_file=tmp_session_file,
        eblet_base=tmp_eblet_base,
    )
    assert not (tmp_eblet_base / "BP015").exists(), "pre-condition: dir must not yet exist"
    lc.start()
    lc.stop()
    lc.wait_for_stop(timeout=2.0)
    assert (tmp_eblet_base / "BP015").exists(), "start() must create the session directory"


# ── Test 2: rebind directory-flip (BP013 → BP012 → BP015) ────────────────────


def test_rebind_creates_new_session_directories(tmp_path):
    """
    After rebind chain BP013 → BP012 → BP015, eblets appear in three distinct
    directories and each heartbeat write lands in the correct session directory.
    """
    session_file = tmp_path / "current_session_name.txt"
    session_file.write_text("BP013", encoding="utf-8")
    eblet_base = tmp_path / "eblets"
    eblet_base.mkdir()
    boundary_jsonl = tmp_path / "federation" / "session_boundary.jsonl"

    written_paths: list[Path] = []

    lc = _make_lc(
        session_id="BP013",
        session_file=session_file,
        eblet_base=eblet_base,
        poll_interval_s=0.05,
        mock_attach=False,
    )

    # Intercept attach.write to record paths without suppressing real writes
    original_write = lc._attach.write

    def capture_write(path, content, **kwargs):
        written_paths.append(Path(path))
        return original_write(path, content, **kwargs)

    lc._attach.write = capture_write

    with patch("the_shadow.lifecycle.SESSION_BOUNDARY_JSONL", boundary_jsonl), \
         patch("the_shadow.lifecycle.FEDERATION_DIR", boundary_jsonl.parent):
        boundary_jsonl.parent.mkdir(parents=True, exist_ok=True)

        lc.start()
        time.sleep(0.1)
        # Trigger first rebind: BP013 → BP012
        session_file.write_text("BP012", encoding="utf-8")
        time.sleep(0.2)
        # Trigger second rebind: BP012 → BP015
        session_file.write_text("BP015", encoding="utf-8")
        time.sleep(0.2)

        lc.stop()
        lc.wait_for_stop(timeout=3.0)

    assert lc._state.session_id == "BP015", (
        f"Final session must be BP015; got {lc._state.session_id!r}"
    )

    # All three session directories must exist
    for session in ("BP013", "BP012", "BP015"):
        assert (eblet_base / session).exists(), (
            f"Session directory {session} must have been created"
        )

    # Heartbeats written after each rebind must be in the correct session directory
    bp012_hbs = [p for p in written_paths if "BP012" in str(p)]
    bp015_hbs = [p for p in written_paths if "BP015" in str(p)]
    assert bp012_hbs, "At least one heartbeat must have been written to BP012/ directory"
    assert bp015_hbs, "At least one heartbeat must have been written to BP015/ directory"

    # Verify no heartbeat was written to a stale BP011 directory
    bp011_writes = [p for p in written_paths if "BP011" in str(p)]
    assert not bp011_writes, (
        f"No write must target BP011/; found: {bp011_writes}"
    )


def test_rebind_dir_exists_before_next_heartbeat(tmp_path):
    """
    After _do_rebind, the new session directory must exist before the next
    heartbeat fires (directory creation is atomic with session_id update).
    """
    session_file = tmp_path / "current_session_name.txt"
    session_file.write_text("BP013", encoding="utf-8")
    eblet_base = tmp_path / "eblets"
    eblet_base.mkdir()
    boundary_jsonl = tmp_path / "federation" / "session_boundary.jsonl"

    lc = _make_lc(
        session_id="BP013",
        session_file=session_file,
        eblet_base=eblet_base,
    )

    with patch("the_shadow.lifecycle.SESSION_BOUNDARY_JSONL", boundary_jsonl), \
         patch("the_shadow.lifecycle.FEDERATION_DIR", boundary_jsonl.parent):
        boundary_jsonl.parent.mkdir(parents=True, exist_ok=True)
        lc._do_rebind("BP013", "BP015", 0)

    # Directory must exist immediately after _do_rebind (before any heartbeat thread fires)
    assert (eblet_base / "BP015").exists(), (
        "_do_rebind must mkdir the new session directory atomically with session_id update"
    )
    assert lc._state.session_id == "BP015"


# ── Test 3: concurrent multi-daemon write to same session directory ───────────


def test_concurrent_8_daemon_writes_no_race(tmp_path):
    """
    8 daemons writing heartbeats to the same session directory (BP015) must not
    race: all 8 heartbeat files must exist and contain valid content afterward.
    """
    session_file = tmp_path / "current_session_name.txt"
    session_file.write_text("BP015", encoding="utf-8")
    # Shared base — all 8 daemons use the same eblet_base → same BP015/ directory
    eblet_base = tmp_path / "eblets"
    eblet_base.mkdir()

    greek_letters = [
        "alpha", "beta", "gamma", "delta",
        "epsilon", "zeta", "eta", "theta",
    ]

    lifecycles: list[ShadowLifecycle] = []
    for i, greek in enumerate(greek_letters, start=1):
        lc = ShadowLifecycle(
            scribe_id=f"R11_shadow_{greek}",
            lighthouse_position=i,
            session_id="BP015",
            heartbeat_interval_s=9999,
            bishop_check_interval_s=9999,
            eblet_root=eblet_base,
            session_poll_interval_s=9999,
            session_file_path=session_file,
        )
        # Use real writes — this is the race test
        lifecycles.append(lc)

    errors: list[str] = []

    def run_heartbeat(lc: ShadowLifecycle) -> None:
        try:
            lc._write_heartbeat()
        except Exception as exc:
            errors.append(f"{lc.scribe_id}: {exc}")

    # Fire all 8 heartbeats concurrently
    threads = [threading.Thread(target=run_heartbeat, args=(lc,)) for lc in lifecycles]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=10.0)

    assert not errors, f"Heartbeat write errors: {errors}"

    # All 8 heartbeat files must exist in the shared BP015/ directory
    session_dir = eblet_base / "BP015"
    assert session_dir.exists(), "Shared BP015/ session directory must exist"

    for greek in greek_letters:
        hb_file = session_dir / f"heartbeat_R11_shadow_{greek}.eblet.md"
        assert hb_file.exists(), (
            f"Heartbeat file missing for R11_shadow_{greek} in {session_dir}"
        )
        content = hb_file.read_text(encoding="utf-8")
        assert "BP015" in content, (
            f"Heartbeat for R11_shadow_{greek} must contain session BP015"
        )


def test_concurrent_8_daemon_writes_distinct_sessions(tmp_path):
    """
    8 daemons each on a different session must write heartbeats to distinct
    session directories without cross-contamination.
    """
    session_file = tmp_path / "current_session_name.txt"
    session_file.write_text("BP015", encoding="utf-8")
    eblet_base = tmp_path / "eblets"
    eblet_base.mkdir()

    greek_letters = [
        "alpha", "beta", "gamma", "delta",
        "epsilon", "zeta", "eta", "theta",
    ]
    sessions = [f"BP{100 + i:03d}" for i in range(8)]

    lifecycles: list[ShadowLifecycle] = []
    for i, (greek, session) in enumerate(zip(greek_letters, sessions), start=1):
        lc = ShadowLifecycle(
            scribe_id=f"R11_shadow_{greek}",
            lighthouse_position=i,
            session_id=session,
            heartbeat_interval_s=9999,
            bishop_check_interval_s=9999,
            eblet_root=eblet_base,
            session_poll_interval_s=9999,
            session_file_path=session_file,
        )
        lifecycles.append(lc)

    errors: list[str] = []

    def run_heartbeat(lc: ShadowLifecycle) -> None:
        try:
            lc._write_heartbeat()
        except Exception as exc:
            errors.append(f"{lc.scribe_id}: {exc}")

    threads = [threading.Thread(target=run_heartbeat, args=(lc,)) for lc in lifecycles]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=10.0)

    assert not errors, f"Heartbeat write errors: {errors}"

    # Each daemon's heartbeat must be in its own session directory
    for greek, session in zip(greek_letters, sessions):
        hb_file = eblet_base / session / f"heartbeat_R11_shadow_{greek}.eblet.md"
        assert hb_file.exists(), (
            f"R11_shadow_{greek} heartbeat not found in {session}/ directory"
        )
        # Verify no cross-contamination into other session directories
        content = hb_file.read_text(encoding="utf-8")
        assert session in content, (
            f"Heartbeat content for R11_shadow_{greek} must reference session {session}"
        )
