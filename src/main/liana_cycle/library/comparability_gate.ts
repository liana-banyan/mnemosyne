// comparability_gate.ts -- D-BP154-050/BISHOP-SEG/S50/seg-comparability
//
// THE TYPED, SOURCE-BOUND COMPARABILITY GATE (FD-BP154-20/FD-BP154-21). Founder's own spec, filed
// verbatim in BISHOP_DROPZONE\SPEC_COMPARABILITY_GATE_BP154.md and
// BISHOP_DROPZONE\SPEC_CATEGORY_ERROR_TAXONOMY_BP154.md -- this file implements those two
// documents' typed core: the five predicates (kept separate, never collapsed), the four-valued
// gate status, the exclusion-reason taxonomy, and -- the single mechanism named as "the ONE thing
// that mechanically blocks the error we made" -- the UNIFORM-PREDICATE INVARIANT: a rule that would
// eliminate one same-relevant-type candidate but not another is REJECTED as non-discriminating
// before it is ever allowed to eliminate anyone.
//
// THE CATEGORY ERROR THIS REPAIRS (both specs, verbatim): "Central Asia is a group of countries"
// does NOT imply "Central Asia is not a world region" -- UN M49 assigns region codes to South
// America (005), Northern Africa (015), and Central Asia (143) alike; all three are territorial
// aggregations. `composite(x) => not-T(x)` is unsound unless the target class explicitly requires
// atomic entities, and then it must apply to every option uniformly. Unitary:1's own per-option
// "conglomerate" classification (D-BP154-045) is NOT wired as an eliminator by this file's own
// integration (terminator_step.ts) for exactly this reason -- it may still RECORD what a source
// states (informational), but a compositeness finding alone never removes an option from the pool.
//
// THE FIVE PREDICATES, KEPT SEPARATE (SPEC PART 2): R(x) geographic region under some taxonomy,
// T(x) in the question's target entity class, B(x) boundaries fixed this run, M(x) metric
// computable on those boundaries, C(x) member of the named category. R⇏T, T⇏C, M⇏C, ¬T⇏¬R --
// never collapsed into one boolean (that collapse is the antonymic-canon violation named
// elsewhere this session, applied here to eligibility itself).
//
// classify_cascade.ts is FORBIDDEN and was not read to build this file. No branch here selects a
// letter (FD-BP153-06) -- every function is symmetric over whichever candidates are handed in.

// ─────────────────────────── SPEC PART 2: the typed record and frame contract ───────────────────────────

export interface Span {
  text: string;
  /** Which step/mechanism this span was read from -- transparency, never itself a decision input. */
  via: string;
}

export type EntityType =
  | 'statistical_macroregion' | 'statistical_subregion' | 'continental_region'
  | 'subnational_region' | 'metropolitan_region' | 'physical_region' | 'biome'
  | 'desert' | 'latitude_zone' | 'country' | 'unknown';

export type AggregationLevel =
  | 'supranational' | 'continental' | 'subcontinental' | 'national' | 'subnational' | 'physical' | 'unknown';

export type PopulationStatus = 'inhabited' | 'uninhabited' | 'partly_inhabited' | 'unknown';

export interface BoundaryInfo {
  status: 'fixed' | 'source_defined' | 'unresolved';
  authority?: string;
  identifier?: string;
  evidence?: Span;
}

/** THE TYPED RECORD -- required before ANY elimination or ranking (spec part 2). Never inferred
 *  from surface words alone; every non-'unknown'/non-'unresolved' field needs its own Span,
 *  carried by the CALLER (this file never invents evidence). */
export interface Candidate {
  optionId: string;
  observedLabel: string;
  entityType: EntityType;
  entityTypeEvidence: Span | null;
  aggregationLevel: AggregationLevel;
  populationStatus: PopulationStatus;
  boundary: BoundaryInfo;
}

export function unknownCandidate(optionId: string, observedLabel: string): Candidate {
  return {
    optionId, observedLabel, entityType: 'unknown', entityTypeEvidence: null,
    aggregationLevel: 'unknown', populationStatus: 'unknown', boundary: { status: 'unresolved' },
  };
}

/** THE FRAME CONTRACT -- immutable, created BEFORE option elimination (spec part 2). */
export interface FrameContract {
  artifactClass: 'curriculum_single_choice' | 'formal_statistical_question' | 'open_factual_question' | 'unknown';
  targetClass: string;
  allowedEntityTypes: EntityType[];
  requiredAggregationLevels: AggregationLevel[];
  membershipRule: 'named_set' | 'numeric_threshold' | 'rank' | 'source_key' | 'unknown';
  metric?: { name: string; formula: string; unit: string; referenceDate: string; source: string };
  authority: Span | null;
}

export function unresolvedFrame(): FrameContract {
  return {
    artifactClass: 'unknown', targetClass: 'unknown', allowedEntityTypes: [], requiredAggregationLevels: [],
    membershipRule: 'unknown', authority: null,
  };
}

// ─────────────────────────── SPEC PART 2: four-valued gate status ───────────────────────────

/** Binary ok/failed is inadequate (spec part 2). UNRESOLVED = the gate ran and the evidence does
 *  not decide it -- the exact gap that let a step return green while excluding almost nothing
 *  (D-BP154-046's own "ok-but-unproductive" finding, generalized here to gate OUTCOMES rather than
 *  step SUCCESS). INAPPLICABLE = legitimately does not apply under the frame. */
export type GateStatus = 'ADMITTED' | 'EXCLUDED_WITH_EVIDENCE' | 'UNRESOLVED' | 'INAPPLICABLE' | 'FAILED';

// ─────────────────────────── SPEC PART 1: the elimination record and exclusion taxonomy ───────────────────────────

export type EliminationStage = 'FRAME' | 'COMPARABILITY' | 'MEMBERSHIP';
export type EliminationDisposition = 'OUT_OF_FRAME' | 'NOT_COMPARABLE' | 'STATED_MEMBER' | 'STATED_NONMEMBER' | 'UNSTATED' | 'FAILED';

export interface Elimination {
  option: string;
  stage: EliminationStage;
  disposition: EliminationDisposition;
  ruleVersion: string;
  sourceSpan: Span | null;
}

/** EXCLUSION REASON TAXONOMY (spec part 2, verbatim table): only these four may support a final
 *  answer; UNSTATED and FAILED never may (absence is omission; a step that did not execute
 *  reliably proves nothing). */
export function dispositionSupportsAnswer(disposition: EliminationDisposition): boolean {
  return disposition === 'OUT_OF_FRAME' || disposition === 'NOT_COMPARABLE'
    || disposition === 'STATED_MEMBER' || disposition === 'STATED_NONMEMBER';
}

// ─────────────────────────── THE UNIFORM-PREDICATE INVARIANT ───────────────────────────
// "THE ONE THING THAT MECHANICALLY BLOCKS THE ERROR WE MADE." ∀ x,y ∈ P, sameRelevantType(x,y) =>
// sameEligibilityPredicate(x,y). A rule that would eliminate one same-relevant-type candidate but
// spare another of the SAME type is REJECTED outright, before it is ever allowed to eliminate
// anyone -- this is what would have caught "Central Asia excluded as a group of countries while
// South America (also a group of countries under M49) is retained" automatically, and would have
// blocked the Founder's own D-BP154-045 instruction to re-ask Unitary specifically to catch it.

/** "Same relevant type" for THIS invariant check: same `entityType` when both are known/stated;
 *  when either is 'unknown', they are never treated as comparable for this check (an unknown
 *  entity's own type has not been established, so uniformity cannot be asserted OR denied about
 *  it -- this function only ever widens what a rule must survive, never narrows it). */
export function sameRelevantType(a: Candidate, b: Candidate): boolean {
  if (a.entityType === 'unknown' || b.entityType === 'unknown') return false;
  return a.entityType === b.entityType;
}

export interface EliminationRuleCheck {
  /** true iff the rule may fire at all -- false means REJECTED, never applied to anyone. */
  discriminating: boolean;
  /** Present only when discriminating is false: every same-relevant-type candidate the rule would
   *  ALSO have removed, naming exactly why the rule fails uniformity. */
  wouldAlsoRemove: string[];
}

/** THE EXECUTABLE CHECK (not a convention, per this ticket's own instruction). `wouldEliminate` is
 *  the rule UNDER TEST, applied to every candidate in `pool` -- if it would fire on more than the
 *  ONE `target` candidate among same-relevant-type peers, the rule is non-discriminating and is
 *  rejected. Symmetric, letter-blind: `wouldEliminate` is supplied by the caller and is never
 *  itself inspected for which letter it targets (FD-BP153-06) -- this function only checks
 *  CONSISTENCY of its own outcome across same-type peers. */
export function checkUniformPredicate(
  target: Candidate,
  pool: Candidate[],
  wouldEliminate: (c: Candidate) => boolean,
): EliminationRuleCheck {
  if (!wouldEliminate(target)) return { discriminating: false, wouldAlsoRemove: [] };
  const wouldAlsoRemove = pool
    .filter((c) => c.optionId !== target.optionId && sameRelevantType(target, c) && wouldEliminate(c))
    .map((c) => c.optionId);
  return { discriminating: wouldAlsoRemove.length === 0, wouldAlsoRemove };
}

// ─────────────────────────── SPEC PART 1: licensing magnitude (mayRank) ───────────────────────────

export interface Frame {
  status: 'ESTABLISHED' | 'UNRESOLVED';
  metric: string | null;
  referenceDate: string | null;
}

/** ∀r ∈ R: taxonomyFixed(r) ∧ boundaryFixed(r) ∧ metricComparable(r) ∧ timeAligned(r). NON-
 *  NEGOTIABLE, spec's own words: any entityType === "unknown" in the pool forbids ranking outright
 *  -- no uncertain entity reaches a numerical tiebreaker, checked FIRST, before the rest. */
export function mayRank(pool: Candidate[], frame: Frame): boolean {
  if (pool.some((c) => c.entityType === 'unknown')) return false; // NON-NEGOTIABLE
  return (
    frame.status === 'ESTABLISHED' && frame.metric !== null && frame.referenceDate !== null
    && pool.length >= 2
    && pool.every((c) => c.boundary.status === 'fixed' && c.populationStatus !== 'unknown')
  );
}

// ─────────────────────────── SPEC PART 1: the terminator decision shape ───────────────────────────

export type ComparabilityVerdict =
  | { kind: 'VERDICT'; option: string; basis: 'UNIQUE_STATED_NONMEMBER' }
  | { kind: 'ABSTAIN'; reason: 'MAGNITUDE_NOT_LICENSED' | 'NO_COMPARABLE_POOL' | 'AMBIGUOUS_RANKING' }
  | { kind: 'RANK'; order: string[] };

/** THE TERMINATOR REWRITE (spec part 1, verbatim pseudocode). Replaces "when eliminations leave a
 *  convenient pair, rank it" with "rank only the complete, predeclared, comparable candidate set."
 *  `stated NONMEMBER`s are read from `eliminations` (this function itself never eliminates
 *  anyone); `comparablePool` is whatever the comparability gate already retained -- COMPLETE, never
 *  a result-shaped subset chosen because it yields a desired letter. `rankByMetric`, supplied by
 *  the caller, orders `comparablePool`; this function only enforces mayRank() and uniqueness of
 *  the resulting extreme, never which direction "extreme" means (that stays the caller's own
 *  question-wording read, unchanged from FD-BP153-01/magnitude_step.ts). */
export function deriveComparabilityVerdict(
  eliminations: Elimination[],
  comparablePool: Candidate[],
  frame: Frame,
  rankByMetric: (pool: Candidate[]) => string[] /* most-to-least, or however the caller orders it */,
): ComparabilityVerdict {
  const statedNonmembers = eliminations.filter((e) => e.disposition === 'STATED_NONMEMBER');
  if (statedNonmembers.length === 1) {
    return { kind: 'VERDICT', option: statedNonmembers[0].option, basis: 'UNIQUE_STATED_NONMEMBER' };
  }
  if (comparablePool.length === 0) return { kind: 'ABSTAIN', reason: 'NO_COMPARABLE_POOL' };
  if (!mayRank(comparablePool, frame)) return { kind: 'ABSTAIN', reason: 'MAGNITUDE_NOT_LICENSED' };
  const order = rankByMetric(comparablePool);
  // onlyIfUnique: the ranking must actually distinguish an extreme -- a caller-side tie (two
  // candidates the ranking could not tell apart) is ambiguous, not a verdict.
  if (order.length !== comparablePool.length || new Set(order).size !== order.length) {
    return { kind: 'ABSTAIN', reason: 'AMBIGUOUS_RANKING' };
  }
  return { kind: 'RANK', order };
}
