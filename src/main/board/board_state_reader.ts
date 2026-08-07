// board_state_reader.ts -- KN-BP144-10 T1/T2/T3: Electron-main port of the read-only inference
// logic in HARDWIRE\tools\board.mjs (the standalone reference script).
//
// IMPORTANT PROVENANCE NOTE (found during Phase 1, not Phase 0): board.mjs was modified by
// someone other than this ticket's agent WHILE Phase 1 coding was already underway. The Phase 0
// report (BISHOP_DROPZONE/KN-BP144-10_REPORT.md) describes an EARLIER version of board.mjs (six
// states, five alarms, no secondary-file parsing, no worker labels, no read-only-phase
// detection). This file ports the CURRENT board.mjs as read at 2026-08-04 18:38:51 (its on-disk
// mtime at the time of this port) -- SEVEN states (added PHASE0-REPORTED) and SEVEN alarms
// (added COLLISION-RISK and DOUBLE-BOOKED; UNOWNED already existed at Phase 0). The Phase 0
// "secondary-file blind spot" finding is now MOOT -- the live script fixed it itself in the
// interim (secondary: [] parsing + COLLISION-RISK). See the Phase 1 section of the report for
// the full list of what changed between Phase 0 and Phase 1 and why re-deriving from the live
// script (rather than the Phase 0 notes) was the correct call: T1/T2 both say "the same
// states/alarms the script already computes" -- present tense, the live script, not a snapshot.
//
// This is still a PORT, not a rewrite: the seven-state ticket machine, the target/secondary
// regexes, the read-only-report heuristic, and all seven alarm rules below are kept byte-for-
// byte equivalent to board.mjs's own render()/collectTickets()/gitCommitsById()/newestReceipt()
// as of that mtime. Never "fixed" here even where a bug was found while porting (see the
// deliberately-preserved cwd omission on the onlySrcless git-show call below, and the ticket's
// own refusal: "if porting reveals a bug in it, report the bug, do not fix it here").
//
// The ONE deliberate deviation from board.mjs, and the reason this file exists instead of a
// literal transliteration: board.mjs shells out to git with synchronous execSync on every
// render tick (now TWICE as expensive per tick as at Phase 0 -- gitCommitsById + git status,
// PLUS one `git show --numstat` per commit of every reported ticket, to detect read-only
// phases), which is fine for a standalone CLI script but would repeatedly block Electron's
// main-process event loop if copied verbatim into a setInterval on the main side. This port
// uses the already-precedented async promisify(execFile) pattern from this same codebase (see
// src/main/index.ts's ollama-pull handler and src/main/dispatch/cephas_adapter.ts's execAsync)
// with an explicit timeout on every git call, so a slow or hung git call degrades to a logged,
// non-fatal `gitError` field on the snapshot instead of ever blocking the process. See
// board_ipc.ts for the second half of the mitigation (decoupling the git-dependent recompute
// cadence from the renderer's fast IPC-read cadence).

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const DROPZONE = 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\BISHOP_DROPZONE';
export const REPO = 'C:\\Users\\Administrator\\Documents\\mnemosyne';
export const DOWNLOADS = 'C:\\Users\\Administrator\\Downloads';
export const BOARD_STATE_PATH = path.join(
  'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\HARDWIRE',
  'board_state.json',
);

const STALL_MIN = 12; // no activity this long on a dispatched ticket -> STALLED (matches board.mjs)
// Ported for fidelity only -- board.mjs declares this constant but its own IDLE alarm logic
// never actually reads it (verified by inspection of board.mjs's render(), both at Phase 0 and
// again on the Phase 1 re-read). Not wired up here either, on purpose.
const IDLE_MIN = 15;
void IDLE_MIN;

const GIT_TIMEOUT_MS = 5000;

export type TicketStatus =
  | 'written'
  | 'DISPATCHED'
  | 'WORKING'
  | 'COMMITTED'
  | 'REPORTED'
  | 'REPORT-NO-COMMIT'
  | 'PHASE0-REPORTED';

export type AlarmKind = 'COLLISION' | 'COLLISION-RISK' | 'DOUBLE-BOOKED' | 'STALLED' | 'ORPHANED' | 'IDLE' | 'UNOWNED';

interface TicketRecord {
  id: string;
  ticketFile: string | null;
  reportFile: string | null;
  target: string | null;
  mode: string | null;
  secondary: string[];
}

interface CommitEntry {
  sha: string;
  iso: string;
  subj: string;
}

export interface BoardRow {
  id: string;
  status: TicketStatus;
  target: string | null;
  secondaryCount: number;
  mode: string | null;
  worker: string | null;
  lastSha: string;
  lastWhen: string;
  lastIso: string | null;
  dispatchedAt: string | null;
  activityMin: number | null;
}

export interface BoardAlarm {
  kind: AlarmKind;
  message: string;
}

export interface BoardSnapshot {
  computedAt: string;
  rows: BoardRow[];
  alarms: BoardAlarm[];
  dirtyFiles: string[];
  newestReceipt: { name: string; mtimeIso: string; minsAgo: number } | null;
  /** Non-fatal: set when this cycle's git shell-out failed or timed out. Rows/alarms from the
   *  PREVIOUS successful snapshot are not overwritten by the caller when this is set (see
   *  board_ipc.ts) -- an unknown value must be shown as unknown, never silently as "clean". */
  gitError: string | null;
}

/** Mirrors board.mjs's own dispatched-entry shape exactly: either the old plain ISO string (no
 *  worker known) or { at, worker } once a worker label has been recorded. Both shapes coexist
 *  in the SAME board_state.json board.mjs itself writes -- no migration, matching board.mjs's
 *  own dispatchInfo() comment verbatim. */
type DispatchEntry = string | { at?: string; worker?: string | null };

interface DispatchState {
  dispatched: Record<string, DispatchEntry>;
}

function dispatchInfo(entry: DispatchEntry | undefined): { at: string | null; worker: string | null } {
  if (!entry) return { at: null, worker: null };
  if (typeof entry === 'string') return { at: entry, worker: null };
  return { at: entry.at || null, worker: entry.worker || null };
}

function loadDispatchState(): DispatchState {
  try {
    const raw = JSON.parse(fs.readFileSync(BOARD_STATE_PATH, 'utf8'));
    if (raw && typeof raw === 'object' && raw.dispatched && typeof raw.dispatched === 'object') {
      return raw as DispatchState;
    }
    return { dispatched: {} };
  } catch {
    return { dispatched: {} };
  }
}

function saveDispatchState(s: DispatchState): void {
  fs.writeFileSync(BOARD_STATE_PATH, JSON.stringify(s, null, 2));
}

/** T4: the single fact artifacts cannot prove. Reads and writes the SAME file board.mjs's own
 *  --dispatch flag writes -- no second state store. Unlabeled (no worker) writes the plain ISO
 *  string, exactly like board.mjs's own unlabeled --dispatch path, so an entry never gets
 *  forced into the object shape unless a worker is actually supplied. */
export function markDispatched(id: string, worker?: string | null): string {
  const s = loadDispatchState();
  const now = new Date().toISOString();
  s.dispatched[id] = worker ? { at: now, worker } : now;
  saveDispatchState(s);
  return now;
}

function minsSince(d: string | Date | null): number | null {
  return d ? Math.floor((Date.now() - new Date(d).getTime()) / 60000) : null;
}

function collectTickets(): TicketRecord[] {
  const files = fs.readdirSync(DROPZONE).filter((f) => /^KN-BP\d+-\d+.*\.md$/.test(f));
  const byId = new Map<string, TicketRecord>();
  for (const f of files) {
    const m = f.match(/^(KN-BP\d+-\d+)/);
    if (!m) continue;
    const id = m[1];
    const full = path.join(DROPZONE, f);
    const isReport = /_REPORT\.md$/i.test(f);
    if (!byId.has(id)) byId.set(id, { id, ticketFile: null, reportFile: null, target: null, mode: null, secondary: [] });
    const t = byId.get(id)!;
    if (isReport) t.reportFile = full;
    else if (!t.ticketFile || f.length > path.basename(t.ticketFile).length) t.ticketFile = full;
  }
  for (const t of byId.values()) {
    if (!t.ticketFile) continue;
    const body = fs.readFileSync(t.ticketFile, 'utf8');
    const tm =
      body.match(/\*\*Your file:\*\*\s*`([^`]+)`/) ||
      body.match(/\*\*File you will touch:\*\*\s*`?([^`\n]+?)`?\s*(?:\(|$)/m) ||
      body.match(/\*\*File touched:\*\*\s*`([^`]+)`/) ||
      body.match(/\*\*Your files?:\*\*\s*`([^`]+)`/);
    if (tm) t.target = tm[1].trim().replace(/^.*mnemosyne[\\/]/, '');
    const mm = body.match(/\*\*MODE:\s*([A-Z ]+)/);
    if (mm) t.mode = mm[1].trim();

    // Secondary files: added to board.mjs between Phase 0 and Phase 1 of THIS ticket. Grabs
    // every backticked path on the "**Secondary, expect to touch:**" line, not just the first.
    const sm = body.match(/\*\*Secondary, expect to touch:\*\*(.*)$/m);
    if (sm) {
      const pathMatches = [...sm[1].matchAll(/`([^`]+)`/g)];
      t.secondary = pathMatches
        .map((p) => p[1].trim().replace(/^.*mnemosyne[\\/]/, ''))
        .filter(Boolean);
    }
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

async function gitCommitsById(): Promise<{ map: Map<string, CommitEntry[]>; error: string | null }> {
  try {
    // No -N cap: DIAGNOSED BUG (BP148 D-BP148-027) -- a fixed commit-count lookback is a lie that
    // gets worse over time. board.mjs/this port's job is to say whether a ticket has a real
    // commit ANYWHERE in history, not "in the last N commits" -- once a matching commit ages past
    // rank N it silently flips REPORTED/COMMITTED work to a false ORPHANED alarm, and every new
    // commit after that makes the window one commit narrower for everyone behind it. Six real
    // KN-BP143/144 commits (ranks 61-76) were false-ORPHANED by the old `git log -60` cap; see
    // BISHOP_DROPZONE/BOARD_ORPHAN_FIX_BP148.md for the measurement. Measured cost of the
    // uncapped call on this repo (306 commits, 2026-08-07): ~66ms vs ~50ms capped -- negligible
    // against both the 5s GIT_TIMEOUT_MS and the 15s BOARD_RECOMPUTE_MS poll cadence (see
    // board_ipc.ts). If this repo's history ever grows enough (rough linear extrapolation: ~0.2ms
    // per commit here, so low thousands of commits before this starts to matter) that the
    // uncapped walk becomes a real fraction of the 15s cadence, the fix is to bound cost by MATCH
    // count instead of history depth -- e.g. `git log --all --grep=<ticket-id-alternation>` built
    // from collectTickets()'s live id list -- not to reintroduce a fixed commit-count cap, which
    // is the exact defect this comment documents.
    const { stdout } = await execFileAsync(
      'git',
      ['log', '--format=%h%x1f%cI%x1f%s'],
      { cwd: REPO, encoding: 'utf8', timeout: GIT_TIMEOUT_MS },
    );
    const map = new Map<string, CommitEntry[]>();
    for (const line of stdout.split('\n').filter(Boolean)) {
      const [sha, iso, ...rest] = line.split('\x1f');
      const subj = rest.join(' ');
      const m = subj.match(/(KN-BP\d+-\d+)/);
      if (!m) continue;
      if (!map.has(m[1])) map.set(m[1], []);
      map.get(m[1])!.push({ sha, iso, subj });
    }
    return { map, error: null };
  } catch (e) {
    return { map: new Map(), error: `git log failed: ${String((e as Error)?.message ?? e)}` };
  }
}

async function gitDirtyFiles(): Promise<{ files: string[]; error: string | null }> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['status', '--porcelain', '--', 'src'],
      { cwd: REPO, encoding: 'utf8', timeout: GIT_TIMEOUT_MS },
    );
    const lines = stdout.split('\n').filter(Boolean);
    return { files: lines.map((l) => l.slice(3).trim()), error: null };
  } catch (e) {
    return { files: [], error: `git status failed: ${String((e as Error)?.message ?? e)}` };
  }
}

/** Mirrors board.mjs's onlySrcless check inside its readOnlyReport detection EXACTLY, including
 *  a bug discovered while porting: board.mjs's own call -- sh(`git show --numstat --format=""
 *  ${c.sha}`) -- omits the cwd argument its sh(cmd, cwd) helper takes everywhere else, so on the
 *  live script it runs in whatever directory the operator happened to invoke `node board.mjs`
 *  from, not REPO. When that directory isn't the mnemosyne repo (the common case -- e.g. the
 *  Founder's own convention of cd'ing into HARDWIRE\tools first), git show fails, sh() catches
 *  and returns '', and onlySrcless silently evaluates to false for that commit -- the git-based
 *  half of read-only detection never actually fires in practice; only the text-pattern half
 *  does. Reported as a finding for a follow-on ticket, NOT fixed here (ticket refusal). This
 *  port deliberately reproduces the same omission (no cwd passed to execFileAsync below) so
 *  Electron's behavior matches the live script's REAL behavior, not the behavior the comment in
 *  board.mjs implies it should have. */
async function commitTouchesOnlySrcless(sha: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['show', '--numstat', '--format=', sha],
      { encoding: 'utf8', timeout: GIT_TIMEOUT_MS },
    );
    const files = stdout.split('\n').filter(Boolean).map((l) => l.split('\t')[2] || '');
    return files.length > 0 && files.every((f) => !f.startsWith('src/'));
  } catch {
    return false;
  }
}

async function detectReadOnlyReport(reportFile: string, commits: CommitEntry[]): Promise<boolean> {
  let readOnlyReport = false;
  try {
    const rt = fs.readFileSync(reportFile, 'utf8');
    readOnlyReport =
      /read-only|read only/i.test(rt) &&
      /(no code changed|no `?src`?[^\n]{0,40}(touched|modified)|no file under `?src`?[^\n]{0,20}(touched|modified)|NO CODE CHANGED|no `src\/` touched|no code (?:was )?written)/i.test(rt);
    if (!readOnlyReport && commits.length) {
      const results = await Promise.all(commits.map((c) => commitTouchesOnlySrcless(c.sha)));
      if (results.every(Boolean)) readOnlyReport = true;
    }
  } catch {
    /* unreadable report: fall through to the strict path, matching board.mjs's own try/catch */
  }
  return readOnlyReport;
}

function newestReceipt(): { name: string; mtimeIso: string; minsAgo: number } | null {
  try {
    const f = fs
      .readdirSync(DOWNLOADS)
      .filter((x) => x.includes('mnemo_mesh_test_receipt') && x.endsWith('.json'))
      .map((x) => ({ name: x, mtime: fs.statSync(path.join(DOWNLOADS, x)).mtime }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    if (!f.length) return null;
    return { name: f[0].name, mtimeIso: f[0].mtime.toISOString(), minsAgo: minsSince(f[0].mtime) ?? 0 };
  } catch {
    return null;
  }
}

/** Faithful port of board.mjs's render(): same SEVEN ticket states, same SEVEN alarms it
 *  actually computes as of the mtime documented at the top of this file. Pure data out -- no
 *  console output, no side effects beyond the async git reads. */
export async function computeBoardSnapshot(): Promise<BoardSnapshot> {
  const state = loadDispatchState();
  const tickets = collectTickets();
  const [{ map: commits, error: gitLogError }, { files: dirtyFiles, error: gitStatusError }] = await Promise.all([
    gitCommitsById(),
    gitDirtyFiles(),
  ]);

  const rows: BoardRow[] = [];
  for (const t of tickets) {
    const cs = commits.get(t.id) || [];
    const { at: dispatchedAt, worker } = dispatchInfo(state.dispatched[t.id]);
    let status: TicketStatus;
    let activityMin: number | null = null;

    let targetMtime: Date | null = null;
    if (t.target) {
      const p = path.join(REPO, t.target);
      if (fs.existsSync(p)) targetMtime = fs.statSync(p).mtime;
    }

    const readOnlyReport = t.reportFile ? await detectReadOnlyReport(t.reportFile, cs) : false;

    if (t.reportFile && cs.length && readOnlyReport) status = 'PHASE0-REPORTED';
    else if (t.reportFile && cs.length) status = 'REPORTED';
    else if (t.reportFile && readOnlyReport) status = 'PHASE0-REPORTED';
    else if (t.reportFile) status = 'REPORT-NO-COMMIT';
    else if (cs.length) status = 'COMMITTED';
    else if (dispatchedAt) {
      const m = targetMtime ? minsSince(targetMtime) : null;
      activityMin = m;
      status = m !== null && m < 3 ? 'WORKING' : 'DISPATCHED';
    } else status = 'written';

    const lastSha = cs.length ? cs[0].sha : '';
    const lastIso = cs.length ? cs[0].iso : null;
    const lastWhen = cs.length ? new Date(cs[0].iso).toLocaleTimeString() : '';
    rows.push({
      id: t.id,
      status,
      target: t.target,
      secondaryCount: t.secondary.length,
      mode: t.mode,
      worker: ['DISPATCHED', 'WORKING'].includes(status) ? worker : null,
      lastSha,
      lastWhen,
      lastIso,
      dispatchedAt,
      activityMin,
    });
  }

  const alarms: BoardAlarm[] = [];
  const secondaryById = new Map(tickets.map((t) => [t.id, t.secondary]));
  const liveStatuses: TicketStatus[] = ['DISPATCHED', 'WORKING', 'COMMITTED'];

  // COLLISION: two not-finished tickets declaring the same PRIMARY target.
  const live = rows.filter((r) => liveStatuses.includes(r.status) && r.target);
  const byTarget = new Map<string, string[]>();
  for (const r of live) {
    if (!r.target) continue;
    if (!byTarget.has(r.target)) byTarget.set(r.target, []);
    byTarget.get(r.target)!.push(r.id);
  }
  for (const [file, ids] of byTarget) {
    if (ids.length > 1) {
      alarms.push({ kind: 'COLLISION', message: `${ids.join(' and ')} both declare ${file}. Never two writers on one file.` });
    }
  }

  // COLLISION-RISK: a live ticket's SECONDARY declaration overlaps another live ticket's file
  // (primary or secondary). Skipped when every claimant is primary-only (already COLLISION).
  const liveAll = rows.filter((r) => liveStatuses.includes(r.status));
  const fileOwners = new Map<string, Map<string, Set<'primary' | 'secondary'>>>();
  for (const r of liveAll) {
    const claim = (file: string | null | undefined, kind: 'primary' | 'secondary') => {
      if (!file) return;
      if (!fileOwners.has(file)) fileOwners.set(file, new Map());
      const owners = fileOwners.get(file)!;
      if (!owners.has(r.id)) owners.set(r.id, new Set());
      owners.get(r.id)!.add(kind);
    };
    claim(r.target, 'primary');
    for (const f of secondaryById.get(r.id) ?? []) claim(f, 'secondary');
  }
  for (const [file, owners] of fileOwners) {
    const ids = [...owners.keys()];
    if (ids.length < 2) continue;
    const allPrimaryOnly = ids.every((id) => owners.get(id)!.has('primary') && !owners.get(id)!.has('secondary'));
    if (allPrimaryOnly) continue;
    const parts = ids.map((id) => `${id} (${owners.get(id)!.has('primary') ? 'primary' : 'secondary'})`);
    alarms.push({
      kind: 'COLLISION-RISK',
      message: `${parts.join(' and ')} may both reach ${file}. At least one side is a secondary declaration, so this is possible, not certain. Verify before treating it as a hard collision.`,
    });
  }

  // DOUBLE-BOOKED: same worker label recorded against two live tickets.
  const liveWithWorker = rows.filter((r) => liveStatuses.includes(r.status) && r.worker);
  const byWorker = new Map<string, string[]>();
  for (const r of liveWithWorker) {
    if (!r.worker) continue;
    if (!byWorker.has(r.worker)) byWorker.set(r.worker, []);
    byWorker.get(r.worker)!.push(r.id);
  }
  for (const [worker, ids] of byWorker) {
    if (ids.length > 1) {
      alarms.push({ kind: 'DOUBLE-BOOKED', message: `${worker} is recorded against ${ids.join(' and ')}. One worker cannot hold two tickets at once.` });
    }
  }

  // STALLED
  for (const r of rows) {
    if (r.status === 'DISPATCHED' && r.dispatchedAt) {
      const m = minsSince(r.dispatchedAt);
      if (m !== null && m > STALL_MIN && (r.activityMin === null || r.activityMin > STALL_MIN)) {
        alarms.push({ kind: 'STALLED', message: `${r.id} dispatched ${m}m ago, no activity on ${r.target || 'its target'}.` });
      }
    }
  }

  // ORPHANED: never fires on PHASE0-REPORTED -- that is the design working, not a report
  // missing its code.
  for (const r of rows) {
    if (r.status === 'REPORT-NO-COMMIT') {
      alarms.push({ kind: 'ORPHANED', message: `${r.id} has a report claiming code work and no commit. Verify before believing it.` });
    }
  }

  // IDLE: nothing moving anywhere while written-but-undispatched work exists
  const anyLive = rows.some((r) => (['WORKING', 'DISPATCHED'] as TicketStatus[]).includes(r.status));
  const queued = rows.filter((r) => r.status === 'written').map((r) => r.id);
  if (!anyLive && queued.length) {
    alarms.push({ kind: 'IDLE', message: `nothing is running and ${queued.length} ticket(s) are written and undispatched: ${queued.join(', ')}` });
  }

  // UNOWNED: uncommitted work with no owning (primary-target) ticket.
  if (dirtyFiles.length) {
    const owned = new Set(live.map((r) => r.target).filter((x): x is string => Boolean(x)));
    const unowned = dirtyFiles.filter((f) => ![...owned].some((o) => f.includes(o.replace(/\\/g, '/'))));
    if (unowned.length && !anyLive) {
      alarms.push({ kind: 'UNOWNED', message: `uncommitted changes with no dispatched ticket: ${unowned.slice(0, 4).join(', ')}` });
    }
  }

  const receipt = newestReceipt();
  const gitError = gitLogError || gitStatusError ? [gitLogError, gitStatusError].filter(Boolean).join('; ') : null;

  return {
    computedAt: new Date().toISOString(),
    rows,
    alarms,
    dirtyFiles,
    newestReceipt: receipt,
    gitError,
  };
}
