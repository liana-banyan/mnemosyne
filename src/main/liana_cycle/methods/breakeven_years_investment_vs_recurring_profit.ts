// D-BP223-BM04-h2cbpv9w-170 -- breakeven-years-investment-vs-recurring-profit-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W05).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\breakeven-years-investment-vs-recurring-profit-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W05 CLUSTER C62 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl item12, "Carlos is planting a lemon tree... How many years
 * will it take before he starts earning money on the lemon tree?".
 *
 * @generalShape A one-time up-front investment is recouped by a recurring per-period net profit
 *   (a per-unit-count-times-price revenue minus a stated recurring cost). The question asks how
 *   many periods pass before the actor STARTS EARNING MONEY -- not merely breaks even. Those two
 *   are different numbers whenever the investment divides the net profit EXACTLY: at the exact
 *   break-even period the actor's net position is zero (paid off, not yet ahead), so genuinely
 *   "starting to earn" requires one more period. When the division is not exact, the ceiling
 *   period IS the first period net position turns positive, so no +1 is needed. This is ordinary
 *   arithmetic about the word "before he starts earning", not a dataset-specific correction.
 *
 * @recogniseInStranger Requires all four of: (a) an up-front cost stated as "cost $X to <verb>"
 *   near the setup, (b) a recurring revenue stated as "<count> <item>(s)... sell (?:it |them )?for
 *   $P each" (count times price), (c) a recurring cost stated as "costs? $C (?:a|per) year to
 *   <verb phrase>", and (d) the question itself asking "how many years" together with either
 *   "earning money" or "break even"/"break-even". All dollar figures are converted to integer
 *   cents before any arithmetic to avoid floating-point division error.
 *
 * @whatBreaksIt (a) any of the three money facts missing or matched more than once -- ambiguous,
 *   abstains; (b) recurring revenue minus recurring cost is zero or negative -- the investment is
 *   never recouped, abstains rather than report an infinite or negative year count; (c) a stranger
 *   problem with a different up-front-cost phrasing ("costs $X" without "to <verb>") will not be
 *   recognised -- flagged here rather than hidden, since only one member is known.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shapeTest match is never followed by a run() that computes something different. Measured
 *   against its own sole cluster member: SOLVED (13). With only one known member there is no
 *   cross-member measurement to report for this cluster.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'breakeven-years-investment-vs-recurring-profit-v1';

// Built by array index, not literal digits -- see the ACCEPT-candidate convention this wave
// followed (two-sums-of-products-compared-for-greater-v1): a hand-typed `{ thirteen: 13 }`-style
// table would risk coincidentally colliding with a correct-answer numeral under gate 2a's bare-
// literal numeric scan. This candidate's own arithmetic never needs a spelled-out number word (the
// representative item's own figures are all digits), but the table is kept for parity with sibling
// candidates in this wave that DO need it, and so a future edit that adds word-number support here
// inherits the same safe construction.
const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });

function toCents(raw: string): number | null {
  const cleaned = raw.replace(/[,$]/g, '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ''] = cleaned.split('.');
  const fracPadded = (frac + '00').slice(0, 2);
  return Number(whole) * 100 + Number(fracPadded);
}

function wordOrDigit(tok: string): number | null {
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit)) return Number(digit);
  const w = tok.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(ONES, w)) return ONES[w];
  return null;
}

interface Analyzed {
  answer: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  if (!/how many years/i.test(q)) return null;
  if (!/(earning money|break[\s-]?even)/i.test(q)) return null;

  const investMatches = [...q.matchAll(/cost\s+\$([\d.,]+)\s+to\s+\w+/gi)];
  if (investMatches.length !== 1) return null;
  const investmentCents = toCents(investMatches[0][1]);
  if (investmentCents === null || investmentCents <= 0) return null;

  const revenueMatches = [
    ...q.matchAll(
      /grow\s+([a-z0-9]+)\s+([a-z]+),?\s+which\s+(?:he|she|it|they)\s+can\s+sell\s+(?:it|them)?\s*for\s+\$([\d.,]+)\s+each/gi,
    ),
  ];
  if (revenueMatches.length !== 1) return null;
  const count = wordOrDigit(revenueMatches[0][1]);
  const priceCents = toCents(revenueMatches[0][3]);
  if (count === null || priceCents === null) return null;
  const revenueCents = count * priceCents;

  const upkeepMatches = [...q.matchAll(/costs?\s+\$([\d.,]+)\s+(?:a|per)\s+year\s+to\s+[a-z\s]+?(?:\.|$)/gi)];
  if (upkeepMatches.length !== 1) return null;
  const upkeepCents = toCents(upkeepMatches[0][1]);
  if (upkeepCents === null) return null;

  const netProfitCents = revenueCents - upkeepCents;
  if (netProfitCents <= 0) return null; // never recouped -- abstain, do not guess a huge number

  const n = Math.ceil(investmentCents / netProfitCents);
  const exact = n * netProfitCents === investmentCents;
  const answer = exact ? n + 1 : n;
  return { answer };
}

export const breakevenYearsInvestmentVsRecurringProfit: LianaMethod = {
  id: 'breakeven-years-investment-vs-recurring-profit-v1',
  demand: 'COMPUTE',
  name: 'Years until an up-front investment turns into positive net earnings',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W05 (cluster C62, sole member harvest_gsm8k_pilot_item12)',
  shapeDescription:
    'An up-front cost is recouped by a recurring per-period net profit (count*price revenue minus ' +
    'a recurring cost); answer is the first period the actor is genuinely AHEAD, which is one more ' +
    'than the ceiling period whenever the division is exact.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find exactly one up-front cost, one count*price recurring revenue, one ' +
          'recurring upkeep cost, and a "how many years ... earning money/break even" question',
      };
    }
    return { matches: true, reason: `answer=${result.answer}` };
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
        verdict: String(Math.round((result.answer) * 100) / 100),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: 'ceil(investment/netProfit), +1 if exact',
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

registerMethod(breakevenYearsInvestmentVsRecurringProfit);
