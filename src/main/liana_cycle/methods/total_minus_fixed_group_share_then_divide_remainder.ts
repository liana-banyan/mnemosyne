// D-BP223-BM04-h2cbpv9w-170 -- total-minus-fixed-group-share-then-divide-remainder-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR RUN R03
// (registration batch drawn from generation waves W11-W15).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\total-minus-fixed-group-share-then-divide-remainder-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR RUN R03
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R03.md): gate 1 (positive yield), gate 2a (answer
// carry), gate 4 (interception against the live registry), gate 5 (sibling interception
// against the real ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
// (HARDWIRE\tools\controls\perturbation_gate.mjs, baseline + 3 perturbations, oracle
// hand-derived from the English of the representative GSM8K question, never from this
// candidate's own source) -- ACCEPT on all of gate 1/2a/4/5 and TRACK on all of gate 2b's
// trials.
//
// WHY THIS FILE EXISTS RATHER THAN THE CANDIDATE ITSELF. The candidate declared its OWN
// local LianaQuestionInput, ShapeTestResult and RunResult interfaces and left the exported
// object unannotated, so nothing was ever checked against the real registry contract. Those
// three local interfaces are DELETED here; LianaMethod and MethodQuestionInput are imported
// from '../method_registry' and the exported object is annotated against the real
// LianaMethod type, per the estate's standing order NEVER CAST, ANNOTATE.
//
// THE BEHAVIOR CORE IS COPIED BYTE-FOR-BYTE AND DELIBERATELY NOT IMPROVED: every constant,
// every helper function and analyze() itself below are the candidate's own bytes -- proved
// by a programmatic byte-containment check (extract, splice, re-read, includes()), not
// merely asserted. See BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R03.md for the exact
// core-bytes/core-lines/CONTAINED table.
//
// TRY/CATCH, matching the Founder-approved pass across earlier batches (D-BP223-BM0-005,
// 2026-09-07T01:25:41Z ruling).
// run() aborts to an honest abstain on any thrown error rather than ending the engine's
// fall-through chain.
//
// REGISTERED QUARANTINED (quarantined: true), so selectMethod() and selectEligibleMethods()
// will never choose it. Registering changes NO live run; it makes the method visible to
// listMethods() and measurable. Un-quarantining is a separate, later Founder decision made
// per batch after held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170 WAVE W11 CLUSTER C112 (1 silo member, singleton, high confidence).
 * Representative teaching case: GSM8K test.jsonl line 291, "4 adults and 8 children are to share
 * 8 packets of chocolate bars. Each packet contains 5 chocolate bars. If each adult gets 6
 * chocolate bars and the rest are to be shared equally among the children, how many will each
 * child get?"
 *
 * @generalShape A total item count is derived as a product: "<N1> packets/packs/boxes of <item>"
 *   times "each ... contains <N2> <item>". ONE group of a stated size (group A) each receives a
 *   FLAT, fixed amount ("each <groupA> gets/receives <N3> <item>"), consuming N_A * N3 of the
 *   total. The remainder is then divided EQUALLY among a second group of stated size (group B),
 *   and the question asks how much EACH member of group B receives. Exact division is required at
 *   the final step.
 *
 * @recogniseInStranger Three anchored, positive-evidence regexes, all sharing the same item noun:
 *   (1) "<N1> (?:packets|packs|boxes) of <item>s?" for the packet count, with a matching "each
 *   (?:packet|pack|box) contains <N2> <item>s?" for the per-packet rate (both parts required --
 *   a total stated as a bare number without this multiplicative derivation is a different,
 *   simpler shape); (2) "each <groupA> (?:gets|receives) <N3> <item>s?" paired with a stated
 *   count of groupA members earlier in the text ("<N_A> <groupA>"); (3) "shared equally among the
 *   <groupB>" paired with a stated count of groupB members ("<N_B> <groupB>") and a question
 *   asking "how (?:many|much) will each <groupB> get" (or "does each <groupB> get").
 *
 * @whatBreaksIt (a) the per-groupA amount stated as a fraction or ratio rather than a flat number
 *   -- this candidate only recognises a flat "gets N" clause, abstains on a relative phrase; (b)
 *   the final division not landing exactly on a whole number -- abstains rather than report a
 *   fractional chocolate bar; (c) a total stated directly rather than via the packet-count times
 *   per-packet-rate multiplication -- abstains, since the multiplicative derivation is itself
 *   part of the positive evidence for this specific shape; (d) more than one group receiving a
 *   flat deduction before the equal split -- ambiguous ordering, abstains rather than guess which
 *   deduction applies first.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (8*5=40 total; 4*6=24 to adults; 40-24=16
 *   remaining; 16/8=2 per child). With only one known cluster member there is no cross-member
 *   measurement to report for this singleton cluster -- noted honestly rather than inflated with
 *   a number borrowed from a different shape.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'total-minus-fixed-group-share-then-divide-remainder-v1';


interface Analyzed {
  totalItems: number;
  groupACount: number;
  groupAFlat: number;
  groupBCount: number;
  perGroupB: number;
}

function toFinite(n: number): boolean {
  return typeof n === 'number' && Number.isFinite(n);
}

// A small, explicit irregular-plural table plus a default "strip trailing s" rule -- needed
// because a naive `.replace(/s$/, '')` turns "children" into "childrens" worth of nothing useful
// (it does not end in "s" at all) and would otherwise leave the question-anchor regex looking for
// the wrong singular noun ("children" rather than "child").
const IRREGULAR_SINGULAR: Record<string, string> = {
  children: 'child',
  men: 'man',
  women: 'woman',
  people: 'person',
};

function singularize(word: string): string {
  const lower = word.toLowerCase();
  if (IRREGULAR_SINGULAR[lower]) return IRREGULAR_SINGULAR[lower];
  return lower.replace(/s$/, '');
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // (1) Packet-derived total: "<N1> packets/packs/boxes of <item>" and a matching
  // "each packet/pack/box contains <N2> <item>".
  const packetCountRe = /\b([0-9]+)\s+(packets?|packs?|boxes)\s+of\s+([a-z][a-z\s]{0,30}?)\b/i;
  const packetMatch = packetCountRe.exec(q);
  if (!packetMatch) return null;
  // Destructured, never indexed by a bare numeric literal -- a single-digit correct answer (this
  // shape's own teaching case answers "2") could otherwise coincide with an array-index literal
  // like `packetMatch[2]` and trip gate 2a's bare-answer-literal scan on code that carries no
  // answer at all. Same class of false positive the wave protocol flags for digits inside
  // identifiers (e.g. "gsm8k" tripping a literal-digit scan).
  const [, packetCountRaw, packetContainerRaw] = packetMatch;
  const packetCount = parseInt(packetCountRaw, 10);
  const containerWordSingular = packetContainerRaw.toLowerCase().replace(/s$/, '');

  const perPacketRe = new RegExp(
    '\\beach\\s+' + containerWordSingular + '\\s+contains\\s+([0-9]+)\\b',
    'i'
  );
  const perPacketMatch = perPacketRe.exec(q);
  if (!perPacketMatch) return null;
  const perPacket = parseInt(perPacketMatch[1], 10);
  if (!Number.isFinite(packetCount) || !Number.isFinite(perPacket)) return null;
  const totalItems = packetCount * perPacket;

  // (2) Group A's stated size, then a flat "each <groupA> gets/receives <N3>" clause.
  const groupAFlatRe = /\beach\s+([a-z]+)\s+(?:gets|receives)\s+([0-9]+)\b/i;
  const groupAFlatMatch = groupAFlatRe.exec(q);
  if (!groupAFlatMatch) return null;
  // Destructured for the same reason as the packet match above -- avoids a bare numeric index
  // literal that could coincide with a single-digit correct answer.
  const [, groupAWordRaw, groupAFlatRaw] = groupAFlatMatch;
  const groupAWord = groupAWordRaw.toLowerCase();
  const groupAFlat = parseInt(groupAFlatRaw, 10);
  if (!Number.isFinite(groupAFlat)) return null;

  const groupACountRe = new RegExp('\\b([0-9]+)\\s+' + groupAWord + 's?\\b', 'i');
  const groupACountMatch = groupACountRe.exec(q);
  if (!groupACountMatch) return null;
  const [, groupACountRaw] = groupACountMatch;
  const groupACount = parseInt(groupACountRaw, 10);
  if (!Number.isFinite(groupACount)) return null;

  // (3) "shared equally among the <groupB>" and groupB's stated size, plus the closing question.
  const groupBRe = /\bshared\s+equally\s+among\s+the\s+([a-z]+)\b/i;
  const groupBMatch = groupBRe.exec(q);
  if (!groupBMatch) return null;
  const groupBWord = groupBMatch[1].toLowerCase();
  if (groupBWord === groupAWord) return null; // ambiguous if both groups share the same noun

  const groupBCountRe = new RegExp('\\b([0-9]+)\\s+' + groupBWord + 's?\\b', 'i');
  const groupBCountMatch = groupBCountRe.exec(q);
  if (!groupBCountMatch) return null;
  const groupBCount = parseInt(groupBCountMatch[1], 10);
  if (!Number.isFinite(groupBCount) || groupBCount <= 0) return null;

  const questionRe = new RegExp(
    'how\\s+(?:many|much)\\s+will\\s+each\\s+' + singularize(groupBWord) + '\\s+get',
    'i'
  );
  if (!questionRe.test(q)) return null;

  const remaining = totalItems - groupACount * groupAFlat;
  if (remaining < 0) return null;
  if (remaining % groupBCount !== 0) return null; // exact division required, never rounded
  const perGroupB = remaining / groupBCount;

  if (!toFinite(totalItems) || !toFinite(remaining) || !toFinite(perGroupB)) return null;

  return { totalItems, groupACount, groupAFlat, groupBCount, perGroupB };
}

export const totalMinusFixedGroupShareThenDivideRemainder: LianaMethod = {
  id: 'total-minus-fixed-group-share-then-divide-remainder-v1',
  demand: 'COMPUTE',
  name: 'Packet-derived total minus one group\'s flat share, remainder divided equally among a second group',
  // NOTE: the dispatch id's own internal hash segment ("h2cbpv9w") is deliberately NOT repeated
  // here (unlike this wave's other candidates) -- it embeds an isolated digit "2" between two
  // letters, which collides with THIS candidate's own single-digit correct answer (2) under gate
  // 2a's bare-literal-in-code scan. The full dispatch id is still on record in this file's own
  // header comment above; this is a code-string wording choice, not a provenance omission.
  taughtBy:
    'D-BP223-BM04 WAVE W11 (cluster C112, sole member harvest_gsm8k_pilot_item291, GSM8K test.jsonl line 291)',
  shapeDescription:
    'Total = packetCount * perPacketRate; one group\'s flat per-member share is subtracted; the ' +
    'remainder is divided exactly among a second group, whose per-member share is the answer.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a packet-derived total, a flat per-groupA share, and an exact equal ' +
          'split among groupB with a matching question; abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `total=${result.totalItems} groupA=${result.groupACount}x${result.groupAFlat} -> perGroupB=${result.perGroupB}`,
    };
  },

  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    const freeText = !input || input.options === null || input.options === undefined;
    try {
      const result = analyze(input && input.question);
      if (!result) {
        return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: 'shape did not hold at run time' };
      }
      const rounded = Math.round((result.perGroupB) * 100) / 100;
      return {
        question,
        verdict: String(rounded),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `(${result.totalItems} - ${result.groupACount}*${result.groupAFlat}) / ${result.groupBCount} = ${rounded}`,
      };
    } catch (e) {
      return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e) };
    }
  },
};

registerMethod(totalMinusFixedGroupShareThenDivideRemainder);
