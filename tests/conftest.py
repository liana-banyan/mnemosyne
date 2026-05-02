"""
conftest.py — KN099 test-isolation fixtures
============================================
Patches module-level path constants in the_shadow.lifecycle for EVERY test in
this directory so that no test can accidentally write to the production ledger
at ~/.claude/state/federation/session_boundary.jsonl.

Also redirects SESSION_FILE_PATH so that tests which instantiate ShadowLifecycle
without an explicit session_file_path argument cannot accidentally read from
the real ~/.claude/state/current_session_name.txt.

Mechanism: monkeypatch.setattr on the three module-level constants.
The monkeypatch fixture reverts all changes after each test automatically.

Any test that also uses an explicit `with patch("the_shadow.lifecycle.SESSION_BOUNDARY_JSONL", ...)`
context further overrides the conftest value within that block — this is fine
because the `with patch` stacks on top and reverts correctly.

KN099 — BP012 finding A2 (test-residue contamination remediation).
"""
from __future__ import annotations

from pathlib import Path

import pytest


@pytest.fixture(autouse=True)
def _isolate_prod_paths(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """
    Redirect every module-level prod path in the_shadow.lifecycle to a
    throwaway tmp_path directory.  Applies to EVERY test automatically.

    Redirected constants:
      - FEDERATION_DIR         → tmp_path / "federation"
      - SESSION_BOUNDARY_JSONL → tmp_path / "federation" / "session_boundary.jsonl"
      - SESSION_FILE_PATH      → tmp_path / "current_session_name.txt"
    """
    import the_shadow.lifecycle as _lc

    fed_dir = tmp_path / "federation"
    monkeypatch.setattr(_lc, "FEDERATION_DIR", fed_dir)
    monkeypatch.setattr(_lc, "SESSION_BOUNDARY_JSONL", fed_dir / "session_boundary.jsonl")
    monkeypatch.setattr(_lc, "SESSION_FILE_PATH", tmp_path / "current_session_name.txt")
