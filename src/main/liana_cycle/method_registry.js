// method_registry.ts -- D-BP149-041/BISHOP/S41/seg-methodregistry
//
// THE METHOD REGISTRY. Ratified canon:
//   Asteroid-ProofVault/state/eblets/CANON/
//     canon_the_liana_cycle_is_a_method_registry_taught_by_humans_bp149.eblet.md
// Founder, BP149, verbatim: "put this engine behind the terminal, so I just type the
// question... exactly. Because that is the basis of the Liana Cycle -- where we then do the
// next question -- qid 85, using the other method I used to solve it... I guide, I train, I
// give the Human Nuance, and you record (through Mnemosynec) and learn and apply... the POINT
// is that that won't cover EVERY question. But I will. And so will other human operators,
// which will teach the Substrate in the Cooperative."
//
// THE RULING THIS FILE IMPLEMENTS (five points, canon section "THE ARCHITECTURE THIS
// REQUIRES"):
//   1. Methods are named, recorded objects -- not branches inside one function. Each entry
//      below is data (id/name/taughtBy) plus two functions (shapeTest, run), never a case
//      label in a switch.
//   2. The terminal SELECTS, it never guesses. selectMethod() runs every registered method's
//      shapeTest() and returns the first one that matches. If none match, it returns null and
//      the caller (liana_terminal_engine.ts) must say so plainly rather than running anything.
//   3. An unmatched question is a teaching prompt, not a failure -- see
//      liana_terminal_engine.ts's no-match transcript text.
//   4. The human is the generator. Nothing in this file invents a new method; every entry here
//      was taught by a human operator working a real case by hand (see each method's
//      `taughtBy` field for the citation).
//   5. Methods accumulate across operators -- this registry is the single append point. A
//      method taught once (registered here) is available to every future question of that
//      shape, for every operator.
//
// A method may be REGISTERED with no RUNNER (`run: null`) -- that is deliberate, not a bug.
// METHOD 2 ("definitional-cascade") ships this way in this ticket: its shape is known (the
// Founder's qid 85 walkthrough taught it), but its stages are not yet built. The registry must
// be able to hold a known-but-unimplemented method so the terminal can say "this is a
// recognized shape, not yet taught" instead of the less honest "no method matches" -- those are
// different findings and the transcript must not conflate them.
// D-BP152-049 STAGE 4/4 -- see this file's own STAGE 4/4 section, below explainSelection(), for
// why these three additional imports now live here (they were library/method_registry.ts's own,
// moved verbatim as part of the registry unification).
import { formatMethodId, parseMethodId } from './library/method_identity';
import { listOrphanSteps } from './library/orphan_catalog';
/** Average option length in words -- the one cheap, generic signal every shapeTest() below uses
 *  to tell "options are short members of one category" (comparative shape, e.g. region names)
 *  apart from "options are full competing statements" (definitional shape, e.g. "It describes a
 *  process that..."). Calibrated against the six real BP149 questions in the canon's own
 *  comparison table (qid 98 comparative avg ~2.0 words/option; qid 85 definitional avg ~11
 *  words/option; qid 92/72/66/46 -- neither shape -- fall in between and are additionally
 *  screened out by each method's own cue-word test). Exported so both methods (and any future
 *  ones) share one measurement instead of each re-deriving it slightly differently. */
export function avgOptionWordCount(options) {
    const texts = Object.values(options);
    if (!texts.length)
        return 0;
    const total = texts.reduce((sum, t) => sum + t.trim().split(/\s+/).filter(Boolean).length, 0);
    return total / texts.length;
}
const REGISTRY = [];
/** Append-only. Called once per method module at import time (see comparative_cascade.ts /
 *  definitional_cascade.ts's bottom-of-file registerMethod() call, and
 *  liana_terminal_engine.ts's import of both). Registering the same id twice is a programming
 *  error, not a runtime condition to handle gracefully -- it throws immediately so it is caught
 *  at build/first-run time, not silently shadowed. */
export function registerMethod(method) {
    if (REGISTRY.some((m) => m.id === method.id)) {
        throw new Error(`method_registry: duplicate method id "${method.id}" -- ids must be unique`);
    }
    REGISTRY.push(method);
}
export function listMethods() {
    return REGISTRY.slice();
}
/** Runs every registered method's shapeTest() in registration order and returns the FIRST
 *  match, plus that match's own ShapeTestResult (so the caller can print the reason without
 *  re-running the test). Returns null when nothing matches -- the caller (
 *  liana_terminal_engine.ts) must treat that as "ask the human", never as license to run the
 *  first method anyway. This function itself performs no I/O (shapeTest() contracts are pure),
 *  so calling it to print a full per-method report costs nothing. */
export function selectMethod(input, 
/** D-BP150-003. The question's DEMAND, determined once by the caller (so the transcript can
 *  print it) and passed in. `null` means it could not be determined -- and per canon R-4/R-5
 *  that means NO METHOD MAY RUN. A question whose operation is unknown is a teaching prompt; a
 *  method run against an unknown operation is exactly the "used wrongly" case this guards.
 *  OPTIONAL so a pre-demand caller keeps compiling; omitting it skips the demand gate entirely
 *  and restores the old shape-only behavior. */
demand) {
    const demandGated = demand !== undefined;
    for (const method of REGISTRY) {
        // R-6: demand PRECEDES shape. Shape asks "can this machinery operate on this option set";
        // demand asks "is this method's operation the one the question wants". Both must pass, and
        // demand is checked first because it is the cheaper and more decisive of the two.
        if (demandGated && method.demand !== demand)
            continue;
        const shape = method.shapeTest(input);
        if (shape.matches)
            return { method, shape };
    }
    return null;
}
/** Why each method was or was not eligible, for the transcript. Separated from selectMethod so the
 *  engine can print a full per-method report without re-running selection. Founder, BP149: "I
 *  DESPISE SUMMARIES" -- a method skipped on demand must say so, not silently vanish from the
 *  listing the way a shape-test failure never did. */
export function explainSelection(input, demand) {
    return REGISTRY.map((method) => {
        if (method.demand !== demand) {
            return {
                method,
                eligible: false,
                reason: `serves ${method.demand}, this question demands ${demand ?? 'UNKNOWN'} -- not run (canon R-4)`,
            };
        }
        const shape = method.shapeTest(input);
        return { method, eligible: shape.matches, reason: `demand ${method.demand} matches; shape: ${shape.reason}` };
    });
}
const NAMENUMBERED_REGISTRY = new Map();
/** Registers `declaration` under the canonical `Name:Number` identity built from `name`/`number`.
 *  A duplicate `Name:Number` is an error, not an overwrite -- per this ticket's instruction and
 *  Rule 66 ("version, never overwrite"): the same name at a different number is a new iteration,
 *  registered independently and freely; the same name at the SAME number that already exists is
 *  a programming error, thrown immediately rather than silently replacing the earlier
 *  registration. This is the public "register" capability of the registry -- the operator's own
 *  "stack methods NameNumbered" mechanism, not limited to the ten pre-existing entries
 *  registerKnownMethods() below installs. */
export function registerNameNumbered(name, number, declaration) {
    const identity = parseMethodId(formatMethodId(name, number));
    if (NAMENUMBERED_REGISTRY.has(identity.id)) {
        throw new Error(`method_registry: duplicate method id "${identity.id}" -- Name:Number is the canonical identity and is never overwritten (Rule 66); register a new number for a new iteration`);
    }
    NAMENUMBERED_REGISTRY.set(identity.id, { identity, declaration });
    return identity;
}
/** Looks up a registered method by its canonical `Name:Number` id. Returns `undefined` if no
 *  such id was registered -- never throws on a miss. */
export function lookupById(id) {
    return NAMENUMBERED_REGISTRY.get(id);
}
/** Every registered method, in registration order. Returns a fresh array each call -- callers
 *  cannot mutate the registry by reference (same discipline as orphan_catalog.ts's
 *  listOrphanSteps()). */
export function listAllEntries() {
    return Array.from(NAMENUMBERED_REGISTRY.values());
}
/** Every registered iteration of one `name`, sorted ascending by `number`. */
export function listIterationsOfName(name) {
    return listAllEntries()
        .filter((entry) => entry.identity.name === name)
        .sort((a, b) => a.identity.number - b.identity.number);
}
/** The highest registered `number` for `name`, or `null` if `name` has no registered iteration
 *  at all. This is a lookup over what is already registered -- it does not reserve, predict, or
 *  allocate the next number for a caller that wants to register a new iteration. */
export function latestNumberOfName(name) {
    const iterations = listIterationsOfName(name);
    if (iterations.length === 0)
        return null;
    return iterations[iterations.length - 1].identity.number;
}
// ─────────────────────────────────────────────────────────────────────────────────────────────
// WHAT IS REGISTERED. Ten entries: the three cascade methods (comparative-cascade serves RANK,
// definitional-cascade serves DEFINE, classify-cascade serves CLASSIFY), the Survey stage, and
// the 6 verified orphans already catalogued in orphan_catalog.ts. Every declaration below was
// written from reading the cited source file directly (sourceFile/sourceLine/exportName/
// exportKind checked against the file at the time of writing), not guessed.
//
// `attribution` on these four is NO_DECISION_RULE: registering a method under a Name:Number
// identity adds no decision rule of its own -- it is a lookup key pointing at code whose own
// decision rules (terminators, gates, thresholds) already carry their own ATTRIBUTED/TARE markers
// at their own call sites inside the cited file, per HARDWIRE-23 Law 4. This entry does not
// re-derive, quote out of context, or alter any of those; see the cited sourceFile for the real
// attribution of what the method actually decides.
const COMPARATIVE_CASCADE_DECLARATION = {
    id: 'methods.comparative_cascade.comparativeCascadeMethod',
    version: '1',
    sourceFile: 'src/main/liana_cycle/methods/comparative_cascade.ts',
    sourceLine: 1235,
    exportName: 'comparativeCascadeMethod',
    exportKind: 'const',
    // D-BP152-045/BISHOP/seg-composer-ui-fixes -- rewritten to plain, operator-facing language.
    // Founder, live report: he should never see "LianaMethod object" or a field list. This is a
    // description-only change to a registry declaration string; comparativeCascadeMethod() itself
    // (comparative_cascade.ts) is untouched.
    whatItDoes: 'Answers questions that ask you to rank a short list of similar items by some property, like '
        + 'size or population -- it looks up a number for each option and gives you the one that '
        + 'ranks highest or lowest, or says it cannot tell.',
    inputs: 'MethodQuestionInput (question, options, qid?, correctAnswer?) to shapeTest(); the same input plus MethodRunContext (askGoogle, emit) to run().',
    outputs: 'ShapeTestResult { matches, reason } from shapeTest(); Promise<LianaTerminalOutcome> from run().',
    decidesOrReports: 'DECIDES_AND_REFUSES',
    queryText: {
        issuesQuery: true,
        description: 'Forms and sends Google queries per stage (register gate, inverse, order-both-ways, Cake '
            + 'Cut Half, hard number) via the injected askGoogle(); templates are hardcoded inline in '
            + 'this file, not loaded from a runtime resource. Full stage order in the file header.',
        loadedFromQueryResource: false,
    },
    attribution: {
        kind: 'NO_DECISION_RULE',
        why: 'Registering this method under a Name:Number identity adds no decision rule. The method\'s '
            + 'own decision rules (the terminator\'s value-convergence/votes/abstain order, the sole-'
            + 'survivor removal) are already ATTRIBUTED at their own call sites inside '
            + 'comparative_cascade.ts (see its header, lines 31-58, and evaluateComparativeTerminator()) '
            + '-- this entry does not re-derive or restate them.',
    },
    orphanEvidence: 'N/A -- not an orphan. Live: registered into the pre-existing method registry via '
        + 'registerMethod(comparativeCascadeMethod) (comparative_cascade.ts:1247), demand RANK, '
        + 'selectable by method_registry.ts\'s selectMethod() whenever a question\'s demand is RANK. '
        + 'This field is populated only because StepDeclaration requires it; no orphan claim is made.',
};
const DEFINITIONAL_CASCADE_DECLARATION = {
    id: 'methods.definitional_cascade.definitionalCascadeMethod',
    version: '1',
    sourceFile: 'src/main/liana_cycle/methods/definitional_cascade.ts',
    sourceLine: 408,
    exportName: 'definitionalCascadeMethod',
    exportKind: 'const',
    // D-BP152-045: rewritten to plain language, description-only (see ComparativeCascade:1 above).
    whatItDoes: 'Answers questions that ask what a term means, where the options are competing definitions -- '
        + 'it looks up every verified meaning of the term, but honestly says it does not know rather '
        + 'than guessing when it cannot match a meaning to one of the options.',
    inputs: 'MethodQuestionInput (question, options, qid?, correctAnswer?) to shapeTest(); the same input plus MethodRunContext (askGoogle, emit) to run().',
    outputs: 'ShapeTestResult { matches, reason } from shapeTest(); Promise<LianaTerminalOutcome> from run().',
    decidesOrReports: 'DECIDES_AND_REFUSES',
    queryText: {
        issuesQuery: true,
        description: 'Forms and sends Google queries via the shared comparative_cascade.ts stage-0/1/2 helpers '
            + 'plus surveyAsk()/fieldGate(); templates are hardcoded inline in this file and its '
            + 'imports, not loaded from a runtime resource.',
        loadedFromQueryResource: false,
    },
    attribution: {
        kind: 'NO_DECISION_RULE',
        why: 'Registering this method under a Name:Number identity adds no decision rule. The method\'s '
            + 'own decision rules (D1 clustering, the D2-D4 survey-not-collapse replacement, D5\'s '
            + 'deliberate non-implementation) are already documented and attributed at their own sites '
            + 'inside definitional_cascade.ts (see its header, lines 23-51) -- this entry does not '
            + 're-derive or restate them.',
    },
    orphanEvidence: 'N/A -- not an orphan. Live: registered into the pre-existing method registry via '
        + 'registerMethod(definitionalCascadeMethod) (definitional_cascade.ts:420), demand DEFINE, '
        + 'selectable by method_registry.ts\'s selectMethod() whenever a question\'s demand is DEFINE. '
        + 'This field is populated only because StepDeclaration requires it; no orphan claim is made.',
};
const CLASSIFY_CASCADE_DECLARATION = {
    id: 'methods.classify_cascade.classifyCascadeMethod',
    version: '1',
    sourceFile: 'src/main/liana_cycle/methods/classify_cascade.ts',
    sourceLine: 1606,
    exportName: 'classifyCascadeMethod',
    exportKind: 'const',
    // D-BP152-045: rewritten to plain language, description-only (see ComparativeCascade:1 above).
    whatItDoes: 'Answers questions that ask which category something belongs to -- it rules out options that '
        + 'clearly fail a test, keeps checking with more tests until only one is left, and only gives '
        + 'an answer once it is confident; it never guesses on a tie.',
    inputs: 'MethodQuestionInput (question, options, qid?, correctAnswer?) to shapeTest(); the same input plus MethodRunContext (askGoogle, emit) to run().',
    outputs: 'ShapeTestResult { matches, reason } from shapeTest(); Promise<LianaTerminalOutcome> from run().',
    decidesOrReports: 'DECIDES_AND_REFUSES',
    queryText: {
        issuesQuery: true,
        description: 'Sends one Google query per criterion per option via evaluateCriterionForOption(); the '
            + 'query text is formed from the question\'s own structurally-extracted candidate terms, '
            + 'not loaded from a runtime resource.',
        loadedFromQueryResource: false,
    },
    attribution: {
        kind: 'NO_DECISION_RULE',
        why: 'Registering this method under a Name:Number identity adds no decision rule. The '
            + 'terminator itself (Occam elimination, the litmus-strip loop, the Banyan-Metric publish/ '
            + 'abstain rule) is ATTRIBUTED to the Founder\'s membership terminator ruling, quoted '
            + 'verbatim in classify_cascade.ts\'s own header (lines 18-42, RULINGS_BP152.md FD-BP152-19) '
            + '-- this entry does not re-derive or restate that quote.',
    },
    orphanEvidence: 'N/A -- not an orphan. Live: registered into the pre-existing method registry via '
        + 'registerMethod(classifyCascadeMethod) (classify_cascade.ts:1619), demand CLASSIFY, '
        + 'selectable by method_registry.ts\'s selectMethod() whenever a question\'s demand is '
        + 'CLASSIFY. This field is populated only because StepDeclaration requires it; no orphan '
        + 'claim is made.',
};
const SURVEY_DECLARATION = {
    id: 'liana_cycle.survey_stage.runSurveyStage',
    version: '1',
    sourceFile: 'src/main/liana_cycle/survey_stage.ts',
    sourceLine: 1729,
    exportName: 'runSurveyStage',
    exportKind: 'function',
    // D-BP152-045: rewritten to plain language, description-only (see ComparativeCascade:1 above).
    whatItDoes: 'Does the groundwork before any answer is picked: looks up what the key term in the question '
        + 'means, sorts the answer options into groups, checks whether that meaning is well '
        + 'established, and rules out any option a source directly contradicts.',
    inputs: 'askText: string; options: Record<string,string> | null; ctx: MethodRunContext; opts: SurveyStageOpts (term hints, jarSourceGroups, ambiguityQueryTransport, etc).',
    outputs: 'Promise<SurveyStageResult>.',
    decidesOrReports: 'DECIDES_AND_REFUSES',
    queryText: {
        issuesQuery: true,
        description: 'Issues Google (or Gemma, per ambiguityQueryTransport) queries across steps 2/3/4/6; some '
            + 'of its composed elements (e.g. survey_ask.ts, field_gate.ts) load query text from '
            + 'resources/liana_survey_queries.json via query_text_loader.ts, the D-BP152-008 '
            + 'runtime-editable resource.',
        loadedFromQueryResource: true,
    },
    attribution: {
        kind: 'NO_DECISION_RULE',
        why: 'Registering this step under a Name:Number identity adds no decision rule. The two '
            + 'Founder-ordered decision rules this file itself owns (step 3\'s grouping model call, '
            + 'step 6\'s direction-driven elimination) are already ATTRIBUTED at their own call sites '
            + 'inside survey_stage.ts, per this file\'s own doc comment above runSurveyStage() -- this '
            + 'entry does not re-derive or restate them.',
    },
    orphanEvidence: 'N/A -- not an orphan. runSurveyStage() is a complete, tested, exported function '
        + '(survey_stage.ts:1729); its own doc comment (lines 1714-1728) states it is "ready to be '
        + 'called by whichever future ticket resolves that wiring decision." Whether any caller '
        + 'currently invokes it is a fact about liana_terminal_engine.ts, a file this ticket does not '
        + 'touch and makes no claim about either way -- this field is populated only because '
        + 'StepDeclaration requires it; no orphan claim is made.',
};
/** Registers the ten pre-existing entries this ticket was asked to register: the three cascade
 *  methods, the Survey stage, and the 6 verified orphans from orphan_catalog.ts. NOT called at
 *  module load -- a caller invokes this explicitly. Calling it twice throws on the second call
 *  (every id it registers would already be present), the same "duplicate is an error" behavior
 *  registerNameNumbered() gives every caller. */
export function registerKnownMethods() {
    const identities = [
        registerNameNumbered('ComparativeCascade', 1, COMPARATIVE_CASCADE_DECLARATION),
        registerNameNumbered('DefinitionalCascade', 1, DEFINITIONAL_CASCADE_DECLARATION),
        registerNameNumbered('ClassifyCascade', 1, CLASSIFY_CASCADE_DECLARATION),
        registerNameNumbered('Survey', 1, SURVEY_DECLARATION),
    ];
    for (const orphan of listOrphanSteps()) {
        identities.push(registerNameNumbered(orphan.exportName, 1, orphan));
    }
    return identities;
}
