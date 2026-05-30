// Mnemosyne — Peer Discovery Engine
// MV-CN · SAGA 3 BP045 W1
//
// Two-tier discovery:
//   Tier 1 (LAN): UDP multicast on 224.0.0.251:5354 — announces + listens for
//                 _mnemosyne._tcp.local. service advertisements.
//   Tier 2 (WAN): WebSocket relay at wss://relay.mnemosynec.ai — peers that
//                 have joined the relay room are cross-network visible.
//
// Both tiers surface a unified peer set to the RelayClient and FederationClient.

import { createSocket, Socket as UDPSocket } from 'dgram';
import { createHash, randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import { app } from 'electron';
import {
  LAN_MULTICAST_ADDR,
  LAN_MULTICAST_PORT,
  LAN_ANNOUNCE_PORT,
  AnnouncePayload,
  FedMsg,
  MnemosynePeer,
} from '../../shared/federation-protocol';

export interface PeerDiscoveryEvents {
  'peer-discovered': (peer: MnemosynePeer) => void;
  'peer-lost': (peerId: string) => void;
  'peer-updated': (peer: MnemosynePeer) => void;
}

declare interface PeerDiscovery {
  on<K extends keyof PeerDiscoveryEvents>(event: K, listener: PeerDiscoveryEvents[K]): this;
  emit<K extends keyof PeerDiscoveryEvents>(event: K, ...args: Parameters<PeerDiscoveryEvents[K]>): boolean;
}

class PeerDiscovery extends EventEmitter {
  private peerId: string;
  private version: string;
  private displayName: string | undefined;

  private udpSocket: UDPSocket | null = null;
  private announceTimer: ReturnType<typeof setInterval> | null = null;
  private pruneTimer: ReturnType<typeof setInterval> | null = null;

  private lanPeers: Map<string, MnemosynePeer> = new Map();
  private wanPeers: Map<string, MnemosynePeer> = new Map();

  // Announce every 15s; prune peers unseen > 60s
  private static readonly ANNOUNCE_INTERVAL_MS = 15_000;
  private static readonly PEER_TTL_MS = 60_000;
  private static readonly PRUNE_INTERVAL_MS = 30_000;

  constructor(peerId: string, displayName?: string) {
    super();
    this.peerId = peerId;
    this.version = app?.isReady() ? app.getVersion() : '0.1.3';
    this.displayName = displayName;
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  async startLAN(): Promise<void> {
    try {
      this.udpSocket = createSocket({ type: 'udp4', reuseAddr: true });

      this.udpSocket.on('error', (err) => {
        console.warn('[PeerDiscovery] UDP error:', err.message);
      });

      this.udpSocket.on('message', (msg, rinfo) => {
        this._handleLANMessage(msg, rinfo.address);
      });

      await new Promise<void>((resolve, reject) => {
        this.udpSocket!.bind(LAN_MULTICAST_PORT, () => {
          try {
            this.udpSocket!.addMembership(LAN_MULTICAST_ADDR);
            this.udpSocket!.setMulticastTTL(32);
            resolve();
          } catch (e) {
            reject(e);
          }
        });
        this.udpSocket!.once('error', reject);
      });

      this.announceTimer = setInterval(() => this._sendAnnounce(), PeerDiscovery.ANNOUNCE_INTERVAL_MS);
      this.pruneTimer = setInterval(() => this._pruneStalePeers(), PeerDiscovery.PRUNE_INTERVAL_MS);

      this._sendAnnounce();
      console.log('[PeerDiscovery] LAN multicast listener started');
    } catch (err) {
      console.warn('[PeerDiscovery] LAN start failed (non-fatal):', err);
    }
  }

  stop(): void {
    if (this.announceTimer) clearInterval(this.announceTimer);
    if (this.pruneTimer) clearInterval(this.pruneTimer);
    try { this.udpSocket?.close(); } catch { /* ignore */ }
    this.udpSocket = null;
  }

  // Called by RelayClient when WAN peers connect/disconnect
  registerWANPeer(peer: MnemosynePeer): void {
    const existing = this.wanPeers.get(peer.peerId);
    this.wanPeers.set(peer.peerId, { ...peer, lastSeen: new Date().toISOString() });
    if (!existing) {
      this.emit('peer-discovered', peer);
    } else {
      this.emit('peer-updated', peer);
    }
  }

  removeWANPeer(peerId: string): void {
    if (this.wanPeers.delete(peerId)) {
      this.emit('peer-lost', peerId);
    }
  }

  // MESH-6 Blocker B3: remove a LAN-discovered peer (mirrors removeWANPeer)
  removeLANPeer(peerId: string): void {
    if (this.lanPeers.delete(peerId)) {
      this.emit('peer-lost', peerId);
    }
  }

  getAllPeers(): MnemosynePeer[] {
    return [
      ...Array.from(this.lanPeers.values()),
      ...Array.from(this.wanPeers.values()),
    ];
  }

  getPeerId(): string {
    return this.peerId;
  }

  // ─── Private — LAN ────────────────────────────────────────────────────────

  private _sendAnnounce(): void {
    if (!this.udpSocket) return;
    const payload: AnnouncePayload = {
      peerId: this.peerId,
      port: LAN_ANNOUNCE_PORT,
      version: this.version,
      displayName: this.displayName,
    };
    const msg: FedMsg = {
      type: 'announce',
      peerId: this.peerId,
      payload,
      ts: new Date().toISOString(),
    };
    const buf = Buffer.from(JSON.stringify(msg));
    this.udpSocket.send(buf, 0, buf.length, LAN_MULTICAST_PORT, LAN_MULTICAST_ADDR);
  }

  private _handleLANMessage(msg: Buffer, senderAddr: string): void {
    try {
      const parsed = JSON.parse(msg.toString()) as FedMsg;
      if (parsed.type !== 'announce' || parsed.peerId === this.peerId) return;

      const ann = parsed.payload as AnnouncePayload;
      const existing = this.lanPeers.get(parsed.peerId);

      const peer: MnemosynePeer = {
        peerId: parsed.peerId,
        displayName: ann.displayName,
        address: senderAddr,
        port: ann.port,
        transport: 'lan',
        phase: 'discovered',
        lastSeen: new Date().toISOString(),
      };

      this.lanPeers.set(parsed.peerId, peer);

      if (!existing) {
        this.emit('peer-discovered', peer);
        console.log('[PeerDiscovery] LAN peer discovered:', parsed.peerId, 'at', senderAddr);
      } else {
        this.emit('peer-updated', peer);
      }
    } catch {
      // Malformed UDP packet — ignore
    }
  }

  private _pruneStalePeers(): void {
    const cutoff = Date.now() - PeerDiscovery.PEER_TTL_MS;
    for (const [id, peer] of this.lanPeers.entries()) {
      if (new Date(peer.lastSeen).getTime() < cutoff) {
        this.lanPeers.delete(id);
        this.emit('peer-lost', id);
        console.log('[PeerDiscovery] LAN peer pruned (stale):', id);
      }
    }
  }
}

// ─── Singleton peer ID (stable per install) ────────────────────────────────

let _cachedPeerId: string | null = null;

export function getStablePeerId(): string {
  if (_cachedPeerId) return _cachedPeerId;
  // Derive stable ID from machine ID hash (no PII)
  try {
    const { execSync } = require('child_process') as typeof import('child_process');
    const raw = execSync('wmic csproduct get uuid', { encoding: 'utf8', timeout: 3000 });
    const uuid = raw.split('\n').find((l) => l.trim().match(/^[0-9A-F-]{36}$/i))?.trim();
    if (uuid) {
      _cachedPeerId = createHash('sha256').update(`mnemosyne:${uuid}`).digest('hex').slice(0, 16);
      return _cachedPeerId;
    }
  } catch { /* fallback */ }
  _cachedPeerId = randomUUID().replace(/-/g, '').slice(0, 16);
  return _cachedPeerId;
}

export { PeerDiscovery };
