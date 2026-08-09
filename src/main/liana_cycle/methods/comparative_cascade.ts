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

// norm/appearsIn/list/toLetters/googleBlocks/gemmaExtract are exported (D-BP149-043) so
// definitional_cascade.ts can share this exact code for its own stages 0/1/2 and D2-D4 rather
// than reproducing it -- see the "shared stages 0/1/2" block below for the full rationale.
export const norm = (s: unknown): string =>
  String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

export const appearsIn = (passage: string, s: string): boolean => {
  const n = norm(s);
  if (!n || n.length < 3) return false;
  return norm(passage).includes(n);
};

export const list = (letters: string[], OPT: Record<string, string>): string =>
  letters.map((L) => `${L}) ${OPT[L]}`).join(' ');

/** Exact-match mapping of extracted text back to a known option letter. HARDWIRE-22:
 *  "Similarity is not identity" -- normalized string equality only, never fuzzy. */
export function toLetters(items: unknown[] | undefined, OPT: Record<string, string>): string[] {
  const out: string[] = [];
  for (const it of items ?? []) {
    for (const [L, t] of Object.entries(OPT)) {
      if (norm(t) === norm(it)) out.push(L);
    }
  }
  return [...new Set(out)];
}

const SQMI_PER_SQKM = 2.589988;
const CALENDAR_YEAR_MIN = 1000;
const CALENDAR_YEAR_MAX = 2100;

/** Folds the superscript "²" (U+00B2) to ascii "2" before the shared norm() strips every
 *  non-alphanumeric character -- norm() alone drops U+00B2 with nothing left in its place, which
 *  silently turned "per km²" into "per km" and made the unit unrecognizable (a prior session
 *  logged this exact miss; FIX 2, D-BP151-013, ticket instruction: "handle it"). Scoped to this
 *  one check -- norm() itself stays byte-identical for the option-text/sentence matching every
 *  other call site in this file depends on. */
function normUnitText(s: unknown): string {
  return norm(String(s == null ? '' : s).replace(/\u00b2/g, '2'));
}

/** FIX 2 (D-BP151-013, "a quantity must prove it is the right kind of quantity"), TIGHTENED per
 *  the Founder's read of scripts/register_gate.mjs-era transcript
 *  (C:\Users\Administrator\Downloads\LianaCyleActualReasoningQid98.md, lines 269 and 280): the
 *  OLD toPerSqKm() already detected that "to 2022" and "none" are not recognized area-rate units
 *  -- it said so in its own returned string ("not a recognized area rate, assumed unconverted")
 *  -- and then used the bare year anyway. THAT assumed-unconverted passthrough was the fail-open,
 *  not a missing check. This version keeps the exact same unit-recognition test (sq mi / sq km /
 *  km2, now also tolerant of a space or the folded superscript before the trailing digit -- "km
 *  2", "km²" -- and, per FIX 2's second finding this pass, requires a RATE marker ("per", "/",
 *  "each") next to the area unit so a bare AREA figure sharing the same "km2" suffix -- e.g. a
 *  region's total 469,630 km2 -- cannot be mistaken for a density just because the digits after
 *  "km" match) but returns an HONEST NULL instead of a passthrough whenever that test fails.
 *  A bare 4-digit integer with no recognized unit that also falls in a plausible-calendar-year
 *  range (1000-2100) gets a more specific rejection reason naming that -- but this is a NAMED
 *  ILLUSTRATION of the general rule, never a second, looser gate: a genuinely rate-carrying value
 *  in that same numeric range is accepted exactly like any other, magnitude alone is never by
 *  itself a rejection reason. */
// Exported (was module-private) so this ticket's unit tests (comparative_cascade.test.ts) can
// call it directly against the exact literal strings from the qid 98 receipt, same convention as
// this file's other exported pure helpers (norm, appearsIn, toLetters) -- zero behavior change.
export function toPerSqKm(
  value: number,
  unit: string | undefined,
  context: string,
): { ok: true; value: number; unit: string } | { ok: false; reason: string } {
  const hay = `${normUnitText(unit)} ${normUnitText(context)}`;
  const RATE_MARKER_RE = /\b(per|each)\b/;
  const hasRateMarker = RATE_MARKER_RE.test(hay) || /\//.test(`${unit ?? ''} ${context ?? ''}`);
  if (hasRateMarker && (/(sq|square)\s*(mi|mile|miles)/.test(hay) || /mi\s*2/.test(hay))) {
    return { ok: true, value: value / SQMI_PER_SQKM, unit: 'per km2 (converted from per sq mi)' };
  }
  if (hasRateMarker && (/(sq|square)\s*(km|kilometer|kilometre|kilometers|kilometres)/.test(hay) || /km\s*2/.test(hay))) {
    return { ok: true, value, unit: 'per km2' };
  }
  if (Number.isInteger(value) && value >= CALENDAR_YEAR_MIN && value <= CALENDAR_YEAR_MAX) {
    return {
      ok: false,
      reason: `no recognized area-RATE unit anywhere in the unit field or surrounding text, and the bare integer ${value} falls in the plausible-calendar-year range (${CALENDAR_YEAR_MIN}-${CALENDAR_YEAR_MAX}) -- rejected rather than guessed as a density`,
    };
  }
  return {
    ok: false,
    reason: `no recognized area-RATE unit ("${unit || 'none stated'}") anywhere in the unit field or surrounding text -- rejected rather than assumed`,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────── shared stages 0/1/2 (D-BP149-043, METHOD 2 reuse) ───────────────────────────
// definitional_cascade.ts (METHOD 2) reuses these three exports verbatim for its own "stages 0,
// 1 and 2 of Method 1, unchanged" per the Founder's BP149 teaching (method_registry.ts header:
// "Use stages 0, 1 and 2 from Method 1, then add ... rules 12, 13 and 11"). Extracted out of
// run() below with NO behavior change -- run() now calls runStage0RegisterGate() and
// extractAssertedMentions() in exactly the places its old inline code used to sit, same inputs,
// same outputs, same printed transcript text. qid 98 was re-verified live after this extraction
// (see this ticket's return) to confirm the answer is still A.

/** FIX 1 (D-BP151-013): thrown when stage 0 (the register gate) cannot execute after bounded
 *  retries -- see runStage0RegisterGate() below. This estate forbids a gate that cannot run from
 *  failing open; every caller of runStage0RegisterGate() must catch this and ABSTAIN rather than
 *  produce a verdict from an unvetted pool. Its own class (same idiom as audible.ts's
 *  AudibleAbandoned) so a caller can tell "stage 0 never ran" apart from any other exception
 *  without parsing a message string. */
export class RegisterGateUnavailableError extends Error {}

// Same bounded-retry idiom as googleBlocks() below (tries=3, i*4000ms settling delay between
// attempts) -- FIX 1 applies it to the register gate call itself. The qid 98 receipt shows this
// call failing with a bare "fetch failed" (register_gate.mjs's pickTarget() dials the CDP port
// via a plain fetch -- see register_gate_loader.ts's own doc comment for why that dial can be a
// transient main-process timing issue, not a permanent one), so a bounded retry with a settling
// delay is the honest thing to try before concluding the gate truly cannot run.
const REGISTER_GATE_RETRY_TRIES = 3;

/** STAGE 0, register gate. Shared, not reproduced -- see this file's own header ("Google is the
 *  only source ... Gemma extracts only ... Unit normalization happens in code") and
 *  register_gate_loader.ts's doc comment for the two runtime shims that make importing
 *  scripts/register_gate.mjs work inside Electron's main process. `pool` in, filtered pool out;
 *  every line this prints on a SUCCESSFUL run is identical to what this stage always printed
 *  inline. FIX 1 (D-BP151-013): a transient failure is now retried up to
 *  REGISTER_GATE_RETRY_TRIES times with a settling delay before it is treated as real; if it
 *  still cannot run, this THROWS RegisterGateUnavailableError instead of returning the pool
 *  unfiltered -- the old catch-and-continue-with-the-full-pool behavior was the gate-fails-open
 *  defect that let three category errors (Arctic Circle, Amazon Rainforest, Sahara Desert -- the
 *  BP149 register gate's own removals) survive into the qid 98 terminator. Callers MUST catch
 *  RegisterGateUnavailableError and abstain; it must never propagate into a verdict. */
export async function runStage0RegisterGate(
  OPT: Record<string, string>,
  pool: string[],
  ctx: MethodRunContext,
): Promise<string[]> {
  const { emit } = ctx;
  const step = (text: string) => emit({ kind: 'stage', text: `-> ${text}`, ts: nowIso() });
  const note = (text: string) => emit({ kind: 'note', text, ts: nowIso() });
  const fact = (text: string) => emit({ kind: 'fact', text: `+ ${text}`, ts: nowIso() });

  step('STAGE 0  register gate -- is each option a member of the category at all?');
  let lastErrMsg = '';
  for (let attempt = 1; attempt <= REGISTER_GATE_RETRY_TRIES; attempt++) {
    try {
      const regMod = await loadRegisterGate();
      const { notRegions, report } = await regMod.runRegisterGate(OPT, { verbose: false });
      for (const [L, r] of Object.entries(report)) {
        const ev = r.evidence ? `about=${r.evidence.about} feature=${r.evidence.featureHits.length} region=${r.evidence.regionHits.length}` : '(no evidence)';
        note(`   ${L}) ${OPT[L]}: ${r.verdict}  [${ev}]${r.scope ? `  scope: ${r.scope.why}` : ''}`);
      }
      let next = [...pool];
      if (notRegions.length) {
        const before = next.length;
        next = next.filter((L) => !notRegions.includes(L));
        fact(`register gate removed ${notRegions.join(', ')}   pool ${before} -> ${next.length}`);
      } else {
        note('   register gate removed nothing');
      }
      return next;
    } catch (e) {
      lastErrMsg = e instanceof Error ? e.message : String(e);
      if (attempt < REGISTER_GATE_RETRY_TRIES) {
        note(`   register gate attempt ${attempt}/${REGISTER_GATE_RETRY_TRIES} failed (${lastErrMsg}) -- retrying after a settling delay, not yet treated as a permanent failure`);
        await sleep(attempt * 4000);
      }
    }
  }
  // FIX 1: the gate cannot run after every retry. It must NOT fail open -- see the class doc
  // above. This is the fix for the qid 98 receipt's line 111: "register gate unavailable (fetch
  // failed) -- continuing with the full pool" is exactly the sentence this throw replaces.
  note(`   register gate unavailable after ${REGISTER_GATE_RETRY_TRIES} attempts (${lastErrMsg}) -- ABSTAINING rather than continuing with an unvetted pool`);
  throw new RegisterGateUnavailableError(
    `stage 0 register gate could not execute after ${REGISTER_GATE_RETRY_TRIES} attempts (${lastErrMsg})`,
  );
}

export interface AssertedMention { L: string; sentence: string; }

/** Shared extraction step underlying STAGE 1 (ask the inverse) and STAGE 2 (Jar Method): ask
 *  Gemma (HARDWIRE-22 extraction only -- never judgment) which of the ALL option names this
 *  passage mentions, and the verbatim sentence each appears in, then verify every claim against
 *  the passage itself before trusting it: the option text must literally appear, the quoted
 *  sentence must literally appear, and the sentence must be an assertion (register_gate.mjs's
 *  isAssertion() -- not a question, not someone else's answer-option list). Callers decide what
 *  the verified mentions MEAN (comparative_cascade.ts votes them high/low by density vocabulary;
 *  definitional_cascade.ts's Jar Method uses the same votes to eliminate). */
export async function extractAssertedMentions(
  passageText: string,
  ALL: string[],
  OPT: Record<string, string>,
  note: (text: string) => void,
): Promise<AssertedMention[]> {
  const ex = await gemmaExtract(
    `Copy out every name from this list that appears anywhere in the passage, and for each one copy the complete sentence it appears in, word for word from the passage. Do not summarize. List: ${ALL.map((L) => OPT[L]).join('; ')}`,
    passageText,
    `{"mentions":[{"name":"exact name from the list","sentence":"the verbatim sentence"}]}`,
  );
  const regMod = await loadRegisterGate().catch(() => null);
  const isAssertion = regMod?.isAssertion ?? (() => true);
  const out: AssertedMention[] = [];
  for (const m of (ex?.mentions as Array<{ name: string; sentence: string }> | undefined) ?? []) {
    const L = toLetters([m?.name], OPT)[0];
    if (!L) continue;
    const s = String(m?.sentence || '');
    if (!appearsIn(passageText, OPT[L])) { note(`      rejected ${L}: "${OPT[L]}" not in the passage`); continue; }
    if (!appearsIn(passageText, s)) { note(`      rejected ${L}: quoted sentence not found in the passage`); continue; }
    if (!isAssertion(s)) { note(`      rejected ${L}: sentence is a question or an answer-option list`); continue; }
    out.push({ L, sentence: s });
  }
  return out;
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

export interface GoogleBlock { title: string; body: string; url: string; kind: string; }
export interface GoogleAnswer { ok: boolean; text: string; blocks: GoogleBlock[]; sources: string[]; via: string; }

// sleep() is now declared once, earlier in this file (near toPerSqKm/runStage0RegisterGate,
// D-BP151-013 FIX 1), so both the register gate retry and this file's own googleBlocks() below
// share the exact same helper instead of two separate copies.

/** Ported from qid98_his_words.mjs's google(): keeps result BLOCKS (title + body), never
 *  flattens to one string -- see this file's header. Reached via the injected in-process
 *  askGoogle (AskGoogleFn), not a second CDP dial. */
export async function googleBlocks(
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

export async function gemmaExtract(instruction: string, passage: string, shape: string): Promise<Record<string, unknown> | null> {
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

export const HIGH_WORDS = /\b(high|highest|most|dense|densely|densest|cluster|clusters|concentration|crowded|populous|greatest|largest|maximum|newest|latest)\b/i;
export const LOW_WORDS = /\b(low|lowest|least|sparse|sparsely|thinly|uninhabited|empty|smallest|fewest|minimum|oldest|earliest)\b/i;

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

  // STAGE 0: register gate -- extracted to runStage0RegisterGate() above (D-BP149-043) so
  // definitional_cascade.ts can share this exact code; behavior and printed output unchanged on
  // a successful run. FIX 1 (D-BP151-013): this can now THROW RegisterGateUnavailableError when
  // stage 0 could not execute after its retries -- caught here and turned into an honest abstain,
  // never allowed to reach the terminator with an unvetted pool (the qid 98 defect).
  try {
    pool = await runStage0RegisterGate(OPT, pool, ctx);
  } catch (e) {
    if (!(e instanceof RegisterGateUnavailableError)) throw e;
    const elapsedS = ((Date.now() - t0) / 1000).toFixed(1);
    emit({ kind: 'result', text: `ABSTAIN   stage 0 register gate unavailable${KEY != null ? `  key=${KEY}` : ''}`, ts: nowIso() });
    note(`   ${e.message}`);
    note('   this estate does not allow a gate to fail open (FIX 1, D-BP151-013): rather than continue with an unvetted option pool -- the qid 98 defect -- this run abstains instead of producing a verdict.');
    note(`   ${elapsedS}s   $0`);
    return {
      qid: input.qid,
      question: input.question,
      verdict: null,
      correct: KEY,
      abstain: true,
      freeText: input.qid == null,
      basis: 'stage 0 register gate unavailable after retries -- abstained rather than continue with an unvetted pool',
      error: 'register_gate_unavailable',
    };
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
      const mentions = await extractAssertedMentions(res.text, ALL, OPT, note);
      for (const { L, sentence: s } of mentions) {
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
      const mentions = await extractAssertedMentions(res.text, ALL, OPT, note);
      const low: string[] = [], high: string[] = [];
      for (const { L, sentence: s } of mentions) {
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
            // FIX 2 (D-BP151-013): the value must prove it carries a real area-RATE unit before
            // it is trusted -- see toPerSqKm()'s own doc comment. A rejection is logged with the
            // raw text, the reason, and the option it belonged to, never silently dropped.
            const c = toPerSqKm(f.value, f.unit, f.context);
            if (c.ok) {
              densities[L] = c.value;
              n++;
              note(`      ${OPT[L]} = ${c.value.toFixed(2)} ${c.unit}`);
            } else {
              note(`      rejected candidate for ${OPT[L]}: ${f.value} ${f.unit ? `(unit field: "${f.unit}")` : '(no unit field)'} -- ${c.reason}   raw: "${f.context}"`);
            }
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
      // FIX 2 (D-BP151-013): same unit-RATE proof as the stage-5 bulk pass above. This also
      // closes the overwrite this ticket's amendment found (stage 5b unconditionally overwrote a
      // good stage-5 value, e.g. Europe's real "72 per km2" from Q10, with a unit-less candidate,
      // e.g. "2012"): a rejected candidate is never assigned, so an earlier real value in
      // `densities[L]` (if any) survives untouched.
      const conv = toPerSqKm(picked.value, picked.unit, picked.context);
      if (conv.ok) {
        densities[L] = conv.value;
        note(`   >> ${OPT[L]} = ${conv.value.toFixed(2)} ${conv.unit}  (as written: ${picked.value} ${picked.unit || 'no unit'})`);
      } else {
        note(`   rejected candidate for ${OPT[L]}: ${picked.value} ${picked.unit ? `(unit field: "${picked.unit}")` : '(no unit field)'} -- ${conv.reason}   raw: "${picked.context}"`);
        note(`   no figure for ${OPT[L]} in this passage (honest null, not a guess)`);
      }
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

  // FIX 3 (D-BP151-013): COVERAGE PRECONDITION. The hard-number branch may rank the pool only
  // when it actually COVERS the pool's real contenders. qid 98: H and I (Amazon Rainforest,
  // Sahara Desert) were each voted least-${property} TWICE by stages 3/4 -- they were the
  // elimination stages' actual answer -- yet both ended stage 5b as an honest null, and the old
  // code still ranked the {A, E, F} subset it happened to have numbers for and answered A.
  // Ranking a subset the parser succeeded on is not ranking the pool. This is a structural
  // precondition, not a softened threshold: if ANY option the elimination stages voted for as
  // least-${property} lacks a resolved value, the branch may not fire at all, regardless of how
  // clean the separation looks among the options that do have one.
  const votedLeast = Object.keys(leastVotes).filter((L) => pool.includes(L) && leastVotes[L] >= 1);
  const votedWithValue = votedLeast.filter((L) => densities[L] !== undefined);
  const votedWithoutValue = votedLeast.filter((L) => densities[L] === undefined);
  if (votedLeast.length) {
    note(`   coverage check for the hard-number branch: voted least-${property} = ${votedLeast.join(', ')}   have a value: ${votedWithValue.join(', ') || '(none)'}   no value (honest null or unresolved): ${votedWithoutValue.join(', ') || '(none)'}`);
  }
  if (votedWithoutValue.length) {
    note(`   hard-number branch: WITHHELD -- ${votedWithoutValue.join(', ')} ${votedWithoutValue.length === 1 ? 'was' : 'were'} voted least-${property} by stages 3/4 but ${votedWithoutValue.length === 1 ? 'has' : 'have'} no resolved value; ranking only the subset the parser succeeded on is not ranking the pool`);
  } else if (inPool.length >= 2) {
    const sorted = [...inPool].sort((a, b) => densities[a] - densities[b]);
    const sep = densities[sorted[0]] === 0 ? Infinity : densities[sorted[1]] / densities[sorted[0]];
    note(`   ascending: ${sorted.map((L) => `${L}=${densities[L]}`).join(' < ')}   separation ${sep.toFixed(2)}x`);
    if (sep >= 1.5) {
      verdict = sorted[0];
      basis = `lowest ${property} among survivors, ${sep.toFixed(1)}x clear of the runner-up`;
      note(`   hard-number branch: FIRED -- coverage satisfied and separation ${sep.toFixed(2)}x >= 1.5x`);
    } else {
      note(`   hard-number branch: covered, but separation ${sep.toFixed(2)}x < 1.5x -- not fired`);
    }
  } else {
    note('   hard-number branch: covered, but fewer than two survivors carry a resolved value -- not fired');
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
  // D-BP150-003: this method orders options by a property. Its answer is a position in an
  // ordering, so its demand is RANK. It must not run on a question that demands anything else.
  demand: 'RANK',
  taughtBy: 'qid 98 (population density), Founder hand-worked BP149, proven live BP149 (scripts/qid98_his_words.mjs, D-BP149-036: A, sole survivor, Google only, $0, 183s)',
  shapeDescription: 'options are members of one category and the question turns on ranking them by a property',
  shapeTest,
  run,
};

registerMethod(comparativeCascadeMethod);
