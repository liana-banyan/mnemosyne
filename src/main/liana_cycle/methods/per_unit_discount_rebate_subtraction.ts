// D-BP221-BM06-008 -- per-unit-discount-rebate-subtraction-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE.
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\harvest_gsm8k_pilot_item109_financial_transaction_with_a_discount_re.candidate.ts
//
// FIFTH item-10 method filed, fourth adapted by BM06. Local `LianaQuestionInput`, `ShapeTestResult`
// and `RunResult` deleted; the exported object now carries `: LianaMethod` and is checked against the
// real registry types. NEVER CAST, ANNOTATE.
//
// BEHAVIOR CORE BYTE-FOR-BYTE, and it is a big one: `DISQUALIFYING_KEYWORDS`, `countWholeWord()`,
// `MoneyMatch`, `extractMoneyAmounts()`, `extractBareIntegers()`, `AnalyzeResult` and `analyze()` are
// the candidate's own bytes, diffed clean. `MoneyMatch` and `AnalyzeResult` are helper types INSIDE
// the analysis and are kept: they are not interface-layer shims, they are how this method thinks.
//
// NO EXTRA ROUNDING HERE, AND THAT IS THE POINT. The candidate already rounds to cents itself
// (`Math.round(totalRaw * 100) / 100`) because this shape is money, and that rounding is part of the
// behavior the gates accepted. Adding the 1e6 convention on top would silently re-round an
// already-rounded currency figure. The value is stringified exactly as the accepted code computed it.

/**
 * @generalShape A flat per-unit price with a flat per-unit discount, rebate, or
 *   cashback subtracted before multiplying by the quantity purchased -- one
 *   uniform dollar-and-cents reduction applied identically to every unit, so
 *   the total is equivalently (quantity * price) - (quantity * discount) or
 *   quantity * (price - discount). There is exactly one quantity, exactly one
 *   per-unit sticker price, and exactly one per-unit reduction; no percentages,
 *   tiers, fees, or second items are involved anywhere in the derivation.
 *
 * @recogniseInStranger The question (a) contains exactly two dollar-amount
 *   tokens (a `$`-prefixed number each, e.g. "$3.00" and "$.20") -- one the
 *   sticker price, one the reduction; (b) contains exactly one bare (non-`$`,
 *   non-percent, non-decimal) integer anywhere in the text -- the quantity
 *   purchased; (c) uses one of "cashback", "rebate", or "discount" to name the
 *   reduction, and that word sits textually close (within ~40 characters) to
 *   exactly one of the two dollar amounts, letting the method tell price and
 *   reduction apart without guessing; (d) contains the whole word "per" at
 *   least once (the per-unit framing) and the whole word "after" at least once
 *   (asking for the total once the reduction is applied); and (e) contains none
 *   of a deliberately long blacklist of words signalling a different shape
 *   (percent sign, "percent", tax, tip, markup, profit, resale, bulk, tier,
 *   coupon code, minimum purchase, shipping, membership fee, interest, wage,
 *   salary, "each additional", "buy one", free, half, double, triple,
 *   fraction, average, combined). All five conditions must hold together; any
 *   single one missing means abstain.
 *
 * @whatBreaksIt A percentage-based reduction ("10% cashback") disguised so the
 *   number still looks plain once the '%' is stripped by a careless extractor;
 *   a second item or a tiered price (buy N at one price, the rest at another)
 *   that still yields exactly two dollar amounts and one bare integer by
 *   coincidence; a reduction word that appears in the text but describes
 *   something else entirely (e.g. a past, unrelated discount mentioned only as
 *   flavor text) sitting close enough to one dollar amount to be misread as
 *   the live discount; a reduction that is actually larger than or equal to
 *   the sticker price (a sign the parse latched onto the wrong two numbers);
 *   and a quantity that is itself the output of an earlier calculation in the
 *   same problem rather than a single stated integer, which would make the
 *   "exactly one bare integer" reading wrong even though the surface text
 *   still matches.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical
 *   analyze() pass, so if any single guard fails (wrong dollar-amount count,
 *   wrong bare-integer count, missing or ambiguous reduction keyword, missing
 *   "per"/"after", a disqualifying-keyword hit, a reduction that is not
 *   strictly smaller than the price, or a non-finite/negative result) the
 *   method abstains: verdict null, abstain true. An honest abstain costs
 *   nothing and the engine falls through to the next eligible method. A false
 *   MATCH would instead multiply the wrong pair of numbers and hand back a
 *   confident wrong total that ends the whole loop -- so every guard here is
 *   written to be over-inclusive in what it refuses, never in what it accepts,
 *   and quarantined:true keeps this method out of selection until it has been
 *   measured against held-out questions.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const DISQUALIFYING_KEYWORDS: string[] = [
  'percent', '%', 'tax', 'tip', 'markup', 'mark up', 'profit', 'loss',
  'resell', 'resale', 'bulk', 'tier', 'coupon code', 'minimum purchase',
  'shipping', 'membership fee', 'interest', 'loan', 'invest', 'mortgage',
  'wage', 'salary', 'hourly', 'overtime', 'commission', 'each additional',
  'additional charge', 'extra charge', 'buy one', 'free', 'half off',
  'half price', 'double', 'triple', 'quarter', 'fraction', 'ratio',
  'average', 'mean', 'combined', 'together with', 'equation', 'unknown',
  'variable', 'more than', 'fewer', 'less than', 'left', 'remain',
  'increase', 'decrease', 'raise', 'change back',
];

function countWholeWord(lowerText: string, word: string): number {
  const re = new RegExp(`\\b${word}\\b`, 'g');
  const m = lowerText.match(re);
  return m ? m.length : 0;
}

interface MoneyMatch {
  value: number;
  start: number;
  end: number;
}

// Pull `$`-prefixed dollar amounts only -- "$3.00", "$.20", "$20" all match.
// Deliberately does NOT match a bare number with no leading '$': that is a
// different signal (the quantity), handled separately below.
function extractMoneyAmounts(text: string): MoneyMatch[] {
  const results: MoneyMatch[] = [];
  const re = /\$\s*(?:\d+\.\d+|\.\d+|\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const digits = m[0].replace(/\$|\s/g, '');
    const value = parseFloat(digits);
    if (Number.isFinite(value) && value > 0) {
      results.push({ value, start: m.index, end: m.index + m[0].length });
    }
  }
  return results;
}

// Pull plain positive whole numbers that are NOT part of a `$` amount already
// captured above and are NOT immediately followed by '%' -- those belong to a
// different shape (a percentage) and must not be swept in as the quantity.
function extractBareIntegers(text: string, moneyRanges: Array<{ start: number; end: number }>): number[] {
  const results: number[] = [];
  const re = /\d+(?:\.\d+)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    if (raw.includes('.')) continue;
    const start = m.index;
    const end = start + raw.length;
    const overlapsMoney = moneyRanges.some((r) => start < r.end && end > r.start);
    if (overlapsMoney) continue;
    const after = text.slice(end, end + 1);
    if (after === '%') continue;
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) results.push(n);
  }
  return results;
}

interface AnalyzeResult {
  quantity: number;
  price: number;
  discount: number;
}

function analyze(rawQuestion: unknown): AnalyzeResult | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();
  const lower = q.toLowerCase();

  // Reject anything smelling like a different derivation entirely, even
  // before looking at the numbers.
  for (const kw of DISQUALIFYING_KEYWORDS) {
    if (lower.includes(kw)) return null;
  }

  // Must name the reduction with one of the three expected words.
  if (!/cashback|rebate|discount/.test(lower)) return null;

  // Must use per-unit framing and must ask for the total AFTER the reduction.
  if (countWholeWord(lower, 'per') < 1) return null;
  if (countWholeWord(lower, 'after') < 1) return null;

  const money = extractMoneyAmounts(q);
  if (money.length !== 2) return null;

  const bareInts = extractBareIntegers(
    q,
    money.map((m) => ({ start: m.start, end: m.end })),
  );
  if (bareInts.length !== 1) return null;
  const quantity = bareInts[0];
  if (!Number.isInteger(quantity) || quantity <= 0) return null;

  // Tell price apart from discount by whether a reduction word sits close
  // (within ~40 characters either side) to that particular dollar amount.
  // Exactly one of the two must qualify -- both or neither is ambiguous.
  const reductionNearby = /cashback|rebate|discount|off\b/;
  const flags = money.map((m) => {
    const windowStart = Math.max(0, m.start - 40);
    const windowEnd = Math.min(q.length, m.end + 40);
    return reductionNearby.test(lower.slice(windowStart, windowEnd));
  });
  const discountCount = flags.filter(Boolean).length;
  if (discountCount !== 1) return null;

  const discountIdx = flags.indexOf(true);
  const priceIdx = discountIdx === 0 ? 1 : 0;
  const price = money[priceIdx].value;
  const discount = money[discountIdx].value;

  if (!(price > 0) || !(discount > 0)) return null;
  // A reduction that is not strictly smaller than the sticker price is a sign
  // the parse latched onto the wrong pair of numbers -- abstain rather than
  // hand back a zero or negative per-unit cost.
  if (discount >= price) return null;

  return { quantity, price, discount };
}

const METHOD_ID = 'per-unit-discount-rebate-subtraction-v1';

export const perUnitDiscountRebateSubtractionMethod: LianaMethod = {
  id: METHOD_ID,
  demand: 'COMPUTE',
  name: 'Per-unit discount/rebate/cashback subtraction',
  taughtBy: 'D-BP221-BM0-075/SEG',
  shapeDescription:
    'A flat per-unit price and a flat per-unit discount/rebate/cashback, both ' +
    'applied over one stated quantity, combined as quantity * (price - discount).',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const question = input && input.question;
    const result = analyze(question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find exactly two dollar amounts plus exactly one bare ' +
          'quantity integer, with an unambiguous per-unit reduction word tied ' +
          'to just one of the two amounts, and no disqualifying keyword; ' +
          'abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason:
        `found quantity=${result.quantity}, price=$${result.price.toFixed(2)}, ` +
        `discount=$${result.discount.toFixed(2)} per unit`,
    };
  },

  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    const freeText = !input || input.options === null || input.options === undefined;

    try {
      const result = analyze(question);
      if (!result) {
        return {
          question, verdict: null, abstain: true, freeText, method: METHOD_ID,
          basis: 'shape did not hold at run time',
        };
      }
      const netPerUnit = result.price - result.discount;
      const totalRaw = result.quantity * netPerUnit;
      const total = Math.round(totalRaw * 100) / 100;
      if (!Number.isFinite(total) || total < 0) {
        return {
          question, verdict: null, abstain: true, freeText, method: METHOD_ID,
          basis: 'computed total was not a sane non-negative number',
        };
      }
      return {
        question,
        verdict: String(total),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `${result.quantity} * ($${result.price.toFixed(2)} - $${result.discount.toFixed(2)}) = ${total}`,
      };
    } catch (e) {
      // TRY/CATCH PASS, D-BP223-BM0-005, on the Founder's explicit approval 2026-09-07T01:25Z:
      // "Yes do the Try/Catch pass across the seven. Approved. Word." Same shape as the XO's
      // rate_distance_unit_pace.ts, so all seven now behave identically when run() throws:
      // ABSTAIN and say what threw, rather than letting the exception end the engine's
      // fall-through chain. An abstain is free; a thrown method is not.
      return {
        question: question,
        verdict: null,
        abstain: true,
        freeText,
        method: METHOD_ID,
        basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e),
      };
    }
  },
};

// REGISTERED AT IMPORT TIME. ACCEPTED by accept_gates.cjs, gate 1 then 2a then 4: 'solves its own
// shape, carries no answer, claims 1 and steals none'. ACCEPT is silent about interface fit.
registerMethod(perUnitDiscountRebateSubtractionMethod);
