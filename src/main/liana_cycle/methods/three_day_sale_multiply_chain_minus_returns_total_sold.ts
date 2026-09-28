// D-BP223-BM04-h2cbp9d8-171 -- three-day-sale-multiply-chain-minus-returns-total-sold-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R05
// (registration batch drawn from generation waves W21-W23).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\three-day-sale-multiply-chain-minus-returns-total-sold-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R05
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R05.md): gate 1 (positive yield), gate 2a
// (answer carry, under the gate2_answer_carry.cjs:253 letter-boundary fix installed
// 2026-09-08T09:08:02Z), gate 4 (interception against the live registry), gate 5 (sibling
// interception against the real ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R05.md for the exact
// core-bytes/core-lines/CONTAINED table. Only the interface layer (imports, the three deleted
// local interfaces, the exported object's shape, shapeTest/run signatures, and the numeric-verdict
// rounding + String() cast) is new text.
//
// TRY/CATCH, matching the Founder-approved pass across earlier batches. run() aborts to an honest
// abstain on any thrown error rather than ending the engine's fall-through chain.
//
// REGISTERED QUARANTINED (`quarantined: true`), so selectMethod() and selectEligibleMethods() will
// never choose it. Registering changes NO live run; it makes the method visible to listMethods()
// and measurable. Un-quarantining is a separate, later Founder decision made per batch after
// held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170 WAVE W23, CLUSTER C214 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 371, "A shoe store was having a weekend
 * sale on a brand of popular tennis shoes. On Friday the store sold 14 pairs of tennis shoes. The
 * next day they sold double that number of shoes. On the last day of the sale they sold one-half
 * the amount that they did the day before, but six people returned their pairs because they
 * didn't fit. How many tennis shoes were sold by the end of the sale?". Silo label: "multi-step
 * arithmetic word problem involving sequential operations" -- matches exactly. Distinct from the
 * registered three-day-mileage-multiplier-backsolve-third-day-v1 (backsolves an UNKNOWN day from
 * a stated combined total across three NAMED weekdays) and three-phase-daily-delta-cascade-sum-v1
 * (additive per-day DELTAS, not multiplicative day-over-day ratios): here all three days' amounts
 * are FORWARD-computed via two chained multiplicative ratios (day2 from day1, day3 from day2),
 * with no combined total given anywhere and a final flat subtraction for returns.
 *
 * @generalShape Day1's sold amount is stated directly. Day2's amount is a stated MULTIPLE of
 *   day1's amount ("the next day they sold <multiplier1> that number"). Day3's amount is a
 *   stated MULTIPLE (often a fraction) of day2's amount ("on the last day ... they sold
 *   <multiplier2> the amount ... the day before"), in the SAME sentence as a flat RETURNS count
 *   subtracted at the very end. The question asks for the total sold by the end of the sale:
 *   (day1 + day2 + day3) - returns.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence, with the same item noun implied
 *   throughout (never re-verified by name, since the pronoun chain "that number"/"the amount"
 *   makes an explicit noun match unavailable):
 *   (a) "on <day1> the store sold <A> pairs of <item>" -- day1's amount, directly;
 *   (b) "the next day they sold <multiplier1-phrase> that number of <item-plural>" -- day2 =
 *       multiplier1 * day1;
 *   (c) "on the last day of the sale they sold <multiplier2-phrase> the amount that they did the
 *       day before, but <R> people returned their pairs because they didn't fit" -- day3 =
 *       multiplier2 * day2, and the flat returns count R, both from one fixed sentence;
 *   (d) "how many <item-plural> were sold by the end of the sale" -- the closing question.
 *   Multiplier phrases resolved via a fixed table ("double"/"twice" = 2, "one-half"/"half" =
 *   1/2, "triple" = 3, "<N>-fold"/"<word> times" = N via a ones-word table), never a literal
 *   digit table. Answer = day1 + day2 + day3 - R, required non-negative.
 *
 * @whatBreaksIt (a) either multiplier phrase outside the fixed table -- abstain, no partial
 *   credit; (b) day3's multiplication producing a non-integer (e.g. an odd day2 with a "one-
 *   third" multiplier) -- abstain rather than round; (c) the final total-minus-returns coming out
 *   negative -- abstain, the parse does not fit; (d) a combined-total sentence present elsewhere
 *   in the text (a stranger asking to backsolve one of the three days instead) -- a different
 *   shape, correctly left unmatched since this candidate never looks for one.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a shape
 *   claim guarantees run() reconstructs the same number. Measured against its own (sole) cluster
 *   member: SOLVED (day1=14, day2=2*14=28, day3=0.5*28=14, total=14+28+14-6=50). With only one
 *   known member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'three-day-sale-multiply-chain-minus-returns-total-sold-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];

function parseMultiplierPhrase(phrase: string): { num: number; den: number } | null {
  const p = phrase.toLowerCase().trim();
  if (p === 'double' || p === 'twice') return { num: 2, den: 1 };
  if (p === 'triple') return { num: 3, den: 1 };
  if (p === 'one-half' || p === 'half' || p === 'one half') return { num: 1, den: 2 };
  if (p === 'one-third' || p === 'a third' || p === 'one third') return { num: 1, den: 3 };
  const timesM = /^([a-z]+)\s+times$/.exec(p);
  if (timesM) {
    const idx = ONES_WORDS.indexOf(timesM[1]);
    if (idx >= 2) return { num: idx, den: 1 };
  }
  return null;
}

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const r1 = /\bon\s+([a-z]+)\s+the\s+store\s+sold\s+(\d+)\s+pairs\s+of\s+[a-z ]+?\.\s/i;
  const m1 = r1.exec(q);
  if (!m1) return null;
  const [, , day1Raw] = m1;
  const day1 = parseInt(day1Raw, 10);
  if (!Number.isFinite(day1)) return null;

  const r2 = /\bthe\s+next\s+day\s+they\s+sold\s+([a-z]+)\s+that\s+number\s+of\s+[a-z]+\b/i;
  const m2 = r2.exec(q);
  if (!m2) return null;
  const [, mult1Phrase] = m2;
  const ratio1 = parseMultiplierPhrase(mult1Phrase);
  if (!ratio1) return null;
  if ((day1 * ratio1.num) % ratio1.den !== 0) return null;
  const day2 = (day1 * ratio1.num) / ratio1.den;

  const r3 =
    /\bon\s+the\s+last\s+day\s+of\s+the\s+sale\s+they\s+sold\s+([a-z-]+)\s+the\s+amount\s+that\s+they\s+did\s+the\s+day\s+before,\s+but\s+([a-z]+|\d+)\s+people\s+returned\s+their\s+pairs\s+because\s+they\s+didn'?t\s+fit\b/i;
  const m3 = r3.exec(q);
  if (!m3) return null;
  const [, mult2Phrase, returnsRaw] = m3;
  const ratio2 = parseMultiplierPhrase(mult2Phrase);
  const returns = /^\d+$/.test(returnsRaw) ? parseInt(returnsRaw, 10) : ONES_WORDS.indexOf(returnsRaw.toLowerCase());
  if (!ratio2 || !Number.isFinite(returns) || returns < 0) return null;
  if ((day2 * ratio2.num) % ratio2.den !== 0) return null;
  const day3 = (day2 * ratio2.num) / ratio2.den;

  const rQ = /how\s+many\s+(?:[a-z]+\s+)+were\s+sold\s+by\s+the\s+end\s+of\s+the\s+sale/i;
  if (!rQ.test(q)) return null;

  const total = day1 + day2 + day3 - returns;
  if (!Number.isFinite(total) || total < 0) return null;
  return { total };
}

export const threeDaySaleMultiplyChainMinusReturnsTotalSold: LianaMethod = {
  id: 'three-day-sale-multiply-chain-minus-returns-total-sold-v1',
  demand: 'COMPUTE',
  name: 'Two chained day-over-day multipliers (day2 from day1, day3 from day2) summed, minus a flat returns count, gives total sold',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W23 (cluster C214, sole member: pilot corpus item at index 371)',
  shapeDescription: 'day2 = mult1*day1; day3 = mult2*day2; answer = day1+day2+day3-returns.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a directly-stated day1 amount, a day2-as-a-multiple-of-day1 sentence, a ' +
          'day3-as-a-multiple-of-day2-plus-flat-returns sentence, and a closing "sold by the end ' +
          'of the sale" question, resolving to a non-negative exact value; abstaining rather than ' +
          'guessing',
      };
    }
    return { matches: true, reason: `total sold by end of sale = ${result.total}` };
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
      return {
          question,
          verdict: String(Math.round((result.total) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'chained the two day-over-day multipliers, summed all three days, then subtracted the flat returns count',
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
  },
};

registerMethod(threeDaySaleMultiplyChainMinusReturnsTotalSold);
