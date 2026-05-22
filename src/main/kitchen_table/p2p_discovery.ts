// Kitchen Table™ P2P Discovery Service — Mnemosyne™ v0.1.8 · SEG-FT-3 · BP052 NOVACULA
// LAN peer discovery via UDP multicast — no cloud relay required.
// Multicast group: 239.255.42.42  Port: 42424

import { createSocket, Socket } from 'dgram';
import { randomUUID } from 'crypto';
import type { P2PDiscoveryPeer } from '../../shared/kitchen_table_types';

// ─── Constants ────────────────────────────────────────────────────────────────

const MULTICAST_ADDR = '239.255.42.42';
const MULTICAST_PORT = 42424;
const BEACON_INTERVAL_MS = 30_000;
const PEER_EXPIRY_MS = 90_000;

// ─── Beacon payload ───────────────────────────────────────────────────────────

interface BeaconPayload {
  peerId: string;
  displayName: string;
  capabilities: string[];
  timestamp: string;
}

// ─── State ────────────────────────────────────────────────────────────────────

let socket: Socket | null = null;
let beaconTimer: ReturnType<typeof setInterval> | null = null;
let expiryTimer: ReturnType<typeof setInterval> | null = null;
let ownPeerId = '';
let ownDisplayName = '';

const peers = new Map<string, P2PDiscoveryPeer>();

// ─── Core ─────────────────────────────────────────────────────────────────────

function sendBeacon(): void {
  if (!socket || !ownPeerId) return;
  const payload: BeaconPayload = {
    peerId: ownPeerId,
    displayName: ownDisplayName,
    capabilities: ['kitchen_table', 'atlas'],
    timestamp: new Date().toISOString(),
  };
  const msg = Buffer.from(JSON.stringify(payload), 'utf-8');
  socket.send(msg, 0, msg.length, MULTICAST_PORT, MULTICAST_ADDR, (err) => {
    if (err) console.warn('[P2P] beacon send error:', err.message);
  });
}

function expirePeers(): void {
  const cutoff = Date.now() - PEER_EXPIRY_MS;
  for (const [id, peer] of peers.entries()) {
    if (new Date(peer.lastSeen).getTime() < cutoff) {
      peers.delete(id);
    }
  }
}

export function startDiscovery(peerId: string, displayName: string): void {
  if (socket) return;

  ownPeerId = peerId || randomUUID();
  ownDisplayName = displayName || 'Mnemosyne™';

  try {
    socket = createSocket({ type: 'udp4', reuseAddr: true });

    socket.on('error', (err) => {
      console.warn('[P2P] socket error:', err.message);
    });

    socket.on('message', (msg, rinfo) => {
      try {
        const payload = JSON.parse(msg.toString('utf-8')) as BeaconPayload;
        if (!payload.peerId || payload.peerId === ownPeerId) return;

        const peer: P2PDiscoveryPeer = {
          peerId: payload.peerId,
          displayName: payload.displayName || rinfo.address,
          lastSeen: new Date().toISOString(),
          capabilities: payload.capabilities ?? [],
          trustLevel: 'unknown',
        };
        peers.set(peer.peerId, peer);
      } catch {
        // malformed beacon — ignore
      }
    });

    socket.bind(MULTICAST_PORT, () => {
      try {
        socket?.addMembership(MULTICAST_ADDR);
        socket?.setMulticastLoopback(false);
        socket?.setMulticastTTL(8);
      } catch (e) {
        console.warn('[P2P] multicast membership error:', (e as Error).message);
      }
    });

    sendBeacon();
    beaconTimer = setInterval(sendBeacon, BEACON_INTERVAL_MS);
    expiryTimer = setInterval(expirePeers, 15_000);
  } catch (e) {
    console.warn('[P2P] startDiscovery failed:', (e as Error).message);
    socket = null;
  }
}

export function stopDiscovery(): void {
  if (beaconTimer) { clearInterval(beaconTimer); beaconTimer = null; }
  if (expiryTimer) { clearInterval(expiryTimer); expiryTimer = null; }
  if (socket) {
    try {
      socket.dropMembership(MULTICAST_ADDR);
      socket.close();
    } catch {
      // socket may already be closed
    }
    socket = null;
  }
  peers.clear();
}

export function getPeers(): P2PDiscoveryPeer[] {
  return Array.from(peers.values());
}

export function isDiscoveryActive(): boolean {
  return socket !== null;
}

// ─── IPC registration (called from registerKitchenTableIpc) ──────────────────

import { ipcMain } from 'electron';

export function registerP2PIPC(): void {
  ipcMain.handle('kitchen-table:p2p-start', (_e, { peerId, displayName }: { peerId: string; displayName: string }) => {
    startDiscovery(peerId, displayName);
    return { ok: true, active: isDiscoveryActive() };
  });

  ipcMain.handle('kitchen-table:p2p-stop', () => {
    stopDiscovery();
    return { ok: true };
  });

  ipcMain.handle('kitchen-table:p2p-peers', () => {
    return { peers: getPeers(), active: isDiscoveryActive() };
  });
}
