// D-BP223-M0-h2cbpqmc-011 -- sum-parts-then-multiply-by-rate-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE.
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\sum-parts-then-multiply-by-rate-v1.candidate.ts
// Accepted (gate 1 then 2a then 4, then the perturbation gate 2b), per
// BISHOP_DROPZONE\D-BP223-M0-h2cbpqmc-010_PROMOTION_BATCH_1_FIVE_CLUSTERS.md.
//
// WHY THIS FILE EXISTS RATHER THAN THE CANDIDATE ITSELF. The candidate declared its OWN local
// `LianaQuestionInput`, `ShapeTestResult` and `RunResult` interfaces and left the exported
// object completely unannotated, so nothing was ever checked against the real registry
// contract -- the same "disguise" already found and named in the earlier seven item-10 methods
// (see reference_a_hand_copied_contract_is_the_defect_not_bad_types_bp222.md). Those three local
// interfaces are DELETED here; `LianaMethod` and `MethodQuestionInput` are imported from
// '../method_registry' and the exported object is annotated against the real `LianaMethod` type,
// per the estate's standing order NEVER CAST, ANNOTATE.
//
// THE BEHAVIOR CORE IS COPIED BYTE-FOR-BYTE AND DELIBERATELY NOT IMPROVED: every constant, every
// helper function and analyze() itself below are the candidate's own bytes -- proved by byte
// containment in this dispatch's report, not merely asserted. `accept_gates.cjs` judged this
// method's BEHAVIOR (gate 1 solves its own shape, gate 2a carries no answer, gate 4 steals
// nothing) and the perturbation gate (2b) ran baseline plus 3 perturbations, all TRACK. Editing
// the analysis would mean that ACCEPT no longer describes this file. Only the interface layer --
// the two signatures and the returned object shapes -- is this dispatch's work.
//
// TRY/CATCH ADDED, matching the Founder-approved pass across the earlier seven
// (D-BP223-BM0-005, 2026-09-07T01:25:41Z ruling: "Yes do the Try/Catch pass across the seven.
// Approved. Word.") applied here from the start rather than as a later pass: run() aborts to an
// honest abstain on any thrown error rather than ending the engine's fall-through chain.
//
// REGISTERED QUARANTINED (`quarantined: true`), so selectMethod() and selectEligibleMethods()
// will never choose it. Registering changes NO live run; it makes the method visible to
// listMethods() and measurable -- the whole point of filing it. Un-quarantining is a separate,
// later Founder decision made per batch after held-out measurement, not this dispatch's.

/**
 * D-BP223-BM0-079 CLUSTER C05 (6 silo members, zero promoted). Representative teaching case:
 * item156 (GSM8K test line 156, the zookeeper's banana order).
 *
 * @generalShape Two or more sub-part amounts are each stated directly, once, in the setup
 *   ("the monkeys need 200 bananas, the gorillas need 400 bananas, and the baboons need 100
 *   bananas"); those sub-parts are added into one base-period total, and that base total is then
 *   multiplied by a separately-stated count/rate (an explicit "every N months/weeks/days" cue,
 *   a literal "tripled"/"doubled" word, or -- when the setup carries no such cue -- a single bare
 *   number sitting in the question's own interrogative clause, e.g. "How much will 8 pens
 *   cost?"). This is cluster C05's "add sub-parts, then multiply by a rate" shape, order of
 *   operations (add-then-multiply) being the discriminator against C03/C04's multiply-then-add.
 *
 * @recogniseInStranger Cut the text at the interrogative ("how many"/"how much"/"what") into a
 *   BODY (everything before) and a QUESTION tail (the interrogative sentence). Search the BODY
 *   for a multiplier via, in order: (1) "every (\d+) (day|week|month|year)s?"; (2) the literal
 *   words "tripled" (=3) or "doubled" (=2). If neither is found, fall back to: (3) the QUESTION
 *   tail contains EXACTLY ONE bare number -- use it as the multiplier. Then split the BODY (minus
 *   whatever text matched the multiplier) into clauses on commas/"and"/sentence breaks and
 *   collect every clause carrying exactly one number as an addend; fire only when there are AT
 *   LEAST TWO such addends, a multiplier was found by exactly one of the three rules, and no
 *   disqualifying keyword (percent, tax, discount, average, more/fewer/less than) is present.
 *
 * @whatBreaksIt (a) a multiplier implied only by a per-person or per-repetition count buried in
 *   its own clause with no "every N unit" / tripled / doubled cue and no lone number in the
 *   question tail (e.g. "each ride cost 6 tickets") -- this shape does not chase that pattern
 *   and abstains rather than mis-derive it, a documented limitation, not a guess; (b) an addend
 *   whose value is itself a multiple of another sub-part rather than an independently stated
 *   number (a chained/derived quantity, a different shape entirely) -- not specifically keyword-
 *   guarded here beyond the generic disqualifiers, so a stranger question of that kind risks
 *   miscounting an addend; measured cross-member and reported honestly rather than assumed safe;
 *   (c) more than one candidate multiplier signal firing at once (ambiguous) -- refused.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Failing any
 *   guard (no multiplier found, fewer than two addends, a disqualifying keyword, a non-finite
 *   result) makes the method ABSTAIN: verdict null, abstain true, costing nothing on the
 *   fallthrough engine. Cross-cluster measurement (D-BP223 batch 1 report) found this design
 *   correct on items 156, 195 and 237 of the 6-member cluster and honestly abstaining (never
 *   wrong) on items 132, 45 and 230, whose multiplier or addends this narrow rule set cannot
 *   locate safely.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';


const METHOD_ID = 'sum-parts-then-multiply-by-rate-v1';

const DISQUALIFYING_KEYWORDS: string[] = [
  'percent', '%', 'tax', 'discount', 'cashback', 'rebate', 'tip', 'markup',
  'mark up', 'profit', 'resale', 'resell', 'average', 'mean', 'ratio',
  'more than', 'fewer than', 'less than', 'left', 'remain', 'half',
  'quarter', 'fraction', 'equation', 'unknown', 'variable', 'commission',
  'interest', 'wage', 'salary',
];

interface Analyzed {
  sumOfParts: number;
  multiplier: number;
  addendCount: number;
  total: number;
}

function splitBodyIntoClauses(body: string, consumedSpans: Array<[number, number]>): number[] {
  // Numbers inside a span already consumed by the multiplier match are excluded, so the
  // multiplier's own number is never also counted as an addend.
  const inConsumed = (idx: number) => consumedSpans.some(([s, e]) => idx >= s && idx < e);

  const sentences = body.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  const addends: number[] = [];
  let offset = 0;
  for (const s of sentences) {
    const sentenceStart = body.indexOf(s, offset);
    offset = sentenceStart >= 0 ? sentenceStart + s.length : offset;
    const parts = s.split(/,\s*(?:and\s+)?|\s+and\s+/i);
    let localOffset = 0;
    for (const p of parts) {
      const trimmed = p.trim();
      const partStart = s.indexOf(p, localOffset);
      localOffset = partStart >= 0 ? partStart + p.length : localOffset;
      if (!trimmed) continue;
      const re = /\$?\d+(?:\.\d+)?/g;
      let m: RegExpExecArray | null;
      const nums: number[] = [];
      let anyConsumed = false;
      while ((m = re.exec(trimmed)) !== null) {
        const globalIdx = (sentenceStart >= 0 ? sentenceStart : 0) + partStart + m.index;
        if (inConsumed(globalIdx)) { anyConsumed = true; continue; }
        nums.push(parseFloat(m[0].replace('$', '')));
      }
      if (nums.length === 1 && !anyConsumed) addends.push(nums[0]);
      // clauses with 0, or 2+ un-consumed numbers are simply not counted as addends -- not
      // disqualifying on their own, since the multiplier clause itself often has extra text.
    }
  }
  return addends;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();
  const lower = q.toLowerCase();
  for (const kw of DISQUALIFYING_KEYWORDS) {
    if (lower.includes(kw)) return null;
  }

  const interrogative = /how (many|much)|what (is|was|will)/i;
  const im = interrogative.exec(q);
  const body = im ? q.slice(0, im.index) : q;
  const question = im ? q.slice(im.index) : '';

  let multiplier: number | null = null;
  const consumedSpans: Array<[number, number]> = [];

  const everyRe = /\bevery\s+(\d+)\s+(day|week|month|year)s?\b/i;
  const everyM = everyRe.exec(body);
  if (everyM) {
    multiplier = parseFloat(everyM[1]);
    consumedSpans.push([everyM.index, everyM.index + everyM[0].length]);
  } else if (/\btripled\b/i.test(body)) {
    multiplier = 3;
  } else if (/\bdoubled\b/i.test(body)) {
    multiplier = 2;
  } else {
    const qNums = question.match(/\d+(?:\.\d+)?/g) || [];
    if (qNums.length === 1) {
      multiplier = parseFloat(qNums[0]);
    }
  }

  if (multiplier === null || !Number.isFinite(multiplier) || multiplier <= 0) return null;

  const addends = splitBodyIntoClauses(body, consumedSpans);
  if (addends.length < 2) return null;
  if (addends.some((n) => !Number.isFinite(n))) return null;

  const sumOfParts = addends.reduce((a, b) => a + b, 0);
  const total = sumOfParts * multiplier;
  if (!Number.isFinite(total) || total < 0) return null;

  return { sumOfParts, multiplier, addendCount: addends.length, total };
}


export const sumPartsThenMultiplyByRateMethod: LianaMethod = {
  id: METHOD_ID,
  demand: 'COMPUTE',
  name: 'Sum sub-parts into a base amount, then multiply by a rate/count',
  taughtBy: 'D-BP223-BM0-079/SEG (cluster C05, representative harvest_gsm8k_pilot_item156)',
  shapeDescription:
    'Two or more directly-stated sub-part amounts summed into a base total, then multiplied by ' +
    'a separately stated rate/count (an "every N months" cue, "tripled"/"doubled", or a lone ' +
    'number in the question tail).',
  quarantined: true,

  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find at least two clean single-number addends plus exactly one identifiable ' +
          'multiplier (every-N-unit, tripled/doubled, or a lone number in the question tail), ' +
          'or a disqualifying keyword was present; abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason:
        `found ${result.addendCount} addend(s) summing to ${result.sumOfParts}, multiplier ` +
        `${result.multiplier}`,
    };
  },

  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    // A question with no options is free text. Read off the input, never assumed -- same
    // convention as every other adapted item-10 method in this folder.
    const freeText = !input || input.options === null || input.options === undefined;

    try {
      const result = analyze(question);
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
      const rounded = Math.round(result.total * 100) / 100;
      return {
        question,
        verdict: String(rounded),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `(${result.sumOfParts}) * ${result.multiplier} = ${rounded}`,
      };
    } catch (e) {
      // TRY/CATCH PASS, D-BP223-BM0-005 convention (see file header): ABSTAIN and say what
      // threw, rather than letting the exception end the engine's fall-through chain.
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

// REGISTERED AT IMPORT TIME, the same convention as every other method module in this folder.
// ACCEPTED by accept_gates.cjs in the Founder's promoted order gate 1 then gate 2a then gate 4,
// then the perturbation gate (2b): baseline + 3 perturbations, all TRACK. See
// BISHOP_DROPZONE\D-BP223-M0-h2cbpqmc-010_PROMOTION_BATCH_1_FIVE_CLUSTERS.md for the full verdicts.
registerMethod(sumPartsThenMultiplyByRateMethod);
