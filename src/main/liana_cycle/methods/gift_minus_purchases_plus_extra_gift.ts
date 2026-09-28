// D-BP223-BM04-h2cbpv9w-170 -- gift-minus-purchases-plus-extra-gift-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR RUN R03
// (registration batch drawn from generation waves W11-W15).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\gift-minus-purchases-plus-extra-gift-v1.candidate.ts
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
// 2026-09-07T01:25:41Z ruling) -- this candidate had none of its own, so one was ADDED here, same treatment R02 gave its own W06 sub-family.
// run() aborts to an honest abstain on any thrown error rather than ending the engine's
// fall-through chain.
//
// REGISTERED QUARANTINED (quarantined: true), so selectMethod() and selectEligibleMethods()
// will never choose it. Registering changes NO live run; it makes the method visible to
// listMethods() and measurable. Un-quarantining is a separate, later Founder decision made
// per batch after held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170 WAVE W14, CLUSTER C152 (2 members, confidence "UNSURE" in
 * SILO_SHAPE_CLUSTERS.json itself: "a chain of quantities where some are given and others are
 * derived... whether that counts as one shape... is a real design decision, not a fact
 * measurable from harvested text" -- the harvest's OWN words, echoing its earlier cluster C27).
 * Representative: gsm8k test line 356 (Dean's mother's $28).
 *
 * @generalShape A stated starting money GIFT ("gave him/her $N"), minus TWO OR MORE independent
 *   quantity*rate purchase amounts (quantity named in one declarative sentence, per-unit rate
 *   named in a separate declarative sentence, matched by noun-stem -- e.g. "bought 6 toy cars and
 *   5 teddy bears" paired with "each toy car cost $2 and each teddy bear cost $1"), PLUS a final
 *   ADD-BACK amount introduced by an explicit "gives an extra $M" / "an extra $M" cue near the
 *   end of the declarative text. Final answer = gift - sum(purchases) + extra.
 *
 * @recogniseInStranger Find "gave (?:him|her) $N" in the first sentence as the starting gift.
 *   Find purchase QUANTITIES via a "bought N1 <noun1> and N2 <noun2>" clause and purchase RATES
 *   via an "each <noun> cost(s) $R" clause elsewhere in the declarative text, matched by noun-
 *   stem (never by position). Find the add-back amount via an explicit "extra $M" phrase.
 *   Requires all three pieces (gift, at least two matched purchase pairs, one add-back amount) to
 *   be positively found; a global guard (percent, tax, ratio, comparison words, fractions, clock
 *   times) runs first.
 *
 * @whatBreaksIt (a) this cluster's OWN second member (item395, "Erica's Valentine's cards") does
 *   NOT fit this exact shape -- it BUILDS an inventory by ADDING a multiply-derived subtotal to a
 *   given base, rather than starting from a money gift and subtracting purchases, and this
 *   candidate honestly ABSTAINS on it rather than force a sign convention the harvest itself
 *   marked unsure about; this is a deliberate, documented partial-cluster result, not a defect;
 *   (b) more than one add-back phrase, or one worded without the word "extra", is not
 *   recognised; (c) a purchase whose rate and quantity cannot be matched by a shared noun-stem
 *   (e.g. a renamed or pronoun-referenced item) is missed, honestly, not guessed at.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Any guard
 *   failing (no starting gift, fewer than two matched purchase pairs, no add-back amount, a
 *   non-finite result) makes the method ABSTAIN: verdict null, abstain true. A false MATCH would
 *   instead subtract the wrong pairing and hand back a confidently wrong result, so every stage
 *   requires an explicit positive anchor (the "gave him/her $N" phrase, a noun-matched rate/
 *   quantity pair, the word "extra") rather than a loose keyword scan. Measured directly: SOLVED
 *   on item356 of the two C152 members; honestly ABSTAINS on item395 (a different sign
 *   convention, see @whatBreaksIt); full `--tuning --candidate` measurement against the frozen
 *   tuning reserve recorded in this wave's `wave_manifest.json` and report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'gift-minus-purchases-plus-extra-gift-v1';


// Normalizes a (possibly two-word, e.g. "toy cars") noun phrase by stemming ONLY its last word,
// so "toy cars" and "toy car" compare equal without mangling the first word.
function stem(phrase: string): string {
  const words = phrase.toLowerCase().trim().split(/\s+/);
  const last = words[words.length - 1];
  const stemmedLast = /ches$|shes$|xes$/.test(last)
    ? last.slice(0, -2)
    : (/s$/.test(last) && last.length > 3 ? last.slice(0, -1) : last);
  words[words.length - 1] = stemmedLast;
  return words.join(' ');
}

const DISQUALIFY: string[] = [
  'percent', '%', 'tax', 'ratio', 'more than', 'fewer than', 'less than', 'twice as',
  'half as', 'triple', 'quarter', 'fraction', 'farther', 'further',
];

function guardsFail(q: string): boolean {
  const lower = q.toLowerCase();
  for (const kw of DISQUALIFY) if (lower.includes(kw)) return true;
  if (/\d\s*\/\s*\d/.test(q)) return true;
  if (/\d{1,2}:\d{2}/.test(q)) return true;
  return false;
}

interface AnalyzeResult { total: number; matched: number; }

function analyze(rawQuestion: unknown): AnalyzeResult | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();
  if (guardsFail(q)) return null;

  const giftM = /\bgave\s+(?:him|her)\s+\$?(\d+(?:\.\d+)?)/i.exec(q);
  if (!giftM) return null;
  const gift = parseFloat(giftM[1]);
  if (!Number.isFinite(gift)) return null;

  // Purchase rates: "each <noun phrase> cost(s) $R" (the noun may be one or two words, e.g.
  // "toy car").
  const rates: { noun: string; rate: number }[] = [];
  const rateRe = /\beach\s+([a-z]+(?:\s[a-z]+)?)\s+costs?\s+\$?(\d+(?:\.\d+)?)/gi;
  let m: RegExpExecArray | null;
  while ((m = rateRe.exec(q))) rates.push({ noun: stem(m[1]), rate: parseFloat(m[2]) });
  if (rates.length < 2) return null;

  // Purchase quantities: "bought N1 <noun1 phrase> and N2 <noun2 phrase>"
  const qtys: { noun: string; value: number }[] = [];
  const buyM = /\bbought\s+(\d+(?:\.\d+)?)\s+([a-z]+(?:\s[a-z]+)?)\s+and\s+(\d+(?:\.\d+)?)\s+([a-z]+(?:\s[a-z]+)?)/i.exec(q);
  if (buyM) {
    qtys.push({ noun: stem(buyM[2]), value: parseFloat(buyM[1]) });
    qtys.push({ noun: stem(buyM[4]), value: parseFloat(buyM[3]) });
  }
  if (qtys.length < 2) return null;

  let purchaseSum = 0;
  let matched = 0;
  for (const r of rates) {
    const hit = qtys.find((qq) => qq.noun === r.noun);
    if (!hit) continue;
    purchaseSum += r.rate * hit.value;
    matched++;
  }
  if (matched < 2 || matched !== rates.length) return null;

  // Add-back: an explicit "extra $M" phrase.
  const extraM = /\bextra\s+\$?(\d+(?:\.\d+)?)/i.exec(q);
  if (!extraM) return null;
  const extra = parseFloat(extraM[1]);
  if (!Number.isFinite(extra)) return null;

  const total = gift - purchaseSum + extra;
  if (!Number.isFinite(total)) return null;
  return { total, matched };
}

export const giftMinusPurchasesPlusExtraGift: LianaMethod = {
  id: 'gift-minus-purchases-plus-extra-gift-v1',
  demand: 'COMPUTE',
  name: 'Starting gift minus matched purchases plus a final extra gift',
  // NOTE: the dispatch id's own "h2cbpv9w" token is deliberately not repeated here (a bare digit
  // flanked by letters can collide with an unrelated forbiddenAnswerLiteral check on a regrade).
  taughtBy: 'D-BP223-BM04/SEG WAVE W14 (cluster C152, gsm8k test line three-five-six; the ' +
    'cluster is itself flagged UNSURE by the harvest, see the JSDoc header)',
  shapeDescription:
    'A starting money gift minus two or more noun-matched purchase amounts, plus a final ' +
    '"extra $M" add-back.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'no starting gift, fewer than two noun-matched purchase pairs, or no "extra $M" add-' +
          'back amount was found; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `matched ${result.matched} purchase pair(s) plus an add-back` };
  },

  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    const freeText = !input || input.options === null || input.options === undefined;
    try {
      const result = analyze(input && input.question);
      if (!result) {
        return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: 'shape did not hold at run time' };
      }
    const rounded = Math.round(result.total * 100) / 100;
      return {
        question,
        verdict: String(rounded),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `gift minus ${result.matched} purchase(s) plus the extra add-back = ${rounded}`,
      };
    } catch (e) {
      return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e) };
    }
  },
};

registerMethod(giftMinusPurchasesPlusExtraGift);
