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
 * Maps mnem_eblet_store.ts's existing VerifiedEbletEntry.corroboration union onto a Rooting
 * Rule tier. This is the ONLY place that translates a corroboration string into a tier --
 * mnem_eblet_store.ts's computeHonestVerification() calls this and then gates on isRooted().
 *
 * 'deterministic_compute' (or a provenance string literally containing 'deterministic_compute'
 *   or 'schedule_amortization', the same provenance-string check computeHonestVerification()
 *   carried before this ticket) -> proven (Tier 1: a calculator/solver proved it).
 * 'coroner_verified' (answer_coroner.ts's own explicit ratification, a real ground-truth
 *   comparison) -> ground-truth-checked (Tier 2).
 * 'concordant' (2+ independent authorities/voters merely agreed, no independent ground truth
 *   involved) -> concordant (Tier 3). THE ONE THIS RULE EXISTS TO STOP FROM ROOTING: before
 *   this ticket, computeHonestVerification() treated this identically to the two tiers above
 *   and granted verified:true; that is the exact defect KN-BP142-6 measured in production
 *   (nine verified:true records for one question, none correct, four minted via a legitimate
 *   concordant accept after the honesty fix had already landed).
 * 'coroner_unverified' -> null. An explicit Coroner REJECTION, never classified into any tier
 *   (never even Tier 3) -- it wins over a provenance-string deterministic match, same as
 *   before this ticket.
 * Everything else ('single_authority', 'authority_extracted_compute', undefined with no
 *   deterministic provenance signal) -> null. Unclassified/no qualifying signal, honest,
 *   never guessed into a tier it did not earn.
 */
export function classifyCorroborationTier(
  corroboration: string | undefined,
  provenance?: string,
): RootingTier | null {
  if (corroboration === 'coroner_unverified') return null;

  const p = provenance ?? '';
  const deterministicByProvenance = p.includes('deterministic_compute') || p.includes('schedule_amortization');
  if (corroboration === 'deterministic_compute' || deterministicByProvenance) {
    return TIER_PROVEN;
  }
  if (corroboration === 'coroner_verified') return TIER_GROUND_TRUTH_CHECKED;
  if (corroboration === 'concordant') return TIER_CONCORDANT;
  return null;
}
