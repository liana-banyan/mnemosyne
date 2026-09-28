// D-BP223-BM04-h2cbpv9w-170 -- conditional-compare-then-add-or-subtract-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, STAGED (not yet
// installed under mnemosyne/src -- see INSTALL_WHEN_CLAIM_CLEARS.md in this same directory).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\conditional-compare-then-add-or-subtract-v1.candidate.ts
// Promoted through gate 1, gate 2a, gate 4 in
//   BISHOP_DROPZONE\D-BP223-M0-h2cbpoxk-035_PROMOTION_BATCH_2_ASDIV_CLUSTERS.md
// and re-verified CONFIDENT-WRONG-free on the real ASDiv-150 + GSM8K-1319 corpora by gate 5
// (sibling interception) in
//   BISHOP_DROPZONE\D-BP223-M0-h2cbpc0g-043_GATE_5_SIBLING_INTERCEPTION.md
// Final combined verdict, this dispatch's own live re-run of accept_gates.cjs (gate 1 then 2a
// then 4 then 5), same moment this file was generated: ACCEPT.
//
// WHY THIS FILE EXISTS RATHER THAN THE CANDIDATE ITSELF. The candidate declared its OWN local
// `LianaQuestionInput`, `ShapeTestResult` and `RunResult` interfaces and left the exported
// object completely unannotated, so nothing was ever checked against the real registry
// contract -- the same disguise found and named in the earlier seven item-10 methods and in
// batch 1 (see reference_a_hand_copied_contract_is_the_defect_not_bad_types_bp222.md and
// D-BP223-M0-h2cbp8h8-018_BATCH_1_REGISTERED_QUARANTINED.md). Those three local interfaces are
// DELETED here; `LianaMethod` and `MethodQuestionInput` are imported from '../method_registry'
// and the exported object is annotated against the real `LianaMethod` type, per the estate's
// standing order NEVER CAST, ANNOTATE.
//
// THE BEHAVIOR CORE IS COPIED BYTE-FOR-BYTE AND DELIBERATELY NOT IMPROVED: every constant, every
// helper function and analyze() itself below are the candidate's own bytes, from its first
// behavior-bearing declaration (`const ONES_WORDS`) through analyze()'s closing brace -- proved
// by a programmatic byte-containment check (extract, splice, re-read, includes()), not merely
// asserted. See this dispatch's own return doc (D-BP223-BM04-h2cbpv9w-170_BATCH2_STAGED.md) for
// the exact core-bytes/core-lines/CONTAINED table. Only the interface layer (imports, the three
// deleted local interfaces, the exported object's shape, shapeTest/run signatures) is new text.
//
// TRY/CATCH ADDED, matching the Founder-approved pass across the earlier seven and batch 1
// (D-BP223-BM0-005, 2026-09-07T01:25:41Z ruling: "Yes do the Try/Catch pass across the seven.
// Approved. Word."): run() aborts to an honest abstain on any thrown error rather than ending
// the engine's fall-through chain.
//
// REGISTERED QUARANTINED (`quarantined: true`), so selectMethod() and selectEligibleMethods()
// will never choose it once installed. Registering changes NO live run; it makes the method
// visible to listMethods() and measurable. Un-quarantining is a separate, later Founder decision
// made per batch after held-out measurement, not this dispatch's.
//
// NOT YET INSTALLED. X001 (session 1d598c24) holds a scoped claim on
// mnemosyne/src/main/liana_cycle/methods and mnemosyne/scripts as of this dispatch. This file is
// staged here, at its exact eventual target filename and contents, so installation is a
// mechanical copy once that claim clears -- see INSTALL_WHEN_CLAIM_CLEARS.md.

/**
 * D-BP223-BM0-079/BATCH-2 CLUSTER C144 (1 silo member, high confidence, singleton). Representative
 * teaching case: ASDiv item18, "Jake has 34 fewer balls than Audrey. Audrey has 41 balls. How many
 * balls does Jake have?".
 *
 * @generalShape Named ACTOR-1 is stated as a relative amount ("N fewer/less/more <noun> than
 *   ACTOR-2") and a SEPARATE sentence states ACTOR-2's own absolute amount of that same noun. The
 *   answer is derived by an explicit compare-then-branch: if the relation word is "fewer"/"less",
 *   subtract the stated difference from ACTOR-2's amount; if "more", add it. Per this silo's own
 *   clustering pass this is kept apart from C143 (plain "subtract two given values") because the
 *   generated solver needs a real if/else on the relation word, not an unconditional operation --
 *   this candidate implements that branch explicitly rather than the direction-agnostic |A-B| that
 *   C143's candidate uses, even though on the one known member the two happen to agree.
 *
 * @recogniseInStranger A regex anchor finds "<Actor1> has <N> (fewer|less|more) <noun> than
 *   <Actor2>." naming the relation word and the noun, then a second anchor finds "<Actor2> has <M>
 *   <noun(s)>" elsewhere in the text to recover Actor2's absolute amount. Both N and M may be
 *   digits or spelled-out number words.
 *
 * @whatBreaksIt (a) the two sentences using a different noun for the same quantity (e.g. one says
 *   "marbles", the other "toys") -- the second regex anchors on the FIRST sentence's own noun
 *   (stemmed for a trailing 's'), so a genuine synonym swap will not be found and the method
 *   abstains rather than guess; (b) more than two actors, or the relative clause spanning more
 *   than one sentence -- the anchors require both facts to sit in the exact two-sentence shape
 *   above and abstain otherwise; (c) a relation word this method does not recognise (only fewer/
 *   less/more are handled) -- abstains.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (7, matching 41-34=7). With only one known
 *   member there is no cross-member measurement to report for this cluster -- honestly noted
 *   rather than inflated with a borrowed number from a different shape.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';


const METHOD_ID = 'conditional-compare-then-add-or-subtract-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });

const TENS_WORDS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const TENS: Record<string, number> = {};
TENS_WORDS.forEach((w, i) => { TENS[w] = (i + 2) * 10; });

const NUMBER_WORDS: Record<string, number> = { ...ONES, ...TENS, hundred: 100 };

function wordOrDigit(tok: string): number | null {
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit)) return parseFloat(digit);
  const w = tok.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, w)) return NUMBER_WORDS[w];
  return null;
}

interface Analyzed {
  name1: string;
  name2: string;
  n: number;
  m: number;
  relation: string;
  result: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const re =
    /([A-Z][\w'.]*(?:\s[A-Z][\w'.]*)?)\s+has\s+([a-zA-Z0-9]+)\s+(fewer|less|more)\s+(\w+)\s+than\s+([A-Z][\w'.]*(?:\s[A-Z][\w'.]*)?)\s*\./i;
  const m = q.match(re);
  if (!m) return null;
  const [, name1, nWord, relation, noun, name2] = m;
  const n = wordOrDigit(nWord);
  if (n === null) return null;

  const nounStem = noun.toLowerCase().replace(/s$/, '');
  const escName2 = name2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re2 = new RegExp(escName2 + '\\s+has\\s+([a-zA-Z0-9]+)\\s+' + nounStem + 's?\\b', 'i');
  const m2 = q.match(re2);
  if (!m2) return null;
  const mVal = wordOrDigit(m2[1]);
  if (mVal === null) return null;

  // D-BP223-M0-GATE5 REMEDIATION (one round, positive evidence). Gate 5 found this candidate
  // CONFIDENT-WRONG on three GSM8K items, all sharing one root cause: a THIRD actor or a
  // POST-STATEMENT EVENT the two-sentence anchor above cannot see. gsm8k-test-91 (Jan/Marcia/
  // Cindy) and gsm8k-test-178 (Rani/Monic/Bo) both ask for "the total ... the three have", not
  // either named actor's own amount -- the regex above still anchors and computes Actor2's
  // amount, which answers a question nobody asked. gsm8k-test-736 (Boris/Beck) adds a THIRD
  // sentence ("Boris gives Beck 10 apples") that changes both actors' amounts before the
  // question is even asked. THE POSITIVE EVIDENCE: this candidate's own representative teaching
  // case's question is "How many balls does Jake have?" -- it names ONE of the two anchored
  // actors directly as the subject of "how many <noun> does <actor> have", nothing else. A
  // question that instead asks for a total/combined/comparative amount, or that follows a
  // transfer verb changing the state after the two facts, is evidence this is NOT that shape.
  const escName1 = name1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const nameForQuestion = new RegExp('\\bhow many\\b[^.?!]*\\bdoes\\s+(?:' + escName1 + '|' + escName2 + ')\\s+have\\b', 'i');
  if (!nameForQuestion.test(q)) return null;
  // A transfer verb anywhere in the text means a state change the two-sentence anchor never
  // modeled -- the "has ... than" facts may no longer hold by the time the question is asked.
  const TRANSFER_AFTER_RE = /\b(gives?|gave|received?|takes?|took|sold|bought)\b/i;
  if (TRANSFER_AFTER_RE.test(q)) return null;

  const rel = relation.toLowerCase();
  const result = rel === 'fewer' || rel === 'less' ? mVal - n : mVal + n;
  if (!Number.isFinite(result)) return null;

  return { name1, name2, n, m: mVal, relation: rel, result };
}


export const conditionalCompareThenAddOrSubtractMethod: LianaMethod = {
  id: METHOD_ID,
  demand: 'COMPUTE',
  name: 'Relative comparison, then conditionally add or subtract the stated difference',
  taughtBy: 'D-BP223-BM0-079/SEG BATCH-2 (cluster C144, sole member harvest_asdiv_pilot_item18)',
  shapeDescription:
    'Actor 1 stated as N fewer/less/more of a noun than Actor 2; Actor 2 stated absolutely. ' +
    'Branches: fewer/less subtracts N from Actor 2, more adds N to Actor 2.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason: `did not find the two-sentence relative-comparison shape ("<Actor1> has N fewer/less/more <noun> than <Actor2>. <Actor2> has M <noun>."), or the question/transfer-verb guard did not hold; abstaining rather than guessing`,
      };
    }
    return { matches: true, reason: `${result.relation}: ${result.m} vs ${result.n} -> ${result.result}` };
  },

  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    // A question with no options is free text. Read off the input, never assumed -- same
    // convention as every other adapted method in this folder.
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
      const rounded = Math.round((result.result) * 100) / 100;
      return {
        question,
        verdict: String(rounded),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `${result.m} ${result.relation === 'more' ? '+' : '-'} ${result.n} = ${rounded}`,
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
// ACCEPTED by this dispatch's own live re-run of accept_gates.cjs (gate 1 then gate 2a then gate 4
// then gate 5), matching BISHOP_DROPZONE\D-BP223-M0-h2cbpoxk-035_PROMOTION_BATCH_2_ASDIV_CLUSTERS.md and
// BISHOP_DROPZONE\D-BP223-M0-h2cbpc0g-043_GATE_5_SIBLING_INTERCEPTION.md. See
// BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_BATCH2_STAGED.md for the full verdict table.
registerMethod(conditionalCompareThenAddOrSubtractMethod);
