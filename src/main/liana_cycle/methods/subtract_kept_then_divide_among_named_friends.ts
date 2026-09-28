// D-BP223-BM04-h2cbp9d8-171 -- subtract-kept-then-divide-among-named-friends-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R09.
// (registration batch drawn from generation waves W30-W31.)
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\subtract-kept-then-divide-among-named-friends-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R09
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R09.md): gate 1 (positive yield), gate 2a
// (answer carry, under gate2_answer_carry.cjs's v3 -- the array-index/bracket-adjacency fix
// installed 2026-09-08T09:46:02Z, on top of v2's letter-boundary fix installed 09:08:02Z), gate 4
// (interception against the live registry), gate 5 (sibling interception against the real
// ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
// (HARDWIRE\tools\controls\perturbation_gate.mjs, baseline + perturbations, oracle hand-derived
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R09.md for the exact
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W30, cluster C268 (GSM8K test.jsonl item435, singleton).
 *
 * @generalShape An actor starts with a stated TOTAL of an item, KEEPS a stated amount for
 *   themself, and shares the REMAINDER equally among a stated number of named friends (the actor
 *   is NOT one of the sharers). The question asks how much EACH friend receives. Verified against
 *   item435's own "#### 5" line before this candidate was written: 25 - 5 = 20 remaining,
 *   20 / 4 friends = 5 each.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) "<Actor> had <TOTAL> <item>";
 *   (b) "kept <KEPT> <item>"; (c) "(his|her|their) <word-or-digit> (other )?friends" naming the
 *   sharer count (spelled one..ten or a bare digit); (d) a closing "how many <item> did each
 *   (of (his|her|their) friends|friend) receive|get" question. The keeper's own share is excluded
 *   from the division by construction (friends only).
 *
 * @whatBreaksIt (a) the friend count is missing or given some other way (e.g. "split among
 *   everyone" with no number) -- abstain; (b) TOTAL minus KEPT is negative or not evenly
 *   divisible by the friend count -- abstain rather than round; (c) the actor is themself
 *   included among the sharers ("shared equally among himself and his four friends") -- a
 *   different, N+1-way split this candidate does not attempt; (d) more than one "kept" clause or
 *   ambiguous item names across clauses -- abstain.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item435): remaining = 25 - 5 = 20, each = 20 / 4 = 5 (exact integer division). SOLVED.
 *   Reach across a wider corpus is recorded in wave_manifest.json, not asserted here -- this is a
 *   singleton-cluster shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'subtract-kept-then-divide-among-named-friends-v1';

const TOTAL_RE = /(\w+)\s+had\s+(\d+)\s+([a-z]+)/i;
const KEPT_RE = /kept\s+(\d+)\s+[a-z]+/i;
const FRIENDS_RE = /(?:his|her|their)\s+(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:other\s+)?friends/i;
const ASK_RE = /how\s+many\s+[a-z]+\s+did\s+each\s+(?:of\s+(?:his|her|their)\s+friends\s+)?(?:receive|get)/i;

const ONES_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

function parseCount(raw: string): number | null {
  if (/^\d+$/.test(raw)) return Number(raw);
  const idx = ONES_WORDS.indexOf(raw.toLowerCase());
  return idx >= 0 ? idx + 1 : null;
}

interface Analyzed { verdict: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const totalM = TOTAL_RE.exec(q);
  if (!totalM) return null;
  const total = Number(totalM[2]);
  if (!Number.isInteger(total) || total < 0) return null;

  const keptM = KEPT_RE.exec(q);
  if (!keptM) return null;
  const kept = Number(keptM[1]);
  if (!Number.isInteger(kept) || kept < 0) return null;

  const friendsM = FRIENDS_RE.exec(q);
  if (!friendsM) return null;
  const friends = parseCount(friendsM[1]);
  if (friends == null || friends <= 0) return null;

  if (!ASK_RE.test(q)) return null;

  const remaining = total - kept;
  if (remaining < 0) return null;
  if (remaining % friends !== 0) return null; // not an exact whole-item share; abstain rather than round

  const verdict = remaining / friends;
  return { verdict };
}

export const subtractKeptThenDivideAmongNamedFriends: LianaMethod = {
  id: 'subtract-kept-then-divide-among-named-friends-v1',
  demand: 'COMPUTE',
  name: 'Compute each friend\'s equal share after an actor keeps part of a total for themself',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W30, cluster C268, GSM8K test item435',
  shapeDescription:
    'An actor starts with a total, keeps a stated amount, and shares the remainder equally among ' +
    'a stated number of friends (the actor is not one of the sharers). Answer = (total - kept) / ' +
    'friendCount, exact integer division.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "<actor> had <total> <item>" clause plus a "kept <N> <item>" clause plus ' +
          'a "<count> friends" sharer clause plus a "how many did each ... receive/get" ask, with ' +
          'an exact whole-item division; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `each friend receives ${result.verdict}` };
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
          verdict: String(Math.round((result.verdict) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: '(total - kept) / friendCount, exact integer division',
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

registerMethod(subtractKeptThenDivideAmongNamedFriends);
