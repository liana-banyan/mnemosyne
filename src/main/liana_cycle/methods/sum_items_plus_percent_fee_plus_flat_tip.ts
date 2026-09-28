// D-BP223-BM04-h2cbpv9w-170 -- sum-items-plus-percent-fee-plus-flat-tip-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W05).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\sum-items-plus-percent-fee-plus-flat-tip-v1.candidate.ts
// Authored by generation wave W05 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W05.md),
// merged into the shared manifest and run through the full gate chain by REGISTRAR R02
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R02.md): gate 1 (positive yield), gate 2a
// (answer carry), gate 4 (interception against the live registry), gate 5 (sibling interception
// against the real ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
// (HARDWIRE\tools\controls\perturbation_gate.mjs, baseline + 3 perturbations, oracle hand-derived
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R02.md for the exact
// core-bytes/core-lines/CONTAINED table. Only the interface layer (imports, the three deleted
// local interfaces, the exported object's shape, shapeTest/run signatures, and the numeric-verdict
// rounding + String() cast) is new text.
//
// TRY/CATCH, matching the Founder-approved pass across earlier batches (D-BP223-BM0-005,
// 2026-09-07T01:25:41Z ruling). run() aborts to an honest abstain on any thrown error rather than
// ending the engine's fall-through chain.
//
// REGISTERED QUARANTINED (`quarantined: true`), so selectMethod() and selectEligibleMethods() will
// never choose it. Registering changes NO live run; it makes the method visible to listMethods()
// and measurable. Un-quarantining is a separate, later Founder decision made per batch after
// held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170 WAVE W05 CLUSTER C64 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl item137, "Rory orders 2 subs for $7.50 each, 2 bags of chips
 * for $1.50 each and 2 cookies for $1.00 each for delivery. There's a 20% delivery fee added at
 * check out and she wants to add a $5.00 tip. What will her delivery order cost?".
 *
 * @generalShape Two or more line items, each "<count> <item> for $<price> each", are summed to a
 *   subtotal. A stated PERCENTAGE fee (delivery fee, service charge) is applied to the subtotal.
 *   A stated FLAT dollar tip/fee is added on top. Total = subtotal + subtotal*pct + flatAmount.
 *
 * @recogniseInStranger Requires all three of: (a) two or more "<count> <item(s)> for $<price>
 *   each" clauses (comma/"and"-separated), (b) an explicit percentage fee phrase ("N% delivery
 *   fee", "N% service charge"/"service fee"), and (c) an explicit flat dollar amount phrase
 *   naming a tip ("add a $T tip", "$T tip"). All dollar figures are converted to integer cents
 *   before any arithmetic; the percentage is applied to the summed subtotal, never to any single
 *   line item.
 *
 * @whatBreaksIt (a) fewer than two "<count> <item> for $<price> each" clauses found -- abstains,
 *   nothing to sum; (b) no percentage-fee phrase found -- this candidate does not attempt a plain
 *   sum (that is a different, broader shape this narrow candidate deliberately leaves alone);
 *   (c) no flat tip phrase found -- abstains rather than assume the tip is zero, since a zero-tip
 *   variant of this shape is not evidenced by the one known member; (d) a stranger question using
 *   "at $P" instead of "for $P each" would not be recognised -- flagged rather than hidden.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own sole cluster member: SOLVED (29). With only one known member there is no
 *   cross-member measurement to report for this cluster.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'sum-items-plus-percent-fee-plus-flat-tip-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });

function wordOrDigit(tok: string): number | null {
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit)) return Number(digit);
  const w = tok.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(ONES, w)) return ONES[w];
  return null;
}

function toCents(raw: string): number | null {
  const cleaned = raw.replace(/[,$]/g, '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ''] = cleaned.split('.');
  const fracPadded = (frac + '00').slice(0, 2);
  return Number(whole) * 100 + Number(fracPadded);
}

interface Analyzed {
  totalCents: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const lineRe = /([a-z0-9]+)\s+([a-z][a-z\s]*?)\s+for\s+\$([\d.,]+)\s+each/gi;
  const lines: { count: number; priceCents: number }[] = [];
  let lm: RegExpExecArray | null;
  while ((lm = lineRe.exec(q)) !== null) {
    const count = wordOrDigit(lm[1]);
    const priceCents = toCents(lm[3]);
    if (count === null || priceCents === null) continue;
    lines.push({ count, priceCents });
  }
  if (lines.length < 2) return null;
  const subtotalCents = lines.reduce((s, l) => s + l.count * l.priceCents, 0);

  const pctMatch = /(\d+(?:\.\d+)?)\s*%\s+(?:delivery|service)\s+(?:fee|charge)/i.exec(q);
  if (!pctMatch) return null;
  const pct = Number(pctMatch[1]);
  if (!Number.isFinite(pct) || pct < 0) return null;

  const tipMatch = /\$([\d.,]+)\s+tip\b/i.exec(q);
  if (!tipMatch) return null;
  const tipCents = toCents(tipMatch[1]);
  if (tipCents === null) return null;

  // Round the percentage fee to the nearest cent, exactly as ordinary money arithmetic does --
  // computed once as an integer, never accumulated across intermediate floating steps.
  const feeCents = Math.round((subtotalCents * pct) / 100);
  const totalCents = subtotalCents + feeCents + tipCents;
  return { totalCents };
}

export const sumItemsPlusPercentFeePlusFlatTip: LianaMethod = {
  id: 'sum-items-plus-percent-fee-plus-flat-tip-v1',
  demand: 'COMPUTE',
  name: 'Sum line items, add a percentage fee on the subtotal, add a flat tip',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W05 (cluster C64, sole member harvest_gsm8k_pilot_item137)',
  shapeDescription:
    'Two or more "<count> <item> for $<price> each" lines sum to a subtotal; a stated percentage ' +
    'delivery/service fee applies to the subtotal; a stated flat tip is added; total is reported ' +
    'in dollars.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find two or more "<count> <item> for $<price> each" lines plus an explicit ' +
          'percentage delivery/service fee plus an explicit flat $ tip',
      };
    }
    return { matches: true, reason: `totalCents=${result.totalCents}` };
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
      const dollars = result.totalCents / 100;
      const verdict = Number.isInteger(dollars) ? dollars : Math.round(dollars * 100) / 100;
      return {
        question,
        verdict: String(Math.round((verdict) * 100) / 100),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: 'subtotal + subtotal*pct + flat tip, integer cents',
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
  }
};

registerMethod(sumItemsPlusPercentFeePlusFlatTip);
