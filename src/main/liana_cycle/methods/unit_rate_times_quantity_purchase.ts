// D-BP223-BM04-h2cbpv9w-170 -- unit-rate-times-quantity-purchase-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR RUN R03
// (registration batch drawn from generation waves W11-W15).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\unit-rate-times-quantity-purchase-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W15, SHAPE 2 of 8: "unit rate times count", mined by frequency
 * over the frozen TUNING RESERVE (gsm8k-train half, 3685 items; never the held-out half).
 * Cue-word membership over the reserve: 245 of 3685 items match a loose keyword probe ("$N
 * per/each <unit>" plus a total/how-much cue). Representative teaching case: gsm8k-train-132
 * (tuning reserve), "James buys 5 packs of beef that are 4 pounds each. The price of beef is
 * $5.50 per pound. How much did he pay?" -- answer 110 (exact: 5*4*5.5 = 110), a three-factor
 * chain (packs -> pounds -> price-per-pound) this candidate's shapeTest is written to require
 * explicitly, not a generic "multiply everything" fallback.
 *
 * @generalShape A single per-unit RATE is stated ("$R per <unit>" or "$R each <unit>"), and a
 *   COUNT of that same unit is available either directly (a bare "N <unit>s") or via one
 *   intermediate multiplier stated as "<A> <container>s that are <B> <unit> each" (packs of
 *   pounds, boxes of items, etc). The closing question asks for the total amount paid/spent,
 *   which is rate times the (possibly two-factor) count.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) a rate sentence "\$R per <unit>"
 *   or "\$R each" naming a unit noun; (b) either (b1) a bare count "N <unit>s" of that SAME unit
 *   noun elsewhere in the question, or (b2) a two-factor count "A <container>s that are B <unit>
 *   each" naming the SAME unit noun as the rate; (c) a closing cue "how much did/does/will <X>
 *   pay/spend" (never "left"/"remain"/"percent"/"discount", which are different shapes).
 *
 * @whatBreaksIt (a) the unit noun in the rate sentence not matching (singular/plural-normalized)
 *   the unit noun in the count sentence -- abstain, cannot anchor which quantity the rate prices;
 *   (b) more than one rate sentence found -- abstain, ambiguous which rate the question wants;
 *   (c) a percent/discount/remainder cue anywhere -- abstain, a different shape; (d) the
 *   two-factor count's own numbers not being plain integers/decimals -- abstain.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass. Measured against
 *   its own representative teaching case (gsm8k-train-132, exact three-factor chain above):
 *   SOLVED (5 * 4 * 5.5 = 110). Reach across the wider tuning reserve is recorded in
 *   wave_manifest.json, not asserted here.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'unit-rate-times-quantity-purchase-v1';


// ROUND 2, on positive evidence from the tuning reserve (Rule 6). Round 1 measured 6 claims, 5
// wrong (16.7% reach); every failure carried a second multiplying/relational factor this
// candidate's simple rate*count never accounted for: "buy one get one free" (halves the
// effective paid quantity), a second actor's amount stated only as a multiple of the first
// ("twice as much gold"), a "times a day"/"per day" repetition factor, a "sections"-level
// container this candidate's two-factor parse does not resolve, and a promotional
// fraction-of-price adjustment. Widened the forbidden-word guard to abstain on all of them.
const FORBIDDEN_WORDS = /\b(percent|discount|off|save|saves|saved|left|remain|remaining|change|free|bogo|twice|thrice|half|third|quarter|times|section|sections|promotional|promotion|increase)\b|%|per\s+day|per\s+week|every\s+day|each\s+day/i;
const CLOSING_PAY_CUE = /how much (?:did|does|will|do)\s+[a-z' ]+\s+(?:pay|spend)\b/i;

function normalizeUnit(s: string): string {
  return s.toLowerCase().replace(/[.,]+$/, '').replace(/s$/, '');
}

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();
  if (FORBIDDEN_WORDS.test(q)) return null;
  if (!CLOSING_PAY_CUE.test(q)) return null;

  const rateRe = /\$(\d+(?:\.\d+)?)\s*(?:per|each)\s+([a-z]+)\b/gi;
  // POST-ROUND-3 HARDENING, on the wave's own GSM8K-1319 diagnostic: "the dinner plates cost
  // $6.00 EACH AND bowls each cost $5.00 ..." confidently answered 0 instead of abstaining --
  // the rate regex captured "$6.00 each and" as a spurious rate with unit noun "and" (a stopword,
  // never a real unit). A stopword filter on the captured noun fixes this at the source rather
  // than papering over the one failing item.
  const STOPWORDS = new Set(['and', 'the', 'a', 'an', 'is', 'of', 'to', 'in', 'on', 'with', 'or', 'but', 'for']);
  const rateMatches: { rate: number; unit: string }[] = [];
  let rm: RegExpExecArray | null;
  rateRe.lastIndex = 0;
  while ((rm = rateRe.exec(q)) !== null) {
    const unit = normalizeUnit(rm[2]);
    if (STOPWORDS.has(unit)) continue;
    rateMatches.push({ rate: parseFloat(rm[1]), unit });
  }
  if (rateMatches.length !== 1) return null;
  const { rate, unit } = rateMatches[0];

  // (b2) two-factor count: "A <container>s of <item> that are B <unit> each" (the intervening
  // "of <item>" clause is common -- "5 packs OF BEEF that are 4 pounds each"). Round 1 of this
  // candidate's own gate-1 pass found TWO real bugs on this exact teaching case, both fixed here:
  // (i) the first regex had no filler for the "of <item>" clause and never matched at all; (ii)
  // after widening the regex to two capture groups, the read-back used the wrong group index
  // (tf[3], which does not exist on a two-group match) so `b` was always NaN and execution fell
  // through to the bare-count branch anyway -- gate 1 WRONG (22 instead of 110) both times, for
  // two different reasons. Fixed to read tf[2], reproven below.
  const twoFactorRe = new RegExp(
    '(\\d+)\\s+[a-z]+\\s+of\\s+[a-z]+\\s+(?:that\\s+are|are)?\\s*(\\d+(?:\\.\\d+)?)\\s+' + unit + 's?\\s+each',
    'i',
  );
  const tf = twoFactorRe.exec(q);
  if (tf) {
    const a = parseFloat(tf[1]);
    const b = parseFloat(tf[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const total = Math.round(a * b * rate * 100) / 100;
      return { total };
    }
  }

  // (b1) bare count "N <unit>s" of the same unit, not part of the rate sentence itself.
  const bareCountRe = new RegExp('\\b(\\d+)\\s+' + unit + 's?\\b', 'gi');
  const counts: number[] = [];
  let cm: RegExpExecArray | null;
  bareCountRe.lastIndex = 0;
  while ((cm = bareCountRe.exec(q)) !== null) counts.push(parseFloat(cm[1]));
  if (counts.length !== 1) return null;
  const total = Math.round(counts[0] * rate * 100) / 100;
  return { total };
}

export const unitRateTimesQuantityPurchase: LianaMethod = {
  id: 'unit-rate-times-quantity-purchase-v1',
  demand: 'COMPUTE',
  name: 'Multiply a stated per-unit rate by a (possibly two-factor) count of that same unit',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W15 (shape 2 of 8, mined by frequency over the tuning reserve, 245/3685 keyword members)',
  shapeDescription:
    'A single "$R per/each <unit>" rate, a count of that same unit (bare, or a two-factor ' +
    '"A containers of B <unit> each" chain), and a closing "how much did/does X pay/spend" ' +
    'question -- answer is rate times count.',
  quarantined: true,

  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find exactly one per-unit rate anchored to a matching count of the same unit ' +
          'and a plain pay/spend closing question; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `rate * count = ${result.total}` };
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
      return { question, verdict: String(rounded), abstain: false, freeText, method: METHOD_ID, basis: 'multiplied the anchored rate by its matching count' };
    } catch (e) {
      return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e) };
    }
  },
};

registerMethod(unitRateTimesQuantityPurchase);
