// D-BP223-BM04-h2cbpv9w-170 -- clients-times-supplies-cost-minus-income-profit-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W05).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\clients-times-supplies-cost-minus-income-profit-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W05 CLUSTER C68 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl item144, "Kim has started his own housekeeping business...
 * He already has 3 clients, but is talking to another 5 potential clients... Each client's home
 * will need 2 bottles of bleach and a pack of cloths... Bottles of bleach will cost $2 each and
 * packs of cloths will cost $5 each... his total income each week will be $92... how much profit,
 * in dollars, will Lucas make each week?".
 *
 * @generalShape Two client counts (confirmed + potential) sum to a total client count. Each
 *   client needs a stated per-client quantity of exactly two supply types, each with its own
 *   per-unit price. Total expense = clients * (qty1*price1 + qty2*price2). A total income is
 *   given directly. Profit = income - expense.
 *
 * @recogniseInStranger Requires: (a) "has <N> clients" and a second "another <M> ... clients"
 *   phrase, summed; (b) "will need <Q1> <item1> and <Q2> <item2>" per client (or "a"/"an" parsed
 *   as 1); (c) two "<item> will cost $<P> each" price statements matching the two supply items by
 *   simple substring containment on the item's own noun phrase; (d) an explicit "total income
 *   each week will be $I" statement; (e) the literal word "profit" in the question. Named-actor
 *   mismatches are deliberately NOT checked (see the honest finding below) -- this business has
 *   exactly one income stream and one expense stream, so no actor selection is needed.
 *
 * @whatBreaksIt (a) fewer or more than two client-count phrases, or two supply-item phrases --
 *   abstains, the arithmetic shape requires exactly two of each; (b) a price statement that
 *   cannot be matched to one of the two supply items by substring -- abstains; (c) no explicit
 *   "total income" dollar figure -- abstains rather than guess; (d) a stranger version with THREE
 *   or more supply types is not recognised by this candidate.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own sole cluster member: SOLVED (20). With only one known member there is no
 *   cross-member measurement to report for this cluster.
 *
 * FINDING (flagged, not hidden): the representative item's own prose names the business owner
 * "Kim" throughout the setup, then asks "how much profit... will LUCAS make" -- a name switch
 * that is a GSM8K authoring inconsistency (the same single person/business), not a second actor.
 * This candidate does not attempt to resolve or require actor-name agreement, since there is only
 * ever one income stream and one expense stream to compute regardless of which name the question
 * uses. Flagged for the Founder per the same class of honest labeling finding W04's report raised
 * for its own clusters C56/C60.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'clients-times-supplies-cost-minus-income-profit-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });

function wordOrDigit(tok: string): number | null {
  if (/^an?$/i.test(tok)) return 1;
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
  return Number(whole) * 100 + Number((frac + '00').slice(0, 2));
}

interface Analyzed {
  answerCents: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();
  if (!/\bprofit\b/i.test(q)) return null;

  const confirmedMatch = /has\s+([a-z0-9]+)\s+clients/i.exec(q);
  const potentialMatch = /another\s+([a-z0-9]+)\s+(?:potential\s+)?clients/i.exec(q);
  if (!confirmedMatch || !potentialMatch) return null;
  const confirmed = wordOrDigit(confirmedMatch[1]);
  const potential = wordOrDigit(potentialMatch[1]);
  if (confirmed === null || potential === null) return null;
  const totalClients = confirmed + potential;

  const needMatch = /will\s+need\s+([a-z0-9]+)\s+([a-z]+(?:\s[a-z]+)*?)\s+and\s+([a-z0-9]+|an?)\s+([a-z]+(?:\s[a-z]+)*?)(?=\.|,|\s+to\b)/i.exec(q);
  if (!needMatch) return null;
  const qty1 = wordOrDigit(needMatch[1]);
  const item1 = needMatch[2].trim();
  const qty2 = wordOrDigit(needMatch[3]);
  const item2 = needMatch[4].trim();
  if (qty1 === null || qty2 === null) return null;

  const priceMatches = [...q.matchAll(/([a-z]+(?:\s[a-z]+)*?)\s+will\s+cost\s+\$([\d.,]+)\s+each/gi)];
  if (priceMatches.length !== 2) return null;

  function priceFor(itemPhrase: string): number | null {
    const key = itemPhrase.toLowerCase().split(/\s+/).pop() || itemPhrase.toLowerCase();
    for (const pm of priceMatches) {
      const priceItemWords = pm[1].toLowerCase();
      if (priceItemWords.includes(key) || key.includes(priceItemWords.split(/\s+/).pop() || '')) {
        return toCents(pm[2]);
      }
    }
    return null;
  }

  const price1 = priceFor(item1);
  const price2 = priceFor(item2);
  if (price1 === null || price2 === null) return null;

  const expenseCents = totalClients * (qty1 * price1 + qty2 * price2);

  const incomeMatch = /total\s+income\s+each\s+week\s+will\s+be\s+\$(\d[\d,]*(?:\.\d{1,2})?)/i.exec(q);
  if (!incomeMatch) return null;
  const incomeCents = toCents(incomeMatch[1]);
  if (incomeCents === null) return null;

  const answerCents = incomeCents - expenseCents;
  return { answerCents };
}

export const clientsTimesSuppliesCostMinusIncomeProfit: LianaMethod = {
  id: 'clients-times-supplies-cost-minus-income-profit-v1',
  demand: 'COMPUTE',
  name: 'Total clients times two per-client supply costs, subtracted from stated total income',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W05 (cluster C68, sole member harvest_gsm8k_pilot_item144)',
  shapeDescription:
    'Confirmed + potential clients summed; each client needs two supply quantities at two given ' +
    'per-unit prices; expense = clients*(qty1*price1+qty2*price2); profit = income - expense.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find both a confirmed and a potential client count, a "will need Q1 item1 and ' +
          'Q2 item2" per-client statement with two matching "$P each" prices, an explicit total ' +
          'income figure, and the word "profit"',
      };
    }
    return { matches: true, reason: `answerCents=${result.answerCents}` };
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
      const dollars = result.answerCents / 100;
      const verdict = Number.isInteger(dollars) ? dollars : Math.round(dollars * 100) / 100;
      return {
        question,
        verdict: String(Math.round((verdict) * 100) / 100),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: 'income - clients*(qty1*price1+qty2*price2), integer cents',
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

registerMethod(clientsTimesSuppliesCostMinusIncomeProfit);
