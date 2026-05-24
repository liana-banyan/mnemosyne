// B83a — Hearth Conjunction Window — Shared Types (main process)
// Founder-coined: "In Conjunction" / "Hearth Conjunction Window" / "HEAVY BOOSTER TEST"

export type ConjunctionMode =
  | 'cpu_only'        // Rule-based / regex / local-substrate-only; no model spend
  | 'ollama'          // Local Ollama llama3.1:8b-instruct-q4_K_M default
  | 'knight_cursor'   // Routes to Knight via Yoke file bridge (best-effort async)
  | 'opus_claude'     // Routes to Opus via Anthropic API (claude-opus-4-7)
  | 'all_in_conjunction'; // Parallel fan-out to all 4 + fan-in synthesis

export interface ConjunctionPanelState {
  selected: ConjunctionMode;
  per_request_override: ConjunctionMode | null; // resets after one dispatch
  last_dispatch: {
    mode: ConjunctionMode;
    ts: string;
    latency_ms: number;
    success: boolean;
  } | null;
  in_flight: { mode: ConjunctionMode; started_at: string } | null;
}

export interface BackendAvailability {
  cpu_only: true;
  ollama: boolean;
  knight_cursor: boolean;
  opus_claude: boolean;
}

export interface AdapterReceipt {
  name: ConjunctionMode;
  result: string | null;
  error: string | null;
  latency_ms: number;
  cost_usd?: number;
  tokens?: { in: number; out: number };
}

export interface ConjunctionResult {
  dispatch_id: string;
  routed_to: ConjunctionMode[];
  receipts: AdapterReceipt[];
  synthesized: string | null;
  synthesizer_mode: SynthesizerMode;
  total_latency_ms: number;
}

export type SynthesizerMode =
  | 'composite_with_provenance'
  | 'best_of_n'
  | 'consensus_extract'
  | 'single'; // when only one backend dispatched

// SE-4 conformant receipt envelope
export interface ConjunctionReceiptEnvelope {
  ts: string;           // ISO 8601
  dispatch_id: string;  // UUID
  mode: ConjunctionMode;
  prompt_hash: string;  // SHA-256 of prompt
  adapters: {
    name: string;
    result_present: boolean;
    latency_ms: number;
    error: string | null;
    cost_usd: number;
  }[];
  synthesizer_mode: string;
  synthesized_present: boolean;
  lamport_clock: number; // monotonically increasing
  session_id: string;
}
