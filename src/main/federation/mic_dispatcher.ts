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
async function encryptForRelay(
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

  const anonKey =
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    '';

  const tryRoute = async (base: string): Promise<Response | null> => {
    try {
      return await fetch(`${base}/wan-relay-route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(anonKey ? { 'Authorization': `Bearer ${anonKey}` } : {}),
        },
        body: JSON.stringify({ payload_encrypted: payloadEncrypted, target_peer_id: peer.id }),
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
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain,
        questions,
        ollamaBaseUrl: payload.ollamaBaseUrl ?? 'http://127.0.0.1:11434',
        model: payload.model ?? 'gemma4:12b',
      }),
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
