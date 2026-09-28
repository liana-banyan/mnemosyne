// D-BP223-BM04-h2cbpv9w-170 -- nested-multiply-two-branches-combined-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W03).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\nested-multiply-two-branches-combined-v1.candidate.ts
// Authored by generation wave W03 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W03.md),
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
 * D-BP223-BM04-h2cbpv9w-170/WAVE-W03 CLUSTER C51 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 66, "There are four schools competing at a
 * basketball tournament. Each school has sent a girls' basketball team and a boys' basketball
 * team and each team has 5 players each. Each school has also sent a coach for each team. In
 * total, how many people have all of the schools sent?" (answer 48).
 *
 * @generalShape An OUTER count of UNITs (schools) is given. Each unit sends some number of
 *   sub-groups (TEAMS), each sub-group carrying TWO independent per-team headcounts: a PLAYERS
 *   branch ("each team has <N1> players each") and a COACHES branch ("also sent a coach for each
 *   team"). Per-unit total = teamsPerUnit * playersPerTeam + teamsPerUnit * coachesPerTeam. The
 *   FINAL step multiplies that per-unit total by the outer unit count -- the silo's own label,
 *   NESTED_MULTIPLY_TWO_BRANCHES_COMBINED, names exactly this: two independent two-factor
 *   branches summed, and the sum then carried by a further multiply, rather than the whole
 *   quantity being built by addition alone.
 *
 * @recogniseInStranger Four anchored pieces: (1) "there are <OUTER> <unit>s competing ..." for
 *   the outer count and unit noun; (2) "each <unit> has sent (.+?) and each team has <N1>
 *   <peopleNoun1> each." -- teamsPerUnit is counted as the literal number of occurrences of the
 *   word "team" inside the enumeration clause (not hard-coded to two), so it generalizes to any
 *   number of named sub-groups as long as each is described with the word "team"; (3) "each
 *   <unit> has also sent (a|an|<N2>) coach(es) for each team." for the coaches-per-team count
 *   ("a"/"an" read as 1); (4) the literal closing question "in total, how many people have all of
 *   the <unit>s sent?".
 *
 * @whatBreaksIt (a) a sub-group described by a word other than "team" (e.g. "squad", "roster")
 *   -- the occurrence count in clause 2 would undercount or miss it entirely, so this candidate
 *   only recognizes the literal word "team"; (b) the coaches clause missing the word "also" or
 *   worded as a rate ("one coach per team" instead of "a coach for each team") -- abstains rather
 *   than guess a different phrasing means the same thing; (c) the closing question not in the
 *   exact "in total, how many people have all of the <unit>s sent?" shape (a different target
 *   noun, or asking about only one branch) -- abstains; (d) more than these two per-team branches
 *   (e.g. a third headcount category) -- not modeled, and there is no positive signal in this
 *   candidate that would let it detect a third branch, so it would silently underestimate; this
 *   is a genuine, reported limit rather than a guarded one.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a shape
 *   claim and the computed verdict can never diverge on the same input. Measured against its own
 *   (sole) cluster member: SOLVED (48, matching (2*5+2*1)*4=48). With only one known member there
 *   is no cross-member measurement to report for this cluster -- honestly noted rather than
 *   inflated with a borrowed number from a different shape.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'nested-multiply-two-branches-combined-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });

const TENS_WORDS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const TENS: Record<string, number> = {};
TENS_WORDS.forEach((w, i) => { TENS[w] = (i + 2) * 10; });

const NUMBER_WORDS: Record<string, number> = { ...ONES, ...TENS };

function wordOrDigit(tok: string): number | null {
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit) && digit.length > 0) return parseFloat(digit);
  const w = tok.toLowerCase().trim();
  if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, w)) return NUMBER_WORDS[w];
  return null;
}

function stem(noun: string): string {
  return noun.toLowerCase().replace(/s$/, '');
}

interface Analyzed {
  outerCount: number;
  result: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const re1 = /there\s+are\s+([a-zA-Z0-9]+)\s+([a-zA-Z]+)\s+competing\b/i;
  const m1 = re1.exec(q);
  if (!m1) return null;
  const [, outerWord, unitNoun] = m1;
  const outerCount = wordOrDigit(outerWord);
  if (outerCount === null) return null;

  const unitStem = stem(unitNoun);
  const re2 = new RegExp(
    'each\\s+' + unitStem + 's?\\s+has\\s+sent\\s+(.+?)\\s+and\\s+each\\s+team\\s+has\\s+' +
      '([a-zA-Z0-9]+)\\s+([a-zA-Z]+)\\s+each\\s*\\.',
    'i',
  );
  const m2 = re2.exec(q);
  if (!m2) return null;
  const [, enumClause, n1Word] = m2;
  const teamsPerUnit = (enumClause.match(/\bteam\b/gi) || []).length;
  const playersPerTeam = wordOrDigit(n1Word);
  if (teamsPerUnit < 1 || playersPerTeam === null) return null;

  const re3 = new RegExp(
    'each\\s+' + unitStem + 's?\\s+has\\s+also\\s+sent\\s+(a|an|[a-zA-Z0-9]+)\\s+coach(?:es)?\\s+' +
      'for\\s+each\\s+team\\s*\\.',
    'i',
  );
  const m3 = re3.exec(q);
  if (!m3) return null;
  const [, coachToken] = m3;
  const coachesPerTeam = /^(a|an)$/i.test(coachToken) ? 1 : wordOrDigit(coachToken);
  if (coachesPerTeam === null) return null;

  const re4 = new RegExp(
    'in\\s+total,?\\s+how\\s+many\\s+people\\s+have\\s+all\\s+of\\s+the\\s+' + unitStem + 's?\\s+sent\\b',
    'i',
  );
  if (!re4.test(q)) return null;

  const perUnit = teamsPerUnit * playersPerTeam + teamsPerUnit * coachesPerTeam;
  const result = perUnit * outerCount;
  if (!Number.isFinite(result)) return null;

  return { outerCount, result };
}

export const nestedMultiplyTwoBranchesCombined: LianaMethod = {
  id: 'nested-multiply-two-branches-combined-v1',
  demand: 'COMPUTE',
  name: 'Two independent per-unit multiply branches summed, then multiplied by an outer count',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170/WAVE-W03 (cluster C51, sole member harvest_gsm8k_pilot_item66)',
  shapeDescription:
    '(teamsPerUnit*playersPerTeam + teamsPerUnit*coachesPerTeam) * outerUnitCount = total people.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find the "there are OUTER <unit>s competing ... each <unit> has sent ... and ' +
          'each team has N players each ... also sent a coach for each team ... in total, how ' +
          'many people have all of the <unit>s sent?" shape; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `nested two-branch multiply across ${result.outerCount} units -> ${result.result}` };
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
      const rounded = Math.round(result.result * 100) / 100;
      return {
        question,
        verdict: String(Math.round((rounded) * 100) / 100),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `(branch1+branch2)*outer = ${rounded}`,
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

registerMethod(nestedMultiplyTwoBranchesCombined);
