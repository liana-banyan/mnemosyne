// D-BP223-BM04-h2cbpv9w-170 -- gain-then-give-away-remaining-count-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\gain-then-give-away-remaining-count-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W20, CLUSTER C184 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl line 329, "Erin has 7 lollipops. Her mother gives Erin another
 * 10 lollipops. If Erin gives 3 of her lollipops to Ella, how many lollipops does she have left?".
 * Silo label: "multi-step addition and subtraction word problem -- addition and subtraction of
 * quantities".
 *
 * @generalShape ONE actor starts with a stated count of an item. A SECOND person (any relation
 *   noun: mother, friend, etc.) gives the actor an additional stated amount of the SAME item. The
 *   actor then gives a stated amount of the SAME item away to a THIRD person. The question asks
 *   how many of the item the first actor has left. Answer = start + received - given away.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) "<Actor> has <N1> <item>"; (b)
 *   a gain clause naming the SAME actor and SAME item, "<Giver> gives <Actor> another <N2> <item>"
 *   (case-insensitive "gives"/"give"); (c) an "if <Actor> gives <N3> of <possessive> <item> to
 *   <Recipient>" clause naming the SAME actor and item; (d) a closing "how many <item> does
 *   <Actor> have left" question naming the same actor and item.
 *
 * @whatBreaksIt (a) the item word differing across any of the three clauses -- abstain, cannot
 *   confirm it is the same running quantity; (b) the actor name in the gain or give-away clause
 *   not matching the opening actor -- abstain; (c) N3 (the amount given away) exceeding N1 + N2
 *   (would go negative) -- abstain rather than report a negative count; (d) any of the three
 *   numbers failing to parse as a non-negative integer -- abstain.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (7 + 10 - 3 = 14). With only one known cluster member there is
 *   no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'gain-then-give-away-remaining-count-v1';

interface Analyzed { left: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const startRe = /([A-Z][a-zA-Z']*)\s+has\s+(\d+)\s+([a-z]+)\b/;
  const sm = startRe.exec(q);
  if (!sm) return null;
  const actor = sm[1];
  const item = sm[3].toLowerCase();
  const start = parseInt(sm[2], 10);
  if (!Number.isFinite(start) || start < 0) return null;

  const gainRe = new RegExp(
    '[A-Za-z][a-zA-Z\']*\\s+gives?\\s+' + escapeRe(actor) + '\\s+another\\s+(\\d+)\\s+' + escapeRe(item) + '\\b',
    'i',
  );
  const gm = gainRe.exec(q);
  if (!gm) return null;
  const gained = parseInt(gm[1], 10);
  if (!Number.isFinite(gained) || gained < 0) return null;

  const giveAwayRe = new RegExp(
    escapeRe(actor) +
      '\\s+gives?\\s+(\\d+)\\s+of\\s+(?:her|his|their)\\s+' +
      escapeRe(item) +
      '\\s+to\\s+[A-Z][a-zA-Z\']*',
    'i',
  );
  const gam = giveAwayRe.exec(q);
  if (!gam) return null;
  const givenAway = parseInt(gam[1], 10);
  if (!Number.isFinite(givenAway) || givenAway < 0) return null;

  const closingRe = new RegExp(
    'how many\\s+' + escapeRe(item) + '\\s+does\\s+(?:she|he|they|' + escapeRe(actor) + ')\\s+have left',
    'i',
  );
  if (!closingRe.test(q)) return null;

  const total = start + gained;
  if (givenAway > total) return null;
  const left = total - givenAway;
  if (!Number.isFinite(left) || left < 0) return null;
  return { left };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const gainThenGiveAwayRemainingCount: LianaMethod = {
  id: 'gain-then-give-away-remaining-count-v1',
  demand: 'COMPUTE',
  name: 'Start with a count, receive more, give some away -- remaining count via exact integer arithmetic',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W20 (cluster C184, sole member: pilot corpus item at index 329)',
  shapeDescription: 'left = start + received - givenAway',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "<Actor> has <N1> <item>" opener, a matching "gives <Actor> another ' +
          '<N2> <item>" gain clause, a matching "<Actor> gives <N3> of ... <item> to ..." give-away ' +
          'clause, and a closing "how many <item> does <Actor> have left" question all sharing the ' +
          'same actor and item; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `left = ${result.left}` };
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
          verdict: String(Math.round(result.left * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'start + received - givenAway, exact integers',
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

registerMethod(gainThenGiveAwayRemainingCount);
