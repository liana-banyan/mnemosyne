// sc01_pivot_terms_scorer.ts -- D-BP152-015/BISHOP/seg-sc01-pivot-terms
//
// SC-01 -- PIVOT TERMS NAMED AND DEFINED. Scores the REAL, unmodified output of
// founderStep2Survey() (survey_stage.ts) against the strict count settled with the Founder this
// session (RULINGS_BP152.md, D-BP152-015 dispatch, SUCCESS TEST section):
//
//   a term counts ONLY if ALL of:
//     1. it appears VERBATIM in the question text (plain string containment, case-insensitive),
//     2. it carries ALL THREE of standard meaning, alternative meaning, impact,
//     3. it has AT LEAST ONE definition from a named source.
//
// THIS FILE REIMPLEMENTS NOTHING of the survey/extraction pipeline. It only READS the real
// FounderStep2Result founderStep2Survey() returns (askAmbiguity() for Part 1/naming,
// surveyAskNested() -> surveyAsk() for the denotation definitions) and applies the three checks
// above as plain string containment / field presence. CODE DOES THE SCORING. NO MODEL ANYWHERE IN
// THIS FILE -- HARDWIRE-22 untouched; nothing here judges whether two meanings are "the same"
// (that is E-MATCH-UP, left to the Founder's own deterministic filter, FD-BP152-12).
//
// NO PASS/FAIL. NO PROMOTION. NO VERDICT. Founder, BP152, verbatim: "We don't promote
// automatically. We look at the results, ME as the user, and see what it gives me." (FD-BP152-10).
// This module reports numbers and the full, uncollapsed enumeration -- nothing more.
//
// THE ENUMERATION IS THE DELIVERABLE (FD-BP152-12). Founder, BP152, verbatim: "I would like to
// see from the results the 4 different meanings so I can make a deterministic filter to get the
// one I want it to." `SC01TermScore.enumeratedMeanings` below is never deduplicated, never
// ranked, never collapsed to a count, and never chosen among.

import type { AmbiguityTermFinding, FounderStep2Result } from './survey_stage';

/** One enumerated denotation for one pivot term, kept in full -- never summarized, never
 *  deduplicated. Traceable back to exactly which nest level of founderStep2Survey()'s own real
 *  output it came from. */
export interface SC01EnumeratedMeaning {
  sentence: string;
  sourceUrl: string;
  sourceTitle: string;
  register: string | null;
  /** Which nest level (surveyAskNested()'s own `surveyedTerm`, elements/survey_ask.ts) this
   *  denotation was found under -- so the enumeration stays attributable to the real call, not
   *  flattened into an unattributed list. */
  fromLevel: string;
}

/** The strict-count verdict for ONE named term, with every predicate broken out so the result
 *  file shows WHICH of the three conditions failed, not only a final boolean -- this is the
 *  ticket's own "DIAGNOSTICS... to locate WHICH step failed". */
export interface SC01TermScore {
  term: string;
  /** Condition 1: plain string containment of `term` in the question text, case-insensitive. */
  verbatimInQuestion: boolean;
  /** Condition 2: standardMeaning, alternativeMeaning and impact are all non-empty strings,
   *  exactly as founderStep2Survey()'s own AmbiguityTermFinding carries them (copied, never
   *  re-derived). */
  carriesTriple: boolean;
  /** Condition 3: at least one denotation, from any nest level, carries a named source (a
   *  non-empty sourceTitle or sourceUrl on a SurveyDenotation founderStep2Survey() itself
   *  returned via surveyAskNested()). */
  hasNamedSourceDefinition: boolean;
  /** True only when all three conditions above are true -- the ONE thing that counts toward the
   *  strict count below. */
  countsTowardStrictCount: boolean;
  /** Every distinct meaning found for this term, in full and uncollapsed (FD-BP152-12). */
  enumeratedMeanings: SC01EnumeratedMeaning[];
}

export interface SC01Result {
  qid: number;
  questionText: string;
  /** THE MEASURE -- how many named terms satisfy all three strict-count conditions. */
  strictCount: number;
  /** THE THREE DIAGNOSTICS the ticket requires, reported alongside the strict count, NOT scores
   *  (FD-BP152-015 dispatch). */
  diagnostics: {
    /** How many terms the ambiguity query (Part 1) named at all. */
    namedCount: number;
    /** Of those, how many carried all three of standard/alternative/impact. */
    tripleCount: number;
    /** Of those, how many had at least one definition from a named source. */
    definedCount: number;
  };
  /** Per-term breakdown, in the source's own order -- includes the full enumeration. */
  terms: SC01TermScore[];
  /** Whether the ambiguity query itself produced a usable result at all (mirrors
   *  FounderStep2Result.ambiguity?.modelUnreachable / .why) -- distinguishes "zero terms because
   *  nothing was named" from "zero terms because the query never answered". */
  ambiguityQueryUnusable: boolean;
  why: string;
}

function isNonEmpty(s: string | null | undefined): boolean {
  return typeof s === 'string' && s.trim().length > 0;
}

/** Plain, case-insensitive string containment -- no fuzzy matching, no stemming, no model. */
function containsVerbatim(haystack: string, needle: string): boolean {
  if (!isNonEmpty(haystack) || !isNonEmpty(needle)) return false;
  return haystack.toLowerCase().includes(needle.trim().toLowerCase());
}

/**
 * SC-01. Scores the REAL FounderStep2Result founderStep2Survey() (survey_stage.ts) returns for
 * one question. Pure function of its input -- issues no query itself, calls no model, makes no
 * network request. Every predicate is string containment or field presence (HARDWIRE-22
 * untouched).
 */
export function scoreSc01PivotTerms(qid: number, questionText: string, step2: FounderStep2Result): SC01Result {
  const ambiguityTerms: AmbiguityTermFinding[] = step2.ambiguity?.terms ?? [];
  const nestedByTerm = new Map<string, FounderStep2Result['ambiguityNested'][number]>();
  for (const entry of step2.ambiguityNested) {
    nestedByTerm.set(entry.term, entry);
  }

  const terms: SC01TermScore[] = ambiguityTerms.map((t) => {
    const verbatimInQuestion = containsVerbatim(questionText, t.term);
    const carriesTriple = isNonEmpty(t.standardMeaning) && isNonEmpty(t.alternativeMeaning) && isNonEmpty(t.impact);

    const nested = nestedByTerm.get(t.term);
    const enumeratedMeanings: SC01EnumeratedMeaning[] = [];
    if (nested) {
      for (const level of nested.nested.levels) {
        for (const d of level.survey.denotations) {
          enumeratedMeanings.push({
            sentence: d.sentence,
            sourceUrl: d.sourceUrl,
            sourceTitle: d.sourceTitle,
            register: d.register,
            fromLevel: `${level.surveyedTerm} (nest level: "${level.level.text}", label: ${level.level.label})`,
          });
        }
      }
    }
    const hasNamedSourceDefinition = enumeratedMeanings.some((m) => isNonEmpty(m.sourceTitle) || isNonEmpty(m.sourceUrl));

    const countsTowardStrictCount = verbatimInQuestion && carriesTriple && hasNamedSourceDefinition;

    return {
      term: t.term,
      verbatimInQuestion,
      carriesTriple,
      hasNamedSourceDefinition,
      countsTowardStrictCount,
      enumeratedMeanings,
    };
  });

  const namedCount = terms.length;
  const tripleCount = terms.filter((t) => t.carriesTriple).length;
  const definedCount = terms.filter((t) => t.hasNamedSourceDefinition).length;
  const strictCount = terms.filter((t) => t.countsTowardStrictCount).length;
  const ambiguityQueryUnusable = step2.ambiguity === null || step2.ambiguity.modelUnreachable === true;

  return {
    qid,
    questionText,
    strictCount,
    diagnostics: { namedCount, tripleCount, definedCount },
    terms,
    ambiguityQueryUnusable,
    why: `${namedCount} term(s) named, ${tripleCount} carried the triple (standard/alternative/impact), `
      + `${definedCount} had a named-source definition; ${strictCount} met all three (strict count). `
      + 'No pass/fail, no promotion -- numbers and the enumeration only (FD-BP152-10, FD-BP152-12).',
  };
}
