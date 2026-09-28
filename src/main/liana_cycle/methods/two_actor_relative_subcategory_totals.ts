// D-BP223-M0-h2cbpqmc-011 -- two-actor-relative-subcategory-totals-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE.
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\two-actor-relative-subcategory-totals-v1.candidate.ts
// Accepted (gate 1 then 2a then 4, then the perturbation gate 2b), per
// BISHOP_DROPZONE\D-BP223-M0-h2cbpqmc-010_PROMOTION_BATCH_1_FIVE_CLUSTERS.md.
//
// WHY THIS FILE EXISTS RATHER THAN THE CANDIDATE ITSELF. The candidate declared its OWN local
// `LianaQuestionInput`, `ShapeTestResult` and `RunResult` interfaces and left the exported
// object completely unannotated, so nothing was ever checked against the real registry
// contract -- the same "disguise" already found and named in the earlier seven item-10 methods
// (see reference_a_hand_copied_contract_is_the_defect_not_bad_types_bp222.md). Those three local
// interfaces are DELETED here; `LianaMethod` and `MethodQuestionInput` are imported from
// '../method_registry' and the exported object is annotated against the real `LianaMethod` type,
// per the estate's standing order NEVER CAST, ANNOTATE.
//
// THE BEHAVIOR CORE IS COPIED BYTE-FOR-BYTE AND DELIBERATELY NOT IMPROVED: every constant, every
// helper function and analyze() itself below are the candidate's own bytes -- proved by byte
// containment in this dispatch's report, not merely asserted. `accept_gates.cjs` judged this
// method's BEHAVIOR (gate 1 solves its own shape, gate 2a carries no answer, gate 4 steals
// nothing) and the perturbation gate (2b) ran baseline plus 3 perturbations, all TRACK. Editing
// the analysis would mean that ACCEPT no longer describes this file. Only the interface layer --
// the two signatures and the returned object shapes -- is this dispatch's work.
//
// TRY/CATCH ADDED, matching the Founder-approved pass across the earlier seven
// (D-BP223-BM0-005, 2026-09-07T01:25:41Z ruling: "Yes do the Try/Catch pass across the seven.
// Approved. Word.") applied here from the start rather than as a later pass: run() aborts to an
// honest abstain on any thrown error rather than ending the engine's fall-through chain.
//
// REGISTERED QUARANTINED (`quarantined: true`), so selectMethod() and selectEligibleMethods()
// will never choose it. Registering changes NO live run; it makes the method visible to
// listMethods() and measurable -- the whole point of filing it. Un-quarantining is a separate,
// later Founder decision made per batch after held-out measurement, not this dispatch's.

/**
 * D-BP223-BM0-079 CLUSTER C21 (3 silo members, zero promoted). Representative teaching case:
 * item161 (GSM8K test line 161, Anakin and Locsin's beach catch).
 *
 * @generalShape Two actors each report the same N sub-categories (e.g. starfish/sea horses/
 *   clownfish). Actor 1's N sub-category amounts are stated directly, in order, as bare numbers.
 *   Actor 2's corresponding N sub-category amounts are each defined RELATIVE to actor 1's
 *   same-position amount, in the SAME order, via a per-item relation word: "N fewer" (subtract),
 *   "N more" (add), "twice"/"double" (x2), "half" (x0.5). The answer is
 *   sum(actor1) + sum(actor2-derived). This is cluster C21's "two actors, per-category
 *   subtotal via add, then add both actors' totals" shape.
 *
 * @recogniseInStranger Find actor 1's list: the first sentence carrying two-or-more bare numbers
 *   (digits or spelled-out words one..twenty) becomes ACTOR1 = that ordered list. Find actor 2's
 *   relation list: the NEXT sentence, scanned in order for exactly that many relation tokens,
 *   each one of "<N> fewer" (subtract N), "<N> more" (add N), "twice"/"double"/"doubles" (x2), or
 *   "half" (x0.5), where <N> may be a digit or a spelled-out number word. Fire only when actor 1's
 *   list has AT LEAST TWO entries, actor 2's relation list has EXACTLY the same length, every
 *   relation token was recognized, and no disqualifying keyword (percent, average, "as many as")
 *   is present anywhere in the text.
 *
 * @whatBreaksIt (a) actor 2's relations given in a different order than actor 1's list, which
 *   this method cannot detect and would silently misalign -- a real, acknowledged risk of the
 *   positional-matching design, not assumed safe; (b) a relation word this method's small
 *   vocabulary does not cover (e.g. "one and a half times") -- correctly abstains rather than
 *   guess; (c) more or fewer relation tokens found than actor 1 has sub-categories -- refused as
 *   a count mismatch; (d) a third actor, or a running total across more than two people, which
 *   this narrow two-actor shape does not attempt.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Any guard
 *   failing (fewer than two actor-1 entries, a relation-count mismatch, an unrecognized relation
 *   token, a disqualifying keyword, a non-finite/negative result) makes the method ABSTAIN:
 *   verdict null, abstain true. Cross-cluster measurement (D-BP223 batch 1 report) found this
 *   design correct on all three members of the cluster it was built for -- items 161, 295 and
 *   121 -- including item295's spelled-out "ten fewer" and item121's "twice"/"half" pair, with no
 *   observed wrong answer in this batch's testing; the positional-alignment assumption above
 *   remains an acknowledged, not exhaustively stress-tested, risk on a stranger question.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';


const METHOD_ID = 'two-actor-relative-subcategory-totals-v1';

const DISQUALIFYING_KEYWORDS: string[] = [
  'percent', '%', 'average', 'mean', 'as many as', 'as much as', 'tax',
  'discount', 'equation', 'unknown', 'variable',
];

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20,
};
const NUM_WORD_ALT = Object.keys(WORD_NUMBERS).join('|');

function extractOrderedNumbers(text: string): number[] {
  const re = new RegExp(`\\b(\\d+(?:\\.\\d+)?|${NUM_WORD_ALT})\\b`, 'gi');
  const out: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[1].toLowerCase();
    const val = /^\d/.test(raw) ? parseFloat(raw) : WORD_NUMBERS[raw];
    if (Number.isFinite(val)) out.push(val);
  }
  return out;
}

interface Relation {
  kind: 'fewer' | 'more' | 'double' | 'half';
  amount: number | null;
}

function extractRelationsInOrder(text: string, expectedCount: number): Relation[] | null {
  // Walk the text left to right, collecting the FIRST `expectedCount` relation cues found, in
  // the order they appear -- one cue per sub-category, same order as actor 1's list.
  const cueRe = new RegExp(
    `(\\d+(?:\\.\\d+)?|${NUM_WORD_ALT})\\s+(fewer|more)\\b|\\b(twice|double|doubles|doubled)\\b|\\bhalf\\b`,
    'gi',
  );
  const relations: Relation[] = [];
  let m: RegExpExecArray | null;
  while ((m = cueRe.exec(text)) !== null && relations.length < expectedCount) {
    if (m[1] && m[2]) {
      const raw = m[1].toLowerCase();
      const amount = /^\d/.test(raw) ? parseFloat(raw) : WORD_NUMBERS[raw];
      if (!Number.isFinite(amount)) return null;
      relations.push({ kind: m[2].toLowerCase() === 'fewer' ? 'fewer' : 'more', amount });
    } else if (m[3]) {
      relations.push({ kind: 'double', amount: null });
    } else {
      relations.push({ kind: 'half', amount: null });
    }
  }
  if (relations.length !== expectedCount) return null;
  return relations;
}

interface Analyzed {
  actor1: number[];
  actor2: number[];
  total: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();
  const lower = q.toLowerCase();
  for (const kw of DISQUALIFYING_KEYWORDS) {
    if (lower.includes(kw)) return null;
  }

  const sentences = q.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);

  let actor1: number[] | null = null;
  let actor1Idx = -1;
  for (let i = 0; i < sentences.length; i++) {
    const nums = extractOrderedNumbers(sentences[i]);
    if (nums.length >= 2) {
      actor1 = nums;
      actor1Idx = i;
      break;
    }
  }
  if (!actor1 || actor1.length < 2) return null;

  // Actor 2's relation sentence: search the remaining sentences (in order) for the first one
  // that yields exactly actor1.length relation cues.
  let relations: Relation[] | null = null;
  for (let i = actor1Idx + 1; i < sentences.length; i++) {
    const found = extractRelationsInOrder(sentences[i], actor1.length);
    if (found) { relations = found; break; }
  }
  if (!relations) return null;

  const actor2: number[] = [];
  for (let i = 0; i < actor1.length; i++) {
    const base = actor1[i];
    const rel = relations[i];
    let val: number;
    if (rel.kind === 'fewer') val = base - (rel.amount as number);
    else if (rel.kind === 'more') val = base + (rel.amount as number);
    else if (rel.kind === 'double') val = base * 2;
    else val = base / 2;
    if (!Number.isFinite(val) || val < 0) return null;
    actor2.push(val);
  }

  const sum1 = actor1.reduce((a, b) => a + b, 0);
  const sum2 = actor2.reduce((a, b) => a + b, 0);
  const total = sum1 + sum2;
  if (!Number.isFinite(total) || total < 0) return null;

  return { actor1, actor2, total };
}


export const twoActorRelativeSubcategoryTotalsMethod: LianaMethod = {
  id: METHOD_ID,
  demand: 'COMPUTE',
  name: 'Two actors, per-category relative amounts, both totals summed',
  taughtBy: 'D-BP223-BM0-079/SEG (cluster C21, representative harvest_gsm8k_pilot_item161)',
  shapeDescription:
    'Actor 1 states N sub-category amounts directly; actor 2\'s same N sub-categories are each ' +
    'defined relative to actor 1\'s ("N fewer", "N more", "twice", "half"), in the same order; ' +
    'both actors\' totals are summed.',
  quarantined: true,

  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find an actor-1 list of two or more numbers followed by an equal-length, ' +
          'in-order list of recognized relation cues (fewer/more/twice/double/half), or a ' +
          'disqualifying keyword was present; abstaining rather than guessing an alignment',
      };
    }
    return {
      matches: true,
      reason:
        `actor1=[${result.actor1.join(',')}], actor2(derived)=[${result.actor2.join(',')}]`,
    };
  },

  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    // A question with no options is free text. Read off the input, never assumed -- same
    // convention as every other adapted item-10 method in this folder.
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
      const rounded = Math.round(result.total * 100) / 100;
      const sum1 = result.actor1.reduce((a, b) => a + b, 0);
      const sum2 = result.actor2.reduce((a, b) => a + b, 0);
      return {
        question,
        verdict: String(rounded),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `sum(actor1)=${sum1} + sum(actor2)=${sum2} = ${rounded}`,
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
// ACCEPTED by accept_gates.cjs in the Founder's promoted order gate 1 then gate 2a then gate 4,
// then the perturbation gate (2b): baseline + 3 perturbations, all TRACK. See
// BISHOP_DROPZONE\D-BP223-M0-h2cbpqmc-010_PROMOTION_BATCH_1_FIVE_CLUSTERS.md for the full verdicts.
registerMethod(twoActorRelativeSubcategoryTotalsMethod);
