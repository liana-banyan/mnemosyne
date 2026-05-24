// B83e — CPU-Only Backend Adapter
// Rule-based / regex / local-substrate lookup — no model spend
// Deterministic. Receipt-class for cost-floor measurement.

import type { AdapterReceipt } from '../types';

// Simple rule set: keyword → canned response
const RULES: Array<{ pattern: RegExp; response: string }> = [
  { pattern: /heavy booster test/i, response: 'HEAVY BOOSTER TEST is the BP035 test class for the Hearth Conjunction Window. It verifies substrate escape velocity from solo-Founder-orchestration class.' },
  { pattern: /trinity/i, response: 'Trinity meta-canon: Blood (B73 Oracle Circuit), Sweat (B80 Sweat Scribe — effort discipline), Tears (B81 Tears Scribe — loss-after-effort discipline). All three scribes LANDED BP034.' },
  { pattern: /drekaskip/i, response: 'Drekaskip (B61A) — Wave Generator, 12/12 G-gates PASS. K30 Contingency Operator at production-class. Saga: hearth_conjunction.' },
  { pattern: /moneypenny|mcci/i, response: 'MoneyPenny (B82) — MCCI Context Kernel operational. 28/28 G-gates PASS. Routes requests across relationship/topic/session context threads.' },
  { pattern: /in conjunction/i, response: 'In Conjunction — Founder-coined mode. Dispatches to CPU / Ollama / Knight / Opus in parallel via K30 Contingency Operator. Fan-in synthesizes composite response.' },
  { pattern: /next step|what.*next/i, response: 'The next step for the Heavy Booster Test is Founder ship-day verification: 9-step protocol, steps 1-8 auto-checked, step 9 = Founder verdict. PASS = substrate escape velocity demonstrated.' },
];

const CPU_ONLY_ADAPTER_NAME = 'cpu_only' as const;

export async function cpuOnlyAvailable(): Promise<{ ok: boolean }> {
  return { ok: true };
}

export async function cpuOnlyDispatch(
  prompt: string,
  opts: { timeout_ms: number },
): Promise<AdapterReceipt> {
  const start = Date.now();
  void opts; // synchronous — timeout not applicable

  let result: string | null = null;

  for (const rule of RULES) {
    if (rule.pattern.test(prompt)) {
      result = rule.response;
      break;
    }
  }

  if (!result) {
    // Fall back to substrate lookup via HTTP
    try {
      const res = await fetch('http://127.0.0.1:11480/substrate/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: prompt, degraded: false }),
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = await res.json() as { hit?: boolean; record?: { text?: string } };
        if (data.hit && data.record?.text) {
          result = `[Substrate hit] ${data.record.text.slice(0, 500)}`;
        }
      }
    } catch {
      // substrate miss — that's fine
    }
  }

  if (!result) {
    result = '[CPU-only] No rule or substrate match for this prompt. Select Ollama, Knight, or Opus for a model response.';
  }

  return {
    name: CPU_ONLY_ADAPTER_NAME,
    result,
    error: null,
    latency_ms: Date.now() - start,
    cost_usd: 0,
    tokens: { in: 0, out: 0 },
  };
}
