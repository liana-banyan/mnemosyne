// B83e — Opus Claude Backend Adapter
// Calls Anthropic API with model claude-opus-4-7
// API key from process.env.ANTHROPIC_API_KEY (loaded from SDS.env at startup)
// Token budget: 4096 max_tokens default; configurable per request
// R-MECHANISM-VERIFY: smoke-test one Opus call before claiming adapter available
//
// Layer 3 — Adaptive Concurrency Carrier: retry-on-empty (R17 SHOW-RESULTS at content layer).
// Null/empty/"(no reply)" response → retry with 1s/2s/4s backoff; max 3 retries.
// Status 'error' (not 'done') when all retries exhausted without substantive content.

import type { AdapterReceipt } from '../types';

// ─── Layer 3: retry helpers ───────────────────────────────────────────────────

const RETRY_MAX      = 3;
const RETRY_DELAYS   = [1_000, 2_000, 4_000];
/** Minimum character count to qualify as substantive content. */
const CONTENT_MIN    = 100;

function isSubstantive(text: string | null): boolean {
  return text !== null && text.trim().length >= CONTENT_MIN;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const ANTHROPIC_API_BASE = 'https://api.anthropic.com/v1';
const OPUS_MODEL = 'claude-opus-4-7';
const DEFAULT_MAX_TOKENS = 4096;

export async function opusClaudeAvailable(): Promise<{ ok: boolean; degraded_reason?: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return { ok: false, degraded_reason: 'ANTHROPIC_API_KEY not set in environment' };
  }
  // Quick availability check without consuming tokens
  try {
    const res = await fetch(`${ANTHROPIC_API_BASE}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: OPUS_MODEL,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    // 200 = available; 529 = overloaded (degraded); 401 = bad key
    if (res.status === 401) {
      return { ok: false, degraded_reason: 'Anthropic API key invalid (401)' };
    }
    if (res.status === 529) {
      return { ok: true }; // overloaded but available — dispatch may still succeed
    }
    return { ok: res.ok || res.status === 200 };
  } catch (err) {
    return { ok: false, degraded_reason: `Anthropic API unreachable: ${String(err)}` };
  }
}

export async function opusClaudeDispatch(
  prompt: string,
  opts: { timeout_ms: number; max_tokens?: number },
): Promise<AdapterReceipt> {
  const start = Date.now();
  const key = process.env.ANTHROPIC_API_KEY;

  if (!key) {
    return {
      name: 'opus_claude',
      result: null,
      error: 'ANTHROPIC_API_KEY not set — load from SDS.env before dispatching to Opus',
      latency_ms: Date.now() - start,
    };
  }

  // Layer 3: retry loop — retry on empty/null content up to RETRY_MAX times
  for (let attempt = 0; attempt <= RETRY_MAX; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS[attempt - 1] ?? 4_000;
      console.warn(`[opus-claude] empty reply on attempt ${attempt} — retrying in ${delay}ms`);
      await sleep(delay);
    }

    try {
      const res = await fetch(`${ANTHROPIC_API_BASE}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: OPUS_MODEL,
          max_tokens: opts.max_tokens ?? DEFAULT_MAX_TOKENS,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(opts.timeout_ms),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => 'unknown');
        return {
          name: 'opus_claude',
          result: null,
          error: `Anthropic API HTTP ${res.status}: ${errBody.slice(0, 200)}`,
          latency_ms: Date.now() - start,
        };
      }

      const data = await res.json() as {
        content?: Array<{ type: string; text: string }>;
        usage?: { input_tokens: number; output_tokens: number };
      };

      const text = data.content?.find((b) => b.type === 'text')?.text ?? null;
      const inputTokens  = data.usage?.input_tokens ?? 0;
      const outputTokens = data.usage?.output_tokens ?? 0;
      const costUsd = (inputTokens * 0.000015) + (outputTokens * 0.000075);

      // Layer 3: content check — only return 'done' when substantive
      if (isSubstantive(text)) {
        return {
          name: 'opus_claude',
          result: text,
          error: null,
          latency_ms: Date.now() - start,
          cost_usd: costUsd,
          tokens: { in: inputTokens, out: outputTokens },
        };
      }
      // Not substantive — loop to retry

    } catch (err) {
      // Network/timeout error — only retry if attempts remain
      if (attempt < RETRY_MAX) {
        console.warn(`[opus-claude] dispatch error on attempt ${attempt + 1} — will retry:`, String(err));
        continue;
      }
      return {
        name: 'opus_claude',
        result: null,
        error: `dispatch failed after ${RETRY_MAX + 1} attempts: ${String(err)}`,
        latency_ms: Date.now() - start,
      };
    }
  }

  // All retries exhausted with empty content — R17: surface real error, NOT green success
  return {
    name: 'opus_claude',
    result: null,
    error: `content-empty after ${RETRY_MAX + 1} attempts — dispatch-OK but no substantive reply (Anthropic concurrency throttle suspected)`,
    latency_ms: Date.now() - start,
  };
}
