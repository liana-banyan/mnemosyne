/**
 * types.ts -- Mountain 2 · Shared scribe type definitions
 *
 * BP089 · Knight Marathon 5 · Persistent SEG Scribes
 * Statute binding: §3 §14 §15 §16 §17
 * Scope: src/main/scribes/
 *
 * All types used across reminder_scribe, wrasse_injector, toolsmith_scribe,
 * scribe_runner, and associated smoke-test fixtures.
 */

// ---------------------------------------------------------------------------
// Dispatch -- the unit of content that scribes scan
// ---------------------------------------------------------------------------

export interface Dispatch {
  /** Unique dispatch identifier */
  id: string;
  /** Agent id that authored this dispatch */
  agentId: string;
  /** Dispatch text body to be scanned */
  text: string;
  /** ISO timestamp of dispatch creation */
  createdAt: string;
  /** Optional channel the dispatch was routed to */
  channel?: string;
  /** Optional metadata bag */
  meta?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// ViolationCandidate -- returned by CanonCorpus.checkViolations
// ---------------------------------------------------------------------------

export interface ViolationCandidate {
  /** Canonical id of the rule / eblet that may be violated */
  canonId: string;
  /** Human-readable description of the potential violation */
  description: string;
  /** Suggested correction text */
  correction: string;
  /** 0–1 confidence score from corpus pre-scan */
  confidence: number;
  /** Stable hash of (canonId + dispatch.id) for vote-log deduplication */
  hash: string;
}

// ---------------------------------------------------------------------------
// Council vote log row
// ---------------------------------------------------------------------------

export interface CouncilVoteRow {
  scribeId: string;
  /** Hash of the dispatch text + canonId being evaluated */
  questionHash: string;
  /** Raw vote tuples from EnforcementCouncil.vote() */
  memberVotes: import('../enforcement_council/enforcement_council').CouncilVoteTuple[];
  /** True if 2-of-3 or 3-of-3 flagged */
  consensusYn: boolean;
  /** Pearl emitted as result of this vote, if any */
  pearlId: string | null;
}

// ---------------------------------------------------------------------------
// Drift watch row (1-of-3 low-confidence flag)
// ---------------------------------------------------------------------------

export interface DriftWatchRow {
  scribeId: string;
  /** Hash of the dispatch under review */
  questionHash: string;
  /** [seatA, seatB, seatC] boolean flags */
  memberVotes: [boolean, boolean, boolean];
  /** Canon or statute suspected by the lone flagging member */
  canonId: string;
  /** Agent id of the dispatch being watched */
  dispatchId: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Ip-ledger registration row
// ---------------------------------------------------------------------------

export interface ScribeIdentityRow {
  key: string;
  role: 'reminder_scribe' | 'wrasse_injector' | 'toolsmith_scribe';
  model: string;
  bootTime: number;
}
