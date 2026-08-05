/**
 * mic_types.ts — MIC (Machine In Charge) v0.4.0 BP083
 *
 * Canonical types for the MIC Conductor role and Constellation peer model.
 * MIC distributes domain-class work units across Constellation peers.
 *
 * SCAFFOLD v0.4.0 — Thorax encryption + Socceri transport deferred to v0.4.1.
 * Transport layer: HTTP scaffold (peer_server.ts port 7474).
 */

export type MicState =
  | 'idle'
  | 'electing'
  | 'dispatching'
  | 'aggregating'
  | 'finalizing'
  | 'error';

export interface ConstellationPeer {
  id: string;
  address: string;        // IP:port e.g. "192.168.1.5:7474"
  name: string;           // human-readable label e.g. "M5-Son"
  online: boolean;
  lastSeen: number;       // epoch ms
  cpuCapacity: number;    // 0-1 (estimated idle fraction)
  ollamaModel: string | null;
  installedDomains: string[];   // which domain Chocolates are installed
  pendingWorkload: number;      // domains currently assigned to this peer
  /** KN-BP144-16 Phase 1: this peer's Thorax Ed25519 public key, learned from a signature-
   *  verified UDP beacon announcement (constellation_discovery.ts). Undefined for a peer never
   *  seen via a verified announce (manually added, or seen only via an unauthenticated/legacy
   *  beacon) -- callers must not assume presence. Never itself proof of continuity/identity
   *  beyond "this announcement was signed by whoever holds the matching private key" (trust-on-
   *  first-use) -- see announce_frame.ts's doc comment. */
  public_key_hex?: string;
  /** KN-BP144-16 Phase 1: whether the MOST RECENT beacon from this peer verified successfully.
   *  'verified' | 'unauthenticated' | 'unknown' (never seen an announce from this peer at all,
   *  e.g. manually added via mic:add-peer). */
  thorax_announce_status?: 'verified' | 'unauthenticated' | 'unknown';
}

export interface DomainWorkUnit {
  domain: string;
  questions: string[];
  assignedTo: string | null;    // peer ID or 'self'
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  ebletCount: number;
  andonEvents: number;
  startedAt?: number;
  completedAt?: number;
  errorMessage?: string;
}

export interface MicWorkload {
  id: string;
  micId: string;          // which peer is the MIC (conductor)
  domains: DomainWorkUnit[];
  peers: ConstellationPeer[];
  selfId: string;
  startTime: number;
  totalEblets: number;
  status: MicState;
  estimatedWallClockMs?: number;
}

export interface PeerPlowResult {
  peerId: string;
  domain: string;
  ebletsWritten: number;
  quarantined: number;
  andonEvents: number;
  status: 'green' | 'yellow' | 'red';
  error?: string;
}

export interface MicAggregatedResult {
  workloadId: string;
  totalEbletsWritten: number;
  totalQuarantined: number;
  totalAndonEvents: number;
  peerResults: PeerPlowResult[];
  selfResults: PeerPlowResult[];
  overallStatus: 'GREEN' | 'YELLOW' | 'RED';
  completedAt: number;
}

export interface MicStartPayload {
  domains: string[];
  questionsPerDomain: number;
  ollamaBaseUrl?: string;
  model?: string;
}

export interface MicStatusEvent {
  type:
    | 'mic-start'
    | 'peer-discovered'
    | 'workload-partitioned'
    | 'dispatch-sent'
    | 'peer-progress'
    | 'peer-complete'
    | 'peer-failed'
    | 'self-progress'
    | 'aggregating'
    | 'complete'
    | 'error';
  workloadId?: string;
  peerId?: string;
  domain?: string;
  message?: string;
  workload?: MicWorkload;
  result?: MicAggregatedResult;
}
