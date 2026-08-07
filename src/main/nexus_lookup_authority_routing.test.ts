// nexus_lookup_authority_routing.test.ts
// SEG: D-BP148-029/BISHOP/per-arm-routing
//
// Test harness for nexus_lookup_authority_routing.ts's planNexusLookupAuthorityRouting() /
// otherNexusBrowserAuthority() -- the pure routing decision that makes the Nexus per-arm
// authority picker (NexusAuthoritySettings.tsx -> nexus_authority_settings_store.ts's
// setArmAuthority(), persisted under localStorage key 'mnemo_nexus_per_arm_authority') actually
// govern which authority index.ts's 'nexus-ask-lookup-fact' handler queries, instead of that
// assignment only ever changing a UI label (the defect this ticket exists to fix).
//
// Mirrors this tree's own prior-art convention for same-process-runnable main-module tests
// (src/main/hex_terminal_telemetry.test.ts, src/main/mnem_eblet_store_serve_ranking.test.ts):
// manual assert() + console output + process.exit(1) on failure, no test-framework dependency
// (this repo has no vitest/jest config wired to a run script), runnable directly via plain
// `node` thanks to Node 24's built-in TypeScript type-stripping (confirmed empirically this
// session: v24.11.0). Unlike the tests that require dist/main/*.js because their source imports
// `electron` at module scope, nexus_lookup_authority_routing.ts has ZERO imports of any kind
// (see that file's own header) -- this harness requires the .ts source DIRECTLY, no build step
// needed, and cannot trip index.ts's module-scope app.whenReady() call because it never touches
// index.ts at all.
//
// CommonJS `require()` (not a top-level ESM `import`), same convention hex_terminal_telemetry.
// test.ts documents in its own header: this file has no ESM import/export marker of its own, so
// tsc treats it as CommonJS/global-script scope under this repo's tsconfig.json ("module":
// "CommonJS") AND plain `node` (no package.json "type": "module") runs it as CJS without
// requiring an explicit '.ts' extension on the require specifier -- Node's ESM loader is the one
// that demands explicit extensions on relative specifiers, and this file never enters ESM mode
// because it contains no top-level `import`/`export` keyword.
//
// Run:
//   node src\main\nexus_lookup_authority_routing.test.ts
//
// What this proves (this ticket's own acceptance bar, restated as assertions):
//   1. No assignment (null, i.e. "could not be read") -> both authorities, google-first,
//      restrictedTo null -- today's exact pre-ticket behavior, unchanged.
//   2. Explicit 'local_free' (the shipped default for every arm) -> same as (1), byte-identical
//      -- an arm nobody has ever touched in the picker must behave exactly as it did before this
//      ticket landed.
//   3. Explicit 'paid_api' -> same as (1) -- no browser-authority implementation exists for it,
//      so it must NOT silently narrow to zero authorities or throw.
//   4. Explicit 'user_google' -> ONLY user_google in the plan, restrictedTo 'user_google'. This
//      is the Founder's actual live assignment (Google -> Lookup) -- the literal defect case.
//   5. Explicit 'user_perplexity' -> ONLY user_perplexity in the plan, restrictedTo
//      'user_perplexity' -- the reverse assignment, proving this isn't a Google-only special
//      case.
//   6. otherNexusBrowserAuthority is a true involution: otherNexusBrowserAuthority(otherNexus
//      BrowserAuthority(x)) === x for both authorities -- the fallback leg (index.ts's handler,
//      when a restricted single-authority attempt returns nothing usable) must always land back
//      on a valid, DIFFERENT authority, never itself, never undefined.
//   7. The master Research Arm switch is NOT this module's concern: the returned plan never
//      carries a researchArmMode/researchArmBrowserAuthority field for any input -- guards
//      against a future accidental scope-creep edit that starts folding that gate in here
//      instead of leaving it to index.ts's isNexusAuthorityFlagEnabled() check.

(function main() {

const { otherNexusBrowserAuthority, planNexusLookupAuthorityRouting } = require('./nexus_lookup_authority_routing.ts');

let passed = 0;
let failed = 0;

function assert(cond: boolean, label: string): void {
  if (cond) {
    passed++;
    console.log(`  PASS: ${label}`);
  } else {
    failed++;
    console.error(`  FAIL: ${label}`);
  }
}

console.log('=== nexus_lookup_authority_routing.test.ts ===');

// --- 1. No assignment (null) -> today's default both-authority behavior -----------------------
{
  const plan = planNexusLookupAuthorityRouting(null);
  assert(
    JSON.stringify(plan.authoritiesToTry) === JSON.stringify(['user_google', 'user_perplexity']),
    "1. null assignment -> authoritiesToTry = ['user_google', 'user_perplexity'] (google-first)",
  );
  assert(plan.restrictedTo === null, '1. null assignment -> restrictedTo null');
}

// --- 2. Explicit 'local_free' -> byte-identical to (1) ------------------------------------------
{
  const plan = planNexusLookupAuthorityRouting('local_free');
  assert(
    JSON.stringify(plan.authoritiesToTry) === JSON.stringify(['user_google', 'user_perplexity']),
    "2. 'local_free' assignment -> authoritiesToTry = ['user_google', 'user_perplexity']",
  );
  assert(plan.restrictedTo === null, "2. 'local_free' assignment -> restrictedTo null");
}

// --- 3. Explicit 'paid_api' -> byte-identical to (1), never narrows to zero --------------------
{
  const plan = planNexusLookupAuthorityRouting('paid_api');
  assert(
    JSON.stringify(plan.authoritiesToTry) === JSON.stringify(['user_google', 'user_perplexity']),
    "3. 'paid_api' assignment -> authoritiesToTry = ['user_google', 'user_perplexity'] (no impl, falls back to default-both, never empty)",
  );
  assert(plan.restrictedTo === null, "3. 'paid_api' assignment -> restrictedTo null");
}

// --- 4. Explicit 'user_google' -> restricted to ONLY user_google (the Founder's live case) -----
{
  const plan = planNexusLookupAuthorityRouting('user_google');
  assert(
    JSON.stringify(plan.authoritiesToTry) === JSON.stringify(['user_google']),
    "4. 'user_google' assignment -> authoritiesToTry = ['user_google'] ONLY (perplexity excluded)",
  );
  assert(plan.restrictedTo === 'user_google', "4. 'user_google' assignment -> restrictedTo 'user_google'");
  assert(!plan.authoritiesToTry.includes('user_perplexity'), '4. perplexity is NOT in the initial plan when Lookup is assigned to Google');
}

// --- 5. Explicit 'user_perplexity' -> restricted to ONLY user_perplexity (the reverse case) -----
{
  const plan = planNexusLookupAuthorityRouting('user_perplexity');
  assert(
    JSON.stringify(plan.authoritiesToTry) === JSON.stringify(['user_perplexity']),
    "5. 'user_perplexity' assignment -> authoritiesToTry = ['user_perplexity'] ONLY (google excluded)",
  );
  assert(plan.restrictedTo === 'user_perplexity', "5. 'user_perplexity' assignment -> restrictedTo 'user_perplexity'");
  assert(!plan.authoritiesToTry.includes('user_google'), '5. google is NOT in the initial plan when Lookup is assigned to Perplexity');
}

// --- 6. otherNexusBrowserAuthority is a true involution -----------------------------------------
{
  assert(otherNexusBrowserAuthority('user_google') === 'user_perplexity', "6a. otherNexusBrowserAuthority('user_google') === 'user_perplexity'");
  assert(otherNexusBrowserAuthority('user_perplexity') === 'user_google', "6b. otherNexusBrowserAuthority('user_perplexity') === 'user_google'");
  assert(
    otherNexusBrowserAuthority(otherNexusBrowserAuthority('user_google')) === 'user_google',
    '6c. otherNexusBrowserAuthority is a true involution for user_google',
  );
  assert(
    otherNexusBrowserAuthority(otherNexusBrowserAuthority('user_perplexity')) === 'user_perplexity',
    '6d. otherNexusBrowserAuthority is a true involution for user_perplexity',
  );
}

// --- 7. Master switch is out of scope for this module -- no such field ever appears ------------
{
  const allInputs = [null, 'local_free', 'user_google', 'user_perplexity', 'paid_api'];
  let anyLeakedField = false;
  for (const input of allInputs) {
    const plan = planNexusLookupAuthorityRouting(input);
    if ('researchArmMode' in plan || 'researchArmBrowserAuthority' in plan) anyLeakedField = true;
  }
  assert(!anyLeakedField, "7. planNexusLookupAuthorityRouting never touches/returns the master-switch fields -- that gate stays index.ts's sole responsibility");
}

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);

})();
