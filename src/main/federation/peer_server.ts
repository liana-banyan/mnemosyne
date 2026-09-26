/**
 * peer_server.ts — MnemosyneC v0.5.0 BP084 Peer HTTP Server
 *
 * Listens on port 7474, handles:
 *   GET  /api/heartbeat      → 200 OK (liveness check)
 *   GET  /api/info           → JSON peer info (installed domains, model, etc.)
 *   POST /api/plow-domain    → runs canonical_pipeline for one domain, returns result JSON
 *   POST /api/diagnosis/post → receives a Diagnosis post from Constellation
 *   POST /api/diagnosis/answer → receives a Diagnosis answer
 *   POST /api/library/search → D-BP223-BM0-X029-007: signed; lists mesh-shared Hollerith card eblets by tag/keyword/connector,
 *                              with a manifest signed by this node's Thorax key
 *   POST /api/library/fetch  → D-BP223-BM0-X029-007: signed; returns those eblets by hex connector (Alexandrian copy)
 *
 * BP084 SEG-2: publishes peer presence to Supabase relay every 60 s
 *   for WAN NAT traversal (cross-NAT peers routed via wan-relay-route).
 * BP084 SEG-3: /api/info populated from ram_detector + chocolates registry.
 *
 * SCAFFOLD v0.4.0 — plain HTTP, no auth. SUPERSEDED BY D-BP223-BM0-X030-073 P2 (XO X030 pick on Founder k/0a8d1c96):
 *   every route on port 7474 now requires a signed Thorax frame (POST: body {signed_frame}; GET /api/info: header
 *   x-mnem-signed-frame whose payload names route "/api/info" and a fresh issued_ms), EXCEPT the minimal unauthenticated
 *   health ping GET /api/heartbeat, which returns {"ok":true} and no machine details. An unsigned request is refused 403
 *   on every other route, whatever isUnauthenticatedLanDiscoveryAllowed() says. The bind stays 0.0.0.0 (LAN), because
 *   the mesh needs it.
 * D-BP223-BM0-X030-073 P1: the relay beacon (presence publish + heartbeat worker) runs only while "Share presence with my
 *   other machines" is on (presence_share_settings.ts), and its email_hash is a per-install salted hash
 *   (beacon_email_hash.ts); the salt is never sent.
 * Full Thorax encryption applied to WAN relay payloads (SEG-5, mic_dispatcher).
 */

import http from 'http';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { app, BrowserWindow } from 'electron';
import type { IncomingMessage, ServerResponse } from 'http';
import { detectHardwareTier, getRecommendedModel, getCachedEffectiveModel, applyVramGate, requiredVramGb, detectVramGbDetailed, type VramDetectionResult } from '../hardware/ram_detector';
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

// ── D-BP157-029/BISHOP/seg-rewire-vram-gate: VRAM gate consultation for /api/plow-domain ──────
//
// The old chain was `model ?? getEffectiveOllamaModel() ?? getRecommendedModel() ?? 'llama3.3:70b'`
// -- the WAN peer's caller-supplied `model` field (a sender's explicit choice) is authoritative
// and is honored as-is even if it does not fit (mirrors ai_dispatch_ipc.ts's model_override
// precedence). getEffectiveOllamaModel()'s own persisted-brain preference is machine-made/
// possibly-stale (see that function's own doc comment above), so when no explicit model arrives
// the resolved candidate is validated against detected VRAM and may be stepped down. Nothing is
// written back to brain_registry.json/right-size.json here -- only the in-memory model used to
// answer THIS request. Unknown VRAM permits-and-records, same policy as ai_dispatch_ipc.ts.
export interface VramGateOutcome {
  model: string;
  requestedModel: string;
  wasExplicit: boolean;
  downgraded: boolean;
  vramGb: number | null;
  vramMethod: string;
  vramConfidence: string;
  requiredVramGbForRequested: number | null;
  note?: string;
}

// Same rationale as ai_dispatch_ipc.ts's cache: VRAM is static per session; detectVramGbDetailed()
// execSyncs a PowerShell registry query on Windows and must not run synchronously on every single
// /api/plow-domain WAN request. Cached once per process (ram_detector.ts is not editable by this
// dispatch -- see its own _cachedEffectiveModel for the same pattern one layer down).
let _cachedVramDetectionForPlow: VramDetectionResult | null = null;
function getCachedVramDetectionForPlow(): VramDetectionResult {
  if (_cachedVramDetectionForPlow === null) {
    _cachedVramDetectionForPlow = detectVramGbDetailed();
  }
  return _cachedVramDetectionForPlow;
}

/** `detector` is injectable so the test suite stays offline (peer_server.plow_domain.test.ts). */
export function resolveVramGatedPlowModel(
  requestedModel: string,
  wasExplicit: boolean,
  detector: () => VramDetectionResult = getCachedVramDetectionForPlow,
): VramGateOutcome {
  const detailed = detector();
  const required = requiredVramGb(requestedModel);

  if (wasExplicit) {
    let note: string | undefined;
    if (required !== null && detailed.vramGb !== null && detailed.vramGb < required) {
      note = `Explicit /api/plow-domain "model" field "${requestedModel}" needs ~${required} GB VRAM; detected VRAM ${detailed.vramGb} GB (method=${detailed.method}, confidence=${detailed.confidence}) is insufficient -- honoring the explicit pick anyway, expect CPU-split slowdown`;
    }
    return {
      model: requestedModel, requestedModel, wasExplicit: true, downgraded: false,
      vramGb: detailed.vramGb, vramMethod: detailed.method, vramConfidence: detailed.confidence,
      requiredVramGbForRequested: required, note,
    };
  }

  const gated = applyVramGate(requestedModel, detailed.vramGb);
  const chosen = gated.model ?? requestedModel;
  return {
    model: chosen, requestedModel, wasExplicit: false, downgraded: chosen !== requestedModel,
    vramGb: detailed.vramGb, vramMethod: detailed.method, vramConfidence: detailed.confidence,
    requiredVramGbForRequested: required, note: gated.note,
  };
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
import { peekAnnouncePayload, verifyAnnounceFrame, signAnnouncePayload } from './announce_frame';
// D-BP223-BM0-X029-007-MESH-CARDS-M2: the Alexandrian Library copy for Hollerith cards (POST /api/library/search,
// POST /api/library/fetch). Pure module; this file only injects userData, this node's key and the key resolution below.
import { handleLibraryRoute, pushEbletToPeer, type LibraryRouteContext, type PushReceipt } from './hollerith_library_share';
// D-BP223-PQ005-012-X041: the fourth consent (an offered card landing here) and the TRAIL-hop signer for accepted offers.
import { offerConsentFromSettings } from './share_receive_consent';
import { signerFromKeypair, type TagSigner } from './eblet_provenance_tags';
import { loadSavedPeers } from './constellation_discovery';
import { appendFileSync, mkdirSync } from 'fs';
import { isUnauthenticatedLanDiscoveryAllowed } from './mesh_trust_settings';
// D-BP223-BM0-X030-073 P1: salted beacon email hash + the one presence switch.
import { beaconEmailHashOrNull } from '../identity/beacon_email_hash';
import { resolvePresenceShare, setSharePresenceChoice, type PresenceShareState } from './presence_share_settings';
// D-BP202-BM02-002. mesh_remote_admin_consent.ts's own header (D-BP202-M0-01-h2cbp8us-001) names
// THIS as its enforcement point: "This machine's declared answer to 'may another machine
// administer me' is published on peer_server's /api/info as `remoteAdminConsent`." That claim was
// not yet true when this dispatch read the file -- no import, no field, verified by grep before
// this line was added. Wired now, mirroring how isUnauthenticatedLanDiscoveryAllowed() above is
// imported and read into the same /api/info payload for the same reason (a peer must be able to
// read this machine's own declared posture, not infer it).
import { isRemoteAdministrationConsentGranted } from './mesh_remote_admin_consent';
import { lookupKnownPeerPublicKey } from './constellation_discovery';
// D-BP223-BM0-X010-004-MESHPLUMB: the enrollment registry gate. See resolveEnrolledSenderKey()
// below for how this is layered onto the pre-existing trust-on-first-use resolution rather than
// replacing it outright.
import { lookupEnrolledPeerPublicKey, lookupEnrolledPeerOwnerId } from '../thorax/peer_enrollment_registry';
// D-BP156-M0-008: HARDWIRE-24 mesh, Bishop-dispatch payload variant (a second wan-relay-route
// payload shape, sibling to the domain-plow shape mic_dispatcher.ts already sends).
import {
  decryptFromRelay,
  isValidMachineTaggedDispatchId,
  type BishopDispatchPayload,
} from './mic_dispatcher';

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
// D-BP202-BM02-007 Part B: read-back hook -- given a caller-supplied id, reports whether the
// corresponding diagnosis artifact exists on disk plus its byte length and sha256, never the
// content itself (registered by diagnosis_ipc.ts, backed by diagnosis_engine.ts's
// checkDiagnosisArtifact()).
let _onDiagnosisVerify: ((id: string) => Promise<{ exists: boolean; byteLength: number | null; sha256: string | null }>) | null = null;
// D-BP156-M0-008: sibling hook to _onPlowDomain above, for HARDWIRE-24 Bishop-session mesh
// dispatches instead of Ollama MC-question plow runs. Same injection pattern, same
// "unregistered means refused, never silently no-op'd" convention as _onPlowDomain's own
// /api/plow-domain handler (see handleInboundBishopDispatchEnvelope below for the WAN-side
// caller; there is no LAN HTTP route for this one -- it only ever arrives via the relay).
let _onBishopDispatch: ((payload: BishopDispatchPayload, verifiedOriginPeerId: string | null, routeId?: string) => Promise<BishopDispatchResult>) | null = null;

// ─── D-BP157-023: the status vocabulary — SEG_RETURN_BP157_015's design, implemented ───────────
//
// `ok` (below) means ONLY "the message was received and handled" — TRANSPORT scope, unchanged
// from before this dispatch (peer_server.ts's own three genuine transport failures below already
// set it correctly; FD-BP157-06 retroactively ratifies that reading). Whether WORK happened is a
// SEPARATE pair of axes, per the Founder's own list ("work begun and work completed and work
// built and work wired in and work operating correctly or work issues follow"):
//   LIFECYCLE — did this dispatch's execution start/finish. Observed-only: every value below is
//   set from something that already happened (a process event, a file's presence), never from an
//   intention. See bishop_dispatch_handler.ts's evidence table (its own header comment) for
//   exactly which observer sets which value.
//   MATURITY — how durable/verified is the capability the dispatch produced. Deliberately NEVER
//   set by any automated code path in this mesh (grep confirms: no assignment to `maturity`
//   exists outside this type definition) — it is set only by whoever files the RETURNS document,
//   citing specific evidence for the rung claimed. Automating it is exactly the BP156 defect
//   ("built" read as "completed") this design exists to stop repeating.
export type WorkLifecycle = 'refused' | 'begun' | 'completed' | 'failed';
export type WorkMaturity = 'built' | 'wired_in' | 'operating_correctly';

/** A single falsifiable observation, always tied to the evidence it was read off of. Any
 *  observer (a guardrail, launchWorker's exit handler, a human filing a RETURNS doc) may append
 *  one; `issues` is never optional on `BishopDispatchResult` so a reader never has to guess
 *  whether an absent field means "checked, none found" or "never checked." */
export interface WorkIssue {
  code: string;
  message: string;
  evidence: string;
  observedAtUtc: string;
  observedBy: string;
}

/** Result of handing a verified (or refused) bishop_dispatch payload to the registered hook. */
export interface BishopDispatchResult {
  /** TRANSPORT ONLY: decoded/verified and handed to the hook without throwing. Never means "and
   *  the work succeeded" — see `lifecycle` for that. */
  ok: boolean;
  /** Set only when ok === false — the transport-level reason (hook unregistered, no peer id,
   *  decrypt failed, malformed envelope). */
  transportReason?: string;
  /** WORK axis 1 — see the module-level comment above and bishop_dispatch_handler.ts's own
   *  evidence table for exactly which observer sets which value. */
  lifecycle: WorkLifecycle;
  /** WORK axis 2 — applies only to code-change dispatches; set by a human/Bishop reviewer citing
   *  evidence, never by this mesh's own machinery. Absent when not yet assessed. */
  maturity?: WorkMaturity;
  /** Always present, `[]` when none — never an optional field a caller could use to dodge
   *  reporting a known issue. */
  issues: WorkIssue[];
  /** True only if a worker was actually spawned. False for a file-write-only outcome
   *  (unregistered hook, unverified sender, disallowed working dir, kill switch off, replay). */
  spawned: boolean;
  /** Legacy human-readable string, kept for existing readers that pattern-match on it. */
  reason: string;
  noticePath?: string;
  /** HARDWIRE-25 effective id (possibly "-W<n>"-suffixed) — needed to correlate a later
   *  stage-2/completion reply back to this stage-1/launch reply for the same underlying dispatch. */
  effectiveId?: string;
}

/** Builds a single-issue array for a transport-level (ok:false) failure below, so each of the
 *  six early-return sites states its own falsifiable code/evidence instead of a bare string. */
function transportIssue(code: string, message: string, evidence: string): WorkIssue[] {
  return [{ code, message, evidence, observedAtUtc: new Date().toISOString(), observedBy: 'handleInboundBishopDispatchEnvelope' }];
}

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
  onDiagnosisVerify?: typeof _onDiagnosisVerify;
  onBishopDispatch?: typeof _onBishopDispatch;
}): void {
  if (hooks.onPlowDomain) _onPlowDomain = hooks.onPlowDomain;
  if (hooks.onDiagnosisPost) _onDiagnosisPost = hooks.onDiagnosisPost;
  if (hooks.onDiagnosisAnswer) _onDiagnosisAnswer = hooks.onDiagnosisAnswer;
  if (hooks.onDiagnosisUpvote) _onDiagnosisUpvote = hooks.onDiagnosisUpvote;
  if (hooks.onDiagnosisVerify) _onDiagnosisVerify = hooks.onDiagnosisVerify;
  if (hooks.onBishopDispatch) _onBishopDispatch = hooks.onBishopDispatch;
}

/**
 * D-BP156-M0-008: the WAN-side entry point for an inbound bishop_dispatch payload -- there is
 * no LAN HTTP route for this (unlike /api/plow-domain), because HARDWIRE-24's design targets
 * the WAN relay specifically (the Founder ruled out the LAN/SMB transport, see this dispatch's
 * ticket). A poller that reads a real inbound wan-relay-route payload for this peer (not built
 * by this dispatch -- see the Yoke-return's honest "what remains unwired" note) calls this
 * function with the raw `payload_encrypted` string it received.
 *
 * Decrypts, then verifies the Ed25519 signature the sender attached via signAnnouncePayload
 * (announce_frame.ts) using the SAME trust-on-first-use policy peer_server.ts already applies
 * to the LAN /api/plow-domain path (resolvePlowDomainRequest, above): prefer a previously
 * learned key for the claimed peer id, fall back to the self-declared key embedded in this
 * same frame only when no previously-learned key exists. An unsigned payload (signAnnouncePayload
 * failed soft on the sender side) or a payload whose signature fails verification is passed to
 * the hook with `verifiedOriginPeerId: null` -- the hook (bishop_dispatch_handler.ts) is
 * responsible for refusing to spawn on an unverified origin; this function does not refuse on
 * the caller's behalf because a file-write-only audit record is still valuable even for an
 * unverified sender (see HARDWIRE-24 Section 8, "a return filed is a claim, not a fact").
 */
export async function handleInboundBishopDispatchEnvelope(
  payloadEncrypted: string,
  routeId?: string,
): Promise<BishopDispatchResult> {
  if (!_onBishopDispatch) {
    const reason = 'onBishopDispatch handler not registered';
    return { ok: false, transportReason: reason, lifecycle: 'failed', issues: transportIssue('HOOK_NOT_REGISTERED', reason, 'peer_server.ts:_onBishopDispatch is null'), spawned: false, reason };
  }

  const selfId = _peerId ?? undefined;
  if (!selfId) {
    const reason = 'this peer has no registered peer id (registerPresenceConfig not called yet)';
    return { ok: false, transportReason: reason, lifecycle: 'failed', issues: transportIssue('NO_SELF_PEER_ID', reason, 'peer_server.ts:_peerId is null'), spawned: false, reason };
  }

  let plaintext: string;
  try {
    plaintext = await decryptFromRelay(payloadEncrypted, selfId);
  } catch (err) {
    const reason = `decrypt failed: ${err instanceof Error ? err.message : String(err)}`;
    return { ok: false, transportReason: reason, lifecycle: 'failed', issues: transportIssue('DECRYPT_FAILED', reason, `selfId=${selfId}`), spawned: false, reason };
  }

  // The plaintext is either a signed announce frame (peekAnnouncePayload succeeds) or, if the
  // sender's signAnnouncePayload failed soft, a bare JSON envelope. Try signed first.
  let rawPayload: Record<string, unknown> | null = null;
  let verifiedOriginPeerId: string | null = null;

  const peeked = peekAnnouncePayload(plaintext);
  if (peeked) {
    const claimedOrigin = typeof peeked.payload.originPeerId === 'string' ? peeked.payload.originPeerId : undefined;
    // D-BP223-BM0-X010-004-MESHPLUMB: the WAN path. Same enrollment-first resolution as the LAN
    // signed_frame paths above -- see resolveEnrolledSenderKey()'s header comment. An ENROLLED
    // origin whose signature fails verification is refused outright below (never falls through
    // to a previously-learned or self-declared key); an UNENROLLED origin falls through to the
    // pre-existing TOFU resolution unchanged, preserving peer_server.bishop_dispatch.test.ts's
    // own "(TOFU)"-labeled test.
    const enrolled = claimedOrigin ? resolveEnrolledSenderKey(claimedOrigin) : { key: null, reason: 'no originPeerId in frame' };
    const knownKey = claimedOrigin ? lookupKnownPeerPublicKey(claimedOrigin) : undefined;
    const keyToVerify = enrolled.key ?? knownKey ?? peeked.claimedPublicKeyHex;
    if (keyToVerify) {
      const verified = verifyAnnounceFrame(plaintext, keyToVerify);
      if (verified.valid && verified.payload) {
        rawPayload = verified.payload;
        verifiedOriginPeerId = claimedOrigin ?? null;
      } else if (enrolled.key) {
        console.warn(`[PeerServer] REFUSED WAN bishop_dispatch: enrolled peer "${claimedOrigin}" failed signature check: ${verified.reason}`);
      }
    }
  }

  // Unsigned fallback -- only reached when peekAnnouncePayload/verifyAnnounceFrame did not
  // already produce a verified payload above. verifiedOriginPeerId stays null: the hook must
  // treat this exactly like a failed verification for spawn purposes.
  if (!rawPayload) {
    try {
      const parsed = JSON.parse(plaintext) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object') rawPayload = parsed;
    } catch {
      const reason = 'decrypted payload is neither a valid signed frame nor valid JSON';
      return { ok: false, transportReason: reason, lifecycle: 'failed', issues: transportIssue('UNPARSEABLE_PAYLOAD', reason, 'JSON.parse threw and peekAnnouncePayload found no signed frame'), spawned: false, reason };
    }
  }

  if (!rawPayload || rawPayload.kind !== 'bishop_dispatch') {
    const reason = 'decrypted payload is not a bishop_dispatch envelope';
    return { ok: false, transportReason: reason, lifecycle: 'failed', issues: transportIssue('WRONG_ENVELOPE_KIND', reason, `kind=${rawPayload ? String(rawPayload.kind) : 'null'}`), spawned: false, reason };
  }
  const dispatchId = rawPayload.dispatchId;
  const promptText = rawPayload.promptText;
  const workingDir = rawPayload.workingDir;
  const originPeerId = rawPayload.originPeerId;
  if (
    !isValidMachineTaggedDispatchId(dispatchId) ||
    typeof promptText !== 'string' ||
    typeof workingDir !== 'string' ||
    typeof originPeerId !== 'string'
  ) {
    const reason = 'bishop_dispatch envelope missing/malformed required fields';
    return { ok: false, transportReason: reason, lifecycle: 'failed', issues: transportIssue('MALFORMED_FIELDS', reason, `dispatchId=${String(dispatchId)} promptText=${typeof promptText} workingDir=${typeof workingDir} originPeerId=${typeof originPeerId}`), spawned: false, reason };
  }

  const payload: BishopDispatchPayload = { kind: 'bishop_dispatch', dispatchId, promptText, workingDir, originPeerId };
  return _onBishopDispatch(payload, verifiedOriginPeerId, routeId);
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
  // ── D-BP202-BM01-011. EVERY PACKAGED INSTALL REPORTED ZERO DOMAINS. ─────────────────────────
  //
  // MEASURED 2026-08-28. M2 (192.168.86.45) and M3 (192.168.86.156), both freshly installed from
  // MnemosyneC-Lean-Setup-0.9.27.exe, reported `installedDomains: []` over /api/info while M0 --
  // running the DEV tree -- reported all 19. The peers looked like empty brains for hours and the
  // estate planned around "M2 needs its library filled".
  //
  // THE DATA WAS NEVER MISSING. package.json's electron-builder config maps
  // `resources/chocolates -> chocolates` under extraResources, and the packaged output really does
  // contain all 16 .jsonl files. What was wrong was the LOOKUP:
  //
  //   dev       app.getAppPath() === the repo root, so repo/resources/chocolates EXISTS  -> 19 domains
  //   packaged  app.getAppPath() === .../resources/app.asar, so this looked for
  //             .../resources/app.asar/resources/chocolates, which cannot exist       -> []
  //
  // And because the miss lands on `if (!existsSync(...)) return []`, it fails SILENTLY: an
  // unreadable path is indistinguishable from a machine that genuinely has no domains. That is the
  // same silent-success class as a truncated seed that still announces itself.
  //
  // THE HOUSE PATTERN ALREADY EXISTED AND THIS FILE SIMPLY DID NOT USE IT. resolveBundledDatasetPath()
  // in liana_terminal_engine.ts and one_click_mmlu_pro.ts, resolveProvenanceDir() in
  // origin_provenance_store.ts, and chocolate_consolidator.ts all pair a packed branch with the dev
  // branch. I checked all five call sites that combine getAppPath() with 'resources': the other four
  // are CORRECT. This was the only one missing its packed half, so this is a one-site defect, not a
  // pattern to sweep.
  const packagedChocolates =
    typeof process !== 'undefined' && (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
      ? join((process as NodeJS.Process & { resourcesPath?: string }).resourcesPath!, 'chocolates')
      : null;
  const chocolatesDir =
    app.isPackaged && packagedChocolates
      ? packagedChocolates
      : join(app.getAppPath(), 'resources', 'chocolates');
  const domains = new Set<string>();

  try {
    if (!existsSync(chocolatesDir)) {
      // LAW 1: a negative must name its scope. "No chocolates directory" and "a directory holding
      // no domains" are different facts and used to be reported identically as []. Say which.
      console.warn(`[peer_server] getInstalledDomains: no chocolates directory at ${chocolatesDir} `
        + `(app.isPackaged=${app.isPackaged}) -- reporting NO domains, which may mean the path is `
        + `wrong rather than that none are installed. D-BP202-BM01-011.`);
      return [];
    }
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

/** D-BP223-BM0-X030-073 P1: the current state of "Share presence with my other machines". Never throws (fails OFF). */
export function getPresenceShareState(): PresenceShareState {
  let registryPath: string | null = null;
  try { registryPath = join(app.getPath('userData'), 'peer_enrollment_registry.json'); } catch { registryPath = null; }
  try {
    return resolvePresenceShare({ registryPath, selfOwnerId: _emailHash });
  } catch (err) {
    console.warn('[PeerServer] presence share state unreadable, beacon OFF:', err);
    return { enabled: false, source: 'default_not_same_owner_mesh', sameOwnerMesh: false, sameOwnerPeers: 0, label: 'Share presence with my other machines', settingsPath: '' };
  }
}

/** D-BP223-BM0-X030-073 P1: the ONE switch. Records the user's choice and applies it now (stops or starts the beacon). */
export function setPresenceSharing(enabled: boolean): PresenceShareState {
  setSharePresenceChoice(enabled);
  const state = getPresenceShareState();
  if (!state.enabled) {
    stopHeartbeatWorker();
    console.log('[PeerServer] presence sharing OFF: no presence publish, no heartbeat worker');
  } else if (_server) {
    startHeartbeatWorker();
    publishPresence().catch(console.warn);
  }
  return state;
}

let _presenceOffLogged = false;

/** Exported for tests and for the switch; the 60 s timer calls it too. */
export async function publishPresence(): Promise<void> {
  if (!_peerId || !_supabaseUrl) return;
  // D-BP223-BM0-X030-073 P1: nothing goes to the relay while the switch is off.
  if (!getPresenceShareState().enabled) {
    if (!_presenceOffLogged) { console.log('[PeerServer] presence publish skipped: "Share presence with my other machines" is off'); _presenceOffLogged = true; }
    return;
  }
  _presenceOffLogged = false;

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
    // D-BP223-BM0-X030-073 P1: per-install SALTED hash (salt local, never sent). Never the unsalted identityFields/_emailHash.
    email_hash: beaconEmailHashOrNull(memberEmail),
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

// ─── D-BP223-BM0-X010-004-MESHPLUMB: enrollment-registry gate ─────────────────────────────────
//
// THE FOUNDER'S ORDER, VERBATIM (k/c6cb1842): "peer_server.ts, discovery, and the WAN path
// remain exactly as open as before... plumb the signed-assertion gate into peer_server.ts,
// discovery and the WAN path." Every signed-frame path below used to resolve an unknown sender's
// verification key with lookupKnownPeerPublicKey() (constellation_discovery.ts's beacon-learned
// store, itself populated by trust-on-first-use) and, failing that, the SELF-DECLARED key
// embedded in the very frame being verified -- KN-BP144-16's own doc comments name this
// explicitly as "trust-on-first-use... callers should prefer [a previously-learned key] when
// available." That is not the gap this dispatch closes -- HARDWIRE-03's actual gap is that NO
// stronger tier existed at all.
//
// resolveEnrolledSenderKey() below adds exactly that stronger tier: peer_enrollment_registry.ts,
// populated only through enroll_peer_order.ts's TOTP-gated path. It is checked FIRST. An
// ENROLLED peer's signature is verified ONLY against its enrolled key -- a bad signature from an
// enrolled peer_id is now refused outright, fail-closed, regardless of what the frame
// self-declares. Two existing tests (peer_server.bishop_dispatch.test.ts's own "(TOFU)"-labeled
// case, and every legacy-unsigned-shape test in this file) exercise peers that are NEVER enrolled
// in any registry -- per this dispatch's own hard limit ("existing tests must still pass"), those
// paths are left running exactly as before by design: an UNENROLLED peer still falls through to
// the pre-existing TOFU/self-declared-key resolution, unchanged. This is a real, disclosed
// tension between "make the live mesh safer tonight" and "break nothing already shipped" --
// resolved here by making enrollment additive and strictly stronger than TOFU wherever it is
// used, rather than by weakening or removing TOFU for peers nobody has enrolled yet. See this
// dispatch's REPORT for the full statement of this tradeoff.
function resolveEnrolledSenderKey(peerId: string): { key: string | null; reason: string } {
  let registryPath: string;
  try {
    // `app` is already imported at module top (used throughout this file). Outside a real
    // Electron main process app.getPath() returns undefined (verified directly in this repo's
    // own peer_server.bishop_dispatch.test.ts header comment) -- join() then throws, caught
    // below, which is exactly the desired "cannot check -> refuse" outcome in that environment.
    registryPath = join(app.getPath('userData'), 'peer_enrollment_registry.json');
  } catch (err) {
    return {
      key: null,
      reason: `enrollment registry path unavailable (${err instanceof Error ? err.message : String(err)})`,
    };
  }
  const key = lookupEnrolledPeerPublicKey(registryPath, peerId);
  if (!key) {
    return { key: null, reason: `peer "${peerId}" is not in the enrollment registry (${registryPath})` };
  }
  return { key, reason: 'enrolled' };
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
    // D-BP223-BM0-X010-004-MESHPLUMB: the enrollment registry is checked FIRST and, when the
    // sender IS enrolled, is authoritative -- a bad signature from an enrolled peer_id is refused
    // here even if it happens to verify against a previously-learned or self-declared key. An
    // UNENROLLED sender falls through to the pre-existing resolution unchanged (see
    // resolveEnrolledSenderKey()'s own header comment for why).
    const enrolled = senderPeerId ? resolveEnrolledSenderKey(senderPeerId) : { key: null, reason: 'no sender_peer_id in frame' };
    const knownKey = senderPeerId ? lookupKnownPeerPublicKey(senderPeerId) : undefined;
    const keyToVerify = enrolled.key ?? knownKey ?? peeked.claimedPublicKeyHex;

    if (!keyToVerify) {
      return { ok: false, status: 403, error: 'refused: signed_frame carried no public_key_hex and no previously-known key exists for this sender' };
    }

    const verified = verifyAnnounceFrame(outer.signed_frame, keyToVerify);
    if (!verified.valid) {
      if (enrolled.key) {
        console.warn(`[PeerServer] REFUSED /api/plow-domain: enrolled peer "${senderPeerId}" failed signature check: ${verified.reason}`);
      }
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

export interface PlowDomainHttpResult {
  status: number;
  body: unknown;
}

/**
 * D-BP156-M0-014: the full resolve-and-dispatch behavior behind `/api/plow-domain` (hook-
 * registered check, auth/parse via resolvePlowDomainRequest, hook invocation), extracted so it
 * can be exercised through a real `registerPeerServerHooks({onPlowDomain})` registration in a
 * test without needing a live HTTP listener -- the same testability extraction this file
 * already applies to `handleInboundBishopDispatchEnvelope` (the WAN entry point) and
 * `resolvePlowDomainRequest` (the auth/parse step alone, which this function calls). No
 * behavior change versus the inline block this replaces: same status codes, same error
 * messages, same catch scope; `handleRequest`'s `/api/plow-domain` branch below now just reads
 * the body and forwards the result.
 */
export async function handlePlowDomainRequestBody(body: string): Promise<PlowDomainHttpResult> {
  if (!_onPlowDomain) {
    return { status: 503, body: { error: 'Plow domain handler not registered' } };
  }
  try {
    const resolved = resolvePlowDomainRequest(body);
    if (!resolved.ok) {
      console.warn(`[PeerServer] REFUSED /api/plow-domain: ${resolved.error}`);
      return { status: resolved.status, body: { error: resolved.error } };
    }
    const { domain, questions, ollamaBaseUrl, model } = resolved;
    // D-BP157-029/BISHOP/seg-rewire-vram-gate: `model` present in the request is the sender's
    // explicit pick (never downgraded); absent, the candidate is the persisted/auto chain below,
    // which IS validated against detected VRAM. See resolveVramGatedPlowModel's own doc comment.
    const wasExplicitPlowModel = typeof model === 'string' && model.length > 0;
    const preGatePlowModel = model ?? getEffectiveOllamaModel() ?? getRecommendedModel() ?? 'llama3.3:70b';
    const vramGate = resolveVramGatedPlowModel(preGatePlowModel, wasExplicitPlowModel);
    // D-BP223-BM0-X029-018 "You come first" (Founder k/0ee57a97): plow work for a peer is model work
    // on THIS person's machine. While they are using it, refuse politely with 503 + retry hint
    // (the work stays with the sender, nothing is lost); light serving on the GET routes is untouched.
    const { checkUserPrecedence } = await import('../user_precedence');
    const precedence = await checkUserPrecedence({ model: vramGate.model, ollamaUrl: ollamaBaseUrl ?? 'http://127.0.0.1:11434' });
    if (precedence.yield) {
      console.log(`[PeerServer] /api/plow-domain deferred: ${precedence.explanation}`);
      return { status: 503, body: { error: 'user_has_precedence', reasons: precedence.reasons, explanation: precedence.explanation, retry_after_s: 120 } };
    }
    if (vramGate.note) {
      // Not folded into the response body: the pre-existing hook-result shape is a stable
      // contract for federated_andon.ts/mic_dispatcher.ts callers and this dispatch's own
      // coordination note says change nothing not asked for -- logged as the legible record
      // instead (still never silent).
      console.warn(`[VramGate] /api/plow-domain: ${vramGate.note}`);
    }
    const result = await _onPlowDomain(
      domain,
      questions,
      ollamaBaseUrl ?? 'http://127.0.0.1:11434',
      vramGate.model,
    );
    return { status: 200, body: result };
  } catch (err) {
    return { status: 500, body: { error: String(err) } };
  }
}

// ─── D-BP202-BM02-007 Part A: diagnosis-route signature discipline ────────────────────────────
//
// MEASURED by D-BP202-BM02-004 and re-confirmed reading this file top-to-bottom before writing
// this function: /api/diagnosis/post, /api/diagnosis/answer and /api/diagnosis/upvote accepted
// caller-supplied JSON with NO authentication whatsoever, right beside /api/plow-domain which
// already does this correctly (resolvePlowDomainRequest, above). This function is that SAME
// pattern -- same two accepted shapes, same trust-on-first-use key resolution
// (lookupKnownPeerPublicKey preferred, self-declared key in the frame as fallback), same
// unconditional refusal of a signature that IS present and fails verification, same
// isUnauthenticatedLanDiscoveryAllowed() escape hatch for the legacy unsigned shape (default
// false = fail closed) -- deliberately NOT a second auth scheme. Unlike resolvePlowDomainRequest
// this has no opinion on the payload's shape (a DiagnosisPost vs. an answer vs. an upvote body
// vs. a verify-by-id request all differ) -- it hands back the verified inner payload object and
// leaves shape extraction to the caller, exactly the way verifyAnnounceFrame's own `payload`
// return already works for handleInboundBishopDispatchEnvelope above.
export interface SignedDiagnosisRequestOk {
  ok: true;
  payload: Record<string, unknown>;
}
export interface SignedDiagnosisRequestRefused {
  ok: false;
  status: number;
  error: string;
}

export function resolveSignedDiagnosisRequest(
  body: string,
): SignedDiagnosisRequestOk | SignedDiagnosisRequestRefused {
  let outer: { signed_frame?: string } & Record<string, unknown>;
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
    // D-BP223-BM0-X010-004-MESHPLUMB: same enrollment-first resolution as resolvePlowDomainRequest
    // above -- see resolveEnrolledSenderKey()'s header comment for the full rationale.
    const enrolled = senderPeerId ? resolveEnrolledSenderKey(senderPeerId) : { key: null, reason: 'no sender_peer_id in frame' };
    const knownKey = senderPeerId ? lookupKnownPeerPublicKey(senderPeerId) : undefined;
    const keyToVerify = enrolled.key ?? knownKey ?? peeked.claimedPublicKeyHex;

    if (!keyToVerify) {
      return { ok: false, status: 403, error: 'refused: signed_frame carried no public_key_hex and no previously-known key exists for this sender' };
    }

    const verified = verifyAnnounceFrame(outer.signed_frame, keyToVerify);
    if (!verified.valid) {
      if (enrolled.key) {
        console.warn(`[PeerServer] REFUSED diagnosis request: enrolled peer "${senderPeerId}" failed signature check: ${verified.reason}`);
      }
      // A refused signature stays refused, unconditionally -- never gated by the opt-out below.
      return { ok: false, status: 403, error: `refused: ${verified.reason}` };
    }
    if (!verified.payload) {
      return { ok: false, status: 400, error: 'signature verified but frame carried no payload' };
    }
    return { ok: true, payload: verified.payload };
  }

  // Legacy/unsigned shape -- accepted only when the Founder's single switch allows it, same as
  // /api/plow-domain. The whole body IS the payload here, matching the pre-D-BP202-BM02-007
  // behavior where the three diagnosis routes called _onDiagnosis*(JSON.parse(body)) directly.
  if (!isUnauthenticatedLanDiscoveryAllowed()) {
    return {
      ok: false,
      status: 403,
      error: 'refused: unsigned diagnosis request and unauthenticated LAN dispatch is disabled by default (D-BP202-BM02-007, mirrors KN-BP144-16)',
    };
  }
  return { ok: true, payload: outer };
}

function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

// ─── D-BP223-BM0-X030-073 P2: every route signed, except the minimal health ping ──────────────────────────────────────

/** Max age of a signed GET frame (replay window). */
export const SIGNED_GET_MAX_AGE_MS = 5 * 60 * 1000;
export const SIGNED_GET_HEADER = 'x-mnem-signed-frame';

type FrameCheck = { ok: true; payload: Record<string, unknown> } | { ok: false; status: number; error: string };

/** Verifies one signed Thorax frame with the same key tiers as every signed route: enrolled key, then a beacon-learned key,
 *  then the frame's self-declared key (trust on first use). */
export function verifySignedFrameHex(signedHex: string): FrameCheck {
  const peeked = peekAnnouncePayload(signedHex);
  if (!peeked) return { ok: false, status: 403, error: 'refused: signed frame malformed' };
  const senderPeerId = typeof peeked.payload.sender_peer_id === 'string' ? peeked.payload.sender_peer_id : undefined;
  const enrolled = senderPeerId ? resolveEnrolledSenderKey(senderPeerId) : { key: null, reason: 'no sender_peer_id' };
  const knownKey = senderPeerId ? lookupKnownPeerPublicKey(senderPeerId) : undefined;
  const keyToVerify = enrolled.key ?? knownKey ?? peeked.claimedPublicKeyHex;
  if (!keyToVerify) return { ok: false, status: 403, error: 'refused: signed frame carried no public key' };
  const verified = verifyAnnounceFrame(signedHex, keyToVerify);
  if (!verified.valid || !verified.payload) return { ok: false, status: 403, error: `refused: ${verified.reason ?? 'signature did not verify'}` };
  return { ok: true, payload: verified.payload };
}

/** POST routes: the body must carry a signed_frame that verifies. Unsigned is 403 regardless of any LAN setting. */
export function requireSignedBody(body: string): FrameCheck {
  let outer: { signed_frame?: unknown };
  try { outer = JSON.parse(body) as { signed_frame?: unknown }; } catch { return { ok: false, status: 403, error: 'refused: unsigned request (body is not a signed frame)' }; }
  if (!outer || typeof outer.signed_frame !== 'string') return { ok: false, status: 403, error: 'refused: unsigned request; every route on this port needs a signed frame (X030-073 P2)' };
  return verifySignedFrameHex(outer.signed_frame);
}

/** GET routes: header x-mnem-signed-frame, payload.route === the path, payload.issued_ms fresh. */
export function requireSignedGet(headers: IncomingMessage['headers'], route: string, nowMs: number = Date.now()): FrameCheck {
  const raw = headers[SIGNED_GET_HEADER];
  const hex = Array.isArray(raw) ? raw[0] : raw;
  if (typeof hex !== 'string' || !hex) return { ok: false, status: 403, error: `refused: unsigned request; send ${SIGNED_GET_HEADER} (X030-073 P2)` };
  const v = verifySignedFrameHex(hex);
  if (!v.ok) return v;
  if (v.payload.route !== route) return { ok: false, status: 403, error: 'refused: signed frame is for a different route' };
  const issued = Number(v.payload.issued_ms);
  if (!Number.isFinite(issued) || Math.abs(nowMs - issued) > SIGNED_GET_MAX_AGE_MS) return { ok: false, status: 403, error: 'refused: signed frame is stale or undated' };
  return v;
}

/** Exported for the X030-073 route tests; the live server calls it for every request. */
export async function handlePeerRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  return handleRequest(req, res);
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = req.url ?? '';
  const method = req.method ?? 'GET';

  // Health ping: the ONE unauthenticated route. No version, no time, no machine details (X030-073 P2).
  if (url === '/api/heartbeat' && method === 'GET') {
    sendJson(res, 200, { ok: true });
    return;
  }

  // Every POST route that is not the library pair is gated here, before any handler or registration check sees it.
  // D-BP223-PQ005-012-X041: /api/library/offer is the PUSH (one card offered to this node, landed only on consent).
  const SIGNED_POST_ROUTES = ['/api/plow-domain', '/api/diagnosis/post', '/api/diagnosis/answer', '/api/diagnosis/upvote', '/api/diagnosis/verify', '/api/library/search', '/api/library/fetch', '/api/library/offer'];
  let preReadBody: string | null = null;
  if (method === 'POST' && SIGNED_POST_ROUTES.includes(url)) {
    preReadBody = await readBody(req);
    const gate = requireSignedBody(preReadBody);
    if (!gate.ok) {
      console.warn(`[PeerServer] REFUSED ${url}: ${gate.error}`);
      sendJson(res, gate.status, { error: gate.error });
      return;
    }
  }

  // Info (SEG-3: populated from ram_detector + chocolates registry)
  if (url === '/api/info' && method === 'GET') {
    const gate = requireSignedGet(req.headers, '/api/info');
    if (!gate.ok) {
      console.warn(`[PeerServer] REFUSED /api/info: ${gate.error}`);
      sendJson(res, gate.status, { error: gate.error });
      return;
    }
    const hwTier = detectHardwareTier();
    const installedDomains = getInstalledDomains();
    // ── D-BP202-BM01-012. REPORT THE NUMBER THAT ACTUALLY DECIDES MODEL FIT. ────────────────────
    //
    // MEASURED 2026-08-28. /api/info reported `ramTier: "full", ramGb: 31.9` for BOTH M2 and M3.
    // That is SYSTEM RAM. Both machines have 8 GB of VRAM, and VRAM is what decides whether a model
    // loads onto the GPU at all. M2 ended up running gemma4:26b, which cannot fit: M0's gemma4:12b
    // was measured occupying 12.2 GB of VRAM against 7.0 GB on disk, so a 26b needs roughly 25 GB.
    // A reader of /api/info saw a plausible number that meant something else.
    //
    // NOTHING IS DETECTED FRESH HERE. detectVramGbDetailed() already lives in ram_detector.ts, is
    // ALREADY imported by this file for the /api/plow-domain gate, and already carries its own two
    // test suites. This only SURFACES what that gate was already deciding on, so a human, the seat
    // roster, or the pre-installer can see the deciding figure rather than infer it.
    //
    // ramTier/ramGb ARE LEFT EXACTLY AS THEY WERE, deliberately. They are honest about what they
    // are, and other callers already depend on them. The fix is not to redefine an existing field;
    // it is to stop that field being the only one visible.
    const vramDetail = detectVramGbDetailed();
    sendJson(res, 200, {
      id: _peerId ?? 'self',
      name: 'MnemosyneC Peer',
      version: app.getVersion(),
      ollamaModel: getEffectiveOllamaModel(),
      ramTier: hwTier.tier,
      ramGb: hwTier.ramGb,
      vramGb: vramDetail.vramGb,
      vramMethod: vramDetail.method,
      vramConfidence: vramDetail.confidence,
      installedDomains,
      // D-BP202-BM02-002. THE ENFORCEMENT POINT mesh_remote_admin_consent.ts's own header promised
      // and did not yet deliver. Fails closed like every other read of that module: a false here
      // (default, or any settings-read error) means an administering peer MUST NOT attempt lbmesh
      // / WinRM administration against this machine. This field being absent (an old build, pre
      // this dispatch) must ALSO be read as "not consented" by any caller -- never as consent by
      // omission. See mesh_remote_admin_consent.ts for the full statement of what this can and
      // cannot enforce (it cannot close an already-provisioned WinRM listener by itself).
      remoteAdminConsent: isRemoteAdministrationConsentGranted(),
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
    const body = preReadBody ?? await readBody(req);
    const { status, body: respBody } = await handlePlowDomainRequestBody(body);
    sendJson(res, status, respBody);
    return;
  }

  // Diagnosis: post — D-BP202-BM02-007 Part A: now runs through resolveSignedDiagnosisRequest
  // (same signature discipline as /api/plow-domain) before the hook ever sees the payload.
  if (url === '/api/diagnosis/post' && method === 'POST') {
    if (!_onDiagnosisPost) {
      sendJson(res, 503, { error: 'Diagnosis post handler not registered' });
      return;
    }
    const body = preReadBody ?? await readBody(req);
    const resolved = resolveSignedDiagnosisRequest(body);
    if (!resolved.ok) {
      console.warn(`[PeerServer] REFUSED /api/diagnosis/post: ${resolved.error}`);
      sendJson(res, resolved.status, { error: resolved.error });
      return;
    }
    try {
      // Part B: the hook now rethrows on a real write failure (diagnosis_ipc.ts) instead of
      // swallowing it -- this catch is what turns that into a truthful non-200 response.
      await _onDiagnosisPost(resolved.payload);
      sendJson(res, 200, { ok: true });
    } catch (err) {
      sendJson(res, 500, { ok: false, error: String(err) });
    }
    return;
  }

  // Diagnosis: answer — same discipline as /api/diagnosis/post above.
  if (url === '/api/diagnosis/answer' && method === 'POST') {
    if (!_onDiagnosisAnswer) {
      sendJson(res, 503, { error: 'Diagnosis answer handler not registered' });
      return;
    }
    const body = preReadBody ?? await readBody(req);
    const resolved = resolveSignedDiagnosisRequest(body);
    if (!resolved.ok) {
      console.warn(`[PeerServer] REFUSED /api/diagnosis/answer: ${resolved.error}`);
      sendJson(res, resolved.status, { error: resolved.error });
      return;
    }
    try {
      await _onDiagnosisAnswer(resolved.payload);
      sendJson(res, 200, { ok: true });
    } catch (err) {
      sendJson(res, 500, { ok: false, error: String(err) });
    }
    return;
  }

  // Diagnosis: upvote — same discipline as /api/diagnosis/post above.
  if (url === '/api/diagnosis/upvote' && method === 'POST') {
    if (!_onDiagnosisUpvote) {
      sendJson(res, 503, { error: 'Diagnosis upvote handler not registered' });
      return;
    }
    const body = preReadBody ?? await readBody(req);
    const resolved = resolveSignedDiagnosisRequest(body);
    if (!resolved.ok) {
      console.warn(`[PeerServer] REFUSED /api/diagnosis/upvote: ${resolved.error}`);
      sendJson(res, resolved.status, { error: resolved.error });
      return;
    }
    try {
      await _onDiagnosisUpvote(resolved.payload);
      sendJson(res, 200, { ok: true });
    } catch (err) {
      sendJson(res, 500, { ok: false, error: String(err) });
    }
    return;
  }

  // Diagnosis: verify — D-BP202-BM02-007 Part B. Read-back so a sender can confirm an artifact
  // actually landed instead of trusting an unconditional 200. Same auth discipline as the three
  // write routes above (same resolveSignedDiagnosisRequest). Returns ONLY existence + integrity
  // figures (byte length, sha256) -- never the stored content -- so it cannot be used to
  // exfiltrate substrate content off a peer.
  if (url === '/api/diagnosis/verify' && method === 'POST') {
    if (!_onDiagnosisVerify) {
      sendJson(res, 503, { error: 'Diagnosis verify handler not registered' });
      return;
    }
    const body = preReadBody ?? await readBody(req);
    const resolved = resolveSignedDiagnosisRequest(body);
    if (!resolved.ok) {
      console.warn(`[PeerServer] REFUSED /api/diagnosis/verify: ${resolved.error}`);
      sendJson(res, resolved.status, { error: resolved.error });
      return;
    }
    const id = resolved.payload.id;
    if (typeof id !== 'string' || id.length === 0) {
      sendJson(res, 400, { error: 'verified payload missing required string field "id"' });
      return;
    }
    try {
      const check = await _onDiagnosisVerify(id);
      sendJson(res, 200, check);
    } catch (err) {
      sendJson(res, 500, { error: String(err) });
    }
    return;
  }

  // D-BP223-BM0-X029-007: Hollerith card library (search by tag / keyword / hex connector, then fetch).
  // Signed requests only; same key resolution tiers as the routes above; only mesh_share + leak-clean eblets in
  // {userData}\eblets\hollerith are ever listed or served (see hollerith_library_share.ts header).
  const library = await handleLibraryRoute(url, method, () => (preReadBody != null ? Promise.resolve(preReadBody) : readBody(req)), libraryRouteContext());
  if (library) {
    if (library.status !== 200) console.warn(`[PeerServer] REFUSED ${url}: ${String(library.body.error ?? library.status)}`);
    sendJson(res, library.status, library.body);
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
}

/** D-BP223-BM0-X029-007: this node's peer id as registered by registerPresenceConfig (null before registration). */
export function getRegisteredPeerId(): string | null {
  return _peerId;
}

/** D-BP223-BM0-X029-007: the Hollerith silo inside the {userData}\eblets root mnem_eblet_store.ts already indexes. */
export function hollerithSiloDir(): string {
  return join(app.getPath('userData'), 'eblets', 'hollerith');
}

/** D-BP223-BM0-X030-207: ORIGIN / TRAIL / USE tag ledgers for the Hollerith silo (eblet_provenance_tags.ts). Beside the silo, not in it,
 *  so the silo's eblet index and the shareability listing never see a jsonl ledger. */
export function hollerithTagsDir(): string {
  return join(app.getPath('userData'), 'eblet_tags', 'hollerith');
}

function libraryRouteContext(): LibraryRouteContext {
  return {
    siloDir: hollerithSiloDir(),
    // X030-207: fetch serves each card's ORIGIN + TRAIL lines so provenance travels with the copy.
    tagsDir: hollerithTagsDir(),
    selfPeerId: _peerId ?? 'self',
    resolveSenderKey: (peerId: string) => {
      const enrolled = resolveEnrolledSenderKey(peerId);
      if (enrolled.key) return { key: enrolled.key, trust: 'enrolled' };
      const known = lookupKnownPeerPublicKey(peerId);
      return known ? { key: known, trust: 'known' } : null;
    },
    // Same trust-on-first-use tier the /api/diagnosis/* routes accept for a signed frame. The trust tier used is
    // returned to the requester (requester_trust) and recorded in its receipt, never hidden.
    allowSelfDeclaredKey: true,
    signPayload: (seed: string, payload: Record<string, unknown>) => signAnnouncePayload(seed, payload)?.signedHex ?? null,
    // D-BP223-BM0-X030-067 pick B (Founder k/dc99f6ff): same-owner is PERSON-level. This node's owner id is the LB session email
    // hash registered by registerPresenceConfig (null when not signed in, which shares no source_pending card to anyone). A
    // requester's owner id comes ONLY from its TOTP-gated enrollment record, never from IP, LAN or anything it claims.
    selfOwnerId: _emailHash,
    resolveSenderOwnerId: (peerId: string) => {
      try {
        return lookupEnrolledPeerOwnerId(join(app.getPath('userData'), 'peer_enrollment_registry.json'), peerId);
      } catch {
        return null;
      }
    },
    // D-BP223-PQ005-012-X041: the PUSH lands a card here only on this node's consent (share_receive_consent.ts, the fourth
    // consent: same owner accepts, an enrolled or known peer is held in the inbox for a person's press, a stranger is refused).
    offerConsent: offerConsentFromSettings(),
    inboxDir: hollerithInboxDir(),
    tagSigner: tagSignerForThisNode(),
  };
}

/** X041: offers held for a person's consent live beside the silo, never inside it (the silo index must never list them). */
export function hollerithInboxDir(): string {
  return join(app.getPath('userData'), 'eblet_inbox', 'hollerith');
}

/** X041: this node's TRAIL-hop signer (the same shape the pull uses on the requester side); null when no keypair is available. */
export function tagSignerForThisNode(): TagSigner | null {
  try {
    const kp = getOrCreateKeypair();
    return signerFromKeypair(_peerId ?? ('self-' + kp.public_key_hex.slice(-16)), kp.public_key_hex, kp.private_key_hex);
  } catch {
    return null;
  }
}

export interface PushEbletArgs {
  /** e.g. http://192.168.86.45:7474; when absent, peerId is resolved through the saved constellation peers (address = ip:port) */
  peerBaseUrl?: string;
  peerId?: string;
  connector?: string;
  file?: string;
  expectedReceiverKeyHex?: string | null;
}

/**
 * D-BP223-PQ005-012-X041: the one-click share, from THIS node. The MCP tool (mnem_share_eblet_to_peer, mode push) and the
 * renderer IPC (share:push-eblet) both call this; it signs with this node's Thorax key, offers the card, verifies the
 * receiver's signed receipt, and appends the receipt to {userData}\share_receipts\sent.jsonl (append-only, never rewritten).
 */
export async function pushEbletToPeerFromThisNode(args: PushEbletArgs): Promise<PushReceipt & { receiptPath: string | null; receiverKeyHex: string | null }> {
  let base = (args.peerBaseUrl ?? '').trim();
  let expectedKey: string | null = args.expectedReceiverKeyHex ?? null;
  if (!base && args.peerId) {
    const peer = loadSavedPeers().find((p) => p.id === args.peerId);
    if (!peer) throw new Error(`peer "${args.peerId}" is not among this node's saved constellation peers; pass peerBaseUrl`);
    base = /^https?:\/\//.test(peer.address) ? peer.address : `http://${peer.address}`;
    if (!expectedKey) expectedKey = resolveEnrolledSenderKey(peer.id).key ?? peer.public_key_hex ?? null;
  } else if (args.peerId && !expectedKey) {
    expectedKey = resolveEnrolledSenderKey(args.peerId).key ?? lookupKnownPeerPublicKey(args.peerId) ?? null;
  }
  if (!base) throw new Error('peerBaseUrl or a saved peerId is required');
  const selfId = _peerId ?? ('self-' + getOrCreateKeypair().public_key_hex.slice(-16));
  const receipt = await pushEbletToPeer({
    peerBaseUrl: base, senderPeerId: selfId, siloDir: hollerithSiloDir(), connector: args.connector, file: args.file,
    signPayload: (seed, payload) => signAnnouncePayload(seed, payload)?.signedHex ?? null,
    expectedReceiverKeyHex: expectedKey, ownerId: _emailHash, tagsDir: hollerithTagsDir(),
  });
  let receiptPath: string | null = null;
  try {
    const dir = join(app.getPath('userData'), 'share_receipts');
    mkdirSync(dir, { recursive: true });
    receiptPath = join(dir, 'sent.jsonl');
    appendFileSync(receiptPath, JSON.stringify({ ...receipt, receiver_key_hex: expectedKey }) + '\n', 'utf8');
  } catch (err) {
    console.warn('[PeerServer] share receipt not recorded:', err);
  }
  return { ...receipt, receiptPath, receiverKeyHex: expectedKey };
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

    // D-BP223-BM0-X030-073 P1: the heartbeat worker is part of the relay beacon; it runs only while the switch is on.
    if (getPresenceShareState().enabled) startHeartbeatWorker();
    else console.log('[PeerServer] heartbeat worker not started: "Share presence with my other machines" is off');
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

/** D-BP223-BM0-X030-073 P1: stops the relay heartbeat worker (part of the beacon). */
function stopHeartbeatWorker(): void {
  if (_heartbeatWorker) {
    try { _heartbeatWorker.postMessage({ type: 'stop' }); } catch { /* ignore */ }
    _heartbeatWorker = null;
  }
}

/** D6b worker start, moved out of the listen callback unchanged (X030-073) so the presence switch can start it too.
 *  D6b: spawn independent worker_threads heartbeat — separate V8 isolate so it
 *  survives relay-poll main-thread hang (prevents "peer looks alive but can't answer" lie) */
function startHeartbeatWorker(): void {
  if (_heartbeatWorker) return;
  {
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
  }
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
