// openai-client.ts — BP060 Application 002 Steps 3+4 · Court: Rook
// Uses raw fetch to https://api.openai.com/v1/chat/completions — no SDK dependency required.
// Court mapping: Rook = gpt-4.5 or best available per Founder verbatim BP059.
// decay_class: BETWEEN

import type { ProviderClient, ProviderQueryArgs, ProviderResponse } from './types';

const OPENAI_BASE = 'https://api.openai.com/v1';
const ROOK_DEFAULT_MODEL = 'gpt-4.5'; // Founder verbatim · Rook = GPT 5.5 or lower fallback

export class OpenAIClient implements ProviderClient {
  readonly provider_id = 'openai';
  readonly display_name = 'OpenAI (Rook)';

  private apiKey: string | null;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env['OPENAI_API_KEY'] || null;
  }

  is_configured(): boolean {
    return !!this.apiKey;
  }

  async query(args: ProviderQueryArgs): Promise<ProviderResponse> {
    if (!this.apiKey) {
      return { ok: false, provider: this.provider_id, error: 'OPENAI_API_KEY not set' };
    }

    const model = args.model || ROOK_DEFAULT_MODEL;

    try {
      const resp = await fetch(`${OPENAI_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: args.messages,
          max_tokens: args.max_tokens ?? 2048,
          temperature: args.temperature ?? 0.7,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => resp.statusText);
        return { ok: false, provider: this.provider_id, error: `HTTP ${resp.status}: ${errText}` };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await resp.json();
      const text = data?.choices?.[0]?.message?.content ?? '';
      const usage = {
        input_tokens: data?.usage?.prompt_tokens,
        output_tokens: data?.usage?.completion_tokens,
      };

      return { ok: true, text, model: data?.model || model, provider: this.provider_id, usage };
    } catch (err) {
      return { ok: false, provider: this.provider_id, error: String(err) };
    }
  }
}
