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

import { findFrame } from './nest';

export type SubstitutionForm = 'assertion' | 'inverted' | 'direct';

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
  /** Always exactly 3, in the order assertion, inverted, direct -- the canon's own order. */
  queries: SubstitutionQuery[];
  /** Always present -- the top-line honest summary for the transcript. */
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

  const why = `${queries.length} query form(s) formed for option "${option}"${frame ? `, frame "${frame}"` : ' (no frame found)'}`;

  return { question, term, option, frame, frameWhy, queries, why };
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
