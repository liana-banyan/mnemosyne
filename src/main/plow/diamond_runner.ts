/**
 * diamond_runner.ts — MnemosyneC v0.3.8 · BP083 SEG-2
 *
 * GPQA Diamond Benchmark runner.
 * 198 graduate-level questions across biology, chemistry, physics.
 * MIT-licensed dataset from github.com/idavidrein/gpqa
 *
 * Two modes (user-selectable in the UI):
 *   🏆 Bare Diamond  — raw Gemma 4 12B, 0-shot, no substrate, no specialists
 *   🔬 Cooperative-Pipeline Diamond — substrate RAG + 3-voter concordance
 *                                      (Andon Cord retry if no majority)
 *
 * METHODOLOGY LOCK (BP080 canon):
 *   GPQA Diamond = 0-shot methodology (Google IT-model evaluation pattern).
 *   Do NOT add few-shot examples, system prompts, or CoT suffixes without
 *   Founder re-ratify.
 *
 * num_predict: 256 + think: false per v0.3.6 Mesh A canon fix.
 * (gemma4:12b emits <think> blocks that truncate with small token budgets.)
 *
 * Caithedral™ spelling per BP081 blood statute.
 */

import * as fs from 'fs';
import * as path from 'path';
import { extractLetterChoice } from './giant_concordance';
import { queryVerifiedEbletsTopical } from '../mnem_eblet_store';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DiamondDomain = 'physics' | 'chemistry' | 'biology';

export interface DiamondQuestion {
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correct_answer: string;
  domain: DiamondDomain;
  explanation?: string;
}

export interface DiamondQuestionResult {
  questionIndex: number;
  question: string;
  domain: DiamondDomain;
  predicted: string | null;
  correct: string;
  is_correct: boolean;
  raw_response: string;
  attempts?: number;
  substrateEblets?: number;
  elapsed_ms: number;
}

export interface DiamondDomainSummary {
  domain: DiamondDomain;
  total: number;
  correct: number;
  score_pct: number;
}

export interface DiamondRunSummary {
  mode: 'bare' | 'cooperative';
  total: number;
  correct: number;
  score_pct: number;
  by_domain: Record<DiamondDomain, DiamondDomainSummary>;
  results: DiamondQuestionResult[];
  elapsed_ms: number;
  startedAt: number;
  completedAt: number;
}

export type DiamondProgressEvent =
  | { type: 'question-start'; questionIndex: number; total: number; domain: DiamondDomain; mode: string }
  | { type: 'question-done'; questionIndex: number; total: number; domain: DiamondDomain; is_correct: boolean; predicted: string | null; correct: string; running_pct: number }
  | { type: 'substrate-hit'; questionIndex: number; eblets: number }
  | { type: 'andon-retry'; questionIndex: number; attempt: number }
  | { type: 'complete'; summary: DiamondRunSummary };

// ─── Constants ────────────────────────────────────────────────────────────────

const OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
const OLLAMA_MODEL = 'gemma4:12b';
const OLLAMA_TIMEOUT_MS = 60_000; // 60s timeout for Diamond (longer than mesh)
const DIAMOND_MAX_ANDON_RETRIES = 3; // max retries for cooperative mode concordance
const COOPERATIVE_VOTER_TEMPS: [number, number, number] = [0.0, 0.2, 0.4];

// ─── Resource path resolution ─────────────────────────────────────────────────

function getDiamondBankPath(): string {
  // In packaged Electron app: process.resourcesPath/seeds/gpqa_diamond_seed.jsonl
  // In dev: workspace_root/resources/seeds/gpqa_diamond_seed.jsonl
  if (typeof process !== 'undefined' && (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath) {
    const pkgPath = path.join(
      (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath!,
      'seeds',
      'gpqa_diamond_seed.jsonl',
    );
    if (fs.existsSync(pkgPath)) return pkgPath;
  }
  // Dev fallback: relative to workspace root
  const devPath = path.resolve(__dirname, '../../../../resources/seeds/gpqa_diamond_seed.jsonl');
  return devPath;
}

// ─── Question bank loader ─────────────────────────────────────────────────────

export function loadDiamondBank(limit?: number): DiamondQuestion[] {
  const bankPath = getDiamondBankPath();

  if (!fs.existsSync(bankPath)) {
    throw new Error(`GPQA Diamond bank not found at: ${bankPath}`);
  }

  const lines = fs
    .readFileSync(bankPath, 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0);

  const questions: DiamondQuestion[] = [];
  for (const line of lines) {
    try {
      const q = JSON.parse(line) as DiamondQuestion;
      questions.push(q);
    } catch {
      // Skip malformed lines
    }
  }

  return limit ? questions.slice(0, limit) : questions;
}

// ─── 0-shot MCQ prompt (BP080 methodology lock — DO NOT add few-shot/CoT) ────

function buildZeroShotPrompt(q: DiamondQuestion, substrateContext?: string): string {
  // BP080 methodology lock: 0-shot, no few-shot, no chain-of-thought
  const contextPrefix = substrateContext
    ? `Relevant background knowledge:\n${substrateContext}\n\n`
    : '';

  return `${contextPrefix}Question: ${q.question}

Options:
A) ${q.options.A}
B) ${q.options.B}
C) ${q.options.C}
D) ${q.options.D}

Answer (single letter only):`;
}

// ─── Ollama call (mirrors mesh_comparison_runner.ts pattern) ─────────────────

async function callOllama(
  prompt: string,
  temperature: number,
  abortSignal?: AbortSignal,
): Promise<string | null> {
  try {
    const requestBody = {
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      // num_predict: 256 + think: false per v0.3.6 Mesh A canon fix
      options: { num_predict: 256, temperature, think: false },
    };

    const resp = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: abortSignal ?? AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
    });

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '(unreadable)');
      console.error(`[Diamond-DIAG] Ollama error ${resp.status}: ${errBody.slice(0, 200)}`);
      return null;
    }

    const data = (await resp.json()) as { response?: string };
    const raw = (data.response ?? '').trim();
    console.log(
      `[Diamond-DIAG] Raw response (first 80): ${raw.slice(0, 80).replace(/\n/g, '↵')}`,
    );
    return raw;
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      console.log('[Diamond-DIAG] Ollama call aborted');
      return null;
    }
    console.error('[Diamond-DIAG] Ollama fetch error:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

// ─── Letter extraction (wraps extractLetterChoice with fast-path) ─────────────

function extractDiamondLetter(response: string): string | null {
  if (!response) return null;
  // Fast-path: first character is A-D
  const firstChar = response.charAt(0).toUpperCase();
  if (['A', 'B', 'C', 'D'].includes(firstChar)) return firstChar;
  // Fall through to full extractLetterChoice (from giant_concordance.ts)
  const extracted = extractLetterChoice(response);
  if (extracted && ['A', 'B', 'C', 'D'].includes(extracted)) return extracted;
  return null;
}

// ─── Substrate context helper ─────────────────────────────────────────────────

async function fetchSubstrateContext(
  questionText: string,
  domain: DiamondDomain,
  topK = 3,
): Promise<{ context: string | undefined; count: number }> {
  try {
    const eblets = await queryVerifiedEbletsTopical(questionText, domain, topK);
    if (eblets.length === 0) return { context: undefined, count: 0 };
    const lines = eblets.map((e, i) => `[${i + 1}] ${e.question.slice(0, 120)}`);
    return { context: lines.join('\n'), count: eblets.length };
  } catch {
    return { context: undefined, count: 0 };
  }
}

// ─── Bare Diamond: single 0-shot Gemma call, no substrate ────────────────────

async function runBareSingleQuestion(
  q: DiamondQuestion,
  abortSignal?: AbortSignal,
): Promise<{ predicted: string | null; raw_response: string; elapsed_ms: number }> {
  const t0 = Date.now();
  const prompt = buildZeroShotPrompt(q);
  const raw = await callOllama(prompt, 0.0, abortSignal);
  const predicted = raw !== null ? extractDiamondLetter(raw) : null;
  console.log(
    `[Diamond-Bare] domain=${q.domain} predicted=${predicted} correct=${q.correct_answer} ✓=${predicted === q.correct_answer}`,
  );
  return { predicted, raw_response: raw ?? '', elapsed_ms: Date.now() - t0 };
}

// ─── Cooperative Diamond: substrate RAG + 3-voter concordance + Andon retry ──

async function runCooperativeSingleQuestion(
  q: DiamondQuestion,
  abortSignal?: AbortSignal,
): Promise<{
  predicted: string | null;
  raw_response: string;
  elapsed_ms: number;
  substrateEblets: number;
  attempts: number;
}> {
  const t0 = Date.now();
  let attempts = 0;
  let lastPredicted: string | null = null;
  let lastRaw = '';
  let substrateEblets = 0;
  let concordanceReached = false;

  while (attempts < DIAMOND_MAX_ANDON_RETRIES) {
    // Adaptive substrate query: first pass = base question; retries augmented
    const contextQuery = attempts === 0
      ? q.question
      : `${q.domain} ${q.question} alternative perspectives`;

    const { context: substrateContext, count: ebletCount } = await fetchSubstrateContext(
      contextQuery,
      q.domain,
      3,
    );
    if (attempts === 0) substrateEblets = ebletCount;

    // Build prompt with substrate context (0-shot per BP080 — no few-shot examples)
    const prompt = buildZeroShotPrompt(q, substrateContext);

    // Temperature escalation per attempt: 0.0, 0.15, 0.30 (per-attempt base)
    const baseTemp = Math.min(attempts * 0.15, 0.3);
    const voterTemps: [number, number, number] = [
      baseTemp,
      Math.min(baseTemp + 0.2, 0.4),
      Math.min(baseTemp + 0.4, 0.6),
    ];

    // 3-voter concordance (mirrors mesh_comparison_runner.ts Condition B/C)
    const voterResults = await Promise.all(
      voterTemps.map(async (temp) => {
        const raw = await callOllama(prompt, temp, abortSignal);
        return { letter: raw !== null ? extractDiamondLetter(raw) : null, raw: raw ?? '' };
      }),
    );

    attempts++;

    // Check for majority (concordance): ≥2 of 3 voters agree
    const letterCounts: Record<string, number> = {};
    for (const v of voterResults) {
      if (v.letter) letterCounts[v.letter] = (letterCounts[v.letter] ?? 0) + 1;
    }

    let majorityLetter: string | null = null;
    let maxCount = 0;
    for (const [letter, count] of Object.entries(letterCounts)) {
      if (count > maxCount) { maxCount = count; majorityLetter = letter; }
    }

    if (majorityLetter && maxCount >= 2) {
      concordanceReached = true;
      lastPredicted = majorityLetter;
      lastRaw = voterResults.find((v) => v.letter === majorityLetter)?.raw ?? '';
      break;
    }

    // No concordance: log Andon and retry with higher temperature
    lastPredicted = majorityLetter ?? voterResults.find((v) => v.letter !== null)?.letter ?? null;
    lastRaw = voterResults[0]?.raw ?? '';

    console.log(
      `[Diamond-Coop] Andon retry attempt=${attempts} domain=${q.domain} ` +
      `votes=${JSON.stringify(letterCounts)} correct=${q.correct_answer}`,
    );
  }

  const is_correct = lastPredicted === q.correct_answer;
  console.log(
    `[Diamond-Coop] domain=${q.domain} predicted=${lastPredicted} correct=${q.correct_answer} ` +
    `✓=${is_correct} attempts=${attempts} concordance=${concordanceReached} substrate=${substrateEblets}`,
  );

  return {
    predicted: lastPredicted,
    raw_response: lastRaw,
    elapsed_ms: Date.now() - t0,
    substrateEblets,
    attempts,
  };
}

// ─── Build domain-level summary from results ─────────────────────────────────

function buildDomainSummary(
  results: DiamondQuestionResult[],
): Record<DiamondDomain, DiamondDomainSummary> {
  const domains: DiamondDomain[] = ['physics', 'chemistry', 'biology'];
  const by_domain = {} as Record<DiamondDomain, DiamondDomainSummary>;

  for (const domain of domains) {
    const domainResults = results.filter((r) => r.domain === domain);
    const correct = domainResults.filter((r) => r.is_correct).length;
    const total = domainResults.length;
    by_domain[domain] = {
      domain,
      total,
      correct,
      score_pct: total > 0 ? (correct / total) * 100 : 0,
    };
  }

  return by_domain;
}

// ─── Public runner: Bare Diamond ─────────────────────────────────────────────

export async function runBareDiamond(
  questionsToRun: number = 198,
  onProgress?: (event: DiamondProgressEvent) => void,
  cancelToken?: { cancelled: boolean },
): Promise<DiamondRunSummary> {
  const startedAt = Date.now();
  let questions: DiamondQuestion[];
  try {
    questions = loadDiamondBank(questionsToRun);
  } catch (err) {
    throw new Error(`Failed to load GPQA Diamond bank: ${(err as Error).message}`);
  }

  const results: DiamondQuestionResult[] = [];
  let correct = 0;

  for (let i = 0; i < questions.length; i++) {
    if (cancelToken?.cancelled) break;

    const q = questions[i]!;
    onProgress?.({
      type: 'question-start',
      questionIndex: i,
      total: questions.length,
      domain: q.domain,
      mode: 'bare',
    });

    const { predicted, raw_response, elapsed_ms } = await runBareSingleQuestion(q);

    const is_correct = predicted === q.correct_answer;
    if (is_correct) correct++;

    const result: DiamondQuestionResult = {
      questionIndex: i,
      question: q.question.slice(0, 200),
      domain: q.domain,
      predicted,
      correct: q.correct_answer,
      is_correct,
      raw_response: raw_response.slice(0, 300),
      elapsed_ms,
    };
    results.push(result);

    onProgress?.({
      type: 'question-done',
      questionIndex: i,
      total: questions.length,
      domain: q.domain,
      is_correct,
      predicted,
      correct: q.correct_answer,
      running_pct: results.length > 0 ? (correct / results.length) * 100 : 0,
    });
  }

  const completedAt = Date.now();
  const total = results.length;
  const summary: DiamondRunSummary = {
    mode: 'bare',
    total,
    correct,
    score_pct: total > 0 ? (correct / total) * 100 : 0,
    by_domain: buildDomainSummary(results),
    results,
    elapsed_ms: completedAt - startedAt,
    startedAt,
    completedAt,
  };

  onProgress?.({ type: 'complete', summary });
  console.log(
    `[Diamond-Bare] COMPLETE total=${total} correct=${correct} ` +
    `score=${summary.score_pct.toFixed(1)}% elapsed=${Math.round(summary.elapsed_ms / 1000)}s`,
  );

  return summary;
}

// ─── Public runner: Cooperative-Pipeline Diamond ─────────────────────────────

export async function runCooperativeDiamond(
  questionsToRun: number = 198,
  onProgress?: (event: DiamondProgressEvent) => void,
  cancelToken?: { cancelled: boolean },
): Promise<DiamondRunSummary> {
  const startedAt = Date.now();
  let questions: DiamondQuestion[];
  try {
    questions = loadDiamondBank(questionsToRun);
  } catch (err) {
    throw new Error(`Failed to load GPQA Diamond bank: ${(err as Error).message}`);
  }

  const results: DiamondQuestionResult[] = [];
  let correct = 0;

  for (let i = 0; i < questions.length; i++) {
    if (cancelToken?.cancelled) break;

    const q = questions[i]!;
    onProgress?.({
      type: 'question-start',
      questionIndex: i,
      total: questions.length,
      domain: q.domain,
      mode: 'cooperative',
    });

    const { predicted, raw_response, elapsed_ms, substrateEblets, attempts } =
      await runCooperativeSingleQuestion(q);

    const is_correct = predicted === q.correct_answer;
    if (is_correct) correct++;

    const result: DiamondQuestionResult = {
      questionIndex: i,
      question: q.question.slice(0, 200),
      domain: q.domain,
      predicted,
      correct: q.correct_answer,
      is_correct,
      raw_response: raw_response.slice(0, 300),
      attempts,
      substrateEblets,
      elapsed_ms,
    };
    results.push(result);

    if (substrateEblets > 0) {
      onProgress?.({ type: 'substrate-hit', questionIndex: i, eblets: substrateEblets });
    }

    if ((attempts ?? 1) > 1) {
      onProgress?.({ type: 'andon-retry', questionIndex: i, attempt: attempts ?? 1 });
    }

    onProgress?.({
      type: 'question-done',
      questionIndex: i,
      total: questions.length,
      domain: q.domain,
      is_correct,
      predicted,
      correct: q.correct_answer,
      running_pct: results.length > 0 ? (correct / results.length) * 100 : 0,
    });
  }

  const completedAt = Date.now();
  const total = results.length;
  const summary: DiamondRunSummary = {
    mode: 'cooperative',
    total,
    correct,
    score_pct: total > 0 ? (correct / total) * 100 : 0,
    by_domain: buildDomainSummary(results),
    results,
    elapsed_ms: completedAt - startedAt,
    startedAt,
    completedAt,
  };

  onProgress?.({ type: 'complete', summary });
  console.log(
    `[Diamond-Coop] COMPLETE total=${total} correct=${correct} ` +
    `score=${summary.score_pct.toFixed(1)}% elapsed=${Math.round(summary.elapsed_ms / 1000)}s`,
  );

  return summary;
}

// ─── Utility: voter temperatures constant (exported for UI display) ───────────

export { COOPERATIVE_VOTER_TEMPS };
