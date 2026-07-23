// gemini-client.ts — BP060 Application 002 Steps 3+4 · Court: Knight
// Uses raw fetch to Google Generative AI API — no SDK dependency required.
// Court mapping: Knight = gemini-3.1-pro or fallback per Founder verbatim BP059.
// decay_class: BETWEEN

import type { ProviderClient, ProviderQueryArgs, ProviderResponse } from './types';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const KNIGHT_DEFAULT_MODEL = 'gemini-1.5-pro'; // best available; 3.1-pro when released

export class GeminiClient implements ProviderClient {
  readonly provider_id = 'gemini';
  readonly display_name = 'Gemini (Knight)';

  private apiKey: string | null;

  constructor(apiKey?: string) {
    // GEMINI_API_KEY is available from env_loader (see settings.json env section)
    this.apiKey = apiKey || process.env['GEMINI_API_KEY'] || null;
  }

  is_configured(): boolean {
    return !!this.apiKey;
  }

  async query(args: ProviderQueryArgs): Promise<ProviderResponse> {
    if (!this.apiKey) {
      return { ok: false, provider: this.provider_id, error: 'GEMINI_API_KEY not set' };
    }

    const model = args.model || KNIGHT_DEFAULT_MODEL;

    // Convert ChatMessage array to Gemini contents format
    const contents = args.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    // System instruction (if any)
    const systemMessages = args.messages.filter((m) => m.role === 'system');
    const systemInstruction = systemMessages.length > 0
      ? { parts: [{ text: systemMessages.map((m) => m.content).join('\n') }] }
      : undefined;

    try {
      const url = `${GEMINI_BASE}/models/${model}:generateContent?key=${this.apiKey}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          ...(systemInstruction ? { system_instruction: systemInstruction } : {}),
          generationConfig: {
            maxOutputTokens: args.max_tokens ?? 2048,
            temperature: args.temperature ?? 0.7,
          },
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => resp.statusText);
        return { ok: false, provider: this.provider_id, error: `HTTP ${resp.status}: ${errText}` };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await resp.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const usage = {
        input_tokens: data?.usageMetadata?.promptTokenCount,
        output_tokens: data?.usageMetadata?.candidatesTokenCount,
      };

      return { ok: true, text, model, provider: this.provider_id, usage };
    } catch (err) {
      return { ok: false, provider: this.provider_id, error: String(err) };
    }
  }
}
