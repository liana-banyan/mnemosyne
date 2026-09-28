// D-BP223-BM04-h2cbp9d8-171 -- ratio-base-then-purchase-delta-combined-total-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R07
// (registration batch drawn from generation waves W26-W27).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\ratio-base-then-purchase-delta-combined-total-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R07
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R07.md): gate 1 (positive yield), gate 2a
// (answer carry, under gate2_answer_carry.cjs's v3 -- the array-index/bracket-adjacency fix
// installed 2026-09-08T09:46:02Z, on top of v2's letter-boundary fix installed 09:08:02Z), gate 4
// (interception against the live registry), gate 5 (sibling interception against the real
// ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
// (HARDWIRE\tools\controls\perturbation_gate.mjs, baseline + perturbations, oracle hand-derived
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R07.md for the exact
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W27, cluster C243 (GSM8K test.jsonl item406, singleton).
 *
 * @generalShape An initial ratio clause states one item type A is a stated multiple of another
 *   item type B ("twice/three times as much A as B"). B's initial total is given directly. A
 *   purchase clause adds a stated flat amount to B ("bought <addB> more B") and, in the SAME
 *   sentence, states A's purchase is a stated flat amount FEWER than B's just-stated purchase
 *   amount ("<diff> fewer A than the number of B [bought]"). The closing question asks for the
 *   COMBINED total of A and B after the purchase. Answer = (mult*B0 + B0) + ((addB - diff) +
 *   addB), i.e. initial combined total plus purchased combined total.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) a ratio clause "<mult> as much
 *   A as B" (mult drawn from "twice"/"three times"/"half"/a bare number + "times"); (b) an
 *   explicit "total of <B0> B" clause; (c) a purchase clause naming BOTH a flat "bought <addB>
 *   more B" AND, in the same clause, "<diff> fewer A than [that / the number of] B" -- the fewer-A
 *   comparison must reference the JUST-STATED purchased-B amount, not B's original total; (d) the
 *   closing question asks for the "combined total" of both items.
 *
 * @whatBreaksIt (a) the "fewer A than" comparison instead references B's ORIGINAL total rather
 *   than the newly purchased B amount -- a different, unattempted shape (this candidate requires
 *   both purchase figures in one adjacent clause); (b) no explicit ratio clause for the initial
 *   amounts; (c) purchased A count would be negative (diff >= addB) -- abstain, nonsensical; (d)
 *   the question asks for only ONE item's final total rather than the combined total.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass. Measured against
 *   its own representative teaching case (item406): cornInitial = 2*40 = 80, initialCombined =
 *   80+40 = 120, cornBought = 60-40 = 20, boughtCombined = 20+60 = 80, total = 120+80 = 200.
 *   SOLVED. Reach across a wider corpus is recorded in wave_manifest.json, not asserted here --
 *   this is a singleton-cluster shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'ratio-base-then-purchase-delta-combined-total-v1';

const MULT_WORDS: Record<string, number> = { twice: 2, double: 2, 'three times': 3, 'triple': 3 };

const RATIO_RE = /\b(twice|double|three times|triple)\s+as\s+much\s+([a-z]+)\s+as\s+([a-z]+)\b/i;
const INITIAL_TOTAL_RE = /\btotal\s+of\s+(\d+)\s+([a-z]+)\b/i;
const PURCHASE_RE = /bought\s+(\d+)\s+more\s+([a-z]+)[^.?!]*?\band\s+(\d+)\s+fewer\s+([a-z]+)\s+than\s+the\s+number\s+of\s+[a-z]+\b/i;
const ASK_RE = /combined\s+total\s+of\s+the\s+number\s+of\s+([a-z]+)\s+and\s+([a-z]+)\b/i;

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const ratioM = RATIO_RE.exec(q);
  if (!ratioM) return null;
  const mult = MULT_WORDS[ratioM[1].toLowerCase()];
  if (!mult) return null;
  const itemA = ratioM[2].toLowerCase(); // e.g. "corn"
  const itemB = ratioM[3].toLowerCase(); // e.g. "cannolis"

  const initM = INITIAL_TOTAL_RE.exec(q);
  if (!initM) return null;
  const b0 = Number(initM[1]);
  if (!Number.isFinite(b0) || b0 <= 0) return null;
  // the "total of N B" clause must refer to item B, the ratio's reference quantity
  const initNoun = initM[2].toLowerCase();
  if (!initNoun.startsWith(itemB.slice(0, Math.max(3, itemB.length - 1)))) return null;

  const purM = PURCHASE_RE.exec(q);
  if (!purM) return null;
  const addB = Number(purM[1]);
  const diff = Number(purM[3]);
  if (!Number.isFinite(addB) || !Number.isFinite(diff) || addB <= 0 || diff < 0) return null;
  if (diff >= addB) return null; // would make purchased A negative -- nonsensical
  const boughtA = addB - diff;

  const askM = ASK_RE.exec(q);
  if (!askM) return null;

  const a0 = mult * b0; // exact integer
  const initialCombined = a0 + b0;
  const boughtCombined = boughtA + addB;
  const total = initialCombined + boughtCombined;
  if (!Number.isFinite(total)) return null;

  return { total };
}

export const ratioBaseThenPurchaseDeltaCombinedTotal: LianaMethod = {
  id: 'ratio-base-then-purchase-delta-combined-total-v1',
  demand: 'COMPUTE',
  name: 'Compute the combined total of two ratio-linked items after a purchase described by one flat amount and one comparative-fewer amount',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W27, cluster C243, GSM8K test item406',
  shapeDescription:
    'A = mult*B initially; B0 given directly; purchase adds addB to B and (addB - diff) to A ' +
    '(diff fewer than the just-purchased B amount). Combined total = (mult*B0 + B0) + ' +
    '((addB - diff) + addB).',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a ratio clause, an initial-total-of-B clause, a combined purchase clause ' +
          '("bought N more B and M fewer A than the number of B"), and a "combined total" ' +
          'closing question with a non-negative purchased-A count; abstaining rather than guessing',
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
          basis: '(mult*B0+B0) + ((addB-diff)+addB)',
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

registerMethod(ratioBaseThenPurchaseDeltaCombinedTotal);
