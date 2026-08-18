/**
 * bishop_dispatch_reply.ts — D-BP156-M0-014, HARDWIRE-24 mesh.
 *
 * THE GAP THIS FILLS: `D-BP156-M0-013` built the inbound listener that hands a claimed
 * bishop_dispatch row to `handleInboundBishopDispatchEnvelope` and marks the `relay_routes` row
 * `answered`/`error`, but nothing wrote the RESULT anywhere the conductor (the machine that sent
 * the dispatch) could read it -- the builder's reply had nowhere to go. This file is that reply
 * leg: the write side (`writeBishopDispatchReply`, called by bishop_dispatch_relay_listener.ts
 * right after `handleEnvelope` resolves) and the read side (`pollForBishopDispatchReply`, for a
 * future conductor-side caller) of a request/reply pair.
 *
 * ── WHY `relay_route_replies`, NOT A NEW TABLE, AND WHY THIS SOLVES THE CREDENTIAL PROBLEM ────
 * `relay_route_replies` is a REAL, PROVEN, already-working request/reply bus. Gadgeted live for
 * this dispatch (2026-08-17, `SUPABASE_SERVICE_ROLE_KEY`, admin-side gadgeting only, matching
 * BP087 Statute 14/15 -- never a runtime credential of this file): 206 real rows, columns `id`,
 * `created_at`, `route_id`, `peer_id`, `answer_json`, `hex_reply`, `processing_ms`. This is
 * exactly what `src/main/mesh_test/wan_dispatch.ts`'s own header already documented for this
 * table (that header's claim was correct here; only `WAN_SOCCERBALL_TRANSPORT_BP155.md`'s
 * `wan_relay_routed` claim, for the separate `relay_routes` table, was wrong -- see
 * `BISHOP_DROPZONE\WAN_RELAY_SCHEMA_VERIFIED_BP156.md`). `index.ts`'s `startRelayRoutePoll()`
 * already POSTs MC-question answers into this exact table using the anon key (`getAnonKey()`),
 * and `wan_dispatch.ts`'s `pollForReply()` already reads it back the same way -- proof, not
 * assumption, that the anon key can both write and read this table. This file is that same
 * already-proven mechanism, scoped to bishop_dispatch replies instead of MC-question answers, so
 * the credential question this ticket exists to answer is solved by construction: no
 * service-role key anywhere in this file's runtime path, matching every other real poller in
 * this codebase (bishop_dispatch_relay_listener.ts included).
 *
 * ── DISCRIMINATOR ────────────────────────────────────────────────────────────────────────────
 * `answer_json.kind === 'bishop_dispatch_reply'`, mirroring bishop_dispatch_relay_listener.ts's
 * own `payload_json.kind === 'bishop_dispatch'` convention on the request side. `route_id` alone
 * already uniquely correlates a reply to its request row, so a reader that already has the
 * route_id does not strictly need the kind tag -- it exists so a reader scanning
 * `relay_route_replies` for an unrelated reason can still tell a bishop_dispatch reply apart
 * from an ordinary MC-question `answer_json` shape (which carries `answer`/`answered_by`/
 * `plow_trace`, never `kind`).
 *
 * ── WHAT THIS FILE DOES NOT DO (read before wiring a caller to the read side) ───────────────
 * This reply is INFORMATIONAL ONLY -- `ok`/`spawned`/`reason`/`noticePath`, mirroring
 * `BishopDispatchResult` verbatim, nothing else. It is never fed back into any code path that
 * could cause the CONDUCTOR to spawn, execute, or act on the builder's say-so; a reply is a
 * report, not a command. This is deliberate: `FD-BP156-01`'s seven auto-spawn guardrails govern
 * an inbound bishop_dispatch REQUEST admitting a spawn decision, and nothing about a reply
 * payload may ever be allowed to admit one on the far end -- `pollForBishopDispatchReply` below
 * returns inert data only, never a callback, so a future caller cannot accidentally wire a
 * reply into a second spawn path.
 *
 * ── SCOPE: MECHANISM, NOT A WIRED CONDUCTOR-SIDE UI/IPC CALLER ──────────────────────────────
 * This ticket's mandate is "a builder's reply can travel back to the conductor over the relay,"
 * not a specific conductor-side consumer -- no IPC handler or renderer surface reads a
 * bishop_dispatch reply today, matching the fact that no conductor-side UI dispatches a
 * bishop_dispatch in the first place yet either. `pollForBishopDispatchReply` is exported and
 * offline-tested so that caller can be added later without re-deriving this mechanism.
 */

import { getAnonKey, getSupabaseUrl } from '../shared/anon_key';
import type { BishopDispatchResult, WorkLifecycle, WorkMaturity, WorkIssue } from './peer_server';

const BISHOP_DISPATCH_REPLY_KIND = 'bishop_dispatch_reply';
const DEFAULT_FETCH_TIMEOUT_MS = 10_000;
const DEFAULT_POLL_TIMEOUT_MS = 120_000;
const DEFAULT_POLL_INTERVAL_MS = 2_000;

/** Injectable so tests never touch a real network. Defaults to the real global fetch. */
export type FetchLike = typeof fetch;

export interface ReplyWriteConfig {
  supabaseUrl: string;
  anonKey: string;
  fetchImpl?: FetchLike;
}

/** Everything a reader needs to identify a reply and read its inert result. Never anything
 *  executable -- see this file's header, "WHAT THIS FILE DOES NOT DO."
 *
 *  D-BP157-023: carries a `stage` discriminator plus the full status vocabulary
 *  (SEG_RETURN_BP157_015's design) instead of just `ok`/`spawned`/`reason`/`noticePath`. `stage:
 *  'launch'` is the row `writeBishopDispatchReply` posts immediately after `handleEnvelope`
 *  resolves (proves `lifecycle` at most as far as `'begun'`/`'failed'`/`'refused'` -- it cannot
 *  prove `'completed'`, because it is written before the worker's real lifetime has elapsed).
 *  `stage: 'completion'` is the SECOND, LATER row `writeBishopDispatchCompletionReply` posts from
 *  inside `launchWorker`'s own `child.once('exit', ...)` handler once the worker has actually
 *  exited -- this is the row that can prove `'completed'`. Both rows share the same `route_id`;
 *  `pollForBishopDispatchReply`'s existing `order=created_at.desc&limit=1` query returns whichever
 *  is newest with zero changes, so the completion reply naturally supersedes the launch reply once
 *  it lands. */
export interface BishopDispatchReplyAnswer {
  kind: 'bishop_dispatch_reply';
  stage: 'launch' | 'completion';
  ok: boolean;
  lifecycle: WorkLifecycle;
  maturity?: WorkMaturity;
  issues: WorkIssue[];
  spawned: boolean;
  reason: string;
  noticePath?: string;
  effectiveId?: string;
  /** Present on `stage: 'completion'` rows only -- where the worker's full log lives, named
   *  rather than shipped whole (the log can grow large over a 30-minute run). */
  workerLogPointer?: string;
  /** Present on `stage: 'completion'` rows only -- the last ~4000 chars of the worker's captured
   *  stdout+stderr, bounded so a large log never blows up this row's payload size. */
  tailExcerpt?: string;
}

/**
 * Best-effort, non-fatal write -- matches bishop_dispatch_relay_listener.ts's
 * finalizeStatus()/writeHeartbeat() convention: a failed reply write must never block the
 * caller from also finalizing the relay_routes row's status, and never throws. Returns true
 * only on a confirmed 2xx write, purely so a caller/test can observe the outcome; a caller that
 * only wants fire-and-forget behavior may ignore the return value (bishop_dispatch_relay_
 * listener.ts does not await it inline for that reason -- see its own call site comment).
 */
export async function writeBishopDispatchReply(
  config: ReplyWriteConfig,
  routeId: string,
  peerId: string,
  result: BishopDispatchResult,
  processingMs: number,
): Promise<boolean> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const answer: BishopDispatchReplyAnswer = {
    kind: BISHOP_DISPATCH_REPLY_KIND,
    stage: 'launch',
    ok: result.ok,
    lifecycle: result.lifecycle,
    ...(result.maturity !== undefined ? { maturity: result.maturity } : {}),
    issues: result.issues,
    spawned: result.spawned,
    reason: result.reason,
    ...(result.noticePath !== undefined ? { noticePath: result.noticePath } : {}),
    ...(result.effectiveId !== undefined ? { effectiveId: result.effectiveId } : {}),
  };
  try {
    const res = await fetchImpl(`${config.supabaseUrl}/rest/v1/relay_route_replies`, {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        route_id: routeId,
        peer_id: peerId,
        answer_json: answer,
        processing_ms: processingMs,
      }),
      signal: AbortSignal.timeout(DEFAULT_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[bishop-dispatch-reply] write REFUSED for route ${routeId.slice(0, 8)}: HTTP ${res.status}`);
    }
    return res.ok;
  } catch (err) {
    console.warn(`[bishop-dispatch-reply] write FAILED for route ${routeId.slice(0, 8)} (non-fatal):`, err);
    return false;
  }
}

/** Everything the stage-2/completion write needs, derived by `bishop_dispatch_handler.ts`'s
 *  `deriveCompletionOutcome` (or a test double of it) once the worker has actually exited. */
export interface BishopDispatchCompletionInput {
  effectiveId: string;
  lifecycle: WorkLifecycle;
  issues: WorkIssue[];
  workerLogPointer: string;
  tailExcerpt: string;
}

/**
 * D-BP157-023, THE RETURN LEG (SEG_RETURN_BP157_015 Part 2). A SECOND, LATER row into the SAME
 * `relay_route_replies` bus `writeBishopDispatchReply` already proved works -- posted from inside
 * `launchWorker`'s own `child.once('exit', ...)` handler, whenever that fires, however long the
 * worker actually ran (up to `LB_MESH_SPAWN_TIMEOUT_MS`). `route_id` carries no uniqueness
 * constraint (measured, `SEG_RETURN_BP157_009`'s schema dump), so this is a legitimate append,
 * never a conflict with the stage-1 launch row already posted for the same route id. Same
 * best-effort, non-fatal, never-throws contract as `writeBishopDispatchReply` above.
 */
export async function writeBishopDispatchCompletionReply(
  config: ReplyWriteConfig,
  routeId: string,
  peerId: string,
  completion: BishopDispatchCompletionInput,
  processingMs: number,
): Promise<boolean> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const answer: BishopDispatchReplyAnswer = {
    kind: BISHOP_DISPATCH_REPLY_KIND,
    stage: 'completion',
    ok: true, // the message (this completion determination) was handled -- see `lifecycle` for the work outcome
    lifecycle: completion.lifecycle,
    issues: completion.issues,
    spawned: true, // only ever called after a worker's own 'exit' event fired -- a process was created
    reason: `worker exited; lifecycle=${completion.lifecycle}`,
    effectiveId: completion.effectiveId,
    workerLogPointer: completion.workerLogPointer,
    tailExcerpt: completion.tailExcerpt,
  };
  try {
    const res = await fetchImpl(`${config.supabaseUrl}/rest/v1/relay_route_replies`, {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        route_id: routeId,
        peer_id: peerId,
        answer_json: answer,
        processing_ms: processingMs,
      }),
      signal: AbortSignal.timeout(DEFAULT_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[bishop-dispatch-reply] completion write REFUSED for route ${routeId.slice(0, 8)}: HTTP ${res.status}`);
    }
    return res.ok;
  } catch (err) {
    console.warn(`[bishop-dispatch-reply] completion write FAILED for route ${routeId.slice(0, 8)} (non-fatal):`, err);
    return false;
  }
}

export interface ReplyPollConfig {
  supabaseUrl: string;
  anonKey: string;
  fetchImpl?: FetchLike;
  /** Injectable so an offline test never actually sleeps. Defaults to a real setTimeout. */
  sleepImpl?: (ms: number) => Promise<void>;
  pollIntervalMs?: number;
}

/** True iff a relay_route_replies row's answer_json is bishop-dispatch-reply-shaped. Exported
 *  as its own pure predicate for the same reason bishop_dispatch_relay_listener.ts exports
 *  hasBishopDispatchKind() -- the easiest thing to get exhaustively right, independently
 *  testable without any network I/O. */
export function isBishopDispatchReply(
  answerJson: Record<string, unknown> | null | undefined,
): answerJson is Record<string, unknown> & BishopDispatchReplyAnswer {
  return !!answerJson && typeof answerJson === 'object' && answerJson['kind'] === BISHOP_DISPATCH_REPLY_KIND;
}

/**
 * Bounded poll for the reply to a specific bishop_dispatch relay_routes row, mirroring
 * wan_dispatch.ts's pollForReply() (same table, same anon-key auth, same "poll until deadline or
 * found" shape). Never throws; returns null on timeout or if a non-bishop_dispatch-reply row is
 * all that is found for this route_id (defensive -- should not happen since a route_id is only
 * ever answered once by this mechanism, but a wrong-shaped row must never be handed to a caller
 * as if it were a valid reply).
 */
export async function pollForBishopDispatchReply(
  config: ReplyPollConfig,
  routeId: string,
  timeoutMs: number = DEFAULT_POLL_TIMEOUT_MS,
): Promise<{ answer: BishopDispatchReplyAnswer; processingMs: number } | null> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const sleepImpl = config.sleepImpl ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const intervalMs = config.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await sleepImpl(intervalMs);
    try {
      const res = await fetchImpl(
        `${config.supabaseUrl}/rest/v1/relay_route_replies?route_id=eq.${encodeURIComponent(routeId)}` +
          `&select=answer_json,processing_ms&order=created_at.desc&limit=1`,
        {
          headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}` },
          signal: AbortSignal.timeout(DEFAULT_FETCH_TIMEOUT_MS),
        },
      );
      if (!res.ok) continue;
      const rows = (await res.json()) as Array<{ answer_json: Record<string, unknown> | null; processing_ms: number }>;
      const row = rows[0];
      if (row && isBishopDispatchReply(row.answer_json)) {
        return { answer: row.answer_json, processingMs: row.processing_ms };
      }
    } catch {
      // Transient poll error -- keep trying until deadline, matching wan_dispatch.ts's
      // pollForReply() tolerant polling style.
    }
  }
  return null;
}

/** Convenience wrapper matching bishop_dispatch_relay_listener.ts's own
 *  startBishopDispatchRelayListenerWithDefaults() naming/credential-resolution convention:
 *  resolves supabaseUrl/anonKey the SAME way every other real poller in this codebase does. */
export function getDefaultReplyWriteConfig(): ReplyWriteConfig {
  return { supabaseUrl: getSupabaseUrl(), anonKey: getAnonKey() };
}
