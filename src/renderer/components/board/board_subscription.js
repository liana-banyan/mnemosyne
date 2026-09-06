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
// BP148 D-BP148-031: dismissal record + the alarm-key/label/explanation vocabulary. This one is
// a REAL runtime import (not type-only, not the main-process re-export convention above) --
// src/shared/board/alarm_key.ts has zero Node built-ins specifically so it bundles into the
// renderer, and both this file and BoardPanel.tsx need canonicalizeAlarmKey() to actually RUN
// (to match a live alarm against the dismissals list), not just its type.
import { canonicalizeAlarmKey } from '../../../shared/board/alarm_key';
export const DEFAULT_BOARD_STATE = {
    snapshot: null,
    loading: false,
    error: null,
    dismissals: null,
};
class BoardSubscription {
    constructor(pollMs = 5000) {
        this.timer = null;
        this.callbacks = new Set();
        this.current = { ...DEFAULT_BOARD_STATE };
        this.pollMs = pollMs;
    }
    subscribe(cb) {
        this.callbacks.add(cb);
        cb({ ...this.current });
        if (!this.timer)
            this._startPolling();
        return () => {
            this.callbacks.delete(cb);
            if (this.callbacks.size === 0)
                this._stopPolling();
        };
    }
    /** T4: force one immediate refresh after a mark-dispatched action, without waiting for the
     *  next tick. Does not spawn a second timer -- reuses this same _poll(). */
    async refreshNow() {
        await this._poll();
    }
    _startPolling() {
        this._poll();
        this.timer = setInterval(() => this._poll(), this.pollMs);
    }
    _stopPolling() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    async _poll() {
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
            const dismissals = {};
            for (const d of dismissalsList ?? [])
                dismissals[d.key] = d;
            this.current = { snapshot: snapshot ?? null, loading: false, error: null, dismissals };
        }
        catch (err) {
            this.current = { ...this.current, loading: false, error: String(err) };
        }
        this._emit();
    }
    _emit() {
        const snap = { ...this.current };
        for (const cb of this.callbacks)
            cb(snap);
    }
    destroy() {
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
export function alarmCount(state) {
    if (!state.snapshot)
        return null;
    if (!state.dismissals)
        return state.snapshot.alarms.length;
    return state.snapshot.alarms.filter((a) => {
        const d = state.dismissals[canonicalizeAlarmKey(a)];
        return !d || d.restoredAt !== null;
    }).length;
}
