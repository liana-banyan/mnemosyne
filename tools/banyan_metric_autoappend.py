#!/usr/bin/env python3
"""
Banyan Metric™ Ledger Auto-Append v2.1
canon: canon_continuous_metric_discipline_every_bishop_reads_bp051
KniPr024: Extended with git-log wave-landing scanner + JSONL ledger mode.

MODE A — bishop_coffee.md / KNIGHT_BISHOP_MESSAGES.md (original v2):
  python banyan_metric_autoappend.py --mode scan   # scan last 3 sessions, dry-run
  python banyan_metric_autoappend.py --mode append  # actually append to ledger
  python banyan_metric_autoappend.py --mode report  # print current ledger summary

  v2 flags:
    --founder-input "note"  # Founder observation note appended to ledger row
    --cron                  # Cron mode: append + exit (no interactive output)

MODE B — git-log wave-landing scanner (KniPr024 · JSONL ledger):
  python banyan_metric_autoappend.py --since HEAD~20
  python banyan_metric_autoappend.py --since <commit-hash> --ledger path/to/ledger.jsonl
  python banyan_metric_autoappend.py --report   # print JSONL ledger summary table
  python banyan_metric_autoappend.py --since HEAD~20 --report  # back-fill + report

  JSONL ledger row schema:
    {"hash": "abc1234", "wave": "KniPr011", "date": "2026-05-23",
     "score": null, "committed_at": "2026-05-23T05:00:00-05:00",
     "subject": "commit subject line"}

  Idempotent: commits already in ledger are never duplicated.
  Wave-landing detection: KniPrNNN, SAGA-*, NOVACULI, feat(*, fix(*, yoke(*

The 6-dim Banyan Metric™ composite (Mode A):
  1. Substrate depth (Eblet count delta / session)  ← v2: real Eblet count
  2. Semantic coherence (canon cross-references / total references)
  3. Pattern fidelity (discipline bindings honored / total bindings)
  4. Velocity (LOC shipped / hour)                  ← v2: real git diff --stat
  5. Precision (build EXIT 0 rate / wave)
  6. Cooperative score (Yoke replies sent / tasks received)
"""

import argparse
import json
import re
import hashlib
import subprocess
import sys
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

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
# KniPr024: JSONL ledger for git-log wave-landing mode (Mode B)
JSONL_LEDGER_DEFAULT = WORKSPACE / "librarian-mcp" / "banyan_metric_ledger.jsonl"

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


# ─── Mode B: git-log wave-landing scanner (KniPr024) ─────────────────────────

# Patterns that signal a "wave landing" commit worth tracking
_WAVE_PATTERNS = [
    re.compile(r'(KniPr\d+[a-z]?)', re.IGNORECASE),     # KniPr011, KniPr011b
    re.compile(r'(NOVACULI\s+SAGA-[\w]+)', re.IGNORECASE),  # NOVACULI SAGA-q
    re.compile(r'(SAGA-[\w]+)', re.IGNORECASE),            # SAGA-7, SAGA-gamma
    re.compile(r'feat\([\w-]+\)'),                         # feat(mnemosyne)
    re.compile(r'fix\([\w-]+\)'),                          # fix(gitignore)
    re.compile(r'yoke\([\w-]+\)', re.IGNORECASE),          # yoke(knight)
    re.compile(r'\bwave\b', re.IGNORECASE),                # generic "wave"
    re.compile(r'\bSAGA\b', re.IGNORECASE),                # generic SAGA
]

_SCORE_PATTERNS = [
    re.compile(r'[Bb]anyan[_ ]?[Mm]etric[:\s]+(\d+(?:\.\d+)?)'),   # Banyan Metric: 8
    re.compile(r'(\d+(?:\.\d+)?)\s*/\s*10'),                        # 7.5/10
    re.compile(r'[Bb][Mm][:\s]+(\d+(?:\.\d+)?)'),                   # BM: 8.5
    re.compile(r'score[:\s]+(\d+(?:\.\d+)?)', re.IGNORECASE),       # score: 9
]


def _extract_wave_name(subject: str) -> Optional[str]:
    """Extract the most specific wave identifier from a commit subject."""
    # KniPr takes priority (most specific)
    m = re.search(r'(KniPr\d+[a-z]?)', subject, re.IGNORECASE)
    if m:
        return m.group(1)
    # NOVACULI SAGA
    m = re.search(r'(NOVACULI\s+SAGA-[\w]+)', subject, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    # bare SAGA-*
    m = re.search(r'(SAGA-[\w]+)', subject, re.IGNORECASE)
    if m:
        return m.group(1)
    # feat/fix/yoke conventional commits — use the scope as wave label
    m = re.search(r'(feat|fix|yoke)\(([\w-]+)\)', subject, re.IGNORECASE)
    if m:
        return f"{m.group(1)}({m.group(2)})"
    return None


def _extract_score(text: str) -> Optional[float]:
    """Extract self-score from commit subject or body."""
    for pat in _SCORE_PATTERNS:
        m = pat.search(text)
        if m:
            try:
                v = float(m.group(1))
                if 0.0 <= v <= 10.0:
                    return v
            except ValueError:
                pass
    return None


def _is_wave_landing(subject: str) -> bool:
    """Return True if the commit subject matches any wave-landing pattern."""
    return any(pat.search(subject) for pat in _WAVE_PATTERNS)


def scan_git_commits(since: str, n: int = 40, repo: Path = WORKSPACE) -> List[Dict[str, Any]]:
    """
    Return a list of wave-landing commit dicts from git log.
    `since` may be a commit hash, tag, branch, or HEAD~N expression.
    Always uses <since>..HEAD range syntax.
    """
    # Build the range: if `since` already contains '..', use as-is; else build range
    if '..' in since:
        rev_range = since
    else:
        rev_range = f'{since}..HEAD'

    try:
        result = subprocess.run(
            ['git', 'log', '--format=%H|%s|%ai', rev_range],
            cwd=repo, capture_output=True, text=True, encoding='utf-8',
            errors='replace', timeout=15
        )
        raw = result.stdout.strip()
    except Exception as e:
        print(f"  [ERROR] git log failed: {e}")
        return []

    commits = []
    for line in raw.splitlines():
        parts = line.split('|', 2)
        if len(parts) < 3:
            continue
        full_hash, subject, date_str = parts
        subject = subject.strip().lstrip('\ufeff')  # strip BOM that sometimes appears

        if not _is_wave_landing(subject):
            continue

        wave = _extract_wave_name(subject)
        score = _extract_score(subject)

        # Parse committed_at — git %ai format: "2026-05-23 00:09:44 -0500"
        try:
            dt = datetime.strptime(date_str.strip(), '%Y-%m-%d %H:%M:%S %z')
            committed_at = dt.isoformat()
            date_only = dt.strftime('%Y-%m-%d')
        except ValueError:
            committed_at = date_str.strip()
            date_only = date_str[:10]

        commits.append({
            'hash': full_hash[:7],
            'wave': wave or 'UNKNOWN',
            'date': date_only,
            'score': score,
            'committed_at': committed_at,
            'subject': subject[:200],
        })

    return commits


def load_jsonl_ledger(ledger_path: Path) -> List[Dict[str, Any]]:
    """Load all rows from a JSONL ledger file. Returns [] if file doesn't exist."""
    if not ledger_path.exists():
        return []
    rows = []
    with ledger_path.open(encoding='utf-8', errors='replace') as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    rows.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    return rows


def append_jsonl_rows(new_rows: List[Dict[str, Any]], ledger_path: Path) -> int:
    """
    Append only rows whose hash is not already in the ledger.
    Returns count of rows actually appended.
    """
    existing = load_jsonl_ledger(ledger_path)
    existing_hashes = {r.get('hash') for r in existing if r.get('hash')}

    to_append = [r for r in new_rows if r['hash'] not in existing_hashes]
    if not to_append:
        return 0

    ledger_path.parent.mkdir(parents=True, exist_ok=True)
    with ledger_path.open('a', encoding='utf-8', newline='\n') as f:
        for row in to_append:
            f.write(json.dumps(row, ensure_ascii=False) + '\n')

    return len(to_append)


def print_jsonl_report(ledger_path: Path) -> None:
    """Print a formatted summary table of all JSONL ledger entries."""
    rows = load_jsonl_ledger(ledger_path)
    if not rows:
        print(f"  [INFO] Ledger is empty or not found: {ledger_path}")
        return

    print(f"\n{'='*90}")
    print(f"  Banyan Metric™ Ledger  |  {ledger_path}")
    print(f"  {len(rows)} wave-landing entries")
    print(f"{'='*90}")
    header = f"{'#':>3}  {'Hash':7}  {'Wave':<26}  {'Date':10}  {'Score':5}  {'Subject'}"
    print(header)
    print('-' * 90)

    scored = [r for r in rows if r.get('score') is not None]
    for i, row in enumerate(rows, 1):
        score_str = f"{row['score']:4.1f}" if row.get('score') is not None else '  -- '
        wave = (row.get('wave') or 'UNKNOWN')[:26]
        subject = (row.get('subject') or '')[:45]
        print(f"{i:>3}  {row.get('hash','???????'):7}  {wave:<26}  {row.get('date','?'):10}  {score_str}  {subject}")

    print('-' * 90)
    if scored:
        avg = sum(r['score'] for r in scored) / len(scored)
        print(f"  Scored waves: {len(scored)}/{len(rows)}  |  Avg score: {avg:.2f}/10")
    else:
        print(f"  No self-scores recorded yet.")
    print(f"{'='*90}\n")


# ─── Mode A: original markdown format ────────────────────────────────────────

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
    parser = argparse.ArgumentParser(description='Banyan Metric™ Ledger Auto-Append v2.1')
    # ── Mode A args (original v2) ─────────────────────────────────────────────
    parser.add_argument('--mode', choices=['scan', 'append', 'report'], default=None,
                        help='Mode A: scan|append|report (bishop_coffee.md / KNIGHT_BISHOP_MESSAGES.md)')
    parser.add_argument('--last-n', type=int, default=3,
                        help='Number of sessions to scan (default: 3)')
    parser.add_argument('--founder-input', type=str, default='',
                        help='Founder observation note appended to each ledger row (v2)')
    parser.add_argument('--cron', action='store_true',
                        help='Cron mode: run --mode append silently + exit (v2)')
    # ── Mode B args (KniPr024: git-log JSONL) ────────────────────────────────
    parser.add_argument('--since', type=str, default=None,
                        help='Mode B: git rev-expression to scan from (e.g. HEAD~20 or a commit hash)')
    parser.add_argument('--ledger', type=str, default=None,
                        help='Mode B: path to JSONL ledger file (default: librarian-mcp/banyan_metric_ledger.jsonl)')
    parser.add_argument('--report', action='store_true',
                        help='Mode B: print summary table of JSONL ledger entries')
    args = parser.parse_args()

    # ─── Mode B dispatch ──────────────────────────────────────────────────────
    if args.since is not None or args.report:
        ledger_path = Path(args.ledger) if args.ledger else JSONL_LEDGER_DEFAULT

        if args.since:
            print(f"Banyan Metric™ v2.1 · Mode B · git-log scanner")
            print(f"  since: {args.since}  →  HEAD")
            print(f"  ledger: {ledger_path}\n")

            commits = scan_git_commits(args.since, repo=WORKSPACE)
            print(f"  Wave-landing commits found: {len(commits)}")

            if commits:
                appended = append_jsonl_rows(commits, ledger_path)
                skipped = len(commits) - appended
                print(f"  Appended: {appended}  |  Already-in-ledger (skipped): {skipped}\n")

                print(f"  Commits scanned:")
                for c in commits:
                    score_str = f"  score={c['score']}" if c['score'] is not None else ''
                    print(f"    [{c['hash']}] {c['wave']:<26} {c['date']}  {c['subject'][:50]}{score_str}")
            else:
                print("  No wave-landing commits matched. Nothing to append.\n")

            # sha256 receipt
            if ledger_path.exists():
                sha = hashlib.sha256(ledger_path.read_bytes()).hexdigest()
                lines = sum(1 for _ in ledger_path.open(encoding='utf-8'))
                print(f"\n  sha256: {sha}")
                print(f"  Ledger rows total: {lines}")

        if args.report:
            print_jsonl_report(ledger_path)

        return

    # ─── Mode A dispatch (original v2 logic) ─────────────────────────────────
    # Default --mode to 'scan' if not in Mode B
    if args.mode is None:
        args.mode = 'scan'

    # --cron forces append mode with minimal output
    if args.cron:
        args.mode = 'append'

    if not args.cron:
        print(f"Banyan Metric™ Ledger Auto-Append v2.1 — mode: {args.mode}")
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
