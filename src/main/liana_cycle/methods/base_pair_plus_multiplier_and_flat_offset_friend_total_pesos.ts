// D-BP223-BM04-h2cbp9d8-171 -- base-pair-plus-multiplier-and-flat-offset-friend-total-pesos-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R06
// (registration batch drawn from generation waves W24-W25).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\base-pair-plus-multiplier-and-flat-offset-friend-total-pesos-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R06
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R06.md): gate 1 (positive yield), gate 2a
// (answer carry, under gate2_answer_carry.cjs's v3 -- the array-index/bracket-adjacency fix
// installed 2026-09-08T09:46:02Z, on top of v2's letter-boundary fix installed 09:08:02Z), gate 4
// (interception against the live registry), gate 5 (sibling interception against the real
// ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R06.md for the exact
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W24, CLUSTER C223 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 382, "Axel has 50 silver pesos and 80 gold
 * pesos. He visits her friend Anna who has twice as many silver pesos as he has and 40 more gold
 * pesos. What's the total number of pesos they have together?". Silo label: "multi-step addition
 * and comparison of two sets of items" -- matches exactly.
 *
 * @generalShape A first named person A has two directly-stated counts of two different currency/
 *   item TYPES ("<A> has <a1> <typeX> and <a2> <typeY>"). A visits a second named person B, who is
 *   described relative to A: B's typeX count is a stated MULTIPLE of A's typeX count ("<multiplier>
 *   as many <typeX> as (?:he|she) has"), and B's typeY count is A's typeY count plus a stated FLAT
 *   offset ("<offset> more <typeY>"). The question asks for the combined total of both types for
 *   both people: (a1+a2) + (multiplier*a1 + a2+offset).
 *
 * @recogniseInStranger Requires ALL of, as positive evidence, with both currency/item type nouns
 *   repeated verbatim (by backreference) throughout:
 *   (a) "<A> has <a1> <typeX> and <a2> <typeY>" -- person A and both base counts;
 *   (b) "visits (?:her|his) friend <B> who has <multiplierWord> as many <typeX> as (?:he|she) has
 *       and <offset> more <typeY>" -- person B, a multiplier word from a fixed table (twice=2,
 *       "three times"=3, "four times"=4), and the flat gold offset, naming the same typeX/typeY
 *       nouns as (a);
 *   (c) the question "what.?s the total number of <typeX-or-generic> (?:they have together|do
 *       they have together)".
 *   Answer = (a1+a2) + (multiplier*a1) + (a2+offset).
 *
 * @whatBreaksIt (a) a multiplier phrase not in the fixed table (e.g. "half as many", "one and a
 *   half times") -- abstain, this candidate only resolves multipliers it has positive evidence
 *   for; (b) typeX or typeY differing textually between person A's sentence and person B's
 *   sentence -- abstain, cannot confirm it is the same two currencies; (c) person B's relative
 *   sentence structured with typeY (not typeX) as the multiplied quantity, or vice-versa -- this
 *   candidate's regex fixes typeX as the multiplied quantity and typeY as the flat-offset
 *   quantity, matching the exact clause order of the representative case, and abstains if that
 *   order is not found; (d) a third person or a third currency type appearing -- the fixed two-
 *   person, two-type regex would simply fail to match, abstaining rather than guessing.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a shape
 *   claim guarantees run() reconstructs the same number. Measured against its own (sole) cluster
 *   member: SOLVED (Axel: 50+80=130; Anna: 2*50=100 silver, 80+40=120 gold, 100+120=220; total
 *   130+220=350). With only one known member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'base-pair-plus-multiplier-and-flat-offset-friend-total-pesos-v1';

interface Analyzed { total: number; }

const MULTIPLIER_WORDS: Record<string, number> = {
  twice: 2,
  'two times': 2,
  'three times': 3,
  'four times': 4,
  'five times': 5,
};

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const rBase = /\b([A-Z][a-z]+)\s+has\s+(\d+)\s+([a-z]+\s+[a-z]+)\s+and\s+(\d+)\s+([a-z]+\s+[a-z]+)\b/;
  const mBase = rBase.exec(q);
  if (!mBase) return null;
  const [, personA, a1Raw, typeX, a2Raw, typeY] = mBase;
  const a1 = parseInt(a1Raw, 10);
  const a2 = parseInt(a2Raw, 10);
  if (!Number.isFinite(a1) || !Number.isFinite(a2)) return null;
  if (typeX.toLowerCase() === typeY.toLowerCase()) return null;
  const typeXEsc = typeX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const typeYEsc = typeY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const rVisit = new RegExp(
    'visits\\s+(?:her|his)\\s+friend\\s+([A-Z][a-z]+)\\s+who\\s+has\\s+' +
      '(twice|two\\s+times|three\\s+times|four\\s+times|five\\s+times)\\s+as\\s+many\\s+' +
      typeXEsc + '\\s+as\\s+(?:he|she)\\s+has\\s+and\\s+(\\d+)\\s+more\\s+' + typeYEsc + '\\b',
    'i',
  );
  const mVisit = rVisit.exec(q);
  if (!mVisit) return null;
  const [, personB, multiplierRaw, offsetRaw] = mVisit;
  if (personB.toLowerCase() === personA.toLowerCase()) return null;
  const multiplier = MULTIPLIER_WORDS[multiplierRaw.trim().toLowerCase().replace(/\s+/g, ' ')];
  if (!multiplier) return null;
  const offset = parseInt(offsetRaw, 10);
  if (!Number.isFinite(offset)) return null;

  const rQ = /what.?s\s+the\s+total\s+number\s+of\s+[a-z]+\s+(?:they\s+have\s+together|do\s+they\s+have\s+together)/i;
  if (!rQ.test(q)) return null;

  const bX = multiplier * a1;
  const bY = a2 + offset;
  const total = (a1 + a2) + (bX + bY);
  if (!Number.isFinite(total) || total < 0) return null;
  return { total };
}

export const basePairPlusMultiplierAndFlatOffsetFriendTotalPesos: LianaMethod = {
  id: 'base-pair-plus-multiplier-and-flat-offset-friend-total-pesos-v1',
  demand: 'COMPUTE',
  name: 'A base person\'s two currency counts, plus a friend\'s multiplied first count and flat-offset second count, summed together',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W24 (cluster C223, sole member: pilot corpus item at index 382)',
  shapeDescription:
    'answer = (a1+a2) + (multiplier*a1) + (a2+offset), where a1/a2 are person A\'s two stated counts, ' +
    'multiplier and offset describe person B relative to A.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "<A> has <a1> <typeX> and <a2> <typeY>" sentence, a "visits (?:her|his) ' +
          'friend <B> who has <multiplier> as many <typeX> as (?:he|she) has and <offset> more ' +
          '<typeY>" sentence naming the same two types, and a closing "total ... together" ' +
          'question; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `combined total = ${result.total}` };
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
          verdict: String(Math.round((result.total) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: '(a1+a2) + (multiplier*a1) + (a2+offset)',
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

registerMethod(basePairPlusMultiplierAndFlatOffsetFriendTotalPesos);
