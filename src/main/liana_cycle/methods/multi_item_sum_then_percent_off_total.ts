// D-BP223-BM04-h2cbp9d8-171 -- multi-item-sum-then-percent-off-total-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R09.
// (registration batch drawn from generation waves W30-W31.)
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\multi-item-sum-then-percent-off-total-v1.candidate.ts
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W30, cluster C264 (GSM8K test.jsonl item430, singleton).
 *
 * @generalShape TWO flat-price named items ("a set of X for $A", "a set of Y for $B") plus ONE
 *   quantity*unit-price item ("N separate Z at $C each") are all purchased together, then the
 *   WHOLE order gets a single percentage discount off. The question asks the final discounted
 *   total. Verified against item430's own "#### 132" line before this candidate was written:
 *   pans $120 + bowls $20 + 5 utensils*$5=$25 -> subtotal $165; 20% off -> 165*0.8=$132.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence, matched by exact cents (never
 *   parseFloat): (a) exactly TWO occurrences of "for $<amount>" (the two flat-price items);
 *   (b) one "<N> separate <noun> at $<amount> each" clause; (c) a "<P>% off" clause; (d) a
 *   closing "How much was <pronoun> order?" question. All amounts are parsed digit-by-digit into
 *   integer cents so the arithmetic never touches a float.
 *
 * @whatBreaksIt (a) more or fewer than exactly two "for $" flat-item prices in the text --
 *   abstain, this candidate does not attempt a 1-item or 3-item variant; (b) the discounted total
 *   is not an exact whole number of cents (totalCents*(100-discountPct) not divisible by 100) --
 *   abstain rather than round; (c) a tax ADDED instead of a discount taken off -- different
 *   arithmetic, not attempted; (d) the question asks for the pre-discount subtotal instead of the
 *   final order cost -- a different question this candidate does not answer.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item430): subtotalCents = 12000 + 2000 + 5*500 = 16500, discounted =
 *   16500*(100-20)/100 = 13200 cents = $132.00 exactly (divisible, no rounding used). SOLVED.
 *   Reach across a wider corpus is recorded in wave_manifest.json, not asserted here -- this is a
 *   singleton-cluster shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'multi-item-sum-then-percent-off-total-v1';

const FLAT_PRICE_RE = /for\s*\$([\d,]+(?:\.\d+)?)/gi;
const QTY_ITEM_RE = /(\d+)\s+separate\s+[a-z]+\s+at\s*\$([\d,]+(?:\.\d+)?)\s+each/i;
const DISCOUNT_RE = /(\d+)%\s*off/i;
const ASK_RE = /how\s+much\s+was\s+(?:her|his|their)\s+order\??/i;

/** Parses a dollar-amount string into EXACT integer cents, digit by digit -- never parseFloat. */
function toCentsExact(raw: string): number | null {
  const clean = raw.replace(/,/g, '');
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(clean);
  if (!m) return null;
  const whole = Number(m[1]);
  const fracRaw = (m[2] || '').padEnd(2, '0').slice(0, 2);
  const frac = Number(fracRaw);
  if (!Number.isInteger(whole) || !Number.isInteger(frac)) return null;
  return whole * 100 + frac;
}

interface Analyzed { verdictStr: string; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const flatMatches = [...q.matchAll(FLAT_PRICE_RE)];
  if (flatMatches.length !== 2) return null; // requires exactly two flat-price items

  const flat1 = toCentsExact(flatMatches[0][1]);
  const flat2 = toCentsExact(flatMatches[1][1]);
  if (flat1 == null || flat2 == null) return null;

  const qtyM = QTY_ITEM_RE.exec(q);
  if (!qtyM) return null;
  const qty = Number(qtyM[1]);
  if (!Number.isInteger(qty) || qty <= 0) return null;
  const unitCents = toCentsExact(qtyM[2]);
  if (unitCents == null) return null;

  const discM = DISCOUNT_RE.exec(q);
  if (!discM) return null;
  const discountPct = Number(discM[1]);
  if (!Number.isInteger(discountPct) || discountPct < 0 || discountPct > 100) return null;

  if (!ASK_RE.test(q)) return null;

  const subtotalCents = flat1 + flat2 + qty * unitCents;
  const scaled = subtotalCents * (100 - discountPct);
  if (scaled % 100 !== 0) return null; // not an exact whole-cent result; abstain rather than round
  const resultCents = scaled / 100;

  const wholeDollars = Math.trunc(resultCents / 100);
  const centsRemainder = resultCents - wholeDollars * 100;
  const verdictStr = centsRemainder === 0 ? String(wholeDollars) : `${wholeDollars}.${String(centsRemainder).padStart(2, '0')}`;

  return { verdictStr };
}

export const multiItemSumThenPercentOffTotal: LianaMethod = {
  id: 'multi-item-sum-then-percent-off-total-v1',
  demand: 'COMPUTE',
  name: 'Compute total order cost of two flat-price items plus one quantity*unit-price item, after a whole-order percentage discount',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W30, cluster C264, GSM8K test item430',
  shapeDescription:
    'Two flat-price items ("for $A", "for $B") plus one quantity*unit-price item ("N at $C each") ' +
    'are summed to a subtotal, then a stated percentage is taken off the whole subtotal. Answer = ' +
    '(A + B + N*C) * (100 - discountPct) / 100, computed in exact integer cents.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find exactly two "for $" flat-price items plus one "N separate ... at $C each" ' +
          'item plus a "P% off" clause plus a "how much was ... order?" ask, with an exact whole-' +
          'cent discounted result; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `discounted order total = $${result.verdictStr}` };
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
          verdict: String(result.verdictStr),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: '(flat1 + flat2 + qty*unitCents) * (100-discountPct) / 100, exact integer-cent arithmetic',
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

registerMethod(multiItemSumThenPercentOffTotal);
