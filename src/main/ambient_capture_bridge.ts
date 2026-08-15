// ambient_capture_bridge.ts -- D-BP154-074/BISHOP-SEG/S74/seg-ambient
//
// A DECOUPLED PUB-SUB SEAM between mcp_server.ts (the HTTP route the extension posts to) and
// index.ts (which owns overlayWindow/dashboardWindow and the "show the indicator" logic).
//
// WHY THIS FILE EXISTS RATHER THAN A DIRECT IMPORT: index.ts already imports
// { startMcpServer, stopMcpServer, getMcpServerStatus } from './mcp_server'. If mcp_server.ts
// imported anything back from './index' to reach overlayWindow/createOverlayWindow, that would be
// a circular module dependency between the two largest files in this codebase -- exactly the
// class of fragile wiring this estate's own coordinator has flagged elsewhere (a failure that
// looks like data). This file breaks the cycle: mcp_server.ts calls notifyAmbientCapture() (knows
// nothing about Electron windows), index.ts calls registerAmbientCaptureNotifier() once at
// startup (owns the window logic), and neither file imports the other.
//
// Also used, symmetrically, for the "capture is enabled/disabled" state so the indicator can
// reflect real toggle state, not just flash on each capture.

export interface AmbientCaptureEvent {
  surface: string;
  url: string;
  query: string;
  ts: string;
}

type CaptureListener = (event: AmbientCaptureEvent) => void;

let listener: CaptureListener | null = null;

/** Called once by index.ts at startup. Registering a new listener replaces any prior one
 *  (idempotent re-registration on hot paths is intentionally allowed, last-writer-wins, since
 *  there is exactly one legitimate owner of the overlay window in this process). */
export function registerAmbientCaptureNotifier(fn: CaptureListener): void {
  listener = fn;
}

/** Called by mcp_server.ts's /capture route after a successful
 *  recordAmbientBrowserCapture(). A no-op (never throws) if index.ts has not registered yet
 *  (e.g. the HTTP server started before app.whenReady() finished wiring the notifier) -- an
 *  ambient capture must never fail to record just because the indicator isn't ready. */
export function notifyAmbientCapture(event: AmbientCaptureEvent): void {
  try {
    listener?.(event);
  } catch (e) {
    console.error('[ambient-capture-bridge] indicator notifier threw (capture itself already recorded, unaffected):', e);
  }
}
