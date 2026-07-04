/**
 * posse_decompose.ts — Army Ants / Posse Decomposition Primitive
 * BP091 HARD CANON · BP092 HOTFIX Round-Up Implementation
 * Caithedral™ · Substrate Cure framing
 *
 * Decomposes a hard question into ≤5 atomically verifiable sub-claims.
 * Routes decomposition LLM call to ULTRA peer (llama3.3:70b via Supabase relay).
 * Persists sub-claims to posse_sub_claims table (§15 BLOOD: pre-applied by Bishop).
 */

import { randomUUID } from 'crypto';

export interface PosseSubClaim {
  sub_claim_id: string;
  parent_question_id: string;
  sub_claim_text: string;
  sub_claim_index: number;
  domain_hint: string | null;
  difficulty_class: 'HARD' | 'MEDIUM' | 'SHORT';
  created_at: string;
}

export interface DecompositionResult {
  parent_question_id: string;
  sub_claims: PosseSubClaim[];
  decomposition_model: string;
  elapsed_ms: number;
}

export async function decomposeQuestion(
  questionId: string,
  question: string,
  options: string[],
  domain: string,
  supabaseUrl: string,
  serviceKey: string,
  ultraPeerId: string,
  timeoutMs = 90000,
  ollamaUrl = 'http://localhost:11434',
  ollamaModel = 'llama3.3:70b',
): Promise<DecompositionResult> {
  const t0 = Date.now();

  const decompositionPrompt = buildDecompositionPrompt(question, options, domain);

  // v0.5.17+ relay peers only support council-vote mode (plow=mesh-12-blade).
  // Council ABSTAINs on non-MMLU generation tasks. Decompose is a generation
  // task — bypass relay entirely and call Ollama direct on the ULTRA peer host.
  // The sweep runs on M0 (the same host as the ULTRA peer), so localhost:11434
  // reaches llama3.3:70b directly. LAN-AS-WAN canon satisfied: the host IS M0.
  let rawReply: string | null = null;
  let decompositionModel = `${ollamaModel} (direct Ollama on ULTRA peer)`;
  const RETRY_BACKOFFS = [3000, 6000, 12000];
  let lastOllamaErr: unknown = null;
  let ollamaSucceeded = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      rawReply = await ollamaGenerate(ollamaUrl, ollamaModel, decompositionPrompt, timeoutMs);
      ollamaSucceeded = true;
      break;
    } catch (ollamaErr) {
      lastOllamaErr = ollamaErr;
      if (isTransientOllamaError(ollamaErr) && attempt < 3) {
        const backoffMs = RETRY_BACKOFFS[attempt - 1];
        console.warn(`posse_decompose: Ollama transient overload (attempt ${attempt}/3), backing off ${backoffMs}ms before retry`);
        await sleep(backoffMs);
      } else {
        // Non-transient error or final attempt — stop retrying.
        break;
      }
    }
  }
  if (!ollamaSucceeded) {
    // Ollama direct call failed — fall back to relay with error-aware guard.
    console.warn(`posse_decompose: Ollama direct failed (${(lastOllamaErr as Error).message}), falling back to relay`);
    decompositionModel = 'llama3.3:70b (ULTRA relay fallback)';
    rawReply = await decomposeViaRelay(
      questionId, decompositionPrompt, domain, supabaseUrl, serviceKey, ultraPeerId, timeoutMs
    );
  }

  const subClaims = parseSubClaims(questionId, rawReply ?? '', domain);

  for (const sc of subClaims) {
    try {
      await supabasePost(supabaseUrl, serviceKey, 'posse_sub_claims', sc);
    } catch { /* non-fatal — receipt traceability only */ }
  }

  return {
    parent_question_id: questionId,
    sub_claims: subClaims,
    decomposition_model: decompositionModel,
    elapsed_ms: Date.now() - t0,
  };
}

const TRANSIENT_OLLAMA_SIGNALS = ['503', 'server busy', 'maximum pending', 'econnreset', 'etimedout', 'timeout', 'aborted', 'request_aborted', 'socket hang up', 'eai_again'];

function isTransientOllamaError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return TRANSIENT_OLLAMA_SIGNALS.some(signal => msg.includes(signal));
}

async function ollamaGenerate(
  baseUrl: string,
  model: string,
  prompt: string,
  timeoutMs: number,
): Promise<string> {
  // BP094 Session 9 BLOCK D: clamp timeoutMs to minimum 5000ms.
  // AbortSignal.timeout() throws RangeError if value is negative.
  // Negative timeoutMs occurs when question deadline is already elapsed.
  const effectiveTimeoutMs = Math.max(5000, timeoutMs);
  if (timeoutMs < 0) {
    console.warn(`[WARN] negative delay corrected to 0 (raw=${timeoutMs}ms) in ollamaGenerate -- question deadline already elapsed`);
  }
  const res = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
    signal: AbortSignal.timeout(effectiveTimeoutMs),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}: ${text.slice(0, 200)}`);
  const parsed = JSON.parse(text);
  const response = parsed.response ?? '';
  if (!response) throw new Error('Ollama returned empty response');
  return response;
}

async function decomposeViaRelay(
  questionId: string,
  decompositionPrompt: string,
  domain: string,
  supabaseUrl: string,
  serviceKey: string,
  ultraPeerId: string,
  timeoutMs: number,
): Promise<string | null> {
  const routePayload = {
    target_peer_id: ultraPeerId,
    hex_frame: Buffer.from(decompositionPrompt, 'utf8').toString('base64'),
    payload_json: {
      prompt: decompositionPrompt,
      question_id: `${questionId}-posse-decompose`,
      wire_format: 'hex-mcode',
      domain,
      session_id: `posse-decomp-${questionId}`,
      plow_max_iterations: 4,
      allotted_timeout_ms: timeoutMs,
      is_posse_decomposition: true,
    },
    status: 'pending',
    session_id: `posse-decomp-${questionId}`,
    ttl_seconds: Math.ceil(timeoutMs / 1000) + 30,
  };

  const insertedRoute = await supabasePost(supabaseUrl, serviceKey, 'relay_routes', routePayload);
  const routeId = insertedRoute?.id;
  if (!routeId) throw new Error('posse_decompose: relay_routes INSERT returned no id');

  // BP094 Session 9 BLOCK D: clamp timeoutMs to prevent negative deadline
  const effectiveDeadlineMs = Math.max(5000, timeoutMs);
  if (timeoutMs < 0) {
    console.warn(`[WARN] negative delay corrected to 0 (raw=${timeoutMs}ms) in decomposeViaRelay -- question deadline already elapsed`);
  }
  const deadline = Date.now() + effectiveDeadlineMs;
  while (Date.now() < deadline) {
    const rows = await supabaseGet(
      supabaseUrl, serviceKey,
      `relay_route_replies?select=route_id,answer_json,hex_reply&route_id=eq.${routeId}`
    );
    if (rows && rows.length > 0) {
      const r = rows[0];
      let raw: string | null = null;
      if (r.hex_reply) {
        try { raw = Buffer.from(r.hex_reply, 'base64').toString('utf8'); } catch { raw = r.hex_reply; }
      }
      if (!raw && r.answer_json) {
        const aj = r.answer_json;
        if (aj && typeof aj === 'object' && aj.error_reason) {
          throw new Error(`peer_relay_error: ${aj.error_reason} — ${aj.message ?? JSON.stringify(aj)}`);
        }
        const candidate = typeof aj === 'string' ? aj : (aj.response ?? aj.answer ?? JSON.stringify(aj));
        if (candidate === 'ERROR' || candidate === 'ABSTAIN') {
          throw new Error(`peer_relay_error: peer returned '${candidate}' — relay council cannot handle generation tasks`);
        }
        raw = candidate;
      }
      return raw;
    }
    await sleep(2000);
  }
  return null;
}

function buildDecompositionPrompt(question: string, options: string[], domain: string): string {
  const optText = options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('\n');
  return `You are a Posse Decomposition expert for the domain: ${domain}.

Your task: Break down the following multiple-choice question into at most 5 ATOMIC sub-claims.
Each sub-claim must be independently verifiable (answerable without needing the other sub-claims).
Each sub-claim should be a YES/NO or FILL-IN-THE-BLANK factual statement.
Assign difficulty: HARD (requires deep reasoning), MEDIUM (factual recall + light reasoning), SHORT (pure recall).

QUESTION:
${question}

OPTIONS:
${optText}

Respond ONLY with a JSON array (no prose). Each element:
{ "sub_claim_text": "...", "difficulty_class": "HARD|MEDIUM|SHORT", "domain_hint": "..." }

Maximum 5 sub-claims. Minimum 2. Be concise.`;
}

function parseSubClaims(
  parentId: string,
  rawText: string,
  domain: string,
): PosseSubClaim[] {
  try {
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return fallbackSubClaims(parentId, rawText, domain);
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return fallbackSubClaims(parentId, rawText, domain);
    return parsed.slice(0, 5).map((item: any, idx: number) => ({
      sub_claim_id: randomUUID(),
      parent_question_id: parentId,
      sub_claim_text: String(item.sub_claim_text ?? ''),
      sub_claim_index: idx,
      domain_hint: item.domain_hint ?? domain,
      difficulty_class: (['HARD', 'MEDIUM', 'SHORT'].includes(item.difficulty_class)
        ? item.difficulty_class : 'MEDIUM') as 'HARD' | 'MEDIUM' | 'SHORT',
      created_at: new Date().toISOString(),
    }));
  } catch {
    return fallbackSubClaims(parentId, rawText, domain);
  }
}

function fallbackSubClaims(parentId: string, rawText: string, domain: string): PosseSubClaim[] {
  return [{
    sub_claim_id: randomUUID(),
    parent_question_id: parentId,
    sub_claim_text: rawText.slice(0, 500) || 'DECOMPOSITION_FAILED',
    sub_claim_index: 0,
    domain_hint: domain,
    difficulty_class: 'HARD',
    created_at: new Date().toISOString(),
  }];
}

async function supabasePost(url: string, key: string, table: string, body: object): Promise<any> {
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`supabase POST ${table} HTTP ${res.status}: ${text.slice(0, 200)}`);
  const rows = JSON.parse(text);
  return Array.isArray(rows) ? rows[0] : rows;
}

async function supabaseGet(url: string, key: string, path: string): Promise<any[]> {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10000),
  });
  const text = await res.text();
  if (!res.ok) return [];
  return JSON.parse(text) ?? [];
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export function healthCheck(): { ok: boolean; module: string } {
  return { ok: true, module: 'army_ants/posse_decompose' };
}
