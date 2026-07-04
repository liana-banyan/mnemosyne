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
