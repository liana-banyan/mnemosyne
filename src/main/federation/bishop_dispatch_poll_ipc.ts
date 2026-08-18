/**
 * bishop_dispatch_poll_ipc.ts — D-BP157-023, HARDWIRE-24 mesh, the return leg's M0-side pull.
 *
 * THE DEFECT THIS CLOSES: `pollForBishopDispatchReply` (bishop_dispatch_reply.ts, built by
 * D-BP156-M0-014) has been real, offline-tested, and CALLED BY NOTHING since the moment it was
 * written -- its own file header stated this plainly ("no IPC handler or renderer surface reads
 * a bishop_dispatch reply today"). `FD-BP157-02` ("PUT ALL THAT WE BUILD IN") and this dispatch's
 * own instruction ("if your design needs it, CALL IT") both name this exact gap. This file is
 * that call site.
 *
 * WHY AN IPC HANDLER, NOT A STANDALONE SCRIPT: `pollForBishopDispatchReply` itself needs no
 * Electron `app` singleton (unlike the SEND side's Ed25519 signing) -- it is a plain anon-key
 * REST poll. It is still registered as an IPC handler rather than left for a standalone script to
 * import directly, for the same reason `bishop_dispatch_send_ipc.ts` is: this mirrors that file's
 * proven shape (small dedicated IPC-registration file, called once from index.ts's init
 * sequence, driven from a terminal via a CDP-attach CLI script) so a person can pull a reply the
 * same way they trigger a send, without needing a second invocation convention.
 *
 * WHO POLLS, AND WHY NOT PUSH (SEG_RETURN_BP157_015 Part 2's own design): M0 is never notified.
 * A human/Bishop-invoked pull, exactly like the send side, calls this handler on demand. Building
 * an M0-side background poller would be a SECOND new daemon on top of the one this estate already
 * has that has been silently dead since 2026-08-11 (measured, cited in this dispatch's own
 * briefing) -- a pull command a person runs is the smaller, more honest design given that
 * history, and per this dispatch's own standing rule, a new always-running process needs a
 * Founder ruling before it gets built, not after.
 */

import { ipcMain } from 'electron';
import { pollForBishopDispatchReply, getDefaultReplyWriteConfig, type BishopDispatchReplyAnswer } from './bishop_dispatch_reply';

export interface BishopDispatchPollReplyRequest {
  routeId: string;
  timeoutMs?: number;
}

export interface BishopDispatchPollReplyResponse {
  ok: boolean;
  error?: string;
  routeId: string;
  found: boolean;
  answer?: BishopDispatchReplyAnswer;
  processingMs?: number;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * Validates the request shape before calling the real poll, matching
 * bishop_dispatch_send_ipc.ts's validateSendRequest()/sendBishopDispatchViaRelay() split -- real
 * logic unit-testable independent of ipcMain registration.
 */
export function validatePollRequest(
  req: Partial<BishopDispatchPollReplyRequest> | null | undefined,
): { ok: true; req: BishopDispatchPollReplyRequest } | { ok: false; error: string } {
  if (!req || typeof req !== 'object') {
    return { ok: false, error: 'request body missing or not an object' };
  }
  if (!isNonEmptyString(req.routeId)) {
    return { ok: false, error: 'routeId is required (non-empty string) -- the relay_routes row id printed by the send side' };
  }
  if (req.timeoutMs !== undefined && (typeof req.timeoutMs !== 'number' || req.timeoutMs <= 0)) {
    return { ok: false, error: 'timeoutMs, if provided, must be a positive number' };
  }
  return { ok: true, req: { routeId: req.routeId, timeoutMs: req.timeoutMs } };
}

/**
 * Real poll, callable independent of ipcMain registration. Calls pollForBishopDispatchReply --
 * the REAL, already-offline-tested read path -- never a hand-rolled relay_route_replies SELECT.
 * `found: false` (with `ok: true`) means the poll completed without error but no matching reply
 * had landed before the deadline -- distinct from `ok: false`, which means the request itself was
 * malformed and no poll was even attempted.
 */
export async function pollBishopDispatchReplyViaRelay(
  req: Partial<BishopDispatchPollReplyRequest> | null | undefined,
): Promise<BishopDispatchPollReplyResponse> {
  const validated = validatePollRequest(req);
  if (!validated.ok) {
    return { ok: false, error: validated.error, routeId: isNonEmptyString(req?.routeId) ? req!.routeId! : '', found: false };
  }
  const { routeId, timeoutMs } = validated.req;

  const result = await pollForBishopDispatchReply(getDefaultReplyWriteConfig(), routeId, timeoutMs);

  if (result) {
    // eslint-disable-next-line no-console
    console.log(`[BishopDispatchPoll] route=${routeId} FOUND stage=${result.answer.stage} lifecycle=${result.answer.lifecycle} issues=${result.answer.issues.length}`);
    return { ok: true, routeId, found: true, answer: result.answer, processingMs: result.processingMs };
  }

  // eslint-disable-next-line no-console
  console.log(`[BishopDispatchPoll] route=${routeId} NOT FOUND before deadline (timeoutMs=${timeoutMs ?? '(default)'})`);
  return { ok: true, routeId, found: false };
}

let _registered = false;

/** Idempotent, matching bishop_dispatch_send_ipc.ts's registerBishopDispatchSendIpc() discipline
 *  exactly. No top-level side effects anywhere in this module -- ipcMain.handle is only ever
 *  called from inside this function, which index.ts's init sequence calls exactly once. */
export function registerBishopDispatchPollIpc(): void {
  if (_registered) return;
  _registered = true;

  ipcMain.handle(
    'bishop-dispatch:poll-reply',
    async (_evt, req: Partial<BishopDispatchPollReplyRequest>) => pollBishopDispatchReplyViaRelay(req),
  );

  console.log('[BishopDispatchPollIpc] handlers registered');
}
