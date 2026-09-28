// D-BP223-M0-h2cbpqmc-011 -- sum-of-independent-rate-count-products-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE.
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\sum-of-independent-rate-count-products-v1.candidate.ts
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
 * D-BP223-BM0-079 CLUSTER C03 (15 silo members, zero promoted -- the single biggest
 * de-duplication saving measured). Representative teaching case: item11 (GSM8K test line 11,
 * the bakery problem, three dozen-priced pastries summed).
 *
 * @generalShape A short list of K (K>=2) independently-priced/rated items, each stated as its
 *   own clause carrying exactly TWO numbers -- a quantity and a per-unit rate (a dollar amount
 *   or a plain rate) -- combined by multiplication within the clause, and the clauses combined
 *   by ADDITION across the whole list to produce one grand total. At most one clause may instead
 *   be a flat, already-total amount carrying only ONE number (e.g. a flat extra item with no
 *   stated quantity, taken as quantity 1). This is the "sum of K independent multiplicative
 *   terms" shape (D-BP223-BM0-079 cluster C03): total = sum_i(qty_i * rate_i) [+ up to one flat
 *   addend].
 *
 * @recogniseInStranger Split the declarative (non-question) sentences of the question into
 *   clauses on commas and "and". A clause QUALIFIES AS A MULTIPLICATIVE TERM when it contains
 *   exactly two numeric tokens (bare integers/decimals or `$`-prefixed amounts) and neither
 *   number is inside the interrogative ("how many"/"how much"/"what is") tail of the question --
 *   that tail is cut off before clause-splitting, never scanned for terms. A clause with exactly
 *   ONE number is a candidate FLAT addend. The method fires only when there are AT LEAST TWO
 *   two-number clauses and AT MOST ONE one-number clause, and no disqualifying keyword (percent,
 *   tax, discount, cashback, rebate, tip, markup, profit, average, ratio, "more than", "fewer
 *   than", "less than", "left", "remain", "twice", "half", "triple", "double") appears anywhere
 *   in the text -- those signal a different final operation (percentage, back-solve, comparison,
 *   a derived-not-independent second term) that this narrow shape must not guess at.
 *
 * @whatBreaksIt (a) the quantity and its rate stated in SEPARATE sentences rather than the same
 *   clause (e.g. "spent $5 on each newspaper ad ... bought 50 newspaper ads") -- each sentence
 *   then carries only one number and the method correctly abstains rather than pairing numbers
 *   across sentences by guesswork; (b) a term whose "quantity" is itself derived from another
 *   term (a chain, not independent) -- caught by the disqualifying-keyword list catching the
 *   relational words that describe such derivations; (c) more than one flat one-number clause,
 *   which usually means the shape is actually a plain sum-of-given-quantities (a different
 *   cluster, C28) rather than K rate*count products; (d) a clause with three or more numbers,
 *   which this method cannot disambiguate and therefore treats as disqualifying for the whole
 *   question, not just that clause.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Any single
 *   guard failing (fewer than two two-number clauses, more than one flat clause, a disqualifying
 *   keyword hit, a non-finite result) makes the method ABSTAIN: verdict null, abstain true. A
 *   false MATCH would instead sum the wrong pairing of numbers and hand back a confident wrong
 *   total that ends the fallthrough loop -- so every guard here is written to refuse rather than
 *   guess, and quarantined:true keeps this method out of selection until measured. Cross-cluster
 *   measurement (D-BP223 batch 1 report) found this design correct on items 11, 158, 171 and 280
 *   of the 15-member cluster and honestly abstaining (never wrong) on the rest, most of which
 *   split quantity/rate across sentences -- a documented, deliberate limitation, not a bug.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';


const METHOD_ID = 'sum-of-independent-rate-count-products-v1';

const DISQUALIFYING_KEYWORDS: string[] = [
  'percent', '%', 'tax', 'discount', 'cashback', 'rebate', 'tip', 'markup',
  'mark up', 'profit', 'resale', 'resell', 'average', 'mean', 'ratio',
  'more than', 'fewer than', 'less than', 'left', 'remain', 'twice',
  'double', 'triple', 'half', 'quarter', 'fraction', 'equation', 'unknown',
  'variable', 'commission', 'interest', 'wage', 'salary',
];

interface Clause {
  text: string;
  numbers: number[];
}

function splitIntoDeclarativeClauses(rawQuestion: string): Clause[] {
  // Cut off the interrogative tail so its numbers (if any) are never scanned as terms -- this
  // shape only ever reads its terms from the DECLARATIVE setup, never from the question itself.
  const interrogative = /how (many|much)|what (is|was|will|does)/i;
  const m = interrogative.exec(rawQuestion);
  const body = m ? rawQuestion.slice(0, m.index) : rawQuestion;

  const sentences = body.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  const clauses: Clause[] = [];
  for (const s of sentences) {
    const parts = s.split(/,\s*(?:and\s+)?|\s+and\s+/i);
    for (const p of parts) {
      const trimmed = p.trim();
      if (!trimmed) continue;
      const numMatches = trimmed.match(/\$?\d+(?:\.\d+)?/g) || [];
      const numbers = numMatches.map((t) => parseFloat(t.replace(/[$]/g, '')));
      if (numbers.length > 0) clauses.push({ text: trimmed, numbers });
    }
  }
  return clauses;
}

interface AnalyzeResult {
  total: number;
  termClauses: number;
  flatClauses: number;
}

function analyze(rawQuestion: unknown): AnalyzeResult | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();
  const lower = q.toLowerCase();
  for (const kw of DISQUALIFYING_KEYWORDS) {
    if (lower.includes(kw)) return null;
  }

  const clauses = splitIntoDeclarativeClauses(q);
  if (!clauses.length) return null;

  let productSum = 0;
  let flatSum = 0;
  let termClauses = 0;
  let flatClauses = 0;

  for (const c of clauses) {
    if (c.numbers.length === 2) {
      const [a, b] = c.numbers;
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      productSum += a * b;
      termClauses++;
    } else if (c.numbers.length === 1) {
      const [a] = c.numbers;
      if (!Number.isFinite(a)) return null;
      flatSum += a;
      flatClauses++;
    } else {
      // A clause with 3+ numbers cannot be disambiguated by this narrow shape -- disqualify
      // the whole question rather than guess which pairing is correct.
      return null;
    }
  }

  if (termClauses < 2) return null;
  if (flatClauses > 1) return null;

  const total = productSum + flatSum;
  if (!Number.isFinite(total) || total < 0) return null;

  return { total, termClauses, flatClauses };
}


export const sumOfIndependentRateCountProductsMethod: LianaMethod = {
  id: METHOD_ID,
  demand: 'COMPUTE',
  name: 'Sum of K independent quantity x rate products',
  taughtBy: 'D-BP223-BM0-079/SEG (cluster C03, representative harvest_gsm8k_pilot_item11)',
  shapeDescription:
    'K (K>=2) independently stated quantity*rate clauses (e.g. "3 dozen donuts which cost $68 ' +
    'per dozen"), summed to one grand total, with at most one flat already-total addend.',
  quarantined: true,

  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find at least two clean quantity*rate clauses (each exactly two numbers) ' +
          'plus at most one flat addend, or a disqualifying keyword was present; abstaining ' +
          'rather than guessing which numbers pair together',
      };
    }
    return {
      matches: true,
      reason:
        `found ${result.termClauses} quantity*rate clause(s) and ${result.flatClauses} flat ` +
        `addend clause(s)`,
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
        basis: `summed ${result.termClauses} quantity*rate term(s) plus ${result.flatClauses} flat addend(s) = ${rounded}`,
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
registerMethod(sumOfIndependentRateCountProductsMethod);
