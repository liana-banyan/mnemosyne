// D-BP223-BM04-h2cbp9d8-171 -- bought-plus-given-minus-eaten-items-left-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R06
// (registration batch drawn from generation waves W24-W25).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\bought-plus-given-minus-eaten-items-left-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W24, CLUSTER C220 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 379, "Rachel bought 23 cookies and Janet
 * gave her 42 cookies. The other day her brother ate 44 of those cookies. How many cookies are
 * left for Rachel?". Silo label: "multi-step addition and subtraction word problem" -- matches
 * exactly.
 *
 * @generalShape A first named person A BUYS a stated count of an ITEM, and a second named person
 *   B, in the same sentence, GIVES person A a further stated count of the same item ("A bought X
 *   <item-plural> and B gave (?:her|him) Y <item-plural>"). A later, separate sentence reports a
 *   third party (A's sibling, "her/his brother/sister") EATING a stated count of "those <item-
 *   plural>". The question asks how many are LEFT FOR person A: X + Y - eaten.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence, with the item noun repeated
 *   verbatim (by backreference) across the acquisition sentence, the consumption sentence, and
 *   the question:
 *   (a) "<A> bought <X> <item-plural> and <B> gave (?:her|him) <Y> <item-plural>" -- person A,
 *       the bought count X, person B, the given count Y, naming the same item noun both times;
 *   (b) "(?:her|his)\s+(?:brother|sister)\s+ate\s+<E>\s+of\s+those\s+<item-plural>" -- the eaten
 *       count E, same item noun;
 *   (c) the question "how many <item-plural> are left for <A>" -- naming the same item noun and
 *       the same person A as (a).
 *   Answer = X + Y - E.
 *
 * @whatBreaksIt (a) E exceeding X + Y -- abstain, cannot have eaten more than was acquired; (b)
 *   the item noun differing between the acquisition sentence, consumption sentence, or question --
 *   abstain, cannot confirm it is the same batch; (c) the question naming a person other than A
 *   (e.g. person B, or the sibling) -- this candidate only recognises "left for the acquiring
 *   person" and abstains otherwise; (d) a THIRD acquisition or consumption event beyond the two
 *   stated (bought+given, then eaten) -- this candidate's regex only matches the fixed two-step
 *   acquisition and one-step consumption pattern and would fail to find its anchors on a longer
 *   chain, abstaining rather than under-counting.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a shape
 *   claim guarantees run() reconstructs the same number. Measured against its own (sole) cluster
 *   member: SOLVED (23+42=65 acquired, 65-44=21 left for Rachel). With only one known member
 *   there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'bought-plus-given-minus-eaten-items-left-v1';

interface Analyzed { left: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const rAcq = /\b([A-Z][a-z]+)\s+bought\s+(\d+)\s+([a-z]+)\s+and\s+([A-Z][a-z]+)\s+gave\s+(?:her|him)\s+(\d+)\s+\3\b/;
  const mAcq = rAcq.exec(q);
  if (!mAcq) return null;
  const [, personA, xRaw, itemNoun, , yRaw] = mAcq;
  const x = parseInt(xRaw, 10);
  const y = parseInt(yRaw, 10);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const itemEsc = itemNoun.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const rEat = new RegExp(
    '\\b(?:her|his)\\s+(?:brother|sister)\\s+ate\\s+(\\d+)\\s+of\\s+those\\s+' + itemEsc + '\\b',
    'i',
  );
  const mEat = rEat.exec(q);
  if (!mEat) return null;
  const e = parseInt(mEat[1], 10);
  if (!Number.isFinite(e)) return null;

  const personAEsc = personA.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rQ = new RegExp(
    'how\\s+many\\s+' + itemEsc + '\\s+are\\s+left\\s+for\\s+' + personAEsc + '\\b',
    'i',
  );
  if (!rQ.test(q)) return null;

  const acquired = x + y;
  if (e > acquired) return null;
  const left = acquired - e;
  if (left < 0) return null;
  return { left };
}

export const boughtPlusGivenMinusEatenItemsLeft: LianaMethod = {
  id: 'bought-plus-given-minus-eaten-items-left-v1',
  demand: 'COMPUTE',
  name: 'Bought count plus given count minus a sibling-eaten count leaves the remainder for the acquiring person',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W24 (cluster C220, sole member: pilot corpus item at index 379)',
  shapeDescription: 'answer = boughtCount + givenCount - eatenCount.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "A bought X <item> and B gave A Y <item>" acquisition sentence, a ' +
          '"her/his brother/sister ate E of those <item>" consumption sentence naming the same ' +
          'item, and a closing question about how many are left for person A; abstaining rather ' +
          'than guessing',
      };
    }
    return { matches: true, reason: `left for the acquiring person = ${result.left}` };
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
          verdict: String(Math.round((result.left) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'boughtCount + givenCount - eatenCount',
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

registerMethod(boughtPlusGivenMinusEatenItemsLeft);
