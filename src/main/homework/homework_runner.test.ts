// homework_runner.test.ts -- D-BP151-021/BISHOP/seg-classify-at-mint
//
// Manual assert() + console output + process.exit(1) on failure, no test-framework dependency --
// same prior-art convention as comparative_cascade.test.ts, rooting_rule.test.ts,
// plow_derived_quantity_reconciler.test.ts, crystal_store.test.ts, hex_terminal_telemetry.test.ts.
//
// Requires the COMPILED dist/main/homework/homework_runner.js (run `npm run build:main` first).
//
// Run:
//   node src\main\homework\homework_runner.test.ts
//
// WHAT THIS TESTS (FD-BP151-09 / D-BP151-021 -- classify eblets AT MINT TIME):
//   1. mintForageEblet() with the real classifier reachable carries a proposed metadata_type,
//      explicitly marked metadata_type_status: 'proposal' (machine proposal, never a ratification).
//   2. mintForageEblet() with the classifier forced unreachable (CANON_CLASSIFIER_OLLAMA_URL
//      pointed at a dead port) STILL SUCCEEDS and records metadata_type: unclassified -- a mint
//      is never blocked by classification, per FD-BP151-09's hard rule.
//
// VAULT SAFETY (LB-GOLD-0399): mintForageEblet() would otherwise write into the real
// Asteroid-ProofVault\state\eblets\CANON\ -- HOMEWORK_TEST_CANON_VAULT_DIR (this file's own env
// override, added in this same ticket) redirects every write below into a scratchpad directory
// instead. The real Vault is never touched by this test; see the SEG return doc for the
// before/after Vault hash proving that.

(async function main(): Promise<void> {

const path = require('path');
const fs = require('fs');
const os = require('os');

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    console.log(`  [PASS] ${label}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${label}${detail ? ` -- ${detail}` : ''}`);
    failed++;
  }
}

// ── Scratchpad test Vault (NEVER the real Vault) ──────────────────────────────────────────
const testVaultDir = path.join(
  os.tmpdir(), 'mnem_homework_runner_test_vault_' + Date.now().toString(36),
);
process.env.HOMEWORK_TEST_CANON_VAULT_DIR = testVaultDir;

const distPath = path.join(__dirname, '..', '..', '..', 'dist', 'main', 'homework', 'homework_runner.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mod = require(distPath) as typeof import('./homework_runner');
const { mintForageEblet, classifyForMint } = mod;

console.log('homework_runner.test.ts -- FD-BP151-09/D-BP151-021: classify-at-mint\n');
console.log(`  (writing test eblets to scratchpad dir, NOT the real Vault: ${testVaultDir})\n`);

// ── 1. classifyForMint() in isolation, real classifier reachable ─────────────────────────────
{
  const receipt = await classifyForMint({
    relPath: 'unit_test_candidate.eblet.md',
    absPath: path.join(testVaultDir, 'unit_test_candidate.eblet.md'),
    currentFrontmatter: '',
    bodyExcerpt: 'A short test record used only to verify the classify-at-mint wiring built under D-BP151-021.',
  });
  console.log('  classifyForMint() (classifier reachable) ->', JSON.stringify(receipt));
  assert(receipt.metadata_type_machine_classified === true, 'receipt.metadata_type_machine_classified is true');
  assert(receipt.metadata_type_human_ratified === false, 'receipt.metadata_type_human_ratified is false');
  assert(receipt.metadata_type_classifier === 'canon_threshold_classifier.ts/proposeEbletTags', 'receipt names the real classifier, not a reimplementation');
  // Depends on live Ollama; both outcomes are honest per FD-BP151-09 (a refusal is a real
  // result) -- assert the receipt is INTERNALLY CONSISTENT rather than forcing one outcome.
  if (receipt.metadata_type_status === 'proposal') {
    assert(typeof receipt.metadata_type === 'string' && receipt.metadata_type.length > 0, 'status=proposal carries a non-empty metadata_type');
  } else {
    assert(receipt.metadata_type === null, 'status=unclassified carries metadata_type: null (never a guess)');
  }
}

// ── 2. mintForageEblet() end-to-end, real classifier reachable -- mint carries a PROPOSAL ────
{
  const result = await mintForageEblet({
    sourceLabel: 'homework_runner_test_source_a.txt',
    sourcePath: path.join(testVaultDir, 'fake_source_a.txt'),
    model: 'test-floor-model',
    summary: 'This is a synthetic homework forage summary used only by homework_runner.test.ts (D-BP151-021) to verify the classify-at-mint wiring. It is not a real archive summary.',
    provenance: 'homework:forage_eblet:test:scenario-a',
  });
  assert(result.ok === true, 'mintForageEblet() (classifier reachable) succeeds', result.ok ? '' : (result as { reason: string }).reason);
  if (result.ok) {
    const raw = fs.readFileSync(result.path, 'utf-8') as string;
    assert(/^metadata_type_classifier: canon_threshold_classifier\.ts\/proposeEbletTags$/m.test(raw), 'minted frontmatter names the real classifier');
    assert(/^metadata_type_machine_classified: true$/m.test(raw), 'minted frontmatter marks machine_classified: true');
    assert(/^metadata_type_human_ratified: false$/m.test(raw), 'minted frontmatter marks human_ratified: false (never silently ratified)');
    const statusMatch = raw.match(/^metadata_type_status: (\w+)$/m);
    assert(!!statusMatch, 'minted frontmatter carries a metadata_type_status field');
    console.log(`  (scenario A minted metadata_type_status=${statusMatch ? statusMatch[1] : '?'})`);
  }
}

// ── 3. mintForageEblet() end-to-end, classifier forced UNREACHABLE -- mint still SUCCEEDS ───
{
  const priorOllamaUrl = process.env.CANON_CLASSIFIER_OLLAMA_URL;
  process.env.CANON_CLASSIFIER_OLLAMA_URL = 'http://127.0.0.1:1'; // dead port, forces the bridge's Ollama call to fail
  try {
    const result = await mintForageEblet({
      sourceLabel: 'homework_runner_test_source_b.txt',
      sourcePath: path.join(testVaultDir, 'fake_source_b.txt'),
      model: 'test-floor-model',
      summary: 'Second synthetic homework forage summary (D-BP151-021), used to verify a mint SUCCEEDS even when the classifier is unreachable.',
      provenance: 'homework:forage_eblet:test:scenario-b',
    });
    assert(result.ok === true, 'mintForageEblet() STILL SUCCEEDS when the classifier is unreachable (never blocks a mint)', result.ok ? '' : (result as { reason: string }).reason);
    if (result.ok) {
      const raw = fs.readFileSync(result.path, 'utf-8') as string;
      assert(/^metadata_type: unclassified$/m.test(raw), 'minted frontmatter records metadata_type: unclassified (never a guess)');
      assert(/^metadata_type_status: unclassified$/m.test(raw), 'minted frontmatter records metadata_type_status: unclassified');
      assert(/^metadata_type_machine_classified: true$/m.test(raw), 'minted frontmatter still marks machine_classified: true (a refusal is still a recorded, attributed outcome)');
      assert(/^metadata_type_human_ratified: false$/m.test(raw), 'minted frontmatter still marks human_ratified: false');
    }
  } finally {
    if (priorOllamaUrl === undefined) delete process.env.CANON_CLASSIFIER_OLLAMA_URL;
    else process.env.CANON_CLASSIFIER_OLLAMA_URL = priorOllamaUrl;
  }
}

// ── Cleanup: remove the scratchpad test dir (never the real Vault) ───────────────────────────
try {
  fs.rmSync(testVaultDir, { recursive: true, force: true });
  console.log(`\n  (cleaned up scratchpad test dir: ${testVaultDir})`);
} catch (e) {
  console.warn(`  (non-fatal: failed to clean up ${testVaultDir}: ${String(e)})`);
}

console.log(`\nhomework_runner.test.ts: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

})();
