// survey_steps.ts -- D-BP152-042/BISHOP/seg-survey-composable-steps
//
// SURVEY'S OWN PARTS, EACH GIVEN ITS OWN NameNumbered IDENTITY. Founder ruling, BP152, verbatim
// (RULINGS_BP152.md FD-BP152-20): "I want to use it to stack methods in whatever order I want - I
// don't need the lego shapes, I just want them NameNumbered (so that we can have iterations
// galore) as methods so that I can mix and match as I please." And, BP152, verbatim (this
// ticket's own ask): "I want to be able to skip survey or one by one put the parts of it in, or
// not."
//
// WHAT THIS FILE REGISTERS. Six Survey primitives, each already a complete, exported, tested unit
// inside `src/main/liana_cycle/survey_stage.ts` (per the file-only inventory at
// `BISHOP_DROPZONE\SEG_RETURN_BP152_010A_VOCAB_SURVEY_STAGE.md`):
//   - `DefineTheTerm:1` -- founderStep2Survey(), his own Step 2 title ("SURVEY: DEFINE THE TERM,
//     PERFUNCTORILY, THEN KEEP LOOKING", THE_FOUNDERS_PROCESS_ORDERED_BP151.md item 2).
//   - `Categorize:1` -- founderStep3CategorizeOptions(), his own verb ("first, I categorize the
//     possible answers", Excerpt 7 BP141, rule 12).
//   - `DetermineRegister:1` -- founderStep4DetermineRegister(), his own step title ("DETERMINE THE
//     REGISTER -- guess out loud, then check it", THE_FOUNDERS_PROCESS_ORDERED_BP151.md item 4).
//   - `JarMethod:1` -- founderStep6JarMethod(), HIS OWN NAME FOR IT, verbatim: "I like to call
//     this the Jar Method" (Excerpt 2, BP141, rule 2).
//   - `AmbiguityQuery:1` -- askAmbiguity(), Part 1 of what Founder BP152 called "the two part
//     google question I did last time" (FD-BP152-01) -- already the transcript's own tag,
//     `[ambiguity]`, in every PARSER INSTRUMENT line askAmbiguity() emits.
//   - `OperationQuery:1` -- askOperation(), Part 2 of the same two-part question -- already the
//     transcript's own tag, `[operation]`.
// Names are his own vocabulary throughout (step titles, his verbs, his own "Jar Method" name, the
// transcript's own existing `[ambiguity]`/`[operation]` tags) -- no dispatch id, no bare function
// name, appears anywhere in an operator-facing `name`.
//
// `Survey:1` (library/method_registry.ts's SURVEY_DECLARATION, D-BP152-040) REMAINS REGISTERED,
// UNCHANGED, AS THE WHOLE-SEQUENCE COMPOSITE -- this file does not touch it, does not re-register
// it, and does not collide with it (`DefineTheTerm`/`Categorize`/`DetermineRegister`/`JarMethod`/
// `AmbiguityQuery`/`OperationQuery` are six NEW names, none of them `Survey`). Per FD-BP152-09, "a
// saved sequence is itself a step" -- so the operator can pick the whole thing (`Survey:1`) or its
// parts (the six below), exactly as this ticket's own ask requires ("skip survey or one by one put
// the parts of it in, or not").
//
// REGISTRATION IS INERT, THE SAME WAY method_registry.ts's OWN REGISTRATION IS (see that file's
// header and its own "registration is inert" test, method_registry.test.ts). This file imports
// NOTHING from survey_stage.ts, methods/*.ts, or elements/*.ts -- every field below is a plain
// string/number/plain-object description written by hand from reading survey_stage.ts directly at
// the commit this ticket built on. Importing this module cannot execute askAmbiguity(),
// askOperation(), founderStep2Survey(), founderStep3CategorizeOptions(),
// founderStep4DetermineRegister(), or founderStep6JarMethod() -- see survey_steps.test.ts, which
// asserts exactly that.
//
// EXPORT VISIBILITY. `askAmbiguity()` and `askOperation()` were module-private in survey_stage.ts
// before this ticket -- this ticket's own SEG return documents the one-line `export` keyword added
// to each (D-BP152-042), the ONLY change made to survey_stage.ts, so these two entries describe a
// symbol that is now actually importable, matching every other entry's own exportKind claim. No
// other primitive in this file needed a visibility change -- founderStep2Survey(),
// founderStep3CategorizeOptions(), founderStep4DetermineRegister(), and founderStep6JarMethod()
// were already exported.
//
// WHAT THIS FILE DOES NOT DO. It does not change what any of the six primitives DOES -- no query
// text, no transport, no sig-figs filter, no elimination rule is touched (see each entry's own
// `attribution`, which points back to survey_stage.ts's own ATTRIBUTED comments, never re-deriving
// or restating them). It does not order the six into a runnable sequence -- that is
// survey_default_script.ts's job (D-BP152-042, stage 2/2), reusing script.ts's existing Script
// format rather than inventing a second one.
import { registerNameNumbered } from './method_registry';
const DEFINE_THE_TERM_DECLARATION = {
    id: 'liana_cycle.survey_stage.founderStep2Survey',
    version: '1',
    sourceFile: 'src/main/liana_cycle/survey_stage.ts',
    sourceLine: 1037,
    exportName: 'founderStep2Survey',
    exportKind: 'function',
    // D-BP152-045/BISHOP/seg-composer-ui-fixes -- rewritten to plain, operator-facing language.
    // Was developer prose naming internal functions (surveyAskNested(), AmbiguityQuery:1/
    // OperationQuery:1 cross-refs) and a "sig-figs-filter" implementation detail; this is a
    // description-only change to a registry declaration string, not to founderStep2Survey() itself.
    whatItDoes: 'Looks up the key term in the question -- or, if no term is given outright, works out what it '
        + 'likely is first -- then reads what it means from a source and checks whether any part of '
        + 'the question could reasonably be read more than one way.',
    parentId: 'Survey:1',
    inputs: 'term: string | null; ctx: MethodRunContext; askText?: string (used only on the no-term path); ambiguityQueryTransport?: \'google\' | \'gemma\'.',
    outputs: 'Promise<FounderStep2Result> -- term, nested survey, ambiguity findings, per-term nested surveys, negation flag, constraint/threshold questions and answers, why. Never a verdict/answer field.',
    decidesOrReports: 'REPORTS',
    queryText: {
        issuesQuery: true,
        description: 'Issues no query directly -- delegates entirely to askAmbiguity() (AmbiguityQuery:1), '
            + 'askOperation() (OperationQuery:1), askConstraint(), askThreshold(), and surveyAskNested().',
        loadedFromQueryResource: true,
    },
    attribution: {
        kind: 'NO_DECISION_RULE',
        why: 'Giving this step its own Name:Number identity adds no decision rule. This function\'s own '
            + 'sig-figs filter (kept-vs-dropped by stated impact) is already ATTRIBUTED at its own call '
            + 'site inside founderStep2Survey() (FD-BP152-20) -- this entry does not re-derive or '
            + 'restate it.',
    },
    orphanEvidence: 'N/A -- not an orphan. Live: exported function, called by runSurveyStage() (survey_stage.ts) '
        + 'on every Survey run. This field is populated only because StepDeclaration requires it.',
};
const CATEGORIZE_DECLARATION = {
    id: 'liana_cycle.survey_stage.founderStep3CategorizeOptions',
    version: '1',
    sourceFile: 'src/main/liana_cycle/survey_stage.ts',
    sourceLine: 1416,
    exportName: 'founderStep3CategorizeOptions',
    exportKind: 'function',
    // D-BP152-045: rewritten to plain language, description-only (see DefineTheTerm:1 above).
    whatItDoes: 'Sorts the answer options into groups by what they have in common, without ruling any of '
        + 'them out.',
    parentId: 'Survey:1',
    inputs: 'options: Record<string,string> | null; ctx: MethodRunContext; sharedFrame?: RegExp; maxCatalystWordsPerOption?: number.',
    outputs: 'Promise<FounderStep3Result> -- { perOption, grouping, why }. No elimination performed.',
    decidesOrReports: 'REPORTS',
    queryText: { issuesQuery: false, description: 'No Google query -- surveyAnswers() and groupOptionsByPredicate() talk only to the local model, not Google.', loadedFromQueryResource: false },
    attribution: {
        kind: 'NO_DECISION_RULE',
        why: 'Giving this step its own Name:Number identity adds no decision rule. The one real judgment '
            + 'this function delegates to (groupOptionsByPredicate()\'s model call) is already ATTRIBUTED '
            + 'at its own call site inside survey_stage.ts (Founder, BP151, verbatim: "Grouping requires '
            + 'a model call - like ALL judgements, and yes, relaxed for this one purpose.") -- this entry '
            + 'does not re-derive or restate it.',
    },
    orphanEvidence: 'N/A -- not an orphan. Live: exported function, called conditionally by runSurveyStage() '
        + '(the D-BP152-009 gate; see survey_default_script.ts for how the default script reproduces '
        + 'that gate). This field is populated only because StepDeclaration requires it.',
};
const DETERMINE_REGISTER_DECLARATION = {
    id: 'liana_cycle.survey_stage.founderStep4DetermineRegister',
    version: '1',
    sourceFile: 'src/main/liana_cycle/survey_stage.ts',
    sourceLine: 1490,
    exportName: 'founderStep4DetermineRegister',
    exportKind: 'function',
    // D-BP152-045: rewritten to plain language, description-only (see DefineTheTerm:1 above).
    whatItDoes: 'Checks whether the meaning found for the key term is the one clear match among the sources, '
        + 'or whether more than one meaning is still in play.',
    parentId: 'Survey:1',
    inputs: 'term: string | null; askText: string; options: Record<string,string> | null; ctx: MethodRunContext.',
    outputs: 'Promise<FounderStep4Result> -- { term, field, verified, why }.',
    decidesOrReports: 'REPORTS',
    queryText: { issuesQuery: true, description: 'Issues no query directly -- delegates entirely to fieldGate() (elements/field_gate.ts).', loadedFromQueryResource: false },
    attribution: {
        kind: 'NO_DECISION_RULE',
        why: 'Giving this step its own Name:Number identity adds no decision rule. The one decision this '
            + 'function itself makes (the ONE_SURVIVOR readout) is a direct enum-equality test, already '
            + 'documented at its own call site inside survey_stage.ts, citing Founder Excerpt 7 BP141 '
            + 'rule 13 ("How do I know that? I don\'t, I\'m guessing. So I\'ll check.") -- this entry does '
            + 'not re-derive or restate it.',
    },
    orphanEvidence: 'N/A -- not an orphan. Live: exported function, called unconditionally by runSurveyStage() on '
        + 'every Survey run. This field is populated only because StepDeclaration requires it.',
};
const JAR_METHOD_DECLARATION = {
    id: 'liana_cycle.survey_stage.founderStep6JarMethod',
    version: '1',
    sourceFile: 'src/main/liana_cycle/survey_stage.ts',
    sourceLine: 1612,
    exportName: 'founderStep6JarMethod',
    exportKind: 'function',
    // D-BP152-045: rewritten to plain language, description-only (see DefineTheTerm:1 above).
    whatItDoes: 'Goes through the sources gathered so far and rules out any answer option that a source '
        + 'directly and clearly contradicts.',
    parentId: 'Survey:1',
    inputs: 'sourceGroups: JarSourceGroup[]; options: Record<string,string> | null; ctx: MethodRunContext.',
    outputs: 'Promise<FounderStep6Result> -- { named, eliminated, eliminatedLetters, why }. This is Survey\'s one true elimination primitive -- narrows the option pool, never picks a final verdict letter.',
    decidesOrReports: 'DECIDES_AND_REFUSES',
    queryText: { issuesQuery: false, description: 'Issues NO Google query of its own -- reads only the blocks the caller already supplied inside sourceGroups.', loadedFromQueryResource: false },
    attribution: {
        kind: 'NO_DECISION_RULE',
        why: 'Giving this step its own Name:Number identity adds no decision rule. The elimination-by-'
            + 'declared-direction rule is already ATTRIBUTED at its own call site inside survey_stage.ts '
            + '(Founder, BP151, verbatim: "certainty is derived from my mechanical processes, not from '
            + 'any model\'s \'certainty\'.") -- this entry does not re-derive or restate it.',
    },
    orphanEvidence: 'N/A -- not an orphan. Live: exported function, called unconditionally by runSurveyStage() '
        + '(with opts.jarSourceGroups ?? [] -- an empty array unless a caller supplies one). This '
        + 'field is populated only because StepDeclaration requires it.',
};
const AMBIGUITY_QUERY_DECLARATION = {
    id: 'liana_cycle.survey_stage.askAmbiguity',
    version: '1',
    sourceFile: 'src/main/liana_cycle/survey_stage.ts',
    sourceLine: 526,
    exportName: 'askAmbiguity',
    exportKind: 'function',
    // D-BP152-045: rewritten to plain language, description-only (see DefineTheTerm:1 above).
    whatItDoes: 'Asks whether any word or phrase in the question could reasonably be read more than one way, '
        + 'and reports back what it finds -- it does not pick which meaning is right.',
    parentId: 'Survey:1',
    inputs: 'askText: string; ctx: MethodRunContext; transport?: \'google\' | \'gemma\' (default \'google\').',
    outputs: 'Promise<AmbiguityQueryResult> -- { askedText, terms, modelUnreachable, transport, citations, rawGooglePassage, rawModelOutput, why }.',
    decidesOrReports: 'REPORTS',
    queryText: {
        issuesQuery: true,
        description: 'Sends `${askText}\\n\\n${askedText}` to Google via googleBlocks(); askedText is loaded from '
            + 'resources/liana_survey_queries.json (id "survey.ambiguity.askedText").',
        loadedFromQueryResource: true,
    },
    attribution: {
        kind: 'NO_DECISION_RULE',
        why: 'Giving this step its own Name:Number identity adds no decision rule. The transport default '
            + '(Google unless the caller selects \'gemma\') and the \'gemma\' branch\'s refusal are '
            + 'already ATTRIBUTED at their own call sites inside askAmbiguity() itself -- this entry does '
            + 'not re-derive or restate them.',
    },
    orphanEvidence: 'N/A -- not an orphan. Live: called from founderStep2Survey()\'s no-term path on every Survey '
        + 'run that lacks a quoted/cued term. EXPORTED for the first time by this ticket (D-BP152-042) '
        + '-- previously module-private inside survey_stage.ts; see this file\'s own header. This '
        + 'field is populated only because StepDeclaration requires it.',
};
const OPERATION_QUERY_DECLARATION = {
    id: 'liana_cycle.survey_stage.askOperation',
    version: '1',
    sourceFile: 'src/main/liana_cycle/survey_stage.ts',
    sourceLine: 719,
    exportName: 'askOperation',
    exportKind: 'function',
    // D-BP152-045: rewritten to plain language, description-only (see DefineTheTerm:1 above).
    whatItDoes: 'Asks what kind of task the question is actually asking for -- for example, ranking, '
        + 'defining, classifying, or reasoning from evidence -- and reports what it finds.',
    parentId: 'Survey:1',
    inputs: 'askText: string; ctx: MethodRunContext; transport?: \'google\' | \'gemma\' (default \'google\', REUSED from Part 1\'s already-resolved value by its caller).',
    outputs: 'Promise<OperationQueryResult> -- { askedText, rawAnswer, modelUnreachable, transport, citations, rawGooglePassage, rawModelOutput, why }.',
    decidesOrReports: 'REPORTS',
    queryText: {
        issuesQuery: true,
        description: 'Sends `${askText}\\n\\n${askedText}` to Google via googleBlocks(); askedText is loaded from '
            + 'resources/liana_survey_queries.json (id "survey.operation.askedText").',
        loadedFromQueryResource: true,
    },
    attribution: {
        kind: 'NO_DECISION_RULE',
        why: 'Giving this step its own Name:Number identity adds no decision rule. The transport reuse '
            + '(no second resolver) and the \'gemma\' branch\'s refusal are already ATTRIBUTED at their '
            + 'own call sites inside askOperation() itself -- this entry does not re-derive or restate '
            + 'them.',
    },
    orphanEvidence: 'N/A -- not an orphan. Live: called from founderStep2Survey()\'s no-term path, immediately '
        + 'after AmbiguityQuery:1, on every Survey run that lacks a quoted/cued term. EXPORTED for the '
        + 'first time by this ticket (D-BP152-042) -- previously module-private inside survey_stage.ts; '
        + 'see this file\'s own header. This field is populated only because StepDeclaration requires it.',
};
/** Registers the six Survey primitives this ticket was asked to register: his Steps 2, 3, 4 and 6,
 *  plus the ambiguity query and the operation query as separately selectable steps. NOT called at
 *  module load -- a caller invokes this explicitly, same convention as method_registry.ts's own
 *  registerKnownMethods(). Calling it twice throws on the second call (duplicate id), the same
 *  behavior registerNameNumbered() gives every caller. Does not touch, re-register, or collide
 *  with `Survey:1` (method_registry.ts's own SURVEY_DECLARATION, D-BP152-040) -- that registration
 *  is untouched by this file. */
export function registerSurveyParts() {
    return [
        registerNameNumbered('DefineTheTerm', 1, DEFINE_THE_TERM_DECLARATION),
        registerNameNumbered('Categorize', 1, CATEGORIZE_DECLARATION),
        registerNameNumbered('DetermineRegister', 1, DETERMINE_REGISTER_DECLARATION),
        registerNameNumbered('JarMethod', 1, JAR_METHOD_DECLARATION),
        registerNameNumbered('AmbiguityQuery', 1, AMBIGUITY_QUERY_DECLARATION),
        registerNameNumbered('OperationQuery', 1, OPERATION_QUERY_DECLARATION),
    ];
}
