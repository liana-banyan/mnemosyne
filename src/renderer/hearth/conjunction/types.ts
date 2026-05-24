// SAGA 4 BP041 — In Conjunction 8-Agent Panel — Renderer-Side Types
// Replaces fixed 4-mode roster with extensible InConjunctionAgent[] array.
// ConjunctionMode kept as alias for backward compat with conjunction_router.

// ─── Agent identity ───────────────────────────────────────────────────────────

export type ConjunctionAgentId =
  | 'cpu_only'
  | 'hearth'
  | 'pawn'
  | 'rook'
  | 'bishop'
  | 'knight'
  | 'browser_ai'
  | 'all_in_conjunction'
  | string; // extensible: third-party plugins register their own IDs

/** Backward-compat alias used by conjunction_router and older IPC surfaces */
export type ConjunctionMode = ConjunctionAgentId;

// ─── Tier system ──────────────────────────────────────────────────────────────

export type TierClass = 'flagship' | 'balanced' | 'cheap';

export interface AgentTier {
  id: string;
  /** Member-facing label, e.g. "🔥 Opus 4.7" */
  label: string;
  tierClass: TierClass;
  /** API model identifier, e.g. "claude-opus-4-7" */
  modelId: string;
}

/** Per-agent persisted tier choice — saved to ~/.lb_substrate/in_conjunction_tiers.json */
export type TierChoiceMap = Record<string, string>; // agentId → tier id

// ─── Probe / availability ─────────────────────────────────────────────────────

export type AgentProbeStatus =
  | 'unknown'     // never checked
  | 'probing'     // spinner in flight
  | 'available'   // green dot
  | 'unavailable' // red X — endpoint failed
  | 'missing_key';// orange — API key not configured

export interface AgentProbeResult {
  agentId: ConjunctionAgentId;
  status: AgentProbeStatus;
  reason?: string;
  probed_at?: string;
}

// ─── Agent descriptor ─────────────────────────────────────────────────────────

export interface InConjunctionAgent {
  id: ConjunctionAgentId;
  displayName: string;
  /** Helena-pedagogy subtitle — answers "what is this?" inline */
  subtitle: string;
  icon: string;
  /** Optional tier array; absent = no model-spend dropdown */
  tiers?: AgentTier[];
  /**
   * Agents that never go unavailable (cpu_only, browser_ai, all_in_conjunction).
   * When true, probe is skipped and status dot stays green.
   */
  alwaysAvailable?: boolean;
  /**
   * env-var name this agent needs to function.
   * Absence → missing_key status until key is set via Settings.
   * e.g. "ANTHROPIC_API_KEY", "PERPLEXITY_API_KEY"
   */
  requiresKey?: string;
  /** Source of record: 'builtin' | 'plugin' */
  source?: 'builtin' | 'plugin';
}

// ─── Panel state ──────────────────────────────────────────────────────────────

export interface ConjunctionPanelState {
  selected: ConjunctionAgentId;
  per_request_override: ConjunctionAgentId | null;
  last_dispatch: {
    mode: ConjunctionAgentId;
    ts: string;
    latency_ms: number;
    success: boolean;
  } | null;
  in_flight: { mode: ConjunctionAgentId; started_at: string } | null;
}

// ─── Dispatch result types ────────────────────────────────────────────────────

export interface AdapterReceipt {
  name: ConjunctionAgentId;
  result: string | null;
  error: string | null;
  latency_ms: number;
  cost_usd?: number;
  tokens?: { in: number; out: number };
}

export interface ConjunctionResult {
  dispatch_id: string;
  routed_to: ConjunctionAgentId[];
  receipts: AdapterReceipt[];
  synthesized: string | null;
  synthesizer_mode: string;
  total_latency_ms: number;
}

// ─── Availability map (keyed by agentId) ─────────────────────────────────────

export type BackendAvailability = Record<string, boolean>;

// ─── API Key status (R16 — values never exposed to renderer) ─────────────────

/** Only the presence/absence of a key is surfaced to renderer, never the value */
export type ApiKeyStatusMap = Record<string, boolean>; // agentId → isSet
