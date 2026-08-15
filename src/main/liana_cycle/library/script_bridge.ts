// script_bridge.ts -- D-BP152-043/BISHOP/seg-scratch-composer, STAGE 1/2
//
// THE SCRATCH COMPOSER'S MAIN-PROCESS ENTRY. Founder, BP152, verbatim (FD-BP152-20): "I want the
// updated Mnemosynec Liana Cycle - the Scratch version... I want to use it to stack methods in
// whatever order I want - I don't need the lego shapes, I just want them NameNumbered (so that we
// can have iterations galore) as methods so that I can mix and match as I please."
//
// This file is the ONLY new wiring this ticket adds. It does not modify script.ts,
// script_runner.ts, method_registry.ts (library/ or the pre-existing liana_cycle/ one),
// method_identity.ts, survey_stage.ts, or any file under methods/ -- it only IMPORTS their
// already-exported functions/types and composes them. Per THE GROUND in this ticket's dispatch:
// "DO NOT BUILD A SECOND ONE" -- the script format and its runner already exist
// (library/script.ts, library/script_runner.ts, D-BP152-041) and are reused here unmodified.
//
// THE DEFAULT MUST NOT CHANGE. runScratchComposer()'s empty-stack branch calls
// runLianaCycleQuestion() -- the SAME function, SAME arguments, that 'liana-terminal-run'
// (index.ts) has always called for a plain run -- by direct reference, with no wrapping and no
// transformation of its return value. There is no code path by which authoring a stack can alter
// what an unauthored run produces; the two branches share no mutable state.
//
// WHAT IS ACTUALLY EXECUTABLE. library/method_registry.ts's ten entries are DECLARATIONS only
// (that file's own header: "REGISTRATION IS INERT... does not order, run, or persist anything").
// Turning a declared Name:Number id into a real, running step means resolving it against the
// LIVE code that already exists elsewhere in this estate:
//   - 'ComparativeCascade:1' / 'DefinitionalCascade:1' / 'ClassifyCascade:1' resolve to the three
//     LianaMethod objects already registered (as a side effect of liana_terminal_engine.ts's own
//     imports) in the PRE-EXISTING liana_cycle/method_registry.ts (not library/) -- found by id
//     via that file's own listMethods(), never re-imported directly from methods/*.ts here.
//   - 'Survey:1' resolves to survey_stage.ts's runSurveyStage(), imported (read-only) and called
//     with the same MethodRunContext shape liana_terminal_engine.ts's own Survey call already
//     uses.
//   - The 6 verified-orphan ids (orphan_catalog.ts) are declared but have NO run() at all --
//     "Making a declared step actually callable is spec item 12, BLOCKED on the Founder's
//     HARDWIRE-22 'typed' ruling" (step_declaration.ts's own header). This file does not build
//     that execution path; stacking an orphan id produces an honest "no runner wired yet" failure
//     (script_runner.ts's own failure shape), never a silent skip and never a fabricated result.
//   - Any id registered by a CONCURRENT dispatch (D-BP152-042, Survey's own parts) that is not one
//     of the four above is likewise reported as "no runner wired yet" -- this file lists whatever
//     the registry holds at runtime (listComposerRegistry(), below) but only ever EXECUTES the
//     four ids named above, so a new declaration appearing in the registry can never silently
//     start running real queries this ticket did not test.

import type { ConversationalAuthorityFn, EmitFn, MethodQuestionInput, MethodRunContext } from '../method_registry';
import { listMethods } from '../method_registry';
// D-BP154-010/BISHOP/S10/seg-thepail -- type-only. THE PAIL's ScriptRunResponse.evidence field
// (below) reports what THIS run wrote to the evidence store; the actual writing/wrapping happens
// in index.ts (the only place an evidenceSession is constructed), never in this file -- see this
// file's own header, "does not modify... any file under methods/... it only IMPORTS". A type-only
// import of the record shape is not evidence-store coupling.
import type { EvidenceAuthority, EvidenceRecord } from '../evidence/evidence_store';
import { runSurveyStage } from '../survey_stage';
import { parseFreeText, parseQid, runLianaCycleQuestion } from '../liana_terminal_engine';
import type { AskGoogleFn } from '../liana_terminal_engine';
import type { LianaTerminalOutcome } from '../../../shared/liana_cycle/liana_terminal_types';
import { listAllEntries, lookupById, registerKnownMethods } from './method_registry';
import { registerSurveyParts } from './survey_steps';
import { registerStateTheQuestionStep } from './state_the_question_step';
// D-BP154-013/BISHOP/S13/seg-composerstep -- THE SOFTBALLS, a Composer step, NOT a
// classify_cascade.ts change. See softballs_step.ts's own header for why it is a separate,
// self-contained implementation rather than a call into establishFrame().
import { registerSoftballsStep, runSoftballsStep } from './softballs_step';
// D-BP154-013/BISHOP/S13/seg-composerstep, STEP 2/3 -- THE NAMED SET. Same discipline as
// softballs_step.ts's own import -- see that file's header for why classify_cascade.ts is not
// depended on here either.
import { registerNamedSetStep, runNamedSetStep } from './named_set_step';
// D-BP154-013/BISHOP/S13/seg-composerstep, STEP 3/3 -- THE DISCRIMINATOR. Same discipline as the
// two imports above -- see discriminator_step.ts's own header.
import { registerDiscriminatorStep, runDiscriminatorStep } from './discriminator_step';
// D-BP154-018/BISHOP-SEG/S18/seg-terminator -- THE TERMINATOR, THE_PAIL_BP154.md STAGE 5. Issues
// no query of its own; reduces the three steps above's already-computed results. See that file's
// own header for FD-BP152-19 (UNIQUE OR ABSTAIN) and the contradiction check.
import { registerTerminatorStep, runTerminatorStep } from './terminator_step';
// D-BP154-022/BISHOP-SEG/S22/seg-magnitude -- THE MAGNITUDE, the fifth Composer step (FD-BP153-01,
// "a superlative resolves by magnitude, ranked WITHIN THE FRAME"). Ranks only the survivors
// Softballs:1/NamedSet:1/Discriminator:1 already left, via terminator_step.ts's own
// deriveTerminatorEliminations() (reused, not duplicated) -- see that file's own header.
import { registerMagnitudeStep, runMagnitudeStep } from './magnitude_step';
// D-BP154-030/BISHOP-SEG/S30/seg-humannuance -- THE HUMAN NUANCE FACTOR, a sixth Composer step
// (FD-BP154-07/07a). Standalone, like Softballs:1/NamedSet:1/Discriminator:1 were before
// terminator_step.ts was built to consume them -- see human_nuance_step.ts's own header for why
// this ticket does not also wire it into deriveTerminatorEliminations().
import { registerHumanNuanceStep, runHumanNuanceStep } from './human_nuance_step';
// D-BP154-041/BISHOP-SEG/S41/seg-purpose, PART 1/3 -- THE QUESTION PURPOSE (FD-BP154-16). Reads
// only stated fields (stem/src/category), never `input.options` -- see purpose_step.ts's own
// header for why it must run before any option-examining step.
import { registerPurposeStep, runPurposeStep } from './purpose_step';
import type { PurposeResult } from './purpose_step';
// D-BP154-041/BISHOP-SEG/S41/seg-purpose, PART 3/3 -- THE UPSTREAM SKIP GATE. See step_skip.ts's
// own header for the full five-qualifier design and the DECIDING/REFUTING classification table.
import { computeStepSkip } from './step_skip';
// D-BP154-042/BISHOP-SEG/S42/seg-originframe -- THE ORIGIN FRAME (the Kobayashi Maru move made
// mechanical). See origin_frame_step.ts's own header for the full ruling and the key-blindness
// discipline.
import { registerOriginFrameStep, runOriginFrameStep } from './origin_frame_step';
// D-BP154-043/BISHOP-SEG/S43/seg-unitary -- FD-BP154-16's "unitary vs conglomerate" membership
// factor, as its own step. See unitary_step.ts's own header.
import { registerUnitaryStep, runUnitaryStep } from './unitary_step';
// D-BP154-053/BISHOP-SEG/S52/seg-wiregate -- THE BOUNDARY STABILITY DISCRIMINATOR (the Founder's
// own sourced proof, PROOF_QID98_TEST_AWARE_ELIMINATION_BP154.md). See boundary_step.ts's own
// header for the full ruling.
import { registerBoundaryStep, runBoundaryStep } from './boundary_step';
// D-BP154-058/BISHOP-SEG/S52/seg-wiregate PART 5 -- THE TARGET-CLASS GATE. See
// target_class_step.ts's own header.
import { registerTargetClassStep, runTargetClassStep } from './target_class_step';
// D-BP154-065/BISHOP-SEG/S52/seg-wiregate -- THE NO-CONSENSUS-FROM-SCATTER STEP, built
// Composer-native after diagnosing the same-shaped forbidden mechanism (D-BP154-064). See
// no_consensus_step.ts's own header.
import { registerNoConsensusStep, runNoConsensusStep } from './no_consensus_step';
import { emitStateTheQuestion } from '../liana_terminal_engine';
import { makeMethodIdentity } from './method_identity';
import { validateScript, type ResolvedRef, type Script, type ScriptResolver, type ScriptStepRef } from './script';
import { runScript, type MethodExecutor, type RunResult, type StepRunRecord } from './script_runner';
import type { StepAttribution } from './step_declaration';
// D-BP154-017/BISHOP-SEG/S17/seg-classify -- THE PERSISTENCE GAP (THE_PAIL_BP154.md STAGE 4):
// mechanism + verbatim corroborating span were computed transiently and discarded at run end. See
// composer_claims_store.ts's own header for why this is a SEPARATE ledger, not a widened
// evidence_store.ts schema (that file is HARDWIRE-08 pinned).
import { appendComposerClaim } from './composer_claims_store';
import {
  applyKeyedAnswerLabel, classifyComposerStepResult,
} from '../../../shared/composer_step_classification';
import type {
  ComposerStepClassificationWithKey,
} from '../../../shared/composer_step_classification';

// ─────────────────────────────── registry population (idempotent) ───────────────────────────────
// registerKnownMethods() throws on any id already present (Rule 66, "duplicate is an error" --
// method_registry.ts's own registerNameNumbered()). That is the expected shape of "someone
// already called this" -- either this function on an earlier IPC call, or a concurrent module
// (D-BP152-042) that registered first -- never a new failure this file introduces. Safe to call
// on every request; registerKnownMethods() does no I/O and no method file import (library/
// method_registry.ts's own header: "importing this module cannot execute any of the code those
// declarations describe").
//
// D-BP152-047/BISHOP/seg-wire-survey-parts-and-baseline -- ADDITIVE. registerSurveyParts()
// (survey_steps.ts) existed, was tested, and was called from nowhere but its own test file before
// this ticket -- this is the only call site this ticket adds. Same idempotent try/catch shape as
// registerKnownMethods() above, for the same reason (a concurrent call, or an earlier IPC call in
// this same process, may have already registered these six ids). Order relative to
// registerKnownMethods() does not matter (survey_steps.test.ts's own "inert to call order" case),
// and this does not touch, re-register, or collide with 'Survey:1' -- that id is registered only
// by registerKnownMethods() above, unchanged. Registration remains inert: survey_steps.ts imports
// nothing from survey_stage.ts/methods/*.ts/elements/*.ts, so calling this executes no query, no
// model call, no Google fetch -- it only adds six more plain-object declarations to the same
// in-memory Map registerKnownMethods() already writes to.
function ensureRegistryPopulated(): void {
  try {
    registerKnownMethods();
  } catch {
    // already registered -- see comment above.
  }
  try {
    registerSurveyParts();
  } catch {
    // already registered -- see comment above.
  }
  // D-BP152-049 STAGE 3/4 -- ADDITIVE, same idempotent shape as the two calls above, for the same
  // reason (a concurrent call, or an earlier IPC call in this same process, may have already
  // registered this id). Does not touch, re-register, or collide with anything registerKnownMethods()
  // registers -- 'StateTheQuestion' is a new name, method_registry.test.ts's own "exactly ten
  // entries" assertion (D-BP152-040) is unaffected.
  try {
    registerStateTheQuestionStep();
  } catch {
    // already registered -- see comment above.
  }
  // D-BP154-013/BISHOP/S13/seg-composerstep -- ADDITIVE, same idempotent shape as the three calls
  // above, for the same reason. Does not touch, re-register, or collide with anything the other
  // three register -- 'Softballs' is a new name.
  try {
    registerSoftballsStep();
  } catch {
    // already registered -- see comment above.
  }
  // D-BP154-013/BISHOP/S13/seg-composerstep, STEP 2/3 -- ADDITIVE, same idempotent shape as the
  // four calls above, for the same reason. Does not touch, re-register, or collide with anything
  // the others register -- 'NamedSet' is a new name.
  try {
    registerNamedSetStep();
  } catch {
    // already registered -- see comment above.
  }
  // D-BP154-013/BISHOP/S13/seg-composerstep, STEP 3/3 -- ADDITIVE, same idempotent shape as the
  // five calls above, for the same reason. Does not touch, re-register, or collide with anything
  // the others register -- 'Discriminator' is a new name.
  try {
    registerDiscriminatorStep();
  } catch {
    // already registered -- see comment above.
  }
  // D-BP154-018/BISHOP-SEG/S18/seg-terminator -- ADDITIVE, same idempotent shape as the six calls
  // above, for the same reason. Does not touch, re-register, or collide with anything the others
  // register -- 'Terminator' is a new name.
  try {
    registerTerminatorStep();
  } catch {
    // already registered -- see comment above.
  }
  // D-BP154-022/BISHOP-SEG/S22/seg-magnitude -- ADDITIVE, same idempotent shape as the seven
  // calls above, for the same reason. Does not touch, re-register, or collide with anything the
  // others register -- 'Magnitude' is a new name.
  try {
    registerMagnitudeStep();
  } catch {
    // already registered -- see comment above.
  }
  // D-BP154-030/BISHOP-SEG/S30/seg-humannuance -- ADDITIVE, same idempotent shape as the eight
  // calls above, for the same reason. Does not touch, re-register, or collide with anything the
  // others register -- 'HumanNuance' is a new name.
  try {
    registerHumanNuanceStep();
  } catch {
    // already registered -- see comment above.
  }
  // D-BP154-041/BISHOP-SEG/S41/seg-purpose, ADDITIVE, PART 1/3 -- same idempotent shape as every
  // call above, for the same reason. Does not touch, re-register, or collide with anything the
  // others register -- 'Purpose' is a new name.
  try {
    registerPurposeStep();
  } catch {
    // already registered -- see comment above.
  }
  // D-BP154-042/BISHOP-SEG/S42/seg-originframe, ADDITIVE -- same idempotent shape as every call
  // above, for the same reason. Does not touch, re-register, or collide with anything the others
  // register -- 'OriginFrame' is a new name.
  try {
    registerOriginFrameStep();
  } catch {
    // already registered -- see comment above.
  }
  // D-BP154-043/BISHOP-SEG/S43/seg-unitary, ADDITIVE -- same idempotent shape as every call above,
  // for the same reason. Does not touch, re-register, or collide with anything the others
  // register -- 'Unitary' is a new name.
  try {
    registerUnitaryStep();
  } catch {
    // already registered -- see comment above.
  }
  // D-BP154-053/BISHOP-SEG/S52/seg-wiregate, ADDITIVE -- same idempotent shape as every call
  // above, for the same reason. Does not touch, re-register, or collide with anything the others
  // register -- 'BoundaryStability' is a new name.
  try {
    registerBoundaryStep();
  } catch {
    // already registered -- see comment above.
  }
  // D-BP154-058/BISHOP-SEG/S52/seg-wiregate PART 5, ADDITIVE -- same idempotent shape as every
  // call above, for the same reason. Does not touch, re-register, or collide with anything the
  // others register -- 'TargetClass' is a new name.
  try {
    registerTargetClassStep();
  } catch {
    // already registered -- see comment above.
  }
  // D-BP154-065/BISHOP-SEG/S52/seg-wiregate, ADDITIVE -- same idempotent shape as every call
  // above, for the same reason. Does not touch, re-register, or collide with anything the others
  // register -- 'NoConsensus' is a new name.
  try {
    registerNoConsensusStep();
  } catch {
    // already registered -- see comment above.
  }
}

// ─────────────────────────────── the UI-facing listing ───────────────────────────────

export interface ComposerRegistryEntry {
  /** The canonical Name:Number id, e.g. "ComparativeCascade:1". */
  id: string;
  name: string;
  number: number;
  /** Plain-language line on what this step does, read straight from the registry's own
   *  declaration (StepDeclaration.whatItDoes) -- never re-derived or shortened here. */
  whatItDoes: string;
  /** D-BP152-045/BISHOP/seg-composer-ui-fixes -- read straight from the registry's own
   *  declaration (StepDeclaration.parentId, added by this ticket), never re-derived or set here.
   *  The canonical id of the composite step this one is a part of (e.g. "Survey:1"), or `null`
   *  when the step is not part of any composite. Lets the composer panel render
   *  "Parent:N > Child:N" from real registry data instead of a hardcoded UI map. */
  parentId: string | null;
  /** True only for the four ids this file's executor actually knows how to run (see this file's
   *  header). A registered-but-not-executable entry (an orphan, or a not-yet-mapped concurrent
   *  registration) still lists -- it is simply marked so the composer panel can say so honestly
   *  rather than let the operator discover it only after a failed run. */
  executable: boolean;
}

/** The Name:Number ids this file's executor can actually run. NOT a decision rule -- it does not
 *  change which answer any of these methods themselves produce, it only names which of the
 *  registry's CURRENTLY DECLARED entries have a real function behind them today. See this file's
 *  header for the full accounting. D-BP152-049 STAGE 3/4 adds 'StateTheQuestion:1' -- it calls
 *  liana_terminal_engine.ts's emitStateTheQuestion(), the SAME function STEP 0 itself calls
 *  automatically at the start of every run (see runOneStep() below). */
// D-BP154-013 adds 'Softballs:1' -- it calls THIS file's own runOneStep() branch below, which
// calls softballs_step.ts's runSoftballsStep() (one query, one verified extraction; see that
// file's own header for why it does not call classify_cascade.ts's establishFrame()).
// D-BP154-018 adds 'Terminator:1' -- issues no query of its own, see terminator_step.ts's header.
// D-BP154-022 adds 'Magnitude:1' -- it calls THIS file's own runOneStep() branch below, which
// calls magnitude_step.ts's runMagnitudeStep() (frame established via terminator_step.ts's own
// deriveTerminatorEliminations(), one ranking query, one verified extraction; see that file's own
// header for why it does not call classify_cascade.ts's ranking logic).
// D-BP154-041 adds 'Purpose:1' -- see purpose_step.ts's own header; must run before any
// option-examining step to satisfy FD-BP154-16's "stated before any option is examined" guard.
// D-BP154-042 adds 'OriginFrame:1' -- see origin_frame_step.ts's own header.
// D-BP154-043 adds 'Unitary:1' -- see unitary_step.ts's own header.
// D-BP154-053 adds 'BoundaryStability:1' -- see boundary_step.ts's own header.
// D-BP154-058 adds 'TargetClass:1' -- see target_class_step.ts's own header.
// D-BP154-065 adds 'NoConsensus:1' -- see no_consensus_step.ts's own header.
const EXECUTABLE_IDS: ReadonlySet<string> = new Set(['ComparativeCascade:1', 'DefinitionalCascade:1', 'ClassifyCascade:1', 'Survey:1', 'StateTheQuestion:1', 'Softballs:1', 'NamedSet:1', 'Discriminator:1', 'Terminator:1', 'Magnitude:1', 'HumanNuance:1', 'Purpose:1', 'OriginFrame:1', 'Unitary:1', 'BoundaryStability:1', 'TargetClass:1', 'NoConsensus:1']);

/** Every step currently on file, for the composer panel -- reads the registry AT CALL TIME (no
 *  cached snapshot), so an entry a concurrent dispatch adds after this ticket lands appears here
 *  automatically without this file changing, per this ticket's own instruction. */
export function listComposerRegistry(): ComposerRegistryEntry[] {
  ensureRegistryPopulated();
  return listAllEntries().map((entry) => ({
    id: entry.identity.id,
    name: entry.identity.name,
    number: entry.identity.number,
    whatItDoes: entry.declaration.whatItDoes,
    parentId: entry.declaration.parentId ?? null,
    executable: EXECUTABLE_IDS.has(entry.identity.id),
  }));
}

// ─────────────────────────────── executing one step ───────────────────────────────

/** Maps the three cascade Name:Number ids to their id inside the PRE-EXISTING (non-library)
 *  method_registry.ts, where the real LianaMethod objects (with a callable `run`) already live.
 *  Plain lookup-table wiring -- see comparative_cascade.ts:1236 / definitional_cascade.ts:409 /
 *  classify_cascade.ts:1607 for each cited `id: '...'` literal this table points at. */
const CASCADE_LIVE_ID: Readonly<Record<string, string>> = {
  'ComparativeCascade:1': 'comparative-cascade',
  'DefinitionalCascade:1': 'definitional-cascade',
  'ClassifyCascade:1': 'classify-cascade',
};

function summarizeOutcome(outcome: LianaTerminalOutcome): string {
  if (outcome.abstain) {
    return `ABSTAIN${outcome.error ? ` (${outcome.error})` : ''}`;
  }
  return `verdict ${outcome.verdict ?? '(none)'}${outcome.basis ? ` -- ${outcome.basis}` : ''}`;
}

/** D-BP154-017/BISHOP-SEG/S17/seg-classify -- persists the classification + mechanism + verbatim
 *  corroborating span for one step's result (composer_claims_store.ts, a SEPARATE ledger from
 *  evidence_store.ts -- see that store's own header for why). Called for every step whose result
 *  shape classifyComposerStepResult() can read (today: Softballs:1/NamedSet:1/Discriminator:1; D-
 *  BP154-018 adds Terminator:1 the same way). Never throws into the caller: a write failure here
 *  is instrumentation failing, not the step itself -- caught and swallowed, same discipline
 *  evidence_authority.ts's own recordingAskGoogle() uses for a failed evidence write not being
 *  allowed to fail the query it describes. Silently a no-op when `ctx.acquisitionId` is absent
 *  (every pre-existing call site, and every unit test, that does not thread one through).
 */
function persistStepClaim(id: string, input: MethodQuestionInput, ctx: MethodRunContext, raw: unknown): void {
  if (!ctx.acquisitionId) return;
  try {
    const blind = classifyComposerStepResult(raw);
    // D-BP154-036/BISHOP-SEG/S36/seg-wireit, ADDITIVE. Scoped to Terminator:1 ONLY -- the answer
    // key names the QUESTION's own correct letter, meaningful only against the run's terminal
    // VERDICT (FD-BP154-11's own qid-98 worked example), never against an intermediate elimination
    // step's own ABSTAIN (Softballs:1/NamedSet:1/etc. have no "verdict" of their own to key
    // against; relabeling their ABSTAIN this way would be a category error, not the ruling's
    // amendment). `input.correctAnswer` is read HERE ONLY, after `raw` already reflects a run that
    // never saw it -- see ComposedRunResult.keyedTerminatorLabel's own header, script_bridge.ts,
    // for the full boundary this mirrors.
    const verdictLetter = id === 'Terminator:1' && typeof (raw as { verdict?: unknown } | null)?.verdict === 'string'
      ? (raw as { verdict: string }).verdict
      : null;
    const labeled: ComposerStepClassificationWithKey = id === 'Terminator:1'
      ? applyKeyedAnswerLabel(blind, verdictLetter, input.correctAnswer)
      : blind;
    const { cls, detail } = labeled;
    const keyed = labeled.keyed ?? null;
    const r = raw as {
      query?: unknown;
      answerProvenance?: { mechanism?: unknown; sourceId?: unknown; detail?: unknown } | null;
      corroboration?: {
        attempted?: unknown; corroborated?: unknown; sourceUrl?: unknown; sourceTitle?: unknown; span?: unknown;
      } | null;
      ok?: unknown;
    };
    appendComposerClaim({
      qid: input.qid ?? null,
      acquisitionId: ctx.acquisitionId,
      stepId: id,
      ts: new Date().toISOString(),
      ok: r.ok === true,
      classification: cls,
      classificationDetail: detail,
      query: typeof r.query === 'string' ? r.query : null,
      mechanism: typeof r.answerProvenance?.mechanism === 'string' ? r.answerProvenance.mechanism : null,
      sourceId: typeof r.answerProvenance?.sourceId === 'string' ? r.answerProvenance.sourceId : null,
      mechanismDetail: typeof r.answerProvenance?.detail === 'string' ? r.answerProvenance.detail : null,
      corroboration: r.corroboration ? {
        attempted: r.corroboration.attempted === true,
        corroborated: r.corroboration.corroborated === true,
        sourceUrl: typeof r.corroboration.sourceUrl === 'string' ? r.corroboration.sourceUrl : null,
        sourceTitle: typeof r.corroboration.sourceTitle === 'string' ? r.corroboration.sourceTitle : null,
        span: typeof r.corroboration.span === 'string' ? r.corroboration.span : null,
      } : null,
      keyed,
    });
  } catch {
    // Instrumentation failure only -- never fails the step it describes. Nothing to report to a
    // caller that has no channel for a non-fatal warning here; the step's own result (already
    // returned to the operator) is unaffected either way.
  }
}

/** Runs exactly one registered step's real code against the shared question. Throws (rather than
 *  returning a fabricated result) for any id this file does not know how to execute -- caught by
 *  script_runner.ts's own MethodExecutor contract, which marks the step 'failed' and stops the
 *  run there; nothing after it runs on a partial/guessed state. */
async function runOneStep(
  id: string,
  input: MethodQuestionInput,
  ctx: MethodRunContext,
  // D-BP154-018, ADDITIVE: every step already run earlier in THIS stack. 'Terminator:1' reads it
  // (it asks no query of its own, see terminator_step.ts's header); D-BP154-022 adds 'Magnitude:1'
  // as a second reader (it establishes its own frame from these same prior results, see
  // magnitude_step.ts's header) -- every other branch below ignores the parameter unchanged.
  priorResults: ComposerStepOutcome[],
): Promise<{ summary: string; raw: unknown }> {
  // D-BP154-041/BISHOP-SEG/S41/seg-purpose, PART 3/3, NEW -- THE UPSTREAM SKIP GATE, checked BEFORE
  // any branch below is reached. computeStepSkip() (step_skip.ts) only ever returns non-null for
  // the five query-issuing steps it names (Softballs:1/NamedSet:1/Discriminator:1/Magnitude:1/
  // HumanNuance:1) and only when a real skip condition holds -- every other id below is untouched,
  // and a `null` return here changes nothing about this function's own pre-existing behavior. No
  // real runner is invoked, no query is issued, no persistStepClaim() call happens (there is
  // nothing to classify) -- the marker IS the step's own raw result, exactly like a real ok:false
  // failure shape, just distinguishable (isSkippedMarker()) from one.
  const skip = computeStepSkip(id, priorResults);
  if (skip) {
    return { summary: skip.skipReason, raw: skip };
  }
  if (id === 'StateTheQuestion:1') {
    // D-BP152-049 STAGE 3/4: calls the SAME function STEP 0 itself calls automatically at the
    // start of every run (liana_terminal_engine.ts) -- see this file's header and
    // state_the_question_step.ts's own header for why there is exactly one implementation.
    const state = emitStateTheQuestion(ctx.emit, input);
    return { summary: `STATE THE QUESTION -- source: ${state.source}; options exist: ${state.optionsExist}`, raw: state };
  }
  if (id === 'Survey:1') {
    const result = await runSurveyStage(input.question, input.options, ctx, {});
    return { summary: `Survey: ${result.why}`, raw: result };
  }
  if (id === 'Softballs:1') {
    // D-BP154-013/BISHOP/S13/seg-composerstep -- THE SOFTBALLS. `ctx.askGoogle` here is whatever
    // the caller (index.ts's 'liana-script-run' handler) passed in -- already the
    // recordingAskGoogle()-wrapped closure that writes into THE PAIL, exactly like every other
    // step run through this function. Nothing in this branch or in softballs_step.ts touches the
    // evidence store directly.
    const { result, summary } = await runSoftballsStep(input, ctx);
    persistStepClaim(id, input, ctx, result);
    return { summary, raw: result };
  }
  if (id === 'NamedSet:1') {
    // D-BP154-013/BISHOP/S13/seg-composerstep, STEP 2/3 -- THE NAMED SET. Same
    // recordingAskGoogle()-wrapped ctx.askGoogle every other step here receives.
    const { result, summary } = await runNamedSetStep(input, ctx);
    persistStepClaim(id, input, ctx, result);
    return { summary, raw: result };
  }
  if (id === 'Discriminator:1') {
    // D-BP154-013/BISHOP/S13/seg-composerstep, STEP 3/3 -- THE DISCRIMINATOR. Same
    // recordingAskGoogle()-wrapped ctx.askGoogle every other step here receives.
    const { result, summary } = await runDiscriminatorStep(input, ctx);
    persistStepClaim(id, input, ctx, result);
    return { summary, raw: result };
  }
  if (id === 'Terminator:1') {
    // D-BP154-018/BISHOP-SEG/S18/seg-terminator -- THE TERMINATOR. No query issued; reduces
    // whatever of Softballs:1/NamedSet:1/Discriminator:1 already ran earlier in this stack.
    // D-BP154-022, ADDITIVE: also consults Magnitude:1 (if present in priorResults) to pick the
    // extreme among multiple survivors -- see terminator_step.ts's own header for the full rule.
    const { result, summary } = await runTerminatorStep(input, ctx, priorResults);
    persistStepClaim(id, input, ctx, result);
    return { summary, raw: result };
  }
  if (id === 'Magnitude:1') {
    // D-BP154-022/BISHOP-SEG/S22/seg-magnitude -- THE MAGNITUDE. Same
    // recordingAskGoogle()-wrapped ctx.askGoogle every other step here receives; establishes its
    // own frame from whatever of Softballs:1/NamedSet:1/Discriminator:1 already ran earlier in
    // this stack (magnitude_step.ts's own header) before ranking anything.
    const { result, summary } = await runMagnitudeStep(input, ctx, priorResults);
    persistStepClaim(id, input, ctx, result);
    return { summary, raw: result };
  }
  if (id === 'Purpose:1') {
    // D-BP154-041/BISHOP-SEG/S41/seg-purpose, PART 1/3 -- THE QUESTION PURPOSE. Issues no query in
    // its BUILT form (purpose_step.ts's own header); reads only `input.question`/`originSrc`/
    // `category`, never `priorResults` and never `input.options`.
    const { result, summary } = await runPurposeStep(input, ctx);
    return { summary, raw: result };
  }
  if (id === 'OriginFrame:1') {
    // D-BP154-042/BISHOP-SEG/S42/seg-originframe -- THE ORIGIN FRAME. Reads priorResults for
    // Terminator:1's own already-computed augmented-question status; runs its own mini-derivation
    // (Softballs:1 + NamedSet:1 over the origin frame only) via the SAME ctx every other step here
    // receives.
    const { result, summary } = await runOriginFrameStep(input, ctx, priorResults);
    return { summary, raw: result };
  }
  if (id === 'Unitary:1') {
    // D-BP154-043/BISHOP-SEG/S43/seg-unitary -- THE UNITARY-VS-CONGLOMERATE FACTOR. Same
    // recordingAskGoogle()-wrapped ctx.askGoogle every other step here receives.
    const { result, summary } = await runUnitaryStep(input, ctx);
    persistStepClaim(id, input, ctx, result);
    return { summary, raw: result };
  }
  if (id === 'TargetClass:1') {
    // D-BP154-058/BISHOP-SEG/S52/seg-wiregate PART 5 -- THE TARGET-CLASS GATE. Perplexity
    // preferred (ctx.askConversationalAuthorityAs), Gemini fallback -- see target_class_step.ts's
    // own header.
    const { result, summary } = await runTargetClassStep(input, ctx);
    persistStepClaim(id, input, ctx, result);
    return { summary, raw: result };
  }
  if (id === 'NoConsensus:1') {
    // D-BP154-065/BISHOP-SEG/S52/seg-wiregate -- THE NO-CONSENSUS-FROM-SCATTER STEP. Queries all
    // five named voices (ctx.askConversationalAuthorityAs) in parallel, awaits every one to
    // completion before any gate runs -- see no_consensus_step.ts's own header.
    const { result, summary } = await runNoConsensusStep(input, ctx);
    persistStepClaim(id, input, ctx, result);
    return { summary, raw: result };
  }
  if (id === 'BoundaryStability:1') {
    // D-BP154-053/BISHOP-SEG/S52/seg-wiregate -- THE BOUNDARY STABILITY DISCRIMINATOR. Same
    // recordingAskGoogle()-wrapped ctx.askGoogle every other step here receives. D-BP154-058 PART 5,
    // ADDITIVE: `priorResults` now threaded through so TargetClass:1's own established frame (if it
    // ran earlier in this same stack) can frame this step's own query -- see boundary_step.ts's own
    // header.
    const { result, summary } = await runBoundaryStep(input, ctx, priorResults);
    persistStepClaim(id, input, ctx, result);
    return { summary, raw: result };
  }
  if (id === 'HumanNuance:1') {
    // D-BP154-030/BISHOP-SEG/S30/seg-humannuance -- THE HUMAN NUANCE FACTOR. Same
    // recordingAskGoogle()-wrapped ctx.askGoogle every other step here receives; reads
    // input.originSrc (threaded through from parseQid(), liana_terminal_engine.ts) and the
    // offline-backfilled origin_provenance/ eblet store -- issues no network call for either.
    const { result, summary } = await runHumanNuanceStep(input, ctx);
    persistStepClaim(id, input, ctx, result);
    return { summary, raw: result };
  }
  const liveId = CASCADE_LIVE_ID[id];
  if (liveId) {
    const method = listMethods().find((m) => m.id === liveId);
    if (!method || !method.run) {
      throw new Error(`step "${id}" resolves to method "${liveId}" but it has no runner registered -- this is a real gap, not the honest "not yet executable" case`);
    }
    const outcome = await method.run(input, ctx);
    return { summary: summarizeOutcome(outcome), raw: outcome };
  }
  throw new Error(`step "${id}" is registered (declared) but has no runner wired in the composer yet -- see script_bridge.ts's header for exactly which ids are executable today`);
}

// ─────────────────────────────── running an authored stack ───────────────────────────────

interface ComposerState {
  input: MethodQuestionInput;
  results: ComposerStepOutcome[];
}

export interface ComposerStepOutcome {
  id: string;
  summary: string;
  raw: unknown;
}

export interface ComposedRunResult {
  ok: boolean;
  /** The runner's own per-step transcript (id, kind, depth, status, whatChanged, durationMs) --
   *  produced by script_runner.ts unmodified, not re-derived here. */
  steps: StepRunRecord[];
  /** What each successfully-run step actually produced, in run order -- shorter than `steps` on
   *  a failed run, since the failing step (and anything after it) contributes no result. */
  results: ComposerStepOutcome[];
  error?: string;
  failedId?: string;
  /** D-BP154-036/BISHOP-SEG/S36/seg-wireit, ADDITIVE. FD-BP154-11's ANSWERED-row amendment
   *  (applyKeyedAnswerLabel(), composer_step_classification.ts), applied ONLY to the Terminator:1
   *  step's OWN already-computed blind classification -- computed here, AFTER the run has already
   *  finished, strictly for display. `parsedInput.correctAnswer` is read for this ONE purpose only;
   *  it is never passed into runOneStep()/deriveTerminatorEliminations()/evaluateVerdict(), so it
   *  cannot influence which options were eliminated, which survived, or which letter (if any) the
   *  blind mechanism reached -- D-BP153-003 stays unrelaxed. `null` when Terminator:1 did not run
   *  in this stack, or when no key is on file for this input (free-text, or a bundled qid the
   *  backfill has not touched -- see applyKeyedAnswerLabel()'s own "no key available" branch). */
  keyedTerminatorLabel?: ComposerStepClassificationWithKey | null;
}

/** D-BP154-036, NEW. THE ONE PLACE `correctAnswer` is read to build a display label for a composed
 *  stack's own result -- see ComposedRunResult.keyedTerminatorLabel's own header for the boundary
 *  this observes. Pure, synchronous: reads only the already-finished `results` array and the
 *  already-known key; calls nothing that acquires, ranks, or eliminates anything. Returns `null`
 *  (never a guess) when Terminator:1 is not among `results` at all. */
function computeKeyedTerminatorLabel(
  results: ComposerStepOutcome[],
  correctAnswer: string | undefined,
): ComposerStepClassificationWithKey | null {
  const term = results.find((r) => r.id === 'Terminator:1');
  if (!term) return null;
  const blind = classifyComposerStepResult(term.raw);
  const verdictLetter = typeof (term.raw as { verdict?: unknown } | null)?.verdict === 'string'
    ? (term.raw as { verdict: string }).verdict
    : null;
  return applyKeyedAnswerLabel(blind, verdictLetter, correctAnswer);
}

/** D-BP154-039/BISHOP-SEG/S39/seg-disagreement, NEW. Founder, this dispatch, verbatim: "A verdict
 *  must carry at least what an abstain carries" -- a live qid-98 receipt
 *  (LIANA_COMPOSER_RUN_qid98_2026-08-14T21-59-51-048Z.json) recorded `basis: "VERDICT F) Central
 *  Asia"` for a verdict, two words, while an abstain on the SAME run would have carried the full
 *  eliminated-list/magnitude-basis/frame-match text -- because index.ts's own receipt writer
 *  hand-built a short string for a verdict instead of reading the SAME full text
 *  runTerminatorStep()'s own summaryLine() already computes and stores on `term.summary`. This
 *  function is THE ONE PLACE that basis text is built now, for both outcomes alike, so the two can
 *  never diverge in richness again.
 *
 *  D-BP154-039 PART 2: when the verdict DISAGREES with the keyed answer (`keyedTerminatorLabel.
 *  keyed.matchesVerdict === false`), the returned basis states that FIRST, explicitly, before the
 *  full elimination text -- "the most informative state in the system" per the Founder's own
 *  words, never left to be inferred from a `keyed` object a reader would have to know to look for.
 *  Reads `result.keyedTerminatorLabel` only for this label; changes no elimination, ranking, or
 *  survivor -- see applyKeyedAnswerLabel()'s own header, composer_step_classification.ts, for the
 *  same boundary stated there. Returns `null` only when Terminator:1 did not run in this stack
 *  (nothing to report a basis for) -- never a fabricated placeholder. */
export function buildComposerRunBasis(result: ComposedRunResult): string | null {
  const term = result.results.find((r) => r.id === 'Terminator:1');
  if (!term) return null;
  const raw = term.raw as { verdict?: string | null; abstain?: boolean } | null;
  if (!raw) return null;
  const full = term.summary;
  if (raw.abstain || !raw.verdict) return full;
  const keyed = result.keyedTerminatorLabel?.keyed;
  if (keyed && keyed.matchesVerdict === false) {
    return `VERDICT ${raw.verdict} -- DISAGREES WITH KEYED ANSWER ${keyed.answer}. The evidence `
      + `admitted does not entail the keyed answer.  ||  ${full}`;
  }
  return full;
}

/** Per HARDWIRE-23 Law 4/5: the operator authoring/reordering a stack via the composer panel at
 *  runtime IS the Founder's own act of "mix and match as I please" (FD-BP152-20) -- this
 *  attribution is descriptive metadata on the Script format (script.ts: "never read by the
 *  runner, never a decision input"), not a control-flow branch, so one constant attribution
 *  covers every operator-authored step rather than inventing a per-step ruling that does not
 *  exist. */
const OPERATOR_STACK_ATTRIBUTION: StepAttribution = {
  kind: 'ATTRIBUTED',
  founderRuling: 'BP152',
  quote:
    'I want to use it to stack methods in whatever order I want - I don\'t need the lego shapes, '
    + 'I just want them NameNumbered (so that we can have iterations galore) as methods so that I '
    + 'can mix and match as I please.',
  citedAt: 'LianaBanyanPlatform/BISHOP_DROPZONE/RULINGS_BP152.md FD-BP152-20',
};

function buildResolver(): ScriptResolver {
  return (id: string): ResolvedRef => {
    const entry = lookupById(id);
    if (!entry) return { kind: 'unresolved' };
    return { kind: 'method', identity: entry.identity };
  };
}

/** Runs an operator-authored, in-memory stack (never saved to disk -- see this ticket's FORBIDDEN
 *  list, "Do NOT add persistence") through the existing, unmodified script_runner.ts. */
export async function runComposedStack(
  stepIds: string[],
  parsedInput: MethodQuestionInput,
  ctx: MethodRunContext,
): Promise<ComposedRunResult> {
  ensureRegistryPopulated();
  const script: Script = {
    identity: makeMethodIdentity('AdHocComposerRun', 1),
    description: 'Operator-composed stack, authored at runtime via the composer panel (not saved to disk).',
    steps: stepIds.map((id): ScriptStepRef => ({ id, attribution: OPERATOR_STACK_ATTRIBUTION })),
    savedBy: 'operator (ad hoc, unsaved)',
    savedAt: new Date().toISOString(),
  };
  const resolve = buildResolver();
  const validation = validateScript(script, resolve);
  if (!validation.ok) {
    return { ok: false, steps: [], results: [], error: validation.error };
  }
  const execute: MethodExecutor<ComposerState> = async (identity, state) => {
    const { summary, raw } = await runOneStep(identity.id, state.input, ctx, state.results);
    return { input: state.input, results: [...state.results, { id: identity.id, summary, raw }] };
  };
  const runResult: RunResult<ComposerState> = await runScript(
    script,
    { input: parsedInput, results: [] },
    resolve,
    execute,
  );
  if (runResult.ok) {
    return {
      ok: true,
      steps: runResult.steps,
      results: runResult.finalState.results,
      keyedTerminatorLabel: computeKeyedTerminatorLabel(runResult.finalState.results, parsedInput.correctAnswer),
    };
  }
  return {
    ok: false,
    steps: runResult.steps,
    results: runResult.stateAtFailure.results,
    error: runResult.error,
    failedId: runResult.failedId,
    keyedTerminatorLabel: computeKeyedTerminatorLabel(runResult.stateAtFailure.results, parsedInput.correctAnswer),
  };
}

// ─────────────────────────────── the one entry point index.ts calls ───────────────────────────────

/** D-BP154-010/BISHOP/S10/seg-thepail -- what THIS run wrote to the evidence store, reported
 *  alongside the answer so the pail's contents are visible to whoever called runScratchComposer(),
 *  not only to a file-reader on disk. Built by the CALLER (index.ts, the only place an
 *  evidenceSession exists) and attached to the response after this function returns -- see this
 *  file's own header for why the evidence-store coupling stays out of this file's own logic. */
export interface ComposerEvidenceSummary {
  acquisitionId: string;
  recordsWritten: number;
  writeFailures: Array<{ query: string; authority: EvidenceAuthority; error: string }>;
  records: EvidenceRecord[];
}

export type ScriptRunResponse =
  | { mode: 'default'; outcome: LianaTerminalOutcome; evidence?: ComposerEvidenceSummary }
  | {
      mode: 'stack';
      qid?: number;
      question: string;
      options: Record<string, string> | null;
      result: ComposedRunResult;
      evidence?: ComposerEvidenceSummary;
    };

/**
 * THE ONE NEW IPC-FACING ENTRY. `stepIds` undefined or empty means "no authored script" -- the
 * default path: this branch calls runLianaCycleQuestion() DIRECTLY, by reference, with the exact
 * arguments 'liana-terminal-run' has always passed for a plain run (no Call an Audible, no
 * Stepped Audible, no Contingency Operator/ambiguity override -- the composer exposes none of
 * those toggles). Nothing in this function transforms, wraps, or inspects that call's return
 * value before handing it back -- THE DEFAULT MUST NOT CHANGE.
 *
 * D-BP154-010/BISHOP/S10/seg-thepail, ADDITIVE/OPTIONAL: `askConversationalAuthority` and
 * `currentAcquisitionId`. Both undefined on every pre-existing call site (this file's own test
 * suite, before this ticket) -- passing them through is the SAME "no wrapping" contract, just
 * widened: `askGoogle` may itself now be a transparent recordingAskGoogle() wrapper (evidence_
 * authority.ts's own contract: returns exactly what the inner function returned), which does not
 * transform this function's own logic at all, only what the CALLER handed in as `askGoogle`. Before
 * this ticket the Composer could not reach Gemini at all (`askConversationalAuthority` was never
 * threaded past this function's own parameter list); this closes that gap for both the default
 * path (an 8th positional argument to runLianaCycleQuestion(), exactly where 'liana-terminal-run'
 * already passes its own) and the stack path (MethodRunContext.askConversationalAuthority, the
 * same optional field Survey's own askAmbiguity()/askOperation() already know how to read).
 */
export async function runScratchComposer(
  input: string,
  stepIds: string[] | undefined,
  askGoogle: AskGoogleFn,
  emit: EmitFn,
  askConversationalAuthority?: ConversationalAuthorityFn,
  currentAcquisitionId?: string,
  // D-BP154-044/BISHOP-SEG/S44/seg-acquire, ADDITIVE/OPTIONAL: undefined on every pre-existing
  // call site (index.ts's own default 'liana-terminal-run' path never passes it) -- threaded only
  // into the stack path's own ctx, below. See method_registry.ts's MethodRunContext.
  // askConversationalAuthorityAs for the full ruling this exists to serve (FD-BP154-19).
  askConversationalAuthorityAs?: MethodRunContext['askConversationalAuthorityAs'],
): Promise<ScriptRunResponse> {
  if (!stepIds || stepIds.length === 0) {
    const outcome = await runLianaCycleQuestion(
      input,
      askGoogle,
      emit,
      undefined, // audible
      undefined, // steppedAudible
      undefined, // contingencyOperatorSurvey
      undefined, // ambiguityQueryTransport
      askConversationalAuthority,
      undefined, // mode
      undefined, // assistedChannel
      currentAcquisitionId,
    );
    return { mode: 'default', outcome };
  }

  const trimmed = input.trim();
  const parsed = /^\d+$/.test(trimmed) ? parseQid(Number(trimmed)) : parseFreeText(trimmed);
  if (parsed.qidNotFound) {
    return {
      mode: 'stack',
      qid: parsed.qid,
      question: '',
      options: null,
      result: {
        ok: false,
        steps: [],
        results: [],
        error: `qid ${parsed.qid} not found in the bundled corpus (resources/mmlu_pro_bundled/questions.jsonl)`,
      },
    };
  }
  const methodInput: MethodQuestionInput = {
    qid: parsed.qid,
    question: parsed.question,
    options: parsed.options,
    correctAnswer: parsed.correctAnswer,
    // D-BP154-030/BISHOP-SEG/S30/seg-humannuance, ADDITIVE: threaded straight through from
    // parseQid()/parseFreeText() (liana_terminal_engine.ts) -- undefined for free-text input or a
    // bundled qid not yet backfilled, exactly like correctAnswer's own optionality above.
    originSrc: parsed.originSrc,
    // D-BP154-041/BISHOP-SEG/S41/seg-purpose, ADDITIVE: same threading, for purpose_step.ts's
    // category-sourced candidate.
    category: parsed.category,
  };
  // D-BP154-017: acquisitionId threaded through so a claim-producing step (persistStepClaim(),
  // above) can tag its persisted classification with the SAME acquisition id THE PAIL already
  // tags every EvidenceRecord this run writes with -- see method_registry.ts's own doc comment on
  // MethodRunContext.acquisitionId.
  const ctx: MethodRunContext = {
    askGoogle, emit, askConversationalAuthority, acquisitionId: currentAcquisitionId, askConversationalAuthorityAs,
  };
  const result = await runComposedStack(stepIds, methodInput, ctx);
  return { mode: 'stack', qid: parsed.qid, question: parsed.question, options: parsed.options, result };
}
