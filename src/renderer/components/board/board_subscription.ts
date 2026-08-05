// board_subscription.ts -- KN-BP144-10 T2/T3: renderer-side singleton poll of the Grand
// Central board snapshot. Deliberately modeled on the existing SagaSubscription pattern
// (src/renderer/hearth/drekaskip_status/saga_subscription.ts) per the Phase 0 finding: this
// repo already has a proven "one shared timer regardless of subscriber count" pub/sub class,
// so a second bespoke polling mechanism was not invented here.
//
// Living outside any one panel component (rather than inline in BoardPanel.tsx's own
// useEffect) is what lets CompassShell.tsx subscribe for the alarm-count badge on its OWN nav
// button while BoardPanel.tsx separately subscribes for the full table -- both share the same
// timer and the same last-fetched snapshot, and the badge stays live even when the Board tab
// itself is never opened (T2's whole point: alerted without looking).
//
// This file never touches the filesystem or spawns git itself -- it only calls
// window.amplify.boardGetState(), which is always an instant read of a main-side cache (see
// src/main/board/board_ipc.ts).

export type BoardSnapshot = import('../../../main/board/board_state_reader').BoardSnapshot;
export type BoardRow = import('../../../main/board/board_state_reader').BoardRow;
export type BoardAlarm = import('../../../main/board/board_state_reader').BoardAlarm;

export interface BoardState {
  snapshot: BoardSnapshot | null;
  loading: boolean;
  error: string | null;
}

export const DEFAULT_BOARD_STATE: BoardState = {
  snapshot: null,
  loading: false,
  error: null,
};

type BoardCallback = (state: BoardState) => void;

class BoardSubscription {
  private timer: ReturnType<typeof setInterval> | null = null;
  private callbacks: Set<BoardCallback> = new Set();
  private current: BoardState = { ...DEFAULT_BOARD_STATE };
  private readonly pollMs: number;

  constructor(pollMs = 5000) {
    this.pollMs = pollMs;
  }

  subscribe(cb: BoardCallback): () => void {
    this.callbacks.add(cb);
    cb({ ...this.current });
    if (!this.timer) this._startPolling();
    return () => {
      this.callbacks.delete(cb);
      if (this.callbacks.size === 0) this._stopPolling();
    };
  }

  /** T4: force one immediate refresh after a mark-dispatched action, without waiting for the
   *  next tick. Does not spawn a second timer -- reuses this same _poll(). */
  async refreshNow(): Promise<void> {
    await this._poll();
  }

  private _startPolling(): void {
    this._poll();
    this.timer = setInterval(() => this._poll(), this.pollMs);
  }

  private _stopPolling(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async _poll(): Promise<void> {
    this.current = { ...this.current, loading: true };
    this._emit();

    try {
      const snapshot = await window.amplify.boardGetState?.();
      this.current = { snapshot: snapshot ?? null, loading: false, error: null };
    } catch (err) {
      this.current = { ...this.current, loading: false, error: String(err) };
    }

    this._emit();
  }

  private _emit(): void {
    const snap = { ...this.current };
    for (const cb of this.callbacks) cb(snap);
  }

  destroy(): void {
    this._stopPolling();
    this.callbacks.clear();
  }
}

// Singleton -- shared across CompassShell's badge and BoardPanel's table.
export const boardSubscription = new BoardSubscription(5000);

/** T5: nothing fabricated -- badge count is the literal length of the real alarms array from
 *  the last successful snapshot, never a placeholder or guessed number. Returns null (not 0)
 *  when no snapshot has landed yet, so callers can render "unknown" instead of a false "clean". */
export function alarmCount(state: BoardState): number | null {
  if (!state.snapshot) return null;
  return state.snapshot.alarms.length;
}
