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
// WAN-DISTRIBUTED DISPATCH (BP132 Yoke #23, 2026-07-23): the north star -- N public
// MMLU-Pro questions dispatched OVER THE WAN MESH with per-peer AND aggregate accuracy
// shown live -- is now wired. See src/main/mesh_test/wan_dispatch.ts for the full
// R-MECHANISM-VERIFY writeup of how this was built against the REAL, already-proven
// relay_routes/relay_route_replies mechanism (verified live against production Supabase
// data, including a real 2026-07-06 run that already produced one honest, correct,
// cross-peer WAN answer -- this module makes that a repeatable one-click flow instead of
// a lost ad-hoc script). `local_ollama` is kept as a selectable fallback per the Yoke:
// it is still the only mode provable without live peers online (peer_presence had 0 rows
// as of this writing -- WAN mode will honestly report "no live peers" rather than
// silently falling back when explicitly requested, see mode handling below).
//
// TRUTH-ALWAYS SCOPE NOTE (read before extending):
//   - Questions ARE real MMLU-Pro curated multiple choice (3-10 options per
//     question, matching the source dataset's actual shape) with ground-truth
//     answers -- see the correction above for exactly where they come from.
//   - Scoring (parsing the model's letter answer, comparing to ground truth,
//     computing accuracy) IS real — not fabricated, in both local and WAN modes.
//   - WAN mode dispatches each question to every currently-live peer independently
//     (no consensus voting) so per-peer accuracy is never collapsed into a synthetic
//     answer; aggregate accuracy is the pooled total across all peer answers.
//   - Live multi-peer verification is still PENDING Bishop/Founder action: this
//     environment has no way to have a second real peer online to test against
//     (peer_presence was 0 rows at last check). The code path is real and was built
//     against the real, verified schema, but an actual >=2-live-peer run has not
//     been observed by this agent -- flagged explicitly in the Yoke-return, same
//     pattern as Yoke #21's peer_presence flag.

import { readFileSync, existsSync, readdirSync, statSync, appendFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { app, BrowserWindow } from 'electron';
import { discoverLiveWanPeers, dispatchQuestionToWanPeers, type WanPeerInfo, type WanConsensusResult } from './wan_dispatch';
import { applySubstrateToggle, isDebugPromptLoggingEnabled, buildOutboundPromptLogLine } from './substrate_toggle';

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
  /** Set only in wan_mesh mode: which peer produced this outcome (one outcome per question-per-peer). */
  peerId?: string;
  machineLabel?: string;
  timedOut?: boolean;
  isAbstain?: boolean;
  /** BP133 Yoke #24 Task 1: true only when substrate context was actually prepended to the
   *  prompt sent to the model for this specific question (local_ollama mode only -- for
   *  wan_mesh outcomes this is decided by the responder and is not echoed back today). */
  substrateContextInjected?: boolean;
  /** BP133 Yoke #24 Task 2: wan_mesh mode only -- which mechanism produced this outcome. */
  answeredBy?: 'plow' | 'minor_council' | 'single_shot';
  /** BP133 Yoke #24 Task 2: wan_mesh + plow mode only -- the plow's full audit trace, present
   *  only when answeredBy === 'plow'. Persisted verbatim into the Task 2.3 receipt file. */
  plowTrace?: Record<string, unknown> | null;
}

/** BP135 Phase 2 (Layer A: consensus): the mesh's single answer for one question, alongside
 *  the per-peer OneClickQuestionOutcome rows for that same question -- never a replacement
 *  for them. Scored locally against the sealed answer key, same as every other outcome here. */
export interface ConsensusQuestionOutcome {
  question_id: number;
  question: string;
  category: string;
  correctLetter: string;
  consensusLetter: string | null;
  isConsensusCorrect: boolean;
  confidenceVariance: number;
  andonTriggered: boolean;
}

export interface PeerAccuracyBreakdown {
  peerId: string;
  machineLabel: string;
  total: number;
  scored: number;
  correct: number;
  accuracy: number | null;
}

export interface OneClickRunResult {
  startedAt: string;
  completedAt: string;
  total: number;
  scored: number; // total minus unparseable/errored
  correct: number;
  accuracy: number | null; // null if scored === 0
  outcomes: OneClickQuestionOutcome[];
  dispatchMode: 'local_ollama' | 'wan_mesh';
  datasetLabel: string;
  questionSource: 'full_corpus_live' | 'bundled_subset';
  /** Only present in wan_mesh mode: per-peer accuracy alongside the pooled aggregate above. */
  peerBreakdown?: PeerAccuracyBreakdown[];
  /** Only present in wan_mesh mode: how many live peers (peer_presence status=active, recently seen) were found. */
  livePeersFound?: number;
  /** Honest failure surface: set when wan_mesh was explicitly requested but no live peers exist. */
  wanError?: string;
  /** BP133 Yoke #24 Task 1: whether substrate/context injection was requested for this run.
   *  Surfaced so a result can never be misread as substrate-off when it was on, or vice
   *  versa -- Truth-Always requirement, same rationale as dispatchMode. */
  substrateEnabled: boolean;
  /** BP133 Yoke #24 Task 2: whether the 12-Blade Column Plow was requested as the wan_mesh
   *  answering mechanism for this run (false/absent means single-shot, the pre-Task-2
   *  default). Surfaced so a result can never be misread as plow-answered when it was not. */
  plowEnabled?: boolean;
  /** BP137 Yoke v2b (Research Arm): whether Stage A.0 (relevance gate moved upstream of the MC
   *  voters) + Stage A (answer-type classifier + compute sidecar) were requested for this run.
   *  Ignored unless plowEnabled is also true (see plow_mc_answerer.ts's researchArmMode doc).
   *  false/absent means the pre-Stage-A/A.0 plow behavior, byte-for-byte unchanged. */
  researchArmMode?: boolean;
  /** BP133 Yoke #24 Task 3: true when the run was stopped early via requestCancel() rather
   *  than completing all questions -- Truth-Always: a partial run must say so, never be
   *  presented as if it ran to completion. */
  cancelled?: boolean;
  /** BP134 Yoke #32 Phase F item 2: set to the per-category count when this run used the
   *  "Full 14x5 MMLU-Pro" exact-sampling preset (or any custom exactPerCategory value). */
  exactPerCategory?: number;
  /** BP134 Yoke #32 Phase F item 3: sha256 of the exact bundled corpus file this run's
   *  questions were sourced from -- lets a receipt be verified against the exact corpus
   *  version it was scored against. Present only when questionSource === 'bundled_subset'
   *  AND resources/mmlu_pro_bundled/manifest.json exists (BP134-and-later builds). */
  corpusManifestSha256?: string;
  /** BP135 Phase 2 (Layer A: consensus), wan_mesh mode only -- one entry per question, the
   *  mesh's single consensus answer alongside (never instead of) peerBreakdown/outcomes. */
  consensusOutcomes?: ConsensusQuestionOutcome[];
  /** Aggregate accuracy of the mesh's single consensus answer, wan_mesh mode only. Scored
   *  over questions where a consensus letter was actually reached; null if none were. */
  consensusAccuracy?: number | null;
  /** BP135 Phase 3 (Layer B: federated substrate): whether pooled cross-peer substrate was
   *  requested for this run. Truth-Always -- same rationale as substrateEnabled/plowEnabled,
   *  a result can never be misread as pooled when it was per-peer-local-only, or vice versa. */
  federatedSubstrateEnabled?: boolean;
}

let running = false;
let cancelRequested = false;

/** BP133 Yoke #24 Task 3: cooperative cancellation for the Diagnostic terminal's `stop`
 *  command. Checked between questions (never mid-Ollama-call) in runLocalMode/runWanMode --
 *  a run stops at the next question boundary, and the result is explicitly marked
 *  cancelled:true rather than silently truncated. */
export function requestOneClickCancel(): { ok: boolean; wasRunning: boolean } {
  const wasRunning = running;
  cancelRequested = true;
  return { ok: true, wasRunning };
}

const PER_DOMAIN_DEFAULT = 10;

// BP134 Yoke #32 Phase F: the 14 canonical MMLU-Pro domains this app's bundled corpus
// now covers exactly (10/category, 140 total, law gap fixed -- see generate_mmlu_pro_bundle.mjs).
// Mirrors per_domain_q_banks.ts ALL_DOMAINS / TestItOutTab & ClipboardCaptureModal DOMAIN_OPTIONS.
const CANONICAL_CATEGORIES = [
  'math', 'physics', 'chemistry', 'biology', 'computer_science', 'engineering',
  'history', 'philosophy', 'law', 'business', 'economics', 'psychology', 'health', 'other',
];

function resolveBundledDatasetPath(): string {
  const packaged = typeof process !== 'undefined' && (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
    ? join((process as NodeJS.Process & { resourcesPath?: string }).resourcesPath!, 'mmlu_pro_bundled', 'questions.jsonl')
    : null;
  if (app.isPackaged && packaged) return packaged;
  return resolve(app.getAppPath(), 'resources', 'mmlu_pro_bundled', 'questions.jsonl');
}

function resolveBundledManifestPath(): string {
  const packaged = typeof process !== 'undefined' && (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
    ? join((process as NodeJS.Process & { resourcesPath?: string }).resourcesPath!, 'mmlu_pro_bundled', 'manifest.json')
    : null;
  if (app.isPackaged && packaged) return packaged;
  return resolve(app.getAppPath(), 'resources', 'mmlu_pro_bundled', 'manifest.json');
}

export interface BundledCorpusManifest {
  version: string;
  generatedAt: string;
  totalQuestions: number;
  sha256: string;
  categories: Array<{ category: string; count: number }>;
}

/** BP134 Yoke #32 Phase F item 3: read the shipped corpus manifest so a receipt can be
 *  verified against the exact corpus version it was scored against. Non-fatal -- returns
 *  null when the manifest is absent (e.g. an older build predating this feature). */
export function loadBundledCorpusManifest(): BundledCorpusManifest | null {
  const path = resolveBundledManifestPath();
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as BundledCorpusManifest;
  } catch (e) {
    console.warn('[one_click_mmlu_pro] failed to parse bundled corpus manifest:', e);
    return null;
  }
}

/** BP134 Yoke #32 Phase F item 2: exact per-category sampling for the "Full 14x5" preset --
 *  groups by category (canonical categories first, in canonical order, then any others found)
 *  and evenly samples exactly `perCategory` from each group (or all of a group when it has
 *  fewer). Unlike downsampleQuestions() (a single global even-stride cut), this GUARANTEES
 *  category coverage regardless of how the source array happens to be laid out or grouped. */
export function sampleExactPerCategory(questions: MmluProQuestion[], perCategory: number): MmluProQuestion[] {
  const byCategory = new Map<string, MmluProQuestion[]>();
  for (const q of questions) {
    const list = byCategory.get(q.category);
    if (list) list.push(q); else byCategory.set(q.category, [q]);
  }
  const orderedCategories = [
    ...CANONICAL_CATEGORIES.filter((c) => byCategory.has(c)),
    ...Array.from(byCategory.keys()).filter((c) => !CANONICAL_CATEGORIES.includes(c)).sort(),
  ];
  const out: MmluProQuestion[] = [];
  for (const category of orderedCategories) {
    const group = byCategory.get(category)!;
    for (const idx of evenlySpacedIndices(group.length, perCategory)) {
      out.push(group[idx]!);
    }
  }
  return out;
}

/** Ships in every install. 140 real curated MMLU-Pro questions, 10 evenly-sampled per domain
 *  across all 14 canonical categories (BP134 Yoke #32 Phase F: law gap fixed, category names
 *  normalized -- see generate_mmlu_pro_bundle.mjs header note). */
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

// BP133 Yoke #24 Task 2: exported so plow_mc_answerer.ts's MC letter extraction reuses the
// exact same parsing convention as local/single-shot dispatch, instead of a second copy.
export function letterFromIndex(i: number): string {
  return String.fromCharCode(65 + i);
}

export function parseLetterFromModelText(text: string, optionCount: number): string | null {
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

/** BP133 Yoke #24 Task 1: opt-in outbound-prompt byte logging (MNEMO_DEBUG_LOG_PROMPTS=1).
 *  Written to {userData}/substrate/debug_outbound_prompts.jsonl. Never logs keys/secrets --
 *  these prompts are exclusively MMLU-Pro question text + optional topical substrate
 *  context, both of which are already visible in the app UI. */
function logOutboundPromptIfEnabled(entry: Parameters<typeof buildOutboundPromptLogLine>[0]): void {
  if (!isDebugPromptLoggingEnabled()) return;
  try {
    const dir = join(app.getPath('userData'), 'substrate');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, 'debug_outbound_prompts.jsonl'), buildOutboundPromptLogLine(entry) + '\n', 'utf8');
  } catch (e) {
    console.warn('[one_click_mmlu_pro] debug prompt log write failed (non-fatal):', e);
  }
}

async function dispatchQuestionLocally(
  q: MmluProQuestion,
  ollamaBaseUrl: string,
  model: string,
  substrateEnabled: boolean,
): Promise<{ rawAnswer: string; latencyMs: number; error?: string; substrateContextInjected: boolean }> {
  const optionsBlock = q.options
    .map((opt, i) => `${letterFromIndex(i)}. ${opt}`)
    .join('\n');
  const basePrompt = `Answer the following multiple-choice question. Respond with ONLY the letter of the correct option, nothing else.\n\nQuestion: ${q.question}\n\n${optionsBlock}\n\nAnswer:`;

  // BP133 Yoke #24 Task 1: the ONLY substrate injection site for local-mode dispatch. When
  // substrateEnabled is false, applySubstrateToggle makes no eblet-store call at all.
  const { prompt, contextInjected, ebletCount } = await applySubstrateToggle(
    basePrompt, q.question, q.category, substrateEnabled,
  );

  logOutboundPromptIfEnabled({
    ts: new Date().toISOString(),
    source: 'local_dispatch',
    mode: 'single_shot',
    model,
    substrateEnabled,
    contextInjected,
    ebletCount,
    questionId: q.question_id,
    domain: q.category,
    promptChars: prompt.length,
    prompt,
  });

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
    if (!res.ok) return { rawAnswer: '', latencyMs, error: `HTTP ${res.status}`, substrateContextInjected: contextInjected };
    const data = await res.json() as { message?: { content?: string } };
    return { rawAnswer: data.message?.content ?? '', latencyMs, substrateContextInjected: contextInjected };
  } catch (e) {
    return { rawAnswer: '', latencyMs: Date.now() - started, error: (e as Error).message, substrateContextInjected: contextInjected };
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

function generateSessionId(): string {
  return 'oneclick_' + randomBytes(6).toString('hex');
}

/** Downsamples an already-loaded question set evenly for the (much slower) WAN path. */
function downsampleQuestions(questions: MmluProQuestion[], maxTotal: number): MmluProQuestion[] {
  if (questions.length <= maxTotal) return questions;
  const step = questions.length / maxTotal;
  const indices = Array.from({ length: maxTotal }, (_, i) => Math.floor(i * step));
  return indices.map((i) => questions[i]!);
}

async function runLocalMode(
  questions: MmluProQuestion[],
  ollamaBaseUrl: string,
  model: string,
  substrateEnabled: boolean,
  progressChannel: string,
): Promise<OneClickQuestionOutcome[]> {
  const outcomes: OneClickQuestionOutcome[] = [];
  for (let i = 0; i < questions.length; i++) {
    if (cancelRequested) break;
    const q = questions[i];
    broadcast(progressChannel, { type: 'question-start', index: i, total: questions.length, question: q.question, category: q.category });
    const { rawAnswer, latencyMs, error, substrateContextInjected } = await dispatchQuestionLocally(q, ollamaBaseUrl, model, substrateEnabled);
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
      substrateContextInjected,
    };
    outcomes.push(outcome);
    broadcast(progressChannel, { type: 'question-complete', index: i, total: questions.length, outcome });
  }
  return outcomes;
}

/** BP133 Yoke #24 Task 2.3: persist a scored, auditable receipt for every plow-answered WAN
 *  question -- the exact capture the flagship THIRD_PLOW_42Q_BRIDGED_BP093 run never made
 *  (full process telemetry saved, but no chosen answer, no correctness field, un-scoreable
 *  forever). Every question this function is called for MUST already have ground truth
 *  available (asker-side scoring, per Task 2's "remote peer never sees the answer key"
 *  requirement) -- correctness is computed locally, never trusted from the peer. */
function persistPlowReceipt(entry: {
  sessionId: string;
  questionId: number;
  domain: string;
  chosenAnswer: string | null;
  correctAnswer: string;
  correct: boolean;
  substrateEnabled: boolean;
  plowAndonEnabled: boolean;
  peerId?: string;
  machineLabel?: string;
  plowTrace?: Record<string, unknown> | null;
  /** BP134 Yoke #32 Phase F item 3: sha256 of the corpus manifest this question was
   *  sourced from, so the receipt can be verified against the exact corpus version. */
  corpusManifestSha256?: string;
  /** BP135 Phase 2 (Layer A: consensus): the mesh's answer for this SAME question, alongside
   *  (never instead of) this individual peer's plow answer -- lets a receipt show both what
   *  this one peer said and what the mesh-as-one-unit concluded. */
  consensusLetter?: string | null;
  consensusCorrect?: boolean;
  confidenceVariance?: number;
  andonTriggered?: boolean;
}): void {
  try {
    const dir = join(app.getPath('userData'), 'plow_receipts');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n';
    appendFileSync(join(dir, `${entry.sessionId}.jsonl`), line, 'utf8');
  } catch (e) {
    // Non-fatal per Truth-Always -- a receipt-write failure must not silently swallow the
    // scored outcome from the in-memory result, but it must be visible in logs, not silent.
    console.error('[one_click_mmlu_pro] plow receipt persistence failed (non-fatal):', e);
  }
}

/** Dispatches each question to every live peer in parallel; one outcome per (question, peer). */
async function runWanMode(
  questions: MmluProQuestion[],
  peers: WanPeerInfo[],
  sessionId: string,
  perQuestionTimeoutMs: number,
  substrateEnabled: boolean,
  plowEnabled: boolean,
  plowAndonEnabled: boolean,
  corpusManifestSha256: string | undefined,
  // BP135 Phase 3 (Layer B: federated substrate): explicit opt-in, defaults false.
  federatedSubstrateEnabled: boolean,
  progressChannel: string,
  // BP137 Yoke v2b (Research Arm): explicit opt-in, defaults false, ignored unless plowEnabled
  // is also true. See runOneClickMmluProTest's config JSDoc.
  researchArmMode: boolean = false,
): Promise<{ outcomes: OneClickQuestionOutcome[]; consensusOutcomes: ConsensusQuestionOutcome[] }> {
  const outcomes: OneClickQuestionOutcome[] = [];
  const consensusOutcomes: ConsensusQuestionOutcome[] = [];
  const totalUnits = questions.length * peers.length;
  let unitIndex = 0;

  for (let i = 0; i < questions.length; i++) {
    if (cancelRequested) break;
    const q = questions[i];
    broadcast(progressChannel, {
      type: 'question-start', index: unitIndex, total: totalUnits, question: q.question, category: q.category,
    });

    const wanOutcome = await dispatchQuestionToWanPeers(
      q, peers, sessionId, perQuestionTimeoutMs, substrateEnabled, plowEnabled, plowAndonEnabled, federatedSubstrateEnabled,
      researchArmMode,
    );

    // BP135 Phase 2 (Layer A: consensus): one mesh-as-one-unit outcome per question, scored
    // locally against the sealed answer key -- alongside, never instead of, the per-peer
    // outcomes below.
    const isConsensusCorrect = wanOutcome.consensus.consensusLetter !== null
      && wanOutcome.consensus.consensusLetter === wanOutcome.correctLetter;
    consensusOutcomes.push({
      question_id: q.question_id,
      question: q.question,
      category: q.category,
      correctLetter: wanOutcome.correctLetter,
      consensusLetter: wanOutcome.consensus.consensusLetter,
      isConsensusCorrect,
      confidenceVariance: wanOutcome.consensus.confidenceVariance,
      andonTriggered: wanOutcome.consensus.andonTriggered,
    });

    for (const pa of wanOutcome.peerAnswers) {
      const outcome: OneClickQuestionOutcome = {
        question_id: q.question_id,
        question: q.question,
        category: q.category,
        modelRawAnswer: pa.answerLetter ?? (pa.isAbstain ? 'ABSTAIN' : ''),
        parsedLetter: pa.answerLetter,
        correctLetter: wanOutcome.correctLetter,
        isCorrect: pa.isCorrect,
        latencyMs: pa.processingMs ?? perQuestionTimeoutMs,
        error: pa.error ?? (pa.timedOut ? 'peer did not reply within timeout' : undefined),
        peerId: pa.peerId,
        machineLabel: pa.machineLabel,
        timedOut: pa.timedOut,
        isAbstain: pa.isAbstain,
        answeredBy: pa.answeredBy,
        plowTrace: pa.plowTrace,
      };
      outcomes.push(outcome);
      unitIndex++;
      broadcast(progressChannel, { type: 'question-complete', index: unitIndex - 1, total: totalUnits, outcome });

      // BP133 Yoke #24 Task 2.3: persist a scored receipt for every plow-answered outcome.
      // Deliberately scoped to answeredBy === 'plow' rather than every WAN outcome -- this is
      // the exact capture the Yoke calls out as previously missing, and single-shot/Minor
      // Council outcomes are already fully captured in the in-memory OneClickRunResult (this
      // is a one-click UI test, not a headless overnight run at risk of losing that object).
      if (pa.answeredBy === 'plow') {
        persistPlowReceipt({
          sessionId,
          questionId: q.question_id,
          domain: q.category,
          chosenAnswer: pa.answerLetter,
          correctAnswer: wanOutcome.correctLetter,
          correct: pa.isCorrect,
          substrateEnabled,
          plowAndonEnabled,
          peerId: pa.peerId,
          machineLabel: pa.machineLabel,
          plowTrace: pa.plowTrace,
          corpusManifestSha256,
          consensusLetter: wanOutcome.consensus.consensusLetter,
          consensusCorrect: isConsensusCorrect,
          confidenceVariance: wanOutcome.consensus.confidenceVariance,
          andonTriggered: wanOutcome.consensus.andonTriggered,
        });
      }
    }
  }
  return { outcomes, consensusOutcomes };
}

function computePeerBreakdown(outcomes: OneClickQuestionOutcome[]): PeerAccuracyBreakdown[] {
  const byPeer = new Map<string, { machineLabel: string; total: number; scored: number; correct: number }>();
  for (const o of outcomes) {
    if (!o.peerId) continue;
    const entry = byPeer.get(o.peerId) ?? { machineLabel: o.machineLabel ?? o.peerId.slice(0, 8), total: 0, scored: 0, correct: 0 };
    entry.total += 1;
    if (o.parsedLetter !== null) entry.scored += 1;
    if (o.isCorrect) entry.correct += 1;
    byPeer.set(o.peerId, entry);
  }
  return Array.from(byPeer.entries()).map(([peerId, e]) => ({
    peerId,
    machineLabel: e.machineLabel,
    total: e.total,
    scored: e.scored,
    correct: e.correct,
    accuracy: e.scored > 0 ? e.correct / e.scored : null,
  }));
}

export async function runOneClickMmluProTest(config: {
  ollamaBaseUrl?: string;
  model?: string;
  questionsPerDomain?: number;
  /** 'auto' (default): use WAN mesh if live peers exist, else local. 'wan_mesh': require live
   * peers, honestly fail (wanError set, no silent fallback) if none are found. 'local_ollama':
   * always local, ignoring any live peers. */
  mode?: 'auto' | 'local_ollama' | 'wan_mesh';
  /** Caps total question count for wan_mesh mode (each question fans out to every live peer,
   * so wall-clock scales with questions x peers x per-question round-trip). Default 20. */
  wanMaxQuestions?: number;
  /** Per-question WAN round-trip timeout, ms. Default 90s -- real observed 2026-07-06 replies
   * took 7-20s for a single-shot bedrock question; 90s gives headroom for a slower/busier peer. */
  wanPerQuestionTimeoutMs?: number;
  /** BP133 Yoke #24 Task 4: caps the TOTAL question count for this run (after per-domain
   * sampling, before mode-specific dispatch), regardless of local_ollama or wan_mesh mode.
   * This is what makes "run a 3-question smoke test" a single explicit number instead of
   * requiring a DevTools console workaround (F12 dev-tools is unavailable in this build).
   * When unset, existing behavior is unchanged: local_ollama runs the full sampled set,
   * wan_mesh downsamples to wanMaxQuestions (default 20). */
  maxTotalQuestions?: number;
  /** BP133 Yoke #24 Task 1: single authoritative substrate/context-injection switch for this
   * run, honored on BOTH local_ollama dispatch (this machine) and wan_mesh dispatch (each
   * responding peer, via payload_json.substrate_enabled -- see wan_dispatch.ts and
   * startRelayRoutePoll in index.ts). Defaults to false -- existing behavior (no injection)
   * is unchanged unless a caller explicitly opts in. See substrate_toggle.ts for the full
   * correctness-gate rationale (cache-trap analysis, single-injection-site guarantee). */
  substrateEnabled?: boolean;
  /** BP133 Yoke #24 Task 2: explicit opt-in to answer wan_mesh questions via the 12-Blade
   * Column Plow instead of single-shot. Ignored (has no effect) in local_ollama mode -- the
   * plow answerer runs on the RESPONDING peer's machine, so a local-only run has no responder
   * to invoke it on. Defaults to false; the existing single-shot default is unchanged unless a
   * caller explicitly opts in. See plow_mc_answerer.ts and index.ts's startRelayRoutePoll. */
  plowEnabled?: boolean;
  /** BP133 Yoke #24 Task 2: Condition C (Andon retry) vs Condition B (single pass) when
   * plowEnabled is true. Ignored when plowEnabled is false. Defaults to false. */
  plowAndonEnabled?: boolean;
  /** BP137 Yoke v2b (Research Arm): explicit opt-in, ignored unless plowEnabled is also true.
   * Threads researchArmMode:true into the plow's config on the RESPONDING peer (see
   * wan_dispatch.ts's payload_json.research_arm_mode and index.ts's startRelayRoutePoll),
   * enabling BOTH Stage A.0 (relevance gate moved upstream of the MC voters, fixes the
   * Bush/Biden off-topic-citation failure mode) and Stage A (answer-type classifier + real
   * compute sidecar for computable questions) together. Defaults to false -- the pre-Stage-A/A.0
   * plow behavior is byte-for-byte unchanged unless a caller explicitly opts in. */
  researchArmMode?: boolean;
  /** BP135 Phase 3 (Layer B: federated substrate). Ignored (has no effect, no extra
   * round-trips) unless substrateEnabled is also true AND dispatchMode resolves to wan_mesh --
   * local_ollama mode has no other peers to pool from. When true, pools topical eblets from
   * ALL live peers (queryTopicalEbletsFromPeers()) before each question's answer round, so
   * every peer's answer prompt carries the pooled cross-peer index instead of just its own
   * local substrate. Defaults to false -- existing per-peer-local-only substrate behavior is
   * unchanged unless a caller explicitly opts in. See wan_dispatch.ts and substrate_toggle.ts. */
  federatedSubstrateEnabled?: boolean;
  /** BP134 Yoke #32 Phase F item 2: the "Full 14x5 MMLU-Pro" preset. When set (e.g. 5),
   * OVERRIDES maxTotalQuestions/questionsPerDomain sampling with an exact per-category
   * sample of this many questions from EACH of the 14 canonical categories, sourced from
   * the guaranteed-complete bundled corpus (never the dev-machine-only full live corpus,
   * which still has the law gap) so the preset behaves identically on every machine. */
  exactPerCategory?: number;
}, opts?: {
  /** BP138 Yoke HOT/COLD Lift: overrides the broadcast channel used for this run's
   *  'mesh-test:progress'-shaped events. Defaults to 'mesh-test:progress' (unchanged
   *  behavior for every existing caller). runHotColdLiftTest() below passes
   *  'mesh-test:hotcold-progress' for BOTH its inner arms so the standalone single-run
   *  panel's own progress listener (bound only to 'mesh-test:progress') is never disturbed
   *  by a lift run's two nested runs -- Truth-Always: a lift run must not silently mutate
   *  the single-run UI's last-result state mid-flight. */
  progressChannel?: string;
}): Promise<OneClickRunResult> {
  if (running) {
    throw new Error('A one-click test run is already in progress');
  }
  running = true;
  cancelRequested = false;
  const progressChannel = opts?.progressChannel ?? 'mesh-test:progress';
  const startedAt = new Date().toISOString();
  const ollamaBaseUrl = config.ollamaBaseUrl ?? 'http://127.0.0.1:11434';
  // BP133 Yoke #24 Task 1 fix: the fleet (and every other model reference in this codebase,
  // including the WAN responder's own baseline/Minor Council calls) runs gemma4:12b. This
  // default previously read 'gemma3:12b' -- a model string that is not what is installed on
  // the peer fleet (verified: `ollama list` shows gemma4:12b only, matching startRelayRoutePoll's
  // own hardcoded 'gemma4:12b' baseline model and AUTO_PREPARE_MODEL in index.ts). Any
  // local_ollama run that relied on this default silently exercised a fallback/mismatch it
  // never surfaced as an error, since Ollama returns 404 for an absent model and that HTTP
  // status was reported as a bare "error" string, not a legible "wrong model" message.
  const model = config.model ?? 'gemma4:12b';
  const requestedMode = config.mode ?? 'auto';
  const substrateEnabled = config.substrateEnabled ?? false;
  const plowEnabled = config.plowEnabled ?? false;
  const plowAndonEnabled = config.plowAndonEnabled ?? false;
  const researchArmMode = config.researchArmMode ?? false;
  const federatedSubstrateEnabled = config.federatedSubstrateEnabled ?? false;
  const exactPerCategory = config.exactPerCategory && config.exactPerCategory > 0 ? config.exactPerCategory : undefined;

  // BP134 Yoke #32 Phase F item 2: the exact-per-category preset always sources from the
  // bundled corpus specifically (never full_corpus_live), because that is the ONLY corpus
  // guaranteed complete across all 14 categories (including the law fix) on every machine --
  // full_corpus_live still has the upstream law gap on this dev machine (see loadFromFullCorpus).
  const { questions: allQuestionsUncapped, source } = exactPerCategory
    ? { questions: loadBundledQuestions(), source: 'bundled_subset' as const }
    : loadQuestions(config.questionsPerDomain ?? PER_DOMAIN_DEFAULT);

  // BP133 Yoke #24 Task 4: total-question cap, applied uniformly before mode dispatch so a
  // "3-question smoke test" is one explicit number in both local_ollama and wan_mesh modes.
  // BP134 Phase F item 2: exactPerCategory takes priority over maxTotalQuestions when set.
  const allQuestions = exactPerCategory
    ? sampleExactPerCategory(allQuestionsUncapped, exactPerCategory)
    : config.maxTotalQuestions && config.maxTotalQuestions > 0
      ? downsampleQuestions(allQuestionsUncapped, config.maxTotalQuestions)
      : allQuestionsUncapped;

  const corpusManifest = source === 'bundled_subset' ? loadBundledCorpusManifest() : null;

  let dispatchMode: 'local_ollama' | 'wan_mesh' = 'local_ollama';
  let livePeers: WanPeerInfo[] = [];
  let wanError: string | undefined;

  if (requestedMode !== 'local_ollama') {
    livePeers = await discoverLiveWanPeers();
    broadcast(progressChannel, { type: 'peers-discovered', count: livePeers.length });
    if (livePeers.length > 0) {
      dispatchMode = 'wan_mesh';
    } else if (requestedMode === 'wan_mesh') {
      // Truth-Always: explicit WAN request with zero live peers is an honest failure,
      // not a silent fallback to local -- surface it and stop, per the Yoke #23 constraint.
      wanError = 'No live WAN peers found (peer_presence has no recently-seen status=active rows besides this machine). Cannot run a WAN-distributed test right now.';
      running = false;
      const emptyResult: OneClickRunResult = {
        startedAt,
        completedAt: new Date().toISOString(),
        total: 0,
        scored: 0,
        correct: 0,
        accuracy: null,
        outcomes: [],
        dispatchMode: 'wan_mesh',
        datasetLabel: 'No WAN dispatch attempted -- no live peers',
        questionSource: source,
        livePeersFound: 0,
        wanError,
        substrateEnabled,
        plowEnabled,
      };
      broadcast(progressChannel, { type: 'complete', result: emptyResult });
      return emptyResult;
    }
    // requestedMode === 'auto' and 0 peers found: fall through to local_ollama silently,
    // since 'auto' explicitly means "best available mode", not a hard WAN requirement.
  }

  let questions = allQuestions;
  let outcomes: OneClickQuestionOutcome[];
  let consensusOutcomes: ConsensusQuestionOutcome[] | undefined;
  let sessionId: string | undefined;

  if (dispatchMode === 'wan_mesh') {
    sessionId = generateSessionId();
    questions = downsampleQuestions(allQuestions, config.wanMaxQuestions ?? 20);
    broadcast(progressChannel, { type: 'start', total: questions.length * livePeers.length });
    // BP133 Yoke #24 Task 2 requirement 4: raise the per-question timeout for plow mode. The
    // pre-existing 90s default was tuned for single-shot; the plow's 9-specialist staggered
    // swarm alone takes >=8s (FireGuard stagger) before any external API latency, plus
    // Saladin's serial per-candidate Ollama calls and up to MAX_ANDON_RETRIES full retries in
    // Condition C. 300s is a defensible default headroom, not a measured ceiling -- still
    // explicitly overridable via wanPerQuestionTimeoutMs for a caller who has better data.
    const defaultTimeoutMs = plowEnabled ? 300_000 : 90_000;
    const wanResult = await runWanMode(
      questions, livePeers, sessionId, config.wanPerQuestionTimeoutMs ?? defaultTimeoutMs,
      substrateEnabled, plowEnabled, plowAndonEnabled, corpusManifest?.sha256, federatedSubstrateEnabled,
      progressChannel, researchArmMode,
    );
    outcomes = wanResult.outcomes;
    consensusOutcomes = wanResult.consensusOutcomes;
  } else {
    broadcast(progressChannel, { type: 'start', total: questions.length });
    outcomes = await runLocalMode(questions, ollamaBaseUrl, model, substrateEnabled, progressChannel);
  }

  const scored = outcomes.filter((o) => o.parsedLetter !== null).length;
  const correct = outcomes.filter((o) => o.isCorrect).length;
  const peerBreakdown = dispatchMode === 'wan_mesh' ? computePeerBreakdown(outcomes) : undefined;
  // BP135 Phase 2 (Layer A: consensus): aggregate accuracy of the mesh's single answer per
  // question, scored only over questions that actually reached a consensus letter.
  const consensusScored = consensusOutcomes?.filter((c) => c.consensusLetter !== null).length ?? 0;
  const consensusCorrect = consensusOutcomes?.filter((c) => c.isConsensusCorrect).length ?? 0;
  const consensusAccuracy = consensusOutcomes ? (consensusScored > 0 ? consensusCorrect / consensusScored : null) : undefined;

  const substrateSuffix = substrateEnabled ? ' [substrate ON]' : ' [substrate OFF]';
  // BP133 Yoke #24 Task 2: label which of A/B/C the run actually was -- Truth-Always, this
  // string ends up on the result the Founder/Bishop reads first.
  const conditionSuffix = dispatchMode !== 'wan_mesh'
    ? ''
    : !plowEnabled
      ? ' [single-shot]'
      : plowAndonEnabled ? ' [plow: Condition C, Andon loop]' : ' [plow: Condition B, single pass]';
  const datasetLabel = (dispatchMode === 'wan_mesh'
    ? `${questions.length} real curated TIGER-Lab/MMLU-Pro questions dispatched to ${livePeers.length} live WAN peer(s) via relay_routes/relay_route_replies (session ${sessionId}) -- ${outcomes.length} total question-peer answers`
    : source === 'full_corpus_live'
      ? `${questions.length} real curated TIGER-Lab/MMLU-Pro questions, evenly sampled live from the full ~11,000-question corpus (dev-machine-only path)`
      : `${questions.length} real curated TIGER-Lab/MMLU-Pro questions, bundled subset shipped with the app (resources/mmlu_pro_bundled/)`) + substrateSuffix + conditionSuffix;

  const result: OneClickRunResult = {
    startedAt,
    completedAt: new Date().toISOString(),
    total: outcomes.length,
    scored,
    correct,
    accuracy: scored > 0 ? correct / scored : null,
    outcomes,
    dispatchMode,
    datasetLabel,
    questionSource: source,
    peerBreakdown,
    livePeersFound: dispatchMode === 'wan_mesh' ? livePeers.length : undefined,
    substrateEnabled,
    plowEnabled: dispatchMode === 'wan_mesh' ? plowEnabled : undefined,
    researchArmMode: dispatchMode === 'wan_mesh' ? researchArmMode : undefined,
    cancelled: cancelRequested,
    exactPerCategory,
    corpusManifestSha256: corpusManifest?.sha256,
    consensusOutcomes,
    consensusAccuracy,
    federatedSubstrateEnabled: dispatchMode === 'wan_mesh' ? federatedSubstrateEnabled : undefined,
  };

  broadcast(progressChannel, { type: 'complete', result });
  running = false;
  return result;
}

// ─── BP138 Yoke: one-click HOT/COLD substrate lift ─────────────────────────────
//
// Today the panel reports ONE accuracy % per run -- to see substrate lift a human has to
// run twice (once with substrate/plow off, once on) and subtract by hand. This adds a
// single action that runs the SAME question set TWICE back to back, reusing this file's
// EXISTING honest, sealed-key scoring path (OneClickRunResult.scored/correct/accuracy,
// computed the identical way for every outcome regardless of mode -- see isCorrect
// computation in runLocalMode above and dispatchQuestionToWanPeers/wan_dispatch.ts for the
// WAN equivalent) rather than inventing a second scorer.
//
// Honesty design (R-MECHANISM-VERIFY): the ONLY thing that differs between the two calls
// to runOneClickMmluProTest below is substrateEnabled/plowEnabled/plowAndonEnabled/
// federatedSubstrateEnabled. dispatchMode (mode), maxTotalQuestions, exactPerCategory,
// questionsPerDomain, and wanMaxQuestions are held IDENTICAL across both arms, which
// (given loadQuestions/sampleExactPerCategory/downsampleQuestions above are all pure/
// deterministic -- evenlySpacedIndices has no randomness, confirmed by reading it) means
// both arms see EXACTLY the same question set. Varying dispatch mode between arms as well
// (e.g. forcing COLD to local_ollama while HOT runs wan_mesh) was considered and rejected:
// it would let a peer-fleet/model difference between arms masquerade as a substrate/plow
// effect, and it would violate the panel's own pre-existing Condition A/B/C convention
// (see the plowEnabled checkbox comment above: "plow OFF + substrate OFF = single-shot
// cold" -- Condition A is already defined codebase-wide as same-mode, substrate+plow off).

/** Judgment call (no pre-existing minimum-n-for-significance convention found anywhere in
 *  this codebase -- searched mesh_test/, plow/, wrasse_quartermaster.ts, etc.; the closest
 *  precedent, wrasse_quartermaster.ts's `min_sample_count` default of 3, gates a routing
 *  trust decision, not a reported accuracy delta, so it isn't reused here). This app's own
 *  UI already treats its smallest question-count preset (3) as an explicit "one-click smoke
 *  test" (see MAX_TOTAL_QUESTIONS comment / QUESTION_COUNT_PRESETS in the panel) -- i.e. not
 *  meant to produce a trustworthy percentage -- and treats 10 as the next real tier. 10 is
 *  used here as the floor below which a HOT/COLD delta is flagged as noisy rather than
 *  hidden or silently trusted (Truth-Always: still shown, just labeled). */
export const HOT_COLD_MIN_MEANINGFUL_N = 10;

export interface HotColdLiftResult {
  startedAt: string;
  completedAt: string;
  /** Full result of the COLD (baseline) arm -- substrate/plow forced off, same dispatch
   *  mode/question sampling as the HOT arm. */
  cold: OneClickRunResult;
  /** Full result of the HOT arm -- exactly the config the caller (the Founder's current
   *  UI toggle state) requested, unmodified. */
  hot: OneClickRunResult;
  /** Human-readable exact config label for each arm, built from the ACTUAL resolved
   *  dispatchMode/substrate/plow/federated fields on that arm's own result -- never
   *  invented/generic strings. */
  coldLabel: string;
  hotLabel: string;
  coldAccuracy: number | null;
  hotAccuracy: number | null;
  coldScored: number;
  hotScored: number;
  coldCorrect: number;
  hotCorrect: number;
  /** min(coldScored, hotScored) -- the shared, fair sample size the LIFT headline is
   *  computed over (comparing two accuracies computed over different denominators would
   *  itself be a subtle dishonesty; using the smaller of the two avoids that). */
  n: number;
  /** (hotAccuracy - coldAccuracy) * 100, in percentage points. Null only when either arm
   *  scored zero questions (accuracy itself is null). */
  liftPp: number | null;
  /** True when n < HOT_COLD_MIN_MEANINGFUL_N -- the UI must say so rather than silently
   *  showing a noisy delta as if it were conclusive. */
  belowMinN: boolean;
  minMeaningfulN: number;
  /** True when the run was stopped early via requestOneClickCancel() during either arm. */
  cancelled: boolean;
}

export type HotColdLiftProgressEvent =
  | { type: 'arm-start'; arm: 'cold' | 'hot'; label: string }
  | { type: 'arm-complete'; arm: 'cold' | 'hot'; result: OneClickRunResult }
  | { type: 'complete'; result: HotColdLiftResult }
  | { type: 'cancelled'; result: HotColdLiftResult };

/** Builds the same style of human-readable config label the rest of this file already uses
 *  for datasetLabel's substrateSuffix/conditionSuffix (see runOneClickMmluProTest above) --
 *  a small formatting helper, not a second copy of any scoring/correctness logic. */
function describeRunArmConfig(r: {
  dispatchMode: 'local_ollama' | 'wan_mesh' | 'auto';
  substrateEnabled: boolean;
  plowEnabled?: boolean;
  plowAndonEnabled?: boolean;
  federatedSubstrateEnabled?: boolean;
  livePeersFound?: number;
}): string {
  const dispatchPart = r.dispatchMode === 'wan_mesh'
    ? `WAN mesh (${r.livePeersFound ?? '?'} live peer${r.livePeersFound === 1 ? '' : 's'})`
    : r.dispatchMode === 'auto'
      ? 'auto (WAN if live, else local-Ollama)'
      : 'local-Ollama';
  const substratePart = r.substrateEnabled ? 'substrate ON' : 'no substrate';
  const plowPart = r.dispatchMode === 'local_ollama'
    ? 'no plow'
    : !r.plowEnabled
      ? 'no plow (single-shot)'
      : r.plowAndonEnabled ? '12-blade plow + Andon loop' : '12-blade plow, single pass';
  const federatedPart = r.dispatchMode !== 'local_ollama' && r.federatedSubstrateEnabled ? ', federated substrate ON' : '';
  return `${dispatchPart}, ${substratePart}, ${plowPart}${federatedPart}`;
}

let hotColdLiftRunning = false;

export function isHotColdLiftActive(): boolean {
  return hotColdLiftRunning;
}

/** BP138 Yoke: runs the exact same question set through runOneClickMmluProTest TWICE --
 *  once with substrate/plow forced off (COLD baseline), once with the caller's requested
 *  config unchanged (HOT, "the exact config being proven") -- and reports both accuracies
 *  plus the delta. `config` here is exactly what a single `runOneClickMmluProTest` call
 *  would receive; it is treated as the HOT arm's config verbatim. */
export async function runHotColdLiftTest(
  config: Parameters<typeof runOneClickMmluProTest>[0],
): Promise<HotColdLiftResult> {
  if (running || hotColdLiftRunning) {
    throw new Error('A one-click test run is already in progress');
  }
  hotColdLiftRunning = true;
  const startedAt = new Date().toISOString();
  const requestedMode = config.mode ?? 'auto';
  try {
    // COLD arm -- Condition A per this panel's own pre-existing convention (see
    // plowEnabled checkbox comment in OneClickMeshTestPanel.tsx: "plow OFF + substrate
    // OFF = single-shot cold"). Same mode/question-count/corpus config as HOT below.
    const coldConfig: typeof config = {
      ...config,
      substrateEnabled: false,
      plowEnabled: false,
      plowAndonEnabled: false,
      researchArmMode: false,
      federatedSubstrateEnabled: false,
    };
    broadcast('mesh-test:hotcold-progress', {
      type: 'arm-start', arm: 'cold',
      label: describeRunArmConfig({ dispatchMode: requestedMode, substrateEnabled: false }),
    } satisfies HotColdLiftProgressEvent);
    const cold = await runOneClickMmluProTest(coldConfig, { progressChannel: 'mesh-test:hotcold-progress' });
    const coldLabel = describeRunArmConfig(cold);
    broadcast('mesh-test:hotcold-progress', { type: 'arm-complete', arm: 'cold', result: cold } satisfies HotColdLiftProgressEvent);

    if (cold.cancelled) {
      // Truth-Always: a stop mid-COLD must not silently continue into a HOT arm the
      // Founder never asked to run after hitting stop.
      const partial: HotColdLiftResult = {
        startedAt,
        completedAt: new Date().toISOString(),
        cold,
        hot: cold,
        coldLabel,
        hotLabel: 'not run (cancelled during COLD arm)',
        coldAccuracy: cold.accuracy,
        hotAccuracy: null,
        coldScored: cold.scored,
        hotScored: 0,
        coldCorrect: cold.correct,
        hotCorrect: 0,
        n: 0,
        liftPp: null,
        belowMinN: true,
        minMeaningfulN: HOT_COLD_MIN_MEANINGFUL_N,
        cancelled: true,
      };
      broadcast('mesh-test:hotcold-progress', { type: 'cancelled', result: partial } satisfies HotColdLiftProgressEvent);
      return partial;
    }

    // HOT arm -- the exact config the caller (the Founder's current UI toggle state)
    // requested, passed through completely unmodified.
    broadcast('mesh-test:hotcold-progress', {
      type: 'arm-start', arm: 'hot',
      label: describeRunArmConfig({
        dispatchMode: requestedMode,
        substrateEnabled: config.substrateEnabled ?? false,
        plowEnabled: config.plowEnabled,
        plowAndonEnabled: config.plowAndonEnabled,
        federatedSubstrateEnabled: config.federatedSubstrateEnabled,
      }),
    } satisfies HotColdLiftProgressEvent);
    const hot = await runOneClickMmluProTest(config, { progressChannel: 'mesh-test:hotcold-progress' });
    const hotLabel = describeRunArmConfig(hot);
    broadcast('mesh-test:hotcold-progress', { type: 'arm-complete', arm: 'hot', result: hot } satisfies HotColdLiftProgressEvent);

    const n = Math.min(cold.scored, hot.scored);
    const liftPp = cold.accuracy !== null && hot.accuracy !== null
      ? (hot.accuracy - cold.accuracy) * 100
      : null;

    const result: HotColdLiftResult = {
      startedAt,
      completedAt: new Date().toISOString(),
      cold,
      hot,
      coldLabel,
      hotLabel,
      coldAccuracy: cold.accuracy,
      hotAccuracy: hot.accuracy,
      coldScored: cold.scored,
      hotScored: hot.scored,
      coldCorrect: cold.correct,
      hotCorrect: hot.correct,
      n,
      liftPp,
      belowMinN: n < HOT_COLD_MIN_MEANINGFUL_N,
      minMeaningfulN: HOT_COLD_MIN_MEANINGFUL_N,
      cancelled: hot.cancelled === true,
    };
    broadcast('mesh-test:hotcold-progress', { type: 'complete', result } satisfies HotColdLiftProgressEvent);
    return result;
  } finally {
    hotColdLiftRunning = false;
  }
}
