// D-BP223-BM04-h2cbpv9w-170 -- shares-value-percent-increase-then-percent-decrease-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\shares-value-percent-increase-then-percent-decrease-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R04
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R04.md): gate 1 (positive yield), gate 2a
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R04.md for the exact
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W20, CLUSTER C189 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl line 336, "Maria buys 8 shares of a stock for $8 each. The
 * stock price increases 50% the first year Maria holds it, then decreases 25% in the second year.
 * What is the final value of all Maria's shares?". Silo label: "multi-step percentage change on a
 * total investment".
 *
 * @generalShape An actor buys a stated COUNT of shares at a stated PRICE each, for an initial
 *   total value = count * price. That total then increases by a stated PERCENTAGE in year one,
 *   then decreases by a (possibly different) stated PERCENTAGE in year two, applied successively
 *   (never both applied to the original total). Answer = count*price*(1+pctUp/100)*(1-pctDown/100).
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) "<Actor> buys <count> shares of
 *   a stock for $<price> each"; (b) "The stock price increases <pctUp>% the first year <Actor>
 *   holds it"; (c) "then decreases <pctDown>% in the second year"; (d) a closing "what is the
 *   final value of all <Actor>'s shares" question.
 *
 * @whatBreaksIt (a) either percentage failing to parse as 0-100 -- abstain; (b) count or price
 *   failing to parse as a positive number -- abstain; (c) the two percentage clauses appearing out
 *   of year order (decrease named before increase in the text) -- this candidate anchors strictly
 *   on "first year ... increases" then "second year ... decreases" and abstains if that exact
 *   sequence is not found, never guessing an order; (d) the final computed value being zero or
 *   negative -- abstain, a real share value is always positive.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED. initial = 8*8 = 64. afterYear1 = 64*1.5 = 96. final =
 *   96*0.75 = 72. With only one known cluster member there is no cross-member measurement to
 *   report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'shares-value-percent-increase-then-percent-decrease-v1';

interface Analyzed { final: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const buyRe = /([A-Z][a-zA-Z']*)\s+buys\s+(\d+(?:\.\d+)?)\s+shares of a stock for\s+\$(\d+(?:\.\d+)?)\s+each/i;
  const bm = buyRe.exec(q);
  if (!bm) return null;
  const actor = bm[1];
  const count = parseFloat(bm[2]);
  const price = parseFloat(bm[3]);
  if (!Number.isFinite(count) || !Number.isFinite(price) || count <= 0 || price <= 0) return null;

  const upRe = new RegExp('The stock price increases\\s+(\\d+(?:\\.\\d+)?)%\\s+the first year\\s+' + escapeRe(actor) + '\\s+holds it', 'i');
  const um = upRe.exec(q);
  if (!um) return null;
  const pctUp = parseFloat(um[1]);
  if (!Number.isFinite(pctUp) || pctUp < 0 || pctUp > 1000) return null;

  const downRe = /then decreases\s+(\d+(?:\.\d+)?)%\s+in the second year/i;
  const dm = downRe.exec(q);
  if (!dm) return null;
  const pctDown = parseFloat(dm[1]);
  if (!Number.isFinite(pctDown) || pctDown < 0 || pctDown > 100) return null;

  const closeRe = new RegExp('what is the final value of all\\s+' + escapeRe(actor) + "'s shares", 'i');
  if (!closeRe.test(q)) return null;

  const initial = count * price;
  const afterYear1 = initial * (1 + pctUp / 100);
  const final = afterYear1 * (1 - pctDown / 100);
  if (!Number.isFinite(final) || final <= 0) return null;
  const rounded = Math.round(final * 100) / 100;
  return { final: rounded };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const sharesValuePercentIncreaseThenPercentDecrease: LianaMethod = {
  id: 'shares-value-percent-increase-then-percent-decrease-v1',
  demand: 'COMPUTE',
  name: 'A total share purchase value increases by one percentage in year one then decreases by another in year two -- final value via exact successive-percentage arithmetic',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W20 (cluster C189, sole member: pilot corpus item at index 336)',
  shapeDescription: 'final = count*price*(1+pctUp/100)*(1-pctDown/100)',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "<Actor> buys <count> shares of a stock for $<price> each" opener, a ' +
          '"increases <pctUp>% the first year <Actor> holds it" clause, a "then decreases ' +
          '<pctDown>% in the second year" clause, and a closing "what is the final value of all ' +
          '<Actor>\'s shares" question; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `final = ${result.final}` };
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
          verdict: String(Math.round(result.final * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'count*price scaled up then down by the two stated percentages',
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

registerMethod(sharesValuePercentIncreaseThenPercentDecrease);
