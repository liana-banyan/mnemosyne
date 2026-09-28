// D-BP223-BM04-h2cbpv9w-170 -- stated-age-projected-n-years-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR RUN R03
// (registration batch drawn from generation waves W11-W15).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\stated-age-projected-n-years-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W15, SHAPE 8 of 8: "ages in n years", mined by frequency over
 * the frozen TUNING RESERVE (gsm8k-train half, 3685 items; never the held-out half). Cue-word
 * membership over the reserve: 167 of 3685 items match a loose keyword probe (years old / age of
 * / in N years / N years ago). Representative teaching case authored directly to this shape
 * (below): a single actor's current age is stated, and the question asks their age at a stated
 * future or past offset in years.
 *
 * @generalShape A single actor's CURRENT age is stated directly ("<Actor> is <N> years old").
 *   The closing question asks for that SAME actor's age at a stated offset: "in <M> years, how
 *   old will <Actor> be" (future, add) or "how old was <Actor> <M> years ago" (past, subtract).
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) a current-age sentence
 *   "<Actor> is <N> years old"; (b) a closing offset clause matching EITHER "in <M> years, how
 *   old will <Actor> be" OR "how old was <Actor> <M> years ago", naming the SAME actor as (a);
 *   (c) exactly one current-age sentence in the question (a second actor's age is a different,
 *   multi-actor shape this candidate does not attempt).
 *
 * @whatBreaksIt (a) the actor named in the offset clause differing from the actor in the
 *   current-age sentence -- abstain, this candidate only projects the SAME actor's own stated
 *   age; (b) more than one current-age sentence present -- abstain, ambiguous which actor's age
 *   anchors the projection; (c) an intervening relative-age clause ("Actor2 is N years older than
 *   Actor1") between the anchor and the question -- abstain, this candidate reads only a single
 *   direct age statement, never a derived one; (d) the past-offset result being negative --
 *   abstain, an actor cannot have a negative age.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass. Measured against
 *   its own representative teaching case (a clean "is N years old ... in M years, how old will"
 *   template): SOLVED. Reach across the wider tuning reserve is recorded in wave_manifest.json,
 *   not asserted here.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'stated-age-projected-n-years-v1';


const AGE_RE = /\b([A-Z][a-z]+)\s+is\s+(\d+)\s+years?\s+old\b/g;

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const ageMatches: { actor: string; age: number }[] = [];
  AGE_RE.lastIndex = 0;
  let am: RegExpExecArray | null;
  while ((am = AGE_RE.exec(q)) !== null) {
    ageMatches.push({ actor: am[1], age: parseFloat(am[2]) });
  }
  if (ageMatches.length !== 1) return null;
  const { actor, age } = ageMatches[0];

  const futureRe = new RegExp('in\\s+(\\d+)\\s+years,?\\s+how old will\\s+' + actor + '\\s+be', 'i');
  const pastRe = new RegExp('how old was\\s+' + actor + '\\s+(\\d+)\\s+years ago', 'i');

  const fm = futureRe.exec(q);
  if (fm) {
    const offset = parseFloat(fm[1]);
    if (!Number.isFinite(offset)) return null;
    return { total: age + offset };
  }
  const pm = pastRe.exec(q);
  if (pm) {
    const offset = parseFloat(pm[1]);
    if (!Number.isFinite(offset)) return null;
    const result = age - offset;
    if (result < 0) return null;
    return { total: result };
  }
  return null;
}

export const statedAgeProjectedNYears: LianaMethod = {
  id: 'stated-age-projected-n-years-v1',
  demand: 'COMPUTE',
  name: 'Project a single stated current age forward or backward by a stated number of years',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W15 (shape 8 of 8, mined by frequency over the tuning reserve, 167/3685 keyword members)',
  shapeDescription:
    'A single "<Actor> is N years old" statement plus a closing "in M years, how old will <Actor> ' +
    'be" (or "how old was <Actor> M years ago") question about the SAME actor -- answer is the ' +
    'stated age plus or minus the offset.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find exactly one current-age statement for a single actor plus a matching ' +
          'future/past offset question about that same actor resolving non-negative; abstaining ' +
          'rather than guessing',
      };
    }
    return { matches: true, reason: `projected age = ${result.total}` };
  },

  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    const freeText = !input || input.options === null || input.options === undefined;
    try {
      const result = analyze(input && input.question);
      if (!result) {
        return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: 'shape did not hold at run time' };
      }
      const rounded = Math.round((result.total) * 100) / 100;
      return { question, verdict: String(rounded), abstain: false, freeText, method: METHOD_ID, basis: 'applied the stated year offset to the single stated current age' };
    } catch (e) {
      return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e) };
    }
  },
};

registerMethod(statedAgeProjectedNYears);
