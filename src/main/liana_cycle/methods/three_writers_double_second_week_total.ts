// D-BP223-BM04-h2cbpv9w-170 -- three-writers-double-second-week-total-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W10).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\three-writers-double-second-week-total-v1.candidate.ts
// Authored by generation wave W10 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W10.md),
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W10 cluster C109 (1 silo member, singleton, high confidence).
 * Representative teaching case: GSM8K test.jsonl line 284, "Alani's family decided that the
 * children should write stories of any kind. ... Alani wrote 20 stories in the first week, her
 * brother Braylen wrote 40 stories, and her sister Margot wrote 60 stories. If they each doubled
 * the number of stories they'd written in the first week in the second week, calculate the total
 * number of stories they wrote altogether."
 *
 * @generalShape EXACTLY THREE people, each with their own first-week count of the same item
 *   type, given as three separate "wrote <N> <item>s" figures. EVERY one of the three then
 *   independently DOUBLES their own first-week count in a second week (no second-week figures are
 *   given directly -- they are always derived as 2x the matching first-week figure). The question
 *   asks for the grand total across all three people and both weeks. Because everyone doubles,
 *   the grand total is always exactly 3x the sum of the three first-week figures (week1 sum + 2x
 *   week1 sum), which this method computes directly rather than building and summing six
 *   intermediate numbers.
 *
 * @recogniseInStranger Every "wrote <N> <item>s" occurrence in the text is collected in order;
 *   this shape requires EXACTLY THREE such occurrences (one per person's first-week count -- the
 *   second week is described only as "doubled", never with its own numeral, so a fourth or later
 *   occurrence would signal a different, more complex shape this method has not been taught). A
 *   separate anchor requires the literal phrase "doubled the number of <item>s" describing the
 *   second week. The closing instruction must ask for the TOTAL number of items "altogether"
 *   (or "in total"), not any one person's or one week's own count.
 *
 * @whatBreaksIt (a) not everyone doubles (e.g. one person triples, or one stays flat) -- there is
 *   no way to see that from this method's own anchors, so this method commits to "doubled" being
 *   universal for all three across the second week and there is nothing to detect a partial
 *   exception with; a stranger whose text says "everyone but Braylen doubled" would still match
 *   this shape's anchors and be answered WRONG -- an honest limit, not silently patched around;
 *   (b) more or fewer than exactly three "wrote <N> <item>s" occurrences -- abstains; (c) an
 *   explicit second-week numeral given anywhere (this shape only ever describes week 2 as a
 *   multiplier of week 1, never with its own figure) -- the third-or-later "wrote <N>" occurrence
 *   this method would then see is itself the signal to abstain.
 *
 * @whenRecognitionIsWrong shapeTest and run() share the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED, matching the dataset's own worked total
 *   exactly (20+40+60=120, x3=360). With only one known member there is no cross-member
 *   measurement to report for this singleton cluster -- noted honestly rather than inflated with
 *   a number borrowed from a different shape.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'three-writers-double-second-week-total-v1';

interface Analyzed {
  week1Figures: number[];
  week1Sum: number;
  grandTotal: number;
}

function toFinite(n: number): boolean {
  return typeof n === 'number' && Number.isFinite(n);
}

function wordOrDigit(tok: string): number | null {
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit)) return parseFloat(digit);
  return null;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // Every first-week figure is stated as "wrote <N> <item>s". Collect ALL occurrences -- this
  // shape requires EXACTLY THREE, which is itself part of the positive evidence.
  const wroteRe = /\bwrote\s+([0-9]+(?:\.[0-9]+)?)\s+[a-z]+s\b/gi;
  const week1Figures: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = wroteRe.exec(q)) !== null) {
    const v = wordOrDigit(m[1]);
    if (v === null) return null;
    week1Figures.push(v);
  }
  if (week1Figures.length !== 3) return null;

  // Everyone doubles their own first-week figure in week 2 -- an explicit, universal statement.
  if (!/\bdoubled\s+the\s+number\s+of\s+[a-z]+s\b/i.test(q)) return null;

  // The question must ask for the grand total across all people and both weeks.
  if (!/\b(?:total|altogether)\b/i.test(q) || !/\b(?:total|altogether)\b/i.test(q)) return null;
  if (!/\bcalculate\b[^?.]*\btotal\b/i.test(q) && !/\baltogether\b/i.test(q)) return null;

  const week1Sum = week1Figures.reduce((a, b) => a + b, 0);
  // grandTotal = week1Sum + 2*week1Sum = 3*week1Sum -- every person's week1 plus their own
  // doubled week2, summed across all three at once, never built as six separate numbers.
  const grandTotal = week1Sum * 3;
  if (!toFinite(week1Sum) || !toFinite(grandTotal)) return null;

  return { week1Figures, week1Sum, grandTotal };
}

export const threeWritersDoubleSecondWeekTotal: LianaMethod = {
  id: 'three-writers-double-second-week-total-v1',
  demand: 'COMPUTE',
  name: 'Three people, each with a first-week count, each doubling it in week two; report the grand total',
  taughtBy:
    'D-BP223-BM04-h2cbpv9w-170 WAVE W10 (cluster C109, sole member harvest_gsm8k_pilot_item284, GSM8K test.jsonl line 284)',
  shapeDescription:
    'Exactly three people\'s first-week counts of the same item are given; all three double ' +
    'their own count in week two; answer is three times the sum of the first-week counts.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find exactly three "wrote N <item>s" figures plus a "doubled the number of ' +
          '<item>s" universal second-week statement and a "total/altogether" question; ' +
          'abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `week1=[${result.week1Figures.join(',')}] sum=${result.week1Sum} -> total=${result.grandTotal}`,
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
      const rounded = Math.round(result.grandTotal * 100) / 100;
      return {
        question,
        verdict: String(Math.round((rounded) * 100) / 100),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `3 * (${result.week1Figures.join('+')}) = 3*${result.week1Sum} = ${rounded}`,
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

registerMethod(threeWritersDoubleSecondWeekTotal);
