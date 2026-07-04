/**
 * WAN Relay Server -- Wave 2 / Phase alpha (BP073)
 * =================================================
 * Node.js/WebSocket relay server for the Mnemosyne cooperative mesh.
 * Stand-alone: can run as a separate process or embedded in the main process.
 *
 * Protocol summary:
 *   relay_join     -> register peerId in registry
 *   relay_leave    -> deregister peerId
 *   relay_route    -> forward message to target peerId
 *   relay_auth     -> authenticate with token
 *   ping           -> respond with pong
 *   relay_health   -> respond with server health stats
 *
 * Cost: server-side compute ~$0.001/signaling-hop (not charged to peers directly;
 * disclosed in per-hop telemetry).
 *
 * Requires: npm package 'ws' (already in Electron deps).
 */

import { EventEmitter } from "events";

// ─── Types (inlined to avoid circular deps with platform lib) ─────────────────

export interface RelayServerConfig {
  port: number;
  authMode: "open" | "token" | "allowlist";
  sharedSecret?: string;
  allowedPeerIds?: string[];
  maxPeers?: number;
  pingIntervalMs?: number;
}

interface RegisteredPeer {
  peerId: string;
  displayName?: string;
  authenticated: boolean;
  connectedAt: string;
  socket: unknown; // WebSocket
  pingTimer?: ReturnType<typeof setInterval>;
}

export const DEFAULT_RELAY_SERVER_CONFIG: RelayServerConfig = {
  port: 8787,
  authMode: "open",
  maxPeers: 500,
  pingIntervalMs: 30_000,
};

// ─── Relay Server ─────────────────────────────────────────────────────────────

export class RelayServer extends EventEmitter {
  private readonly config: RelayServerConfig;
  private server: unknown = null; // WebSocket.Server
  private readonly peers = new Map<string, RegisteredPeer>();
  private readonly startedAt = Date.now();
  private running = false;

  constructor(config: RelayServerConfig = DEFAULT_RELAY_SERVER_CONFIG) {
    super();
    this.config = { ...DEFAULT_RELAY_SERVER_CONFIG, ...config };
  }

  /** Start the relay server on the configured port. */
  start(): void {
    try {
      const WS = require("ws") as typeof import("ws");
      const wss = new WS.Server({ port: this.config.port });
      this.server = wss;
      this.running = true;

      console.log(`[RelayServer] Listening on ws://0.0.0.0:${this.config.port}`);
      this.emit("started", { port: this.config.port });

      wss.on("connection", (ws: import("ws"), req: import("http").IncomingMessage) => {
        this._handleConnection(ws, req);
      });

      wss.on("error", (err: Error) => {
        console.error("[RelayServer] Server error:", err.message);
        this.emit("error", err);
      });

    } catch (err) {
      console.error("[RelayServer] Failed to start:", err);
      this.running = false;
    }
  }

  /** Stop the relay server and disconnect all peers. */
  stop(): void {
    this.running = false;
    for (const [peerId] of this.peers) {
      this._cleanupPeer(peerId);
    }
    (this.server as any)?.close();
    this.server = null;
    this.emit("stopped");
    console.log("[RelayServer] Stopped.");
  }

  isRunning(): boolean {
    return this.running;
  }

  connectedPeerCount(): number {
    return this.peers.size;
  }

  // ─── Connection handling ───────────────────────────────────────────────────

  private _handleConnection(ws: import("ws"), req: import("http").IncomingMessage): void {
    const maxPeers = this.config.maxPeers ?? 500;
    if (this.peers.size >= maxPeers) {
      ws.close(1013, "Relay at capacity");
      return;
    }

    // Extract peerId from header (may be overridden on relay_join)
    const peerId = (req.headers["x-mnemosyne-peerid"] as string) || `anon-${Date.now()}`;

    ws.on("message", (data: Buffer | string) => {
      try {
        const msg = JSON.parse(data.toString());
        this._handleMessage(peerId, ws, msg);
      } catch {
        // malformed
      }
    });

    ws.on("close", () => {
      this._cleanupPeer(peerId);
      this._broadcastPeerList();
    });

    ws.on("error", (err: Error) => {
      console.warn(`[RelayServer] Socket error for ${peerId}:`, err.message);
    });
  }

  private _handleMessage(peerId: string, ws: unknown, msg: Record<string, unknown>): void {
    const type = msg.type as string;
    const msgPeerId = (msg.peerId as string) || peerId;

    switch (type) {
      case "relay_join": {
        const payload = msg.payload as { peerId: string; displayName?: string; authToken?: string };
        const joinPeerId = payload?.peerId ?? msgPeerId;
        const authResult = this._authenticate(joinPeerId, payload?.authToken);

        this.peers.set(joinPeerId, {
          peerId: joinPeerId,
          displayName: payload?.displayName,
          authenticated: authResult.accepted,
          connectedAt: new Date().toISOString(),
          socket: ws,
        });

        // Respond with auth ack
        this._send(ws, {
          type: "relay_auth_ack",
          peerId: "relay-server",
          payload: authResult,
          ts: new Date().toISOString(),
        });

        // Send current peer list to the joining peer
        this._send(ws, {
          type: "relay_peer_list",
          peerId: "relay-server",
          payload: { peers: this._peerSnapshot() },
          ts: new Date().toISOString(),
        });

        this._broadcastPeerList();
        this.emit("peer-joined", joinPeerId);
        console.log(`[RelayServer] Peer joined: ${joinPeerId} (auth: ${authResult.accepted})`);
        break;
      }

      case "relay_leave": {
        this._cleanupPeer(msgPeerId);
        this._broadcastPeerList();
        break;
      }

      case "relay_route": {
        const payload = msg.payload as { toPeerId: string; innerMsg: unknown };
        const target = this.peers.get(payload?.toPeerId);
        if (target) {
          this._send(target.socket, {
            type: "relay_route",
            peerId: msgPeerId,
            payload: msg.payload,
            ts: new Date().toISOString(),
          });
          this.emit("message-routed", { from: msgPeerId, to: payload.toPeerId });
        } else {
          // Target not found; notify sender
          this._send(ws, {
            type: "relay_route",
            peerId: "relay-server",
            payload: { error: "TARGET_NOT_FOUND", toPeerId: payload?.toPeerId },
            ts: new Date().toISOString(),
          });
        }
        break;
      }

      case "ping": {
        this._send(ws, {
          type: "pong",
          peerId: "relay-server",
          ts: new Date().toISOString(),
        });
        break;
      }

      case "relay_health": {
        this._send(ws, {
          type: "relay_health_ack",
          peerId: "relay-server",
          payload: {
            relayVersion: "0.2.0-bp073",
            connectedPeers: this.peers.size,
            uptimeMs: Date.now() - this.startedAt,
            serverTs: new Date().toISOString(),
          },
          ts: new Date().toISOString(),
        });
        break;
      }

      default:
        break;
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private _authenticate(peerId: string, token?: string): { accepted: boolean; reason?: string; sessionId: string } {
    const sessionId = `relay-${Date.now()}-${peerId.slice(0, 8)}`;

    if (this.config.authMode === "open") {
      return { accepted: true, sessionId };
    }

    if (this.config.authMode === "allowlist") {
      const allowed = this.config.allowedPeerIds ?? [];
      return allowed.includes(peerId)
        ? { accepted: true, sessionId }
        : { accepted: false, reason: "Not in allowlist", sessionId: "" };
    }

    // Token mode
    if (!token) return { accepted: false, reason: "Missing token", sessionId: "" };
    const expected = this._computeToken(peerId);
    return token === expected
      ? { accepted: true, sessionId }
      : { accepted: false, reason: "Invalid token", sessionId: "" };
  }

  private _computeToken(peerId: string): string {
    const secret = this.config.sharedSecret ?? "mnemosyne-relay-secret";
    let hash = 0;
    const input = `${peerId}:${secret}`;
    for (let i = 0; i < input.length; i++) {
      hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
  }

  private _broadcastPeerList(): void {
    const snapshot = this._peerSnapshot();
    const msg = {
      type: "relay_broadcast",
      peerId: "relay-server",
      payload: { peers: snapshot, broadcastAt: new Date().toISOString() },
      ts: new Date().toISOString(),
    };
    for (const [, peer] of this.peers) {
      this._send(peer.socket, msg);
    }
  }

  private _peerSnapshot(): Array<{ peerId: string; displayName?: string; connectedAt: string; authenticated: boolean }> {
    return [...this.peers.values()].map(({ peerId, displayName, connectedAt, authenticated }) => ({
      peerId,
      displayName,
      connectedAt,
      authenticated,
    }));
  }

  private _cleanupPeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer?.pingTimer) clearInterval(peer.pingTimer);
    this.peers.delete(peerId);
    this.emit("peer-left", peerId);
  }

  private _send(socket: unknown, msg: unknown): void {
    const ws = socket as import("ws");
    if (ws && (ws as any).readyState === 1 /* OPEN */) {
      ws.send(JSON.stringify(msg));
    }
  }
}
