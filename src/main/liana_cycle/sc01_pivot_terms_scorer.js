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
function isNonEmpty(s) {
    return typeof s === 'string' && s.trim().length > 0;
}
/** Plain, case-insensitive string containment -- no fuzzy matching, no stemming, no model. */
function containsVerbatim(haystack, needle) {
    if (!isNonEmpty(haystack) || !isNonEmpty(needle))
        return false;
    return haystack.toLowerCase().includes(needle.trim().toLowerCase());
}
/**
 * SC-01. Scores the REAL FounderStep2Result founderStep2Survey() (survey_stage.ts) returns for
 * one question. Pure function of its input -- issues no query itself, calls no model, makes no
 * network request. Every predicate is string containment or field presence (HARDWIRE-22
 * untouched).
 */
export function scoreSc01PivotTerms(qid, questionText, step2) {
    const ambiguityTerms = step2.ambiguity?.terms ?? [];
    const nestedByTerm = new Map();
    for (const entry of step2.ambiguityNested) {
        nestedByTerm.set(entry.term, entry);
    }
    const terms = ambiguityTerms.map((t) => {
        const verbatimInQuestion = containsVerbatim(questionText, t.term);
        const carriesTriple = isNonEmpty(t.standardMeaning) && isNonEmpty(t.alternativeMeaning) && isNonEmpty(t.impact);
        const nested = nestedByTerm.get(t.term);
        const enumeratedMeanings = [];
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
