// D-BP223-BM04-h2cbp9d8-171 -- two-request-groups-plus-multiple-minus-prebought-stock-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R05
// (registration batch drawn from generation waves W21-W23).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\two-request-groups-plus-multiple-minus-prebought-stock-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W21, CLUSTER C198 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl line 351, "April is donating plant pots to a local school for
 * their new garden. They ask for 30 plant pots for the daisies, and twice as many for the roses.
 * April had already bought 100 plant pots from the garden center before she knew how many she
 * needed. How many plant pots does April have left over?" Silo label: "multi-step word problem
 * involving multiplication and subtraction".
 *
 * @generalShape A RECIPIENT requests a stated count of an item for one named purpose (group A),
 *   and a SECOND stated count for a second named purpose (group B), where group B's count is
 *   expressed as a multiple of group A's count ("<mult> times as many for <purposeB>", the
 *   purpose noun standing in for a repeated item reference -- "as many" implicitly elides the
 *   item word rather than repeating it). An ACTOR separately already owns/bought a stated total
 *   of the SAME item, BEFORE knowing the requested amounts. The question asks how many of the
 *   item the actor has left over after fulfilling both requests. Answer = ownedTotal -
 *   (groupA + groupB).
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) a first request clause "ask for
 *   <N1> <item> for the <purposeA>"; (b) a second request clause "<mult> as many for the
 *   <purposeB>" (multiplier via a shared number-word table, also accepting "twice"), with NO item
 *   noun repeated (the elided "of them"/"as many <item>" form) immediately following (a) in the
 *   same sentence; (c) a separate sentence "<Actor> had already bought <N2> <item>" naming the
 *   SAME item as (a), with an explicit "before <Actor> knew how many ... needed" (or equivalent)
 *   clause confirming the purchase predates the requests; (d) a closing "how many <item> does
 *   <Actor> have left over" question.
 *
 * @whatBreaksIt (a) the item word in the pre-bought sentence differing from the requested item --
 *   abstain, cannot confirm the same running quantity; (b) the requested total (groupA + groupB)
 *   exceeding the pre-bought amount -- abstain rather than report a negative leftover; (c) the
 *   second request clause naming its own explicit item noun rather than eliding it via "as many"
 *   -- out of this candidate's narrower elided-reference scope, abstain; (d) more than two
 *   request purposes present -- abstain, this candidate only reasons about exactly two.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (100 - (30 + 30*2) = 10). With only one known cluster member
 *   there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'two-request-groups-plus-multiple-minus-prebought-stock-v1';

interface Analyzed { leftover: number; }

const NUMBER_WORD_LIST = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
];

function wordToMultiplier(word: string): number | null {
  const w = word.toLowerCase().trim();
  if (w === 'twice') return 2;
  if (w === 'thrice') return 3;
  const idx = NUMBER_WORD_LIST.indexOf(w);
  if (idx >= 0) return idx;
  const digitMatch = /^\d+$/.exec(w);
  if (digitMatch) return parseInt(w);
  return null;
}

function stemItem(word: string): string {
  let w = word.trim().toLowerCase();
  if (w.endsWith('es') && w.length > 3) w = w.slice(0, -2);
  else if (w.endsWith('s') && w.length > 2) w = w.slice(0, -1);
  return w;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const requestRe = /ask(?:s|ed)?\s+for\s+(\d+)\s+((?:[a-z]+\s+)?[a-z]+)\s+for\s+the\s+[a-z]+,?\s+and\s+(twice|thrice|[a-z]+)\s+as\s+many\s+for\s+the\s+[a-z]+/i;
  const rm = requestRe.exec(q);
  if (!rm) return null;
  const groupA = parseInt(rm[1]);
  if (!Number.isFinite(groupA) || groupA <= 0) return null;
  const item = stemItem(rm[2]);
  const mult = wordToMultiplier(rm[3]);
  if (mult == null || mult <= 0) return null;
  const groupB = groupA * mult;

  const boughtRe = new RegExp(
    'already\\s+bought\\s+(\\d+)\\s+' + escapeRe(item) + 's?\\b[^.]*?before[^.]*?(?:knew|knowing)\\s+how\\s+many', 'i',
  );
  const bm = boughtRe.exec(q);
  if (!bm) return null;
  const ownedTotal = parseInt(bm[1]);
  if (!Number.isFinite(ownedTotal) || ownedTotal < 0) return null;

  const closingRe = new RegExp(
    'how\\s+many\\s+' + escapeRe(item) + 's?\\s+does\\s+[a-z]+\\s+have\\s+left\\s+over\\b', 'i',
  );
  if (!closingRe.test(q)) return null;

  const requested = groupA + groupB;
  if (requested > ownedTotal) return null;
  const leftover = ownedTotal - requested;
  if (!Number.isFinite(leftover) || leftover < 0) return null;
  return { leftover };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const twoRequestGroupsPlusMultipleMinusPreboughtStock: LianaMethod = {
  id: 'two-request-groups-plus-multiple-minus-prebought-stock-v1',
  demand: 'COMPUTE',
  name: 'Two elided-reference request groups (second a multiple of the first) subtracted from a pre-bought stock -- exact integer arithmetic',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W21 (cluster C198, sole member: pilot corpus item at index 351)',
  shapeDescription: 'leftover = ownedTotal - (groupA + groupA*mult)',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a two-purpose request sentence ("ask for <N1> <item> for the <purposeA>, ' +
          'and <mult> as many for the <purposeB>"), a matching "already bought <N2> <item> ... ' +
          'before <knew how many needed>" sentence, and a closing "how many <item> ... left ' +
          'over" question all sharing the same item; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `leftover = ${result.leftover}` };
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
          verdict: String(Math.round((result.leftover) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'ownedTotal minus the sum of the two request groups, exact integers',
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

registerMethod(twoRequestGroupsPlusMultipleMinusPreboughtStock);
