/**
 * flagship_escalate.ts — Tier 2 Flagship Escalation
 * BP092 · Caithedral™
 *
 * Called when Tier 1 tiebreaker and Posse swarm both fail to resolve a contested question.
 * Routes to Anthropic Claude Sonnet 4.6 (primary) → OpenAI GPT-4o (fallback).
 * Budget metered in Joules (1 Joule = $0.001 USD equivalent).
 * Persists to tier2_flagship_runs table (§15 BLOOD: migration pre-applied by Bishop).
 */

import Anthropic from '@anthropic-ai/sdk';

export interface Tier2FlagshipConfig {
  anthropicApiKey: string;
  openaiApiKey?: string;
  joulesRemainingRef: { value: number };  // mutable ref — caller owns it
  joulesCapPerRun: number;                 // default: 5000 (= $5 USD)
  joulesPerQuestion: number;               // default: 120 (= $0.12 ceiling per Q)
  supabaseUrl: string;
  serviceKey: string;
  sessionId: string;
}

export interface Tier2Result {
  answer: string | null;
  vendor: 'anthropic' | 'openai' | 'skipped';
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_joules: number;
  question_id: string;
  created_at: string;
}

export async function tier2FlagshipEscalate(
  questionId: string,
  prompt: string,
  numOptions: number,
  domain: string,
  config: Tier2FlagshipConfig,
): Promise<Tier2Result> {
  const base: Tier2Result = {
    answer: null,
    vendor: 'skipped',
    model: 'none',
    input_tokens: 0,
    output_tokens: 0,
    cost_joules: 0,
    question_id: questionId,
    created_at: new Date().toISOString(),
  };

  // Budget guard
  if (config.joulesRemainingRef.value < config.joulesPerQuestion) {
    console.log(`  [TIER2] budget exhausted — joulesRemaining=${config.joulesRemainingRef.value} < threshold=${config.joulesPerQuestion} — skipping`);
    await persistTier2Run(config.supabaseUrl, config.serviceKey, { ...base, vendor: 'skipped' });
    return base;
  }

  // Primary: Anthropic Claude Sonnet 4.6
  if (config.anthropicApiKey) {
    try {
      const client = new Anthropic({ apiKey: config.anthropicApiKey });
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 16,
        messages: [{ role: 'user', content: prompt }],
      });

      const rawText = msg.content[0]?.type === 'text' ? msg.content[0].text : '';
      const letters = 'ABCDEFGHIJ'.slice(0, numOptions);
      const m = rawText.match(new RegExp(`^\\s*([${letters}])\\b`, 'i'));
      const answer = m ? m[1].toUpperCase() : null;

      const inputTokens = msg.usage.input_tokens;
      const outputTokens = msg.usage.output_tokens;
      // Sonnet 4.6: $3/M input, $15/M output → Joules = tokens × rate / 1000
      const costJoules = Math.ceil((inputTokens * 3 + outputTokens * 15) / 1000);

      config.joulesRemainingRef.value = Math.max(0, config.joulesRemainingRef.value - costJoules);

      const result: Tier2Result = {
        answer,
        vendor: 'anthropic',
        model: 'claude-sonnet-4-6',
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_joules: costJoules,
        question_id: questionId,
        created_at: new Date().toISOString(),
      };

      await persistTier2Run(config.supabaseUrl, config.serviceKey, result);
      console.log(`  [TIER2] Anthropic claude-sonnet-4-6 → ${answer ?? 'NULL'} · ${costJoules} Joules · remaining=${config.joulesRemainingRef.value}`);
      return result;
    } catch (err: any) {
      console.warn(`  [TIER2] Anthropic API failed: ${err?.message} — trying OpenAI fallback`);
    }
  }

  // Fallback: OpenAI GPT-4o
  if (config.openaiApiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 16,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
      const data: any = await res.json();
      const rawText = data.choices?.[0]?.message?.content ?? '';
      const letters = 'ABCDEFGHIJ'.slice(0, numOptions);
      const m = rawText.match(new RegExp(`^\\s*([${letters}])\\b`, 'i'));
      const answer = m ? m[1].toUpperCase() : null;

      const inputTokens = data.usage?.prompt_tokens ?? 0;
      const outputTokens = data.usage?.completion_tokens ?? 0;
      // GPT-4o: $5/M input, $15/M output
      const costJoules = Math.ceil((inputTokens * 5 + outputTokens * 15) / 1000);
      config.joulesRemainingRef.value = Math.max(0, config.joulesRemainingRef.value - costJoules);

      const result: Tier2Result = {
        answer,
        vendor: 'openai',
        model: 'gpt-4o',
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_joules: costJoules,
        question_id: questionId,
        created_at: new Date().toISOString(),
      };

      await persistTier2Run(config.supabaseUrl, config.serviceKey, result);
      console.log(`  [TIER2] OpenAI gpt-4o → ${answer ?? 'NULL'} · ${costJoules} Joules · remaining=${config.joulesRemainingRef.value}`);
      return result;
    } catch (err: any) {
      console.warn(`  [TIER2] OpenAI fallback also failed: ${err?.message}`);
    }
  }

  await persistTier2Run(config.supabaseUrl, config.serviceKey, base);
  return base;
}

async function persistTier2Run(url: string, key: string, result: Tier2Result): Promise<void> {
  try {
    await fetch(`${url}/rest/v1/tier2_flagship_runs`, {
      method: 'POST',
      headers: {
        apikey: key, Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json', Prefer: 'return=minimal',
      },
      body: JSON.stringify(result),
      signal: AbortSignal.timeout(10000),
    });
  } catch { /* non-fatal */ }
}

export function healthCheck(): { ok: boolean; module: string } {
  return { ok: true, module: 'tier2/flagship_escalate' };
}
