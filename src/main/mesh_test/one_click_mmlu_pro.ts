// one_click_mmlu_pro.ts — BP132 Yoke #21 D9 / Yoke #22 one-click staged test
//
// CORRECTION (2026-07-23, post-Yoke-return): an earlier pass here claimed
// lb-reproducibility-pack/datasets/mmlu_pro_per_domain/ was EMPTY. That was
// wrong -- a non-recursive directory check saw 14 domain subfolders and no
// files at the top level and misreported "empty" instead of recursing. The
// corpus is real: 13 of 14 domains have a curated questions.json (law is a
// genuine gap -- META.json claims 1106 questions but no question file exists
// on disk for that one domain), ~11,000 real curated TIGER-Lab/MMLU-Pro
// questions total. Root cause was an investigation bug, not a code bug --
// loadStubQuestions() below never even attempted to read that path; it went
// straight to a 5-question hand-authored placeholder.
//
// FIX: resources/mmlu_pro_bundled/questions.jsonl now ships 130 REAL curated
// questions (10 evenly-sampled per available domain, generated via
// scripts/generate_mmlu_pro_bundle.mjs) baked into the app bundle, because
// the source corpus lives in the sibling LianaBanyanPlatform monorepo
// (lb-reproducibility-pack/), which will NOT exist on a stranger's machine --
// a packaged install has no way to reach that path. On this dev machine
// specifically (where LianaBanyanPlatform happens to be checked out as a
// sibling folder), loadQuestions() below prefers reading the FULL live
// corpus directly and falls back to the bundled 130 only when that sibling
// path isn't present (i.e. always, for anyone other than this Founder
// checkout layout). Both paths are real curated data; only the bundled path
// is guaranteed portable.
//
// TRUTH-ALWAYS SCOPE NOTE (read before extending):
// The north star (Yoke #21/#22) asks for N public MMLU-Pro questions dispatched
// OVER THE WAN MESH with per-arm accuracy shown live. This module delivers a real,
// honestly-scored MVP of that flow, with one deliberate scope narrowing still open:
//
//   - Questions ARE real MMLU-Pro curated multiple choice (3-10 options per
//     question, matching the source dataset's actual shape) with ground-truth
//     answers -- see the correction above for exactly where they come from.
//   - Scoring (parsing the model's letter answer, comparing to ground truth,
//     computing accuracy) IS real — not fabricated.
//   - Dispatch in THIS version is LOCAL (this peer's Ollama), not yet distributed
//     across WAN mesh peers. The existing mesh dispatch pipelines were evaluated
//     for reuse and found to be a mismatch for ground-truth multiple-choice scoring:
//       - mic:start-distributed-plow / mic_dispatcher.ts / canonical_pipeline.ts:
//         a 9-specialist open-research-then-arbitrate pipeline (Wikipedia/Wikidata/
//         arXiv/Wolfram/etc.) that reports back eblet-growth counts (PeerPlowResult:
//         ebletsWritten/quarantined/andonEvents), NOT the model's raw per-question
//         answer letter. Bolting ground-truth MC scoring onto it means either (a)
//         extending PeerPlowResult + the peer-side worker to also return raw answers
//         (real surgery, multi-file), or (b) parsing free-text Three-Fates synthesis
//         back into a letter (lossy, fragile).
//       - relay_answer/ (Yoke #21 A1's now-wired WAN answer poller): built for
//         open-ended Q&A relay, not batch multiple-choice, and has no built-in
//         answer-key comparison.
//     Extending one of these for real distributed ground-truth MC scoring is the
//     single largest open follow-up from this Yoke — flagged explicitly in the
//     Yoke-return to Bishop, not silently narrowed.
//
// This module is intentionally small and self-contained so a future pass can swap
// `dispatchQuestionLocally` for a real mesh-distributed dispatcher without touching
// the scoring/progress contract the renderer depends on.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { app, BrowserWindow } from 'electron';

export interface MmluProQuestion {
  question_id: number;
  question: string;
  options: string[];
  answer: string; // letter A-J
  answer_index: number;
  category: string;
  src: string;
}

export interface OneClickQuestionOutcome {
  question_id: number;
  question: string;
  category: string;
  modelRawAnswer: string;
  parsedLetter: string | null;
  correctLetter: string;
  isCorrect: boolean;
  latencyMs: number;
  error?: string;
}

export interface OneClickRunResult {
  startedAt: string;
  completedAt: string;
  total: number;
  scored: number; // total minus unparseable/errored
  correct: number;
  accuracy: number | null; // null if scored === 0
  outcomes: OneClickQuestionOutcome[];
  dispatchMode: 'local_ollama';
  datasetLabel: string;
  questionSource: 'full_corpus_live' | 'bundled_subset';
}

let running = false;

const PER_DOMAIN_DEFAULT = 10;

function resolveBundledDatasetPath(): string {
  const packaged = typeof process !== 'undefined' && (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
    ? join((process as NodeJS.Process & { resourcesPath?: string }).resourcesPath!, 'mmlu_pro_bundled', 'questions.jsonl')
    : null;
  if (app.isPackaged && packaged) return packaged;
  return resolve(app.getAppPath(), 'resources', 'mmlu_pro_bundled', 'questions.jsonl');
}

/** Ships in every install. 130 real curated MMLU-Pro questions, 10 evenly-sampled per domain. */
export function loadBundledQuestions(): MmluProQuestion[] {
  const path = resolveBundledDatasetPath();
  if (!existsSync(path)) {
    console.error(`[one_click_mmlu_pro] bundled dataset not found at ${path}`);
    return [];
  }
  try {
    const raw = readFileSync(path, 'utf8');
    return raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => JSON.parse(l) as MmluProQuestion);
  } catch (e) {
    console.error('[one_click_mmlu_pro] failed to parse bundled dataset:', e);
    return [];
  }
}

/**
 * Dev-machine-only convenience: LianaBanyanPlatform/lb-reproducibility-pack/ lives in a
 * sibling monorepo folder alongside this repo on the Founder's checkout, NOT inside this
 * app's own resources -- it will not exist on any other machine (dev or stranger's
 * packaged install). Returns null whenever that sibling path is absent, which is the
 * expected/normal case off this one machine.
 */
function resolveFullCorpusDir(): string | null {
  const candidate = resolve(app.getAppPath(), '..', 'LianaBanyanPlatform', 'lb-reproducibility-pack', 'datasets', 'mmlu_pro_per_domain');
  return existsSync(candidate) ? candidate : null;
}

function evenlySpacedIndices(length: number, count: number): number[] {
  if (length <= count) return Array.from({ length }, (_, i) => i);
  const step = length / count;
  return Array.from({ length: count }, (_, i) => Math.floor(i * step));
}

/** Reads the full ~11,000-question live corpus directly when available (see resolveFullCorpusDir). */
function loadFromFullCorpus(corpusDir: string, perDomain: number): MmluProQuestion[] {
  const domains: string[] = readdirSync(corpusDir).filter((d: string) => statSync(join(corpusDir, d)).isDirectory());
  const out: MmluProQuestion[] = [];
  let qid = 1;
  for (const domain of domains.sort()) {
    const qPath = join(corpusDir, domain, 'questions.json');
    if (!existsSync(qPath)) continue; // e.g. 'law' -- known gap, no question file shipped for that domain
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(qPath, 'utf8'));
    } catch {
      continue;
    }
    const arr = Array.isArray(parsed) ? parsed : (parsed as { questions?: unknown[] }).questions;
    if (!Array.isArray(arr) || arr.length === 0) continue;
    for (const idx of evenlySpacedIndices(arr.length, perDomain)) {
      const q = arr[idx] as { question: string; options: string[]; correct_answer: string; source_id?: string; source_category?: string };
      const answerIndex = q.options.indexOf(q.correct_answer);
      if (answerIndex === -1) continue;
      out.push({
        question_id: qid++,
        question: q.question,
        options: q.options,
        answer: letterFromIndex(answerIndex),
        answer_index: answerIndex,
        category: q.source_category || domain,
        src: 'tiger-lab-mmlu-pro-curated-live',
      });
    }
  }
  return out;
}

export interface LoadedQuestionSet {
  questions: MmluProQuestion[];
  source: 'full_corpus_live' | 'bundled_subset';
}

export function loadQuestions(perDomain: number = PER_DOMAIN_DEFAULT): LoadedQuestionSet {
  const fullDir = resolveFullCorpusDir();
  if (fullDir) {
    try {
      const qs = loadFromFullCorpus(fullDir, perDomain);
      if (qs.length > 0) {
        console.log(`[one_click_mmlu_pro] using FULL live corpus at ${fullDir} (${qs.length} questions)`);
        return { questions: qs, source: 'full_corpus_live' };
      }
    } catch (e) {
      console.error('[one_click_mmlu_pro] full corpus read failed, falling back to bundled subset:', e);
    }
  }
  return { questions: loadBundledQuestions(), source: 'bundled_subset' };
}

function letterFromIndex(i: number): string {
  return String.fromCharCode(65 + i);
}

function parseLetterFromModelText(text: string, optionCount: number): string | null {
  const validLetters = Array.from({ length: optionCount }, (_, i) => letterFromIndex(i));
  const trimmed = text.trim();
  // Prefer an exact single-letter answer, then "Answer: X" / "(X)" patterns, then
  // first standalone valid letter token found anywhere in the response.
  if (validLetters.includes(trimmed.toUpperCase()) && trimmed.length <= 2) return trimmed.toUpperCase();
  const labeled = trimmed.match(/(?:answer|correct answer)\s*(?:is|:)?\s*\(?([A-J])\)?/i);
  if (labeled && validLetters.includes(labeled[1].toUpperCase())) return labeled[1].toUpperCase();
  const paren = trimmed.match(/\(([A-J])\)/);
  if (paren && validLetters.includes(paren[1].toUpperCase())) return paren[1].toUpperCase();
  const bare = trimmed.match(/\b([A-J])\b/);
  if (bare && validLetters.includes(bare[1].toUpperCase())) return bare[1].toUpperCase();
  return null;
}

async function dispatchQuestionLocally(
  q: MmluProQuestion,
  ollamaBaseUrl: string,
  model: string,
): Promise<{ rawAnswer: string; latencyMs: number; error?: string }> {
  const optionsBlock = q.options
    .map((opt, i) => `${letterFromIndex(i)}. ${opt}`)
    .join('\n');
  const prompt = `Answer the following multiple-choice question. Respond with ONLY the letter of the correct option, nothing else.\n\nQuestion: ${q.question}\n\n${optionsBlock}\n\nAnswer:`;
  const started = Date.now();
  try {
    const res = await fetch(`${ollamaBaseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        options: { temperature: 0.0 },
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const latencyMs = Date.now() - started;
    if (!res.ok) return { rawAnswer: '', latencyMs, error: `HTTP ${res.status}` };
    const data = await res.json() as { message?: { content?: string } };
    return { rawAnswer: data.message?.content ?? '', latencyMs };
  } catch (e) {
    return { rawAnswer: '', latencyMs: Date.now() - started, error: (e as Error).message };
  }
}

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload);
  }
}

export function isOneClickRunActive(): boolean {
  return running;
}

export async function runOneClickMmluProTest(config: {
  ollamaBaseUrl?: string;
  model?: string;
  questionsPerDomain?: number;
}): Promise<OneClickRunResult> {
  if (running) {
    throw new Error('A one-click test run is already in progress');
  }
  running = true;
  const startedAt = new Date().toISOString();
  const ollamaBaseUrl = config.ollamaBaseUrl ?? 'http://127.0.0.1:11434';
  const model = config.model ?? 'gemma3:12b';
  const { questions, source } = loadQuestions(config.questionsPerDomain ?? PER_DOMAIN_DEFAULT);
  const outcomes: OneClickQuestionOutcome[] = [];

  broadcast('mesh-test:progress', { type: 'start', total: questions.length });

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    broadcast('mesh-test:progress', { type: 'question-start', index: i, total: questions.length, question: q.question, category: q.category });
    const { rawAnswer, latencyMs, error } = await dispatchQuestionLocally(q, ollamaBaseUrl, model);
    const parsedLetter = error ? null : parseLetterFromModelText(rawAnswer, q.options.length);
    const isCorrect = parsedLetter !== null && parsedLetter === q.answer.toUpperCase();
    const outcome: OneClickQuestionOutcome = {
      question_id: q.question_id,
      question: q.question,
      category: q.category,
      modelRawAnswer: rawAnswer,
      parsedLetter,
      correctLetter: q.answer.toUpperCase(),
      isCorrect,
      latencyMs,
      error,
    };
    outcomes.push(outcome);
    broadcast('mesh-test:progress', { type: 'question-complete', index: i, total: questions.length, outcome });
  }

  const scored = outcomes.filter((o) => o.parsedLetter !== null).length;
  const correct = outcomes.filter((o) => o.isCorrect).length;
  const result: OneClickRunResult = {
    startedAt,
    completedAt: new Date().toISOString(),
    total: questions.length,
    scored,
    correct,
    accuracy: scored > 0 ? correct / scored : null,
    outcomes,
    dispatchMode: 'local_ollama',
    datasetLabel: source === 'full_corpus_live'
      ? `${questions.length} real curated TIGER-Lab/MMLU-Pro questions, evenly sampled live from the full ~11,000-question corpus (dev-machine-only path)`
      : `${questions.length} real curated TIGER-Lab/MMLU-Pro questions, bundled subset shipped with the app (resources/mmlu_pro_bundled/)`,
    questionSource: source,
  };

  broadcast('mesh-test:progress', { type: 'complete', result });
  running = false;
  return result;
}
