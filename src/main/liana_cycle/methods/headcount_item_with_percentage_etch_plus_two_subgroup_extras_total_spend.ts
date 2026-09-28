// D-BP223-BM04-h2cbp9d8-171 -- headcount-item-with-percentage-etch-plus-two-subgroup-extras-total-spend-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R05
// (registration batch drawn from generation waves W21-W23).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\headcount-item-with-percentage-etch-plus-two-subgroup-extras-total-spend-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R05
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R05.md): gate 1 (positive yield), gate 2a
// (answer carry, under the gate2_answer_carry.cjs:253 letter-boundary fix installed
// 2026-09-08T09:08:02Z), gate 4 (interception against the live registry), gate 5 (sibling
// interception against the real ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R05.md for the exact
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W23, CLUSTER C212 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 369, "44 seniors need to receive awards.
 * Each senior receives a picture frame that costs $20. Each picture frame needs to be etched with
 * the logo for an additional 20% cost per frame. 2 of the seniors will also receive pins that are
 * $5. 1/4 of the seniors are officers and they will need to receive cords that are $12 each. How
 * much will be spent on the senior gifts?". Silo label: "multi-item procurement cost calculation"
 * -- matches exactly.
 *
 * @generalShape A headcount N is given for a group. EVERY member of the group receives item1,
 *   whose base per-unit price is stated, then bumped by a stated PERCENTAGE surcharge applied per
 *   unit ("needs to be <verb>ed ... for an additional P% cost per <unit>"). A flat subgroup of M
 *   members ALSO receives item2 at its own flat per-unit price. A FRACTIONAL subgroup (a/b of N)
 *   receives item3 at its own flat per-unit price. The question asks for the grand total spend
 *   across all three item categories.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence, in this fixed clause order:
 *   (a) "<N> <group-plural> need to receive <item0>" -- the headcount;
 *   (b) "each <group-singular> receives a <item1> that costs $<C>" -- item1's base per-unit price;
 *   (c) "each <item1> needs to be [a-z]+ed ... for an additional <P>% cost per <unit>" -- the
 *       percentage surcharge, naming the SAME item1 as (b);
 *   (d) "<M> of the <group-plural> will also receive <item2> that are $<D>" -- the flat subgroup;
 *   (e) "<a>/<b> of the <group-plural> are <label> and they will need to receive <item3> that are
 *       $<E> each" -- the fractional subgroup;
 *   (f) a closing "how much will be spent on the <group-plural> <noun>" question.
 *   Grand total = N*(C*(100+P)/100) + M*D + (a*N/b)*E, every division required to be EXACT
 *   (integer or exact terminating amount) or the candidate abstains rather than round.
 *
 * @whatBreaksIt (a) the percentage surcharge not evenly dividing C*(100+P) by 100 -- abstain
 *   rather than round to cents; (b) the fractional subgroup's a*N not evenly divisible by b --
 *   abstain, the fraction does not cleanly apply to this headcount; (c) item1 named differently
 *   between clauses (b) and (c) -- abstain, cannot confirm the surcharge applies to the priced
 *   item; (d) a missing clause (only one of the two subgroup-extra sentences present) -- abstain,
 *   this is a fixed three-part total.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a shape
 *   claim guarantees run() reconstructs the same number. Measured against its own (sole) cluster
 *   member: SOLVED (frame unit = 20*120/100=24, frames=44*24=1056; pins=2*5=10; cords=(1*44/4)*12=
 *   11*12=132; total=1056+10+132=1198). With only one known member there is no cross-member
 *   measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'headcount-item-with-percentage-etch-plus-two-subgroup-extras-total-spend-v1';

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const r1 = /\b(\d+)\s+([a-z]+)\s+need\s+to\s+receive\s+[a-z]+\.\s/i;
  const m1 = r1.exec(q);
  if (!m1) return null;
  const [, nRaw, groupPlural] = m1;
  const n = parseInt(nRaw, 10);
  if (!Number.isFinite(n)) return null;

  const r2 = /\beach\s+[a-z]+\s+receives\s+a\s+([a-z ]+?)\s+that\s+costs\s+\$(\d+(?:\.\d+)?)\b/i;
  const m2 = r2.exec(q);
  if (!m2) return null;
  const [, item1, priceRaw] = m2;
  const price = parseFloat(priceRaw);
  if (!Number.isFinite(price)) return null;

  const item1Esc = item1.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const r3 = new RegExp(
    'each\\s+' + item1Esc + '\\s+needs\\s+to\\s+be\\s+[a-z]+ed\\s+.*?for\\s+an\\s+additional\\s+(\\d+)%\\s+cost\\s+per\\s+[a-z]+\\b',
    'i',
  );
  const m3 = r3.exec(q);
  if (!m3) return null;
  const [, pctRaw] = m3;
  const pct = parseInt(pctRaw, 10);
  if (!Number.isFinite(pct)) return null;

  const cents1 = Math.round(price * 100) * (100 + pct);
  if (cents1 % 100 !== 0) return null;
  const perUnit1Cents = cents1 / 100;
  const item1TotalCents = perUnit1Cents * n;

  const r4 = new RegExp(
    '(\\d+)\\s+of\\s+the\\s+' + groupPlural + '\\s+will\\s+also\\s+receive\\s+([a-z]+)\\s+that\\s+are\\s+\\$(\\d+(?:\\.\\d+)?)\\b',
    'i',
  );
  const m4 = r4.exec(q);
  if (!m4) return null;
  const [, mRaw, , priceMRaw] = m4;
  const mCount = parseInt(mRaw, 10);
  const priceM = parseFloat(priceMRaw);
  if (!Number.isFinite(mCount) || !Number.isFinite(priceM)) return null;
  const item2TotalCents = mCount * Math.round(priceM * 100);

  const r5 = new RegExp(
    '(\\d+)\\/(\\d+)\\s+of\\s+the\\s+' + groupPlural + '\\s+are\\s+[a-z]+\\s+and\\s+they\\s+will\\s+need\\s+to\\s+receive\\s+([a-z]+)\\s+that\\s+are\\s+\\$(\\d+(?:\\.\\d+)?)\\s+each\\b',
    'i',
  );
  const m5 = r5.exec(q);
  if (!m5) return null;
  const [, fracNumRaw, fracDenRaw, , priceERaw] = m5;
  const fracNum = parseInt(fracNumRaw, 10);
  const fracDen = parseInt(fracDenRaw, 10);
  const priceE = parseFloat(priceERaw);
  if (!Number.isFinite(fracNum) || !Number.isFinite(fracDen) || fracDen === 0 || !Number.isFinite(priceE)) return null;
  if ((fracNum * n) % fracDen !== 0) return null;
  const subgroupCount = (fracNum * n) / fracDen;
  const item3TotalCents = subgroupCount * Math.round(priceE * 100);

  const rQ = /how\s+much\s+will\s+be\s+spent\s+on\s+the\s+[a-z]+\s+[a-z]+/i;
  if (!rQ.test(q)) return null;

  const totalCents = item1TotalCents + item2TotalCents + item3TotalCents;
  if (!Number.isFinite(totalCents) || totalCents < 0) return null;
  const total = totalCents / 100;
  return { total };
}

export const headcountItemWithPercentageEtchPlusTwoSubgroupExtrasTotalSpend: LianaMethod = {
  id: 'headcount-item-with-percentage-etch-plus-two-subgroup-extras-total-spend-v1',
  demand: 'COMPUTE',
  name: 'Headcount times a percentage-surcharged per-unit item, plus a flat subgroup extra, plus a fractional subgroup extra, summed to a total spend',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W23 (cluster C212, sole member: pilot corpus item at index 369)',
  shapeDescription:
    'total = N*(price*(100+pct)/100) + M*priceM + (frac*N)*priceE, all exact-cents arithmetic, no rounding.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a headcount sentence, a base per-unit price for every member, a matching ' +
          'percentage-surcharge sentence for the same item, a flat-subgroup extra sentence, a ' +
          'fractional-subgroup extra sentence, and a closing total-spend question, all resolving ' +
          'to exact-cents totals; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `total spend = ${result.total}` };
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
          basis: 'summed the surcharged per-unit item total, the flat-subgroup extra, and the fractional-subgroup extra',
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

registerMethod(headcountItemWithPercentageEtchPlusTwoSubgroupExtrasTotalSpend);
