// Mnemosyne Federation Protocol — Shared Types
// MV-CN Cross-Network Mesh Discovery · SAGA 3 BP045 W1
//
// Four-frame topology: Wife · Founder · Daughter · Son
// LAN peers: mDNS/UDP multicast (_mnemosyne._tcp.local.)
// WAN peers: WebSocket relay at wss://relay.mnemosynec.ai

export const MNEMOSYNE_SERVICE_NAME = '_mnemosyne._tcp.local.';
export const LAN_ANNOUNCE_PORT = 11481;
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
  | 'pong';

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
