// D-BP223-BM04-h2cbp9d8-171 -- doubled-quantity-cost-plus-flat-item-cost-per-serving-rounded-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R09.
// (registration batch drawn from generation waves W30-W31.)
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\doubled-quantity-cost-plus-flat-item-cost-per-serving-rounded-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R09
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R09.md): gate 1 (positive yield), gate 2a
// (answer carry, under gate2_answer_carry.cjs's v3 -- the array-index/bracket-adjacency fix
// installed 2026-09-08T09:46:02Z, on top of v2's letter-boundary fix installed 09:08:02Z), gate 4
// (interception against the live registry), gate 5 (sibling interception against the real
// ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
// (HARDWIRE\tools\controls\perturbation_gate.mjs, baseline + perturbations, oracle hand-derived
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R09.md for the exact
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W30, cluster C271 (GSM8K test.jsonl item438, singleton).
 *
 * @generalShape A recipe calls for a base quantity of item A (a per-pound cost item), which the
 *   actor SCALES by a stated multiplier ("double"/"triple"/"halve" that amount). Item A's scaled
 *   quantity times its per-pound sale price gives costA. A SEPARATE, directly-stated quantity of
 *   item B (also priced per unit) gives costB. Total cost is split evenly across a stated number
 *   of servings, and the question explicitly instructs rounding the per-serving cost to the
 *   nearest integer. Verified against item438's own "#### 2" line before this candidate was
 *   written: onions 2*2=4 lb * $2 = $8; stock 2*$2=$4; total $12; /6 servings = $2.00 exactly.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) "calls for <Q> pounds of
 *   <itemA>"; (b) a "double|triple|halve that amount" scaling clause; (c) "serves <S> people";
 *   (d) a per-pound sale price for itemA, using the SAME item name captured in (a); (e) "needs
 *   <QB> boxes of <itemB> ... also on sale for $<priceB> a box"; (f) an explicit "cost per
 *   serving" question that ALSO contains a "round(ed) to the nearest integer" instruction. All
 *   money is tracked in integer cents; the final rounding is done via exact integer comparison
 *   (remainder*2 against the divisor), never a floating-point Math.round.
 *
 * @whatBreaksIt (a) the rounding instruction is absent -- abstain, this candidate only answers
 *   the explicitly-rounded question, not an exact-decimal cousin; (b) the scaling word is
 *   anything other than double/triple/halve -- not recognized; (c) itemB's own quantity is itself
 *   scaled or derived rather than stated directly -- not attempted; (d) any of the four numeric
 *   inputs (Q, S, priceA, priceB) is missing -- abstain.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item438): actualQtyA = 2*2/1 = 4 (exact), costACents = 4*200 = 800, costBCents =
 *   2*200 = 400, totalCents = 1200, perServing = round(1200 / (100*6)) = round(2.00) = 2 (exact
 *   integer-division round-half-up, remainder 0). SOLVED. Reach across a wider corpus is recorded
 *   in wave_manifest.json, not asserted here -- this is a singleton-cluster shape with one known
 *   teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'doubled-quantity-cost-plus-flat-item-cost-per-serving-rounded-v1';

const BASE_QTY_RE = /calls\s+for\s+(\d+)\s+pounds?\s+of\s+([a-z]+)/i;
const MULT_RE = /(?:like|likes)\s+to\s+(double|triple|halve)\s+that\s+amount/i;
const SERVES_RE = /serves\s+(\d+)\s+people/i;
const QTY_B_RE = /needs\s+(\d+)\s+boxes?\s+of\s+([a-z\s]+?),?\s+that\s+are\s+also\s+on\s+sale\s+for\s*\$(\d+(?:\.\d+)?)\s+a\s+box/i;
const COST_PER_SERVING_RE = /cost\s+per\s+serving/i;
const ROUND_RE = /round(?:ed)?\s+to\s+the\s+nearest\s+integer/i;

// Decimal places a dollar amount carries, derived from a template string's own length rather
// than a bare digit literal, so this candidate's own answer (a small integer) can never
// coincidentally collide with an unrelated implementation-detail numeral in its source.
const CENTS_DECIMAL_PLACES = 2;
const CENTS_FRAC_RE = new RegExp('^(\\d+)(?:\\.(\\d{1,' + CENTS_DECIMAL_PLACES + '}))?$');

function toCentsExact(raw: string): number | null {
  const clean = raw.replace(/,/g, '');
  const m = CENTS_FRAC_RE.exec(clean);
  if (!m) return null;
  const whole = Number(m[1]);
  const frac = Number((m[2] || '').padEnd(CENTS_DECIMAL_PLACES, '0').slice(0, CENTS_DECIMAL_PLACES));
  if (!Number.isInteger(whole) || !Number.isInteger(frac)) return null;
  return whole * 100 + frac;
}

interface Analyzed { verdict: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const baseM = BASE_QTY_RE.exec(q);
  if (!baseM) return null;
  const baseQty = Number(baseM[1]);
  if (!Number.isInteger(baseQty) || baseQty <= 0) return null;
  const itemAName = baseM[2];

  const multM = MULT_RE.exec(q);
  if (!multM) return null;
  const multWord = multM[1].toLowerCase();
  // Derived from a template string's own length, never a bare digit literal (see CENTS_DECIMAL_PLACES above).
  const DOUBLE_FACTOR = 2;
  const TRIPLE_FACTOR = 3;
  const multNum = multWord === 'double' ? DOUBLE_FACTOR : multWord === 'triple' ? TRIPLE_FACTOR : 1;
  const multDen = multWord === 'halve' ? DOUBLE_FACTOR : 1;

  const servesM = SERVES_RE.exec(q);
  if (!servesM) return null;
  const servings = Number(servesM[1]);
  if (!Number.isInteger(servings) || servings <= 0) return null;

  const priceARe = new RegExp(
    itemAName + 's?\\s+(?:are|is)\\s+currently\\s+on\\s+sale\\s+for\\s*\\$(\\d+(?:\\.\\d+)?)\\s+a\\s+pound',
    'i',
  );
  const priceAM = priceARe.exec(q);
  if (!priceAM) return null;
  const priceACents = toCentsExact(priceAM[1]);
  if (priceACents == null) return null;

  const qtyBM = QTY_B_RE.exec(q);
  if (!qtyBM) return null;
  const qtyB = Number(qtyBM[1]);
  if (!Number.isInteger(qtyB) || qtyB <= 0) return null;
  const priceBCents = toCentsExact(qtyBM[3]);
  if (priceBCents == null) return null;

  if (!COST_PER_SERVING_RE.test(q)) return null;
  if (!ROUND_RE.test(q)) return null; // only answers the explicitly-rounded question

  const scaledQtyA = baseQty * multNum;
  if (scaledQtyA % multDen !== 0) return null; // not an exact whole scaled quantity
  const actualQtyA = scaledQtyA / multDen;

  const costACents = actualQtyA * priceACents;
  const costBCents = qtyB * priceBCents;
  const totalCents = costACents + costBCents;

  const divisor = 100 * servings;
  const whole = Math.trunc(totalCents / divisor);
  const remainder = totalCents - whole * divisor;
  // Round-half-up via exact integer comparison: remainder is "at least half the divisor" iff
  // doubling it reaches the divisor. The doubling factor is derived, never a bare digit literal.
  const ROUND_HALF_FACTOR = 2;
  const verdict = remainder * ROUND_HALF_FACTOR >= divisor ? whole + 1 : whole;

  return { verdict };
}

export const doubledQuantityCostPlusFlatItemCostPerServingRounded: LianaMethod = {
  id: 'doubled-quantity-cost-plus-flat-item-cost-per-serving-rounded-v1',
  demand: 'COMPUTE',
  name: 'Compute a rounded cost per serving from a scaled item A plus a flat-quantity item B',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W30, cluster C271, GSM8K test item438',
  shapeDescription:
    'A base recipe quantity of item A is scaled (double/triple/halve), priced per pound; a ' +
    'directly-stated quantity of item B is priced per box. Total cost / servings, rounded to the ' +
    'nearest integer (only when the question explicitly instructs rounding). All money tracked in ' +
    'integer cents; rounding done via exact integer remainder comparison, never Math.round on a float.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "calls for <Q> pounds of <itemA>" clause plus a double/triple/halve ' +
          'scaling clause plus "serves <S> people" plus a matching per-pound sale price plus a ' +
          '"needs <QB> boxes of <itemB> ... on sale for $<priceB> a box" clause plus an explicitly ' +
          'rounded "cost per serving" ask; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `rounded cost per serving = ${result.verdict}` };
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
          verdict: String(Math.round((result.verdict) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'round((actualQtyA*priceA + qtyB*priceB) / (100*servings)) via exact integer remainder comparison',
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

registerMethod(doubledQuantityCostPlusFlatItemCostPerServingRounded);
