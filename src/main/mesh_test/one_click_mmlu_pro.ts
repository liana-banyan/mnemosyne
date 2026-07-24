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
import { discoverLiveWanPeers, dispatchQuestionToWanPeers, type WanPeerInfo } from './wan_dispatch';
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
  /** BP133 Yoke #24 Task 3: true when the run was stopped early via requestCancel() rather
   *  than completing all questions -- Truth-Always: a partial run must say so, never be
   *  presented as if it ran to completion. */
  cancelled?: boolean;
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
): Promise<OneClickQuestionOutcome[]> {
  const outcomes: OneClickQuestionOutcome[] = [];
  for (let i = 0; i < questions.length; i++) {
    if (cancelRequested) break;
    const q = questions[i];
    broadcast('mesh-test:progress', { type: 'question-start', index: i, total: questions.length, question: q.question, category: q.category });
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
    broadcast('mesh-test:progress', { type: 'question-complete', index: i, total: questions.length, outcome });
  }
  return outcomes;
}

/** Dispatches each question to every live peer in parallel; one outcome per (question, peer). */
async function runWanMode(
  questions: MmluProQuestion[],
  peers: WanPeerInfo[],
  sessionId: string,
  perQuestionTimeoutMs: number,
  substrateEnabled: boolean,
): Promise<OneClickQuestionOutcome[]> {
  const outcomes: OneClickQuestionOutcome[] = [];
  const totalUnits = questions.length * peers.length;
  let unitIndex = 0;

  for (let i = 0; i < questions.length; i++) {
    if (cancelRequested) break;
    const q = questions[i];
    broadcast('mesh-test:progress', {
      type: 'question-start', index: unitIndex, total: totalUnits, question: q.question, category: q.category,
    });

    const wanOutcome = await dispatchQuestionToWanPeers(q, peers, sessionId, perQuestionTimeoutMs, substrateEnabled);

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
      };
      outcomes.push(outcome);
      unitIndex++;
      broadcast('mesh-test:progress', { type: 'question-complete', index: unitIndex - 1, total: totalUnits, outcome });
    }
  }
  return outcomes;
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
}): Promise<OneClickRunResult> {
  if (running) {
    throw new Error('A one-click test run is already in progress');
  }
  running = true;
  cancelRequested = false;
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
  const { questions: allQuestionsUncapped, source } = loadQuestions(config.questionsPerDomain ?? PER_DOMAIN_DEFAULT);
  // BP133 Yoke #24 Task 4: total-question cap, applied uniformly before mode dispatch so a
  // "3-question smoke test" is one explicit number in both local_ollama and wan_mesh modes.
  const allQuestions = config.maxTotalQuestions && config.maxTotalQuestions > 0
    ? downsampleQuestions(allQuestionsUncapped, config.maxTotalQuestions)
    : allQuestionsUncapped;

  let dispatchMode: 'local_ollama' | 'wan_mesh' = 'local_ollama';
  let livePeers: WanPeerInfo[] = [];
  let wanError: string | undefined;

  if (requestedMode !== 'local_ollama') {
    livePeers = await discoverLiveWanPeers();
    broadcast('mesh-test:progress', { type: 'peers-discovered', count: livePeers.length });
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
      };
      broadcast('mesh-test:progress', { type: 'complete', result: emptyResult });
      return emptyResult;
    }
    // requestedMode === 'auto' and 0 peers found: fall through to local_ollama silently,
    // since 'auto' explicitly means "best available mode", not a hard WAN requirement.
  }

  let questions = allQuestions;
  let outcomes: OneClickQuestionOutcome[];
  let sessionId: string | undefined;

  if (dispatchMode === 'wan_mesh') {
    sessionId = generateSessionId();
    questions = downsampleQuestions(allQuestions, config.wanMaxQuestions ?? 20);
    broadcast('mesh-test:progress', { type: 'start', total: questions.length * livePeers.length });
    outcomes = await runWanMode(questions, livePeers, sessionId, config.wanPerQuestionTimeoutMs ?? 90_000, substrateEnabled);
  } else {
    broadcast('mesh-test:progress', { type: 'start', total: questions.length });
    outcomes = await runLocalMode(questions, ollamaBaseUrl, model, substrateEnabled);
  }

  const scored = outcomes.filter((o) => o.parsedLetter !== null).length;
  const correct = outcomes.filter((o) => o.isCorrect).length;
  const peerBreakdown = dispatchMode === 'wan_mesh' ? computePeerBreakdown(outcomes) : undefined;

  const substrateSuffix = substrateEnabled ? ' [substrate ON]' : ' [substrate OFF]';
  const datasetLabel = (dispatchMode === 'wan_mesh'
    ? `${questions.length} real curated TIGER-Lab/MMLU-Pro questions dispatched to ${livePeers.length} live WAN peer(s) via relay_routes/relay_route_replies (session ${sessionId}) -- ${outcomes.length} total question-peer answers`
    : source === 'full_corpus_live'
      ? `${questions.length} real curated TIGER-Lab/MMLU-Pro questions, evenly sampled live from the full ~11,000-question corpus (dev-machine-only path)`
      : `${questions.length} real curated TIGER-Lab/MMLU-Pro questions, bundled subset shipped with the app (resources/mmlu_pro_bundled/)`) + substrateSuffix;

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
    cancelled: cancelRequested,
  };

  broadcast('mesh-test:progress', { type: 'complete', result });
  running = false;
  return result;
}
