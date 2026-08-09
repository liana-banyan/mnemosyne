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
// D-BP150-014 -- THE SURVEYED-ASK PATH. checkKind() is a VALUE import (no second classifier
// written here, per that element's own header discipline); SurveyAskNestedResult is a TYPE-ONLY
// import so it is erased at compile time and cannot create a runtime import cycle with
// elements/survey_ask.ts (which itself imports a type from this module's sibling,
// method_registry.ts -- see determineDemandFromSurveyedAsk()'s own header for why this ordering is
// safe).
import { checkKind } from './elements/kind_check';
import type { SurveyAskNestedResult } from './elements/survey_ask';

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
// D-BP150-014: exported (previously module-private) so the surveyed-ask measurement path can feed
// the SAME narrowed ask text into surveyAskNested() that determineDemand() already reads for the
// string path -- an apples-to-apples comparison between the two derivations, not two different
// inputs. No behavior change to any existing caller.
export function effectiveAsk(question: string): string {
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

// ─────────────────────────────────────────────────────────────────────────────────────────────
// D-BP150-014 -- THE SURVEYED-ASK PATH, ALONGSIDE THE SCAFFOLD ABOVE, NOT REPLACING IT.
//
// Canon R-1: "DEMAND is derived from the surveyed ASK ... never read off the question string by
// pattern match." This function is the first implementation of that rule: it takes a
// SurveyAskNestedResult (elements/survey_ask.ts's nest form, D-BP150-014) -- the actual output of
// running Survey on the ASK -- and derives DEMAND from ITS STRUCTURE, never from `input.question`.
//
// This file's own header (above) says: "When Survey lands, the cue tables are DELETED, not
// extended." THEY ARE NOT DELETED HERE, ON PURPOSE. determineDemandFromSurveyedAsk() is added
// ALONGSIDE determineDemand() so both can be measured against each other on the same corpus before
// either is trusted alone -- deleting the scaffold before the replacement is proven would destroy
// the only baseline this estate has. See D-BP150-014's return for the surveyed-vs-string
// comparison across the six canon benchmark questions. Bishop and the Founder decide when the cue
// tables die, per this ticket's own instruction -- this function does not decide that for them.
//
// WHAT IS ACTUALLY DERIVABLE FROM THE SURVEYED ASK TODAY, AND WHAT IS NOT, STATED HONESTLY:
//   - LOCATE-IN-FRAMEWORK: the nest produced a 'framework' level (elements/nest.ts's own
//     "within/in <Capitalized Span>" rule) -- a term's role inside a named theory is exactly what a
//     resolved framework level means structurally.
//   - DEFINE: the MOST SPECIFIC surveyed level (the last one -- whole-phrase, or existence-check
//     when the nest produced one) returned at least one denotation whose sentence kind-checks
//     (elements/kind_check.ts's checkKind(), NOT a second classifier) as DEFINITION-STATEMENT -- a
//     clause stating what a term means is exactly a denotation answering "what does this mean",
//     which is what DEFINE requires.
//   - RANK / CLASSIFY / IDENTIFY / INFER: NOT YET DERIVABLE from the surveyed ASK term's own
//     denotations alone. These four characterize an OPERATION ON THE OPTIONS (order them, sort
//     them into categories, pick the member that fits, draw a conclusion) -- none of that is
//     visible in what the ASK's own term denotes. Reaching them honestly needs E-SURVEY-ANSWERS
//     and/or E-CATALYST-WORDS signals this function does not consume. Returning `null` here for a
//     question whose true demand is one of these four is NOT a defect being papered over; it is
//     the accurate report of what this element can and cannot see yet, named per canon R-5 --
//     "a question whose demand no method serves is a teaching prompt, not a failure."
// ─────────────────────────────────────────────────────────────────────────────────────────────

export function determineDemandFromSurveyedAsk(nested: SurveyAskNestedResult): DemandResult {
  const frameworkLevel = nested.levels.find((l) => l.level.label === 'framework');
  if (frameworkLevel) {
    return {
      demand: 'LOCATE-IN-FRAMEWORK',
      why: `the surveyed ask decomposed a framework level ("${frameworkLevel.level.text}") via the `
        + `Nest Method (elements/nest.ts) -- ${frameworkLevel.level.why}`,
      derivedFrom: 'surveyed-ask',
    };
  }

  const mostSpecific = nested.levels[nested.levels.length - 1];
  if (mostSpecific) {
    for (const d of mostSpecific.survey.denotations) {
      const kc = checkKind(d.sentence);
      if (kc.type === 'DEFINITION-STATEMENT') {
        return {
          demand: 'DEFINE',
          why: `the most specific surveyed level ("${mostSpecific.surveyedTerm}") returned a `
            + `denotation that kind-checks as DEFINITION-STATEMENT (${kc.why}): "${d.sentence}"`,
          derivedFrom: 'surveyed-ask',
        };
      }
    }
    if (mostSpecific.survey.denotations.length === 0) {
      return {
        demand: null,
        why: `no denotations were found for the surveyed ask ("${mostSpecific.surveyedTerm}") -- `
          + 'nothing to derive an operation from; this is a teaching prompt (canon R-5), not a '
          + 'fabricated guess',
        derivedFrom: 'surveyed-ask',
      };
    }
  }

  return {
    demand: null,
    why: 'the surveyed ask carries no framework level and no denotation kind-checks as a '
      + 'DEFINITION-STATEMENT -- RANK/CLASSIFY/IDENTIFY/INFER are not yet derivable from the '
      + 'surveyed ASK term\'s own denotations alone (they characterize the operation on the '
      + 'OPTIONS, not the ASK); an honest gap, not a fabrication -- see D-BP150-014\'s return',
    derivedFrom: 'surveyed-ask',
  };
}
