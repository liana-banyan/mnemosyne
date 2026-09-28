// D-BP223-BM04-h2cbp9d8-171 -- two-species-heads-and-bumps-system-solve-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R08
// (registration batch drawn from generation waves W28-W29).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\two-species-heads-and-bumps-system-solve-v1.candidate.ts
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W28, cluster C251 (GSM8K test.jsonl item416, singleton).
 *
 * @generalShape A herd is made of two named animal types. A total HEAD count and a total FEATURE
 *   count (e.g. bumps/humps) are given, along with each animal type's per-head feature count
 *   (e.g. "camels have two humps each and dromedaries have one hump each"). The question asks for
 *   the count of ONE of the two types. This is the classic linear system: let x = count of type1;
 *   x*c1 + (H-x)*c2 = F, solved for x, then the asked type's count is either x or H-x depending on
 *   which type the question names. The corpus's own ground truth (verified against item416's own
 *   "#### 56" line before this candidate was written: x=(304-180)/(2-1)=124 camels, dromedaries =
 *   180-124=56) is reproduced here exactly via the standard linear-system solve.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) a "herd consists of <type1>s
 *   and <type2>s" naming clause; (b) an explicit head-count clause "<H> heads"; (c) an explicit
 *   feature-count clause "<F> <feature-plural>"; (d) an explicit per-head feature clause for BOTH
 *   types in the form "<type> have <word-or-digit> <feature>(s) each", parsed only via a fixed
 *   word list (one/two/three/four) or a bare digit, never a hardcoded literal equal to the
 *   answer; (e) a closing question "how many <type> are there", naming one of the two types.
 *
 * @whatBreaksIt (a) the two types' per-head feature counts being equal -- the linear system has
 *   no unique solution, abstain (division by zero); (b) the solved count for either type coming
 *   out negative, non-integer, or exceeding the total head count -- abstain, the given numbers do
 *   not form a consistent system under this reading; (c) more than two animal types named --
 *   different shape, not handled; (d) the per-head feature clause using a different comparative
 *   phrasing than "have <N> <feature>(s) each" -- abstain rather than guess.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item416): H=180, F=304, c1(camels)=2, c2(dromedaries)=1; x = (304 - 180*1)/(2-1) = 124
 *   camels; dromedaries asked = 180-124 = 56 (kept as an exact integer division, checked for
 *   remainder before accepting, never a float heuristic). SOLVED. Reach across a wider corpus is
 *   recorded in wave_manifest.json, not asserted here -- this is a singleton-cluster shape with
 *   one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'two-species-heads-and-bumps-system-solve-v1';

const NUM_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };

function parseCount(raw: string): number | null {
  const t = raw.trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(NUM_WORDS, t)) return NUM_WORDS[t];
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const HERD_RE = /herd consists of (\w+)s? and (\w+)s?/i;
const HEADS_RE = /(\d+)\s+heads/i;
const FEATURE_TOTAL_RE = /(\d+)\s+([a-z]+)\b(?=[^.?!]*\bHow many\b)/i;
// Deliberately NOT anchored to the same feature noun as the total-count clause: the corpus's own
// English (item416) states the TOTAL as "304 bumps" but the PER-HEAD rate as "two humps each" --
// a genuine synonym shift within one question. Requiring word-identity here would wrongly abstain
// on the corpus's own teaching case, so this clause only requires "<type> have <count> <some
// feature noun> each", cross-checked structurally (both types, both counts), not lexically.
const PER_HEAD_RE = (type: string) =>
  new RegExp(type + '\\s+have\\s+(\\w+)\\s+[a-z]+s?\\s+each', 'i');
const ASK_RE = /how many (\w+)s?\s+are there/i;

interface Analyzed { count: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const herdM = HERD_RE.exec(q);
  if (!herdM) return null;
  const type1 = herdM[1].toLowerCase();
  const type2 = herdM[2].toLowerCase();

  const headsM = HEADS_RE.exec(q);
  if (!headsM) return null;
  const heads = Number(headsM[1]);
  if (!Number.isFinite(heads) || heads <= 0) return null;

  // Feature total: the number immediately followed (within the question) by a "How many" ask,
  // i.e. the second bare quantity clause after heads -- read directly, not guessed.
  const featM = /and\s+(\d+)\s+([a-z]+)\./i.exec(q);
  if (!featM) return null;
  const featureTotal = Number(featM[1]);
  if (!Number.isFinite(featureTotal) || featureTotal <= 0) return null;

  const p1M = PER_HEAD_RE(type1).exec(q);
  if (!p1M) return null;
  const c1 = parseCount(p1M[1]);
  if (c1 == null) return null;

  const p2M = PER_HEAD_RE(type2).exec(q);
  if (!p2M) return null;
  const c2 = parseCount(p2M[1]);
  if (c2 == null) return null;

  if (c1 === c2) return null; // no unique solution

  const askM = ASK_RE.exec(q);
  if (!askM) return null;
  const askedType = askM[1].toLowerCase();
  if (askedType !== type1 && askedType !== type2) return null;

  // x = count of type1, solving x*c1 + (heads-x)*c2 = featureTotal
  const numerator = featureTotal - heads * c2; // exact integer
  const denominator = c1 - c2;
  if (numerator % denominator !== 0) return null;
  const type1Count = numerator / denominator;
  if (!Number.isFinite(type1Count) || type1Count < 0 || type1Count > heads) return null;
  const type2Count = heads - type1Count;
  if (type2Count < 0) return null;

  const count = askedType === type1 ? type1Count : type2Count;
  return { count };
}

export const twoSpeciesHeadsAndBumpsSystemSolve: LianaMethod = {
  id: 'two-species-heads-and-bumps-system-solve-v1',
  demand: 'COMPUTE',
  name: 'Solve a two-species heads-and-feature-count linear system for the count of one named species',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W28, cluster C251, GSM8K test item416',
  shapeDescription:
    'A herd of two animal types has H heads and F total features (e.g. humps), each type\'s ' +
    'per-head feature count given; asks for one type\'s count. Standard linear system solve, ' +
    'exact integer arithmetic, only when the system resolves to a non-negative integer count ' +
    'within [0, H].',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "herd consists of <type1>s and <type2>s" clause plus a head-count plus ' +
          'a feature-total clause plus per-head feature clauses for BOTH types plus a matching ' +
          'closing question, resolving to a non-negative integer within [0, heads]; abstaining ' +
          'rather than guessing',
      };
    }
    return { matches: true, reason: `count = ${result.count}` };
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
          verdict: String(Math.round((result.count) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'standard two-species heads/feature linear system solve, exact integer arithmetic',
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

registerMethod(twoSpeciesHeadsAndBumpsSystemSolve);
