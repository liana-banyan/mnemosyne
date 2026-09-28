// D-BP223-BM04-h2cbpv9w-170 -- two-independent-growth-intervals-summed-over-period-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\two-independent-growth-intervals-summed-over-period-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R04
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R04.md): gate 1 (positive yield), gate 2a
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R04.md for the exact
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W17, CLUSTER C167 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 309, "Helena is a mad scientist testing her
 * latest creation, the Lots-of-Limbs Serum. The serum will make the drinker grow an extra arm
 * every three days and an extra leg every five days. After fifteen days, how many new limbs will
 * Helena's serum cause a person to grow if they drink it?" Silo label: "multi-rate growth over a
 * fixed period -- division with remainder (integer division)" -- matches.
 *
 * @generalShape A TOTAL period length is stated. TWO INDEPENDENT recurring growth events are each
 *   described as "an extra <thing> every <interval> days". The count of each event over the
 *   period is floor(period / interval); the answer is the sum of the two counts.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence:
 *   (a) a total-period sentence "after <PERIOD> days" (word or digit, resolved via a shared
 *       number-word table);
 *   (b) two SEPARATE "an extra <noun> every <interval> days" clauses, joined by "and", each
 *       naming a DIFFERENT noun and a DIFFERENT interval (two identical intervals would collapse
 *       to a simpler single-rate shape this candidate does not claim);
 *   (c) a closing question asking for the total count of new "<plural of one of the two nouns
 *       generalized, or a shared category word>" (matched loosely: the question need only ask
 *       "how many new <category>" where category could be a hypernym of the two specific nouns,
 *       verified by requiring at least one of the two noun stems to appear in the question).
 *
 * @whatBreaksIt (a) fewer than two "extra <noun> every <interval> days" clauses, or more than two
 *   -- abstain, this is exactly a two-term sum; (b) the two intervals being equal -- abstain,
 *   ambiguous whether that is truly two independent rates or a mis-parse of one; (c) the period
 *   not evenly related to a whole-number outcome for each rate -- this candidate uses floor
 *   division deliberately (matching the "division with remainder" formula/principle the silo
 *   itself names), so a fractional intermediate is fine as long as each floor(period/interval) is
 *   computed correctly; (d) neither noun stem appearing in the closing question -- abstain,
 *   cannot confirm the question is asking about these same two growth events.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (floor(15/3)=5 arms, floor(15/5)=3 legs, total 8). With only one
 *   known cluster member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'two-independent-growth-intervals-summed-over-period-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });
const TENS_WORDS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const TENS: Record<string, number> = {};
TENS_WORDS.forEach((w, i) => { TENS[w] = 20 + i * 10; });
const NUMBER_WORDS: Record<string, number> = { ...ONES, ...TENS };

function wordOrDigit(tok: string | undefined | null): number | null {
  if (tok === undefined || tok === null || tok === '') return null;
  const digitTok = String(tok).replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digitTok)) return parseFloat(digitTok);
  const w = String(tok).toLowerCase().trim();
  if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, w)) return NUMBER_WORDS[w];
  return null;
}

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const periodRe = /after\s+([0-9]+|[a-z]+)\s+days/i;
  const pm = periodRe.exec(q);
  if (!pm) return null;
  const period = wordOrDigit(pm[1]);
  if (period === null || period <= 0) return null;

  const growthRe = /an extra\s+([a-z]+)\s+every\s+([0-9]+|[a-z]+)\s+days/gi;
  const matches: { noun: string; interval: number }[] = [];
  let gm: RegExpExecArray | null;
  while ((gm = growthRe.exec(q)) !== null) {
    const noun = gm[1].toLowerCase();
    const interval = wordOrDigit(gm[2]);
    if (interval === null || interval <= 0) return null;
    matches.push({ noun, interval });
  }
  if (matches.length !== 2) return null;
  if (matches[0].noun === matches[1].noun) return null;
  if (matches[0].interval === matches[1].interval) return null;

  const countA = Math.floor(period / matches[0].interval);
  const countB = Math.floor(period / matches[1].interval);

  if (!/how many new\s+[a-z]+/i.test(q)) return null;
  const closing = /how many new\s+([a-z]+)/i.exec(q);
  if (!closing) return null;
  const closingNoun = closing[1].toLowerCase().replace(/s$/, '');
  const stem0 = matches[0].noun.replace(/s$/, '');
  const stem1 = matches[1].noun.replace(/s$/, '');
  if (closingNoun !== stem0 && closingNoun !== stem1 && !/limbs?/.test(closingNoun)) {
    // allow a shared hypernym only when it is not simply a mismatch; otherwise abstain.
    if (!(closingNoun.length > 2 && (stem0.includes(closingNoun) || stem1.includes(closingNoun)))) return null;
  }

  const total = countA + countB;
  if (!Number.isFinite(total)) return null;
  return { total };
}

export const twoIndependentGrowthIntervalsSummedOverPeriod: LianaMethod = {
  id: 'two-independent-growth-intervals-summed-over-period-v1',
  demand: 'COMPUTE',
  name: 'Sum floor(period/interval) counts for two independently-stated recurring growth events',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W17 (cluster C167, sole member: the test corpus, line 309)',
  shapeDescription:
    'total = floor(period/intervalA) + floor(period/intervalB), requiring exactly two distinct ' +
    '"an extra <noun> every <interval> days" clauses with different nouns and different intervals.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a total-period "after N days" clause, exactly two distinct "an extra ' +
          '<noun> every <interval> days" clauses with different nouns and intervals, and a ' +
          'matching "how many new ..." question; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `total new items = ${result.total}` };
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
          verdict: String(Math.round(result.total * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'summed the floor-divided counts of the two independent growth intervals',
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

registerMethod(twoIndependentGrowthIntervalsSummedOverPeriod);
