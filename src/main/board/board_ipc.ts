// board_ipc.ts -- KN-BP144-10 T3/T4: Electron wiring for the Grand Central board panel.
// Mirrors the existing src/main/plow/liana_cycle_scheduler.ts convention exactly (see its
// initLianaCycleScheduler doc-comment): a single init function, called once at app startup
// AFTER registerIPCHandlers(), that starts its own poll loop AND registers its own IPC
// handlers -- kept out of the giant registerIPCHandlers() function in index.ts so this
// ticket's footprint on index.ts is two lines (one import, one call).
//
// Mitigation for the sync-git-blocking risk flagged in Phase 0 (see
// BISHOP_DROPZONE/KN-BP144-10_REPORT.md): this module recomputes the board snapshot (the part
// that shells out to git) on its OWN interval, decoupled from and slower than the renderer's
// fast IPC-poll cadence (see board_subscription.ts on the renderer side). The renderer's
// 'board-get-state' calls are always an instant in-memory cache read -- they never trigger a
// git call themselves, so no renderer action can ever cause a main-thread git shell-out. The
// git calls themselves are additionally async (board_state_reader.ts's execFileAsync with a
// timeout), so even the interval's own recompute tick never blocks the event loop -- this is
// belt-and-suspenders: cadence decoupling AND non-blocking I/O, not one or the other.
import { ipcMain } from 'electron';
import { computeBoardSnapshot, markDispatched, type BoardSnapshot } from './board_state_reader';
import { verifyOrphanTicket, type VerifyOrphanResult } from './board_verify';
import {
  listDismissals,
  dismissAlarm,
  restoreAlarm,
  commitUnownedFiles,
  parkUnownedFiles,
  discardUnownedFiles,
  type CommitUnownedResult,
  type ParkUnownedResult,
  type DiscardUnownedResult,
} from './board_alarm_actions';
import type { AlarmDismissal, AlarmKind } from '../../shared/board/alarm_key';

// Main-side recompute cadence: slower than the renderer's UI-refresh poll (5s, see
// board_subscription.ts) on purpose -- git doesn't need to be re-shelled-out-to 12x as often as
// the panel repaints. This is the "less frequently than a fast UI-refresh timer" half of the
// two-part mitigation described above.
const BOARD_RECOMPUTE_MS = 15_000;

let cache: BoardSnapshot | null = null;
let refreshInFlight: Promise<void> | null = null;
let watcherStarted = false;

async function refresh(): Promise<void> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = computeBoardSnapshot()
    .then((snap) => {
      // If this cycle's git call failed/timed out, don't silently keep serving a snapshot that
      // *claims* freshness -- carry the error forward but keep the last-known-good rows/alarms
      // rather than blanking the whole panel over a single flaky git invocation. T5: nothing
      // fabricated -- the gitError field itself is what makes the staleness visible to the UI,
      // not a guess about what the rows would have been.
      if (snap.gitError && cache) {
        cache = { ...snap, rows: cache.rows, alarms: cache.alarms, gitError: snap.gitError };
      } else {
        cache = snap;
      }
    })
    .catch((e) => console.error('[board_ipc] snapshot recompute threw (non-fatal):', e))
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

/** Call once, at app startup (after registerIPCHandlers()). Starts the board recompute poll AND
 *  registers this panel's own IPC handlers. Idempotent guard matches
 *  liana_cycle_scheduler.ts's initLianaCycleScheduler discipline. */
export function initBoardWatcher(): void {
  if (watcherStarted) {
    console.warn('[board_ipc] initBoardWatcher called twice, ignoring second call');
    return;
  }
  watcherStarted = true;

  void refresh();
  setInterval(() => {
    void refresh();
  }, BOARD_RECOMPUTE_MS).unref();

  try {
    // T3: renderer never touches the filesystem or spawns git -- this is always an instant
    // read of the in-memory cache computed by the interval above, never a fresh recompute.
    ipcMain.handle('board-get-state', () => {
      return cache;
    });

    // T4: the one button. Records the handoff in the SAME board_state.json board.mjs's own
    // --dispatch flag writes (no second state store), then forces one immediate recompute so
    // the panel doesn't wait a full BOARD_RECOMPUTE_MS tick to reflect the new dispatch.
    ipcMain.handle('board-mark-dispatched', async (_event, args: { id: string }) => {
      const id = args?.id;
      if (!id || typeof id !== 'string') {
        return { ok: false, error: 'missing ticket id' };
      }
      const dispatchedAt = markDispatched(id);
      await refresh();
      return { ok: true, dispatchedAt, snapshot: cache };
    });

    // BP148 D-BP148-028: the Verify button. Read-only -- never touches board_state.json, the
    // cache, or git's working state. Runs its own on-demand git calls (see board_verify.ts);
    // deliberately NOT routed through refresh()/cache, since a verify lookup has nothing to do
    // with the 15s recompute cadence and must never be mistaken for one.
    ipcMain.handle('board-verify-orphan', async (_event, args: { id: string }): Promise<VerifyOrphanResult> => {
      const id = args?.id;
      if (!id || typeof id !== 'string') {
        return {
          id: String(id ?? ''),
          claimedTarget: null,
          claimedSecondary: [],
          repos: [],
          verdict: 'unknown-ticket',
          computedAt: new Date().toISOString(),
          error: 'missing ticket id',
        };
      }
      return verifyOrphanTicket(id);
    });
    // BP148 D-BP148-031: alarm dismiss/acknowledge -- persisted (own file, see
    // board_alarm_actions.ts), never erased. Applies to ANY alarm kind, not just UNOWNED --
    // the Founder's rule is universal ("an alarm that states a fact but offers no action is
    // noise"), and coordination-only alarm kinds (COLLISION, DOUBLE-BOOKED, ...) have nothing
    // BUT acknowledge as their real action.
    ipcMain.handle(
      'board-alarm-dismiss',
      (_event, args: { key: string; kind: AlarmKind; message: string; note?: string | null }): AlarmDismissal | { error: string } => {
        const { key, kind, message, note } = args ?? ({} as typeof args);
        if (!key || !kind || !message) return { error: 'missing key/kind/message' };
        return dismissAlarm(key, kind, message, note ?? null);
      },
    );

    ipcMain.handle('board-alarm-restore', (_event, args: { key: string }): AlarmDismissal | { error: string } => {
      const key = args?.key;
      if (!key) return { error: 'missing key' };
      const restored = restoreAlarm(key);
      return restored ?? { error: `no dismissal on record for key ${key}` };
    });

    ipcMain.handle('board-alarm-list-dismissals', (): AlarmDismissal[] => listDismissals());

    // BP148 D-BP148-031: the three real UNOWNED actions. All three stage/touch ONLY the
    // explicit file paths the renderer sends (never -A/./glob -- HARDWIRE-15), and all three
    // re-validate those paths against a FRESH git status read inside board_alarm_actions.ts
    // before touching anything (see that file's realDirtyStatusFor()).
    ipcMain.handle(
      'board-unowned-commit',
      (_event, args: { files: string[]; message: string }): Promise<CommitUnownedResult> =>
        commitUnownedFiles(args?.files ?? [], args?.message ?? ''),
    );

    ipcMain.handle(
      'board-unowned-park',
      (_event, args: { files: string[]; branchName: string; message?: string }): Promise<ParkUnownedResult> =>
        parkUnownedFiles(args?.files ?? [], args?.branchName ?? '', args?.message ?? ''),
    );

    // Destructive. Requires confirm:true in the payload (defense in depth behind the UI's own
    // two-step confirm -- see BoardPanel.tsx) -- board_alarm_actions.ts's discardUnownedFiles()
    // refuses to run without it.
    ipcMain.handle(
      'board-unowned-discard',
      (_event, args: { files: string[]; confirm: boolean }): Promise<DiscardUnownedResult> =>
        discardUnownedFiles(args?.files ?? [], args?.confirm === true),
    );
  } catch (err) {
    console.error('[board_ipc] IPC handler registration failed:', err);
  }

  console.log(`[board_ipc] initialized. recomputeIntervalMs=${BOARD_RECOMPUTE_MS}`);
}
