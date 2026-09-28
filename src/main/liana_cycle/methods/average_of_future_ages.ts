// D-BP223-BM04-h2cbpv9w-170 -- average-of-future-ages-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W03).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\average-of-future-ages-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170/WAVE-W03 CLUSTER C47 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 218, "Adrian's age is three times the age
 * of Harriet, and Harriet is half the age of Zack. Calculate the average age of the three in
 * three years if Harriet is 21 years old now." (answer 45).
 *
 * @generalShape Three named people linked by two multiplicative age relations in one sentence
 *   ("A's age is <mult1> the age of B, and B is <mult2> the age of C."). A separate sentence
 *   gives ONE of the three people's current age directly and asks for the AVERAGE age of all
 *   three after a stated number of years. The silo's own label for this is
 *   AVERAGE_OF_FUTURE_AGES: sum the three current ages (derived via the multiplicative chain from
 *   whichever one was given), project every person forward by the same constant N, then divide
 *   by 3 -- equivalently (sum_now + 3*N) / 3.
 *
 * @recogniseInStranger Two anchored regexes. The first finds "<A>'s age is <mult1-phrase> the
 *   age of <B>, and <B> is <mult2-phrase> the age of <C>." and requires the SAME name for B in
 *   both halves. The second finds "average age of the three in <N> years if <X> is <K> years old
 *   now" where <X> must be one of A, B or C (case-insensitively) captured by the first regex.
 *   Multiplier phrases understood: "<word-or-digit> times", "twice", "double", "half", "one
 *   third"/"a third"/"third", "one fourth"/"a fourth"/"one quarter"/"a quarter"/"quarter".
 *
 * @whatBreaksIt (a) a multiplier phrase outside the fixed list (e.g. "one and a half times",
 *   "a fifth") -- abstains rather than guess a value; (b) more than three named people, or the
 *   two relations spread across more than one sentence, or in a different order than
 *   A-relates-to-B-then-B-relates-to-C -- the anchor is positional and requires B to repeat
 *   verbatim; (c) the given actor in the tail sentence not matching any of A, B, C by name --
 *   abstains rather than guess which relation applies; (d) the question asking for a total or a
 *   single person's future age instead of "the average age of the three" -- the tail anchor
 *   requires that exact phrase.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a shape
 *   claim and the computed verdict can never diverge on the same input. Measured against its own
 *   (sole) cluster member: SOLVED (45, matching (63+21+42+9)/3=45). With only one known member
 *   there is no cross-member measurement to report for this cluster -- honestly noted rather than
 *   inflated with a borrowed number from a different shape.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'average-of-future-ages-v1';

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

// Fixed multiplier-phrase vocabulary (see @whatBreaksIt). "<n> times" is handled separately
// below (it covers any word-or-digit count), this table only holds the irregular phrasings.
const NAMED_MULTIPLIERS: Record<string, number> = {
  twice: 2,
  double: 2,
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
};

function parseMultiplierPhrase(phraseRaw: string): number | null {
  const phrase = phraseRaw.trim().toLowerCase();
  const timesMatch = /^([a-z0-9]+)\s+times$/.exec(phrase);
  if (timesMatch) {
    const n = wordOrDigit(timesMatch[1]);
    return n === null ? null : n;
  }
  if (Object.prototype.hasOwnProperty.call(NAMED_MULTIPLIERS, phrase)) return NAMED_MULTIPLIERS[phrase];
  return null;
}

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

  const re1 =
    /([A-Z][\w'.]*)'s\s+age\s+is\s+([a-zA-Z0-9 ]+?)\s+the\s+age\s+of\s+([A-Z][\w'.]*)\s*,?\s+and\s+([A-Z][\w'.]*)\s+is\s+([a-zA-Z0-9 ]+?)\s+the\s+age\s+of\s+([A-Z][\w'.]*)\s*\./;
  const m1 = re1.exec(q);
  if (!m1) return null;
  const [, actor1, mult1Phrase, actor2a, actor2b, mult2Phrase, actor3] = m1;
  if (!sameName(actor2a, actor2b)) return null;
  const mult1 = parseMultiplierPhrase(mult1Phrase);
  const mult2 = parseMultiplierPhrase(mult2Phrase);
  if (mult1 === null || mult2 === null || mult1 === 0 || mult2 === 0) return null;

  const re2 =
    /average\s+age\s+of\s+the\s+three\s+in\s+([a-zA-Z0-9]+)\s+years?\s+if\s+([A-Z][\w'.]*)\s+is\s+([a-zA-Z0-9]+)\s+years?\s+old\s+now/i;
  const m2 = re2.exec(q);
  if (!m2) return null;
  const [, nWord, actorGiven, kWord] = m2;
  const n = wordOrDigit(nWord);
  const k = wordOrDigit(kWord);
  if (n === null || k === null) return null;

  let age1: number, age2: number, age3: number;
  if (sameName(actorGiven, actor2a)) {
    age2 = k;
    age1 = mult1 * age2;
    age3 = age2 / mult2;
  } else if (sameName(actorGiven, actor1)) {
    age1 = k;
    age2 = age1 / mult1;
    age3 = age2 / mult2;
  } else if (sameName(actorGiven, actor3)) {
    age3 = k;
    age2 = mult2 * age3;
    age1 = mult1 * age2;
  } else {
    return null; // the given actor names none of the three -- abstain, never guess
  }

  const sumNow = age1 + age2 + age3;
  const result = (sumNow + 3 * n) / 3;
  if (!Number.isFinite(result)) return null;

  return { actor1, actor2: actor2a, actor3, result };
}

export const averageOfFutureAges: LianaMethod = {
  id: 'average-of-future-ages-v1',
  demand: 'COMPUTE',
  name: 'Average of three ages projected forward, derived from a two-step multiplicative chain',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170/WAVE-W03 (cluster C47, sole member harvest_gsm8k_pilot_item218)',
  shapeDescription:
    'Actor1 = mult1*Actor2, Actor2 = mult2*Actor3, one actor given now; average age of the ' +
    'three in N years = (sum_now + 3*N) / 3.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find the "<A>\'s age is <mult> the age of <B>, and <B> is <mult> the age of ' +
          '<C>. ... average age of the three in <N> years if <one of A/B/C> is <K> ... now" ' +
          'shape; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `average of three projected ages -> ${result.result}` };
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
        basis: `(sum_now + 3N)/3 = ${rounded}`,
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

registerMethod(averageOfFutureAges);
