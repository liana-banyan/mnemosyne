#!/usr/bin/env bash
# Usage: ./scripts/bishop_closeout.sh B120 "one-line summary of session"
#
# Three-step atomic Bishop session closeout:
#   1. Verify MILESTONE_B{N}_CLOSEOUT.md exists in BISHOP_DROPZONE/03_BishopHandoffs/
#      (Bishop writes this before calling the script — the script only validates + moves on)
#   2. Run `cd librarian-mcp && npm run rebuild` — capture exit code + tail
#   3. Verify the new B{N} session MUST appear in librarian-mcp/index/context.json
#      (mirrors what get_diff_since_session would return), otherwise print FAILED and exit 1
#
# Exit 0 = full success. Exit 1 = any step failed (don't swallow errors).
# Prints a clear +/-  line for each step and a one-line summary at the end.
#
# K453(B120): Closes the "session writeout gap" — B118+B119 were invisible to
# get_diff_since_session until manual rebuild at B120 open. This script makes
# that impossible going forward.

set -euo pipefail

# ── args ──────────────────────────────────────────────────────────────────────
SESSION_ID="${1:-}"
SUMMARY="${2:-}"

if [[ -z "$SESSION_ID" ]]; then
  echo "ERROR: Missing session ID."
  echo "Usage: $0 B120 \"one-line summary of session\""
  exit 1
fi

# Ensure we have a B-number (strip B prefix for arithmetic, then restore)
if [[ ! "$SESSION_ID" =~ ^B[0-9]+$ ]]; then
  echo "ERROR: Session ID must be in the form B<number> (e.g. B120). Got: '$SESSION_ID'"
  exit 1
fi
B_NUM="${SESSION_ID#B}"
PREV_ID="B$(( B_NUM - 1 ))"

# ── paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MILESTONE_REL="BISHOP_DROPZONE/03_BishopHandoffs/MILESTONE_${SESSION_ID}_CLOSEOUT.md"
MILESTONE_ABS="$PLATFORM_ROOT/$MILESTONE_REL"
LIBRARIAN_DIR="$PLATFORM_ROOT/librarian-mcp"
CONTEXT_JSON="$LIBRARIAN_DIR/index/context.json"

echo ""
echo "=== Bishop Closeout: $SESSION_ID ==================================="
[[ -n "$SUMMARY" ]] && echo "    Summary: $SUMMARY"
echo ""

# ── Step 1: Verify milestone file ─────────────────────────────────────────────
echo "--- Step 1/3: Verifying milestone file ---"
if [[ -f "$MILESTONE_ABS" ]]; then
  echo "  OK  Milestone file found: $MILESTONE_REL"
else
  echo "  FAIL  Milestone file NOT found."
  echo "        Searched: $MILESTONE_ABS"
  echo ""
  echo "  Bishop must write MILESTONE_${SESSION_ID}_CLOSEOUT.md before calling this script."
  exit 1
fi

# ── Step 2: Rebuild Librarian index ───────────────────────────────────────────
echo ""
echo "--- Step 2/3: Rebuilding Librarian index ---"
echo "    Running: npm run rebuild (in librarian-mcp/)"

REBUILD_LOG="$(mktemp)"
trap 'rm -f "$REBUILD_LOG"' EXIT

cd "$LIBRARIAN_DIR"
if npm run rebuild >"$REBUILD_LOG" 2>&1; then
  REBUILD_OK=1
else
  REBUILD_EXIT=$?
  REBUILD_OK=0
fi

# Extract time + session count from output (example: "Index built in 47.1s (incremental)")
REBUILD_TIME="$(grep -oP 'Index built in \K[\d.]+s' "$REBUILD_LOG" | tail -1 || true)"
if [[ -z "$REBUILD_TIME" ]] && grep -q 'Index is FRESH' "$REBUILD_LOG"; then
  REBUILD_TIME="fresh/no-op"
fi
SESSION_COUNT="$(python3 -c "
import json, sys
try:
  d = json.load(open('$CONTEXT_JSON'))
  sessions = d.get('sessions', [])
  print(len(sessions))
except Exception as e:
  print('?')
" 2>/dev/null || echo "?")"

if [[ "$REBUILD_OK" -eq 1 ]]; then
  echo "  OK  Librarian index rebuilt (${REBUILD_TIME:-?}, ${SESSION_COUNT} sessions)"
else
  echo "  FAIL  npm run rebuild exited non-zero (exit $REBUILD_EXIT)."
  echo "        Last 20 lines of output:"
  tail -20 "$REBUILD_LOG" | sed 's/^/        /'
  exit 1
fi

# ── Step 3: Verify session appears in context.json ────────────────────────────
echo ""
echo "--- Step 3/3: Verifying $SESSION_ID is indexed ---"

cd "$PLATFORM_ROOT"
SESSION_FOUND="$(python3 -c "
import json, sys
try:
  d = json.load(open('$CONTEXT_JSON'))
  sessions = d.get('sessions', [])
  ids = [s.get('id','') for s in sessions]
  print('yes' if '$SESSION_ID' in ids else 'no')
except Exception as e:
  print('error: ' + str(e))
" 2>&1)"

if [[ "$SESSION_FOUND" == "yes" ]]; then
  echo "  OK  Session $SESSION_ID now visible in Librarian index"
else
  echo "  FAIL  Session $SESSION_ID not found in index after rebuild."
  echo "        context.json check returned: $SESSION_FOUND"
  echo ""
  echo "  This means get_diff_since_session $PREV_ID would NOT list $SESSION_ID."
  echo "  Check that the milestone file follows the MILESTONE_B###_CLOSEOUT.md naming"
  echo "  convention and that it contains a valid ## Headline section."
  exit 1
fi

# ── Success banner ─────────────────────────────────────────────────────────────
echo ""
echo "==================================================================="
echo "  OK  Milestone file verified: $MILESTONE_REL"
echo "  OK  Librarian index rebuilt (${REBUILD_TIME:-?}, ${SESSION_COUNT} sessions)"
echo "  OK  Session $SESSION_ID now visible via get_diff_since_session $PREV_ID"
echo "==================================================================="
echo ""
echo "    Bishop closeout COMPLETE for $SESSION_ID."
[[ -n "$SUMMARY" ]] && echo "    Ledger entry: \"$SUMMARY\""
echo ""
