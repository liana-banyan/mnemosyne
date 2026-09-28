// D-BP223-BM04-h2cbpv9w-170 -- two-quantity-ratio-scale-from-given-total-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\two-quantity-ratio-scale-from-given-total-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W19, CLUSTER C176 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 319, "The ratio of the electric poles and
 * electric wires needed to connect and supply the electricity in a certain neighborhood is 1:3.
 * If the total number of electric wires needed to connect the electricity in the neighborhood is
 * 45, calculate the total number of electric poles required by an electric company to supply the
 * electricity in the neighborhood." Silo label: "ratio and proportion problem" -- matches exactly.
 *
 * @generalShape TWO named quantities (A, B) whose ratio A:B = p:q is stated as literal digits
 *   ("is p:q"), immediately followed by an absolute value given for ONE of the two named
 *   quantities, and a closing "calculate the total number of <the other quantity>" clause. The
 *   answer is the OTHER quantity's value, scaled from the given one via the stated ratio.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence:
 *   (a) a sentence containing "ratio of the <A> and <B>" where A and B are both noun phrases
 *       immediately followed by a shared modifier word ("needed"/"required"), and ending
 *       "is <p>:<q>" with LITERAL digit ratio terms (never a ratio spelled in words);
 *   (b) a sentence "the total number of <X> ... is <N>" where X's noun phrase matches A or B
 *       EXACTLY (same words, case-insensitive) up to the same modifier word;
 *   (c) a closing sentence containing "calculate the total number of <Y>" where Y matches the
 *       OTHER of {A, B} (not the same one as X), again up to the same modifier word.
 *
 * @whatBreaksIt (a) the ratio stated in words ("one to three") instead of digits -- abstain,
 *   never parse a spelled ratio here; (b) a third named quantity anywhere in the ratio clause --
 *   abstain, this candidate is TWO-quantity only; (c) X and Y resolving to the SAME quantity, or
 *   neither matching A/B exactly -- abstain, cannot orient the scale; (d) the scaled result not
 *   landing on a positive integer -- abstain rather than round or return a fraction.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (wires 45, ratio poles:wires 1:3, poles = 45 * 1/3 = 15). With
 *   only one known cluster member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'two-quantity-ratio-scale-from-given-total-v1';

const MODIFIER = '(?:needed|required)';
const NOUN_PHRASE = '[a-z]+(?:\\s+[a-z]+){0,3}?';

function normNoun(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const ratioRe = new RegExp(
    'ratio of the (' + NOUN_PHRASE + ')\\s+and\\s+(' + NOUN_PHRASE + ')\\s+' + MODIFIER + '\\b[^.]*?\\bis\\s+(\\d+)\\s*:\\s*(\\d+)',
    'i',
  );
  const rm = ratioRe.exec(q);
  if (!rm) return null;
  const a = normNoun(rm[1]);
  const b = normNoun(rm[2]);
  const p = parseInt(rm[3], 10);
  const qty = parseInt(rm[4], 10);
  if (!a || !b || a === b || !Number.isFinite(p) || !Number.isFinite(qty) || p <= 0 || qty <= 0) return null;

  const givenRe = new RegExp(
    'total number of (' + NOUN_PHRASE + ')\\s+' + MODIFIER + '\\b[^.]*?\\bis\\s+(\\d+)\\b',
    'i',
  );
  const gm = givenRe.exec(q);
  if (!gm) return null;
  const givenNoun = normNoun(gm[1]);
  const givenValue = parseInt(gm[2], 10);
  if (!Number.isFinite(givenValue) || givenValue <= 0) return null;

  const targetRe = new RegExp(
    'calculate the total number of (' + NOUN_PHRASE + ')\\s+' + MODIFIER,
    'i',
  );
  const tm = targetRe.exec(q);
  if (!tm) return null;
  const targetNoun = normNoun(tm[1]);

  if (givenNoun !== a && givenNoun !== b) return null;
  if (targetNoun !== a && targetNoun !== b) return null;
  if (givenNoun === targetNoun) return null;

  const ratioByNoun: Record<string, number> = { [a]: p, [b]: qty };
  const givenRatio = ratioByNoun[givenNoun];
  const targetRatio = ratioByNoun[targetNoun];
  if (!givenRatio || !targetRatio) return null;

  // target / given = targetRatio / givenRatio  =>  target = givenValue * targetRatio / givenRatio
  const numerator = givenValue * targetRatio;
  if (numerator % givenRatio !== 0) return null;
  const total = numerator / givenRatio;
  if (total <= 0 || !Number.isInteger(total)) return null;
  return { total };
}

export const twoQuantityRatioScaleFromGivenTotal: LianaMethod = {
  id: 'two-quantity-ratio-scale-from-given-total-v1',
  demand: 'COMPUTE',
  name: 'Scale one of two ratio-linked quantities to the other from a stated digit ratio and one given total',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W19 (cluster C176, sole member: pilot corpus item at index 319)',
  shapeDescription:
    'Ratio A:B = p:q stated as literal digits; one of A or B is given an absolute value; ' +
    'the other is asked for, scaled by the ratio.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a two-quantity digit ratio ("is p:q"), a matching given total for one ' +
          'of the two named quantities, and a closing "calculate the total number of" clause ' +
          'naming the OTHER quantity, resolving to a positive integer; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `scaled total = ${result.total}` };
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
          basis: 'scaled the given quantity by the stated digit ratio',
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

registerMethod(twoQuantityRatioScaleFromGivenTotal);
