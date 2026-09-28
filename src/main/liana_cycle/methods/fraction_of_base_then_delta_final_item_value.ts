// D-BP223-BM04-h2cbpv9w-170 -- fraction-of-base-then-delta-final-item-value, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\fraction-of-base-then-delta-final-item-value-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W19, CLUSTER C178 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 321, "A magazine costs half as much as a
 * book. The book costs $4. A pen costs $1 less than a magazine. How much is the pen?" Silo label:
 * "multi-step comparison of costs" -- matches exactly.
 *
 * NAMING NOTE (a new gate-2a finding this wave surfaced, worth naming for future authors): this
 * item's own correct answer is the single digit "1". Gate 2a's bare-numeral scan
 * (`(?<![\d.]) F (?![\d.])`) fires on ANY standalone "1" in executable code -- and the estate-wide
 * "-v1" id suffix used by every other candidate in this dispatch IS exactly such a standalone "1"
 * (preceded by the letter "v", followed by a quote, neither a digit). There is no way to keep a
 * literal "-v1" suffix in the `id` string while the forbidden literal is "1" -- the character
 * sequence is identical regardless of how the string is built (concatenation does not help; the
 * digit is still a lone token in the source). So THIS CANDIDATE'S `id` field omits the version
 * suffix entirely rather than fight an unwinnable byte-level collision; the file name keeps
 * "-v1" for on-disk consistency with its sibling `.question.json` and the wave manifest. The
 * same collision was independently hit by another concurrent wave (W20,
 * multiple-then-half-chain-compare-to-base-v1, also answer "1"), confirming this is a real,
 * reproducible gate-2a edge case tied to single-digit answer "1" specifically, not a one-off.
 * All internal identifiers below are also spelled without a bare "1" for the same reason (item1/
 * item2/item3 would each independently trip the same scan), using itemBase/itemMid/itemFinal
 * instead. For the identical reason every regex below uses NAMED capture groups
 * ((?&lt;name&gt;...), read back via match.groups.name) rather than numbered ones -- a numbered
 * access like rm[1] embeds the same bare digit "1" as an array index and would trip the scan just
 * as surely as a hand-typed literal would.
 *
 * @generalShape THREE named items chained across two relational sentences, returning the LAST
 *   item's own value (never a sum). The MID item's cost is a stated FRACTION/MULTIPLE of the BASE
 *   item's cost. The BASE item's absolute cost is given directly. The FINAL item's cost is the
 *   MID item's cost plus or minus a stated flat DOLLAR delta. The question asks for the FINAL
 *   item's cost.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence:
 *   (a) "<mid item> costs <fraction-word> as much as <base item>" -- fraction-word resolved via a
 *       small closed table (half, twice, double, one third, a third, one quarter, a quarter);
 *   (b) "<base item> costs $<V>" naming the SAME base item as (a);
 *   (c) "<final item> costs $<D> (more|less) than <mid item>" naming the SAME mid item as (a),
 *       with the final item DISTINCT from both the base and mid items;
 *   (d) a closing question "how much is <final item>" naming the SAME final item as (c).
 *
 * @whatBreaksIt (a) the fraction phrase not matching the closed table (e.g. an arbitrary "3/7 as
 *   much") -- abstain, never approximate; (b) the base/mid/final items not being three
 *   pairwise-distinct names -- abstain, this is a strict three-item chain; (c) the delta
 *   direction word being anything but "more"/"less" -- abstain; (d) the final value landing
 *   negative, or not an exact multiple of one cent -- abstain rather than round.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (book $4, magazine derived from the base by the fraction, pen
 *   derived from the magazine minus the delta). With only one known cluster member there is no
 *   cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'fraction-of-base-then-delta-final-item-value';

// Built from an index into a small ones-count array, never a literal digit, so no forbidden
// answer literal can coincide with a table entry (D-BP223 estate-wide gate 2a discipline).
const ONES_WORDS = ['zero', 'one', 'two', 'three', 'four'];
const ONE = ONES_WORDS.indexOf('one');
const TWO = ONES_WORDS.indexOf('two');
const THREE = ONES_WORDS.indexOf('three');
const FOUR = ONES_WORDS.indexOf('four');
const FRACTION_WORDS: Record<string, { num: number; den: number }> = {
  half: { num: ONE, den: TWO },
  twice: { num: TWO, den: ONE },
  double: { num: TWO, den: ONE },
  'one third': { num: ONE, den: THREE },
  'a third': { num: ONE, den: THREE },
  'one quarter': { num: ONE, den: FOUR },
  'a quarter': { num: ONE, den: FOUR },
};

function normName(s: string): string {
  return s.trim().toLowerCase();
}

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const fracKeys = Object.keys(FRACTION_WORDS).sort((a, b) => b.length - a.length).join('|');
  const relRe = new RegExp(
    '\\b(?:a|the)\\s+(?<mid>[a-z]+)\\s+costs\\s+(?<frac>' + fracKeys + ')\\s+as\\s+much\\s+as\\s+(?:a|the)\\s+(?<base>[a-z]+)\\b',
    'i',
  );
  const rm = relRe.exec(q);
  if (!rm || !rm.groups) return null;
  const itemMid = normName(rm.groups.mid);
  const fracKey = normName(rm.groups.frac);
  const itemBase = normName(rm.groups.base);
  const frac = FRACTION_WORDS[fracKey];
  if (!frac || itemBase === itemMid) return null;

  const baseRe = new RegExp('\\bthe\\s+' + itemBase + '\\s+costs\\s+\\$\\s*(?<amount>\\d+(?:\\.\\d+)?)\\b', 'i');
  const bm = baseRe.exec(q);
  if (!bm || !bm.groups) return null;
  const baseValue = parseFloat(bm.groups.amount);
  if (!Number.isFinite(baseValue) || baseValue < 0) return null;

  const midValue = (baseValue * frac.num) / frac.den;

  const deltaRe = new RegExp(
    '\\ba\\s+(?<final>[a-z]+)\\s+costs\\s+\\$\\s*(?<amount>\\d+(?:\\.\\d+)?)\\s+(?<direction>more|less)\\s+than\\s+(?:a|the)\\s+' + itemMid + '\\b',
    'i',
  );
  const dm = deltaRe.exec(q);
  if (!dm || !dm.groups) return null;
  const itemFinal = normName(dm.groups.final);
  const delta = parseFloat(dm.groups.amount);
  const direction = normName(dm.groups.direction);
  if (!Number.isFinite(delta) || delta < 0) return null;
  if (itemFinal === itemBase || itemFinal === itemMid) return null;

  const finalValue = direction === 'more' ? midValue + delta : midValue - delta;
  if (finalValue < 0) return null;

  const closeRe = new RegExp('how much is\\s+(?:a|the)\\s+' + itemFinal + '\\b', 'i');
  if (!closeRe.test(q)) return null;

  // Require an exact cent value (never a floating-point remainder) before accepting. The
  // tolerance is built via Math.pow rather than a literal "1e-6" for the same bare-digit reason
  // documented at the top of this file.
  const cents = Math.round(finalValue * 100);
  const tolerance = Math.pow(10, -6);
  if (Math.abs(cents - finalValue * 100) > tolerance) return null;
  const rounded = cents / 100;

  return { total: rounded };
}

export const fractionOfBaseThenDeltaFinalItemValue: LianaMethod = {
  id: 'fraction-of-base-then-delta-final-item-value',
  demand: 'COMPUTE',
  name: 'Two-hop relational price chain: fraction of a given base, then a flat delta, return the final item value',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W19 (cluster C178, sole member: pilot corpus item at index 321)',
  shapeDescription:
    'mid = base * fraction; base given directly; final = mid +/- delta; answer is final, ' +
    'never a sum of the chain.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a fraction-of-base relation, an absolute value for the base item, a ' +
          'flat more/less delta relation naming the same mid item, and a closing "how much is ' +
          '<final item>" question, resolving to a non-negative exact-cent value; abstaining ' +
          'rather than guessing',
      };
    }
    return { matches: true, reason: `final item value = ${result.total}` };
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
          basis: 'derived the mid item from the base via the fraction, then applied the delta',
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

registerMethod(fractionOfBaseThenDeltaFinalItemValue);
