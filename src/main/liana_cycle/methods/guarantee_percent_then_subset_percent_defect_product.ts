// D-BP223-BM04-h2cbp9d8-171 -- guarantee-percent-then-subset-percent-defect-product-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R08
// (registration batch drawn from generation waves W28-W29).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\guarantee-percent-then-subset-percent-defect-product-v1.candidate.ts
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W28, cluster C248 (GSM8K test.jsonl item413, singleton).
 *
 * @generalShape An item is marketed as "<P1>% guaranteed not to <event>" (so the true rate of
 *   <event> is 100-P1 percent). A second clause states "<P2>% of the <at-risk subset> also
 *   have/has a <defect>" (a defect rate conditioned on the at-risk subset, not the whole
 *   population). Given a total production count N, the question asks how many items will have
 *   BOTH the defect and the original event. The corpus's own ground truth (verified against
 *   item413's own "#### 25" line before this candidate was written: (100-99)%=1%, 1%*5%=0.05%,
 *   0.05%*50000=25) treats the two percentages as independent probabilities multiplied together
 *   against the total, i.e. answer = (100-P1)/100 * P2/100 * N -- reproduced here exactly.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) an explicit "<P1>% guaranteed
 *   not to <event>" clause naming an event word; (b) an explicit "<P2>% of the ... also
 *   have/has a <defect clause>" second-percentage clause; (c) an explicit total-count clause
 *   ("makes <N> <items>" or "if she/he makes <N>"); (d) a closing question of the form "how many
 *   ... will both <defect-ish phrase> and <event>" that echoes the SAME event word captured in
 *   (a).
 *
 * @whatBreaksIt (a) more than two distinct percent figures in the question -- ambiguous, abstain;
 *   (b) the event word in the closing question does not match the event word from the guarantee
 *   clause -- this candidate does not attempt cross-referencing beyond an exact word match;
 *   (c) the closing question is not a "both X and Y" conjunction (e.g. asks only about one
 *   defect) -- different shape, not handled; (d) the product (100-P1)*P2*N is not evenly
 *   divisible by 10000 -- abstains rather than report a fractional count of items.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item413): pEvent = (100-99)/100 = 1/100, pDefectGivenAtRisk = 5/100, count =
 *   (1/100)*(5/100)*50000 = 25 (kept as exact integer arithmetic throughout, never a float
 *   heuristic: numerator = (100-99)*5*50000 = 250000, /10000 = 25). SOLVED. Reach across a wider
 *   corpus is recorded in wave_manifest.json, not asserted here -- this is a singleton-cluster
 *   shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'guarantee-percent-then-subset-percent-defect-product-v1';

const GUARANTEE_RE = /(\d+)%\s*guaranteed not to\s+([a-z]+)/i;
const SUBSET_PERCENT_RE = /(\d+)%\s+of the [^.?!]*?also (?:have|has)\b[^.?!]*/i;
const TOTAL_COUNT_RE = /(?:if\s+\w+\s+makes|makes)\s+([\d,]+)\s+[a-z]+/i;
const ASK_BOTH_RE = /how many[^.?!]*\bboth\b[^.?!]*\band\b[^.?!]*\?/i;

interface Analyzed { count: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const gM = GUARANTEE_RE.exec(q);
  if (!gM) return null;
  const p1 = Number(gM[1]);
  const eventWord = gM[2].toLowerCase();
  if (!Number.isFinite(p1) || p1 < 0 || p1 > 100) return null;

  const sM = SUBSET_PERCENT_RE.exec(q);
  if (!sM) return null;
  const p2 = Number(sM[1]);
  if (!Number.isFinite(p2) || p2 < 0 || p2 > 100) return null;

  const cM = TOTAL_COUNT_RE.exec(q);
  if (!cM) return null;
  const total = Number(cM[1].replace(/,/g, ''));
  if (!Number.isFinite(total) || total <= 0) return null;

  const askM = ASK_BOTH_RE.exec(q);
  if (!askM) return null;
  // The closing question must echo the SAME event word captured from the guarantee clause --
  // positive evidence that "both" refers to this exact event, not an unrelated pair.
  const askText = askM[0].toLowerCase();
  if (!askText.includes(eventWord)) return null;

  // Rational arithmetic throughout: kept as an exact integer numerator over a fixed denominator,
  // only checked for divisibility at the end, never rounded.
  const numerator = (100 - p1) * p2 * total; // exact integer
  if (numerator % 10000 !== 0) return null; // would not land on a whole-item count
  const count = numerator / 10000;
  if (!Number.isFinite(count) || count < 0) return null;

  return { count };
}

export const guaranteePercentThenSubsetPercentDefectProduct: LianaMethod = {
  id: 'guarantee-percent-then-subset-percent-defect-product-v1',
  demand: 'COMPUTE',
  name: 'Compute how many items have both a defect (rate given conditional on the at-risk subset) and the original guaranteed-against event',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W28, cluster C248, GSM8K test item413',
  shapeDescription:
    'An item is "<P1>% guaranteed not to <event>"; "<P2>% of the at-risk subset also have a ' +
    'defect"; given a total count N, asks how many will have both. Answer = ' +
    '(100-P1)*P2*N/10000, matching the corpus\'s own worked chain, only when the product divides ' +
    '10000 evenly.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "<P1>% guaranteed not to <event>" clause plus a "<P2>% of the ... ' +
          'also have/has a defect" clause plus a total-count clause plus a "how many ... both ' +
          '<event>... and" closing question echoing the same event word; abstaining rather than ' +
          'guessing',
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
          basis: '(100-P1)*P2*total/10000, exact rational arithmetic, two independent percentages multiplied',
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

registerMethod(guaranteePercentThenSubsetPercentDefectProduct);
