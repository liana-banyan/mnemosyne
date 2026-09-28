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

import { app } from 'electron';
import { getAnonKey, getSupabaseUrl } from '../shared/anon_key';
import type { BishopDispatchResult, WorkLifecycle, WorkMaturity, WorkIssue } from './peer_server';
import { getStablePeerId } from './peer-discovery';
import { repliesOnly, routeRepliesForSender, routeReplyPut } from './relay_rpc';

const BISHOP_DISPATCH_REPLY_KIND = 'bishop_dispatch_reply';
const DEFAULT_FETCH_TIMEOUT_MS = 10_000;
const DEFAULT_POLL_TIMEOUT_MS = 120_000;
const DEFAULT_POLL_INTERVAL_MS = 2_000;

/**
 * D-BP157-030, Item 1 (SEG_RETURN_BP157_027_MESH_UPDATE_CONSENT.md Part 4e / Part 5 items 1-2).
 * MEASURED failure this session: M0 was on 0.9.23 while its source was 0.9.25, M3 was on 0.9.25
 * lacking the latest commits, and NEITHER machine could see the other's version in a dispatch
 * reply -- both reached wrong conclusions until a 56 MB bundle was manually searched to prove
 * the gap. This is the fix: derive the responder's own version + dev/installed build kind from
 * the REAL runtime, every time a reply is written, never a hardcoded literal.
 *
 * `buildKind` reuses this codebase's one existing IS_DEV convention verbatim
 * (`auto_updater.ts:48`, `index.ts:540`: `NODE_ENV==='development' || !app.isPackaged`) so
 * "installed" here means exactly what it means everywhere else in this app.
 *
 * Returns undefined -- never a fabricated value -- when `app` is unavailable, e.g. under vitest,
 * where 'electron' resolves to a path STRING rather than the real module (MEASURED,
 * node_modules/electron/index.js: `module.exports = getElectronPath()`), so destructuring `app`
 * off it yields `undefined` and `app.getVersion()` throws. A reply written outside a real
 * Electron main process simply omits the version fields rather than lying about them.
 */
function getResponderVersionInfo(): { appVersion: string; buildKind: 'dev' | 'installed' } | undefined {
  try {
    const appVersion = app.getVersion();
    if (!appVersion) return undefined;
    const buildKind: 'dev' | 'installed' =
      process.env.NODE_ENV === 'development' || !app.isPackaged ? 'dev' : 'installed';
    return { appVersion, buildKind };
  } catch {
    return undefined;
  }
}

/** D-BP157-030: builds a single VERSION_SKEW WorkIssue, mirroring peer_server.ts's own
 *  `transportIssue()` helper shape exactly (`code`/`message`/`evidence`/`observedAtUtc`/
 *  `observedBy`) rather than inventing a new vocabulary. This is an OBSERVATION, never a
 *  refusal -- a skewed peer still did its work; this only stops a reader from silently treating
 *  a stale-code reply as equivalent evidence to a current-code one. */
function versionSkewIssue(localVersion: string, responderVersion: string): WorkIssue {
  return {
    code: 'VERSION_SKEW',
    message: `This reply came from a peer running a different app version than this machine -- treat its results as advisory, not equivalent evidence, until the version gap is understood.`,
    evidence: `local=${localVersion} responder=${responderVersion}`,
    observedAtUtc: new Date().toISOString(),
    observedBy: 'pollForBishopDispatchReply',
  };
}

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
  /** D-BP157-030: the responder's own `app.getVersion()`, derived at write time, never
   *  hardcoded. OPTIONAL so an older peer that predates this field still parses cleanly on
   *  read -- a missing field means "peer too old to report," not a parse error. */
  responderVersion?: string;
  /** D-BP157-030: 'dev' when running from source (`NODE_ENV==='development' || !app.isPackaged`,
   *  this codebase's one existing IS_DEV convention), 'installed' otherwise. Tonight both the bare
   *  version number AND this distinction mattered -- M0 was a dev build one version behind its
   *  own source tree, and a bare semver alone would have hidden that. OPTIONAL for the same
   *  older-peer reason as `responderVersion`. */
  responderBuildKind?: 'dev' | 'installed';
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
  const versionInfo = getResponderVersionInfo();
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
    ...(versionInfo ? { responderVersion: versionInfo.appVersion, responderBuildKind: versionInfo.buildKind } : {}),
  };
  // D-BP223-X043-010-RB: through route_reply_put (Phase A RPC), proven with this install's owner secret.
  const r = await routeReplyPut({
    supabaseUrl: config.supabaseUrl, anonKey: config.anonKey, fetchImpl, timeoutMs: DEFAULT_FETCH_TIMEOUT_MS,
    routeId, peerId, answerJson: answer, processingMs,
  });
  if (!r.ok) {
    console.warn(`[bishop-dispatch-reply] write REFUSED for route ${routeId.slice(0, 8)}: ${r.error}`);
  }
  return r.ok;
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
  const versionInfo = getResponderVersionInfo();
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
    ...(versionInfo ? { responderVersion: versionInfo.appVersion, responderBuildKind: versionInfo.buildKind } : {}),
  };
  // D-BP223-X043-010-RB: through route_reply_put (Phase A RPC), proven with this install's owner secret.
  const r = await routeReplyPut({
    supabaseUrl: config.supabaseUrl, anonKey: config.anonKey, fetchImpl, timeoutMs: DEFAULT_FETCH_TIMEOUT_MS,
    routeId, peerId, answerJson: answer, processingMs,
  });
  if (!r.ok) {
    console.warn(`[bishop-dispatch-reply] completion write REFUSED for route ${routeId.slice(0, 8)}: ${r.error}`);
  }
  return r.ok;
}

export interface ReplyPollConfig {
  supabaseUrl: string;
  anonKey: string;
  fetchImpl?: FetchLike;
  /** D-BP223-X043-010-RB: the SENDER's peer id (replies are read through route_replies_for_sender,
   *  which proves the sender). Defaults to this machine's getStablePeerId(). */
  peerId?: string;
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
 * D-BP157-030, Item 1's read-side half: this is "where a reply is received" in this codebase
 * today -- Part 3 of SEG_RETURN_BP157_027_MESH_UPDATE_CONSENT.md found no conductor-side
 * UI/IPC consumer exists yet for ANY reply field, so `pollForBishopDispatchReply` (this
 * function's caller) is the one real "reply received" point to annotate. If the reply carries a
 * `responderVersion` and it differs from THIS machine's own (derived the same way, via
 * `getResponderVersionInfo()`), append one `VERSION_SKEW` WorkIssue to a COPY of the answer's
 * `issues` array -- never mutates the row read off the wire, and never touches `ok`/`lifecycle`/
 * `spawned`. This is deliberately observation-only: a skewed peer still did its work; a future
 * conductor-side reader is simply stopped from silently treating a stale-code reply as
 * equivalent evidence to a current-code one, without this ever becoming a refusal or a new
 * denial-of-service vector against the mesh (mirrors the design doc's Part 4e explicitly).
 * When either version is unavailable (e.g. this machine's own `app` is unreachable, matching
 * `getResponderVersionInfo()`'s own defensive return), no issue is added -- absence of a
 * comparison is not evidence of no skew, so this never fabricates a false "clean" result either.
 */
function annotateVersionSkew(answer: BishopDispatchReplyAnswer): BishopDispatchReplyAnswer {
  const localVersion = getResponderVersionInfo()?.appVersion;
  if (!localVersion || !answer.responderVersion || answer.responderVersion === localVersion) {
    return answer;
  }
  const existingIssues = Array.isArray(answer.issues) ? answer.issues : [];
  return { ...answer, issues: [...existingIssues, versionSkewIssue(localVersion, answer.responderVersion)] };
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
  const senderPeerId = config.peerId ?? getStablePeerId();

  while (Date.now() < deadline) {
    await sleepImpl(intervalMs);
    try {
      // D-BP223-X043-010-RB: sender-side read through route_replies_for_sender (Phase A RPC). It
      // returns only replies to routes THIS peer sent (origin_peer_id proven at route_send).
      const r = await routeRepliesForSender({
        supabaseUrl: config.supabaseUrl, anonKey: config.anonKey, fetchImpl, timeoutMs: DEFAULT_FETCH_TIMEOUT_MS,
        peerId: senderPeerId, routeIds: [routeId],
      });
      if (!r.ok) continue;
      const replies = repliesOnly(r.data);
      const row = replies[replies.length - 1]; // server orders by reply created_at ASC; newest last
      const answerJson = (row?.answer_json ?? null) as Record<string, unknown> | null;
      if (row && isBishopDispatchReply(answerJson)) {
        return { answer: annotateVersionSkew(answerJson), processingMs: row.processing_ms ?? 0 };
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
