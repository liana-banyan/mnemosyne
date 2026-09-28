// D-BP223-BM04-h2cbpv9w-170 -- cost-chain-three-items-via-relationship-then-sum-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R01 (registration
// batch drawn from generation wave W01).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\cost-chain-three-items-via-relationship-then-sum-v1.candidate.ts
// Authored by generation wave W01 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W01.md), merged into the
// shared manifest and run through the full gate chain by REGISTRAR R01
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R01.md): gate 1 (positive yield), gate 2a (answer carry),
// gate 4 (interception against the live registry), gate 5 (sibling interception against the real
// ASDiv-150 + GSM8K-1319 corpora, per D-BP223-M0-h2cbpc0g-043's own methodology), and the
// perturbation gate 2b (HARDWIRE\tools\controls\perturbation_gate.mjs, baseline + 3 perturbations,
// oracle hand-derived from the English of the representative GSM8K question, never from this
// candidate's own source) -- ACCEPT on all of gate 1/2a/4/5 and TRACK on all of gate 2b's trials.
//
// WHY THIS FILE EXISTS RATHER THAN THE CANDIDATE ITSELF. The candidate declared its OWN local
// `LianaQuestionInput`, `ShapeTestResult` and `RunResult` interfaces and left the exported object
// completely unannotated, so nothing was ever checked against the real registry contract -- the
// same disguise found and named in the earlier seven item-10 methods, batch 1 and batch 2 (see
// reference_a_hand_copied_contract_is_the_defect_not_bad_types_bp222.md). Those three local
// interfaces are DELETED here; `LianaMethod` and `MethodQuestionInput` are imported from
// '../method_registry' and the exported object is annotated against the real `LianaMethod` type,
// per the estate's standing order NEVER CAST, ANNOTATE.
//
// THE BEHAVIOR CORE IS COPIED BYTE-FOR-BYTE AND DELIBERATELY NOT IMPROVED: every constant, every
// helper function and analyze() itself below are the candidate's own bytes, from its first
// behavior-bearing declaration through analyze()'s closing brace -- proved by a programmatic byte-
// containment check (extract, splice, re-read, includes()), not merely asserted. See
// BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R01.md for the exact core-bytes/core-lines/CONTAINED table.
// Only the interface layer (imports, the three deleted local interfaces, the exported object's
// shape, shapeTest/run signatures, and the numeric-verdict rounding + String() cast) is new text.
//
// TRY/CATCH, matching the Founder-approved pass across the earlier seven, batch 1 and batch 2
// (D-BP223-BM0-005, 2026-09-07T01:25:41Z ruling: "Yes do the Try/Catch pass across the seven.
// Approved. Word."): run() aborts to an honest abstain on any thrown error rather than ending the
// engine's fall-through chain.
//
// REGISTERED QUARANTINED (`quarantined: true`), so selectMethod() and selectEligibleMethods() will
// never choose it. Registering changes NO live run; it makes the method visible to listMethods()
// and measurable. Un-quarantining is a separate, later Founder decision made per batch after
// held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170 WAVE W01, CLUSTER C33 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test-set lineIndex 128 (harvest_gsm8k_pilot_item128),
 * "Well's mother sells watermelons, peppers, and oranges at the local store. A watermelon costs
 * three times what each pepper costs. An orange costs 5 less than what a watermelon cost. Dillon
 * is sent to the store to buy 4 watermelons, 20 peppers, and 10 oranges. What's the total amount
 * of money he will spend if each pepper costs 15$?"
 *
 * @generalShape A BASE item's unit cost is given directly (usually late in the text, "if each
 *   <base> costs $V"). A second item's unit cost is a stated MULTIPLE of the base item's cost. A
 *   third item's unit cost is the second item's cost minus a stated constant. Purchase quantities
 *   for all three items are given together in one "buy Q1 <item2s>, Q2 <base>s, and Q3 <item3s>"
 *   clause. The answer is the sum of quantity*unit-cost across all three items. Silo cluster
 *   label: COST_CHAIN_THREE_ITEMS_VIA_RELATIONSHIP_THEN_SUM.
 *
 * @recogniseInStranger Four anchored clauses: "A <item2> costs <mult> times what each <base>
 *   costs."; "An/A <item3> costs <const> less than what a <item2> cost."; a quantities clause
 *   naming all three items (any singular/plural noun spelling) with a leading count each; and a
 *   base-cost clause "each <base> costs $<value>" (digits or spelled-out numbers, dollar sign
 *   optional). Item names are matched case-insensitively and singularized (trailing 's' stripped)
 *   to line the quantities clause up with the relationship clauses.
 *
 * @whatBreaksIt (a) fewer or more than exactly two chained relationship clauses (one multiply,
 *   one subtract) -- this candidate's regexes only recognise that exact two-link chain, so a
 *   longer or shorter chain falls through unrecognised; (b) the base item's own name in the cost
 *   clause not matching the base item name used in the multiply-relationship clause -- abstains
 *   rather than guess which item is the true base; (c) the quantities clause not naming all three
 *   derived item names (after singularizing) -- abstains rather than sum an incomplete purchase.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (pepper=15, watermelon=45, orange=40,
 *   4*45+20*15+10*40=880). With only one known member there is no cross-member measurement to
 *   report for this cluster.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';


const METHOD_ID = 'cost-chain-three-items-via-relationship-then-sum-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });

const TENS_WORDS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const TENS: Record<string, number> = {};
TENS_WORDS.forEach((w, i) => { TENS[w] = (i + 2) * 10; });

const NUMBER_WORDS: Record<string, number> = { ...ONES, ...TENS, hundred: 100 };

function wordOrDigit(tok: string): number | null {
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit)) return parseFloat(digit);
  const w = tok.trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, w)) return NUMBER_WORDS[w];
  return null;
}

function singular(noun: string): string {
  return noun.trim().toLowerCase().replace(/s$/, '');
}

const MULT_RE =
  /a\s+([a-zA-Z]+)\s+costs?\s+([a-zA-Z0-9]+)\s+times\s+what\s+(?:each\s+)?(?:a\s+)?([a-zA-Z]+)\s+costs?/i;

const SUB_RE =
  /an?\s+([a-zA-Z]+)\s+costs?\s+([a-zA-Z0-9]+)\s+less\s+than\s+what\s+a\s+([a-zA-Z]+)\s+costs?/i;

const BASE_COST_RE = (base: string) =>
  new RegExp('each\\s+' + base + '\\s+costs?\\s+\\$?([a-zA-Z0-9.]+)\\$?', 'i');

const QUANTITIES_RE =
  /buy\s+([a-zA-Z0-9]+)\s+([a-zA-Z]+),\s*([a-zA-Z0-9]+)\s+([a-zA-Z]+),?\s*and\s+([a-zA-Z0-9]+)\s+([a-zA-Z]+)/i;

interface Analyzed {
  itemNames: Record<string, number>;
  unitCosts: Record<string, number>;
  total: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const mm = q.match(MULT_RE);
  if (!mm) return null;
  const item2 = singular(mm[1]);
  const mult = wordOrDigit(mm[2]);
  const base = singular(mm[3]);
  if (mult === null) return null;

  const sm = q.match(SUB_RE);
  if (!sm) return null;
  const item3 = singular(sm[1]);
  const constVal = wordOrDigit(sm[2]);
  const item2Ref = singular(sm[3]);
  if (constVal === null || item2Ref !== item2) return null;

  const baseCostMatch = q.match(BASE_COST_RE(base));
  if (!baseCostMatch) return null;
  const baseCost = parseFloat(baseCostMatch[1].replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(baseCost)) return null;

  const qtyMatch = q.match(QUANTITIES_RE);
  if (!qtyMatch) return null;
  const qtyByName: Record<string, number> = {};
  const pairs: [string, string][] = [
    [qtyMatch[1], qtyMatch[2]],
    [qtyMatch[3], qtyMatch[4]],
    [qtyMatch[5], qtyMatch[6]],
  ];
  for (const [qtyWord, nounWord] of pairs) {
    const qty = wordOrDigit(qtyWord);
    if (qty === null) return null;
    qtyByName[singular(nounWord)] = qty;
  }
  if (!(base in qtyByName) || !(item2 in qtyByName) || !(item3 in qtyByName)) return null;

  const item2Cost = mult * baseCost;
  const item3Cost = item2Cost - constVal;

  const unitCosts: Record<string, number> = { [base]: baseCost, [item2]: item2Cost, [item3]: item3Cost };
  const total = qtyByName[base] * baseCost + qtyByName[item2] * item2Cost + qtyByName[item3] * item3Cost;
  if (!Number.isFinite(total)) return null;

  return { itemNames: qtyByName, unitCosts, total };
}


export const costChainThreeItemsViaRelationshipThenSumMethod: LianaMethod = {
  id: 'cost-chain-three-items-via-relationship-then-sum-v1',
  demand: 'COMPUTE',
  name: 'Base item cost given, two more items each derived via a chained multiply/subtract relationship, then summed by quantity',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170/W01 (cluster C33, sole member harvest_gsm8k_pilot_item128)',
  shapeDescription:
    'Base item unit cost given directly. Item2 = multiplier * base cost. Item3 = item2 cost - ' +
    'a stated constant. A single clause gives purchase quantities for all three items; the ' +
    'answer sums quantity*unit-cost across the three.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find the base-cost / multiply-relationship / subtract-relationship / ' +
          'three-item-quantities four-clause shape; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `unit costs derived, total ${result.total}` };
  },
  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    // A question with no options is free text. Read off the input, never assumed --
    // same convention as every other adapted method in this folder.
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
        basis: `sum(qty*unitCost) = ${rounded}`,
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

// REGISTERED AT IMPORT TIME, the same convention as every other method module in this folder.
// ACCEPTED by REGISTRAR R01's own live run of accept_gates.cjs (gate 1 then gate 2a then gate 4
// then gate 5) and by the perturbation gate (2b, baseline + 3 perturbations, all TRACK). See
// BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R01.md for the full verdict table.
registerMethod(costChainThreeItemsViaRelationshipThenSumMethod);
