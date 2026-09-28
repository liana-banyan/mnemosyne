/**
 * constellation_discovery.ts — v0.5.0 BP084 LAN/WAN peer discovery
 *
 * LAN discovery:
 *   - Saved peer list + HTTP heartbeat check (v0.4.0)
 *   - UDP multicast beacon on port 7475 (v0.5.0 BP084 SEG-4)
 *
 * WAN discovery:
 *   - Email-hash → relay lookup (privacy boundary; raw email never transmitted)
 *
 * Peers are persisted in %APPDATA%/MnemosyneC/constellation_peers.json.
 * Heartbeat: simple HTTP GET to peer's MnemosyneC peer_server /api/heartbeat.
 *
 * UDP beacon port: 7475 (sister to peer_server 7474)
 * Beacon packet (pre-KN-BP144-16, legacy/opt-out only): JSON string
 *   { type:"MNEMOSYNEC_PEER_BEACON", peer_id, version, capabilities_summary }
 *
 * KN-BP144-16 Phase 1: the wire format is now a signed hex-mcode frame (see announce_frame.ts)
 * whose decoded payload carries the same fields PLUS public_key_hex (the sender's Thorax
 * Ed25519 public key). addOrUpdatePeer() is called ONLY after verifyAnnounceFrame() succeeds,
 * or -- opt-out path -- after isUnauthenticatedLanDiscoveryAllowed() is confirmed true for a
 * legacy/unsigned packet. A signature that is present and fails verification is ALWAYS refused,
 * never gated by the opt-out setting. See HARDWIRE-03 / KN-BP144-16_REPORT.md for the full
 * mesh-trust context this closes (LAN half only -- WAN, authorization scoping, and revocation
 * remain open, named in that report).
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createSocket, type Socket } from 'dgram';
import { app } from 'electron';
import type { ConstellationPeer } from './mic_types';
import { signAnnouncePayload, peekAnnouncePayload, verifyAnnounceFrame } from './announce_frame';
import { isUnauthenticatedLanDiscoveryAllowed } from './mesh_trust_settings';
// D-BP223-BM0-X010-004-MESHPLUMB: enrollment registry gate, checked FIRST in the beacon handler
// below -- see resolveEnrolledBeaconKey()'s own header comment.
import { lookupEnrolledPeerPublicKey } from '../thorax/peer_enrollment_registry';

export const UDP_BEACON_PORT = 7475;
const BEACON_INTERVAL_MS = 30_000;
const BEACON_ADDRESS = '255.255.255.255'; // IPv4 broadcast

const PEERS_DIR = () => app.getPath('userData');
const PEERS_FILE = () => join(PEERS_DIR(), 'constellation_peers.json');

function ensurePeersDir(): void {
  const dir = PEERS_DIR();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function loadSavedPeers(): ConstellationPeer[] {
  try {
    const f = PEERS_FILE();
    if (!existsSync(f)) return [];
    const saved = JSON.parse(readFileSync(f, 'utf8')) as ConstellationPeer[];
    // Mark all offline initially — heartbeat check will update
    return saved.map((p) => ({ ...p, online: false }));
  } catch {
    return [];
  }
}

export function savePeers(peers: ConstellationPeer[]): void {
  try {
    ensurePeersDir();
    writeFileSync(PEERS_FILE(), JSON.stringify(peers, null, 2), 'utf8');
  } catch (err) {
    console.error('[ConstellationDiscovery] savePeers error:', err);
  }
}

export async function heartbeatPeer(peer: ConstellationPeer): Promise<boolean> {
  try {
    const res = await fetch(`http://${peer.address}/api/heartbeat`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function discoverPeers(): Promise<ConstellationPeer[]> {
  const saved = loadSavedPeers();
  if (saved.length === 0) return [];

  // Check each peer's heartbeat in parallel
  const results = await Promise.all(
    saved.map(async (peer) => {
      const online = await heartbeatPeer(peer);
      return { ...peer, online, lastSeen: online ? Date.now() : peer.lastSeen };
    }),
  );

  savePeers(results);
  return results;
}

export function addOrUpdatePeer(peer: ConstellationPeer): void {
  const saved = loadSavedPeers();
  const idx = saved.findIndex((p) => p.id === peer.id);
  if (idx >= 0) {
    saved[idx] = peer;
  } else {
    saved.push(peer);
  }
  savePeers(saved);
}

export function removePeer(peerId: string): void {
  const saved = loadSavedPeers();
  savePeers(saved.filter((p) => p.id !== peerId));
}

/**
 * KN-BP144-16 Phase 1: returns a previously-learned Thorax Ed25519 public key for a given
 * peer_id, IF this node has ever seen a signature-verified UDP beacon from that peer. Used by
 * peer_server.ts's `/api/plow-domain` handler to verify a LAN HTTP dispatch request against a
 * key learned independently of that same request (stronger than trusting a self-declared key
 * inside the request being verified) -- falls back to trust-on-first-use only when no
 * previously-learned key exists (see announce_frame.ts's doc comment on that limit).
 */
export function lookupKnownPeerPublicKey(peerId: string): string | undefined {
  const saved = loadSavedPeers();
  return saved.find((p) => p.id === peerId)?.public_key_hex;
}

/**
 * D-BP223-BM0-X010-004-MESHPLUMB: resolves this machine's enrollment-registry key for an
 * announcing peer, if any. Checked FIRST by the beacon handler below, ahead of
 * lookupKnownPeerPublicKey()'s own beacon-learned (trust-on-first-use) store -- HARDWIRE-03's
 * actual gap was that no stronger tier than TOFU existed anywhere on this path; this is that
 * tier. An UNENROLLED peer_id falls through to the pre-existing TOFU resolution unchanged (no
 * existing test in this repo covers the beacon handler directly, but the same additive
 * discipline as peer_server.ts's sibling change is kept here for consistency and so a live
 * install's un-enrolled LAN peers see no behavior change until the Founder actually enrolls
 * someone).
 */
function resolveEnrolledBeaconKey(peerId: string): string | undefined {
  try {
    const registryPath = join(app.getPath('userData'), 'peer_enrollment_registry.json');
    return lookupEnrolledPeerPublicKey(registryPath, peerId) ?? undefined;
  } catch {
    return undefined;
  }
}

export async function getPeerInfo(peerAddress: string): Promise<Partial<ConstellationPeer> | null> {
  try {
    // D-BP223-BM0-X030-073 P2: /api/info refuses unsigned requests; sign a fresh route frame (header x-mnem-signed-frame).
    const headers: Record<string, string> = {};
    let senderPeerId: string | undefined;
    try { senderPeerId = (require('./peer_server') as typeof import('./peer_server')).getRegisteredPeerId() ?? undefined; } catch { senderPeerId = undefined; }
    const signed = signAnnouncePayload('api-info-' + Date.now(), { route: '/api/info', issued_ms: Date.now(), ...(senderPeerId ? { sender_peer_id: senderPeerId } : {}) });
    if (signed) headers['x-mnem-signed-frame'] = signed.signedHex;
    const res = await fetch(`http://${peerAddress}/api/info`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return (await res.json()) as Partial<ConstellationPeer>;
  } catch {
    return null;
  }
}

// ─── UDP LAN auto-discovery (BP084 · SEG-4) ──────────────────────────────────

interface BeaconPacket {
  type: 'MNEMOSYNEC_PEER_BEACON';
  peer_id: string;
  version: string;
  capabilities_summary: {
    ollamaModel?: string;
    ramTier?: string;
    installedDomains?: string[];
  };
  port: number; // peer_server HTTP port (7474)
  /** KN-BP144-16 Phase 1: sender's Thorax Ed25519 public key, embedded automatically by
   *  signAnnouncePayload() (announce_frame.ts). Absent on a legacy/opt-out unsigned packet. */
  public_key_hex?: string;
}

/** Builds the ConstellationPeer record shared by both the verified and unauthenticated receive
 *  paths below -- the only difference between them is public_key_hex/thorax_announce_status. */
function buildPeerFromPacket(
  packet: BeaconPacket,
  peerAddress: string,
  publicKeyHex: string | undefined,
  status: ConstellationPeer['thorax_announce_status'],
): ConstellationPeer {
  return {
    id: packet.peer_id,
    address: peerAddress,
    name: `UDP-${packet.peer_id.slice(0, 8)}`,
    online: true,
    lastSeen: Date.now(),
    cpuCapacity: 0.5,
    ollamaModel: packet.capabilities_summary?.ollamaModel ?? null,
    installedDomains: packet.capabilities_summary?.installedDomains ?? [],
    pendingWorkload: 0,
    ...(publicKeyHex ? { public_key_hex: publicKeyHex } : {}),
    thorax_announce_status: status,
  };
}

let _beaconSocket: Socket | null = null;
let _beaconTimer: ReturnType<typeof setInterval> | null = null;
let _selfPeerId: string | null = null;

/**
 * Start UDP beacon broadcast on port 7475.
 * Broadcasts MNEMOSYNEC_PEER_BEACON every 30 s.
 * Listens for beacons from other peers and auto-adds them to the saved peer list.
 *
 * @param peerId  - this peer's ID
 * @param version - app version string
 * @param capsSummary - lightweight capabilities for peer selection
 */
export function startUdpBeacon(
  peerId: string,
  version: string,
  capsSummary: BeaconPacket['capabilities_summary'] = {},
): void {
  if (_beaconSocket) return; // already running

  _selfPeerId = peerId;
  _beaconSocket = createSocket({ type: 'udp4', reuseAddr: true });

  _beaconSocket.on('error', (err) => {
    console.warn('[ConstellationDiscovery] UDP beacon socket error:', err.message);
    stopUdpBeacon();
  });

  _beaconSocket.on('message', (msg, rinfo) => {
    try {
      const raw = msg.toString('utf8');

      // KN-BP144-16 Phase 1: try the SIGNED hex-mcode frame format first (see announce_frame.ts).
      const peeked = peekAnnouncePayload(raw);
      if (peeked) {
        const packet = peeked.payload as Partial<BeaconPacket>;
        if (
          packet.type !== 'MNEMOSYNEC_PEER_BEACON' ||
          !packet.peer_id ||
          packet.peer_id === _selfPeerId
        ) {
          return; // ignore own beacons and unknown packets
        }
        const peerAddress = `${rinfo.address}:${packet.port ?? 7474}`;
        // D-BP223-BM0-X010-004-MESHPLUMB: enrolled key wins over the self-declared key when the
        // announcing peer_id IS enrolled -- an enrolled peer whose signature fails against its
        // ENROLLED key is refused below even if it would verify against its own self-declared
        // key (a rotated-but-not-re-enrolled key, or a forged announcement). An unenrolled peer
        // falls through to the pre-existing self-declared-key verification, unchanged.
        const enrolledKey = resolveEnrolledBeaconKey(packet.peer_id);
        const claimedKey = enrolledKey ?? peeked.claimedPublicKeyHex;
        if (claimedKey) {
          const verified = verifyAnnounceFrame(raw, claimedKey);
          if (!verified.valid) {
            // A refused signature stays refused, unconditionally -- never gated by the
            // unauthenticated-LAN-discovery opt-out below (that setting only governs the
            // ABSENCE of a signature, never one that is present and fails).
            console.warn(
              `[ConstellationDiscovery] REFUSED beacon from ${packet.peer_id.slice(0, 8)}… at ${peerAddress}` +
              `${enrolledKey ? ' (ENROLLED peer, key mismatch or forged signature)' : ''}: ${verified.reason}`,
            );
            return;
          }
          const peer = buildPeerFromPacket(packet as BeaconPacket, peerAddress, claimedKey, 'verified');
          addOrUpdatePeer(peer);
          console.log(
            `[ConstellationDiscovery] UDP: discovered LAN peer ${packet.peer_id.slice(0, 8)}… at ${peerAddress} ` +
            `(signature VERIFIED${enrolledKey ? ', ENROLLED' : ''})`,
          );
          return;
        }
        // Signed frame, but no public_key_hex embedded -- cannot verify. Falls to the same
        // unauthenticated policy as a legacy unsigned packet, below.
        handleUnauthenticatedBeacon(packet as BeaconPacket, peerAddress, 'signed frame carried no public_key_hex');
        return;
      }

      // Legacy/opt-out path: plain unsigned JSON (pre-KN-BP144-16 peer, or this feature's
      // opt-out format). Only ever reached when the message did not parse as a signed frame.
      const legacyPacket = JSON.parse(raw) as BeaconPacket;
      if (
        legacyPacket.type !== 'MNEMOSYNEC_PEER_BEACON' ||
        !legacyPacket.peer_id ||
        legacyPacket.peer_id === _selfPeerId
      ) {
        return; // ignore own beacons and unknown packets
      }
      const peerAddress = `${rinfo.address}:${legacyPacket.port ?? 7474}`;
      handleUnauthenticatedBeacon(legacyPacket, peerAddress, 'legacy unsigned beacon (pre-KN-BP144-16 wire format)');
    } catch {
      // Ignore malformed packets -- unchanged from pre-Phase-1 behavior.
    }
  });

  _beaconSocket.bind(UDP_BEACON_PORT, () => {
    _beaconSocket?.setBroadcast(true);
    sendBeacon(peerId, version, capsSummary);
  });

  _beaconTimer = setInterval(() => {
    sendBeacon(peerId, version, capsSummary);
  }, BEACON_INTERVAL_MS);

  console.log(`[ConstellationDiscovery] UDP beacon started on port ${UDP_BEACON_PORT}`);
}

/**
 * KN-BP144-16 Phase 1: policy for a beacon that arrived with no verifiable signature (either
 * genuinely unsigned/legacy JSON, or a signed frame with no embedded key). Gated by the
 * mesh_trust_settings.ts opt-out, which defaults to false (refuse) -- see that module's doc
 * comment. Never used for a signature that IS present and fails verification; that path
 * returns directly from the caller above without reaching here.
 */
function handleUnauthenticatedBeacon(packet: BeaconPacket, peerAddress: string, reason: string): void {
  if (!isUnauthenticatedLanDiscoveryAllowed()) {
    console.warn(
      `[ConstellationDiscovery] REFUSED unauthenticated beacon from ${packet.peer_id.slice(0, 8)}… at ${peerAddress} ` +
      `(${reason}) -- unauthenticated LAN discovery is disabled by default (KN-BP144-16). ` +
      `Call setUnauthenticatedLanDiscoveryAllowed(true) (mesh_trust_settings.ts) if this LAN is trusted.`,
    );
    return;
  }
  const peer = buildPeerFromPacket(packet, peerAddress, undefined, 'unauthenticated');
  addOrUpdatePeer(peer);
  console.log(
    `[ConstellationDiscovery] UDP: discovered LAN peer ${packet.peer_id.slice(0, 8)}… at ${peerAddress} ` +
    `(UNAUTHENTICATED -- ${reason}; opt-out setting is enabled)`,
  );
}

function sendBeacon(
  peerId: string,
  version: string,
  capsSummary: BeaconPacket['capabilities_summary'],
): void {
  if (!_beaconSocket) return;
  const packet: BeaconPacket = {
    type: 'MNEMOSYNEC_PEER_BEACON',
    peer_id: peerId,
    version,
    capabilities_summary: capsSummary,
    port: 7474,
  };
  // KN-BP144-16 Phase 1: always attempt to sign the outgoing beacon with this machine's own
  // Thorax Ed25519 keypair (announce_frame.ts embeds public_key_hex automatically). Falls back
  // to the legacy plain-JSON wire format ONLY if signing itself fails (e.g. keypair truly
  // unavailable) -- this node's own opt-out setting never suppresses its OWN signature; that
  // setting only governs how permissive THIS node is when RECEIVING an unsigned announce.
  const signed = signAnnouncePayload(peerId, packet as unknown as Record<string, unknown>);
  const wireString = signed ? signed.signedHex : JSON.stringify(packet);
  const buf = Buffer.from(wireString, 'utf8');
  _beaconSocket.send(buf, 0, buf.length, UDP_BEACON_PORT, BEACON_ADDRESS, (err) => {
    if (err) {
      console.warn('[ConstellationDiscovery] UDP beacon send error:', err.message);
    }
  });
}

export function stopUdpBeacon(): void {
  if (_beaconTimer) {
    clearInterval(_beaconTimer);
    _beaconTimer = null;
  }
  if (_beaconSocket) {
    try { _beaconSocket.close(); } catch { /* ignore */ }
    _beaconSocket = null;
  }
  _selfPeerId = null;
  console.log('[ConstellationDiscovery] UDP beacon stopped');
}
