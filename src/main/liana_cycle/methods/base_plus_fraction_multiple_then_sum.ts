// D-BP223-M0-h2cbpqmc-011 -- base-plus-fraction-multiple-then-sum-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE.
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\base-plus-fraction-multiple-then-sum-v1.candidate.ts
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
 * D-BP223-BM0-079 CLUSTER C08 (3 silo members, zero promoted). Representative teaching case:
 * item71 (GSM8K test line 71, Kelian's two recipes).
 *
 * @generalShape Exactly one base quantity is stated as a bare number; a second quantity is
 *   defined ENTIRELY in words as a fixed multiple or fraction of the base ("twice as many as the
 *   first one", "half as many apples as her mom", "a third of that amount") -- no second number
 *   is stated for it. The answer is the SUM of the base and its derived multiple:
 *   base * (1 + fraction). This is cluster C08's "term2 = term1 x a stated fraction/multiple,
 *   then sum both" shape.
 *
 * @recogniseInStranger The question contains EXACTLY ONE numeric token (bare integer/decimal or
 *   `$`-prefixed amount) anywhere in the text, and contains exactly one of a small set of
 *   fixed multiplier phrases with no accompanying number of its own: "twice as many"/"twice as
 *   much" -> x2, "double" -> x2, "a third of"/"one third of" -> x(1/3), "half as many"/"half as
 *   much" -> x(1/2), "triple" -> x3, "a quarter of"/"one quarter of" -> x(1/4). Exactly one such
 *   phrase must be present (never zero, never more than one -- either is ambiguous), and none of
 *   a disqualifying-keyword list (percent, tax, discount, average, "more than", "fewer than",
 *   "left", "remain") may appear.
 *
 * @whatBreaksIt (a) a SECOND base-adjacent number appearing anywhere in the text (this method
 *   requires exactly one, since it cannot otherwise tell which number is the base) -- a stranger
 *   question with, say, a stated price AND a stated quantity would correctly fail this guard;
 *   (b) two competing multiplier phrases in the same text (ambiguous, which one applies) --
 *   refused; (c) a multiplier phrase describing something other than a straight sum of base and
 *   derived-term (e.g. the derived term should be SUBTRACTED, or there are three or more terms
 *   in a chain) -- not distinguishable by this narrow keyword set, so a stranger question of that
 *   shape risks a wrong sum; this is a real, acknowledged limitation, not assumed safe.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Any guard
 *   failing (not exactly one number, not exactly one multiplier phrase, a disqualifying keyword,
 *   a non-finite result) makes the method ABSTAIN: verdict null, abstain true. Cross-cluster
 *   measurement (D-BP223 batch 1 report) found this design correct on all three members of the
 *   cluster it was built for -- items 71, 185 and 223 -- with no observed wrong answer in this
 *   batch's testing, though the single-number/single-phrase requirement means it is deliberately
 *   narrow and abstains readily on any stranger question outside that exact pattern.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';


const METHOD_ID = 'base-plus-fraction-multiple-then-sum-v1';

const DISQUALIFYING_KEYWORDS: string[] = [
  'percent', '%', 'tax', 'discount', 'cashback', 'rebate', 'tip', 'markup',
  'mark up', 'profit', 'resale', 'resell', 'average', 'mean', 'more than',
  'fewer than', 'less than', 'left', 'remain', 'equation', 'unknown',
  'variable', 'commission', 'interest', 'wage', 'salary',
];

// Ordered so a longer/more-specific phrase is checked before a shorter one that could be a
// substring of it (e.g. "one third of" contains no "half", no collision risk here, but kept
// explicit and ordered for clarity and future additions).
const MULTIPLIER_PHRASES: Array<{ re: RegExp; value: number }> = [
  { re: /twice as (?:many|much)/i, value: 2 },
  { re: /\bdouble\b/i, value: 2 },
  { re: /\btriple\b/i, value: 3 },
  { re: /half as (?:many|much)/i, value: 1 / 2 },
  { re: /(?:a|one) third of/i, value: 1 / 3 },
  { re: /(?:a|one) quarter of/i, value: 1 / 4 },
];

interface Analyzed {
  base: number;
  fraction: number;
  total: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();
  const lower = q.toLowerCase();
  for (const kw of DISQUALIFYING_KEYWORDS) {
    if (lower.includes(kw)) return null;
  }

  const numMatches = q.match(/\$?\d+(?:\.\d+)?/g) || [];
  if (numMatches.length !== 1) return null;
  const base = parseFloat(numMatches[0].replace('$', ''));
  if (!Number.isFinite(base) || base <= 0) return null;

  const hits = MULTIPLIER_PHRASES.filter((p) => p.re.test(q));
  if (hits.length !== 1) return null;
  const fraction = hits[0].value;

  const total = base * (1 + fraction);
  if (!Number.isFinite(total) || total < 0) return null;

  return { base, fraction, total };
}


export const basePlusFractionMultipleThenSumMethod: LianaMethod = {
  id: METHOD_ID,
  demand: 'COMPUTE',
  name: 'Base quantity plus a stated fraction/multiple of itself',
  taughtBy: 'D-BP223-BM0-079/SEG (cluster C08, representative harvest_gsm8k_pilot_item71)',
  shapeDescription:
    'One stated base number plus a second quantity defined purely in words as a fixed multiple ' +
    'or fraction of it ("twice as many", "half as much", "a third of that"), summed.',
  quarantined: true,

  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find exactly one bare number plus exactly one recognized multiplier phrase ' +
          '(twice/double/triple/half/third/quarter) with no disqualifying keyword; abstaining ' +
          'rather than guessing',
      };
    }
    return {
      matches: true,
      reason:
        `base=${result.base}, fraction=${result.fraction}`,
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
        basis: `${result.base} * (1 + ${result.fraction}) = ${rounded}`,
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
registerMethod(basePlusFractionMultipleThenSumMethod);
