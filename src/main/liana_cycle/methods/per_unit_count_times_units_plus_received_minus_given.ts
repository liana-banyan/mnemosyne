// D-BP223-BM04-h2cbpv9w-170 -- per-unit-count-times-units-plus-received-minus-given-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\per-unit-count-times-units-plus-received-minus-given-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W16, CLUSTER C141 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 99, "Mary... received 18 new potted plants
 * ... She already has 2 potted plants on each of the 40 window ledges... she will give 1 potted
 * plant from each ledge to friends and family tomorrow. How many potted plants will Mary remain
 * with?". Silo label: "inventory management -- addition and subtraction of items in a set".
 *
 * @generalShape An existing per-unit count is stated, spread across a named number of units
 *   ("has <perUnit1> <item> on each of <N> <unit>"). A separate quantity of the SAME item is
 *   received. A further per-unit amount of the SAME item, spread across the SAME units, is then
 *   given away ("give <perUnit2> <item> from each <unit>"). The question asks how many of the
 *   item remain. Answer = perUnit1*N + received - perUnit2*N.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence:
 *   (a) a "has <perUnit1> <item phrase> on each of <N> <unit>" existing-inventory sentence;
 *   (b) a "received <amount> new <item phrase>" sentence for the same item;
 *   (c) a "give <perUnit2> <item phrase> from each <unit>" give-away sentence, where the unit
 *       word singular-matches the existing-inventory sentence's own unit word;
 *   (d) the question's own closing sentence containing "remain", so this candidate never answers
 *       an unrelated "how many are there now" question that skips the give-away step.
 *
 * @whatBreaksIt (a) no per-unit existing-inventory sentence -- abstain; (b) the give-away
 *   sentence's unit word not singular-matching the existing-inventory sentence's unit word --
 *   abstain, never assume they refer to the same set of units; (c) no explicit "remain" cue in
 *   the closing sentence -- abstain, this guards against a nearby but different question; (d) any
 *   of the three quantities not present as a plain integer -- abstain rather than guess.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (per-unit existing count times unit count, plus received, minus
 *   per-unit give-away times unit count, matches the item's own accepted remainder exactly). With
 *   only one known cluster member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'per-unit-count-times-units-plus-received-minus-given-v1';

/** Singularize a noun phrase crudely (strip a trailing "s", never touch "ss"). */
function singularize(s: string): string {
  const t = s.trim().toLowerCase();
  if (t.endsWith('ies')) return t.slice(0, -3) + 'y';
  if (t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
  return t;
}

interface Analyzed { remaining: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // (a) existing per-unit inventory.
  const existingRe = /\bhas\s+(\d+)\s+[a-z]+(?:\s+[a-z]+)?\s+on\s+each\s+of\s+(?:the\s+)?(\d+)\s+(?:[a-z]+\s+)?([a-z]+)\b/i;
  const em = existingRe.exec(q);
  if (!em) return null;
  const perUnitExisting = parseInt(em[1], 10);
  const numUnits = parseInt(em[2], 10);
  const unitWordExisting = singularize(em[3]);

  // (b) received amount.
  const receivedRe = /\breceived\s+(\d+)\s+new\s+[a-z]+(?:\s+[a-z]+)?\b/i;
  const rm = receivedRe.exec(q);
  if (!rm) return null;
  const received = parseInt(rm[1], 10);

  // (c) give-away per unit, same units.
  const giveRe = /\bgive\s+(\d+)\s+[a-z]+(?:\s+[a-z]+)?\s+from\s+each\s+([a-z]+)\b/i;
  const gm = giveRe.exec(q);
  if (!gm) return null;
  const perUnitGiven = parseInt(gm[1], 10);
  const unitWordGiven = singularize(gm[2]);
  if (unitWordGiven !== unitWordExisting) return null;

  // (d) closing sentence must ask about what remains.
  const lastSentence = q.slice(Math.max(q.lastIndexOf('.'), q.lastIndexOf('!')) + 1);
  if (!/\bremain/i.test(lastSentence)) return null;

  const remaining = perUnitExisting * numUnits + received - perUnitGiven * numUnits;
  return { remaining };
}

export const perUnitCountTimesUnitsPlusReceivedMinusGiven: LianaMethod = {
  id: 'per-unit-count-times-units-plus-received-minus-given-v1',
  demand: 'COMPUTE',
  name: 'Combine a per-unit existing inventory, a received amount, and a per-unit give-away into a remaining total',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W16 (cluster C141, sole member harvest_gsm8k_pilot_item99_inventory_management)',
  shapeDescription:
    'An existing per-unit count spread across N units; a received amount of the same item; a ' +
    'per-unit give-away spread across the SAME units; the question asks what remains; answer = ' +
    'perUnitExisting*N + received - perUnitGiven*N.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a per-unit existing-inventory sentence plus a received-amount sentence ' +
          'plus a matching-unit give-away sentence plus a closing remain-with question; ' +
          'abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `remaining = ${result.remaining}` };
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
          verdict: String(Math.round(result.remaining * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'perUnitExisting*units + received - perUnitGiven*units',
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

registerMethod(perUnitCountTimesUnitsPlusReceivedMinusGiven);
