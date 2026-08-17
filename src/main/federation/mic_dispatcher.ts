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
import { getAnonKey } from '../shared/anon_key';
// KN-BP144-16 Phase 1: sign the LAN /api/plow-domain dispatch (see peer_server.ts's
// resolvePlowDomainRequest() for the receiving side).
import { signAnnouncePayload } from './announce_frame';
import { getStablePeerId } from './peer-discovery';
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
 * Encrypt a MIC dispatch payload for WAN relay using Thorax AES-256-GCM.
 * Key derived from sha256(peerId + ":wan-mic-key-v1") for simplicity;
 * full key exchange uses emailHash + sessionNonce from wan_soccerball_address.
 * SEG-5: relay sees only opaque ciphertext + target peer_id.
 */
export async function encryptForRelay(
  plaintext: string,
  targetPeerId: string,
  _sharedSecret?: string,
): Promise<string> {
  // Derive a deterministic key from targetPeerId; in production this is replaced
  // by the shared emailHash+sessionNonce from wan_soccerball_address.ts key exchange.
  const keyMaterial = _sharedSecret ?? targetPeerId;
  const rawKey = createHash('sha256').update(`${keyMaterial}:thorax-relay-v1`).digest();

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt'],
  );

  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    new TextEncoder().encode(plaintext),
  );

  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(ct)));
  return JSON.stringify({ iv: ivB64, ct: ctB64 });
}

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

  const tryRoute = async (base: string): Promise<Response | null> => {
    try {
      return await fetch(`${base}/wan-relay-route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(anonKey ? { 'Authorization': `Bearer ${anonKey}` } : {}),
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
 * Decrypt a Thorax AES-256-GCM payload produced by encryptForRelay(). Symmetric counterpart,
 * added D-BP156-M0-008 -- did not exist anywhere in this codebase before this dispatch (a
 * repo-wide grep for `decryptForRelay`/`decryptFromRelay` before writing this function found
 * zero hits). `selfPeerId` must be the SAME value the sender used as `targetPeerId` when
 * calling encryptForRelay (i.e. the receiver's own stable peer id) -- the key derivation is
 * sha256(targetPeerId + ":thorax-relay-v1")`, unchanged from encryptForRelay above.
 */
export async function decryptFromRelay(
  payloadEncrypted: string,
  selfPeerId: string,
  _sharedSecret?: string,
): Promise<string> {
  const keyMaterial = _sharedSecret ?? selfPeerId;
  const rawKey = createHash('sha256').update(`${keyMaterial}:thorax-relay-v1`).digest();

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'raw', rawKey, { name: 'AES-GCM' }, false, ['decrypt'],
  );

  const parsed = JSON.parse(payloadEncrypted) as { iv?: string; ct?: string };
  if (typeof parsed.iv !== 'string' || typeof parsed.ct !== 'string') {
    throw new Error('decryptFromRelay: payload_encrypted missing iv/ct');
  }
  const iv = Uint8Array.from(atob(parsed.iv), (c) => c.charCodeAt(0));
  const ct = Uint8Array.from(atob(parsed.ct), (c) => c.charCodeAt(0));

  const pt = await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, ct);
  return new TextDecoder().decode(pt);
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

  let payloadEncrypted: string;
  try {
    payloadEncrypted = await encryptForRelay(plaintext, peer.id);
  } catch (err) {
    return {
      peerId: peer.id,
      domain,
      ebletsWritten: 0,
      quarantined: 0,
      andonEvents: 0,
      status: 'red',
      error: `Thorax encrypt failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

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
// mesh rather than an Ollama MC-question plow run. Reuses encryptForRelay and
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
 * question) to `peer` over the WAN relay. Reuses encryptForRelay and
 * postToRelayRouteWithFallback UNCHANGED from dispatchDomainViaRelay above -- the only new
 * code here is the payload shape itself, the machine-tag validation, and signing the plaintext
 * with this machine's existing Thorax Ed25519 keypair (announce_frame.ts's
 * signAnnouncePayload, the SAME primitive peer_server.ts already uses to authenticate the LAN
 * /api/plow-domain path) before encrypting it.
 *
 * HONEST LIMIT, stated because this gates a capability that can launch a CLI worker on the
 * receiving machine: encryptForRelay's key derivation is sha256(targetPeerId + ":thorax-relay-
 * v1") -- confidentiality against the relay operator, but NOT sender authentication by itself,
 * since a peer's id is public (advertised in peer_presence). The Ed25519 signature above is
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

  let payloadEncrypted: string;
  try {
    payloadEncrypted = await encryptForRelay(plaintext, peer.id);
  } catch (err) {
    return { ok: false, error: `Thorax encrypt failed: ${err instanceof Error ? err.message : String(err)}` };
  }

  const res = await postToRelayRouteWithFallback(payloadEncrypted, peer.id);
  if (!res || !res.ok) {
    return { ok: false, error: `WAN relay route failed: HTTP ${res?.status ?? 'unreachable'}` };
  }
  return { ok: true };
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
