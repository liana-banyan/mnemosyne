// Mnemosyne — WAN Relay Client
// MV-CN · SAGA 3 BP045 W1
//
// Connects to wss://relay.mnemosynec.ai and participates in the cooperative
// peer mesh. Each connected instance can discover and sync with Mnemosyne
// peers on different networks (WAN-class). Composes with PeerDiscovery.
//
// Protocol:
//   Client → relay_join  → relay registers peerId
//   Relay  → relay_broadcast (peer list updates)
//   Client → relay_route → relay forwards to target peerId
//   Client ↔ Client via relay: identify → identify_ack → ratify → ratify_ack → sync

import { EventEmitter } from 'events';
import { BrowserWindow } from 'electron';
import {
  RELAY_URL,
  FedMsg,
  MnemosynePeer,
  RelayJoinPayload,
  RelayBroadcastPayload,
  RelayRoutePayload,
} from '../../shared/federation-protocol';
import type { PeerDiscovery } from './peer-discovery';

export interface RelayClientEvents {
  'wan-peer-list': (peers: MnemosynePeer[]) => void;
  'connected': () => void;
  'disconnected': () => void;
}

declare interface RelayClient {
  on<K extends keyof RelayClientEvents>(event: K, listener: RelayClientEvents[K]): this;
  emit<K extends keyof RelayClientEvents>(event: K, ...args: Parameters<RelayClientEvents[K]>): boolean;
}

class RelayClient extends EventEmitter {
  private ws: import('ws') | null = null;
  private peerId: string;
  private displayName: string | undefined;
  private discovery: PeerDiscovery;
  private windows: Set<BrowserWindow> = new Set();

  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private connected = false;

  private static readonly MAX_RECONNECT_DELAY_MS = 30_000;
  private static readonly PING_INTERVAL_MS = 30_000;

  constructor(peerId: string, discovery: PeerDiscovery, displayName?: string) {
    super();
    this.peerId = peerId;
    this.discovery = discovery;
    this.displayName = displayName;
  }

  registerWindow(win: BrowserWindow): void {
    this.windows.add(win);
    win.on('closed', () => this.windows.delete(win));
  }

  start(): void {
    this._connect();
  }

  stop(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.ws?.close();
    this.ws = null;
    this.connected = false;
  }

  isConnected(): boolean { return this.connected; }

  sendToPeer(toPeerId: string, innerMsg: FedMsg): void {
    if (!this.connected || !this.ws) return;
    const envelope: FedMsg = {
      type: 'relay_route',
      peerId: this.peerId,
      payload: { toPeerId, innerMsg } as RelayRoutePayload,
      ts: new Date().toISOString(),
    };
    this.ws.send(JSON.stringify(envelope));
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private _connect(): void {
    try {
      // Use dynamic require so Electron can resolve ws from node_modules
      const WS = require('ws') as typeof import('ws');
      this.ws = new WS(RELAY_URL, {
        handshakeTimeout: 10_000,
        headers: { 'X-Mnemosyne-PeerId': this.peerId },
      });

      this.ws!.on('open', () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        console.log('[RelayClient] Connected to relay');
        this.emit('connected');

        this._send({
          type: 'relay_join',
          peerId: this.peerId,
          payload: { peerId: this.peerId, displayName: this.displayName } as RelayJoinPayload,
          ts: new Date().toISOString(),
        });

        this.pingTimer = setInterval(() => {
          this._send({ type: 'ping', peerId: this.peerId, ts: new Date().toISOString() });
        }, RelayClient.PING_INTERVAL_MS);

        this._broadcastState({ relayConnected: true });
      });

      this.ws!.on('message', (data: Buffer | string) => {
        try {
          const msg = JSON.parse(data.toString()) as FedMsg;
          this._handleMessage(msg);
        } catch { /* malformed */ }
      });

      this.ws!.on('close', () => {
        this.connected = false;
        if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
        this.emit('disconnected');
        this._broadcastState({ relayConnected: false });
        console.log('[RelayClient] Disconnected — will reconnect');
        this._scheduleReconnect();
      });

      this.ws!.on('error', (err: Error) => {
        console.warn('[RelayClient] WS error:', err.message);
      });

    } catch (err) {
      console.warn('[RelayClient] ws module unavailable:', err);
    }
  }

  private _handleMessage(msg: FedMsg): void {
    if (msg.type === 'pong') return;

    if (msg.type === 'relay_broadcast') {
      const payload = msg.payload as RelayBroadcastPayload;
      this._handleMessage(payload.innerMsg);
      return;
    }

    if (msg.type === 'relay_route') {
      const payload = msg.payload as RelayRoutePayload;
      this._handleMessage(payload.innerMsg);
      return;
    }

    if (msg.type === 'announce' || msg.type === 'identify' || msg.type === 'identify_ack') {
      const peer: MnemosynePeer = {
        peerId: msg.peerId,
        address: 'relay',
        port: 0,
        transport: 'wan-relay',
        phase: msg.type === 'identify_ack' ? 'identified' : 'discovered',
        lastSeen: new Date().toISOString(),
      };
      this.discovery.registerWANPeer(peer);

      if (msg.type === 'identify') {
        this.sendToPeer(msg.peerId, {
          type: 'identify_ack',
          peerId: this.peerId,
          payload: { peerId: this.peerId, version: '0.1.3', pubkeyFingerprint: this.peerId },
          ts: new Date().toISOString(),
        });
      }
    }

    if (msg.type === 'ratify') {
      const peer = this.discovery.getAllPeers().find((p) => p.peerId === msg.peerId);
      if (peer) {
        this.discovery.registerWANPeer({ ...peer, phase: 'ratified' });
        this.sendToPeer(msg.peerId, {
          type: 'ratify_ack',
          peerId: this.peerId,
          ts: new Date().toISOString(),
        });
      }
    }

    if (msg.type === 'ratify_ack') {
      const peer = this.discovery.getAllPeers().find((p) => p.peerId === msg.peerId);
      if (peer) {
        this.discovery.registerWANPeer({ ...peer, phase: 'synced' });
        console.log('[RelayClient] Peer reached SYNCED:', msg.peerId);
      }
    }
  }

  private _send(msg: FedMsg): void {
    if (this.ws && this.connected) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private _scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      RelayClient.MAX_RECONNECT_DELAY_MS,
    );
    console.log(`[RelayClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => this._connect(), delay);
  }

  private _broadcastState(state: Record<string, unknown>): void {
    for (const win of this.windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('relay-state-changed', state);
      }
    }
  }
}

export { RelayClient };
