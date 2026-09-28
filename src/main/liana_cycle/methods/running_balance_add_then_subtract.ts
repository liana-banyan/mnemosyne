// D-BP223-BM04-h2cbpv9w-170 -- running-balance-add-then-subtract-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W03).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\running-balance-add-then-subtract-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170/WAVE-W03 CLUSTER C50 (4 silo members, medium confidence: 1 GSM8K +
 * 3 ASDiv degenerate-arity siblings). Representative teaching case (the GSM8K member, chosen as
 * this candidate's teaching case per this silo's own convention of a GSM8K-flavored
 * representative when one exists): GSM8K test.jsonl line 81, "Charlie had 10 stickers. He bought
 * 21 stickers from a store in the mall and got 23 stickers for his birthday. Then Charlie gave 9
 * of the stickers to his sister and used 28 to decorate a greeting card. How many stickers does
 * Charlie have left?" (answer 17).
 *
 * @generalShape An OWNER starts with a known quantity of one item. Zero or more GAIN clauses
 *   (bought/got/received/earned/found/added) and zero or more LOSS clauses
 *   (gave/used/lost/spent/sold/took) each add a known amount, in narrative order. The question
 *   asks how many the owner has LEFT. This is a FORWARD SIMULATION -- start + sum(gains) -
 *   sum(losses) -- never a back-solve against a stated final total (that is a different cluster,
 *   C48's algebra shape). The silo's own label is RUNNING_BALANCE_ADD_THEN_SUBTRACT, generalized
 *   here to N gains and M losses rather than a fixed count, since the cluster's own 3 ASDiv
 *   siblings are the simplest N=1-gain, N=1-loss degenerate case of the identical formula.
 *
 * @recogniseInStranger (1) an opening "<Owner> had <START> <item>." sentence naming the owner and
 *   item noun; (2) every GAIN-verb or LOSS-verb followed (not necessarily immediately) by a
 *   number, scanned across the REMAINDER of the text, summed per side; (3) a closing "how many
 *   <item> (does|do) <Owner> have left" question repeating the SAME owner name and item noun
 *   (stemmed). As a completeness safeguard, this candidate counts every standalone numeral (digit
 *   or number word) anywhere in the remainder text and REQUIRES that count to equal the number of
 *   gain/loss clauses it found -- a stray, unaccounted-for number anywhere is treated as evidence
 *   this text has a shape this candidate does not understand, and it abstains rather than risk
 *   silently dropping or double-counting a quantity.
 *
 * @whatBreaksIt (a) any comparative, rate or multiplicative language anywhere in the text
 *   ("more than", "fewer than", "twice", "half", "per", "each", "times") -- disqualifying,
 *   because those signal a different arithmetic shape (comparison or rate, not a running balance)
 *   even if a gain/loss verb also happens to appear; (b) a stray number not attached to a
 *   recognised gain/loss verb (e.g. a date, a price in a different unit, an unrelated count) --
 *   the completeness check above catches this and abstains; (c) the question asking for anything
 *   other than "how many <item> ... have left" (a total, a comparison, someone else's amount) --
 *   abstains; (d) a THIRD actor's action changing the owner's total (a transfer the owner did not
 *   themselves perform) -- not modeled by the fixed gain/loss verb list, so it is either missed
 *   entirely (triggering the completeness check) or wrongly attributed, both of which this
 *   candidate's guard is built to catch via the stray-number check.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a shape
 *   claim and the computed verdict can never diverge on the same input. Measured against its own
 *   GSM8K representative: SOLVED (17, matching 10+21+23-9-28=17). The 3 ASDiv siblings were not
 *   re-verified against their own text by this dispatch (out of scope for wave generation, see
 *   the wave protocol's ASDiv-internal-only rule); this is reported honestly rather than claimed.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'running-balance-add-then-subtract-v1';

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
const NUMBER_WORD_ALTERNATION = Object.keys(NUMBER_WORDS).sort((a, b) => b.length - a.length).join('|');

function wordOrDigit(tok: string): number | null {
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit) && digit.length > 0) return parseFloat(digit);
  const w = tok.toLowerCase().trim();
  if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, w)) return NUMBER_WORDS[w];
  return null;
}

const GAIN_VERBS = ['bought', 'got', 'received', 'earned', 'found', 'added'];
const LOSS_VERBS = ['gave', 'used', 'lost', 'spent', 'sold', 'took'];

// Any of these anywhere in the remainder text signals a DIFFERENT arithmetic shape (comparison
// or rate), even if a gain/loss verb also appears -- positive evidence AGAINST this shape.
const DISQUALIFYING_RE = /\b(more than|fewer than|less than|twice|half|per\b|each\b|times\b)\b/i;

function stem(noun: string): string {
  return noun.toLowerCase().replace(/s$/, '');
}
function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

interface Analyzed {
  owner: string;
  result: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const openRe = /([A-Z][\w'.]*)\s+had\s+([a-zA-Z0-9]+)\s+([a-zA-Z]+)\b[^.?!]*\./;
  const openMatch = openRe.exec(q);
  if (!openMatch) return null;
  const [full, owner, startWord, itemNoun] = openMatch;
  const start = wordOrDigit(startWord);
  if (start === null) return null;

  const remainder = q.slice((openMatch.index ?? 0) + full.length);
  if (DISQUALIFYING_RE.test(remainder)) return null;

  const tailRe = new RegExp(
    'how\\s+many\\s+' + stem(itemNoun) + 's?\\s+(?:does|do)\\s+' +
      owner.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+have\\s+left\\b',
    'i',
  );
  if (!tailRe.test(remainder)) return null;

  const numTokenRe = new RegExp('\\b(?:\\d+(?:\\.\\d+)?|' + NUMBER_WORD_ALTERNATION + ')\\b', 'gi');
  const allNumberTokens = remainder.match(numTokenRe) || [];

  let gainTotal = 0;
  let gainCount = 0;
  for (const verb of GAIN_VERBS) {
    const re = new RegExp('\\b' + verb + '\\b\\s+([a-zA-Z0-9]+)\\b', 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(remainder))) {
      const v = wordOrDigit(m[1]);
      if (v === null) continue;
      gainTotal += v;
      gainCount += 1;
    }
  }
  let lossTotal = 0;
  let lossCount = 0;
  for (const verb of LOSS_VERBS) {
    const re = new RegExp('\\b' + verb + '\\b\\s+([a-zA-Z0-9]+)\\b', 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(remainder))) {
      const v = wordOrDigit(m[1]);
      if (v === null) continue;
      lossTotal += v;
      lossCount += 1;
    }
  }

  if (gainCount + lossCount === 0) return null; // nothing recognised -- abstain, do not guess
  // COMPLETENESS SAFEGUARD (see @recogniseInStranger): every standalone numeral in the
  // remainder must have been claimed by exactly one gain/loss clause. A mismatch means a
  // quantity in this text was not understood, and this candidate refuses to guess past it.
  if (allNumberTokens.length !== gainCount + lossCount) return null;

  const result = start + gainTotal - lossTotal;
  if (!Number.isFinite(result)) return null;

  return { owner, result };
}

export const runningBalanceAddThenSubtract: LianaMethod = {
  id: 'running-balance-add-then-subtract-v1',
  demand: 'COMPUTE',
  name: 'Forward running balance: start plus gains minus losses',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170/WAVE-W03 (cluster C50, GSM8K representative harvest_gsm8k_pilot_item81; 3 ASDiv siblings not re-verified)',
  shapeDescription:
    'start + sum(gain-verb amounts) - sum(loss-verb amounts) = how many are left. A forward ' +
    'simulation, never a back-solve against a stated final total.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find "<Owner> had START <item>. [gain-verb N] ... [loss-verb M] ... how many ' +
          '<item> does <Owner> have left?" with every numeral in the text accounted for by a ' +
          'recognised gain/loss verb; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `running balance for ${result.owner} -> ${result.result}` };
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
        basis: `start + gains - losses = ${rounded}`,
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

registerMethod(runningBalanceAddThenSubtract);
