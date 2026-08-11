// state_the_question_step.ts -- D-BP152-049/BISHOP/seg-unify-registry-and-fixes, STAGE 3/4
//
// "STATE THE QUESTION" AS A SELECTABLE, NameNumbered STEP. Founder, BP152, verbatim: "I think we
// need to add a step 'State the Question'... I still think we need it so I can add it to my
// stack, just in case I want to go back to it in the same sequence script I make; or any other
// purpose."
//
// STEP 0 (liana_terminal_engine.ts, D-BP152-019/FD-BP152-14) ALREADY RUNS THIS AUTOMATICALLY, AT
// THE START OF EVERY RUN, UNCONDITIONALLY -- THIS TICKET DOES NOT TOUCH THAT. This file only
// registers the SAME logic under a NameNumbered id ('StateTheQuestion:1') so an operator can also
// place it explicitly, anywhere, inside an authored Composer stack -- exactly his own "in case I
// want to go back to it in the same sequence script I make" and "any other purpose". Placing it
// again mid-stack is legitimate, per his own words.
//
// REUSES, DOES NOT RE-WRITE. Running this step calls liana_terminal_engine.ts's
// emitStateTheQuestion() -- extracted from Step 0's own inline block by this same ticket
// (D-BP152-049 STAGE 3/4) so there is exactly ONE implementation of "state the question" in this
// codebase, not two. This file holds only the DECLARATION (registered via registerNameNumbered(),
// method_registry.ts); the execution wiring lives in script_bridge.ts's runOneStep(), the same
// place every other executable Composer id (ComparativeCascade:1 etc.) is wired.
//
// REGISTRATION IS INERT, the same discipline as survey_steps.ts's own declarations (see that
// file's header) -- this file imports NOTHING from liana_terminal_engine.ts, so importing it
// alone cannot run anything; only script_bridge.ts's runOneStep() branch (a separate module,
// executed only when this id is actually stacked and run) calls the real function.

import { registerNameNumbered } from './method_registry';
import type { MethodIdentity } from './method_identity';
import type { StepDeclaration } from './step_declaration';

const STATE_THE_QUESTION_DECLARATION: StepDeclaration = {
  id: 'liana_cycle.liana_terminal_engine.emitStateTheQuestion',
  version: '1',
  sourceFile: 'src/main/liana_cycle/liana_terminal_engine.ts',
  sourceLine: 120,
  exportName: 'emitStateTheQuestion',
  exportKind: 'function',
  whatItDoes:
    'States the question exactly as STEP 0 always does automatically at the start of every run -- '
    + 'the question verbatim, its options verbatim (or an honest note that there are none), '
    + 'whether options exist, and where the question came from -- so an operator can also place it '
    + 'again, explicitly, anywhere in an authored stack.',
  inputs: '{ qid?, question, options } (the same shape as MethodQuestionInput) plus an EmitFn, to emitStateTheQuestion().',
  outputs: 'StateTheQuestionResult { source, question, options, optionsExist, qid? }.',
  decidesOrReports: 'REPORTS',
  queryText: { issuesQuery: false, description: null, loadedFromQueryResource: false },
  attribution: {
    kind: 'ATTRIBUTED',
    founderRuling: 'BP152',
    quote:
      'I think we need to add a step \'State the Question\'... I still think we need it so I can '
      + 'add it to my stack, just in case I want to go back to it in the same sequence script I '
      + 'make; or any other purpose.',
    citedAt: 'D-BP152-049 dispatch (this ticket)',
  },
  orphanEvidence:
    'N/A -- not an orphan. Live: emitStateTheQuestion() is called both by STEP 0\'s own automatic '
    + 'block in liana_terminal_engine.ts and by script_bridge.ts\'s runOneStep() for this '
    + 'NameNumbered id. This field is populated only because StepDeclaration requires it; no '
    + 'orphan claim is made.',
};

/** Registers 'StateTheQuestion:1'. Called from script_bridge.ts's ensureRegistryPopulated(),
 *  idempotently (same try/catch shape as registerKnownMethods()/registerSurveyParts() there) --
 *  NOT from registerKnownMethods() itself, so method_registry.test.ts's own "exactly ten entries"
 *  assertion (D-BP152-040) stays true unchanged; this is a new, separate, additive registration
 *  point, the same pattern D-BP152-047 already established for registerSurveyParts(). */
export function registerStateTheQuestionStep(): MethodIdentity {
  return registerNameNumbered('StateTheQuestion', 1, STATE_THE_QUESTION_DECLARATION);
}
