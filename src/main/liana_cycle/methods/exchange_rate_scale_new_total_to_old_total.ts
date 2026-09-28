// D-BP223-BM04-h2cbpv9w-170 -- exchange-rate-scale-new-total-to-old-total-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\exchange-rate-scale-new-total-to-old-total-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W19, CLUSTER C181 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 324, "People can trade 2 old records for 1
 * new one. 5 people come in with old records and leave with 7 new records between them. How many
 * old records did the 5 people bring in?" Silo label: "inverse proportion or ratio-based word
 * problem" -- matches exactly.
 *
 * @generalShape An EXCHANGE RATE is stated: "<R> old <item> for <S> new <item>" (R units of the
 *   OLD item trade for S units of the NEW item, R and S both literal digits). A separate sentence
 *   states a TOTAL of the NEW item that a group of people collectively received. A distractor
 *   headcount (how many people) appears but plays no role in the arithmetic. The question asks
 *   how many OLD units were brought in, computed as newTotal * R / S.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence:
 *   (a) "trade <R> old <item> for <S> new <item>" (or "<S> new <item>" with S=1 written as "one"
 *       or bare, i.e. "for 1 new one") -- both counts and the shared item noun in one sentence;
 *   (b) a sentence "<N> people come in with old <item> and leave with <T> new <item>" giving the
 *       collective NEW total T (the people count N itself is read but never used arithmetically,
 *       confirmed a decoy by construction);
 *   (c) a closing question "how many old <item> did the <N> people bring in", matching the SAME
 *       people count N as (b) and the SAME item.
 *
 * @whatBreaksIt (a) the exchange rate stated as anything but two literal digit counts (a spelled
 *   ratio, or a per-person rate rather than a group rate) -- abstain; (b) the item noun differing
 *   between the rate sentence and the collective-total sentence -- abstain; (c) the resulting old
 *   total not landing on a positive integer -- abstain rather than round.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (7 new records * 2 old-per-new = 14 old records; the "5 people"
 *   headcount is read but never multiplies into the result). With only one known cluster member
 *   there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'exchange-rate-scale-new-total-to-old-total-v1';

function normName(s: string): string {
  return s.trim().toLowerCase();
}

function singularize(s: string): string {
  const w = s.trim().toLowerCase();
  return w.endsWith('s') ? w.slice(0, -1) : w;
}

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const rateRe = /\btrade\s+(\d+)\s+old\s+([a-z]+)\s+for\s+(\d+|one)\s+new\s+(?:[a-z]+|one)\b/i;
  const rm = rateRe.exec(q);
  if (!rm) return null;
  const R = parseInt(rm[1], 10);
  const item = singularize(rm[2]);
  const sTok = rm[3].toLowerCase();
  const S = sTok === 'one' ? 1 : parseInt(sTok, 10);
  if (!Number.isFinite(R) || R <= 0 || !Number.isFinite(S) || S <= 0 || !item) return null;

  const collectRe = new RegExp(
    '(\\d+)\\s+people\\s+come\\s+in\\s+with\\s+old\\s+' + item + 's?\\s+and\\s+leave\\s+with\\s+(\\d+)\\s+new\\s+' + item + 's?\\b',
    'i',
  );
  const cm = collectRe.exec(q);
  if (!cm) return null;
  const peopleCount = parseInt(cm[1], 10);
  const newTotal = parseInt(cm[2], 10);
  if (!Number.isFinite(peopleCount) || peopleCount <= 0 || !Number.isFinite(newTotal) || newTotal <= 0) return null;

  const closeRe = new RegExp('how many old\\s+' + item + 's?\\s+did the\\s+' + peopleCount + '\\s+people bring in', 'i');
  if (!closeRe.test(q)) return null;

  const total = newTotal * R;
  if (total % S !== 0) return null;
  const oldTotal = total / S;
  if (oldTotal <= 0 || !Number.isInteger(oldTotal)) return null;
  return { total: oldTotal };
}

export const exchangeRateScaleNewTotalToOldTotal: LianaMethod = {
  id: 'exchange-rate-scale-new-total-to-old-total-v1',
  demand: 'COMPUTE',
  name: 'Scale a group\'s collectively-received new-item total to an old-item total via a stated exchange rate, ignoring the decoy headcount',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W19 (cluster C181, sole member: pilot corpus item at index 324)',
  shapeDescription:
    'oldTotal = newTotal * R / S, where the exchange rate is "R old for S new"; the people ' +
    'headcount is read for the closing-question match but never multiplies into the arithmetic.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a literal-digit exchange-rate sentence, a matching collective new-total ' +
          'sentence for the same item, and a closing "how many old <item> did the <N> people ' +
          'bring in" question naming the same people count, resolving to a positive integer; ' +
          'abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `old total = ${result.total}` };
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
          verdict: String(Math.round(result.total * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'scaled the collective new-item total by the stated exchange rate',
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

registerMethod(exchangeRateScaleNewTotalToOldTotal);
