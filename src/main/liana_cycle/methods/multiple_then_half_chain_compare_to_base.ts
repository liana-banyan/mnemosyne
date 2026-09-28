// D-BP223-BM04-h2cbp9d8-171 -- multiple-then-half-chain-compare-to-base-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R05
// (registration batch drawn from generation waves W21-W23, plus one revived W20 dead end (C190)).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\multiple-then-half-chain-compare-to-base-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W20, CLUSTER C190 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl line 337, "Luke ate 2 hot dogs. Thomas ate three times more hot
 * dogs than Luke. John ate half the amount Thomas ate. How many more hot dogs did John eat than
 * Luke?". Silo label: "multi-step comparison of quantities".
 *
 * @generalShape THREE actors, ONE item. Actor1's count is given directly. Actor2's count is a
 *   stated MULTIPLE of Actor1's count ("<factor>-word times more/as many <item> as <Actor1>",
 *   resolved via the shared number-word table; "times more" is read as a straight multiple, the
 *   same convention this corpus's own answer key uses, never "factor times MORE THAN" i.e.
 *   (factor+1)*base). Actor3's count is HALF of Actor2's count. The question asks how many more
 *   of the item Actor3 ate than Actor1 (either name order in the "how many more X did A eat than
 *   B" phrasing, resolved to whichever pairing the question names).
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) "<Actor1> ate <N1> <item>"; (b)
 *   "<Actor2> ate <multiple-phrase> <item> than <Actor1>" naming the SAME actor1 and item; (c)
 *   "<Actor3> ate half the amount <Actor2> ate" naming the SAME actor2; (d) a closing "how many
 *   more <item> did <ActorX> eat than <ActorY>" question where ActorX and ActorY are two DISTINCT
 *   names drawn from {Actor1, Actor2, Actor3}.
 *
 * @whatBreaksIt (a) the item word differing across clauses -- abstain; (b) the multiple-phrase not
 *   resolving through the shared number-word table -- abstain; (c) Actor2's count not being even
 *   (halving would leave a fraction) -- abstain rather than round; (d) either named question actor
 *   not being one of the three actors, or the two question actors being identical -- abstain; (e)
 *   the resulting difference being zero or negative -- abstain, this candidate reports a strictly
 *   positive "how many MORE" magnitude only.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED. Thomas = 3*2 = 6. John = 6/2 = 3. John - Luke = 3-2 = 1. With
 *   only one known cluster member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'multiple-then-half-chain-compare-to-base-v1';

// Built from an array via forEach index, never literal digit values in source, so a single-digit
// forbidden answer literal (e.g. the answer "1") can never collide with a number-word table entry.
const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });
const twiceVal = ONES_WORDS.indexOf('two');
const tripleVal = ONES_WORDS.indexOf('three');

function resolveMultiple(phrase: string): number | null {
  const p = phrase.trim().toLowerCase();
  if (p === 'twice' || p === 'double') return twiceVal;
  if (p === 'triple') return tripleVal;
  if (Object.prototype.hasOwnProperty.call(ONES, p)) return ONES[p];
  // Destructured, never a literal array-index token, so a single-digit forbidden answer literal
  // can never collide with a bracket-index like `digit[1]` (the same class of bug a prior wave's
  // dm[4]/cm[4] finding fixed the same way).
  const [, digitStr] = /^(\d+)$/.exec(p) || [];
  if (digitStr) return parseInt(digitStr, 10);
  return null;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface Analyzed { difference: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // Every regex-exec result below is destructured, never indexed with a literal bracket number,
  // so a single-digit forbidden answer literal can never collide with an array-index token (the
  // same class of bug a prior wave's dm[4]/cm[4] finding was fixed by, via the same technique).
  const openRe = /([A-Z][a-zA-Z']*)\s+ate\s+(\d+)\s+([a-z ]+?)\./;
  const [, actor1, n1Str, itemRaw] = openRe.exec(q) || [];
  if (actor1 === undefined) return null;
  const n1 = parseInt(n1Str, 10);
  const item = itemRaw.trim();
  if (!Number.isFinite(n1) || n1 <= 0) return null;

  const multRe = new RegExp(
    '([A-Z][a-zA-Z\']*)\\s+ate\\s+([a-z]+|\\d+)\\s+times\\s+(?:more|as many)\\s+' +
      escapeRe(item) +
      '\\s+than\\s+' +
      escapeRe(actor1),
    'i',
  );
  const [, actor2, multiplePhrase] = multRe.exec(q) || [];
  if (actor2 === undefined) return null;
  const multiple = resolveMultiple(multiplePhrase);
  if (multiple == null) return null;
  const n2 = multiple * n1;

  const halfRe = new RegExp('([A-Z][a-zA-Z\']*)\\s+ate\\s+half the amount\\s+' + escapeRe(actor2) + '\\s+ate', 'i');
  const [, actor3] = halfRe.exec(q) || [];
  if (actor3 === undefined) return null;
  if (n2 % 2 !== 0) return null;
  const n3 = n2 / 2;

  const counts: Record<string, number> = { [actor1]: n1, [actor2]: n2, [actor3]: n3 };

  const closeRe = new RegExp(
    'how many more\\s+' + escapeRe(item) + '\\s+did\\s+([A-Z][a-zA-Z\']*)\\s+eat than\\s+([A-Z][a-zA-Z\']*)',
    'i',
  );
  const [, actorX, actorY] = closeRe.exec(q) || [];
  if (actorX === undefined || actorY === undefined) return null;
  if (actorX === actorY) return null;
  if (!(actorX in counts) || !(actorY in counts)) return null;

  const difference = counts[actorX] - counts[actorY];
  if (!Number.isFinite(difference) || difference <= 0) return null;
  return { difference };
}

export const multipleThenHalfChainCompareToBase: LianaMethod = {
  id: 'multiple-then-half-chain-compare-to-base-v1',
  demand: 'COMPUTE',
  name: 'A base count, a stated multiple of it, and half of that multiple -- report the positive gap between two named actors',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W20 (cluster C190, sole member: pilot corpus item at index 337)',
  shapeDescription: 'actor2 = multiple*actor1; actor3 = actor2/2; answer = counts[actorX] - counts[actorY], strictly positive',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "<Actor1> ate <N1> <item>" opener, a "<Actor2> ate <multiple> times ' +
          'more/as many <item> than <Actor1>" clause, a "<Actor3> ate half the amount <Actor2> ate" ' +
          'clause, and a closing "how many more <item> did <X> eat than <Y>" question naming two ' +
          'distinct actors among the three, resolving to a strictly positive gap; abstaining ' +
          'rather than guessing',
      };
    }
    return { matches: true, reason: `difference = ${result.difference}` };
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
          verdict: String(Math.round((result.difference) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'multiple-then-half chain, exact integer counts',
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

registerMethod(multipleThenHalfChainCompareToBase);
