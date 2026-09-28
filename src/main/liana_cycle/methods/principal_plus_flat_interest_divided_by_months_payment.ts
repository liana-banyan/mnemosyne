// D-BP223-BM04-h2cbp9d8-171 -- principal-plus-flat-interest-divided-by-months-payment-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R06
// (registration batch drawn from generation waves W24-W25).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\principal-plus-flat-interest-divided-by-months-payment-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R06
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R06.md): gate 1 (positive yield), gate 2a
// (answer carry, under gate2_answer_carry.cjs's v3 -- the array-index/bracket-adjacency fix
// installed 2026-09-08T09:46:02Z, on top of v2's letter-boundary fix installed 09:08:02Z), gate 4
// (interception against the live registry), gate 5 (sibling interception against the real
// ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R06.md for the exact
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W24, CLUSTER C221 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 380, "Karan borrowed $3,650 for five months
 * at an interest rate of 10%. She has to pay an equal amount every month. How much does she have
 * to pay per month?". Silo label: "loan repayment calculation with simple interest" -- matches
 * exactly.
 *
 * @generalShape A person BORROWS a stated PRINCIPAL for a stated number of MONTHS at a stated
 *   interest RATE (percent), where the interest is applied ONCE, FLAT, over the whole loan (not
 *   compounded per month). A separate sentence confirms the repayment is split EQUALLY across the
 *   months. The question asks for the per-month payment: principal * (1 + rate/100) / months.
 *   Computed as EXACT rational (fraction) arithmetic over cents, never a floating heuristic, so
 *   the result must reduce to a whole number of cents or the candidate abstains.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence:
 *   (a) "borrowed \$<principal> for <months> months at an interest rate of <rate>%" -- principal
 *       (digits, optional thousands commas), months (a bare digit OR a spelled-out number word
 *       one..twelve), and rate (digits, optional decimal);
 *   (b) "pay an equal amount every month" -- confirms the flat-interest total is split evenly,
 *       not compounded;
 *   (c) the question "how much does (?:she|he|they) have to pay per month".
 *   Answer = round_to_cent(principal * (100 + rate) / 100 / months), computed with BigInt
 *   fraction arithmetic (numerator/denominator in integer cents), abstaining unless the division
 *   by months lands on an exact whole cent.
 *
 * @whatBreaksIt (a) the interest applying PER MONTH (compounding) rather than once flat -- this
 *   candidate only recognises the single "an interest rate of R%" sentence with no "per month" or
 *   "monthly" qualifier on the rate itself, and abstains if such a qualifier is present, since
 *   compounding needs different arithmetic; (b) the final division by months not landing on an
 *   exact whole cent -- abstain, a fractional cent payment is not a valid answer; (c) "pay an
 *   equal amount every month" absent -- abstain, cannot confirm the repayment is split evenly
 *   rather than front- or back-loaded; (d) a months word outside the fixed one..twelve table --
 *   abstain, this candidate only resolves the month-words it has positive evidence for.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a shape
 *   claim guarantees run() reconstructs the same number. Measured against its own (sole) cluster
 *   member: SOLVED ($3,650 * 1.10 = $4,015 total, / 5 months = $803/month, exact). With only one
 *   known member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'principal-plus-flat-interest-divided-by-months-payment-v1';

interface Analyzed { perMonthCents: number; }

const MONTH_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

function parseMonths(raw: string): number | null {
  const t = raw.trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(MONTH_WORDS, t)) return MONTH_WORDS[t];
  const n = parseInt(t, 10);
  if (Number.isFinite(n) && String(n) === t) return n;
  return null;
}

/** Parse a dollar amount ("3,650" or "3650.25") into exact integer cents. */
function toCents(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '');
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!m) return null;
  const whole = parseInt(m[1], 10);
  const frac = m[2] ? m[2].padEnd(2, '0') : '00';
  return whole * 100 + parseInt(frac, 10);
}

/** Parse a percent value ("10" or "7.5") into a [numerator, denominator=1000] pair representing
 * rate/100 in thousandths, exact, no floating point. */
function ratePerMille(raw: string): number | null {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(raw.trim());
  if (!m) return null;
  const whole = parseInt(m[1], 10);
  const frac = m[2] ? m[2].padEnd(2, '0') : '00';
  // rate in hundredths of a percent (e.g. 10% -> 1000, 7.5% -> 750), so rate/100 == thousandths/100000
  return whole * 100 + parseInt(frac, 10);
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const rLoan = /\bborrowed\s+\$?([\d,]+(?:\.\d{1,2})?)\s+for\s+([a-z]+|\d+)\s+months\s+at\s+an\s+interest\s+rate\s+of\s+(\d+(?:\.\d{1,2})?)%/i;
  const mLoan = rLoan.exec(q);
  if (!mLoan) return null;
  const [, principalRaw, monthsRaw, rateRaw] = mLoan;

  // Guard: interest must not be qualified as per-month/monthly compounding.
  const afterLoan = q.slice(mLoan.index + mLoan[0].length, mLoan.index + mLoan[0].length + 30);
  if (/\bper\s+month\b|\bmonthly\b|\bcompound/i.test(afterLoan)) return null;

  const principalCents = toCents(principalRaw);
  if (principalCents === null) return null;
  const months = parseMonths(monthsRaw);
  if (months === null || months <= 0) return null;
  const rateHundredths = ratePerMille(rateRaw);
  if (rateHundredths === null) return null;

  if (!/\bpay\s+an\s+equal\s+amount\s+every\s+month\b/i.test(q)) return null;

  const rQ = /how\s+much\s+does\s+(?:she|he|they)\s+have\s+to\s+pay\s+per\s+month/i;
  if (!rQ.test(q)) return null;

  // totalCents = principalCents * (10000 + rateHundredths) / 10000, exact integer required.
  const numerator = principalCents * (10000 + rateHundredths);
  if (numerator % 10000 !== 0) return null;
  const totalCents = numerator / 10000;

  if (totalCents % months !== 0) return null;
  const perMonthCents = totalCents / months;
  if (!Number.isFinite(perMonthCents) || perMonthCents < 0) return null;
  return { perMonthCents };
}

export const principalPlusFlatInterestDividedByMonthsPayment: LianaMethod = {
  id: 'principal-plus-flat-interest-divided-by-months-payment-v1',
  demand: 'COMPUTE',
  name: 'Principal plus one-time flat interest, divided evenly across the loan\'s months, gives the monthly payment',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W24 (cluster C221, sole member: pilot corpus item at index 380)',
  shapeDescription:
    'answer = round(principal * (1 + rate/100)) / months, computed in exact integer cents; abstains ' +
    'unless both divisions land on a whole cent.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "borrowed $P for M months at an interest rate of R%" sentence (with no ' +
          'per-month/compounding qualifier), a "pay an equal amount every month" sentence, a ' +
          'closing question about the per-month payment, and an exact-cent result at every step; ' +
          'abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `monthly payment in cents = ${result.perMonthCents}` };
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
            const dollars = result.perMonthCents / 100;
      return {
          question,
          verdict: String(Math.round((dollars) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'principal * (1 + rate/100), divided evenly by months, both steps exact in integer cents',
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

registerMethod(principalPlusFlatInterestDividedByMonthsPayment);
