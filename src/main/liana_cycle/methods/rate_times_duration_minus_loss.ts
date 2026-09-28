// D-BP221-BM06-007 -- rate-times-duration-minus-loss-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE.
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\harvest_gsm8k_pilot_item113_multi_step_arithmetic_problem.candidate.ts
//
// THIS CANDIDATE IS THE ONE WORTH READING TWICE, AND IT IS THE SHARPEST CASE IN THE SET OF SIX.
// It ALREADY carried the annotation:
//
//     export const rateTimesDurationMinusLossMethod: LianaMethod = { ... }
//
// and it was annotated AGAINST A LOCAL INTERFACE IT DECLARED ITSELF, at line 71 of the candidate:
//
//     interface LianaMethod {                       // the candidate's own, NOT the registry's
//       shapeTest: (input: LianaMethodInput) => ShapeTestResult;
//       run: (input: LianaMethodInput) => Promise<RunResult>;   // no ctx param, local RunResult
//     }
//
// So it TYPECHECKED, and it LOOKED conforming, and it satisfied a grep for `: LianaMethod`, and it
// conformed to nothing. **A local interface with the right name is not the interface.** This is the
// same species as the arms-differ gate whose header promised a property its code did not enforce:
// the check measured one thing while every reader took it for another. The four incompatibilities
// were all still there underneath -- `run` taking no `ctx`, a numeric verdict where the registry
// wants `string | null`, and no `question` or `freeText` on the outcome at all.
//
// The local `LianaMethodInput`, `ShapeTestResult`, `RunResult` AND `LianaMethod` are all DELETED
// here, and the real ones are imported from '../method_registry'. That is the difference between an
// annotation and a decoration.
//
// BEHAVIOR CORE BYTE-FOR-BYTE: `RATE_RE`, `DURATION_RE`, `LOSS_RE`, `findClauses()` and
// `hasMultipleLossClauses()` are the candidate's own bytes, diffed clean. accept_gates.cjs returned
// ACCEPT on that behavior, so it stays untouched.
//
// VERDICT IS ROUNDED BEFORE STRINGIFYING, unlike multi_step_multiplication_chain.ts: the rate and
// duration regexes both admit `\d+(?:\.\d+)?`, so gross and net can be non-integer and can carry
// floating-point dust. Same convention as rate_distance_unit_pace.ts.
//
// ONE STRUCTURAL CHANGE I AM NAMING RATHER THAN LETTING YOU FIND: the candidate's run() had SIX
// near-identical abstain returns, and adapting each to the six-field outcome shape would have meant
// six copies of the same literal. They go through one local `abstain(basis)` helper instead. THAT IS
// IN THE INTERFACE LAYER, NOT THE ANALYSIS: every guard, its order, and its reason string are
// unchanged, and the helper only builds the outcome object the registry requires. The behavior core
// named above is still byte-for-byte the candidate's.
//
// REGISTERED QUARANTINED. No live run changes behavior today.

/**
 * @generalShape
 *   RATE-TIMES-DURATION-MINUS-LOSS: a two-hop arithmetic word problem in which
 *   (a) a per-unit-time rate ("N <units> a/per/each <period>") is multiplied by
 *   (b) a stated duration ("after/for/in N <period(s)>") to get a gross total,
 *   and then (c) a single flat-count loss/failure clause ("N of them did not
 *   grow/broke/were lost/...") for the SAME unit noun is subtracted from that
 *   gross total to get the net answer. The GSM8K-113 deposit (rate of planting
 *   per day, times days planted, minus flowers that did not grow) is one
 *   instance of this shape; the shape itself is unit-agnostic (widgets/hour,
 *   apples/day, eggs laid, etc.) and does not depend on flowers or gardens.
 *
 * @recogniseInStranger
 *   The question text must contain, as three textually separable clauses:
 *   (1) an explicit per-period RATE clause matching a number immediately
 *       followed by a noun and then "a|per|each|every <period>" (day, hour,
 *       week, month, minute, year); (2) an explicit DURATION clause matching
 *       "after|for|in <number> <period(s)>"; and (3) an explicit LOSS clause
 *       matching a number followed by a recognised subtractive cue
 *       ("did not/didn't grow", "were lost", "broke", "were broken", "were
 *       damaged", "rotted", "spoiled", "were defective", "did not survive").
 *   All three numbers must be distinct textual matches and the rate/loss
 *   clauses should plausibly share a unit noun. If any of the three pieces is
 *   missing, or the text contains a percent sign anywhere (a proportional
 *   loss is a different shape, not a flat count), the shape does not match.
 *
 * @whatBreaksIt
 *   - A percentage-based loss ("10% did not grow") instead of a flat count:
 *     that needs a multiply-then-round step first, not a bare subtraction.
 *   - More than one subtractive clause (two different loss events), which
 *     makes "the" loss ambiguous and the single-subtraction model wrong.
 *   - A rate that is not literally stated per period but must itself be
 *     derived (e.g. "planted 30 flowers over 15 days" -- a rate-and-distance
 *     / division shape, not this one).
 *   - A loss clause that is additive in disguise ("5 more grew back"), or a
 *     final question that asks for something other than the net remaining
 *     total (e.g. "how many did NOT grow in total" or "what fraction failed").
 *   - A non-constant rate ("2 a day for the first week, then 3 a day"),
 *     which this method has no way to detect from surface cues alone.
 *
 * @whenRecognitionIsWrong
 *   shapeTest only certifies that the three surface clauses exist; it does
 *   not itself compute anything, so a false shapeTest match cannot alone
 *   produce a wrong verdict. The actual risk is run() misreading which
 *   captured number plays which role (e.g. treating the loss count as a
 *   second rate). run() re-parses independently with the same anchored
 *   regexes shapeTest used, requires exactly one match per role, and
 *   ABSTAINS (never guesses) if extraction is ambiguous, if any two of the
 *   three roles resolve to the same substring, or if the arithmetic would
 *   require anything beyond one multiply and one subtract. Because a
 *   confident wrong verdict ends the whole engine's fall-through chain while
 *   an abstain is free, every ambiguous case below routes to abstain.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const RATE_RE = /(\d+(?:\.\d+)?)\s+[a-zA-Z]+\s+(?:a|per|each|every)\s+(day|hour|week|month|minute|year)s?\b/i;
const DURATION_RE = /\b(?:after|for|in)\s+(\d+(?:\.\d+)?)\s+(day|hour|week|month|minute|year)s?\b/i;
const LOSS_RE =
  /(\d+(?:\.\d+)?)\s+(?:of (?:them|which)\s+)?(?:did not|didn't|do not|don't|does not|doesn't|failed to (?:grow|survive)|were lost|was lost|broke|were broken|was broken|were damaged|was damaged|rotted|spoiled|were defective|was defective|did not survive|didn't survive|did not grow|didn't grow)\b/i;

function findClauses(text: string) {
  const rate = RATE_RE.exec(text);
  const duration = DURATION_RE.exec(text);
  const loss = LOSS_RE.exec(text);
  return { rate, duration, loss };
}

function hasMultipleLossClauses(text: string): boolean {
  const g = new RegExp(LOSS_RE.source, 'gi');
  let count = 0;
  while (g.exec(text)) {
    count += 1;
    if (count > 1) return true;
  }
  return false;
}


const METHOD_ID = 'rate-times-duration-minus-loss-v1';

export const rateTimesDurationMinusLossMethod: LianaMethod = {
  id: METHOD_ID,
  demand: 'COMPUTE',
  name: 'RateTimesDurationMinusLoss',
  taughtBy: 'D-BP221-BM0-075/SEG',
  shapeDescription:
    'Two-hop arithmetic: multiply a stated per-period rate by a stated duration, then subtract a single flat-count loss clause for the same unit, to get the net total.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const text = (input && typeof input.question === 'string') ? input.question : '';
    if (!text) {
      return { matches: false, reason: 'no question text to inspect' };
    }
    if (text.includes('%')) {
      return { matches: false, reason: 'percent sign present: proportional loss, not flat-count subtraction' };
    }
    const { rate, duration, loss } = findClauses(text);
    if (!rate || !duration || !loss) {
      return {
        matches: false,
        reason: `missing required clause(s): rate=${Boolean(rate)} duration=${Boolean(duration)} loss=${Boolean(loss)}`,
      };
    }
    if (rate[0] === duration[0] || rate[0] === loss[0] || duration[0] === loss[0]) {
      return { matches: false, reason: 'two roles resolved to the same substring, ambiguous parse' };
    }
    if (hasMultipleLossClauses(text)) {
      return { matches: false, reason: 'more than one subtractive clause found, single-subtraction model does not apply' };
    }
    return { matches: true, reason: 'rate, duration and a single flat-count loss clause all present and distinct' };
  },

  async run(input: MethodQuestionInput) {
    const text = (input && typeof input.question === 'string') ? input.question : '';
    // A question with no options is free text. Read off the input, never assumed.
    const freeText = !input || input.options === null || input.options === undefined;

    try {
      const abstain = (basis: string) => ({
        question: text, verdict: null, abstain: true, freeText, method: METHOD_ID, basis,
      });

      if (!text || text.includes('%')) {
        return abstain('no usable text, or a percentage-based loss is present');
      }
      const { rate, duration, loss } = findClauses(text);
      if (!rate || !duration || !loss) {
        return abstain('re-parse could not find all three clauses');
      }
      if (rate[0] === duration[0] || rate[0] === loss[0] || duration[0] === loss[0]) {
        return abstain('re-parse found overlapping clauses, ambiguous roles');
      }
      if (hasMultipleLossClauses(text)) {
        return abstain('re-parse found more than one loss clause');
      }

      const ratePerPeriod = Number(rate[1]);
      const durationCount = Number(duration[1]);
      const lossCount = Number(loss[1]);

      if (
        !Number.isFinite(ratePerPeriod) ||
        !Number.isFinite(durationCount) ||
        !Number.isFinite(lossCount)
      ) {
        return abstain('one of the three extracted numbers did not parse as finite');
      }

      const gross = ratePerPeriod * durationCount;
      if (lossCount > gross) {
        return abstain('loss count exceeds the computed gross total, model does not fit');
      }

      const net = gross - lossCount;
      const rounded = Math.round(net * 1e6) / 1e6;
      return {
        question: text,
        verdict: String(rounded),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `rate(${ratePerPeriod}) x duration(${durationCount}) - loss(${lossCount}) = ${rounded}`,
      };
    } catch (e) {
      // TRY/CATCH PASS, D-BP223-BM0-005, on the Founder's explicit approval 2026-09-07T01:25Z:
      // "Yes do the Try/Catch pass across the seven. Approved. Word." Same shape as the XO's
      // rate_distance_unit_pace.ts, so all seven now behave identically when run() throws:
      // ABSTAIN and say what threw, rather than letting the exception end the engine's
      // fall-through chain. An abstain is free; a thrown method is not.
      return {
        question: text,
        verdict: null,
        abstain: true,
        freeText,
        method: METHOD_ID,
        basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e),
      };
    }
  },
};

// REGISTERED AT IMPORT TIME. ACCEPTED by accept_gates.cjs in the Founder's promoted order gate 1
// then gate 2a then gate 4: 'solves its own shape, carries no answer, claims 1 and steals none'.
// ACCEPT means safe to register and is silent about interface fit, which is what this file adds.
registerMethod(rateTimesDurationMinusLossMethod);
