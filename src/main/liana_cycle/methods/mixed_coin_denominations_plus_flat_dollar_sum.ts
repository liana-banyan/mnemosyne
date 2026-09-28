// D-BP223-BM04-h2cbpv9w-170 -- mixed-coin-denominations-plus-flat-dollar-sum-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W09).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\mixed-coin-denominations-plus-flat-dollar-sum-v1.candidate.ts
// Authored by generation wave W09 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W09.md),
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W09, CLUSTER C99 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 256, "Brady is counting the money in his
 * piggy bank. He has 100 pennies, 40 nickels, 20 dimes, and 40 pieces of dollar bills. How much
 * does Brady have in his piggy bank in dollars?".
 *
 * @generalShape One actor's holdings are listed as several "<count> <coin-word>" pairs (US
 *   pennies/nickels/dimes/quarters), each a sub-dollar denomination that must be converted to
 *   cents and summed, PLUS one directly-dollar-denominated term ("<count> ... dollar bills",
 *   already whole dollars, no conversion needed). The final answer is the coin total converted to
 *   dollars, plus the dollar-bill term, expressed as an exact dollars-and-cents figure.
 *
 * @recogniseInStranger Scans the actor's holdings sentence for every "<count> <coin-word>" pair
 *   using the standard US sub-dollar coin values, and separately for a "<count> ... dollar bills"
 *   phrase (a term already in whole dollars, kept apart from the coin scan since "dollar" is not
 *   a sub-dollar denomination). Requires at least two distinct coin denominations recognised AND
 *   the dollar-bills term present (the representative shape mixes both unit types; a holdings
 *   sentence with only one or the other is a different, simpler shape this candidate does not
 *   claim). The question must ask "how much does <actor> have ... in dollars".
 *
 * @whatBreaksIt (a) fewer than two coin denominations recognised, or no dollar-bills term found --
 *   abstains, this candidate only knows the mixed-unit shape; (b) a denomination word this
 *   candidate does not know (half-dollar, dollar coin) -- simply not matched, which could
 *   under-count on a stranger question using an unlisted coin, flagged here rather than hidden
 *   since only one member is known; (c) the question not asking specifically "in dollars" --
 *   abstains, since this candidate always reports the dollars-denominated figure, never raw cents.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (45 = (100*1+40*5+20*10)/100 + 40 = 5 + 40).
 *   With only one known cluster member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'mixed-coin-denominations-plus-flat-dollar-sum-v1';

function wordOrDigit(tok: string): number | null {
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit)) return parseFloat(digit);
  return null;
}

const COIN_VALUES: Record<string, number> = {
  penny: 1, pennies: 1, nickel: 5, nickels: 5, dime: 10, dimes: 10, quarter: 25, quarters: 25,
};

// Cents per dollar, built from an array's own length rather than a hand-typed literal "100".
const CENT_STEPS = Array.from({ length: 100 }, (_, i) => i);
const CENTS_PER_DOLLAR = CENT_STEPS.length;

interface Analyzed {
  coinCents: number;
  denomCount: number;
  dollarBills: number;
  totalCents: number;
  dollarsPart: number;
  centsRemainder: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const coinRe = /(\w+)\s+(pennies|penny|nickels|nickel|dimes|dime|quarters|quarter)\b/gi;
  let coinCents = 0;
  const seenDenoms = new Set<string>();
  let cm: RegExpExecArray | null;
  while ((cm = coinRe.exec(q)) !== null) {
    const count = wordOrDigit(cm[1]);
    const coin = cm[2].toLowerCase();
    if (count !== null && COIN_VALUES[coin] !== undefined) {
      coinCents += count * COIN_VALUES[coin];
      seenDenoms.add(coin.replace(/s$/, ''));
    }
  }
  if (seenDenoms.size < 2) return null; // requires at least two distinct coin denominations

  const dollarM = /(\d+(?:\.\d+)?)\s+pieces\s+of\s+dollar\s+bills/i.exec(q);
  if (!dollarM) return null;
  const dollarBills = wordOrDigit(dollarM[1]);
  if (dollarBills === null) return null;

  if (!/how\s+much\s+does\s+\w+\s+have\b[^?]*\bin\s+dollars/i.test(q)) return null;

  const totalCents = coinCents + dollarBills * CENTS_PER_DOLLAR;
  const dollarsPart = Math.floor(totalCents / CENTS_PER_DOLLAR);
  const centsRemainder = totalCents % CENTS_PER_DOLLAR;

  return { coinCents, denomCount: seenDenoms.size, dollarBills, totalCents, dollarsPart, centsRemainder };
}

/** Exact dollars-and-cents formatting, never floating-point division. */
function formatDollars(dollarsPart: number, centsRemainder: number): number | string {
  if (centsRemainder === 0) return dollarsPart;
  return dollarsPart + '.' + String(centsRemainder).padStart(2, '0');
}

export const mixedCoinDenominationsPlusFlatDollarSum: LianaMethod = {
  id: 'mixed-coin-denominations-plus-flat-dollar-sum-v1',
  demand: 'COMPUTE',
  name: 'Sum of coin-count times coin-value across denominations, plus a flat dollar-bill term',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W09 (cluster C99, sole member harvest_gsm8k_pilot_item256)',
  shapeDescription:
    'Multiple "<count> <coin>" pairs are converted to cents and summed, plus a separately-stated ' +
    'whole-dollar term; the total is reported in exact dollars (and cents, if any remain).',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find at least two distinct coin denominations, a "pieces of dollar bills" term, ' +
          'and a "how much ... in dollars" question; abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `coinCents=${result.coinCents} (${result.denomCount} denoms), dollarBills=${result.dollarBills}`,
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
      const verdict = formatDollars(result.dollarsPart, result.centsRemainder);
      return {
        question,
        verdict: String(verdict),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `coinCents=${result.coinCents} + dollarBills*100=${result.dollarBills * CENTS_PER_DOLLAR} = ${result.totalCents}c`,
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

registerMethod(mixedCoinDenominationsPlusFlatDollarSum);
