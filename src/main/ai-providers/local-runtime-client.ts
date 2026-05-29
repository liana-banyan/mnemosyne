// local-runtime-client.ts — BP060 Application 002 Steps 3+4 · DOCTRINE-CLASS
// OpenAI-compatible REST client — NOT Ollama-specific SDK.
// Reads LOCAL_RUNTIME_URL from settings (default: http://localhost:11434).
// Works with Ollama, llama.cpp, vLLM, LM Studio — any OpenAI-compatible local server.
// Label: "Local LLM Engine" — NOT "Ollama" hardcoded anywhere.
// AI-agnostic and runtime-agnostic by construction per
// canon_cooperative_class_local_inference_runtime_agnostic_ollama_default_alternatives_supported_resilience_bp059.
// decay_class: BETWEEN

import type { ProviderClient, ProviderQueryArgs, ProviderResponse } from './types';

const DEFAULT_LOCAL_RUNTIME_URL = 'http://localhost:11434';
const DEFAULT_LOCAL_MODEL = 'llama3.3';

export class LocalRuntimeClient implements ProviderClient {
  readonly provider_id = 'local';
  readonly display_name = 'Local LLM Engine';

  private runtimeUrl: string;

  constructor(runtimeUrl?: string) {
    this.runtimeUrl = (runtimeUrl || DEFAULT_LOCAL_RUNTIME_URL).replace(/\/$/, '');
  }

  is_configured(): boolean {
    return true; // local is always "configured" — may just not be running
  }

  async query(args: ProviderQueryArgs): Promise<ProviderResponse> {
    const model = args.model || DEFAULT_LOCAL_MODEL;
    const url = `${this.runtimeUrl}/v1/chat/completions`;

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: args.messages,
          max_tokens: args.max_tokens ?? 2048,
          temperature: args.temperature ?? 0.7,
          stream: false,
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
      return { ok: false, provider: this.provider_id, error: `Local LLM Engine unreachable: ${String(err)}` };
    }
  }

  async listModels(): Promise<{ ok: boolean; models: string[]; error?: string }> {
    try {
      const resp = await fetch(`${this.runtimeUrl}/v1/models`);
      if (!resp.ok) {
        return { ok: false, models: [], error: `HTTP ${resp.status}` };
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await resp.json();
      const models = (data?.models || data?.data || []).map((m: any) => m.id || m.name || String(m));
      return { ok: true, models };
    } catch (err) {
      return { ok: false, models: [], error: String(err) };
    }
  }

  setRuntimeUrl(url: string): void {
    this.runtimeUrl = url.replace(/\/$/, '');
  }

  getRuntimeUrl(): string {
    return this.runtimeUrl;
  }
}
