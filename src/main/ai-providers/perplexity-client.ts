// perplexity-client.ts — BP060 Application 002 Steps 3+4 · Court: Pawn
// Raw fetch to Perplexity API (OpenAI-compatible endpoint) — no SDK required.
// Court mapping: Pawn = best available Comet model per Founder verbatim BP059.
// decay_class: BETWEEN

import type { ProviderClient, ProviderQueryArgs, ProviderResponse } from './types';

const PERPLEXITY_BASE = 'https://api.perplexity.ai';
const PAWN_DEFAULT_MODEL = 'sonar'; // Comet / best available Perplexity flagship

export class PerplexityClient implements ProviderClient {
  readonly provider_id = 'perplexity';
  readonly display_name = 'Perplexity (Pawn)';

  private apiKey: string | null;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env['PERPLEXITY_API_KEY'] || null;
  }

  is_configured(): boolean {
    return !!this.apiKey;
  }

  async query(args: ProviderQueryArgs): Promise<ProviderResponse> {
    if (!this.apiKey) {
      return { ok: false, provider: this.provider_id, error: 'PERPLEXITY_API_KEY not set' };
    }

    const model = args.model || PAWN_DEFAULT_MODEL;

    try {
      const resp = await fetch(`${PERPLEXITY_BASE}/chat/completions`, {
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
