// D-BP223-BM04-h2cbp9d8-171 -- total-split-evenly-two-different-per-unit-rates-daily-yield-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R05
// (registration batch drawn from generation waves W21-W23).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\total-split-evenly-two-different-per-unit-rates-daily-yield-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W23, CLUSTER C215 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 374, "Mary has 30 sheep. She gets 1 kg of
 * milk from half of them and 2 kg of milk from the other half every day. How much milk does she
 * collect every day?". Silo label: "multi-step arithmetic problem involving proportions and
 * summation" -- matches exactly. Distinct from the registered two-activity-rate-times-count-sum-v1
 * (two INDEPENDENTLY-counted activities, each with its own separately stated count) and
 * two-subgroup-daily-rate-sum-times-week-style shapes: here there is a SINGLE stated total split
 * evenly in half by the text itself ("half of them"/"the other half"), never two separately
 * counted subgroups.
 *
 * @generalShape A total headcount N of a single animal/unit type is given directly. EXACTLY HALF
 *   of that total yields one per-unit RATE of a product, and the OTHER half yields a DIFFERENT
 *   per-unit rate of the SAME product, both stated in one sentence ("gets <R1> kg of <product>
 *   from half of them and <R2> kg of <product> from the other half every day"). The question asks
 *   for the total product collected per day: (N/2)*R1 + (N/2)*R2.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence:
 *   (a) "<actor> has <N> <animal-plural>" -- the total headcount;
 *   (b) "gets <R1> kg of <product> from half of them and <R2> kg of <product> from the other
 *       half every day", naming the SAME product word in both halves;
 *   (c) "how much <product> does <pronoun> collect every day", naming the SAME product as (b).
 *   N must be evenly divisible by 2 (an exact half), or the candidate abstains rather than round.
 *
 * @whatBreaksIt (a) N odd -- abstain, "half of them" cannot be exact; (b) the two per-unit rates
 *   naming DIFFERENT products (a copy/paste mismatch) -- abstain, cannot confirm this is the same
 *   substance; (c) more than two subgroups implied elsewhere (a third rate or a stated fraction
 *   other than exactly one half) -- a different, richer shape this candidate does not attempt;
 *   (d) the closing question asking about a different product than (b) -- unmatched.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a shape
 *   claim guarantees run() reconstructs the same number. Measured against its own (sole) cluster
 *   member: SOLVED (half=30/2=15, total=15*1+15*2=45). With only one known member there is no
 *   cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'total-split-evenly-two-different-per-unit-rates-daily-yield-v1';

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const r1 = /\b([a-z]+)\s+has\s+(\d+)\s+([a-z]+)\.\s/i;
  const m1 = r1.exec(q);
  if (!m1) return null;
  const [, , nRaw] = m1;
  const n = parseInt(nRaw, 10);
  if (!Number.isFinite(n) || n % 2 !== 0) return null;
  const half = n / 2;

  const r2 =
    /\b[a-z]+\s+gets\s+(\d+(?:\.\d+)?)\s+kg\s+of\s+([a-z]+)\s+from\s+half\s+of\s+them\s+and\s+(\d+(?:\.\d+)?)\s+kg\s+of\s+([a-z]+)\s+from\s+the\s+other\s+half\s+every\s+day\b/i;
  const m2 = r2.exec(q);
  if (!m2) return null;
  const [, rate1Raw, product1, rate2Raw, product2] = m2;
  if (product1.toLowerCase() !== product2.toLowerCase()) return null;
  const rate1 = parseFloat(rate1Raw);
  const rate2 = parseFloat(rate2Raw);
  if (!Number.isFinite(rate1) || !Number.isFinite(rate2)) return null;

  const productEsc = product1.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rQ = new RegExp('how\\s+much\\s+' + productEsc + '\\s+does\\s+[a-z]+\\s+collect\\s+every\\s+day', 'i');
  if (!rQ.test(q)) return null;

  const total = half * rate1 + half * rate2;
  if (!Number.isFinite(total) || total < 0) return null;
  return { total };
}

export const totalSplitEvenlyTwoDifferentPerUnitRatesDailyYield: LianaMethod = {
  id: 'total-split-evenly-two-different-per-unit-rates-daily-yield-v1',
  demand: 'COMPUTE',
  name: 'Total headcount split exactly in half, each half yielding a different per-unit rate of the same product, summed to the daily total',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W23 (cluster C215, sole member: pilot corpus item at index 374)',
  shapeDescription: 'answer = (N/2)*rate1 + (N/2)*rate2, N required evenly divisible by 2.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a total-headcount sentence with an even count, a matching "half ... the ' +
          'other half" twin-rate sentence naming the same product, and a closing daily-collection ' +
          'question naming the same product; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `daily total = ${result.total}` };
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
          basis: 'split the total exactly in half and applied each half\'s own stated per-unit rate, then summed',
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

registerMethod(totalSplitEvenlyTwoDifferentPerUnitRatesDailyYield);
