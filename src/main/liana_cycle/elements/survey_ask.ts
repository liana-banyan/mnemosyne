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
  /** Every query actually sent, verbatim, in order. */
  queries: string[];
  /** Distinct candidate denotations found. Deliberately UNRANKED -- see this file's header. */
  denotations: SurveyDenotation[];
  discarded: SurveyDiscardedBlock[];
  /** Always present -- the top-line honest summary for the transcript. */
  why: string;
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
): Promise<{ denotation: SurveyDenotation | null; discardReason: string | null }> {
  const passage = [block.title, block.body].filter(Boolean).join(' -- ');
  if (!passage.trim()) {
    return { denotation: null, discardReason: 'block carried no text (title and body both empty)' };
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
export async function surveyAsk(term: string, ctx: MethodRunContext): Promise<SurveyAskResult> {
  const { askGoogle, emit } = ctx;
  const say = (text: string) => emit({ kind: 'header', text, ts: nowIso() });
  const step = (text: string) => emit({ kind: 'stage', text: `-> ${text}`, ts: nowIso() });
  const fact = (text: string) => emit({ kind: 'fact', text: `+ ${text}`, ts: nowIso() });
  const note = (text: string) => emit({ kind: 'note', text, ts: nowIso() });

  say(`E-SURVEY-ASK -- enumerate denotations of "${term}" (does NOT pick one)`);

  const queries = [defineQuery(term), otherMeaningsQuery(term)];
  const denotations: SurveyDenotation[] = [];
  const discarded: SurveyDiscardedBlock[] = [];
  const seenSentences = new Set<string>();

  for (const q of queries) {
    step(`survey query -- ${q}`);
    note(`   ${q}`);
    const res = await googleBlocks(askGoogle, q);
    if (!res.ok) {
      note(`   no answer (${res.via})`);
      continue;
    }
    fact(`Google [${res.via}]: ${res.blocks.length} block(s) returned for "${q}"`);

    for (const block of res.blocks) {
      const { denotation, discardReason } = await extractDenotationFromBlock(term, block, q);
      if (!denotation) {
        discarded.push({
          query: q,
          sourceUrl: block.url,
          sourceTitle: block.title,
          why: discardReason ?? 'discarded, no reason recorded',
        });
        note(`      discarded [${block.url || '(no url)'}]: ${discardReason}`);
        continue;
      }
      const key = norm(denotation.sentence);
      if (seenSentences.has(key)) {
        note(`      duplicate of an already-recorded denotation, not added again: "${denotation.sentence}"`);
        continue;
      }
      seenSentences.add(key);
      denotations.push(denotation);
      fact(
        `denotation [${denotation.aspect.aspect}${denotation.register ? `, register: ${denotation.register}` : ', register: unstated'}]: `
          + `"${denotation.sentence}"`,
      );
    }
  }

  const why = denotations.length
    ? `${denotations.length} distinct denotation(s) found across ${queries.length} quer(y/ies) and `
      + `${discarded.length} discarded source block(s). NOT resolved to one -- comparing these against `
      + 'the ANSWERS is E-MATCH-UP, which canon marks UNSOLVED; that comparison does not happen here.'
    : `no verifiable denotation found for "${term}" across ${queries.length} quer(y/ies) `
      + `(${discarded.length} source block(s) consulted and discarded) -- an honest empty result, not a fabrication`;

  note(`   ${why}`);
  emit({ kind: 'result', text: `SURVEY (${term}): ${denotations.length} denotation(s), ${discarded.length} discarded`, ts: nowIso() });

  return { term, queries, denotations, discarded, why };
}
