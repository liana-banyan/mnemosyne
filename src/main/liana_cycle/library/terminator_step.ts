// terminator_step.ts -- D-BP154-018/BISHOP-SEG/S18/seg-terminator
//
// THE TERMINATOR AS A COMPOSER STEP. THE_PAIL_BP154.md STAGE 5, Founder verbatim: "NOW make sure
// that you don't throw the milk or spill it or drink it or poison it, as you carry it ALL THE WAY
// BACK TO THE HOUSE." This is the carrying-home step -- a fourth stackable Composer step beside
// Softballs:1/NamedSet:1/Discriminator:1, registered and reorderable exactly like them.
//
// IT ASKS NO NEW QUESTION OF ITS OWN. Every other Composer step issues at least one query
// (owned-evidence-first, then conversational, per composer_step_evidence.ts); this one issues
// none -- it is a pure reducer over the THREE PRECEDING STEPS' ALREADY-COMPUTED results, read from
// script_bridge.ts's own accumulated ComposerState.results (threaded in as `priorResults`, see
// that file's own header for the plumbing). If Softballs/NamedSet/Discriminator have not yet run
// in THIS stack (the operator composes the order himself, FD-BP152-20), the missing step simply
// contributes zero eliminations -- never treated as "confirmed nothing to eliminate", which would
// be exactly the "absence read as denial" error HARDWIRE-22's sibling rule (FD-BP153-07) forbids
// throughout this estate.
//
// THE RULE, ALREADY RATIFIED (FD-BP152-19, verbatim): "UNIQUE OR ABSTAIN. NEVER PICK AMONG
// SURVIVORS."
//   1. Options THE SOFTBALLS states are NOT members of the category are OUT.
//   2. Options THE NAMED SET states ARE members of the superlative property are OUT (the question
//      asks which is NOT the property; a stated member cannot be that answer).
//   3. Options THE DISCRIMINATOR states have a kind DIFFERENT from the category-denoting kind are
//      OUT -- FD-BP153-06's own passing example, verbatim: "Eliminate an option a source STATES is
//      a different kind of thing." Compared by exact normalized-text identity against the
//      category-denoting kind the SAME passage stated (HARDWIRE-22: similarity is not identity --
//      this is whitespace/case-fold identity on two spans the source itself already gave, never a
//      semantic judgment call).
//   4. Exactly one survivor after 1-3 -> VERDICT. More than one -> ABSTAIN, naming which step left
//      it ambiguous (this reducer does not itself re-ask the Discriminator a second time; a stack
//      that wants a second attempt reorders/reruns Discriminator:1 itself). Zero survivors ->
//      ABSTAIN, naming over-elimination (at least one step's basis must be wrong; never published).
//
// THE CONTRADICTION CHECK (BP154 dispatch, verbatim: "if the frame excluded an option that another
// step treats as a member, that is a contradiction and it ABSTAINS rather than publishing" -- the
// five-runs-all-published-A history this ticket exists to stop, one of which "called B and D 'not
// world regions' while the named set simultaneously called them the most densely populated
// regions"). Checked BEFORE the survivor count: any letter BOTH excluded by Softballs (not even in
// the category) AND included by Named Set (a superlative member OF the category) is
// self-contradictory on its face -- Softballs and Named Set cannot both be right about it -- and
// forces an ABSTAIN regardless of what the survivor count would otherwise say.
//
// THE BASIS IS THE PRODUCT, NOT THE LETTER (FD-BP153-06). Every elimination in the published basis
// names WHICH step eliminated the option, on WHAT stated source, with the VERBATIM SPAN -- never
// merely "eliminated". No branch below ever reads which letter is which; every option is treated
// by the same three rules regardless of identity.
//
// HARDWIRE-22 UNRELAXED even though this file asks no query itself: verbatim span or
// discard-and-count is inherited from what Softballs/NamedSet/Discriminator already verified --
// this file trusts their `excluded`/`included`/`kinds` arrays exactly as given (those steps already
// ran the verbatim-span choke point; re-verifying here would be redundant, not safer) and never
// invents a span of its own.
//
// classify_cascade.ts remains FORBIDDEN. comparative_cascade.ts remains untouched by this file
// (this reducer needs none of its exports -- no gemmaExtract call, no googleBlocks call, nothing).
// D-BP153-003: runtime stays structurally blind -- no answer key, no qid-specific branch, anywhere
// in this file.

import type { MethodQuestionInput, MethodRunContext } from '../method_registry';
import { registerNameNumbered } from './method_registry';
import type { MethodIdentity } from './method_identity';
import type { StepDeclaration } from './step_declaration';
import type { ComposerStepOutcome } from './script_bridge';
import { classifyComposerStepResult, type ComposerStepClass } from '../../../shared/composer_step_classification';
import type { SoftballsResult } from './softballs_step';
import type { NamedSetResult } from './named_set_step';
import type { DiscriminatorResult } from './discriminator_step';
// D-BP154-022/BISHOP-SEG/S22/seg-magnitude, ADDITIVE, TYPE-ONLY (erased at compile time -- no
// runtime circular dependency; magnitude_step.ts's own VALUE import of
// deriveTerminatorEliminations from THIS file is the only runtime edge between the two files).
import type { MagnitudeResult } from './magnitude_step';
// D-BP154-033/BISHOP-SEG/S30-continuation/seg-wire-humannuance, ADDITIVE, TYPE-ONLY (erased at
// compile time -- same non-circular shape as MagnitudeResult's own import just above:
// human_nuance_step.ts's own runtime import of deriveTerminatorEliminations from THIS file is the
// only runtime edge between the two files). Closes the gap flagged in D-BP154-030's own commit
// message: HumanNuance:1 was built and registered but never consumed by this file, so it could
// never change a verdict -- BUILT, not ACTIVE, per FD-BP154-08. This wiring is what makes it ACTIVE.
import type { HumanNuanceResult } from './human_nuance_step';
// D-BP154-041/BISHOP-SEG/S41/seg-purpose, PART 2/3, ADDITIVE, TYPE-ONLY (same non-circular shape as
// the two imports just above -- purpose_step.ts's own runtime imports never reach this file).
// FD-BP154-17: "before an answer is attempted, establish that the available evidence class CAN
// satisfy the stated purpose." Consulted here so a structurally-insufficient purpose withholds a
// verdict BEFORE this reducer's own elimination/contradiction logic runs at all.
import type { PurposeResult } from './purpose_step';
// D-BP154-055/BISHOP-SEG/S52/seg-wiregate, VALUE IMPORT. Coordinator's own live-diagnosed fix:
// "the sufficiency precondition is firing on the raw nine-option count and short-circuiting the
// whole chain before the frame is ever attempted... it must be evaluated against the COMPARABLE
// CANDIDATE SET, not the raw option list." checkSufficiency() (sufficiency_gate.ts, D-BP154-041,
// UNCHANGED) is reused, not reinvented -- called a SECOND time, here, against the post-admissibility-
// filter pool size, alongside the pre-existing RAW call purpose_step.ts already makes. Both are
// kept, never one deleted for the other (coordinator, verbatim: "Keep the gate... do not delete it
// -- move it, and record BOTH results").
import { checkSufficiency } from './sufficiency_gate';
import type { PurposeSufficiencyResult } from './sufficiency_gate';
// D-BP154-041/BISHOP-SEG/S41/seg-purpose, PART 3/3, ADDITIVE, VALUE IMPORT. isSkippedMarker() is
// the ONE place a SKIPPED-AS-MOOT raw result (script_bridge.ts's own computeStepSkip()) is told
// apart from a real 'failed' result -- qualifier 1 of the skip gate's own five: "SKIPPED-AS-MOOT
// is not FAILED... must NOT mark the run incomplete." No runtime circular dependency: step_skip.ts
// imports isMembershipPartitioned (this file, above) as a VALUE, but this file never imports
// anything from script_bridge.ts except TYPES (already erased at compile time, see
// ComposerStepOutcome's own import below) -- the same non-circular shape magnitude_step.ts's/
// human_nuance_step.ts's own imports FROM this file already establish.
import { isSkippedMarker } from './step_skip';
// D-BP154-043/BISHOP-SEG/S43/seg-unitary, ADDITIVE, TYPE-ONLY (same non-circular shape as every
// other feeder-step type import above -- unitary_step.ts's own runtime imports never reach this
// file). FD-BP154-16's "unitary vs conglomerate" membership factor, as a sixth elimination source.
import type { UnitaryResult } from './unitary_step';
// D-BP154-052/BISHOP-SEG/S52/seg-wiregate, VALUE IMPORT. comparability_gate.ts (D-BP154-050) was
// BUILT and tested but never consumed by this file -- FD-BP154-08's own "tests pass is never
// ACTIVE" applies to it exactly as it applied to HumanNuance:1 before D-BP154-033 wired that one
// in (see this file's own import above). checkUniformPredicate() -- "the executable rejection of
// any elimination rule that would also remove a same-type peer" -- is now called LIVE, this run,
// against whatever Unitary:1 actually returned (checkCompositenessUniformity(), below) -- this
// REPLACES the prior hardcoded "Unitary never eliminates" comment (D-BP154-050's own
// `void unitary;` line, still present just below for the reason stated there) with a computed,
// per-run, data-driven decision: the withdrawal is no longer asserted by this file's own say-so,
// it is PROVEN by the same mechanical check the spec names as the ONE thing that mechanically
// blocks the Central Asia category error. D-BP154-060/FD-BP154-22: every option in the frame now
// gets a real entityType (peer-scope, not a substantive claim -- see buildComparabilityCandidates()'s
// own header below) so an option a feeder step never addressed at all stays VISIBLE to the
// procedural check as unanswered, rather than disappearing via 'unknown'-type exclusion.
import {
  checkUniformPredicate, type Candidate,
} from './comparability_gate';
// D-BP154-053/BISHOP-SEG/S52/seg-wiregate, ADDITIVE, TYPE-ONLY (same non-circular shape as every
// other feeder-step type import above). The Founder's own sourced proof names boundary stability,
// not compositeness, as the discriminator that survives checkUniformPredicate() -- see
// boundary_step.ts's own header.
import type { BoundaryResult } from './boundary_step';

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

// D-BP154-020/BISHOP-SEG/S20/seg-discriminator2 -- THE VOCABULARY MISMATCH FIX.
//
// LIVE-MEASURED this ticket (qid 98, run 6): a real Discriminator passage stated the
// category-denoting kind as a COMPOUND LIST -- "Continents and Geographic / Geopolitical
// Subregions" -- while stating each option's OWN kind singularly, with its own parenthetical
// elaboration -- "Continent (a major global landmass)". Byte-for-byte identity (this file's
// pre-existing rule, unchanged in spirit below) failed EVERY ONE of the 9 options against that
// compound string, even the ones the source's own words plainly support (a "Continent" IS one of
// the two kinds the same sentence says denote "world regions") -- producing a spurious
// zero-survivor DEGENERATE FRAME that the zero-survivors safety net below correctly caught and
// abstained on, but which never should have been produced in the first place: the source did not
// say a Continent is a DIFFERENT kind from what denotes the category, it said the OPPOSITE.
//
// Founder's own naming of this exact trap (D-BP154-020 dispatch): "A kind that does not
// string-match is UNSTATED, not denied. Never exclude on a non-match." THE FIX BELOW STAYS
// STRUCTURAL, NEVER SEMANTIC (HARDWIRE-22; BP153 canon "ask a local model to copy, never to
// decide") -- no synonym table, no similarity score, no model consulted about whether two labels
// mean the same thing, anywhere in this function:
//   1. Strip each side's own trailing parenthetical elaboration -- decoration the source itself
//      set off in parentheses, never part of the classification word itself.
//   2. Split the categoryKind's stated text on ITS OWN literal list conjunctions (", " / " and "
//      / " or ") into the list of kind-phrases the source itself enumerated -- reading a list the
//      source wrote as a list, never inventing one that isn't there.
//   3. Fold a single trailing "s" for singular/plural tolerance ONLY -- the same class of
//      mechanical operation norm() above already performs (case/punctuation/whitespace folding),
//      applied identically to every kind pair regardless of the actual words, never conditioned on
//      which option, letter, or category is involved.
// A per-option kind is treated as matching the category iff it equals (after 1-3) the WHOLE
// categoryKind string OR any ONE item the split in step 2 produced -- always an EXACT match
// against a literal phrase the source itself wrote, never a judgment that two different words mean
// the same thing. An option whose kind matches NEITHER is eliminated exactly as before this fix.
// D-BP154-021/BISHOP-SEG/S21/seg-mortgagetrap FIX to D-BP154-020's own stripParenthetical(): the
// ORIGINAL only stripped a TRAILING parenthetical (anchored to end-of-string). LIVE-MEASURED this
// ticket (qid 98): a real categoryKind read "Geopolitical Macro-Regions (such as South Asia, North
// Africa, and Central Asia) and Continents (such as Europe and South America)" -- a parenthetical
// in the MIDDLE of the string, not just at the end. The end-anchored strip removed only the final
// "(such as Europe and South America)", leaving the FIRST parenthetical's own internal commas and
// "and" ("South Asia, North Africa, and Central Asia") to be mis-read by the list-splitter below as
// ADDITIONAL top-level list separators -- corrupting the split into "Geopolitical Macro-Regions
// (such as South Asia", "North Africa", "and Central Asia)", "Continents", none of which matched
// "Geopolitical Macro-Region" (B/C/F's own stated kind) -- wrongly eliminating them. Fixed by
// stripping EVERY parenthetical span (global, not end-anchored) before splitting -- still the same
// mechanical operation (decoration the source set off in parentheses, never part of the
// classification word itself), just no longer blind to a parenthetical that isn't the very last
// thing in the string.
function stripParenthetical(s: string): string {
  return s.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
}
function foldPluralToken(s: string): string {
  return s.endsWith('s') && !s.endsWith('ss') ? s.slice(0, -1) : s;
}
function normKindToken(s: string): string {
  return foldPluralToken(norm(stripParenthetical(s)));
}
function splitCategoryKindList(categoryKindText: string): string[] {
  return stripParenthetical(categoryKindText)
    .split(/\s*,\s*|\s+and\s+|\s+or\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
}
/** Exported for direct unit testing (same discipline as this file's own deriveTerminatorEliminations). */
export function discriminatorKindMatchesCategory(optionKind: string, categoryKindText: string): boolean {
  const optionToken = normKindToken(optionKind);
  if (!optionToken) return false;
  if (normKindToken(categoryKindText) === optionToken) return true;
  return splitCategoryKindList(categoryKindText).some((item) => normKindToken(item) === optionToken);
}

export interface TerminatorEliminationEntry {
  letter: string;
  name: string;
  /** Which Composer step's stated fact eliminated this option. D-BP154-033, ADDITIVE:
   *  'HumanNuance:1' added as a fourth elimination source. D-BP154-043, ADDITIVE: 'Unitary:1'
   *  added as a fifth (FD-BP154-16's "unitary vs conglomerate" factor). */
  // D-BP154-053, ADDITIVE: 'BoundaryStability:1' added as a sixth elimination source -- the
  // Founder's own sourced proof (PROOF_QID98_TEST_AWARE_ELIMINATION_BP154.md): boundary stability,
  // not compositeness, is the discriminator that survives checkUniformPredicate().
  sourceStep: 'Softballs:1' | 'NamedSet:1' | 'Discriminator:1' | 'HumanNuance:1' | 'Unitary:1' | 'BoundaryStability:1';
  reason: string;
  span: string;
}

export interface TerminatorContradiction {
  letter: string;
  reason: string;
}

export interface TerminatorResult {
  ok: boolean;
  /** Which of the feeder steps were actually found (already run, earlier in this same stack) --
   *  a step absent from the stack is reported here as 'not run', distinct from a step that ran
   *  and abstained. D-BP154-022, ADDITIVE: 'Magnitude:1' added alongside the original three.
   *  D-BP154-033, ADDITIVE: 'HumanNuance:1' added as a fifth. */
  // D-BP154-041 PART 2/3, ADDITIVE: 'Purpose:1' added as a sixth entry -- see this file's own new
  // import above. PART 3/3, ADDITIVE: 'skipped-moot' added as a fourth status -- Purpose:1 itself
  // is never skipped (nothing precedes it), so it never carries this status; the five query-issuing
  // feeder steps can. D-BP154-043, ADDITIVE: 'Unitary:1' added as a seventh entry.
  //
  // D-BP154-046 FIX 1, NEW STATE. Founder: "A step that succeeds badly is indistinguishable from a
  // step that succeeds well" -- the antonymic canon at the status layer. 'ok-but-unproductive':
  // the step ran, returned ok:true, but stated NOTHING actionable (isStepProductive(), below) --
  // e.g. Softballs:1 excluding zero (or, live-measured, a partial/trivial subset that left obvious
  // non-regions in the frame) is formally green and substantively hollow. Distinct from 'ok'
  // (ran, succeeded, produced something) and from 'failed' (did not succeed at all) -- three states
  // for three different facts, never collapsed into two.
  // D-BP154-053, ADDITIVE: 'BoundaryStability:1' added as an eighth entry.
  stepsConsulted: Record<'Softballs:1' | 'NamedSet:1' | 'Discriminator:1' | 'Magnitude:1' | 'HumanNuance:1' | 'Purpose:1' | 'Unitary:1' | 'BoundaryStability:1', 'not run' | 'ok' | 'ok-but-unproductive' | 'failed' | 'skipped-moot'>;
  /** D-BP154-041 PART 2/3, FD-BP154-17, ADDITIVE. Non-null ONLY when Purpose:1 ran (ok:true) and
   *  found the evidence class structurally incapable of satisfying its own stated purpose -- a
   *  DISTINCT outcome from a normal ABSTAIN (multiple/zero survivors after elimination) and from a
   *  wrong VERDICT. `abstain` is still set true and `abstainReason` still carries a human-readable
   *  line (every pre-existing reader of `abstain`/`abstainReason` keeps working unchanged); this
   *  field is what lets a reader tell the two ABSTAIN shapes apart structurally. */
  insufficientEvidence: { preconditionId: string; reason: string; policyVersion: string } | null;
  eliminated: TerminatorEliminationEntry[];
  survivors: string[];
  contradiction: TerminatorContradiction | null;
  verdict: string | null;
  verdictName: string | null;
  abstain: boolean;
  abstainReason: string | null;
  /** D-BP154-018: the classification (017's ratified mapping) of every CONTRIBUTING feeder step --
   *  i.e. every step that eliminated at least one non-survivor -- so the shared classifier can
   *  derive this verdict's own PROVEN/CORROBORATED/ANSWERED tier from how well-evidenced its own
   *  basis actually is, never from which letter it reached. Empty when abstaining. */
  basisStepClasses: ComposerStepClass[];
  /** D-BP154-022, ADDITIVE: non-null ONLY when this verdict was reached via Magnitude:1's stated
   *  ranking rather than a unique survivor after elimination alone (FD-BP153-01: "magnitude
   *  decides only among the survivors" -- a DIFFERENT mechanism from UNIQUE OR ABSTAIN's own
   *  elimination-to-one, reported honestly as such, never blended into `eliminated` as if it were
   *  another stated exclusion). Null in every pre-existing unique-survivor verdict. */
  // D-BP154-043, ADDITIVE: `tieBreakKind` distinguishes a GENUINE superlative ranking
  // ('genuine-superlative', FD-BP153-01's own original case -- no prior step ever found a stated
  // member of the property) from a PARTITIONED TIE-BREAK ('partitioned-membership-tiebreak' --
  // membership already partitioned the options but left more than one survivor, and this run's own
  // artifact class was established as a single-answer item, so FD-BP154-14's AMENDMENT permits
  // Magnitude:1 as the final permissible tie-break). Undefined on the pre-existing genuine-ranking
  // shape (no behavior change for that case); always present when this verdict came through the
  // amendment's own branch.
  magnitudeBasis: {
    targetExtreme: 'most' | 'least'; property: string; span: string;
    tieBreakKind?: 'genuine-superlative' | 'partitioned-membership-tiebreak';
    /** D-BP154-043, ADDITIVE. The Founder's own explicit badge instruction, verbatim: "PROVEN
     *  requires the single frozen dataset covering all survivors... Otherwise it is ANSWERED. Do
     *  not badge higher than the evidence." Computed here from Magnitude:1's own
     *  `frozenSource.obtained` -- never upgraded on this file's own say-so. */
    sourceGrade?: 'ANSWERED -- not proven by a unified frozen dataset' | 'PROVEN-eligible -- single frozen source covers every survivor';
  } | null;
  /** D-BP154-024/BISHOP-SEG/S24/seg-unstated, ADDITIVE: the three-bucket report (Founder, this
   *  dispatch, verbatim: "matched-as-member / matched-as-non-member / unmatched (unstated) --
   *  three outcomes, not two"). Null only in the two early "cannot even attempt this" failure
   *  returns (no options at all); computed whenever OPT exists, regardless of abstain/verdict. */
  frameMatchBuckets: TerminatorFrameMatchBuckets | null;
  /** D-BP154-052/BISHOP-SEG/S52/seg-wiregate, ADDITIVE, OPTIONAL (undefined only on the two early
   *  "cannot even attempt this" failure returns, before OPT/Unitary:1 are even read -- every other
   *  return site below sets it). THE LIVE PROOF that comparability_gate.ts's own
   *  checkUniformPredicate() -- not this file's comment -- decided whether Unitary:1's
   *  composite/conglomerate finding may eliminate anyone this run. See
   *  checkCompositenessUniformity()'s own header above. */
  comparabilityGate?: ComparabilityGateCheck | null;
  /** D-BP154-053, ADDITIVE, OPTIONAL (same undefined-on-the-two-early-failures shape as
   *  `comparabilityGate` above). THE LIVE PROOF that checkUniformPredicate() -- not this file's
   *  say-so -- decided whether BoundaryStability:1's materially-variable-boundary finding may
   *  eliminate anyone this run, and (unlike `comparabilityGate`) the SAME live decision actually
   *  GATES whether it is folded into `eliminated` (see checkBoundaryStabilityUniformity()'s own
   *  header above and deriveTerminatorEliminations()'s own use of it). */
  boundaryGate?: ComparabilityGateCheck | null;
  /** D-BP154-056, ADDITIVE, OPTIONAL (same shape as `comparabilityGate`/`boundaryGate` above). THE
   *  THIRD LIVE CALL: whether checkUniformPredicate() accepted or rejected Discriminator:1's own
   *  `subregionNonMembers` finding (D-BP154-026) as discriminating this run -- live-measured to
   *  reproduce the SAME category error the compositeness gate exists to catch (see
   *  checkSubregionUniformity()'s own header above). Undefined only on the two early failure
   *  returns before Discriminator:1 is even read. */
  subregionGate?: ComparabilityGateCheck | null;
  /** D-BP154-055, ADDITIVE. Purpose:1's own RAW sufficiency check (sufficiency_gate.ts,
   *  D-BP154-041), computed against the FULL, unfiltered option list -- "the item as MMLU-Pro
   *  ships it." Coordinator's own ruling: KEPT, never deleted -- it correctly detects the
   *  augmentation defect from the option count alone, deterministically and for free, and that
   *  finding stands regardless of what the comparable-set check below finds. Null only when
   *  Purpose:1 did not run/failed, or found no precondition applicable. Copied straight from
   *  `purposeRaw.sufficiency` -- never recomputed here (a second, independently-computed copy
   *  could drift from Purpose:1's own). */
  sufficiencyRaw?: PurposeSufficiencyResult | null;
  /** D-BP154-055, ADDITIVE. THE COORDINATOR'S OWN FIX: the SAME precondition
   *  (sufficiency_gate.ts's checkSufficiency(), reused unchanged), evaluated a SECOND time against
   *  the COMPARABLE CANDIDATE SET -- the option count AFTER admissibility-class eliminations
   *  (Softballs:1/HumanNuance:1/BoundaryStability:1's own OUT_OF_FRAME/NOT_COMPARABLE-class
   *  findings, computed live from whatever THIS run's evidence actually states, never from the
   *  raw list). THIS is what gates `insufficientEvidence` below now -- the raw field above is
   *  reported, never acted on by itself. Null under the same conditions `sufficiencyRaw` is null,
   *  OR when `purposeRaw.purposeType` has no declared precondition (checkSufficiency() itself
   *  reports `sufficient: true` in that case, so this is never null merely for lack of a rule). */
  sufficiencyPostFilter?: PurposeSufficiencyResult | null;
  /** D-BP154-028/BISHOP-SEG/S28/seg-survivable, ADDITIVE. Founder's own rule, this dispatch,
   *  verbatim: "A step that failed must never be indistinguishable from a step that ran and found
   *  nothing... an ABSTAIN from an incomplete run is a different animal from an ABSTAIN with all
   *  steps green, and today they look identical." True whenever ANY entry in `stepsConsulted` is
   *  'failed' -- computed from that SAME field (never a second, independently-tracked source of
   *  truth), so this can never drift from what the receipt already carries. 'not run' is NOT
   *  incomplete -- a step the operator never stacked was never expected to run; only a step that
   *  WAS run and did not succeed makes the run incomplete. Read this before trusting ANY verdict or
   *  ABSTAIN below, verdict or not -- a verdict reached while a feeder step failed is exactly as
   *  incomplete as an abstain reached the same way. */
  incomplete: boolean;
  error?: string;
}

/** D-BP154-028, ADDITIVE. The ONE place `incomplete` is computed -- never duplicated inline at each
 *  of the six TerminatorResult return sites below (that duplication is exactly the drift risk this
 *  file's own emptyDiscriminatorFields()-style helpers already guard against elsewhere in this
 *  estate). */
function anyStepFailed(stepsConsulted: TerminatorResult['stepsConsulted']): boolean {
  return Object.values(stepsConsulted).some((s) => s === 'failed');
}

// D-BP154-029/BISHOP-SEG/S29/seg-withhold, NEW. Founder's own rule, this dispatch, verbatim: "An
// incomplete run may not publish a verdict. If any step FAILED, the run ABSTAINS, and the basis
// names which steps failed and that the verdict was withheld because of it." The receipt's OWN
// first live run caught this: NamedSet:1 failed (so B/E, its own stated superlative-property
// eliminations, never happened), Magnitude:1 then ranked the WRONG survivor set, and the Terminator
// published F anyway -- `incomplete: true` was recorded, and the run proceeded as if it were not.
// "A flag that records a problem while the system proceeds as if there were none is not a fix."
// This map names each step's own job, purely descriptive (never used to eliminate or judge
// anything) -- it is what a reader needs to understand WHY withholding a verdict is the correct
// response to that specific step's absence.
const STEP_RESPONSIBILITY: Record<string, string> = {
  'Softballs:1': 'eliminating options the source states are NOT the category',
  'NamedSet:1': 'eliminating options the source states ARE the superlative property',
  'Discriminator:1': 'eliminating options the source states ARE the superlative property, or explicitly NOT the category in their own right',
  'Magnitude:1': 'ranking the survivors by magnitude to select the extreme',
  // D-BP154-033, ADDITIVE.
  'HumanNuance:1': 'eliminating options a source states are excluded from the origin\'s own (pre-augmentation) frame, with a stated reason',
  // D-BP154-043, ADDITIVE.
  'Unitary:1': 'eliminating options a source states are a conglomerate/grouping of multiple regions, not a single unitary region',
  // D-BP154-053, ADDITIVE.
  'BoundaryStability:1': 'eliminating options a source states have a materially variable, not-fixed-by-the-item boundary/definition, NOT_COMPARABLE to a peer whose boundary is fixed',
};

/** D-BP154-029, NEW. Names every FAILED step and what it was responsible for -- "Withheld:
 *  NamedSet:1 failed, so stated members of the superlative property were never eliminated" is the
 *  dispatch's own worked example; this generalizes it to however many steps failed, symmetrically
 *  (no step is special-cased by identity). */
function withheldNote(stepsConsulted: TerminatorResult['stepsConsulted']): string {
  const failedIds = (Object.entries(stepsConsulted) as Array<[string, string]>)
    .filter(([, status]) => status === 'failed')
    .map(([id]) => id);
  return failedIds
    .map((id) => `${id} failed, so ${STEP_RESPONSIBILITY[id] ?? 'its own contribution to the frame'} never happened`)
    .join('; ');
}

function sameLetterSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const bSet = new Set(b);
  return a.every((L) => bSet.has(L));
}

/** D-BP154-041 PART 3/3, EXTRACTED (not duplicated) from this file's own FD-BP154-14 branch below,
 *  so script_bridge.ts's own upstream skip gate (step_skip.ts) can check the SAME condition BEFORE
 *  Magnitude:1 ever runs, not only after it already spent a live query -- see step_skip.ts's own
 *  header for the full "upstream skip gate" reasoning this closes the loop on. Pure, synchronous;
 *  reads only NamedSet:1's/Discriminator:1's own already-computed `included`/`propertyMembers`
 *  arrays, and only when `ok === true` -- qualifiers 2/3 of the skip gate's own five (never resolve,
 *  and never skip, on the basis of a step that itself FAILED). */
// D-BP154-046 FIX 1, NEW, EXPORTED. THE ANTONYMIC CANON AT THE STATUS LAYER (Founder: "a step that
// succeeds badly is indistinguishable from a step that succeeds well"). Per-step "did this step's
// own successful run state anything actionable" -- reads only each step's OWN already-computed
// arrays (never a new judgment, never a letter-specific rule, FD-BP153-06); called ONLY after a
// step's own `ok === true` (qualifier 3: a failed step is 'failed', never 'ok-but-unproductive' --
// the two are different facts). A step id this function does not recognize is treated as
// productive by default -- never a false "unproductive" downgrade for a step this function has
// not been taught about. Exported so step_skip.ts's own gates (FIX 2, below) can consult the same
// definition rather than a second, independently-computed one that could drift from this one.
export function isStepProductive(id: string, raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as Record<string, unknown>;
  const nonEmpty = (v: unknown): boolean => Array.isArray(v) && v.length > 0;
  switch (id) {
    case 'Softballs:1':
    case 'HumanNuance:1':
    case 'Unitary:1':
      return nonEmpty(r.excluded);
    // D-BP154-053, ADDITIVE. BoundaryResult's own field is `unstable`, not `excluded`.
    case 'BoundaryStability:1':
      return nonEmpty(r.unstable);
    case 'NamedSet:1':
      return nonEmpty(r.included);
    case 'Discriminator:1':
      return nonEmpty(r.propertyMembers) || nonEmpty(r.subregionNonMembers) || nonEmpty(r.categoryEnumerationMembers);
    case 'Magnitude:1':
      return nonEmpty(r.order);
    case 'Purpose:1':
      return nonEmpty(r.survivors);
    default:
      return true;
  }
}

export function isMembershipPartitioned(
  namedSet: NamedSetResult | null,
  discriminator: DiscriminatorResult | null,
): boolean {
  return Boolean(
    (namedSet?.ok && namedSet.included.length > 0)
    || (discriminator?.ok && discriminator.propertyMembers.length > 0),
  );
}

// D-BP154-046 FIX 2, EXTRACTED (not duplicated) so script_bridge.ts's own upstream skip gate
// (step_skip.ts) can apply the SAME substantive-frame requirement BEFORE Magnitude:1 runs, not
// only after it already spent a live query -- see this function's own original inline comment
// (now here) for the full qualifier-2 reasoning. `null` (never a guess) when HumanNuance:1 did
// not run/failed, or found no augmentation deltas to check against.
// D-BP154-057, BLOCKER 2 -- CORRECTED, THE COORDINATOR'S OWN RULING (disclosed to the Founder, not
// itself a Founder ruling): "the substantive-frame check requires every option to be ACCOUNTED
// FOR, not ELIMINATED. An option is accounted for when it carries an explicit disposition with its
// basis -- OUT_OF_FRAME, STATED_MEMBER, STATED_NONMEMBER, NOT_COMPARABLE, or
// RETAINED-as-comparable-candidate. An option with no disposition at all still makes the frame
// non-substantive." LIVE-DIAGNOSED (this ticket, qid 98): the original ELIMINATED-only check
// correctly caught the Arctic-Circle-on-a-hollow-frame defect (an option with NO disposition at
// all) but over-reached into requiring every augmentation addition be REMOVED -- the Founder's own
// proof legitimately RETAINS North Africa as a final comparable candidate (BoundaryStability:1's
// own `confirmedStable`), which is an explicit, sourced disposition, not silence.
export function isCategoryFrameSubstantive(
  // Structurally typed to `{ letter: string }` (not the full TerminatorEliminationEntry) so
  // step_skip.ts's own upstream call (which has no `name`/`sourceStep`/`reason`/`span` to hand in
  // before Magnitude:1 has even run) can build a minimal letter-only array and still call this
  // SAME function -- one definition, reused, never a second one that could drift.
  eliminated: Array<{ letter: string }>,
  humanNuance: HumanNuanceResult | null,
  // D-BP154-057, ADDITIVE/OPTIONAL -- defaults to an empty set so every pre-existing call site
  // (this file's own tests) compiles and behaves identically when omitted. Letters with an
  // EXPLICIT "confirmed retained as a comparable candidate" disposition -- Unitary:1's own
  // `confirmedUnitary`, BoundaryStability:1's own `confirmedStable` -- a source directly and
  // verifiably stated this option belongs in the comparable pool, never a default/silent survival
  // (silence stays uncaught, exactly as it always has).
  confirmedRetained: ReadonlySet<string> = new Set(),
): { substantive: boolean; uncaught: string[] } | null {
  if (!humanNuance?.ok || humanNuance.nonParticipants.length === 0) return null;
  const eliminatedLetters = new Set(eliminated.map((e) => e.letter));
  const uncaught = humanNuance.nonParticipants.filter((L) => !eliminatedLetters.has(L) && !confirmedRetained.has(L));
  return { substantive: uncaught.length === 0, uncaught };
}

// D-BP154-052/BISHOP-SEG/S52/seg-wiregate, NEW -- THE LIVE CALL. D-BP154-060/FD-BP154-22,
// REWRITTEN: every option in the FRAME (OPT) is now a same-relevant-type peer for THIS gate's own
// procedural check, not only the ones Unitary:1 happened to classify. Necessary correction: under
// the retired outcome-cardinality reading, an option Unitary:1 never addressed at all stayed
// unknownCandidate() ('unknown' entityType), and sameRelevantType() correctly refuses to compare
// two 'unknown'-typed candidates -- which meant a genuinely UNANSWERED peer was invisible to the
// check, exactly the loophole that would let the Central Asia manoeuvre's own shape (ask ONE
// option, never mention its peers at all) slip through undetected. The FRAME ITSELF is what
// establishes peer scope for "was the identical question asked of every candidate" (Unitary:1's own
// query is addressed to every lettered option in the frame by construction) -- this is a scope
// decision, never a substantive claim about what any option actually IS (spec's own "never infer
// entityType from surface words alone" governs SUBSTANTIVE typing elsewhere in this file, e.g.
// checkBoundaryStabilityUniformity()'s own `boundary.status`; it does not govern which candidates
// this PROCEDURAL check is entitled to ask "were you addressed?" about). `entityTypeEvidence`
// stays span-sourced and null for anything Unitary:1 never actually classified -- only the PEER
// GROUPING widened, not what is asserted about any one candidate. */
function buildComparabilityCandidates(OPT: Record<string, string>, unitary: UnitaryResult | null): Candidate[] {
  const candidates = new Map<string, Candidate>();
  for (const L of Object.keys(OPT)) {
    candidates.set(L, {
      optionId: L, observedLabel: OPT[L], entityType: 'statistical_macroregion', entityTypeEvidence: null,
      aggregationLevel: 'unknown', populationStatus: 'unknown', boundary: { status: 'unresolved' },
    });
  }
  if (unitary?.ok) {
    for (const e of [...unitary.excluded, ...unitary.confirmedUnitary]) {
      const prior = candidates.get(e.letter);
      candidates.set(e.letter, {
        optionId: e.letter,
        observedLabel: e.name,
        entityType: 'statistical_macroregion',
        entityTypeEvidence: { text: e.span, via: 'Unitary:1' },
        aggregationLevel: 'unknown',
        populationStatus: 'unknown',
        boundary: prior?.boundary ?? { status: 'unresolved' },
      });
    }
  }
  return [...candidates.values()];
}

/** D-BP154-052, NEW, EXPORTED (unit-testable independent of a live run). Reported on every
 *  TerminatorResult once `eliminated`/`contradiction` are computed (below); this is the field a
 *  live receipt shows to prove the comparability gate's own mechanism, not this file's comment,
 *  decided the run. D-BP154-060/FD-BP154-22, REWRITTEN: `discriminating` now answers "was the
 *  identical question asked of every same-relevant-type peer, sourced and span-verified, none
 *  exempted or inferred" -- never "did the rule's own outcome happen to strike more than one
 *  peer" (that reading was a bug, RETIRED this ruling; comparability_gate.ts's own header carries
 *  the full text). */
export interface ComparabilityGateCheck {
  /** false when the feeder step did not run, stated nothing to check, or every stated candidate
   *  had no known same-relevant-type peer to test against -- UNTESTED, per spec's own "if any part
   *  is missing, the only valid action is UNRESOLVED", never asserted discriminating OR
   *  non-discriminating in that case. */
  ran: boolean;
  ruleChecked: string;
  /** null only when `ran` is false. true: every same-relevant-type peer was individually asked
   *  and answered this run -- procedurally fair, regardless of what any answer said. false:
   *  REJECTED -- at least one same-relevant-type peer was never individually, sourcedly asked/
   *  answered (exempted or inferred) -- a procedural failure, the exact Central Asia manoeuvre
   *  shape. */
  discriminating: boolean | null;
  /** FD-BP154-22, RENAMED from `wouldAlsoRemove`. Every same-relevant-type peer that was NOT
   *  individually asked and given a sourced, span-verified answer this run -- empty unless
   *  `discriminating` is false. Never populated by which peers the rule's own outcome would ALSO
   *  have struck; that question is retired. */
  unanswered: string[];
  note: string;
}

/** THE LIVE CALL. checkUniformPredicate() (comparability_gate.ts) is invoked once per option
 *  Unitary:1 stated is a conglomerate, against the FULL candidate pool this run actually built --
 *  never a fixture, never a hardcoded pair. Symmetric and letter-blind (FD-BP153-06): every
 *  Unitary-stated composite option is tried as `target` in turn. D-BP154-060/FD-BP154-22: `answered`
 *  is true for a peer iff Unitary:1 gave it EITHER a span-verified `excluded` (composite) OR
 *  `confirmedUnitary` (single) entry -- i.e. it was individually asked and its answer was sourced,
 *  regardless of WHICH way that answer went. A peer in neither array was never answered (silent,
 *  exempted, or discarded on verification) -- exactly the procedural gap the Central Asia manoeuvre
 *  exploited. */
export function checkCompositenessUniformity(
  OPT: Record<string, string>, unitary: UnitaryResult | null,
): ComparabilityGateCheck {
  const ruleChecked = 'composite/conglomerate (Unitary:1) excludes an option from the region category';
  if (!unitary?.ok || unitary.excluded.length === 0) {
    return {
      ran: false, ruleChecked, discriminating: null, unanswered: [],
      note: 'Unitary:1 did not run/failed, or stated no option is a conglomerate this run -- nothing to check',
    };
  }
  const pool = buildComparabilityCandidates(OPT, unitary);
  const compositeSet = new Set(unitary.excluded.map((e) => e.letter));
  const confirmedSet = new Set(unitary.confirmedUnitary.map((e) => e.letter));
  // D-BP154-060/FD-BP154-22: "answered" -- individually asked AND sourced -- never "would this
  // rule also eliminate it". A peer stated composite OR confirmed single-unitary was answered
  // either way; only silence/omission counts as unanswered.
  const answered = (c: Candidate) => compositeSet.has(c.optionId) || confirmedSet.has(c.optionId);
  const unanswered = new Set<string>();
  let anyChecked = false;
  let discriminating = true;
  for (const target of pool) {
    if (!compositeSet.has(target.optionId)) continue;
    anyChecked = true;
    const check = checkUniformPredicate(target, pool, answered);
    if (!check.discriminating) {
      discriminating = false;
      for (const L of check.unanswered) unanswered.add(L);
    }
  }
  if (!anyChecked) {
    return {
      ran: false, ruleChecked, discriminating: null, unanswered: [],
      note: 'no Unitary-stated composite option had a known same-relevant-type peer to test uniformity against',
    };
  }
  return {
    ran: true, ruleChecked, discriminating, unanswered: [...unanswered],
    note: discriminating
      ? 'PROCEDURALLY FAIR this run -- every same-relevant-type peer was individually asked and given a '
        + 'sourced, verified answer by Unitary:1; still NOT folded into `eliminated` (D-BP154-050: a '
        + 'compositeness finding alone never removes an option without a Founder decision to re-enable it) '
        + '-- reported, not acted on'
      : `REJECTED as non-discriminating -- ${unanswered.size ? [...unanswered].join(', ') : '(unlisted)'} `
        + 'was/were never individually asked and given a sourced, span-verified answer this run (FD-BP154-22: '
        + '"uniformity is procedure") -- this is WHY Unitary:1 does not eliminate, computed this run, not '
        + 'asserted by this file\'s own say-so',
  };
}

// D-BP154-053/BISHOP-SEG/S52/seg-wiregate, NEW -- THE SECOND LIVE CALL, THE ACCEPTING CASE. The
// Founder's own sourced proof (PROOF_QID98_TEST_AWARE_ELIMINATION_BP154.md): "the valid
// discriminator is boundary stability, not compositeness... this PASSES checkUniformPredicate() --
// it distinguishes on a property the candidates genuinely differ on, rather than one they all
// share." Same candidate-pool construction as buildComparabilityCandidates() above (every option
// BoundaryStability:1 adjudicated gets entityType 'statistical_macroregion' -- the same
// "same-relevant-type" bucket the compositeness check uses, so the two rules are tested against
// the SAME peer group), but here `answered` reads whether BoundaryStability:1 gave the peer ANY
// sourced classification (fixed, unstable, or insufficiently-enumerated) -- D-BP154-060/FD-BP154-22,
// "uniformity is procedure". Unlike
// checkCompositenessUniformity(), a boundary-stability rule this function finds DISCRIMINATING is
// what LICENSES folding it into `eliminated` (below, in deriveTerminatorEliminations()) -- the
// live, data-driven difference between a rule the gate rejects and one it accepts.
// D-BP154-060/FD-BP154-22, REWRITTEN -- same correction as buildComparabilityCandidates() above:
// every option in the FRAME is a same-relevant-type peer for THIS gate's procedural check, not
// only the ones BoundaryStability:1 happened to classify; see that function's own header for the
// full reasoning (an unaddressed option must be VISIBLE to the check as unanswered, never invisible
// because it never received a real entityType).
function buildBoundaryCandidates(OPT: Record<string, string>, boundary: BoundaryResult | null): Candidate[] {
  const candidates = new Map<string, Candidate>();
  for (const L of Object.keys(OPT)) {
    candidates.set(L, {
      optionId: L, observedLabel: OPT[L], entityType: 'statistical_macroregion', entityTypeEvidence: null,
      aggregationLevel: 'unknown', populationStatus: 'unknown', boundary: { status: 'unresolved' },
    });
  }
  if (boundary?.ok) {
    for (const e of boundary.confirmedStable) {
      candidates.set(e.letter, {
        optionId: e.letter,
        observedLabel: e.name,
        entityType: 'statistical_macroregion',
        entityTypeEvidence: { text: e.span, via: 'BoundaryStability:1' },
        aggregationLevel: 'unknown',
        populationStatus: 'unknown',
        boundary: { status: 'fixed', evidence: { text: e.span, via: 'BoundaryStability:1' } },
      });
    }
    for (const e of boundary.unstable) {
      candidates.set(e.letter, {
        optionId: e.letter,
        observedLabel: e.name,
        entityType: 'statistical_macroregion',
        entityTypeEvidence: { text: e.span, via: 'BoundaryStability:1' },
        aggregationLevel: 'unknown',
        populationStatus: 'unknown',
        boundary: { status: 'unresolved', evidence: { text: e.span, via: 'BoundaryStability:1' } },
      });
    }
  }
  return [...candidates.values()];
}

/** THE LIVE CALL, ACCEPTING CASE. checkUniformPredicate() invoked once per option
 *  BoundaryStability:1 stated has a materially variable boundary, against the full candidate pool
 *  this run actually built. A candidate whose boundary is 'unresolved' or 'source_defined' (never
 *  affirmatively confirmed 'fixed' this run) is what the rule removes; if it would ALSO remove a
 *  same-relevant-type peer BoundaryStability:1 itself confirmed 'fixed' (or another unstable
 *  option, trivially, which never happens since only unstable candidates are tested as targets),
 *  the rule is REJECTED exactly as the compositeness rule is -- this function does not assume
 *  acceptance, it computes it, so a run where BoundaryStability:1 fails to distinguish (e.g. it
 *  calls every M49-style option variable) is caught the same mechanical way. */
export function checkBoundaryStabilityUniformity(
  OPT: Record<string, string>, boundary: BoundaryResult | null,
): ComparabilityGateCheck {
  const ruleChecked = 'boundary/definition not fixed by the item (BoundaryStability:1) excludes an option from the final aggregate comparison';
  if (!boundary?.ok || boundary.unstable.length === 0) {
    return {
      ran: false, ruleChecked, discriminating: null, unanswered: [],
      note: 'BoundaryStability:1 did not run/failed, or stated no option has a materially variable boundary this run -- nothing to check',
    };
  }
  const pool = buildBoundaryCandidates(OPT, boundary);
  const unstableSet = new Set(boundary.unstable.map((e) => e.letter));
  // D-BP154-060/FD-BP154-22: "answered" -- individually asked AND sourced -- never "would this
  // rule also eliminate it". `insufficientEnumeration` entries WERE individually asked and given a
  // sourced, span-verified answer (they just did not name enough rivals to trigger elimination) --
  // they count as answered, exactly like `unstable`/`confirmedStable`. Only silence
  // (`notAddressed`) is unanswered.
  const answeredSet = new Set<string>([
    ...boundary.unstable.map((e) => e.letter),
    ...boundary.confirmedStable.map((e) => e.letter),
    ...boundary.insufficientEnumeration.map((e) => e.letter),
  ]);
  const answered = (c: Candidate) => answeredSet.has(c.optionId);
  const unanswered = new Set<string>();
  let anyChecked = false;
  let discriminating = true;
  for (const target of pool) {
    if (!unstableSet.has(target.optionId)) continue;
    anyChecked = true;
    const check = checkUniformPredicate(target, pool, answered);
    if (!check.discriminating) {
      discriminating = false;
      for (const L of check.unanswered) unanswered.add(L);
    }
  }
  if (!anyChecked) {
    return {
      ran: false, ruleChecked, discriminating: null, unanswered: [],
      note: 'no BoundaryStability-stated variable-boundary option had a known same-relevant-type peer to test uniformity against',
    };
  }
  return {
    ran: true, ruleChecked, discriminating, unanswered: [...unanswered],
    note: discriminating
      ? 'ACCEPTED -- every same-relevant-type peer was individually asked (the identical enumerable question, '
        + 'D-BP154-058) and given a sourced, span-verified answer this run (FD-BP154-22: "uniformity is '
        + 'procedure") -- this is WHY BoundaryStability:1 DOES eliminate (unlike a REJECTED rule), computed '
        + 'this run, not asserted by this file\'s own say-so'
      : `REJECTED as non-discriminating -- ${unanswered.size ? [...unanswered].join(', ') : '(unlisted)'} `
        + 'was/were never individually asked and given a sourced, span-verified answer this run -- withheld '
        + 'exactly like a procedurally-rejected compositeness finding',
  };
}

// D-BP154-056/BISHOP-SEG/S52/seg-wiregate, NEW -- THE THIRD LIVE CALL. LIVE-MEASURED this ticket
// (qid 98, D-BP154-055 receipt, LIANA_COMPOSER_RUN acquisitionId 2026-08-15T03-33-52-578Z_14568):
// Discriminator:1's OWN `subregionNonMembers` mechanism (D-BP154-026, pre-existing, this file's own
// header above) reproduces the EXACT SAME category error the comparability gate exists to catch --
// a real live passage stated "South America, along with South Asia, North Africa, and Central
// Asia, is a subregion located within a larger macro world region" and D-BP154-026's own logic
// eliminated ALL FOUR uniformly, contradicting Discriminator's OWN enumeration probe (which had
// separately affirmed South America a member) and forcing an honest ABSTAIN. The uniform
// application is not itself a defect (FD-BP153-06 -- it did not selectively pick Central Asia); the
// defect is that "subregion of a larger region" is being read as a MEMBERSHIP-EXCLUDING fact at
// all, exactly `composite(x) => not-T(x)` under a different name (spec's own error type 4,
// "aggregate/atomic confusion"). checkUniformPredicate() is the SAME mechanism
// checkCompositenessUniformity()/checkBoundaryStabilityUniformity() already use, applied a THIRD
// time to this THIRD source -- symmetric, letter-blind, computed live from whatever THIS run's own
// Discriminator:1 returned, never assumed.
// D-BP154-060/FD-BP154-22, REWRITTEN -- same peer-scope correction as buildComparabilityCandidates()/
// buildBoundaryCandidates() above (every option in the FRAME is a same-relevant-type peer for this
// gate's own procedural check). Combined with this file's own "HONEST LIMITATION" note just below
// (no independent "confirmed not a subdivision" array exists), this widening means the subregion
// gate will now almost always find unaddressed peers and REJECT -- which is the correct, honest,
// conservative outcome given the data gap, not a defect: a rule this file cannot verify was fairly
// asked of every peer must not be trusted to eliminate anyone.
function buildSubregionCandidates(OPT: Record<string, string>, discriminator: DiscriminatorResult | null): Candidate[] {
  const candidates = new Map<string, Candidate>();
  for (const L of Object.keys(OPT)) {
    candidates.set(L, {
      optionId: L, observedLabel: OPT[L], entityType: 'statistical_macroregion', entityTypeEvidence: null,
      aggregationLevel: 'unknown', populationStatus: 'unknown', boundary: { status: 'unresolved' },
    });
  }
  if (discriminator?.ok) {
    for (const e of discriminator.subregionNonMembers) {
      candidates.set(e.letter, {
        optionId: e.letter, observedLabel: e.name, entityType: 'statistical_macroregion',
        entityTypeEvidence: { text: e.span, via: 'Discriminator:1' }, aggregationLevel: 'unknown',
        populationStatus: 'unknown', boundary: { status: 'unresolved' },
      });
    }
    // Same-relevant-type peers: options Discriminator:1's OWN enumeration affirmatively named as
    // members of the category -- these are the candidates a uniform "subregion" rule must NOT also
    // remove for the rule to survive as discriminating (e.g. live-measured this ticket: the
    // enumeration affirmed South America a member while the subregion probe removed it too).
    for (const e of discriminator.categoryEnumerationMembers) {
      if (candidates.get(e.letter)?.entityTypeEvidence !== null) continue; // already given a real evidence span above
      candidates.set(e.letter, {
        optionId: e.letter, observedLabel: e.name, entityType: 'statistical_macroregion',
        entityTypeEvidence: { text: e.span, via: 'Discriminator:1' }, aggregationLevel: 'unknown',
        populationStatus: 'unknown', boundary: { status: 'unresolved' },
      });
    }
  }
  return [...candidates.values()];
}

// D-BP154-060/FD-BP154-22, HONEST LIMITATION, DOCUMENTED RATHER THAN PAPERED OVER: unlike
// compositeness (Unitary:1's own TWO independent arrays, `excluded`/`confirmedUnitary`) and
// boundary (BoundaryStability:1's own THREE, `unstable`/`confirmedStable`/`insufficientEnumeration`),
// Discriminator:1's own SUBREGION sub-question (D-BP154-026) has no companion "confirmed NOT a
// subdivision" array -- only `subregionNonMembers`, a one-directional positive claim. This file
// cannot currently tell "this peer was individually asked and said no" apart from "this peer was
// never asked at all" for that specific sub-question -- clause (1)/(3) of FD-BP154-22's own test
// ("the identical question was asked of every candidate... no option exempted") is NOT
// independently verifiable here with today's data. Until discriminator_step.ts gains a matching
// "confirmed not a subdivision" array, `answered` below is necessarily the SAME set-membership
// proxy the retired cardinality reading used -- reported honestly as a data gap in `note`, never
// silently treated as a genuine procedural verification.
export function checkSubregionUniformity(
  OPT: Record<string, string>, discriminator: DiscriminatorResult | null,
): ComparabilityGateCheck {
  const ruleChecked = 'subregion of a larger region (Discriminator:1) excludes an option from the category in its own right';
  if (!discriminator?.ok || discriminator.subregionNonMembers.length === 0) {
    return {
      ran: false, ruleChecked, discriminating: null, unanswered: [],
      note: 'Discriminator:1 did not run/failed, or stated no option is a subregion-not-in-its-own-right this run -- nothing to check',
    };
  }
  const pool = buildSubregionCandidates(OPT, discriminator);
  const subregionSet = new Set(discriminator.subregionNonMembers.map((e) => e.letter));
  // HONEST LIMITATION (this function's own header, above): no independent "confirmed NOT a
  // subdivision" array exists yet, so `answered` cannot distinguish "asked, said no" from "never
  // asked" for any peer outside `subregionNonMembers` itself.
  const answered = (c: Candidate) => subregionSet.has(c.optionId);
  const unanswered = new Set<string>();
  let anyChecked = false;
  let discriminating = true;
  for (const target of pool) {
    if (!subregionSet.has(target.optionId)) continue;
    anyChecked = true;
    const check = checkUniformPredicate(target, pool, answered);
    if (!check.discriminating) {
      discriminating = false;
      for (const L of check.unanswered) unanswered.add(L);
    }
  }
  if (!anyChecked) {
    return {
      ran: false, ruleChecked, discriminating: null, unanswered: [],
      note: 'no Discriminator-stated subregion-non-member option had a known same-relevant-type peer to test uniformity against',
    };
  }
  return {
    ran: true, ruleChecked, discriminating, unanswered: [...unanswered],
    note: discriminating
      ? 'no OTHER same-relevant-type peer was ALSO flagged a subregion-non-member this run -- but see this '
        + 'function\'s own header: discriminator_step.ts has no independent "confirmed not a subdivision" '
        + 'array, so peer coverage (clause 1/3 of FD-BP154-22) is NOT independently verified here, only the '
        + 'absence of a second flagged peer'
      : `REJECTED -- ${unanswered.size ? [...unanswered].join(', ') : '(unlisted)'} was/were ALSO flagged a `
        + 'subregion-non-member this run by the identical sub-question -- withheld, never folded into '
        + '`eliminated` (peer-coverage caveat above still applies: this gate cannot yet distinguish a '
        + 'genuinely fair-but-multi-hit question from an unasked peer)',
  };
}

function summaryLine(OPT: Record<string, string>, r: TerminatorResult): string {
  if (!r.ok) return `TERMINATOR: FAILED -- ${r.error}`;
  const elimText = r.eliminated.length
    ? r.eliminated.map((e) => `${e.letter}) ${e.name} [${e.sourceStep}: ${e.reason} -- "${e.span}"]`).join('  |  ')
    : '(none)';
  // D-BP154-024/BISHOP-SEG/S24/seg-unstated -- reported on EVERY outcome (verdict or abstain), so
  // a silently-failing matcher shows up as a pile of UNSTATED counts even on a run that still
  // reaches a verdict via other evidence.
  const bucketsNote = r.frameMatchBuckets
    ? `  ||  FRAME MATCH: affirmed-non-member=${r.frameMatchBuckets.affirmedNonMember.length} `
      + `(${r.frameMatchBuckets.affirmedNonMember.join(', ') || 'none'}), `
      + `affirmed-member=${r.frameMatchBuckets.affirmedMember.length} `
      + `(${r.frameMatchBuckets.affirmedMember.join(', ') || 'none'}), `
      + `unstated=${r.frameMatchBuckets.unstated.length} (${r.frameMatchBuckets.unstated.join(', ') || 'none'})`
    : '';
  // D-BP154-028/BISHOP-SEG/S28/seg-survivable FIX. Founder's own rule: "the verdict basis must
  // state which steps FAILED, not merely which eliminations happened... an ABSTAIN from an
  // incomplete run is a different animal from an ABSTAIN with all steps green, and today they look
  // identical." Reported on EVERY outcome now (previously only the multi-survivor ABSTAIN branch
  // named step status, and only informally, inline in `abstainReason` -- a VERDICT reached while a
  // feeder step failed said nothing about it at all). `incomplete` is the SAME field
  // deriveTerminatorEliminations()'s caller already computes (anyStepFailed(stepsConsulted)) --
  // read here, never recomputed, so this text can never disagree with the structured field.
  const stepsNote = (Object.entries(r.stepsConsulted) as Array<[string, string]>)
    .map(([id, status]) => `${id}: ${status}`).join(', ');
  const completenessNote = r.incomplete
    ? `  ||  RUN INCOMPLETE -- ${Object.entries(r.stepsConsulted).filter(([, s]) => s === 'failed').map(([id]) => id).join(', ')} FAILED (steps consulted: ${stepsNote})`
    : `  ||  run complete -- all consulted steps green (steps consulted: ${stepsNote})`;
  // D-BP154-041 PART 2/3: INSUFFICIENT EVIDENCE is reported as its OWN labeled line, ahead of the
  // generic ABSTAIN line -- FD-BP154-17's own "a distinct outcome from ABSTAIN and from a wrong
  // answer" must be visible in the transcript, not just in the structured field.
  // D-BP154-055/BISHOP-SEG/S52/seg-wiregate -- BOTH SUFFICIENCY RESULTS, IN THE RECEIPT. Coordinator,
  // verbatim: "Both are true and the receipt should carry both... it must not be erased by a clean
  // result over the filtered set." Reported on every outcome where either was computed (i.e.
  // whenever Purpose:1 ran ok), not only when the run actually withholds on it.
  const sufficiencyNote = (r.sufficiencyRaw || r.sufficiencyPostFilter)
    ? `  ||  SUFFICIENCY -- RAW (against all ${Object.keys(OPT).length} option(s), the item as shipped): `
      + `${r.sufficiencyRaw ? (r.sufficiencyRaw.sufficient ? 'SUFFICIENT' : 'INSUFFICIENT') : 'not computed'}`
      + (r.sufficiencyRaw ? ` -- ${r.sufficiencyRaw.reason}` : '')
      + `  ||  SUFFICIENCY -- POST-FILTER (against the comparable candidate set, after admissibility `
      + `filtering): ${r.sufficiencyPostFilter ? (r.sufficiencyPostFilter.sufficient ? 'SUFFICIENT' : 'INSUFFICIENT') : 'not computed'}`
      + (r.sufficiencyPostFilter ? ` -- ${r.sufficiencyPostFilter.reason}` : '')
    : '';
  if (r.insufficientEvidence) {
    return `TERMINATOR -- INSUFFICIENT EVIDENCE (${r.insufficientEvidence.preconditionId}, policy v`
      + `${r.insufficientEvidence.policyVersion}): ${r.insufficientEvidence.reason}${completenessNote}${sufficiencyNote}`;
  }
  // D-BP154-052/BISHOP-SEG/S52/seg-wiregate -- THE GATE'S OWN DECISION, IN THE RECEIPT. Reported
  // whenever it ran (undefined only on the two early failure returns before Unitary:1 is read).
  const comparabilityGateNote = r.comparabilityGate?.ran
    ? `  ||  COMPARABILITY GATE (checkUniformPredicate, live): ${r.comparabilityGate.ruleChecked} -- `
      + `${r.comparabilityGate.discriminating ? 'DISCRIMINATING' : 'REJECTED'} -- ${r.comparabilityGate.note}`
    : r.comparabilityGate
      ? `  ||  COMPARABILITY GATE: not run this pass -- ${r.comparabilityGate.note}`
      : '';
  // D-BP154-053 -- THE ACCEPTING GATE'S OWN DECISION, IN THE RECEIPT.
  const boundaryGateNote = r.boundaryGate?.ran
    ? `  ||  BOUNDARY GATE (checkUniformPredicate, live): ${r.boundaryGate.ruleChecked} -- `
      + `${r.boundaryGate.discriminating ? 'ACCEPTED' : 'REJECTED'} -- ${r.boundaryGate.note}`
    : r.boundaryGate
      ? `  ||  BOUNDARY GATE: not run this pass -- ${r.boundaryGate.note}`
      : '';
  // D-BP154-056 -- THE THIRD GATE'S OWN DECISION, IN THE RECEIPT.
  const subregionGateNote = r.subregionGate?.ran
    ? `  ||  SUBREGION GATE (checkUniformPredicate, live): ${r.subregionGate.ruleChecked} -- `
      + `${r.subregionGate.discriminating ? 'DISCRIMINATING' : 'REJECTED'} -- ${r.subregionGate.note}`
    : r.subregionGate
      ? `  ||  SUBREGION GATE: not run this pass -- ${r.subregionGate.note}`
      : '';
  if (r.abstain) {
    return `TERMINATOR -- ABSTAIN: ${r.abstainReason}  ||  ELIMINATED: ${elimText}  ||  SURVIVORS: ${r.survivors.join(', ') || '(none)'}${bucketsNote}${completenessNote}${comparabilityGateNote}${boundaryGateNote}${subregionGateNote}${sufficiencyNote}`;
  }
  const magnitudeNote = r.magnitudeBasis
    ? `  ||  MAGNITUDE BASIS: target=${r.magnitudeBasis.targetExtreme} of "${r.magnitudeBasis.property}" -- "${r.magnitudeBasis.span}"`
    : '';
  return `TERMINATOR -- VERDICT ${r.verdict}) ${r.verdictName}  ||  ELIMINATED: ${elimText}${magnitudeNote}${bucketsNote}${completenessNote}${comparabilityGateNote}${boundaryGateNote}${subregionGateNote}${sufficiencyNote}`;
}

/** THE ONE PLACE the feeder steps' results become eliminations. Pure, synchronous, no I/O --
 *  unit-testable without a live Ollama/browser (unlike the feeder steps themselves). D-BP154-033,
 *  ADDITIVE: `humanNuance` is a fifth, OPTIONAL parameter (defaults to `undefined` when a caller
 *  does not pass one) -- every pre-existing 3/4-arg call site (this file's own tests,
 *  magnitude_step.ts's runMagnitudeStep()) keeps compiling and behaving byte-identically; only a
 *  caller that explicitly passes a HumanNuanceResult gets the new elimination source. */
export function deriveTerminatorEliminations(
  OPT: Record<string, string>,
  softballs: SoftballsResult | null,
  namedSet: NamedSetResult | null,
  discriminator: DiscriminatorResult | null,
  humanNuance?: HumanNuanceResult | null,
  // D-BP154-043, ADDITIVE/OPTIONAL -- undefined on every pre-existing call site (this file's own
  // tests, magnitude_step.ts's runMagnitudeStep()), same discipline `humanNuance` above already
  // established: every existing caller keeps compiling and behaving byte-identically.
  unitary?: UnitaryResult | null,
  // D-BP154-053, ADDITIVE/OPTIONAL -- same discipline as `unitary` above: undefined on every
  // pre-existing call site, every existing caller keeps compiling and behaving byte-identically.
  boundaryStability?: BoundaryResult | null,
): {
  eliminated: TerminatorEliminationEntry[]; contradiction: TerminatorContradiction | null;
  boundaryGate: ComparabilityGateCheck; subregionGate: ComparabilityGateCheck;
} {
  const eliminated: TerminatorEliminationEntry[] = [];
  const excludedBySoftballs = new Map<string, { name: string; span: string }>();
  if (softballs?.ok) {
    for (const e of softballs.excluded) {
      excludedBySoftballs.set(e.letter, { name: e.name, span: e.span });
      // D-BP154-050 FIX. Spec's own exclusion-reason taxonomy: "Never emit 'not a world region'
      // where the actual conclusion is 'outside this run's target entity class.'" A source stating
      // an option is "not a world region" is a statement about admissibility under THIS question's
      // own target category, never a claim the option lacks population or does not exist as a
      // place (both would be false as stated for a biome/desert/latitude line, which DO have
      // populations and DO have definable boundaries) -- the verbatim span (the source's own
      // words) is unchanged and still fully quoted; only this file's OWN reason text is narrowed.
      eliminated.push({
        letter: e.letter, name: e.name, sourceStep: 'Softballs:1',
        reason: 'source states this option falls outside the category this question names -- an '
          + 'admissibility finding under this run\'s own target category, not a claim the option '
          + 'has no population or is not a real place',
        span: e.span,
      });
    }
  }
  const includedByNamedSet = new Map<string, { name: string; span: string }>();
  if (namedSet?.ok) {
    for (const e of namedSet.included) {
      includedByNamedSet.set(e.letter, { name: e.name, span: e.span });
      eliminated.push({
        letter: e.letter, name: e.name, sourceStep: 'NamedSet:1',
        reason: `source states this IS the superlative property (a member, not the odd one out)`, span: e.span,
      });
    }
  }
  // D-BP154-033/BISHOP-SEG/S30-continuation/seg-wire-humannuance, ADDITIVE. HumanNuance:1's own
  // `excluded` array (human_nuance_step.ts) is an AFFIRMATIVE denial of the SAME shape Softballs'
  // own `excluded` already is: a source explicitly stated a REASON this option does not belong to
  // the origin's own (pre-augmentation) frame -- e.g. "sparsely settled", the Founder's own worked
  // example (FD-BP154-07a). Symmetric across every option (FD-BP153-06); no letter is favored, and
  // this reads only HumanNuanceResult.excluded -- never `frame`/`nonParticipants` (a non-participant
  // with NO stated reason is UNRESOLVED, per that file's own law, and is never eliminated here).
  const excludedByHumanNuance = new Map<string, { name: string; reason: string; span: string }>();
  if (humanNuance?.ok) {
    for (const e of humanNuance.excluded) {
      excludedByHumanNuance.set(e.letter, { name: e.name, reason: e.reason, span: e.span });
      eliminated.push({
        letter: e.letter, name: e.name, sourceStep: 'HumanNuance:1',
        reason: `source states this is excluded from the origin's own frame (${e.reason})`, span: e.span,
      });
    }
  }
  // D-BP154-050/BISHOP-SEG/S50/seg-comparability, WITHDRAWN AS AN ELIMINATOR. Founder's own spec
  // (SPEC_COMPARABILITY_GATE_BP154.md/SPEC_CATEGORY_ERROR_TAXONOMY_BP154.md): "Central Asia is a
  // group of countries" does NOT imply "Central Asia is not a world region" -- UN M49 assigns
  // region codes to South America (005), Northern Africa (015), AND Central Asia (143) alike; all
  // three are territorial aggregations. `composite(x) => not-T(x)` is unsound unless the target
  // class explicitly requires atomic entities, and even then must apply uniformly to EVERY option
  // -- comparability_gate.ts's own checkUniformPredicate() is the executable form of that check,
  // and applying it here would reject "conglomerate" as a discriminator outright (it fires on
  // South America and North Africa exactly as it fires on Central Asia under any M49-style frame).
  // D-BP154-045's own "ask Unitary per-option to catch Central Asia specifically" was, in the
  // Founder's own later words, "outcome engineering... the premise was selected because it
  // produces the rankable pair {A, C} that yields A, not because a criterion independently
  // distinguishes F." Unitary:1 STILL RUNS and STILL RECORDS what a source states
  // (unitary.excluded/confirmedUnitary remain on the result, informational) -- it no longer
  // contributes anything to `eliminated`. A compositeness finding alone never removes an option.
  void unitary; // parameter kept (its OTHER fields -- confirmedUnitary -- may be read for reporting elsewhere); no longer folded into eliminated.
  // D-BP154-053/BISHOP-SEG/S52/seg-wiregate, NEW, LIVE-GATED. THE ACCEPTING CASE the Founder's own
  // sourced proof names: unlike compositeness, a materially-variable-boundary finding folds into
  // `eliminated` -- but ONLY when checkBoundaryStabilityUniformity() (this file, above) finds the
  // rule discriminating THIS RUN, computed from whatever BoundaryStability:1 actually returned,
  // never assumed. disposition NOT_COMPARABLE (comparability_gate.ts's own exclusion-reason
  // taxonomy) -- a comparability decision, never a claim the option is not a region or lacks
  // inhabitants (spec's own words, both files).
  const boundaryGate = checkBoundaryStabilityUniformity(OPT, boundaryStability?.ok ? boundaryStability : null);
  const excludedByBoundaryStability = new Map<string, { name: string; span: string }>();
  if (boundaryStability?.ok && boundaryGate.discriminating) {
    for (const e of boundaryStability.unstable) {
      excludedByBoundaryStability.set(e.letter, { name: e.name, span: e.span });
      eliminated.push({
        letter: e.letter, name: e.name, sourceStep: 'BoundaryStability:1',
        reason: 'source states this option\'s boundary/definition is materially variable and not fixed '
          + 'by the item -- NOT_COMPARABLE to a peer whose boundary IS fixed (a comparability decision, '
          + 'never a claim this option is not a region or lacks inhabitants; checkUniformPredicate() '
          + 'accepted this rule as discriminating this run, see comparabilityGate/boundaryGate)',
        span: e.span,
      });
    }
  }
  // D-BP154-024/BISHOP-SEG/S24/seg-unstated FIX -- REMOVED, not weakened: kind-mismatch NO
  // LONGER eliminates anyone. See this file's own header for the full history (FOUR live
  // instances of the same class of defect: `ca92a439`, `d219bf2a`, `44499f3b`, and this one --
  // qid 98's own A eliminated for stating its kind as the compound "Continent / Macro-geographical
  // region" against a category-kind list containing "Continent" -- a phrasing difference, not a
  // denial, and A is GENUINELY a member of the very enumeration the SAME run obtained). THE LAW:
  // a kind that does not structurally match the category-kind list is UNSTATED, not DENIED --
  // this comparison is an INFERENCE from two separately-extracted facts, never something the
  // source directly said ("X is not the category"), and four straight defects proved that
  // inference is not reliable enough to eliminate on. discriminatorKindMatchesCategory() (this
  // file, above) is KEPT and still called -- by computeFrameMatchBuckets() below, for REPORTING
  // ("affirmedMember" visibility) only, never to eliminate. The genuine, affirmative "not the
  // category" fact remains exactly where it always correctly lived: Softballs' own direct
  // statement, above -- untouched by this fix.
  // D-BP154-021/BISHOP-SEG/S21/seg-mortgagetrap, ADDITIVE. FD-BP153-07 point 3 is about the
  // SUPERLATIVE PROPERTY, not only the bare category (Founder's own correction, D-BP154-021
  // dispatch) -- discriminator.propertyMembers (discriminator_step.ts, ADDITIVE this same
  // ticket) is what THE DISCRIMINATOR's own query states ARE the superlative property itself
  // (e.g. "the world's most densely populated regions"), asked and verified with the exact same
  // verbatim-span discipline as every other extraction in this estate. SAME semantic as NAMED
  // SET's own rule above: a stated MEMBER of the superlative property cannot be the answer to a
  // "which is NOT ..." question -- eliminated, sourced honestly to Discriminator:1 (a second,
  // independent path to the same fact NAMED SET tries to establish, not a duplicate vote -- each
  // is credited to its own step).
  const propertyMembersByDiscriminator = new Map<string, { name: string; span: string }>();
  if (discriminator?.ok) {
    for (const e of discriminator.propertyMembers) {
      propertyMembersByDiscriminator.set(e.letter, { name: e.name, span: e.span });
      eliminated.push({
        letter: e.letter, name: e.name, sourceStep: 'Discriminator:1',
        reason: `source states this IS the superlative property (a member, not the odd one out)`, span: e.span,
      });
    }
  }
  // D-BP154-024/BISHOP-SEG/S24/seg-unstated FIX to D-BP154-023's own D-BP154-023 build,
  // REMOVED, not weakened: absence FROM the category's own enumeration NO LONGER eliminates
  // anyone. LIVE-MEASURED the very next dispatch after D-BP154-023 landed: qid 98's own A (South
  // America) IS genuinely named in the UN-geoscheme enumeration a real run obtained ("Americas:
  // ...South America..."), but the LOCAL EXTRACTION MODEL failed to produce a verified span for
  // it (one candidate discarded), so `categoryEnumerationMembers` came back without A -- and the
  // absence-elimination rule below (as originally built) read that EXTRACTION FAILURE as "the
  // enumeration excludes A" and eliminated it. THE LAW, restated for this mechanism exactly as
  // for the kind-mismatch fix above: our own matcher failing to verify a member is UNSTATED, not
  // a stated exclusion -- "never because our matcher failed to find it" (Founder, this dispatch,
  // verbatim). A genuine enumeration being "exhaustive by its own nature" does not change this:
  // exhaustiveness is a property of what the SOURCE said, not of what OUR extraction succeeded in
  // copying from it. `discriminator.categoryEnumerationMembers` is KEPT and still computed --
  // used by computeFrameMatchBuckets() below for REPORTING ("affirmedMember" visibility, and the
  // contradiction check immediately below, which only ever reads genuine POSITIVE membership,
  // never absence) -- never to eliminate.
  const enumeratedByDiscriminator = new Map<string, { name: string; span: string }>();
  if (discriminator?.ok) {
    for (const e of discriminator.categoryEnumerationMembers) {
      enumeratedByDiscriminator.set(e.letter, { name: e.name, span: e.span });
    }
  }
  // D-BP154-026/BISHOP-SEG/S26/seg-subregion, ADDITIVE. A source explicitly stating an option is
  // NOT the category in its own right (only a subdivision WITHIN a larger region) is an
  // AFFIRMATIVE denial -- the exact same status Softballs' own `excluded` already carries (D-BP154-
  // 024's law: elimination requires the source itself to say so, never our own inference). This is
  // a genuinely different QUESTION from Softballs' ("is this the category at all?") -- Softballs
  // asks membership in the category outright; this asks whether a stated SUBREGION is the category
  // ITSELF or a part within it. Symmetric across every option (FD-BP153-06); no letter is favored.
  // D-BP154-056/BISHOP-SEG/S52/seg-wiregate, LIVE-GATED (was unconditional). THE THIRD LIVE CALL --
  // checkSubregionUniformity() (this file, above) is invoked BEFORE this rule may fold into
  // `eliminated` at all. LIVE-MEASURED this ticket: a real passage stated FOUR options (A, B, C, F)
  // uniformly as "a subregion located within a larger macro world region", contradicting the SAME
  // step's own enumeration -- exactly the non-discriminating shape this check exists to catch.
  const subregionGate = checkSubregionUniformity(OPT, discriminator?.ok ? discriminator : null);
  const subregionNonMembersByDiscriminator = new Map<string, { name: string; span: string }>();
  if (discriminator?.ok && subregionGate.discriminating) {
    for (const e of discriminator.subregionNonMembers) {
      subregionNonMembersByDiscriminator.set(e.letter, { name: e.name, span: e.span });
      eliminated.push({
        letter: e.letter, name: e.name, sourceStep: 'Discriminator:1',
        reason: `source states this is not the category in its own right (a subdivision within a larger region); `
          + 'checkUniformPredicate() accepted this rule as discriminating this run', span: e.span,
      });
    }
  }
  let contradiction: TerminatorContradiction | null = null;
  // D-BP154-026, ADDITIVE: the same three contradiction checks Softballs' own `excludedBySoftballs`
  // loop below already runs, applied to this second affirmative-denial source -- a subregion-
  // non-member fact cannot coexist with a stated superlative-property membership or a stated
  // enumeration membership for the SAME option without the two mechanisms disagreeing.
  for (const [letter, subregionFact] of subregionNonMembersByDiscriminator) {
    const namedSetFact = includedByNamedSet.get(letter);
    if (namedSetFact) {
      contradiction = {
        letter,
        reason: `DISCRIMINATOR states "${OPT[letter] ?? letter}" is not the category in its own right ("${subregionFact.span}") while `
          + `NAMED SET simultaneously states it IS the superlative property ("${namedSetFact.span}") -- `
          + `self-contradictory, not published`,
      };
      break;
    }
    const discriminatorPropertyFact = propertyMembersByDiscriminator.get(letter);
    if (discriminatorPropertyFact) {
      contradiction = {
        letter,
        reason: `DISCRIMINATOR states "${OPT[letter] ?? letter}" is not the category in its own right ("${subregionFact.span}") while `
          + `it simultaneously states this option IS the superlative property ("${discriminatorPropertyFact.span}") -- `
          + `self-contradictory, not published`,
      };
      break;
    }
    const discriminatorEnumerationFact = enumeratedByDiscriminator.get(letter);
    if (discriminatorEnumerationFact) {
      contradiction = {
        letter,
        reason: `DISCRIMINATOR states "${OPT[letter] ?? letter}" is not the category in its own right ("${subregionFact.span}") while `
          + `its own enumeration simultaneously names it as a member ("${discriminatorEnumerationFact.span}") -- `
          + `self-contradictory, not published`,
      };
      break;
    }
  }
  if (contradiction) return { eliminated, contradiction, boundaryGate, subregionGate };
  for (const [letter, softballsFact] of excludedBySoftballs) {
    const namedSetFact = includedByNamedSet.get(letter);
    if (namedSetFact) {
      contradiction = {
        letter,
        reason: `SOFTBALLS states "${OPT[letter] ?? letter}" is not the category ("${softballsFact.span}") while `
          + `NAMED SET simultaneously states it IS the superlative property ("${namedSetFact.span}") -- `
          + `self-contradictory, not published`,
      };
      break;
    }
    const discriminatorPropertyFact = propertyMembersByDiscriminator.get(letter);
    if (discriminatorPropertyFact) {
      contradiction = {
        letter,
        reason: `SOFTBALLS states "${OPT[letter] ?? letter}" is not the category ("${softballsFact.span}") while `
          + `DISCRIMINATOR simultaneously states it IS the superlative property ("${discriminatorPropertyFact.span}") -- `
          + `self-contradictory, not published`,
      };
      break;
    }
    // D-BP154-023, ADDITIVE: SOFTBALLS says "not the category" while THE DISCRIMINATOR's own
    // enumeration names the SAME option as a member of the category -- the two mechanisms cannot
    // both be right about it.
    const discriminatorEnumerationFact = enumeratedByDiscriminator.get(letter);
    if (discriminatorEnumerationFact) {
      contradiction = {
        letter,
        reason: `SOFTBALLS states "${OPT[letter] ?? letter}" is not the category ("${softballsFact.span}") while `
          + `DISCRIMINATOR's own enumeration simultaneously names it as a member ("${discriminatorEnumerationFact.span}") -- `
          + `self-contradictory, not published`,
      };
      break;
    }
  }
  if (contradiction) return { eliminated, contradiction, boundaryGate, subregionGate };
  // D-BP154-033, ADDITIVE: the SAME three contradiction checks Softballs'/the subregion source's
  // own loops above already run, applied to HumanNuance:1's own affirmative denial -- a
  // frame-excluded fact cannot coexist with a stated superlative-property membership or a stated
  // enumeration membership for the SAME option without the mechanisms disagreeing.
  for (const [letter, humanNuanceFact] of excludedByHumanNuance) {
    const namedSetFact = includedByNamedSet.get(letter);
    if (namedSetFact) {
      contradiction = {
        letter,
        reason: `HUMAN NUANCE states "${OPT[letter] ?? letter}" is excluded from the origin's own frame `
          + `("${humanNuanceFact.span}") while NAMED SET simultaneously states it IS the superlative `
          + `property ("${namedSetFact.span}") -- self-contradictory, not published`,
      };
      break;
    }
    const discriminatorPropertyFact = propertyMembersByDiscriminator.get(letter);
    if (discriminatorPropertyFact) {
      contradiction = {
        letter,
        reason: `HUMAN NUANCE states "${OPT[letter] ?? letter}" is excluded from the origin's own frame `
          + `("${humanNuanceFact.span}") while DISCRIMINATOR simultaneously states it IS the superlative `
          + `property ("${discriminatorPropertyFact.span}") -- self-contradictory, not published`,
      };
      break;
    }
    const discriminatorEnumerationFact = enumeratedByDiscriminator.get(letter);
    if (discriminatorEnumerationFact) {
      contradiction = {
        letter,
        reason: `HUMAN NUANCE states "${OPT[letter] ?? letter}" is excluded from the origin's own frame `
          + `("${humanNuanceFact.span}") while DISCRIMINATOR's own enumeration simultaneously names it `
          + `as a member ("${discriminatorEnumerationFact.span}") -- self-contradictory, not published`,
      };
      break;
    }
  }
  // D-BP154-050: Unitary:1's own contradiction checks REMOVED along with its elimination role --
  // a compositeness finding no longer participates in `eliminated` at all (see this file's own
  // header above), so it can no longer contradict anything either; keeping a dead contradiction
  // check against a Map that is never populated would be exactly the "receipt reports a step
  // green while it produced nothing" shape this ticket's own dispatch warned against.
  //
  // D-BP154-053, ADDITIVE: the SAME three contradiction checks applied to BoundaryStability:1's
  // own NOT_COMPARABLE finding -- only populated (non-empty Map) when checkBoundaryStabilityUniformity()
  // actually accepted the rule this run, so this loop is a genuine no-op (never a dead check
  // against an always-empty Map) exactly when the rule was rejected.
  for (const [letter, boundaryFact] of excludedByBoundaryStability) {
    const namedSetFact = includedByNamedSet.get(letter);
    if (namedSetFact) {
      contradiction = {
        letter,
        reason: `BOUNDARY STABILITY states "${OPT[letter] ?? letter}" has a materially variable boundary `
          + `("${boundaryFact.span}") while NAMED SET simultaneously states it IS the superlative property `
          + `("${namedSetFact.span}") -- self-contradictory, not published`,
      };
      break;
    }
    const discriminatorPropertyFact = propertyMembersByDiscriminator.get(letter);
    if (discriminatorPropertyFact) {
      contradiction = {
        letter,
        reason: `BOUNDARY STABILITY states "${OPT[letter] ?? letter}" has a materially variable boundary `
          + `("${boundaryFact.span}") while DISCRIMINATOR simultaneously states it IS the superlative `
          + `property ("${discriminatorPropertyFact.span}") -- self-contradictory, not published`,
      };
      break;
    }
  }
  return { eliminated, contradiction, boundaryGate, subregionGate };
}

export interface TerminatorFrameMatchBuckets {
  /** Options a source AFFIRMATIVELY states are NOT the category -- Softballs' own direct "not the
   *  category" statement, OR (D-BP154-026, ADDITIVE) Discriminator's own direct "not the category
   *  in its own right, only a subdivision within one" statement. Both are real denials, never an
   *  inference from a structural mismatch. This is the ONLY bucket THE FRAME's own eliminations
   *  (above) may draw on. */
  affirmedNonMember: string[];
  /** Options AFFIRMATIVELY confirmed a member of the bare CATEGORY -- Discriminator's own kind
   *  structurally matching the category-kind list, or verified as a named member of the
   *  category's own stated enumeration. (Superlative-PROPERTY membership -- NamedSet's/
   *  Discriminator's own `included`/`propertyMembers` -- is a DIFFERENT question with its own,
   *  unaffected elimination rule; it is not folded in here.) */
  affirmedMember: string[];
  /** D-BP154-024/BISHOP-SEG/S24/seg-unstated, THE WHOLE POINT OF THIS FIX: every option in
   *  neither bucket above -- a kind was stated but did not structurally match the category-kind
   *  list, OR a productive enumeration exists but never verified this option as a member, OR
   *  nothing was ever stated about this option at all. NEVER eliminated on this basis alone;
   *  these options SURVIVE into the frame exactly as if nothing had been asked (Founder, this
   *  dispatch, verbatim: "A failed match is UNSTATED, and an UNSTATED option survives... It does
   *  not get eliminated"). Reported explicitly so a silently-failing matcher shows up as a pile
   *  of UNSTATED counts, not as confident (and wrong) eliminations. */
  unstated: string[];
}

/** D-BP154-024/BISHOP-SEG/S24/seg-unstated. THE THREE-BUCKET REPORT (Founder, this dispatch,
 *  verbatim: "matched-as-member / matched-as-non-member / unmatched (unstated) -- three
 *  outcomes, not two"). Pure, synchronous, same testability discipline as
 *  deriveTerminatorEliminations() above -- deliberately a SEPARATE function (not folded into
 *  that one) so a caller can report the buckets even when `eliminated` ends up empty for other
 *  reasons, and so the REPORTING logic is visibly decoupled from the ELIMINATION logic (the
 *  actual bug this ticket fixes was exactly that coupling: a "no match" being routed straight
 *  into `eliminated` instead of into a named, honest third bucket). */
export function computeFrameMatchBuckets(
  OPT: Record<string, string>,
  softballs: SoftballsResult | null,
  discriminator: DiscriminatorResult | null,
  // D-BP154-033, ADDITIVE/OPTIONAL -- undefined on every pre-existing 3-arg call site (this file's
  // own test suite), so every existing caller keeps compiling and behaving identically.
  humanNuance?: HumanNuanceResult | null,
  // D-BP154-043, ADDITIVE/OPTIONAL -- same discipline as `humanNuance` above.
  unitary?: UnitaryResult | null,
  // D-BP154-056, ADDITIVE/OPTIONAL -- same discipline as `humanNuance`/`unitary` above. When
  // omitted (every pre-existing call site), this function behaves byte-identically to before
  // (subregionNonMembers folds in unconditionally, same as always) -- only a caller that explicitly
  // passes the live checkSubregionUniformity() result gets the gated behavior.
  subregionGate?: ComparabilityGateCheck | null,
): TerminatorFrameMatchBuckets {
  const affirmedNonMember = new Set<string>();
  if (softballs?.ok) {
    for (const e of softballs.excluded) affirmedNonMember.add(e.letter);
  }
  // D-BP154-026, ADDITIVE: the second affirmative-denial source (see deriveTerminatorEliminations()
  // above for the full ruling) -- folded into the SAME bucket as Softballs' own `excluded`, since
  // both answer the identical question ("does the source affirmatively place this option outside
  // the category?"), just via two independently-asked questions.
  //
  // D-BP154-056 FIX: gated the same way `eliminated` itself now is -- a REJECTED (non-
  // discriminating) subregion rule is not an affirmed non-member of the category either (same
  // ruling D-BP154-050 already gave Unitary:1's own `excluded`, just below); `subregionGate` being
  // omitted (undefined, every pre-existing caller) preserves the old unconditional behavior exactly.
  if (discriminator?.ok && subregionGate?.discriminating !== false) {
    for (const e of discriminator.subregionNonMembers) affirmedNonMember.add(e.letter);
  }
  // D-BP154-033, ADDITIVE: a THIRD affirmative-denial source -- HumanNuance:1's own `excluded`,
  // same bucket, same reasoning as the two above.
  if (humanNuance?.ok) {
    for (const e of humanNuance.excluded) affirmedNonMember.add(e.letter);
  }
  // D-BP154-050: Unitary:1's own `excluded` REMOVED from this bucket -- a compositeness finding is
  // not an affirmed non-member of the CATEGORY (this file's own header above states the ruling in
  // full); folding it in here would let it influence the frame-match report exactly the same way
  // it used to influence elimination, through a side door.
  const affirmedMember = new Set<string>();
  if (discriminator?.ok && discriminator.categoryKind) {
    for (const k of discriminator.kinds) {
      if (discriminatorKindMatchesCategory(k.kind, discriminator.categoryKind.kind)) affirmedMember.add(k.letter);
    }
  }
  if (discriminator?.ok) {
    for (const e of discriminator.categoryEnumerationMembers) affirmedMember.add(e.letter);
  }
  // A genuine affirmative denial (Softballs) always outranks a structural-match "member" reading
  // -- defensive only; terminator_step.ts's own contradiction check above already refuses to
  // publish when the two genuinely disagree, so this should never matter in practice.
  for (const L of affirmedNonMember) affirmedMember.delete(L);
  const unstated: string[] = [];
  for (const L of Object.keys(OPT)) {
    if (affirmedNonMember.has(L) || affirmedMember.has(L)) continue;
    unstated.push(L);
  }
  return { affirmedNonMember: [...affirmedNonMember], affirmedMember: [...affirmedMember], unstated };
}

export async function runTerminatorStep(
  input: MethodQuestionInput,
  _ctx: MethodRunContext,
  priorResults: ComposerStepOutcome[],
): Promise<{ result: TerminatorResult; summary: string }> {
  const OPT = input.options;
  const emptyStepsConsulted: TerminatorResult['stepsConsulted'] = {
    'Softballs:1': 'not run', 'NamedSet:1': 'not run', 'Discriminator:1': 'not run', 'Magnitude:1': 'not run',
    'HumanNuance:1': 'not run', 'Purpose:1': 'not run', 'Unitary:1': 'not run', 'BoundaryStability:1': 'not run',
  };
  if (!OPT || Object.keys(OPT).length === 0) {
    const result: TerminatorResult = {
      ok: false, stepsConsulted: emptyStepsConsulted, insufficientEvidence: null, eliminated: [], survivors: [],
      contradiction: null, verdict: null, verdictName: null, abstain: true,
      abstainReason: 'this question has no lettered options', basisStepClasses: [], magnitudeBasis: null,
      frameMatchBuckets: null, incomplete: false,
      error: 'THE TERMINATOR needs lettered options -- cannot run without them',
    };
    return { result, summary: summaryLine({}, result) };
  }
  const all = Object.keys(OPT);

  const findRaw = (id: string): unknown | null => priorResults.find((r) => r.id === id)?.raw ?? null;
  const softballsRaw = findRaw('Softballs:1') as SoftballsResult | null;
  const namedSetRaw = findRaw('NamedSet:1') as NamedSetResult | null;
  const discriminatorRaw = findRaw('Discriminator:1') as DiscriminatorResult | null;
  const magnitudeRaw = findRaw('Magnitude:1') as MagnitudeResult | null;
  // D-BP154-033/BISHOP-SEG/S30-continuation/seg-wire-humannuance, ADDITIVE.
  const humanNuanceRaw = findRaw('HumanNuance:1') as HumanNuanceResult | null;
  // D-BP154-041 PART 2/3, ADDITIVE.
  const purposeRaw = findRaw('Purpose:1') as PurposeResult | null;
  // D-BP154-043, ADDITIVE.
  const unitaryRaw = findRaw('Unitary:1') as UnitaryResult | null;
  // D-BP154-053, ADDITIVE.
  const boundaryRaw = findRaw('BoundaryStability:1') as BoundaryResult | null;
  // D-BP154-052/BISHOP-SEG/S52/seg-wiregate, NEW. THE LIVE CALL -- computed once, here, from
  // whatever Unitary:1 actually returned this run, threaded into every TerminatorResult return
  // below (see checkCompositenessUniformity()'s own header above).
  const comparabilityGate = checkCompositenessUniformity(OPT, unitaryRaw?.ok ? unitaryRaw : null);

  // D-BP154-041 PART 3/3, NEW. THE ONE PLACE a step's raw result (real, or a SKIPPED-AS-MOOT
  // marker from script_bridge.ts's own computeStepSkip()) becomes its stepsConsulted status --
  // qualifier 1 of the skip gate's own five: skipped is checked BEFORE 'ok'/'failed', so it can
  // never be folded into 'failed' and can never mark a run incomplete (anyStepFailed(), below,
  // only ever counts the literal string 'failed'). D-BP154-046 FIX 1, AMENDED: a raw that IS ok
  // is no longer automatically 'ok' -- isStepProductive() (this file, exported below) is
  // consulted, and a formally-successful-but-hollow result becomes 'ok-but-unproductive', the
  // antonymic canon's third state.
  const stepStatus = (
    id: string, raw: { ok?: boolean } | null,
  ): 'not run' | 'ok' | 'ok-but-unproductive' | 'failed' | 'skipped-moot' => {
    if (!raw) return 'not run';
    if (isSkippedMarker(raw)) return 'skipped-moot';
    if (!raw.ok) return 'failed';
    return isStepProductive(id, raw) ? 'ok' : 'ok-but-unproductive';
  };

  const stepsConsulted: TerminatorResult['stepsConsulted'] = {
    'Softballs:1': stepStatus('Softballs:1', softballsRaw),
    'NamedSet:1': stepStatus('NamedSet:1', namedSetRaw),
    'Discriminator:1': stepStatus('Discriminator:1', discriminatorRaw),
    'Magnitude:1': stepStatus('Magnitude:1', magnitudeRaw),
    'HumanNuance:1': stepStatus('HumanNuance:1', humanNuanceRaw),
    // Purpose:1 is never a skip candidate (nothing precedes it) -- same productivity check applied.
    'Purpose:1': stepStatus('Purpose:1', purposeRaw),
    'Unitary:1': stepStatus('Unitary:1', unitaryRaw),
    'BoundaryStability:1': stepStatus('BoundaryStability:1', boundaryRaw),
  };
  // D-BP154-029/BISHOP-SEG/S29/seg-withhold FIX. Computed ONCE, used everywhere below --
  // deriveTerminatorEliminations() itself, contradiction/zero-survivor ABSTAINs, and (new this
  // ticket) the gate that keeps a VERDICT from ever publishing while `incomplete` is true. This
  // generalizes automatically to 'HumanNuance:1' above -- anyStepFailed() reads whatever keys
  // `stepsConsulted` carries, never a hardcoded list of them.
  const incomplete = anyStepFailed(stepsConsulted);
  const consultedNote = (Object.entries(stepsConsulted) as Array<[string, string]>)
    .map(([id, status]) => `${id}: ${status}`).join(', ');

  const { eliminated, contradiction, boundaryGate, subregionGate } = deriveTerminatorEliminations(
    OPT,
    softballsRaw?.ok ? softballsRaw : null,
    namedSetRaw?.ok ? namedSetRaw : null,
    discriminatorRaw?.ok ? discriminatorRaw : null,
    humanNuanceRaw?.ok ? humanNuanceRaw : null,
    unitaryRaw?.ok ? unitaryRaw : null,
    boundaryRaw?.ok ? boundaryRaw : null,
  );
  // D-BP154-024/BISHOP-SEG/S24/seg-unstated, ADDITIVE: computed ONCE, threaded into every
  // TerminatorResult return below regardless of outcome (abstain, verdict, or contradiction) --
  // see computeFrameMatchBuckets()'s own header for why this is a report, never a gate.
  const frameMatchBuckets = computeFrameMatchBuckets(
    OPT, softballsRaw?.ok ? softballsRaw : null, discriminatorRaw?.ok ? discriminatorRaw : null,
    humanNuanceRaw?.ok ? humanNuanceRaw : null,
    unitaryRaw?.ok ? unitaryRaw : null,
    subregionGate,
  );

  // D-BP154-055/BISHOP-SEG/S52/seg-wiregate -- THE COORDINATOR'S OWN LIVE-DIAGNOSED FIX, MOVED
  // (not deleted) FROM ABOVE deriveTerminatorEliminations() TO HERE, AFTER it. Founder's own
  // reading of the qid-98 receipt: "the gate is firing on the raw nine-option count and short-
  // circuiting the whole chain before the frame is ever attempted... it is correct about the naive
  // reading and wrong as a gate placement... requiredMemberCount = optionCount - 1 must be
  // evaluated against the COMPARABLE CANDIDATE SET, not the raw option list -- establish frame ->
  // remove out-of-frame -> remove non-comparable -> THEN test whether the remaining pool can
  // satisfy the purpose."
  //
  // THE COMPARABLE POOL, computed live from whatever THIS run's own admissibility-class sources
  // actually eliminated -- Softballs:1 (OUT_OF_FRAME-equivalent: "falls outside the category"),
  // HumanNuance:1 (the same admissibility class, D-BP154-033's own ruling), and BoundaryStability:1
  // (NOT_COMPARABLE, D-BP154-053) -- NEVER Discriminator:1's/NamedSet:1's own STATED_MEMBER-class
  // eliminations, because satisfying the NEGATED_SUPERLATIVE_MEMBERSHIP purpose (finding enough
  // affirmed members to leave a unique non-member) IS what the purpose asks for, not a filter
  // that should shrink the pool BEFORE the purpose is even tested against it. This reads only
  // `eliminated`'s own already-computed `sourceStep` tags -- no new judgment, no letter selected
  // (FD-BP153-06).
  const admissibilityFilteredLetters = new Set(
    eliminated
      .filter((e) => e.sourceStep === 'Softballs:1' || e.sourceStep === 'HumanNuance:1' || e.sourceStep === 'BoundaryStability:1')
      .map((e) => e.letter),
  );
  const comparablePoolCount = all.length - admissibilityFilteredLetters.size;
  // `sufficiencyRaw` is copied straight from Purpose:1's own already-computed field -- never
  // recomputed (a second, independently-computed copy could drift from Purpose:1's own). Null
  // under the exact same conditions the pre-existing early-return check above used to read.
  const sufficiencyRaw = purposeRaw?.ok ? purposeRaw.sufficiency : null;
  // `sufficiencyPostFilter`: THE SAME checkSufficiency() function (sufficiency_gate.ts, UNCHANGED)
  // called a second time, against `comparablePoolCount` instead of the raw `all.length`. Null
  // under the same conditions `sufficiencyRaw` is null -- if Purpose:1 never ran or never
  // classified a purposeType, there is nothing to re-check against a narrower pool either.
  const sufficiencyPostFilter = purposeRaw?.ok
    ? checkSufficiency(purposeRaw.purposeType, comparablePoolCount)
    : null;
  // THE GATE ITSELF, MOVED: an insufficiency finding now requires the POST-FILTER check (the
  // comparable pool) to ALSO be insufficient -- the raw check alone no longer aborts the run.
  // BOTH results are always threaded into every TerminatorResult return below regardless of this
  // branch's own outcome (coordinator, verbatim: "Both are true and the receipt should carry
  // both... it must not be erased by a clean result over the filtered set").
  if (sufficiencyPostFilter && !sufficiencyPostFilter.sufficient) {
    const result: TerminatorResult = {
      ok: true, stepsConsulted, eliminated, survivors: all.filter((L) => !admissibilityFilteredLetters.has(L)),
      contradiction: null, verdict: null, verdictName: null, abstain: true,
      abstainReason: `INSUFFICIENT EVIDENCE (against the comparable pool of ${comparablePoolCount}, after `
        + `admissibility filtering): ${sufficiencyPostFilter.reason}`,
      insufficientEvidence: {
        preconditionId: sufficiencyPostFilter.preconditionId,
        reason: sufficiencyPostFilter.reason,
        policyVersion: sufficiencyPostFilter.policyVersion,
      },
      basisStepClasses: [], magnitudeBasis: null, frameMatchBuckets, incomplete, comparabilityGate, boundaryGate, sufficiencyRaw, sufficiencyPostFilter, subregionGate,
    };
    return { result, summary: summaryLine(OPT, result) };
  }

  if (contradiction) {
    const result: TerminatorResult = {
      ok: true, stepsConsulted, insufficientEvidence: null, eliminated, survivors: [], contradiction, verdict: null,
      verdictName: null, abstain: true,
      abstainReason: `CONTRADICTION: ${contradiction.reason}`,
      basisStepClasses: [], magnitudeBasis: null, frameMatchBuckets, incomplete, comparabilityGate, boundaryGate, sufficiencyRaw, sufficiencyPostFilter, subregionGate,
    };
    return { result, summary: summaryLine(OPT, result) };
  }

  const eliminatedLetters = new Set(eliminated.map((e) => e.letter));
  const survivors = all.filter((L) => !eliminatedLetters.has(L));

  const contributingSteps = new Set(eliminated.map((e) => e.sourceStep));
  const basisStepClasses: ComposerStepClass[] = [];
  if (contributingSteps.has('Softballs:1') && softballsRaw) basisStepClasses.push(classifyComposerStepResult(softballsRaw).cls);
  if (contributingSteps.has('NamedSet:1') && namedSetRaw) basisStepClasses.push(classifyComposerStepResult(namedSetRaw).cls);
  if (contributingSteps.has('Discriminator:1') && discriminatorRaw) basisStepClasses.push(classifyComposerStepResult(discriminatorRaw).cls);
  // D-BP154-033, ADDITIVE.
  if (contributingSteps.has('HumanNuance:1') && humanNuanceRaw) basisStepClasses.push(classifyComposerStepResult(humanNuanceRaw).cls);
  // D-BP154-043, ADDITIVE.
  if (contributingSteps.has('Unitary:1') && unitaryRaw) basisStepClasses.push(classifyComposerStepResult(unitaryRaw).cls);
  // D-BP154-053, ADDITIVE.
  if (contributingSteps.has('BoundaryStability:1') && boundaryRaw) basisStepClasses.push(classifyComposerStepResult(boundaryRaw).cls);

  if (survivors.length === 0) {
    const result: TerminatorResult = {
      ok: true, stepsConsulted, insufficientEvidence: null, eliminated, survivors, contradiction: null, verdict: null,
      verdictName: null, abstain: true,
      abstainReason: 'every option was eliminated -- at least one contributing step\'s basis must be wrong; not published',
      basisStepClasses: [], magnitudeBasis: null, frameMatchBuckets, incomplete, comparabilityGate, boundaryGate, sufficiencyRaw, sufficiencyPostFilter, subregionGate,
    };
    return { result, summary: summaryLine(OPT, result) };
  }
  if (survivors.length > 1) {
    // D-BP154-014/BISHOP-SEG/S40/seg-magnitude-gate, NEW. FD-BP154-14 (RULINGS_BP154.md), Founder
    // verbatim: "Magnitude should not run once membership is settled - ruled." AMENDS FD-BP153-01.
    //
    // MEASURED LIVE, qid 98 (LIANA_COMPOSER_RUN_qid98_2026-08-14T21-59-51-048Z.json, the first
    // COMPLETE seven-step run of the session): NamedSet:1 found exactly ONE stated member of the
    // superlative property (B, South Asia) and eliminated it. Every one of the FOUR remaining
    // survivors was THEREFORE already a stated NON-member by construction -- elimination only ever
    // removes members; a survivor's mere presence proves nothing was stated placing it INSIDE the
    // property. Magnitude:1 then ranked those four non-members by the SAME property and picked
    // "the least dense of several equally-correct answers" -- answering "which is least dense",
    // not "which is NOT considered one of the most densely populated". The membership test had
    // ALREADY partitioned the options; magnitude had nothing legitimate left to decide, and it
    // decided anyway, publishing a confident wrong VERDICT F against a key of A.
    //
    // THE GATE, structural and HARDWIRE-22 safe: reads only WHETHER NamedSet:1's own `included` or
    // Discriminator:1's own `propertyMembers` arrays are non-empty -- i.e. whether the membership-
    // of-the-property question was ever asked AND answered affirmatively for at least one option.
    // Never reads Magnitude:1's own ranking content, never which letter is which (FD-BP153-06).
    // When it fires, Magnitude:1's own status (ran/failed/not stacked) becomes irrelevant -- per
    // the ruling's own words, "it does not run", not "it runs but is not trusted".
    //
    // AMENDS, DOES NOT REPLACE, FD-BP153-01: "a superlative resolves by magnitude, ranked within
    // the frame" remains correct and UNCHANGED below for a genuine "which is the MOST/LEAST X"
    // question, where NO prior step ever found a stated member of the property to partition on --
    // this gate is silent (membershipPartitioned stays false) and the pre-existing magnitude-
    // consultation logic runs exactly as before.
    const membershipPartitioned = isMembershipPartitioned(namedSetRaw, discriminatorRaw);
    // D-BP154-043/BISHOP-SEG/S43/seg-unitary, AMENDS FD-BP154-14 (which itself amended FD-BP153-01).
    // Founder's own correction, D-BP154-043 dispatch, verbatim: "I over-applied FD-BP154-14 as
    // 'membership settled -> always abstain'... Magnitude does NOT run when membership RESOLVES to
    // a unique survivor. Magnitude IS the final permissible tie-break when membership PARTITIONS
    // but leaves several survivors AND the artifact class is a single-answer item. Partitioned-but-
    // unresolved and resolved are different states; collapsing them was my error."
    //
    // `survivors.length > 1` (this whole branch's own guard) is already "partitioned but leaves
    // several survivors" -- membership never RESOLVES to a unique survivor inside this branch at
    // all (a unique survivor is handled entirely separately, below this whole `if` block). So the
    // ONLY new condition this amendment adds is the artifact-class precondition: is this
    // confirmed, from STATED METADATA (src/category -- step 1 of the Founder's own chain), to be a
    // single-correct-answer assessment item? Reused, not reinvented: HumanNuance:1's own
    // `artifactClassEstablished` + `corpusMetaTruth` (human_nuance_step.ts, FD-BP154-07a: "every
    // MMLU-Pro item is a human-authored assessment artifact with exactly one intended answer")
    // already answer exactly this question from exactly those two fields -- no new classification
    // logic is built here.
    const artifactClassEstablished = Boolean(
      humanNuanceRaw?.ok && humanNuanceRaw.artifactClassEstablished && humanNuanceRaw.corpusMetaTruth,
    );
    // D-BP154-046 FIX 2, NEW. Founder: "FD-BP154-18's licence checked that membership partitioned
    // and artifact class was established -- both formally true in the failing run, both hollow...
    // Skip-gate qualifier 2 applies here and was never carried over: resolved must mean resolved
    // by EVIDENCE, not by exhaustion." LIVE-MEASURED (D-BP154-046 dispatch): Softballs:1 returned
    // ok:true while excluding only D -- G/H/I (biomes/a latitude line) survived into the frame,
    // the license fired anyway (membershipPartitioned + artifactClassEstablished both formally
    // true), and Magnitude ranked a frame that was never substantively established, publishing
    // VERDICT G) Arctic Circle.
    //
    // THE CHECK: HumanNuance:1's own `nonParticipants` (human_nuance_step.ts) is a BLIND,
    // letter-agnostic, already-computed fact -- the augmentation-added options, derived purely
    // from an option-COUNT comparison against the origin's own (pre-augmentation) option set,
    // never a judgment about which letter is which (FD-BP153-06). If a category-elimination pass
    // were genuinely substantive, every one of those additions would appear somewhere in
    // `eliminated` (Softballs/Discriminator/HumanNuance/Unitary all contribute to that same
    // array). An addition that survived UNELIMINATED is direct, structural evidence the frame is
    // still hollow -- exactly qualifier 2's "resolved by evidence, not exhaustion": a partition
    // existing on paper is not the same fact as the category having actually been narrowed.
    // `null` (never a guess) when HumanNuance:1 did not run or found no augmentation deltas to
    // check against -- absence of this specific evidence is NOT treated as "substantive" by
    // default (qualifier 2 again: no evidence for substantiveness means it is not licensed).
    //
    // D-BP154-057, BLOCKER 2, THE COORDINATOR'S OWN RULING (isCategoryFrameSubstantive()'s own
    // header above carries the full text). `confirmedRetained` is built ONLY from EXPLICIT,
    // sourced "confirmed" arrays -- Unitary:1's own confirmedUnitary, BoundaryStability:1's own
    // confirmedStable -- never from mere silence/omission, which still leaves an option uncaught
    // exactly as before this fix.
    const confirmedRetained = new Set<string>([
      ...(unitaryRaw?.ok ? unitaryRaw.confirmedUnitary.map((e) => e.letter) : []),
      ...(boundaryRaw?.ok ? boundaryRaw.confirmedStable.map((e) => e.letter) : []),
    ]);
    const categoryFrameSubstantive = isCategoryFrameSubstantive(eliminated, humanNuanceRaw, confirmedRetained);
    // Qualifier 3: no gate may be licensed on the basis of a step that FAILED or was UNPRODUCTIVE.
    // Softballs:1/Discriminator:1 are the category-elimination steps this license depends on;
    // 'ok-but-unproductive' (D-BP154-046 FIX 1) on EITHER, with nothing else in `eliminated`
    // covering the category question, is the same hollow-license shape by construction --
    // categoryFrameSubstantive's own uncaught-additions check already catches this in practice
    // (an unproductive Softballs leaves its own augmentation additions uncaught), so this is
    // stated here as the EXPLICIT qualifier-3 reading, not a second, separate check.
    const licenseWithheld = membershipPartitioned && (
      !artifactClassEstablished
      || categoryFrameSubstantive === null
      || !categoryFrameSubstantive.substantive
    );
    if (licenseWithheld) {
      const statedMembers = [
        ...(namedSetRaw?.ok ? namedSetRaw.included.map((e) => `${e.letter}) ${e.name} [NamedSet:1]`) : []),
        ...(discriminatorRaw?.ok ? discriminatorRaw.propertyMembers.map((e) => `${e.letter}) ${e.name} [Discriminator:1]`) : []),
      ];
      const substantiveNote = categoryFrameSubstantive === null
        ? 'no evidence either way (HumanNuance:1 did not run, or found no augmentation deltas to check) -- absence of evidence for substantiveness is not treated as substantive'
        : categoryFrameSubstantive.substantive
          ? 'substantive (every known augmentation addition was eliminated by some step)'
          : `NOT substantive -- ${categoryFrameSubstantive.uncaught.map((L) => `${L}) ${OPT[L]}`).join(', ')} `
            + `${categoryFrameSubstantive.uncaught.length === 1 ? 'is' : 'are'} a known augmentation addition `
            + 'that survived every elimination step uncaught (Softballs:1/Discriminator:1 ran "ok" but did '
            + 'not substantively narrow the category, D-BP154-046 FIX 1/2)';
      const result: TerminatorResult = {
        ok: true, stepsConsulted, insufficientEvidence: null, eliminated, survivors, contradiction: null, verdict: null,
        verdictName: null, abstain: true,
        abstainReason: `FD-BP154-14 (amended D-BP154-043, D-BP154-046): Magnitude:1 not consulted -- the membership test already `
          + `partitioned the options (stated member(s): ${statedMembers.join(', ') || '(none)'}), `
          + `so the ${survivors.length} remaining survivor(s) (${survivors.join(', ')}) are `
          + 'non-members by elimination; ranking them by magnitude would answer "which is least/'
          + 'most of the property", not "which is NOT a member" -- more than one survivor after '
          + 'membership is settled is an ABSTAIN, not a ranking problem UNLESS the artifact class is '
          + 'confirmed a single-answer item AND the category frame is SUBSTANTIVELY established '
          + '(D-BP154-046 FIX 2), which is not the case here. Artifact class: '
          + `${humanNuanceRaw?.ok ? (humanNuanceRaw.artifactClassEstablished ? (humanNuanceRaw.corpusMetaTruth ? 'established' : 'established but no corpus meta-truth') : 'not established') : 'not run/failed'}. `
          + `Category frame: ${substantiveNote}. Steps consulted: ${consultedNote}`,
        basisStepClasses: [], magnitudeBasis: null, frameMatchBuckets, incomplete, comparabilityGate, boundaryGate, sufficiencyRaw, sufficiencyPostFilter, subregionGate,
      };
      return { result, summary: summaryLine(OPT, result) };
    }
    // D-BP154-043/046: when membershipPartitioned && artifactClassEstablished && the category
    // frame is substantively established, this branch is
    // deliberately NOT taken -- execution falls through to the SAME magnitude-consultation logic
    // below a genuine superlative ranking already uses, now also serving as the permitted
    // tie-break. `tieBreakKind` (set on the eventual `magnitudeBasis`, below) is what tells the two
    // cases apart in the published result.
    const tieBreakKind: 'genuine-superlative' | 'partitioned-membership-tiebreak' = membershipPartitioned
      ? 'partitioned-membership-tiebreak' : 'genuine-superlative';
    // D-BP154-022/BISHOP-SEG/S22/seg-magnitude, ADDITIVE: FD-BP153-01, "magnitude decides only
    // among the survivors" -- consulted here, AFTER the elimination-based frame is established,
    // exactly the ordering the ruling names. Every one of these checks must hold before a
    // magnitude-derived verdict is trusted; any single failure falls through to the SAME honest
    // multi-survivor ABSTAIN this branch has always returned, now naming why magnitude did not
    // apply:
    //   (a) Magnitude:1 actually ran and succeeded (ok:true) -- absent/failed is not a basis.
    //   (b) its own `frame` is EXACTLY the survivor set THIS reduction just (re-)computed -- never
    //       trust a ranking obtained against a different or stale frame (a mismatch means the
    //       stack was reordered or re-run in a way that invalidates the ranking; report it, never
    //       force it).
    //   (c) `targetExtreme` was determined (the question's own wording named a direction).
    //   (d) EVERY survivor was actually ranked (`unranked.length === 0`) -- a partial ordering
    //       cannot honestly name the true extreme (an unranked option could be even more extreme
    //       than the one at the end of a short list).
    if (
      magnitudeRaw?.ok && magnitudeRaw.targetExtreme && magnitudeRaw.property
      && sameLetterSet(magnitudeRaw.frame, survivors)
      && magnitudeRaw.unranked.length === 0
      && magnitudeRaw.order.length === survivors.length
    ) {
      const extremeEntry = magnitudeRaw.targetExtreme === 'least'
        ? magnitudeRaw.order[magnitudeRaw.order.length - 1]
        : magnitudeRaw.order[0];
      // D-BP154-029/BISHOP-SEG/S29/seg-withhold FIX. THE GATE. This is the exact shape the
      // dispatch's own live receipt caught: NamedSet:1 failed, Magnitude:1 ranked the WRONG
      // survivor set (B/E never eliminated), and F published anyway with `incomplete: true`
      // recorded but ignored. A verdict derived from a partial elimination set is unsound whatever
      // letter it lands on -- WITHHELD, never published, when `incomplete` is true, regardless of
      // how clean Magnitude:1's own ranking looks.
      if (incomplete) {
        const result: TerminatorResult = {
          ok: true, stepsConsulted, insufficientEvidence: null, eliminated, survivors, contradiction: null, verdict: null,
          verdictName: null, abstain: true,
          abstainReason: `WITHHELD: Magnitude:1 would have named ${extremeEntry.letter}) ${OPT[extremeEntry.letter]} as the `
            + `${magnitudeRaw.targetExtreme} of "${magnitudeRaw.property}", but this run is INCOMPLETE -- ${withheldNote(stepsConsulted)}. `
            + `A verdict derived from a partial elimination set is unsound whatever letter it lands on -- not published. `
            + `Steps consulted: ${consultedNote}`,
          basisStepClasses: [], magnitudeBasis: null, frameMatchBuckets, incomplete, comparabilityGate, boundaryGate, sufficiencyRaw, sufficiencyPostFilter, subregionGate,
        };
        return { result, summary: summaryLine(OPT, result) };
      }
      const magnitudeClass = classifyComposerStepResult(magnitudeRaw).cls;
      const result: TerminatorResult = {
        ok: true, stepsConsulted, insufficientEvidence: null, eliminated, survivors, contradiction: null,
        verdict: extremeEntry.letter, verdictName: OPT[extremeEntry.letter], abstain: false, abstainReason: null,
        basisStepClasses: [...basisStepClasses, magnitudeClass],
        magnitudeBasis: {
          targetExtreme: magnitudeRaw.targetExtreme, property: magnitudeRaw.property, span: extremeEntry.span,
          tieBreakKind,
          sourceGrade: magnitudeRaw.frozenSource?.obtained
            ? 'PROVEN-eligible -- single frozen source covers every survivor'
            : 'ANSWERED -- not proven by a unified frozen dataset',
        },
        frameMatchBuckets, incomplete, comparabilityGate, boundaryGate, sufficiencyRaw, sufficiencyPostFilter, subregionGate,
      };
      return { result, summary: summaryLine(OPT, result) };
    }
    const magnitudeNote = magnitudeRaw
      ? magnitudeRaw.ok
        ? !sameLetterSet(magnitudeRaw.frame, survivors)
          ? `; Magnitude:1 ran but against a DIFFERENT frame {${magnitudeRaw.frame.join(', ')}} than this reduction's own {${survivors.join(', ')}} -- refused, not trusted`
          : magnitudeRaw.unranked.length > 0
            ? `; Magnitude:1 ran on the right frame but left ${magnitudeRaw.unranked.join(', ')} unranked -- a partial ordering cannot name the true extreme`
            : '; Magnitude:1 ran but did not resolve a target extreme'
        : `; Magnitude:1 ran but did not succeed (${magnitudeRaw.error ?? 'no reason given'})`
      : '';
    const result: TerminatorResult = {
      ok: true, stepsConsulted, insufficientEvidence: null, eliminated, survivors, contradiction: null, verdict: null,
      verdictName: null, abstain: true,
      abstainReason: `more than one survivor left (${survivors.join(', ')}) -- no stated distinction separated them further. Steps consulted: ${consultedNote}${magnitudeNote}`,
      basisStepClasses: [], magnitudeBasis: null, frameMatchBuckets, incomplete, comparabilityGate, boundaryGate, sufficiencyRaw, sufficiencyPostFilter, subregionGate,
    };
    return { result, summary: summaryLine(OPT, result) };
  }

  const verdict = survivors[0];
  // D-BP154-029/BISHOP-SEG/S29/seg-withhold FIX. THE SAME GATE as the magnitude-verdict branch
  // above, applied here too: a unique survivor reached while `incomplete` is true is exactly as
  // untrustworthy as a magnitude-derived one -- the elimination set that made it unique is partial
  // by construction (a failed step never eliminated anything, so any option it WOULD have removed
  // is sitting in `survivors` unexamined). WITHHELD, never published.
  if (incomplete) {
    const result: TerminatorResult = {
      ok: true, stepsConsulted, insufficientEvidence: null, eliminated, survivors, contradiction: null, verdict: null,
      verdictName: null, abstain: true,
      abstainReason: `WITHHELD: a unique survivor (${verdict}) ${OPT[verdict]} was reached, but this run is `
        + `INCOMPLETE -- ${withheldNote(stepsConsulted)}. A verdict derived from a partial elimination set is `
        + `unsound whatever letter it lands on -- not published. Steps consulted: ${consultedNote}`,
      basisStepClasses: [], magnitudeBasis: null, frameMatchBuckets, incomplete, comparabilityGate, boundaryGate, sufficiencyRaw, sufficiencyPostFilter, subregionGate,
    };
    return { result, summary: summaryLine(OPT, result) };
  }
  const result: TerminatorResult = {
    ok: true, stepsConsulted, insufficientEvidence: null, eliminated, survivors, contradiction: null,
    verdict, verdictName: OPT[verdict], abstain: false, abstainReason: null, basisStepClasses,
    magnitudeBasis: null, frameMatchBuckets, incomplete, comparabilityGate, boundaryGate, sufficiencyRaw, sufficiencyPostFilter, subregionGate,
  };
  return { result, summary: summaryLine(OPT, result) };
}

// ───────────────────────── registration (inert until stacked and run) ─────────────────────────

const TERMINATOR_DECLARATION: StepDeclaration = {
  id: 'liana_cycle.terminator_step.runTerminatorStep',
  version: '1',
  sourceFile: 'src/main/liana_cycle/library/terminator_step.ts',
  sourceLine: 1,
  exportName: 'runTerminatorStep',
  exportKind: 'function',
  whatItDoes:
    'Consumes what Softballs:1/NamedSet:1/Discriminator:1 already established (no new query of '
    + 'its own) and applies UNIQUE OR ABSTAIN (FD-BP152-19): options a source stated are not the '
    + 'category, ARE the superlative property, or are a different stated kind than the category '
    + 'are eliminated; exactly one survivor is the verdict, more than one or zero is an honest '
    + 'ABSTAIN naming the blocker, and a self-contradictory basis (excluded and included by the '
    + 'same letter) ABSTAINS rather than publishing.',
  inputs: 'MethodQuestionInput (question, options, qid) plus the accumulated results of any '
    + 'Softballs:1/NamedSet:1/Discriminator:1 steps already run earlier in the same stack.',
  outputs: 'Promise<{ result: TerminatorResult, summary: string }> -- the verdict or an honest '
    + 'abstain, every elimination with its source step and verbatim span, and any contradiction found.',
  decidesOrReports: 'DECIDES_AND_REFUSES',
  queryText: {
    issuesQuery: false,
    description: 'Issues no query of its own -- a pure reducer over the three feeder steps\' already-acquired results.',
    loadedFromQueryResource: false,
  },
  attribution: {
    kind: 'ATTRIBUTED',
    founderRuling: 'BP152/BP154',
    quote: 'UNIQUE OR ABSTAIN. NEVER PICK AMONG SURVIVORS.',
    citedAt: 'FD-BP152-19; THE_PAIL_BP154.md STAGE 5',
  },
  orphanEvidence:
    'N/A -- not an orphan. Live: registered via registerTerminatorStep() (this file), executed by '
    + 'script_bridge.ts\'s runOneStep() for id "Terminator:1", the same wiring pattern Softballs:1/'
    + 'NamedSet:1/Discriminator:1 already use.',
};

/** Registers 'Terminator:1'. Called from script_bridge.ts's ensureRegistryPopulated(),
 *  idempotently -- same try/catch shape as the other Composer step registrations there. */
export function registerTerminatorStep(): MethodIdentity {
  return registerNameNumbered('Terminator', 1, TERMINATOR_DECLARATION);
}
