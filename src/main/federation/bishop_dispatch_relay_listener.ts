/**
 * bishop_dispatch_relay_listener.ts — D-BP156-M0-013, HARDWIRE-24 mesh.
 *
 * THE GAP THIS FILLS: `D-BP156-M0-008` (mnemosyne commit `74703251`) built the `bishop_dispatch`
 * payload, `dispatchBishopDispatchViaRelay` (send side), and `handleInboundBishopDispatchEnvelope`
 * / `onBishopDispatch` (peer_server.ts's receive-side entry point), but reported honestly that
 * nothing live ever CALLS `handleInboundBishopDispatchEnvelope` -- there was no listener. This
 * file is that listener: it polls the live `relay_routes` table (verified schema, not the wrong
 * `wan_relay_routed` name from `WAN_SOCCERBALL_TRANSPORT_BP155.md` Section 5 -- see
 * `BISHOP_DROPZONE\WAN_RELAY_SCHEMA_VERIFIED_BP156.md`), finds rows addressed to this peer that
 * are shaped like a bishop_dispatch envelope, and hands each one to
 * `handleInboundBishopDispatchEnvelope`.
 *
 * ── CREDENTIAL, MEASURED, NOT ASSUMED ────────────────────────────────────────────────────────
 * This listener authenticates with the Supabase ANON/PUBLISHABLE key (`getAnonKey()`,
 * `../shared/anon_key.ts`), never a service-role key. This is not a convenience choice -- it is
 * the one credential shape a real installed MnemosyneC client can legitimately hold, and it is
 * already the LIVE, PROVEN pattern for reading this exact table for this exact purpose:
 *   - `src/main/relay_answer/worker.ts`'s `fetchPendingRoutes()`/`writePollerHeartbeat()` already
 *     GET and PATCH `relay_routes`/`peer_presence` with `apikey`/`Authorization: Bearer` set to
 *     the anon key, no service role involved anywhere in that file.
 *   - `src/main/index.ts`'s `startRelayRoutePoll()` does the identical GET/PATCH dance with
 *     `getAnonKey()`.
 *   - `src/main/mesh_test/wan_dispatch.ts`'s own header documents that a SIBLING module,
 *     `src/main/plow/mesh_plow_dispatcher.ts`, was rejected specifically because it "requires a
 *     Supabase SERVICE ROLE key for its wan-relay-route POST, which a real distributed client app
 *     cannot safely ship to every user's machine" -- flagged there as unproven/broken dead code.
 * `SUPABASE_SERVICE_ROLE_KEY` was used ONLY for this dispatch's own live database gadgeting
 * (Bishop measuring schema directly, BP087 Statute 14/15, admin-side, never shipped) -- it is not
 * a credential this file touches, imports, or requires at runtime. Anything requiring a
 * service-role key on a shipped client is exactly the dead-end this dispatch's own hard
 * constraints warn against, and this design avoids it by construction, matching the one
 * already-proven poller pattern in this codebase rather than inventing a new one.
 *
 * ── PAYLOAD-SHAPE DISCRIMINATOR, AND WHY ─────────────────────────────────────────────────────
 * Live measurement (`WAN_RELAY_SCHEMA_VERIFIED_BP156.md` + this dispatch's own re-verification,
 * see the Yoke-return) found the top-level `wire_format` column holds exactly one value across
 * every one of 6,657 real rows: `"json-legacy"` -- set by the `wan-relay-route` edge function
 * from `Content-Type`, not by the application, and shared identically by every existing
 * MC-question row. It cannot discriminate payload MEANING, only wire encoding. `payload_json`,
 * by contrast, is already this codebase's real convention for tagging payload variants
 * (`wan_dispatch.ts`'s `insertRelayRoute` already keys behavior off fields living INSIDE
 * `payload_json`, e.g. `research_arm_mesh_synergy`, `substrate_enabled`). This listener follows
 * that same convention: a row is bishop-dispatch-shaped iff `payload_json.kind === 'bishop_dispatch'`
 * AND `payload_json.payload_encrypted` is a string. Verified live: zero of 6,657 real rows carry
 * a `kind` key of any value inside `payload_json` -- zero collision risk with the existing
 * MC-question path, which this listener never claims, PATCHes, or otherwise touches.
 *
 * ── HONEST FINDING, ORIGINALLY BLOCKING -- CLOSED BY `D-BP156-M0-016`, NOT BY THIS DISPATCH ──
 * **CORRECTION filed by `D-BP156-M0-014` (2026-08-17), after verifying `mic_dispatcher.ts`'s
 * current source rather than trusting this paragraph as still current.** This section originally
 * reported, as a live blocker: `dispatchBishopDispatchViaRelay` POSTs `{ payload_encrypted,
 * target_peer_id }` to the `wan-relay-route` edge function, which requires BOTH `target_peer_id`
 * AND `hex_frame` and 400s without `hex_frame` -- which `dispatchBishopDispatchViaRelay` never
 * sent, so "no bishop_dispatch row can reach relay_routes through that send path." **That is no
 * longer true.** `D-BP156-M0-016` (commit `61cb159b`) replaced the edge-function POST with
 * `postBishopDispatchRelayRoute` (`mic_dispatcher.ts`, ~line 276), which INSERTs directly into
 * `relay_routes` via PostgREST with the anon key, mirroring `wan_dispatch.ts`'s proven
 * `insertRelayRoute()`, and explicitly sets `hex_frame: payloadEncrypted` to satisfy the
 * NOT-NULL legacy column -- see that function's own doc comment for the full fix. The send path
 * is closed; this listener's receive side was already correct and needed no change for this.
 *
 * ── ROW-LEVEL IDEMPOTENCY ────────────────────────────────────────────────────────────────────
 * On top of `bishop_dispatch_handler.ts`'s existing per-dispatchId dedupe-ever marker, this file
 * adds idempotency at the ROW level: claiming a row is a CONDITIONAL PATCH
 * (`id=eq.<id>&status=eq.pending` -> `{status:'processing'}`, `Prefer: return=representation`).
 * An empty response array means the row was already claimed (by a previous tick, or theoretically
 * a second listener instance) -- this listener skips it rather than re-processing. A row is never
 * left at `status: 'pending'` after this listener has decided it owns it (bishop-dispatch-shaped),
 * so a re-read on the next poll's `status=eq.pending` filter cannot see it again.
 *
 * ── A SEPARATE, PRE-EXISTING RACE -- ALSO CLOSED BY `D-BP156-M0-016`, NOT BY THIS DISPATCH ───
 * **CORRECTION filed by `D-BP156-M0-014` (2026-08-17), after verifying `index.ts`'s current
 * source.** This section originally reported, as a live blocker: `src/main/index.ts`'s
 * `startRelayRoutePoll()` selected the identical `relay_routes?target_peer_id=eq.<self>&
 * status=eq.pending` query with no kind-check, so once the send-side bug above was fixed a real
 * bishop_dispatch row would be visible to both pollers and `startRelayRoutePoll`'s faster loop
 * would likely win the claim race and misroute it into the Ollama pipeline. **That guard now
 * exists.** `D-BP156-M0-016`'s commit message names this exact fix ("startRelayRoutePoll claim
 * race"); `index.ts`'s `startRelayRoutePoll()` now imports `isBishopDispatchPayload` from this
 * file and `continue`s past any bishop_dispatch-shaped row BEFORE its "mark processing" PATCH,
 * leaving it at `status:'pending'` for this listener's own conditional claim to win -- see
 * `index.ts`'s inline comment at that `continue` for the same discriminator-sharing rationale
 * `isBishopDispatchPayload`'s own doc comment (below) describes.
 *
 * ── REPLY LEG (`D-BP156-M0-014`) ─────────────────────────────────────────────────────────────
 * This listener's own poll tick now also writes the builder's result back to the conductor,
 * via `bishop_dispatch_reply.ts`'s `writeBishopDispatchReply` -- see that file's header for the
 * full mechanism (`relay_route_replies`, anon key, proven pattern) and for why the reply is
 * inert data only, never a second spawn path.
 */

import { getAnonKey, getSupabaseUrl } from '../shared/anon_key';
import { getStablePeerId } from './peer-discovery';
import { handleInboundBishopDispatchEnvelope } from './peer_server';
import type { BishopDispatchResult } from './peer_server';
import { writeBishopDispatchReply } from './bishop_dispatch_reply';

/** The one literal this listener claims. Matches `BishopDispatchPayload.kind` (mic_dispatcher.ts)
 *  -- not re-imported as a type-level union because the check here is against untyped JSON
 *  freshly parsed off the wire (payload_json is `Record<string, unknown> | null` from Postgres),
 *  not against an already-validated `BishopDispatchPayload`. */
const BISHOP_DISPATCH_KIND = 'bishop_dispatch';

const DEFAULT_POLL_INTERVAL_MS = 15_000;
const DEFAULT_FETCH_TIMEOUT_MS = 10_000;
const DEFAULT_ROW_LIMIT = 25;

export function getBishopRelayPollIntervalMs(): number {
  const envVal = process.env.LB_MESH_BISHOP_RELAY_POLL_MS;
  const parsed = envVal ? Number.parseInt(envVal, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_POLL_INTERVAL_MS;
}

// ─── Row shape, as measured live (WAN_RELAY_SCHEMA_VERIFIED_BP156.md + this dispatch) ─────────

export interface RelayRouteRow {
  id: string;
  created_at: string;
  payload_json: Record<string, unknown> | null;
  hex_frame: string | null;
  status: string;
  wire_format: string | null;
  ttl_seconds: number | null;
  session_id: string | null;
}

/** Injectable so tests never touch a real network. Defaults to the real global fetch. */
export type FetchLike = typeof fetch;

/** Injectable so tests never touch real peer_server.ts module state (electron app.getPath,
 *  real Ed25519 keys, etc.) -- defaults to the real handleInboundBishopDispatchEnvelope.
 *  D-BP157-023: widened to accept the row's own `route_id` as an optional second argument, so it
 *  can be threaded all the way into `handleBishopDispatch`/`launchWorker` for the return-leg's
 *  stage-2/completion reply (see bishop_dispatch_reply.ts's `writeBishopDispatchCompletionReply`
 *  and this file's own call site below). */
export type EnvelopeHandlerFn = (payloadEncrypted: string, routeId?: string) => Promise<BishopDispatchResult>;

export interface BishopRelayListenerConfig {
  peerId: string;
  supabaseUrl: string;
  anonKey: string;
  fetchImpl?: FetchLike;
  handleEnvelope?: EnvelopeHandlerFn;
  rowLimit?: number;
  /** Injectable clock, offline-test only (real callers never pass this). */
  nowMs?: () => number;
}

function restHeaders(anonKey: string, extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

// ─── Pure predicates (no I/O — the easiest things to get exhaustively right) ───────────────────

/** True iff `payload_json.kind === 'bishop_dispatch'` AND `payload_json.payload_encrypted` is a
 *  string. See this file's header for why `payload_json.kind` (not the top-level `wire_format`
 *  column) is the discriminator. A row with `kind === 'bishop_dispatch'` but a malformed/missing
 *  `payload_encrypted` is deliberately NOT matched here -- see `hasBishopDispatchKind()` below,
 *  which this listener uses to decide "is this row ours to claim" separately from "is the
 *  envelope inside it well-formed," so a malformed-but-ours row still gets claimed and marked
 *  `error` (never left stuck at `pending` forever) instead of silently ignored forever. */
export function extractEncryptedEnvelope(row: RelayRouteRow): string | null {
  const pj = row.payload_json;
  if (!pj || typeof pj !== 'object') return null;
  if (pj['kind'] !== BISHOP_DISPATCH_KIND) return null;
  const enc = pj['payload_encrypted'];
  return typeof enc === 'string' && enc.length > 0 ? enc : null;
}

/** True iff this row claims to be a bishop_dispatch envelope at all (regardless of whether the
 *  envelope payload itself is well-formed) -- this is the "is this row ours to claim and never
 *  leave un-drained" check, distinct from `extractEncryptedEnvelope`'s stricter "is it usable"
 *  check. A row where this is true but `extractEncryptedEnvelope` returns null is claimed and
 *  marked `error` as a logged no-op (never crashes, never left at `pending` forever, never
 *  handed to the decrypt/dispatch path with a non-string). */
export function hasBishopDispatchKind(row: RelayRouteRow): boolean {
  return isBishopDispatchPayload(row.payload_json);
}

/** D-BP156-M0-016: the same `payload_json.kind === 'bishop_dispatch'` check as
 *  `hasBishopDispatchKind` above, factored out to take just the `payload_json` value rather
 *  than a full `RelayRouteRow` -- so `index.ts`'s `startRelayRoutePoll` (whose own local row
 *  shape does not carry every `RelayRouteRow` field, e.g. no `created_at`/`status`/
 *  `wire_format`/`ttl_seconds`) can reuse this EXACT, already-tested discriminator to skip a
 *  bishop_dispatch row rather than re-implementing the same string comparison a second place.
 *  Both callers now share one definition of "is this row ours" -- this listener via
 *  `hasBishopDispatchKind`, and `startRelayRoutePoll` via this function directly -- so the two
 *  pollers can never drift out of agreement on which rows belong to which poller. */
export function isBishopDispatchPayload(
  payloadJson: Record<string, unknown> | null | undefined,
): boolean {
  return !!payloadJson && typeof payloadJson === 'object' && payloadJson['kind'] === BISHOP_DISPATCH_KIND;
}

/** Respects `ttl_seconds` (scope item 5). Fails OPEN (treats as not-expired) when `ttl_seconds`
 *  is missing/non-positive or `created_at` fails to parse -- both are defensive branches never
 *  observed on a real row (every sampled row has a valid ISO `created_at` and a positive
 *  `ttl_seconds`, 150 or 360) but a malformed value must never crash the poll loop, and treating
 *  unmeasurable expiry as "not yet expired" is the safer failure mode (a bad row still gets
 *  claimed and either processed or marked `error`, never silently dropped on a date-math NaN). */
export function isRowExpired(row: RelayRouteRow, nowMs: number): boolean {
  if (typeof row.ttl_seconds !== 'number' || row.ttl_seconds <= 0) return false;
  const createdMs = Date.parse(row.created_at);
  if (Number.isNaN(createdMs)) return false;
  return nowMs > createdMs + row.ttl_seconds * 1000;
}

// ─── One poll tick, fully injectable, fully offline-testable ───────────────────────────────────

export interface PollTickSummary {
  seen: number;
  skippedNotOurs: number;
  claimLost: number;
  expired: number;
  processed: number;
  malformed: number;
  errored: number;
  /** D-BP156-M0-014: count of replies successfully POSTed to relay_route_replies this tick.
   *  Never blocks processed/errored above -- a reply write failure is logged and reflected only
   *  here, matching writeBishopDispatchReply()'s own non-fatal, best-effort contract. */
  repliesWritten: number;
}

function emptySummary(): PollTickSummary {
  return {
    seen: 0, skippedNotOurs: 0, claimLost: 0, expired: 0, processed: 0, malformed: 0, errored: 0,
    repliesWritten: 0,
  };
}

/** Conditional PATCH: only succeeds (returns true) if the row was still `status='pending'` at
 *  the moment Postgres evaluated the filter. `Prefer: return=representation` is what lets us
 *  tell "I won the claim" (non-empty array) from "someone/something already moved this row"
 *  (empty array) without a second round trip. Any network/HTTP failure is treated as "did not
 *  claim" -- fails closed, never processes a row it cannot prove ownership of. */
async function conditionalClaim(
  fetchImpl: FetchLike,
  supabaseUrl: string,
  anonKey: string,
  rowId: string,
  newStatus: string,
): Promise<boolean> {
  try {
    const res = await fetchImpl(
      `${supabaseUrl}/rest/v1/relay_routes?id=eq.${encodeURIComponent(rowId)}&status=eq.pending`,
      {
        method: 'PATCH',
        headers: restHeaders(anonKey, { Prefer: 'return=representation' }),
        body: JSON.stringify({ status: newStatus }),
        signal: AbortSignal.timeout(DEFAULT_FETCH_TIMEOUT_MS),
      },
    );
    if (!res.ok) return false;
    const body = (await res.json()) as unknown[];
    return Array.isArray(body) && body.length > 0;
  } catch {
    return false;
  }
}

/** Unconditional finalize -- only ever called on a row this listener already proved it owns
 *  (won the conditionalClaim above), so there is no race to guard against here. Best-effort:
 *  a failed finalize PATCH is logged, not thrown -- the row stays at `processing` rather than
 *  reverting to `pending`, so it will not be re-fired by a future poll (the SELECT filter is
 *  `status=eq.pending`), matching the row-level-idempotency requirement even in this failure
 *  mode, at the cost of the row never reaching a terminal status if this single write fails. */
async function finalizeStatus(
  fetchImpl: FetchLike,
  supabaseUrl: string,
  anonKey: string,
  rowId: string,
  newStatus: string,
): Promise<void> {
  try {
    await fetchImpl(`${supabaseUrl}/rest/v1/relay_routes?id=eq.${encodeURIComponent(rowId)}`, {
      method: 'PATCH',
      headers: restHeaders(anonKey, { Prefer: 'return=minimal' }),
      body: JSON.stringify({ status: newStatus }),
      signal: AbortSignal.timeout(DEFAULT_FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    console.warn(`[bishop-relay-listener] finalize PATCH failed for row ${rowId} (non-fatal):`, err);
  }
}

/** Best-effort peer_presence heartbeat, matching relay_answer/worker.ts's writePollerHeartbeat
 *  convention (same columns, same anon-key auth, same fire-and-catch non-fatal failure mode).
 *  Shares `relay_poller_heartbeat_at`/`relay_poller_poll_count` with any other poller touching
 *  this peer's presence row (e.g. index.ts's startRelayRoutePoll) -- see this file's header note
 *  on that shared-column caveat. Both loops writing "a relay poller is alive right now" to the
 *  same liveness columns is honest (a relay poller genuinely is alive), just not consumer-scoped;
 *  documented rather than silently assumed fine. */
async function writeHeartbeat(
  fetchImpl: FetchLike,
  supabaseUrl: string,
  anonKey: string,
  peerId: string,
  pollCount: number,
): Promise<void> {
  try {
    await fetchImpl(`${supabaseUrl}/rest/v1/peer_presence?peer_id=eq.${encodeURIComponent(peerId)}`, {
      method: 'PATCH',
      headers: restHeaders(anonKey, { Prefer: 'return=minimal' }),
      body: JSON.stringify({
        relay_poller_heartbeat_at: new Date().toISOString(),
        relay_poller_poll_count: pollCount,
      }),
      signal: AbortSignal.timeout(DEFAULT_FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    console.warn('[bishop-relay-listener] heartbeat PATCH failed (non-fatal):', err);
  }
}

/**
 * One full poll tick: fetch pending rows addressed to this peer, act only on bishop-dispatch-
 * shaped ones, leave every other row completely untouched (scope item 2: "leave the existing
 * inference-payload path completely untouched"). Never throws -- every per-row failure mode is
 * caught, logged, and reflected in the returned summary instead of propagating.
 */
export async function pollBishopDispatchRoutesOnce(
  config: BishopRelayListenerConfig,
  pollCount: number,
): Promise<PollTickSummary> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const handleEnvelope = config.handleEnvelope ?? handleInboundBishopDispatchEnvelope;
  const rowLimit = config.rowLimit ?? DEFAULT_ROW_LIMIT;
  const nowMs = config.nowMs ?? Date.now;
  const summary = emptySummary();

  // Best-effort liveness signal every tick, independent of whether any row is found -- this is
  // what lets a future reader tell "never ran" (relay_poller_poll_count: 0, as measured live for
  // M0/M3/NJS_3D_FACTORY before this dispatch) apart from "ran, found nothing this tick."
  void writeHeartbeat(fetchImpl, config.supabaseUrl, config.anonKey, config.peerId, pollCount);

  let rows: RelayRouteRow[];
  try {
    const url =
      `${config.supabaseUrl}/rest/v1/relay_routes` +
      `?target_peer_id=eq.${encodeURIComponent(config.peerId)}&status=eq.pending` +
      `&select=id,created_at,payload_json,hex_frame,status,wire_format,ttl_seconds,session_id` +
      `&order=created_at.asc&limit=${rowLimit}`;
    const res = await fetchImpl(url, {
      headers: restHeaders(config.anonKey),
      signal: AbortSignal.timeout(DEFAULT_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[bishop-relay-listener] fetch pending rows FAILED: HTTP ${res.status}`);
      return summary;
    }
    rows = ((await res.json()) as RelayRouteRow[]) ?? [];
  } catch (err) {
    console.warn('[bishop-relay-listener] fetch pending rows network error (non-fatal):', err);
    return summary;
  }

  summary.seen = rows.length;

  for (const row of rows) {
    // Not ours: never touch it. This is the "leave the inference-payload path untouched"
    // contract -- a SELECT already happened (harmless, read-only), but no PATCH is ever issued
    // for a row this listener does not recognize as bishop-dispatch-shaped.
    if (!hasBishopDispatchKind(row)) {
      summary.skippedNotOurs++;
      continue;
    }

    if (isRowExpired(row, nowMs())) {
      const won = await conditionalClaim(fetchImpl, config.supabaseUrl, config.anonKey, row.id, 'expired');
      if (won) {
        summary.expired++;
        console.log(`[bishop-relay-listener] row ${row.id.slice(0, 8)} expired (ttl_seconds=${row.ttl_seconds}) -- skipped, never handed to the envelope handler`);
      } else {
        summary.claimLost++;
      }
      continue;
    }

    const claimed = await conditionalClaim(fetchImpl, config.supabaseUrl, config.anonKey, row.id, 'processing');
    if (!claimed) {
      // Someone/something else already moved this row off `pending` between our SELECT and our
      // PATCH -- row-level idempotency (scope item 6): never re-fire a row we did not win.
      summary.claimLost++;
      continue;
    }

    const envelope = extractEncryptedEnvelope(row);
    if (!envelope) {
      // Ours by kind, but malformed (missing/non-string payload_encrypted). Claimed already
      // (so it is never re-selected on the next poll), marked error, never handed to the
      // decrypt/dispatch path with a non-string -- "a malformed inbound payload must never take
      // down the peer server."
      summary.malformed++;
      await finalizeStatus(fetchImpl, config.supabaseUrl, config.anonKey, row.id, 'error');
      console.warn(`[bishop-relay-listener] row ${row.id.slice(0, 8)} has kind='bishop_dispatch' but no usable payload_encrypted string -- marked error`);
      continue;
    }

    const rowStartMs = nowMs();
    try {
      // D-BP157-023: row.id is this route's routeId -- threaded through so the eventual
      // stage-2/completion reply (posted much later, from inside launchWorker's own exit
      // handler) can be correlated back to this same relay_route_replies route id.
      const result = await handleEnvelope(envelope, row.id);
      await finalizeStatus(fetchImpl, config.supabaseUrl, config.anonKey, row.id, result.ok ? 'answered' : 'error');
      // D-BP156-M0-014: write the reply leg -- the builder's result travels back to the
      // conductor via relay_route_replies (see bishop_dispatch_reply.ts's header for the full
      // mechanism). Best-effort, matching finalizeStatus/writeHeartbeat above: a failed reply
      // write is logged inside writeBishopDispatchReply itself and must never affect this row's
      // relay_routes status (already finalized above) or throw into this poll tick.
      if (await writeBishopDispatchReply(
        { supabaseUrl: config.supabaseUrl, anonKey: config.anonKey, fetchImpl },
        row.id,
        config.peerId,
        result,
        nowMs() - rowStartMs,
      )) {
        summary.repliesWritten++;
      }
      if (result.ok) {
        summary.processed++;
        console.log(`[bishop-relay-listener] row ${row.id.slice(0, 8)} handled: spawned=${result.spawned} reason=${result.reason}`);
      } else {
        summary.errored++;
        console.warn(`[bishop-relay-listener] row ${row.id.slice(0, 8)} envelope handler returned ok=false: ${result.reason}`);
      }
    } catch (err) {
      // Never let a throwing handler (or a throwing decrypt/verify inside it) take down the poll
      // loop or the host process -- exactly the "malformed inbound payload must never take down
      // the peer server" requirement, defended even against a bug in the handler itself.
      summary.errored++;
      await finalizeStatus(fetchImpl, config.supabaseUrl, config.anonKey, row.id, 'error');
      console.error(`[bishop-relay-listener] row ${row.id.slice(0, 8)} envelope handler THREW (caught, marked error):`, err);
    }
  }

  return summary;
}

// ─── The running listener ────────────────────────────────────────────────────────────────────

export interface BishopRelayListenerHandle {
  stop(): void;
}

/**
 * Starts the poll loop on an interval (default `getBishopRelayPollIntervalMs()`,
 * env-overridable via `LB_MESH_BISHOP_RELAY_POLL_MS`). Non-overlapping: a tick that has not yet
 * resolved suppresses the next scheduled tick (same discipline as relay_answer/worker.ts's
 * `inflight` guard), so a slow Supabase response or a slow envelope handler cannot cause two
 * ticks to race each other from THIS listener (the conditionalClaim above additionally protects
 * against a race with any OTHER process/listener touching the same rows).
 */
export function startBishopDispatchRelayListener(
  config: BishopRelayListenerConfig,
  intervalMs: number = getBishopRelayPollIntervalMs(),
): BishopRelayListenerHandle {
  let pollCount = 0;
  let inflight = false;

  async function tick(): Promise<void> {
    if (inflight) return;
    inflight = true;
    pollCount++;
    try {
      await pollBishopDispatchRoutesOnce(config, pollCount);
    } catch (err) {
      // pollBishopDispatchRoutesOnce is designed to never throw, but this listener must survive
      // even if that guarantee is ever broken by a future edit -- belt and suspenders.
      console.error('[bishop-relay-listener] poll tick threw unexpectedly (caught, listener stays alive):', err);
    } finally {
      inflight = false;
    }
  }

  const intervalId = setInterval(() => { void tick(); }, intervalMs);
  void tick(); // first tick immediately, matching startRelayRoutePoll's own boot behavior

  return {
    stop(): void {
      clearInterval(intervalId);
    },
  };
}

/** Convenience wrapper matching index.ts's existing `startRelayRoutePoll(_relayPeerId)` /
 *  `startRelayAnswerPoller({peerId, supabaseUrl, anonKey})` call-site convention -- resolves
 *  peerId/supabaseUrl/anonKey the SAME way those callers already do (getStablePeerId(),
 *  getSupabaseUrl(), getAnonKey()) so this listener authenticates identically to every other
 *  poller in this codebase, no new credential path introduced. */
export function startBishopDispatchRelayListenerWithDefaults(): BishopRelayListenerHandle {
  return startBishopDispatchRelayListener({
    peerId: getStablePeerId(),
    supabaseUrl: getSupabaseUrl(),
    anonKey: getAnonKey(),
  });
}
