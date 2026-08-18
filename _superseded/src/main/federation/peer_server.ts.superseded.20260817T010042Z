/**
 * peer_server.ts — MnemosyneC v0.5.0 BP084 Peer HTTP Server
 *
 * Listens on port 7474, handles:
 *   GET  /api/heartbeat      → 200 OK (liveness check)
 *   GET  /api/info           → JSON peer info (installed domains, model, etc.)
 *   POST /api/plow-domain    → runs canonical_pipeline for one domain, returns result JSON
 *   POST /api/diagnosis/post → receives a Diagnosis post from Constellation
 *   POST /api/diagnosis/answer → receives a Diagnosis answer
 *
 * BP084 SEG-2: publishes peer presence to Supabase relay every 60 s
 *   for WAN NAT traversal (cross-NAT peers routed via wan-relay-route).
 * BP084 SEG-3: /api/info populated from ram_detector + chocolates registry.
 *
 * SCAFFOLD v0.4.0 — plain HTTP, no auth.
 * Full Thorax encryption applied to WAN relay payloads (SEG-5, mic_dispatcher).
 */

import http from 'http';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { app, BrowserWindow } from 'electron';
import type { IncomingMessage, ServerResponse } from 'http';
import { detectHardwareTier, getRecommendedModel, getCachedEffectiveModel } from '../hardware/ram_detector';
// BP135 Yoke #35: brain_registry.ts is the store ai-dispatch:query's real Ask handler reads via
// getActiveBrain() -- "the exact installed Ollama tag the user picked in ASK's model selector"
// (see ai_dispatch_ipc.ts). index.ts's WAN plow answer paths now honor this SAME store; presence
// must advertise it too, or peer_presence.capabilities.ollamaModel lies about what this peer
// actually answers with (broke the model-diversity mesh test's verification).
import { getActiveBrain, hasPersistedBrainChoice } from '../brain_registry/brain_registry';

/** Returns effective ollama model. Prefers the peer's own ASK-selector active local brain
 * (brain_registry.ts) over hardware-tier auto-detection, since that is the model that will
 * actually answer -- falls back to the right-size.json override / RAM-tier recommendation
 * when no local brain has been explicitly selected. hasPersistedBrainChoice() guards against
 * brain_registry.json's non-hardware-aware baked-in default ('gemma4-12b') being trusted on a
 * box that has never opened the Ask model picker -- common now that CleanShell un-routed
 * LeanAskTab/BrainSwapSelector (YOKE_35) -- which would otherwise silently reintroduce the
 * exact hardcoded-12b bug this fix exists to remove. */
function getEffectiveOllamaModel(): string | null {
  const activeBrain = hasPersistedBrainChoice() ? getActiveBrain() : undefined;
  if (activeBrain?.kind === 'local') return activeBrain.model_id;
  const cached = getCachedEffectiveModel();
  if (cached) return cached.model;
  return getRecommendedModel();
}

/** Returns whether an override is currently active. */
function isOverrideActive(): boolean {
  return getCachedEffectiveModel()?.overrideActive ?? false;
}
import type { MicStartPayload } from './mic_types';
import { getOrCreateKeypair } from '../thorax/ed25519_keypair';
import {
  collectPeerIdentity,
  collectLanAddresses,
  getArtifactServerPort,
} from '../identity/peerIdentityCollector';
import { getLBSession } from '../lb_auth';
import { getAnonKey, getAnonKeyHeaders } from '../shared/anon_key';
// KN-BP144-16 Phase 1: /api/plow-domain authentication (see that ticket's REPORT.md).
import { peekAnnouncePayload, verifyAnnounceFrame } from './announce_frame';
import { isUnauthenticatedLanDiscoveryAllowed } from './mesh_trust_settings';
import { lookupKnownPeerPublicKey } from './constellation_discovery';

export const PEER_SERVER_PORT = 7474;
const PRESENCE_INTERVAL_MS = 60_000;
// D6b: heartbeat_worker runs on 30s cadence (independent V8 isolate from relay-poll event loop)
const HEARTBEAT_WORKER_INTERVAL_MS = 30_000;
const LAN_REFRESH_MS = 60 * 60 * 1000;

let _server: http.Server | null = null;
let _presenceTimer: ReturnType<typeof setInterval> | null = null;
let _lanRefreshTimer: ReturnType<typeof setInterval> | null = null;
/** D6b — worker_threads heartbeat Worker; null until started */
let _heartbeatWorker: import('worker_threads').Worker | null = null;
/** BP104 D5b — cached LAN addresses; refreshed every 60 min */
let _cachedLanAddresses: string[] = [];

// Callback hooks (set by registerPeerServerHooks)
let _onPlowDomain: ((domain: string, questions: string[], ollamaBaseUrl: string, model: string) => Promise<{ ebletsWritten: number; quarantined: number; andonEvents: number; status: string }>) | null = null;
let _onDiagnosisPost: ((post: unknown) => Promise<void>) | null = null;
let _onDiagnosisAnswer: ((answer: unknown) => Promise<void>) | null = null;
let _onDiagnosisUpvote: ((data: unknown) => Promise<void>) | null = null;

// Presence config (set by startPeerServer caller)
let _peerId: string | null = null;
let _emailHash: string | null = null;
let _wanSoccerballId: string | null = null;
let _relaySessionId: string | null = null;
let _supabaseUrl: string | null = null;

// Tier returned by wan-relay-publish response ('base' | 'member' | 'unknown')
let _currentTier: string = 'unknown';

// BP132 Yoke #21 A2: Truth-Always diagnostic event channel — publishPresence() failures
// used to be a silent console.warn(); the renderer (and any support session) had no
// visibility at all into a degraded mesh. Broadcast structured failure detail instead.
export interface PeerServerDiagnosticEvent {
  kind: 'presence_publish_failed' | 'presence_publish_ok';
  message: string;
  httpStatus?: number;
  httpBody?: string;
  base?: string;
  at: string;
}

function broadcastDiagnosticEvent(event: PeerServerDiagnosticEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('peer-server:diagnostic', event);
    }
  }
}

/** Returns the membership tier last received from the WAN relay publish endpoint. */
export function getCurrentTier(): string {
  return _currentTier;
}

export function registerPeerServerHooks(hooks: {
  onPlowDomain?: typeof _onPlowDomain;
  onDiagnosisPost?: typeof _onDiagnosisPost;
  onDiagnosisAnswer?: typeof _onDiagnosisAnswer;
  onDiagnosisUpvote?: typeof _onDiagnosisUpvote;
}): void {
  if (hooks.onPlowDomain) _onPlowDomain = hooks.onPlowDomain;
  if (hooks.onDiagnosisPost) _onDiagnosisPost = hooks.onDiagnosisPost;
  if (hooks.onDiagnosisAnswer) _onDiagnosisAnswer = hooks.onDiagnosisAnswer;
  if (hooks.onDiagnosisUpvote) _onDiagnosisUpvote = hooks.onDiagnosisUpvote;
}

export function registerPresenceConfig(config: {
  peerId: string;
  emailHash: string | null;
  wanSoccerballId: string;
  relaySessionId: string;
  supabaseUrl: string;
}): void {
  _peerId = config.peerId;
  _emailHash = config.emailHash;
  _wanSoccerballId = config.wanSoccerballId;
  _relaySessionId = config.relaySessionId;
  _supabaseUrl = config.supabaseUrl;
}

// ─── Chocolates registry (SEG-3) ─────────────────────────────────────────────

/**
 * Returns list of installed domain names from the chocolates JSONL files.
 * Reads provenance fields like "starter_chocolate:math:v0.3.7" → "math".
 */
function getInstalledDomains(): string[] {
  const chocolatesDir = join(app.getAppPath(), 'resources', 'chocolates');
  const domains = new Set<string>();

  try {
    if (!existsSync(chocolatesDir)) return [];
    const files = readdirSync(chocolatesDir).filter((f) => f.endsWith('.jsonl'));
    for (const file of files) {
      try {
        const content = readFileSync(join(chocolatesDir, file), 'utf8');
        for (const line of content.split('\n')) {
          if (!line.trim()) continue;
          const provMatch = line.match(/"provenance":"[^:]+:([^:]+)/);
          if (provMatch && provMatch[1]) {
            domains.add(provMatch[1]);
          }
        }
      } catch {
        // Skip unreadable file
      }
    }
  } catch {
    // Return empty on any error
  }

  return [...domains].sort();
}

// ─── Presence publishing (SEG-2) ─────────────────────────────────────────────

/**
 * Publishes this peer's presence to the Supabase relay for NAT traversal.
 * Called every 60 s while the server is running.
 */
function resolveLocalPublicKeyHex(): string | undefined {
  try {
    const { ensureLocalPeerKeypair } = require('../identity/localPeerKeypair') as typeof import('../identity/localPeerKeypair');
    return ensureLocalPeerKeypair().publicKeyHex;
  } catch {
    return undefined;
  }
}

async function publishPresence(): Promise<void> {
  if (!_peerId || !_supabaseUrl) return;

  const hwTier = detectHardwareTier();
  const installedDomains = getInstalledDomains();

  if (_cachedLanAddresses.length === 0) {
    _cachedLanAddresses = collectLanAddresses();
  }

  const localPublicKeyHex = resolveLocalPublicKeyHex();
  const memberEmail = getLBSession()?.email;
  const identityFields = collectPeerIdentity({
    peerId: _peerId,
    publicKeyHex: localPublicKeyHex,
    memberEmail,
    artifactServerPort: getArtifactServerPort(),
    lanAddressesOverride: _cachedLanAddresses,
  });

  const wanSid = identityFields.wan_soccerball_id ?? _wanSoccerballId;
  if (!wanSid || wanSid.length !== 32) {
    // BP132 Yoke #21 A3: this guard silently dropped every presence publish when
    // wan_soccerball_id was missing/malformed — surface it instead of a silent return.
    const failMsg = `presence publish skipped · wan_soccerball_id invalid (len=${wanSid?.length ?? 0}, expected 32)`;
    console.error(`[PeerServer] ${failMsg}`);
    broadcastDiagnosticEvent({
      kind: 'presence_publish_failed',
      message: failMsg,
      at: new Date().toISOString(),
    });
    return;
  }

  // MAMBA-beta3: Ed25519 Thorax PKI -- inject public_key_hex into peer capabilities
  let thoraxPublicKeyHex: string | undefined;
  try {
    thoraxPublicKeyHex = getOrCreateKeypair().public_key_hex;
  } catch {
    console.warn('[PeerServer] Thorax keypair unavailable -- publishing without public_key_hex');
  }

  const relayBase =
    (typeof process !== 'undefined' && process.env?.RELAY_BASE)
      ? process.env.RELAY_BASE
      : 'https://relay.lianabanyan.com/functions/v1';
  const relayBaseFallback = 'https://ruuxzilgmuwddcofqecc.supabase.co/functions/v1';

  console.log(`[D5] publishing presence: version=${app.getVersion()} peer_id=${_peerId?.slice(0, 8)}… machine_label=${identityFields.machine_label}`);

  const body = {
    v: 1,
    s: wanSid.slice(0, 32),
    p: [_peerId],
    b: {
      peerId: _peerId,
    },
    ts: Date.now(),
    peer_id: _peerId,
    version: app.getVersion(),
    machine_label: identityFields.machine_label,
    lan_addresses: identityFields.lan_addresses,
    email_hash: identityFields.email_hash ?? _emailHash ?? null,
    artifact_server_address: identityFields.artifact_server_address ?? undefined,
    relay_session_id: _relaySessionId ?? undefined,
    capabilities: {
      ollamaModel: getEffectiveOllamaModel(),
      overrideActive: isOverrideActive(),
      ramTier: hwTier.tier,
      ramGb: hwTier.ramGb,
      installedDomains,
      version: app.getVersion(),
      ...(thoraxPublicKeyHex !== undefined ? { public_key_hex: thoraxPublicKeyHex } : {}),
    },
  };

  const postBody = JSON.stringify(body);
  // BP132 Yoke #21 A2: return HTTP status + response body text on failure so the caller
  // can log/surface the real reason (edge-function rejection, 4xx validation error, network
  // failure, etc.) instead of a single opaque boolean. `httpStatus` is undefined only for a
  // true network-level failure (fetch threw before a response was received).
  const tryPublish = async (base: string): Promise<{ ok: boolean; tier?: string; httpStatus?: number; httpBody?: string; error?: string }> => {
    try {
      // BP132 Yoke #23 Task 6: this call previously sent NO apikey/Authorization header
      // at all, which every Supabase edge function with JWT verification enabled (the
      // default) rejects as 401 UNAUTHORIZED_NO_AUTH_HEADER before the handler even runs.
      // This is very likely THE reason peer_presence stayed at 0 rows across Yoke #21/#22.
      const res = await fetch(`${base}/wan-relay-publish`, {
        method: 'POST',
        headers: getAnonKeyHeaders({ 'Content-Type': 'application/json' }),
        body: postBody,
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        let bodyText = '';
        try { bodyText = await res.text(); } catch { /* ignore */ }
        return { ok: false, httpStatus: res.status, httpBody: bodyText.slice(0, 1000) };
      }
      try {
        const data = await res.json() as { ok?: boolean; tier?: string; peer_id?: string };
        return { ok: true, tier: data.tier, httpStatus: res.status };
      } catch {
        return { ok: true, httpStatus: res.status };
      }
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  };

  let result = await tryPublish(relayBase);
  let attemptedBase = relayBase;
  if (!result.ok) {
    result = await tryPublish(relayBaseFallback);
    attemptedBase = relayBaseFallback;
  }

  if (result.ok) {
    if (result.tier) _currentTier = result.tier;
    console.log(`[PeerServer] presence published: peer=${_peerId?.slice(0, 8)}… tier=${_currentTier} httpStatus=${result.httpStatus ?? 'n/a'}`);
    broadcastDiagnosticEvent({
      kind: 'presence_publish_ok',
      message: `presence published tier=${_currentTier}`,
      httpStatus: result.httpStatus,
      base: attemptedBase,
      at: new Date().toISOString(),
    });
  } else {
    // BP132 Yoke #21 A2: no more silent console.warn — log the exact HTTP status/body
    // (or network error) from the wan-relay-publish edge function and emit an IPC event
    // so the renderer / a support session can see WHY the mesh is degraded, not just THAT.
    const failMsg = result.httpStatus
      ? `presence publish failed · base=${attemptedBase} httpStatus=${result.httpStatus} body=${result.httpBody ?? ''}`
      : `presence publish failed · base=${attemptedBase} network_error=${result.error ?? 'unknown'}`;
    console.error(`[PeerServer] ${failMsg} · WAN routing degraded`);
    broadcastDiagnosticEvent({
      kind: 'presence_publish_failed',
      message: failMsg,
      httpStatus: result.httpStatus,
      httpBody: result.httpBody,
      base: attemptedBase,
      at: new Date().toISOString(),
    });
  }
}

// ─── Request helpers ──────────────────────────────────────────────────────────

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

interface PlowDomainRequestOk {
  ok: true;
  domain: string;
  questions: string[];
  ollamaBaseUrl?: string;
  model?: string;
}
interface PlowDomainRequestRefused {
  ok: false;
  status: number;
  error: string;
}

/**
 * KN-BP144-16 Phase 1: authenticates and extracts a /api/plow-domain request body.
 *
 * Two shapes are accepted:
 *  - { signed_frame: <hex> } — the current, signed shape. sender_peer_id and public_key_hex are
 *    read from the DECODED frame payload (announce_frame.ts), never from outside it. The public
 *    key used to verify is PREFERRED from this node's own previously-learned record for that
 *    sender_peer_id (constellation_discovery.ts's lookupKnownPeerPublicKey — populated only by a
 *    signature-verified UDP beacon), falling back to the self-declared key embedded in this same
 *    frame (trust-on-first-use) only when no previously-learned key exists. A signature that IS
 *    present and fails verification is ALWAYS refused — never gated by the opt-out below.
 *  - legacy flat { domain, questions, ollamaBaseUrl?, model? } — pre-KN-BP144-16 shape, accepted
 *    ONLY when isUnauthenticatedLanDiscoveryAllowed() is true (default false).
 */
// Exported (KN-BP144-16 Phase 1) purely so the real /api/plow-domain decision logic can be
// exercised through a real HTTP transport in a test harness without binding to the production
// PEER_SERVER_PORT (7474) — see KN-BP144-16_REPORT.md's FE-3 method note for why: this
// process's own real peer_server may already be running live on 7474 with the pre-Phase-1
// dist loaded in memory (Node does not hot-reload). No behavior change; handleRequest's own
// call site above is unchanged.
export function resolvePlowDomainRequest(body: string): PlowDomainRequestOk | PlowDomainRequestRefused {
  let outer: { signed_frame?: string; domain?: string; questions?: string[]; ollamaBaseUrl?: string; model?: string };
  try {
    outer = JSON.parse(body);
  } catch {
    return { ok: false, status: 400, error: 'request body is not valid JSON' };
  }

  if (typeof outer.signed_frame === 'string') {
    const peeked = peekAnnouncePayload(outer.signed_frame);
    if (!peeked) {
      return { ok: false, status: 400, error: 'signed_frame present but malformed (failed to decode)' };
    }
    const senderPeerId = typeof peeked.payload.sender_peer_id === 'string' ? peeked.payload.sender_peer_id : undefined;
    const knownKey = senderPeerId ? lookupKnownPeerPublicKey(senderPeerId) : undefined;
    const keyToVerify = knownKey ?? peeked.claimedPublicKeyHex;

    if (!keyToVerify) {
      return { ok: false, status: 403, error: 'refused: signed_frame carried no public_key_hex and no previously-known key exists for this sender' };
    }

    const verified = verifyAnnounceFrame(outer.signed_frame, keyToVerify);
    if (!verified.valid) {
      // A refused signature stays refused, unconditionally — never gated by the opt-out setting.
      return { ok: false, status: 403, error: `refused: ${verified.reason}` };
    }
    const vp = verified.payload as {
      domain?: string; questions?: string[]; ollamaBaseUrl?: string; model?: string;
    };
    if (typeof vp.domain !== 'string' || !Array.isArray(vp.questions)) {
      return { ok: false, status: 400, error: 'verified frame missing required domain/questions fields' };
    }
    return { ok: true, domain: vp.domain, questions: vp.questions, ollamaBaseUrl: vp.ollamaBaseUrl, model: vp.model };
  }

  // Legacy/unsigned shape.
  if (!isUnauthenticatedLanDiscoveryAllowed()) {
    return {
      ok: false,
      status: 403,
      error: 'refused: unsigned /api/plow-domain request and unauthenticated LAN dispatch is disabled by default (KN-BP144-16)',
    };
  }
  if (typeof outer.domain !== 'string' || !Array.isArray(outer.questions)) {
    return { ok: false, status: 400, error: 'request missing required domain/questions fields' };
  }
  return { ok: true, domain: outer.domain, questions: outer.questions, ollamaBaseUrl: outer.ollamaBaseUrl, model: outer.model };
}

function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = req.url ?? '';
  const method = req.method ?? 'GET';

  // Heartbeat
  if (url === '/api/heartbeat' && method === 'GET') {
    sendJson(res, 200, { ok: true, version: app.getVersion(), ts: Date.now() });
    return;
  }

  // Info (SEG-3: populated from ram_detector + chocolates registry)
  if (url === '/api/info' && method === 'GET') {
    const hwTier = detectHardwareTier();
    const installedDomains = getInstalledDomains();
    sendJson(res, 200, {
      id: _peerId ?? 'self',
      name: 'MnemosyneC Peer',
      version: app.getVersion(),
      ollamaModel: getEffectiveOllamaModel(),
      ramTier: hwTier.tier,
      ramGb: hwTier.ramGb,
      installedDomains,
      capabilities: {
        ollamaModel: getEffectiveOllamaModel(),
        overrideActive: isOverrideActive(),
        ramTier: hwTier.tier,
        ramGb: hwTier.ramGb,
        installedDomains,
        version: app.getVersion(),
      },
    });
    return;
  }

  // Plow domain
  if (url === '/api/plow-domain' && method === 'POST') {
    if (!_onPlowDomain) {
      sendJson(res, 503, { error: 'Plow domain handler not registered' });
      return;
    }
    try {
      const body = await readBody(req);
      const resolved = resolvePlowDomainRequest(body);
      if (!resolved.ok) {
        console.warn(`[PeerServer] REFUSED /api/plow-domain: ${resolved.error}`);
        sendJson(res, resolved.status, { error: resolved.error });
        return;
      }
      const { domain, questions, ollamaBaseUrl, model } = resolved;
      const result = await _onPlowDomain(
        domain,
        questions,
        ollamaBaseUrl ?? 'http://127.0.0.1:11434',
        model ?? getEffectiveOllamaModel() ?? getRecommendedModel() ?? 'llama3.3:70b',
      );
      sendJson(res, 200, result);
    } catch (err) {
      sendJson(res, 500, { error: String(err) });
    }
    return;
  }

  // Diagnosis: post
  if (url === '/api/diagnosis/post' && method === 'POST') {
    if (!_onDiagnosisPost) {
      sendJson(res, 503, { error: 'Diagnosis post handler not registered' });
      return;
    }
    try {
      const body = await readBody(req);
      await _onDiagnosisPost(JSON.parse(body));
      sendJson(res, 200, { ok: true });
    } catch (err) {
      sendJson(res, 500, { error: String(err) });
    }
    return;
  }

  // Diagnosis: answer
  if (url === '/api/diagnosis/answer' && method === 'POST') {
    if (!_onDiagnosisAnswer) {
      sendJson(res, 503, { error: 'Diagnosis answer handler not registered' });
      return;
    }
    try {
      const body = await readBody(req);
      await _onDiagnosisAnswer(JSON.parse(body));
      sendJson(res, 200, { ok: true });
    } catch (err) {
      sendJson(res, 500, { error: String(err) });
    }
    return;
  }

  // Diagnosis: upvote
  if (url === '/api/diagnosis/upvote' && method === 'POST') {
    if (!_onDiagnosisUpvote) {
      sendJson(res, 503, { error: 'Diagnosis upvote handler not registered' });
      return;
    }
    try {
      const body = await readBody(req);
      await _onDiagnosisUpvote(JSON.parse(body));
      sendJson(res, 200, { ok: true });
    } catch (err) {
      sendJson(res, 500, { error: String(err) });
    }
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
}

export function startPeerServer(): void {
  if (_server) {
    console.log('[PeerServer] Already running on port', PEER_SERVER_PORT);
    return;
  }

  _server = http.createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      console.error('[PeerServer] Unhandled request error:', err);
      try {
        sendJson(res, 500, { error: 'Internal server error' });
      } catch {
        // Response may already be sent
      }
    });
  });

  _server.listen(PEER_SERVER_PORT, '0.0.0.0', () => {
    console.log(`[PeerServer] v0.5.0 BP084 listening on :${PEER_SERVER_PORT}`);
    _cachedLanAddresses = collectLanAddresses();
    // BP104 D5b: refresh LAN addresses every 60 min for next heartbeat upsert
    if (_lanRefreshTimer) clearInterval(_lanRefreshTimer);
    _lanRefreshTimer = setInterval(() => {
      _cachedLanAddresses = collectLanAddresses();
    }, LAN_REFRESH_MS);
    // BP084 SEG-2: start presence publishing loop (full identity payload every 60s)
    publishPresence().catch(console.warn);
    _presenceTimer = setInterval(() => {
      publishPresence().catch(console.warn);
    }, PRESENCE_INTERVAL_MS);

    // D6b: spawn independent worker_threads heartbeat — separate V8 isolate so it
    // survives relay-poll main-thread hang (prevents "peer looks alive but can't answer" lie)
    if (_peerId && _supabaseUrl) {
      try {
        const { Worker } = require('worker_threads') as typeof import('worker_threads');
        const { join: pathJoin } = require('path') as typeof import('path');
        const workerPath = pathJoin(__dirname, 'heartbeat_worker.js');
        const relayBase = (typeof process !== 'undefined' && process.env?.RELAY_BASE)
          ? process.env.RELAY_BASE
          : 'https://relay.lianabanyan.com/functions/v1';
        const relayBaseFallback = 'https://ruuxzilgmuwddcofqecc.supabase.co/functions/v1';
        const supabaseAnonKey = getAnonKey();
        _heartbeatWorker = new Worker(workerPath, {
          workerData: {
            supabaseUrl: _supabaseUrl,
            supabaseAnonKey,
            peerId: _peerId,
            version: app.getVersion(),
            relayBase,
            relayBaseFallback,
            intervalMs: HEARTBEAT_WORKER_INTERVAL_MS,
          },
        });
        _heartbeatWorker.on('error', (err) => {
          console.warn('[PeerServer] heartbeat_worker error:', err.message);
        });
        _heartbeatWorker.on('exit', (code) => {
          if (code !== 0) console.warn(`[PeerServer] heartbeat_worker exited with code ${code}`);
          _heartbeatWorker = null;
        });
        console.log('[PeerServer] D6b heartbeat_worker started — independent V8 isolate');
      } catch (err) {
        console.warn('[PeerServer] D6b heartbeat_worker spawn failed (non-fatal — falling back to main-thread heartbeat):', err);
      }
    }
  });

  _server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[PeerServer] Port ${PEER_SERVER_PORT} already in use — skipping start`);
    } else {
      console.error('[PeerServer] Server error:', err);
    }
    _server = null;
  });
}

export function stopPeerServer(): void {
  if (_lanRefreshTimer) {
    clearInterval(_lanRefreshTimer);
    _lanRefreshTimer = null;
  }
  if (_presenceTimer) {
    clearInterval(_presenceTimer);
    _presenceTimer = null;
  }
  // D6b: gracefully stop heartbeat_worker
  if (_heartbeatWorker) {
    try { _heartbeatWorker.postMessage({ type: 'stop' }); } catch { /* ignore */ }
    _heartbeatWorker = null;
  }
  if (_server) {
    _server.close(() => { console.log('[PeerServer] Stopped.'); });
    _server = null;
  }
}
