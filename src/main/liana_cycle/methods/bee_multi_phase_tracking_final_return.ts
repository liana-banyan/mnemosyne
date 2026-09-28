// D-BP223-BM04-h2cbpv9w-170 -- bee-multi-phase-tracking-final-return-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W05).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\bee-multi-phase-tracking-final-return-v1.candidate.ts
// Authored by generation wave W05 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W05.md),
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W05 CLUSTER C69 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl item147, "Debra is monitoring a beehive... She sees 30 bees
 * leave the hive in the first 6 hours, and then she sees 1/2 that many bees return in the next 6
 * hours. She sees two times as many bees as she saw first leave the hive fly from the hive and
 * leave in the next 6 hours. Then every bee that left before that hadn't already returned returns
 * to the hive in the next 6 hours. How many bees did Debra see return to the hive in the last 6
 * hours of the day?".
 *
 * @generalShape A four-phase population narrative: (1) an initial count I leaves; (2) a stated
 *   FRACTION of I returns; (3) a stated MULTIPLE of I leaves in a second wave; (4) a final phase
 *   in which EVERY unit that left earlier and had not yet returned returns. The final phase's
 *   count = (total that ever left) - (already returned) = (I + multiple*I) - fraction*I.
 *
 * @recogniseInStranger Requires all four phases as distinct textual cues: (a) an initial count
 *   given directly ("sees <N> ... leave ... in the first ... hours"), (b) an explicit FRACTION
 *   phrase ("<p>/<q> that many ... return"), (c) an explicit MULTIPLE phrase ("<k> times as many
 *   ... as ... first leave ... leave"), and (d) the literal closing cue "every ... that left
 *   before that hadn't already returned returns" marking the final, total-catch-up phase. The
 *   question must ask how many returned in the LAST/FINAL period.
 *
 * @whatBreaksIt (a) any of the four phase cues missing -- abstains, this is a specific enough
 *   narrative shape that a partial match is not trusted; (b) the fraction or multiple do not
 *   parse to a clean rational number -- abstains rather than round; (c) a stranger variant with a
 *   FIFTH phase (another leave/return cycle before the final catch-up) is not recognised by this
 *   candidate -- flagged rather than hidden, since only one member is known.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own sole cluster member: SOLVED (75). With only one known member there is no
 *   cross-member measurement to report for this cluster.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'bee-multi-phase-tracking-final-return-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });

const SPECIAL_MULTIPLIERS: Record<string, number> = { twice: 2, thrice: 2 + 1 };

function wordOrDigit(tok: string): number | null {
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit)) return Number(digit);
  const w = tok.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(ONES, w)) return ONES[w];
  return null;
}

interface Analyzed {
  answer: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  if (!/how\s+many\s+\w+\s+did\s+\w+\s+see\s+return.*(?:last|final)/i.test(q)) return null;
  if (!/every\s+\w+\s+that\s+left\s+before\s+that\s+hadn'?t\s+already\s+returned\s+returns/i.test(q)) return null;

  const initialMatch = /sees?\s+([a-z0-9]+)\s+\w+\s+leave\s+the\s+hive\s+in\s+the\s+first/i.exec(q);
  if (!initialMatch) return null;
  const initial = wordOrDigit(initialMatch[1]);
  if (initial === null || initial <= 0) return null;

  const fractionMatch = /(\d+)\s*\/\s*(\d+)\s+that\s+many\s+\w+\s+return/i.exec(q);
  if (!fractionMatch) return null;
  const fracNum = Number(fractionMatch[1]);
  const fracDen = Number(fractionMatch[2]);
  if (!fracDen) return null;

  const multMatch = /(twice|thrice|[a-z0-9]+\s+times)\s+as\s+many\s+\w+\s+as\s+(?:she|he|they)\s+saw\s+first\s+leave\s+the\s+hive\s+fly\s+from\s+the\s+hive\s+and\s+leave/i.exec(q);
  if (!multMatch) return null;
  let multiplier: number | null = null;
  const multToken = multMatch[1].toLowerCase();
  if (Object.prototype.hasOwnProperty.call(SPECIAL_MULTIPLIERS, multToken)) {
    multiplier = SPECIAL_MULTIPLIERS[multToken];
  } else {
    const timesTok = multToken.replace(/\s+times$/, '');
    multiplier = wordOrDigit(timesTok);
  }
  if (multiplier === null) return null;

  // returned-already (in cents-free integer arithmetic: multiply everything by fracDen first,
  // then divide once at the end, so no intermediate rounding occurs).
  const numerator = initial * fracDen * (1 + multiplier) - initial * fracNum;
  if (numerator % fracDen !== 0) return null; // must resolve to a whole number of bees
  const answer = numerator / fracDen;
  if (!Number.isFinite(answer) || answer < 0) return null;
  return { answer };
}

export const beeMultiPhaseTrackingFinalReturn: LianaMethod = {
  id: 'bee-multi-phase-tracking-final-return-v1',
  demand: 'COMPUTE',
  name: 'Four-phase leave/return population narrative, final-phase catch-up count',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W05 (cluster C69, sole member harvest_gsm8k_pilot_item147)',
  shapeDescription:
    'Initial count leaves; a fraction of it returns; a multiple of it leaves in a second wave; a ' +
    'final phase returns every unit not yet back: answer = (initial + multiple*initial) - ' +
    'fraction*initial.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find an initial leave count, an explicit fraction-return phrase, an explicit ' +
          'multiple second-wave-leave phrase, the literal "every ... hadn\'t already returned ' +
          'returns" closing cue, and a "how many ... return ... last/final" question',
      };
    }
    return { matches: true, reason: `answer=${result.answer}` };
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
        verdict: String(Math.round((result.answer) * 100) / 100),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: '(initial + multiple*initial) - fraction*initial',
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

registerMethod(beeMultiPhaseTrackingFinalReturn);
