// BP140-K3 — Homework busy-guard
// Self-expiring "is the app doing real work right now" signal so homework_runner.ts's
// background loop never contends with an active user Ask or a scored mesh-test for the shared
// local Ollama daemon (there is exactly one Ollama process; a homework job and a live Ask
// racing for it would slow down or corrupt the user-visible answer).
//
// A plain latched boolean (set true at request-start, cleared at request-end) was considered
// and rejected: ai_dispatch_ipc.ts's 'ai-dispatch:query' handler has several early-return
// branches (served_verbatim exact-match, CSIA Psionic fast path, flagship-brain dispatch) that
// each kick off their own detached fire-and-forget async IIFE and return a
// `{ ok: true, streaming: true }` ack to the renderer BEFORE that IIFE resolves. A naive
// set-at-entry/clear-at-return pair would clear "busy" while a background generation is still
// actively streaming tokens.
//
// Instead this is a heartbeat window: callers call markAppBusy() at request start AND at every
// progress tick (each streamed token, each retry) to keep renewing the window. If a future call
// site forgets to call clearAppBusy() at its own completion point, the window simply expires on
// its own after BUSY_WINDOW_MS — Homework is briefly over-cautious, never permanently blocked.

const BUSY_WINDOW_MS = 30_000;

let busyUntilMs = 0;

/** Called by an in-flight Ask/query path to (re)assert "the app is busy" for BUSY_WINDOW_MS. */
export function markAppBusy(): void {
  busyUntilMs = Date.now() + BUSY_WINDOW_MS;
}

/** Best-effort immediate clear at a known completion point. Not required for correctness (the
 *  window expires on its own) but keeps Homework's wait as short as possible after a real Ask
 *  finishes. */
export function clearAppBusy(): void {
  busyUntilMs = 0;
}

/** True if any Ask/query path has renewed the busy window within the last BUSY_WINDOW_MS. */
export function isAppBusy(): boolean {
  return Date.now() < busyUntilMs;
}
