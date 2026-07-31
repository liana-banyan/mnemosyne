// plow_mc_schedule_solver.ts -- deterministic iterative "schedule solver" for loan/repayment
// word problems that the single-expression compute engine (compute_sidecar.ts's computeAnswer /
// computeUnitAwareMatch) structurally cannot solve: a fixed periodic payment against a
// DECLINING balance that accrues interest each period, terminating in a smaller final payment
// once the remaining balance drops below one full payment (the Founder's canonical "Mr. Scaccio"
// case -- see the worked example below).
//
// WHY THIS EXISTS: computeAnswer() only evaluates a SINGLE arithmetic expression (or asks a
// model to derive one) -- it has no notion of a period-by-period simulation loop, so it can
// never produce the correct $103.11 for a 5-months-of-$20-plus-a-final-partial-payment loan.
// computeUnitAwareMatch() is unit-algebra-aware but is still single-expression/single-fact --
// same structural gap. This module is a THIRD, independent tier, tried only after both existing
// tiers have already returned null (see the call site in plow_mc_answerer.ts's
// `if (answerType === 'computable')` block, immediately after the pre-existing "Cannot compute
// ... fall through" comment). It never touches or duplicates those two tiers' logic.
//
// CONSERVATISM (never guess): every extraction step below requires a confident, unambiguous
// regex match. Any missing/ambiguous piece (loan context, principal, payment, or a
// matching-period rate) returns null immediately -- this module never invents a number. The
// final option-match step uses the SAME "exactly one option qualifies" honesty gate every other
// compute tier in this repo uses (see compute_sidecar.ts's matchValueToOption /
// matchQuantityToOption docstrings): zero or 2+ qualifying options is an honest null, never a
// forced guess.
//
// WORKED EXAMPLE (Founder canonical, ground truth $103.11):
//   "Mr. Scaccio borrows $100 from his credit union and agrees to pay back $20 a month with
//    interest of 1% per month on the unpaid balance. How much does he pay?"
//   principal=100, payment=20, rate=1%/month, declining balance. Month-by-month:
//     M1: 100     + 1.00000  = 101.0000  -> pay 20 -> balance  81.0000  (paid so far  20.00)
//     M2:  81     + 0.81000  =  81.8100  -> pay 20 -> balance  61.8100  (paid so far  40.00)
//     M3:  61.81  + 0.61810  =  62.4281  -> pay 20 -> balance  42.4281  (paid so far  60.00)
//     M4:  42.4281+ 0.424281 =  42.8524  -> pay 20 -> balance  22.8524  (paid so far  80.00)
//     M5:  22.8524+ 0.228524 =  23.0809  -> pay 20 -> balance   3.0809  (paid so far 100.00)
//     M6:   3.0809+ 0.030809 =   3.1117  <= payment -> FINAL payment 3.1117, done
//   total paid = 100 + 3.1117... = 103.1117... -> $103.11, matches an MC option stated as
//   "$103.00" within the tolerance below (declining-balance amortization rounds ugly; the MC
//   dataset rounds to the nearest dollar).
//
// Rule 66: version, never overwrite -- this is a new file, no supersede needed.

import type { McOption } from './compute_sidecar';
import { extractNumber } from './compute_sidecar';

export interface ScheduleSolverResult {
  letter: string;
  value: number;
  /** The MC option's OWN stated numeric value (e.g. 103 for the text "$103.00"), distinct from
   *  `value` (our computed quantity, e.g. 103.1117...) -- same computed-value-vs-option-value
   *  distinction plow_mc_answerer.ts's other compute tiers surface via matchedOptionValue. */
  optionValue: number;
  provenance: string;
  trace: string;
}

/** Runaway guard only -- a real loan/payment/rate combination converges in well under 1000
 *  periods; this cap exists purely so a pathological/malformed extraction (e.g. a near-zero
 *  effective payment) can never spin forever. */
const MAX_PERIODS = 10000;

const PERIOD_WORD_RE = '(month|year|week|day)';

/** Same $/comma/decimal handling as compute_sidecar.ts's extractNumber, scoped to a single regex
 *  capture group's raw text rather than a whole free-text search, so callers stay in control of
 *  WHERE in the sentence the number is anchored (principal vs payment vs rate). */
function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').replace(/\$/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function normalizePeriod(word: string): string {
  return word.toLowerCase().replace(/s$/, '');
}

interface LoanStructure {
  principal: number;
  payment: number;
  ratePercent: number;
  period: string; // normalized singular: 'month' | 'year' | 'week' | 'day'
  decliningBalance: boolean;
  asksInterestOnly: boolean;
}

/** Conservative structural parse. Returns null the moment any REQUIRED piece (loan context,
 *  principal, payment, matching-period rate) is not confidently present -- see this file's
 *  header re: never-guess discipline. Deliberately does NOT attempt partial/best-effort
 *  extraction: a half-parsed loan structure is worse than an honest abstain. */
function parseLoanStructure(question: string): LoanStructure | null {
  // Loan/borrow context gate -- without this, a numerically-dense but unrelated question (e.g.
  // "a store marks up $20 items by 1% each month") could otherwise false-positive into this
  // solver. Requires an explicit borrow/loan/owe framing.
  if (!/\b(borrows?|borrowed|loan|owes?)\b/i.test(question)) return null;

  // Principal: "borrows $100", "loan of $100", "principal of $100", "owes $100"
  const principalMatch =
    question.match(/\bborrows?\s+\$?([\d,]+(?:\.\d+)?)/i) ??
    question.match(/\bloan\s+of\s+\$?([\d,]+(?:\.\d+)?)/i) ??
    question.match(/\bprincipal\s+of\s+\$?([\d,]+(?:\.\d+)?)/i) ??
    question.match(/\bowes?\s+\$?([\d,]+(?:\.\d+)?)/i);
  if (!principalMatch || !principalMatch[1]) return null;
  const principal = parseMoney(principalMatch[1]);
  if (principal === null || principal <= 0) return null;

  // Payment: "pay back $20 a month", "pays $50 per month", "payment of $50 each week",
  // or the adjective-first phrasing "monthly payment of $50".
  const paymentRe = new RegExp(
    `\\bpay(?:s|ing)?\\s*(?:back)?\\s*\\$?([\\d,]+(?:\\.\\d+)?)\\s*(?:a|per|each)\\s*${PERIOD_WORD_RE}\\b`,
    'i',
  );
  const paymentAdjRe = new RegExp(
    `\\b(monthly|yearly|annual|weekly|daily)\\s*payment\\s*of\\s*\\$?([\\d,]+(?:\\.\\d+)?)`,
    'i',
  );
  let payment: number | null = null;
  let paymentPeriod: string | null = null;
  const paymentMatch = question.match(paymentRe);
  if (paymentMatch && paymentMatch[1] && paymentMatch[2]) {
    payment = parseMoney(paymentMatch[1]);
    paymentPeriod = normalizePeriod(paymentMatch[2]);
  } else {
    const adjMatch = question.match(paymentAdjRe);
    if (adjMatch && adjMatch[1] && adjMatch[2]) {
      payment = parseMoney(adjMatch[2]);
      const adj = adjMatch[1].toLowerCase();
      paymentPeriod = adj.startsWith('month') ? 'month'
        : adj.startsWith('year') || adj.startsWith('annual') ? 'year'
        : adj.startsWith('week') ? 'week' : 'day';
    }
  }
  if (payment === null || payment <= 0 || !paymentPeriod) return null;

  // Rate: "interest of 1% per month", "1% interest per month", "1% monthly interest"
  const rateRe = new RegExp(
    `([\\d.]+)\\s*%\\s*(?:interest\\s*)?(?:per|a|each)\\s*${PERIOD_WORD_RE}\\b`,
    'i',
  );
  const rateAdjRe = /([\d.]+)\s*%\s*(monthly|yearly|annual|weekly|daily)\s*interest/i;
  let ratePercent: number | null = null;
  let ratePeriod: string | null = null;
  const rateMatch = question.match(rateRe);
  if (rateMatch && rateMatch[1] && rateMatch[2]) {
    ratePercent = parseFloat(rateMatch[1]);
    ratePeriod = normalizePeriod(rateMatch[2]);
  } else {
    const adjMatch = question.match(rateAdjRe);
    if (adjMatch && adjMatch[1] && adjMatch[2]) {
      ratePercent = parseFloat(adjMatch[1]);
      const adj = adjMatch[2].toLowerCase();
      ratePeriod = adj.startsWith('month') ? 'month'
        : adj.startsWith('year') || adj.startsWith('annual') ? 'year'
        : adj.startsWith('week') ? 'week' : 'day';
    }
  }
  if (ratePercent === null || !Number.isFinite(ratePercent) || ratePercent <= 0 || !ratePeriod) return null;

  // Payment period and rate period MUST match -- a mismatched-period problem (e.g. a monthly
  // payment against an annual rate) needs real compounding-period conversion this module does
  // not attempt; conservative null rather than a wrong simulation.
  if (paymentPeriod !== ratePeriod) return null;

  // Declining vs flat balance: explicit "unpaid/declining/outstanding/remaining balance" wording
  // is the common textbook phrasing and is treated as authoritative when present. Explicit
  // "original balance"/"original amount"/"flat rate" wording is treated as the flat-interest
  // reading (interest charged on the ORIGINAL principal every period, never declining). Absent
  // either signal, default to declining -- it is the overwhelmingly common convention for this
  // exact "borrows X, pays back Y a period with Z% interest" phrasing, and is the Founder's own
  // worked Scaccio case (which itself says "on the unpaid balance" explicitly).
  const flatSignal = /\b(original balance|original amount|original principal|flat rate|flat interest)\b/i.test(question);
  const decliningBalance = !flatSignal;

  const asksInterestOnly = /\bhow much interest\b/i.test(question);

  return { principal, payment, ratePercent, period: paymentPeriod, decliningBalance, asksInterestOnly };
}

/** Period-by-period simulation. Declining-balance case charges interest on the CURRENT balance
 *  each period, then applies the fixed payment; once the balance (after interest) is <= the
 *  fixed payment, that reduced amount becomes the final payment and the loan is closed -- this
 *  is what produces a final partial payment (e.g. $3.11 in the Scaccio case) rather than a clean
 *  N x fixed-payment total. Flat case charges interest on the ORIGINAL principal every period
 *  (never declining) until the loan closes the same way. Capped at MAX_PERIODS as a runaway
 *  guard; returns null (never guesses) if that cap is hit without the loan ever closing. */
function simulateSchedule(loan: LoanStructure): { totalPaid: number; periods: number; lines: string[] } | null {
  const lines: string[] = [];
  let balance = loan.principal;
  let totalPaid = 0;
  const rate = loan.ratePercent / 100;

  for (let i = 1; i <= MAX_PERIODS; i++) {
    const startBalance = balance;
    const interest = loan.decliningBalance ? startBalance * rate : loan.principal * rate;
    const balanceWithInterest = startBalance + interest;

    if (balanceWithInterest <= loan.payment + 1e-9) {
      totalPaid += balanceWithInterest;
      lines.push(
        `Period ${i}: balance ${startBalance.toFixed(4)} + interest ${interest.toFixed(4)} = ` +
        `${balanceWithInterest.toFixed(4)} <= payment ${loan.payment.toFixed(2)} -> FINAL payment ` +
        `${balanceWithInterest.toFixed(4)}, balance now 0.00`,
      );
      return { totalPaid, periods: i, lines };
    }

    totalPaid += loan.payment;
    balance = balanceWithInterest - loan.payment;
    lines.push(
      `Period ${i}: balance ${startBalance.toFixed(4)} + interest ${interest.toFixed(4)} = ` +
      `${balanceWithInterest.toFixed(4)} -> pay ${loan.payment.toFixed(2)} -> new balance ${balance.toFixed(4)}`,
    );
  }
  return null; // runaway guard tripped -- never converged, honest null
}

/** Matches a computed value to the SINGLE MC option within tolerance = max($0.50, 1% of the
 *  computed value) -- wide enough to accept a dataset option rounded to the nearest dollar (e.g.
 *  computed $103.1117 vs option "$103.00") without being so wide that two nearby distractor
 *  options both qualify. Zero or 2+ qualifying options is an honest null, matching every other
 *  compute tier's "exactly one option" gate in this repo (see compute_sidecar.ts). */
function matchToSingleOption(value: number, options: McOption[]): { letter: string; optionValue: number } | null {
  const tolerance = Math.max(0.5, 0.01 * Math.abs(value));
  const matches: { letter: string; optionValue: number }[] = [];
  for (const opt of options) {
    const optValue = extractNumber(opt.text);
    if (optValue === null) continue;
    if (Math.abs(optValue - value) <= tolerance) {
      matches.push({ letter: opt.letter, optionValue: optValue });
    }
  }
  if (matches.length !== 1) return null;
  return matches[0] as { letter: string; optionValue: number };
}

/** Top-level entry point. Pure, synchronous, no I/O. Returns null (never guesses) the moment any
 *  required piece of loan structure is not confidently extractable, the schedule fails to
 *  converge, or the computed quantity does not match EXACTLY ONE MC option within tolerance. See
 *  this file's header for the worked Scaccio example and the full conservatism rationale. */
export function solveScheduleProblem(questionText: string, options: McOption[]): ScheduleSolverResult | null {
  const loan = parseLoanStructure(questionText);
  if (!loan) return null;

  const sim = simulateSchedule(loan);
  if (!sim) return null;

  const value = loan.asksInterestOnly ? sim.totalPaid - loan.principal : sim.totalPaid;
  const matched = matchToSingleOption(value, options);
  if (!matched) return null;

  const trace =
    `schedule=${loan.decliningBalance ? 'declining_balance' : 'flat_balance'} ` +
    `principal=${loan.principal} payment=${loan.payment}/${loan.period} rate=${loan.ratePercent}%/${loan.period} ` +
    `periods=${sim.periods} totalPaid=${sim.totalPaid.toFixed(4)} asked=${loan.asksInterestOnly ? 'interest' : 'total_paid'} ` +
    `value=${value.toFixed(4)} matchedOption=${matched.letter}(${matched.optionValue}) | ` +
    sim.lines.join(' | ');

  return {
    letter: matched.letter,
    value,
    optionValue: matched.optionValue,
    provenance: 'deterministic_compute:schedule_amortization',
    trace,
  };
}
