// survey_stage.ts -- THE SURVEY STAGE (E-SURVEY) -- D-BP151-025/BISHOP/seg-survey-the-lieutenant
//
// SURVEY IS THE LIEUTENANT. Founder, BP151, verbatim, the order that governs this whole file:
// "the Sergeant directs the Privates with the machetes to very efficiently chop a path through
// the jungle. the Lieutenant tells them WHAT JUNGLE and in WHAT DIRECTION, because the best
// highway constructed in the wrong jungle in the wrong jungle is worse than useless." Everything
// already built (comparative_cascade.ts, definitional_cascade.ts) is the Sergeant. This file is
// the Lieutenant: it PROPOSES what the question is about and which way to go. IT NEVER ANSWERS
// THE QUESTION, and it is never itself an elimination stage.
//
// SCOPE, EXACTLY: `BISHOP_DROPZONE\THE_FOUNDERS_PROCESS_ORDERED_BP151.md` names five Founder
// steps with no execution point anywhere in the live code. Step 11 (THE TERMINATOR) is OUT OF
// SCOPE -- ruled on separately this session, owned by D-BP151-024; NOTHING in that file is read,
// imported, or touched here. This file builds ONLY steps 2, 3, 4 and 6, in his order:
//
//   STEP 2 (SURVEY) -- Founder, Excerpt 7, BP141: "If I look up the definition of bias in
//     google, perfunctorily, I get this... That doesn't answer my question, it's just a fact to
//     eblet for component factor foundation for reasoning. So keeping those definitions in mind,
//     but not bound by them."
//   STEP 3 (CATEGORIZE) -- Founder, Excerpt 7, BP141, rule 12: "Well, first, I categorize the
//     possible answers. I note that A, B, sorta C but more to that, D, E same as C... F, H is
//     like C and E, I, and J all have to do with what answer it results in. G does not."
//   STEP 4 (DETERMINE THE REGISTER) -- Founder, Excerpt 7, BP141, rule 13: "So I need to define
//     what CONTEXT the question is being asked in. I would guess from 'sample' being used in
//     A, B, C, D, E, H, I questions... then it has to do with statistics. How do I know that? I
//     don't, I'm guessing. So I'll check:" -- then he ran "what is bias in statistics". THE
//     VERIFICATION IS NOT OPTIONAL: an unverified guess is never acted on, per his own words.
//   STEP 6 (THE JAR METHOD) -- Founder, Excerpt 2, BP141, rule 2: "Note that we got rid of four
//     answers with one google search - I like to call this the Jar Method... First we take out
//     the Softballs, because we KNOW they are not the answer." He removed options a SOURCE NAMED
//     EXPLICITLY -- not options a regex matched.
//
// EVERY OTHER FOUNDER STEP (1, 5, 7-18) IS UNTOUCHED. This file does not build the register gate,
// the inverse, order-both-ways, Cake Cut Half, re-inclusion, the hard number, or the terminator.
// It does not change comparative_cascade.ts, definitional_cascade.ts, or stepped_audible.ts --
// none of those three files is imported, read for editing, or modified by this ticket.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// D-BP151-025 AMENDMENT -- TWO FORKS RULED ON, STEPS 3 AND 6 NOW COMPLETE.
//
// The first pass of this ticket stopped at two forks rather than pick a number or invent a rule.
// The Founder ruled on both directly; this amendment builds exactly what he ordered, no more:
//
//   STEP 3's GROUPING. Founder, BP151, verbatim: "Grouping requires a model call - like ALL
//     judgements, and yes, relaxed for this one purpose." HARDWIRE-22 ("Gemma extracts, never
//     judges") is relaxed ONLY for the single model call inside groupOptionsByPredicate() below --
//     nowhere else in this file, nowhere else in this estate. See that function's own ATTRIBUTED
//     comment at its call site.
//
//   STEP 6's ELIMINATION. Founder, BP151, verbatim: "certainty is derived from my mechanical
//     processes, not from any model's 'certainty'." Confirmed reading: polarity comes from WHICH
//     QUESTION WAS ASKED (the direction is fixed the moment a query goes out), never from
//     classifying a sentence with a word list. See founderStep6JarMethod()'s own ATTRIBUTED
//     comment. NO vocabulary threshold was built for step 3 (he chose the model call over it,
//     explicitly); NO word-list polarity classifier was built for step 6 (HIGH_WORDS/LOW_WORDS
//     remains a named tare, not reproduced here); step 6 still issues no Google query of its own
//     (confirmed correct as built -- "we got rid of four answers with ONE google search", never a
//     second search).
// ─────────────────────────────────────────────────────────────────────────────────────────────
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// WIRE IT, DO NOT REWRITE IT. Every phase below composes an EXISTING element. Nothing in this
// file re-implements a classifier, a query template, or an elimination rule another file already
// owns. The tare sweep (`TARE_SWEEP_BP151.md`) found the following already built and simply not
// called from anywhere live; this file is their first live caller for the ones marked (WIRED
// HERE, FIRST LIVE CALLER):
//
//   STEP 2 -> surveyAskNested() (elements/survey_ask.ts) -- ALREADY LIVE (definitional_cascade.ts
//             calls the bare surveyAsk() form). The NESTED form (surveyAskNested), and therefore
//             buildNest()/findFrame() (elements/nest.ts), were dead code before this file --
//             WIRED HERE, FIRST LIVE CALLER for elements/nest.ts.
//   STEP 3 -> surveyAnswers() (elements/survey_answers.ts) -- DEAD CODE before this file, nothing
//             imported it. WIRED HERE, FIRST LIVE CALLER. It already does exactly what step 3
//             needs as RAW MATERIAL (per-option KIND via checkKind(), ASPECT via tagAspect(),
//             and each option's own discriminating CATALYST WORDS via findCatalystWords(), each
//             surveyed in turn) -- which also makes this file the first live caller of
//             elements/kind_check.ts (checkKind/checkKindForAllOptions were dead: only reachable
//             through survey_answers.ts itself and the dead half of substitution_search.ts). The
//             actual GROUPING act (D-BP151-025 amendment) calls the SAME local Ollama instance
//             and model comparative_cascade.ts's gemmaExtract() already talks to, via a NEW
//             minimal function (groupViaModel(), this file) -- not gemmaExtract() itself, because
//             its own prompt wrapper ("report only what it states... never guess") was MEASURED
//             this ticket to suppress the judgment this one call is now ordered to make. See
//             groupViaModel()'s and groupOptionsByPredicate()'s own comments for the measurement
//             and the exact ATTRIBUTED ruling.
//   STEP 4 -> fieldGate() (elements/field_gate.ts) -- ALREADY LIVE (definitional_cascade.ts's
//             D1.5 already calls it). Reused here unmodified, as a general pre-method Survey
//             capability rather than one method's private stage.
//   STEP 6 -> extractAssertedMentions() (methods/comparative_cascade.ts, already exported and
//             already used by comparative_cascade.ts's own STAGE 1/STAGE 2) -- reused for its
//             EXTRACTION-AND-VERIFICATION half (HARDWIRE-22 unmodified: copy the sentence, verify
//             it appears verbatim, verify it is an assertion). The elimination decision (D-BP151-
//             025 amendment) is mechanical, driven by the CALLER-DECLARED direction of the query
//             that produced each source block, never a word list -- HIGH_WORDS/LOW_WORDS remains
//             a named tare, not reproduced here. See founderStep6JarMethod()'s own ATTRIBUTED
//             comment.
//   ALSO WIRED: findAskCatalyst() (elements/catalyst_words.ts) -- DEAD before this file (only
//             substitution_search.ts, itself dead, called it). WIRED HERE, FIRST LIVE CALLER, to
//             derive the term steps 2 and 4 need from the raw question text.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// HARDWIRE-23 (THE TARE RULE) -- HOW THIS FILE STAYS CLEAN.
//
// This file introduces exactly TWO decision rules of its own, and both are ATTRIBUTED at their
// own call site, per Law 4 -- no other decision rule (threshold, cutoff, ratio, tie-break, word
// list) exists anywhere in this file:
//   1. groupOptionsByPredicate()'s model call (step 3) -- HARDWIRE-22 relaxed, Founder-ordered,
//      scoped to this one call only.
//   2. founderStep6JarMethod()'s direction-driven elimination (step 6) -- mechanical, driven by a
//      caller-declared query direction, never a word list or a model judgment.
// Every OTHER phase still either (a) delegates entirely to an existing element and reports its
// result unmodified, or (b) reports raw, unranked facts with no decision made here.
//
// SURVEY STILL NEVER ANSWERS THE QUESTION. Step 6 now narrows the OPTION pool (ordered, see
// above) -- that is a POOL NARROWING, not picking a final verdict letter; `neverAnswersTheQuestion`
// on the orchestrator's own result stays true and no function in this file ever sets a
// `verdict`/`answer`/`correct` field. Where an existing wired element (fieldGate) narrows a FIELD,
// that narrowing is its own, already-disclosed behavior (E-FIELD-GATE's STEP 2/4, field_gate.ts).

import type { MethodRunContext, EmitFn } from './method_registry';
import { surveyAskNested, type SurveyAskNestedResult } from './elements/survey_ask';
import { surveyAnswers, type SurveyAnswersResult } from './elements/survey_answers';
import { fieldGate, type FieldGateResult } from './elements/field_gate';
import { findAskCatalyst } from './elements/catalyst_words';
import { extractAssertedMentions, type AssertedMention, type GoogleBlock } from './methods/comparative_cascade';

function nowIso(): string {
  return new Date().toISOString();
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// STEP 2 -- SURVEY: enumerate denotations of the ASK's own term, perfunctorily, then keep looking.
// ─────────────────────────────────────────────────────────────────────────────────────────────

export interface FounderStep2Result {
  term: string | null;
  /** Present only when `term` was derived -- surveyAskNested()'s own result (elements/
   *  survey_ask.ts), UNMODIFIED. Ready for a future ticket to feed directly into
   *  determineDemandFromSurveyedAsk() (demand_test.ts) -- not wired here, see this ticket's
   *  return, "THINGS I NOTICED AND DID NOT DO". */
  nested: SurveyAskNestedResult | null;
  why: string;
}

/**
 * FOUNDER STEP 2. Founder, Excerpt 7, BP141: "If I look up the definition of bias in google,
 * perfunctorily, I get this... That doesn't answer my question, it's just a fact to eblet for
 * component factor foundation for reasoning. So keeping those definitions in mind, but not bound
 * by them."
 *
 * WIRES surveyAskNested() (elements/survey_ask.ts) unmodified -- this is the FIRST live caller of
 * its nested form, which itself wires elements/nest.ts (buildNest/findFrame), also dead before
 * this ticket. `term` is REQUIRED to already be resolved by the caller (runSurveyStage() below
 * derives it via findAskCatalyst()); this function never guesses one itself.
 */
export async function founderStep2Survey(term: string | null, ctx: MethodRunContext): Promise<FounderStep2Result> {
  const { emit } = ctx;
  emit({
    kind: 'stage',
    text: '-> SURVEY STEP 2 -- define the term, perfunctorily, then keep looking (Founder, Excerpt 7, BP141)',
    ts: nowIso(),
  });
  if (!term) {
    const why = 'no term to survey -- refusing rather than guessing one from the raw question text (refusing beats guessing)';
    emit({ kind: 'note', text: `   ${why}`, ts: nowIso() });
    emit({ kind: 'result', text: 'SURVEY STEP 2: no term, not run', ts: nowIso() });
    return { term: null, nested: null, why };
  }
  const nested = await surveyAskNested(term, ctx);
  const why = `surveyed "${term}" via E-SURVEY-ASK's nested form (wired, not rewritten): ${nested.why}`;
  emit({ kind: 'result', text: `SURVEY STEP 2: "${term}" -- ${nested.levels.length} level(s) surveyed`, ts: nowIso() });
  return { term, nested, why };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// STEP 3 -- CATEGORIZE THE OPTIONS BY SHARED PREDICATE, BEFORE ELIMINATING ANYTHING.
// ─────────────────────────────────────────────────────────────────────────────────────────────

export interface SurveyOptionGroup {
  /** The model's own short description of what this group's options have in common -- a
   *  PROPOSAL, sourced from the one relaxed judgment call this file makes (see
   *  groupOptionsByPredicate()'s own ATTRIBUTED comment), never a verified extraction. */
  label: string;
  letters: string[];
}

export interface FounderStep3GroupingResult {
  /** The model's proposed clusters. May be empty (model unreachable, or it proposed nothing
   *  usable) -- an honest empty result, never a fabrication. */
  groups: SurveyOptionGroup[];
  /** Options the model did not place in any usable group -- reported, never forced into one. */
  ungrouped: string[];
  /** True when the model call itself produced nothing (unreachable/failed) -- distinguishes "no
   *  live model, not run" from "model ran and proposed nothing". */
  modelUnreachable: boolean;
  why: string;
}

export interface FounderStep3Result {
  /** surveyAnswers()'s own result (elements/survey_answers.ts), UNMODIFIED -- per-option KIND,
   *  ASPECT, and discriminating CATALYST WORDS, each already surveyed. This IS the raw material
   *  the Founder read when he said "I categorize the possible answers" -- what each option IS,
   *  not what it merely spells. */
  perOption: SurveyAnswersResult | null;
  /** The model's proposed groupings (D-BP151-025 amendment) -- see groupOptionsByPredicate()'s
   *  own ATTRIBUTED comment. Null exactly when `perOption` is null (no options to group). */
  grouping: FounderStep3GroupingResult | null;
  why: string;
}

/** methods/comparative_cascade.ts declares its Ollama endpoint/model as MODULE-PRIVATE constants
 *  (`OLLAMA_API_BASE`, `MODEL` -- not exported, so this file cannot import them). Read here with
 *  the IDENTICAL env-var names and defaults, so the SAME local Ollama instance and the SAME model
 *  answer both this call and every gemmaExtract() call -- a config convention, not a second
 *  system. See groupViaModel()'s own header for why the CALL ITSELF cannot reuse gemmaExtract(). */
const OLLAMA_API_BASE = process.env.OLLAMA_API_BASE ?? 'http://127.0.0.1:11434';
const GROUPING_MODEL = process.env.CASCADE_MODEL ?? 'gemma4:12b';

/**
 * MEASURED FINDING, this ticket: `gemmaExtract()` (methods/comparative_cascade.ts) cannot be
 * reused for step 3's grouping call. Its own prompt wrapper is HARDWIRE-22's TEXTUAL enforcement
 * -- "Read the passage and report only what it states... Do not reason... Never guess." -- and a
 * judgment task run through that wrapper was measured (this ticket, three separate instruction/
 * shape attempts against the live local Ollama instance, `gemma4:12b`) to come back with every
 * `group`/`letters` field null every time: the wrapper's own words tell the model not to do the
 * one thing this call now needs it to do. Continuing to route through gemmaExtract() would leave
 * the Founder's relaxation unusable in practice while APPEARING wired. So this ONE call uses its
 * own minimal prompt (below), with NO "report only what it states"/"never guess" framing -- BUT
 * the same underlying transport (identical Ollama endpoint, identical model, identical
 * temperature 0 for determinism, identical abort-on-timeout/catch-and-return-null robustness
 * `gemmaExtract()` already has) -- not a second, differently-behaved system, only a different
 * instruction reaching the same one. Re-measured after this fix, live: the model now returns real
 * groups (e.g. two sampling-bias options clustered together, a sample-size option left alone).
 */
async function groupViaModel(instruction: string, listing: string, shape: string): Promise<Record<string, unknown> | null> {
  const prompt = `You are grouping lettered options by shared predicate, using your own judgment. This is NOT extraction -- there is no single stated fact to copy; you must decide which options are alike.

OPTIONS:
${listing}

TASK: ${instruction}

Return ONLY JSON in this shape, no prose, no fence:
${shape}
Every option letter must appear in exactly one group. Do not leave a field null -- assign a real group to every option.`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    const res = await fetch(`${OLLAMA_API_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: GROUPING_MODEL, prompt, stream: false, think: false, options: { temperature: 0, num_predict: 512 } }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
    const j = (await res.json()) as { response?: string };
    const t = (j.response || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * ATTRIBUTED: Founder, BP151, verbatim: "Grouping requires a model call - like ALL judgements,
 * and yes, relaxed for this one purpose."
 *
 * THE RELAXATION IS SCOPED TO THIS ONE CALL, AND NOTHING ELSE. HARDWIRE-22 ("Gemma extracts,
 * never judges") is relaxed ONLY for grouping options by shared predicate, here, via
 * groupViaModel() above. It does not extend to extraction, elimination, register determination,
 * or any other judgment anywhere else in this file or this estate -- every other model call this
 * file relies on (surveyAsk, surveyAnswers, fieldGate, extractAssertedMentions) still goes through
 * `gemmaExtract()` unmodified and stays extraction-only.
 *
 * THE MODEL GROUPS. IT DOES NOT DECIDE WHICH GROUP IS RIGHT, AND IT NEVER ANSWERS THE QUESTION.
 * The instruction below says so, and the only post-call check this function performs is
 * MECHANICAL, not a second judgment: every returned letter must be a real option letter in this
 * question's own option set; a hallucinated or unknown letter is dropped, never trusted. NO
 * vocabulary threshold was built as an alternative (the Founder chose the model call over one,
 * explicitly, when this fork was put to him).
 */
async function groupOptionsByPredicate(
  options: Record<string, string>,
  ctx: MethodRunContext,
): Promise<FounderStep3GroupingResult> {
  const letters = Object.keys(options);
  const listing = letters.map((L) => `${L}) ${options[L]}`).join('\n');
  const ex = await groupViaModel(
    'Group these lettered options into clusters of options that make a similar kind of claim or '
      + 'share a similar predicate -- the way a person would group answers before eliminating any '
      + 'of them, not by counting shared words. An option unlike every other option may form a '
      + 'group of one. For each group, give a short label describing what its options have in '
      + 'common. Do not decide which option is correct. Do not answer the question these options '
      + 'are for. Do not rank the groups.',
    listing,
    '{"groups":[{"label":"short description of what this group\'s options have in common","letters":["A","B"]}]}',
  );
  if (!ex) {
    return {
      groups: [],
      ungrouped: letters,
      modelUnreachable: true,
      why: 'the model call for grouping returned nothing (unreachable or failed) -- an honest '
        + 'empty result, not a fabrication; every option reported ungrouped',
    };
  }
  const rawGroups = Array.isArray(ex.groups) ? (ex.groups as Array<{ label?: unknown; letters?: unknown }>) : [];
  const validLetters = new Set(letters);
  const seen = new Set<string>();
  const groups: SurveyOptionGroup[] = [];
  for (const g of rawGroups) {
    const label = typeof g?.label === 'string' && g.label.trim() ? g.label.trim() : '(no label given)';
    const rawLetters = Array.isArray(g?.letters) ? g!.letters : [];
    // MECHANICAL check only, not a second judgment: a returned letter must be one of THIS
    // question's own real options. A hallucinated/unknown letter is dropped, never trusted.
    const groupLetters = rawLetters.filter((l): l is string => typeof l === 'string' && validLetters.has(l));
    if (!groupLetters.length) continue;
    groupLetters.forEach((l) => seen.add(l));
    groups.push({ label, letters: groupLetters });
  }
  const ungrouped = letters.filter((L) => !seen.has(L));
  const why = `${groups.length} group(s) proposed by the model, ${ungrouped.length} option(s) left ungrouped -- `
    + 'a PROPOSAL, not a decision: the model groups, it does not decide which group is right, and it never answers the question';
  return { groups, ungrouped, modelUnreachable: false, why };
}

/**
 * FOUNDER STEP 3. Founder, Excerpt 7, BP141, rule 12: "Well, first, I categorize the possible
 * answers. I note that A, B, sorta C but more to that, D, E same as C... F, H is like C and E,
 * I, and J all have to do with what answer it results in. G does not."
 *
 * WIRES surveyAnswers() (elements/survey_answers.ts) unmodified -- DEAD CODE before this file,
 * first live caller. It reports, per option: the option's own verbatim text, its KIND
 * (checkKind(), elements/kind_check.ts -- also its first live caller), its ASPECT (tagAspect()),
 * and its own discriminating catalyst word(s) (findCatalystWords()), each surveyed in turn.
 *
 * THEN GROUPS via groupOptionsByPredicate() -- the Founder's own resolution of the fork this
 * function originally stopped at (see that function's own ATTRIBUTED comment for the exact
 * ruling and its scope). The grouping is a PROPOSAL: it is not verified against the passage the
 * way an extraction is, and it never picks a "right" group or an answer to the question.
 */
export async function founderStep3CategorizeOptions(
  options: Record<string, string> | null,
  ctx: MethodRunContext,
  sharedFrame?: RegExp,
  /** Passthrough to surveyAnswers()'s own `maxCatalystWordsPerOption` (elements/survey_answers.ts)
   *  -- an existing COST bound already defined and owned by that element (default 1, unchanged
   *  here), never a new decision rule: it does not change WHICH catalyst word is surveyed, only
   *  how many of the already-ordered list get an extra Google round-trip. Exposed here so a
   *  caller (including this file's own tests) can bound I/O without touching survey_answers.ts. */
  maxCatalystWordsPerOption?: number,
): Promise<FounderStep3Result> {
  const { emit } = ctx;
  emit({
    kind: 'stage',
    text: '-> SURVEY STEP 3 -- categorize the options by shared predicate, before eliminating anything (Founder, Excerpt 7, BP141, rule 12)',
    ts: nowIso(),
  });
  if (!options || Object.keys(options).length === 0) {
    const why = 'no options supplied -- nothing to categorize';
    emit({ kind: 'note', text: `   ${why}`, ts: nowIso() });
    emit({ kind: 'result', text: 'SURVEY STEP 3: no options, not run', ts: nowIso() });
    return { perOption: null, grouping: null, why };
  }
  const perOption = await surveyAnswers(options, ctx, { sharedFrame, maxCatalystWordsPerOption });
  emit({
    kind: 'note',
    text: '   ATTRIBUTED: Founder, BP151, verbatim: "Grouping requires a model call - like ALL judgements, and yes, '
      + 'relaxed for this one purpose." (HARDWIRE-22 relaxed for THIS grouping call only)',
    ts: nowIso(),
  });
  const grouping = await groupOptionsByPredicate(options, ctx);
  const why = `${perOption.why} -- ${grouping.why}`;
  emit({ kind: 'note', text: `   ${grouping.why}`, ts: nowIso() });
  emit({
    kind: 'result',
    text: `SURVEY STEP 3: ${perOption.letters.length} option(s) surveyed, ${grouping.groups.length} group(s) proposed (model call, PROPOSAL only)`,
    ts: nowIso(),
  });
  return { perOption, grouping, why };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// STEP 4 -- DETERMINE THE REGISTER: guess out loud, then check it. Verification is mandatory.
// ─────────────────────────────────────────────────────────────────────────────────────────────

export interface FounderStep4Result {
  term: string | null;
  /** Present only when `term` was resolved -- fieldGate()'s own result (elements/field_gate.ts),
   *  UNMODIFIED. */
  field: FieldGateResult | null;
  /** True EXACTLY when fieldGate() reached ONE_SURVIVOR -- the only decision this function itself
   *  makes, and it is a direct, definitional readout of fieldGate()'s own GateDecision enum, not
   *  a new threshold. An unverified guess (MULTIPLE_SURVIVORS, ZERO_SURVIVORS, NO_CANDIDATES) is
   *  never reported as verified. */
  verified: boolean;
  why: string;
}

/**
 * FOUNDER STEP 4. Founder, Excerpt 7, BP141, rule 13: "So I need to define what CONTEXT the
 * question is being asked in. I would guess from 'sample' being used in A, B, C, D, E, H, I
 * questions... then it has to do with statistics. How do I know that? I don't, I'm guessing. So
 * I'll check:" -- then he ran "what is bias in statistics" and verified the register-specific
 * definition came back. THE VERIFICATION IS NOT OPTIONAL, per his own words.
 *
 * WIRES fieldGate() (elements/field_gate.ts) unmodified -- ALREADY LIVE (definitional_cascade.ts
 * D1.5 already calls it). fieldGate()'s own STEP 1 (ask) / STEP 2 (eliminate by co-occurring
 * vocabulary) shape already IS guess-then-verify: candidate field names are never trusted merely
 * because Google returned them (the "guess"); a candidate survives only if its own sourced
 * vocabulary is independently corroborated by the ASK/options (the "check"). `verified` below is
 * true only on fieldGate()'s own ONE_SURVIVOR decision -- MULTIPLE_SURVIVORS, ZERO_SURVIVORS and
 * NO_CANDIDATES are all reported honestly as unverified, per this ticket's hard constraint that an
 * unverified register guess may never be acted on.
 */
export async function founderStep4DetermineRegister(
  term: string | null,
  askText: string,
  options: Record<string, string> | null,
  ctx: MethodRunContext,
): Promise<FounderStep4Result> {
  const { emit } = ctx;
  emit({
    kind: 'stage',
    text: '-> SURVEY STEP 4 -- determine the register: guess out loud, then check it (Founder, Excerpt 7, BP141, rule 13)',
    ts: nowIso(),
  });
  if (!term) {
    const why = 'no term to determine a register for -- refusing rather than guessing one from the raw question text';
    emit({ kind: 'note', text: `   ${why}`, ts: nowIso() });
    emit({ kind: 'result', text: 'SURVEY STEP 4: no term, not run', ts: nowIso() });
    return { term: null, field: null, verified: false, why };
  }
  const field = await fieldGate(term, askText, options, ctx);
  const verified = field.decision === 'ONE_SURVIVOR';
  const why = verified
    ? `VERIFIED: ${field.why}`
    : `NOT VERIFIED (${field.decision}) -- register left unconstrained rather than acted on: ${field.why}`;
  emit({ kind: 'note', text: `   ${why}`, ts: nowIso() });
  emit({ kind: 'result', text: `SURVEY STEP 4: ${verified ? 'VERIFIED' : 'unverified'} [${field.decision}]`, ts: nowIso() });
  return { term, field, verified, why };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// STEP 6 -- THE JAR METHOD: report what a source NAMED, never what a word list matched.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The semantic direction of one Jar Method source query, DECLARED by the caller who formed the
 * query -- never inferred by this file from the query text, from the returned passage, or from a
 * word list. See JarSourceGroup's own ATTRIBUTED comment for the ruling this encodes.
 *   'answers-eliminate' -- the query asks for the OPPOSITE of what the original ask wants (his
 *     own qid-98 example: the inverse, "Which regions ARE densely populated?"). Any option a
 *     source NAMES as an answer to that query is confirmed to be the opposite of what is sought,
 *     and is eliminated.
 *   'answers-keep' -- the query asks the SAME direction as the original ask. A named option is
 *     reported (in `named`) but not eliminated by this function.
 */
export type JarQueryDirection = 'answers-eliminate' | 'answers-keep';

export interface JarSourceGroup {
  query: string;
  blocks: GoogleBlock[];
  /**
   * ATTRIBUTED: Founder, BP151, verbatim: "certainty is derived from my mechanical processes, not
   * from any model's 'certainty'." Confirmed reading (put to him directly): the polarity comes
   * from WHICH QUESTION WAS ASKED, not from classifying the sentence. His own qid-98 walkthrough
   * asked the inverse -- "Which of the following world regions IS considered one of the world's
   * most densely populated regions?" -- so any option a source names as an answer to THAT query
   * is removed from the pool for the original (opposite) ask. The direction was fixed the moment
   * the query went out, which means it is knowable only by whoever formed the query -- this file
   * does not and cannot infer it from the query string or the returned text. REQUIRED, not
   * optional or defaulted: a source group with no declared direction cannot be constructed (the
   * type carries no undefined/default case).
   */
  direction: JarQueryDirection;
}

export interface JarNamedMention {
  letter: string;
  /** The verbatim sentence the source asserted about this option, HARDWIRE-22 -- copied and
   *  verified against the passage it came from, never paraphrased. */
  sentence: string;
  sourceQuery: string;
  direction: JarQueryDirection;
}

export interface JarEliminatedOption {
  letter: string;
  sentence: string;
  sourceQuery: string;
  why: string;
}

export interface FounderStep6Result {
  /** Every option a supplied source block explicitly named, with the verbatim sentence and the
   *  direction of the query that produced it -- the full naming record, regardless of outcome. */
  named: JarNamedMention[];
  /** Options ELIMINATED because a source named them as an answer to a query DECLARED
   *  'answers-eliminate'. Mechanical: (a) named verbatim -- extractAssertedMentions() proves it;
   *  (b) the query's direction is known -- the caller declared it; (c) eliminate per that known
   *  direction. No word list, no model judgment, no threshold. */
  eliminated: JarEliminatedOption[];
  /** Unique eliminated letters, for a caller that only needs the pool-narrowing fact. */
  eliminatedLetters: string[];
  why: string;
}

/**
 * FOUNDER STEP 6, THE JAR METHOD. Founder, Excerpt 2, BP141, rule 2: "Note that we got rid of
 * four answers with one google search - I like to call this the Jar Method... First we take out
 * the Softballs, because we KNOW they are not the answer." He removed options a SOURCE NAMED
 * EXPLICITLY, with certainty -- not options a word-list regex happened to match.
 *
 * WIRES extractAssertedMentions() (methods/comparative_cascade.ts, already exported, already used
 * live by that file's own STAGE 1/STAGE 2) for its EXTRACTION-AND-VERIFICATION half, UNMODIFIED:
 * which of the option's own names does this passage mention, and the verbatim sentence, each
 * checked against the passage itself (appearsIn) and checked to be an assertion (register_gate.
 * mjs's isAssertion()) before being trusted.
 *
 * THE CERTAINTY/POLARITY RULING (D-BP151-025 amendment), ATTRIBUTED at JarSourceGroup.direction's
 * own comment above: certainty is MECHANICAL, derived from the caller-declared direction of the
 * query that produced a source block -- never from a model's confidence, never from a word list
 * (HIGH_WORDS/LOW_WORDS remains comparative_cascade.ts's own named tare, not reproduced here).
 * (a) a source names an option verbatim (proven); (b) the query's direction is known (declared);
 * (c) eliminate per that known direction. This function makes no OTHER decision: it does not
 * choose which query to run, does not weigh sources against each other, and never eliminates an
 * option no source named.
 *
 * STILL ISSUES NO GOOGLE QUERY OF ITS OWN -- confirmed correct as originally built. Founder,
 * Excerpt 2, BP141: "we got rid of four answers with ONE google search" -- the Jar Method was
 * never a second search; it reads more out of a response an earlier query already returned. This
 * function takes `sourceGroups` -- blocks and their KNOWN direction, from a caller who already
 * fetched them for another purpose (e.g. Stage 1's inverse query) -- as a required parameter,
 * mirroring D-BP150-018(C)'s "stop throwing away Stage 1's haul" precedent. An empty array is an
 * honest "not run", never a fabricated result.
 */
export async function founderStep6JarMethod(
  sourceGroups: JarSourceGroup[],
  options: Record<string, string> | null,
  ctx: MethodRunContext,
): Promise<FounderStep6Result> {
  const { emit } = ctx;
  const note = (text: string) => emit({ kind: 'note', text, ts: nowIso() });
  emit({
    kind: 'stage',
    text: '-> SURVEY STEP 6 -- THE JAR METHOD: eliminate what a source NAMED, by the query\'s own known direction (Founder, Excerpt 2, BP141, rule 2)',
    ts: nowIso(),
  });

  if (!options || Object.keys(options).length === 0) {
    const why = 'no options supplied -- nothing to check a source against';
    note(`   ${why}`);
    emit({ kind: 'result', text: 'SURVEY STEP 6: no options, not run', ts: nowIso() });
    return { named: [], eliminated: [], eliminatedLetters: [], why };
  }
  if (!sourceGroups.length) {
    const why = 'no source groups supplied -- this function issues no query of its own (Founder: "we got rid of '
      + 'four answers with ONE google search" -- never a second search); not run, not a fabricated elimination';
    note(`   ${why}`);
    emit({ kind: 'result', text: 'SURVEY STEP 6: no source groups, not run', ts: nowIso() });
    return { named: [], eliminated: [], eliminatedLetters: [], why };
  }

  const ALL = Object.keys(options);
  const named: JarNamedMention[] = [];
  const eliminated: JarEliminatedOption[] = [];
  for (const { query, blocks, direction } of sourceGroups) {
    note(`   source group -- query "${query}", direction=${direction}`);
    // eslint-disable-next-line no-await-in-loop -- one Gemma call per block, sequential by design,
    // same pattern as survey_ask.ts's own handleBlock() loop.
    for (const block of blocks) {
      const passage = [block.title, block.body].filter(Boolean).join(' -- ');
      if (!passage.trim()) continue;
      // eslint-disable-next-line no-await-in-loop
      const mentions: AssertedMention[] = await extractAssertedMentions(passage, ALL, options, note);
      for (const m of mentions) {
        named.push({ letter: m.L, sentence: m.sentence, sourceQuery: query, direction });
        if (direction === 'answers-eliminate') {
          eliminated.push({
            letter: m.L,
            sentence: m.sentence,
            sourceQuery: query,
            why: `named as an answer to a query declared "answers-eliminate" -- eliminated by the Jar Method's own `
              + 'mechanical rule (certainty from the query\'s known direction, not a word list; Founder, BP151: '
              + '"certainty is derived from my mechanical processes, not from any model\'s \'certainty\'")',
          });
        }
      }
    }
  }
  const eliminatedLetters = [...new Set(eliminated.map((e) => e.letter))];
  const why = named.length
    ? `${named.length} named mention(s) found across ${sourceGroups.length} source group(s), verified verbatim -- `
      + `${eliminatedLetters.length} option(s) eliminated by known query direction: ${eliminatedLetters.join(', ') || '(none)'}`
    : `0 named mentions found across ${sourceGroups.length} source group(s) -- an honest empty result, not a fabrication`;
  note(`   ${why}`);
  emit({
    kind: 'result',
    text: `SURVEY STEP 6: ${named.length} named mention(s), ${eliminatedLetters.length} option(s) eliminated`,
    ts: nowIso(),
  });
  return { named, eliminated, eliminatedLetters, why };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE ORCHESTRATOR -- steps 2, 3, 4, 6, IN HIS ORDER. Survey PROPOSES. It never answers.
// ─────────────────────────────────────────────────────────────────────────────────────────────

export interface SurveyStageResult {
  askText: string;
  term: string | null;
  termWhy: string;
  step2: FounderStep2Result;
  step3: FounderStep3Result;
  step4: FounderStep4Result;
  step6: FounderStep6Result;
  /** ALWAYS true -- structural guard so a caller cannot mistake this result for a verdict. Survey
   *  never sets a `verdict`/`answer` field anywhere in this file. */
  neverAnswersTheQuestion: true;
  why: string;
}

export interface SurveyStageOpts {
  /** Caller-supplied override for the term steps 2/4 survey -- skips findAskCatalyst() derivation.
   *  Mirrors substitution_search.ts's own `explicitTerm` convention. */
  explicitTerm?: string;
  /** Already-fetched Google blocks for step 6 to report on, each with its KNOWN, caller-declared
   *  query direction (see JarSourceGroup's own ATTRIBUTED comment). Omitted/empty = step 6
   *  reports "not run", never a fabricated result -- it issues no query of its own. */
  jarSourceGroups?: JarSourceGroup[];
  sharedFrame?: RegExp;
  /** Passthrough to founderStep3CategorizeOptions()'s own cost bound -- see that parameter's own
   *  comment. Not a decision rule; unset leaves survey_answers.ts's own default (1) unchanged. */
  maxCatalystWordsPerOption?: number;
}

/**
 * THE SURVEY STAGE. Runs Founder steps 2, 3, 4 and 6, IN HIS ORDER, before any elimination stage
 * touches anything. Composes existing elements (see this file's header for the full wiring
 * table) plus the two Founder-ordered decision rules this file itself owns (step 3's grouping
 * model call, step 6's direction-driven elimination), both ATTRIBUTED at their own call site.
 *
 * NOT WIRED INTO liana_terminal_engine.ts's DISPATCH BY THIS TICKET. See this ticket's return,
 * "THINGS I NOTICED AND DID NOT DO", for why splicing this into the shared dispatcher ahead of
 * method selection is its own fork (which term for a free-text question with no quoted/cued term,
 * whether a failed Survey should abstain the whole run or proceed unscoped, and how Survey's own
 * `kind:'stage'` events would interact with stepped_audible.ts's hard `methodId !==
 * 'comparative-cascade'` gate -- a file this ticket may not touch) that this ticket did not
 * receive an order to resolve. This function is complete, tested, and ready to be called by
 * whichever future ticket resolves that wiring decision.
 */
export async function runSurveyStage(
  askText: string,
  options: Record<string, string> | null,
  ctx: MethodRunContext,
  opts: SurveyStageOpts = {},
): Promise<SurveyStageResult> {
  const { emit } = ctx;
  emit({ kind: 'header', text: 'SURVEY -- the Lieutenant: what is this question about, and which way does it point? (steps 2, 3, 4, 6 only; step 11/TERMINATOR is out of scope, owned by D-BP151-024)', ts: nowIso() });

  let term: string | null = null;
  let termWhy: string;
  if (opts.explicitTerm && opts.explicitTerm.trim()) {
    term = opts.explicitTerm.trim();
    termWhy = `caller-supplied explicit term override: "${term}"`;
  } else {
    // WIRED HERE, FIRST LIVE CALLER of elements/catalyst_words.ts's findAskCatalyst() -- dead
    // before this file (only substitution_search.ts, itself dead, called it).
    const catalyst = findAskCatalyst(askText);
    if (catalyst) {
      term = catalyst.term;
      termWhy = `derived via findAskCatalyst() (elements/catalyst_words.ts, wired here for the first time): ${catalyst.why}`;
    } else {
      termWhy = 'findAskCatalyst() found no quoted term and no explains/describes/defines-style cue in the '
        + 'question -- refusing rather than guessing one from the raw question text (refusing beats guessing)';
    }
  }
  emit({ kind: 'note', text: `   term: ${term ? `"${term}"` : '(none -- ' + termWhy + ')'}`, ts: nowIso() });

  const step2 = await founderStep2Survey(term, ctx);
  const step3 = await founderStep3CategorizeOptions(options, ctx, opts.sharedFrame, opts.maxCatalystWordsPerOption);
  const step4 = await founderStep4DetermineRegister(term, askText, options, ctx);
  const step6 = await founderStep6JarMethod(opts.jarSourceGroups ?? [], options, ctx);

  const why = `SURVEY complete -- term ${term ? `"${term}" (${termWhy})` : `unresolved (${termWhy})`}; `
    + `step2: ${step2.nested ? `${step2.nested.levels.length} level(s) surveyed` : 'not run'}; `
    + `step3: ${step3.perOption ? `${step3.perOption.letters.length} option(s) surveyed, ${step3.grouping?.groups.length ?? 0} group(s) proposed` : 'not run'}; `
    + `step4: ${step4.verified ? 'VERIFIED register' : 'unverified/unresolved'}; `
    + `step6: ${step6.named.length} named mention(s), ${step6.eliminatedLetters.length} option(s) eliminated by known query direction. `
    + 'SURVEY NEVER ANSWERS THE QUESTION -- step 6\'s elimination narrows the option POOL (Founder-ordered, mechanical), '
    + 'no final verdict letter was ever picked by this stage.';
  emit({ kind: 'result', text: `SURVEY: ${why}`, ts: nowIso() });

  return { askText, term, termWhy, step2, step3, step4, step6, neverAnswersTheQuestion: true, why };
}
