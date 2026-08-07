// rooting_rule.test.ts
// SEG: D-BP148-021/BISHOP/tier-check-tighten
//
// Test harness for rooting_rule.ts's classifyCorroborationTier()/isRooted() tightening.
// Mirrors this tree's own prior-art convention for same-process-runnable main-module tests
// (src/main/crystal/crystal_store.test.ts, src/main/hex_terminal_telemetry.test.ts): manual
// assert() + console output + process.exit(1) on failure, no test-framework dependency,
// runnable directly via plain `node` (Node 24's built-in TypeScript type-stripping, commonjs
// mode, confirmed empirically this session -- no build step needed, since rooting_rule.ts has
// ZERO sibling-module imports of its own and so never hits the extensionless-import resolution
// failure mnem_eblet_store.test.ts's header documents for ITS target module).
//
// Run:
//   node src\main\rooting_rule.test.ts
//
// Tests:
//   1. The old defect, verified GONE: an unanchored substring match ('deterministic_compute'
//      appearing ANYWHERE in a longer provenance string) no longer grants Tier 1 -- covers both
//      real false-positive shapes measured live on the substrate this ticket (D-BP148-021):
//        (a) `answer_coroner:ensemble_candidate:deterministic_compute_reasoning_fact` -- the
//            per-candidate RGBY ledger shape, an authority-extracted value with no independent
//            grounding.
//        (b) a bare `plow_mc_answerer:solved:deterministic_compute` marker with no solver name.
//   2. Genuine, well-formed named-solver provenance still roots Tier 1 (never widened away) --
//      every real solver-name suffix confirmed on the live substrate this ticket.
//      (density, physics_kepler, aircraft_lift_drag, unit_aware, bare_value, bare_value_match,
//      elimination_cascade_fallback, schedule_amortization), both the `plow_mc_answerer:solved:`
//      shape and the `deterministic_compute:formula:` component shape.
//   3. The old stray `schedule_amortization` OR-branch is gone: the unrelated legacy
//      `plow_mc_answerer:compute_method:schedule_amortization:<timestamp>` shape (a DIFFERENT
//      literal middle segment, "compute_method" not "solved:deterministic_compute") no longer
//      qualifies for Tier 1 from this function (it was never meant to -- that shape is quarantined
//      elsewhere in mnem_eblet_store.ts, not this file's job to also grant it Tier 1 in the
//      meantime).
//   4. The bare `corroboration === 'deterministic_compute'` flag, unaccompanied by a matching
//      well-formed provenance string, no longer roots Tier 1 on its own (closes a future-write
//      loophole; confirmed unused by the real live substrate as measured this ticket -- zero
//      records set `corroboration` to any value at all).
//   5. Regression fixture: the EXACT real provenance strings captured from the live
//      verified_eblets.jsonl substrate this ticket (BISHOP_DROPZONE\ROOTING_PASS_BP148_DRY_RUN.md
//      + this ticket's own follow-up read), for both records that lost Tier 1 and records that
//      correctly keep it -- so a future accidental re-loosening of the regex is caught here
//      before it ever touches the live store again.
//   6. Tier 2 (coroner_verified), Tier 3 (concordant), and the coroner_unverified/null paths are
//      all unchanged by this ticket -- still exactly the pre-existing KN-BP142-10 behavior.
//   7. isRooted(): unchanged sanity (Tier 1/2 root, Tier 3/null do not).
//   8. Monotonicity/safety property: nothing that was NOT Tier-1 under the old (loose) rule
//      becomes Tier-1 under the new (tight) rule -- demoting is the only direction this ticket
//      may move a record. Checked directly against a reimplementation of the OLD predicate on a
//      table of real + synthetic provenance strings.

// NOTE ON require() vs import, and the wrapping IIFE: this file has no ESM import/export marker
// of its own, so tsc treats it as global-script scope (same reasoning as crystal_store.test.ts's
// and hex_terminal_telemetry.test.ts's own header comments) -- a bare top-level `const` here
// would collide with identically-named top-level consts in sibling test files under the same
// `tsc -p tsconfig.main.json` program. Wrapping everything in this IIFE avoids the collision
// without touching any file this ticket doesn't own.
(function main(): void {

const {
  classifyCorroborationTier,
  isRooted,
  TIER_PROVEN,
  TIER_GROUND_TRUTH_CHECKED,
  TIER_CONCORDANT,
} = require('./rooting_rule.ts');

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}${detail ? ' -- ' + detail : ''}`);
    failed++;
  }
}

function tierOf(corroboration: string | undefined, provenance?: string): string | null {
  return classifyCorroborationTier(corroboration, provenance);
}

// ── Test 1: the old defect is gone ──────────────────────────────────────────
console.log('\nTest 1: unanchored substring false positives no longer root');
{
  // (a) real shape: answer_coroner ensemble-candidate ledger row, provenance CONTAINS
  // 'deterministic_compute' only as part of a longer, unrelated literal.
  assert(
    tierOf(undefined, 'answer_coroner:ensemble_candidate:deterministic_compute_reasoning_fact') === null,
    'ensemble_candidate:deterministic_compute_reasoning_fact -> null (not Tier 1)',
  );
  // (b) real shape: bare marker, no solver name at all.
  assert(
    tierOf(undefined, 'plow_mc_answerer:solved:deterministic_compute') === null,
    'bare plow_mc_answerer:solved:deterministic_compute (no :<method>) -> null (not Tier 1)',
  );
  // A provenance string that merely mentions the phrase in prose (not even a real prefix shape).
  assert(
    tierOf(undefined, 'note: this record did not go through deterministic_compute at all') === null,
    'arbitrary prose containing the phrase -> null',
  );
}

// ── Test 2: genuine named-solver provenance still roots Tier 1 ─────────────
console.log('\nTest 2: well-formed named-solver provenance still roots Tier 1');
{
  const solvedSolvers = [
    'density', 'physics_kepler', 'aircraft_lift_drag', 'unit_aware',
    'bare_value', 'bare_value_match', 'elimination_cascade_fallback', 'schedule_amortization',
  ];
  for (const s of solvedSolvers) {
    assert(
      tierOf(undefined, `plow_mc_answerer:solved:deterministic_compute:${s}`) === TIER_PROVEN,
      `plow_mc_answerer:solved:deterministic_compute:${s} -> proven`,
    );
  }
  const formulaSolvers = ['density', 'physics_kepler', 'aircraft_lift_drag', 'unit_aware', 'bare_value', 'schedule_amortization'];
  for (const s of formulaSolvers) {
    assert(
      tierOf(undefined, `deterministic_compute:formula:${s}`) === TIER_PROVEN,
      `deterministic_compute:formula:${s} -> proven`,
    );
  }
}

// ── Test 3: the stray schedule_amortization OR-branch is gone ──────────────
console.log('\nTest 3: legacy compute_method:schedule_amortization shape no longer roots');
{
  assert(
    tierOf(undefined, 'plow_mc_answerer:compute_method:schedule_amortization:1785521418440') === null,
    'plow_mc_answerer:compute_method:schedule_amortization:<ts> -> null (different shape, quarantined elsewhere)',
  );
}

// ── Test 4: bare corroboration flag alone no longer roots ──────────────────
console.log('\nTest 4: corroboration:"deterministic_compute" alone (no matching provenance) no longer roots');
{
  assert(
    tierOf('deterministic_compute', undefined) === null,
    'corroboration flag with no provenance -> null',
  );
  assert(
    tierOf('deterministic_compute', 'spider:some_authority:session123') === null,
    'corroboration flag with unrelated provenance -> null',
  );
  // But it still roots when the provenance ITSELF is well-formed (the provenance shape is what
  // carries the evidence now, not the caller's own self-declared flag).
  assert(
    tierOf('deterministic_compute', 'plow_mc_answerer:solved:deterministic_compute:density') === TIER_PROVEN,
    'corroboration flag + well-formed provenance -> proven (provenance shape carries it)',
  );
}

// ── Test 5: regression fixture -- exact real strings from the live substrate ───
console.log('\nTest 5: regression fixture against real captured substrate strings (BP148)');
{
  // Real WRONG-but-formerly-Tier-1 record: "referent object of security" no_consensus_from_scatter
  // fallback (qid 92) -- 3 voters scattered across 3 different letters, no plurality, and the
  // system defaulted to an option anyway, mislabeled 'deterministic_compute'.
  assert(
    tierOf(undefined, 'plow_mc_answerer:solved:deterministic_compute') === null,
    'no_consensus_from_scatter fallback marker (qid 92 shape) -> null',
  );
  // Real WRONG-but-formerly-Tier-1 record: airplane lift/drag "I" answer via the ensemble-ledger
  // reasoning_fact shape.
  assert(
    tierOf(undefined, 'answer_coroner:ensemble_candidate:deterministic_compute_reasoning_fact') === null,
    'airplane-lift-drag "I" ensemble reasoning_fact shape -> null',
  );
  // Real CORRECT, still-rooted records for the four contradiction questions (density C, Kepler E,
  // airplane E, Jane Morrow J) -- must NOT be collaterally demoted by this fix.
  assert(tierOf(undefined, 'plow_mc_answerer:solved:deterministic_compute:density') === TIER_PROVEN, 'density solver (real shape) -> proven');
  assert(tierOf(undefined, 'plow_mc_answerer:solved:deterministic_compute:physics_kepler') === TIER_PROVEN, 'physics_kepler solver (real shape) -> proven');
  assert(tierOf(undefined, 'plow_mc_answerer:solved:deterministic_compute:aircraft_lift_drag') === TIER_PROVEN, 'aircraft_lift_drag solver (real shape) -> proven');
  assert(tierOf(undefined, 'plow_mc_answerer:solved:deterministic_compute:bare_value') === TIER_PROVEN, 'bare_value solver (real shape, Jane Morrow) -> proven');
  // Real WRONG-but-still-Tier-1-under-this-fix records: disclosed, not silently smoothed over --
  // a well-formed provenance from a real named solver that happened to compute wrong that run.
  // This function has no access to `reasoning`/`answer` (only corroboration+provenance, the two
  // arguments mnem_eblet_store.ts's real call sites actually pass), so these remain proven; see
  // this file's own doc comment on classifyCorroborationTier for the full disclosure.
  assert(tierOf(undefined, 'plow_mc_answerer:solved:deterministic_compute:bare_value_match') === TIER_PROVEN, 'bare_value_match solver (real shape, Kepler WRONG answer D) -> still proven, disclosed limitation');
  assert(tierOf(undefined, 'plow_mc_answerer:solved:deterministic_compute:unit_aware') === TIER_PROVEN, 'unit_aware solver (real shape, produces BOTH correct and wrong answers) -> still proven, disclosed limitation');
}

// ── Test 6: Tier 2 / Tier 3 / null paths unchanged ──────────────────────────
console.log('\nTest 6: coroner_verified / concordant / coroner_unverified unchanged');
{
  assert(tierOf('coroner_verified', undefined) === TIER_GROUND_TRUTH_CHECKED, "corroboration:'coroner_verified' -> ground-truth-checked");
  assert(tierOf('concordant', undefined) === TIER_CONCORDANT, "corroboration:'concordant' -> concordant (Tier 3, never roots)");
  assert(tierOf('coroner_unverified', 'plow_mc_answerer:solved:deterministic_compute:density') === null, "corroboration:'coroner_unverified' wins over a well-formed deterministic provenance -> null");
  assert(tierOf('single_authority', undefined) === null, "corroboration:'single_authority' -> null");
  assert(tierOf('authority_extracted_compute', undefined) === null, "corroboration:'authority_extracted_compute' -> null");
  assert(tierOf(undefined, undefined) === null, 'no signal at all -> null');
}

// ── Test 7: isRooted() sanity ───────────────────────────────────────────────
console.log('\nTest 7: isRooted() sanity');
{
  assert(isRooted(TIER_PROVEN) === true, 'proven is rooted');
  assert(isRooted(TIER_GROUND_TRUTH_CHECKED) === true, 'ground-truth-checked is rooted');
  assert(isRooted(TIER_CONCORDANT) === false, 'concordant is NOT rooted');
  assert(isRooted(null) === false, 'null is NOT rooted');
  assert(isRooted(undefined) === false, 'undefined is NOT rooted');
}

// ── Test 8: monotonicity -- nothing gains Tier 1 that lacked it under the old rule ──
console.log('\nTest 8: monotonicity (only demotions, never a new grant)');
{
  function oldTierOf(corroboration: string | undefined, provenance?: string): string | null {
    if (corroboration === 'coroner_unverified') return null;
    const p = provenance ?? '';
    const deterministicByProvenance = p.includes('deterministic_compute') || p.includes('schedule_amortization');
    if (corroboration === 'deterministic_compute' || deterministicByProvenance) return TIER_PROVEN;
    if (corroboration === 'coroner_verified') return TIER_GROUND_TRUTH_CHECKED;
    if (corroboration === 'concordant') return TIER_CONCORDANT;
    return null;
  }

  const fixtures: Array<[string | undefined, string | undefined]> = [
    [undefined, 'answer_coroner:ensemble_candidate:deterministic_compute_reasoning_fact'],
    [undefined, 'plow_mc_answerer:solved:deterministic_compute'],
    [undefined, 'plow_mc_answerer:compute_method:schedule_amortization:1785521418440'],
    ['deterministic_compute', undefined],
    ['deterministic_compute', 'spider:some_authority:session123'],
    [undefined, 'plow_mc_answerer:solved:deterministic_compute:density'],
    [undefined, 'plow_mc_answerer:solved:deterministic_compute:unit_aware'],
    [undefined, 'deterministic_compute:formula:physics_kepler'],
    ['coroner_verified', undefined],
    ['concordant', undefined],
    [undefined, undefined],
    ['single_authority', 'plow_mc_answerer:solved:wikipedia:https://en.wikipedia.org/wiki/X'],
  ];

  let anyPromotion = false;
  for (const [c, p] of fixtures) {
    const before = isRooted(oldTierOf(c, p));
    const after = isRooted(tierOf(c, p));
    if (after && !before) {
      anyPromotion = true;
      console.error(`  ✗ PROMOTION DETECTED: (${c}, ${p}) was not rooted before, is rooted now`);
    }
  }
  assert(!anyPromotion, 'no fixture gained Tier-1 rootedness under the new rule that lacked it under the old rule');
}

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\nrooting_rule.test.ts: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

})();
