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
// BP148 D-BP148-028: the Verify button's result shape, read straight from the main-process
// module that computes it -- same "one source of truth, re-exported here" convention as the
// three types above.
export type VerifyOrphanResult = import('../../../main/board/board_verify').VerifyOrphanResult;
// BP148 D-BP148-031: dismissal record + the alarm-key/label/explanation vocabulary. This one is
// a REAL runtime import (not type-only, not the main-process re-export convention above) --
// src/shared/board/alarm_key.ts has zero Node built-ins specifically so it bundles into the
// renderer, and both this file and BoardPanel.tsx need canonicalizeAlarmKey() to actually RUN
// (to match a live alarm against the dismissals list), not just its type.
import { canonicalizeAlarmKey, type AlarmDismissal } from '../../../shared/board/alarm_key';
export type { AlarmDismissal } from '../../../shared/board/alarm_key';

export interface BoardState {
  snapshot: BoardSnapshot | null;
  loading: boolean;
  error: string | null;
  /** BP148 D-BP148-031: every dismissal on record (active AND restored), keyed by the same
   *  canonicalizeAlarmKey() an alarm's own key is computed with. Polled on the same cadence as
   *  the snapshot so the badge and the panel never show a dismissal the other one doesn't know
   *  about. null only until the first successful poll lands. */
  dismissals: Record<string, AlarmDismissal> | null;
}

export const DEFAULT_BOARD_STATE: BoardState = {
  snapshot: null,
  loading: false,
  error: null,
  dismissals: null,
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
      // BP148 D-BP148-031: fetch snapshot + dismissals together so the two never show a
      // half-refreshed pairing (e.g. an alarm the badge counts as active but the panel already
      // knows is dismissed, or vice versa). boardAlarmListDismissals is optional-chained the
      // same way every other bridge call in this file already is -- an older preload (mid-
      // rollout) simply yields an empty dismissals map, never a crash.
      const [snapshot, dismissalsList] = await Promise.all([
        window.amplify.boardGetState?.(),
        window.amplify.boardAlarmListDismissals?.(),
      ]);
      const dismissals: Record<string, AlarmDismissal> = {};
      for (const d of dismissalsList ?? []) dismissals[d.key] = d;
      this.current = { snapshot: snapshot ?? null, loading: false, error: null, dismissals };
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
 *  when no snapshot has landed yet, so callers can render "unknown" instead of a false "clean".
 *
 *  BP148 D-BP148-031: now EXCLUDES alarms the user has actively dismissed (restoredAt === null)
 *  -- a dismissed alarm is still visible on the board (see BoardPanel.tsx's "Handled" section),
 *  but it must stop contributing to the nav badge, or "dismiss" would be theater: the whole
 *  point of acknowledging something is that the board stops nagging about it. A dismissal whose
 *  underlying real-world alarm reappears gets a NEW canonicalizeAlarmKey() only if its identity
 *  actually changed (different ticket/file/worker) -- see that function's own per-kind
 *  volatility notes -- so a genuinely NEW instance of the same alarm kind still counts. */
export function alarmCount(state: BoardState): number | null {
  if (!state.snapshot) return null;
  if (!state.dismissals) return state.snapshot.alarms.length;
  return state.snapshot.alarms.filter((a) => {
    const d = state.dismissals![canonicalizeAlarmKey(a)];
    return !d || d.restoredAt !== null;
  }).length;
}
