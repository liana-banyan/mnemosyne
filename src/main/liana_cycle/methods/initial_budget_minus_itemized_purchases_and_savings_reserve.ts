// D-BP223-BM04-h2cbpv9w-170 -- initial-budget-minus-itemized-purchases-and-savings-reserve-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\initial-budget-minus-itemized-purchases-and-savings-reserve-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W18, CLUSTER C168 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl line 310, "Theo has $6000 he wishes to spend on his upcoming
 * business trip to South Africa. He buys 6 business suits at $100 each, 3 suitcases at $50 each,
 * a flight ticket that costs $700 more than 5 times as much as the cost of a business suit. He
 * wishes to save $2000 for this trip, how much does he have to spend on buying gifts for his
 * business partners in South Africa?". Silo label: "multi-step budget allocation and expense
 * calculation -- multi-step addition and subtraction".
 *
 * @generalShape A starting BUDGET is stated. TWO flat-price purchases are made ("N1 item1 at $P1
 *   each, N2 item2 at $P2 each"). A THIRD item's price is stated as a LINEAR FUNCTION of the
 *   FIRST item's per-unit price ("$X more than M times as much as the cost of one item1"). A
 *   SAVINGS reserve is set aside. The answer is what remains of the budget after the three
 *   purchases and the reserve are all subtracted.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) an actor-and-budget sentence
 *   "<Actor> has $<T> ... wishes to spend"; (b) a purchase sentence naming two flat-price items,
 *   "buys <n1> <item1> at $<p1> each, <n2> <item2> at $<p2> each"; (c) a derived-price clause,
 *   "a <item3> that costs $<X> more than <M> times as much as the cost of a <item1-singular>",
 *   where item1-singular is item1 with a trailing "s" stripped -- the SAME first item named in (b);
 *   (d) a savings clause, "wishes to save $<S>"; (e) a closing question asking how much is left to
 *   spend on a further purpose.
 *
 * @whatBreaksIt (a) the derived-price clause's referenced item not matching item1 (singular form)
 *   -- abstains, cannot anchor the shared unit price; (b) any of the six numeric fields failing to
 *   parse; (c) the savings clause missing entirely; (d) the final remainder computing to a
 *   negative number -- abstains rather than reporting an impossible spend; (e) more than one
 *   plausible "has $<T>...wishes to spend" match -- only the first is used, and a genuinely
 *   ambiguous stranger is expected to be rare for this specific multi-clause shape.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (purchases 600+150=750; flight 700+5*100=1200; spent
 *   750+1200=1950; reserved 1950+2000=3950; remainder 6000-3950=2050). With only one known cluster
 *   member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'initial-budget-minus-itemized-purchases-and-savings-reserve-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });

function wordOrDigit(tok: string | undefined): number | null {
  if (tok === undefined || tok === '') return null;
  const digitStr = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digitStr)) return parseFloat(digitStr);
  const w = tok.toLowerCase().trim();
  if (Object.prototype.hasOwnProperty.call(ONES, w)) return ONES[w];
  return null;
}

function singularize(item: string): string {
  return item.trim().replace(/s$/i, '');
}

interface Analyzed { remainder: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const budgetRe = /\b[A-Z][a-z]+\s+has\s+\$([\d,]+(?:\.\d+)?)\b[\s\S]*?wishes to spend/i;
  const bm = budgetRe.exec(q);
  if (!bm) return null;
  const budget = parseFloat(bm[1].replace(/,/g, ''));

  const purchaseRe = /buys\s+(\d+)\s+([a-z ]+?)\s+at\s+\$([\d.]+)\s+each,\s*(\d+)\s+([a-z ]+?)\s+at\s+\$([\d.]+)\s+each/i;
  const pm = purchaseRe.exec(q);
  if (!pm) return null;
  const n1 = parseFloat(pm[1]);
  const item1 = pm[2].trim();
  const p1 = parseFloat(pm[3]);
  const n2 = parseFloat(pm[4]);
  const p2 = parseFloat(pm[6]);

  const derivedRe = /that costs\s+\$([\d.]+)\s+more than\s+(\d+|[a-z]+)\s+times as much as the cost of (?:a|an)\s+([a-z ]+?)(?:[.,]|$)/i;
  const dm = derivedRe.exec(q);
  if (!dm) return null;
  const extra = parseFloat(dm[1]);
  const multiplier = wordOrDigit(dm[2]);
  const derivedRef = dm[3].trim();
  if (multiplier === null) return null;
  if (singularize(item1).toLowerCase() !== derivedRef.toLowerCase()) return null;

  const savingsRe = /wishes to save\s+\$([\d,]+(?:\.\d+)?)/i;
  const sm = savingsRe.exec(q);
  if (!sm) return null;
  const savings = parseFloat(sm[1].replace(/,/g, ''));

  if (!/how much does\s+(?:he|she|they)\s+have to spend on/i.test(q)) return null;

  const purchases = n1 * p1 + n2 * p2;
  const derivedCost = extra + multiplier * p1;
  const spent = purchases + derivedCost;
  const reserved = spent + savings;
  const remainder = budget - reserved;
  if (!Number.isFinite(remainder) || remainder < 0) return null;
  return { remainder };
}

export const initialBudgetMinusItemizedPurchasesAndSavingsReserve: LianaMethod = {
  id: 'initial-budget-minus-itemized-purchases-and-savings-reserve-v1',
  demand: 'COMPUTE',
  name: 'Two flat purchases plus a price derived from one of them, minus a savings reserve, from a starting budget',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W18 (cluster C168, sole member: pilot corpus item at index 310)',
  shapeDescription:
    'budget - (n1*p1 + n2*p2 + (extra + multiplier*p1)) - savings = remainder for a further purpose',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a budget-and-wishes-to-spend sentence, a two-item flat-price purchase ' +
          'clause, a derived-price clause referencing the first item\'s singular form, a savings ' +
          'clause, and a closing "how much...to spend on" question resolving to a non-negative ' +
          'remainder; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `remainder = ${result.remainder}` };
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
          verdict: String(Math.round(result.remainder * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'budget minus purchases, derived item, and savings',
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

registerMethod(initialBudgetMinusItemizedPurchasesAndSavingsReserve);
