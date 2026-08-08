// comparative_cascade.ts -- D-BP149-041/BISHOP/S41/seg-methodregistry
//
// METHOD 1 of the Liana Cycle method registry: THE COMPARATIVE CASCADE. Shape: options are
// short members of one category and the question turns on ranking them by a named property.
// Taught by qid 98 (population density), Founder hand-worked BP149, proven live via
// scripts/qid98_his_words.mjs (D-BP149-036) -- CORRECT, A, sole survivor, Google only, $0,
// 183s. This file ports that script's mechanism into a registry method callable on any
// comparative question, not just qid 98. Read scripts/qid98_his_words.mjs in full before
// touching this file -- its stage order, verification rules, terminator, and comments are the
// specification this file stays faithful to.
//
// WHAT IS PORTED, unchanged in substance:
//   - Google is the only source, via the injected askGoogle (AskGoogleFn) -- the SAME
//     in-process bridge (runBrowserAuthorityQueryFromMain) every other main-process caller in
//     this estate uses, not a second CDP dial.
//   - Google's result BLOCKS (title + body) are kept, never flattened to one string -- see
//     googleBlocks() below (a block's body refers to its own title with pronouns; flattening
//     destroys that reference -- measured to break the register gate for a whole BP149
//     session).
//   - Gemma extracts only, never judges (HARDWIRE-22). think:false, num_predict:512 (>=256).
//   - Every extraction is verified against the passage it came from before it is trusted.
//   - A sentence that is a question, or someone else's answer-option list, is not an assertion
//     (isAssertion(), imported from register_gate.mjs -- see that module's own doc comment for
//     the qid 98 case this caught).
//   - Unit normalization (per sq mi -> per km2) happens in code, never asked of the model.
//   - Stage order: register gate, inverse, order-both-ways with all-options QC, Cake Cut Half
//     with re-inclusion (both halves always drawn from the FULL option set, never the narrowed
//     pool -- see buildFounderQuestions() Q6/Q7 below, both list(ALL)), hard number per-option,
//     then the terminator.
//   - Terminator order: hard-number ranking at >=1.5x separation, then cross-framing
//     convergence (leastVotes), then SOLE SURVIVOR (elimination leaving exactly one option IS
//     the answer -- its absence is what made a correct BP149 run abstain before that fix).
//
// WHAT IS GENERALIZED, AND WHY IT HAS TO BE: qid98_his_words.mjs's own header says "this file
// contains NO TEMPLATE" -- true for that file, whose entire purpose was proving the Founder's
// EXACT thirteen questions work on the EXACT qid 98 option set. This file is a REGISTRY method:
// per the BP149 ruling, it must answer future comparative questions this session has never
// seen, so its ten questions cannot be hand-copied text. deriveCategoryAndProperty() below
// extracts the category noun phrase and the ranking property FROM THE QUESTION ITSELF (never a
// generic cross-domain template like "put these in order of most to least", which the ruling's
// own triggering finding says Google answered with nonsense because it names no category or
// property). On qid 98 this derivation reproduces the Founder's own wording closely enough that
// the live proof reaches the same result his hand-worked run did (see this ticket's return).

import { avgOptionWordCount, registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput, MethodRunContext, ShapeTestResult } from '../method_registry';
import type { LianaTerminalOutcome } from '../../../shared/liana_cycle/liana_terminal_types';
import { loadRegisterGate } from '../register_gate_loader';

const OLLAMA_API_BASE = process.env.OLLAMA_API_BASE ?? 'http://127.0.0.1:11434';
const MODEL = process.env.CASCADE_MODEL ?? 'gemma4:12b';

function nowIso(): string {
  return new Date().toISOString();
}

// ─────────────────────────── pure helpers ───────────────────────────

const norm = (s: unknown): string =>
  String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

const appearsIn = (passage: string, s: string): boolean => {
  const n = norm(s);
  if (!n || n.length < 3) return false;
  return norm(passage).includes(n);
};

const list = (letters: string[], OPT: Record<string, string>): string =>
  letters.map((L) => `${L}) ${OPT[L]}`).join(' ');

/** Exact-match mapping of extracted text back to a known option letter. HARDWIRE-22:
 *  "Similarity is not identity" -- normalized string equality only, never fuzzy. */
function toLetters(items: unknown[] | undefined, OPT: Record<string, string>): string[] {
  const out: string[] = [];
  for (const it of items ?? []) {
    for (const [L, t] of Object.entries(OPT)) {
      if (norm(t) === norm(it)) out.push(L);
    }
  }
  return [...new Set(out)];
}

const SQMI_PER_SQKM = 2.589988;
/** Unit normalization, in code, never asked of the model -- ported verbatim from
 *  qid98_his_words.mjs's toPerSqKm(). Covers the measured case (per sq mile vs per sq km);
 *  a property whose unit is neither passes through unchanged, clearly marked "assumed". */
function toPerSqKm(value: number, unit?: string): { value: number; unit: string; assumed: boolean } {
  const u = norm(unit);
  if (!u) return { value, unit: 'as given (no unit stated, assumed unconverted)', assumed: true };
  if (/(sq|square)\s*(mi|mile|miles)/.test(u) || /mi2/.test(u)) {
    return { value: value / SQMI_PER_SQKM, unit: 'per km2 (converted from per sq mi)', assumed: false };
  }
  if (/(sq|square)\s*(km|kilometer|kilometre|kilometers|kilometres)/.test(u) || /km2/.test(u)) {
    return { value, unit: 'per km2', assumed: false };
  }
  return { value, unit: `as given (unit "${unit}" not a recognized area rate, assumed unconverted)`, assumed: true };
}

/** Extracts the category noun phrase and the ranking property FROM THE QUESTION ITSELF -- see
 *  this file's header ("WHAT IS GENERALIZED") for why this replaces hand-copied wording. Falls
 *  back to generic-but-honest phrasing when the question does not fit the "following X is/are
 *  ... SUPERLATIVE Y" shape the register gate + shapeTest already require to reach this point. */
function deriveCategoryAndProperty(question: string): { category: string; property: string } {
  const catMatch = question.match(/following\s+([a-z][a-z\s]*?)\s+(?:is|are)\b/i);
  const category = catMatch ? catMatch[1].trim() : 'options';

  const supMatch = question.match(
    /\b(most|least|highest|lowest|greatest|smallest|densest|largest|fewest|maximum|minimum|earliest|latest|oldest|newest|farthest|nearest|closest)\b/i,
  );
  let property = '';
  if (supMatch && supMatch.index != null) {
    const after = question.slice(supMatch.index + supMatch[0].length).trim();
    const propMatch = after.match(/^([a-z][a-z\s-]*?)(?:\s+(?:regions?|options?|choices?|items?|of\b)|[.?]|$)/i);
    property = (propMatch ? propMatch[1] : after.split(/\s+/).slice(0, 3).join(' ')).trim();
  }
  if (!property) property = 'the property in question';
  return { category, property };
}

// ─────────────────────────── Google, blocks kept ───────────────────────────

interface GoogleBlock { title: string; body: string; url: string; kind: string; }
interface GoogleAnswer { ok: boolean; text: string; blocks: GoogleBlock[]; sources: string[]; via: string; }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Ported from qid98_his_words.mjs's google(): keeps result BLOCKS (title + body), never
 *  flattens to one string -- see this file's header. Reached via the injected in-process
 *  askGoogle (AskGoogleFn), not a second CDP dial. */
async function googleBlocks(
  askGoogle: MethodRunContext['askGoogle'],
  query: string,
  tries = 3,
): Promise<GoogleAnswer> {
  for (let i = 1; i <= tries; i++) {
    try {
      const raw = await askGoogle(query);
      if (raw) {
        const parts: string[] = [];
        const blocks: GoogleBlock[] = [];
        if (raw.snippet && raw.snippet.trim()) {
          parts.push(raw.snippet.trim());
          blocks.push({ title: '', body: raw.snippet.trim(), url: '', kind: 'answer_box' });
        }
        const rs = Array.isArray(raw.results) ? raw.results : [];
        for (const r of rs.slice(0, 6)) {
          const title = String(r.title || '').trim();
          const body = String(r.snippet || '').trim();
          blocks.push({ title, body, url: String(r.url || ''), kind: 'organic' });
          parts.push([title, body].filter(Boolean).join(' -- '));
        }
        if (parts.length) {
          const sources = (raw.citations || []).map((c) => c.url).concat(rs.map((r) => r.url).filter(Boolean));
          return { ok: true, text: parts.join('\n'), blocks, sources, via: `${raw.snippet ? 'box' : 'nobox'}+organic(${rs.length})` };
        }
      }
    } catch {
      // fall through to retry
    }
    if (i < tries) await sleep(i * 4000);
  }
  return { ok: false, text: '', blocks: [], sources: [], via: 'no answer after 3 attempts' };
}

// ─────────────────────────── Gemma, extraction only (HARDWIRE-22) ───────────────────────────

async function gemmaExtract(instruction: string, passage: string, shape: string): Promise<Record<string, unknown> | null> {
  const prompt = `Read the passage and report only what it states. Do not reason about which answer is correct. Do not choose between options.

PASSAGE:
${passage}

TASK: ${instruction}

Return ONLY JSON in this shape, no prose, no fence:
${shape}
Use null where the passage does not state it. Never guess.`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    const res = await fetch(`${OLLAMA_API_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt, stream: false, think: false, options: { temperature: 0, num_predict: 512 } }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
    const j = (await res.json()) as { response?: string };
    const t = (j.response || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ─────────────────────────── the Founder's ten questions, generalized ───────────────────────────

interface FounderQuestion { n: number; stage: 1 | 3 | 4 | 5; why: string; text: string; }

/** Cake Cut Half re-inclusion: Q6 and Q7 BOTH ask over list(ALL), never the narrowed pool --
 *  each alternating-direction pass starts from the full option set again as a control, per
 *  canon_cake_cut_half_alternating_bp141 ("re-including just-eliminated options as a
 *  control"). qid98_his_words.mjs already does this (both its Q6 and Q7 use list(ALL)); this
 *  port preserves it exactly. */
function buildFounderQuestions(
  category: string,
  property: string,
  inverseQuestion: string,
  ALL: string[],
  pool: string[],
  OPT: Record<string, string>,
): FounderQuestion[] {
  return [
    { n: 1, stage: 1, why: 'the inverse', text: `${inverseQuestion} ${list(ALL, OPT)}` },
    { n: 2, stage: 3, why: `most ${property} to least ${property}, survivors`, text: `Please put these ${category} in order of most ${property} to least ${property}. ${list(pool, OPT)}` },
    { n: 3, stage: 3, why: `least ${property} to most ${property}, survivors (opposite framing)`, text: `Please put these ${category} in order of least ${property} to most ${property}. ${list(pool, OPT)}` },
    { n: 4, stage: 3, why: `most ${property} to least ${property}, ALL options as quality control`, text: `Please put these ${category} in order of most ${property} to least ${property}. ${list(ALL, OPT)}` },
    { n: 5, stage: 3, why: `least ${property} to most ${property}, ALL options as quality control`, text: `Please put these ${category} in order of least ${property} to most ${property}. ${list(ALL, OPT)}` },
    { n: 6, stage: 4, why: `Cake Cut Half, remove the half that is least ${property}`, text: `From the following ${category} listed, please remove the half that are least ${property}: ${list(ALL, OPT)}` },
    { n: 7, stage: 4, why: `Cake Cut Half, remove the half that is MOST ${property} (re-including all options, opposite direction)`, text: `From the following ${category} listed, please remove the half that are MOST ${property}: ${list(ALL, OPT)}` },
    { n: 8, stage: 5, why: 'the hard number, all options', text: `What are the numeric values or rates associated with "${property}" for each of the following ${category}?: ${list(ALL, OPT)}` },
    { n: 9, stage: 5, why: `sort by ${property}, most to least`, text: `Please sort the following ${category} by exact order or provide numeric values for each, in order of most ${property} to least ${property}: ${list(ALL, OPT)}` },
    { n: 10, stage: 5, why: `sort by ${property}, least to most`, text: `Please sort the following ${category} by exact order or provide numeric values for each, in order of least ${property} to most ${property}: ${list(ALL, OPT)}` },
  ];
}

// ─────────────────────────── word sets (generalized superset of qid98_his_words.mjs's) ───────────────────────────

const HIGH_WORDS = /\b(high|highest|most|dense|densely|densest|cluster|clusters|concentration|crowded|populous|greatest|largest|maximum|newest|latest)\b/i;
const LOW_WORDS = /\b(low|lowest|least|sparse|sparsely|thinly|uninhabited|empty|smallest|fewest|minimum|oldest|earliest)\b/i;

// ─────────────────────────── shapeTest ───────────────────────────

const SUPERLATIVE_RE = /\b(most|least|highest|lowest|greatest|smallest|densest|largest|fewest|maximum|minimum|earliest|latest|oldest|newest|farthest|nearest|closest)\b/i;
const MAX_AVG_OPTION_WORDS_FOR_RANKING = 6;

function shapeTest(input: MethodQuestionInput): ShapeTestResult {
  if (!input.options || Object.keys(input.options).length < 2) {
    return { matches: false, reason: 'no option pool to rank -- this method eliminates among options, it needs at least two' };
  }
  const avgWords = avgOptionWordCount(input.options);
  if (avgWords > MAX_AVG_OPTION_WORDS_FOR_RANKING) {
    return {
      matches: false,
      reason: `options read as full statements (avg ${avgWords.toFixed(1)} words each, > ${MAX_AVG_OPTION_WORDS_FOR_RANKING}) -- not short members of one category, so nothing to rank by a property`,
    };
  }
  const supMatch = input.question.match(SUPERLATIVE_RE);
  if (!supMatch) {
    return { matches: false, reason: 'question names no superlative/ranking property (most/least/highest/lowest/...) -- nothing to order by' };
  }
  return {
    matches: true,
    reason: `options are short (avg ${avgWords.toFixed(1)} words) and the question asks to rank by "${supMatch[0]}"`,
  };
}

// ─────────────────────────── run ───────────────────────────

async function run(input: MethodQuestionInput, ctx: MethodRunContext): Promise<LianaTerminalOutcome> {
  const { askGoogle, emit } = ctx;
  const OPT = input.options as Record<string, string>;
  const ALL = Object.keys(OPT);
  const KEY = input.correctAnswer;
  const t0 = Date.now();

  const say = (text: string) => emit({ kind: 'header', text, ts: nowIso() });
  const step = (text: string) => emit({ kind: 'stage', text: `-> ${text}`, ts: nowIso() });
  const fact = (text: string) => emit({ kind: 'fact', text: `+ ${text}`, ts: nowIso() });
  const note = (text: string) => emit({ kind: 'note', text, ts: nowIso() });

  say(`METHOD comparative-cascade -- ${input.qid != null ? `qid ${input.qid}` : 'free-text'}`);
  note(`   ${input.question}`);
  note(`   ${list(ALL, OPT)}`);

  const { category, property } = deriveCategoryAndProperty(input.question);
  note(`   derived category: "${category}"   derived property: "${property}"`);

  let pool = [...ALL];
  const leastVotes: Record<string, number> = {};
  const denseVotes: Record<string, number> = {};
  const densities: Record<string, number> = {};

  // STAGE 0: register gate -- imported from register_gate.mjs, not reproduced. See
  // register_gate_loader.ts for the two runtime shims that make the import work inside
  // Electron's main process.
  step('STAGE 0  register gate -- is each option a member of the category at all?');
  try {
    const regMod = await loadRegisterGate();
    const { notRegions, report } = await regMod.runRegisterGate(OPT, { verbose: false });
    for (const [L, r] of Object.entries(report)) {
      const ev = r.evidence ? `about=${r.evidence.about} feature=${r.evidence.featureHits.length} region=${r.evidence.regionHits.length}` : '(no evidence)';
      note(`   ${L}) ${OPT[L]}: ${r.verdict}  [${ev}]${r.scope ? `  scope: ${r.scope.why}` : ''}`);
    }
    if (notRegions.length) {
      const before = pool.length;
      pool = pool.filter((L) => !notRegions.includes(L));
      fact(`register gate removed ${notRegions.join(', ')}   pool ${before} -> ${pool.length}`);
    } else {
      note('   register gate removed nothing');
    }
  } catch (e) {
    note(`   register gate unavailable (${e instanceof Error ? e.message : String(e)}) -- continuing with the full pool; register stage skipped honestly rather than guessing`);
  }

  const inverseQuestion = /\bNOT\b/i.test(input.question)
    ? input.question.replace(/\bNOT\s+/i, ' ').replace(/\s+/g, ' ').trim()
    : input.question;

  const questions = buildFounderQuestions(category, property, inverseQuestion, ALL, pool, OPT);

  for (const q of questions) {
    step(`Q${q.n}  stage ${q.stage} -- ${q.why}`);
    note(`   ${q.text}`);
    const res = await googleBlocks(askGoogle, q.text);
    if (!res.ok) {
      note(`   no answer (${res.via})`);
      continue;
    }
    fact(`Google [${res.via}]: ${res.text}`);

    let effect = '';
    if (q.stage === 1) {
      const ex = await gemmaExtract(
        `Copy out every name from this list that appears anywhere in the passage, and for each one copy the complete sentence it appears in, word for word from the passage. Do not summarize. List: ${ALL.map((L) => OPT[L]).join('; ')}`,
        res.text,
        `{"mentions":[{"name":"exact name from the list","sentence":"the verbatim sentence"}]}`,
      );
      const regMod = await loadRegisterGate().catch(() => null);
      const isAssertion = regMod?.isAssertion ?? (() => true);
      for (const m of (ex?.mentions as Array<{ name: string; sentence: string }> | undefined) ?? []) {
        const L = toLetters([m?.name], OPT)[0];
        if (!L) continue;
        const s = String(m?.sentence || '');
        if (!appearsIn(res.text, OPT[L])) { note(`      rejected ${L}: "${OPT[L]}" not in the passage`); continue; }
        if (!appearsIn(res.text, s)) { note(`      rejected ${L}: quoted sentence not found in the passage`); continue; }
        if (!isAssertion(s)) { note(`      rejected ${L}: sentence is a question or an answer-option list`); continue; }
        if (HIGH_WORDS.test(s) && !LOW_WORDS.test(s)) denseVotes[L] = (denseVotes[L] || 0) + 1;
        else if (LOW_WORDS.test(s) && !HIGH_WORDS.test(s)) leastVotes[L] = (leastVotes[L] || 0) + 1;
      }
      effect = `high-${property} votes: ${JSON.stringify(denseVotes)}   low-${property} votes: ${JSON.stringify(leastVotes)}`;
    } else if (q.stage === 3) {
      const ex = await gemmaExtract(
        `If this passage states an explicit ranking or ordered list of any of these names, copy that list out in exactly the order the passage gives it. If the passage does not state an order, return an empty list. Do not put them in order yourself. Names: ${ALL.map((L) => OPT[L]).join('; ')}`,
        res.text,
        `{"order":["exact name, in the passage's stated order"],"order_stated_in_passage":true}`,
      );
      let ord = toLetters(ex?.order as unknown[] | undefined, OPT);
      ord = ord.filter((L) => appearsIn(res.text, OPT[L]));
      if (ord.length >= 2) {
        const leastEnd = q.why.includes('most') && q.why.indexOf('most') < q.why.indexOf('least') ? ord[ord.length - 1] : ord[0];
        leastVotes[leastEnd] = (leastVotes[leastEnd] || 0) + 1;
        effect = `order: ${ord.join(' > ')}   least-${property} end: ${leastEnd}`;
      } else {
        effect = 'no usable ordering mapped';
      }
    } else if (q.stage === 4) {
      const ex = await gemmaExtract(
        `Copy out every name from this list that appears anywhere in the passage, and for each one copy the complete sentence it appears in, word for word from the passage. Do not summarize the sentence. List: ${ALL.map((L) => OPT[L]).join('; ')}`,
        res.text,
        `{"mentions":[{"name":"exact name from the list","sentence":"the verbatim sentence"}]}`,
      );
      const regMod = await loadRegisterGate().catch(() => null);
      const isAssertion = regMod?.isAssertion ?? (() => true);
      const low: string[] = [], high: string[] = [];
      for (const m of (ex?.mentions as Array<{ name: string; sentence: string }> | undefined) ?? []) {
        const L = toLetters([m?.name], OPT)[0];
        if (!L) continue;
        const s = String(m?.sentence || '');
        if (!appearsIn(res.text, OPT[L])) { note(`      rejected ${L}: "${OPT[L]}" not in the passage`); continue; }
        if (!appearsIn(res.text, s)) { note(`      rejected ${L}: quoted sentence not found in the passage`); continue; }
        if (!isAssertion(s)) { note(`      rejected ${L}: sentence is a question or an answer-option list`); continue; }
        if (LOW_WORDS.test(s) && !HIGH_WORDS.test(s)) low.push(L);
        else if (HIGH_WORDS.test(s) && !LOW_WORDS.test(s)) high.push(L);
        else note(`      ambiguous sentence for ${L}, counted for neither: ${s.slice(0, 110)}`);
      }
      for (const L of low) leastVotes[L] = (leastVotes[L] || 0) + 1;
      for (const L of high) denseVotes[L] = (denseVotes[L] || 0) + 1;
      effect = (low.length || high.length)
        ? `asserted LOW ${property}: ${low.join(', ') || '(none)'}   asserted HIGH ${property}: ${high.join(', ') || '(none)'}`
        : 'nothing mapped exactly';
    } else if (q.stage === 5) {
      const ex = await gemmaExtract(
        `Copy out every number in this passage that appears together with a unit or rate (for example "per square kilometer", "%", "/km2", "per sq mi"). For each one, copy the surrounding words exactly as they appear.`,
        res.text,
        `{"figures":[{"value":number,"unit":"the unit as written","context":"the verbatim surrounding text"}]}`,
      );
      let n = 0;
      for (const f of (ex?.figures as Array<{ value: number; unit?: string; context: string }> | undefined) ?? []) {
        if (typeof f.value !== 'number') continue;
        if (!appearsIn(res.text, f.context)) { note(`      rejected figure ${f.value}: quoted context not found in the passage`); continue; }
        const ctx2 = norm(String(f.context || ''));
        for (const L of ALL) {
          if (ctx2.includes(norm(OPT[L])) && densities[L] === undefined) {
            const c = toPerSqKm(f.value, f.unit);
            densities[L] = c.value;
            n++;
            note(`      ${OPT[L]} = ${c.value.toFixed(2)} ${c.unit}`);
          }
        }
      }
      effect = n ? `values attributed by context match: ${Object.entries(densities).map(([L, d]) => `${L}=${d}`).join('  ')}` : "no figure's context named a listed option";
    }
    note(`   >> ${effect}`);
  }

  // STAGE 5b: one option per question -- ported rationale from qid98_his_words.mjs (bulk
  // multi-option queries can return context about the WRONG scale and attribute a number to the
  // wrong option; one option per question makes attribution unambiguous).
  const survivors = ALL.filter((L) => pool.includes(L));
  step(`STAGE 5b  one option per question -- ${survivors.length} surviving option(s)`);
  for (const L of survivors) {
    const q5b = `What is the numeric value or rate associated with "${property}" for ${OPT[L]}? Report the number and its unit.`;
    note(`   ${q5b}`);
    const res = await googleBlocks(askGoogle, q5b);
    if (!res.ok) { note(`   no answer (${res.via})`); continue; }
    fact(`Google [${res.via}]: ${res.text}`);
    const ex = await gemmaExtract(
      `Copy out every number in this passage that appears together with a unit or rate (for example "per square kilometer", "%", "/km2", "per sq mi", "years"). For each one, copy the surrounding words exactly as they appear, at least the full phrase or sentence containing it.`,
      res.text,
      `{"figures":[{"value":number,"unit":"the unit as written","context":"the verbatim surrounding text"}]}`,
    );
    const wanted = norm(OPT[L]);
    let picked: { value: number; unit?: string; context: string } | null = null;
    for (const f of (ex?.figures as Array<{ value: number; unit?: string; context: string }> | undefined) ?? []) {
      if (typeof f.value !== 'number') continue;
      if (!appearsIn(res.text, f.context)) { note(`      rejected ${f.value}: quoted context not in the passage`); continue; }
      if (norm(String(f.context || '')).includes(wanted)) { picked = f; break; }
    }
    if (picked) {
      const conv = toPerSqKm(picked.value, picked.unit);
      densities[L] = conv.value;
      note(`   >> ${OPT[L]} = ${conv.value.toFixed(2)} ${conv.unit}  (as written: ${picked.value} ${picked.unit || 'no unit'})`);
    } else {
      note(`   no figure for ${OPT[L]} in this passage (honest null, not a guess)`);
    }
  }

  // TERMINATOR. Arithmetic only, no model below this line.
  say('TERMINATOR');
  const denseElim = Object.keys(denseVotes).filter((L) => pool.includes(L) && denseVotes[L] >= 1);
  if (denseElim.length) {
    const before = pool.length;
    pool = pool.filter((L) => !denseElim.includes(L));
    note(`   eliminated as asserted-high-${property}: ${denseElim.join(', ')}   pool ${before} -> ${pool.length}`);
  }
  note(`   surviving pool after the inverse: ${pool.join(', ')}`);
  note(`   least-${property} votes across stages 3 and 4: ${Object.entries(leastVotes).map(([L, n]) => `${L}x${n}`).join('  ') || '(none)'}`);
  note(`   hard values: ${Object.entries(densities).map(([L, d]) => `${L}=${d}`).join('  ') || '(none)'}`);

  let verdict: string | null = null;
  let basis = '';
  const inPool = Object.keys(densities).filter((L) => pool.includes(L));
  if (inPool.length >= 2) {
    const sorted = [...inPool].sort((a, b) => densities[a] - densities[b]);
    const sep = densities[sorted[0]] === 0 ? Infinity : densities[sorted[1]] / densities[sorted[0]];
    note(`   ascending: ${sorted.map((L) => `${L}=${densities[L]}`).join(' < ')}   separation ${sep.toFixed(2)}x`);
    if (sep >= 1.5) { verdict = sorted[0]; basis = `lowest ${property} among survivors, ${sep.toFixed(1)}x clear of the runner-up`; }
  }
  if (!verdict) {
    const ranked = Object.keys(leastVotes).filter((L) => pool.includes(L)).sort((a, b) => leastVotes[b] - leastVotes[a]);
    if (ranked.length && (ranked.length === 1 || leastVotes[ranked[0]] > leastVotes[ranked[1]])) {
      verdict = ranked[0];
      basis = `converged across framings as least ${property} (${leastVotes[ranked[0]]} votes)`;
    }
  }
  // SOLE SURVIVOR. If elimination has left exactly one option standing, that IS the answer.
  // Ported verbatim as a rule (not just a fallback of convenience) -- its absence is what made a
  // correct BP149 run abstain before this fix; see this file's header.
  if (!verdict && pool.length === 1) {
    verdict = pool[0];
    basis = 'sole survivor of elimination -- every other option was ruled out by register, inverse or value';
  }

  const elapsedS = ((Date.now() - t0) / 1000).toFixed(1);
  if (verdict) {
    const ok = KEY != null ? verdict === KEY : undefined;
    emit({ kind: 'result', text: `${KEY != null ? (ok ? 'CORRECT' : 'WRONG') : 'ANSWER'}  ${verdict} (${OPT[verdict]})${KEY != null ? `  key=${KEY}` : ''}`, ts: nowIso() });
    note(`   ${basis}`);
    note(`   ${elapsedS}s   $0`);
    return { qid: input.qid, question: input.question, verdict, correct: KEY, ok, basis, abstain: false, freeText: input.qid == null };
  }
  emit({ kind: 'result', text: `ABSTAIN   pool=${pool.join(',')}${KEY != null ? `  key=${KEY}` : ''}`, ts: nowIso() });
  note(`   ${elapsedS}s   $0`);
  return { qid: input.qid, question: input.question, verdict: null, correct: KEY, abstain: true, freeText: input.qid == null, basis: 'no terminator condition met' };
}

export const comparativeCascadeMethod: LianaMethod = {
  id: 'comparative-cascade',
  name: 'The Comparative Cascade',
  taughtBy: 'qid 98 (population density), Founder hand-worked BP149, proven live BP149 (scripts/qid98_his_words.mjs, D-BP149-036: A, sole survivor, Google only, $0, 183s)',
  shapeDescription: 'options are members of one category and the question turns on ranking them by a property',
  shapeTest,
  run,
};

registerMethod(comparativeCascadeMethod);
