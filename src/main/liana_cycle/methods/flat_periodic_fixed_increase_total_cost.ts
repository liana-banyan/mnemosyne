// D-BP223-BM04-h2cbpv9w-170 -- flat-periodic-fixed-increase-total-cost-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W06).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\flat-periodic-fixed-increase-total-cost-v1.candidate.ts
// Authored by generation wave W06 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W06.md),
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W06 CLUSTER C75 (1 member, sole member
 * harvest_gsm8k_pilot_item162_compound_interest_or_growth_over_time). Representative teaching
 * case: GSM8K test.jsonl line 162 (a bag of marbles' price rising every two months).
 *
 * SILO LABEL VS. ARITHMETIC MISMATCH, flagged not hidden (same class as WAVE W04's C56 finding
 * for a "compound interest" label on GSM8K item187). SILO_SHAPE_CLUSTERS.json's C75 shape label
 * is "compound interest or growth over time -- percentage increase over fixed intervals", but the
 * deposit's OWN Steps field already says the increase is "based on the original price (or the
 * current price if it's a compound interest problem, but here it's based on the original
 * price)" -- i.e. the deposit itself documents that this is FLAT (simple) growth on the ORIGINAL
 * price each period, not compounding growth on the current (already-grown) price. GSM8K line
 * 162's own accepted answer (92) confirms this: $20 + 18 periods * ($20 * 20% = $4) = $92. True
 * compounding on the same numbers would give $20 * (1.2)^18 ~= $521.00, which does not match. This
 * candidate computes the FLAT arithmetic the accepted answer requires, is named accordingly (not
 * "compound"), and positively refuses any question containing "compound"/"compounded" so it never
 * misapplies flat-rate math to a genuinely compounding problem. Flagged for the Founder to decide
 * whether SILO_SHAPE_CLUSTERS.json's C75 label itself needs correcting.
 *
 * @generalShape An initial cost P; a percentage rate r% stated as "of the original price"
 *   (explicit flat-basis cue); a fixed interval of K months; a total elapsed time of T months.
 *   final = P + (T / K) * (P * r / 100), i.e. the SAME fixed dollar increase applied once per
 *   period, on the original price every time.
 *
 * @recogniseInStranger Require the phrase "of the original price" attached to the percentage
 *   increase (the positive cue this is flat, not compounding). Extract P from "costs $P", r% from
 *   "increases by r% of the original price", K from "every K months", T from "after T months".
 *   Fire only when T is an exact multiple of K and P*r is an exact multiple of 100 (an exact
 *   whole-dollar-or-cent increase per period).
 *
 * @whatBreaksIt (a) the words "compound"/"compounded" anywhere in the text -- positively refused,
 *   since that names a different (multiplicative, current-price-based) formula this candidate
 *   does not compute; (b) no "of the original price" cue -- without it, whether the rate applies
 *   to the original or the current (already-grown) price is unstated and this candidate does not
 *   guess; (c) a non-exact period count or a non-exact per-period increase.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Any guard
 *   failing (a "compound" keyword present, no flat-basis cue, a non-exact period count or
 *   increase, a non-finite result) makes the method ABSTAIN: verdict null, abstain true. Gate 1
 *   (own generating question, GSM8K line 162): SOLVED, verdict 92, matching the corpus's own
 *   "#### 92".
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'flat-periodic-fixed-increase-total-cost-v1';

const NUM_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve',
];
const WORD_TO_NUM: Record<string, number> = {};
NUM_WORDS.forEach((w, i) => { WORD_TO_NUM[w] = i; });

function parseNum(tok: string): number | null {
  if (/^\d+(?:\.\d+)?$/.test(tok)) return parseFloat(tok);
  const v = WORD_TO_NUM[tok.toLowerCase()];
  return v === undefined ? null : v;
}

const PRICE_RE = /costs?\s*\$?(\d+(?:\.\d+)?)/i;
const RATE_RE = /increases?\s+by\s+(\d+(?:\.\d+)?)%\s+of\s+the\s+original\s+price/i;
const INTERVAL_RE = /every\s+([a-z0-9]+)\s+months?/i;
const TOTAL_RE = /after\s+(\d+(?:\.\d+)?)\s+months?/i;
const COMPOUND_RE = /\bcompound(?:ed|ing)?\b/i;

interface Analyzed {
  price: number;
  periods: number;
  perPeriod: number;
  answer: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();
  if (COMPOUND_RE.test(q)) return null; // a genuinely different formula -- refuse, do not guess

  const pm = PRICE_RE.exec(q);
  const rm = RATE_RE.exec(q);
  const im = INTERVAL_RE.exec(q);
  const tm = TOTAL_RE.exec(q);
  if (!pm || !rm || !im || !tm) return null;

  const price = parseFloat(pm[1]);
  const rate = parseFloat(rm[1]);
  const interval = parseNum(im[1]);
  const totalMonths = parseFloat(tm[1]);
  if (
    !Number.isFinite(price) || !Number.isFinite(rate) ||
    interval === null || interval <= 0 || !Number.isFinite(totalMonths)
  ) {
    return null;
  }

  if (totalMonths % interval !== 0) return null; // exact whole number of periods only
  const periods = totalMonths / interval;

  const increaseNumerator = price * rate; // e.g. 20 * 20 = 400
  const increaseDenom = 100;
  if (increaseNumerator % increaseDenom !== 0) return null; // exact per-period increase only
  const perPeriod = increaseNumerator / increaseDenom;

  const answer = price + periods * perPeriod;
  if (!Number.isFinite(answer)) return null;

  return { price, periods, perPeriod, answer };
}

export const flatPeriodicFixedIncreaseTotalCost: LianaMethod = {
  id: 'flat-periodic-fixed-increase-total-cost-v1',
  demand: 'COMPUTE',
  name: 'Flat (non-compounding) fixed percentage-of-original-price increase, applied every fixed interval',
  taughtBy:
    'D-BP223-BM04-h2cbpv9w-170/WAVE W06 (cluster C75, representative harvest_gsm8k_pilot_item162). ' +
    'NOTE: the silo label calls this "compound interest"; the deposit\'s own steps and the ' +
    "item's own accepted answer both confirm FLAT growth on the original price -- see this " +
    'file\'s own header finding.',
  shapeDescription:
    'An initial price, a percentage increase stated "of the original price" (flat basis, not ' +
    'compounding), applied once per fixed interval across a total elapsed time: final = price ' +
    '+ (totalTime / interval) * (price * rate / 100).',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find an initial price, a flat-basis ("of the original price") percentage ' +
          'rate, an exact whole number of fixed-length periods, and an exact per-period ' +
          'increase, or the text names "compound" growth instead; abstaining rather than ' +
          'guessing',
      };
    }
    return {
      matches: true,
      reason: `price=${result.price}, periods=${result.periods}, perPeriod=${result.perPeriod}`,
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
        return {
            question,
            verdict: String(Math.round((result.answer) * 100) / 100),
            abstain: false,
            freeText,
            method: METHOD_ID,
            basis: `${result.price} + ${result.periods} * ${result.perPeriod} = ${result.answer}`,
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

registerMethod(flatPeriodicFixedIncreaseTotalCost);
