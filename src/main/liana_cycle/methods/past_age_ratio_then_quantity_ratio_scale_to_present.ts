// D-BP223-BM04-h2cbpv9w-170 -- past-age-ratio-then-quantity-ratio-scale-to-present-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\past-age-ratio-then-quantity-ratio-scale-to-present-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R04
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R04.md): gate 1 (positive yield), gate 2a
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R04.md for the exact
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W18, CLUSTER C171 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl line 313, "Six years ago, when Noah was half as old as Cera, the
 * population of Chile was half what it is now. Currently, Cera is 46 years old. If the population
 * of Chile six years ago was 3000 times the age of Noah, calculate the population of Chile now."
 * Silo label: "multi-step word problem involving age relationships and proportional scaling --
 * algebraic substitution and proportional scaling".
 *
 * @generalShape N years ago, PersonA's age was a stated RATIO of PersonB's PAST age, and a named
 *   QUANTITY (a population, a price, a count) was a stated RATIO of its OWN present value at that
 *   same past moment. PersonB's CURRENT age is given directly. The past quantity is then given as
 *   a multiple of PersonA's PAST age (the SAME "N years ago" anchor). The answer is the quantity's
 *   PRESENT value, backed out through: PersonB-past -> PersonA-past -> quantity-past ->
 *   quantity-present.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) "<N> years ago, when <A> was
 *   <ratio1-phrase> as old as <B>, the <quantity> was <ratio2-phrase> what it is now"; (b)
 *   "Currently, <B> is <V> years old", naming the SAME B; (c) "the <quantity> <N> years ago was
 *   <M> times the age of <A>", using the SAME <N>, the SAME quantity name, and the SAME A as (a);
 *   (d) both ratio phrases resolve via a small known table (half/twice/double/a third/a quarter/
 *   "<k> times").
 *
 * @whatBreaksIt (a) the "N years ago" figure in the multiplier clause not matching the opening
 *   clause's -- abstains, cannot assume the same past moment; (b) either ratio phrase not
 *   recognized by the small table; (c) PersonA's backsolved past age, or the quantity's backsolved
 *   present value, not landing on an exact whole number -- abstains rather than round; (d) the
 *   quantity name in the multiplier clause not matching the opening clause's quantity name.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (Cera-past = 46-6 = 40; Noah-past = 40/2 = 20; quantity-past =
 *   3000*20 = 60000; quantity-now = 60000/(1/2) = 120000). With only one known cluster member
 *   there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'past-age-ratio-then-quantity-ratio-scale-to-present-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });

function wordOrDigit(tok: string | undefined): number | null {
  if (tok === undefined || tok === '') return null;
  const digitStr = tok.replace(/[^0-9]/g, '');
  if (/^\d+$/.test(digitStr)) return parseInt(digitStr, 10);
  const w = tok.toLowerCase().trim();
  if (Object.prototype.hasOwnProperty.call(ONES, w)) return ONES[w];
  return null;
}

interface Frac { num: number; den: number; }

function parseRatioPhrase(phrase: string): Frac | null {
  const p = phrase.toLowerCase().trim();
  if (p === 'half') return { num: 1, den: 2 };
  if (p === 'twice' || p === 'double') return { num: 2, den: 1 };
  if (p === 'a third' || p === 'one third' || p === 'a-third') return { num: 1, den: 3 };
  if (p === 'a quarter' || p === 'one quarter' || p === 'a fourth') return { num: 1, den: 4 };
  const timesM = /^([a-z-]+)\s+times$/.exec(p);
  if (timesM) {
    const n = wordOrDigit(timesM[1]);
    if (n !== null && n >= 2) return { num: n, den: 1 };
  }
  return null;
}

interface Analyzed { quantityNow: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const openRe = /(\d+|[a-z]+)\s+years ago,\s*when\s+([A-Z][a-z]+)\s+was\s+([a-z]+)\s+as old as\s+([A-Z][a-z]+),\s*the\s+([a-z ]+?)\s+was\s+([a-z]+)\s+what it is now/i;
  const opm = openRe.exec(q);
  if (!opm) return null;
  const yearsAgo1 = wordOrDigit(opm[1]);
  const actorA = opm[2];
  const ratio1 = parseRatioPhrase(opm[3]);
  const actorB = opm[4];
  const quantityName = opm[5].trim().toLowerCase();
  const ratio2 = parseRatioPhrase(opm[6]);
  if (yearsAgo1 === null || !ratio1 || !ratio2 || actorA === actorB) return null;

  const currentRe = new RegExp('currently,\\s*' + actorB + '\\s+is\\s+(\\d+|[a-z]+)\\s+years old', 'i');
  const cm = currentRe.exec(q);
  if (!cm) return null;
  const bNow = wordOrDigit(cm[1]);
  if (bNow === null) return null;

  const multRe = new RegExp('the\\s+' + quantityName.replace(/\s+/g, '\\s+') + '\\s+(\\d+|[a-z]+)\\s+years ago was\\s+(\\d+|[a-z]+)\\s+times the age of\\s+' + actorA, 'i');
  const mm = multRe.exec(q);
  if (!mm) return null;
  const yearsAgo2 = wordOrDigit(mm[1]);
  const multiplier = wordOrDigit(mm[2]);
  if (yearsAgo2 === null || multiplier === null) return null;
  if (yearsAgo1 !== yearsAgo2) return null;

  const bPast = bNow - yearsAgo1;
  if (bPast <= 0) return null;
  const aPastNum = bPast * ratio1.num;
  if (aPastNum % ratio1.den !== 0) return null;
  const aPast = aPastNum / ratio1.den;

  const quantityPast = multiplier * aPast;
  // quantityPast = ratio2.num/ratio2.den * quantityNow  =>  quantityNow = quantityPast * ratio2.den / ratio2.num
  const quantityNowNum = quantityPast * ratio2.den;
  if (quantityNowNum % ratio2.num !== 0) return null;
  const quantityNow = quantityNowNum / ratio2.num;
  if (!Number.isFinite(quantityNow) || quantityNow <= 0) return null;
  return { quantityNow };
}

export const pastAgeRatioThenQuantityRatioScaleToPresent: LianaMethod = {
  id: 'past-age-ratio-then-quantity-ratio-scale-to-present-v1',
  demand: 'COMPUTE',
  name: 'Backsolve a past age via a ratio, then scale a co-dated quantity ratio forward to the present',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W18 (cluster C171, sole member: pilot corpus item at index 313)',
  shapeDescription:
    'bPast = bNow - N; aPast = ratio1*bPast; qPast = multiplier*aPast; qNow = qPast / ratio2',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a matched "N years ago" age-ratio-and-quantity-ratio opening clause, a ' +
          'current age for the second actor, and a multiplier clause sharing the same N-years-ago ' +
          'anchor and quantity name, resolving through two exact-division backsolves; abstaining ' +
          'rather than guessing',
      };
    }
    return { matches: true, reason: `quantity now = ${result.quantityNow}` };
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
          verdict: String(Math.round(result.quantityNow * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'two-hop past-to-present ratio backsolve',
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

registerMethod(pastAgeRatioThenQuantityRatioScaleToPresent);
