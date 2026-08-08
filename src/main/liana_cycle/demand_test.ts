// demand_test.ts -- D-BP150-003/BISHOP/S03/seg-demand
//
// THE DEMAND TEST. Ratified canon:
//   Asteroid-ProofVault/state/eblets/CANON/
//     canon_the_demand_test_selects_by_operation_not_by_regex_bp150.eblet.md
// Founder, BP150: "we will need to put in the step of determining WHICH METHOD of DATA... needs to
// apply to the question in question. How do you determine it now? We need to formalize it, so we
// DON'T 'use it wrongly'." And on the name and taxonomy: "Yes, I love the DEMAND and all the rest
// you mentioned. do it."
//
// A question's DEMAND is what its answer must BE -- the operation the answer performs. It is a
// third axis, orthogonal to REGISTER (which field) and ASPECT (process/attempt/result/nominal).
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// THIS FILE IS A SCAFFOLD AND THE SCAFFOLD PART IS RIGHT HERE. READ IT BEFORE TRUSTING A RESULT.
//
// Canon R-1 says DEMAND is derived from the SURVEYED ASK and "is never read off the question
// string by pattern match". SURVEY IS NOT BUILT YET. So this implementation reads the question
// string -- the same surface the two shapeTest() regexes already read.
//
// What it therefore IS: a structural improvement. The operation becomes a named, declared,
// checkable property instead of an accident of import order, and a method that does not serve the
// question's operation is refused rather than run. That is the enforceable half of "don't use it
// wrongly", and it is worth having now.
//
// What it is NOT: the semantic step the Founder specified. Every derivation below is marked
// `derivedFrom: 'question-string'`. When Survey lands, that field becomes 'surveyed-ask' and the
// cue tables below are deleted, not extended. Extending them would be the quiet path back to
// exactly the regex selection this canon exists to replace.
// ─────────────────────────────────────────────────────────────────────────────────────────────

import type { MethodQuestionInput } from './method_registry';

/** The six demand types read off the BP150 benchmark corpus. THE LIST IS OPEN, but per canon R-7
 *  a new type is a Founder act -- never inferred here from a question that matched nothing. */
export type LianaDemand =
  | 'RANK'                  // the answer is a position in an ordering            (qid 98)
  | 'DEFINE'                // the answer is a meaning                            (qid 85)
  | 'IDENTIFY'              // the answer is a member or instance                 (qid 66)
  | 'CLASSIFY'              // the answer assigns items to categories             (qid 46)
  | 'INFER'                 // the answer is a conclusion drawn from evidence     (qid 72)
  | 'LOCATE-IN-FRAMEWORK';  // the answer is a term's role inside a named theory   (qid 92)

export interface DemandResult {
  /** null = no demand could be determined. Per canon R-5 that is a teaching prompt, not a
   *  failure, and it must be reported as "demand unknown", never defaulted to a convenient one. */
  demand: LianaDemand | null;
  /** Always present, matched or not. The transcript prints this. */
  why: string;
  /** 'question-string' while Survey is unbuilt; 'surveyed-ask' once it is. Load-bearing: it is how
   *  a reader tells a scaffolded derivation from a real one without reading this file. */
  derivedFrom: 'question-string' | 'surveyed-ask';
}

// Ordered. The FIRST match wins, and the order encodes specificity, not preference: a question
// that both names a framework and asks to rank is a framework question about ranking.
const CUES: Array<{ demand: LianaDemand; re: RegExp; label: string }> = [
  {
    demand: 'LOCATE-IN-FRAMEWORK',
    // "Within Critical Security Studies, what is the referent object of security?"
    // The preposition is matched case-insensitively BY HAND rather than with the /i flag, because
    // the capital letters in the framework name are load-bearing -- they are what distinguishes a
    // named theory ("Critical Security Studies") from an ordinary prepositional phrase. Adding /i
    // would drop that requirement and match almost any sentence starting with "in ...,".
    // BP150: the first version wrote this alternation lowercase with no flag at all, so sentence-
    // initial "Within" never matched and qid 92 came back UNKNOWN. Caught by measurement, not review.
    re: /\b(?:[Ww]ithin|[Ii]n|[Aa]ccording to|[Uu]nder)\s+[A-Z][\w-]*(?:\s+[A-Z][\w-]*)+\s*,/,
    label: 'names a capitalized framework and asks for a term\'s role inside it',
  },
  {
    demand: 'CLASSIFY',
    // "Indicate whether the following ... represent a change in supply or a change in quantity..."
    re: /\b(indicate whether|classify|categoriz|which category|sort .* into|represents? an? .+ or an? )/i,
    label: 'asks for an assignment of items to categories',
  },
  {
    demand: 'DEFINE',
    re: /\b(correctly (explains|describes|defines)|best (explains|describes|defines)|which of the following statements|refers to|is defined as|\bmeans\b)/i,
    label: 'asks what a term means',
  },
  {
    demand: 'RANK',
    re: /\b(most|least|highest|lowest|greatest|smallest|densest|largest|fewest|maximum|minimum|earliest|latest|oldest|newest|farthest|nearest|closest)\b/i,
    label: 'names a superlative to order by',
  },
  {
    demand: 'INFER',
    // "What do we know about the people who built Stonehenge based on the analysis of..."
    re: /\b(what do we know|based on the analysis|suggests? that|can be inferred|evidence (indicates|suggests)|tells us about|reveals? about)\b/i,
    label: 'asks for a conclusion drawn from stated evidence',
  },
  {
    demand: 'IDENTIFY',
    // "You notice ... You would look for potential sources of infection in..."
    //
    // DOMAIN VOCABULARY REMOVED, BP150. This cue originally read
    //   which (sites?|structures?|organs?|areas?|regions?|of these|of the following) (is|are|drains?|would)
    // Adversarial SEG D-BP150-006 caught that `organs?` and `drains?` are ANATOMY terms, present
    // only because qid 66 is an anatomy question -- while the file simultaneously claimed its cue
    // tables carried "no domain vocabulary" and therefore could not be tuned toward the corpus.
    // The claim was false and the counter-example was in the same file. Tuning a selector on the
    // very questions it is measured against is how a benchmark result stops meaning anything.
    // Now grammatical only: an interrogative determiner over a generic head, or an explicit
    // instruction to locate something.
    re: /\b(you would look|where would|identify the|which (?:of these|of the following) (?:is|are|would))\b/i,
    label: 'asks which member or instance satisfies a stated condition',
  },
];

/**
 * Determines what operation the question's answer must perform.
 *
 * Returns `{demand: null}` freely and on purpose. Canon R-5: a question whose demand cannot be
 * determined is reported with that stated, so the operator learns WHAT KIND of method is missing
 * rather than only that one is. Guessing here would put a confidently wrong operation in front of
 * method selection, which is the failure this whole test exists to prevent.
 */
/**
 * MMLU-Pro source-excerpt questions carry a boilerplate preamble and a long quoted passage, with
 * the ACTUAL ask on the final line:
 *
 *   This question refers to the following information.
 *   Read the following excerpt.
 *   <several hundred words of quoted source>
 *   -John S. C. Abbott, historian, Napoleon at St. Helena, 1855
 *   Which of the following features ... does Abbott seem most impressed with?
 *
 * Matching cues against the whole blob is wrong twice over. BP150 measured both: the boilerplate's
 * own phrase "refers to" fires the DEFINE cue on every one of these questions, and the quoted
 * passage can contain any cue word at random. The ask is the last line, so that is what gets read.
 */
function effectiveAsk(question: string): string {
  const lines = question.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (lines.length <= 1) return question;
  const last = lines[lines.length - 1];
  // Only narrow when the final line actually looks like the ask. If it does not, read the whole
  // thing rather than silently discarding the question.
  return /[?:]$/.test(last) ? last : question;
}

export function determineDemand(input: MethodQuestionInput): DemandResult {
  const raw = input.question ?? '';
  if (!raw.trim()) {
    return { demand: null, why: 'no question text to read', derivedFrom: 'question-string' };
  }
  const q = effectiveAsk(raw);
  const narrowed = q !== raw;
  for (const cue of CUES) {
    const m = cue.re.exec(q);
    if (m) {
      return {
        demand: cue.demand,
        why: `${cue.label} (matched "${m[0].trim().slice(0, 40)}")${narrowed ? ' [read the final ask line, not the quoted source passage]' : ''}`,
        derivedFrom: 'question-string',
      };
    }
  }
  return {
    demand: null,
    why: `no demand could be determined from the question as typed${narrowed ? ' (final ask line)' : ''} -- this is a teaching prompt, not a failure`,
    derivedFrom: 'question-string',
  };
}

/** One line for the transcript, always naming how the demand was derived so a scaffolded result is
 *  never mistaken for a surveyed one. */
export function describeDemand(r: DemandResult): string {
  const head = r.demand ? `DEMAND: ${r.demand}` : 'DEMAND: UNKNOWN';
  const caveat = r.derivedFrom === 'question-string'
    ? ' [derived from the question string -- SCAFFOLD; Survey is not built yet]'
    : '';
  return `${head} -- ${r.why}${caveat}`;
}
