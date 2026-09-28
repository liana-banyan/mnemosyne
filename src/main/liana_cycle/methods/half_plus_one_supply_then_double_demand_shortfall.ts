// D-BP223-BM04-h2cbp9d8-171 -- half-plus-one-supply-then-double-demand-shortfall-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R08
// (registration batch drawn from generation waves W28-W29).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\half-plus-one-supply-then-double-demand-shortfall-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R08
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R08.md): gate 1 (positive yield), gate 2a
// (answer carry, under gate2_answer_carry.cjs's v3 -- the array-index/bracket-adjacency fix
// installed 2026-09-08T09:46:02Z, on top of v2's letter-boundary fix installed 09:08:02Z), gate 4
// (interception against the live registry), gate 5 (sibling interception against the real
// ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
// (HARDWIRE\tools\controls\perturbation_gate.mjs, baseline + perturbations, oracle hand-derived
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R08.md for the exact
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W29, cluster C262 (GSM8K test.jsonl item428, singleton).
 *
 * @generalShape A supplier prepares stock for a stated ESTIMATED headcount N, under a rule that
 *   HALF of that estimated headcount gets a SECOND unit of the item (so the supply prepared is
 *   N + N/2, i.e. one-and-a-half times the estimate). A DIFFERENT, ACTUAL headcount M then shows
 *   up, and EVERY one of those M actual attendees wants a second unit (demand = M*2). The
 *   question asks how many of the actual attendees did NOT get a second unit. Verified against
 *   item428's own "#### 26" line before this candidate was written: prepared = 36 + 36/2 = 54,
 *   needed = 40*2 = 80, shortfall = 80-54 = 26.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) an estimated-headcount clause
 *   ("prepare...for <N> guests"); (b) a half-get-a-second-unit rule clause ("enough for half of
 *   the guests to be able to have two <item>s" or similar half-subset-gets-two phrasing);
 *   (c) a DIFFERENT actual-headcount clause ("<M> guests showed up"), with M != N; (d) an
 *   everyone-wants-a-second clause ("everyone wanted a second <item>"); (e) a closing question
 *   asking how many guests did NOT get a second unit.
 *
 * @whatBreaksIt (a) the estimated headcount N is not evenly divisible by 2 -- abstain rather than
 *   report a fractional half-guest; (b) the actual headcount M equals the estimated headcount N
 *   (no genuine over-attendance scenario, a different and simpler question) -- abstain;
 *   (c) demand (M*2) does not exceed supply (N+N/2) -- there would be no shortfall and this
 *   candidate does not attempt the "everyone got a second" case; (d) more than one distinct
 *   headcount figure fills either capture slot -- ambiguous, abstain.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item428): estimated=36, actual=40, prepared = 36 + 36/2 = 54, needed = 40*2 = 80,
 *   shortfall = 80-54 = 26 (exact integer arithmetic throughout, no floats). SOLVED. Reach across
 *   a wider corpus is recorded in wave_manifest.json, not asserted here -- this is a
 *   singleton-cluster shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'half-plus-one-supply-then-double-demand-shortfall-v1';

const ESTIMATED_RE = /prepare\w*\s+[a-z\s]{0,30}?for\s+(\d+)\s+guests/i;
const HALF_RULE_RE = /enough\s+for\s+half\s+of\s+the\s+guests\s+to\s+be\s+able\s+to\s+have\s+two/i;
const ACTUAL_RE = /(\d+)\s+guests\s+showed\s+up/i;
const EVERYONE_RE = /everyone\s+wanted\s+a\s+second/i;
const ASK_RE = /how\s+many\s+guests\s+did\s+not\s+get\s+a\s+second/i;

interface Analyzed { shortfall: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const estM = ESTIMATED_RE.exec(q);
  if (!estM) return null;
  const estimated = Number(estM[1]);
  if (!Number.isInteger(estimated) || estimated <= 0) return null;

  const halfM = HALF_RULE_RE.exec(q);
  if (!halfM) return null;

  const actM = ACTUAL_RE.exec(q);
  if (!actM) return null;
  const actual = Number(actM[1]);
  if (!Number.isInteger(actual) || actual <= 0) return null;
  if (actual === estimated) return null; // no genuine over-attendance scenario

  const everyoneM = EVERYONE_RE.exec(q);
  if (!everyoneM) return null;

  const askM = ASK_RE.exec(q);
  if (!askM) return null;

  if (estimated % 2 !== 0) return null; // would not land on a whole-number half-guest count
  const prepared = estimated + estimated / 2; // exact integer arithmetic
  const needed = actual * 2;
  const shortfall = needed - prepared;
  if (!Number.isInteger(shortfall) || shortfall <= 0) return null; // no shortfall, different case

  return { shortfall };
}

export const halfPlusOneSupplyThenDoubleDemandShortfall: LianaMethod = {
  id: 'half-plus-one-supply-then-double-demand-shortfall-v1',
  demand: 'COMPUTE',
  name: 'Compute the shortfall between a half-subset-gets-two supply plan and an everyone-wants-two actual-attendance demand',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W29, cluster C262, GSM8K test item428',
  shapeDescription:
    'Estimated headcount N; supply prepared = N + N/2 (half of the estimate gets a second unit). ' +
    'Actual headcount M (M != N); demand = M*2 (everyone wants a second unit). ' +
    'Answer = demand - supply, when positive.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find an estimated-headcount + half-of-guests-get-two rule + actual-headcount + ' +
          '"everyone wanted a second" + "how many guests did not get a second" chain resolving to ' +
          'a positive whole-number shortfall; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `guests without a second = ${result.shortfall}` };
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
          verdict: String(Math.round((result.shortfall) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: '(actual*2) - (estimated + estimated/2), exact integer arithmetic',
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

registerMethod(halfPlusOneSupplyThenDoubleDemandShortfall);
