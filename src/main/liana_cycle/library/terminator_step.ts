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
  sourceStep: 'Softballs:1' | 'NamedSet:1' | 'Discriminator:1' | 'HumanNuance:1' | 'Unitary:1';
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
  stepsConsulted: Record<'Softballs:1' | 'NamedSet:1' | 'Discriminator:1' | 'Magnitude:1' | 'HumanNuance:1' | 'Purpose:1' | 'Unitary:1', 'not run' | 'ok' | 'failed' | 'skipped-moot'>;
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
export function isMembershipPartitioned(
  namedSet: NamedSetResult | null,
  discriminator: DiscriminatorResult | null,
): boolean {
  return Boolean(
    (namedSet?.ok && namedSet.included.length > 0)
    || (discriminator?.ok && discriminator.propertyMembers.length > 0),
  );
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
  if (r.insufficientEvidence) {
    return `TERMINATOR -- INSUFFICIENT EVIDENCE (${r.insufficientEvidence.preconditionId}, policy v`
      + `${r.insufficientEvidence.policyVersion}): ${r.insufficientEvidence.reason}${completenessNote}`;
  }
  if (r.abstain) {
    return `TERMINATOR -- ABSTAIN: ${r.abstainReason}  ||  ELIMINATED: ${elimText}  ||  SURVIVORS: ${r.survivors.join(', ') || '(none)'}${bucketsNote}${completenessNote}`;
  }
  const magnitudeNote = r.magnitudeBasis
    ? `  ||  MAGNITUDE BASIS: target=${r.magnitudeBasis.targetExtreme} of "${r.magnitudeBasis.property}" -- "${r.magnitudeBasis.span}"`
    : '';
  return `TERMINATOR -- VERDICT ${r.verdict}) ${r.verdictName}  ||  ELIMINATED: ${elimText}${magnitudeNote}${bucketsNote}${completenessNote}`;
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
): { eliminated: TerminatorEliminationEntry[]; contradiction: TerminatorContradiction | null } {
  const eliminated: TerminatorEliminationEntry[] = [];
  const excludedBySoftballs = new Map<string, { name: string; span: string }>();
  if (softballs?.ok) {
    for (const e of softballs.excluded) {
      excludedBySoftballs.set(e.letter, { name: e.name, span: e.span });
      eliminated.push({
        letter: e.letter, name: e.name, sourceStep: 'Softballs:1',
        reason: `source states this is not the category`, span: e.span,
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
  // D-BP154-043/BISHOP-SEG/S43/seg-unitary, ADDITIVE. Unitary:1's own `excluded` array
  // (unitary_step.ts) is a FOURTH affirmative denial of the SAME shape -- FD-BP154-16's "unitary
  // vs conglomerate" membership factor: a source explicitly stated an option IS a conglomerate/
  // grouping of multiple regions, not a single unitary region. Symmetric across every option
  // (FD-BP153-06); an UNSTATED option is never eliminated on this basis (absence is omission).
  const excludedByUnitary = new Map<string, { name: string; span: string }>();
  if (unitary?.ok) {
    for (const e of unitary.excluded) {
      excludedByUnitary.set(e.letter, { name: e.name, span: e.span });
      eliminated.push({
        letter: e.letter, name: e.name, sourceStep: 'Unitary:1',
        reason: 'source states this is a conglomerate/grouping of multiple regions, not a single unitary region (FD-BP154-16 unitary-vs-conglomerate factor)',
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
  const subregionNonMembersByDiscriminator = new Map<string, { name: string; span: string }>();
  if (discriminator?.ok) {
    for (const e of discriminator.subregionNonMembers) {
      subregionNonMembersByDiscriminator.set(e.letter, { name: e.name, span: e.span });
      eliminated.push({
        letter: e.letter, name: e.name, sourceStep: 'Discriminator:1',
        reason: `source states this is not the category in its own right (a subdivision within a larger region)`, span: e.span,
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
  if (contradiction) return { eliminated, contradiction };
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
  if (contradiction) return { eliminated, contradiction };
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
  if (contradiction) return { eliminated, contradiction };
  // D-BP154-043, ADDITIVE: the SAME three contradiction checks above, applied to Unitary:1's own
  // affirmative denial -- a conglomerate-grouping fact cannot coexist with a stated superlative-
  // property membership or a stated enumeration membership for the SAME option.
  for (const [letter, unitaryFact] of excludedByUnitary) {
    const namedSetFact = includedByNamedSet.get(letter);
    if (namedSetFact) {
      contradiction = {
        letter,
        reason: `UNITARY states "${OPT[letter] ?? letter}" is a conglomerate/grouping ("${unitaryFact.span}") `
          + `while NAMED SET simultaneously states it IS the superlative property ("${namedSetFact.span}") -- `
          + `self-contradictory, not published`,
      };
      break;
    }
    const discriminatorPropertyFact = propertyMembersByDiscriminator.get(letter);
    if (discriminatorPropertyFact) {
      contradiction = {
        letter,
        reason: `UNITARY states "${OPT[letter] ?? letter}" is a conglomerate/grouping ("${unitaryFact.span}") `
          + `while DISCRIMINATOR simultaneously states it IS the superlative property `
          + `("${discriminatorPropertyFact.span}") -- self-contradictory, not published`,
      };
      break;
    }
    const discriminatorEnumerationFact = enumeratedByDiscriminator.get(letter);
    if (discriminatorEnumerationFact) {
      contradiction = {
        letter,
        reason: `UNITARY states "${OPT[letter] ?? letter}" is a conglomerate/grouping ("${unitaryFact.span}") `
          + `while DISCRIMINATOR's own enumeration simultaneously names it as a member `
          + `("${discriminatorEnumerationFact.span}") -- self-contradictory, not published`,
      };
      break;
    }
  }
  return { eliminated, contradiction };
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
): TerminatorFrameMatchBuckets {
  const affirmedNonMember = new Set<string>();
  if (softballs?.ok) {
    for (const e of softballs.excluded) affirmedNonMember.add(e.letter);
  }
  // D-BP154-026, ADDITIVE: the second affirmative-denial source (see deriveTerminatorEliminations()
  // above for the full ruling) -- folded into the SAME bucket as Softballs' own `excluded`, since
  // both answer the identical question ("does the source affirmatively place this option outside
  // the category?"), just via two independently-asked questions.
  if (discriminator?.ok) {
    for (const e of discriminator.subregionNonMembers) affirmedNonMember.add(e.letter);
  }
  // D-BP154-033, ADDITIVE: a THIRD affirmative-denial source -- HumanNuance:1's own `excluded`,
  // same bucket, same reasoning as the two above.
  if (humanNuance?.ok) {
    for (const e of humanNuance.excluded) affirmedNonMember.add(e.letter);
  }
  // D-BP154-043, ADDITIVE: a FOURTH affirmative-denial source -- Unitary:1's own `excluded`, same
  // bucket, same reasoning.
  if (unitary?.ok) {
    for (const e of unitary.excluded) affirmedNonMember.add(e.letter);
  }
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
    'HumanNuance:1': 'not run', 'Purpose:1': 'not run', 'Unitary:1': 'not run',
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

  // D-BP154-041 PART 3/3, NEW. THE ONE PLACE a step's raw result (real, or a SKIPPED-AS-MOOT
  // marker from script_bridge.ts's own computeStepSkip()) becomes its stepsConsulted status --
  // qualifier 1 of the skip gate's own five: skipped is checked BEFORE 'ok'/'failed', so it can
  // never be folded into 'failed' and can never mark a run incomplete (anyStepFailed(), below,
  // only ever counts the literal string 'failed').
  const stepStatus = (raw: { ok?: boolean } | null): 'not run' | 'ok' | 'failed' | 'skipped-moot' => {
    if (!raw) return 'not run';
    if (isSkippedMarker(raw)) return 'skipped-moot';
    return raw.ok ? 'ok' : 'failed';
  };

  const stepsConsulted: TerminatorResult['stepsConsulted'] = {
    'Softballs:1': stepStatus(softballsRaw),
    'NamedSet:1': stepStatus(namedSetRaw),
    'Discriminator:1': stepStatus(discriminatorRaw),
    'Magnitude:1': stepStatus(magnitudeRaw),
    'HumanNuance:1': stepStatus(humanNuanceRaw),
    // Purpose:1 is never a skip candidate (nothing precedes it) -- plain ok/failed/not-run, same
    // as PART 2/3 built it.
    'Purpose:1': purposeRaw ? (purposeRaw.ok ? 'ok' : 'failed') : 'not run',
    'Unitary:1': stepStatus(unitaryRaw),
  };
  // D-BP154-041 PART 2/3, FD-BP154-17, NEW. "Before an answer is attempted, establish that the
  // available evidence class CAN satisfy the stated purpose." Checked here, BEFORE this reducer's
  // own elimination/contradiction logic runs at all -- a structurally-insufficient purpose means no
  // amount of elimination could ever have produced a trustworthy unique survivor, so nothing below
  // this point is worth computing. A DISTINCT outcome from a normal ABSTAIN: `insufficientEvidence`
  // is set, never conflated with "no stated distinction separated them further".
  if (purposeRaw?.ok && purposeRaw.sufficiency && !purposeRaw.sufficiency.sufficient) {
    const result: TerminatorResult = {
      ok: true, stepsConsulted, eliminated: [], survivors: all, contradiction: null, verdict: null,
      verdictName: null, abstain: true,
      abstainReason: `INSUFFICIENT EVIDENCE: ${purposeRaw.sufficiency.reason}`,
      insufficientEvidence: {
        preconditionId: purposeRaw.sufficiency.preconditionId,
        reason: purposeRaw.sufficiency.reason,
        policyVersion: purposeRaw.sufficiency.policyVersion,
      },
      basisStepClasses: [], magnitudeBasis: null, frameMatchBuckets: null, incomplete: false,
    };
    return { result, summary: summaryLine(OPT, result) };
  }
  // D-BP154-029/BISHOP-SEG/S29/seg-withhold FIX. Computed ONCE, used everywhere below --
  // deriveTerminatorEliminations() itself, contradiction/zero-survivor ABSTAINs, and (new this
  // ticket) the gate that keeps a VERDICT from ever publishing while `incomplete` is true. This
  // generalizes automatically to 'HumanNuance:1' above -- anyStepFailed() reads whatever keys
  // `stepsConsulted` carries, never a hardcoded list of them.
  const incomplete = anyStepFailed(stepsConsulted);
  const consultedNote = (Object.entries(stepsConsulted) as Array<[string, string]>)
    .map(([id, status]) => `${id}: ${status}`).join(', ');

  const { eliminated, contradiction } = deriveTerminatorEliminations(
    OPT,
    softballsRaw?.ok ? softballsRaw : null,
    namedSetRaw?.ok ? namedSetRaw : null,
    discriminatorRaw?.ok ? discriminatorRaw : null,
    humanNuanceRaw?.ok ? humanNuanceRaw : null,
    unitaryRaw?.ok ? unitaryRaw : null,
  );
  // D-BP154-024/BISHOP-SEG/S24/seg-unstated, ADDITIVE: computed ONCE, threaded into every
  // TerminatorResult return below regardless of outcome (abstain, verdict, or contradiction) --
  // see computeFrameMatchBuckets()'s own header for why this is a report, never a gate.
  const frameMatchBuckets = computeFrameMatchBuckets(
    OPT, softballsRaw?.ok ? softballsRaw : null, discriminatorRaw?.ok ? discriminatorRaw : null,
    humanNuanceRaw?.ok ? humanNuanceRaw : null,
    unitaryRaw?.ok ? unitaryRaw : null,
  );

  if (contradiction) {
    const result: TerminatorResult = {
      ok: true, stepsConsulted, insufficientEvidence: null, eliminated, survivors: [], contradiction, verdict: null,
      verdictName: null, abstain: true,
      abstainReason: `CONTRADICTION: ${contradiction.reason}`,
      basisStepClasses: [], magnitudeBasis: null, frameMatchBuckets, incomplete,
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

  if (survivors.length === 0) {
    const result: TerminatorResult = {
      ok: true, stepsConsulted, insufficientEvidence: null, eliminated, survivors, contradiction: null, verdict: null,
      verdictName: null, abstain: true,
      abstainReason: 'every option was eliminated -- at least one contributing step\'s basis must be wrong; not published',
      basisStepClasses: [], magnitudeBasis: null, frameMatchBuckets, incomplete,
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
    if (membershipPartitioned && !artifactClassEstablished) {
      const statedMembers = [
        ...(namedSetRaw?.ok ? namedSetRaw.included.map((e) => `${e.letter}) ${e.name} [NamedSet:1]`) : []),
        ...(discriminatorRaw?.ok ? discriminatorRaw.propertyMembers.map((e) => `${e.letter}) ${e.name} [Discriminator:1]`) : []),
      ];
      const result: TerminatorResult = {
        ok: true, stepsConsulted, insufficientEvidence: null, eliminated, survivors, contradiction: null, verdict: null,
        verdictName: null, abstain: true,
        abstainReason: `FD-BP154-14: Magnitude:1 not consulted -- the membership test already `
          + `partitioned the options (stated member(s): ${statedMembers.join(', ') || '(none)'}), `
          + `so the ${survivors.length} remaining survivor(s) (${survivors.join(', ')}) are `
          + 'non-members by elimination; ranking them by magnitude would answer "which is least/'
          + 'most of the property", not "which is NOT a member" -- more than one survivor after '
          + 'membership is settled is an ABSTAIN, not a ranking problem UNLESS the artifact class is '
          + 'confirmed a single-answer item (D-BP154-043 amendment), which it is not here '
          + `(HumanNuance:1: ${humanNuanceRaw?.ok ? (humanNuanceRaw.artifactClassEstablished ? 'artifact class established but no corpus meta-truth' : 'artifact class not established') : 'not run/failed'}). `
          + `Steps consulted: ${consultedNote}`,
        basisStepClasses: [], magnitudeBasis: null, frameMatchBuckets, incomplete,
      };
      return { result, summary: summaryLine(OPT, result) };
    }
    // D-BP154-043: when membershipPartitioned && artifactClassEstablished, this branch is
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
          basisStepClasses: [], magnitudeBasis: null, frameMatchBuckets, incomplete,
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
        frameMatchBuckets, incomplete,
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
      basisStepClasses: [], magnitudeBasis: null, frameMatchBuckets, incomplete,
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
      basisStepClasses: [], magnitudeBasis: null, frameMatchBuckets, incomplete,
    };
    return { result, summary: summaryLine(OPT, result) };
  }
  const result: TerminatorResult = {
    ok: true, stepsConsulted, insufficientEvidence: null, eliminated, survivors, contradiction: null,
    verdict, verdictName: OPT[verdict], abstain: false, abstainReason: null, basisStepClasses,
    magnitudeBasis: null, frameMatchBuckets, incomplete,
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
