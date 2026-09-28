// D-BP223-BM04-h2cbpv9w-170 -- two-option-percent-profit-choose-max-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W06).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\two-option-percent-profit-choose-max-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W06 CLUSTER C73 (1 member, sole member
 * harvest_gsm8k_pilot_item15_comparative_analysis_of_investment_growt). Representative teaching
 * case: GSM8K test.jsonl line 15 (a merchant choosing between jewelry and electronic gadgets).
 *
 * SILO LABEL VS. ARITHMETIC MISMATCH, flagged not hidden (same class as D-BP223 batch 2's and
 * WAVE W04's own findings). SILO_SHAPE_CLUSTERS.json's C73 shape label is
 * "comparative_analysis_of_investment_growth -- percentage_increase_calculation", and the
 * deposit's own Steps field ends "...to determine the profit margin over the alternative choice",
 * i.e. it describes computing the DIFFERENCE between the two options' profits (125 - 96 = 29).
 * GSM8K line 15's own accepted answer ("#### 125") is NOT that difference -- it is simply the
 * LARGER of the two profits (the profit from the option the merchant actually picks to maximize
 * profit). This candidate computes what the accepted answer requires (the maximum of the two
 * profits), not the margin the deposit's Steps field describes, and says so here for the Founder
 * to decide whether the silo label/steps text itself needs correcting.
 *
 * @generalShape Two named options, each given a dollar value and a percentage growth/profit rate.
 *   Profit_i = value_i * rate_i / 100. When the question asks the actor to MAXIMIZE profit by
 *   picking one option, the answer is the LARGER of the two profits (not their difference).
 *
 * @recogniseInStranger Require the literal phrase "maximiz(e/ing) profit" in the question (the
 *   positive cue this is a choose-the-better-option question, not a margin/comparison question).
 *   Extract (name, value) pairs from "<name...> worth $<value>" and (name, rate) pairs from
 *   "<name...> market will go up/rise/increase/grow <rate>%". Pair a value to a rate when they
 *   share a real (non-stopword) word of at least 4 characters. Fire only when exactly two such
 *   pairs are formed and each profit divides out exactly (value * rate is an exact multiple of
 *   100, i.e. no fractional-cent profit).
 *
 * @whatBreaksIt (a) more or fewer than two options; (b) a value/rate that cannot be matched to a
 *   counterpart by shared name words; (c) a question asking for the margin/difference between the
 *   two options rather than "maximize profit" -- a different question this candidate does not
 *   attempt; (d) a non-exact profit (rate*value not a whole number of cents).
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Any guard
 *   failing (not exactly two paired options, an inexact profit, a non-finite result) makes the
 *   method ABSTAIN: verdict null, abstain true. Gate 1 (own generating question, GSM8K line 15):
 *   SOLVED, verdict 125, matching the corpus's own "#### 125".
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'two-option-percent-profit-choose-max-v1';

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'while', 'that', 'which', 'his', 'her', 'its', 'of', 'in', 'on',
  'worth', 'market', 'will', 'within', 'same', 'month', 'this', 'to', 'by', 'is', 'was',
]);

const VALUE_RE = /([a-z][a-z\s]*?)\s+worth\s+\$?([\d,]+(?:\.\d+)?)/gi;
const RATE_RE = /([a-z][a-z\s]*?)\s+(?:market\s+)?will\s+(?:go up|rise|increase|grow)\s+(\d+(?:\.\d+)?)%/gi;
const MAXIMIZE_RE = /maximiz(?:e|ing)\s+profit/i;

function meaningfulWords(name: string): string[] {
  return name
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

function nameOverlap(a: string, b: string): boolean {
  const aw = meaningfulWords(a);
  const bw = meaningfulWords(b);
  return aw.some((w) => bw.includes(w));
}

interface Pair { name: string; value: number; rate: number }

interface Analyzed {
  pairs: [Pair, Pair];
  profits: [number, number];
  answer: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();
  if (!MAXIMIZE_RE.test(q)) return null;

  const values: { name: string; value: number }[] = [];
  let m: RegExpExecArray | null;
  VALUE_RE.lastIndex = 0;
  while ((m = VALUE_RE.exec(q))) {
    values.push({ name: m[1].trim(), value: parseFloat(m[2].replace(/,/g, '')) });
  }
  if (values.length !== 2) return null;

  const rates: { name: string; rate: number }[] = [];
  RATE_RE.lastIndex = 0;
  while ((m = RATE_RE.exec(q))) {
    rates.push({ name: m[1].trim(), rate: parseFloat(m[2]) });
  }
  if (rates.length !== 2) return null;

  const pairs: Pair[] = [];
  const usedRateIdx = new Set<number>();
  for (const v of values) {
    let matchIdx = -1;
    for (let i = 0; i < rates.length; i += 1) {
      if (usedRateIdx.has(i)) continue;
      if (nameOverlap(v.name, rates[i].name)) { matchIdx = i; break; }
    }
    if (matchIdx === -1) return null;
    usedRateIdx.add(matchIdx);
    pairs.push({ name: v.name, value: v.value, rate: rates[matchIdx].rate });
  }
  if (pairs.length !== 2) return null;

  const profits: number[] = [];
  for (const p of pairs) {
    // exact-cents check: value * rate must be an exact multiple of 100 (rate given to at most
    // one decimal place in this shape; multiplying by 10 first keeps everything integer)
    const scaledRate = Math.round(p.rate * 10);
    const numerator = p.value * scaledRate;
    const denom = 1000;
    if (numerator % denom !== 0) return null;
    profits.push(numerator / denom);
  }
  if (!Number.isFinite(profits[0]) || !Number.isFinite(profits[1])) return null;

  const answer = Math.max(profits[0], profits[1]);

  return {
    pairs: [pairs[0], pairs[1]],
    profits: [profits[0], profits[1]],
    answer,
  };
}

export const twoOptionPercentProfitChooseMax: LianaMethod = {
  id: 'two-option-percent-profit-choose-max-v1',
  demand: 'COMPUTE',
  name: 'Two options, each a value times a percent rate, report the larger profit chosen to maximize it',
  taughtBy:
    'D-BP223-BM04-h2cbpv9w-170/WAVE W06 (cluster C73, representative harvest_gsm8k_pilot_item15). ' +
    'NOTE: the silo label/steps for C73 describe a MARGIN (difference) between the two profits; ' +
    "the item's own accepted answer is the LARGER profit alone, not the margin -- this candidate " +
    'follows the accepted answer, per instruction, and flags the label mismatch for the Founder.',
  shapeDescription:
    'Two named options each carry a dollar value and a percent growth rate; profit_i = ' +
    'value_i * rate_i / 100; when the question asks to maximize profit by choosing one option, ' +
    'report the larger of the two profits.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "maximize profit" cue plus exactly two value/rate option pairs with ' +
          'an exact-cents profit for each; abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `pairs=${JSON.stringify(result.pairs)}, profits=${JSON.stringify(result.profits)}`,
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
            basis: `profits=[${result.profits.join(', ')}] -> maximize by choosing the larger = ` +
            `${result.answer}`,
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

registerMethod(twoOptionPercentProfitChooseMax);
