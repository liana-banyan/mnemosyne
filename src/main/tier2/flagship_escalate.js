/**
 * flagship_escalate.js - Tier 2 Flagship Escalation (pure JS, BP094 Session 9)
 * Caithedral(TM)
 *
 * Called when Tier 1 tiebreaker and Posse swarm both fail to resolve a contested question.
 * Routes to Anthropic Claude Sonnet 4.6 (primary) -> local llama3.3:70b via Ollama (fallback).
 * Budget metered in Joules (1 Joule = $0.001 USD equivalent).
 * tier_source: "TIER2_FLAGSHIP_API" | "TIER2_FLAGSHIP_LOCAL"
 *
 * Block B contract (BP094 Session 9):
 *   Input: questionId, prompt, numOptions, domain, config
 *   Output: { answer, confidence, tier_source, joules_consumed, vendor, model, ... }
 */

const LETTERS = 'ABCDEFGHIJ';

/**
 * Extract the answer letter from a raw model response.
 */
function extractLetter(text, numOptions) {
  if (!text) return null;
  const valid = LETTERS.slice(0, numOptions);
  const patterns = [
    new RegExp(`^\\s*([${valid}])\\b`, 'i'),
    new RegExp(`Answer[:\\s]+([${valid}])\\b`, 'i'),
    new RegExp(`\\b([${valid}])\\s*\\)`, 'i'),
    new RegExp(`\\b([${valid}])\\.`, 'i'),
    new RegExp(`^\\s*([${valid}])`, 'im'),
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

/**
 * Persist tier2 run record to Supabase (non-fatal on failure).
 */
async function persistTier2Run(supabaseUrl, serviceKey, record) {
  try {
    await fetch(`${supabaseUrl}/rest/v1/tier2_flagship_runs`, {
      method: 'POST',
      headers: {
        apikey: serviceKey, Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json', Prefer: 'return=minimal',
      },
      body: JSON.stringify(record),
      signal: AbortSignal.timeout(10000),
    });
  } catch { /* non-fatal */ }
}

/**
 * Dispatch to local Ollama (llama3.3:70b) as Tier 2 fallback when API key absent.
 * Returns raw text or null on failure.
 */
async function ollamaGenerate(prompt, model = 'llama3.3:70b') {
  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: { num_predict: 16, temperature: 0 },
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = await res.json();
    return data.response ?? null;
  } catch (err) {
    console.warn(`  [TIER2 LOCAL] Ollama ${model} failed: ${err?.message}`);
    return null;
  }
}

/**
 * tier2FlagshipEscalate - main entry point.
 *
 * @param {string} questionId
 * @param {string} prompt
 * @param {number} numOptions
 * @param {string} domain
 * @param {object} config - { anthropicApiKey, openaiApiKey, joulesRemainingRef, joulesCapPerRun, joulesPerQuestion, supabaseUrl, serviceKey, sessionId }
 * @returns {Promise<{ answer: string|null, confidence: number, tier_source: string, joules_consumed: number, vendor: string, model: string, question_id: string, created_at: string }>}
 */
export async function tier2FlagshipEscalate(questionId, prompt, numOptions, domain, config) {
  const {
    anthropicApiKey = '',
    openaiApiKey = '',
    joulesRemainingRef = { value: 5000 },
    joulesCapPerRun = 5000,
    joulesPerQuestion = 120,
    supabaseUrl = '',
    serviceKey = '',
    sessionId = '',
  } = config;

  const base = {
    answer: null,
    confidence: 0,
    tier_source: 'TIER2_FLAGSHIP_API',
    joules_consumed: 0,
    vendor: 'skipped',
    model: 'none',
    question_id: questionId,
    session_id: sessionId,
    domain,
    created_at: new Date().toISOString(),
  };

  // Joules cap guard - per user-controlled-cap canon
  if (joulesRemainingRef.value <= 0) {
    console.log(`  [TIER2] cap=0 skipping flagship per user-controlled-cap canon`);
    await persistTier2Run(supabaseUrl, serviceKey, { ...base, vendor: 'skipped' });
    return base;
  }

  // Primary: Anthropic Claude Sonnet 4.6 (when API key present and not in gemma/local mode)
  if (anthropicApiKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicApiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 16,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(45000),
      });

      if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
      const data = await res.json();
      const rawText = data.content?.[0]?.type === 'text' ? data.content[0].text : '';
      const answer = extractLetter(rawText, numOptions);
      const inputTokens = data.usage?.input_tokens ?? 0;
      const outputTokens = data.usage?.output_tokens ?? 0;
      // claude-sonnet-4-6: $3/M input, $15/M output -> Joules = tokens * rate / 1000
      const costJoules = Math.max(1, Math.ceil((inputTokens * 3 + outputTokens * 15) / 1000));

      joulesRemainingRef.value = Math.max(0, joulesRemainingRef.value - costJoules);

      const result = {
        ...base,
        answer,
        confidence: answer !== null ? 0.95 : 0,
        tier_source: 'TIER2_FLAGSHIP_API',
        joules_consumed: costJoules,
        vendor: 'anthropic',
        model: 'claude-sonnet-4-6',
      };

      await persistTier2Run(supabaseUrl, serviceKey, result);
      console.log(`  [TIER2 FLAGSHIP] escalated; answer=${answer ?? 'NULL'}; joules_consumed=${costJoules}; tier_source=TIER2_FLAGSHIP_API`);
      return result;
    } catch (err) {
      console.warn(`  [TIER2] Anthropic API failed: ${err?.message} -- falling back to local Ollama`);
    }
  }

  // Fallback: local llama3.3:70b via Ollama (when API key absent or API failed)
  {
    const localModel = 'llama3.3:70b';
    const rawText = await ollamaGenerate(prompt, localModel);
    const answer = extractLetter(rawText, numOptions);
    // Local Ollama costs 0 API Joules but deducts 1 Joule for accounting discipline
    const costJoules = 1;
    joulesRemainingRef.value = Math.max(0, joulesRemainingRef.value - costJoules);

    const result = {
      ...base,
      answer,
      confidence: answer !== null ? 0.75 : 0,
      tier_source: 'TIER2_FLAGSHIP_LOCAL',
      joules_consumed: costJoules,
      vendor: 'ollama',
      model: localModel,
    };

    await persistTier2Run(supabaseUrl, serviceKey, result);
    console.log(`  [TIER2 FLAGSHIP] escalated; answer=${answer ?? 'NULL'}; joules_consumed=${costJoules}; tier_source=TIER2_FLAGSHIP_LOCAL`);
    return result;
  }
}

export function healthCheck() {
  return { ok: true, module: 'tier2/flagship_escalate' };
}
