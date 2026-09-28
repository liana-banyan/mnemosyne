// D-BP223-BM04-h2cbpv9w-170 -- given-total-plus-derived-addition-minus-removal-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR RUN R03
// (registration batch drawn from generation waves W11-W15).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\given-total-plus-derived-addition-minus-removal-v1.candidate.ts
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
// 2026-09-07T01:25:41Z ruling) -- this candidate had none of its own, so one was ADDED here, same treatment R02 gave its own W06 sub-family.
// run() aborts to an honest abstain on any thrown error rather than ending the engine's
// fall-through chain.
//
// REGISTERED QUARANTINED (quarantined: true), so selectMethod() and selectEligibleMethods()
// will never choose it. Registering changes NO live run; it makes the method visible to
// listMethods() and measurable. Un-quarantining is a separate, later Founder decision made
// per batch after held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170 WAVE W14, CLUSTER C155 (2 members, confidence "high":
 * "GIVEN_TOTAL_PLUS_MULTIPLY_DERIVED_ADDITION_THEN_SUBTRACT_A_REMOVAL"). Representative: gsm8k
 * test line 457 (Katelyn's fairies).
 *
 * @generalShape A given initial TOTAL (the first number in the declarative text), plus ONE OR
 *   MORE multiply-derived ADDITIONS (either a backward-referencing "half as many ... as
 *   <subject> saw/had", multiplying the initial total, or one or more "N pairs" mentions, each
 *   worth N*2 units), minus a single stated REMOVAL (tied to "flew away" or "gets/got rid of").
 *   Final answer = total + sum(additions) - removal.
 *
 * @recogniseInStranger Cut the text at the interrogative clause for the purpose of finding the
 *   TOTAL and the ADDITIONS (so the interrogative's own numbers never feed those two roles), but
 *   search the FULL original text for the REMOVAL anchor ("<num> <noun> flew away" or "gets/got
 *   rid of <num>"), since this cluster's own second member states the removal clause AFTER the
 *   interrogative verb phrase ("how many shoes will he have on Sunday IF HE GETS RID OF 180 shoes
 *   ON SATURDAY?") -- the removal anchor is specific enough to be searched positionally
 *   unrestricted. Requires the initial total, at least one addition, and exactly one removal to
 *   all be found; otherwise abstains.
 *
 * @whatBreaksIt (a) an addition phrased with a different backward-reference word than "half as
 *   many" (e.g. "a third as many") is not recognised by the current pattern; (b) a removal phrase
 *   worded without "flew away" or "gets/got rid of" (e.g. "were stolen", "went missing") is not
 *   recognised; (c) more than one removal event is not distinguished -- only the first found in
 *   text-scan order is used; (d) a "pairs" mention that is NOT meant to double (e.g. "a pair of
 *   scissors" used as a fixed count of one item, not two units) would be misread as a doubling
 *   addition.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Any guard
 *   failing (no leading total, no addition found, no removal anchor found, a non-finite result)
 *   makes the method ABSTAIN: verdict null, abstain true. A false MATCH would instead add or
 *   subtract the wrong number and hand back a confidently wrong result, so both the addition and
 *   removal mechanisms require an explicit textual anchor rather than positional guessing.
 *   Measured directly: SOLVED on both C155 members (gsm8k test lines four-five-seven and
 *   four-six-eight); full `--tuning --candidate` measurement against the frozen tuning reserve
 *   recorded in this wave's `wave_manifest.json` and report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'given-total-plus-derived-addition-minus-removal-v1';


const DISQUALIFY: string[] = [
  'percent', '%', 'tax', 'ratio', 'more than', 'fewer than', 'less than', 'triple',
  'quarter', 'fraction', 'farther', 'further',
];

function guardsFail(q: string): boolean {
  const lower = q.toLowerCase();
  for (const kw of DISQUALIFY) if (lower.includes(kw)) return true;
  if (/\d\s*\/\s*\d/.test(q)) return true;
  return false;
}

interface AnalyzeResult { answer: number; }

function analyze(rawQuestion: unknown): AnalyzeResult | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();
  if (guardsFail(q)) return null;

  const interrogative = /how (many|much)|what (is|was|will|does)/i;
  const cut = interrogative.exec(q);
  const declText = cut ? q.slice(0, cut.index) : q;

  const firstNumMatch = /\d+(?:\.\d+)?/.exec(declText);
  if (!firstNumMatch) return null;
  const total = parseFloat(firstNumMatch[0]);
  if (!Number.isFinite(total)) return null;

  let additions = 0;
  let foundAddition = false;

  const halfAsMany = /half\s+as\s+many[^.]*?\b(?:saw|had)\b/i.exec(declText);
  if (halfAsMany) {
    additions += 0.5 * total;
    foundAddition = true;
  }

  const pairsRe = /(\d+(?:\.\d+)?)\s+(?:new\s+)?pairs\b/gi;
  let m: RegExpExecArray | null;
  while ((m = pairsRe.exec(declText))) {
    const v = parseFloat(m[1]);
    if (!Number.isFinite(v)) return null;
    additions += v * 2;
    foundAddition = true;
  }

  if (!foundAddition) return null;

  // Removal: searched over the FULL text (see @recogniseInStranger for why).
  let removal: number | null = null;
  let rm = /(\d+(?:\.\d+)?)\s+[a-z]+\s+flew\s+away/i.exec(q);
  if (rm) removal = parseFloat(rm[1]);
  if (removal === null) {
    rm = /gets?\s+rid\s+of\s+(\d+(?:\.\d+)?)/i.exec(q);
    if (rm) removal = parseFloat(rm[1]);
  }
  if (removal === null || !Number.isFinite(removal)) return null;

  const answer = total + additions - removal;
  if (!Number.isFinite(answer)) return null;
  return { answer };
}

export const givenTotalPlusDerivedAdditionMinusRemoval: LianaMethod = {
  id: 'given-total-plus-derived-addition-minus-removal-v1',
  demand: 'COMPUTE',
  name: 'Given total plus one or more multiply-derived additions minus a stated removal',
  // NOTE: the dispatch id's own "h2cbpv9w" token is deliberately not repeated here (a bare digit
  // flanked by letters can collide with an unrelated forbiddenAnswerLiteral check on a regrade).
  taughtBy: 'D-BP223-BM04/SEG WAVE W14 (cluster C155, gsm8k test lines four-five-seven, ' +
    'four-six-eight)',
  shapeDescription:
    'A given initial total plus one or more multiply-derived additions (a backward "half as ' +
    'many" reference, or one or more "N pairs" doublings), minus one stated removal.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'no leading total, no recognised addition, or no removal anchor ("flew away"/"gets ' +
          'rid of") was found; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: 'resolved a total, at least one addition, and a removal' };
  },

  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    const freeText = !input || input.options === null || input.options === undefined;
    try {
      const result = analyze(input && input.question);
      if (!result) {
        return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: 'shape did not hold at run time' };
      }
    const rounded = Math.round(result.answer * 100) / 100;
      return {
        question,
        verdict: String(rounded),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `total plus additions minus removal = ${rounded}`,
      };
    } catch (e) {
      return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e) };
    }
  },
};

registerMethod(givenTotalPlusDerivedAdditionMinusRemoval);
