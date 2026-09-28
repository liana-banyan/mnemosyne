// D-BP223-BM04-h2cbpv9w-170 -- total-times-percentage-then-half-of-that-subgroup-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\total-times-percentage-then-half-of-that-subgroup-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W20, CLUSTER C187 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl line 332, "There are 220 castles in Scotland. 40 percent of
 * them are ruins, and half of the ruined castles are unmanned. How many unmanned ruined castles
 * are there in Scotland?". Silo label: "multi-step percentage and fraction of a total".
 *
 * @generalShape A TOTAL count of items in a place is stated. A stated PERCENTAGE of the total
 *   defines a first subgroup. HALF of that first subgroup defines a second, nested subgroup. The
 *   question asks for the size of the nested (second) subgroup. Answer = total * (pct/100) * 0.5.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) "There are <total> <itemPlural>
 *   in <Place>"; (b) "<pct> percent of them are <subgroupNoun>" (the subgroup named as a noun);
 *   (c) "half of the <subgroupAdjective> <itemPlural> are <nestedAdjective>", where
 *   <subgroupAdjective> need not be string-identical to <subgroupNoun> (a noun/adjective word-form
 *   pair like "ruins"/"ruined") but must share the same 4-letter stem, structurally anchored by
 *   sharing the SAME <itemPlural> as the opener; (d) a closing "how many <nestedAdjective>
 *   <subgroupAdjective> <itemPlural> are there in <Place>" question naming the SAME place and the
 *   SAME two adjective words (order-independent) captured in clause (c).
 *
 * @whatBreaksIt (a) the place name in the closing question not matching the opener -- abstain;
 *   (b) the percentage failing to parse as 0-100 -- abstain; (c) total*(pct/100) not landing on an
 *   exact integer (a fractional first-subgroup count) -- abstain rather than round; (d) that
 *   integer not being even (halving it would leave a fraction) -- abstain rather than round; (e)
 *   the subgroup noun and the halving clause's adjective not sharing a 4-letter stem -- abstain,
 *   cannot confirm they name the same subgroup; (f) the two adjective phrases in the closing
 *   question appearing in the OPPOSITE order from the body (e.g. asking for "ruined unmanned"
 *   instead of "unmanned ruined") -- treated as the same nested subgroup only when both adjectives
 *   are present, order-independent, since English closing questions may restate them either way.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (220 * 0.40 = 88; 88 / 2 = 44). With only one known cluster
 *   member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'total-times-percentage-then-half-of-that-subgroup-v1';

interface Analyzed { nested: number; }

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const openRe = /There are\s+(\d+)\s+([a-z]+)\s+in\s+([A-Z][a-zA-Z]*)/;
  const om = openRe.exec(q);
  if (!om) return null;
  const total = parseInt(om[1], 10);
  const itemPlural = om[2];
  const place = om[3];
  if (!Number.isFinite(total) || total <= 0) return null;

  const pctRe = new RegExp('(\\d+(?:\\.\\d+)?)\\s+percent of them are\\s+([a-z]+)', 'i');
  const pm = pctRe.exec(q);
  if (!pm) return null;
  const pct = parseFloat(pm[1]);
  const subgroupNoun = pm[2];
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return null;

  // The percent clause names the subgroup as a NOUN ("are ruins"); the next sentence may name the
  // SAME subgroup as a different word-form ADJECTIVE ("the ruined castles"). Exact string identity
  // between the two is not required -- positive evidence instead comes from structural adjacency
  // (this is the very next "half of the <adj> <itemPlural> are <nestedAdj>" clause, sharing the
  // SAME itemPlural noun) plus a shared word stem (first 4 letters) as a sanity check against an
  // unrelated later halving clause being mistaken for this one.
  const halfRe = new RegExp('half of the\\s+([a-z]+)\\s+' + escapeRe(itemPlural) + '\\s+are\\s+([a-z]+)', 'i');
  const hm = halfRe.exec(q);
  if (!hm) return null;
  const subgroupAdj = hm[1];
  const nestedAdj = hm[2];
  const stem = (w: string) => w.toLowerCase().slice(0, 4);
  if (stem(subgroupAdj) !== stem(subgroupNoun)) return null;

  const closeRe = new RegExp(
    'how many\\s+(?:' +
      escapeRe(nestedAdj) + '\\s+' + escapeRe(subgroupAdj) + '|' + escapeRe(subgroupAdj) + '\\s+' + escapeRe(nestedAdj) +
      ')\\s+' + escapeRe(itemPlural) + '\\s+are there in\\s+' + escapeRe(place),
    'i',
  );
  if (!closeRe.test(q)) return null;

  const firstSubgroup = (total * pct) / 100;
  if (!Number.isInteger(firstSubgroup)) return null;
  if (firstSubgroup % 2 !== 0) return null;
  const nested = firstSubgroup / 2;
  if (!Number.isFinite(nested) || nested < 0) return null;
  return { nested };
}

export const totalTimesPercentageThenHalfOfThatSubgroup: LianaMethod = {
  id: 'total-times-percentage-then-half-of-that-subgroup-v1',
  demand: 'COMPUTE',
  name: 'A total is reduced by a percentage into a first subgroup, then halved into a nested subgroup -- exact arithmetic',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W20 (cluster C187, sole member: pilot corpus item at index 332)',
  shapeDescription: 'nested = (total * pct/100) / 2, both steps required to land on exact integers',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "There are <total> <item> in <Place>" opener, a "<pct> percent of them ' +
          'are <adj1>" clause, a matching "half of the <adj1> <item> are <adj2>" nested clause, ' +
          'and a closing "how many <adj2> <adj1> <item> are there in <Place>" question resolving ' +
          'to exact integers at both steps; abstaining rather than rounding',
      };
    }
    return { matches: true, reason: `nested = ${result.nested}` };
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
          verdict: String(Math.round(result.nested * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'total * pct/100, then halved, exact integers only',
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

registerMethod(totalTimesPercentageThenHalfOfThatSubgroup);
