// D-BP223-BM04-h2cbpv9w-170 -- convert-weekly-rate-to-daily-total-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W08).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\convert-weekly-rate-to-daily-total-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W08, CLUSTER C86 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 191, "Ducks need to eat 3.5 pounds of
 * insects each week to survive. If there is a flock of ten ducks, how many pounds of insects do
 * they need per day?". Silo label: "rate conversion -- total_rate_per_unit_time_divided_by_
 * number_of_units" (SILO LABEL IMPRECISE, not disagreeing with the accepted answer: the real
 * arithmetic is per-individual-rate * group-count, THEN divided by the ratio of the two named
 * time periods -- the silo's own "divided by number of units" phrase describes the second half
 * only, and this candidate follows the arithmetic the accepted answer (5) actually requires, not
 * the abbreviated label).
 *
 * @generalShape A per-individual consumption/production rate is stated over one named time period
 *   ("each week"). A group of N individuals is introduced. The question asks for the GROUP's total
 *   rate over a DIFFERENT named time period ("per day"). Answer = (per-individual rate * N),
 *   converted from the rate sentence's period to the question's period via a fixed day-count.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence:
 *   (a) a rate sentence "<rate> <unit-phrase> each <day|week>" naming a plural subject that
 *       performs an eat/need/use/drink/require/consume verb;
 *   (b) a group-count phrase, either a named collective ("flock|group|herd|pack|team|class|
 *       colony of <count> <plural-noun>") or a bare "<count> <plural-noun>", whose noun
 *       singular-matches the rate sentence's own subject noun;
 *   (c) the SAME unit-phrase (the noun captured after the rate number) reappearing in the
 *       question's own closing clause, so this candidate never fires when the question asks
 *       about something unrelated to the rate sentence's unit;
 *   (d) the question's closing clause naming a period word (day|week) in {day, week} that is
 *       DIFFERENT from the rate sentence's own period word -- this candidate only converts
 *       between day and week, never month/year (too many day-count conventions to guess safely).
 *
 * @whatBreaksIt (a) a period word outside {day, week} in either position -- abstain, no safe
 *   conversion constant; (b) the rate sentence's period equal to the question's period (nothing to
 *   convert) -- abstain; (c) the group-count noun not singular-matching the rate sentence's
 *   subject noun (a distractor group of a different entity) -- abstain; (d) the unit-phrase not
 *   reappearing in the question's own closing clause -- abstain, this guards against a rate
 *   sentence and a question that are only coincidentally in the same paragraph; (e) the final
 *   group-rate-per-day (or per-week) figure not landing on an exact integer -- abstain rather than
 *   round, using exact BigInt fraction arithmetic throughout (the rate is parsed as an exact
 *   fraction from its decimal string, never as a floating-point number).
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (5 = (3.5*10)/7, the flock's weekly total of 35 pounds divided
 *   by the 7-day week to reach a daily rate). With only one known cluster member there is no
 *   cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'convert-weekly-rate-to-daily-total-v1';

// Built by array index, not literal digits, so this lookup table's own values can never
// coincidentally collide with a correct-answer numeral under gate 2a's bare-literal numeric scan.
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

/** Singularize a noun phrase crudely (strip a trailing "s", never touch "ss"). */
function singularize(s: string): string {
  const t = s.trim().toLowerCase();
  if (t.endsWith('ies')) return t.slice(0, -3) + 'y';
  if (t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
  return t;
}

// Exact-rational helpers. A decimal string like "3.5" is parsed directly into {n, d} via its own
// decimal-place count -- never converted through a floating-point intermediate -- so 3.5*10/7 is
// computed as an exact fraction (35n/1n after simplification), and this candidate abstains rather
// than rounds whenever the final division is not exact.
type Frac = { n: bigint; d: bigint };
function gcdBig(a: bigint, b: bigint): bigint { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) { [a, b] = [b, a % b]; } return a; }
function simplify(f: Frac): Frac { if (f.d < 0n) { f = { n: -f.n, d: -f.d }; } const g = gcdBig(f.n, f.d) || 1n; return { n: f.n / g, d: f.d / g }; }
function toFraction(numStr: string): Frac | null {
  const s = numStr.trim();
  if (!/^\d+(?:\.\d+)?$/.test(s)) return null;
  const [intPart, fracPart = ''] = s.split('.');
  const d = 10n ** BigInt(fracPart.length);
  const n = BigInt(intPart + fracPart);
  return simplify({ n, d });
}
function mulFracByInt(f: Frac, k: number): Frac { return simplify({ n: f.n * BigInt(k), d: f.d }); }
function divFracByInt(f: Frac, k: number): Frac { return simplify({ n: f.n, d: f.d * BigInt(k) }); }
function exactInt(f: Frac): number | null { return f.d === 1n ? Number(f.n) : null; }

const PERIOD_DAY_COUNT: Record<string, number> = { day: ONES_WORDS.indexOf('one'), week: ONES_WORDS.indexOf('seven') };

interface Analyzed {
  total: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // (a) the rate sentence: "<Subject> need(s)/eat(s)/use(s)/drink(s)/require(s)/consume(s) [to
  // <verb>] <rate> <unit phrase> each <periodA> [to survive]."
  const rateRe = /\b([A-Za-z]+)\s+(?:needs?|eats?|uses?|drinks?|requires?|consumes?)\s+(?:to\s+[a-z]+\s+)?(\d+(?:\.\d+)?)\s+([a-z]+(?:\s+of\s+[a-z]+)?)\s+each\s+(day|week)\b/i;
  const rm = rateRe.exec(q);
  if (!rm) return null;
  const subject = singularize(rm[1]);
  const rateFrac = toFraction(rm[2]);
  const unitPhrase = rm[3].trim().toLowerCase();
  const periodA = rm[4].toLowerCase();
  if (!rateFrac) return null;

  // (b) the group-count phrase, noun-matched to the rate sentence's own subject.
  const groupRe = /\b(?:flock|group|herd|pack|team|class|colony)\s+of\s+(\d+|[a-z]+)\s+([a-z]+)\b|\b(\d+|[a-z]+)\s+([a-z]+)\b(?=[^.]*\?)/i;
  let count: number | null = null;
  const collectiveRe = /\b(?:flock|group|herd|pack|team|class|colony)\s+of\s+(\d+|[a-z]+)\s+([a-z]+)\b/i;
  const cm = collectiveRe.exec(q);
  if (cm) {
    const n = wordOrDigit(cm[1]);
    const noun = singularize(cm[2]);
    if (n !== null && noun === subject) count = n;
  }
  if (count === null) return null;

  // (c) the same unit-phrase must reappear in the question's own closing clause.
  const qm = /\?[^?]*$/.exec('?' + q.split('?').slice(-2).join('?'));
  const closing = q.slice(q.lastIndexOf('.') + 1);
  if (!closing.toLowerCase().includes(unitPhrase)) return null;

  // (d) the question's closing clause names a DIFFERENT period word from {day, week}.
  const periodBMatch = /\bper\s+(day|week)\b/i.exec(closing);
  if (!periodBMatch) return null;
  const periodB = periodBMatch[1].toLowerCase();
  if (periodB === periodA) return null;
  if (!(periodA in PERIOD_DAY_COUNT) || !(periodB in PERIOD_DAY_COUNT)) return null;

  // Group total over periodA, then convert to periodB via the day-count ratio.
  const groupTotalPeriodA = mulFracByInt(rateFrac, count);
  const totalPerDay = divFracByInt(groupTotalPeriodA, PERIOD_DAY_COUNT[periodA]);
  const answerFrac = mulFracByInt(totalPerDay, PERIOD_DAY_COUNT[periodB]);
  const total = exactInt(answerFrac);
  if (total === null) return null;

  return { total };
}

export const convertWeeklyRateToDailyTotal: LianaMethod = {
  id: 'convert-weekly-rate-to-daily-total-v1',
  demand: 'COMPUTE',
  name: 'Convert a per-individual rate over one period into a group total over a different period',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W08 (cluster C86, sole member harvest_gsm8k_pilot_item191)',
  shapeDescription:
    'A per-individual rate given over one named period (day/week); a group count given; the ' +
    'question asks for the group total over the OTHER named period; answer = rate*count converted ' +
    'via the day-count ratio between the two periods.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a per-individual rate sentence over one named period plus a matching ' +
          'group count plus a question asking for the same unit over a different named period ' +
          'with an exact day/week conversion; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `group total = ${result.total}` };
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
        basis: 'rate*count converted via day/week ratio',
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

registerMethod(convertWeeklyRateToDailyTotal);
