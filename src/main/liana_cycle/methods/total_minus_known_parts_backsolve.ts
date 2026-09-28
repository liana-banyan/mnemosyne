// D-BP223-M0-h2cbpqmc-011 -- total-minus-known-parts-backsolve-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE.
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\total-minus-known-parts-backsolve-v1.candidate.ts
// Accepted (gate 1 then 2a then 4, then the perturbation gate 2b), per
// BISHOP_DROPZONE\D-BP223-M0-h2cbpqmc-010_PROMOTION_BATCH_1_FIVE_CLUSTERS.md.
//
// WHY THIS FILE EXISTS RATHER THAN THE CANDIDATE ITSELF. The candidate declared its OWN local
// `LianaQuestionInput`, `ShapeTestResult` and `RunResult` interfaces and left the exported
// object completely unannotated, so nothing was ever checked against the real registry
// contract -- the same "disguise" already found and named in the earlier seven item-10 methods
// (see reference_a_hand_copied_contract_is_the_defect_not_bad_types_bp222.md). Those three local
// interfaces are DELETED here; `LianaMethod` and `MethodQuestionInput` are imported from
// '../method_registry' and the exported object is annotated against the real `LianaMethod` type,
// per the estate's standing order NEVER CAST, ANNOTATE.
//
// THE BEHAVIOR CORE IS COPIED BYTE-FOR-BYTE AND DELIBERATELY NOT IMPROVED: every constant, every
// helper function and analyze() itself below are the candidate's own bytes -- proved by byte
// containment in this dispatch's report, not merely asserted. `accept_gates.cjs` judged this
// method's BEHAVIOR (gate 1 solves its own shape, gate 2a carries no answer, gate 4 steals
// nothing) and the perturbation gate (2b) ran baseline plus 3 perturbations, all TRACK. Editing
// the analysis would mean that ACCEPT no longer describes this file. Only the interface layer --
// the two signatures and the returned object shapes -- is this dispatch's work.
//
// TRY/CATCH ADDED, matching the Founder-approved pass across the earlier seven
// (D-BP223-BM0-005, 2026-09-07T01:25:41Z ruling: "Yes do the Try/Catch pass across the seven.
// Approved. Word.") applied here from the start rather than as a later pass: run() aborts to an
// honest abstain on any thrown error rather than ending the engine's fall-through chain.
//
// REGISTERED QUARANTINED (`quarantined: true`), so selectMethod() and selectEligibleMethods()
// will never choose it. Registering changes NO live run; it makes the method visible to
// listMethods() and measurable -- the whole point of filing it. Un-quarantining is a separate,
// later Founder decision made per batch after held-out measurement, not this dispatch's.

/**
 * D-BP223-BM0-079 CLUSTER C12 (5 silo members, zero promoted). Representative teaching case:
 * item197 (GSM8K test line 197, the city of Soda's population).
 *
 * @generalShape A total is stated directly (flagged by a keyword like "exactly", "total",
 *   "altogether", "in all", "combined"); two or more of the total's parts are also stated
 *   directly as their own numbers; the missing remaining part is TOTAL minus the sum of the
 *   stated known parts. This is cluster C12's "back-solve total minus known parts" shape.
 *
 * @recogniseInStranger Cut the text at the interrogative ("how many"/"how much"/"what") into a
 *   BODY and a QUESTION tail (numbers in the tail are never scanned as data). Split BODY into
 *   clauses on commas/"and"/sentence breaks. The TOTAL clause is the one clause containing
 *   exactly one number AND one of the keywords "exactly", "total", "altogether", "in all",
 *   "combined". Every OTHER clause carrying exactly one number is a KNOWN-PART candidate. Fire
 *   only when exactly one TOTAL clause is found, there are AT LEAST TWO known-part clauses, no
 *   clause anywhere carries two or more numbers (ambiguous pairing), and no disqualifying
 *   keyword (percent, average, "more than", "fewer than", "less than", "as many as", "times as",
 *   "twice", "half", "third", "tenth", "quarter") is present anywhere in the text.
 *
 * @whatBreaksIt (a) a "known part" that is not actually independent but is itself derived from
 *   another part via a relative phrase ("50 more customers than the first day", "half as old as
 *   the oldest") -- these are exactly what the disqualifying-keyword list is built to catch,
 *   because summing the bare number as if it were the whole part (rather than the relation) would
 *   silently give the wrong subtraction; (b) a total described without any of the four trigger
 *   words this method looks for (a stranger phrasing this method has not been shown); (c) a
 *   problem needing a further split (e.g. divide the remainder by 2) after the subtraction --
 *   out of scope for this narrow shape, correctly left unmatched rather than half-answered.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Any guard
 *   failing (no unambiguous total clause, fewer than two known-part clauses, any multi-number
 *   clause, a disqualifying keyword, a negative or non-finite result) makes the method ABSTAIN:
 *   verdict null, abstain true. Cross-cluster measurement (D-BP223 batch 1 report) found this
 *   design correct on item197 (the representative) and honestly abstaining (never wrong) on
 *   items 213, 219, 273 and 294 of the 5-member cluster, every one of which carries a relative-
 *   derivation the disqualifying-keyword guard correctly refuses rather than mis-sums.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';


const METHOD_ID = 'total-minus-known-parts-backsolve-v1';

const DISQUALIFYING_KEYWORDS: string[] = [
  'percent', '%', 'average', 'mean', 'more than', 'fewer than', 'less than',
  'as many as', 'as much as', 'times as', 'twice', 'double', 'triple',
  'half', 'quarter', 'third', 'tenth', 'fraction', 'ratio', 'equation',
  'unknown', 'variable',
];

const TOTAL_KEYWORDS = ['exactly', 'total', 'altogether', 'in all', 'combined'];

interface Clause {
  text: string;
  numbers: number[];
}

function splitDeclarativeClauses(body: string): Clause[] {
  const sentences = body.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  const clauses: Clause[] = [];
  for (const s of sentences) {
    const parts = s.split(/,\s*(?:and\s+)?|\s+and\s+/i);
    for (const p of parts) {
      const trimmed = p.trim();
      if (!trimmed) continue;
      const numMatches = trimmed.match(/\$?\d+(?:\.\d+)?/g) || [];
      const numbers = numMatches.map((t) => parseFloat(t.replace('$', '')));
      clauses.push({ text: trimmed, numbers });
    }
  }
  return clauses;
}

interface Analyzed {
  total: number;
  knownParts: number[];
  answer: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();
  const lower = q.toLowerCase();
  for (const kw of DISQUALIFYING_KEYWORDS) {
    if (lower.includes(kw)) return null;
  }

  const interrogative = /how (many|much)|what (is|was|will)/i;
  const im = interrogative.exec(q);
  const body = im ? q.slice(0, im.index) : q;

  const clauses = splitDeclarativeClauses(body);
  if (!clauses.length) return null;

  // Any clause with two-or-more numbers makes the whole question ambiguous for this narrow
  // shape -- refuse rather than guess which number is the total and which is a part.
  if (clauses.some((c) => c.numbers.length >= 2)) return null;

  let totalClause: Clause | null = null;
  const knownParts: number[] = [];
  for (const c of clauses) {
    if (c.numbers.length !== 1) continue;
    const lowerClause = c.text.toLowerCase();
    const looksLikeTotal = TOTAL_KEYWORDS.some((kw) => lowerClause.includes(kw));
    if (looksLikeTotal) {
      if (totalClause) return null; // more than one candidate total clause -- ambiguous
      totalClause = c;
    } else {
      knownParts.push(c.numbers[0]);
    }
  }

  if (!totalClause) return null;
  if (knownParts.length < 2) return null;

  const total = totalClause.numbers[0];
  if (!Number.isFinite(total)) return null;
  const sumKnown = knownParts.reduce((a, b) => a + b, 0);
  const answer = total - sumKnown;
  if (!Number.isFinite(answer) || answer < 0) return null;

  return { total, knownParts, answer };
}


export const totalMinusKnownPartsBacksolveMethod: LianaMethod = {
  id: METHOD_ID,
  demand: 'COMPUTE',
  name: 'Back-solve: total minus known parts equals the missing part',
  taughtBy: 'D-BP223-BM0-079/SEG (cluster C12, representative harvest_gsm8k_pilot_item197)',
  shapeDescription:
    'A stated total (cued by "exactly"/"total"/"altogether"/"in all"/"combined") minus two or ' +
    'more directly-stated known parts equals the missing remaining part.',
  quarantined: true,

  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find exactly one clearly-cued total clause plus at least two unambiguous ' +
          'single-number known-part clauses, or a disqualifying (relational/percentage) ' +
          'keyword was present; abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason:
        `total=${result.total}, known parts=[${result.knownParts.join(', ')}]`,
    };
  },

  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    // A question with no options is free text. Read off the input, never assumed -- same
    // convention as every other adapted item-10 method in this folder.
    const freeText = !input || input.options === null || input.options === undefined;

    try {
      const result = analyze(question);
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
      const rounded = Math.round(result.answer * 100) / 100;
      return {
        question,
        verdict: String(rounded),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `${result.total} - (${result.knownParts.join(' + ')}) = ${rounded}`,
      };
    } catch (e) {
      // TRY/CATCH PASS, D-BP223-BM0-005 convention (see file header): ABSTAIN and say what
      // threw, rather than letting the exception end the engine's fall-through chain.
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

// REGISTERED AT IMPORT TIME, the same convention as every other method module in this folder.
// ACCEPTED by accept_gates.cjs in the Founder's promoted order gate 1 then gate 2a then gate 4,
// then the perturbation gate (2b): baseline + 3 perturbations, all TRACK. See
// BISHOP_DROPZONE\D-BP223-M0-h2cbpqmc-010_PROMOTION_BATCH_1_FIVE_CLUSTERS.md for the full verdicts.
registerMethod(totalMinusKnownPartsBacksolveMethod);
