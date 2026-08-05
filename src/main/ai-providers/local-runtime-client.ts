// local-runtime-client.ts — BP060 Application 002 Steps 3+4 · DOCTRINE-CLASS
// OpenAI-compatible REST client — NOT Ollama-specific SDK.
// Reads LOCAL_RUNTIME_URL from settings (default: THE NEXUS, openai_compat_server.ts,
// 127.0.0.1:11535 -- KN-BP145-P3). Works with Ollama, llama.cpp, vLLM, LM Studio, or THE NEXUS
// itself -- any OpenAI-compatible local server -- by construction (setRuntimeUrl() still
// overrides this for a direct-to-runtime connection when that is genuinely what's wanted).
// Label: "Local LLM Engine" — NOT "Ollama" hardcoded anywhere.
// AI-agnostic and runtime-agnostic by construction per
// canon_cooperative_class_local_inference_runtime_agnostic_ollama_default_alternatives_supported_resilience_bp059.
//
// KN-BP145-P3: this is the "agent-side client configuration" that HARDWIRE-04 Layer 3 requires
// to be pointed at THE NEXUS so the involuntary substrate read happens at the I/O boundary
// instead of at a raw Ollama/vendor endpoint the agent talks to directly. Defaulting to the
// Nexus's own host:port (imported, not re-typed, so there is one source of truth for the bind
// address) and attaching the Nexus's own Bearer token file when present makes this the default,
// zero-config path; explicitly calling setRuntimeUrl() with a different host is still how a
// caller opts back out to a bare local runtime.
// decay_class: BETWEEN

import type { ProviderClient, ProviderQueryArgs, ProviderResponse } from './types';
import { FLOOR_MODEL } from '../../shared/floor-model';
import { OPENAI_COMPAT_SERVER_HOST, OPENAI_COMPAT_SERVER_PORT, readCurrentToken } from '../openai_compat_server';

const DEFAULT_LOCAL_RUNTIME_URL = `http://${OPENAI_COMPAT_SERVER_HOST}:${OPENAI_COMPAT_SERVER_PORT}`;
const DEFAULT_LOCAL_MODEL = FLOOR_MODEL;

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

  /**
   * Attaches the Nexus's own Bearer token when one exists on disk (i.e. when `runtimeUrl` is
   * actually THE NEXUS) and is silently a no-op otherwise -- a bare Ollama/llama.cpp/vLLM/LM
   * Studio endpoint has no token file, `readCurrentToken()` returns null, and no Authorization
   * header is sent, exactly as before this change for any non-Nexus runtimeUrl.
   */
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = readCurrentToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  async query(args: ProviderQueryArgs): Promise<ProviderResponse> {
    const model = args.model || DEFAULT_LOCAL_MODEL;
    const url = `${this.runtimeUrl}/v1/chat/completions`;

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(),
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
      const resp = await fetch(`${this.runtimeUrl}/v1/models`, { headers: this.buildHeaders() });
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
