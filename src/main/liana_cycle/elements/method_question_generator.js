// elements/method_question_generator.ts -- E-METHOD-QUESTION-GENERATOR --
// D-BP152-032/BISHOP/seg-auto-method-and-key-exclusion, STAGE 1.
//
// Founder, BP152, verbatim ("build that next" -- the mandate this ticket answers): the machine
// generates the method questions itself, so the user need not be good at asking. And, on why it
// matters: "it shouldn't depend on a user being good at asking the right questions."
//
// WHAT WAS ALREADY BUILT, AND WHAT WAS MISSING. survey_stage.ts's askAmbiguity() (Part 1) asks
// what is ambiguous; askOperation() (Part 2) asks what operation is required. Google's own answer
// to the Founder's separate meta-prompt ("what is the smallest set of questions that would tell me
// the method") named TWO question SHAPES, recorded verbatim at FD-BP152-03:
//
//   Q1 -- SCALE/DEFINITION: "What specific definition and scale of '{subject}' is this question
//         using?" -- already built and wired (survey_stage.ts's askConstraint(), D-BP151-035,
//         template id "survey.constraint.definitionScale"). This module's
//         generateScaleDefinitionQuestion() reuses that EXACT template -- it does not invent a
//         second wording -- so the question this module SAYS would be asked and the one
//         askConstraint() actually asks are provably the same string.
//   Q2 -- THRESHOLD: "What is the specific threshold used to qualify as '{subject}'?" --
//         survey_stage.ts's own D-BP151-035 header named this "a stopped fork, not built" (Form 2)
//         and left the exact reduced wording on file as the open question put to the Founder. THIS
//         IS WHAT THIS MODULE BUILDS. The template lives in resources/liana_survey_queries.json
//         (ids "survey.constraint.threshold" / "survey.constraint.thresholdWithUnit"), same
//         runtime-editable convention every other query in this estate now uses (D-BP152-008).
//
// STRUCTURAL EXTRACTION, NO WORD LIST, NO INVENTED SELECTION RULE. Per this ticket's own
// instruction: derive method questions the way elements/catalyst_words.ts's
// extractBoundPhrases() works -- a MECHANICAL rule over the text's own structure (there,
// capitalization runs; here, literal substring containment and adjacency), never a hand-authored
// vocabulary. Two consequences, both deliberate:
//
//   1. `literalSubjectSpan()` is the ONLY gate on whether a question gets generated at all. A
//      Part-1-named term that is not a literal (case-insensitive) span of the question text
//      produces NO question for that shape -- refused, not guessed around (FD-BP152-03: "Both
//      subjects are literal spans of the question text").
//   2. BOTH shapes are generated for EVERY named term, uniformly. This module does NOT try to
//      decide which shape "fits" a given term (e.g. "this one sounds like a scale question, that
//      one sounds like a threshold question") -- inventing that selection rule would be exactly
//      the unordered-priority tare HARDWIRE-23 Law 1 forbids (see demand_test.ts's
//      determineDemandFromAmbiguityNested(), same reasoning, same citation). A term that does not
//      fit a shape is expected to come back empty/unusable from the source -- an honest empty
//      result the caller already knows how to report, not a fabrication invented here.
//
// THE ONE INTERIM JUDGMENT, TARE-LABELED, PER FD-BP152-03 ITSELF. Founder's own Q2, quoted
// verbatim, carries the unit inline: "...threshold (people per square kilometer) used to
// qualify...". FD-BP152-03's own ruling: "carry his parenthetical verbatim when the question
// itself names the quantity's unit, and omit it otherwise so Google names the unit rather than
// being fed one." `detectAdjacentUnit()` implements that STRUCTURALLY -- it looks only at WHERE a
// parenthetical sits (immediately after the subject's own literal span), never at what it says --
// so this remains a positional/grammatical rule, not a second word list.
import { getQueryText } from '../query_text_loader';
/**
 * Verifies `term` is a literal, case-insensitive substring of `questionText`, and returns the
 * EXACT substring as it appears in `questionText` -- original casing and punctuation, never the
 * term as Part 1 (a model/source) happened to phrase it. Returns null when no literal match
 * exists. This is the ONLY gate this module has on whether a question may be generated at all.
 */
export function literalSubjectSpan(term, questionText) {
    const t = String(term ?? '').trim();
    const q = String(questionText ?? '');
    if (!t || !q)
        return null;
    const idx = q.toLowerCase().indexOf(t.toLowerCase());
    if (idx === -1)
        return null;
    return q.slice(idx, idx + t.length);
}
/**
 * FD-BP152-03's interim ruling, implemented structurally. Looks ONLY at whether a parenthetical
 * `(...)` sits immediately after `subjectSpan`'s own occurrence in `questionText` (allowing a
 * comma/colon and whitespace between them, the ordinary way an aside is punctuated) -- never at
 * the parenthetical's own words. Returns the parenthetical INCLUDING its parentheses (so it can be
 * spliced into the generated question exactly as the source question wrote it), or null when none
 * is adjacent -- in which case the caller omits the unit and lets Google name it, per the ruling.
 */
export function detectAdjacentUnit(subjectSpan, questionText) {
    const s = String(subjectSpan ?? '');
    const q = String(questionText ?? '');
    if (!s || !q)
        return null;
    const idx = q.indexOf(s);
    if (idx === -1)
        return null;
    const after = q.slice(idx + s.length);
    const m = /^\s*[,:]?\s*(\([^)]{1,80}\))/.exec(after);
    return m ? m[1] : null;
}
function refuse(shape, term, why) {
    return { shape, term, why };
}
/**
 * FD-BP152-03, Q1 -- SCALE/DEFINITION. Reuses the EXACT query template askConstraint()
 * (survey_stage.ts) already sends live (`survey.constraint.definitionScale`,
 * resources/liana_survey_queries.json) -- this function builds no second wording, it only
 * verifies the subject and calls the same getQueryText() id askConstraint() calls. Exported so
 * Stage 1's own verification can show BOTH shapes instantiate for the same input (VERIFY (a));
 * askConstraint() itself is unmodified by this ticket and remains the live caller for Q1.
 */
export function generateScaleDefinitionQuestion(term, questionText) {
    const subject = literalSubjectSpan(term, questionText);
    if (!subject) {
        return refuse('SCALE_DEFINITION', term, `"${term}" is not a literal span of the question text -- refusing rather than asking about a `
            + 'paraphrase (FD-BP152-03: "Both subjects are literal spans of the question text")');
    }
    const questionTextOut = getQueryText('survey.constraint.definitionScale', { term: subject });
    return {
        shape: 'SCALE_DEFINITION',
        term,
        subject,
        queryId: 'survey.constraint.definitionScale',
        questionText: questionTextOut,
        source: 'machine-generated',
        why: `subject "${subject}" verified as a literal span of the question text; instantiates the `
            + "Founder's SCALE/DEFINITION shape (FD-BP152-03, Google's own form-1 wording, same template "
            + "askConstraint() already asks live)",
    };
}
/**
 * FD-BP152-03, Q2 -- THRESHOLD. Builds the reduced wording survey_stage.ts's own D-BP151-035
 * header left as an open fork ("Form 2 IS A STOPPED FORK, NOT BUILT"), now closed: "What is the
 * specific threshold{ unit} used to qualify as '{subject}'?" -- TARE-labeled (Bishop's reduced
 * wording, not the Founder's own words beyond "threshold" and "qualify as", which his own Q2
 * uses). The unit clause is included only when `detectAdjacentUnit()` finds one structurally
 * adjacent to the subject in the question text (FD-BP152-03's own interim ruling).
 */
export function generateThresholdQuestion(term, questionText) {
    const subject = literalSubjectSpan(term, questionText);
    if (!subject) {
        return refuse('THRESHOLD', term, `"${term}" is not a literal span of the question text -- refusing rather than asking about a `
            + 'paraphrase (FD-BP152-03: "Both subjects are literal spans of the question text")');
    }
    const unit = detectAdjacentUnit(subject, questionText);
    const queryId = unit ? 'survey.constraint.thresholdWithUnit' : 'survey.constraint.threshold';
    const values = unit ? { term: subject, unit } : { term: subject };
    const questionTextOut = getQueryText(queryId, values);
    const unitNote = unit
        ? `; the question text names an adjacent unit ${unit}, carried verbatim per FD-BP152-03's `
            + 'interim ruling (TARE: the carry-vs-omit rule is Bishop\'s, structurally implemented, not '
            + 'the Founder\'s own wording)'
        : '; no unit is adjacent to the subject in the question text, so none is fed to Google '
            + '(FD-BP152-03\'s interim ruling: "omit it otherwise so Google names the unit rather than '
            + 'being fed one") (TARE, same rule)';
    return {
        shape: 'THRESHOLD',
        term,
        subject,
        queryId,
        questionText: questionTextOut,
        source: 'machine-generated',
        why: `subject "${subject}" verified as a literal span of the question text; instantiates the `
            + `Founder's THRESHOLD shape (FD-BP152-03)${unitNote}`,
    };
}
/**
 * Orchestrator. Applies BOTH shapes to EVERY term Part 1 (askAmbiguity()) named, uniformly -- see
 * this file's own header for why no rule picks which shape "fits" a term. `operationRawAnswer`
 * (Part 2's own stated answer, verbatim, may be null) is carried into the result purely for
 * transcript/attribution context -- it does not gate or select which questions are generated;
 * see this file's header, point 2, for why gating on it would itself be an invented rule.
 *
 * REFUSES BEATS GUESSING AT THE WHOLE-CALL LEVEL TOO: when there are no named terms, or no
 * question text to check spans against, this returns zero questions and ONE explicit refusal
 * naming why -- never silently empty with no explanation.
 */
export function generateMethodQuestions(ambiguityTerms, questionText, operationRawAnswer = null) {
    const q = String(questionText ?? '');
    if (!ambiguityTerms.length || !q.trim()) {
        return {
            questions: [],
            refusals: [
                refuse('SCALE_DEFINITION', '(none)', `no Part 1 term(s) and/or no question text to generate from (terms: ${ambiguityTerms.length}, `
                    + `question text present: ${!!q.trim()}, Part 2 operation answer: `
                    + `${operationRawAnswer ? `"${operationRawAnswer}"` : 'null'}) -- refusing rather than guessing`),
            ],
        };
    }
    const questions = [];
    const refusals = [];
    for (const t of ambiguityTerms) {
        const q1 = generateScaleDefinitionQuestion(t.term, q);
        if ('questionText' in q1)
            questions.push(q1);
        else
            refusals.push(q1);
        const q2 = generateThresholdQuestion(t.term, q);
        if ('questionText' in q2)
            questions.push(q2);
        else
            refusals.push(q2);
    }
    return { questions, refusals };
}
