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
  } catch (err) {
    console.error('[board_ipc] IPC handler registration failed:', err);
  }

  console.log(`[board_ipc] initialized. recomputeIntervalMs=${BOARD_RECOMPUTE_MS}`);
}
