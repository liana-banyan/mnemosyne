// types.ts -- AI Provider interface contracts (BP060 Application 002 Steps 3+4)
// All provider clients (local, anthropic, future frontier) implement ProviderClient.

export interface ProviderMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ProviderQueryArgs {
  messages: ProviderMessage[];
  model?: string;
  max_tokens?: number;
  temperature?: number;
  court_member?: string;
}

export interface ProviderResponse {
  ok: boolean;
  text?: string;
  model?: string;
  provider: string;
  error?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

export interface ProviderClient {
  readonly provider_id: string;
  readonly display_name: string;
  is_configured(): boolean;
  query(args: ProviderQueryArgs): Promise<ProviderResponse>;
}

// BP132 (fix-forward): court-router.ts referenced CourtMapping/DEFAULT_COURT_MAPPING
// before either existed here, which broke `tsc -p tsconfig.main.json`. Maps each Court
// member to a provider_id (see court-router.ts getClientForProvider for the valid set:
// 'local' | 'anthropic' | 'openai' | 'gemini' | 'perplexity').
// AI-agnostic by construction (file header, line 5): default = 'local' for every seat,
// cooperative-class compute-ownership doctrine -- no provider hardcoded as default.
export interface CourtMapping {
  bishop: string;
  rook: string;
  knight: string;
  pawn: string;
  local: string;
}

export const DEFAULT_COURT_MAPPING: CourtMapping = {
  bishop: 'local',
  rook: 'local',
  knight: 'local',
  pawn: 'local',
  local: 'local',
};
