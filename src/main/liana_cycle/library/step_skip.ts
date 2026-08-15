// step_skip.ts -- D-BP154-041/BISHOP-SEG/S41/seg-purpose, PART 3/3
//
// THE UPSTREAM SKIP GATE (demand-driven, not sequential). Founder: "if their usefulness has been
// superseded by a previous step, then we don't run what we don't need." MEASURED THIS TICKET:
// `Magnitude:1` ran and timed out on a live qid-98 stack AFTER FD-BP154-14's own reducer (terminator_
// step.ts) had already ruled its output irrelevant -- a wasted live query that also dragged the run
// to `incomplete: true`. terminator_step.ts's own FD-BP154-14 branch only ever catches this AFTER
// Magnitude:1 has already run (it is a downstream, defensive check on whatever Magnitude:1 returned
// or failed to return). computeStepSkip() below is the upstream half: called from script_bridge.ts's
// runOneStep() BEFORE a skippable step's real runner is invoked at all, so the query is never spent.
//
// Each step DECLARES what it produces; the Terminator DECLARES what it needs (see the DECIDING/
// REFUTING table below). Before a step runs: can this step's own output still change the outcome?
// If not, this file returns a SkippedStepMarker instead of letting the caller invoke the real
// runner -- no network call, no Ollama call, no wall-clock cost.
//
// ───────────────────────────── THE FIVE QUALIFIERS ─────────────────────────────
//
// 1. SKIPPED-AS-MOOT IS NOT FAILED. isSkippedMarker() (below) is the ONE place a skip marker is
//    told apart from a real failure -- terminator_step.ts's own stepStatus() (PART 3/3, that file)
//    checks it FIRST and reports the THIRD status 'skipped-moot', never 'failed'. anyStepFailed()
//    (terminator_step.ts, pre-existing, unmodified) only ever counts the literal string 'failed',
//    so a skip can never mark a run `incomplete`.
//
// 2. RESOLVED MEANS RESOLVED BY EVIDENCE, NOT EXHAUSTION. computeStepSkip()'s own FD-BP154-14
//    check calls isMembershipPartitioned() (terminator_step.ts, EXTRACTED not duplicated), which
//    reads NamedSet:1/Discriminator:1's own `included`/`propertyMembers` ONLY when that step's own
//    `ok === true` -- a unique survivor left behind by two FAILED feeder steps is exhaustion, not
//    resolution, and never triggers a skip here.
//
// 3. NO STEP IS SKIPPED ON THE BASIS OF A STEP THAT ITSELF FAILED. Same `ok === true` discipline as
//    (2) -- both of this file's checks (the sufficiency-driven skip and the FD-BP154-14 skip) read
//    a feeder's own facts only when that feeder succeeded; a failed Purpose:1 or a failed NamedSet:1/
//    Discriminator:1 never causes anything downstream to be skipped.
//
// 4. STEPS THAT CAN REFUTE ALWAYS RUN. Classified once, here, so the classification is one citable
//    table rather than scattered judgment calls:
//
//      Purpose:1        DECIDING  -- selects R (which precondition/policy applies). Never a skip
//                                     candidate: nothing precedes it in a stack (FD-BP154-16).
//      Softballs:1      REFUTING  -- its `excluded` facts feed terminator_step.ts's own
//                                     contradiction checks against NamedSet:1/Discriminator:1's
//                                     stated memberships (deriveTerminatorEliminations()'s own
//                                     three contradiction loops). Always runs.
//      NamedSet:1       REFUTING  -- symmetric to Softballs:1's own reasoning; its `included` facts
//                                     are the OTHER side of the same contradiction checks. Always
//                                     runs.
//      Discriminator:1  REFUTING  -- `propertyMembers`/`subregionNonMembers`/`categoryEnumeration`
//                                     each feed their own contradiction checks. Always runs.
//      HumanNuance:1    REFUTING  -- its `excluded` facts feed the same contradiction checks
//                                     (D-BP154-033). Always runs.
//      Magnitude:1      DECIDING ONLY -- it ranks survivors; a ranking can never CONTRADICT a
//                                     stated membership fact, only add a decision on top of one
//                                     already-settled frame. THE ONE SKIP CANDIDATE below.
//      Terminator:1     the final aggregator -- always runs (nothing after it to report the
//                                     result to; it is also where contradiction detection actually
//                                     executes, so it can never itself be "superseded").
//
//    THE SUFFICIENCY-DRIVEN SKIP IS A SEPARATE, WIDER GATE, NOT GOVERNED BY THIS TABLE. When
//    Purpose:1 finds the evidence class structurally incapable (sufficiency_gate.ts), EVERY
//    query-issuing step is skipped alike -- including the four REFUTING ones. This is not an
//    exception to qualifier 4: REFUTING exists to guard against false symmetry AMONG STATED FACTS
//    (the Founder's own "a space cowboy implies a space horse" example) -- there is nothing here
//    for a REFUTING step to refute, because the structural conclusion (optionCount cannot support
//    a unique non-member of a small, exclusive grouping) does not rest on any stated fact a source
//    could contradict. A contradiction among Softballs:1/NamedSet:1's own claims could never change
//    an arithmetic fact about the option count.
//
// 5. EVERY SKIP IS RECORDED WITH ITS REASON AND IS RE-DERIVABLE. computeStepSkip() is pure and
//    synchronous, versioned (SKIP_POLICY_VERSION), and reads nothing but `priorResults` -- replaying
//    the identical prior results always produces the identical skip decision. SkippedStepMarker.
//    skipReason is threaded into the step's own summary line (script_bridge.ts's runOneStep()) and
//    persists in the run transcript exactly like every other step's summary.
//
// classify_cascade.ts is FORBIDDEN and was not read. No branch below selects a letter (HARDWIRE-22/
// FD-BP153-06) -- every check reads only counts/booleans already computed by the feeder steps
// themselves, never which option is which.

import { deriveTerminatorEliminations, isCategoryFrameSubstantive, isMembershipPartitioned } from './terminator_step';
import type { NamedSetResult } from './named_set_step';
import type { DiscriminatorResult } from './discriminator_step';
import type { SoftballsResult } from './softballs_step';
import type { UnitaryResult } from './unitary_step';
import type { HumanNuanceResult } from './human_nuance_step';
import type { ComposerStepOutcome } from './script_bridge';

export const SKIP_POLICY_VERSION = '1';

export interface SkippedStepMarker {
  ok: false;
  skipped: true;
  skipReason: string;
}

/** THE ONE PLACE a raw step result is told apart from a real (possibly failed) one. Structural,
 *  never a class check -- SkippedStepMarker is a plain object, so a duck-typed `skipped === true`
 *  check is what every consumer (terminator_step.ts's own stepStatus()) needs. */
export function isSkippedMarker(raw: unknown): raw is SkippedStepMarker {
  return Boolean(raw) && typeof raw === 'object' && (raw as { skipped?: unknown }).skipped === true;
}

// D-BP154-055/BISHOP-SEG/S52/seg-wiregate, REMOVED (not weakened): the sufficiency-driven upstream
// skip that used to live here (SKIPPABLE_QUERY_STEPS + a Purpose:1-raw-sufficiency check, firing
// on Softballs:1/NamedSet:1/Discriminator:1/HumanNuance:1/Unitary:1/Magnitude:1 alike) is GONE.
// Coordinator's own live-diagnosed finding (qid 98, D-BP154-055 dispatch): "the gate is firing on
// the raw nine-option count and short-circuiting the whole chain before the frame is ever
// attempted... it is correct about the naive reading and wrong as a gate placement." The fix moves
// the sufficiency check DOWNSTREAM, into terminator_step.ts's own runTerminatorStep() -- evaluated
// a SECOND time there, against the COMPARABLE CANDIDATE SET (the option count after admissibility-
// class eliminations), not the raw list -- which structurally REQUIRES Softballs:1/HumanNuance:1/
// BoundaryStability:1 (the admissibility-class sources) to have already run before that recheck can
// mean anything. An UPSTREAM skip based on the RAW count alone would once again short-circuit the
// very evidence the downstream recheck needs -- exactly the placement error this ticket repairs.
// These five/six query-issuing steps therefore always run now; only Magnitude:1's own SEPARATE,
// unrelated FD-BP154-14 skip (below, unmodified) remains.
export function computeStepSkip(id: string, priorResults: ComposerStepOutcome[]): SkippedStepMarker | null {
  const findRaw = (sid: string): unknown | null => priorResults.find((r) => r.id === sid)?.raw ?? null;

  if (id === 'Magnitude:1') {
    const softballsRaw = findRaw('Softballs:1') as SoftballsResult | null;
    const namedSetRaw = findRaw('NamedSet:1') as NamedSetResult | null;
    const discriminatorRaw = findRaw('Discriminator:1') as DiscriminatorResult | null;
    const unitaryRaw = findRaw('Unitary:1') as UnitaryResult | null;
    // D-BP154-043, AMENDED; D-BP154-046 FIX 2, AMENDED AGAIN. Founder's own correction to
    // FD-BP154-14 (terminator_step.ts's own header carries the full ruling text): "Magnitude does
    // NOT run when membership RESOLVES to a unique survivor. Magnitude IS the final permissible
    // tie-break when membership PARTITIONS but leaves several survivors AND the artifact class is
    // a single-answer item AND the category frame is SUBSTANTIVELY established." This upstream
    // gate must apply the SAME amendment the downstream terminator_step.ts reducer applies, or the
    // two disagree -- LIVE-MEASURED TWICE now (D-BP154-043's own original mismatch, and again this
    // ticket: Magnitude:1 ran a real, wasted live query here even though terminator_step.ts's own
    // Fix 2 correctly withheld the license afterward, because this file still only checked the
    // pre-Fix-2 condition). isCategoryFrameSubstantive() is imported, not duplicated -- ONE
    // definition, reused by both this upstream gate and the downstream reducer.
    const humanNuanceRaw = findRaw('HumanNuance:1') as HumanNuanceResult | null;
    const artifactClassEstablished = Boolean(
      humanNuanceRaw?.ok && humanNuanceRaw.artifactClassEstablished && humanNuanceRaw.corpusMetaTruth,
    );
    // Qualifiers 2/3: a minimal, letter-only "what has been eliminated so far" array, built ONLY
    // from letters each feeder step's own `ok === true` result actually states -- a failed or
    // unproductive step contributes nothing, same discipline deriveTerminatorEliminations() itself
    // already applies (never duplicated here; this is deliberately narrower, letter-only, since
    // this upstream gate has no `OPT` to build full elimination entries with).
    const eliminatedLetters: Array<{ letter: string }> = [
      ...(softballsRaw?.ok ? softballsRaw.excluded.map((e) => ({ letter: e.letter })) : []),
      ...(namedSetRaw?.ok ? namedSetRaw.included.map((e) => ({ letter: e.letter })) : []),
      ...(discriminatorRaw?.ok ? [...discriminatorRaw.propertyMembers, ...discriminatorRaw.subregionNonMembers].map((e) => ({ letter: e.letter })) : []),
      ...(humanNuanceRaw?.ok ? humanNuanceRaw.excluded.map((e) => ({ letter: e.letter })) : []),
      ...(unitaryRaw?.ok ? unitaryRaw.excluded.map((e) => ({ letter: e.letter })) : []),
    ];
    const categoryFrameSubstantive = isCategoryFrameSubstantive(eliminatedLetters, humanNuanceRaw);
    // Qualifiers 2/3: isMembershipPartitioned() (terminator_step.ts) itself reads `included`/
    // `propertyMembers` ONLY when the owning step's own `ok === true`.
    if (isMembershipPartitioned(namedSetRaw, discriminatorRaw)
      && (!artifactClassEstablished || categoryFrameSubstantive === null || !categoryFrameSubstantive.substantive)) {
      const substantiveNote = categoryFrameSubstantive === null
        ? 'no evidence either way'
        : categoryFrameSubstantive.substantive
          ? 'substantive'
          : `NOT substantive -- ${categoryFrameSubstantive.uncaught.join(', ')} uncaught`;
      return {
        ok: false,
        skipped: true,
        skipReason: `SKIPPED-AS-MOOT (skip policy v${SKIP_POLICY_VERSION}): FD-BP154-14 -- membership `
          + 'already partitioned by NamedSet:1/Discriminator:1 (both SUCCESSFUL). Artifact class: '
          + `${humanNuanceRaw?.ok ? (humanNuanceRaw.artifactClassEstablished ? 'established' : 'not established') : 'not run/failed'}. `
          + `Category frame (D-BP154-046 FIX 2): ${substantiveNote}. `
          + 'Magnitude:1 is DECIDING-only (it ranks; it cannot refute a stated membership fact) and has '
          + 'nothing legitimate left to decide once membership is settled without BOTH of the tie-break '
          + 'licence\'s own preconditions (D-BP154-043/046)',
      };
    }
    // Both preconditions hold: NOT skipped -- the amendment permits Magnitude:1 to run as the
    // final tie-break here; falls through to the live run.
  }

  return null;
}
