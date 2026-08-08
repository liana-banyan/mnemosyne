// liana_terminal_engine.ts -- D-BP149-034/BISHOP/S34/seg-lianaterminal
//
// PORTS scripts/founder_cascade_v2.mjs into a main-process module the renderer can drive over
// IPC. This is a PORT, not a rewrite: the stage sequence (0 vet -> 1 inverse -> 2 Jar Method ->
// 5 terminate-on-hard-number), the division of labor (Google is the only source, Gemma extracts
// mechanically and never judges, the code decides by arithmetic), and the exact prompt shapes
// are copied from that script. Two things change, both purely I/O:
//   1. console.log(...) becomes emit(event) -- an LianaTerminalEvent pushed to the renderer's
//      live transcript pane instead of printed to a terminal the Founder has to paste back.
//   2. Google is reached via `askGoogle` (injected by index.ts, backed by the SAME
//      runBrowserAuthorityQueryFromMain() plow_mc_answerer.ts's Stage F2/F3 already use) instead
//      of a CDP WebSocket eval into the renderer -- both ultimately drive
//      window.amplify.runBrowserAuthorityQuery({authority:'user_google', question}), so this is
//      the in-process equivalent of the same call, not a different code path.
//
// See scripts/founder_cascade_v2.mjs's own header for the fuller design writeup (why Gemma
// never picks, why the 1.5x separation bar, what v1 got wrong). Not duplicated here to avoid
// the two files drifting apart in prose while the logic itself stays identical.
//
// DOES NOT TOUCH src/main/plow/plow_mc_answerer.ts. Fully separate module, separate engine.

import fs from 'node:fs';
import { join, resolve } from 'node:path';
import { app } from 'electron';
import type {
  LianaTerminalEvent,
  LianaTerminalOutcome,
} from '../../shared/liana_cycle/liana_terminal_types';
import type { BrowserAuthorityRawExtraction } from '../../shared/plow/browser_authority_types';

// HARD BINDING, canon 2026-06-15 (feedback_gemma4_thinking_model_num_predict_256_think_false_fix_bp083):
// think:false and num_predict >= 256 on any parseable Gemma call. Mirrors founder_cascade_v2.mjs
// byte-for-byte on this point.
const OLLAMA_API_BASE = process.env.OLLAMA_API_BASE ?? 'http://127.0.0.1:11434';
const MODEL = process.env.CASCADE_MODEL ?? 'gemma4:12b';

/** What this engine needs from the caller to reach the user's own logged-in Google session --
 *  same dependency-injection shape browser_authority_adapter.ts's BrowserAuthorityBridge uses,
 *  so index.ts supplies a one-line closure around its own runBrowserAuthorityQueryFromMain()
 *  rather than this module importing that giant entry file directly. */
export type AskGoogleFn = (question: string) => Promise<BrowserAuthorityRawExtraction | null>;

export type EmitFn = (event: LianaTerminalEvent) => void;

function nowIso(): string {
  return new Date().toISOString();
}

function say(emit: EmitFn, text: string): void {
  emit({ kind: 'header', text, ts: nowIso() });
}
function step(emit: EmitFn, text: string): void {
  emit({ kind: 'stage', text: `-> ${text}`, ts: nowIso() });
}
function fact(emit: EmitFn, text: string): void {
  emit({ kind: 'fact', text: `+ ${text}`, ts: nowIso() });
}
function note(emit: EmitFn, text: string): void {
  emit({ kind: 'note', text, ts: nowIso() });
}

// ─────────────────────────── GOOGLE, THE ONLY SOURCE ───────────────────────────

interface GoogleAnswer {
  ok: boolean;
  text: string;
  sources: unknown[];
  error?: string;
}

async function askGoogleFact(askGoogle: AskGoogleFn, query: string): Promise<GoogleAnswer> {
  try {
    const raw = await askGoogle(query);
    if (!raw) return { ok: false, text: '', sources: [], error: 'no extraction (authority call returned null)' };
    const text = (raw.snippet || '').trim();
    const sources = raw.citations || raw.results || [];
    return { ok: Boolean(text), text, sources };
  } catch (e) {
    return { ok: false, text: '', sources: [], error: e instanceof Error ? e.message : String(e) };
  }
}

// ─────────────────────────── GEMMA, MECHANICAL ONLY ───────────────────────────
// Same contract as founder_cascade_v2.mjs's gemmaExtract(): never shown the options, never
// asked to choose -- only asked for a NAMED EXTRACTION checkable against the passage it came
// from.
async function gemmaExtract(
  instruction: string,
  passage: string,
  shape: string,
): Promise<Record<string, unknown> | null> {
  const prompt = `Extract information from the passage. Do not reason about which answer is correct. Do not choose between options. Only report what the passage states.

PASSAGE:
${passage}

TASK: ${instruction}

Return ONLY JSON in exactly this shape, no prose, no markdown fence:
${shape}
If the passage does not state it, use null. Never guess.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    const res = await fetch(`${OLLAMA_API_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: false,
        think: false,
        options: { temperature: 0, num_predict: 512 },
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
    const j = (await res.json()) as { response?: string };
    const t = (j.response || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    try {
      return JSON.parse(t) as Record<string, unknown>;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

// ─────────────────────────── BUNDLE LOOKUP ───────────────────────────
// Same resolveBundledDatasetPath() convention as one_click_mmlu_pro.ts (dev vs packaged path).

interface BundledQuestion {
  question_id: number;
  question: string;
  options: string[];
  answer: string;
  category?: string;
}

function resolveBundledDatasetPath(): string {
  const packaged = typeof process !== 'undefined' && (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
    ? join((process as NodeJS.Process & { resourcesPath?: string }).resourcesPath!, 'mmlu_pro_bundled', 'questions.jsonl')
    : null;
  if (app.isPackaged && packaged) return packaged;
  return resolve(app.getAppPath(), 'resources', 'mmlu_pro_bundled', 'questions.jsonl');
}

function loadQuestion(qid: number): BundledQuestion | null {
  const bundlePath = resolveBundledDatasetPath();
  if (!fs.existsSync(bundlePath)) return null;
  const rows = fs
    .readFileSync(bundlePath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l) as BundledQuestion);
  return rows.find((r) => r.question_id === qid) ?? null;
}

const letter = (i: number) => String.fromCharCode(65 + i);

// ─────────────────────────── THE CASCADE (ported, stages 0/1/2/5) ───────────────────────────

async function runMcQuestion(q: BundledQuestion, askGoogle: AskGoogleFn, emit: EmitFn): Promise<LianaTerminalOutcome> {
  const opts: Record<string, string> = {};
  q.options.forEach((o, i) => (opts[letter(i)] = o));
  const optList = Object.entries(opts).map(([k, v]) => `${k}) ${v}`).join('  ');

  say(emit, `qid ${q.question_id} [${q.category ?? ''}]`);
  emit({ kind: 'note', text: `   ${q.question}`, ts: nowIso() });
  emit({ kind: 'note', text: `   ${optList}`, ts: nowIso() });

  let pool = Object.keys(opts);

  // STAGE 0: vet the question, determine the register.
  step(emit, 'STAGE 0  vet the question, determine the register');
  const g0 = await askGoogleFact(
    askGoogle,
    `${q.question} Of these specific choices, which are NOT normally taught as members of the category this question is asking about, and why? ${optList}`,
  );
  if (g0.ok) {
    fact(emit, `Google: ${g0.text.slice(0, 180)}`);
    const reg = await gemmaExtract(
      'List the technical terms this passage defines, and for each, the field or register it belongs to.',
      g0.text,
      `{"terms":[{"term":"...","register":"..."}]}`,
    );
    const terms = (reg?.terms as Array<{ term: string; register: string }> | undefined) ?? [];
    for (const t of terms.slice(0, 4)) note(emit, `       term: ${t.term} -- register: ${t.register}`);
  } else {
    note(emit, `       no Google answer (${g0.error || 'empty'})`);
  }

  // STAGE 1: ask the inverse -- lettered options INSIDE the query (his hand-worked shape).
  step(emit, 'STAGE 1  ask the inverse');
  const inverseQ = `${q.question.replace(/\bNOT\b/, '').replace(/\s+/g, ' ').trim()} ${optList}`;
  const g1 = await askGoogleFact(askGoogle, inverseQ);
  let asserted: string[] = [];
  if (g1.ok) {
    fact(emit, `Google: ${g1.text.slice(0, 180)}`);
    const ex = await gemmaExtract(
      `The passage discusses some of these items: ${Object.values(opts).join('; ')}. List ONLY the items the passage explicitly says HAVE the property being discussed. Copy each item's wording exactly from the list above.`,
      g1.text,
      `{"asserted":["exact item text"]}`,
    );
    const rawAsserted = (ex?.asserted as string[] | undefined) ?? [];
    for (const a of rawAsserted) {
      for (const [L, txt] of Object.entries(opts)) {
        if (txt.toLowerCase().trim() === String(a).toLowerCase().trim()) asserted.push(L);
      }
    }
    asserted = [...new Set(asserted)];
    if (asserted.length) fact(emit, `asserted-to-have-the-property: ${asserted.join(', ')}`);
    else note(emit, '       Gemma named nothing that maps EXACTLY to an option (no similarity fallback, by design)');
  } else {
    note(emit, `       no Google answer (${g1.error || 'empty'})`);
  }

  // STAGE 2: Jar Method -- remove what we now KNOW is not the answer.
  step(emit, 'STAGE 2  Jar Method');
  const isNegated = /\bNOT\b/.test(q.question);
  if (asserted.length && isNegated) {
    const before = pool.length;
    pool = pool.filter((L) => !asserted.includes(L));
    fact(emit, `removed ${before - pool.length} option(s) asserted to HAVE the property (question asks which does NOT): ${asserted.join(', ')}`);
    note(emit, `       pool: ${pool.join(', ')}`);
  } else if (asserted.length) {
    pool = asserted.length ? asserted : pool;
    fact(emit, `kept only asserted options: ${pool.join(', ')}`);
  } else {
    note(emit, '       nothing eliminable from stage 1');
  }

  // STAGE 5: terminate on the hard number.
  step(emit, 'STAGE 5  terminate on the hard number');
  let verdict: string | null = null;
  let basis = '';
  const g5 = await askGoogleFact(
    askGoogle,
    `What are the relevant numeric values for each of the following, with units? ${pool.map((L) => `${L}) ${opts[L]}`).join(' ')}`,
  );
  if (g5.ok) {
    fact(emit, `Google: ${g5.text.slice(0, 180)}`);
    const nums = await gemmaExtract(
      `For each of these items, report the single numeric value the passage gives, and the unit. Items: ${pool.map((L) => opts[L]).join('; ')}. Copy item wording exactly.`,
      g5.text,
      `{"values":[{"item":"exact item text","value":number,"unit":"..."}]}`,
    );
    const byLetter: Record<string, { value: number; unit?: string }> = {};
    const values = (nums?.values as Array<{ item: string; value: number; unit?: string }> | undefined) ?? [];
    for (const v of values) {
      for (const L of pool) {
        if (opts[L].toLowerCase().trim() === String(v.item).toLowerCase().trim() && typeof v.value === 'number') byLetter[L] = v;
      }
    }
    const have = Object.keys(byLetter);
    if (have.length >= 2) {
      const sorted = have.sort((a, b) => byLetter[a].value - byLetter[b].value);
      note(emit, `       ranked: ${sorted.map((L) => `${L}=${byLetter[L].value}${byLetter[L].unit || ''}`).join('  ')}`);
      const lo = byLetter[sorted[0]].value;
      const next = byLetter[sorted[1]].value;
      const sep = next === 0 ? Infinity : next / (lo || 1e-9);
      if (sep >= 1.5) {
        verdict = sorted[0];
        basis = `lowest value with ${sep.toFixed(1)}x separation from the runner-up`;
      } else {
        note(emit, `       separation only ${sep.toFixed(2)}x -- below the 1.5x bar, will not terminate on it`);
      }
    } else {
      note(emit, `       only ${have.length} option(s) got an exact-matched number -- cannot rank`);
    }
  } else {
    note(emit, `       no Google answer (${g5.error || 'empty'})`);
  }

  if (!verdict && pool.length === 1) {
    verdict = pool[0];
    basis = 'sole survivor after elimination';
  }

  const correct = q.answer;
  const ok = verdict === correct;
  if (verdict) {
    emit({ kind: 'result', text: `${ok ? 'CORRECT' : 'WRONG'}  chose ${verdict} (${opts[verdict]})  key=${correct}`, ts: nowIso() });
  } else {
    emit({ kind: 'result', text: `ABSTAIN  pool=${pool.join(',')}  key=${correct}`, ts: nowIso() });
  }
  if (basis) note(emit, `       basis: ${basis}`);

  return {
    qid: q.question_id,
    question: q.question,
    verdict,
    correct,
    ok,
    basis,
    abstain: !verdict,
    freeText: false,
  };
}

// ─────────────────────────── FREE-TEXT MODE ───────────────────────────
// A typed question with no MC option pool has nothing to eliminate against -- this runs a single
// honest Google+Gemma fact lookup instead of forcing the elimination machinery onto it.

async function runFreeTextQuestion(question: string, askGoogle: AskGoogleFn, emit: EmitFn): Promise<LianaTerminalOutcome> {
  say(emit, `free-text question (no bundled qid match -- running single fact lookup, not the MC cascade)`);
  emit({ kind: 'note', text: `   ${question}`, ts: nowIso() });

  step(emit, 'STAGE G  ask Google');
  const g = await askGoogleFact(askGoogle, question);
  if (!g.ok) {
    emit({ kind: 'result', text: `ABSTAIN  no usable Google answer (${g.error || 'empty'})`, ts: nowIso() });
    return { question, verdict: null, abstain: true, freeText: true, error: g.error };
  }
  fact(emit, `Google: ${g.text.slice(0, 300)}`);

  step(emit, 'STAGE E  Gemma extracts the stated answer (mechanical only)');
  const ex = await gemmaExtract(
    'State the single direct answer this passage gives to the question, verbatim from the passage where possible.',
    g.text,
    `{"answer":"..."}`,
  );
  const answer = (ex?.answer as string | undefined) ?? null;
  if (answer) fact(emit, `extracted: ${answer}`);
  else note(emit, '       Gemma extracted nothing parseable from this passage');

  emit({ kind: 'result', text: answer ? `ANSWER  ${answer}` : 'ABSTAIN  no extractable answer', ts: nowIso() });
  return { question, verdict: answer, abstain: !answer, freeText: true };
}

// ─────────────────────────── ENTRY POINT ───────────────────────────

/** Runs one question through the terminal: numeric input -> bundled-qid MC cascade (stages
 *  0/1/2/5, ported from founder_cascade_v2.mjs); anything else -> a single free-text fact
 *  lookup. Never throws -- an internal failure is reported as an 'error' event plus an
 *  abstained outcome, matching this estate's honest-abstain-over-fabrication rule. */
export async function runLianaCycleQuestion(input: string, askGoogle: AskGoogleFn, emit: EmitFn): Promise<LianaTerminalOutcome> {
  const trimmed = input.trim();
  try {
    if (/^\d+$/.test(trimmed)) {
      const qid = Number(trimmed);
      const q = loadQuestion(qid);
      if (!q) {
        emit({ kind: 'error', text: `qid ${qid} not found in the bundled corpus (resources/mmlu_pro_bundled/questions.jsonl)`, ts: nowIso() });
        return { qid, question: '', verdict: null, abstain: true, freeText: false, error: 'qid not in bundle' };
      }
      return await runMcQuestion(q, askGoogle, emit);
    }
    return await runFreeTextQuestion(trimmed, askGoogle, emit);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    emit({ kind: 'error', text: `cascade threw: ${msg}`, ts: nowIso() });
    return { question: trimmed, verdict: null, abstain: true, freeText: !/^\d+$/.test(trimmed), error: msg };
  }
}
