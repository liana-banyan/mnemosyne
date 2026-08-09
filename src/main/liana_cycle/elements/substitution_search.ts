// elements/substitution_search.ts -- E-SUBSTITUTION-SEARCH -- D-BP150-010/BISHOP/S10/seg-nest
//
// THE NEST METHOD's substitution-correction half. Ratified canon:
//   Asteroid-ProofVault/state/eblets/CANON/canon_the_nest_method_bp150.eblet.md
//
// Founder, BP150, verbatim: "Then we'll do the substitution of each answer (after each answer's
// survey of their own) and plug in to what the resultant sentence would be, not simply
// substitution, which wouldn't work in the limited way we trade one for one in the current
// substitution. Instead, new sentences are formed which need to be evaluated based on searches to
// see if they are true, like this for A: Search google for: "Within Critical Security Studies,
// Technological systems is the referent object of security." And "Technological systems are the
// referent object of security within what studies?" And "What is the referent object of security
// within critical security studies?" But do that for all of the answers, after the Answers Survey
// for each."
//
// THREE QUERY FORMS, VERBATIM TEMPLATES FROM THE CANON TABLE:
//   assertion  "Within <Frame>, <option> is <term>."             does the claim corroborate as stated
//   inverted   "<option> are <term> within what studies?"        plug in a wrong answer and the field
//                                                                  that comes back is NOT the asked one
//   direct     "What is <term> within <frame, lowercased>?"      what does the field itself say the
//                                                                  answer is
//
// The copula differs between assertion ("is") and inverted ("are"), and the frame's casing differs
// between assertion (as matched, e.g. "Critical Security Studies") and direct (lowercased, e.g.
// "critical security studies") -- BOTH exactly as the Founder wrote them in the passage quoted
// above. This file reproduces those templates as given; it does not correct or normalize them, per
// this ticket's instruction to build what he described, not an improvement on it.
//
// THIS FILE IS PURE. NO I/O. It FORMS the three query strings; it does not send them anywhere.
// Sending stays in whatever calls this -- a future E-SUBSTITUTION run(), or a method that composes
// this with survey_ask.ts's `googleBlocks()` -- keeping the split means the query text itself can be
// tested with no network involved, exactly as this ticket's test script does.
//
// Frame detection reuses findFrame() from nest.ts (the same "within/in <Capitalized Span>" rule) --
// one frame-detection rule for the whole registry, per the governing canon's "mix and match" purpose
// for elements. This file does not re-derive it.
//
// WHAT THIS FILE DELIBERATELY DOES NOT DO:
//   - It does not call E-SURVEY-ANSWERS and does not require it to have run first. Canon makes that
//     ordering a PROCESS requirement ("after each answer's survey of their own"), not a signature
//     dependency of the sentence-forming step -- the caller is responsible for the ordering.
//   - It does not judge whether a query "sounds right" for a non-framework question. When no frame
//     is found, each template is honestly reduced (the "within..." clause dropped) and `frameWhy`
//     says so plainly -- these templates were taught by a LOCATE-IN-FRAMEWORK case (qid 92) and are
//     not claimed to generalize past it.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// D-BP150-011 UPDATE -- KIND-CHECK GATES THIS FILE, PER R-1 OF THE GOVERNING KIND-CHECK CANON:
//   Asteroid-ProofVault/state/eblets/CANON/canon_kind_check_first_and_the_types_are_finite_bp150.eblet.md
//
// THE TICKET THAT FORCED IT: run against qid 92, the templates above produced for option E ("There
// is no specific referent point.", the correct answer) the nonsense "There is no specific referent
// point. are referent object of security within what studies?" -- the method could not phrase the
// one option it most needed to test, and nothing in this file noticed. That is exactly the failure
// the kind-check canon exists to catch.
//
// `formSubstitutionQueries()` now calls `checkKind()` (elements/kind_check.ts) on the OPTION text
// FIRST -- before the operation, not as validation after (R-1) -- and branches on the result:
//   THING                       -> the three templates exactly as before (unchanged behavior).
//   PROPOSITION / ABSENCE-CLAIM -> the templates are NOT formed. A single CORROBORATION query is
//                                  formed instead, appropriate to a claim rather than a slot-filler
//                                  (canon's own qid 92 example: "Within Critical Security Studies, is
//                                  there a specific referent object of security?"). This function's
//                                  corroboration template is the mechanical shape "Within <Frame>, is
//                                  there <term>?" / "Is there <term>?" -- it is NOT claimed to
//                                  reproduce the canon's illustrative phrasing byte-for-byte (that
//                                  phrasing hand-inserts "a specific", which is not mechanically
//                                  derivable from `term` alone without a grammar model this element
//                                  does not use); it is the same SHAPE, and that gap is reported
//                                  explicitly in this ticket's return rather than papered over.
//   any other type, or null     -> REFUSED. `queries` is always `[]`, never a plausible-looking wrong
//                                  template (R-2: refusal is reported with the reason, never silent).
//
// THE RETURN SHAPE MAKES REFUSAL IMPOSSIBLE TO MISTAKE FOR SUCCESS, following AspectElimination's
// `eliminated_any` precedent in aspect_tag.ts: `formed_any` is `false` exactly when `queries` is `[]`,
// and `status` names which of the three branches ran. A caller that ignores `formed_any`/`status` and
// reads `queries` directly gets an empty list on refusal, never a wrong-shaped query wearing the same
// interface as a real one.
// ─────────────────────────────────────────────────────────────────────────────────────────────

import { findFrame } from './nest';
import { checkKind, KindType } from './kind_check';

export type SubstitutionForm = 'assertion' | 'inverted' | 'direct' | 'corroboration';

/** Which of the three kind-check branches produced this result. `formed_any` is redundant with this
 *  on purpose (mirrors AspectElimination's `eliminated_any` -- a boolean flag a careless caller is
 *  more likely to check than a string union). */
export type SubstitutionStatus = 'substituted' | 'corroboration' | 'refused';

export interface SubstitutionQuery {
  form: SubstitutionForm;
  query: string;
  /** What this form tests, from the canon table -- printed alongside the query so a transcript
   *  reader knows WHY each one was sent, not only what it says. */
  tests: string;
  /** How this specific string was assembled from question/term/option. */
  why: string;
}

export interface SubstitutionResult {
  question: string;
  term: string;
  option: string;
  frame: string | null;
  frameWhy: string;
  /** The kind-check result for `option`, run FIRST per canon R-1. Always present, including on
   *  refusal -- this is WHY the branch below was taken. */
  kind: KindType | null;
  kindWhy: string;
  /** 'substituted' (THING, 3 templates) | 'corroboration' (PROPOSITION/ABSENCE-CLAIM, 1 query) |
   *  'refused' (any other type, or null -- unrecognized). */
  status: SubstitutionStatus;
  /** True exactly when `queries.length > 0`. Mirrors AspectElimination's `eliminated_any`: a caller
   *  that ignores this and treats `queries` as always-populated gets an empty array on refusal, never
   *  a plausible-looking wrong query. */
  formed_any: boolean;
  /** 3 for 'substituted' (assertion, inverted, direct, the canon's own order), 1 for 'corroboration',
   *  ALWAYS EMPTY for 'refused'. */
  queries: SubstitutionQuery[];
  /** Always present -- the top-line honest summary for the transcript, including on refusal. */
  why: string;
}

/**
 * E-SUBSTITUTION-SEARCH. Forms the three query strings the canon specifies for one option, given
 * the question (to locate the framework, if any), the ASK's term (e.g. "the referent object of
 * security"), and one option's text (e.g. "Technological systems").
 *
 * Never sends anything. Returns the three query strings, labeled, sourced, and honest about
 * whether a framework was actually found in the question.
 */
export function formSubstitutionQueries(question: string, term: string, option: string): SubstitutionResult {
  const frameMatch = findFrame(question);
  const frame = frameMatch ? frameMatch.frame : null;
  const frameWhy = frameMatch
    ? frameMatch.why
    : 'no capitalized "within/in <Frame>" span found in the question -- the within-clause is '
      + 'omitted below; the canon\'s three templates were taught by qid 92\'s LOCATE-IN-FRAMEWORK '
      + 'shape and are not claimed to generalize past it';

  // R-1: the kind-check runs FIRST, before any operation that consumes the option it types.
  const kindResult = checkKind(option);
  const kind = kindResult.type;
  const kindWhy = kindResult.why;

  if (kind === 'THING') {
    const queries: SubstitutionQuery[] = [];

    const assertionQuery = frame ? `Within ${frame}, ${option} is ${term}.` : `${option} is ${term}.`;
    queries.push({
      form: 'assertion',
      query: assertionQuery,
      tests: 'does the claim corroborate as stated',
      why: frame
        ? `template "Within <Frame>, <option> is <term>." with Frame="${frame}", option="${option}", term="${term}"`
        : `no frame found -- template reduced to "<option> is <term>." with option="${option}", term="${term}"`,
    });

    const invertedQuery = frame ? `${option} are ${term} within what studies?` : `${option} are ${term}.`;
    queries.push({
      form: 'inverted',
      query: invertedQuery,
      tests: 'plug in a wrong answer and the field that comes back is NOT the asked one',
      why: frame
        ? `template "<option> are <term> within what studies?" with option="${option}", term="${term}"`
        : `no frame found -- template reduced to "<option> are <term>." with option="${option}", term="${term}"`,
    });

    const directQuery = frame ? `What is ${term} within ${frame.toLowerCase()}?` : `What is ${term}?`;
    queries.push({
      form: 'direct',
      query: directQuery,
      tests: 'what does the field itself say the answer is',
      why: frame
        ? `template "What is <term> within <frame, lowercased>?" with frame="${frame.toLowerCase()}", term="${term}"`
        : `no frame found -- template reduced to "What is <term>?" with term="${term}"`,
    });

    const why = `kind-check: THING (${kindWhy}) -- ${queries.length} substitution query form(s) formed `
      + `for option "${option}"${frame ? `, frame "${frame}"` : ' (no frame found)'}`;

    return { question, term, option, frame, frameWhy, kind, kindWhy, status: 'substituted', formed_any: true, queries, why };
  }

  if (kind === 'PROPOSITION' || kind === 'ABSENCE-CLAIM') {
    // The option is a claim, not a slot-fillable thing -- one-for-one substitution into "<option> is
    // <term>." produces the nonsense the governing canon documents (qid 92 option E). Instead: a
    // corroboration form appropriate to a claim. Canon names the SHAPE via qid 92's option E: "Within
    // Critical Security Studies, is there a specific referent object of security?" -- see this file's
    // header note on why this template does not claim byte-identical reproduction of that phrasing.
    const corroborationQuery = frame ? `Within ${frame}, is there ${term}?` : `Is there ${term}?`;
    const queries: SubstitutionQuery[] = [{
      form: 'corroboration',
      query: corroborationQuery,
      tests: 'does the field corroborate that the term names a real, specific referent -- asked as a '
        + 'claim question about the term itself, never by substituting the claim option into the '
        + '"<option> is <term>" slot',
      why: frame
        ? `option kind is ${kind} (${kindWhy}) -- template "Within <Frame>, is there <term>?" with `
          + `Frame="${frame}", term="${term}"`
        : `option kind is ${kind} (${kindWhy}) -- no frame found, template reduced to "Is there <term>?" `
          + `with term="${term}"`,
    }];

    const why = `kind-check: ${kind} (${kindWhy}) -- substitution templates REFUSED for this option `
      + '(they would substitute a claim into a slot and produce nonsense, per the governing canon\'s '
      + 'qid 92 finding); 1 corroboration query form formed instead';

    return { question, term, option, frame, frameWhy, kind, kindWhy, status: 'corroboration', formed_any: true, queries, why };
  }

  // Any other type, or null (unrecognized) -- REFUSE. Per R-2, refusal is reported with the reason,
  // never silently. `queries` is `[]`, never a plausible-looking wrong template.
  const why = kind
    ? `kind-check: ${kind} (${kindWhy}) -- REFUSED: this element only composes query forms for THING `
      + '(substitution templates) and PROPOSITION/ABSENCE-CLAIM (corroboration); a method handed a '
      + 'type it does not declare must not run, per R-5 of the governing kind-check canon'
    : `kind-check: unrecognized (${kindWhy}) -- REFUSED: per R-3, an unrecognized type is never `
      + 'coerced to the nearest known type; no query was formed';

  return { question, term, option, frame, frameWhy, kind, kindWhy, status: 'refused', formed_any: false, queries: [], why };
}

/** Convenience: forms the three queries for every option in a set, in letter order. Still no I/O --
 *  this only loops formSubstitutionQueries() once per option. */
export function formSubstitutionQueriesForAllOptions(
  question: string,
  term: string,
  options: Record<string, string>,
): Record<string, SubstitutionResult> {
  const out: Record<string, SubstitutionResult> = {};
  for (const [letter, text] of Object.entries(options)) {
    out[letter] = formSubstitutionQueries(question, term, text);
  }
  return out;
}
