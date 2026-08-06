// yoke_watcher.ts -- KN-BP147-M2: THE RESIDENT CONSUMER. OD-04. THE RED QUEEN.
//
// Watches HARDWIRE\LEDGER\YOKE\BLOCKED\, HARDWIRE\LEDGER\RETURNS\, and heartbeat staleness
// under HARDWIRE\LEDGER\YOKE\HEARTBEAT\ -- and survives the death of any actor session,
// because it runs inside MnemosyneC's own main process, not inside an IDE session.
//
// THIS IS THE WATCH ACT CLASS ONLY. Free. Read-only. Never spawns, dispatches, or calls a
// metered model -- see autopilot_grant.ts for why ACT is refused unconditionally in this
// landing, and resident_settings.ts for the persisted "armed" switch this module obeys.
//
// STATE MODEL -- five states named in HARDWIRE-00 Section 6 / 6.2d, resolved honestly:
//
//   WORKING              heartbeat touched within STALE_THRESHOLD_MS, no BLOCKED, no RETURN.
//   WAITING              a BLOCKED file exists with no UNBLOCKED reply yet. HEALTHY, no alarm
//                         (HARDWIRE-00 6.2d: "nothing to beat about... the healthiest possible
//                         reason").
//   ANSWER_UNCOLLECTED   an UNBLOCKED reply is newer than its BLOCKED file, but no heartbeat
//                         and no RETURN has landed since. Named verbatim in HARDWIRE-00 6.2d
//                         ("ANSWER UNCOLLECTED -- waiting, not hung"). Mild alarm: the worker
//                         has an answer sitting unread.
//   FINISHED             a RETURNS file exists for this dispatch id. The dispatch WAS
//                         signalled -- via the return, which IS the completion signal (Section
//                         4.1) -- even if its heartbeat went stale afterward. HEALTHY, no
//                         alarm ("a completed dispatch going quiet is healthy and must not
//                         alarm," ticket line 73).
//   HUNG_OR_CRASHED       no RETURN, no BLOCKED, and the heartbeat is stale (or was never
//                         written) past STALE_THRESHOLD_MS. ALARM.
//
// AN HONEST LIMIT, STATED BEFORE IT BITES (refusal duty: never fabricate a precondition, and
// a fabricated DISTINCTION is the same violation applied to a classification instead of a
// gate): the ticket names "hung" and "crashed" as two of the five states, but nothing in the
// yoke's file evidence -- a stale heartbeat, no BLOCKED, no RETURN -- can mechanically tell
// the two apart. A hung-but-technically-alive actor and an actor whose process has actually
// died produce byte-identical evidence on disk. This module reports the honest merged label
// HUNG_OR_CRASHED rather than inventing a signal it does not have (e.g. probing for a live
// process by PID would be guessing which OS process belongs to which dispatch -- across
// different IDEs, machines, and actors, that guess would itself be a fabricated
// precondition). Both sub-states require identical human attention, which is the
// operationally load-bearing fact; the label says so honestly instead of pretending to a
// precision this consumer does not have.

import { existsSync, readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import { getResidentWatchSettings, isWatchArmed } from './resident_settings';
import { buildWatchGrant, type AutopilotGrant } from './autopilot_grant';

// Absolute paths, matching the convention already established by
// HARDWIRE\tools\_beat_helper.ps1:72 ($dir = '...\LEDGER\YOKE\HEARTBEAT'), which hardcodes the
// same ledger root rather than deriving it -- this is single-machine estate tooling, not a
// portable library.
const LEDGER_ROOT = 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\HARDWIRE\\LEDGER';
const BLOCKED_DIR = join(LEDGER_ROOT, 'YOKE', 'BLOCKED');
const UNBLOCKED_DIR = join(LEDGER_ROOT, 'YOKE', 'UNBLOCKED');
const RETURNS_DIR = join(LEDGER_ROOT, 'RETURNS');
const HEARTBEAT_DIR = join(LEDGER_ROOT, 'YOKE', 'HEARTBEAT');

// House law Section 6.2: "Touch it at least every ten minutes while a dispatch is live." 15
// minutes gives one full missed cadence of slack before this consumer calls a silence stale,
// so a single delayed beat does not fire a false alarm.
const STALE_THRESHOLD_MS = 15 * 60 * 1000;

export type DispatchState =
  | 'WORKING'
  | 'WAITING'
  | 'ANSWER_UNCOLLECTED'
  | 'FINISHED'
  | 'HUNG_OR_CRASHED';

export interface DispatchStatus {
  dispatchId: string;
  state: DispatchState;
  detail: string;
  lastEvidenceUtc: string | null;
  alarms: boolean;
}

export interface ResidentStatusSnapshot {
  armed: boolean;
  lastPollUtc: string;
  pollCount: number;
  dispatches: DispatchStatus[];
  actorBeats: { actorOrBishopId: string; lastBeatUtc: string; stale: boolean }[];
  grant: AutopilotGrant;
}

// DISPATCH_ID_RE matches D-BP<digits>-<digits> with an optional -<suffix> tail (e.g.
// D-BP147-001-S), and stops before the first underscore/dot that follows it. Anchored at the
// start of the filename.
const DISPATCH_ID_RE = /^(D-BP\d+-\d+(?:-[A-Za-z0-9]+)?)/;

function safeReaddir(dir: string): string[] {
  try {
    if (!existsSync(dir)) return [];
    return readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.md') || f.toLowerCase().endsWith('.beat'));
  } catch (err) {
    // FAIL OPEN ON THE WATCH TIER (ticket line 98): a directory this consumer cannot read is
    // logged loudly, and the poll continues with whatever the other directories yielded --
    // it never wedges the loop.
    console.error(`[resident/yoke_watcher] cannot read ${dir} (failing open, continuing poll):`, err);
    return [];
  }
}

function mtimeMs(path: string): number {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return 0;
  }
}

function extractDispatchId(filename: string): string | null {
  const m = DISPATCH_ID_RE.exec(filename);
  return m ? m[1] : null;
}

/** One poll: reads the three ledger directories plus UNBLOCKED, classifies every dispatch id
 *  it can see, and returns a full snapshot. Never throws -- every directory read is wrapped
 *  so one unreadable directory cannot take down the whole poll (fail open, ticket line 98). */
export function scanYoke(): ResidentStatusSnapshot {
  const nowMs = Date.now();
  const dispatchIds = new Set<string>();

  const blockedFiles = safeReaddir(BLOCKED_DIR).filter((f) => f.endsWith('.md'));
  const unblockedFiles = safeReaddir(UNBLOCKED_DIR).filter((f) => f.endsWith('.md'));
  const returnFiles = safeReaddir(RETURNS_DIR).filter((f) => f.endsWith('.md'));
  const heartbeatFiles = safeReaddir(HEARTBEAT_DIR).filter((f) => f.endsWith('.beat'));

  // Index each directory by dispatch id -> latest mtime for that id (a dispatch can have at
  // most one live BLOCKED/UNBLOCKED file pair by ledger convention -- Section 4.1 "one file
  // per dispatch" -- but this consumer takes the max mtime defensively rather than assuming
  // exactly one).
  const blockedByDispatch = new Map<string, number>();
  for (const f of blockedFiles) {
    const id = extractDispatchId(f);
    if (!id) continue;
    const t = mtimeMs(join(BLOCKED_DIR, f));
    blockedByDispatch.set(id, Math.max(blockedByDispatch.get(id) ?? 0, t));
    dispatchIds.add(id);
  }

  const unblockedByDispatch = new Map<string, number>();
  for (const f of unblockedFiles) {
    const id = extractDispatchId(f);
    if (!id) continue;
    const t = mtimeMs(join(UNBLOCKED_DIR, f));
    unblockedByDispatch.set(id, Math.max(unblockedByDispatch.get(id) ?? 0, t));
  }

  const returnByDispatch = new Map<string, number>();
  for (const f of returnFiles) {
    const id = extractDispatchId(f);
    if (!id) continue;
    const t = mtimeMs(join(RETURNS_DIR, f));
    returnByDispatch.set(id, Math.max(returnByDispatch.get(id) ?? 0, t));
    dispatchIds.add(id);
  }

  const beatByDispatch = new Map<string, number>();
  const actorBeats: ResidentStatusSnapshot['actorBeats'] = [];
  for (const f of heartbeatFiles) {
    const id = extractDispatchId(f);
    const beatPath = join(HEARTBEAT_DIR, f);
    const t = mtimeMs(beatPath);
    if (id) {
      beatByDispatch.set(id, Math.max(beatByDispatch.get(id) ?? 0, t));
      dispatchIds.add(id);
    } else {
      // Not a D-BPxxx-xxx dispatch beat -- e.g. BISHOP-BP147.beat, an actor-level liveness
      // beat rather than a per-dispatch one. Tracked separately; the 5-state dispatch machine
      // below does not apply to it (there is no BLOCKED/RETURNS counterpart for an actor id).
      actorBeats.push({
        actorOrBishopId: f.replace(/\.beat$/i, ''),
        lastBeatUtc: new Date(t).toISOString(),
        stale: nowMs - t > STALE_THRESHOLD_MS,
      });
    }
  }

  const dispatches: DispatchStatus[] = [];
  for (const id of dispatchIds) {
    const blockedT = blockedByDispatch.get(id) ?? 0;
    const unblockedT = unblockedByDispatch.get(id) ?? 0;
    const returnT = returnByDispatch.get(id) ?? 0;
    const beatT = beatByDispatch.get(id) ?? 0;

    let state: DispatchState;
    let detail: string;
    let lastEvidenceMs = Math.max(blockedT, unblockedT, returnT, beatT);

    if (returnT > 0) {
      state = 'FINISHED';
      detail = `RETURNS file on disk (${new Date(returnT).toISOString()}) -- the return IS the completion signal (Section 4.1); heartbeat staleness after this is healthy and not alarmed.`;
    } else if (blockedT > 0 && unblockedT > blockedT) {
      // Answered. Healthy only if collected (a beat or return has landed since the answer).
      if (beatT > unblockedT) {
        state = 'WORKING';
        detail = `BLOCKED (${new Date(blockedT).toISOString()}) answered by UNBLOCKED (${new Date(unblockedT).toISOString()}), and a heartbeat since (${new Date(beatT).toISOString()}) shows the worker collected it and is moving.`;
      } else {
        state = 'ANSWER_UNCOLLECTED';
        detail = `UNBLOCKED reply (${new Date(unblockedT).toISOString()}) is newer than its BLOCKED file (${new Date(blockedT).toISOString()}), but no heartbeat and no RETURN has landed since. HARDWIRE-00 6.2d: "ANSWER UNCOLLECTED -- waiting, not hung."`;
      }
    } else if (blockedT > 0) {
      state = 'WAITING';
      detail = `BLOCKED file on disk (${new Date(blockedT).toISOString()}) with no UNBLOCKED reply yet. A worker correctly holding on a filed block has nothing to beat about -- healthy, not alarmed (HARDWIRE-00 6.2d).`;
    } else if (beatT > 0 && nowMs - beatT <= STALE_THRESHOLD_MS) {
      state = 'WORKING';
      detail = `Heartbeat fresh (${new Date(beatT).toISOString()}, ${Math.round((nowMs - beatT) / 1000)}s ago).`;
    } else {
      state = 'HUNG_OR_CRASHED';
      const beatDesc = beatT > 0 ? `last heartbeat ${new Date(beatT).toISOString()} (${Math.round((nowMs - beatT) / 60000)} min ago)` : 'no heartbeat file ever seen';
      detail = `No RETURNS, no BLOCKED, and ${beatDesc} -- past the ${STALE_THRESHOLD_MS / 60000}-minute staleness threshold. File evidence cannot distinguish "hung" from "crashed" (see module header); reporting the honest merged state rather than a fabricated distinction.`;
    }

    dispatches.push({
      dispatchId: id,
      state,
      detail,
      lastEvidenceUtc: lastEvidenceMs > 0 ? new Date(lastEvidenceMs).toISOString() : null,
      alarms: state === 'HUNG_OR_CRASHED' || state === 'ANSWER_UNCOLLECTED',
    });
  }

  const settings = getResidentWatchSettings();
  return {
    armed: settings.watchArmed,
    lastPollUtc: new Date(nowMs).toISOString(),
    pollCount: _pollCount,
    dispatches: dispatches.sort((a, b) => a.dispatchId.localeCompare(b.dispatchId)),
    actorBeats,
    grant: buildWatchGrant([BLOCKED_DIR, RETURNS_DIR, HEARTBEAT_DIR, UNBLOCKED_DIR]),
  };
}

function statusFilePath(): string {
  return join(app.getPath('userData'), 'resident_watch_status.json');
}

/** Persists the latest snapshot so its arming and its findings are checkable from outside the
 *  process too (Section 1.5: "prove the far end... read back what actually landed") --
 *  independent of whatever stdout/log capture may or may not be attached to this run. */
function persistSnapshot(snap: ResidentStatusSnapshot): void {
  try {
    mkdirSync(app.getPath('userData'), { recursive: true });
    writeFileSync(statusFilePath(), JSON.stringify(snap, null, 2), 'utf8');
  } catch (err) {
    console.error('[resident/yoke_watcher] failed to persist status snapshot (non-fatal):', err);
  }
}

/** Reads the last-persisted snapshot straight from disk, independent of any in-process cache
 *  -- the same "read back what actually landed" discipline applied to this module's own
 *  output. Returns null if no poll has ever run/persisted in this userData profile. */
export function readPersistedResidentStatus(): ResidentStatusSnapshot | null {
  try {
    const f = statusFilePath();
    if (!existsSync(f)) return null;
    return JSON.parse(readFileSync(f, 'utf8')) as ResidentStatusSnapshot;
  } catch {
    return null;
  }
}

let _pollCount = 0;
let _lastSnapshot: ResidentStatusSnapshot | null = null;
let _intervalHandle: ReturnType<typeof setInterval> | null = null;

/** In-process read of the latest snapshot (no disk I/O). */
export function getResidentStatus(): ResidentStatusSnapshot | null {
  return _lastSnapshot;
}

/** One poll tick: scan, log every alarm by name, persist. Exported (not just internal to the
 *  interval) so a test/probe can call it directly without waiting for the interval to fire. */
export function pollOnce(): ResidentStatusSnapshot {
  _pollCount++;
  const snap = scanYoke();
  for (const d of snap.dispatches) {
    if (d.alarms) {
      // Names the specific dispatch id in every alarm (ticket line 74) -- never a bare "Knight
      // may be hung" that fails to say whose beat it held.
      console.warn(`[RESIDENT ALARM] dispatch=${d.dispatchId} state=${d.state} :: ${d.detail}`);
    } else {
      console.log(`[RESIDENT] dispatch=${d.dispatchId} state=${d.state} (healthy)`);
    }
  }
  for (const b of snap.actorBeats) {
    if (b.stale) {
      console.warn(`[RESIDENT ALARM] actor-beat=${b.actorOrBishopId} stale since ${b.lastBeatUtc}`);
    }
  }
  _lastSnapshot = snap;
  persistSnapshot(snap);
  return snap;
}

/**
 * startResidentWatcher -- the single no-arg init call this ticket's OWNS block registers in
 * index.ts's INIT-CALL APPEND ZONE. Idempotent guard matches board_ipc.ts's
 * initBoardWatcher() discipline exactly (KN-BP144-10 precedent, board_ipc.ts:55-60).
 *
 * Reads the persisted "armed" switch FIRST. If not armed, this call is a no-op that only
 * logs its own dormancy -- WATCH is "a switch the user holds, not a promise the agent makes"
 * (ticket line 90); this function never assumes the user's election.
 */
export function startResidentWatcher(): void {
  if (_intervalHandle !== null) {
    console.warn('[resident/yoke_watcher] startResidentWatcher called twice, ignoring second call');
    return;
  }

  if (!isWatchArmed()) {
    console.log(
      '[resident/yoke_watcher] RESIDENT WATCHER present but NOT ARMED. The persistence switch is the user\'s ' +
      '(ON_DECK_BP146.md OD-04 / PROV_24 WATCH row) -- call armResidentWatch() to elect it. No polling started.',
    );
    return;
  }

  armInterval();
}

function armInterval(): void {
  const { pollIntervalMs } = getResidentWatchSettings();
  // Poll once immediately (mirrors board_ipc.ts:62 `void refresh();` before the interval),
  // so a freshly-started/restarted process reflects reality at t=0 rather than waiting a full
  // interval before its first read-back is meaningful.
  pollOnce();
  _intervalHandle = setInterval(() => {
    pollOnce();
  }, pollIntervalMs);
  // .unref() matches board_ipc.ts:65 -- this interval must never be the thing keeping the
  // Electron process alive on its own; it rides along with whatever else the app is doing.
  _intervalHandle.unref?.();
  console.log(
    `[resident/yoke_watcher] YOKE WATCHER ARMED -- watching ${BLOCKED_DIR}, ${RETURNS_DIR}, ${HEARTBEAT_DIR} ` +
    `(${pollIntervalMs / 1000}s poll, ${_lastSnapshot?.dispatches.length ?? 0} dispatch ids at first poll).`,
  );
}

/** Arms the watch (persists the switch, then starts polling if not already running). This is
 *  the mechanism behind "the user holds the persistence switch" -- calling it is how an
 *  operator, acting on the user's explicit instruction, elects the always-on WATCH tier. */
export function armResidentWatch(): ResidentStatusSnapshot {
  const { setWatchArmed } = require('./resident_settings') as typeof import('./resident_settings');
  setWatchArmed(true);
  if (_intervalHandle === null) {
    armInterval();
  }
  return pollOnce();
}

/** Disarms the watch: persists the switch off and stops the interval. WATCH is free, but it
 *  remains the user's switch in both directions. */
export function disarmResidentWatch(): void {
  const { setWatchArmed } = require('./resident_settings') as typeof import('./resident_settings');
  setWatchArmed(false);
  if (_intervalHandle !== null) {
    clearInterval(_intervalHandle);
    _intervalHandle = null;
  }
  console.log('[resident/yoke_watcher] YOKE WATCHER DISARMED by explicit user election.');
}

/** Test-only: resets module-level state so repeated test runs within one process don't see a
 *  stale interval handle or a stale poll count. Mirrors the *_ForTests convention already
 *  used by mesh_trust_settings.ts / resident_settings.ts. */
export function _resetResidentWatcherForTests(): void {
  if (_intervalHandle !== null) {
    clearInterval(_intervalHandle);
    _intervalHandle = null;
  }
  _pollCount = 0;
  _lastSnapshot = null;
}

export const _paths = { BLOCKED_DIR, UNBLOCKED_DIR, RETURNS_DIR, HEARTBEAT_DIR };
