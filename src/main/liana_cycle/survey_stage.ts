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
//             through survey_answers.ts itself and the dead half of substitution_search.ts).
//   STEP 4 -> fieldGate() (elements/field_gate.ts) -- ALREADY LIVE (definitional_cascade.ts's
//             D1.5 already calls it). Reused here unmodified, as a general pre-method Survey
//             capability rather than one method's private stage.
//   STEP 6 -> extractAssertedMentions() (methods/comparative_cascade.ts, already exported and
//             already used by comparative_cascade.ts's own STAGE 1/STAGE 2) -- reused for its
//             EXTRACTION-AND-VERIFICATION half only (HARDWIRE-22: copy the sentence, verify it
//             appears verbatim, verify it is an assertion). The HIGH_WORDS/LOW_WORDS regex vote
//             that turns those verified mentions into an elimination decision belongs to
//             comparative_cascade.ts and definitional_cascade.ts's own Jar Method wiring -- NOT
//             reproduced here. See founderStep6JarMethod()'s own header for exactly where this
//             file stops and why.
//   ALSO WIRED: findAskCatalyst() (elements/catalyst_words.ts) -- DEAD before this file (only
//             substitution_search.ts, itself dead, called it). WIRED HERE, FIRST LIVE CALLER, to
//             derive the term steps 2 and 4 need from the raw question text.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// HARDWIRE-23 (THE TARE RULE) -- HOW THIS FILE STAYS CLEAN.
//
// This file introduces ZERO new decision rules (no threshold, cutoff, ratio, tie-break, or word
// list of its own). Every phase either (a) delegates entirely to an existing element and reports
// its result unmodified, or (b) reports raw, unranked facts with no clustering/elimination
// decision made here. Where the Founder's own step calls for a JUDGMENT this file cannot make
// without either inventing a rule or invoking model judgment nobody ordered, this file STOPS and
// says so in the returned `fork` field, per Law 2 ("stop and ask, do not implement and disclose").
// See founderStep3CategorizeOptions() and founderStep6JarMethod() for the two forks this ticket
// found and did not build past.
//
// SURVEY NEVER ELIMINATES. Every function below returns candidates/facts, never a narrowed pool.
// Where an existing wired element (fieldGate) DOES narrow (a field, not an OPTION), that
// narrowing is its own, already-disclosed behavior (E-FIELD-GATE's STEP 2/4, field_gate.ts) --
// this file does not add a second narrowing on top of it, and never narrows an OPTION.

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

export interface FounderStep3Result {
  /** surveyAnswers()'s own result (elements/survey_answers.ts), UNMODIFIED -- per-option KIND,
   *  ASPECT, and discriminating CATALYST WORDS, each already surveyed. This IS the raw material
   *  the Founder read when he said "I categorize the possible answers" -- what each option IS,
   *  not what it merely spells. */
  perOption: SurveyAnswersResult | null;
  /** ALWAYS present, and always states the fork below when perOption is non-null. */
  why: string;
  /** ALWAYS present -- this step stops short of the Founder's full instruction (grouping) on
   *  every call, options-supplied or not; HARDWIRE-23 Law 2: stop and report, do not implement
   *  and disclose. */
  fork: string;
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
 * THE FORK THIS FUNCTION STOPS AT: the Founder's OWN act above is grouping options by READING
 * THEIR MEANING ("D, E same as C", "G does not") -- a semantic judgment, not a count. The only
 * existing mechanism that turns per-option vocabulary into GROUPS is a shared-token-count
 * threshold (definitional_cascade.ts's own D1, `categorizeBySharedPredicate()`, ">=2 shared
 * non-stopword tokens") -- already named a TARE by the tare sweep (row #17: "That number is not
 * yours and does not do what you did"). Building a SECOND clustering rule here, with any
 * threshold at all (1, 2, or otherwise), would be exactly the tare this ticket exists to stop
 * installing -- and the alternative, asking a model to JUDGE which options are "like" each
 * other, is model JUDGMENT, which HARDWIRE-22 forbids everywhere in this estate's Gemma calls and
 * which no Founder order authorizes here. So this function reports the SAME raw per-option facts
 * he had in front of him (assertion, kind, aspect, catalyst words) and STOPS -- it proposes the
 * material, it does not propose the groups. See this ticket's return for the fork stated to the
 * Founder.
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
  const fork = 'FORK, not built: grouping options by READ MEANING ("D, E same as C... G does not") is a semantic '
    + 'judgment. The only mechanical grouping rule on file is definitional_cascade.ts D1\'s >=2-shared-token '
    + 'threshold, already named a TARE (tare sweep row #17) because it counts tokens, not meaning, and the '
    + 'number is unattributed. Building a second threshold here would repeat exactly that defect; asking a '
    + 'model to judge similarity is JUDGMENT, which HARDWIRE-22 forbids for every Gemma call in this estate '
    + 'and which no Founder order authorizes here. STOPPED per HARDWIRE-23 Law 2 -- reporting the per-option '
    + 'facts (kind/aspect/catalyst words) he had in front of him, not the groups.';
  if (!options || Object.keys(options).length === 0) {
    const why = 'no options supplied -- nothing to categorize';
    emit({ kind: 'note', text: `   ${why}`, ts: nowIso() });
    emit({ kind: 'result', text: 'SURVEY STEP 3: no options, not run', ts: nowIso() });
    return { perOption: null, why, fork };
  }
  const perOption = await surveyAnswers(options, ctx, { sharedFrame, maxCatalystWordsPerOption });
  const why = `${perOption.why} -- ${fork}`;
  emit({ kind: 'note', text: `   ${fork}`, ts: nowIso() });
  emit({ kind: 'result', text: `SURVEY STEP 3: ${perOption.letters.length} option(s) surveyed, 0 grouped (fork, see note)`, ts: nowIso() });
  return { perOption, why, fork };
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

export interface JarNamedMention {
  letter: string;
  /** The verbatim sentence the source asserted about this option, HARDWIRE-22 -- copied and
   *  verified against the passage it came from, never paraphrased. */
  sentence: string;
  sourceQuery: string;
}

export interface FounderStep6Result {
  /** Every option a supplied source block explicitly named, with the verbatim sentence -- NOT an
   *  elimination. See this function's own header for exactly why this file stops at naming. */
  named: JarNamedMention[];
  why: string;
  fork: string;
}

/**
 * FOUNDER STEP 6, THE JAR METHOD. Founder, Excerpt 2, BP141, rule 2: "Note that we got rid of
 * four answers with one google search - I like to call this the Jar Method... First we take out
 * the Softballs, because we KNOW they are not the answer." He removed options a SOURCE NAMED
 * EXPLICITLY, with certainty -- not options a word-list regex happened to match.
 *
 * WIRES extractAssertedMentions() (methods/comparative_cascade.ts, already exported, already used
 * live by that file's own STAGE 1/STAGE 2) for its EXTRACTION-AND-VERIFICATION half only: which
 * of the option's own names does this passage mention, and the verbatim sentence, each checked
 * against the passage itself (appearsIn) and checked to be an assertion (register_gate.mjs's
 * isAssertion(), not a question or someone else's answer-option list) before being trusted.
 *
 * THE FORK THIS FUNCTION STOPS AT, PER THIS TICKET'S OWN HARD CONSTRAINT ("If you cannot
 * distinguish 'named by the source' from 'matched a word list' without inventing a rule, stop and
 * report"): extractAssertedMentions() proves an option was NAMED (its own text appears, in an
 * asserted sentence, verified verbatim). It does NOT decide whether that naming means "this is
 * the answer" or "this is a softball, take it out" -- that polarity call is exactly what
 * comparative_cascade.ts's HIGH_WORDS/LOW_WORDS regex vote does today, and the governing process
 * document names that regex vote itself as the tare (6.a: "the live rule eliminates on one match
 * against a generic word-list... That is not what you did. You removed what a source named with
 * certainty; the code removes what a regex touches"). Building a SECOND polarity rule here --
 * with any word list, however small -- would repeat that exact defect under Survey's name
 * instead of the cascade's. So this function reports NAMING ONLY and performs NO ELIMINATION;
 * whether/how a "softball" is taken out of a pool remains the elimination stage's own decision,
 * unchanged by this ticket.
 *
 * ALSO STOPS AT SOURCING: this function issues NO Google query of its own. The Founder's example
 * ("one google search") is domain-specific to the case he walked; inventing a generic query
 * template for "the Jar Method search" without an order for its exact wording would itself be an
 * unordered rule (a query is a filter over what evidence can ever reach this function). Per
 * D-BP150-018(C)'s already-established precedent ("stop throwing away Stage 1's haul"), this
 * function instead takes `sourceBlocks` -- blocks a CALLER already fetched for its own purpose --
 * as a required parameter. An empty array is an honest "not run", never a fabricated result.
 */
export async function founderStep6JarMethod(
  sourceBlocks: Array<{ query: string; blocks: GoogleBlock[] }>,
  options: Record<string, string> | null,
  ctx: MethodRunContext,
): Promise<FounderStep6Result> {
  const { emit } = ctx;
  const note = (text: string) => emit({ kind: 'note', text, ts: nowIso() });
  emit({
    kind: 'stage',
    text: '-> SURVEY STEP 6 -- THE JAR METHOD: report what a source NAMED, never what a word list matched (Founder, Excerpt 2, BP141, rule 2)',
    ts: nowIso(),
  });
  const fork = 'FORK, elimination not built: this function reports which options a source NAMED, verified '
    + 'verbatim (extractAssertedMentions(), wired not rewritten) -- it does not decide whether a named '
    + 'mention means "take it out". That polarity call is comparative_cascade.ts\'s own HIGH_WORDS/'
    + 'LOW_WORDS regex vote, already named a tare by the governing process document (6.a); building a '
    + 'second word-list here would repeat the same defect under Survey\'s name. STOPPED per HARDWIRE-23 '
    + 'Law 2. Also stops at sourcing: this function issues no Google query of its own -- it only reports '
    + 'on `sourceBlocks` a caller already fetched, per D-BP150-018(C)\'s reuse precedent.';

  if (!options || Object.keys(options).length === 0) {
    const why = 'no options supplied -- nothing to check a source against';
    note(`   ${why}`);
    emit({ kind: 'result', text: 'SURVEY STEP 6: no options, not run', ts: nowIso() });
    return { named: [], why, fork };
  }
  if (!sourceBlocks.length) {
    const why = 'no source blocks supplied -- this function issues no query of its own (see fork below); '
      + 'not run, not a fabricated empty elimination';
    note(`   ${why}`);
    emit({ kind: 'result', text: 'SURVEY STEP 6: no source blocks, not run', ts: nowIso() });
    return { named: [], why, fork };
  }

  const ALL = Object.keys(options);
  const named: JarNamedMention[] = [];
  for (const { query, blocks } of sourceBlocks) {
    // eslint-disable-next-line no-await-in-loop -- one Gemma call per block, sequential by design,
    // same pattern as survey_ask.ts's own handleBlock() loop.
    for (const block of blocks) {
      const passage = [block.title, block.body].filter(Boolean).join(' -- ');
      if (!passage.trim()) continue;
      // eslint-disable-next-line no-await-in-loop
      const mentions: AssertedMention[] = await extractAssertedMentions(passage, ALL, options, note);
      for (const m of mentions) {
        named.push({ letter: m.L, sentence: m.sentence, sourceQuery: query });
      }
    }
  }
  const why = named.length
    ? `${named.length} named mention(s) found across ${sourceBlocks.length} source(s), verified verbatim -- ${fork}`
    : `0 named mentions found across ${sourceBlocks.length} source(s) -- an honest empty result, not a fabrication -- ${fork}`;
  note(`   ${why}`);
  emit({ kind: 'result', text: `SURVEY STEP 6: ${named.length} named mention(s), 0 eliminated (fork, see note)`, ts: nowIso() });
  return { named, why, fork };
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
  /** Already-fetched Google blocks for step 6 to report on (see founderStep6JarMethod()'s own
   *  header for why this function never fetches its own). Omitted/empty = step 6 reports "not
   *  run", never a fabricated result. */
  jarSourceBlocks?: Array<{ query: string; blocks: GoogleBlock[] }>;
  sharedFrame?: RegExp;
  /** Passthrough to founderStep3CategorizeOptions()'s own cost bound -- see that parameter's own
   *  comment. Not a decision rule; unset leaves survey_answers.ts's own default (1) unchanged. */
  maxCatalystWordsPerOption?: number;
}

/**
 * THE SURVEY STAGE. Runs Founder steps 2, 3, 4 and 6, IN HIS ORDER, before any elimination stage
 * touches anything. Composes four already-existing elements (see this file's header for the full
 * wiring table) and adds no new decision rule of its own -- every threshold/word-list/query this
 * function relies on is either already attributed elsewhere or explicitly refused here as a fork.
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
  const step6 = await founderStep6JarMethod(opts.jarSourceBlocks ?? [], options, ctx);

  const why = `SURVEY complete -- term ${term ? `"${term}" (${termWhy})` : `unresolved (${termWhy})`}; `
    + `step2: ${step2.nested ? `${step2.nested.levels.length} level(s) surveyed` : 'not run'}; `
    + `step3: ${step3.perOption ? `${step3.perOption.letters.length} option(s) reported, 0 grouped (fork)` : 'not run'}; `
    + `step4: ${step4.verified ? 'VERIFIED register' : 'unverified/unresolved'}; `
    + `step6: ${step6.named.length} named mention(s), 0 eliminated (fork). `
    + 'PROPOSAL ONLY -- no answer was picked, no option was eliminated, by this stage.';
  emit({ kind: 'result', text: `SURVEY: proposal only -- ${why}`, ts: nowIso() });

  return { askText, term, termWhy, step2, step3, step4, step6, neverAnswersTheQuestion: true, why };
}
