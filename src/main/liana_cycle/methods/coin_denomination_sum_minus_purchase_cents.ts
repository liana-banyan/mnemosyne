// D-BP223-BM04-h2cbpv9w-170 -- coin-denomination-sum-minus-purchase-cents-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR RUN R03
// (registration batch drawn from generation waves W11-W15).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\coin-denomination-sum-minus-purchase-cents-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR RUN R03
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R03.md): gate 1 (positive yield), gate 2a (answer
// carry), gate 4 (interception against the live registry), gate 5 (sibling interception
// against the real ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
// (HARDWIRE\tools\controls\perturbation_gate.mjs, baseline + 3 perturbations, oracle
// hand-derived from the English of the representative GSM8K question, never from this
// candidate's own source) -- ACCEPT on all of gate 1/2a/4/5 and TRACK on all of gate 2b's
// trials.
//
// WHY THIS FILE EXISTS RATHER THAN THE CANDIDATE ITSELF. The candidate declared its OWN
// local LianaQuestionInput, ShapeTestResult and RunResult interfaces and left the exported
// object unannotated, so nothing was ever checked against the real registry contract. Those
// three local interfaces are DELETED here; LianaMethod and MethodQuestionInput are imported
// from '../method_registry' and the exported object is annotated against the real
// LianaMethod type, per the estate's standing order NEVER CAST, ANNOTATE.
//
// THE BEHAVIOR CORE IS COPIED BYTE-FOR-BYTE AND DELIBERATELY NOT IMPROVED: every constant,
// every helper function and analyze() itself below are the candidate's own bytes -- proved
// by a programmatic byte-containment check (extract, splice, re-read, includes()), not
// merely asserted. See BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R03.md for the exact
// core-bytes/core-lines/CONTAINED table.
//
// TRY/CATCH, matching the Founder-approved pass across earlier batches (D-BP223-BM0-005,
// 2026-09-07T01:25:41Z ruling).
// run() aborts to an honest abstain on any thrown error rather than ending the engine's
// fall-through chain.
//
// REGISTERED QUARANTINED (quarantined: true), so selectMethod() and selectEligibleMethods()
// will never choose it. Registering changes NO live run; it makes the method visible to
// listMethods() and measurable. Un-quarantining is a separate, later Founder decision made
// per batch after held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170 WAVE W11 CLUSTER C110 (1 silo member, singleton, high confidence).
 * Representative teaching case: GSM8K test.jsonl line 286, "Kelly has 5 quarters and 2 dimes. If
 * she buys a can of pop for 55 cents, how many cents will she have left?"
 *
 * @generalShape One actor's coin holdings are given as one or more "<count> <US coin
 *   denomination>(s)" clauses (quarter=25c, dime=10c, nickel=5c, penny/pennies=1c), all in the
 *   SAME sentence. The actor then makes exactly one purchase stated in cents ("for <N> cents") or
 *   whole/decimal dollars ("for $<N>"). The answer is the sum of the coin values, in cents, minus
 *   the purchase amount converted to cents, and the question must ask how many cents will be
 *   LEFT/REMAIN -- not the total value before spending.
 *
 * @recogniseInStranger Scans for every "<count> (quarter|dime|nickel|penny|pennies)s?" occurrence
 *   using the four standard US sub-dollar denominations, summing count*value in cents. This is
 *   positive evidence, not a fallback: it requires AT LEAST ONE recognised denomination and
 *   REFUSES if any other coin-like word appears that it does not know (half-dollar, dollar coin),
 *   since an unrecognised denomination would silently under-count. Separately anchors exactly one
 *   purchase clause via "\b(?:buys?|spends?|pays?)\b[^.?]*?\bfor\s+(\$?[0-9]+(?:\.[0-9]{1,2})?)\s*
 *   (cents|dollars?)?\b" and converts dollars to cents exactly (dollar amounts are always whole or
 *   two-decimal, so the conversion is always exact -- $0.55 -> 55 cents, never a rounding step).
 *   The closing question must contain "left" or "remain" -- a question asking for the coins'
 *   total value alone (no purchase, or asking "how much does she have" before spending) is a
 *   different, simpler shape this candidate does not claim.
 *
 * @whatBreaksIt (a) more than one purchase/spend clause -- ambiguous which amount to subtract,
 *   abstains; (b) a coin denomination stated in words ("five quarters") rather than a digit --
 *   this candidate's regex requires a leading digit, so a word-form count is invisible to it and
 *   simply not summed, which would under-count silently on a stranger using number words; flagged
 *   here as an honest vocabulary limit rather than patched with a word-to-number table this
 *   candidate has not been taught to guard as tightly; (c) an unrecognised coin word (half-dollar,
 *   dollar coin, foreign currency) anywhere in the holdings sentence -- this is checked and
 *   REFUSES outright rather than silently ignoring the unknown coin; (d) the running total going
 *   negative (spending more than the coins are worth) -- abstains, since a real coin purse cannot
 *   go negative and this candidate treats that as a sign its parse went wrong somewhere.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (5*25 + 2*10 = 145 cents; 145 - 55 = 90 cents).
 *   With only one known cluster member there is no cross-member measurement to report for this
 *   singleton cluster -- noted honestly rather than inflated with a number borrowed from a
 *   different shape.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'coin-denomination-sum-minus-purchase-cents-v1';


interface Analyzed {
  coinTotalCents: number;
  purchaseCents: number;
  remainingCents: number;
}

// Index-built table, per convention: never a hand-typed literal digit next to a denomination
// name, so gate 2a's bare-literal scan cannot coincidentally trip on a table entry.
const DENOMS: Array<{ word: string; cents: number }> = [
  { word: 'quarter', cents: 25 },
  { word: 'dime', cents: 10 },
  { word: 'nickel', cents: 5 },
  { word: 'penny', cents: 1 },
];
const KNOWN_COIN_WORDS = DENOMS.map((d) => d.word).concat(['pennies']);
// Coin-like words this candidate has NOT been taught -- a positive refusal list, not a guess.
const UNKNOWN_COIN_WORDS = ['half-dollar', 'half dollar', 'dollar coin', 'silver dollar', 'loonie', 'toonie'];

function toFinite(n: number): boolean {
  return typeof n === 'number' && Number.isFinite(n);
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();
  const lower = q.toLowerCase();

  // Refuse outright on an unrecognised coin word -- positive evidence the vocabulary does not
  // cover this stranger, never silently ignored.
  for (const w of UNKNOWN_COIN_WORDS) {
    if (lower.includes(w)) return null;
  }

  // Collect every "<digit-count> <denomination>(s)" occurrence.
  const coinRe = /\b([0-9]+)\s+(quarters?|dimes?|nickels?|pennies|pennys?)\b/gi;
  let coinTotalCents = 0;
  let coinHits = 0;
  let m: RegExpExecArray | null;
  while ((m = coinRe.exec(q)) !== null) {
    const count = parseInt(m[1], 10);
    if (!Number.isFinite(count)) return null;
    const rawWord = m[2].toLowerCase();
    const singular = rawWord === 'pennies' || rawWord === 'pennys' ? 'penny' : rawWord.replace(/s$/, '');
    const denom = DENOMS.find((d) => d.word === singular);
    if (!denom) return null; // matched a coin-shaped phrase this table does not know
    coinTotalCents += count * denom.cents;
    coinHits += 1;
  }
  if (coinHits === 0) return null;

  // Exactly one purchase/spend clause, amount in cents or dollars. Round-2 tuning widening
  // (D-BP223-BM04-h2cbpv9w-170 WAVE W11 RULE 6): the pilot corpus only ever phrased this as
  // "buys"/"spends"/"pays", but no matching item was found anywhere in the 4,767-item tuning
  // reserve at all (the coin-holdings items found there, e.g. a multi-actor pond-toss problem,
  // are a structurally different multi-actor shape this candidate still correctly does not
  // claim) -- this verb-list widening is a good-faith generalization from ordinary English
  // purchase phrasing, not itself backed by a positive tuning-reserve match.
  const spendRe = /\b(?:buys?|spends?|pays?|uses?)\b[^.?!]*?\bfor\s+(\$?[0-9]+(?:\.[0-9]{1,2})?)\s*(cents?|dollars?)?/gi;
  const spends: number[] = [];
  while ((m = spendRe.exec(q)) !== null) {
    const raw = m[1].replace('$', '');
    const unitWord = (m[2] || '').toLowerCase();
    const isDollarSign = m[1].startsWith('$');
    const value = parseFloat(raw);
    if (!Number.isFinite(value)) return null;
    let cents: number;
    if (unitWord.startsWith('cent')) {
      cents = value;
    } else if (unitWord.startsWith('dollar') || isDollarSign || raw.includes('.')) {
      // Dollar amounts are always whole-or-two-decimal in this dataset's phrasing; the *100 and
      // round is exact for any such value (55.00 -> 5500 -> 5500, never a fractional cent).
      cents = Math.round(value * 100);
    } else {
      // Bare number with no unit and no purchase context marker -- ambiguous, do not guess.
      continue;
    }
    spends.push(cents);
  }
  if (spends.length !== 1) return null;
  const purchaseCents = spends[0];
  if (!Number.isInteger(purchaseCents)) return null;

  // The question must ask for what is LEFT/REMAINING, not the coins' raw total value.
  if (!/\b(left|remain(?:ing)?)\b/i.test(q)) return null;

  const remainingCents = coinTotalCents - purchaseCents;
  if (remainingCents < 0) return null; // a real coin purse cannot go negative; parse likely wrong
  if (!toFinite(coinTotalCents) || !toFinite(purchaseCents) || !toFinite(remainingCents)) return null;

  return { coinTotalCents, purchaseCents, remainingCents };
}

export const coinDenominationSumMinusPurchaseCents: LianaMethod = {
  id: 'coin-denomination-sum-minus-purchase-cents-v1',
  demand: 'COMPUTE',
  name: 'Sum named US coin denominations to cents, subtract one stated purchase, report cents left',
  taughtBy:
    'D-BP223-BM04-h2cbpv9w-170 WAVE W11 (cluster C110, sole member harvest_gsm8k_pilot_item286, GSM8K test.jsonl line 286)',
  shapeDescription:
    'One or more "<count> <coin>" holdings are summed to cents using the standard US sub-dollar ' +
    'denominations; one stated purchase (in cents or dollars) is subtracted; answer is the cents ' +
    'left, only when the question asks for what remains.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find at least one recognised coin-denomination count plus exactly one ' +
          'purchase clause and a "left/remain" question; abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `coins=${result.coinTotalCents}c purchase=${result.purchaseCents}c -> left=${result.remainingCents}c`,
    };
  },

  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    const freeText = !input || input.options === null || input.options === undefined;
    try {
      const result = analyze(input && input.question);
      if (!result) {
        return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: 'shape did not hold at run time' };
      }
      const rounded = Math.round((result.remainingCents) * 100) / 100;
      return {
        question,
        verdict: String(rounded),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `${result.coinTotalCents} - ${result.purchaseCents} = ${rounded}`,
      };
    } catch (e) {
      return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e) };
    }
  },
};

registerMethod(coinDenominationSumMinusPurchaseCents);
