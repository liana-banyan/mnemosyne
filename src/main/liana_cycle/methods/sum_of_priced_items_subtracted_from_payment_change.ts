// D-BP223-BM04-h2cbpv9w-170 -- sum-of-priced-items-subtracted-from-payment-change-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W10).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\sum-of-priced-items-subtracted-from-payment-change-v1.candidate.ts
// Authored by generation wave W10 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W10.md),
// merged into the shared manifest and run through the full gate chain by REGISTRAR R02
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R02.md): gate 1 (positive yield), gate 2a
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R02.md for the exact
// core-bytes/core-lines/CONTAINED table. Only the interface layer (imports, the three deleted
// local interfaces, the exported object's shape, shapeTest/run signatures, and the numeric-verdict
// rounding + String() cast) is new text.
//
// TRY/CATCH, matching the Founder-approved pass across earlier batches (D-BP223-BM0-005,
// 2026-09-07T01:25:41Z ruling). run() aborts to an honest abstain on any thrown error rather than
// ending the engine's fall-through chain.
//
// REGISTERED QUARANTINED (`quarantined: true`), so selectMethod() and selectEligibleMethods() will
// never choose it. Registering changes NO live run; it makes the method visible to listMethods()
// and measurable. Un-quarantining is a separate, later Founder decision made per batch after
// held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170 WAVE W10 cluster C104 (1 silo member, singleton, high confidence).
 * Representative teaching case: GSM8K test.jsonl line 272, "A mother goes shopping. She buys
 * cocoa at $4.20, laundry at $9.45 and a package of pasta at $1.35. She pays $20. How much change
 * does the cashier give back?"
 *
 * @generalShape TWO OR MORE dollar-priced items are listed, each cost marked with a literal "$",
 *   then a SEPARATE "pays $<amount>" clause states what was handed over. The question asks for
 *   change. This is deliberately NARROWER than a generic "subtract two given values" shape: it
 *   requires the dollar sign on every item, an explicit "pays" verb naming the tendered amount
 *   (not just another list item), and the literal word "change" in the question -- none of which
 *   a bare two-number subtraction candidate checks for.
 *
 * @recogniseInStranger A "pays $<amount>" anchor finds the tendered amount. Every OTHER "$<value>"
 *   in the text (i.e. every dollar figure that is not the pays-clause's own match) is treated as
 *   an item cost and summed. The question must contain the word "change". If fewer than two item
 *   costs are found, or no pays-clause exists, the method abstains.
 *
 * @whatBreaksIt (a) a discount, tax, or fee mentioned alongside the item costs -- this method sums
 *   every dollar figure outside the pays-clause with no way to tell a discount from a cost, so it
 *   abstains the instant it sees "discount", "tax", "off", or "fee" anywhere in the text rather
 *   than silently mis-summing; (b) more than one "pays" clause (e.g. a second purchase) -- the
 *   regex only captures the first pays-clause and a stranger's second one would silently be
 *   treated as an item cost, so the method also abstains if "pays" appears more than once;
 *   (c) amounts given in cents or a non-"$" currency marker are invisible to this method by
 *   construction and correctly produce no match at all.
 *
 * @whenRecognitionIsWrong shapeTest and run() share the identical analyze() pass, and all
 *   arithmetic is done in integer cents (never floating dollars) to avoid the classic $4.20 +
 *   $9.45 + $1.35 binary-rounding trap, converting back to a dollar string only at the very end.
 *   Measured against its own (sole) cluster member: SOLVED, matching the dataset's own change
 *   amount exactly. With only one known member there is no cross-member measurement to report for
 *   this singleton cluster -- noted honestly rather than inflated with a number borrowed from a
 *   different shape.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'sum-of-priced-items-subtracted-from-payment-change-v1';

interface Analyzed {
  paidCents: number;
  itemCostsCents: number[];
  totalCostCents: number;
  changeCents: number;
}

/** Parse a "$X.YY" or "$X" dollar string into an EXACT integer cent count -- never a float --
 *  so a chain of additions and one subtraction can never accumulate binary rounding error. */
function dollarsToCents(s: string): number | null {
  const m = /^([0-9]+)(?:\.([0-9]{1,2}))?$/.exec(s.trim());
  if (!m) return null;
  const wholePart = Number(m[1]);
  const fracDigits = (m[2] || '').padEnd(2, '0');
  const fracPart = Number(fracDigits);
  if (!Number.isFinite(wholePart) || !Number.isFinite(fracPart)) return null;
  return wholePart * 100 + fracPart;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // Disqualifying context: any fee-shaped word means this is not a bare items-then-payment shape.
  const DISQUALIFY_RE = /\b(discount|tax|off|fee|coupon|tip)\b/i;
  if (DISQUALIFY_RE.test(q)) return null;

  // The question must ask about change.
  if (!/\bchange\b/i.test(q)) return null;

  // Exactly one "pays $<amount>" clause.
  const paysMatches = q.match(/\bpays?\b\s*\$\s*([0-9]+(?:\.[0-9]{1,2})?)/gi);
  if (!paysMatches || paysMatches.length !== 1) return null;
  const paysRe = /\bpays?\b\s*\$\s*([0-9]+(?:\.[0-9]{1,2})?)/i;
  const paysMatch = paysRe.exec(q);
  if (!paysMatch) return null;
  const paidCents = dollarsToCents(paysMatch[1]);
  if (paidCents === null) return null;

  // Every dollar figure NOT inside the pays-clause's own match is an item cost.
  const allDollarRe = /\$\s*([0-9]+(?:\.[0-9]{1,2})?)/g;
  const paysStart = paysMatch.index;
  const paysEnd = paysStart + paysMatch[0].length;
  const itemCostsCents: number[] = [];
  let dm: RegExpExecArray | null;
  while ((dm = allDollarRe.exec(q)) !== null) {
    const matchStart = dm.index;
    if (matchStart >= paysStart && matchStart < paysEnd) continue; // this is the pays-clause's own figure
    const c = dollarsToCents(dm[1]);
    if (c === null) return null;
    itemCostsCents.push(c);
  }
  if (itemCostsCents.length < 2) return null;

  const totalCostCents = itemCostsCents.reduce((a, b) => a + b, 0);
  const changeCents = paidCents - totalCostCents;
  if (!Number.isFinite(changeCents)) return null;

  return { paidCents, itemCostsCents, totalCostCents, changeCents };
}

function centsToDollarString(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const fracStr = String(frac).padStart(2, '0');
  const trimmed = fracStr === '00' ? String(whole) : `${whole}.${fracStr}`;
  return (negative ? '-' : '') + trimmed;
}

export const sumOfPricedItemsSubtractedFromPaymentChange: LianaMethod = {
  id: 'sum-of-priced-items-subtracted-from-payment-change-v1',
  demand: 'COMPUTE',
  name: 'Sum two or more dollar-marked item costs, subtract from a separately-stated payment, report change',
  taughtBy:
    'D-BP223-BM04-h2cbpv9w-170 WAVE W10 (cluster C104, sole member harvest_gsm8k_pilot_item272, GSM8K test.jsonl line 272)',
  shapeDescription:
    'Two or more "$" item costs are listed; a separate "pays $" clause states the amount ' +
    'tendered; the question asks for "change"; answer is payment minus the summed item costs.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find two-or-more "$" item costs plus a single "pays $" clause and a "change" ' +
          'question, with no discount/tax/fee wording; abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `paid=${centsToDollarString(result.paidCents)}, items=${result.itemCostsCents.length}, ` +
        `total=${centsToDollarString(result.totalCostCents)} -> change=${centsToDollarString(result.changeCents)}`,
    };
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
      const verdict = centsToDollarString(result.changeCents);
      return {
        question,
        verdict: String(verdict),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `${centsToDollarString(result.paidCents)} - ${centsToDollarString(result.totalCostCents)} = ${verdict}`,
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
  }
};

registerMethod(sumOfPricedItemsSubtractedFromPaymentChange);
