// D-BP223-BM04-h2cbpv9w-170 -- multi-item-cost-with-derived-price-relationship-sum-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W06).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\multi-item-cost-with-derived-price-relationship-sum-v1.candidate.ts
// Authored by generation wave W06 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W06.md),
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W06 CLUSTER C76 (1 member, sole member
 * harvest_gsm8k_pilot_item163_multi_step_word_problem_involving_cost_c). Representative teaching
 * case: GSM8K test.jsonl line 163 (red cars, action figures, and a doll).
 *
 * @generalShape An itemized list names two DIRECTLY-COUNTED item types (with quantities) plus one
 *   SINGLE (uncounted, i.e. introduced with "a"/"an" rather than a number) derived item type. Each
 *   directly-counted type's UNIT PRICE is given separately as "one/a(n) <item> cost(s) $X". The
 *   derived item's total cost is given as "<derived item> cost(s) as much as K <counted item>",
 *   i.e. K times that counted item's own unit price. Total = sum over the two counted types of
 *   (quantity * unit price), plus the derived item's cost.
 *
 * @recogniseInStranger Find the itemized list inside "toys:" (or a general "there are ... :"
 *   list clause), split on commas/"and". Each piece matching "<N> <noun phrase>" is a
 *   directly-counted item; each piece matching "a/an <noun phrase>" (no number) is the single
 *   derived item -- fire only when there are exactly two counted items and exactly one such
 *   uncounted item. Find each counted item's own unit price via "one/a(n) <noun> cost(s) $X",
 *   matched to the counted item by noun (singularised, last word). Find the relationship clause
 *   "<derived noun> cost(s) as much as <K> <counted noun>" and resolve <K> * that counted item's
 *   unit price as the derived item's total cost.
 *
 * @whatBreaksIt (a) more or fewer than two counted item types, or more than one uncounted item;
 *   (b) a unit price that cannot be matched to a counted item by noun; (c) a relationship clause
 *   that references a counted item this candidate could not itself price; (d) any percentage,
 *   discount, or "each" is ambiguous -- rate wording other than the bare "one/a(n) X cost(s) $Y"
 *   form is out of scope and left unmatched.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Any guard
 *   failing (wrong item-type counts, an unresolved unit price, an unresolved relationship clause,
 *   a non-finite total) makes the method ABSTAIN: verdict null, abstain true. Gate 1 (own
 *   generating question, GSM8K line 163): SOLVED, verdict 50, matching the corpus's own "#### 50".
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'multi-item-cost-with-derived-price-relationship-sum-v1';

const NUM_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const WORD_TO_NUM: Record<string, number> = {};
NUM_WORDS.forEach((w, i) => { WORD_TO_NUM[w] = i; });

function parseNum(tok: string): number | null {
  if (/^\d+(?:\.\d+)?$/.test(tok)) return parseFloat(tok);
  const v = WORD_TO_NUM[tok.toLowerCase()];
  return v === undefined ? null : v;
}

function singular(w: string): string {
  return w.replace(/s$/, '');
}

function nounKey(nounPhrase: string): string {
  return singular(nounPhrase.trim().split(/\s+/).pop() as string);
}

const LIST_RE = /(?:toys|items?):\s*(.+?)\./i;
const UNITPRICE_RE = /\b(?:one|a|an)\s+([a-z]+(?:\s+[a-z]+)?)\s+cost(?:s)?\s+\$?(\d+(?:\.\d+)?)/gi;
const REL_RE = /\bthe\s+([a-z]+)\s+cost\s+as\s+much\s+as\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+([a-z]+(?:\s+[a-z]+)?)/i;

interface CountedItem { noun: string; qty: number }

interface Analyzed {
  total: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const lm = LIST_RE.exec(q);
  if (!lm) return null;
  const pieces = lm[1].split(/,\s*(?:and\s+)?|\s+and\s+/i).map((s) => s.trim()).filter(Boolean);

  const counted: CountedItem[] = [];
  let uncounted: string | null = null;
  for (const p of pieces) {
    let m = /^(\d+)\s+(.+)$/.exec(p);
    if (m) { counted.push({ noun: m[2].trim(), qty: parseInt(m[1], 10) }); continue; }
    m = /^(?:a|an)\s+(.+)$/i.exec(p);
    if (m) {
      if (uncounted !== null) return null; // more than one uncounted item -- ambiguous
      uncounted = m[1].trim();
      continue;
    }
    return null; // a list piece this candidate cannot parse -- a stranger shape
  }
  if (counted.length !== 2 || uncounted === null) return null;

  const prices: { noun: string; price: number }[] = [];
  let m2: RegExpExecArray | null;
  UNITPRICE_RE.lastIndex = 0;
  while ((m2 = UNITPRICE_RE.exec(q))) {
    prices.push({ noun: m2[1].trim(), price: parseFloat(m2[2]) });
  }

  function findPrice(nounPhrase: string): number | null {
    const key = nounKey(nounPhrase);
    const found = prices.find((p) => nounKey(p.noun) === key);
    return found ? found.price : null;
  }

  let total = 0;
  for (const item of counted) {
    const price = findPrice(item.noun);
    if (price === null) return null;
    total += item.qty * price;
  }

  const rm = REL_RE.exec(q);
  if (!rm) return null;
  const derivedNoun = rm[1];
  if (nounKey(derivedNoun) !== nounKey(uncounted)) return null; // relationship must name the
  // same single item the list itself introduced
  const multiplier = parseNum(rm[2]);
  if (multiplier === null) return null;
  const refPrice = findPrice(rm[3]);
  if (refPrice === null) return null;

  total += multiplier * refPrice;
  if (!Number.isFinite(total)) return null;

  return { total };
}

export const multiItemCostWithDerivedPriceRelationshipSum: LianaMethod = {
  id: 'multi-item-cost-with-derived-price-relationship-sum-v1',
  demand: 'COMPUTE',
  name: 'Two counted item types priced directly, one derived item priced as a multiple of one of them, summed',
  taughtBy:
    'D-BP223-BM04-h2cbpv9w-170/WAVE W06 (cluster C76, representative harvest_gsm8k_pilot_item163)',
  shapeDescription:
    'Two directly-counted item types with their own unit prices, plus one single derived item ' +
    'whose total cost equals a stated multiple of one counted type\'s unit price; sum all three.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find exactly two directly-counted item types plus one single derived item ' +
          'with a resolvable unit-price relationship to one of the counted types; abstaining ' +
          'rather than guessing',
      };
    }
    return { matches: true, reason: `total=${result.total}` };
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
            basis: `sum of two counted-item totals plus the derived item's cost = ${result.total}`,
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

registerMethod(multiItemCostWithDerivedPriceRelationshipSum);
