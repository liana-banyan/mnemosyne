// Mnemosyne — Paired-Frame Mutual-Aid Layer
// BP072 Task 1 · canon_deaf_bishop_two_is_better_than_one_redundancy_proof_bp071
//
// Three scopes:
//   PF-1 — Persistent pairing model (consent-based, JSON persisted, one active partner max)
//   PF-2 — Heartbeat + deaf-detection (30 s ping, 3 missed → ASSIST_MODE)
//   PF-3 — Three assist modes behind `PAIRED_FRAME_ASSIST` flag:
//           (a) substrate-serve  — serve partner's SIDs from warm replica on port 11481
//           (b) inference-lend   — route deaf frame's ask→answer (STUBBED)
//           (c) state-mirror     — replicate partner's new Eblets (STUBBED)
//
// Transport:
//   LAN  — TCP on port LAN_ANNOUNCE_PORT (11481) — testable today
//   WAN  — RelayClient.sendToPeer (STUBBED; enable with PAIRED_FRAME_WAN_RELAY=1
//          once Founder deploys relay+resolver — DO NOT deploy GCP)
//
// substrate-blacklist: .claude/state/secrets/ excluded from all replication paths.

import { EventEmitter } from 'events';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { createConnection } from 'net';
import {
  FedMsg,
  MnemosynePeer,
  PairRequestPayload,
  PairAcceptPayload,
  PairRejectPayload,
  PairHeartbeatPayload,
  PairHeartbeatAckPayload,
  PairUnpairPayload,
  AssistSubstrateServePayload,
  AssistInferenceLendPayload,
  AssistStateMirrorPayload,
} from '../../shared/federation-protocol';
import type { PeerDiscovery } from './peer-discovery';
import type { RelayClient } from './relay-client';

// ─── Feature flags ───────────────────────────────────────────────────────────

/** PF-3 assist mode (all three sub-modes). Default ON; set PAIRED_FRAME_ASSIST=0 to disable. */
const ASSIST_MODE_ENABLED = process.env.PAIRED_FRAME_ASSIST !== '0';

/**
 * WAN relay transport. Default OFF until Founder deploys relay+resolver.
 * Set PAIRED_FRAME_WAN_RELAY=1 to enable after relay is live.
 * DO NOT deploy GCP infrastructure to enable this.
 */
const WAN_RELAY_ENABLED = process.env.PAIRED_FRAME_WAN_RELAY === '1';

// ─── Constants ────────────────────────────────────────────────────────────────

const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_MISSED_THRESHOLD = 3; // 3 consecutive windows (~90 s) → ASSIST_MODE
const PARTNER_CONTACT_GRACE_MULTIPLIER = 1.5; // missed if elapsed > interval × 1.5

/** Same root as FederationClient.FEDERATION_DATA_DIR — do not diverge. */
const FEDERATION_DATA_DIR = resolve(
  process.env.APPDATA || process.env.HOME || '.',
  'AMPLIFY Computer',
  'federation',
);
const PAIR_STATE_FILE = resolve(FEDERATION_DATA_DIR, 'pair_state.json');

// ─── Types ───────────────────────────────────────────────────────────────────

interface PersistedPairState {
  pairedPeerId: string | null;
  pairedAt: string | null;
  pairedDisplayName?: string;
}

export interface PairedFrameStatus {
  paired: boolean;
  pairedPeerId: string | null;
  pairedAt: string | null;
  pairedDisplayName?: string;
  assistModeActive: boolean;
  assistModeEnabled: boolean;
  missedHeartbeats: number;
  lastPartnerContactAt: string | null;
}

export interface PairedFrameManagerEvents {
  'paired': (peerId: string) => void;
  'unpaired': (peerId: string) => void;
  'pair-request-received': (info: { peerId: string; displayName?: string; requestedAt: string }) => void;
  'pair-rejected': (info: { peerId: string; reason?: string }) => void;
  'assist-mode-entered': (partnerId: string) => void;
  'assist-mode-exited': (partnerId: string | null) => void;
  'assist-inference-lend-stub': (info: { sessionId: string; requesterId: string }) => void;
  'assist-state-mirror-stub': (info: { dagId: string; emitterId: string }) => void;
}

declare interface PairedFrameManager {
  on<K extends keyof PairedFrameManagerEvents>(event: K, listener: PairedFrameManagerEvents[K]): this;
  emit<K extends keyof PairedFrameManagerEvents>(event: K, ...args: Parameters<PairedFrameManagerEvents[K]>): boolean;
}

// ─── PairedFrameManager ───────────────────────────────────────────────────────

class PairedFrameManager extends EventEmitter {
  private readonly ownPeerId: string;
  private readonly discovery: PeerDiscovery;
  private readonly relay: RelayClient;

  // PF-1 — persistent pair state
  private state: PersistedPairState = { pairedPeerId: null, pairedAt: null };

  // PF-2 — heartbeat / deaf-detection
  private assistModeActive = false;
  private missedHeartbeats = 0;
  private heartbeatSeq = 0;
  private lastPartnerContact = 0; // epoch ms; 0 = never
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(ownPeerId: string, discovery: PeerDiscovery, relay: RelayClient) {
    super();
    this.ownPeerId = ownPeerId;
    this.discovery = discovery;
    this.relay = relay;
    this._loadState();
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  start(): void {
    if (this.state.pairedPeerId) {
      this._startHeartbeat();
    }
    console.log(
      `[PairedFrameManager] Started. paired=${!!this.state.pairedPeerId} ` +
      `partner=${this.state.pairedPeerId ?? 'none'} assistMode=${ASSIST_MODE_ENABLED} wanRelay=${WAN_RELAY_ENABLED}`,
    );
  }

  stop(): void {
    this._stopHeartbeat();
    console.log('[PairedFrameManager] Stopped.');
  }

  // ─── PF-1: Public pairing API ─────────────────────────────────────────────

  /**
   * Send a pair_request to a discovered peer.
   * Consent is given on the recipient side via acceptPairing().
   */
  requestPairing(peerId: string, displayName?: string): void {
    console.log(`[PairedFrameManager] Requesting pairing with ${peerId}`);
    this._sendToPartnerById(peerId, {
      type: 'pair_request',
      peerId: this.ownPeerId,
      payload: {
        fromPeerId: this.ownPeerId,
        displayName,
        requestedAt: new Date().toISOString(),
      } satisfies PairRequestPayload,
      ts: new Date().toISOString(),
    });
  }

  /**
   * Consent to an inbound pair_request.
   * Persists state, starts heartbeat, sends pair_accept back.
   * At most one active partner — if already paired to another peer, rejects instead.
   */
  acceptPairing(peerId: string, displayName?: string): void {
    if (this.state.pairedPeerId && this.state.pairedPeerId !== peerId) {
      console.warn(
        `[PairedFrameManager] acceptPairing(${peerId}) rejected — already paired to ${this.state.pairedPeerId}`,
      );
      this.rejectPairing(peerId, 'already paired to another frame');
      return;
    }
    console.log(`[PairedFrameManager] Accepting pairing with ${peerId}`);
    this.state = {
      pairedPeerId: peerId,
      pairedAt: new Date().toISOString(),
      pairedDisplayName: displayName,
    };
    this._saveState();
    this._startHeartbeat();
    this._sendToPartnerById(peerId, {
      type: 'pair_accept',
      peerId: this.ownPeerId,
      payload: { fromPeerId: this.ownPeerId } satisfies PairAcceptPayload,
      ts: new Date().toISOString(),
    });
    this.emit('paired', peerId);
  }

  /** Decline an inbound pair_request. */
  rejectPairing(peerId: string, reason?: string): void {
    console.log(`[PairedFrameManager] Rejecting pairing with ${peerId}: ${reason ?? '(no reason)'}`);
    this._sendToPartnerById(peerId, {
      type: 'pair_reject',
      peerId: this.ownPeerId,
      payload: { fromPeerId: this.ownPeerId, reason } satisfies PairRejectPayload,
      ts: new Date().toISOString(),
    });
  }

  /** Dissolve the current pairing. Notifies partner and clears persisted state. */
  unpair(reason?: string): void {
    const partnerId = this.state.pairedPeerId;
    if (!partnerId) return;
    console.log(`[PairedFrameManager] Unpairing from ${partnerId}`);
    this._sendToPartnerById(partnerId, {
      type: 'pair_unpair',
      peerId: this.ownPeerId,
      payload: { fromPeerId: this.ownPeerId, reason } satisfies PairUnpairPayload,
      ts: new Date().toISOString(),
    });
    this._clearPairing();
    this.emit('unpaired', partnerId);
  }

  getStatus(): PairedFrameStatus {
    return {
      paired: !!this.state.pairedPeerId,
      pairedPeerId: this.state.pairedPeerId,
      pairedAt: this.state.pairedAt,
      pairedDisplayName: this.state.pairedDisplayName,
      assistModeActive: this.assistModeActive,
      assistModeEnabled: ASSIST_MODE_ENABLED,
      missedHeartbeats: this.missedHeartbeats,
      lastPartnerContactAt:
        this.lastPartnerContact > 0
          ? new Date(this.lastPartnerContact).toISOString()
          : null,
    };
  }

  /**
   * Route all inbound pair_* and assist_* messages here.
   * Called from both the RelayClient inbound hook and the FederationClient TCP inbound hook.
   */
  handleInbound(msg: FedMsg): void {
    switch (msg.type) {
      case 'pair_request':           return this._handlePairRequest(msg);
      case 'pair_accept':            return this._handlePairAccept(msg);
      case 'pair_reject':            return this._handlePairReject(msg);
      case 'pair_heartbeat':         return this._handlePairHeartbeat(msg);
      case 'pair_heartbeat_ack':     return this._handlePairHeartbeatAck(msg);
      case 'pair_unpair':            return this._handlePairUnpair(msg);
      case 'assist_substrate_serve': return this._handleAssistSubstrateServe(msg);
      case 'assist_inference_lend':  return this._handleAssistInferenceLend(msg);
      case 'assist_state_mirror':    return this._handleAssistStateMirror(msg);
    }
  }

  // ─── PF-2: Heartbeat (private) ────────────────────────────────────────────

  private _startHeartbeat(): void {
    this._stopHeartbeat();
    // Give partner a grace period equal to one full interval on startup
    this.lastPartnerContact = Date.now();
    this.missedHeartbeats = 0;
    this.heartbeatTimer = setInterval(
      () => this._onHeartbeatTick(),
      HEARTBEAT_INTERVAL_MS,
    );
  }

  private _stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.assistModeActive) {
      this.assistModeActive = false;
      this.emit('assist-mode-exited', this.state.pairedPeerId);
    }
  }

  private _onHeartbeatTick(): void {
    if (!this.state.pairedPeerId) return;

    const elapsed = Date.now() - this.lastPartnerContact;
    if (elapsed > HEARTBEAT_INTERVAL_MS * PARTNER_CONTACT_GRACE_MULTIPLIER) {
      this.missedHeartbeats++;
    } else {
      this.missedHeartbeats = 0;
    }

    // PF-2: deaf-detection threshold check
    if (ASSIST_MODE_ENABLED) {
      const shouldAssist = this.missedHeartbeats >= HEARTBEAT_MISSED_THRESHOLD;
      if (shouldAssist !== this.assistModeActive) {
        this.assistModeActive = shouldAssist;
        const evt = shouldAssist ? 'assist-mode-entered' : 'assist-mode-exited';
        this.emit(evt, this.state.pairedPeerId);
        console.log(
          `[PairedFrameManager] ASSIST_MODE ${shouldAssist ? 'ENTERED' : 'EXITED'} — ` +
          `partner=${this.state.pairedPeerId} missed=${this.missedHeartbeats}`,
        );
      }
    }

    // Send our own heartbeat
    this._sendToPartnerById(this.state.pairedPeerId, {
      type: 'pair_heartbeat',
      peerId: this.ownPeerId,
      payload: {
        fromPeerId: this.ownPeerId,
        seq: this.heartbeatSeq++,
      } satisfies PairHeartbeatPayload,
      ts: new Date().toISOString(),
    });
  }

  /** Record any contact from partner; exits ASSIST_MODE if currently active. */
  private _touchPartnerContact(): void {
    this.lastPartnerContact = Date.now();
    if (this.assistModeActive && ASSIST_MODE_ENABLED) {
      this.missedHeartbeats = 0;
      this.assistModeActive = false;
      this.emit('assist-mode-exited', this.state.pairedPeerId);
      console.log(
        `[PairedFrameManager] ASSIST_MODE EXITED — partner ${this.state.pairedPeerId} came back`,
      );
    }
  }

  // ─── PF-1: Message handlers ───────────────────────────────────────────────

  private _handlePairRequest(msg: FedMsg): void {
    const payload = msg.payload as PairRequestPayload;
    console.log(
      `[PairedFrameManager] pair_request from ${msg.peerId} (${payload.displayName ?? 'unnamed'})`,
    );
    this.emit('pair-request-received', {
      peerId: msg.peerId,
      displayName: payload.displayName,
      requestedAt: payload.requestedAt,
    });
  }

  private _handlePairAccept(msg: FedMsg): void {
    const payload = msg.payload as PairAcceptPayload;
    if (!this.state.pairedPeerId) {
      // We sent the request and the remote accepted — complete the binding
      this.state = {
        pairedPeerId: msg.peerId,
        pairedAt: new Date().toISOString(),
        pairedDisplayName: payload.displayName,
      };
      this._saveState();
      this._startHeartbeat();
      console.log(`[PairedFrameManager] Pairing confirmed with ${msg.peerId}`);
      this.emit('paired', msg.peerId);
    }
  }

  private _handlePairReject(msg: FedMsg): void {
    const payload = msg.payload as PairRejectPayload;
    console.log(
      `[PairedFrameManager] pair_reject from ${msg.peerId}: ${payload.reason ?? '(no reason)'}`,
    );
    this.emit('pair-rejected', { peerId: msg.peerId, reason: payload.reason });
  }

  private _handlePairHeartbeat(msg: FedMsg): void {
    if (msg.peerId !== this.state.pairedPeerId) return;
    const payload = msg.payload as PairHeartbeatPayload;
    this._touchPartnerContact();
    // Send ack via a new outbound connection (fire-and-forget)
    this._sendToPartnerById(msg.peerId, {
      type: 'pair_heartbeat_ack',
      peerId: this.ownPeerId,
      payload: { fromPeerId: this.ownPeerId, seq: payload.seq } satisfies PairHeartbeatAckPayload,
      ts: new Date().toISOString(),
    });
  }

  private _handlePairHeartbeatAck(msg: FedMsg): void {
    if (msg.peerId !== this.state.pairedPeerId) return;
    this._touchPartnerContact();
  }

  private _handlePairUnpair(msg: FedMsg): void {
    if (msg.peerId !== this.state.pairedPeerId) return;
    const payload = msg.payload as PairUnpairPayload;
    console.log(
      `[PairedFrameManager] pair_unpair from ${msg.peerId}: ${payload.reason ?? '(no reason)'}`,
    );
    this._clearPairing();
    this.emit('unpaired', msg.peerId);
  }

  // ─── PF-3: Assist mode handlers ───────────────────────────────────────────

  /**
   * PF-3a — substrate-serve
   * When ASSIST_MODE is active, answer /dag/fetch_from_peer requests for the deaf
   * partner's SIDs from our warm replica.  The actual SID serving is handled by the
   * existing FederationClient TCP server on port 11481 via dag_soccerball_lookup —
   * this handler is the pairing-layer trigger/log.
   */
  private _handleAssistSubstrateServe(msg: FedMsg): void {
    if (!ASSIST_MODE_ENABLED) return;
    const payload = msg.payload as AssistSubstrateServePayload;
    console.log(
      `[PairedFrameManager][PF-3a] assist_substrate_serve: dag_id=${payload.dag_id} ` +
      `requester=${payload.requester_peer_id} assistModeActive=${this.assistModeActive}`,
    );
    if (!this.assistModeActive) {
      console.warn(
        '[PairedFrameManager][PF-3a] assist_substrate_serve received but ASSIST_MODE not active — ignoring',
      );
    }
    // Warm-replica SID serving is handled transparently by the existing FederationClient
    // TCP server (port 11481).  The replica is populated by state-mirror (PF-3c, see below).
  }

  /**
   * PF-3b — inference-lend
   * Route the deaf frame's ask→answer to our local LLM.
   * STUBBED — actual OllamaManager.askFloorModel wiring deferred until relay deploy.
   * GATED on existing opt-in borrow-a-trusted-node consent (do not bypass).
   */
  private _handleAssistInferenceLend(msg: FedMsg): void {
    if (!ASSIST_MODE_ENABLED) return;
    const payload = msg.payload as AssistInferenceLendPayload;
    // TODO(BP072): wire to OllamaManager.askFloorModel and return result via relay once
    //              relay+resolver is deployed.  Consent check must precede dispatch.
    console.log(
      `[PairedFrameManager][PF-3b] assist_inference_lend STUB: ` +
      `session_id=${payload.session_id} requester=${payload.requester_peer_id} ` +
      `prompt_len=${payload.prompt?.length ?? 0}`,
    );
    this.emit('assist-inference-lend-stub', {
      sessionId: payload.session_id,
      requesterId: payload.requester_peer_id,
    });
  }

  /**
   * PF-3c — state-mirror
   * Continuously replicate partner's new Eblets so this frame is a warm standby.
   * STUBBED — trigger and message type wired; full Eblet replication is a TODO.
   * substrate-blacklist: .claude/state/secrets/ MUST be excluded from all replication.
   */
  private _handleAssistStateMirror(msg: FedMsg): void {
    if (!ASSIST_MODE_ENABLED) return;
    const payload = msg.payload as AssistStateMirrorPayload;
    // TODO(BP072): implement Eblet replication via dag_soccerball_emit once state-mirror
    //              scope is formally defined.  Any path under .claude/state/secrets/ is
    //              permanently excluded (substrate-blacklist).
    console.log(
      `[PairedFrameManager][PF-3c] assist_state_mirror STUB: ` +
      `dag_id=${payload.dag_id} emitter=${payload.emitter_peer_id}`,
    );
    this.emit('assist-state-mirror-stub', {
      dagId: payload.dag_id,
      emitterId: payload.emitter_peer_id,
    });
  }

  // ─── Transport ────────────────────────────────────────────────────────────

  private _sendToPartnerById(peerId: string, msg: FedMsg): void {
    const peer = this.discovery.getAllPeers().find((p) => p.peerId === peerId);

    if (peer?.transport === 'lan') {
      this._sendViaTCP(peer, msg);
      return;
    }

    if (WAN_RELAY_ENABLED && this.relay.isConnected()) {
      // WAN relay path — active only when PAIRED_FRAME_WAN_RELAY=1
      console.log(`[PairedFrameManager] WAN relay send: type=${msg.type} to=${peerId}`);
      this.relay.sendToPeer(peerId, msg);
      return;
    }

    // WAN relay not yet deployed — log quietly in dev, silently in prod
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        `[PairedFrameManager] No transport for ${peerId} (type=${msg.type}); ` +
        `wanRelayEnabled=${WAN_RELAY_ENABLED} relayConnected=${this.relay.isConnected()}`,
      );
    }
  }

  private _sendViaTCP(peer: MnemosynePeer, msg: FedMsg): void {
    const sock = createConnection({ host: peer.address, port: peer.port, timeout: 3000 }, () => {
      sock.write(JSON.stringify(msg) + '\n');
      sock.end();
    });
    sock.on('error', (err) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          `[PairedFrameManager] TCP send failed ${peer.address}:${peer.port} (${msg.type}): ${err.message}`,
        );
      }
    });
  }

  // ─── State / persistence ──────────────────────────────────────────────────

  private _clearPairing(): void {
    this._stopHeartbeat();
    this.missedHeartbeats = 0;
    this.lastPartnerContact = 0;
    this.heartbeatSeq = 0;
    this.state = { pairedPeerId: null, pairedAt: null };
    this._saveState();
  }

  private _loadState(): void {
    if (!existsSync(PAIR_STATE_FILE)) return;
    try {
      this.state = JSON.parse(readFileSync(PAIR_STATE_FILE, 'utf-8')) as PersistedPairState;
      if (this.state.pairedPeerId) {
        console.log(
          `[PairedFrameManager] Loaded persisted pair: partner=${this.state.pairedPeerId} ` +
          `since=${this.state.pairedAt ?? 'unknown'}`,
        );
      }
    } catch {
      this.state = { pairedPeerId: null, pairedAt: null };
    }
  }

  private _saveState(): void {
    try {
      mkdirSync(FEDERATION_DATA_DIR, { recursive: true });
      writeFileSync(PAIR_STATE_FILE, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[PairedFrameManager] Failed to persist pair state:', err);
    }
  }
}

export { PairedFrameManager };
