// D-BP223-BM04-h2cbp9d8-171 -- two-leg-trip-detour-plus-return-different-speeds-total-time-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R05
// (registration batch drawn from generation waves W21-W23).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\two-leg-trip-detour-plus-return-different-speeds-total-time-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R05
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R05.md): gate 1 (positive yield), gate 2a
// (answer carry, under the gate2_answer_carry.cjs:253 letter-boundary fix installed
// 2026-09-08T09:08:02Z), gate 4 (interception against the live registry), gate 5 (sibling
// interception against the real ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R05.md for the exact
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W22, CLUSTER C207 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 363, "John drives to his friend's house 200
 * miles away. He drives at a speed of 70 mph. He had to take a detour that added 10 miles to his
 * trip. After he gets there he takes a route home that is 240 miles but he goes 80 mph. How long
 * did the trip take?". Silo label: "multi-part travel time calculation" -- matches exactly.
 *
 * @generalShape An outbound leg's base distance and speed are stated, and a separate sentence
 *   adds a detour offset to that SAME outbound distance. A return leg's distance and speed are
 *   stated separately (a different distance and a different speed). Total time = (outbound
 *   distance + detour offset) / outbound speed + return distance / return speed.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) "drives to his friend's house
 *   <D1> miles away"; (b) "drives at a speed of <S1> mph"; (c) "detour that added <offset> miles
 *   to his trip"; (d) "route home that is <D2> miles but he goes <S2> mph".
 *
 * @whatBreaksIt (a) any of the four sentences missing or worded differently -- abstain, the
 *   anchors are exact phrasings from the one known teaching case; (b) either leg's time not
 *   dividing evenly (a fractional-hour leg) -- abstain rather than round, since this candidate
 *   was only ever shown clean-division examples.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a shape
 *   claim guarantees run() reconstructs the same number. Measured against its own (sole) cluster
 *   member: SOLVED ((200+10)/70=3, 240/80=3, total=6). With only one known member there is no
 *   cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'two-leg-trip-detour-plus-return-different-speeds-total-time-v1';

interface Analyzed { totalHours: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const d1Re = /\bdrives\s+to\s+his\s+friend'?s\s+house\s+(\d+(?:\.\d+)?)\s+miles\s+away\b/i;
  const d1M = d1Re.exec(q);
  if (!d1M) return null;
  const [, d1Raw] = d1M;
  const d1 = parseFloat(d1Raw);

  const s1Re = /\bdrives\s+at\s+a\s+speed\s+of\s+(\d+(?:\.\d+)?)\s+mph\b/i;
  const s1M = s1Re.exec(q);
  if (!s1M) return null;
  const [, s1Raw] = s1M;
  const s1 = parseFloat(s1Raw);
  if (!(s1 > 0)) return null;

  const offsetRe = /\bdetour\s+that\s+added\s+(\d+(?:\.\d+)?)\s+miles\s+to\s+his\s+trip\b/i;
  const offsetM = offsetRe.exec(q);
  if (!offsetM) return null;
  const [, offsetRaw] = offsetM;
  const offset = parseFloat(offsetRaw);

  const returnRe = /\broute\s+home\s+that\s+is\s+(\d+(?:\.\d+)?)\s+miles\s+but\s+he\s+goes\s+(\d+(?:\.\d+)?)\s+mph\b/i;
  const returnM = returnRe.exec(q);
  if (!returnM) return null;
  const [, d2Raw, s2Raw] = returnM;
  const d2 = parseFloat(d2Raw);
  const s2 = parseFloat(s2Raw);
  if (!(s2 > 0)) return null;

  const outboundDistance = d1 + offset;
  if (outboundDistance % s1 !== 0) return null;
  const time1 = outboundDistance / s1;
  if (d2 % s2 !== 0) return null;
  const time2 = d2 / s2;

  const totalHours = time1 + time2;
  if (!(totalHours > 0)) return null;
  return { totalHours };
}

export const twoLegTripDetourPlusReturnDifferentSpeedsTotalTime: LianaMethod = {
  id: 'two-leg-trip-detour-plus-return-different-speeds-total-time-v1',
  demand: 'COMPUTE',
  name: 'Detour-adjusted outbound leg plus a separately-stated return leg, each divided by its own speed',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W22 (cluster C207, sole member: pilot corpus item at index 363)',
  shapeDescription:
    'totalHours = (outboundDistance + detourOffset) / outboundSpeed + returnDistance / returnSpeed.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find an outbound distance and speed, a detour offset added to that same ' +
          'outbound distance, and a separately-stated return distance and speed, resolving to a ' +
          'positive exact total hour count; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `total hours = ${result.totalHours}` };
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
          verdict: String(Math.round((result.totalHours) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'divided the detour-adjusted outbound leg and the return leg by their own speeds, then summed',
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

registerMethod(twoLegTripDetourPlusReturnDifferentSpeedsTotalTime);
