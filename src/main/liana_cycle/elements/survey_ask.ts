// elements/survey_ask.ts -- E-SURVEY-ASK -- D-BP150-005/BISHOP/S05/seg-survey
//
// THE UNCONDITIONAL PRE-PHASE, as a method element. Ratified canon:
//   Asteroid-ProofVault/state/eblets/CANON/
//     canon_liana_methods_are_compositions_of_named_elements_bp150.eblet.md
//
// Founder, BP150: "Before we can ask what a term means within the context of the question, we
// need to have the denotation and possible applications for each. This step, in this question,
// will be crucial, as the term bias means many different things depending on context."
//
// THE ONE WAY THIS DIFFERS FROM D2/D3/D4 (definitional_cascade.ts), AND IT IS THE WHOLE REASON
// THIS ELEMENT EXISTS: D2 looks up the bare term once. D3 GUESSES one register from the option
// vocabulary, then verifies that single guess. D4 reduces to ONE core sense. All three CHOOSE.
// Survey must ENUMERATE and hand every candidate forward, undecided.
//
// Canon F-1, the measured failure this closes: on qid 85 the run fetched the SAMPLING sense of
// "bias" at step 7 -- "A sampling method is called biased if it systematically favors some
// outcomes over others" -- rejected every option against it, then re-fetched at D2/D3 and
// silently carried forward the ESTIMATOR sense instead -- "bias is the tendency of a statistic
// to overestimate or underestimate the population parameter." Two different folds inside ONE
// register (statistics), and picking one without saying so is what broke the question. Survey
// exists so both folds come back side by side, sourced, and NOTHING picks between them here.
//
// WHAT IS REUSED, NOT REINVENTED (per this ticket's instruction -- no second Google path, no
// second Gemma prompt style):
//   - googleBlocks() from comparative_cascade.ts -- the SAME injected AskGoogleFn bridge every
//     method in this registry uses. Google is the only source. $0. No second CDP dial, ever.
//   - gemmaExtract() from comparative_cascade.ts -- HARDWIRE-22, extraction only, never
//     judgment. Every prompt below is "copy the sentence that...", "copy the word or phrase
//     that...", exactly D4's own prompt shape, never "which of these", never "decide whether".
//   - appearsIn() from comparative_cascade.ts -- an extraction that cannot be found verbatim in
//     the passage it came from is DISCARDED, not trusted. Applied here to both the defining
//     sentence AND the claimed register name, independently.
//   - tagAspect() from aspect_tag.ts -- E-ASPECT-TAG is its own element with its own canon
//     (the 5K Rule). This file does not write a second aspect classifier; it calls that one.
//
// WHAT THIS FILE DELIBERATELY DOES NOT DO, AND WHY:
//   - It does not pick a denotation. Returning several with no winner is the CORRECT output.
//     Comparing denotations against each other and eliminating on the difference is E-MATCH-UP
//     (D5), and canon marks E-MATCH-UP UNSOLVED. Scoring or ranking the candidates here would
//     smuggle that unsolved problem into a module whose whole job is to refuse it.
//   - It does not infer a register. `SurveyDenotation.register` is extracted FROM the source
//     text by Gemma (copy the field/subject name the passage itself states), verified against
//     that same passage, and left null when the source does not say -- never guessed from
//     option vocabulary the way D3's REGISTER_LEXICON guesses. That guess-then-verify machinery
//     belongs to D3 and stays there; Survey runs before any options are even in scope for this
//     purpose.
//   - It is not a registered LianaMethod. Canon: "Survey runs unconditionally, before method
//     selection... It is not in the registry, because a registry entry would need something to
//     select IT, and that is a loop." So this file exports plain functions, not a
//     `shapeTest`/`run` pair, and performs I/O freely -- `shapeTest()` is the thing required to
//     stay pure (method_registry.ts says so explicitly), not this element.
//   - It does not extract the ASK's term from the raw question string. That is E-CATALYST-WORDS'
//     job (`findAskCatalyst()` in catalyst_words.ts) or D2's own `extractBareTerm()` inside the
//     cascade that calls this. `surveyAsk()` takes the term as an argument so it composes with
//     either -- "mix and match", per the governing canon's own stated purpose for elements.

import type { MethodRunContext } from '../method_registry';
import { appearsIn, gemmaExtract, googleBlocks, norm, type GoogleBlock } from '../methods/comparative_cascade';
import { tagAspect, type AspectTag } from './aspect_tag';
// D-BP150-019 FIX 1 -- answer-key contamination guard, reused not reimplemented. See that file's
// own header for the two measured leaks this closes (qid 85 denotations 32 and 33) and why both
// checks are needed (a marker phrase and a near-verbatim option match catch different leaks).
import { findAnswerKeyMarker, findNearVerbatimOptionMatch } from './answer_key_guard';
// D-BP150-014 -- THE NEST METHOD's decomposition half, reused not reimplemented. Ratified canon:
//   Asteroid-ProofVault/state/eblets/CANON/canon_the_nest_method_bp150.eblet.md
// "E-SURVEY-ASK must gain decomposition: take a phrase, produce the nest, survey each level in
// order, and carry the frame's resolved sense into the levels below it. Its current single-term
// signature is a special case of the nest with depth 1." See surveyAskNested() at the bottom of
// this file for the general form; surveyAsk() above is UNCHANGED and remains the depth-1 case.
import { buildNest, type NestLevel, type NestResult } from './nest';

function nowIso(): string {
  return new Date().toISOString();
}

/** One candidate denotation of the surveyed term, sourced and never summarized. */
export interface SurveyDenotation {
  /** The defining sentence, copied verbatim (HARDWIRE-22) -- never paraphrased or shortened. */
  sentence: string;
  sourceUrl: string;
  sourceTitle: string;
  /** The register/field this denotation belongs to, AS STATED BY THE SOURCE and verified against
   *  it -- never inferred by this module. Null when the source text does not name one. */
  register: string | null;
  /** Always present, explains the register verdict even (especially) when it is null. */
  registerWhy: string;
  /** From tagAspect() (elements/aspect_tag.ts) -- no second classifier written here. */
  aspect: AspectTag;
  /** Always present: which query and source this denotation came from, for audit. */
  why: string;
}

/** A source block that was consulted but yielded nothing verifiable -- recorded, not silently
 *  dropped. "I DESPISE SUMMARIES" (Founder, BP149): a block that produced nothing is itself a
 *  fact the transcript must show. */
export interface SurveyDiscardedBlock {
  query: string;
  sourceUrl: string;
  sourceTitle: string;
  why: string;
}

export interface SurveyAskResult {
  term: string;
  /** Every query actually sent to Google, verbatim, in order. Does NOT include
   *  `reusedSources` below -- those cost no new Google call. */
  queries: string[];
  /** Distinct candidate denotations found. Deliberately UNRANKED -- see this file's header. */
  denotations: SurveyDenotation[];
  discarded: SurveyDiscardedBlock[];
  /** D-BP150-018 (C). Labels of already-fetched block sources (e.g. Stage 1's inverse-question
   *  fetch, comparative_cascade.ts) that were run through this SAME extraction/verification
   *  pipeline, at zero additional Google cost -- see `SurveyAskOpts.extraBlockSources` below. */
  reusedSources: string[];
  /** Always present -- the top-line honest summary for the transcript. */
  why: string;
}

export interface SurveyAskOpts {
  /** D-BP150-018 (B). Field names to scope additional denotation queries to, one query per field:
   *  "<term> in <field>". Sent for EVERY name in this list -- there is no "pick the best field"
   *  step here; the caller (definitional_cascade.ts) is expected to pass every field its own
   *  E-FIELD-GATE run left surviving, not just a single guess. An empty/omitted list leaves this
   *  function's behavior identical to before this ticket: "define <term>" and "other meanings of
   *  <term>" only. */
  scopeFields?: string[];
  /** D-BP150-018 (C). Already-fetched Google blocks, from a caller that ran its OWN query for its
   *  own purpose (Stage 1's "ask the inverse", comparative_cascade.ts, shared not copied) and
   *  happened to fetch material that may state a denotation of `term`. Survey never saw this
   *  material before this ticket because it only ever ran its own two queries. Each entry's
   *  blocks are pushed through the exact same extractDenotationFromBlock()/appearsIn()
   *  verification every query-derived block gets -- no new Google call, no relaxed verification. */
  extraBlockSources?: Array<{ query: string; blocks: GoogleBlock[] }>;
  /** D-BP150-019 FIX 1(b). The question's own option set, so every candidate denotation -- from
   *  EVERY source, freshly queried or reused -- can be checked for near-verbatim reproduction of an
   *  option's text (isNearVerbatimOptionMatch(), answer_key_guard.ts) before it is trusted. The
   *  marker check (FIX 1(a)) alone does not catch every leak: a source can restate an option's
   *  substance without ever using a phrase like "the correct answer is" (measured case: qid 85
   *  denotation 32, homework.study.com). Optional/null-safe -- a caller with no options in scope
   *  (surveyAskNested()'s per-level calls, surveyAnswers()'s per-catalyst-word calls) simply skips
   *  this check, exactly as before this ticket. */
  options?: Record<string, string> | null;
}

/** D2 reuses this exact query text ("define <term>"). Survey reuses it too, verbatim, so the two
 *  elements are asking Google the same first question -- Survey just does not stop at one block
 *  of the answer the way D2 does. */
function defineQuery(term: string): string {
  return `define ${term}`;
}

/** A second, differently-angled query aimed squarely at surfacing OTHER senses -- this is the
 *  same "Other Meanings" surface D3's REGISTER_LEXICON comment in definitional_cascade.ts cites
 *  Google as already returning for an ambiguous term like "bias" (statistics, sewing,
 *  electronics, K-pop). Asking for it directly, rather than hoping D2's single "define" query
 *  happens to surface it, is the concrete mechanism behind "enumerate, don't collapse". */
function otherMeaningsQuery(term: string): string {
  return `other meanings of ${term}`;
}

/** D-BP150-018 (B). Scoped like D3 was, but for EVERY surviving field, not one guess: "<term> in
 *  <field>" -- the exact query shape D3's register guess used ("what is bias in statistics"), the
 *  scoping half of D3 this ticket restores without restoring D3's collapse. One of these is sent
 *  per field the caller passes in `SurveyAskOpts.scopeFields`; every one of them is enumerated,
 *  none is picked. */
function scopedQuery(term: string, field: string): string {
  return `${term} in ${field}`;
}

/** One Gemma call per source block, extraction only, HARDWIRE-22. Copies the defining sentence
 *  AND the register name the passage itself states -- same call shape as D4's single-field
 *  extraction in definitional_cascade.ts, just two fields instead of one, exactly as
 *  extractAssertedMentions() in comparative_cascade.ts already extracts {name, sentence} pairs
 *  in one call rather than two. Both fields are verified against the block's OWN text
 *  (appearsIn) before being trusted; neither is asked of Gemma as a judgment. */
async function extractDenotationFromBlock(
  term: string,
  block: GoogleBlock,
  query: string,
  options: Record<string, string> | null | undefined,
): Promise<{ denotation: SurveyDenotation | null; discardReason: string | null }> {
  const passage = [block.title, block.body].filter(Boolean).join(' -- ');
  if (!passage.trim()) {
    return { denotation: null, discardReason: 'block carried no text (title and body both empty)' };
  }

  // D-BP150-019 FIX 1(a). Reject the WHOLE PASSAGE, before any extraction is even attempted, when
  // it contains an answer-declaring phrase. Checked here, not just against the sentence Gemma would
  // extract below, because extraction can cleanly strip a marker's own wording while still
  // laundering through a sentence lifted from an answer-key page -- measured case: qid 85 denotation
  // 32's source passage read "...True or False? 1 answer -- Top answer: The given statement is
  // true: bias describes a process..."; the marker never appears in the sentence Gemma would copy,
  // only in the passage it was cut from. See answer_key_guard.ts's own header for every marker and
  // where each was observed.
  const marker = findAnswerKeyMarker(passage);
  if (marker) {
    return {
      denotation: null,
      discardReason: `passage discarded before extraction -- contains answer-declaring phrase "${marker.label}" (answer-key contamination, D-BP150-019 FIX 1a)`,
    };
  }

  const ex = await gemmaExtract(
    `Copy the single sentence in this passage that most directly states what "${term}" means. `
      + 'Copy it exactly as it appears, word for word. Do not summarize. Do not combine sentences. '
      + 'Do not choose between any list of options. Separately, copy the exact word or short phrase '
      + 'this passage uses to name the field, subject, or register this definition belongs to (for '
      + 'example "statistics", "sewing", "physics"), copied exactly as it appears in the passage.',
    passage,
    '{"sentence":"the verbatim defining sentence, or null if none states it",'
      + '"register":"the field/subject name copied verbatim from the passage, or null if the passage does not state one"}',
  );

  const rawSentence = ex && typeof ex.sentence === 'string' ? ex.sentence.trim() : '';
  if (!rawSentence || !appearsIn(passage, rawSentence)) {
    return {
      denotation: null,
      discardReason: rawSentence
        ? 'extracted sentence could not be verified verbatim against the passage it claimed to come from'
        : 'no defining sentence for the term could be extracted from this passage',
    };
  }

  // D-BP150-019 FIX 1(b). The extracted sentence may still reproduce one of THIS question's own
  // options near-verbatim even with no marker phrase anywhere in the passage -- measured case: qid
  // 85 denotation 32, "Bias describes a process that results in a sample that does not represent
  // the population." (homework.study.com), reproduces option A ("It describes a process that
  // results in a sample that does not represent the population.") with only the leading frame and
  // one article differing. See answer_key_guard.ts's isNearVerbatimOptionMatch() for the
  // stripped/normalized substring test and its measured threshold.
  const nearVerbatim = findNearVerbatimOptionMatch(rawSentence, options);
  if (nearVerbatim) {
    return {
      denotation: null,
      discardReason: `extracted sentence discarded -- near-verbatim reproduction of option ${nearVerbatim.letter}'s text ("${nearVerbatim.optionText}") once the leading frame and articles are stripped (answer-key contamination, D-BP150-019 FIX 1b)`,
    };
  }

  const rawRegister = ex && typeof ex.register === 'string' ? ex.register.trim() : '';
  let register: string | null = null;
  let registerWhy: string;
  if (!rawRegister || rawRegister.toLowerCase() === 'null') {
    registerWhy = 'the passage does not itself name a field or register for this definition';
  } else if (!appearsIn(passage, rawRegister)) {
    registerWhy = `extracted register "${rawRegister}" could not be verified verbatim against the passage -- discarded, sentence kept`;
  } else {
    register = rawRegister;
    registerWhy = `stated by the source passage itself, verified verbatim`;
  }

  const aspect = tagAspect(rawSentence);

  return {
    denotation: {
      sentence: rawSentence,
      sourceUrl: block.url,
      sourceTitle: block.title,
      register,
      registerWhy,
      aspect,
      why: `from query "${query}", source ${block.url || '(no url)'}${block.title ? ` ("${block.title}")` : ''}`,
    },
    discardReason: null,
  };
}

/**
 * E-SURVEY-ASK. Enumerates the candidate denotations of `term` -- the ASK's own catalyst word,
 * supplied by the caller (E-CATALYST-WORDS or D2's own extraction), not derived here. Runs
 * unconditionally, before method selection, per canon R-1. Performs I/O (Google + local Gemma)
 * freely: canon R-2 requires `shapeTest()` to stay pure, not this element -- Survey pays the I/O
 * once so every `shapeTest()` downstream can stay a pure function over its output.
 *
 * Returns EVERY verified candidate denotation, unranked, alongside an honest record of every
 * source block that was consulted and discarded. Never picks one. Never eliminates. Never scores.
 */
export async function surveyAsk(term: string, ctx: MethodRunContext, opts: SurveyAskOpts = {}): Promise<SurveyAskResult> {
  const { askGoogle, emit } = ctx;
  const say = (text: string) => emit({ kind: 'header', text, ts: nowIso() });
  const step = (text: string) => emit({ kind: 'stage', text: `-> ${text}`, ts: nowIso() });
  const fact = (text: string) => emit({ kind: 'fact', text: `+ ${text}`, ts: nowIso() });
  const note = (text: string) => emit({ kind: 'note', text, ts: nowIso() });

  const scopeFields = opts.scopeFields ?? [];
  const extraBlockSources = opts.extraBlockSources ?? [];

  say(
    `E-SURVEY-ASK -- enumerate denotations of "${term}" (does NOT pick one)`
      + (scopeFields.length ? `, scoped to ${scopeFields.length} surviving field(s): ${scopeFields.join(', ')}` : ''),
  );

  // D-BP150-018 (B). One scoped query PER surviving field, in addition to the two unscoped
  // queries -- nothing is dropped, nothing is picked. See scopedQuery()'s own header.
  const queries = [defineQuery(term), otherMeaningsQuery(term), ...scopeFields.map((f) => scopedQuery(term, f))];
  const denotations: SurveyDenotation[] = [];
  const discarded: SurveyDiscardedBlock[] = [];
  const reusedSources: string[] = [];
  const seenSentences = new Set<string>();

  /** Shared per-block handling -- used for both freshly-fetched blocks (below) and reused Stage 1
   *  blocks (further below), so a block runs through IDENTICAL extraction/verification/dedup
   *  regardless of which path fetched it. */
  async function handleBlock(block: GoogleBlock, sourceLabel: string): Promise<void> {
    const { denotation, discardReason } = await extractDenotationFromBlock(term, block, sourceLabel, opts.options);
    if (!denotation) {
      discarded.push({
        query: sourceLabel,
        sourceUrl: block.url,
        sourceTitle: block.title,
        why: discardReason ?? 'discarded, no reason recorded',
      });
      note(`      discarded [${block.url || '(no url)'}]: ${discardReason}`);
      return;
    }
    const key = norm(denotation.sentence);
    if (seenSentences.has(key)) {
      note(`      duplicate of an already-recorded denotation, not added again: "${denotation.sentence}"`);
      return;
    }
    seenSentences.add(key);
    denotations.push(denotation);
    fact(
      `denotation [${denotation.aspect.aspect}${denotation.register ? `, register: ${denotation.register}` : ', register: unstated'}]: `
        + `"${denotation.sentence}"`,
    );
  }

  for (const q of queries) {
    step(`survey query -- ${q}`);
    note(`   ${q}`);
    const res = await googleBlocks(askGoogle, q);
    if (!res.ok) {
      note(`   no answer (${res.via})`);
      continue;
    }
    fact(`Google [${res.via}]: ${res.blocks.length} block(s) returned for "${q}"`);

    // eslint-disable-next-line no-await-in-loop -- one Gemma call per block, sequential by design
    for (const block of res.blocks) await handleBlock(block, q);
  }

  // D-BP150-018 (C). STOP THROWING AWAY STAGE 1'S HAUL: blocks a caller already fetched for its
  // own purpose (Stage 1's inverse-question query, comparative_cascade.ts) are pushed through the
  // exact same handleBlock() pipeline above -- same extraction prompt, same appearsIn()
  // verification, same dedup against denotations already found -- at zero additional Google cost.
  // Recorded separately in `reusedSources`, NOT in `queries`, because no new Google call happened.
  for (const { query: sourceLabel, blocks } of extraBlockSources) {
    step(`survey reused source -- ${sourceLabel} (already fetched, no new Google call)`);
    reusedSources.push(sourceLabel);
    // eslint-disable-next-line no-await-in-loop -- one Gemma call per block, sequential by design
    for (const block of blocks) await handleBlock(block, sourceLabel);
  }

  const totalSourceCount = queries.length + reusedSources.length;
  const why = denotations.length
    ? `${denotations.length} distinct denotation(s) found across ${queries.length} Google quer(y/ies)`
      + `${reusedSources.length ? ` + ${reusedSources.length} reused source(s)` : ''} and `
      + `${discarded.length} discarded source block(s). NOT resolved to one -- comparing these against `
      + 'the ANSWERS is E-MATCH-UP, which canon marks UNSOLVED; that comparison does not happen here.'
    : `no verifiable denotation found for "${term}" across ${totalSourceCount} source(s) `
      + `(${discarded.length} source block(s) consulted and discarded) -- an honest empty result, not a fabrication`;

  note(`   ${why}`);
  emit({ kind: 'result', text: `SURVEY (${term}): ${denotations.length} denotation(s), ${discarded.length} discarded`, ts: nowIso() });

  return { term, queries, denotations, discarded, reusedSources, why };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// D-BP150-014 -- THE NEST FORM. Ratified canon: canon_the_nest_method_bp150.eblet.md.
// ─────────────────────────────────────────────────────────────────────────────────────────────

export interface SurveyNestLevelResult {
  /** buildNest()'s own level object (elements/nest.ts), unmodified. */
  level: NestLevel;
  /** The term actually sent to surveyAsk() for this level -- may differ from `level.text` when the
   *  resolved frame's name was carried down into it. See surveyAskNested()'s own header note. */
  surveyedTerm: string;
  survey: SurveyAskResult;
}

export interface SurveyAskNestedResult {
  input: string;
  /** buildNest()'s own result (elements/nest.ts), unmodified -- not reproduced or re-derived. */
  nest: NestResult;
  /** One entry per nest level, OUTERMOST FIRST, per canon. For a depth-1 nest (buildNest() found no
   *  frame/part split, or REFUSED) this has exactly one entry -- the special case canon names:
   *  "depth-1 ... is a special case of the nest with depth 1." */
  levels: SurveyNestLevelResult[];
  /** True when buildNest() refused decomposition (elements/nest.ts, D-BP150-012 FIX 3) -- mirrors
   *  NestResult.refused so a caller does not have to reach into `nest` to check it. */
  refused: boolean;
  /** Always present -- the top-line honest summary for the transcript. */
  why: string;
}

/**
 * E-SURVEY-ASK, THE NEST FORM. Decomposes `phrase` via buildNest() (elements/nest.ts, NOT
 * re-derived here) and surveys each level OUTERMOST FIRST, exactly the order canon specifies:
 * "1. The outer frame first ... 2. Each part, inside that frame ... 3. Check the construct is real
 * ... 4. Then the whole phrase" (canon_the_nest_method_bp150).
 *
 * CARRYING THE FRAME'S SENSE DOWN: once the framework level has been surveyed, its own resolved
 * NAME (e.g. "Critical Security Studies") -- never a CHOSEN denotation, since Survey never chooses
 * one (that is E-MATCH-UP, UNSOLVED) -- is appended as context ("<level text> in <frame>") to the
 * term surveyed for every level below it. This is the mechanical form of "carrying the resolved
 * frame's sense ... into the levels below it" that stays inside what Survey is allowed to do: it
 * carries forward a FACT the phrase itself states (the frame is named X), never a JUDGMENT (X
 * means this one thing here).
 *
 * The single-term entry point (`surveyAsk` above) is UNCHANGED and remains the function to call
 * for a bare term. This function is the general case: when buildNest() finds no frame and no
 * "X of Y" split (the common case for a short definitional ask like qid 85's "bias"), it produces
 * exactly one level whose surveyed term equals the input, and the result is substantively the same
 * as calling `surveyAsk()` directly. When buildNest() REFUSES (its own structural gate,
 * D-BP150-012 FIX 3 -- a multi-sentence, over-length, or lettered-option input), `nest.levels` is
 * already a single whole-phrase level per that function's own contract, and this function surveys
 * that one level and reports the refusal in `why` -- "survey the whole phrase as one level and say
 * so", per this ticket's own instruction.
 */
export async function surveyAskNested(phrase: string, ctx: MethodRunContext): Promise<SurveyAskNestedResult> {
  const { emit } = ctx;
  const say = (text: string) => emit({ kind: 'header', text, ts: nowIso() });
  const note = (text: string) => emit({ kind: 'note', text, ts: nowIso() });

  const nest = buildNest(phrase);
  say(`E-SURVEY-ASK (NEST FORM) -- ${nest.levels.length} level(s): ${nest.levels.map((l) => l.label).join(' -> ')}${nest.refused ? ' [buildNest REFUSED decomposition]' : ''}`);
  if (nest.refused) {
    note(`   ${nest.why}`);
  }

  const levels: SurveyNestLevelResult[] = [];
  let frameName: string | null = null;

  for (const lvl of nest.levels) {
    const surveyedTerm = (lvl.label !== 'framework' && frameName)
      ? `${lvl.text} in ${frameName}`
      : lvl.text;
    note(`   LEVEL [${lvl.label}] "${lvl.text}"${surveyedTerm !== lvl.text ? ` -- surveyed as "${surveyedTerm}" (frame carried down)` : ''}`);
    note(`      ${lvl.why}`);
    // eslint-disable-next-line no-await-in-loop -- levels are dependency-ordered, outermost first,
    // and each inner level's query depends on whether the outer one resolved a frame name; they
    // cannot run concurrently.
    const survey = await surveyAsk(surveyedTerm, ctx);
    levels.push({ level: lvl, surveyedTerm, survey });
    if (lvl.label === 'framework') {
      frameName = lvl.text;
    }
  }

  const why = nest.refused
    ? `buildNest() refused decomposition (${nest.why}) -- surveyed the whole phrase as a single level, per this element's own instruction to do so and say so`
    : `${levels.length} level(s) surveyed outermost-first: ${levels.map((l) => `${l.level.label}="${l.surveyedTerm}" (${l.survey.denotations.length} denotation(s))`).join('; ')}`;
  emit({ kind: 'result', text: `SURVEY-NEST: ${levels.length} level(s) surveyed`, ts: nowIso() });

  return { input: phrase, nest, levels, refused: nest.refused, why };
}
