// D-BP223-BM04-h2cbpv9w-170 -- two-sums-of-products-compared-for-greater-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, STAGED (not yet
// installed under mnemosyne/src -- see INSTALL_WHEN_CLAIM_CLEARS.md in this same directory).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\two-sums-of-products-compared-for-greater-v1.candidate.ts
// Promoted through gate 1, gate 2a, gate 4 in
//   BISHOP_DROPZONE\D-BP223-M0-h2cbpoxk-035_PROMOTION_BATCH_2_ASDIV_CLUSTERS.md
// and re-verified CONFIDENT-WRONG-free on the real ASDiv-150 + GSM8K-1319 corpora by gate 5
// (sibling interception) in
//   BISHOP_DROPZONE\D-BP223-M0-h2cbpc0g-043_GATE_5_SIBLING_INTERCEPTION.md
// Final combined verdict, this dispatch's own live re-run of accept_gates.cjs (gate 1 then 2a
// then 4 then 5), same moment this file was generated: ACCEPT.
//
// WHY THIS FILE EXISTS RATHER THAN THE CANDIDATE ITSELF. The candidate declared its OWN local
// `LianaQuestionInput`, `ShapeTestResult` and `RunResult` interfaces and left the exported
// object completely unannotated, so nothing was ever checked against the real registry
// contract -- the same disguise found and named in the earlier seven item-10 methods and in
// batch 1 (see reference_a_hand_copied_contract_is_the_defect_not_bad_types_bp222.md and
// D-BP223-M0-h2cbp8h8-018_BATCH_1_REGISTERED_QUARANTINED.md). Those three local interfaces are
// DELETED here; `LianaMethod` and `MethodQuestionInput` are imported from '../method_registry'
// and the exported object is annotated against the real `LianaMethod` type, per the estate's
// standing order NEVER CAST, ANNOTATE.
//
// THE BEHAVIOR CORE IS COPIED BYTE-FOR-BYTE AND DELIBERATELY NOT IMPROVED: every constant, every
// helper function and analyze() itself below are the candidate's own bytes, from its first
// behavior-bearing declaration (`const ONES_WORDS`) through analyze()'s closing brace -- proved
// by a programmatic byte-containment check (extract, splice, re-read, includes()), not merely
// asserted. See this dispatch's own return doc (D-BP223-BM04-h2cbpv9w-170_BATCH2_STAGED.md) for
// the exact core-bytes/core-lines/CONTAINED table. Only the interface layer (imports, the three
// deleted local interfaces, the exported object's shape, shapeTest/run signatures) is new text.
//
// TRY/CATCH ADDED, matching the Founder-approved pass across the earlier seven and batch 1
// (D-BP223-BM0-005, 2026-09-07T01:25:41Z ruling: "Yes do the Try/Catch pass across the seven.
// Approved. Word."): run() aborts to an honest abstain on any thrown error rather than ending
// the engine's fall-through chain.
//
// REGISTERED QUARANTINED (`quarantined: true`), so selectMethod() and selectEligibleMethods()
// will never choose it once installed. Registering changes NO live run; it makes the method
// visible to listMethods() and measurable. Un-quarantining is a separate, later Founder decision
// made per batch after held-out measurement, not this dispatch's.
//
// NOT YET INSTALLED. X001 (session 1d598c24) holds a scoped claim on
// mnemosyne/src/main/liana_cycle/methods and mnemosyne/scripts as of this dispatch. This file is
// staged here, at its exact eventual target filename and contents, so installation is a
// mechanical copy once that claim clears -- see INSTALL_WHEN_CLAIM_CLEARS.md.

/**
 * D-BP223-BM0-079/BATCH-2 CLUSTER C147 (1 silo member, high confidence, singleton). Representative
 * teaching case: ASDiv item29, "Mrs. Hilt has two pennies, two dimes, and two nickels. Jacob has
 * four pennies, one nickel, and one dime. Who has more money?".
 *
 * @generalShape Two (or more) named people each list a set of US coin counts (pennies/nickels/
 *   dimes/quarters); each person's total is a sum of products (count * coin value), and the
 *   answer is the NAME of whichever person's total is greater -- a COMPARE, not a SUBTRACT, per
 *   this silo's own note distinguishing it from its near-twin C14 (same problem_kind label,
 *   nearly identical steps text, but C14's final operation reports the numeric DIFFERENCE while
 *   this one reports WHICH person, so they are kept separate).
 *
 * @recogniseInStranger Scans for every "<Name> has <coin list>." sentence, and within each such
 *   sentence's list, every "<count> <coin-word>" pair (pennies/penny, nickels/nickel, dimes/dime,
 *   quarters/quarter -- digit or spelled-out count), converts to cents with the standard US coin
 *   values, and sums per person. Requires at least two people with a non-zero coin total; reports
 *   the name of whichever total is strictly larger.
 *
 * @whatBreaksIt (a) fewer than two people found, or fewer than two with any recognised coin
 *   mentioned -- abstains, nothing to compare; (b) a TIE (equal totals) -- abstains rather than
 *   arbitrarily pick a name, since "who has more" has no correct answer when the totals are
 *   equal; (c) a coin denomination this method does not know (half-dollar, dollar coin) -- those
 *   tokens are simply not matched, which could under-count a person's total on a stranger question
 *   using an unlisted coin; flagged here rather than hidden, since only one member is known.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED ("Mrs. Hilt", 32 cents vs Jacob's 19 cents).
 *   With only one known member there is no cross-member measurement to report for this cluster.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';


const METHOD_ID = 'two-sums-of-products-compared-for-greater-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });

const TENS_WORDS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const TENS: Record<string, number> = {};
TENS_WORDS.forEach((w, i) => { TENS[w] = (i + 2) * 10; });
const NUMBER_WORDS: Record<string, number> = { ...ONES, ...TENS, hundred: 100 };

const COIN_VALUES: Record<string, number> = {
  penny: 1, pennies: 1, nickel: 5, nickels: 5, dime: 10, dimes: 10, quarter: 25, quarters: 25,
};

function wordOrDigit(tok: string): number | null {
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit)) return parseFloat(digit);
  const w = tok.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, w)) return NUMBER_WORDS[w];
  return null;
}

interface PersonTotal {
  name: string;
  cents: number;
}

interface Analyzed {
  winner: string;
  totals: PersonTotal[];
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // Anti-collision guard, added after the full-150-item ASDiv coverage run measured this
  // candidate answering a NAME to a question that actually asks for a NUMBER ("How much more?",
  // C14's territory, a numeric-difference sibling sharing near-identical setup prose per this
  // cluster's own notes) -- require the tail to actually ask WHO, not just find two coin-list
  // sentences and assume the question wants a winner's name.
  if (!/\bwho\b/i.test(q)) return null;

  const personRe = /([A-Z][\w'.]*(?:\s[A-Z][\w'.]*)?)\s+has\s+([^.]+?)\./g;
  const totals: PersonTotal[] = [];
  let pm: RegExpExecArray | null;
  while ((pm = personRe.exec(q)) !== null) {
    const name = pm[1];
    const listText = pm[2];
    const coinRe = /([a-zA-Z0-9]+)\s+(pennies|penny|nickels|nickel|dimes|dime|quarters|quarter)\b/gi;
    let cm: RegExpExecArray | null;
    let cents = 0;
    let any = false;
    while ((cm = coinRe.exec(listText)) !== null) {
      const count = wordOrDigit(cm[1]);
      const coin = cm[2].toLowerCase();
      if (count !== null && COIN_VALUES[coin] !== undefined) {
        cents += count * COIN_VALUES[coin];
        any = true;
      }
    }
    if (any) totals.push({ name, cents });
  }

  if (totals.length < 2) return null;
  const sorted = [...totals].sort((a, b) => b.cents - a.cents);
  if (sorted[0].cents === sorted[1].cents) return null; // tie -- no correct "who has more"
  return { winner: sorted[0].name, totals };
}


export const twoSumsOfProductsComparedForGreaterMethod: LianaMethod = {
  id: METHOD_ID,
  demand: 'COMPUTE',
  name: 'Two coin-value sums compared, report who has more',
  taughtBy: 'D-BP223-BM0-079/SEG BATCH-2 (cluster C147, sole member harvest_asdiv_pilot_item29)',
  shapeDescription:
    'Two or more people each list US coin counts; each total is a sum of count*value in cents; ' +
    'the answer is the NAME of whichever person totals more (a compare, not a numeric difference).',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason: `did not find at least two "<Name> has <coin list>." sentences with a non-tied coin total naming who the question asks about; abstaining rather than guessing`,
      };
    }
    return { matches: true, reason: `totals=${JSON.stringify(result.totals)}` };
  },

  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    // A question with no options is free text. Read off the input, never assumed -- same
    // convention as every other adapted method in this folder.
    const freeText = !input || input.options === null || input.options === undefined;

    try {
      const result = analyze(question);
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
        verdict: result.winner,
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: result.totals.map((t) => `${t.name}=${t.cents}c`).join(', '),
      };
    } catch (e) {
      // TRY/CATCH PASS, D-BP223-BM0-005 convention (see file header): ABSTAIN and say what
      // threw, rather than letting the exception end the engine's fall-through chain.
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

// REGISTERED AT IMPORT TIME, the same convention as every other method module in this folder.
// ACCEPTED by this dispatch's own live re-run of accept_gates.cjs (gate 1 then gate 2a then gate 4
// then gate 5), matching BISHOP_DROPZONE\D-BP223-M0-h2cbpoxk-035_PROMOTION_BATCH_2_ASDIV_CLUSTERS.md and
// BISHOP_DROPZONE\D-BP223-M0-h2cbpc0g-043_GATE_5_SIBLING_INTERCEPTION.md. See
// BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_BATCH2_STAGED.md for the full verdict table.
registerMethod(twoSumsOfProductsComparedForGreaterMethod);
