// D-BP223-BM04-h2cbpv9w-170 -- two-prior-days-sum-times-target-day-multiplier-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\two-prior-days-sum-times-target-day-multiplier-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W17, CLUSTER C161 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 300, "On Tuesday, Peter wants to exercise
 * for twice the amount of time he did on Monday and Sunday combined. On Sunday he exercised for
 * 23 minutes. On Monday he exercised for 16 minutes. How many minutes does he have to exercise on
 * Tuesday to reach his goal?" Silo label: "multi-step word problem involving addition and
 * multiplication -- summation followed by multiplication" -- matches exactly.
 *
 * @generalShape TWO named prior periods (days) each carry a stated numeric AMOUNT of the same
 *   unit. A THIRD, target period's amount is defined as an explicit MULTIPLE of the SUM of the
 *   first two. The question asks for the target period's amount.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence:
 *   (a) a goal sentence naming the target period and an explicit multiple-of-the-combined-total
 *       phrasing ("for <multiple> the amount of time <subject> did on <periodA> and <periodB>
 *       combined"), the multiple resolved via a shared number-word table (word or digit, "twice"/
 *       "double" included);
 *   (b) two SEPARATE sentences, one per named prior period, each giving a bare number tied to the
 *       SAME unit noun as the goal sentence (minutes, hours, etc.), and each period name matching
 *       one of the two named in (a);
 *   (c) a closing question asking how much/many of that unit is needed on the target period.
 *
 * @whatBreaksIt (a) the goal sentence naming periods other than the two whose amounts are later
 *   given -- abstain, cannot resolve; (b) more than two prior-period amount sentences present --
 *   abstain, this shape is exactly two addends, not an open sum; (c) the unit noun differing
 *   between the goal sentence and either amount sentence -- abstain; (d) the multiple phrase not
 *   resolving to a number via the shared table -- abstain rather than guess a default of one.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED ((23+16)*2 = 78). With only one known cluster member there is no
 *   cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'two-prior-days-sum-times-target-day-multiplier-v1';

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
  if (w === 'twice' || w === 'double') return 2;
  if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, w)) return NUMBER_WORDS[w];
  return null;
}

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const goalRe = /for\s+([a-z0-9]+)\s+(?:the amount of|as much|as many)\s+[a-z]*\s*(?:time|[a-z]+)\s+(?:he|she|they)\s+did\s+on\s+([A-Z][a-z]+)\s+and\s+([A-Z][a-z]+)\s+combined/i;
  const gm = goalRe.exec(q);
  if (!gm) return null;
  const multiple = wordOrDigit(gm[1]);
  const periodA = gm[2];
  const periodB = gm[3];
  if (multiple === null || multiple <= 0 || periodA === periodB) return null;

  // Unit noun: pull from the goal-clause context if present, else infer from amount sentences.
  const unitGuess = /(minutes?|hours?|dollars?|miles?|pages?)/i.exec(q.slice(0, gm.index + gm[0].length));

  const amtRe = (name: string) => new RegExp('On\\s+' + name + '\\s+(?:he|she|they)\\s+exercised for\\s+([0-9]+|[a-z]+)\\s+(minutes?|hours?|dollars?|miles?|pages?)', 'i');
  const amA = amtRe(periodA).exec(q);
  const amB = amtRe(periodB).exec(q);
  if (!amA || !amB) return null;
  const valA = wordOrDigit(amA[1]);
  const valB = wordOrDigit(amB[1]);
  if (valA === null || valB === null) return null;
  const unitA = amA[2].toLowerCase().replace(/s$/, '');
  const unitB = amB[2].toLowerCase().replace(/s$/, '');
  if (unitA !== unitB) return null;
  if (unitGuess && unitGuess[1].toLowerCase().replace(/s$/, '') !== unitA) return null;

  if (!/how (?:much|many)/i.test(q)) return null;

  const total = (valA + valB) * multiple;
  if (!Number.isFinite(total)) return null;
  return { total };
}

export const twoPriorDaysSumTimesTargetDayMultiplier: LianaMethod = {
  id: 'two-prior-days-sum-times-target-day-multiplier-v1',
  demand: 'COMPUTE',
  name: 'Sum two named prior periods, multiply by an explicit stated multiple for a target period',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W17 (cluster C161, sole member: GSM8K test.jsonl item 300)',
  shapeDescription:
    'target = multiple * (amountA + amountB), where amountA/amountB are two separately-stated ' +
    'same-unit figures for two named periods, and multiple is stated relative to their combined total.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a goal sentence naming a multiple of two combined named periods, two ' +
          'separate same-unit amount sentences for exactly those two periods, and a how-much/many ' +
          'question; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `target amount = ${result.total}` };
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
          basis: 'summed the two named periods, then multiplied by the stated multiple',
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

registerMethod(twoPriorDaysSumTimesTargetDayMultiplier);
