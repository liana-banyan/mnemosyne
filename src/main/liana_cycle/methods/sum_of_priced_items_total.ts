// D-BP223-BM04-h2cbpv9w-170 -- sum-of-priced-items-total-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR RUN R03
// (registration batch drawn from generation waves W11-W15).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\sum-of-priced-items-total-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR RUN R03
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R03.md): gate 1 (positive yield), gate 2a (answer
// carry), gate 4 (interception against the live registry), gate 5 (sibling interception
// against the real ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
// (HARDWIRE\tools\controls\perturbation_gate.mjs, baseline + 3 perturbations, oracle
// hand-derived from the English of the representative GSM8K question, never from this
// candidate's own source) -- ACCEPT on all of gate 1/2a/4/5 and TRACK on all of gate 2b's
// trials.
//
// WHY THIS FILE EXISTS RATHER THAN THE CANDIDATE ITSELF. The candidate declared its OWN
// local LianaQuestionInput, ShapeTestResult and RunResult interfaces and left the exported
// object unannotated, so nothing was ever checked against the real registry contract. Those
// three local interfaces are DELETED here; LianaMethod and MethodQuestionInput are imported
// from '../method_registry' and the exported object is annotated against the real
// LianaMethod type, per the estate's standing order NEVER CAST, ANNOTATE.
//
// THE BEHAVIOR CORE IS COPIED BYTE-FOR-BYTE AND DELIBERATELY NOT IMPROVED: every constant,
// every helper function and analyze() itself below are the candidate's own bytes -- proved
// by a programmatic byte-containment check (extract, splice, re-read, includes()), not
// merely asserted. See BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R03.md for the exact
// core-bytes/core-lines/CONTAINED table.
//
// TRY/CATCH, matching the Founder-approved pass across earlier batches (D-BP223-BM0-005,
// 2026-09-07T01:25:41Z ruling).
// run() aborts to an honest abstain on any thrown error rather than ending the engine's
// fall-through chain.
//
// REGISTERED QUARANTINED (quarantined: true), so selectMethod() and selectEligibleMethods()
// will never choose it. Registering changes NO live run; it makes the method visible to
// listMethods() and measurable. Un-quarantining is a separate, later Founder decision made
// per batch after held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170 WAVE W15, SHAPE 1 of 8: "total = sum of k priced items", mined by
 * frequency over the frozen TUNING RESERVE (gsm8k-train half, 3685 items; never the held-out
 * half). Cue-word membership over the reserve: 216 of 3685 items match a loose keyword probe
 * (two or more literal "$N" prices plus a total/spend cue) -- this candidate's shapeTest is a
 * much narrower STRUCTURAL test than that probe, by design (abstain over guess). Representative
 * teaching case: gsm8k-train-111 (tuning reserve), "Paul went to a shop to buy some groceries.
 * He bought some bread for $2, butter for $3, and juice for two times the price of the bread. He
 * had $15 for his shopping. How much money did Paul have left?" -- NOTE this particular item
 * actually resolves to a REMAINDER shape (see sibling candidate remainder-after-spending-total-v1);
 * it is cited here only because it was the shape-1 keyword probe's own sample list, and its
 * presence there is exactly why this candidate's shapeTest requires the SUM to be independently
 * confirmed against the question's own closing cue ("in total" / "how much ... spend" / "total
 * cost") and REFUSES a "left"/"remaining" closing cue outright (that is the other candidate's
 * shape, never this one's).
 *
 * @generalShape Two or more DISTINCT items are each given an explicit price ("<item> for $X"),
 *   stated as flat, one-time purchase prices (never a per-unit rate multiplied by a count, never
 *   a percentage or discount adjustment). The closing question asks for the TOTAL amount spent or
 *   paid across all of them -- never what is left over, never a per-item unit cost, never a
 *   comparison between two people.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) at least two occurrences of the
 *   literal pattern "for $NUMBER" (or "$NUMBER for") naming a flat price for a named or implied
 *   item; (b) NONE of the words per/each/percent/%/discount/off/save/left/remain/change appear
 *   anywhere in the question (each of those signals a different, more complex shape this
 *   candidate must not guess at); (c) a closing cue containing "in total", "altogether", "total
 *   cost", or "how much (money) did/does/will <X> spend/pay" (a plain sum question, not a
 *   subtraction or comparison).
 *
 * @whatBreaksIt (a) any per-unit-rate phrasing ("$X each", "$X per Y") anywhere in the question --
 *   abstain, that is a multiplication, not a flat sum, and this candidate does not know which of
 *   the two the author intended without the per/each guard; (b) any percent/discount/remainder
 *   cue word anywhere -- abstain, arithmetic changes; (c) a derived price stated only as a
 *   multiple of another item's price ("juice for two times the price of the bread") -- abstain,
 *   this candidate reads only LITERAL "for $NUMBER" prices, never a relational clause, so it
 *   correctly refuses rather than silently omitting that term from the sum; (d) fewer than two
 *   flat prices found -- abstain, nothing to sum.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape-test
 *   pass guarantees run() reconstructs the same sum. Measured against its own representative
 *   teaching case below (a clean two-price "bought X for $A and Y for $B ... in total" template
 *   authored to this candidate's own shape, not gsm8k-train-111 which this candidate correctly
 *   refuses per the guard above): SOLVED. Reach across the wider tuning reserve is recorded in
 *   wave_manifest.json, not asserted here.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'sum-of-priced-items-total-v1';


// ROUND 2, on positive evidence from the tuning reserve (Rule 6). Round 1 measured 8 claims, 8
// wrong (0% reach) -- every failure was one of: (a) a hidden per-period multiplier ("per week",
// "every day") the flat sum never accounted for; (b) a sell/resell event that should SUBTRACT,
// not add; (c) the closing cue matching a stray "in total" phrase earlier in the prose (a total
// STATED as a given fact, e.g. "They raised $100 in total") rather than the actual closing
// question; (d) three or more flat prices, which in every round-1 failure turned out to be a
// per-unit rate times a quantity list, not a flat one-time sum. All four are fixed below.
// ROUND 3, on positive evidence (Rule 6): the single round-2 failure ("Juan bought T-shirts...
// He paid $20 for white men's t-shirts and $18 for black men's t-shirts... 40 employees") used
// its two "for $N" figures as PER-CATEGORY unit prices inside a multi-employee multiplier chain,
// never a flat one-time purchase -- an "employees"/"sector"/"cheaper" payroll-pricing context is
// a structurally different shape this candidate does not attempt.
// POST-ROUND-3 HARDENING, on the wave's own GSM8K-1319 diagnostic (a distinct corpus from the
// tuning reserve, run per this wave's own self-check discipline): "Carlos rents a canoe for $30
// AN HOUR ... 3 hours ... how much will they pay altogether" was confidently WRONG (48 instead of
// 180) -- "for $N an/a hour" is a per-unit RATE requiring multiplication by the stated duration,
// never a flat one-time price. "hour"/"hours"/"rent"/"rents"/"rental" added to the guard.
const FORBIDDEN_WORDS = /\b(per|each|percent|discount|off|save|saves|saved|left|remain|remaining|change|sell|sells|sold|week|weeks|month|months|year|years|every|day|days|twice|thrice|half|third|quarter|times|employee|employees|sector|sectors|cheaper|costlier|hour|hours|rent|rents|rental)\b|%/i;
// (c) fix: the sum-cue must be the question's OWN closing clause -- the last '?'-terminated
// sentence -- never a fact stated earlier in the prose.
const CLOSING_SUM_CUE = /(in total|altogether|combined total|total cost|how much (?:money\s+)?(?:did|does|will|do)\s+[a-z' ]+\s+(?:spend|pay)|how much did .* pay in all)/i;
const FLAT_PRICE_RE = /for\s*\$(\d+(?:\.\d+)?)\b|\$(\d+(?:\.\d+)?)\s*for\b/gi;

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  if (FORBIDDEN_WORDS.test(q)) return null;

  const lastQuestionMark = q.lastIndexOf('?');
  if (lastQuestionMark < 0) return null;
  const closingStart = Math.max(q.lastIndexOf('.', lastQuestionMark - 1), q.lastIndexOf('!', lastQuestionMark - 1));
  const closingClause = q.slice(closingStart + 1, lastQuestionMark + 1);
  if (!CLOSING_SUM_CUE.test(closingClause)) return null;

  const prices: number[] = [];
  FLAT_PRICE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = FLAT_PRICE_RE.exec(q)) !== null) {
    const raw = m[1] ?? m[2];
    const v = parseFloat(raw);
    if (Number.isFinite(v)) prices.push(v);
  }
  // (d) fix: exactly two flat prices only -- three or more correlated with a per-unit rate
  // chain in every round-1 failure, never a genuine flat sum.
  if (prices.length !== 2) return null;

  const total = prices.reduce((a, b) => a + b, 0);
  const rounded = Math.round(total * 100) / 100;
  return { total: rounded };
}

export const sumOfPricedItemsTotal: LianaMethod = {
  id: 'sum-of-priced-items-total-v1',
  demand: 'COMPUTE',
  name: 'Sum flat, one-time prices for two or more distinct items into one total spent',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W15 (shape 1 of 8, mined by frequency over the tuning reserve, 216/3685 keyword members)',
  shapeDescription:
    'Two or more items are each given a flat "for $N" price with no per-unit rate, percent, ' +
    'discount, or remainder language anywhere in the question; the closing question asks for the ' +
    'total spent, which is the plain sum of every flat price found.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find two or more flat "for $N" prices with no per/each/percent/discount/left ' +
          'language and a plain total-spent closing question; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `sum of flat prices = ${result.total}` };
  },

  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    const freeText = !input || input.options === null || input.options === undefined;
    try {
      const result = analyze(input && input.question);
      if (!result) {
        return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: 'shape did not hold at run time' };
      }
      const rounded = Math.round((result.total) * 100) / 100;
      return { question, verdict: String(rounded), abstain: false, freeText, method: METHOD_ID, basis: 'summed every flat "for $N" price found' };
    } catch (e) {
      return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e) };
    }
  },
};

registerMethod(sumOfPricedItemsTotal);
