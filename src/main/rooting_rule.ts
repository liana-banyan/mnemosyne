// rooting_rule.ts -- KN-BP142-10: the Rooting Rule made structural, not incidental.
//
// Canon (Founder-ratified BP142, ratified and minted, not re-derived here):
// canon_rooting_rule_only_proven_and_ground_truth_checked_root_an_eblet_bp142.eblet.md
//
// THE RULE, verbatim from canon. Three acceptance tiers. Only the top two ROOT an eblet:
//
//   TIER 1  proven                a deterministic solver computed it
//   TIER 2  ground-truth-checked  checked against a known answer key
//   ----------------------------- the rooting line -----------------------------
//   TIER 3  concordant            independent sources or models merely agreed
//
// An eblet is ROOTED only via Tier 1 or Tier 2. Only a ROOTED eblet may flip `verified` to
// true. Only a ROOTED eblet may mint a Mark to a peer. Tier 3 (concordant) still answers --
// it is served and it is stored -- it simply is not ROOTED, so it mints nothing and never
// sets verified:true. Do not suppress concordant answers. Do not promote them either.
//
// WHY THIS FILE EXISTS (KN-BP142-6/KN-BP142-5 finding, restated honestly): KN-BP142-5 landed a
// caller for the Liana Cycle Engine (70a1e169) and its live three-question turn produced the
// right OUTCOME (one Mark minted for the ground-truth-correct answer, withheld from two
// wrong-but-concordant answers) -- but it never opened liana_cycle_runner.ts, where minting
// actually happens, and the token ROOTED appeared nowhere in src/main. The rule held only
// because the pre-existing logic happened to produce the right result on three questions --
// coincidence-shaped, not structure-shaped. KN-BP142-6 then measured the live substrate store
// holding nine verified:true records for one MMLU-Pro question, none of them correct, four of
// them written AFTER the honest-verification fix had already landed, through a legitimate
// two-model "concordant" accept -- proof the mechanism was minting wrong marks in production,
// not as legacy residue.
//
// THIS FILE is the SINGLE shared source of truth for tier classification and the ROOTED
// predicate, imported by BOTH of the two real write paths so neither can drift from the other
// and neither can be bypassed by a caller simply not calling this module:
//   - mnem_eblet_store.ts's computeHonestVerification() -- the verified:true write gate.
//   - liana_cycle_runner.ts's mintLedgerMark() -- the Mark-mint write gate.
//
// Use ROOTED verbatim (Founder's chosen word, BP142, over the earlier candidate ESTABLISHED)
// in identifiers, trace strings, and comments here and at both call sites. Never abbreviated,
// never a synonym, never reintroducing "established".

/** The three named tiers, in the canon's own vocabulary. String-literal union (matches this
 *  codebase's existing convention for VerifiedEbletEntry.corroboration/verdict, etc.) rather
 *  than a numeric/TS enum, so a tier value round-trips through JSON (log lines, JSONL ledger
 *  rows) exactly as a human reading the canon would spell it. */
export type RootingTier = 'proven' | 'ground-truth-checked' | 'concordant';

/** TIER 1: a deterministic solver computed it. */
export const TIER_PROVEN: RootingTier = 'proven';
/** TIER 2: checked against a known answer key. */
export const TIER_GROUND_TRUTH_CHECKED: RootingTier = 'ground-truth-checked';
/** TIER 3: independent sources or models merely agreed. Never ROOTS. */
export const TIER_CONCORDANT: RootingTier = 'concordant';

/** Only these two tiers ROOT an eblet (the rooting line, Founder-ratified BP142). Tier 3
 *  (concordant) is deliberately absent from this set -- that absence IS the rule. */
const ROOTING_TIERS: ReadonlySet<RootingTier> = new Set([TIER_PROVEN, TIER_GROUND_TRUTH_CHECKED]);

/**
 * THE ROOTED PREDICATE. "A rooted eblet can bear weight. An aerial one cannot yet." (canon)
 * Returns true only for Tier 1 (proven) or Tier 2 (ground-truth-checked). A null tier
 * (unclassified, e.g. no qualifying signal at all) and Tier 3 (concordant) both return false --
 * neither may flip verified:true nor mint a Mark. This is the one function both write-path
 * gates call; there is no second way to become ROOTED anywhere else in this codebase.
 */
export function isRooted(tier: RootingTier | null | undefined): boolean {
  return tier != null && ROOTING_TIERS.has(tier);
}

/** Verbatim marker for trace strings and logs, never abbreviated. */
export const ROOTED = 'ROOTED';
/** The honest counterpart for a Tier 3 or unclassified result -- canon's own image ("an aerial
 *  one cannot yet"), used only in human-readable trace strings, never as a stored verdict
 *  value (verified:false / verdict:'unverified' remain the actual stored fields). */
export const NOT_ROOTED_AERIAL = 'not ROOTED (aerial)';

/**
 * Renders a tier classification as the exact ROOTED / not-ROOTED trace string this ticket's
 * verification requires to be grep-able at the write path itself.
 */
export function rootedTraceLabel(tier: RootingTier | null | undefined): string {
  return isRooted(tier) ? ROOTED : NOT_ROOTED_AERIAL;
}

/**
 * D-BP148-021 (Bishop, BP148, HARDWIRE-17 ordinary tier -- tightening a predicate, not inventing
 * a concept): the provenance check below used to grant Tier 1 to ANY provenance string that
 * merely CONTAINED the literal text 'deterministic_compute' or 'schedule_amortization' anywhere
 * in it (`.includes()`, unanchored) -- "That proves a solver ran, not that it ran correctly"
 * (ticket framing), and worse: it did not even reliably prove a solver ran at all. Measured
 * directly against the real live substrate (verified_eblets.jsonl, 1,847 records) this ticket,
 * by enumerating every one of the 16 DISTINCT real provenance strings on disk that contain
 * 'deterministic_compute' and every one of the 11 that contain 'schedule_amortization': the old
 * unanchored match let through two real, damaging false-positive SHAPES, both caught rooting a
 * WRONG answer at the exact same Tier-1 "proven" status as a genuinely-computed correct answer
 * to the identical question:
 *
 *   1. `answer_coroner:ensemble_candidate:deterministic_compute_reasoning_fact` -- the
 *      per-candidate RGBY ledger provenance answer_coroner.ts writes for EVERY ensemble
 *      candidate, winner and losers alike (see mnem_eblet_store.ts's own KN-BP141-5 FIX 3 doc
 *      comment). It merely CONTAINS the substring 'deterministic_compute' as part of the longer
 *      literal 'deterministic_compute_reasoning_fact' -- a value LIFTED from an authority's own
 *      reasoning text, explicitly NOT independently grounded (this is exactly the
 *      'authority_extracted_compute' case this file's own corroboration-field doc comment
 *      already says must never root). Measured live: this exact provenance shape rooted a WRONG
 *      answer ("I) 9 degrees, 48 hp") for the airplane lift/drag question, sitting Tier-1
 *      alongside that question's genuinely-computed correct answer ("E) 7 degrees, 41.5 hp").
 *   2. A bare `plow_mc_answerer:solved:deterministic_compute` marker with NO solver name at all
 *      (no trailing `:<method>`) -- used, live, for a `no_consensus_from_scatter` fallback that
 *      fires when independent authorities scatter across DIFFERENT answers with NO plurality
 *      (measured: 3 voters, 3 different letters, maxCount=1 each) and the system picks a default
 *      option anyway. This is provably NOT a computation -- yet it was labeled
 *      'deterministic_compute' and rooted Tier 1 under the old rule, for the "referent object of
 *      security" question (qid 92 in the BP148 corpus, independently flagged by earlier BP144
 *      memory as a false-consensus case).
 *
 * FIX: require the provenance string to be, in its ENTIRETY (anchored start-to-end, never
 * `.includes()`), one of the two well-formed shapes this codebase's real deterministic-compute
 * writers actually produce -- verified against every real occurrence of both prefixes in the
 * live substrate:
 *   - `plow_mc_answerer:solved:deterministic_compute:<method>` (plow_mc_answerer.ts's own
 *     solved-by-a-named-solver marker; `<method>` is the solver's own name -- e.g. `density`,
 *     `physics_kepler`, `aircraft_lift_drag`, `unit_aware`, `bare_value`, `bare_value_match`,
 *     `elimination_cascade_fallback`, `schedule_amortization`, all confirmed real on disk).
 *   - `deterministic_compute:formula:<method>` (the reusable component/formula eblets, same
 *     named-method requirement).
 * A non-empty `<method>` name is REQUIRED -- this is what closes false positive #2 above (the
 * bare no-solver-name marker no longer matches anything). `schedule_amortization` is no longer a
 * separate OR-branch; it is just one more named method under the same anchored
 * `deterministic_compute:` shape, which also closes the old code's stray
 * `p.includes('schedule_amortization')` clause -- that unanchored check also happened to match
 * the unrelated legacy `plow_mc_answerer:compute_method:schedule_amortization:<timestamp>` shape
 * (9 confirmed on disk), a row already independently quarantined by
 * isContaminatedComputeMethodEblet in mnem_eblet_store.ts (not this file's concern) but which
 * never should have been eligible for Tier 1 from this function in the first place.
 *
 * The old `corroboration === 'deterministic_compute'` explicit-flag branch is removed as a
 * standalone path: a self-declared flag with no matching well-formed provenance is the same
 * class of unverifiable self-assertion this fix closes for provenance strings, and it was never
 * actually exercised by the live substrate (confirmed this ticket: zero records in the measured
 * 1,847-line store set `corroboration` to any value at all -- every existing Tier-1 grant flowed
 * through the provenance fallback alone). Tier 1 now always requires the anchored provenance
 * shape above; nothing merely NAMES its way in, whether via `provenance` or `corroboration`.
 *
 * WHAT THIS DOES NOT FIX (disclosed, not smoothed over): a provenance string CAN be well-formed
 * (`plow_mc_answerer:solved:deterministic_compute:<real-solver-name>`) while the solver's own
 * arithmetic/physics was simply wrong on that occasion -- e.g. the live store also holds a
 * `deterministic_compute:bare_value_match`-provenanced WRONG Kepler-binary-star answer and a
 * `deterministic_compute:unit_aware`-provenanced WRONG airplane-lift/drag answer, each sitting
 * beside a correctly-computed answer to the SAME question via the SAME well-formed provenance
 * shape from the SAME named-solver family (`unit_aware` produces both correct and incorrect
 * answers depending on the run -- the solver name alone is not a validity signal, confirmed by
 * reading real records of both outcomes). Distinguishing a well-formed-but-wrong compute from a
 * well-formed-and-right one requires inspecting the actual computed value inside `reasoning` (or
 * the `answer` field) and comparing it against the option text -- data this function is never
 * given: `classifyCorroborationTier(corroboration, provenance)` is called with exactly these two
 * string arguments from mnem_eblet_store.ts's two real call sites (computeHonestVerification's
 * write-time gate and queryVerifiedEblets' read-time re-derivation), and D-BP148-021's own OWNS
 * section forbids editing mnem_eblet_store.ts to widen that call. This fix closes every false
 * positive reachable from a (corroboration, provenance) pair alone; a same-shape-different-
 * correctness contradiction between two well-formed compute records is a different defect
 * needing either a wider call-site signature (a separate ticket, touching a file this one may
 * not) or a correctness check inside each solver itself before it ever writes. Reported honestly
 * in this ticket's own report, not silently declared fixed.
 *
 * Maps mnem_eblet_store.ts's existing VerifiedEbletEntry.corroboration union onto a Rooting
 * Rule tier. This is the ONLY place that translates a corroboration string into a tier --
 * mnem_eblet_store.ts's computeHonestVerification() calls this and then gates on isRooted().
 *
 * A provenance string matching GENUINE_DETERMINISTIC_COMPUTE_PROVENANCE_RE (see above this
 *   function) -> proven (Tier 1: a named solver's own marker, anchored, not a substring guess).
 * 'coroner_verified' (answer_coroner.ts's own explicit ratification, a real ground-truth
 *   comparison) -> ground-truth-checked (Tier 2).
 * 'concordant' (2+ independent authorities/voters merely agreed, no independent ground truth
 *   involved) -> concordant (Tier 3). THE ONE THIS RULE EXISTS TO STOP FROM ROOTING: before
 *   KN-BP142-10, computeHonestVerification() treated this identically to the two tiers above
 *   and granted verified:true; that is the exact defect KN-BP142-6 measured in production
 *   (nine verified:true records for one question, none correct, four minted via a legitimate
 *   concordant accept after the honesty fix had already landed).
 * 'coroner_unverified' -> null. An explicit Coroner REJECTION, never classified into any tier
 *   (never even Tier 3) -- it wins over a provenance-shape deterministic match, same as before.
 * Everything else ('single_authority', 'authority_extracted_compute', 'deterministic_compute'
 *   with no matching well-formed provenance, undefined with no qualifying provenance shape) ->
 *   null. Unclassified/no qualifying signal, honest, never guessed into a tier it did not earn.
 */

/** Anchored (start-to-end) shape of a genuine, named deterministic-solver provenance marker.
 *  See the doc comment above classifyCorroborationTier() for the full evidence trail: every
 *  distinct real provenance string on the live substrate containing 'deterministic_compute' or
 *  'schedule_amortization' was enumerated and checked against this pattern before it was
 *  written. `.includes()` is deliberately never used here again -- a substring match anywhere in
 *  an arbitrary longer string (an ensemble-ledger row, a no-consensus fallback note) is exactly
 *  the defect this ticket closes. */
const GENUINE_DETERMINISTIC_COMPUTE_PROVENANCE_RE =
  /^(?:plow_mc_answerer:solved:deterministic_compute:[a-z][a-z0-9_]*|deterministic_compute:formula:[a-z][a-z0-9_]*)$/;

export function classifyCorroborationTier(
  corroboration: string | undefined,
  provenance?: string,
): RootingTier | null {
  if (corroboration === 'coroner_unverified') return null;

  const p = (provenance ?? '').trim();
  if (GENUINE_DETERMINISTIC_COMPUTE_PROVENANCE_RE.test(p)) {
    return TIER_PROVEN;
  }
  if (corroboration === 'coroner_verified') return TIER_GROUND_TRUTH_CHECKED;
  if (corroboration === 'concordant') return TIER_CONCORDANT;
  return null;
}
