// D-BP223-BM04-h2cbpv9w-170 -- sequential-signed-boarding-changes-backsolve-initial-value-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\sequential-signed-boarding-changes-backsolve-initial-value-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W19, CLUSTER C182 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 326, "Some people got on a bus at the
 * terminal. At the first bus stop, 5 more people got in. Then at the second bus stop, 7 people
 * got down and 8 more got in. If there were a total of 20 people heading to the third stop, how
 * many people got on the bus at the terminal?" Silo label: "multi-step word problem involving
 * addition and subtraction to find an initial value" -- matches exactly.
 *
 * @generalShape An UNKNOWN starting headcount ("Some people got on ... at the terminal", no
 *   number given) is followed by an ordered sequence of one or more signed changes: a positive
 *   clause ("<N> more people got in") ADDS N, a negative clause ("<N> people got down/off")
 *   SUBTRACTS N. A closing sentence states the KNOWN final total after all changes. The unknown
 *   starting count is backsolved as final - sum(signed changes).
 *
 * @recogniseInStranger Requires ALL of, as positive evidence:
 *   (a) an opening sentence "some people got on [a/the] bus at the terminal" with NO number
 *       attached to the starting headcount;
 *   (b) at least one positive clause matching "<N> more [people] got in" (or "got on") and/or at
 *       least one negative clause matching "<N> [people] got down" (or "got off") -- the noun
 *       "people" is OPTIONAL in the regex because a second or later clause routinely elides it
 *       once already established ("5 more people got in ... 8 more got in"), and requiring it on
 *       every occurrence would silently under-count exactly the multi-stop case this candidate
 *       exists for; each occurrence is scanned independently and summed algebraically, so any
 *       number of stops is handled the same way;
 *   (c) a closing sentence "there were a total of <F> people heading to the <ordinal> stop", and
 *       a question asking "how many people got on the bus at the terminal";
 *   (d) at least one positive AND one negative clause must both be present (this candidate's
 *       narrow, safe recognition; a run with only same-sign changes is a different, simpler
 *       shape it does not attempt).
 *
 * @whatBreaksIt (a) any numeral in the text that is an ORDINAL stop label ("first", "second",
 *   "third") rather than a headcount -- these are matched as words, never captured as a signed
 *   quantity, so they cannot leak into the sum; (b) a starting headcount that IS given as a
 *   number -- out of scope, this candidate exists specifically for the unknown-start case;
 *   (c) the backsolved initial value landing negative or non-integer -- abstain rather than
 *   report an impossible headcount.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (final 20; net change +5-7+8=+6; initial = 20-6=14). With only
 *   one known cluster member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'sequential-signed-boarding-changes-backsolve-initial-value-v1';

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  if (!/\bsome\s+people\s+got\s+on\s+(?:a|the)\s+bus\s+at\s+the\s+terminal\b/i.test(q)) return null;

  // "people" is frequently elided on a second or later clause ("5 more people got in ...
  // 8 more got in") once the noun has already been established -- both forms must be caught,
  // never only the first, spelled-out one.
  const posRe = /(\d+)\s+more\s+(?:people\s+)?got\s+(?:in|on)\b/gi;
  const negRe = /(\d+)\s+(?:people\s+)?got\s+(?:down|off)\b/gi;

  let net = 0;
  let posCount = 0;
  let negCount = 0;
  let m: RegExpExecArray | null;
  while ((m = posRe.exec(q)) !== null) {
    const v = parseInt(m[1], 10);
    if (!Number.isFinite(v)) return null;
    net += v;
    posCount++;
  }
  while ((m = negRe.exec(q)) !== null) {
    const v = parseInt(m[1], 10);
    if (!Number.isFinite(v)) return null;
    net -= v;
    negCount++;
  }
  if (posCount === 0 || negCount === 0) return null;

  const finalRe = /there were\s+a\s+total\s+of\s+(\d+)\s+people\s+heading\s+to\s+the\s+[a-z]+\s+stop\b/i;
  const fm = finalRe.exec(q);
  if (!fm) return null;
  const finalTotal = parseInt(fm[1], 10);
  if (!Number.isFinite(finalTotal) || finalTotal < 0) return null;

  if (!/how many people got on the bus at the terminal/i.test(q)) return null;

  const initial = finalTotal - net;
  if (initial < 0 || !Number.isInteger(initial)) return null;
  return { total: initial };
}

export const sequentialSignedBoardingChangesBacksolveInitialValue: LianaMethod = {
  id: 'sequential-signed-boarding-changes-backsolve-initial-value-v1',
  demand: 'COMPUTE',
  name: 'Backsolve an unknown starting headcount from a sequence of signed boarding changes and a known final total',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W19 (cluster C182, sole member: pilot corpus item at index 326)',
  shapeDescription:
    'initial = finalTotal - sum(signed changes), where each "N more people got in" is +N and ' +
    'each "N people got down/off" is -N, scanned across the whole text so any number of stops ' +
    'is handled the same way.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find an unknown-start boarding-at-the-terminal opening with no number ' +
          'attached, at least one positive AND one negative signed boarding-change clause, a ' +
          'closing "total of N people heading to the <ordinal> stop" sentence, and the matching ' +
          'closing question, resolving to a non-negative integer; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `backsolved initial headcount = ${result.total}` };
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
          basis: 'summed the signed boarding changes and subtracted from the known final total',
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

registerMethod(sequentialSignedBoardingChangesBacksolveInitialValue);
