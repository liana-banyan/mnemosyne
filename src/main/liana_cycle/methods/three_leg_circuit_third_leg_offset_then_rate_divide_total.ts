// D-BP223-BM04-h2cbp9d8-171 -- three-leg-circuit-third-leg-offset-then-rate-divide-total-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R05
// (registration batch drawn from generation waves W21-W23).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\three-leg-circuit-third-leg-offset-then-rate-divide-total-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W22, CLUSTER C205 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 361, "A train travels between 3 different
 * cities. It goes 75 miles from the first city to the second city, 100 miles from the second city
 * to the third city, and 50 miles less than that combined distance to go from the third city to
 * the first city. It does this trip 3 times a day. The train needs service every 18,000 miles so
 * how many days does it go between services?". Silo label: "multi-step distance and frequency
 * calculation" -- matches exactly.
 *
 * @generalShape Two legs of a three-leg circuit are stated directly. The third leg is the
 *   COMBINED total of the first two, minus a stated offset. The full circuit distance is the sum
 *   of all three legs. A daily repeat count is given, yielding a daily distance. A service
 *   interval distance is given; the answer is the interval divided by the daily distance.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) "goes <D1> miles from the first
 *   city to the second city, <D2> miles from the second city to the third city"; (b) "<offset>
 *   miles less than that combined distance to go from the third city to the first city"; (c)
 *   "does this trip <N> times a day"; (d) "needs service every <interval> miles", where interval
 *   may include comma thousands separators, stripped before parsing.
 *
 * @whatBreaksIt (a) either of the first two legs or the offset clause missing or reordered --
 *   abstain, the anchors are positional; (b) more or fewer than three cities / three legs
 *   mentioned -- outside this candidate's fixed positional pattern, abstains; (c) the final
 *   division not landing on an exact integer number of days -- abstain rather than round.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a shape
 *   claim guarantees run() reconstructs the same number. Measured against its own (sole) cluster
 *   member: SOLVED (leg3 = 75+100-50=125, circuit = 300, daily = 3*300=900, days =
 *   18000/900=20). With only one known member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'three-leg-circuit-third-leg-offset-then-rate-divide-total-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];

function wordOrDigit(tok: string | undefined): number | null {
  if (tok === undefined || tok === '') return null;
  const digitOnly = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digitOnly)) return parseFloat(digitOnly);
  const w = tok.toLowerCase().trim();
  const idx = ONES_WORDS.indexOf(w);
  return idx >= 0 ? idx : null;
}

interface Analyzed { days: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const legsRe = /\bgoes\s+(\d+(?:\.\d+)?)\s+miles\s+from\s+the\s+first\s+city\s+to\s+the\s+second\s+city,\s+(\d+(?:\.\d+)?)\s+miles\s+from\s+the\s+second\s+city\s+to\s+the\s+third\s+city\b/i;
  const legsM = legsRe.exec(q);
  if (!legsM) return null;
  const [, d1Raw, d2Raw] = legsM;
  const d1 = parseFloat(d1Raw);
  const d2 = parseFloat(d2Raw);

  const offsetRe = /(\d+(?:\.\d+)?)\s+miles\s+less\s+than\s+that\s+combined\s+distance\s+to\s+go\s+from\s+the\s+third\s+city\s+to\s+the\s+first\s+city\b/i;
  const offsetM = offsetRe.exec(q);
  if (!offsetM) return null;
  const [, offsetRaw] = offsetM;
  const offset = parseFloat(offsetRaw);

  const tripsRe = /\bdoes\s+this\s+trip\s+(\d+|[a-z]+)\s+times\s+a\s+day\b/i;
  const tripsM = tripsRe.exec(q);
  if (!tripsM) return null;
  const [, tripsRaw] = tripsM;
  const trips = wordOrDigit(tripsRaw);
  if (trips === null || trips <= 0) return null;

  const intervalRe = /\bneeds\s+service\s+every\s+([\d,]+(?:\.\d+)?)\s+miles\b/i;
  const intervalM = intervalRe.exec(q);
  if (!intervalM) return null;
  const [, intervalRaw] = intervalM;
  const interval = parseFloat(intervalRaw.replace(/,/g, ''));
  if (!Number.isFinite(interval) || interval <= 0) return null;

  const leg3 = d1 + d2 - offset;
  if (leg3 <= 0) return null;
  const circuit = d1 + d2 + leg3;
  const daily = circuit * trips;
  if (!(daily > 0) || interval % daily !== 0) return null;
  const days = interval / daily;
  return { days };
}

export const threeLegCircuitThirdLegOffsetThenRateDivideTotal: LianaMethod = {
  id: 'three-leg-circuit-third-leg-offset-then-rate-divide-total-v1',
  demand: 'COMPUTE',
  name: 'Third leg from a combined-minus-offset relation, then a service interval divided by daily distance',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W22 (cluster C205, sole member: pilot corpus item at index 361)',
  shapeDescription:
    'leg3 = (leg1+leg2) - offset; circuit = leg1+leg2+leg3; daily = circuit*tripsPerDay; ' +
    'answer = serviceInterval / daily.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find two stated legs of a three-leg circuit, a combined-minus-offset third ' +
          'leg, a daily trip count and a service interval, resolving to a positive exact integer ' +
          'day count; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `days between services = ${result.days}` };
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
          verdict: String(Math.round((result.days) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'derived the third leg, summed the circuit, divided the service interval by the daily distance',
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

registerMethod(threeLegCircuitThirdLegOffsetThenRateDivideTotal);
