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
// D-BP153-001 -- THE STRUCTURAL PATH (see determineDemandFromQuestionStructure()'s own header,
// bottom of this file). VALUE import, deliberately: the whole point is to call the SAME detector
// classify_cascade.ts's run() already gates its superlative route on, rather than write a second
// one here. No cycle: classify_cascade.ts imports method_registry and its own elements, never this
// module (verified by reading its import block, BP153).
import { extractSuperlativeMatch } from './methods/classify_cascade';

/** The six demand types read off the BP150 benchmark corpus, plus a seventh added at BP164.
 *  THE LIST IS OPEN, but per canon R-7 a new type is a Founder act -- never inferred here from a
 *  question that matched nothing.
 *
 *  D-BP164-M0-112/BISHOP/M0/seg-toolbox -- 'COMPUTE' ADDED, R-7 SATISFIED. `arithmetic_cascade.ts`
 *  and `stage3_symbolic_cascade.ts` (D-BP164-M0-037, D-BP164-M0-054) each carried a PROVISIONAL
 *  `demand: 'COMPUTE' as unknown as LianaDemand` cast, both stating in their own headers that
 *  adding 'COMPUTE' here is the unmade Founder act R-7 requires. This dispatch's Founder ruling
 *  makes that act: "we need to make an open-ended response, clearly, to run that. And when the
 *  next test has a different requirement of necessity, like it's True/False only, we will add
 *  that to the list of things we can do, as well." COMPUTE is the first of that open list: the
 *  answer is a value derived by computation from the question text alone (OlympiadBench,
 *  ASDiv/GSM8K, and the Stage 3 generated shapes). Both cascades' casts are removed in the same
 *  dispatch (see each file's own `demand:` line) now that this is a real member, not a workaround. */
export type LianaDemand =
  | 'RANK'                  // the answer is a position in an ordering            (qid 98)
  | 'DEFINE'                // the answer is a meaning                            (qid 85)
  | 'IDENTIFY'              // the answer is a member or instance                 (qid 66)
  | 'CLASSIFY'              // the answer assigns items to categories             (qid 46)
  | 'INFER'                 // the answer is a conclusion drawn from evidence     (qid 72)
  | 'LOCATE-IN-FRAMEWORK'   // the answer is a term's role inside a named theory   (qid 92)
  | 'COMPUTE';              // the answer is a value derived by computation        (BP164)

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
//     when the nest produced one) returned at least one denotation whose sentence EITHER kind-checks
//     (elements/kind_check.ts's checkKind(), NOT a second classifier -- unmodified, see D-BP157-053
//     below for why) as DEFINITION-STATEMENT, OR carries a real-prose definitional construction per
//     looksLikeDefinitionalProse() (this file, D-BP157-053) -- a clause stating what a term means is
//     exactly a denotation answering "what does this mean", which is what DEFINE requires.
//   - RANK / CLASSIFY / IDENTIFY / INFER: NOT YET DERIVABLE from the surveyed ASK term's own
//     denotations alone. These four characterize an OPERATION ON THE OPTIONS (order them, sort
//     them into categories, pick the member that fits, draw a conclusion) -- none of that is
//     visible in what the ASK's own term denotes. Reaching them honestly needs E-SURVEY-ANSWERS
//     and/or E-CATALYST-WORDS signals this function does not consume. Returning `null` here for a
//     question whose true demand is one of these four is NOT a defect being papered over; it is
//     the accurate report of what this element can and cannot see yet, named per canon R-5 --
//     "a question whose demand no method serves is a teaching prompt, not a failure."
// ─────────────────────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────────────────────
// D-BP157-053/BISHOP/seg-define-detection-bug -- THE DEFINE-DETECTION FIX FOR THE SURVEYED-ASK
// PATH, SPECIFICALLY. Ratified by D-BP150-014's own return, "SURVEYED-ASK vs QUESTION-STRING
// DEMAND," reason 2 (this file's own sibling return doc): "fixing it needs either a second, more
// general definitional-shape check for the SURVEYED-ASK path specifically, or a different signal
// entirely." This is that second check. checkKind() (elements/kind_check.ts) is NOT modified --
// its DEFINITION_LEAD_RE is a closed, sentence-INITIAL rule ("^It (describes|refers to|denotes|
// means|represents|indicates|explains)") that matches the MMLU-Pro OPTION-phrasing convention
// (D4's extraction target -- an option written as a self-contained gloss, "It describes a process
// that..."), never how real Google prose actually states a definition. Verified live at D-BP150-014
// qid 85: the real passage found by Survey, "A sampling method is called biased if it
// systematically favors some outcomes over others.", kind-checks as plain PROPOSITION (it has a
// finite-verb marker, "is", but no DEFINITION_LEAD_RE match) -- so determineDemandFromSurveyedAsk()
// never fired DEFINE for the one qid it should have. That miss is confirmed here, from the code,
// not merely asserted from the return document (HARDWIRE-26): kind_check.ts:93's regex is exactly
// as narrow as the return doc says, and this file's DEFINE loop (below) previously consulted
// nothing else.
//
// checkKind() is left untouched on purpose, matching this ticket's own instruction not to
// silently change other behavior: survey_answers.ts's E-SURVEY-ANSWERS still relies on
// checkKind() to type MMLU-Pro OPTION text (where the "It describes..." convention is the correct,
// intended signal -- qid 85's own options F-5 canon table), and widening DEFINITION_LEAD_RE there
// would change that unrelated call site's behavior with no test coverage in this ticket. Instead,
// this second check lives HERE, scoped to the surveyed-ask DEFINE path only, and runs ALONGSIDE
// (never replacing) the checkKind() check above -- an MMLU-Pro-shaped denotation is still caught by
// checkKind() exactly as before; a real-prose denotation is now ALSO caught, by this pattern set.
//
// GRAMMATICAL SIGNALS ONLY, closed class, same discipline as kind_check.ts's own header: every
// pattern below is a generic English definitional/naming construction (copula + "called"/"known
// as"/"defined as", or the reporting verbs "refers to"/"denotes"), not a word pulled from any
// benchmark question's own vocabulary.
//
// KNOWN, DECLARED LIMITATION: "is/are/was/were called X" also matches the English idiom "called
// into question/doubt", which is NOT a definition (it means "disputed"), so that idiom is excluded
// by a negative lookahead. This is a grammatical exception (a fixed idiom), not a domain-vocabulary
// carve-out. No claim is made that every possible false positive is excluded -- only this measured
// one, plus the general shape a definitional clause takes in prose.
// ─────────────────────────────────────────────────────────────────────────────────────────────

const REAL_PROSE_DEFINITION_PATTERNS: { re: RegExp; label: string }[] = [
  {
    re: /\b(?:is|are|was|were)\s+(?:called|known\s+as)\s+(?!into\b)/i,
    label: '"is/are/was/were called/known as" (naming construction; excludes the "called into '
      + 'question/doubt" idiom, which is not definitional)',
  },
  {
    re: /\b(?:is|are|was|were)\s+defined\s+as\b/i,
    label: '"is/are/was/were defined as"',
  },
  {
    re: /\brefers?\s+to\b/i,
    label: '"refers/refer to"',
  },
  {
    re: /\bdenotes?\b/i,
    label: '"denotes"',
  },
];

/**
 * Real-prose definitional-shape check, SCOPED TO THE SURVEYED-ASK DEFINE PATH (this file). Pure,
 * mechanical, grammatical-signal only -- see the section header immediately above for the full
 * discipline and why this exists alongside checkKind() rather than inside it.
 */
export function looksLikeDefinitionalProse(
  sentence: string,
): { isMatch: boolean; label: string | null; matchedText: string | null } {
  const t = String(sentence ?? '').trim();
  if (!t) return { isMatch: false, label: null, matchedText: null };
  for (const { re, label } of REAL_PROSE_DEFINITION_PATTERNS) {
    const m = re.exec(t);
    if (m) {
      return { isMatch: true, label, matchedText: m[0].trim() };
    }
  }
  return { isMatch: false, label: null, matchedText: null };
}

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
      // D-BP157-053: checkKind()'s DEFINITION_LEAD_RE only fires on the MMLU-Pro option-phrasing
      // convention ("It describes/refers to/..."), not on how real Google prose states a
      // definition -- see this file's section header above. This second, narrower check catches
      // the real-prose shape without touching checkKind() or its other call sites.
      const realProse = looksLikeDefinitionalProse(d.sentence);
      if (realProse.isMatch) {
        return {
          demand: 'DEFINE',
          why: `the most specific surveyed level ("${mostSpecific.surveyedTerm}") returned a `
            + `denotation carrying a real-prose definitional construction (${realProse.label}, `
            + `matched "${realProse.matchedText}") even though it does not kind-check as `
            + `DEFINITION-STATEMENT (kind-check: ${kc.type ?? 'unrecognized'}) -- `
            + `determineDemandFromSurveyedAsk()'s D-BP157-053 fix for the D-BP150-014 qid-85 DEFINE `
            + `miss: "${d.sentence}"`,
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
      + 'DEFINITION-STATEMENT or carries a real-prose definitional construction (D-BP157-053) -- '
      + 'RANK/CLASSIFY/IDENTIFY/INFER are not yet derivable from the surveyed ASK term\'s own '
      + 'denotations alone (they characterize the operation on the OPTIONS, not the ASK); an honest '
      + 'gap, not a fabrication -- see D-BP150-014\'s return',
    derivedFrom: 'surveyed-ask',
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// D-BP151-032 -- THE AMBIGUITY PATH'S ADAPTER. REUSES determineDemandFromSurveyedAsk() ABOVE. IT
// IS NOT A SECOND DEMAND DERIVATION.
//
// THE MEASURED FAILURE THIS CLOSES. survey_stage.ts's D-BP151-031 amendment gave Step 2's no-term
// path a way to produce a demand-shaped result even without a single quoted/cued term: when the
// source names one or more ambiguous terms (FounderStep2Result.ambiguityNested, survey_stage.ts),
// EACH is surveyed via the same surveyAskNested() the quoted/cued path already uses -- but nothing
// consumed that array. liana_terminal_engine.ts's one call site
// (`surveyResult.step2.nested ? determineDemandFromSurveyedAsk(...) : ...`) keyed off `step2.nested`
// alone, which stays null on the ambiguity path BY DESIGN (there is no single term to hand it --
// there can be several). qid 98 names no quoted/cued term, so it always took the null branch and
// abstained with `error: "demand_unknown"` even after D-BP151-031 landed. See that ticket's own
// return, "THINGS I NOTICED AND DID NOT DO", item 1, for the same finding stated at landing time.
//
// WHAT THIS FUNCTION ADAPTS, EXACTLY. `ambiguityNested` is `Array<{term, nested}>` --
// determineDemandFromSurveyedAsk()'s declared parameter type is a single `SurveyAskNestedResult`.
// Each `ambiguityNested[i].nested` already IS that exact type (surveyAskNested()'s own return
// value, unmodified -- see survey_stage.ts's own doc comment on the field). So the only adaptation
// needed is ITERATION: call the existing function once per named term's nested result. No demand
// logic (no cue table, no denotation reading, no kind-checking) is written in this function --
// every actual demand judgment still happens exactly once, inside determineDemandFromSurveyedAsk().
//
// THE ONE DECISION THIS FUNCTION DOES MAKE, AND WHY IT IS NOT A TARE. When more than one term is
// named, their surveyed asks can each independently produce a demand, and those demands can
// DISAGREE. HARDWIRE-23 Law 1 names a tie-break or priority list among competing signals as
// exactly the shape of unordered rule that is forbidden -- no Founder order picks a "most
// important" ambiguity-named term, and inventing one here (first-named wins, longest-denotation
// wins, any of it) would be exactly that tare. So this function makes NO CHOICE among competing
// demands: it accepts a result only when every term that produced ANY demand agrees on the SAME
// one (vacuously true when there is only one non-null result, which is what qid 98's live run
// measured -- D-BP151-031 test 1f named exactly one term). On disagreement, or when nothing usable
// came back from any term, it reports UNKNOWN -- canon R-5's own "refuse rather than guess" rule
// applied to more than one candidate instead of one, never inferred as a new rule of its own. See
// this ticket's return, "ANY FORK YOU STOPPED ON", for the open question this leaves for the
// Founder if disagreement is ever actually measured on live data.
// ─────────────────────────────────────────────────────────────────────────────────────────────
export function determineDemandFromAmbiguityNested(
  ambiguityNested: Array<{ term: string; nested: SurveyAskNestedResult }>,
): DemandResult {
  if (!ambiguityNested.length) {
    return {
      demand: null,
      why: 'the surveyed ask\'s ambiguity path named no terms to survey -- nothing to derive a demand from',
      derivedFrom: 'surveyed-ask',
    };
  }

  // Reuse only. determineDemandFromSurveyedAsk() is called unmodified, once per named term.
  const perTerm = ambiguityNested.map((e) => ({ term: e.term, result: determineDemandFromSurveyedAsk(e.nested) }));
  const withDemand = perTerm.filter((p) => p.result.demand !== null);

  if (!withDemand.length) {
    return {
      demand: null,
      why: `ambiguity path named ${ambiguityNested.length} term(s) `
        + `(${ambiguityNested.map((e) => `"${e.term}"`).join(', ')}); each was run through `
        + 'determineDemandFromSurveyedAsk() unmodified and none produced a determinable demand -- '
        + 'this is a teaching prompt (canon R-5), not a fabricated guess',
      derivedFrom: 'surveyed-ask',
    };
  }

  const distinctDemands = new Set(withDemand.map((p) => p.result.demand));
  if (distinctDemands.size > 1) {
    return {
      demand: null,
      why: `ambiguity path named ${ambiguityNested.length} term(s); ${withDemand.length} of them produced a `
        + `demand via determineDemandFromSurveyedAsk() and they DISAGREE `
        + `(${withDemand.map((p) => `"${p.term}" -> ${p.result.demand}`).join('; ')}) -- no priority rule among `
        + 'ambiguity-named terms has been ordered (HARDWIRE-23 Law 1), so this reports UNKNOWN rather than '
        + 'picking a winner; see this ticket\'s return for the open fork',
      derivedFrom: 'surveyed-ask',
    };
  }

  const winner = withDemand[0];
  return {
    demand: winner.result.demand,
    why: `ambiguity path named ${ambiguityNested.length} term(s) `
      + `(${ambiguityNested.map((e) => `"${e.term}"`).join(', ')}); ${withDemand.length} of them produced a `
      + `demand via determineDemandFromSurveyedAsk() ${withDemand.length > 1 ? 'and they agree' : '(the only one that did)'} `
      + `-- "${winner.term}" -> ${winner.result.demand}: ${winner.result.why}`,
    derivedFrom: 'surveyed-ask',
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// D-BP152-005 -- PART 2 OF THE FOUNDER'S OPENING QUERY. THE DIRECT SIGNAL, NOT ANOTHER INFERENCE.
//
// ATTRIBUTED: Founder, BP152, verbatim (FD-BP152-05, the whole two-part query he opens every
// question with): PART 1 is the existing ambiguity query (survey_stage.ts's askAmbiguity(),
// unchanged by this ticket); PART 2, built this ticket (survey_stage.ts's askOperation()), asks:
//
//   "And then what operation does this question require in order to answer it: does it want
//   things ranked, defined, classified, or inferred from evidence?"
//
// THE MEASURED FAILURE THIS CLOSES. LIANA_RUN_qid98_2026-08-10T03-53-08-736Z.json ended
// `abstain: true, error: "demand_unknown"` -- Part 2 asks for exactly the value whose absence
// killed that run (FD-BP152-05's own "WHY THIS IS THE QUERY THAT MATTERS" section).
//
// THIS FUNCTION MAPS, IT NEVER GUESSES. `rawAnswer` (survey_stage.ts's OperationQueryResult, the
// source's own stated answer to Part 2, copied verbatim, never interpreted there) is matched
// against ONLY the words/phrases Part 2 itself offered -- this is NOT a cue table read off the
// question string (the thing this file's own header says dies when Survey lands): it is a closed
// lookup over an answer the SOURCE gave to a question WE constrained to exactly six choices.
//
// GAP 1 (FD-BP152-05) -- CLOSED, D-BP152-023, per FD-BP152-16 ("part two should offer all six
// demand types"). His original wording offered ranked/defined/classified/inferred-from-evidence --
// four of the six LianaDemand types; IDENTIFY and LOCATE-IN-FRAMEWORK could never be returned. The
// query text in `resources/liana_survey_queries.json` (`survey.operation.askedText`) now offers
// all six -- his four words unchanged, plus a TARE-flagged addition ('identified', 'placed within
// a framework') so the two remaining types can be returned. See that file's own `attribution`
// field for which words are his and which are not.
//
// CANON R-5, UNCHANGED. An answer that names none of the six words/phrases, or more than one of
// them, or is absent, returns `demand: null` -- never a default, never a guess. This function
// never falls back to determineDemand()'s CUES table (that table is not imported into or
// referenced by this function at all); liana_terminal_engine.ts's own call site names, in its own
// transcript line, which path (nested / operation / ambiguity / none) produced the demand it
// acted on.
//
// GAP 1 CLOSED, D-BP152-023, per FD-BP152-16 ("part two should offer all six demand types").
// `resources/liana_survey_queries.json`'s `survey.operation.askedText` now offers all six; the two
// FOUNDER words below (ranked/defined/classified/inferred from evidence) are unchanged from
// D-BP152-005 -- their four regex entries are untouched, byte-for-byte, from before this ticket.
// The two new entries (IDENTIFY, LOCATE-IN-FRAMEWORK) map the TARE wording the JSON file's own
// `attribution` field flags as Bishop's, not the Founder's -- see that file for the exact words and
// why. This function still picks nothing: it is the same closed lookup over an answer the SOURCE
// gave to a question WE constrained, now to six choices instead of four.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** The six words/phrases Part 2 itself now offers (FD-BP152-16), mapped onto the six LianaDemand
 *  types. Order does not matter for a match -- `hits` below reports every match, not just the
 *  first, so an answer naming more than one word/phrase is caught as ambiguous rather than
 *  silently resolved by array order. RANK/DEFINE/CLASSIFY/INFER are the Founder's own four words,
 *  regexes unchanged from D-BP152-005. IDENTIFY and LOCATE-IN-FRAMEWORK are new, D-BP152-023,
 *  matching the TARE wording added to `survey.operation.askedText` -- distinct stems, no overlap
 *  with the four Founder words or each other. */
const OPERATION_ANSWER_MAP: Array<{ demand: LianaDemand; re: RegExp }> = [
  { demand: 'RANK', re: /\brank/ },
  { demand: 'DEFINE', re: /\bdefin/ },
  { demand: 'CLASSIFY', re: /\bclassif/ },
  { demand: 'INFER', re: /\binfer/ },
  { demand: 'IDENTIFY', re: /\bidentif/ },
  { demand: 'LOCATE-IN-FRAMEWORK', re: /\bframework/ },
];

/**
 * Maps PART 2's raw stated answer (survey_stage.ts's `OperationQueryResult.rawAnswer`, verbatim,
 * uninterpreted) onto a `LianaDemand`. See this section's own header, immediately above, for the
 * full ruling, GAP 1, and why this is a closed lookup rather than a cue table.
 */
export function determineDemandFromOperationAnswer(rawAnswer: string | null): DemandResult {
  if (!rawAnswer || !rawAnswer.trim()) {
    return {
      demand: null,
      why: 'the operation query (Part 2 of the Founder\'s opening query, FD-BP152-05) returned no '
        + 'usable answer -- an honest null, not a fabrication',
      derivedFrom: 'surveyed-ask',
    };
  }
  const a = rawAnswer.toLowerCase();
  const hits = OPERATION_ANSWER_MAP.filter((m) => m.re.test(a));
  if (hits.length === 1) {
    return {
      demand: hits[0].demand,
      why: `the operation query's answer ("${rawAnswer}") named "${hits[0].demand.toLowerCase()}" -- one `
        + 'of the six words/phrases Part 2 now offers (ranked/defined/classified/inferred from evidence, '
        + 'his four words, plus identified/placed within a framework, TARE-flagged, FD-BP152-16, '
        + 'D-BP152-023)',
      derivedFrom: 'surveyed-ask',
    };
  }
  if (hits.length > 1) {
    return {
      demand: null,
      why: `the operation query's answer ("${rawAnswer}") matched more than one of the six offered `
        + `words/phrases (${hits.map((h) => h.demand).join(', ')}) -- ambiguous, reporting UNKNOWN rather `
        + 'than picking one',
      derivedFrom: 'surveyed-ask',
    };
  }
  return {
    demand: null,
    why: `the operation query's answer ("${rawAnswer}") did not name any of the six words/phrases Part 2 `
      + 'offers (ranked/defined/classified/inferred from evidence/identified/placed within a framework) '
      + '-- an honest null, not a fabrication',
    derivedFrom: 'surveyed-ask',
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// D-BP153-001 -- THE STRUCTURAL PATH. LAST RESORT, AFTER ALL THREE SURVEYED-ASK PATHS REFUSE.
//
// THE MEASURED FAILURE THIS CLOSES. Live run, Downloads\latestTest.md (qid 98, confirmed by that
// file's own SOURCE header): SURVEY STEP 2 found no cued term, so the ambiguity query ran; Google
// answered the GENERIC ambiguity query rather than the question, returning "words", "phrases",
// "meaning", "fundamentally"; the sig-figs rule correctly dropped all four (they are not literal
// spans of qid 98 -- the rule D-BP152-052/e41ff93d added). That left ZERO surviving terms, so the
// ternary in liana_terminal_engine.ts fell to its `'none'` branch and the whole run ended
// `DEMAND: UNKNOWN` at latestTest.md:561 -- before method selection, before classify-cascade,
// before North Africa's density was ever asked about. Every component behaved correctly. The run
// still could not start.
//
// WHAT WAS ACTUALLY WRONG. Two components already agreed on this question's shape and were not
// connected to each other. `run()` in methods/classify_cascade.ts:1595 gates its entire
// superlative-by-magnitude route -- the route built at D-BP152-038/c2b6524c to replicate the
// Founder's own hand-worked qid-98 resolution -- on `extractSuperlativeMatch()`, which matches
// "most densely populated" in qid 98 today. But nothing could ever REACH `run()`, because DEMAND
// derivation, which decides whether classify-cascade is selected at all, consulted only the survey
// and never the question's own grammar. A detector that correctly identifies the question is
// useless downstream of a gate that refuses before it is called.
//
// WHY THIS IS A LOGIC FIX AND NOT GATE-WIDENING. It does not relax the sig-figs rule, does not
// widen findAskCatalyst() to swallow the question's subject noun phrase, does not lower a
// threshold, and does not add a cue table. It writes NO new detector: it calls
// `extractSuperlativeMatch()`, the exact function `run()` already trusts to route this question,
// which itself tests SUPERLATIVE_PROPERTY_RE, the exact regex extractClassifyCandidateTerms()
// already matches. Nothing here is tuned toward qid 98's answer key, and this function never sees
// an option list or an answer -- only the question's grammar.
//
// WHY CLASSIFY. The Founder ruled it by name: FD-BP152-06, "qid 98 IS CLASSIFY", already cited at
// classifyCascadeMethod's own `taughtBy` (classify_cascade.ts:1611). `classifyCascadeMethod.demand`
// is 'CLASSIFY', and its `run()` sends a structural superlative to runSuperlativeByMagnitude().
// Returning CLASSIFY here is what connects his ruling to the route built to serve it. NOTE the
// stale comment at LianaDemand's own 'RANK' line above, which still annotates RANK with "(qid 98)"
// from the BP150 corpus reading -- that predates FD-BP152-06 and is not what governs.
//
// WHY 'question-string' AND NOT 'surveyed-ask'. That field exists so a reader can tell a derivation
// that came from the survey from one that did not, WITHOUT reading this file. This one did not come
// from the survey -- the survey refused, honestly, three times over. Labeling it 'surveyed-ask'
// would launder a structural inference as a surveyed finding. It is the ONLY path in this file that
// reports 'question-string', and that is the point.
//
// WHAT IT STILL REFUSES. A question with no structural superlative gets `demand: null` exactly as
// before. Refusing still beats guessing (canon R-5). This path can only ever fire where the
// question's own grammar carries the signal, and it runs LAST, so it can never override a demand
// the survey actually derived.
// ─────────────────────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────────────────────
// D-BP164-M0-112/BISHOP/M0/seg-toolbox -- SECOND STRUCTURAL DETECTOR, COMPUTE, ADDED HERE (NOT
// A PARALLEL PATH). Founder ruling this dispatch: "we need to make an open-ended response,
// clearly... and when the next test has a different requirement of necessity, like it's
// True/False only, we will add that to the list of things we can do, as well." That is an order
// to make ADDING a structural demand shape easy and obvious, not a one-off. So this function was
// refactored from one hardcoded check into an ORDERED LIST of small detectors
// (STRUCTURAL_DEMAND_DETECTORS below), tried in order, first match wins -- the superlative/CLASSIFY
// detector above is detector 1, unchanged in wording or behavior; COMPUTE is detector 2; a future
// True/False detector is a THIRD ENTRY in the same list, not a bolted-on branch.
//
// WHAT COMPUTE DETECTS. An open-ended (no lettered option pool, or fewer than two options -- the
// same threshold every cascade's own shapeTest() already uses) question whose own grammar asks for
// a derived value: a "compute/calculate/find/determine/evaluate/solve for/what is/how many/how
// much" cue PLUS numeric or algebraic/LaTeX math content (a digit, or a LaTeX math delimiter/
// command). Both conditions are read from `question`/`options` ONLY -- the same two fields this
// file's other structural derivations read, never a dataset's `answer_type` or any other
// answer-adjacent field (PART TEN, REPLICATION_PROTOCOL_BP159.md).
//
// THIS IS DEMAND, NOT SELECTION. Matching COMPUTE here says only "this answer must be a computed
// value" -- it does NOT claim any registered method can produce one. `method_registry.ts`'s
// `selectMethod()` still runs every COMPUTE method's own `shapeTest()` afterward and can honestly
// refuse (e.g. neither `arithmetic_cascade.ts` nor `stage3_symbolic_cascade.ts` matches a
// competition-math system-of-equations problem) -- that is `no_method_matched`, a DIFFERENT and
// more informative outcome than `demand_unknown`, per this file's canon R-5 doctrine (name what is
// missing, don't just say nothing ran).
//
// WHY THIS EXTENDS THE PATH RATHER THAN A NEW ONE (per this dispatch's own instruction to look at
// what exists before building): it is the SAME function, the SAME last-resort ordering (tried only
// after all three surveyed-ask derivations refuse), the SAME 'question-string' labeling discipline,
// and the SAME refuse-beats-guess return shape as the CLASSIFY detector it now sits beside.
const COMPUTE_CUE_RE = /\b(compute|calculate|evaluate|determine|find (?:the|all)|what is|how many|how much|solve for)\b/i;
const MATH_CONTENT_RE = /[0-9]|\$[^$]*\$|\\frac|\\log|\\sum|\\int|\\sqrt|\^\d|\^\{|_\{/;

// ─────────────────────────────────────────────────────────────────────────────────────────────
// D-BP165-M0-020/BISHOP/M0/seg-demand -- THIRD AND FOURTH STRUCTURAL DETECTORS, WIDENING FOR
// ORDINARY LETTERED MCQ STEMS. Founder ruling this dispatch, verbatim: "do #2, widen the
// structural detector ... Narrow, additive, keeps Survey off, and it is the same structural path
// already extended once at D-BP164-M0-112 for exactly this kind of reason."
//
// THE MEASURED FAILURE THIS CLOSES. D-BP165-M0-019's n=50 stratified sweep (seed 42, dataset sha
// 51d7b60cb50f027a564d57df2e8db671af7f084c34481cfb37285b6d3eb0c1b1) returned 50 of 50 ABSTAINED,
// ZERO LLM CALLS: 42/50 `demand_unknown`, the other 8 reached classify-cascade (routed by the
// pre-existing `classify-superlative` detector below) and abstained only because their frame
// query needs `askGoogle`, a SEPARATE, already-known limitation (Survey is OFF by default,
// Founder's own preference) -- not this file's problem and not touched here. Every one of the 42
// `demand_unknown` items carries a LETTERED OPTION POOL (an ordinary MMLU-Pro MCQ) -- exactly the
// shape `compute-open-ended` (D-BP164-M0-112) refuses on sight (`hasOptionPool` returns null
// immediately) and no detector in this list had ever looked at.
//
// WHY WIDENING, NOT A NEW DETECTOR CLASS, AND NO NEW LianaDemand MEMBER. Canon R-7: "a new type is
// a Founder act, never inferred here." Neither entry below mints one. Both map a real MCQ shape
// onto a demand type that ALREADY EXISTS: COMPUTE (D-BP164-M0-112) and IDENTIFY (BP150 corpus,
// registered with `run: null` in untaught_shapes.ts, D-BP153-008, so a question that resolves to
// it gets an honest "recognized shape, not yet taught" instead of silence). Both entries read ONLY
// `question` and `options` -- never `answer`/`answer_index`/`category`/`src`
// (PART TEN, REPLICATION_PROTOCOL_BP159.md) -- and both return `demand: null` freely rather than
// stretch a type past what it means (this dispatch's own instruction: "a wrong demand is worse
// than demand_unknown").
//
// FIXTURES ARE REAL, NOT INVENTED. Every question_id cited below is drawn from the ACTUAL 42-item
// `demand_unknown` set the n=50 baseline report names
// (BISHOP_DROPZONE/D-BP165-M0-019_MMLU_PRO_SWEEP/mmlu_pro_subset_report_D-BP165-M0-019.json,
// `perItem[].error === "demand_unknown"`), read directly against
// C:\Users\Administrator\Documents\DATASETS\MMLU-Pro\mmlu-pro-test.jsonl (12,032 rows, 14
// categories) -- not the six-question BP150 corpus these older detectors were tuned against.
//
// ── ENTRY 3: compute-mcq-numeric-options (COMPUTE) ──
// WHAT IT DETECTS. The EXACT SAME two signals `compute-open-ended` already requires on the
// question text (COMPUTE_CUE_RE, MATH_CONTENT_RE -- unmodified, reused, never duplicated-and-
// diverged) PLUS one new signal read from `options`, which is what "using the options it is
// already handed" (the Founder's own phrase, this dispatch) means concretely: every option value
// contains at least one digit (`allOptionsCarryADigit()` below). That third signal is what tells a
// genuinely computed-value MCQ (qid 638's ten dollar-figure options; qid 8165's ten bare numbers)
// apart from an MCQ whose options are qualitative (names, categories, prose claims) -- the exact
// case `compute-open-ended` was already correctly refusing, and still refuses, unchanged: this is
// an ADDITIVE new list entry, not an edit to that function's body.
//
// MEASURED AGAINST THE REAL 42: 14 convert -- qid 638 (business, loan payoff balance, options
// "90000.00".."150000.00"), 712 (business, tile count + cost), 3769 (chemistry, molecular weight,
// options like "1.01 x 10^5 g/mole"), 4632 (chemistry, lipid-molecule count), 8165/8430/8597/9027
// (math, bare numbers or short numeric expressions), 8567 (math, "14 x 3" / "21 x 4" -- literal
// arithmetic expressions rather than evaluated numbers, still all-digit-bearing and still COMPUTE:
// per `compute-open-ended`'s own header, whether any registered method's shapeTest() actually fits
// THIS question's specific shape is a method-selection question, never a demand question), 9761
// (physics, retina image separation), 11601/11634/11790/12241 (engineering: transformer
// efficiency, heat flux, boundary-layer thickness, drag force -- several with PROSE-WRAPPED
// numeric options, e.g. "880lb_f for the whole plate and 124lb_f for the first 10 ft", still
// all-digit-bearing so still caught).
//
// WHAT IT STILL LEAVES UNMAPPED, ON PURPOSE (an honest gap, not smoothed over). qid 584 -- THE
// FOUNDER'S OWN NAMED FIXTURE -- has an all-numeric option pool but its `question` field carries NO
// verb at all: a bare table ("Policy Face Value of Policy Premium Rate Term of Policy Premium 1
// $9,000 ..."), src `stemez-Business`, whose actual ask appears to have been stripped by the
// dataset's own source extraction. COMPUTE_CUE_RE correctly finds no cue because there genuinely is
// none in the question text, and this detector, like every other one in this file, never guesses a
// missing verb from the option shape alone. qid 3960/4221/9219 spell their numbers as WORDS ("five
// seconds", not "5"), so MATH_CONTENT_RE's literal-digit requirement -- unchanged scope, D-BP164-
// M0-112 -- never fires. qid 2957 (a genetics pedigree cross) has cue+math on the question but its
// options are genotype notation with NO digits at all (`allOptionsCarryADigit` correctly returns
// false -- that answer is not a computed value, it is an assignment). qid 7420/10608 have all-digit
// options but no COMPUTE_CUE_RE phrase in the question. None of these are silently absorbed; they
// stay `demand_unknown` and this comment names exactly why.
//
// ── ENTRY 4: identify-mcq-condition (IDENTIFY) ──
// WHAT IT DETECTS. The generic MMLU-Pro "which (one) of the following ... is/are/does/would/can/
// should/results/cannot/must [a stated condition, possibly negated]" stem, plus the explicit
// imperative "Identify ...". Per `LianaDemand`'s own doc comment, IDENTIFY is "the answer is a
// member or instance", and the CUES table above (this file, the unused scaffold) already carries
// the same grammatical idea for it ("asks which member or instance satisfies a stated condition")
// -- this entry gives that idea a home in the LIVE structural path, grammar tuned to real MCQ
// stems rather than re-derived from nothing. "Which of the following entities cannot sue for
// libel" and "Identify the antecedent of the following conditional proposition" both ask exactly
// this: pick the OPTION -- a member of the lettered set -- that does or does not satisfy the
// condition the question states. This is NOT DEFINE (DEFINE asks what a term MEANS; this asks
// which member QUALIFIES).
//
// GUARDED AGAINST LOCATE-IN-FRAMEWORK. `FRAMEWORK_CUE_RE` below mirrors the CUES table's own
// LOCATE-IN-FRAMEWORK regex byte-for-byte (kept as a separate constant, not imported, so this new
// entry is never coupled to that scaffold's own lifecycle/removal). A question that both names a
// capitalized framework ("Within Critical Security Studies, ...") and also happens to phrase itself
// as "which of the following" is NOT claimed here -- checked directly against all 42 real fixtures,
// zero collide, but the guard costs one regex test and this file's own doctrine is refuse-beats-
// guess (canon R-5): a possible LOCATE-IN-FRAMEWORK question reported UNKNOWN here is not a new
// gap, since no structural detector in this file has ever produced that demand type.
//
// MEASURED AGAINST THE REAL 42 (the 14 above already removed by the ordering below): 7 more
// convert -- qid 1525 (law, "does not apply to solicitation"), 5283 (other, "cannot sue for
// libel"), 5471 (other, "results in establishment of a price..."), 5818 (other, "the impact on
// assets and liabilities"), 6054 (health, "not a reason for increased risk..."), 6637 (health, THE
// FOUNDER'S OWN OTHER NAMED FIXTURE, "Which of the following statements is correct?"), 10948
// (philosophy, "Identify the antecedent of...").
//
// TOTAL MEASURED CONVERSION: 21 of the 42 `demand_unknown` items now resolve a demand, across 9 of
// the 14 categories (business, law, chemistry, math, physics, engineering, other, health,
// philosophy). The remaining 21 keep reporting `demand: null`, each with its own detector's `why`
// naming what was checked and found absent -- see the two paragraphs above for the specific,
// named reasons, not a blanket "no match".
// ─────────────────────────────────────────────────────────────────────────────────────────────
const FRAMEWORK_CUE_RE = /\b(?:[Ww]ithin|[Ii]n|[Aa]ccording to|[Uu]nder)\s+[A-Z][\w-]*(?:\s+[A-Z][\w-]*)+\s*,/;
const IDENTIFY_WHICH_RE = /\bwhich (?:one )?of the following\b[^?]{0,120}\b(is|are|does|would|can|should|results?|cannot|must)\b/i;
const IDENTIFY_IMPERATIVE_RE = /^\s*identify\b/i;

/** True only when an option pool exists (>= 2 entries, the same threshold every other structural
 *  check in this file uses) AND every single option value contains at least one digit. This is the
 *  new signal D-BP165-M0-020 reads from `options` -- a computed-value MCQ's options are dominated
 *  by digits (dollar figures, bare numbers, scientific notation, unit-suffixed quantities); a
 *  qualitative MCQ's options (names, categories, prose claims) essentially never are. Deliberately
 *  ALL, not a majority or a threshold -- a single non-numeric option is evidence the pool is
 *  qualitative, and refusing on that evidence (canon R-5) beats guessing past it. */
function allOptionsCarryADigit(options: Record<string, string> | null): boolean {
  if (!options) return false;
  const values = Object.values(options);
  if (values.length < 2) return false;
  return values.every((v) => /\d/.test(v));
}

interface StructuralDemandDetector {
  /** Short label for the transcript/why-string only -- not read by any caller. */
  id: string;
  detect(question: string, options: Record<string, string> | null): DemandResult | null;
}

/** ORDERED. First match wins. Adding a new structural shape (e.g. the Founder's own named
 *  next example, True/False) is ONE NEW ENTRY here, in the shape the COMPUTE entry demonstrates --
 *  never a special case bolted onto `determineDemandFromQuestionStructure()`'s body. */
const STRUCTURAL_DEMAND_DETECTORS: StructuralDemandDetector[] = [
  {
    id: 'classify-superlative',
    detect(question) {
      const superlative = extractSuperlativeMatch(question);
      if (!superlative) return null;
      return {
        demand: 'CLASSIFY',
        why: `the question's own grammar carries a structural superlative ("${superlative.direction} `
          + `${superlative.property}", a literal span of the question) -- the SAME signal `
          + 'extractSuperlativeMatch() gives classify_cascade.ts\'s run() to route this question to its '
          + 'superlative-by-magnitude path. CLASSIFY per FD-BP152-06 ("qid 98 is classify"). Derived '
          + 'structurally because SURVEY STEP 2 produced no term, no usable operation answer, and no '
          + 'surviving ambiguity-named term',
        derivedFrom: 'question-string',
      };
    },
  },
  {
    id: 'compute-open-ended',
    detect(question, options) {
      const hasOptionPool = !!options && Object.keys(options).length >= 2;
      if (hasOptionPool) return null;
      const cueMatch = question.match(COMPUTE_CUE_RE);
      if (!cueMatch) return null;
      if (!MATH_CONTENT_RE.test(question)) return null;
      return {
        demand: 'COMPUTE',
        why: `the question has no lettered option pool (open-ended free response) and its own `
          + `grammar carries a computation cue ("${cueMatch[0]}") alongside numeric/LaTeX math `
          + 'content -- the answer must be a value derived by computation. This says only that '
          + 'COMPUTE is the demand; whether any registered method\'s shapeTest() actually fits this '
          + 'question\'s specific shape is decided separately, at method selection (D-BP164-M0-112)',
        derivedFrom: 'question-string',
      };
    },
  },
  {
    id: 'compute-mcq-numeric-options',
    detect(question, options) {
      if (!allOptionsCarryADigit(options)) return null;
      const cueMatch = question.match(COMPUTE_CUE_RE);
      if (!cueMatch) return null;
      if (!MATH_CONTENT_RE.test(question)) return null;
      return {
        demand: 'COMPUTE',
        why: 'the question carries a lettered option pool, but every option contains a digit (a '
          + 'computed-value option set, not a qualitative one -- allOptionsCarryADigit()) and the '
          + `question's own grammar carries a computation cue ("${cueMatch[0]}") alongside `
          + 'numeric/LaTeX math content -- the answer must be a value (or arithmetic expression) '
          + 'derived by computation, presented as MCQ rather than free response. Widened from '
          + 'compute-open-ended (D-BP164-M0-112) at D-BP165-M0-020, Founder verbatim: "widen the '
          + 'structural detector ... using the options it is already handed." This says only that '
          + 'COMPUTE is the demand; whether any registered method\'s shapeTest() actually fits this '
          + 'question\'s specific shape is decided separately, at method selection',
        derivedFrom: 'question-string',
      };
    },
  },
  {
    id: 'identify-mcq-condition',
    detect(question, options) {
      const hasOptionPool = !!options && Object.keys(options).length >= 2;
      if (!hasOptionPool) return null;
      // Defer to LOCATE-IN-FRAMEWORK rather than mis-claim it -- see this section's own header
      // for why this guard costs nothing and no real fixture in the measured 42 needed it.
      if (FRAMEWORK_CUE_RE.test(question)) return null;
      const m = IDENTIFY_WHICH_RE.exec(question) ?? IDENTIFY_IMPERATIVE_RE.exec(question);
      if (!m) return null;
      return {
        demand: 'IDENTIFY',
        why: 'the question carries a lettered option pool and its own grammar asks which member of '
          + `that set satisfies (or fails to satisfy) a stated condition ("${m[0].trim().slice(0, 60)}") `
          + '-- IDENTIFY per LianaDemand\'s own doc comment ("the answer is a member or instance"). '
          + 'Widened at D-BP165-M0-020 (Founder verbatim, this dispatch: "widen the structural '
          + 'detector ... Narrow, additive"), the same structural path D-BP164-M0-112 first extended '
          + 'for COMPUTE. Guarded against LOCATE-IN-FRAMEWORK (FRAMEWORK_CUE_RE, mirrors the CUES '
          + 'table\'s own pattern) so a framework question is never mis-claimed here. IDENTIFY is '
          + 'registered with `run: null` (untaught_shapes.ts, D-BP153-008) -- a question resolving '
          + 'here reports "recognized shape, not yet taught," an honest, complete result, never a '
          + 'silent demand_unknown',
        derivedFrom: 'question-string',
      };
    },
  },
];

/**
 * Derives DEMAND from the question's own grammar and structure (no options field, cue words,
 * math content), trying each entry of `STRUCTURAL_DEMAND_DETECTORS` in order and returning the
 * first match. See that list's own header for why this is a wiring fix / open-ended-by-design
 * extension point rather than a widened gate, and for what it still refuses.
 *
 * MUST be called only after `determineDemandFromSurveyedAsk()`,
 * `determineDemandFromOperationAnswer()`, and `determineDemandFromAmbiguityNested()` have all
 * failed to produce a demand -- it is a last resort, never a first opinion.
 *
 * `options` is OPTIONAL (defaults to `null`) so every pre-existing single-argument call site
 * (this file's own tests included) keeps compiling and behaving identically -- omitting it simply
 * means the compute-open-ended detector always sees "no option pool".
 */
export function determineDemandFromQuestionStructure(
  question: string,
  options: Record<string, string> | null = null,
): DemandResult {
  for (const detector of STRUCTURAL_DEMAND_DETECTORS) {
    const result = detector.detect(question, options);
    if (result) return result;
  }
  return {
    demand: null,
    why: 'the question carries no structural superlative (SUPERLATIVE_PROPERTY_RE did not match a '
      + 'literal span of it); no computation cue plus math content either as open-ended free '
      + 'response or, per D-BP165-M0-020, as an MCQ with an all-digit option pool; and no '
      + '"which of the following .../Identify ..." condition-selection grammar either (again '
      + `D-BP165-M0-020) -- so there is nothing in its own grammar to derive a demand from (tried: `
      + `${STRUCTURAL_DEMAND_DETECTORS.map((d) => d.id).join(', ')}) -- reporting UNKNOWN, which is `
      + 'a teaching prompt (canon R-5), not a guess',
    derivedFrom: 'question-string',
  };
}
