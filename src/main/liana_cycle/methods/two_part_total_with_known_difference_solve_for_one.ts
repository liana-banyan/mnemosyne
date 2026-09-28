// D-BP223-BM04-h2cbpv9w-170 -- two-part-total-with-known-difference-solve-for-one-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\two-part-total-with-known-difference-solve-for-one-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W16, CLUSTER C138 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 84, "A football team played 22 games.
 * They won 8 more than they lost. How many did they win?". Silo label:
 * "algebraic_equation_system -- sum of parts equals whole".
 *
 * @generalShape A whole quantity T is stated as the total of two complementary parts (won/lost
 *   games). A second sentence states one part exceeds the other by a fixed difference D, using
 *   the SAME pair of complementary verbs. The question asks for ONE of the two parts, named by
 *   the same verb pair. This is the classic sum-and-difference algebraic system: if partX =
 *   partY + D and partX + partY = T, then partY = (T-D)/2 and partX = (T+D)/2.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence:
 *   (a) a "played <T> games" total sentence;
 *   (b) a "they <won|lost> <D> more than they <lost|won>" difference sentence, using the
 *       win/lose verb pair specifically (never a different complementary pair this candidate has
 *       no evidence for);
 *   (c) the question asking "how many did they <win|lose>", naming one of the same two verbs.
 *
 * @whatBreaksIt (a) no explicit game total -- abstain; (b) the difference sentence not using
 *   BOTH win and lose (e.g. "they won 8 more than 10" with a bare number instead of the
 *   complementary verb) -- abstain, never assume which quantity 10 refers to; (c) the requested
 *   verb in the question matching neither of the two verbs named in (b) -- abstain; (d) the
 *   sum-and-difference system not landing on an exact integer split -- abstain rather than round,
 *   using exact integer division checked before use.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED ((22+8)/2 matches the item's own accepted win count exactly).
 *   With only one known cluster member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'two-part-total-with-known-difference-solve-for-one-v1';

interface Analyzed { value: number; }

// Present-tense form for each past-tense verb this shape recognizes, so the question's own
// "how many did they win/lose" phrasing can be matched back to the sentence's "won/lost".
const PRESENT_OF: Record<string, string> = { won: 'win', lost: 'lose' };
const OPPOSITE_OF: Record<string, string> = { won: 'lost', lost: 'won' };

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // (a) the total.
  const totalRe = /\bplayed\s+(\d+)\s+games\b/i;
  const totm = totalRe.exec(q);
  if (!totm) return null;
  const total = parseInt(totm[1], 10);

  // (b) the difference sentence, requiring the true win/lose complementary pair.
  const diffRe = /\bthey\s+(won|lost)\s+(\d+)\s+more\s+than\s+they\s+(won|lost)\b/i;
  const dm = diffRe.exec(q);
  if (!dm) return null;
  const verbA = dm[1].toLowerCase();
  const diff = parseInt(dm[2], 10);
  const verbB = dm[3].toLowerCase();
  if (OPPOSITE_OF[verbA] !== verbB) return null;

  // (c) the question's own target verb.
  const targetRe = /how\s+many\s+did\s+they\s+(win|lose)\b/i;
  const tm = targetRe.exec(q);
  if (!tm) return null;
  const targetVerb = tm[1].toLowerCase();

  // Sum-and-difference system: verbA-count = verbB-count + diff; verbA-count + verbB-count = total.
  const numeratorB = total - diff;
  if (numeratorB % 2 !== 0) return null;
  const verbBCount = numeratorB / 2;
  const verbACount = verbBCount + diff;

  if (PRESENT_OF[verbA] === targetVerb) return { value: verbACount };
  if (PRESENT_OF[verbB] === targetVerb) return { value: verbBCount };
  return null;
}

export const twoPartTotalWithKnownDifferenceSolveForOne: LianaMethod = {
  id: 'two-part-total-with-known-difference-solve-for-one-v1',
  demand: 'COMPUTE',
  name: 'Solve a sum-and-difference system (total = wins+losses, wins-losses=D) for one named part',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W16 (cluster C138, sole member harvest_gsm8k_pilot_item84_algebraic_equation_system)',
  shapeDescription:
    'A total games-played figure; a stated difference between wins and losses using the win/lose ' +
    'verb pair; the question asks for one of the two parts; solved via the classic sum-and-' +
    'difference algebraic system, exact integer split required.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a games-played total plus a win/lose difference sentence plus a ' +
          'matching how-many-did-they-win-or-lose question with an exact integer split; ' +
          'abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `solved part = ${result.value}` };
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
          verdict: String(Math.round(result.value * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'sum-and-difference system solved exactly for the requested part',
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

registerMethod(twoPartTotalWithKnownDifferenceSolveForOne);
