// survey_default_script.ts -- D-BP152-042/BISHOP/seg-survey-composable-steps, STAGE 2/2
//
// `Survey:1` EXPRESSED AS A SCRIPT -- an ordered list of its own parts' ids, per script.ts's
// existing format (D-BP152-041), rather than a hardcoded call sequence. Founder, BP152, verbatim
// (FD-BP152-09): "A SCRIPT is an ordered sequence of steps... A SAVED SEQUENCE IS ITSELF A STEP."
// This ticket's own ask: "I want to be able to skip survey or one by one put the parts of it in,
// or not."
//
// THE DEFAULT SCRIPT REPRODUCES TODAY'S BEHAVIOR EXACTLY -- same four steps, same order
// (`runSurveyStage()`, `src/main/liana_cycle/survey_stage.ts`, current HEAD: term resolved once,
// then Step 2, Step 3 [gated], Step 4, Step 6, unconditionally in that order). See
// survey_script.test.ts for the byte-identical proof (this ticket's own assertion (c)) and for
// exactly how the D-BP152-009 gate (Step 3 runs only when Step 2's operation query did not resolve
// a demand) is reproduced -- that gate is NOT expressible inside this static, ordered `steps`
// array (script.ts's own format has no conditional branch), so it lives in the MethodExecutor the
// test builds, mirroring runSurveyStage()'s own gate formula verbatim, not re-deriving it. Nothing
// in THIS file (pure data, four id strings and their attributions) makes that choice -- flagged
// here so a reader of this file alone is not misled into thinking the gate is captured by the
// steps array itself.
//
// This file holds PURE DATA -- no import of survey_stage.ts, method_registry.ts, or any executable
// code. A Script (script.ts's own type) is just {identity, description, steps, savedBy, savedAt};
// nothing here can execute anything (see survey_script.test.ts's own "inert" assertion).
//
// UNWIRED. This script is not resolved, run, or referenced by liana_terminal_engine.ts or any live
// run path -- runSurveyStage() itself is UNCHANGED and remains the thing actually wired (behind
// isContingencyOperatorSurveySpliceEnabled(), unrelated to this ticket). Wiring the script/runner
// pair into a real run is a separate ruling, per script.ts's and script_runner.ts's own headers.

import type { Script } from './script';

/** ATTRIBUTED: Founder, BP151, verbatim (survey_stage.ts's own file header, "SCOPE, EXACTLY"):
 *  "This file builds ONLY steps 2, 3, 4 and 6, in his order." The four ids below are exactly the
 *  four StepDeclarations survey_steps.ts (stage 1 of this ticket) registers for those steps --
 *  `DefineTheTerm:1`, `Categorize:1`, `DetermineRegister:1`, `JarMethod:1` -- in that same order. */
const STEP_ORDER_ATTRIBUTION = {
  kind: 'ATTRIBUTED' as const,
  founderRuling: 'BP151',
  quote: 'This file builds ONLY steps 2, 3, 4 and 6, in his order.',
  citedAt: 'src/main/liana_cycle/survey_stage.ts:14 (file header, "SCOPE, EXACTLY")',
};

/** The default `Survey:1` script -- reproduces `runSurveyStage()`'s own literal call order
 *  (survey_stage.ts, current HEAD: Step 2 unconditionally, Step 3 gated on Step 2's operation
 *  result, Step 4 unconditionally, Step 6 unconditionally) exactly. See this file's own header for
 *  why the Step 3 gate itself is not, and cannot be, expressed inside `steps` below. */
export const SURVEY_DEFAULT_SCRIPT: Script = {
  identity: { name: 'Survey', number: 1, id: 'Survey:1' },
  description:
    'The Founder\'s default Survey sequence: Steps 2, 3, 4 and 6, in his order, exactly as '
    + 'runSurveyStage() runs them today (survey_stage.ts). Step 3\'s D-BP152-009 gate (skip when '
    + 'Step 2\'s operation query already resolved a demand) is reproduced by the executor that '
    + 'runs this script, not by this steps array -- see survey_script.test.ts.',
  steps: [
    { id: 'DefineTheTerm:1', attribution: STEP_ORDER_ATTRIBUTION, note: 'Founder Step 2 -- SURVEY: define the term, perfunctorily, then keep looking.' },
    { id: 'Categorize:1', attribution: STEP_ORDER_ATTRIBUTION, note: 'Founder Step 3 -- categorize the options by shared predicate. Gated (D-BP152-009): the executor skips this when Step 2\'s operation query already resolved a demand.' },
    { id: 'DetermineRegister:1', attribution: STEP_ORDER_ATTRIBUTION, note: 'Founder Step 4 -- determine the register: guess out loud, then check it.' },
    { id: 'JarMethod:1', attribution: STEP_ORDER_ATTRIBUTION, note: 'Founder Step 6 -- the Jar Method: take out the Softballs first.' },
  ],
  savedBy: 'Founder',
  savedAt: '2026-08-09T00:00:00.000Z', // BP151 -- when this exact four-step order was ruled.
};
