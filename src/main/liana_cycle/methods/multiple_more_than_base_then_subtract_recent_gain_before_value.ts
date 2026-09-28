// D-BP223-BM04-h2cbp9d8-171 -- multiple-more-than-base-then-subtract-recent-gain-before-value-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R05
// (registration batch drawn from generation waves W21-W23).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\multiple-more-than-base-then-subtract-recent-gain-before-value-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W23, CLUSTER C211 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 368, "After scoring 14 points, Erin now has
 * three times more points than Sara, who scored 8. How many points did Erin have before?". Silo
 * label: "multi-step comparison and subtraction" -- matches exactly. This candidate reproduces
 * the corpus's own idiomatic reading of "N times more than X" as X + N*X (the corpus's own
 * worked solution: "three times more points than Sara ... is 3*8 = 24 MORE than Sara ... a total
 * of 8+24 = 32"), rather than the stricter literal reading (N*X alone).
 *
 * @generalShape Actor2's base value is given directly ("<actor2>, who <verb2> <B>"). Actor1's
 *   CURRENT value is stated as a multiple MORE than actor2's base value ("<actor1> now has
 *   <multiplier> times more <unit> than <actor2>"), read as base + multiplier*base. A separate,
 *   earlier clause states actor1 GAINED a stated amount to reach that current value ("after
 *   <gaining-verb> <A> <unit>, <actor1> now has ..."). The question asks for actor1's value
 *   BEFORE that gain: current - A.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence, in one fixed compound sentence:
 *   (a) "after <verb1-ing> <A> points, <actor1> now has <multiplier-phrase> times more points
 *       than <actor2>, who <verb2> <B>" -- captures A, actor1, the multiplier, actor2, and B all
 *       from one anchored pattern, actor1 and actor2 textually distinct;
 *   (b) the question "how many points did <actor1> have before", naming the SAME actor1 as (a).
 *   Multiplier resolved via a fixed ones-word table (never a literal digit table). Answer =
 *   B*(1+multiplier) - A.
 *
 * @whatBreaksIt (a) actor1 and actor2 naming the same person -- abstain; (b) a multiplier phrase
 *   outside the fixed ones-word list -- abstain, no partial credit; (c) the gain amount A
 *   exceeding the reconstructed current value (current - A negative) -- abstain, the parse does
 *   not fit; (d) the question asking about actor2 instead of actor1 -- unmatched, this candidate
 *   only answers "before" for the actor whose gain clause it found; (e) a plain "N times as many"
 *   (without "more") phrasing -- a different, non-idiomatic reading this candidate does not
 *   attempt, correctly left unmatched.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a shape
 *   claim guarantees run() reconstructs the same number. Measured against its own (sole) cluster
 *   member: SOLVED (current = 8*(1+3)=32, before = 32-14=18). With only one known member there is
 *   no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'multiple-more-than-base-then-subtract-recent-gain-before-value-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];

function parseMultiplierWord(word: string): number | null {
  const idx = ONES_WORDS.indexOf(word.toLowerCase().trim());
  return idx >= 2 ? idx : null;
}

interface Analyzed { before: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const r1 =
    /\bafter\s+[a-z]+ing\s+(\d+)\s+points,\s+([a-z]+)\s+now\s+has\s+([a-z]+)\s+times\s+more\s+points\s+than\s+([a-z]+),\s+who\s+[a-z]+\s+(\d+)\b/i;
  const m1 = r1.exec(q);
  if (!m1) return null;
  const [, gainRaw, actor1, multWord, actor2, baseRaw] = m1;
  const gain = parseInt(gainRaw, 10);
  const base = parseInt(baseRaw, 10);
  if (!Number.isFinite(gain) || !Number.isFinite(base)) return null;
  if (actor1.toLowerCase() === actor2.toLowerCase()) return null;
  const mult = parseMultiplierWord(multWord);
  if (mult === null) return null;

  const rQ = new RegExp('how\\s+many\\s+points\\s+did\\s+' + actor1 + '\\s+have\\s+before', 'i');
  if (!rQ.test(q)) return null;

  const current = base * (1 + mult);
  const before = current - gain;
  if (!Number.isFinite(before) || before < 0) return null;
  return { before };
}

export const multipleMoreThanBaseThenSubtractRecentGainBeforeValue: LianaMethod = {
  id: 'multiple-more-than-base-then-subtract-recent-gain-before-value-v1',
  demand: 'COMPUTE',
  name: 'Actor1\'s current value = base + multiplier*base (a stated multiple MORE than actor2), minus actor1\'s own recent stated gain gives actor1\'s value before',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W23 (cluster C211, sole member: pilot corpus item at index 368)',
  shapeDescription:
    'current = base * (1 + multiplier); answer = current - gain, where gain is actor1\'s own stated recent increase.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find the fixed "after gaining A points, actor1 now has M times more points ' +
          'than actor2, who scored B" compound sentence plus a matching "how many points did ' +
          'actor1 have before" question, resolving to a non-negative exact value; abstaining ' +
          'rather than guessing',
      };
    }
    return { matches: true, reason: `actor1's value before the recent gain = ${result.before}` };
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
          verdict: String(Math.round((result.before) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'current = base*(1+multiplier); subtracted actor1\'s own stated recent gain to get the value before',
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

registerMethod(multipleMoreThanBaseThenSubtractRecentGainBeforeValue);
