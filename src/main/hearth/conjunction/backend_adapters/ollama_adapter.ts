// B83e — Ollama Backend Adapter
// Calls http://localhost:11434/api/generate (Ollama default)
// Model: llama3.1:8b-instruct-q4_K_M (matches B69 codegen path)
// R-MECHANISM-VERIFY: verify Ollama daemon running before claiming available:ok

import type { AdapterReceipt } from '../types';

const OLLAMA_BASE = 'http://localhost:11434';
const OLLAMA_MODEL = 'llama3.1:8b-instruct-q4_K_M';

export async function ollamaAvailable(): Promise<{ ok: boolean; degraded_reason?: string }> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return { ok: false, degraded_reason: `Ollama returned ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, degraded_reason: `Ollama unreachable: ${String(err)}` };
  }
}

export async function ollamaDispatch(
  prompt: string,
  opts: { timeout_ms: number },
): Promise<AdapterReceipt> {
  const start = Date.now();

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
      }),
      signal: AbortSignal.timeout(opts.timeout_ms),
    });

    if (!res.ok) {
      return {
        name: 'ollama',
        result: null,
        error: `Ollama HTTP ${res.status}: ${await res.text().catch(() => 'unknown')}`,
        latency_ms: Date.now() - start,
      };
    }

    const data = await res.json() as {
      response?: string;
      prompt_eval_count?: number;
      eval_count?: number;
    };

    return {
      name: 'ollama',
      result: data.response ?? null,
      error: null,
      latency_ms: Date.now() - start,
      cost_usd: 0, // local — no cloud cost
      tokens: {
        in: data.prompt_eval_count ?? 0,
        out: data.eval_count ?? 0,
      },
    };
  } catch (err) {
    return {
      name: 'ollama',
      result: null,
      error: String(err),
      latency_ms: Date.now() - start,
    };
  }
}
