// ai-providers/types.ts — BP060 Application 002 Steps 3+4 · AI-agnostic provider types
// All provider clients implement ProviderClient interface.
// NO provider hardcoded as default in routing layer.
// decay_class: BETWEEN

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ProviderQueryArgs {
  model?: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
}

export interface ProviderResponse {
  ok: boolean;
  text?: string;
  model?: string;
  provider?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: string;
}

export interface ProviderClient {
  readonly provider_id: string;
  readonly display_name: string;
  query(args: ProviderQueryArgs): Promise<ProviderResponse>;
  is_configured(): boolean;
}

export interface CourtMapping {
  bishop: string;   // court member → provider_id
  rook: string;
  knight: string;
  pawn: string;
  local: string;    // default
}

export const DEFAULT_COURT_MAPPING: CourtMapping = {
  bishop: 'anthropic',
  rook: 'openai',
  knight: 'gemini',
  pawn: 'perplexity',
  local: 'local',
};
