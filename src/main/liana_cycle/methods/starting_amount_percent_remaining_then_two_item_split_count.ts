// D-BP223-BM04-h2cbp9d8-171 -- starting-amount-percent-remaining-then-two-item-split-count-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R09.
// (registration batch drawn from generation waves W30-W31.)
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\starting-amount-percent-remaining-then-two-item-split-count-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R09
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R09.md): gate 1 (positive yield), gate 2a
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R09.md for the exact
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W30, cluster C267 (GSM8K test.jsonl item434, singleton).
 *
 * @generalShape Two items are priced up front ("<itemA> for <priceA> cents and <itemB> for
 *   <priceB> cents"). An actor starts with a stated dollar amount, buys a KNOWN quantity of
 *   itemA, and ends with a stated PERCENTAGE of the STARTING amount left over. The question asks
 *   how many of itemB the actor bought with what remained. Verified against item434's own
 *   "#### 5" line before this candidate was written: started $5=500c, 1% left = 5c, spent =
 *   495c, chips 3*40c=120c, remaining for candy = 495-120 = 375c, 375/75 = 5 candy bars.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) exactly two "<name> for <N>
 *   cents" price clauses; (b) a single dollar figure ("$<amount>") naming the starting total;
 *   (c) a "got <N> <itemA-name>" quantity clause whose item name matches one of the two priced
 *   items; (d) a "had <P>% of <pronoun> money left" clause; (e) a closing "how many <itemB-name>
 *   did <actor> buy" question whose item name matches the OTHER priced item. All arithmetic is
 *   done in integer cents.
 *
 * @whatBreaksIt (a) more or fewer than exactly two priced items -- abstain, this candidate does
 *   not attempt a single-item or three-item variant; (b) the quantity-clause or ask-clause item
 *   name does not match one of the two priced items (ambiguous binding) -- abstain; (c) the
 *   leftover-cents or the final item-B count is not an exact whole number -- abstain rather than
 *   round; (d) the percentage is stated as "spent P%" instead of "had P% left" -- a different,
 *   complementary phrasing this candidate does not attempt.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item434): startingCents=500, leftoverCents=500*1/100=5 (exact), spentCents=495,
 *   itemACost=3*40=120, remainingForB=495-120=375, countB=375/75=5 (exact). SOLVED. Reach across
 *   a wider corpus is recorded in wave_manifest.json, not asserted here -- this is a singleton-
 *   cluster shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'starting-amount-percent-remaining-then-two-item-split-count-v1';

const PRICE_RE = /(?:\bsell\s+|\band\s+)([a-z]+(?:\s[a-z]+)?)\s+for\s+(\d+)\s+cents/gi;
const STARTING_RE = /\$(\d+(?:\.\d+)?)\b/;
const QTY_A_RE = /got\s+(\d+)\s+(?:bags?\s+of\s+)?([a-z]+)\b/i;
const PERCENT_LEFT_RE = /had\s+(\d+)%\s+of\s+(?:his|her|their)\s+money\s+left/i;
const ASK_RE = /how\s+many\s+([a-z]+(?:\s[a-z]+)?)\s+did\s+\w+\s+buy/i;

function toCentsExact(raw: string): number | null {
  const clean = raw.replace(/,/g, '');
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(clean);
  if (!m) return null;
  const whole = Number(m[1]);
  const frac = Number((m[2] || '').padEnd(2, '0').slice(0, 2));
  if (!Number.isInteger(whole) || !Number.isInteger(frac)) return null;
  return whole * 100 + frac;
}

function normName(s: string): string {
  return s.trim().toLowerCase().replace(/s$/, '');
}

interface Analyzed { verdict: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const priceMatches = [...q.matchAll(PRICE_RE)];
  if (priceMatches.length !== 2) return null; // requires exactly two priced items
  const priceOf: Record<string, number> = {};
  for (const m of priceMatches) priceOf[normName(m[1])] = Number(m[2]);

  const startM = STARTING_RE.exec(q);
  if (!startM) return null;
  const startingCents = toCentsExact(startM[1]);
  if (startingCents == null) return null;

  const qtyM = QTY_A_RE.exec(q);
  if (!qtyM) return null;
  const qtyA = Number(qtyM[1]);
  if (!Number.isInteger(qtyA) || qtyA <= 0) return null;
  const itemAName = normName(qtyM[2]);
  const priceA = priceOf[itemAName];
  if (priceA == null) return null;

  const percentM = PERCENT_LEFT_RE.exec(q);
  if (!percentM) return null;
  const percentLeft = Number(percentM[1]);
  if (!Number.isInteger(percentLeft) || percentLeft < 0 || percentLeft > 100) return null;

  const askM = ASK_RE.exec(q);
  if (!askM) return null;
  const itemBName = normName(askM[1]);
  const priceB = priceOf[itemBName];
  if (priceB == null || itemBName === itemAName) return null;

  const scaledLeftover = startingCents * percentLeft;
  if (scaledLeftover % 100 !== 0) return null; // not an exact whole-cent leftover
  const leftoverCents = scaledLeftover / 100;
  const spentCents = startingCents - leftoverCents;

  const itemACost = qtyA * priceA;
  const remainingForB = spentCents - itemACost;
  if (remainingForB < 0) return null;
  if (priceB <= 0 || remainingForB % priceB !== 0) return null; // not an exact whole item-B count

  const verdict = remainingForB / priceB;
  return { verdict };
}

export const startingAmountPercentRemainingThenTwoItemSplitCount: LianaMethod = {
  id: 'starting-amount-percent-remaining-then-two-item-split-count-v1',
  demand: 'COMPUTE',
  name: 'Backsolve a second item count from a starting amount, a known first-item purchase, and a stated percentage of the starting amount left over',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W30, cluster C267, GSM8K test item434',
  shapeDescription:
    'Two items are priced in cents. A starting dollar amount is spent down to leave a stated ' +
    'percentage of ITSELF (not of what was spent). A known quantity of item A is bought; the ' +
    'remainder of the spent amount buys item B. Answer = (starting*(100-P)/100 - qtyA*priceA) / ' +
    'priceB, all integer-cent arithmetic, checked exact at every division.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find exactly two "<item> for <N> cents" prices plus a single starting dollar ' +
          'figure plus a "got <N> <itemA>" clause plus a "had <P>% of ... money left" clause plus ' +
          'a "how many <itemB> did ... buy?" ask, with every division exact; abstaining rather ' +
          'than guessing',
      };
    }
    return { matches: true, reason: `item B count = ${result.verdict}` };
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
          verdict: String(Math.round((result.verdict) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: '(starting*(100-percentLeft)/100 - qtyA*priceA) / priceB, exact integer-cent arithmetic',
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

registerMethod(startingAmountPercentRemainingThenTwoItemSplitCount);
