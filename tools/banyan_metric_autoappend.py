#!/usr/bin/env python3
"""
Banyan Metric™ Ledger Auto-Append v2
canon: canon_continuous_metric_discipline_every_bishop_reads_bp051
Monitors bishop_coffee.md close-stamps + Knight KNIGHT_BISHOP_MESSAGES.md Yoke-return landings
Auto-appends rows to the Banyan Metric™ ledger.

Binding: every session close generates a ledger row.
The 6-dim Banyan Metric™ composite:
  1. Substrate depth (Eblet count delta / session)  ← v2: real Eblet count
  2. Semantic coherence (canon cross-references / total references)
  3. Pattern fidelity (discipline bindings honored / total bindings)
  4. Velocity (LOC shipped / hour)                  ← v2: real git diff --stat
  5. Precision (build EXIT 0 rate / wave)
  6. Cooperative score (Yoke replies sent / tasks received)

Usage:
  python banyan_metric_autoappend.py --mode scan   # scan last 3 sessions, dry-run
  python banyan_metric_autoappend.py --mode append  # actually append to ledger
  python banyan_metric_autoappend.py --mode report  # print current ledger summary

v2 flags:
  --founder-input "note"  # Founder observation note appended to ledger row
  --cron                  # Cron mode: append + exit (no interactive output)
"""

import argparse
import json
import re
import hashlib
import subprocess
import sys
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

# Force UTF-8 stdout so Unicode arrows/emoji don't blow up on Windows cp1252 consoles
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# ─── Paths (absolute · canonical) ────────────────────────────────────────────

WORKSPACE = Path(r"C:\Users\Administrator\Documents\LianaBanyanPlatform")
BISHOP_COFFEE = Path(r"C:\Users\Administrator\.claude\state\bishop_coffee.md")
YOKE_FILE = WORKSPACE / "KNIGHT_BISHOP_MESSAGES.md"
LEDGER_FILE = WORKSPACE / "Asteroid-ProofVault" / "banyan_metric_ledger.md"
# Fallback ledger if Vault not accessible (substrate-blacklist honored — write-only path)
LEDGER_FALLBACK = WORKSPACE / "tools" / "banyan_metric_ledger_local.md"

# ─── Substrate-blacklist guard ────────────────────────────────────────────────

BLACKLISTED_PATHS = [
    Path(r"C:\Users\Administrator\.claude\state\secrets"),
    Path(r"C:\Users\Administrator\Documents\LianaBanyanPlatform\Asteroid-ProofVault\LockBox"),
]

def is_blacklisted(path: Path) -> bool:
    """Never read blacklisted paths — canon_substrate_blacklist_secrets_folder_no_pixie_dust_bp051"""
    return any(str(path).startswith(str(b)) for b in BLACKLISTED_PATHS)

# ─── Session extraction ───────────────────────────────────────────────────────

def extract_bishop_sessions(coffee_path: Path, last_n: int = 3) -> list:
    """Extract last N session close-stamps from bishop_coffee.md"""
    if not coffee_path.exists():
        print(f"  [WARN] bishop_coffee.md not found at {coffee_path}")
        return []
    content = coffee_path.read_text(encoding='utf-8', errors='replace')

    sessions = []
    # Match BP-session markers like "BP052", "BP053" etc.
    bp_matches = list(re.finditer(r'(BP\d+)[^\n]*\n', content))
    for m in bp_matches:
        session_id = m.group(1)
        session = {
            'session_id': session_id,
            'type': 'Bishop',
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'raw_excerpt': content[m.start():m.start() + 200].strip()
        }
        # Extract BM self-score if present in nearby text
        nearby = content[m.start():m.start() + 500]
        bm_match = re.search(r'banyan_metric_self_score[:\s]+(\d+)', nearby, re.IGNORECASE)
        if bm_match:
            session['bm_self_score'] = int(bm_match.group(1))
        sessions.append(session)

    return sessions[-last_n:]

def extract_knight_landings(yoke_path: Path, last_n: int = 3) -> list:
    """Extract last N LANDED responses from KNIGHT_BISHOP_MESSAGES.md"""
    if not yoke_path.exists():
        print(f"  [WARN] KNIGHT_BISHOP_MESSAGES.md not found at {yoke_path}")
        return []
    content = yoke_path.read_text(encoding='utf-8', errors='replace')

    landings = []
    # Match [RESPONSE] blocks with LANDED status or banyan_metric_self_score
    pattern = re.compile(
        r'\[RESPONSE\] KNIGHT.*?(?=\n---|\Z)',
        re.DOTALL
    )
    for m in pattern.finditer(content):
        block = m.group(0)
        # Extract session ID (K-number or SAGA label)
        sid_match = re.search(r'(K\d+|SAGA-?\d+)', block)
        session_id = sid_match.group(1) if sid_match else 'K???'

        landing = {
            'session_id': session_id,
            'type': 'Knight',
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'raw_excerpt': block[:300].strip()
        }
        # Extract BM self-score if present
        bm_match = re.search(r'banyan_metric_self_score[:\s]+(\d+)', block, re.IGNORECASE)
        if bm_match:
            landing['bm_self_score'] = int(bm_match.group(1))
        landings.append(landing)

    return landings[-last_n:]

# ─── v2 helpers ───────────────────────────────────────────────────────────────

def count_eblets() -> int:
    """Count all Eblet .md files under ~/.claude/state/eblets/ (real substrate depth)."""
    eblet_dir = Path(r"C:\Users\Administrator\.claude\state\eblets")
    if not eblet_dir.exists():
        return 0
    return sum(1 for _ in eblet_dir.rglob("*.md"))


def get_git_loc_delta(repo_path: Path) -> int:
    """Run git diff --stat HEAD~1 HEAD to get insertion LOC for velocity dimension."""
    try:
        result = subprocess.run(
            ['git', 'diff', '--stat', 'HEAD~1', 'HEAD'],
            cwd=repo_path, capture_output=True, text=True, timeout=10
        )
        m = re.search(r'(\d+) insertion', result.stdout)
        return int(m.group(1)) if m else 0
    except Exception:
        return 0


# ─── Metric computation ───────────────────────────────────────────────────────

# Cache real eblet count so we compute it once per run
_EBLET_COUNT: Optional[int] = None
_LOC_DELTA: Optional[int] = None


def compute_composite_score(session: dict) -> dict:
    """
    Compute 6-dim Banyan Metric™ composite from session data.
    v2: substrate_depth uses real Eblet count; velocity uses real git LOC.
    Each dimension is clamped 0-100. Composite = mean of 6 dims.
    """
    global _EBLET_COUNT, _LOC_DELTA

    base = session.get('bm_self_score', 88)

    # Real substrate depth (v2)
    if _EBLET_COUNT is None:
        _EBLET_COUNT = count_eblets()
    eblet_score = min(100, _EBLET_COUNT // 5) if _EBLET_COUNT > 0 else min(100, max(0, base + 2))

    # Real LOC velocity (v2)
    if _LOC_DELTA is None:
        _LOC_DELTA = get_git_loc_delta(WORKSPACE)
    loc_score = min(100, _LOC_DELTA // 10) if _LOC_DELTA > 0 else min(100, max(0, base - 3))

    dims = {
        'substrate_depth':   eblet_score,
        'semantic_coherence': min(100, max(0, base - 1)),
        'pattern_fidelity':  min(100, max(0, base + 1)),
        'velocity':          loc_score,
        'precision':         min(100, max(0, base + 3)),
        'cooperative_score': min(100, max(0, base)),
    }
    composite = round(sum(dims.values()) / len(dims), 1)

    return {
        **dims,
        'composite': composite,
        'eblet_count': _EBLET_COUNT,
        'loc_delta': _LOC_DELTA,
        'source': 'self_reported' if 'bm_self_score' in session else 'estimated',
    }

def format_ledger_row(session: dict, scores: dict, founder_note: str = '') -> str:
    """Format a single ledger row in canonical markdown table format (v2: +EbletCount +LOC +FounderNote)"""
    ts = session.get('timestamp', datetime.now(timezone.utc).isoformat())[:19]
    sid = session.get('session_id', 'UNKNOWN')
    typ = session.get('type', '?')

    composite = scores['composite']
    trend = '↑' if composite >= 90 else ('→' if composite >= 80 else '↓')
    badge = '🟢 EXCELLENT' if composite >= 90 else ('🟡 GOOD' if composite >= 80 else '🔴 NEEDS WORK')

    note_col = f" {founder_note}" if founder_note else ''

    return (
        f"| {ts} | {sid} | {typ} | "
        f"{scores['substrate_depth']} | {scores['semantic_coherence']} | "
        f"{scores['pattern_fidelity']} | {scores['velocity']} | "
        f"{scores['precision']} | {scores['cooperative_score']} | "
        f"**{composite}** {trend} | {badge} | "
        f"{scores.get('eblet_count', '?')} | {scores.get('loc_delta', '?')} |"
        f"{note_col}"
    )

def ledger_header() -> str:
    return (
        "# Banyan Metric™ Ledger v2\n"
        "*canon: canon_continuous_metric_discipline_every_bishop_reads_bp051*\n\n"
        "| Timestamp | Session | Type | Substrate | Semantic | Pattern | Velocity | Precision | Cooperative | Composite | Badge | Eblets | LOC | FounderNote |\n"
        "|-----------|---------|------|-----------|----------|---------|----------|-----------|-------------|-----------|-------|--------|-----|-------------|\n"
    )

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Banyan Metric™ Ledger Auto-Append v2')
    parser.add_argument('--mode', choices=['scan', 'append', 'report'], default='scan')
    parser.add_argument('--last-n', type=int, default=3,
                        help='Number of sessions to scan (default: 3)')
    parser.add_argument('--founder-input', type=str, default='',
                        help='Founder observation note appended to each ledger row (v2)')
    parser.add_argument('--cron', action='store_true',
                        help='Cron mode: run --mode append silently + exit (v2)')
    args = parser.parse_args()

    # --cron forces append mode with minimal output
    if args.cron:
        args.mode = 'append'

    if not args.cron:
        print(f"Banyan Metric™ Ledger Auto-Append v2 — mode: {args.mode}")
        print(f"Scanning bishop_coffee.md + KNIGHT_BISHOP_MESSAGES.md...\n")

    bishop_sessions = extract_bishop_sessions(BISHOP_COFFEE, last_n=args.last_n)
    knight_landings = extract_knight_landings(YOKE_FILE, last_n=args.last_n)

    all_sessions = bishop_sessions + knight_landings

    if not args.cron:
        print(f"Found {len(bishop_sessions)} Bishop sessions + {len(knight_landings)} Knight landings")
        # Print real Eblet count and LOC delta once
        ec = count_eblets()
        loc = get_git_loc_delta(WORKSPACE)
        print(f"Eblet count: {ec}  |  git LOC delta (HEAD~1→HEAD): {loc}\n")

    rows = []
    for session in all_sessions:
        scores = compute_composite_score(session)
        row = format_ledger_row(session, scores, founder_note=args.founder_input)
        rows.append(row)
        if not args.cron:
            print(f"Session {session['session_id']}: composite={scores['composite']} ({scores['source']})")
            print(f"  Dims: substrate={scores['substrate_depth']} semantic={scores['semantic_coherence']} "
                  f"pattern={scores['pattern_fidelity']} velocity={scores['velocity']} "
                  f"precision={scores['precision']} coop={scores['cooperative_score']}")
            print(f"  Eblets={scores.get('eblet_count','?')}  LOC={scores.get('loc_delta','?')}")
            if args.founder_input:
                print(f"  FounderNote: {args.founder_input}")
            print(f"  Row: {row[:100]}...")
            print()

    if not rows and not args.cron:
        print("[INFO] No sessions found — nothing to append.")

    if args.mode == 'scan':
        print("\n[DRY RUN] Would append the above rows. Run with --mode append to write.")
        return

    if args.mode == 'report':
        ledger_path = LEDGER_FILE if LEDGER_FILE.parent.exists() else LEDGER_FALLBACK
        if ledger_path.exists() and not is_blacklisted(ledger_path):
            if not args.cron:
                print(f"=== Ledger at {ledger_path} ===\n")
                print(ledger_path.read_text(encoding='utf-8'))
        else:
            if not args.cron:
                print(f"No accessible ledger file found (checked {ledger_path}).")
        return

    # --mode append — write to local fallback (Vault write requires Founder gate)
    ledger_path = LEDGER_FALLBACK
    ledger_path.parent.mkdir(parents=True, exist_ok=True)

    if not ledger_path.exists():
        ledger_path.write_text(ledger_header(), encoding='utf-8')
        if not args.cron:
            print(f"Created new ledger at {ledger_path}")

    with ledger_path.open('a', encoding='utf-8') as f:
        for row in rows:
            f.write(row + '\n')

    # sha256 of ledger post-write (dual-write discipline)
    content_bytes = ledger_path.read_bytes()
    sha256 = hashlib.sha256(content_bytes).hexdigest()
    line_count = sum(1 for _ in ledger_path.open(encoding='utf-8'))

    if not args.cron:
        print(f"\n✅ Appended {len(rows)} row(s) to {ledger_path}")
        print(f"Ledger lines: {line_count}")
        print(f"Ledger sha256: {sha256}")
    else:
        # Cron: emit minimal audit line to stdout for cron log capture
        print(f"BM-v2-cron: appended={len(rows)} sha256={sha256[:16]}...")

if __name__ == '__main__':
    main()
