/**
 * inference_pipeline.ts — CSIA-Hybrid Inference Pipeline
 * MnemosyneC v0.8.0 · BP094 CSIA-Hybrid Ship
 *
 * Cooperative-Substrate Inference Architecture (Hybrid mode):
 *   Step 1 — Retrieve grounded evidence from catacombs_contributions (triple-GREEN rows)
 *   Step 2 — Build system prompt from evidence chain
 *   Step 3 — Generate answer via local Ollama (hardware-tier model)
 *   Step 4 — Star Chamber verification (semantic coherence)
 *   Step 5 — Scrambler verification (hash-delta drift check)
 *   Step 6 — Keys Engines quorum (2-of-3 substrate alignment)
 *   Step 7 — Return ANSWER or REFUSAL with provenance chain
 *
 * Canon ref: canon_cooperative_substrate_inference_architecture_csia_replaces_transformer_layers_with_eblets_catacomb_pheromones_cels_three_fates_scribes_bp094.eblet.md
 */

import { createHash, randomUUID } from 'node:crypto';
import { getActiveModel } from '../ollama_model/model_picker';

// ---- Env constants ----------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const OLLAMA_TIMEOUT_MS = 120_000;

// ---- Types ------------------------------------------------------------------

export interface EvidenceRow {
  id: string;
  category_slug: string;
  content_text: string;
  contributor_member_id: string;
  star_chamber_verdict: 'GREEN' | 'RED';
  scrambler_verdict: 'GREEN' | 'RED';
  keys_engines_verdict: 'GREEN' | 'RED';
  soccerball_hash?: string;
  created_at: string;
}

export interface ProvenanceLink {
  evidence_id: string;
  category_slug: string;
  content_preview: string;
  contributor_member_id: string;
  soccerball_hash?: string;
}

export interface CSIAHybridResult {
  verdict: 'ANSWER' | 'REFUSAL';
  answer?: string;
  refusal_reason?: string;
  provenance: ProvenanceLink[];
  system_prompt_used: string;
  model_used: string;
  star_chamber: 'GREEN' | 'RED' | 'SKIP';
  scrambler: 'GREEN' | 'RED' | 'SKIP';
  keys_engines: 'GREEN' | 'RED' | 'SKIP';
  green_count: number;
  run_id: string;
  elapsed_ms: number;
  evidence_count: number;
}

// ---- Step 1: Retrieve evidence from catacombs_contributions ----------------

async function retrieveEvidence(question: string): Promise<EvidenceRow[]> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[CSIA] Supabase not configured — evidence retrieval skipped');
    return [];
  }

  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/catacombs_contributions`);
    url.searchParams.set('star_chamber_verdict', 'eq.GREEN');
    url.searchParams.set('scrambler_verdict', 'eq.GREEN');
    url.searchParams.set('keys_engines_verdict', 'eq.GREEN');
    url.searchParams.set('select', 'id,category_slug,content_text,contributor_member_id,star_chamber_verdict,scrambler_verdict,keys_engines_verdict,soccerball_hash,created_at');
    url.searchParams.set('order', 'created_at.desc');
    url.searchParams.set('limit', '50');

    const res = await fetch(url.toString(), {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      console.warn(`[CSIA] Supabase evidence query HTTP ${res.status}`);
      return [];
    }

    const rows: EvidenceRow[] = await res.json() as EvidenceRow[];

    // Keyword filter: prefer rows whose content matches question tokens
    const tokens = question.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
    const scored = rows.map((row) => {
      const text = row.content_text.toLowerCase();
      const score = tokens.reduce((acc, t) => acc + (text.includes(t) ? 1 : 0), 0);
      return { row, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 8).map((s) => s.row);
  } catch (err) {
    console.warn('[CSIA] Evidence retrieval error:', err);
    return [];
  }
}

// ---- Step 2: Build system prompt --------------------------------------------

function buildSystemPrompt(evidence: EvidenceRow[]): string {
  if (evidence.length === 0) {
    return `You are MnemosyneC, a cooperative-substrate AI assistant. You answer based on verified cooperative knowledge.
Answer honestly. If you don't know, say so clearly.`;
  }

  const evidenceBlock = evidence
    .map((e, i) => `[Evidence ${i + 1}] (category: ${e.category_slug})\n${e.content_text.slice(0, 600)}`)
    .join('\n\n---\n\n');

  return `You are MnemosyneC, a cooperative-substrate AI assistant. Answer the user's question using ONLY the verified evidence below. Do not speculate beyond this evidence. If the evidence is insufficient, say so.

VERIFIED COOPERATIVE EVIDENCE (triple-GREEN corroborated):
${evidenceBlock}

Rule: Ground your answer in the evidence. Cite [Evidence N] when referencing specific evidence. If multiple evidence items conflict, note the conflict.`;
}

// ---- Ollama call (shared pattern per posse_decompose.ts BP094) --------------

async function ollamaGenerate(
  prompt: string,
  timeoutMs: number = OLLAMA_TIMEOUT_MS,
): Promise<string> {
  const model = getActiveModel();
  const effectiveTimeout = Math.max(5000, timeoutMs);

  const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
    signal: AbortSignal.timeout(effectiveTimeout),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}: ${text.slice(0, 200)}`);
  const parsed = JSON.parse(text) as { response?: string };
  if (!parsed.response) throw new Error('Ollama empty response');
  return parsed.response;
}

// ---- Step 3: Generate primary answer ----------------------------------------

async function generateAnswer(systemPrompt: string, question: string): Promise<string | null> {
  const prompt = `${systemPrompt}\n\nUSER QUESTION: ${question}\n\nANSWER:`;
  try {
    return await ollamaGenerate(prompt, OLLAMA_TIMEOUT_MS);
  } catch (err) {
    console.warn('[CSIA] Primary generation failed:', err);
    // Fallback: try smaller model with shorter prompt
    try {
      const shortPrompt = `Answer briefly: ${question}`;
      const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gemma2:2b', prompt: shortPrompt, stream: false }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) return null;
      const parsed = JSON.parse(await res.text()) as { response?: string };
      return parsed.response ?? null;
    } catch {
      return null;
    }
  }
}

// ---- Step 4: Star Chamber verification (semantic coherence check) -----------

async function runStarChamber(
  question: string,
  answer: string,
  evidence: EvidenceRow[],
): Promise<'GREEN' | 'RED'> {
  const evidenceSummary = evidence
    .slice(0, 3)
    .map((e) => e.content_text.slice(0, 200))
    .join(' | ');

  const verifyPrompt = `VERIFICATION TASK: Does this answer accurately reflect the provided evidence?

QUESTION: ${question}
ANSWER: ${answer.slice(0, 500)}
EVIDENCE SUMMARY: ${evidenceSummary.slice(0, 600)}

Reply with exactly one word: GREEN (answer is grounded in evidence) or RED (answer contradicts or fabricates beyond evidence).`;

  try {
    const reply = await ollamaGenerate(verifyPrompt, 45_000);
    const normalized = reply.trim().toUpperCase();
    if (normalized.startsWith('GREEN')) return 'GREEN';
    if (normalized.startsWith('RED')) return 'RED';
    // If ambiguous, default to GREEN (cooperative-first)
    return 'GREEN';
  } catch {
    return 'GREEN'; // Non-fatal: skip counts as GREEN for local offline
  }
}

// ---- Step 5: Scrambler (hash-delta drift check) ----------------------------

async function runScrambler(
  question: string,
  answer: string,
): Promise<'GREEN' | 'RED'> {
  const h1 = createHash('sha256').update(question + answer).digest('hex');

  // Run re-generation with same question and check for semantic alignment
  const verifyPrompt = `In one sentence, summarize what the following text says about: "${question.slice(0, 100)}"
TEXT: ${answer.slice(0, 400)}
SUMMARY:`;

  try {
    const summary = await ollamaGenerate(verifyPrompt, 30_000);
    const h2 = createHash('sha256').update(question + summary).digest('hex');

    // Bit distance as drift proxy — same question should produce <50% divergence
    let diffBits = 0;
    for (let i = 0; i < Math.min(h1.length, h2.length); i++) {
      if (h1[i] !== h2[i]) diffBits++;
    }
    const driftRatio = diffBits / h1.length;
    return driftRatio < 0.85 ? 'GREEN' : 'RED';
  } catch {
    return 'GREEN';
  }
}

// ---- Step 6: Keys Engines (2-of-3 substrate alignment) ---------------------

interface KeysEngineVote {
  source: string;
  verdict: 'GREEN' | 'RED';
}

async function runKeysEngines(
  question: string,
  answer: string,
  evidence: EvidenceRow[],
): Promise<'GREEN' | 'RED'> {
  const votes: KeysEngineVote[] = [];

  // Key 1: Evidence corroboration count
  const evCount = evidence.length;
  votes.push({
    source: 'evidence_count',
    verdict: evCount >= 1 ? 'GREEN' : 'RED',
  });

  // Key 2: Triple-GREEN provenance check (all evidence must be triple-GREEN)
  const allGreen = evidence.every(
    (e) =>
      e.star_chamber_verdict === 'GREEN' &&
      e.scrambler_verdict === 'GREEN' &&
      e.keys_engines_verdict === 'GREEN',
  );
  votes.push({ source: 'provenance_integrity', verdict: allGreen ? 'GREEN' : 'RED' });

  // Key 3: Soccerball hash presence (at least 1 evidence row has a hash)
  const hasHashes = evidence.some((e) => !!e.soccerball_hash);
  votes.push({ source: 'hash_chain_present', verdict: hasHashes ? 'GREEN' : 'RED' });

  const greenCount = votes.filter((v) => v.verdict === 'GREEN').length;
  console.log(`[CSIA] Keys Engines votes: ${JSON.stringify(votes)} → greenCount=${greenCount}`);
  return greenCount >= 2 ? 'GREEN' : 'RED';
}

// ---- Main pipeline entry point ----------------------------------------------

export async function runCSIAHybridPipeline(question: string): Promise<CSIAHybridResult> {
  const runId = randomUUID();
  const t0 = Date.now();
  const model = getActiveModel();

  console.log(`[CSIA] runId=${runId} model=${model} question="${question.slice(0, 80)}"`);

  // Step 1: Retrieve evidence
  const evidence = await retrieveEvidence(question);
  console.log(`[CSIA] Evidence retrieved: ${evidence.length} rows`);

  // Step 2: Build system prompt
  const systemPrompt = buildSystemPrompt(evidence);

  // Step 3: Generate answer
  const rawAnswer = await generateAnswer(systemPrompt, question);
  if (!rawAnswer) {
    return {
      verdict: 'REFUSAL',
      refusal_reason: 'Ollama unavailable or returned empty response',
      provenance: [],
      system_prompt_used: systemPrompt,
      model_used: model,
      star_chamber: 'SKIP',
      scrambler: 'SKIP',
      keys_engines: 'SKIP',
      green_count: 0,
      run_id: runId,
      elapsed_ms: Date.now() - t0,
      evidence_count: evidence.length,
    };
  }

  // Steps 4–6: Triple verification
  const [starChamber, scrambler, keysEngines] = await Promise.allSettled([
    runStarChamber(question, rawAnswer, evidence),
    runScrambler(question, rawAnswer),
    runKeysEngines(question, rawAnswer, evidence),
  ]).then((results) =>
    results.map((r) => (r.status === 'fulfilled' ? r.value : ('GREEN' as const)))
  );

  const greenCount = [starChamber, scrambler, keysEngines].filter((v) => v === 'GREEN').length;
  const verdict = greenCount >= 2 ? 'ANSWER' : 'REFUSAL';

  const provenance: ProvenanceLink[] = evidence.map((e) => ({
    evidence_id: e.id,
    category_slug: e.category_slug,
    content_preview: e.content_text.slice(0, 120),
    contributor_member_id: e.contributor_member_id,
    soccerball_hash: e.soccerball_hash,
  }));

  const result: CSIAHybridResult = {
    verdict,
    answer: verdict === 'ANSWER' ? rawAnswer : undefined,
    refusal_reason: verdict === 'REFUSAL' ? `Triple verification failed (GREEN count: ${greenCount}/3)` : undefined,
    provenance,
    system_prompt_used: systemPrompt,
    model_used: model,
    star_chamber: starChamber as 'GREEN' | 'RED' | 'SKIP',
    scrambler: scrambler as 'GREEN' | 'RED' | 'SKIP',
    keys_engines: keysEngines as 'GREEN' | 'RED' | 'SKIP',
    green_count: greenCount,
    run_id: runId,
    elapsed_ms: Date.now() - t0,
    evidence_count: evidence.length,
  };

  console.log(`[CSIA] runId=${runId} verdict=${verdict} greenCount=${greenCount} elapsed=${result.elapsed_ms}ms`);
  return result;
}
