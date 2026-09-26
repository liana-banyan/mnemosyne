// ticker.ts -- D-BP223-BM04-X033S3-009 STEP 1
//
// Emits one IPC push event per ProveItTickerEvent, in the order it happens (spec Section 3:
// "streamed to the renderer as it happens (IPC event per step; not a batch at the end)"). Also
// keeps an in-memory per-run ring so a test (or a late-attaching renderer) can read back the
// exact sequence without needing a real BrowserWindow -- same "runs headless under vitest"
// discipline as every other module in this feature.
//
// Reuses the existing preload event-subscription convention (ai_dispatch_ipc.ts's
// 'ask-token-progress' / 'ask-engine-progress': ipcMain sends on a named channel via
// BrowserWindow.webContents, preload.ts wraps it with ipcRenderer.on()) -- see ipc.ts's
// registerProveItIPC() for the send side.

import { randomUUID } from 'crypto';
import { PROVEIT_CHANNELS, type ProveItTickerEvent, type ProveItTickerStep } from '../../shared/proveit_contract';

export type TickerSink = (event: ProveItTickerEvent) => void;

const MAX_EVENTS_PER_RUN = 64;
const runLog = new Map<string, ProveItTickerEvent[]>();
let sink: TickerSink | null = null;

/** Wired by ipc.ts at registerProveItIPC() time to broadcast to every renderer window on
 *  PROVEIT_CHANNELS.ticker. Left unset under vitest -- events are still recorded in runLog. */
export function setTickerSink(next: TickerSink | null): void {
  sink = next;
}

export function newRunId(): string {
  return randomUUID();
}

export function emitTicker(runId: string, step: ProveItTickerStep, line: string, extra?: Partial<ProveItTickerEvent>): ProveItTickerEvent {
  const event: ProveItTickerEvent = { runId, step, atMs: Date.now(), line, ...extra };
  const log = runLog.get(runId) ?? [];
  log.push(event);
  if (log.length > MAX_EVENTS_PER_RUN) log.shift();
  runLog.set(runId, log);
  try {
    sink?.(event);
  } catch {
    // A dead/closed renderer window must never break the ask/write flow itself.
  }
  return event;
}

export function emitTickerError(runId: string, atStep: ProveItTickerStep, reason: string): ProveItTickerEvent {
  return emitTicker(runId, 'error', `error at ${atStep}: ${reason} -- try the by-hand path`, {
    error: { atStep, reason, byHandOffered: true },
  });
}

/** Test/inspection seam: the exact, ordered event list for one run. */
export function getRunEvents(runId: string): ProveItTickerEvent[] {
  return [...(runLog.get(runId) ?? [])];
}

export function _clearTickerLogForTests(): void {
  runLog.clear();
}

export { PROVEIT_CHANNELS };
