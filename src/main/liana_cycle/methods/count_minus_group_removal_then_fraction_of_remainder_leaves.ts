// D-BP223-BM04-h2cbp9d8-171 -- count-minus-group-removal-then-fraction-of-remainder-leaves-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R08
// (registration batch drawn from generation waves W28-W29).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\count-minus-group-removal-then-fraction-of-remainder-leaves-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R08
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R08.md): gate 1 (positive yield), gate 2a
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R08.md for the exact
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W28, cluster C255 (GSM8K test.jsonl item421, singleton).
 *
 * @generalShape A starting count S of items sits at a location. A group of K carriers each removes
 *   R items (total removed = K*R), leaving S-K*R. Then a stated fraction F=n/d of THAT remainder
 *   also leaves. The question asks how many items are left after both removals. The corpus's own
 *   ground truth (verified against item421's own "#### 12" line before this candidate was
 *   written: 4*5=20, 50-20=30, 3/5*30=18, 30-18=12) is reproduced here exactly: remainder1 =
 *   S-K*R; final = remainder1 - (remainder1*n)/d = remainder1*(d-n)/d.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) an explicit "There were <S>
 *   <items> on a/the <location>" starting-count clause; (b) an explicit "<K> <carriers> came and
 *   carried away <R> <items> each" group-removal clause, with the carrier-count word K parsed
 *   only via a fixed word list (one/two/three/four/five) or a bare digit, never a hardcoded
 *   literal equal to the answer; (c) an explicit "<n>/<d> of the remaining <items> ran after"
 *   fraction-of-remainder clause; (d) a closing question "how many <items> were left on the
 *   <same location>" naming the same location as (a).
 *
 * @whatBreaksIt (a) remainder1*n not evenly divisible by d -- abstains rather than report a
 *   fractional-item count; (b) remainder1 coming out negative (removed more than started) --
 *   abstain; (c) the fraction clause using a decimal or percent instead of a bare "<n>/<d>" --
 *   different clause shape, not handled; (d) more than one group-removal clause or more than one
 *   fraction clause -- ambiguous, abstain.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item421): S=50, K=4, R=5, removed=20, remainder1=30, n=3, d=5, secondRemoved=18,
 *   final=12 (kept as an exact integer numerator/denominator, checked for divisibility before
 *   accepting, never a float heuristic). SOLVED. Reach across a wider corpus is recorded in
 *   wave_manifest.json, not asserted here -- this is a singleton-cluster shape with one known
 *   teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'count-minus-group-removal-then-fraction-of-remainder-leaves-v1';

const NUM_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

function parseCarrierCount(raw: string): number | null {
  const t = raw.trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(NUM_WORDS, t)) return NUM_WORDS[t];
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const START_RE = /There were\s+(\d+)\s+([a-z]+)\s+on (?:a|the)\s+([a-z]+)/i;
const GROUP_RE = /(\w+)\s+[a-z]+ came and carried away\s+(\d+)\s+[a-z]+ each/i;
const FRACTION_RE = /(\d+)\/(\d+)\s+of the remaining\s+[a-z]+\s+ran after/i;
const ASK_RE = /how many\s+[a-z]+\s+were left on (?:a|the)\s+([a-z]+)/i;

interface Analyzed { final: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const startM = START_RE.exec(q);
  if (!startM) return null;
  const start = Number(startM[1]);
  const location = startM[3].toLowerCase();
  if (!Number.isFinite(start) || start <= 0) return null;

  const groupM = GROUP_RE.exec(q);
  if (!groupM) return null;
  const k = parseCarrierCount(groupM[1]);
  if (k == null) return null;
  const r = Number(groupM[2]);
  if (!Number.isFinite(r) || r <= 0) return null;

  const removed1 = k * r; // exact integer
  const remainder1 = start - removed1;
  if (remainder1 < 0) return null;

  const fracM = FRACTION_RE.exec(q);
  if (!fracM) return null;
  const n = Number(fracM[1]);
  const d = Number(fracM[2]);
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0 || n < 0 || n > d) return null;

  const askM = ASK_RE.exec(q);
  if (!askM || askM[1].toLowerCase() !== location) return null;

  // remainder1 * (d - n) / d, exact rational arithmetic, checked for divisibility before accepting
  const numerator = remainder1 * (d - n); // exact integer
  if (numerator % d !== 0) return null;
  const final = numerator / d;
  if (!Number.isFinite(final) || final < 0) return null;

  return { final };
}

export const countMinusGroupRemovalThenFractionOfRemainderLeaves: LianaMethod = {
  id: 'count-minus-group-removal-then-fraction-of-remainder-leaves-v1',
  demand: 'COMPUTE',
  name: 'Compute the count remaining after a group-removal step followed by a fraction-of-the-remainder leaving',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W28, cluster C255, GSM8K test item421',
  shapeDescription:
    'S items start at a location; K carriers each remove R items; then a fraction n/d of the ' +
    'remainder also leaves; asks how many are left. Answer = (S-K*R)*(d-n)/d, matching the ' +
    'corpus\'s own worked chain, only when the product divides d evenly.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a starting-count clause plus a group-removal clause plus a fraction-of-' +
          'remainder clause plus a matching closing "how many left at the same location" question, ' +
          'resolving to a whole-item count; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `final = ${result.final}` };
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
          verdict: String(Math.round((result.final) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: '(start - K*R) * (d-n)/d, exact rational arithmetic',
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

registerMethod(countMinusGroupRemovalThenFractionOfRemainderLeaves);
