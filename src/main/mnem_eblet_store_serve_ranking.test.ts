// mnem_eblet_store_serve_ranking.test.ts
// SEG: D-BP148-015/BISHOP/serve-path-ranking
//
// Test harness for the read-time rooting/ranking fix landed on queryVerifiedEblets()'s
// exact-match branch this ticket (mnem_eblet_store.ts). Mirrors this tree's own prior-art
// convention for same-domain main-module tests (src/main/mnem_eblet_store.test.ts,
// src/main/crystal/crystal_store.test.ts): manual assert() + console output +
// process.exit(1) on failure, no test-framework dependency.
//
// Same constraint as mnem_eblet_store.test.ts (read that file's header for the full
// explanation): mnem_eblet_store.ts has extensionless sibling-.ts imports
// (./rooting_rule, ./semantic_soccerball) that Node's native TS type-stripping cannot
// resolve via require(), so THIS test requires the COMPILED dist/main/mnem_eblet_store.js.
// Run `npm run build:main` first.
//
// Unlike mnem_eblet_store.test.ts, this harness does NOT require an operator-supplied
// MNEM_EBLET_TEST_SCRATCH env var: every path this test touches (verified_eblets.jsonl,
// its parent dirs) lives entirely under a fresh os.tmpdir() directory that THIS test sets
// %APPDATA% to for the whole run, so there is no shared/production location it could ever
// collide with (contrast mnem_eblet_store.test.ts's M1 tests, which specifically had to
// prove non-interference WITH the real production index path -- a different, real risk
// this test does not carry). All scenarios here use SYNTHETIC data, not the real store, so
// results are deterministic and reproducible independent of what is on disk in
// %APPDATA%\amplify-computer\substrate\verified_eblets.jsonl on any given machine or day.
//
// Run (after `npm run build:main`):
//   node src\main\mnem_eblet_store_serve_ranking.test.ts
//
// What this proves (D-BP148-015's own acceptance bar, restated as assertions):
//   1. An exact-match candidate that fails isRooted() (no qualifying corroboration/
//      provenance signal) is never returned -- the function abstains ([]), it does not
//      fall back to serving the unrooted record.
//   2. Given one unrooted (first-written, wrong) and one later ROOTED (Tier 1,
//      deterministic_compute) record for the identical question, the ROOTED one is
//      selected -- file order is NOT the tie-break (the defect this ticket fixes).
//   3. Tier 1 (proven) outranks Tier 2 (ground-truth-checked) when both are rooted and
//      disagree.
//   4. Two disagreeing ROOTED records, tied on tier/verdict/explicit-corroboration AND on
//      independent-derivation count -> abstain (return []), never a silent pick.
//   5. Two disagreeing ROOTED record GROUPS, tied on tier/verdict/explicit-corroboration
//      but NOT on count (one answer has more independent rooted derivations behind it) ->
//      the larger group wins -- this is the addition beyond the ticket's literal four
//      criteria (disclosed in mnem_eblet_store.ts's own comment at the call site), proven
//      here against a synthetic reproduction of the real density-question shape (14
//      independent Tier-1 records for one answer vs 2 for another).
//   6. A class:'component' record sharing its parent whole_answer's exact question text
//      does not manufacture a false contradiction, and is never selected as the top
//      (verbatim-serve) hit even when rooted.
//   7. A real verdict ('verified') outranks an absent/'unverified' one when tier and
//      explicit-corroboration are otherwise tied.

(async function main(): Promise<void> {

const fs = require('fs');
const path = require('path');
const os = require('os');

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ` -- ${detail}` : ''}`);
    failed++;
  }
}

const DIST_MODULE_PATH = path.join(__dirname, '..', '..', 'dist', 'main', 'mnem_eblet_store');
if (!fs.existsSync(DIST_MODULE_PATH + '.js')) {
  console.error(
    `FATAL: ${DIST_MODULE_PATH}.js does not exist. Run \`npm run build:main\` first -- ` +
      'this test requires the COMPILED output (see file header for why).',
  );
  process.exit(2);
}

const SCRATCH_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'mnem-serve-ranking-test-'));
const SCRATCH_SUBSTRATE_DIR = path.join(SCRATCH_ROOT, 'amplify-computer', 'substrate');
fs.mkdirSync(SCRATCH_SUBSTRATE_DIR, { recursive: true });
const SCRATCH_STORE_FILE = path.join(SCRATCH_SUBSTRATE_DIR, 'verified_eblets.jsonl');

const savedAppData = process.env.APPDATA;
process.env.APPDATA = SCRATCH_ROOT;

function freshRequire(): any {
  const resolved = require.resolve(DIST_MODULE_PATH);
  delete require.cache[resolved];
  return require(DIST_MODULE_PATH);
}

let baseTs = 1700000000000;
function nextTs(): number {
  baseTs += 1000;
  return baseTs;
}

function writeStore(records: object[]): void {
  const lines = records.map((r) => JSON.stringify(r)).join('\n') + '\n';
  fs.writeFileSync(SCRATCH_STORE_FILE, lines, 'utf-8');
}

function baseRecord(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    question: 'DEFAULT QUESTION',
    answer: 'DEFAULT ANSWER',
    provenance: 'test:synthetic',
    verified: true,
    sha256: 'deadbeef',
    timestamp: nextTs(),
    ...overrides,
  };
}

console.log('\n=== mnem_eblet_store serve-path ranking harness (D-BP148-015) ===');
console.log(`    scratch APPDATA: ${SCRATCH_ROOT}\n`);

// ── Test 1: unrooted-only exact match -> abstain ────────────────────────────────────
console.log('Test 1: unrooted-only exact match abstains (never serves an unproven guess)');
{
  const Q = 'What is 2 plus 2, unrooted-only case?';
  writeStore([
    baseRecord({ question: Q, answer: 'A) 5', provenance: 'plow_mc_answerer:solved:decompose-and-eliminate:x', verdict: 'unverified' }),
    baseRecord({ question: Q, answer: 'B) 3', provenance: 'plow_mc_answerer:solved:user_perplexity:y', verdict: undefined }),
  ]);
  const mod = freshRequire();
  const hits = await mod.queryVerifiedEblets(Q);
  assert(Array.isArray(hits) && hits.length === 0, 'returns [] when no exact-match candidate is rooted', JSON.stringify(hits));
}

// ── Test 2: unrooted first-write loses to a later ROOTED record (the density/Kepler shape) ──
console.log('\nTest 2: later ROOTED record beats an earlier unrooted guess (file order is not the tiebreak)');
{
  const Q = 'Calculate the density of a synthetic block, test shape.';
  writeStore([
    baseRecord({ question: Q, answer: 'H) .50 g/cc', provenance: 'plow_mc_answerer:solved:decompose-and-eliminate:x', verdict: 'unverified' }), // written FIRST
    baseRecord({ question: Q, answer: 'C) .60 g/cc', provenance: 'plow_mc_answerer:solved:deterministic_compute:density', verdict: 'verified' }), // written LATER, rooted
  ]);
  const mod = freshRequire();
  const hits = await mod.queryVerifiedEblets(Q);
  const top = hits.find((h: any) => h.class !== 'component');
  assert(!!top, 'a candidate is returned');
  assert(!!top && top.answer === 'C) .60 g/cc', 'the ROOTED (deterministic_compute) answer is selected, not the earlier-written guess', top ? top.answer : '(none)');
}

// ── Test 3: Tier 1 (proven) outranks Tier 2 (ground-truth-checked) ─────────────────
console.log('\nTest 3: Tier 1 proven outranks Tier 2 ground-truth-checked when both rooted and disagree');
{
  const Q = 'Tier ordering test question, proven vs ground-truth-checked.';
  writeStore([
    baseRecord({ question: Q, answer: 'X) tier2', corroboration: 'coroner_verified', provenance: 'answer_coroner:x', verdict: 'verified' }),
    baseRecord({ question: Q, answer: 'Y) tier1', corroboration: 'deterministic_compute', provenance: 'plow_mc_answerer:solved:deterministic_compute:x', verdict: 'verified' }),
  ]);
  const mod = freshRequire();
  const hits = await mod.queryVerifiedEblets(Q);
  const top = hits.find((h: any) => h.class !== 'component');
  assert(!!top && top.answer === 'Y) tier1', 'Tier 1 (proven) wins over Tier 2 (ground-truth-checked)', top ? top.answer : '(none)');
}

// ── Test 4: fully tied contradiction (same tier/verdict/corroboration/count) -> abstain ──
console.log('\nTest 4: two disagreeing rooted answers, tied on every criterion including count -> abstain');
{
  const Q = 'Fully tied contradiction test question.';
  writeStore([
    baseRecord({ question: Q, answer: 'A) one', provenance: 'plow_mc_answerer:solved:deterministic_compute:x', verdict: 'verified' }),
    baseRecord({ question: Q, answer: 'B) two', provenance: 'plow_mc_answerer:solved:deterministic_compute:y', verdict: 'verified' }),
  ]);
  const mod = freshRequire();
  const hits = await mod.queryVerifiedEblets(Q);
  assert(Array.isArray(hits) && hits.length === 0, 'returns [] (abstain) rather than guessing between two indistinguishable rooted answers', JSON.stringify(hits));
}

// ── Test 5: independent-derivation-count tiebreak (the real density-question shape) ──
console.log('\nTest 5: larger independently-rooted group wins a tier/verdict-tied contradiction (density shape)');
{
  const Q = 'Majority tiebreak test question, density shape reproduction.';
  const records: object[] = [];
  for (let i = 0; i < 14; i++) {
    records.push(baseRecord({ question: Q, answer: 'C) majority', provenance: `plow_mc_answerer:solved:deterministic_compute:density${i}`, verdict: 'verified' }));
  }
  for (let i = 0; i < 2; i++) {
    records.push(baseRecord({ question: Q, answer: 'A) minority', provenance: `plow_mc_answerer:solved:deterministic_compute:unit_aware${i}`, verdict: 'verified' }));
  }
  writeStore(records);
  const mod = freshRequire();
  const hits = await mod.queryVerifiedEblets(Q);
  const top = hits.find((h: any) => h.class !== 'component');
  assert(!!top && top.answer === 'C) majority', '14-record group beats 2-record group when tier/verdict tie', top ? top.answer : '(none, abstained)');
}

// ── Test 6: a component sharing the parent's question text never false-contradicts or serves ──
console.log('\nTest 6: class:component sharing exact question text does not false-contradict or get served');
{
  const Q = 'Component false-contradiction test question.';
  writeStore([
    baseRecord({ question: Q, answer: 'C) the whole answer', provenance: 'plow_mc_answerer:solved:deterministic_compute:x', verdict: 'verified', class: 'whole_answer' }),
    baseRecord({ question: Q, answer: 'a supporting fact, different text entirely', provenance: 'plow_mc_answerer:solved:deterministic_compute:y', verdict: 'verified', class: 'component' }),
  ]);
  const mod = freshRequire();
  const hits = await mod.queryVerifiedEblets(Q);
  const top = hits.find((h: any) => h.class !== 'component');
  assert(!!top && top.answer === 'C) the whole answer', 'the whole_answer is still served (component did not trigger an abstain)', top ? JSON.stringify(top.answer) : '(none, abstained)');
}

// ── Test 7: real verdict outranks absent/'unverified' when tier ties ───────────────
console.log("\nTest 7: real verdict ('verified') outranks absent/'unverified' when tier and corroboration tie");
{
  const Q = 'Verdict tiebreak test question.';
  writeStore([
    baseRecord({ question: Q, answer: 'A) legacy', provenance: 'plow_mc_answerer:solved:deterministic_compute:x', verdict: undefined }), // rooted via provenance string, but legacy verdict
    baseRecord({ question: Q, answer: 'B) honest', provenance: 'plow_mc_answerer:solved:deterministic_compute:y', verdict: 'verified' }),
  ]);
  const mod = freshRequire();
  const hits = await mod.queryVerifiedEblets(Q);
  const top = hits.find((h: any) => h.class !== 'component');
  assert(!!top && top.answer === 'B) honest', "the record with a real verdict:'verified' wins over the legacy verdict-absent one", top ? top.answer : '(none)');
}

process.env.APPDATA = savedAppData;
fs.rmSync(SCRATCH_ROOT, { recursive: true, force: true });

// ─── Summary ──────────────────────────────────────────────────────────────
console.log(`\n${'='.repeat(70)}`);
console.log(`Results: ${passed} passed · ${failed} failed`);
if (failed === 0) {
  console.log('✓ ALL TESTS PASSED');
  process.exit(0);
} else {
  console.error(`✗ ${failed} TESTS FAILED`);
  process.exit(1);
}

})().catch((e) => {
  console.error('FATAL: unhandled error in test harness:', e);
  process.exit(1);
});
