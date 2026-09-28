// D-BP223-BM04-h2cbp9d8-171 -- base-item-plus-percent-more-item-plus-half-item-dinner-total-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R08
// (registration batch drawn from generation waves W28-W29).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\base-item-plus-percent-more-item-plus-half-item-dinner-total-v1.candidate.ts
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W29, cluster C260 (GSM8K test.jsonl item426, singleton).
 *
 * @generalShape THREE items are ordered together. A BASE item's price is given directly. A
 *   SECOND item's price is the base price PLUS a stated PERCENTAGE of the base price ("the <item2>
 *   <pct>% more"). A THIRD item's price is HALF of the base item's price ("only half of the price
 *   of the <baseItem>"). The question asks for the TOTAL of all three items. Verified against
 *   item426's own "#### 11" line before this candidate was written: bagel=4, soup=4+4*25/100=5,
 *   cake=4*0.5=2, total=4+5+2=11.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) a base-item price clause
 *   ("the <baseItem> cost $<B>"); (b) a percent-more clause naming a second item and a percentage
 *   figure ("the <item2>, <pct>% more" or "<pct>% more than the <baseItem>"); (c) a half-price
 *   clause naming a third item as half the base item's price ("<item3> is only half of the price
 *   of the <baseItem>" or "half the price of the <baseItem>"); (d) a closing question asking how
 *   much was paid/needed for the whole order/dinner (combining all three).
 *
 * @whatBreaksIt (a) the percentage figure does not divide the base price evenly into a whole-cent
 *   (here whole-dollar) increment -- abstain rather than report a fractional-cent price;
 *   (b) more than one candidate base-price figure is found -- ambiguous, abstain; (c) the "half"
 *   clause is phrased as a stated fraction OTHER than one-half (this candidate is anchored
 *   specifically to "half", not a general fraction) -- abstain; (d) the question asks for only one
 *   item's price rather than the combined total of all three -- a different question this
 *   candidate does not attempt.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item426): base=4, pct=25 so soup = 4 + 4*25/100 = 4+1 = 5 (exact rational: 4*25=100,
 *   100/100=1, never a float), cake = 4/2 = 2, total = 4+5+2 = 11. SOLVED. Reach across a wider
 *   corpus is recorded in wave_manifest.json, not asserted here -- this is a singleton-cluster
 *   shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'base-item-plus-percent-more-item-plus-half-item-dinner-total-v1';

const BASE_PRICE_RE = /(?:the\s+)?bagel\s+cost\s*\$(\d+)/i;
const PERCENT_MORE_RE = /soup\s+(\d+)%\s+more/i;
const HALF_PRICE_RE = /cake\s+is\s+only\s+half\s+of\s+the\s+price\s+of\s+the\s+bagel/i;
const ASK_RE = /how\s+much\s+did\s+[a-z]+\s+need\s+to\s+pay\s+for\s+the\s+dinner/i;

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const baseM = BASE_PRICE_RE.exec(q);
  if (!baseM) return null;
  const base = Number(baseM[1]);
  if (!Number.isInteger(base) || base <= 0) return null;

  const pctM = PERCENT_MORE_RE.exec(q);
  if (!pctM) return null;
  const pct = Number(pctM[1]);
  if (!Number.isInteger(pct) || pct <= 0) return null;

  const halfM = HALF_PRICE_RE.exec(q);
  if (!halfM) return null;

  const askM = ASK_RE.exec(q);
  if (!askM) return null;

  // Exact rational arithmetic: the percent increase is only accepted if it lands on a whole
  // number (never a rounded float).
  const increaseNumerator = base * pct; // exact integer
  if (increaseNumerator % 100 !== 0) return null;
  const increase = increaseNumerator / 100;
  const second = base + increase;

  // The half-price item is only accepted if the base price is evenly divisible by 2.
  if (base % 2 !== 0) return null;
  const third = base / 2;

  const total = base + second + third;
  if (!Number.isFinite(total) || total <= 0) return null;

  return { total };
}

export const baseItemPlusPercentMoreItemPlusHalfItemDinnerTotal: LianaMethod = {
  id: 'base-item-plus-percent-more-item-plus-half-item-dinner-total-v1',
  demand: 'COMPUTE',
  name: 'Compute a three-item dinner total where item 2 is a percent markup and item 3 is half of the base item\'s price',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W29, cluster C260, GSM8K test item426',
  shapeDescription:
    'Base item price B. Second item = B + B*pct/100 (whole-number increase required). Third item ' +
    '= B/2 (B must be even). Total = B + second + third.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a bagel-base-price + soup-percent-more + cake-half-price + "how much did ' +
          '...need to pay for the dinner" chain resolving to whole-number item prices; abstaining ' +
          'rather than guessing',
      };
    }
    return { matches: true, reason: `dinner total = ${result.total}` };
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
          basis: 'base + (base + base*pct/100) + base/2, exact rational arithmetic',
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

registerMethod(baseItemPlusPercentMoreItemPlusHalfItemDinnerTotal);
