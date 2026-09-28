// D-BP223-BM04-h2cbpv9w-170 -- two-item-category-spend-difference-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR RUN R03
// (registration batch drawn from generation waves W11-W15).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\two-item-category-spend-difference-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W15, SHAPE 7 of 8 (ROUND 2 PIVOT): "difference of two
 * products". Round 1's design (two DIFFERENT actors, each independently buying at their own
 * rate -- see the abandoned sibling file two-actor-unit-count-product-difference-v1.candidate.ts,
 * kept per Rule 66, never deleted) measured ZERO-CLAIMS against the 4767-item tuning reserve.
 * Targeted keyword search on positive evidence ("how much more did [A-Z][a-z]+ (spend|pay)")
 * found the REAL dominant phrasing of this shape in the reserve: a SINGLE actor buying TWO
 * item categories at two different per-unit prices, asked how much more was spent on one
 * category than the other -- e.g. gsm8k-train-53, "Caleb bought 10 cartons of ice cream and 4
 * cartons of frozen yoghurt. Each carton of ice cream cost $4 and each carton of frozen yoghurt
 * cost $1. How much more did Caleb spend on ice cream than on frozen yoghurt?" (answer 36) and
 * gsm8k-train-3242 (Jane, ice cream cones vs pudding, answer 65). This candidate is authored to
 * that real, evidenced pattern, not the round-1 guess.
 *
 * @generalShape ONE actor buys two stated counts of two different item categories in one
 *   sentence ("<Actor> bought <N1> <item1> and <N2> <item2>"). A second sentence states each
 *   category's own per-unit price, in the SAME order ("Each <item1> cost $<R1> and each <item2>
 *   cost $<R2>"). The closing question asks how much MORE was spent on one named category than
 *   the other.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) a purchase sentence "<Actor>
 *   bought <N1> <phrase1> and <N2> <phrase2>"; (b) a price sentence "each <phrase> cost $<R1>
 *   and each <phrase> cost $<R2>", read POSITIONALLY (first price anchors the first-mentioned
 *   category, second price the second); (c) a closing "how much more did <Actor> spend on <X>
 *   than <Y>" (or "than on <Y>") where <X> and <Y> each share at least one significant word with
 *   one of the two purchased-category phrases, and <X>'s matched category is different from
 *   <Y>'s.
 *
 * @whatBreaksIt (a) the purchase sentence not stating exactly two counted categories -- abstain;
 *   (b) the price sentence not stating exactly two literal dollar prices in the same "each ...
 *   cost $R" form -- abstain; (c) either closing category phrase failing to share a significant
 *   word with either purchased category, or both matching the SAME category -- abstain, cannot
 *   resolve which product is which; (d) the computed "more" difference landing at zero or
 *   negative -- treated as a parse failure (wrong category attached to wrong price), not a valid
 *   answer, so this candidate abstains rather than report it.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass. Measured
 *   against its own representative teaching case (a clean two-category purchase + positional
 *   price template): SOLVED. Reach across the wider tuning reserve is recorded in
 *   wave_manifest.json, not asserted here.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'two-item-category-spend-difference-v1';


const PURCHASE_RE = /\b[A-Z][a-z]+\s+(?:bought|purchased|buys?)\s+(\d+)\s+([a-z]+(?:\s+[a-z]+){0,4}?)\s+and\s+(\d+)\s+([a-z]+(?:\s+[a-z]+){0,4}?)[.,]/i;
const PRICE_RE = /each\s+[a-z]+(?:\s+[a-z]+){0,4}?\s+cost\s*\$(\d+(?:\.\d+)?)\s+and\s+each\s+[a-z]+(?:\s+[a-z]+){0,4}?\s+cost\s*\$(\d+(?:\.\d+)?)/i;
const CLOSING_MORE_RE = /how much more (?:did|does)\s+[A-Z][a-z]+\s+spend\s+on\s+([a-z]+(?:\s+[a-z]+){0,4}?)\s+than\s+(?:on\s+)?([a-z]+(?:\s+[a-z]+){0,4}?)\??\s*$/i;

function significantWords(phrase: string): Set<string> {
  const stop = new Set(['the', 'a', 'an', 'of', 'and', 'to', 'in', 'on']);
  return new Set(
    phrase.toLowerCase().replace(/[.,?!]/g, '').split(/\s+/)
      .map((w) => w.replace(/s$/, ''))
      .filter((w) => w.length > 2 && !stop.has(w)),
  );
}

function shares(a: Set<string>, b: Set<string>): boolean {
  for (const w of a) if (b.has(w)) return true;
  return false;
}

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const pm = PURCHASE_RE.exec(q);
  if (!pm) return null;
  const n1 = parseFloat(pm[1]);
  const item1 = pm[2];
  const n2 = parseFloat(pm[3]);
  const item2 = pm[4];
  if (!Number.isFinite(n1) || !Number.isFinite(n2)) return null;

  const prm = PRICE_RE.exec(q);
  if (!prm) return null;
  const r1 = parseFloat(prm[1]);
  const r2 = parseFloat(prm[2]);
  if (!Number.isFinite(r1) || !Number.isFinite(r2)) return null;

  const total1 = n1 * r1;
  const total2 = n2 * r2;
  const set1 = significantWords(item1);
  const set2 = significantWords(item2);

  const cm = CLOSING_MORE_RE.exec(q);
  if (!cm) return null;
  const xSet = significantWords(cm[1]);
  const ySet = significantWords(cm[2]);

  const xIs1 = shares(xSet, set1);
  const xIs2 = shares(xSet, set2);
  const yIs1 = shares(ySet, set1);
  const yIs2 = shares(ySet, set2);

  let xTotal: number | null = null;
  let yTotal: number | null = null;
  if (xIs1 && !xIs2) xTotal = total1;
  else if (xIs2 && !xIs1) xTotal = total2;
  if (yIs1 && !yIs2) yTotal = total1;
  else if (yIs2 && !yIs1) yTotal = total2;

  if (xTotal === null || yTotal === null || xTotal === yTotal) return null;

  const diff = Math.round((xTotal - yTotal) * 100) / 100;
  if (diff <= 0) return null;
  return { total: diff };
}

export const twoItemCategorySpendDifference: LianaMethod = {
  id: 'two-item-category-spend-difference-v1',
  demand: 'COMPUTE',
  name: 'One actor buys two item categories at two per-unit prices; report how much more was spent on one category',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W15 (shape 7 of 8, round 2 pivot on positive evidence gsm8k-train-53/gsm8k-train-3242 from the tuning reserve)',
  shapeDescription:
    'A single actor buys two stated counts of two item categories in one sentence, a second ' +
    'sentence gives each category its own per-unit price in the same order, and a closing "how ' +
    'much more ... spent on X than Y" question resolves to the positive difference of the two ' +
    'count*rate products.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a two-category purchase sentence, a matching positional two-price ' +
          'sentence, and a closing "how much more spent on X than Y" question resolving to a ' +
          'positive difference; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `difference = ${result.total}` };
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
      return { question, verdict: String(rounded), abstain: false, freeText, method: METHOD_ID, basis: 'differenced the two count*rate products, resolved by shared-word match to the closing question' };
    } catch (e) {
      return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e) };
    }
  },
};

registerMethod(twoItemCategorySpendDifference);
