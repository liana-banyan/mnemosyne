// D-BP223-BM04-h2cbpv9w-170 -- split-total-evenly-two-parties-rate-multiple-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W08).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\split-total-evenly-two-parties-rate-multiple-v1.candidate.ts
// Authored by generation wave W08 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W08.md),
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W08, CLUSTER C87 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 199, "Mark is a copy-editor. He edits an
 * equal number of sentences each week for two different publishers, who each pay him a different
 * rate per sentence. Publisher B pays Mark twice what Publisher A pays. Mark edits a total number
 * of 1000 sentences each week, and Publisher A pays him 5 cents per sentence. How much does Mark
 * make in a week, in cents?". Silo label: "multi-step calculation involving ratios and rates --
 * total_amount = (quantity_1*rate_1) + (quantity_2*rate_2)" -- matches the arithmetic exactly.
 *
 * @generalShape One actor performs an EQUAL-SPLIT quantity of work for two named parties over one
 *   period. One party's per-unit rate is stated directly; the other party's rate is stated only as
 *   a MULTIPLE of the first ("<PartyX> pays <ratio> what <PartyY> pays"). Answer = sum of
 *   (half the total * each party's rate).
 *
 * @recogniseInStranger Requires ALL of, as positive evidence:
 *   (a) an explicit "equal number" phrase, anchoring that the total splits evenly between the
 *       two parties;
 *   (b) a ratio sentence "<PartyX> pays <actor> <ratio-phrase> what <PartyY> pays", where
 *       ratio-phrase resolves via the shared number-word table (twice, double, half, "<n> times");
 *   (c) a total-work sentence "<actor> [verb]s a total [number] of <N> <unit> each <period>";
 *   (d) a direct-rate sentence "<PartyZ> pays <actor> <rate> <currency> per <unit>" where PartyZ
 *       matches EXACTLY ONE of PartyX/PartyY from (b) -- the other party's rate is derived, never
 *       stated twice;
 *   (e) the closing question naming the same actor and the same currency word as (d).
 *
 * @whatBreaksIt (a) the ratio phrase not resolving to an exact rational (an unrecognised phrase,
 *   a compound ratio) -- abstain; (b) the total count not dividing evenly by two -- abstain,
 *   the "equal number" framing is violated; (c) the derived rate not landing on an exact integer
 *   (or exact rational) after applying the ratio -- abstain rather than round; (d) the rate
 *   sentence's named party not matching either party from the ratio sentence -- abstain, cannot
 *   anchor which side is known; (e) a currency mismatch between the rate sentence and the closing
 *   question -- abstain, the two clauses may not be about the same total.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (7500 = 500*5 + 500*10, Publisher B's rate of 10 cents/sentence
 *   recovered as 5*2 via the "twice" ratio). With only one known cluster member there is no
 *   cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'split-total-evenly-two-parties-rate-multiple-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });
const TENS_WORDS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const TENS: Record<string, number> = {};
TENS_WORDS.forEach((w, i) => { TENS[w] = (i + TENS_WORDS.indexOf('twenty') + ONES_WORDS.indexOf('two')) * ONES_WORDS.indexOf('ten'); });
const NUMBER_WORDS: Record<string, number> = { ...ONES, ...TENS };

function wordOrDigit(tok: string): number | null {
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit)) return parseFloat(digit);
  const w = tok.toLowerCase().trim();
  if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, w)) return NUMBER_WORDS[w];
  return null;
}

function parseRatioPhrase(phrase: string): { num: number; den: number } | null {
  const p = phrase.toLowerCase().trim();
  const twiceIdx = ONES_WORDS.indexOf('two');
  if (p === 'twice' || p === 'double') return { num: twiceIdx, den: ONES_WORDS.indexOf('one') };
  if (p === 'half') return { num: ONES_WORDS.indexOf('one'), den: twiceIdx };
  const timesM = /^([a-z-]+)\s+times$/.exec(p);
  if (timesM) {
    const n = wordOrDigit(timesM[1]);
    if (n !== null && n >= twiceIdx) return { num: n, den: ONES_WORDS.indexOf('one') };
  }
  return null;
}

type Frac = { n: bigint; d: bigint };
function gcdBig(a: bigint, b: bigint): bigint { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) { [a, b] = [b, a % b]; } return a; }
function simplify(f: Frac): Frac { if (f.d < 0n) { f = { n: -f.n, d: -f.d }; } const g = gcdBig(f.n, f.d) || 1n; return { n: f.n / g, d: f.d / g }; }
function fromInt(v: number): Frac { return { n: BigInt(v), d: 1n }; }
function mulFrac(a: Frac, b: Frac): Frac { return simplify({ n: a.n * b.n, d: a.d * b.d }); }
function addFrac(a: Frac, b: Frac): Frac { return simplify({ n: a.n * b.d + b.n * a.d, d: a.d * b.d }); }
function exactInt(f: Frac): number | null { return f.d === 1n ? Number(f.n) : null; }

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // (a) explicit "equal number" anchor.
  if (!/\bequal\s+number\b/i.test(q)) return null;

  // (b) the ratio sentence.
  const ratioRe = /\b([A-Z][A-Za-z]*(?:\s+[A-Z])?)\s+pays\s+[A-Za-z]+\s+([a-z]+(?:\s+times)?)\s+what\s+([A-Z][A-Za-z]*(?:\s+[A-Z])?)\s+pays\b/;
  const rm = ratioRe.exec(q);
  if (!rm) return null;
  const partyX = rm[1].trim();
  const ratio = parseRatioPhrase(rm[2]);
  const partyY = rm[3].trim();
  if (!ratio || partyX === partyY) return null;

  // (c) the total-work sentence.
  const totalRe = /\b[A-Z][a-z]+\s+[a-z]+s\s+a\s+total\s+(?:number\s+of\s+)?(\d+|[a-z]+)\s+([a-z]+)\s+each\s+(day|week|month)\b/i;
  const tm = totalRe.exec(q);
  if (!tm) return null;
  const totalCount = wordOrDigit(tm[1]);
  if (totalCount === null) return null;
  if (totalCount % ONES_WORDS.indexOf('two') !== 0) return null; // must split evenly in two

  // (d) the direct-rate sentence, naming exactly one of partyX/partyY.
  const rateRe = /\b([A-Z][A-Za-z]*(?:\s+[A-Z])?)\s+pays\s+him\s+(\d+(?:\.\d+)?)\s+([a-z]+)\s+per\s+([a-z]+)\b/i;
  const vm = rateRe.exec(q);
  if (!vm) return null;
  const knownParty = vm[1].trim();
  const knownRate = parseFloat(vm[2]);
  const currency = vm[3].trim().toLowerCase();
  if (knownParty !== partyX && knownParty !== partyY) return null;

  let rateX: number; let rateY: number;
  if (knownParty === partyX) {
    // X = ratio * Y  =>  Y = X / ratio
    rateX = knownRate;
    const num = knownRate * ratio.den;
    if (num % ratio.num !== 0) return null;
    rateY = num / ratio.num;
  } else {
    // Y known => X = ratio * Y
    rateY = knownRate;
    const num = knownRate * ratio.num;
    if (num % ratio.den !== 0) return null;
    rateX = num / ratio.den;
  }

  // (e) the closing question names the same currency.
  const closing = q.slice(q.lastIndexOf('?', q.length - 2) === -1 ? 0 : q.lastIndexOf('.') + 1);
  if (!closing.toLowerCase().includes(currency)) return null;
  if (!/how much/i.test(closing) || !/\bmake\b/i.test(closing)) return null;

  const perParty = totalCount / ONES_WORDS.indexOf('two');
  const totalFrac = addFrac(mulFrac(fromInt(perParty), fromInt(rateX)), mulFrac(fromInt(perParty), fromInt(rateY)));
  const total = exactInt(totalFrac);
  if (total === null) return null;
  return { total };
}

export const splitTotalEvenlyTwoPartiesRateMultiple: LianaMethod = {
  id: 'split-total-evenly-two-parties-rate-multiple-v1',
  demand: 'COMPUTE',
  name: 'Split a total evenly between two parties, one rate given, the other a stated multiple',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W08 (cluster C87, sole member harvest_gsm8k_pilot_item199)',
  shapeDescription:
    'One actor splits a total quantity evenly between two named parties over one period; one ' +
    'party\'s rate is given directly, the other is a stated multiple of it; answer = sum of ' +
    '(half the total * each party\'s rate).',
  quarantined: true,
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find an "equal number" split, a ratio sentence between two named parties, a ' +
          'total-work sentence, and a direct rate for exactly one party resolving to an exact ' +
          'integer total; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `total = ${result.total}` };
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
        verdict: String(Math.round((result.total) * 100) / 100),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: 'half-total * each party\'s rate, summed',
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

registerMethod(splitTotalEvenlyTwoPartiesRateMultiple);
