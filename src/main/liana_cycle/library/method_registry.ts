// method_registry.ts -- D-BP152-040/BISHOP/seg-method-identity-registry
//
// THE REGISTRY THAT HOLDS NAMENUMBERED METHODS. Founder ruling, BP152, verbatim
// (RULINGS_BP152.md FD-BP152-20): "I want to use it to stack methods in whatever order I want -
// I don't need the lego shapes, I just want them NameNumbered (so that we can have iterations
// galore) as methods so that I can mix and match as I please."
//
// This is an in-memory map from a MethodIdentity's canonical `Name:Number` id (method_identity.ts)
// to a StepDeclaration (library/step_declaration.ts, D-BP152-018 -- the SAME declaration shape
// orphan_catalog.ts already uses; this file does not invent a second one).
//
// A concurrent ticket, D-BP152-041, owns script.ts/script_runner.ts in this same directory --
// the format for STACKING registered methods into an ordered, runnable sequence, and the runner
// that executes one. Neither is built here. This file only holds WHAT can be named and looked
// up; it does not order, run, or persist anything.
//
// REGISTRATION IS INERT, THE SAME WAY orphan_catalog.ts's IS (see that file's own header and its
// own "registration is inert" test, orphan_catalog.test.ts). Every declaration below is a plain
// string/number/plain-object description written by hand from reading the cited source -- this
// file imports NOTHING from methods/comparative_cascade.ts, methods/definitional_cascade.ts,
// methods/classify_cascade.ts, or survey_stage.ts, so importing this module cannot execute any
// of the code those declarations describe (no Google query, no Gemma call, no cascade run()).
// The only import besides method_identity.ts and step_declaration.ts is orphan_catalog.ts's own
// already-inert listOrphanSteps() -- reused rather than re-transcribed, per this ticket's
// instruction not to invent a second declaration shape.

import { formatMethodId, parseMethodId } from './method_identity';
import type { MethodIdentity } from './method_identity';
import type { StepDeclaration } from './step_declaration';
import { listOrphanSteps } from './orphan_catalog';

export interface RegisteredMethod {
  identity: MethodIdentity;
  declaration: StepDeclaration;
}

const REGISTRY = new Map<string, RegisteredMethod>();

/** Registers `declaration` under the canonical `Name:Number` identity built from `name`/`number`.
 *  A duplicate `Name:Number` is an error, not an overwrite -- per this ticket's instruction and
 *  Rule 66 ("version, never overwrite"): the same name at a different number is a new iteration,
 *  registered independently and freely; the same name at the SAME number that already exists is
 *  a programming error, thrown immediately rather than silently replacing the earlier
 *  registration. This is the public "register" capability of the registry -- the operator's own
 *  "stack methods NameNumbered" mechanism, not limited to the ten pre-existing entries
 *  registerKnownMethods() below installs. */
export function registerNameNumbered(name: string, number: number, declaration: StepDeclaration): MethodIdentity {
  const identity = parseMethodId(formatMethodId(name, number));
  if (REGISTRY.has(identity.id)) {
    throw new Error(`method_registry: duplicate method id "${identity.id}" -- Name:Number is the canonical identity and is never overwritten (Rule 66); register a new number for a new iteration`);
  }
  REGISTRY.set(identity.id, { identity, declaration });
  return identity;
}

/** Looks up a registered method by its canonical `Name:Number` id. Returns `undefined` if no
 *  such id was registered -- never throws on a miss. */
export function lookupById(id: string): RegisteredMethod | undefined {
  return REGISTRY.get(id);
}

/** Every registered method, in registration order. Returns a fresh array each call -- callers
 *  cannot mutate the registry by reference (same discipline as orphan_catalog.ts's
 *  listOrphanSteps()). */
export function listAllEntries(): RegisteredMethod[] {
  return Array.from(REGISTRY.values());
}

/** Every registered iteration of one `name`, sorted ascending by `number`. */
export function listIterationsOfName(name: string): RegisteredMethod[] {
  return listAllEntries()
    .filter((entry) => entry.identity.name === name)
    .sort((a, b) => a.identity.number - b.identity.number);
}

/** The highest registered `number` for `name`, or `null` if `name` has no registered iteration
 *  at all. This is a lookup over what is already registered -- it does not reserve, predict, or
 *  allocate the next number for a caller that wants to register a new iteration. */
export function latestNumberOfName(name: string): number | null {
  const iterations = listIterationsOfName(name);
  if (iterations.length === 0) return null;
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

const COMPARATIVE_CASCADE_DECLARATION: StepDeclaration = {
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
  whatItDoes:
    'Answers questions that ask you to rank a short list of similar items by some property, like '
    + 'size or population -- it looks up a number for each option and gives you the one that '
    + 'ranks highest or lowest, or says it cannot tell.',
  inputs: 'MethodQuestionInput (question, options, qid?, correctAnswer?) to shapeTest(); the same input plus MethodRunContext (askGoogle, emit) to run().',
  outputs: 'ShapeTestResult { matches, reason } from shapeTest(); Promise<LianaTerminalOutcome> from run().',
  decidesOrReports: 'DECIDES_AND_REFUSES',
  queryText: {
    issuesQuery: true,
    description:
      'Forms and sends Google queries per stage (register gate, inverse, order-both-ways, Cake '
      + 'Cut Half, hard number) via the injected askGoogle(); templates are hardcoded inline in '
      + 'this file, not loaded from a runtime resource. Full stage order in the file header.',
    loadedFromQueryResource: false,
  },
  attribution: {
    kind: 'NO_DECISION_RULE',
    why:
      'Registering this method under a Name:Number identity adds no decision rule. The method\'s '
      + 'own decision rules (the terminator\'s value-convergence/votes/abstain order, the sole-'
      + 'survivor removal) are already ATTRIBUTED at their own call sites inside '
      + 'comparative_cascade.ts (see its header, lines 31-58, and evaluateComparativeTerminator()) '
      + '-- this entry does not re-derive or restate them.',
  },
  orphanEvidence:
    'N/A -- not an orphan. Live: registered into the pre-existing method registry via '
    + 'registerMethod(comparativeCascadeMethod) (comparative_cascade.ts:1247), demand RANK, '
    + 'selectable by method_registry.ts\'s selectMethod() whenever a question\'s demand is RANK. '
    + 'This field is populated only because StepDeclaration requires it; no orphan claim is made.',
};

const DEFINITIONAL_CASCADE_DECLARATION: StepDeclaration = {
  id: 'methods.definitional_cascade.definitionalCascadeMethod',
  version: '1',
  sourceFile: 'src/main/liana_cycle/methods/definitional_cascade.ts',
  sourceLine: 408,
  exportName: 'definitionalCascadeMethod',
  exportKind: 'const',
  // D-BP152-045: rewritten to plain language, description-only (see ComparativeCascade:1 above).
  whatItDoes:
    'Answers questions that ask what a term means, where the options are competing definitions -- '
    + 'it looks up every verified meaning of the term, but honestly says it does not know rather '
    + 'than guessing when it cannot match a meaning to one of the options.',
  inputs: 'MethodQuestionInput (question, options, qid?, correctAnswer?) to shapeTest(); the same input plus MethodRunContext (askGoogle, emit) to run().',
  outputs: 'ShapeTestResult { matches, reason } from shapeTest(); Promise<LianaTerminalOutcome> from run().',
  decidesOrReports: 'DECIDES_AND_REFUSES',
  queryText: {
    issuesQuery: true,
    description:
      'Forms and sends Google queries via the shared comparative_cascade.ts stage-0/1/2 helpers '
      + 'plus surveyAsk()/fieldGate(); templates are hardcoded inline in this file and its '
      + 'imports, not loaded from a runtime resource.',
    loadedFromQueryResource: false,
  },
  attribution: {
    kind: 'NO_DECISION_RULE',
    why:
      'Registering this method under a Name:Number identity adds no decision rule. The method\'s '
      + 'own decision rules (D1 clustering, the D2-D4 survey-not-collapse replacement, D5\'s '
      + 'deliberate non-implementation) are already documented and attributed at their own sites '
      + 'inside definitional_cascade.ts (see its header, lines 23-51) -- this entry does not '
      + 're-derive or restate them.',
  },
  orphanEvidence:
    'N/A -- not an orphan. Live: registered into the pre-existing method registry via '
    + 'registerMethod(definitionalCascadeMethod) (definitional_cascade.ts:420), demand DEFINE, '
    + 'selectable by method_registry.ts\'s selectMethod() whenever a question\'s demand is DEFINE. '
    + 'This field is populated only because StepDeclaration requires it; no orphan claim is made.',
};

const CLASSIFY_CASCADE_DECLARATION: StepDeclaration = {
  id: 'methods.classify_cascade.classifyCascadeMethod',
  version: '1',
  sourceFile: 'src/main/liana_cycle/methods/classify_cascade.ts',
  sourceLine: 1606,
  exportName: 'classifyCascadeMethod',
  exportKind: 'const',
  // D-BP152-045: rewritten to plain language, description-only (see ComparativeCascade:1 above).
  whatItDoes:
    'Answers questions that ask which category something belongs to -- it rules out options that '
    + 'clearly fail a test, keeps checking with more tests until only one is left, and only gives '
    + 'an answer once it is confident; it never guesses on a tie.',
  inputs: 'MethodQuestionInput (question, options, qid?, correctAnswer?) to shapeTest(); the same input plus MethodRunContext (askGoogle, emit) to run().',
  outputs: 'ShapeTestResult { matches, reason } from shapeTest(); Promise<LianaTerminalOutcome> from run().',
  decidesOrReports: 'DECIDES_AND_REFUSES',
  queryText: {
    issuesQuery: true,
    description:
      'Sends one Google query per criterion per option via evaluateCriterionForOption(); the '
      + 'query text is formed from the question\'s own structurally-extracted candidate terms, '
      + 'not loaded from a runtime resource.',
    loadedFromQueryResource: false,
  },
  attribution: {
    kind: 'NO_DECISION_RULE',
    why:
      'Registering this method under a Name:Number identity adds no decision rule. The '
      + 'terminator itself (Occam elimination, the litmus-strip loop, the Banyan-Metric publish/ '
      + 'abstain rule) is ATTRIBUTED to the Founder\'s membership terminator ruling, quoted '
      + 'verbatim in classify_cascade.ts\'s own header (lines 18-42, RULINGS_BP152.md FD-BP152-19) '
      + '-- this entry does not re-derive or restate that quote.',
  },
  orphanEvidence:
    'N/A -- not an orphan. Live: registered into the pre-existing method registry via '
    + 'registerMethod(classifyCascadeMethod) (classify_cascade.ts:1619), demand CLASSIFY, '
    + 'selectable by method_registry.ts\'s selectMethod() whenever a question\'s demand is '
    + 'CLASSIFY. This field is populated only because StepDeclaration requires it; no orphan '
    + 'claim is made.',
};

const SURVEY_DECLARATION: StepDeclaration = {
  id: 'liana_cycle.survey_stage.runSurveyStage',
  version: '1',
  sourceFile: 'src/main/liana_cycle/survey_stage.ts',
  sourceLine: 1729,
  exportName: 'runSurveyStage',
  exportKind: 'function',
  // D-BP152-045: rewritten to plain language, description-only (see ComparativeCascade:1 above).
  whatItDoes:
    'Does the groundwork before any answer is picked: looks up what the key term in the question '
    + 'means, sorts the answer options into groups, checks whether that meaning is well '
    + 'established, and rules out any option a source directly contradicts.',
  inputs: 'askText: string; options: Record<string,string> | null; ctx: MethodRunContext; opts: SurveyStageOpts (term hints, jarSourceGroups, ambiguityQueryTransport, etc).',
  outputs: 'Promise<SurveyStageResult>.',
  decidesOrReports: 'DECIDES_AND_REFUSES',
  queryText: {
    issuesQuery: true,
    description:
      'Issues Google (or Gemma, per ambiguityQueryTransport) queries across steps 2/3/4/6; some '
      + 'of its composed elements (e.g. survey_ask.ts, field_gate.ts) load query text from '
      + 'resources/liana_survey_queries.json via query_text_loader.ts, the D-BP152-008 '
      + 'runtime-editable resource.',
    loadedFromQueryResource: true,
  },
  attribution: {
    kind: 'NO_DECISION_RULE',
    why:
      'Registering this step under a Name:Number identity adds no decision rule. The two '
      + 'Founder-ordered decision rules this file itself owns (step 3\'s grouping model call, '
      + 'step 6\'s direction-driven elimination) are already ATTRIBUTED at their own call sites '
      + 'inside survey_stage.ts, per this file\'s own doc comment above runSurveyStage() -- this '
      + 'entry does not re-derive or restate them.',
  },
  orphanEvidence:
    'N/A -- not an orphan. runSurveyStage() is a complete, tested, exported function '
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
export function registerKnownMethods(): MethodIdentity[] {
  const identities: MethodIdentity[] = [
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
