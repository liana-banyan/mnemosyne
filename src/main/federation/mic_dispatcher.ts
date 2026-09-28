/**
 * mic_dispatcher.ts — MIC (Machine In Charge) Conductor v0.4.0 BP083
 *
 * Greedy domain-to-peer assignment algorithm.
 * Assigns domains to the peer with the lowest pending load.
 * Domain-Chocolate match bonus: if a peer has the domain installed, it gets
 * priority (load - 1 effective). Per-domain isolation (BP078 canon) ensures
 * no cross-domain contamination.
 *
 * SCAFFOLD v0.4.0 — peer dispatch via HTTP POST to peer_server.ts port 7474.
 * Thorax encryption + Socceri transport deferred to v0.4.1.
 */

import type {
  ConstellationPeer,
  DomainWorkUnit,
  MicWorkload,
  MicAggregatedResult,
  PeerPlowResult,
  MicStatusEvent,
  MicStartPayload,
} from './mic_types';
import { discoverPeers } from './constellation_discovery';
import { randomBytes, createHash } from 'crypto';
import { networkInterfaces } from 'os';
import { getAnonKey, getSupabaseUrl } from '../shared/anon_key';
// KN-BP144-16 Phase 1: sign the LAN /api/plow-domain dispatch (see peer_server.ts's
// resolvePlowDomainRequest() for the receiving side).
import { signAnnouncePayload } from './announce_frame';
import { getStablePeerId } from './peer-discovery';
import { ownerProofHeaders, routeSend } from './relay_rpc';
// D-BP223-X043-007-RELAY-X25519: v2 relay sealing (per-peer X25519 key agreement).
import { sealRelayPayloadForPeer, type SealDeps, type SealResult } from './relay_v2_transport';
// D-BP156-M0-008: HARDWIRE-24 mesh, Bishop-dispatch payload variant. getStablePeerId already
// imported above is reused (not re-imported) by callers of dispatchBishopDispatchViaRelay.

const PEER_SERVER_PORT = 7474;

// ─── WAN relay config (BP084 SEG-2) ──────────────────────────────────────────
const RELAY_BASE =
  (typeof process !== 'undefined' && process.env?.RELAY_BASE)
    ? process.env.RELAY_BASE
    : 'https://relay.lianabanyan.com/functions/v1';
const RELAY_BASE_FALLBACK = 'https://ruuxzilgmuwddcofqecc.supabase.co/functions/v1';

/**
 * Returns true if peerAddress (IP:port) is on the same local subnet as this machine.
 * LAN peers → direct port 7474; WAN peers → relay route.
 */
function isLanPeer(peerAddress: string): boolean {
  const peerIp = peerAddress.split(':')[0] ?? '';
  const ifaces = networkInterfaces();
  for (const iface of Object.values(ifaces)) {
    if (!iface) continue;
    for (const addr of iface) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      // Same /24 subnet check (sufficient for home/office LAN)
      const localPrefix = addr.address.split('.').slice(0, 3).join('.');
      const peerPrefix = peerIp.split('.').slice(0, 3).join('.');
      if (localPrefix === peerPrefix) return true;
    }
  }
  return false;
}

/**
 * D-BP223-X043-007-RELAY-X25519: THE OLD KEY RULE WAS NOT SECRET. encryptForRelay derived its
 * AES-256-GCM key from sha256(targetPeerId + ":thorax-relay-v1") and no caller ever passed a shared
 * secret, so anyone who could read peer_presence (anon-readable) could decrypt every relay_routes
 * row (also anon-readable). That v1 code now lives VERBATIM in relay_v1_legacy.ts, and every send
 * in this file seals with v2 (relay_x25519.ts: per-peer X25519 + HKDF-SHA256 + AES-256-GCM, signed
 * key announcements) through sealRelayPayloadForPeer (relay_v2_transport.ts).
 *
 * encryptForRelay / decryptFromRelay remain exported ONLY as deprecated aliases of the v1 legacy
 * functions, for existing tests and for reading old frames during a transition window the user
 * turns on (relay_crypto_settings.ts). No production send path calls encryptForRelay any more.
 */
export {
  encryptForRelayV1Legacy as encryptForRelay,
  decryptFromRelayV1Legacy as decryptFromRelay,
} from './relay_v1_legacy';

// D-BP156-M0-008: shared POST-to-wan-relay-route-with-fallback helper, extracted verbatim out
// of dispatchDomainViaRelay's own body (same headers, same timeout, same base->fallback order,
// same swallow-network-error-into-null behavior) so the new bishop-dispatch payload variant
// below reuses the exact retry/circuit-breaker behavior instead of forking it, per this
// dispatch's explicit instruction ("reuse the existing encryption, retry, and circuit-breaker
// code verbatim. Do not fork it, do not reimplement it."). Zero behavior change for
// dispatchDomainViaRelay's own call site -- this is a pure extraction.
async function postToRelayRouteWithFallback(
  payloadEncrypted: string,
  targetPeerId: string,
): Promise<Response | null> {
  // BP132 Yoke #23 Task 6: shared helper so a stranger's install still authenticates.
  const anonKey = getAnonKey();
  // D-BP223-X043-010-RB: wan-relay-route now also requires the sender's presence owner proof
  // (x-lb-owner-secret header). No secret, no send (fail closed, same as a network failure).
  const ownerProof = ownerProofHeaders(getStablePeerId());
  if (!ownerProof) return null;

  const tryRoute = async (base: string): Promise<Response | null> => {
    try {
      return await fetch(`${base}/wan-relay-route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(anonKey ? { 'Authorization': `Bearer ${anonKey}` } : {}),
          ...ownerProof,
        },
        body: JSON.stringify({ payload_encrypted: payloadEncrypted, target_peer_id: targetPeerId }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      return null;
    }
  };

  let res = await tryRoute(RELAY_BASE);
  if (!res || !res.ok) {
    res = await tryRoute(RELAY_BASE_FALLBACK);
  }
  return res;
}

/**
 * Dispatch a domain work unit to a WAN peer via the Supabase relay.
 * Payload is Thorax-encrypted — relay sees only ciphertext + target peer_id.
 */
async function dispatchDomainViaRelay(
  peer: ConstellationPeer,
  domain: string,
  questions: string[],
  payload: MicStartPayload,
): Promise<PeerPlowResult> {
  const plaintext = JSON.stringify({
    domain,
    questions,
    ollamaBaseUrl: payload.ollamaBaseUrl ?? 'http://127.0.0.1:11434',
    model: payload.model ?? 'gemma4:12b',
  });

  // D-BP223-X043-007: v2 seal (per-peer X25519), replacing encryptForRelay(plaintext, peer.id).
  const sealed = await sealRelayPayloadForPeer(plaintext, peer.id);
  if (!sealed.ok) {
    return {
      peerId: peer.id,
      domain,
      ebletsWritten: 0,
      quarantined: 0,
      andonEvents: 0,
      status: 'red',
      error: `Thorax encrypt failed: ${sealed.error}`,
    };
  }
  const payloadEncrypted = sealed.payloadEncrypted;

  const res = await postToRelayRouteWithFallback(payloadEncrypted, peer.id);

  if (!res || !res.ok) {
    return {
      peerId: peer.id,
      domain,
      ebletsWritten: 0,
      quarantined: 0,
      andonEvents: 0,
      status: 'red',
      error: `WAN relay route failed: HTTP ${res?.status ?? 'unreachable'}`,
    };
  }

  // Relay accepted the payload.  The actual result is async (target peer processes
  // and responds independently).  Return yellow pending — aggregation will
  // reconcile via Supabase or future response channel.
  return {
    peerId: peer.id,
    domain,
    ebletsWritten: 0,
    quarantined: 0,
    andonEvents: 0,
    status: 'yellow',
    error: undefined,
  };
}

// ─── Bishop dispatch payload (D-BP156-M0-008, HARDWIRE-24) ─────────────────────
//
// A second payload shape carried over the SAME wan-relay-route transport as
// dispatchDomainViaRelay above, for coordinating a Claude-Code Bishop session across the
// mesh rather than an Ollama MC-question plow run. Reuses the relay sealing (v2 since X043-007) and
// postToRelayRouteWithFallback verbatim (see both above) -- nothing about the transport,
// encryption, retry, or fallback behavior is forked or reimplemented for this variant.

/**
 * HARDWIRE-24 Section 3: a dispatch id crossing the mesh must carry the machine
 * ("D-BP155-M0-001", "D-BP155-M3-001"). A bare "D-BP155-001" is malformed once the mesh is
 * live and must be rejected, not silently accepted. Matches any machine tag of the form
 * "M<digits>" (not hardcoded to M0/M3 only) so a future M1/M2 machine label is not rejected
 * by a narrower pattern than HARDWIRE-24 itself specifies.
 */
const MACHINE_TAGGED_DISPATCH_ID_RE = /^D-BP\d+-M\d+-\d+(?:-[A-Za-z0-9]+)?$/;

export function isValidMachineTaggedDispatchId(id: unknown): id is string {
  return typeof id === 'string' && MACHINE_TAGGED_DISPATCH_ID_RE.test(id);
}

export interface BishopDispatchPayload {
  kind: 'bishop_dispatch';
  dispatchId: string;
  promptText: string;
  workingDir: string;
  /** Self-declared by the sender inside the SIGNED envelope (see signAnnouncePayload,
   *  announce_frame.ts) -- the receiver verifies this against an Ed25519 signature rather than
   *  trusting it at face value. See dispatchBishopDispatchViaRelay's doc comment for the honest
   *  limit of what that signature does and does not prove. */
  originPeerId: string;
}

export interface BishopDispatchSendResult {
  ok: boolean;
  error?: string;
  /** D-BP156-M0-020: the `relay_routes.id` of the row this send just inserted, present only
   *  when ok is true. postBishopDispatchRelayRoute already sends `Prefer: return=representation`
   *  (see below) so the insert response body already contains this row -- previously that body
   *  was fetched and immediately discarded, leaving a successful send with no way for a caller
   *  to name which row it produced. This is the field a sender-side receipt (a caller printing
   *  "sent, relay_routes row <id> to peer <targetPeerId>") is built from. */
  routeId?: string;
}

// D-BP156-M0-016: relay_routes INSERT for a bishop_dispatch row, mirroring wan_dispatch.ts's
// insertRelayRoute() -- the proven, anon-key-only sender that produced 5,694 `answered` rows
// (verified live, WAN_RELAY_SCHEMA_VERIFIED_BP156.md). This does NOT reuse
// postToRelayRouteWithFallback above: that helper POSTs `{payload_encrypted, target_peer_id}`
// to the `wan-relay-route` EDGE FUNCTION, which requires `target_peer_id` AND `hex_frame` and
// returns HTTP 400 without both (verified against the edge function's real source,
// LianaBanyanPlatform\platform\supabase\functions\wan-relay-route\index.ts) -- the exact
// defect this dispatch (D-BP156-M0-016) exists to fix. The proven sender instead INSERTs
// directly into the `relay_routes` TABLE via PostgREST with the anon/publishable key
// (getAnonKey()/getSupabaseUrl(), same as every other real poller in this codebase), never
// invoking the edge function at all. dispatchDomainViaRelay/postToRelayRouteWithFallback
// above are left completely untouched -- out of this dispatch's scope, and already flagged
// elsewhere (wan_dispatch.ts's own header) as a known-broken sibling path, not fixed here.
const BISHOP_DISPATCH_TTL_SECONDS = 300;

// D-BP165-M0-013 ADDITION -- GAP 2 CLOSURE, READ THIS BEFORE REMOVING IT. Founder order (BP165,
// verbatim): "make certain that all outbound and inbound traffic, which are celpanes or eblets...
// are recorded as a matter of course... so that there is no way to cheat the system, and go around
// the immutable ledgers." MEASURED at this dispatch (D-BP165-M0-013): postBishopDispatchRelayRoute()
// below is a direct `fetch POST .../rest/v1/relay_routes` with NO ledger call anywhere on this path --
// real bishop_dispatch traffic (this function's whole purpose) has never touched any durable ledger.
// This is the exact gap D-BP165-M0-013's brief named by file and reasoning (mic_channel_send.js's own
// header: "bishop_dispatch_send_cli.mjs already sends through the SAME relay_routes table... Anyone
// holding the service-role key can POST directly and never touch the ledger" -- the CLI itself only
// attaches over CDP and calls window.amplify.bishopDispatchSendViaRelay(...), which resolves HERE).
//
// WHY A PORTED HELPER, NOT A CROSS-REPO require() OF mic_channel_ledger.js: this file lives in the
// mnemosyne repo (an Electron app, asar-packaged when built) and mic_channel_ledger.js lives in the
// separate LianaBanyanPlatform repo. A relative require() reaching outside this project works in an
// unpacked dev run but breaks once packaged (asar cannot resolve outside its own archive), and this
// function runs inside the live Electron main process -- an unverified cross-repo runtime dependency
// on a chokepoint like this is itself a new, undocumented bypass risk. The estate's OWN established
// precedent for exactly this situation is mic_channel_crypto.js's own header: socceriHash/
// signSocceriHash there are "PORTED, not reimplemented, from ... key_signer.ts ... because this
// script must run as a plain Node process with no Electron app singleton available." The same
// reasoning applies in reverse here: this code ports the SAME hash-chain shape mic_channel_ledger.js
// writes (prev_entry_hash / entry_hash, per-peer CHAIN_HEAD.<peer id>.txt, the same dual
// LB_LEDGER_ROOT convention, the same SHA-512-over-canonicalized-JSON primitive) so a single verify
// pass (mic_channel_ledger_verify.js) can walk BOTH this file's peer log and the MIC channel's,
// rather than inventing a fourth ledger shape.
//
// PEER IDENTITY: getStablePeerId() (imported above, already used elsewhere in this file for Bishop
// dispatch) is used here, NOT the MIC channel's own Ed25519 keypair identity (mic_channel_keys.js) --
// those are two independent identity systems in this estate, so this necessarily writes to its own
// `mic_channel_log.<electron peer id>.jsonl` file rather than the MIC channel CLI's file. That is
// correct, not a bug: readMergedLedger()/mic_channel_ledger_verify.js already treat every
// `mic_channel_log.*.jsonl` file in the ledger directory as one more independent witness stream (the
// same "one writer per file" discipline that file's own D-BP161-M0-014 section documents), and two
// different identity systems writing two different files is exactly that discipline, not a collision.
//
// M3 DOWNCHAIN: ledgerRoot()/ledgerDir() below port the SAME dual-convention detection
// mic_channel_ledger.js uses (LB_LEDGER_ROOT unset -> M0's repo-root-relative default; LB_LEDGER_ROOT
// set and already ending in HARDWIRE\LEDGER -> used as-is) so M3 running this same compiled app
// against its own LB_LEDGER_ROOT gets the fix automatically, with no M3-specific code path.
function ledgerRootTs(): string {
  const fromEnv = typeof process !== 'undefined' ? process.env?.LB_LEDGER_ROOT : undefined;
  return fromEnv || 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform';
}

function rootAlreadyEndsInHardwireLedgerTs(root: string): boolean {
  const normalized = root.replace(/[\\/]+$/, '');
  const segments = normalized.split(/[\\/]+/).filter(Boolean);
  if (segments.length < 2) return false;
  const lastTwo = segments.slice(-2).map((s) => s.toLowerCase());
  return lastTwo[0] === 'hardwire' && lastTwo[1] === 'ledger';
}

function ledgerDirTs(): string {
  // Lazily required (not top-level imported) so this file's existing, already-verified import graph
  // is untouched for every caller that never reaches this code path.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path') as typeof import('path');
  const root = ledgerRootTs();
  const hardwireLedgerDir = rootAlreadyEndsInHardwireLedgerTs(root)
    ? root
    : path.join(root, 'HARDWIRE', 'LEDGER');
  return path.join(hardwireLedgerDir, 'MIC_CHANNEL');
}

/** Deterministic JSON serialization, sorted keys -- the same shape as mic_channel_crypto.js's
 *  canonicalize(), ported for the same "two readers must hash identical bytes" reason. */
function canonicalizeTs(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalizeTs).join(',') + ']';
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalizeTs(obj[k])).join(',') + '}';
}

/** D-BP165-M0-013 fix carried over from mic_channel_ledger.js's own stripUndefinedDeep() (found live
 *  by that file's corruption-proof test run): an own-property with value `undefined` is INCLUDED by
 *  canonicalizeTs() but SILENTLY DROPPED by JSON.stringify(), so the two can never agree unless
 *  undefined-valued keys are removed before either runs. */
function stripUndefinedDeepTs(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripUndefinedDeepTs);
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj)) {
      if (obj[k] === undefined) continue;
      out[k] = stripUndefinedDeepTs(obj[k]);
    }
    return out;
  }
  return value;
}

/** Appends one hash-chained entry to this peer's traffic ledger. Mirrors mic_channel_ledger.js's
 *  appendLedgerEntry() exactly (see that file for the full design rationale): per-peer
 *  CHAIN_HEAD.<peer id>.txt, atomic-mkdir lock, prev_entry_hash/entry_hash via SHA-512 over
 *  canonicalized JSON, declared chain_genesis marker on first use (never rewrites prior history).
 *  Throws on a genuine I/O failure or lock timeout -- callers that ledger BEFORE sending rely on this
 *  propagating rather than being swallowed, so a send this function could not durably record never
 *  reaches the network. */
function appendMicChannelLedgerEntryTs(rawEntry: Record<string, unknown>): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs') as typeof import('fs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path') as typeof import('path');

  const entry = stripUndefinedDeepTs(rawEntry) as Record<string, unknown>;
  const dir = ledgerDirTs();
  fs.mkdirSync(dir, { recursive: true });

  const peerId = getStablePeerId();
  const logFile = path.join(dir, `mic_channel_log.${peerId}.jsonl`);
  const chainHeadFile = path.join(dir, `CHAIN_HEAD.${peerId}.txt`);
  const lockDir = path.join(dir, '.chain_lock');

  const lockStart = Date.now();
  for (;;) {
    try {
      fs.mkdirSync(lockDir);
      break;
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code !== 'EEXIST') throw err;
      if (Date.now() - lockStart > 15000) {
        throw new Error(
          `could not acquire mic_channel_ledger chain lock within 15000ms -- possible stale lock at ${lockDir}`,
        );
      }
      const t0 = Date.now();
      while (Date.now() - t0 < 5) { /* tiny synchronous busy-wait, matches mic_channel_ledger.js's fallback */ }
    }
  }

  try {
    let prevHash: string | null = null;
    if (fs.existsSync(chainHeadFile)) {
      const t = fs.readFileSync(chainHeadFile, 'utf8').trim();
      prevHash = t || null;
    }
    const isGenesis = prevHash === null;

    const bodyWithoutHash: Record<string, unknown> = {
      logged_at: new Date().toISOString(),
      ...entry,
      prev_entry_hash: prevHash,
    };
    if (isGenesis) {
      bodyWithoutHash.chain_genesis = true;
      let existingLines = 0;
      if (fs.existsSync(logFile)) {
        existingLines = fs.readFileSync(logFile, 'utf8').split(/\r?\n/).filter((l) => l.trim()).length;
      }
      bodyWithoutHash.unchained_lines_before_genesis = existingLines;
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require('crypto') as typeof import('crypto');
    const entryHash = crypto.createHash('sha512')
      .update(Buffer.from(canonicalizeTs(bodyWithoutHash), 'utf8'))
      .digest('hex');
    const fullBody = { ...bodyWithoutHash, entry_hash: entryHash };

    fs.appendFileSync(logFile, JSON.stringify(fullBody) + '\n', 'utf8');
    fs.writeFileSync(chainHeadFile, entryHash + '\n', 'utf8');
  } finally {
    try { fs.rmdirSync(lockDir); } catch { /* already gone, not fatal */ }
  }
}

async function postBishopDispatchRelayRoute(
  payloadEncrypted: string,
  targetPeerId: string,
  dispatchId: string,
  encWire: 'v2' | 'v1' = 'v2',
  /** D-BP223-X043-010-RB: the sending peer id, proven to route_send by its owner secret. */
  senderPeerId: string = getStablePeerId(),
): Promise<{ ok: boolean; error?: string; routeId?: string }> {
  const anonKey = getAnonKey();
  const supabaseUrl = getSupabaseUrl();

  // D-BP165-M0-013: LEDGER-THEN-SEND. Left deliberately UNCAUGHT -- see the block comment above this
  // function. A ledger write this process cannot durably complete must stop the send here, not be
  // swallowed and let the POST below proceed unrecorded.
  const attemptHash = createHash('sha512').update(payloadEncrypted).digest('hex');
  appendMicChannelLedgerEntryTs({
    direction: 'send_attempt', via: 'bishop_dispatch', kind: 'bishop_dispatch',
    to: targetPeerId, dispatch_id: dispatchId, payload_sha512: attemptHash,
  });

  try {
    // D-BP223-X043-010-RB: sent through route_send (Phase A RPC), proven with this install's
    // presence owner secret; the server sets origin_peer_id from that proof. Direct INSERTs into
    // relay_routes are refused for anon once Phase B is applied.
    const sent = await routeSend({
      supabaseUrl, anonKey, timeoutMs: 15_000,
      senderPeerId,
      targetPeerId,
      // relay_routes.hex_frame is a NOT NULL legacy column (verified live,
      // WAN_RELAY_SCHEMA_VERIFIED_BP156.md / wan_dispatch.ts's insertRelayRoute doc
      // comment). The bishop_dispatch listener (bishop_dispatch_relay_listener.ts) reads
      // payload_json.payload_encrypted exclusively and never looks at hex_frame -- so this
      // column is populated with the SAME already-opaque ciphertext purely to satisfy the
      // schema, never with plaintext promptText/dispatchId.
      hexFrame: payloadEncrypted,
      payloadJson: {
        kind: 'bishop_dispatch',
        payload_encrypted: payloadEncrypted,
        // D-BP223-X043-007: which relay encryption sealed payload_encrypted. Informational
        // only; the receiver decides from the frame itself, never from this field.
        enc: encWire,
      },
      sessionId: dispatchId,
      ttlSeconds: BISHOP_DISPATCH_TTL_SECONDS,
      wireFormat: 'json-legacy',
    });

    // D-BP165-M0-013: the OUTCOME ledger entry below is a second, separate observation, appended
    // AFTER the network call has already completed one way or another. Unlike the pre-send attempt
    // entry above (which is deliberately left to throw and block the send), a ledger-write failure
    // HERE must never overwrite an already-true send result with a false one -- the POST already
    // happened; misreporting it as failed could cause a caller to retry and duplicate a real,
    // already-sent dispatch. So this one is wrapped: recorded when possible, loudly logged to
    // console.error (never silently swallowed) when the ledger itself cannot be written, but the
    // function's actual return value always reflects what the network call really did.
    const logOutcome = (fields: Record<string, unknown>): void => {
      try {
        appendMicChannelLedgerEntryTs({ direction: 'sent', via: 'bishop_dispatch', ...fields });
      } catch (ledgerErr) {
        console.error(
          '[mic_dispatcher] D-BP165-M0-013: could not record bishop_dispatch SEND OUTCOME to the ' +
          'traffic ledger (the send attempt itself WAS already ledgered before this network call, ' +
          'and the network result below is unaffected by this failure):',
          ledgerErr,
        );
      }
    };

    if (!sent.ok) {
      // status 0 = no HTTP response (network failure or no owner secret): the old 'insert error'
      // wording; any HTTP refusal keeps the old 'insert failed' wording.
      const error = sent.status === 0
        ? `relay_routes insert error: ${sent.error ?? 'unknown'}`
        : `relay_routes insert failed: ${sent.error ?? 'unknown'}`;
      logOutcome({
        ok: false, http_status: sent.status, error,
        to: targetPeerId, dispatch_id: dispatchId, payload_sha512: attemptHash,
      });
      return { ok: false, error };
    }
    // route_send returns the new relay_routes row id: the caller's receipt.
    const routeId: string | undefined = typeof sent.data === 'string' && sent.data ? sent.data : undefined;
    logOutcome({
      ok: true, http_status: sent.status,
      route_id: routeId, to: targetPeerId, dispatch_id: dispatchId, payload_sha512: attemptHash,
    });
    return { ok: true, ...(routeId ? { routeId } : {}) };
  } catch (err) {
    // This catch is the network/pre-response failure path -- nothing was sent, so (unlike
    // logOutcome above) it is safe and correct for a ledger failure here to propagate as part of
    // reporting this attempt failed; there is no already-succeeded send it could misreport.
    const error = `relay_routes insert error: ${err instanceof Error ? err.message : String(err)}`;
    try {
      appendMicChannelLedgerEntryTs({
        direction: 'sent', via: 'bishop_dispatch', ok: false, error,
        to: targetPeerId, dispatch_id: dispatchId, payload_sha512: attemptHash,
      });
    } catch (ledgerErr) {
      console.error('[mic_dispatcher] D-BP165-M0-013: could not record bishop_dispatch SEND FAILURE to the traffic ledger:', ledgerErr);
    }
    return { ok: false, error };
  }
}

/**
 * D-BP156-M0-008 (design-constraint follow-up): the seam for a future second carrier. Today
 * there is exactly ONE implementation (wanRelayBishopDispatchTransport, below, wrapping
 * dispatchBishopDispatchViaRelay) -- this repo already has a real, proven, hash-verified LAN
 * transport (MnemosyneC's Federation/MIC layer, MESH_6_RECEIPT_BP063 + the BP131 3-machine
 * mesh runs) that the Founder is considering wiring to this SAME payload/receive-side logic
 * later, for an enterprise/LAN-only case. This interface exists so that day's change is
 * "write a second implementation and pick one at the call site," not a rewrite of the payload
 * shape, validation, or receive-side hook -- see bishop_dispatch_handler.ts's own note on why
 * the security guardrails there are carrier-blind by construction (LAN is a latency
 * optimization, never a trust boundary; a LAN implementation of this interface would still need
 * to produce a cryptographically verified origin peer id, not merely "arrived from this
 * subnet"). Deliberately NOT a plugin registry or config-driven carrier selection -- one
 * interface, one implementation, nothing speculative beyond that.
 */
export interface BishopDispatchTransport {
  send(
    peer: ConstellationPeer,
    dispatchId: string,
    promptText: string,
    workingDir: string,
    selfPeerId: string,
  ): Promise<BishopDispatchSendResult>;
}

/**
 * Sends a Bishop-session dispatch (a HARDWIRE-24 cross-machine coordination unit, not an MC
 * question) to `peer` over the WAN relay. Seals with the same v2 relay encryption as
 * dispatchDomainViaRelay above (was encryptForRelay v1 until D-BP223-X043-007). As of D-BP156-M0-016 this does NOT reuse
 * postToRelayRouteWithFallback (that helper targets the wan-relay-route edge function, which
 * 400s without a hex_frame it never sends -- see postBishopDispatchRelayRoute's doc comment
 * above for the full finding); the encrypted envelope is instead INSERTed directly into
 * relay_routes via postBishopDispatchRelayRoute, mirroring the proven wan_dispatch.ts sender.
 * The only new code here beyond the payload shape itself is the machine-tag validation and
 * signing the plaintext with this machine's existing Thorax Ed25519 keypair (announce_frame.ts's
 * signAnnouncePayload, the SAME primitive peer_server.ts already uses to authenticate the LAN
 * /api/plow-domain path) before encrypting it.
 *
 * D-BP223-X043-007-RELAY-X25519 CORRECTION: the sentence that stood here said the v1 key
 * derivation (sha256(targetPeerId + ":thorax-relay-v1")) gave "confidentiality against the relay
 * operator". It did not: the peer id is public, so anyone with presence access could derive the
 * key. Sends now seal with v2 (sealRelayPayloadForPeer: X25519 key agreement with the recipient's
 * signed, verified relay key; relay_x25519.ts), which IS confidential against the relay operator
 * and anyone reading relay_routes. v2 still does not replace sender authentication: the Ed25519
 * signature above is
 * what actually proves origin; the receiver (bishop_dispatch_handler.ts) verifies it against a
 * previously-learned key for the claimed peer id where one exists, falling back to
 * trust-on-first-use exactly as resolvePlowDomainRequest() already does for the LAN path
 * (peer_server.ts) -- this is real authentication, but TOFU, not a full PKI. Combined with the
 * receiver's own hardcoded origin-peer-id allowlist (Founder-named M0 id), this is materially
 * stronger than an unauthenticated self-declared field, but it is not cryptographic proof
 * against a peer id learned for the first time from a malicious sender.
 */
export async function dispatchBishopDispatchViaRelay(
  peer: ConstellationPeer,
  dispatchId: string,
  promptText: string,
  workingDir: string,
  selfPeerId: string,
  /** D-BP223-X043-007: optional, tests only. Production uses sealRelayPayloadForPeer's defaults. */
  sealDeps?: SealDeps,
): Promise<BishopDispatchSendResult> {
  if (!isValidMachineTaggedDispatchId(dispatchId)) {
    return {
      ok: false,
      error: `dispatch id "${String(dispatchId)}" is not machine-tagged (HARDWIRE-24 Section 3 ` +
        `requires the form D-BP<n>-M<n>-<n>); refusing to send an untagged id`,
    };
  }

  const payload: BishopDispatchPayload = {
    kind: 'bishop_dispatch',
    dispatchId,
    promptText,
    workingDir,
    originPeerId: selfPeerId,
  };

  const signed = signAnnouncePayload(dispatchId, payload as unknown as Record<string, unknown>);
  // signAnnouncePayload fails soft (returns null) per its own doc comment -- falls back to an
  // unsigned plaintext JSON envelope rather than throwing. The receiver's own handler refuses
  // an unsigned/unverifiable bishop_dispatch outright (see bishop_dispatch_handler.ts) rather
  // than ever trusting an unsigned originPeerId claim for the auto-spawn decision.
  const plaintext = signed ? signed.signedHex : JSON.stringify(payload);

  // D-BP223-X043-007: v2 seal, replacing encryptForRelay(plaintext, peer.id) (public-id key).
  const sealed: SealResult = await sealRelayPayloadForPeer(plaintext, peer.id, { selfPeerId, ...sealDeps });
  if (!sealed.ok) {
    return { ok: false, error: `Thorax encrypt failed: ${sealed.error}` };
  }

  return postBishopDispatchRelayRoute(sealed.payloadEncrypted, peer.id, dispatchId, sealed.wire, selfPeerId);
}

/** The one implementation of BishopDispatchTransport that exists today. A caller that wants to
 *  stay carrier-agnostic (e.g. a future dispatcher that picks WAN vs LAN by peer locality, the
 *  same way dispatchDomainViaRelay's own sibling isLanPeer() check already does for the
 *  domain-plow path) should depend on the BishopDispatchTransport interface, not directly on
 *  dispatchBishopDispatchViaRelay -- so a second (LAN) implementation is additive later. */
export const wanRelayBishopDispatchTransport: BishopDispatchTransport = {
  send: dispatchBishopDispatchViaRelay,
};

export function generateWorkloadId(): string {
  return 'mic_' + randomBytes(6).toString('hex');
}

// ─── Greedy partition algorithm ───────────────────────────────────────────────

export function partitionWorkload(
  domains: string[],
  questionBanks: Record<string, string[]>,
  peers: ConstellationPeer[],
  selfId: string,
): DomainWorkUnit[] {
  const onlinePeers = peers.filter((p) => p.online);

  // Build worker roster (self + online peers)
  const workers: Array<{ id: string; load: number; installedDomains: string[] }> = [
    { id: selfId, load: 0, installedDomains: [] },
    ...onlinePeers.map((p) => ({
      id: p.id,
      load: 0,
      installedDomains: p.installedDomains,
    })),
  ];

  const units: DomainWorkUnit[] = [];

  for (const domain of domains) {
    // Pick worker with lowest effective load
    // Domain-Chocolate match: subtract 1 from effective load if domain is installed
    let bestWorker = workers[0]!;
    let bestEffectiveLoad =
      bestWorker.load - (bestWorker.installedDomains.includes(domain) ? 1 : 0);

    for (const worker of workers.slice(1)) {
      const effectiveLoad = worker.load - (worker.installedDomains.includes(domain) ? 1 : 0);
      if (effectiveLoad < bestEffectiveLoad) {
        bestWorker = worker;
        bestEffectiveLoad = effectiveLoad;
      }
    }

    bestWorker.load++;

    units.push({
      domain,
      questions: questionBanks[domain] ?? [],
      assignedTo: bestWorker.id,
      status: 'pending',
      ebletCount: 0,
      andonEvents: 0,
    });
  }

  return units;
}

// ─── Estimated wall-clock ─────────────────────────────────────────────────────

export function estimateWallClockMs(
  units: DomainWorkUnit[],
  peers: ConstellationPeer[],
  selfId: string,
): number {
  // Per-domain estimate: ~5 min per domain per machine (rough average at 100 q)
  const PER_DOMAIN_MS = 5 * 60 * 1000;
  const workerCount = 1 + peers.filter((p) => p.online).length;
  const maxDomainsPerWorker = Math.ceil(units.length / workerCount);
  return maxDomainsPerWorker * PER_DOMAIN_MS;
}

// ─── Dispatch single domain to peer ──────────────────────────────────────────
//
// BP084 SEG-2/SEG-5:
//   LAN peers (same /24 subnet) → direct HTTP POST to port 7474 (fast, no encryption)
//   WAN peers (different subnet) → Thorax-encrypted payload via Supabase relay-route
//
async function dispatchDomainToPeer(
  peer: ConstellationPeer,
  domain: string,
  questions: string[],
  payload: MicStartPayload,
): Promise<PeerPlowResult> {
  // WAN peers: route through relay with Thorax encryption
  if (!isLanPeer(peer.address)) {
    return dispatchDomainViaRelay(peer, domain, questions, payload);
  }

  // LAN peers: direct HTTP POST to peer_server port 7474
  const url = `http://${peer.address}/api/plow-domain`;
  try {
    // KN-BP144-16 Phase 1: sign the dispatch body with this machine's own Thorax Ed25519
    // keypair. sender_peer_id lets the receiver look up a previously-learned key for this
    // sender (constellation_discovery.ts's lookupKnownPeerPublicKey) instead of trusting only
    // the self-declared key embedded in this same frame. Falls back to the legacy flat body
    // ONLY if signing itself fails — the receiver's own opt-out setting (default: refuse)
    // governs whether that fallback is accepted, not this sender.
    const dispatchPayload = {
      domain,
      questions,
      ollamaBaseUrl: payload.ollamaBaseUrl ?? 'http://127.0.0.1:11434',
      model: payload.model ?? 'gemma4:12b',
      sender_peer_id: getStablePeerId(),
    };
    const signed = signAnnouncePayload(dispatchPayload.sender_peer_id, dispatchPayload);
    const requestBody = signed ? { signed_frame: signed.signedHex } : dispatchPayload;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30 * 60 * 1000), // 30 min timeout for a full domain
    });

    if (!res.ok) {
      return {
        peerId: peer.id,
        domain,
        ebletsWritten: 0,
        quarantined: 0,
        andonEvents: 0,
        status: 'red',
        error: `HTTP ${res.status}`,
      };
    }

    const data = (await res.json()) as {
      ebletsWritten?: number;
      quarantined?: number;
      andonEvents?: number;
      status?: 'green' | 'yellow' | 'red';
    };

    return {
      peerId: peer.id,
      domain,
      ebletsWritten: data.ebletsWritten ?? 0,
      quarantined: data.quarantined ?? 0,
      andonEvents: data.andonEvents ?? 0,
      status: data.status ?? 'yellow',
    };
  } catch (err) {
    return {
      peerId: peer.id,
      domain,
      ebletsWritten: 0,
      quarantined: 0,
      andonEvents: 0,
      status: 'red',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── MIC Orchestrator ─────────────────────────────────────────────────────────

export async function runMicPlow(
  payload: MicStartPayload,
  selfId: string,
  questionBanks: Record<string, string[]>,
  onProgress: (event: MicStatusEvent) => void,
  cancelToken: { cancelled: boolean },
  runSelfDomain: (domain: string, questions: string[]) => Promise<PeerPlowResult>,
): Promise<MicAggregatedResult> {
  const workloadId = generateWorkloadId();

  onProgress({ type: 'mic-start', workloadId, message: 'MIC: discovering Constellation peers…' });

  // 1. Discover peers
  const peers = await discoverPeers();
  const onlinePeers = peers.filter((p) => p.online);

  onProgress({
    type: 'peer-discovered',
    workloadId,
    message: `MIC: ${onlinePeers.length} online peers discovered`,
  });

  // 2. Partition domains
  const units = partitionWorkload(payload.domains, questionBanks, peers, selfId);
  const estimatedMs = estimateWallClockMs(units, peers, selfId);

  const workload: MicWorkload = {
    id: workloadId,
    micId: selfId,
    domains: units,
    peers,
    selfId,
    startTime: Date.now(),
    totalEblets: 0,
    status: 'dispatching',
    estimatedWallClockMs: estimatedMs,
  };

  onProgress({ type: 'workload-partitioned', workloadId, workload });

  // 3. Dispatch in parallel — self + peers
  const selfUnits = units.filter((u) => u.assignedTo === selfId);
  const peerUnits = units.filter((u) => u.assignedTo !== selfId);

  const selfResultPromises = selfUnits.map(async (unit) => {
    if (cancelToken.cancelled) return null;
    onProgress({ type: 'self-progress', workloadId, domain: unit.domain, message: `Running ${unit.domain} locally…` });
    return runSelfDomain(unit.domain, unit.questions);
  });

  const peerResultPromises = peerUnits.map(async (unit) => {
    if (cancelToken.cancelled) return null;
    const peer = peers.find((p) => p.id === unit.assignedTo);
    if (!peer) {
      // Peer vanished — fall back to self
      onProgress({ type: 'peer-failed', workloadId, peerId: unit.assignedTo ?? '?', domain: unit.domain, message: `Peer ${unit.assignedTo} not found — reassigning to self` });
      return runSelfDomain(unit.domain, unit.questions);
    }
    onProgress({ type: 'dispatch-sent', workloadId, peerId: peer.id, domain: unit.domain, message: `Dispatching ${unit.domain} to ${peer.name}…` });
    const result = await dispatchDomainToPeer(peer, unit.domain, unit.questions, payload);
    if (result.status === 'red' && result.error) {
      // Failure recovery: reassign to self
      onProgress({ type: 'peer-failed', workloadId, peerId: peer.id, domain: unit.domain, message: `${peer.name} failed for ${unit.domain}: ${result.error} — running locally as fallback` });
      return runSelfDomain(unit.domain, unit.questions);
    }
    onProgress({ type: 'peer-complete', workloadId, peerId: peer.id, domain: unit.domain });
    return result;
  });

  const allResults = await Promise.all([...selfResultPromises, ...peerResultPromises]);
  const validResults = allResults.filter((r): r is PeerPlowResult => r !== null);

  const selfResults = validResults.filter((r) => r.peerId === selfId);
  const peerResults = validResults.filter((r) => r.peerId !== selfId);

  const totalEbletsWritten = validResults.reduce((s, r) => s + r.ebletsWritten, 0);
  const totalQuarantined = validResults.reduce((s, r) => s + r.quarantined, 0);
  const totalAndonEvents = validResults.reduce((s, r) => s + r.andonEvents, 0);

  const overallStatus: MicAggregatedResult['overallStatus'] =
    totalEbletsWritten >= 5 ? 'GREEN' : totalEbletsWritten > 0 ? 'YELLOW' : 'RED';

  const aggregated: MicAggregatedResult = {
    workloadId,
    totalEbletsWritten,
    totalQuarantined,
    totalAndonEvents,
    peerResults,
    selfResults,
    overallStatus,
    completedAt: Date.now(),
  };

  onProgress({ type: 'complete', workloadId, result: aggregated });
  return aggregated;
}
