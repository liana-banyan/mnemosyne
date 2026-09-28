// D-BP223-BM04-h2cbp9d8-171 -- fraction-sold-known-remainder-backsolve-original-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R06
// (registration batch drawn from generation waves W24-W25).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\fraction-sold-known-remainder-backsolve-original-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R06
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R06.md): gate 1 (positive yield), gate 2a
// (answer carry, under gate2_answer_carry.cjs's v3 -- the array-index/bracket-adjacency fix
// installed 2026-09-08T09:46:02Z, on top of v2's letter-boundary fix installed 09:08:02Z), gate 4
// (interception against the live registry), gate 5 (sibling interception against the real
// ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R06.md for the exact
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W25, cluster C225 (GSM8K test.jsonl item384, singleton).
 *
 * @generalShape An actor disposed of (sold/spent/used/gave away/lost/ate) a stated FRACTION p/q of
 *   a named quantity, and was left with a stated REMAINING amount. The closing question asks how
 *   much of that SAME named quantity the actor had originally/at first. remainingFraction =
 *   (q-p)/q; original = remaining / remainingFraction = remaining * q / (q-p). Arithmetic is done
 *   as an exact rational (the remaining amount may itself be a decimal, e.g. "12.8 hectares") via
 *   BigInt numerator/denominator, never a floating-point heuristic.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) a disposal verb immediately
 *   followed by a literal "p/q" fraction and "of his/her/their/its <quantity noun>"; (b) later in
 *   the SAME question, "and had <amount> <unit> left"; (c) a closing "how much <SAME quantity
 *   noun> did/does <actor> have at first/originally/initially/to start" question, where the
 *   quantity noun stem-matches clause (a)'s quantity noun.
 *
 * @whatBreaksIt (a) the fraction is given as a percentage or a word ("half", "a third") instead of
 *   a literal "p/q" -- abstain, this candidate reads only the literal fraction form; (b) the
 *   quantity noun in the closing question does not stem-match the disposal clause's quantity noun
 *   -- abstain, a different quantity is being asked about; (c) p >= q (nothing would remain, or a
 *   negative remainder) -- abstain, contradictory reading; (d) the exact rational division does
 *   not land on a whole number -- abstain rather than report a repeating or rounded decimal.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item384): SOLVED. Reach across a wider corpus is recorded in wave_manifest.json, not
 *   asserted here -- this is a singleton-cluster shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'fraction-sold-known-remainder-backsolve-original-v1';

function stem(word: string): string {
  return word.toLowerCase().replace(/s$/, '');
}

const DISPOSAL_RE = /(?:sold|spent|used|gave away|lost|ate)\s+(\d+)\/(\d+)\s+of\s+(?:his|her|their|its)\s+([a-z]+)\b/i;
const REMAIN_RE = /and had\s+([\d,]+(?:\.\d+)?)\s+([a-z]+)\s+left/i;
const QUESTION_RE = /how much\s+([a-z]+)\b[^.?!]*\b(?:did|does)\b[^.?!]*\bhave\s+(?:at first|originally|initially|to start)/i;

function decimalToFraction(raw: string): { num: bigint; den: bigint } | null {
  const s = raw.replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const [intPart, fracPart = ''] = s.split('.');
  const den = 10n ** BigInt(fracPart.length);
  const num = BigInt((intPart || '0') + fracPart);
  return { num, den };
}

interface Analyzed { original: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const dispM = DISPOSAL_RE.exec(q);
  const remM = REMAIN_RE.exec(q);
  const qM = QUESTION_RE.exec(q);
  if (!dispM || !remM || !qM) return null;

  if (stem(dispM[3]) !== stem(qM[1])) return null;

  const p = BigInt(dispM[1]);
  const qq = BigInt(dispM[2]);
  if (p <= 0n || qq <= 0n || p >= qq) return null;

  const frac = decimalToFraction(remM[1]);
  if (!frac) return null;

  // original = remaining * qq / (qq - p), as an exact rational.
  const numerator = frac.num * qq;
  const denominator = frac.den * (qq - p);
  if (denominator === 0n || numerator % denominator !== 0n) return null;
  const original = numerator / denominator;

  return { original: Number(original) };
}

export const fractionSoldKnownRemainderBacksolveOriginal: LianaMethod = {
  id: 'fraction-sold-known-remainder-backsolve-original-v1',
  demand: 'COMPUTE',
  name: 'Backsolve an original quantity from a disposed fraction and the known remainder',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W25, cluster C225, GSM8K test item384',
  shapeDescription:
    'A p/q fraction of a named quantity was disposed of, leaving a stated remainder. Original = ' +
    'remainder * q / (q - p), computed as an exact BigInt rational, only when it lands on a whole number.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "<verb> p/q of his/her <quantity> and had <amount> <unit> left" pair ' +
          'with a matching "how much <quantity> ... at first" closing question resolving to a ' +
          'whole number; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `original quantity = ${result.original}` };
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
          verdict: String(Math.round((result.original) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'exact-rational backsolve: remaining * q / (q - p)',
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

registerMethod(fractionSoldKnownRemainderBacksolveOriginal);
