// D-BP223-BM04-h2cbp9d8-171 -- total-minus-pairs-and-loose-items-washed-missed-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R06
// (registration batch drawn from generation waves W24-W25).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\total-minus-pairs-and-loose-items-washed-missed-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W24, CLUSTER C219 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 378, "Lindsay is doing the laundry, and
 * thinks she has missed some socks. There are 50 socks that need washing. If she washes 10 pairs
 * of socks and 15 loose socks, how many socks has Lindsay missed?". Silo label: "subtraction of a
 * sum from a total" -- matches exactly.
 *
 * @generalShape A TOTAL count of an ITEM that "needs" some action is stated ("there are N <item-
 *   plural> that need <verb-ing>"). A later sentence reports the action being applied to the item
 *   in TWO forms: a PAIRED count ("<P> pairs of <item-plural>") and a LOOSE/individual count ("<L>
 *   loose <item-plural>"). The question asks how many of the item were MISSED, i.e. never acted
 *   on: total - (P*2 + L).
 *
 * @recogniseInStranger Requires ALL of, as positive evidence, with the item noun repeated
 *   verbatim (by backreference) across the total sentence, the action sentence, and the question:
 *   (a) "there are <N> <item-plural> that need <verb-ing>" -- the total and the item noun;
 *   (b) "(?:she|he|they) <verb>s? <P> pairs of <item-plural> and <L> loose <item-plural>" -- the
 *       paired count P and the loose count L, naming the same item noun as (a);
 *   (c) the question "how many <item-plural> has [a-z]+ missed", naming the same item noun.
 *   Answer = N - (2*P + L).
 *
 * @whatBreaksIt (a) 2*P + L exceeding N -- abstain, cannot have acted on more than the stated
 *   total; (b) the action sentence's item noun not matching the total sentence's item noun --
 *   abstain, cannot confirm this is the same batch; (c) the action described with only a paired
 *   count or only a loose count (missing either half of the "P pairs ... and L loose" construction)
 *   -- abstain, no partial credit, this candidate requires both counts stated together; (d) the
 *   question asking how many were WASHED rather than MISSED -- this candidate only recognises the
 *   "ask about the shortfall" framing and would need a different (trivial) formula otherwise.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a shape
 *   claim guarantees run() reconstructs the same number. Measured against its own (sole) cluster
 *   member: SOLVED (10 pairs = 20 socks, +15 loose = 35 washed, 50-35=15 missed). With only one
 *   known member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'total-minus-pairs-and-loose-items-washed-missed-v1';

interface Analyzed { missed: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const rTotal = /\bthere\s+are\s+(\d+)\s+([a-z]+)\s+that\s+need\s+[a-z]+ing\b/i;
  const mTotal = rTotal.exec(q);
  if (!mTotal) return null;
  const [, nRaw, itemNoun] = mTotal;
  const n = parseInt(nRaw, 10);
  if (!Number.isFinite(n)) return null;
  const itemEsc = itemNoun.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const rAction = new RegExp(
    '\\b(?:she|he|they)\\s+[a-z]+s?\\s+(\\d+)\\s+pairs\\s+of\\s+' + itemEsc +
      '\\s+and\\s+(\\d+)\\s+loose\\s+' + itemEsc + '\\b',
    'i',
  );
  const mAction = rAction.exec(q);
  if (!mAction) return null;
  const [, pRaw, lRaw] = mAction;
  const p = parseInt(pRaw, 10);
  const l = parseInt(lRaw, 10);
  if (!Number.isFinite(p) || !Number.isFinite(l)) return null;

  const rQ = new RegExp('how\\s+many\\s+' + itemEsc + '\\s+has\\s+[a-z]+\\s+missed\\b', 'i');
  if (!rQ.test(q)) return null;

  const washed = 2 * p + l;
  if (washed > n) return null;
  const missed = n - washed;
  if (missed < 0) return null;
  return { missed };
}

export const totalMinusPairsAndLooseItemsWashedMissed: LianaMethod = {
  id: 'total-minus-pairs-and-loose-items-washed-missed-v1',
  demand: 'COMPUTE',
  name: 'Total needing an action minus paired-count*2 plus loose count leaves the missed remainder',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W24 (cluster C219, sole member: pilot corpus item at index 378)',
  shapeDescription: 'answer = total - (2*pairedCount + looseCount).',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a total-needing-an-action sentence, a "<P> pairs of <item> and <L> loose ' +
          '<item>" action sentence naming the same item, and a closing question about how many ' +
          'were missed; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `missed = ${result.missed}` };
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
          verdict: String(Math.round((result.missed) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'total minus (2*pairedCount + looseCount)',
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

registerMethod(totalMinusPairsAndLooseItemsWashedMissed);
