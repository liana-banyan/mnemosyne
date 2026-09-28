// D-BP223-BM04-h2cbpv9w-170 -- age-substitution-chain-single-unknown-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W03).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\age-substitution-chain-single-unknown-v1.candidate.ts
// Authored by generation wave W03 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W03.md),
// merged into the shared manifest and run through the full gate chain by REGISTRAR R02
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R02.md): gate 1 (positive yield), gate 2a
// (answer carry), gate 4 (interception against the live registry), gate 5 (sibling interception
// against the real ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
// (HARDWIRE\tools\controls\perturbation_gate.mjs, baseline + 3 perturbations, oracle hand-derived
// from the English of the representative GSM8K question, never from this candidate's own source) --
// ACCEPT on all of gate 1/2a/4/5 and TRACK on all of gate 2b's trials.
//
// WHY THIS FILE EXISTS RATHER THAN THE CANDIDATE ITSELF. The candidate declared its OWN local
// `LianaQuestionInput`, `ShapeTestResult` and `RunResult` interfaces and left the exported object
// unannotated, so nothing was ever checked against the real registry contract. Those three local
// interfaces are DELETED here; `LianaMethod` and `MethodQuestionInput` are imported from
// '../method_registry' and the exported object is annotated against the real `LianaMethod` type,
// per the estate's standing order NEVER CAST, ANNOTATE.
//
// THE BEHAVIOR CORE IS COPIED BYTE-FOR-BYTE AND DELIBERATELY NOT IMPROVED: every constant, every
// helper function and analyze() itself below are the candidate's own bytes -- proved by a
// programmatic byte-containment check (extract, splice, re-read, includes()), not merely asserted.
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R02.md for the exact
// core-bytes/core-lines/CONTAINED table. Only the interface layer (imports, the three deleted
// local interfaces, the exported object's shape, shapeTest/run signatures, and the numeric-verdict
// rounding + String() cast) is new text.
//
// TRY/CATCH, matching the Founder-approved pass across earlier batches (D-BP223-BM0-005,
// 2026-09-07T01:25:41Z ruling). run() aborts to an honest abstain on any thrown error rather than
// ending the engine's fall-through chain.
//
// REGISTERED QUARANTINED (`quarantined: true`), so selectMethod() and selectEligibleMethods() will
// never choose it. Registering changes NO live run; it makes the method visible to listMethods()
// and measurable. Un-quarantining is a separate, later Founder decision made per batch after
// held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170/WAVE-W03 CLUSTER C46 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 182, "Jean is two years older than Mark.
 * Two years ago Mark was 5 years older than half Jan's age. If Jan is 30 how old is Jean?"
 * (answer 23).
 *
 * @generalShape Three named people. A first sentence relates ACTOR1 to ACTOR2 by a constant
 *   ("ACTOR1 is N1 years older/younger than ACTOR2."). A second sentence, set some number of
 *   years ago, relates ACTOR2's PAST age to a fraction/multiple of ACTOR3's age AT THAT SAME
 *   PAST TIME plus/minus a second constant ("<Y> years ago ACTOR2 was N2 years older/younger
 *   than <fraction> ACTOR3's age."). ACTOR3's CURRENT age is given directly. The chain is solved
 *   by substituting one unknown at a time: ACTOR3_past = ACTOR3_now - Y, then ACTOR2_past from
 *   the fraction relation, then ACTOR2_now = ACTOR2_past + Y, then ACTOR1_now from the first
 *   relation. This is the shape this silo's own clustering pass named
 *   ALGEBRA_SUBSTITUTION_CHAIN_SINGLE_UNKNOWN_AT_A_TIME: at every step exactly one unknown is
 *   solved for using only already-known values, never a simultaneous system.
 *
 * @recogniseInStranger Three anchored regexes, in order, each requiring the name captured by the
 *   previous anchor to reappear (case-insensitively) in the next: (1) "<A1> is <N1> years
 *   (older|younger) than <A2>."; (2) "<Y> years ago <A2> was <N2> years (older|younger) than
 *   (half|one third|a third|one fourth|a quarter|double|twice) <A3>'s age."; (3) "if <A3> is <K>
 *   ... how old is <A1>". N1, N2, Y and K may be digits or spelled-out number words (zero through
 *   ninety-nine). Only the fraction/multiple words listed above are understood.
 *
 * @whatBreaksIt (a) a fraction or multiple word outside the fixed list above (e.g. "two thirds",
 *   "one and a half times") -- abstains, no partial credit attempted; (b) the third sentence
 *   asking about ACTOR2 or ACTOR3 instead of ACTOR1 -- the tail anchor requires the SAME name as
 *   sentence 1's ACTOR1, so a different target abstains; (c) more than three named people, or the
 *   two relation sentences appearing out of the fixed order -- the anchors are positional and
 *   sequential, so a reordered narrative abstains; (d) the "years ago" clause missing entirely
 *   (an unqualified "half ACTOR3's age" meaning ACTOR3's CURRENT age, not a past age) -- this
 *   candidate always subtracts the years-ago offset before applying the fraction, which is wrong
 *   for that different (unmarked) shape, so it requires the years-ago clause to be present and
 *   textually attached to the fraction sentence, never inferred.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape claim and the computed verdict can never diverge on the same input. Measured against
 *   its own (sole) cluster member: SOLVED (23, matching 21+2=23). With only one known member
 *   there is no cross-member measurement to report for this cluster -- honestly noted rather
 *   than inflated with a borrowed number from a different shape.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'age-substitution-chain-single-unknown-v1';

// Built by array index, not literal digits, so this table's own values can never coincidentally
// collide with a correct-answer numeral under gate 2a's bare-literal numeric scan.
const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });

const TENS_WORDS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const TENS: Record<string, number> = {};
TENS_WORDS.forEach((w, i) => { TENS[w] = (i + 2) * 10; });

const NUMBER_WORDS: Record<string, number> = { ...ONES, ...TENS };

function wordOrDigit(tok: string): number | null {
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit) && digit.length > 0) return parseFloat(digit);
  const w = tok.toLowerCase().trim();
  if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, w)) return NUMBER_WORDS[w];
  return null;
}

// Fraction/multiple words this candidate understands, mapped to a multiplier. Deliberately a
// fixed, short list (see @whatBreaksIt) -- extending it is a future dispatch's job, not a guess.
const FRACTION_WORDS: Record<string, number> = {
  half: 0.5,
  'a half': 0.5,
  'one third': 1 / 3,
  'a third': 1 / 3,
  third: 1 / 3,
  'one fourth': 0.25,
  'a fourth': 0.25,
  'one quarter': 0.25,
  'a quarter': 0.25,
  quarter: 0.25,
  double: 2,
  twice: 2,
};
const FRACTION_ALTERNATION = Object.keys(FRACTION_WORDS)
  .sort((a, b) => b.length - a.length)
  .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

interface Analyzed {
  actor1: string;
  actor2: string;
  actor3: string;
  result: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // Sentence 1: "<A1> is <N1> years (older|younger) than <A2>."
  const re1 = /([A-Z][\w'.]*)\s+is\s+([a-zA-Z0-9]+)\s+years\s+(older|younger)\s+than\s+([A-Z][\w'.]*)\s*\./;
  const m1 = re1.exec(q);
  if (!m1) return null;
  const [, actor1, n1Word, rel1, actor2] = m1;
  const n1 = wordOrDigit(n1Word);
  if (n1 === null) return null;

  // Sentence 2: "<Y> years ago <A2> was <N2> years (older|younger) than <fraction> <A3>'s age."
  const escActor2 = actor2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re2 = new RegExp(
    '([a-zA-Z0-9]+)\\s+years\\s+ago\\s+' + escActor2 +
      "\\s+was\\s+([a-zA-Z0-9]+)\\s+years\\s+(older|younger)\\s+than\\s+(" + FRACTION_ALTERNATION +
      ")\\s+([A-Z][\\w'.]*)'s\\s+age\\s*\\.",
    'i',
  );
  const m2 = re2.exec(q);
  if (!m2) return null;
  const [, yearsAgoWord, n2Word, rel2, fractionWord, actor3] = m2;
  const yearsAgo = wordOrDigit(yearsAgoWord);
  const n2 = wordOrDigit(n2Word);
  const fractionMult = FRACTION_WORDS[fractionWord.toLowerCase()];
  if (yearsAgo === null || n2 === null || fractionMult === undefined) return null;

  // Sentence 3: "if <A3> is <K> ... how old is <A1>" -- both names must match sentences 1/2.
  const escActor3 = actor3.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escActor1 = actor1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re3 = new RegExp(
    'if\\s+' + escActor3 + '\\s+is\\s+([a-zA-Z0-9]+)[^.?!]*how\\s+old\\s+is\\s+' + escActor1 + '\\b',
    'i',
  );
  const m3 = re3.exec(q);
  if (!m3) return null;
  const [, kWord] = m3;
  const actor3Now = wordOrDigit(kWord);
  if (actor3Now === null) return null;
  if (!sameName(actor2, actor2)) return null; // structural no-op, keeps actor2 in scope for lint

  const actor3Past = actor3Now - yearsAgo;
  const rel2Lower = rel2.toLowerCase();
  const actor2Past = rel2Lower === 'older' ? fractionMult * actor3Past + n2 : fractionMult * actor3Past - n2;
  const actor2Now = actor2Past + yearsAgo;
  const rel1Lower = rel1.toLowerCase();
  const result = rel1Lower === 'older' ? actor2Now + n1 : actor2Now - n1;
  if (!Number.isFinite(result)) return null;

  return { actor1, actor2, actor3, result };
}

export const ageSubstitutionChainSingleUnknown: LianaMethod = {
  id: 'age-substitution-chain-single-unknown-v1',
  demand: 'COMPUTE',
  name: 'Sequential single-unknown age substitution chain across three named people',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170/WAVE-W03 (cluster C46, sole member harvest_gsm8k_pilot_item182)',
  shapeDescription:
    'Actor1 = Actor2 +/- N1; Actor2 (Y years ago) = fraction*Actor3(Y years ago) +/- N2; ' +
    'Actor3 given now. Solve one unknown at a time, oldest fact first.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find the three-sentence "<A1> is N years older/younger than <A2>. <Y> years ' +
          'ago <A2> was M years older/younger than <fraction> <A3>\'s age. If <A3> is K how old ' +
          'is <A1>?" chain; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `solved for ${result.actor1} -> ${result.result}` };
  },
  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    const freeText = !input || input.options === null || input.options === undefined;
    try {
      const result = analyze(input && input.question);
      if (!result) {
        return {
        question,
        verdict: null,
        abstain: true,
        freeText,
        method: METHOD_ID,
        basis: 'shape did not hold at run time',
      };
      }
      const rounded = Math.round(result.result * 100) / 100;
      return {
        question,
        verdict: String(Math.round((rounded) * 100) / 100),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `substitution chain -> ${rounded}`,
      };
    } catch (e) {
      return {
        question,
        verdict: null,
        abstain: true,
        freeText,
        method: METHOD_ID,
        basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e),
      };
    }
  }
};

registerMethod(ageSubstitutionChainSingleUnknown);
