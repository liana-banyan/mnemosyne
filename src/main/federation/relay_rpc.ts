/**
 * relay_rpc.ts -- D-BP223-X043-010-RB. The ONLY way the app writes peer_presence and reads or
 * writes relay_routes / relay_route_replies.
 *
 * Every function here calls one of the Phase A SECURITY DEFINER functions (applied live
 * 2026-09-28T03:09:33Z; text in BISHOP_DROPZONE\D-BP223-X043-007-RELAY-X25519\
 * PHASE_A_APPLY_20260928T030926Z.sql) over PostgREST `POST /rest/v1/rpc/<name>` with the public
 * anon key plus this install's presence owner secret (presence_owner_secret.ts). After Phase B the
 * direct table routes these replace are refused for anon, so nothing else in the app may touch
 * those tables directly. peer_presence stays publicly READABLE; plain SELECTs of it are not here.
 * (Checked before writing: relay-client.ts is the WebSocket relay, relay_server.ts the local
 * relay server, relay_v2_transport.ts the v2 encryption glue; none of them calls these RPCs.)
 *
 *   presence_put_own(peer_id, secret, fields)            register / claim / update own presence row
 *   route_send(sender, secret, target, hex, payload...)  send a route; origin_peer_id set from proof
 *   routes_fetch_mine(peer_id, secret, status, limit)    recipient reads its own routes (ASC, max 200)
 *   route_set_status(route, peer, secret, from, to)      recipient moves its own route (from NULL = unconditional)
 *   route_reply_put(route, peer, secret, answer, hex, ms) recipient replies to its own route
 *   route_replies_for_sender(peer, secret, route_ids[])  sender reads status + replies of routes it sent
 *
 * THE SECRET IS NEVER LOGGED, NEVER IN A URL, NEVER IN A RETURNED ERROR. Server error text is
 * scrubbed of it before it leaves this module (PostgREST does not echo argument values, but this
 * does not rely on that).
 */

import { getPresenceOwnerSecret } from './presence_owner_secret';

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface RelayRpcBase {
  supabaseUrl: string;
  anonKey: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

export interface RelayRpcResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  /** Postgres SQLSTATE when the server raised one (42501 = not the owner / not proven). */
  code?: string;
}

type SecretProvider = (peerId: string) => string;
let _secretProvider: SecretProvider = (peerId) => getPresenceOwnerSecret(peerId);

/** Tests inject a provider; production uses the safeStorage-backed store. */
export function setOwnerSecretProviderForTests(p: SecretProvider | null): void {
  _secretProvider = p ?? ((peerId) => getPresenceOwnerSecret(peerId));
}

const DEFAULT_TIMEOUT_MS = 10_000;

function scrub(text: string, secret: string): string {
  return secret ? text.split(secret).join('[redacted]') : text;
}

async function callRpc<T>(base: RelayRpcBase, fn: string, peerIdForSecret: string, args: (secret: string) => Record<string, unknown>): Promise<RelayRpcResult<T>> {
  let secret: string;
  try {
    secret = _secretProvider(peerIdForSecret);
  } catch (err) {
    return { ok: false, status: 0, error: `owner secret unavailable: ${(err as Error).message}` };
  }
  const fetchImpl = base.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await fetchImpl(`${base.supabaseUrl}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: base.anonKey,
        Authorization: `Bearer ${base.anonKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(args(secret)),
      signal: AbortSignal.timeout(base.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch (err) {
    return { ok: false, status: 0, error: scrub(`network: ${(err as Error).message}`, secret) };
  }
  let text = '';
  try { text = await res.text(); } catch { /* empty body */ }
  if (!res.ok) {
    let code: string | undefined;
    let message = text;
    try {
      const j = JSON.parse(text) as { code?: string; message?: string };
      code = j.code;
      message = j.message ?? text;
    } catch { /* not JSON */ }
    return { ok: false, status: res.status, code, error: scrub(`HTTP ${res.status} ${message}`.slice(0, 400), secret) };
  }
  let data: T | undefined;
  try { data = text ? (JSON.parse(text) as T) : undefined; } catch { data = text as unknown as T; }
  return { ok: true, status: res.status, data };
}

// ---------------------------------------------------------------------------------------------
// presence

/** Self-service columns presence_put_own accepts (anything else is ignored by the server). */
export interface PresenceFields {
  email_hash?: string;
  wan_soccerball_id?: string;
  lan_addresses?: string[];
  relay_session_id?: string;
  capabilities?: Record<string, unknown>;
  version?: string;
  artifact_server_address?: string;
  public_key_hex?: string;
  machine_label?: string;
  mic_load_hours?: number;
  /** Any value: the server stamps now(). */
  relay_poller_heartbeat_at?: true | string;
  relay_poller_poll_count?: number;
  /** Only 'active' is honoured by the server. */
  state?: 'active';
}

export async function presencePutOwn(
  base: RelayRpcBase & { peerId: string; fields: PresenceFields },
): Promise<RelayRpcResult<string>> {
  return callRpc<string>(base, 'presence_put_own', base.peerId, (secret) => ({
    p_peer_id: base.peerId, p_secret: secret, p_fields: base.fields,
  }));
}

// ---------------------------------------------------------------------------------------------
// routes

export interface RouteSendInput {
  senderPeerId: string;
  targetPeerId: string;
  hexFrame: string;
  payloadJson?: unknown;
  sessionId?: string | null;
  ttlSeconds?: number;
  wireFormat?: string;
}

/** Returns the new route id in `data` (a uuid string). */
export async function routeSend(base: RelayRpcBase & RouteSendInput): Promise<RelayRpcResult<string>> {
  return callRpc<string>(base, 'route_send', base.senderPeerId, (secret) => ({
    p_sender_peer_id: base.senderPeerId,
    p_secret: secret,
    p_target_peer_id: base.targetPeerId,
    p_hex_frame: base.hexFrame,
    p_payload_json: base.payloadJson ?? null,
    p_session_id: base.sessionId ?? null,
    p_ttl_seconds: base.ttlSeconds ?? 300,
    p_wire_format: base.wireFormat ?? 'json-legacy',
  }));
}

export interface RelayRouteRecord {
  id: string;
  created_at: string;
  target_peer_id: string;
  hex_frame: string;
  payload_json: unknown;
  status: string;
  session_id: string | null;
  ttl_seconds: number | null;
  wire_format: string | null;
  origin_peer_id: string | null;
  [k: string]: unknown;
}

/** Recipient-only. Oldest first, limit clamped to 1..200 by the server. `status` null = all. */
export async function routesFetchMine(
  base: RelayRpcBase & { peerId: string; status?: string | null; limit?: number },
): Promise<RelayRpcResult<RelayRouteRecord[]>> {
  const r = await callRpc<RelayRouteRecord[]>(base, 'routes_fetch_mine', base.peerId, (secret) => ({
    p_peer_id: base.peerId,
    p_secret: secret,
    p_status: base.status === undefined ? 'pending' : base.status,
    p_limit: base.limit ?? 25,
  }));
  if (r.ok && !Array.isArray(r.data)) r.data = [];
  return r;
}

/** Recipient-only status move. fromStatus null = unconditional. data=true when this call moved it. */
export async function routeSetStatus(
  base: RelayRpcBase & { routeId: string; peerId: string; fromStatus: string | null; toStatus: 'processing' | 'answered' | 'error' | 'expired' },
): Promise<RelayRpcResult<boolean>> {
  return callRpc<boolean>(base, 'route_set_status', base.peerId, (secret) => ({
    p_route_id: base.routeId,
    p_peer_id: base.peerId,
    p_secret: secret,
    p_from_status: base.fromStatus,
    p_to_status: base.toStatus,
  }));
}

/** Recipient-only reply. data = reply id. */
export async function routeReplyPut(
  base: RelayRpcBase & { routeId: string; peerId: string; answerJson?: unknown; hexReply?: string | null; processingMs?: number | null },
): Promise<RelayRpcResult<string>> {
  return callRpc<string>(base, 'route_reply_put', base.peerId, (secret) => ({
    p_route_id: base.routeId,
    p_peer_id: base.peerId,
    p_secret: secret,
    p_answer_json: base.answerJson ?? null,
    p_hex_reply: base.hexReply ?? null,
    p_processing_ms: base.processingMs == null ? null : Math.round(base.processingMs),
  }));
}

export interface SenderReplyRow {
  route_id: string;
  route_status: string;
  reply_id: string | null;
  reply_created_at: string | null;
  reply_peer_id: string | null;
  answer_json: unknown;
  hex_reply: string | null;
  processing_ms: number | null;
}

/** Sender-only: status and replies of routes this peer sent (origin_peer_id proven at send). A
 *  route with no reply yet appears once with reply_id null. */
export async function routeRepliesForSender(
  base: RelayRpcBase & { peerId: string; routeIds: string[] },
): Promise<RelayRpcResult<SenderReplyRow[]>> {
  const r = await callRpc<SenderReplyRow[]>(base, 'route_replies_for_sender', base.peerId, (secret) => ({
    p_peer_id: base.peerId, p_secret: secret, p_route_ids: base.routeIds,
  }));
  if (r.ok && !Array.isArray(r.data)) r.data = [];
  return r;
}

/** Only rows that actually carry a reply (drops the reply_id-null placeholder rows). */
export function repliesOnly(rows: SenderReplyRow[] | undefined): SenderReplyRow[] {
  return (rows ?? []).filter((r) => r.reply_id !== null);
}

/** Header carrying the owner proof to the five relay edge functions (wan-relay-publish,
 *  beacons-lit-handshake, wan-relay-route, substrace-wake, submit-relay-route-reply). A HEADER,
 *  not a body field, on purpose: the currently deployed wan-relay-publish stores the whole
 *  request body in wan_relay_records.peanut_roll, and an unknown header is ignored by old code,
 *  so the secret is never persisted server-side before or after the edge change is deployed. */
export const OWNER_PROOF_HEADER = 'x-lb-owner-secret';

/** { 'x-lb-owner-secret': <secret> } for an edge-function call, or null when the secret is
 *  unavailable (callers then fail closed and skip the write). Never log the returned object. */
export function ownerProofHeaders(peerId: string): Record<string, string> | null {
  try {
    return { [OWNER_PROOF_HEADER]: _secretProvider(peerId) };
  } catch (err) {
    console.warn(`[relay-rpc] owner secret unavailable for edge proof: ${(err as Error).message}`);
    return null;
  }
}
