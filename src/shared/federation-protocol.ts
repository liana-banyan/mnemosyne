// Mnemosyne Federation Protocol — Shared Types
// MV-CN Cross-Network Mesh Discovery · SAGA 3 BP045 W1
//
// Four-frame topology: Wife · Founder · Daughter · Son
// LAN peers: mDNS/UDP multicast (_mnemosyne._tcp.local.)
// WAN peers: WebSocket relay at wss://relay.mnemosynec.ai

export const MNEMOSYNE_SERVICE_NAME = '_mnemosyne._tcp.local.';
export const LAN_ANNOUNCE_PORT = Number(process.env.PEER_ANNOUNCE_PORT ?? 11481);
export const LAN_MULTICAST_ADDR = '224.0.0.251';
export const LAN_MULTICAST_PORT = 5354;
export const RELAY_URL = 'wss://relay.mnemosynec.ai';
export const RELAY_HTTP_URL = 'https://relay.mnemosynec.ai';
export const FOUR_FRAME_COLLECTOR_PATH = '/4frame';

// ─── Peer handshake phases ─────────────────────────────────────────────────

export type PeerPhase = 'discovered' | 'identified' | 'ratified' | 'synced' | 'error';
export type PeerTransport = 'lan' | 'wan-relay';

export interface MnemosynePeer {
  peerId: string;
  displayName?: string;
  address: string;
  port: number;
  transport: PeerTransport;
  phase: PeerPhase;
  lastSeen: string;
  recordCount?: number;
  relaySessionId?: string;
}

// ─── Wire messages ────────────────────────────────────────────────────────

export type FedMsgType =
  | 'announce'       // LAN UDP broadcast: "I am Mnemosyne peerId X at addr:port"
  | 'identify'       // WS handshake step 1: share peerId + pubkey fingerprint
  | 'identify_ack'   // WS handshake step 2: confirm + return own identity
  | 'ratify'         // Join the mesh: add me to your peer set
  | 'ratify_ack'     // Confirmed in mesh
  | 'sync_request'   // Exchange record IDs
  | 'sync_response'  // Send records peer doesn't have
  | 'relay_join'     // Tell relay server: I am peerId X
  | 'relay_route'    // Relay envelope: from → to → payload
  | 'relay_broadcast'// Relay envelope: from → all connected peers
  | 'ping'
  | 'pong'
  | 'sid_fetch_request'   // Requester → holder: "do you have dag_id X?"
  | 'sid_fetch_response'  // Holder → requester: full DagNode or null
  | 'pointer_advance'     // Emitter → all peers: "root dag_id pointer moved from old→new"
  // BP072 — Paired-Frame Mutual-Aid (PF-1/2/3)
  | 'pair_request'         // A→B: consent-gated binding proposal
  | 'pair_accept'          // B→A: binding accepted; both sides persist state
  | 'pair_reject'          // B→A: binding declined
  | 'pair_heartbeat'       // A↔B: liveness ping (30 s interval)
  | 'pair_heartbeat_ack'   // B→A: explicit heartbeat acknowledgement
  | 'pair_unpair'          // A→B: dissolve current pairing
  | 'assist_substrate_serve'  // PF-3a: healthy→deaf: serve SIDs from warm replica
  | 'assist_inference_lend'   // PF-3b: route deaf frame's ask→answer (STUBBED)
  | 'assist_state_mirror'     // PF-3c: replicate new Eblets to partner (STUBBED)
  // BP087 MAMBA-Row3: Substrace theorem mesh routing re-weave dispatch
  | 'substrace_wake'          // Origin→target: re-weave wake with manifest
  | 'substrace_wake_complete';// Target→origin: manifest fully resolved + items returned

export interface FedMsg {
  type: FedMsgType;
  peerId: string;
  payload?: unknown;
  ts: string;
}

export interface AnnouncePayload {
  peerId: string;
  port: number;
  version: string;
  displayName?: string;
}

export interface IdentifyPayload {
  peerId: string;
  version: string;
  displayName?: string;
  pubkeyFingerprint: string;
}

export interface SyncRequestPayload {
  recordIds: string[];
}

export interface SyncResponsePayload {
  records: Array<{ id: string; text: string; source: string; keywords: string[]; ts: string }>;
}

export interface RelayJoinPayload {
  peerId: string;
  displayName?: string;
}

export interface RelayRoutePayload {
  toPeerId: string;
  innerMsg: FedMsg;
}

export interface RelayBroadcastPayload {
  innerMsg: FedMsg;
}

// ─── MESH-6: SID-targeted peer fetch + pointer-advance payloads ────────────

export interface SidFetchRequestPayload {
  dag_id: string;                // 32-char target dag_id
  requester_peer_id: string;
}

export interface SidFetchResponsePayload {
  dag_id: string;                // echo of the requested dag_id
  found: boolean;
  node?: {                       // only present when found === true
    id: string;
    pearls: string[];
    bindings: Record<string, string>;
    faces: Record<string, string>;
    depth: number;
    ts: number;
  };
  holder_peer_id: string;
}

export interface PointerAdvancePayload {
  old_dag_id: string | null;     // null on first emit
  new_dag_id: string;
  pointer_label: string;         // human tag e.g. "session-root"
  emitter_peer_id: string;
  advanced_at: string;           // ISO-8601 UTC
}

// ─── BP072 — Paired-Frame Mutual-Aid payloads ──────────────────────────────

export interface PairRequestPayload {
  fromPeerId: string;
  displayName?: string;
  requestedAt: string;
}

export interface PairAcceptPayload {
  fromPeerId: string;
  displayName?: string;
}

export interface PairRejectPayload {
  fromPeerId: string;
  reason?: string;
}

export interface PairHeartbeatPayload {
  fromPeerId: string;
  seq: number;
}

export interface PairHeartbeatAckPayload {
  fromPeerId: string;
  seq: number;
}

export interface PairUnpairPayload {
  fromPeerId: string;
  reason?: string;
}

export interface AssistSubstrateServePayload {
  dag_id: string;
  requester_peer_id: string;
}

export interface AssistInferenceLendPayload {
  prompt: string;
  requester_peer_id: string;
  session_id: string;
}

export interface AssistStateMirrorPayload {
  dag_id: string;
  emitter_peer_id: string;
}

// ─── 4-Frame telemetry ─────────────────────────────────────────────────────

export type FrameIndex = 1 | 2 | 3 | 4;

export interface FourFrameEvent {
  sessionId: string;
  frame: FrameIndex;
  peerId: string;
  status: PeerPhase;
  timestamp: string;
  networkType?: 'lan' | 'wan';
  deviceHint?: string;
}
