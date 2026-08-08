// definitional_cascade.ts -- D-BP149-041/BISHOP/S41/seg-methodregistry
//
// METHOD 2 of the Liana Cycle method registry: THE DEFINITIONAL CASCADE. Shape: the question
// turns on what a term MEANS, and the options are competing statements of that meaning.
// Taught by the Founder's qid 85 walkthrough (bias), `FounderCascadeWorkedByHand.txt` Excerpt
// 7 -- he never orders anything for that question. He categorizes the options by shared
// predicate, looks up the definition of the term, establishes the REGISTER (statistics, not
// sewing, not K-pop), reduces the definition to its core sense, and matches on sense rather
// than tokens. Rules 12, 13 and 11 of his fourteen.
//
// THIS IS A DELIBERATE STUB. Ticket instruction, verbatim: "REGISTER IT AS A STUB, DO NOT
// IMPLEMENT IT... This is deliberate: it is the next thing the Founder will teach, and the
// registry must be able to hold a known-but-unimplemented method." `run: null` below is what
// makes that possible -- see method_registry.ts's LianaMethod.run doc comment. The shapeTest
// below is real (it is what lets the terminal say "this is a recognized shape, not yet taught"
// instead of the less honest "no method matches" for a question like qid 85), but no stage,
// no Google call, and no Gemma call exists here. When the Founder walks a definitional
// question by hand, THAT session is what fills in `run`.

import { avgOptionWordCount, registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput, ShapeTestResult } from '../method_registry';

// Calibrated against the six real BP149 questions in the canon comparison table: qid 85's ten
// options average ~11 words each and nine of ten literally begin "It describes..." -- a set of
// competing statements of what a term means, not short members of one category (contrast qid
// 98's region names, avg ~2 words). MIN_AVG_OPTION_WORDS mirrors comparative_cascade.ts's own
// MAX_AVG_OPTION_WORDS_FOR_RANKING (6) from the opposite side, so a question in the gap between
// the two (qid 92's referent-object question, avg ~3.3 words, no definitional cue) matches
// neither method and correctly falls through to "no method matches, ask the human."
const MIN_AVG_OPTION_WORDS_FOR_DEFINITIONS = 5;

const DEFINITIONAL_CUE_RE = /\b(correctly (explains|describes|defines)|best (explains|describes|defines)|which of the following statements|refers to|is defined as|means)\b/i;

function shapeTest(input: MethodQuestionInput): ShapeTestResult {
  if (!input.options || Object.keys(input.options).length < 2) {
    return { matches: false, reason: 'no option pool of competing statements to match on sense' };
  }
  if (!DEFINITIONAL_CUE_RE.test(input.question)) {
    return { matches: false, reason: 'question does not ask what a term means or which statement correctly explains/defines it' };
  }
  const avgWords = avgOptionWordCount(input.options);
  if (avgWords < MIN_AVG_OPTION_WORDS_FOR_DEFINITIONS) {
    return {
      matches: false,
      reason: `options are too short (avg ${avgWords.toFixed(1)} words, < ${MIN_AVG_OPTION_WORDS_FOR_DEFINITIONS}) to be competing statements of a definition`,
    };
  }
  return {
    matches: true,
    reason: `question asks what a term means and options are full competing statements (avg ${avgWords.toFixed(1)} words) -- shape recognized, method not yet taught`,
  };
}

export const definitionalCascadeMethod: LianaMethod = {
  id: 'definitional-cascade',
  name: 'The Definitional Cascade',
  taughtBy: "the Founder's qid 85 walkthrough (bias), FounderCascadeWorkedByHand.txt Excerpt 7 -- NOT YET IMPLEMENTED, this is a registered stub awaiting the Founder's next hand-worked teaching session",
  shapeDescription: 'the question turns on what a term means and the options are competing statements of that meaning',
  shapeTest,
  run: null,
};

registerMethod(definitionalCascadeMethod);
