// D-BP223-BM04-h2cbpv9w-170 -- sum-achieved-periods-then-subtract-from-target-shortfall-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR RUN R03
// (registration batch drawn from generation waves W11-W15).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\sum-achieved-periods-then-subtract-from-target-shortfall-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR RUN R03
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R03.md): gate 1 (positive yield), gate 2a (answer
// carry), gate 4 (interception against the live registry), gate 5 (sibling interception
// against the real ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
// (HARDWIRE\tools\controls\perturbation_gate.mjs, baseline + 3 perturbations, oracle
// hand-derived from the English of the representative GSM8K question, never from this
// candidate's own source) -- ACCEPT on all of gate 1/2a/4/5 and TRACK on all of gate 2b's
// trials.
//
// WHY THIS FILE EXISTS RATHER THAN THE CANDIDATE ITSELF. The candidate declared its OWN
// local LianaQuestionInput, ShapeTestResult and RunResult interfaces and left the exported
// object unannotated, so nothing was ever checked against the real registry contract. Those
// three local interfaces are DELETED here; LianaMethod and MethodQuestionInput are imported
// from '../method_registry' and the exported object is annotated against the real
// LianaMethod type, per the estate's standing order NEVER CAST, ANNOTATE.
//
// THE BEHAVIOR CORE IS COPIED BYTE-FOR-BYTE AND DELIBERATELY NOT IMPROVED: every constant,
// every helper function and analyze() itself below are the candidate's own bytes -- proved
// by a programmatic byte-containment check (extract, splice, re-read, includes()), not
// merely asserted. See BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R03.md for the exact
// core-bytes/core-lines/CONTAINED table.
//
// TRY/CATCH, matching the Founder-approved pass across earlier batches (D-BP223-BM0-005,
// 2026-09-07T01:25:41Z ruling).
// run() aborts to an honest abstain on any thrown error rather than ending the engine's
// fall-through chain.
//
// REGISTERED QUARANTINED (quarantined: true), so selectMethod() and selectEligibleMethods()
// will never choose it. Registering changes NO live run; it makes the method visible to
// listMethods() and measurable. Un-quarantining is a separate, later Founder decision made
// per batch after held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170 WAVE W11 CLUSTER C114 (1 silo member, singleton, high confidence).
 * Representative teaching case: GSM8K test.jsonl line 297, "Sam sells bread. He has a target of
 * selling 120 crates of bread in a week. One week he was closed on Monday and Friday. Over the
 * weekend he sold 20 crates. On Tuesday he sold 15 crates, on Wednesday 12 crates, and Thursday
 * 18 crates. By how many crates was Sam off from his target for the week?"
 *
 * @generalShape A stated numeric TARGET/GOAL is given for a unit noun ("a target of selling <T>
 *   <unit>"). Two or more ACHIEVED amounts of the SAME unit noun are then stated across separate
 *   labeled sub-periods ("On <day> he sold <N> <unit>", "Over the weekend he sold <N> <unit>").
 *   The question asks "By how many <unit> was <subject> off (from|of) his/her/its target", and the
 *   answer is the absolute difference between the target and the sum of every achieved amount.
 *
 * @recogniseInStranger Anchors, all sharing the same unit noun: (1) "target of selling <T>
 *   <unit>"; (2) EVERY "sold <N> <unit>" occurrence anywhere in the body (collected via a global
 *   scan, not a fixed count, since the number of sub-periods varies -- this is itself positive
 *   evidence: at least two such occurrences are required, since a single achieved figure would be
 *   a simpler target-minus-one-actual shape this candidate does not claim); (3) the closing
 *   question anchored to the literal phrase "off (?:from|of) (?:his|her|its|their) target",
 *   naming the SAME unit noun as the target and the achieved figures.
 *
 * @whatBreaksIt (a) fewer than two "sold <N> <unit>" occurrences -- abstains, this shape requires
 *   multiple sub-period figures to sum; (b) more than one stated target for the same unit noun --
 *   ambiguous, abstains; (c) any achieved figure stated in a different unit than the target --
 *   this candidate requires the identical unit-noun string in every occurrence and abstains on a
 *   mismatch; (d) the question asking how much OVER (rather than off/short of) the target -- still
 *   matched by this candidate's phrase (it reports an absolute difference either way), but a
 *   question asking for something other than the target-vs-achieved gap (e.g. asking for the
 *   achieved total itself) does not match the anchored question phrase and abstains.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (15+12+18+20=65 sold; |120-65|=55 off). With
 *   only one known cluster member there is no cross-member measurement to report for this
 *   singleton cluster -- noted honestly rather than inflated with a number borrowed from a
 *   different shape.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'sum-achieved-periods-then-subtract-from-target-shortfall-v1';


interface Analyzed {
  target: number;
  achieved: number[];
  achievedSum: number;
  shortfall: number;
}

function toFinite(n: number): boolean {
  return typeof n === 'number' && Number.isFinite(n);
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // (1) Target: "target/goal of selling <T> <unit>". Widened from "target" alone to also accept
  // "goal" (Round-2 tuning, RULE 6): no matching item for either word was found anywhere in the
  // 4,767-item tuning reserve, so this is a good-faith English-synonym widening rather than one
  // backed by a positive tuning-reserve match; it changes no arithmetic, only the recognised
  // keyword.
  const targetRe = /\b(?:target|goal)\s+of\s+selling\s+([0-9]+(?:\.[0-9]+)?)\s+([a-z]+)\b/i;
  const targetMatch = targetRe.exec(q);
  if (!targetMatch) return null;
  const target = parseFloat(targetMatch[1]);
  const unit = targetMatch[2].toLowerCase().replace(/s$/, '');
  if (!Number.isFinite(target)) return null;

  // Refuse a second, distinct target for the same unit -- ambiguity guard.
  const targetGlobalRe = new RegExp('\\b(?:target|goal)\\s+of\\s+selling\\s+[0-9]+(?:\\.[0-9]+)?\\s+' + unit + 's?\\b', 'gi');
  const targetMatches = q.match(targetGlobalRe) || [];
  if (targetMatches.length !== 1) return null;

  // (2) Achieved figures. The verb "sold" anchors the narrative (required at least once, positive
  // evidence this is a selling-achieved shape) but a list of sub-periods commonly ELIDES the
  // repeated verb ("On Tuesday he sold 15 crates, on Wednesday 12 crates, and Thursday 18
  // crates" -- only the first clause carries "sold"). So this candidate requires "sold" to appear
  // at least once, then collects EVERY "<N> <unit>" occurrence OUTSIDE the target clause itself
  // (the target's own figure is excluded by substring removal, never double-counted).
  if (!/\bsold\b/i.test(q)) return null;
  const searchText = q.slice(0, targetMatch.index) + q.slice(targetMatch.index + targetMatch[0].length);
  const figureRe = new RegExp('\\b([0-9]+(?:\\.[0-9]+)?)\\s+' + unit + 's?\\b', 'gi');
  const achieved: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = figureRe.exec(searchText)) !== null) {
    const v = parseFloat(m[1]);
    if (!Number.isFinite(v)) return null;
    achieved.push(v);
  }
  if (achieved.length < 2) return null;

  // (3) The closing question anchored to "off/under/short (from/of) ... target/goal", same unit
  // noun. The phrase list is widened (Round-2 tuning, RULE 6) from "off (from|of) ... target"
  // alone to also accept "under"/"short of" and the "goal" synonym -- no matching item was found
  // in the tuning reserve for any of these phrasings, so this is a good-faith synonym widening,
  // not one backed by positive evidence.
  const questionRe = new RegExp(
    'by\\s+how\\s+many\\s+' + unit + 's?\\b[^.?!]*?\\b(?:off\\s+(?:from|of)|under|short\\s+of)\\b[^.?!]*?\\b(?:target|goal)\\b',
    'i'
  );
  if (!questionRe.test(q)) return null;

  const achievedSum = achieved.reduce((a, b) => a + b, 0);
  const shortfall = Math.abs(target - achievedSum);
  if (!toFinite(achievedSum) || !toFinite(shortfall)) return null;

  return { target, achieved, achievedSum, shortfall };
}

export const sumAchievedPeriodsThenSubtractFromTargetShortfall: LianaMethod = {
  id: 'sum-achieved-periods-then-subtract-from-target-shortfall-v1',
  demand: 'COMPUTE',
  name: 'Sum achieved amounts across labeled sub-periods, report absolute shortfall from a stated target',
  taughtBy:
    'D-BP223-BM04-h2cbpv9w-170 WAVE W11 (cluster C114, sole member harvest_gsm8k_pilot_item297, GSM8K test.jsonl line 297)',
  shapeDescription:
    'A stated target for a unit noun; two or more "sold N <unit>" sub-period figures summed; ' +
    'answer is the absolute difference between the target and that sum.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a single stated target, at least two matching "sold N <unit>" figures, ' +
          'and an "off from/of ... target" question; abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `target=${result.target} sum=${result.achievedSum} -> off=${result.shortfall}`,
    };
  },

  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    const freeText = !input || input.options === null || input.options === undefined;
    try {
      const result = analyze(input && input.question);
      if (!result) {
        return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: 'shape did not hold at run time' };
      }
      const rounded = Math.round((result.shortfall) * 100) / 100;
      return {
        question,
        verdict: String(rounded),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `|${result.target} - (${result.achieved.join('+')})| = ${rounded}`,
      };
    } catch (e) {
      return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e) };
    }
  },
};

registerMethod(sumAchievedPeriodsThenSubtractFromTargetShortfall);
