// anthropic-client.ts — BP060 Application 002 Steps 3+4 · Court: Bishop
// Uses raw fetch to https://api.anthropic.com/v1/messages — no SDK dependency required.
// Court mapping: Bishop = claude-opus-4-7 (1M context) per Founder verbatim BP059.
// decay_class: BETWEEN

import type { ProviderClient, ProviderQueryArgs, ProviderResponse } from './types';

const ANTHROPIC_BASE = 'https://api.anthropic.com/v1';
const BISHOP_DEFAULT_MODEL = 'claude-opus-4-7'; // Founder verbatim · 1M context

export class AnthropicClient implements ProviderClient {
  readonly provider_id = 'anthropic';
  readonly display_name = 'Anthropic (Bishop)';

  private apiKey: string | null;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env['ANTHROPIC_API_KEY'] || null;
  }

  is_configured(): boolean {
    return !!this.apiKey;
  }

  async query(args: ProviderQueryArgs): Promise<ProviderResponse> {
    if (!this.apiKey) {
      return { ok: false, provider: this.provider_id, error: 'ANTHROPIC_API_KEY not set' };
    }

    const model = args.model || BISHOP_DEFAULT_MODEL;

    // Separate system messages from user/assistant messages (Anthropic API format)
    const systemMessages = args.messages.filter((m) => m.role === 'system');
    const conversationMessages = args.messages.filter((m) => m.role !== 'system');
    const systemText = systemMessages.map((m) => m.content).join('\n') || undefined;

    try {
      const resp = await fetch(`${ANTHROPIC_BASE}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          messages: conversationMessages.map((m) => ({ role: m.role, content: m.content })),
          ...(systemText ? { system: systemText } : {}),
          max_tokens: args.max_tokens ?? 2048,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => resp.statusText);
        return { ok: false, provider: this.provider_id, error: `HTTP ${resp.status}: ${errText}` };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await resp.json();
      const text = data?.content?.[0]?.text ?? '';
      const usage = {
        input_tokens: data?.usage?.input_tokens,
        output_tokens: data?.usage?.output_tokens,
      };

      return { ok: true, text, model: data?.model || model, provider: this.provider_id, usage };
    } catch (err) {
      return { ok: false, provider: this.provider_id, error: String(err) };
    }
  }
}
