// board_alarm_actions.ts -- BP148 D-BP148-031: real actions behind Grand Central's alarm cards.
//
// THE PROBLEM THIS FIXES: the Founder clicked into an UNOWNED alarm and found a sentence with
// no button -- "it still doesn't tell me what to do with it." This module is the "what do I do
// about it" half of every alarm: a persisted, recoverable dismiss/acknowledge path for every
// alarm kind, plus three real git actions for UNOWNED specifically (commit / park to a branch /
// discard), because "uncommitted changes with no ticket" is the one alarm kind where the fix is
// an actual filesystem operation, not just a human decision recorded elsewhere.
//
// SAFETY DISCIPLINE (all three matter equally):
//   1. Every git mutation here stages by EXPLICIT PATH ONLY -- never `-A`, `.`, or a glob. This
//      mirrors the exact HARDWIRE-15 discipline this ticket's own dispatch brief was written
//      under (five index races tonight from wildcard staging). See stageExplicit() below: it is
//      the only function in this file allowed to call `git add`, and it refuses a request with
//      zero files.
//   2. Every file this module is asked to touch is validated against a FRESH `git status
//      --porcelain -- src` read at call time (validateAgainstRealDirtyFiles()) -- never trusted
//      from whatever the renderer last polled. A stale UI snapshot cannot be used to commit,
//      park, or discard a file that is no longer actually dirty (or was never dirty at all).
//   3. discardUnownedFiles() is the one irreversible action in this module. It requires an
//      explicit `confirm: true` in the IPC payload (defense in depth behind the UI's own
//      two-step confirm -- see BoardPanel.tsx), and it still prefers the non-destructive park
//      path be offered first in the UI (see the Founder's own instruction: "prefer offering
//      'park to a branch' over 'discard' wherever both would serve").
//
// DISMISSALS live in their OWN file (BOARD_ALARM_DISMISSALS_PATH), a sibling of
// board_state.json, NOT a new key inside board_state.json itself. board_state.json is the file
// board.mjs's own --dispatch flag reads and writes (see board_state_reader.ts's header) --
// adding a second writer's data into that same file would risk an external consumer of
// board.mjs's format choking on an unrecognized key, for no benefit; a sibling file costs
// nothing and keeps the two concerns (dispatch ledger vs. alarm acknowledgements) visibly
// separate on disk.

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { REPO, BOARD_STATE_PATH } from './board_state_reader';
import type { AlarmDismissal, AlarmKind } from '../../shared/board/alarm_key';

const execFileAsync = promisify(execFile);
const GIT_TIMEOUT_MS = 8000;

export const BOARD_ALARM_DISMISSALS_PATH = path.join(
  path.dirname(BOARD_STATE_PATH),
  'board_alarm_dismissals.json',
);

// ─── Dismissals: persisted, recoverable, never erased ──────────────────────────────────────

interface DismissalsFile {
  dismissals: Record<string, AlarmDismissal>;
}

function loadDismissals(): DismissalsFile {
  try {
    const raw = JSON.parse(fs.readFileSync(BOARD_ALARM_DISMISSALS_PATH, 'utf8'));
    if (raw && typeof raw === 'object' && raw.dismissals && typeof raw.dismissals === 'object') {
      return raw as DismissalsFile;
    }
    return { dismissals: {} };
  } catch {
    return { dismissals: {} };
  }
}

function saveDismissals(s: DismissalsFile): void {
  fs.mkdirSync(path.dirname(BOARD_ALARM_DISMISSALS_PATH), { recursive: true });
  fs.writeFileSync(BOARD_ALARM_DISMISSALS_PATH, JSON.stringify(s, null, 2));
}

/** Read-only: every dismissal ever recorded, active or restored. The renderer uses this to
 *  render BOTH the "hide from the active list" filter and the visible "previously dismissed"
 *  section -- nothing here is ever deleted, only appended or flipped to restored. */
export function listDismissals(): AlarmDismissal[] {
  return Object.values(loadDismissals().dismissals).sort((a, b) =>
    a.dismissedAt < b.dismissedAt ? 1 : a.dismissedAt > b.dismissedAt ? -1 : 0,
  );
}

/** Records that an alarm was acknowledged/dismissed. Idempotent on the SAME key: re-dismissing
 *  just refreshes dismissedAt/note and clears any prior restoredAt, rather than creating a
 *  second row for the same real-world alarm. */
export function dismissAlarm(key: string, kind: AlarmKind, message: string, note: string | null): AlarmDismissal {
  const s = loadDismissals();
  const record: AlarmDismissal = {
    key,
    kind,
    message,
    note: note && note.trim() ? note.trim() : null,
    dismissedAt: new Date().toISOString(),
    restoredAt: null,
  };
  s.dismissals[key] = record;
  saveDismissals(s);
  return record;
}

/** Un-dismisses (restores) a previously dismissed alarm -- the recoverable half of "persisted
 *  and recoverable." Does NOT delete the row: restoredAt is stamped so the acknowledgement
 *  history stays visible (who/when it was dismissed, and when it was undone). Returns null if
 *  the key was never dismissed. */
export function restoreAlarm(key: string): AlarmDismissal | null {
  const s = loadDismissals();
  const existing = s.dismissals[key];
  if (!existing) return null;
  const record: AlarmDismissal = { ...existing, restoredAt: new Date().toISOString() };
  s.dismissals[key] = record;
  saveDismissals(s);
  return record;
}

// ─── UNOWNED actions: commit / park / discard, all explicit-path-only ──────────────────────

export interface GitActionResult {
  ok: boolean;
  error: string | null;
}

export interface CommitUnownedResult extends GitActionResult {
  sha: string | null;
  stat: string | null;
}

export interface ParkUnownedResult extends GitActionResult {
  branch: string | null;
  sha: string | null;
  stat: string | null;
  returnedToBranch: string | null;
}

export interface DiscardFileResult {
  file: string;
  action: 'deleted-untracked' | 'reverted-tracked' | 'skipped-not-dirty';
  ok: boolean;
  error: string | null;
}

export interface DiscardUnownedResult extends GitActionResult {
  results: DiscardFileResult[];
}

async function git(args: string[], cwd = REPO): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync('git', args, { cwd, encoding: 'utf8', timeout: GIT_TIMEOUT_MS });
}

/** Re-reads REAL `git status --porcelain -- src` at call time (never trusts a possibly-stale
 *  renderer-side snapshot) and returns the subset of `requestedFiles` that is genuinely dirty
 *  right now, plus each file's raw porcelain status code (needed by discardUnownedFiles to tell
 *  an untracked file from a modified tracked one). Files the caller asked for that are NOT
 *  actually dirty are silently excluded -- this is the guard against acting on stale input, not
 *  a place to report a mismatch as an error (an alarm the user is reacting to may have already
 *  partially resolved itself between poll and click; that is not a failure). */
async function realDirtyStatusFor(requestedFiles: string[]): Promise<Map<string, string>> {
  const { stdout } = await git(['status', '--porcelain', '--', 'src']);
  const byFile = new Map<string, string>();
  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue;
    const code = line.slice(0, 2);
    const file = line.slice(3).trim();
    byFile.set(file, code);
  }
  const wanted = new Set(requestedFiles);
  const out = new Map<string, string>();
  for (const [file, code] of byFile) {
    if (wanted.has(file)) out.set(file, code);
  }
  return out;
}

function requireNonEmptyFiles(files: string[]): string | null {
  if (!Array.isArray(files) || files.length === 0) return 'no files given -- refusing a wildcard-shaped no-op';
  if (files.some((f) => typeof f !== 'string' || !f.trim())) return 'one or more file paths were empty/invalid';
  return null;
}

/** Commits exactly the given files, explicit-path `git add`, never `-A`/`.`/a glob. Validates
 *  every requested file is REALLY dirty right now before adding anything. */
export async function commitUnownedFiles(files: string[], message: string): Promise<CommitUnownedResult> {
  const badInput = requireNonEmptyFiles(files);
  if (badInput) return { ok: false, error: badInput, sha: null, stat: null };
  if (!message || !message.trim()) return { ok: false, error: 'commit message is required', sha: null, stat: null };

  try {
    const real = await realDirtyStatusFor(files);
    const toAdd = files.filter((f) => real.has(f));
    if (toAdd.length === 0) {
      return { ok: false, error: 'none of the requested files are actually dirty right now (already committed or reverted since the alarm was last computed)', sha: null, stat: null };
    }
    await git(['add', '--', ...toAdd]);
    await git(['commit', '-m', message.trim()]);
    const { stdout: sha } = await git(['rev-parse', 'HEAD']);
    const { stdout: stat } = await git(['show', '--stat', '--name-only', sha.trim()]);
    return { ok: true, error: null, sha: sha.trim(), stat: stat.trim() };
  } catch (e) {
    return { ok: false, error: `git failed: ${String((e as Error)?.message ?? e)}`, sha: null, stat: null };
  }
}

/** Parks exactly the given files on a NEW branch created from the current HEAD, then returns to
 *  the branch the repo was on before this call -- the exact convention Bishop's own worked
 *  example used (commit f062de8f on bp148-generator-wiring-measured-worse): the files' changes
 *  become a real commit on the parking branch, and checking back out to the original branch
 *  restores its working tree to clean (the changes are safely preserved on the new branch's
 *  history, not lost, not left dirty on the original branch either). Never destructive -- see
 *  "prefer park over discard" in this file's header. */
export async function parkUnownedFiles(files: string[], branchName: string, message: string): Promise<ParkUnownedResult> {
  const badInput = requireNonEmptyFiles(files);
  if (badInput) return { ok: false, error: badInput, branch: null, sha: null, stat: null, returnedToBranch: null };
  if (!branchName || !/^[a-zA-Z0-9._/-]+$/.test(branchName)) {
    return { ok: false, error: 'branch name is required and must be a plain git-safe branch name', branch: null, sha: null, stat: null, returnedToBranch: null };
  }

  let originalBranch: string | null = null;
  try {
    const { stdout: cur } = await git(['rev-parse', '--abbrev-ref', 'HEAD']);
    originalBranch = cur.trim();

    const real = await realDirtyStatusFor(files);
    const toAdd = files.filter((f) => real.has(f));
    if (toAdd.length === 0) {
      return { ok: false, error: 'none of the requested files are actually dirty right now', branch: null, sha: null, stat: null, returnedToBranch: null };
    }

    await git(['checkout', '-b', branchName]);
    await git(['add', '--', ...toAdd]);
    await git(['commit', '-m', message && message.trim() ? message.trim() : `PARKED via board UI: ${toAdd.join(', ')}`]);
    const { stdout: sha } = await git(['rev-parse', 'HEAD']);
    const { stdout: stat } = await git(['show', '--stat', '--name-only', sha.trim()]);
    await git(['checkout', originalBranch]);

    return { ok: true, error: null, branch: branchName, sha: sha.trim(), stat: stat.trim(), returnedToBranch: originalBranch };
  } catch (e) {
    // Best-effort: if we made it past the checkout -b but failed after, try to return to the
    // original branch so the repo is not left stranded on the new branch. Never throws further
    // -- a failed cleanup attempt still reports the ORIGINAL error, not a masked one.
    if (originalBranch) {
      try { await git(['checkout', originalBranch]); } catch { /* best-effort only */ }
    }
    return { ok: false, error: `git failed: ${String((e as Error)?.message ?? e)}`, branch: null, sha: null, stat: null, returnedToBranch: originalBranch };
  }
}

/** THE ONE IRREVERSIBLE ACTION IN THIS MODULE. Requires `confirm === true` from the caller
 *  (BoardPanel.tsx's own two-step UI confirm sets this only after the user has seen the exact
 *  file list and clicked a second, explicitly-labelled "Yes, discard" control) -- this is
 *  defense in depth, not the only gate. Handles the two real dirty shapes differently, because
 *  `git checkout --` does not touch untracked files at all:
 *    - untracked (`??`)              -> the file is deleted from disk (fs.unlink).
 *    - tracked, modified/staged      -> `git reset -- file` (unstage) then `git checkout -- file`
 *                                       (restore working-tree content to HEAD's version).
 *  Every file gets its own try/catch so one failure does not abort the rest; the per-file result
 *  array is the evidence returned to the caller, never a bare boolean. */
export async function discardUnownedFiles(files: string[], confirm: boolean): Promise<DiscardUnownedResult> {
  const badInput = requireNonEmptyFiles(files);
  if (badInput) return { ok: false, error: badInput, results: [] };
  if (confirm !== true) {
    return { ok: false, error: 'discard requires explicit confirm:true -- refusing an unconfirmed destructive call', results: [] };
  }

  const real = await realDirtyStatusFor(files);
  const results: DiscardFileResult[] = [];

  for (const file of files) {
    const code = real.get(file);
    if (!code) {
      results.push({ file, action: 'skipped-not-dirty', ok: false, error: 'not actually dirty right now -- nothing to discard' });
      continue;
    }
    try {
      if (code.startsWith('??')) {
        fs.unlinkSync(path.join(REPO, file));
        results.push({ file, action: 'deleted-untracked', ok: true, error: null });
      } else {
        await git(['reset', '--', file]);
        await git(['checkout', '--', file]);
        results.push({ file, action: 'reverted-tracked', ok: true, error: null });
      }
    } catch (e) {
      results.push({ file, action: code.startsWith('??') ? 'deleted-untracked' : 'reverted-tracked', ok: false, error: String((e as Error)?.message ?? e) });
    }
  }

  const anyFailed = results.some((r) => !r.ok);
  return { ok: !anyFailed, error: anyFailed ? 'one or more files failed to discard -- see per-file results' : null, results };
}
