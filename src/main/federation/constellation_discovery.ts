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
 * Beacon packet: JSON string { type:"MNEMOSYNEC_PEER_BEACON", peer_id, version, capabilities_summary }
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createSocket, type Socket } from 'dgram';
import { app } from 'electron';
import type { ConstellationPeer } from './mic_types';

export const UDP_BEACON_PORT = 7475;
const BEACON_INTERVAL_MS = 30_000;
const BEACON_ADDRESS = '255.255.255.255'; // IPv4 broadcast

const PEERS_DIR = () => join(app.getPath('appData'), 'MnemosyneC');
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

export async function getPeerInfo(peerAddress: string): Promise<Partial<ConstellationPeer> | null> {
  try {
    const res = await fetch(`http://${peerAddress}/api/info`, {
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
      const packet = JSON.parse(msg.toString('utf8')) as BeaconPacket;
      if (
        packet.type !== 'MNEMOSYNEC_PEER_BEACON' ||
        !packet.peer_id ||
        packet.peer_id === _selfPeerId
      ) {
        return; // ignore own beacons and unknown packets
      }

      const peerAddress = `${rinfo.address}:${packet.port ?? 7474}`;
      const peer: ConstellationPeer = {
        id: packet.peer_id,
        address: peerAddress,
        name: `UDP-${packet.peer_id.slice(0, 8)}`,
        online: true,
        lastSeen: Date.now(),
        cpuCapacity: 0.5,
        ollamaModel: packet.capabilities_summary?.ollamaModel ?? null,
        installedDomains: packet.capabilities_summary?.installedDomains ?? [],
        pendingWorkload: 0,
      };

      addOrUpdatePeer(peer);
      console.log(
        `[ConstellationDiscovery] UDP: discovered LAN peer ${packet.peer_id.slice(0, 8)}… at ${peerAddress}`,
      );
    } catch {
      // Ignore malformed packets
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
  const buf = Buffer.from(JSON.stringify(packet), 'utf8');
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
