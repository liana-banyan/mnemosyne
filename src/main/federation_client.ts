// AMPLIFY Computer — Federation Client
// B37 Phase 3 — Cooperative substrate network sync + peer discovery
//
// Three connectivity tiers:
//   Online:   sync with LB cooperative substrate endpoint (lianabanyan.com/api/substrate)
//   Local:    mDNS/broadcast peer discovery on LAN (other AMPLIFY Computer instances)
//   Fallback: peer-to-peer substrate exchange with discovered local peers only

import { createServer, createConnection, Server, Socket } from 'net';
import { createHash } from 'crypto';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  mkdirSync,
} from 'fs';
import { resolve } from 'path';
import type { SubstrateRecord, SubstrateLocalIndex } from './substrate_router';

// ─── Constants ────────────────────────────────────────────────────────────────

const FEDERATION_DATA_DIR = resolve(
  process.env.APPDATA || process.env.HOME || '.',
  'AMPLIFY Computer',
  'federation',
);

// LB cooperative substrate API endpoint
const LB_SUBSTRATE_SEARCH_URL = 'https://lianabanyan.com/api/substrate/search';
const LB_SUBSTRATE_WRITE_URL = 'https://lianabanyan.com/api/substrate/write';
const LB_SUBSTRATE_SYNC_URL = 'https://lianabanyan.com/api/substrate/sync';

// Peer-to-peer discovery (local AMPLIFY instances announce on this port)
const PEER_ANNOUNCE_PORT = 11481;
const PEER_SYNC_TIMEOUT_MS = 5000;

// Sync intervals
const ONLINE_SYNC_INTERVAL_MS = 5 * 60 * 1000;  // 5 minutes
const PEER_SCAN_INTERVAL_MS = 30 * 1000;          // 30 seconds
const CONNECTIVITY_CHECK_URL = 'https://lianabanyan.com/api/health';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Peer {
  address: string;
  port: number;
  lastSeen: string;
  recordCount?: number;
}

export interface FederationStatus {
  online: boolean;
  peerCount: number;
  lastSyncTs: string | null;
  lastSyncRecordsExchanged: number;
  pendingWriteCount: number;
  peers: Peer[];
}

interface PendingWrite {
  record: SubstrateRecord;
  ts: string;
}

// ─── Federation Client ────────────────────────────────────────────────────────

export class FederationClient {
  private index: SubstrateLocalIndex;
  private memberToken: string | null = null;

  private peers: Map<string, Peer> = new Map();
  private pendingWrites: PendingWrite[] = [];
  private lastSyncTs: string | null = null;
  private lastSyncRecordsExchanged = 0;
  private online = false;

  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private peerScanTimer: ReturnType<typeof setInterval> | null = null;
  private announceServer: Server | null = null;

  constructor(index: SubstrateLocalIndex) {
    this.index = index;
    if (!existsSync(FEDERATION_DATA_DIR)) {
      mkdirSync(FEDERATION_DATA_DIR, { recursive: true });
    }
    this._loadPersisted();
  }

  setMemberToken(token: string | null): void {
    this.memberToken = token;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    // Immediate connectivity check
    this.online = await this._checkConnectivity();

    // Start peer announce server (so other local AMPLIFY instances find us)
    await this._startAnnounceServer();

    // Sync timers
    this.syncTimer = setInterval(() => this._syncCycle(), ONLINE_SYNC_INTERVAL_MS);
    this.peerScanTimer = setInterval(() => this._scanLocalPeers(), PEER_SCAN_INTERVAL_MS);

    // Initial syncs
    if (this.online) {
      this._syncCycle().catch(() => {});
    }
    this._scanLocalPeers().catch(() => {});

    console.log(`[Federation] Started. Online=${this.online}, peers=${this.peers.size}`);
  }

  async stop(): Promise<void> {
    if (this.syncTimer) clearInterval(this.syncTimer);
    if (this.peerScanTimer) clearInterval(this.peerScanTimer);

    this._persistPeers();
    await this._closeAnnounceServer();
  }

  // ─── Queue a write (from local query router ─ new records learned locally) ─

  queueWrite(record: SubstrateRecord): void {
    this.pendingWrites.push({ record, ts: new Date().toISOString() });
    // Cap queue at 500 pending writes
    if (this.pendingWrites.length > 500) this.pendingWrites.shift();
  }

  // ─── Federation search (for AI Burst mode: augment substrate query) ─────────

  async federatedSearch(query: string): Promise<SubstrateRecord | null> {
    if (!this.online) return null;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-AMPLIFY-Version': '0.1.0',
      };
      if (this.memberToken) headers['Authorization'] = `Bearer ${this.memberToken}`;

      const res = await fetch(LB_SUBSTRATE_SEARCH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ q: query, top_k: 1 }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (!res.ok) return null;
      const data = await res.json() as { hits?: SubstrateRecord[] };
      return data.hits?.[0] ?? null;
    } catch {
      return null;
    }
  }

  // ─── Peer-sync: exchange substrate records with a local peer ────────────────

  async syncWithPeer(peer: Peer): Promise<number> {
    return new Promise<number>((resolve) => {
      let exchanged = 0;
      try {
        const socket = createConnection(
          { host: peer.address, port: peer.port, timeout: PEER_SYNC_TIMEOUT_MS },
          () => {
            // Send our top-50 recent records
            const recentIds = this._recentLocalRecordIds(50);
            socket.write(
              JSON.stringify({ type: 'sync_request', record_ids: recentIds }) + '\n',
            );
          },
        );

        let buffer = '';
        socket.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            try {
              const msg = JSON.parse(line) as {
                type: string;
                records?: SubstrateRecord[];
              };
              if (msg.type === 'sync_response' && msg.records) {
                for (const rec of msg.records) {
                  this.index.writeRecord(rec);
                  exchanged++;
                }
                socket.end();
              }
            } catch {
              // Malformed — ignore
            }
          }
        });

        socket.on('error', () => resolve(exchanged));
        socket.on('close', () => resolve(exchanged));
        setTimeout(() => { socket.destroy(); resolve(exchanged); }, PEER_SYNC_TIMEOUT_MS);
      } catch {
        resolve(0);
      }
    });
  }

  // ─── Status ─────────────────────────────────────────────────────────────────

  getStatus(): FederationStatus {
    return {
      online: this.online,
      peerCount: this.peers.size,
      lastSyncTs: this.lastSyncTs,
      lastSyncRecordsExchanged: this.lastSyncRecordsExchanged,
      pendingWriteCount: this.pendingWrites.length,
      peers: Array.from(this.peers.values()),
    };
  }

  async checkAndUpdateConnectivity(): Promise<boolean> {
    this.online = await this._checkConnectivity();
    return this.online;
  }

  // ─── Private — sync cycle ────────────────────────────────────────────────────

  private async _syncCycle(): Promise<void> {
    this.online = await this._checkConnectivity();
    if (!this.online) return;

    let exchanged = 0;

    // Push pending writes to LB cooperative substrate
    if (this.pendingWrites.length > 0) {
      exchanged += await this._flushPendingWrites();
    }

    // Pull new records from LB cooperative substrate
    exchanged += await this._pullFromCooperative();

    this.lastSyncTs = new Date().toISOString();
    this.lastSyncRecordsExchanged = exchanged;

    if (exchanged > 0) {
      console.log(`[Federation] Synced ${exchanged} records with cooperative substrate`);
    }
  }

  private async _flushPendingWrites(): Promise<number> {
    if (this.pendingWrites.length === 0) return 0;
    const batch = this.pendingWrites.splice(0, 50);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-AMPLIFY-Version': '0.1.0',
      };
      if (this.memberToken) headers['Authorization'] = `Bearer ${this.memberToken}`;

      const res = await fetch(LB_SUBSTRATE_WRITE_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ records: batch.map((w) => w.record) }),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        // Re-queue failed batch
        this.pendingWrites.unshift(...batch);
        return 0;
      }
      return batch.length;
    } catch {
      this.pendingWrites.unshift(...batch);
      return 0;
    }
  }

  private async _pullFromCooperative(): Promise<number> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-AMPLIFY-Version': '0.1.0',
      };
      if (this.memberToken) headers['Authorization'] = `Bearer ${this.memberToken}`;

      const since = this.lastSyncTs ?? new Date(0).toISOString();
      const res = await fetch(LB_SUBSTRATE_SYNC_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ since, limit: 100 }),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) return 0;
      const data = await res.json() as { records?: SubstrateRecord[] };
      const records = data.records ?? [];
      for (const rec of records) {
        this.index.writeRecord(rec);
      }
      return records.length;
    } catch {
      return 0;
    }
  }

  // ─── Private — peer discovery ────────────────────────────────────────────────

  private async _startAnnounceServer(): Promise<void> {
    return new Promise((resolve) => {
      this.announceServer = createServer((socket: Socket) => {
        this._handlePeerConnection(socket);
      });

      this.announceServer.on('error', () => {
        // Port already in use — another AMPLIFY is running; that's fine
        resolve();
      });

      this.announceServer.listen(PEER_ANNOUNCE_PORT, '0.0.0.0', () => {
        console.log(`[Federation] Peer announce server on :${PEER_ANNOUNCE_PORT}`);
        resolve();
      });
    });
  }

  private _handlePeerConnection(socket: Socket): void {
    const peerAddr = socket.remoteAddress ?? 'unknown';
    let buffer = '';

    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        try {
          const msg = JSON.parse(line) as {
            type: string;
            record_ids?: string[];
          };

          if (msg.type === 'sync_request') {
            // Register peer
            const peerKey = `${peerAddr}:${PEER_ANNOUNCE_PORT}`;
            this.peers.set(peerKey, {
              address: peerAddr,
              port: PEER_ANNOUNCE_PORT,
              lastSeen: new Date().toISOString(),
            });

            // Respond with records the peer doesn't have
            const theirIds = new Set(msg.record_ids ?? []);
            const toSend = this._getRecordsExcluding(theirIds, 50);

            socket.write(
              JSON.stringify({ type: 'sync_response', records: toSend }) + '\n',
            );
            socket.end();
          }
        } catch {
          // Malformed — ignore
        }
      }
    });

    socket.on('error', () => {});
  }

  private async _closeAnnounceServer(): Promise<void> {
    return new Promise((resolve) => {
      if (this.announceServer) {
        this.announceServer.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  private async _scanLocalPeers(): Promise<void> {
    // Attempt to connect to common local network addresses on PEER_ANNOUNCE_PORT
    // In a real deployment, mDNS/Bonjour would be used; this is a lightweight fallback
    const localCandidates = this._guessLocalPeerAddresses();
    const results = await Promise.allSettled(
      localCandidates.map((addr) => this._probePeer(addr)),
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        const peer = result.value;
        this.peers.set(`${peer.address}:${peer.port}`, peer);
      }
    }

    // Prune peers not seen in >10 minutes
    const now = Date.now();
    for (const [key, peer] of this.peers.entries()) {
      if (now - new Date(peer.lastSeen).getTime() > 10 * 60 * 1000) {
        this.peers.delete(key);
      }
    }
  }

  private async _probePeer(address: string): Promise<Peer | null> {
    return new Promise<Peer | null>((resolve) => {
      const socket = createConnection(
        { host: address, port: PEER_ANNOUNCE_PORT, timeout: 1500 },
        () => {
          socket.destroy();
          resolve({
            address,
            port: PEER_ANNOUNCE_PORT,
            lastSeen: new Date().toISOString(),
          });
        },
      );
      socket.on('error', () => resolve(null));
      socket.on('timeout', () => { socket.destroy(); resolve(null); });
    });
  }

  private _guessLocalPeerAddresses(): string[] {
    // Scan .1-.10 on common LAN subnets for simplicity; mDNS is the proper solution
    const subnets = ['192.168.1', '192.168.0', '10.0.0', '10.0.1', '172.16.0'];
    const suffixes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const addresses: string[] = [];
    for (const subnet of subnets) {
      for (const suffix of suffixes) {
        addresses.push(`${subnet}.${suffix}`);
      }
    }
    return addresses;
  }

  // ─── Private — index helpers ─────────────────────────────────────────────────

  private _recentLocalRecordIds(limit: number): string[] {
    // Approximate: return last N IDs from in-memory records
    const records = (this.index as unknown as { records: SubstrateRecord[] }).records;
    if (!Array.isArray(records)) return [];
    return records.slice(-limit).map((r) => r.id);
  }

  private _getRecordsExcluding(excludeIds: Set<string>, limit: number): SubstrateRecord[] {
    const records = (this.index as unknown as { records: SubstrateRecord[] }).records;
    if (!Array.isArray(records)) return [];
    return records
      .filter((r) => !excludeIds.has(r.id))
      .slice(-limit);
  }

  // ─── Private — connectivity ──────────────────────────────────────────────────

  private async _checkConnectivity(): Promise<boolean> {
    try {
      const res = await fetch(CONNECTIVITY_CHECK_URL, {
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // ─── Private — persistence ───────────────────────────────────────────────────

  private _loadPersisted(): void {
    const peersFile = resolve(FEDERATION_DATA_DIR, 'peers.json');
    if (existsSync(peersFile)) {
      try {
        const data = JSON.parse(readFileSync(peersFile, 'utf8')) as Peer[];
        for (const peer of data) {
          this.peers.set(`${peer.address}:${peer.port}`, peer);
        }
      } catch {
        // Ignore
      }
    }
  }

  private _persistPeers(): void {
    const peersFile = resolve(FEDERATION_DATA_DIR, 'peers.json');
    try {
      writeFileSync(
        peersFile,
        JSON.stringify(Array.from(this.peers.values()), null, 2),
        'utf8',
      );
    } catch {
      // Ignore
    }
  }
}
