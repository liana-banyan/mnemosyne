// ai_dispatch_ipc_cloud_escalation_receipt.test.ts
// D-BP155-029/BISHOP/seg-meter-net-and-auditlist
//
// Proves _emitCloudEscalationSavingsReceipt() (ai_dispatch_ipc.ts) -- the new call this ticket
// wires into the TIER 3/TIER 4/explicit-flagship-pick call sites -- actually reaches
// substrate_savings_receipt.ts's emitSavingsReceipt() and produces a REAL, non-UNMEASURED
// actual_cost_usd when given a real (here: fabricated-but-shaped-like-dispatchViaBrain's-real-
// output) SEGResultEnvelope whose model_id has a price-table rate. This is the closing proof for
// Task 1's Return item 3 ("a case proving a cloud escalation now contributes real cost").
//
// Same constraint as ai_dispatch_ipc_escalation_ladder.test.ts (see that file's header): this
// module imports `electron` at module scope, so it must run against the COMPILED dist output via
// plain `node`, not vitest/ts-node directly.
//
// Contamination discipline: _setLogPathForTests() points substrate_savings_receipt.ts's log at a
// per-run temp file under os.tmpdir(); a fresh price-table fixture is written to a second temp
// file and passed as SavingsReceiptInput.price_table_path is NOT settable from
// _emitCloudEscalationSavingsReceipt's signature (it always resolves the REAL
// config/substrate_price_table.json path) -- so this harness prices against the REAL repo price
// table on purpose, using a model_id ('claude-sonnet-5') that IS present in it, exactly proving
// the real wiring end to end rather than a fixture-only unit result (substrate_savings_receipt.
// test.ts already covers the fixture-isolated unit behavior). Only the LOG path is redirected to
// a temp file -- the real config/substrate_price_table.json is read-only in this test and never
// written to.
//
// Run (after `npm run build:main`):
//   node dist\main\ai_dispatch_ipc_cloud_escalation_receipt.test.js
// (compiled alongside the other src/main test files by the same tsc -p tsconfig.main.json pass)

// Module-scoped (not a global script): this repo has several sibling test files that follow
// the same manual-assert convention (wire/hex-encode.test.ts, ai_dispatch_ipc_escalation_ladder.
// test.ts) and, without an explicit import/export, TypeScript treats a plain .ts file as a global
// script -- top-level `passed`/`failed`/`assert` would then collide across every such file in one
// tsc -p tsconfig.main.json compile. This `export {}` is the minimal fix: it makes this file a
// module so its top-level declarations are private to it.
export {};

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

const DIST_DIR = path.join(__dirname, '..', '..', 'dist', 'main');
const AI_DISPATCH_PATH = path.join(DIST_DIR, 'ai_dispatch_ipc');
const RECEIPT_PATH = path.join(DIST_DIR, 'substrate_savings_receipt');

for (const p of [AI_DISPATCH_PATH, RECEIPT_PATH]) {
  if (!fs.existsSync(p + '.js')) {
    console.error(`FATAL: ${p}.js does not exist. Run \`npm run build:main\` first.`);
    process.exit(2);
  }
}

const aiDispatchMod = require(AI_DISPATCH_PATH);
const receiptMod = require(RECEIPT_PATH);

const { _emitCloudEscalationSavingsReceipt } = aiDispatchMod;
const { _setLogPathForTests, verifySavingsChain, UNMEASURED } = receiptMod;

if (typeof _emitCloudEscalationSavingsReceipt !== 'function') {
  console.error('FATAL: _emitCloudEscalationSavingsReceipt export not found on compiled ai_dispatch_ipc module.');
  process.exit(2);
}

console.log('\n=== ai_dispatch_ipc cloud-escalation savings-receipt wiring (D-BP155-029) ===\n');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mnemo-cloud-escalation-receipt-test-'));
const logFile = path.join(tmpDir, 'savings_receipts.jsonl');
_setLogPathForTests(logFile);

try {
  // 1: a real-shaped successful flagship SEGResultEnvelope, priced model_id, produces a real
  // (non-UNMEASURED) actual_cost_usd once it flows through _emitCloudEscalationSavingsReceipt.
  const successEnvelope = {
    brain_id: 'claude-sonnet-4-6',
    kind: 'flagship',
    model_id: 'claude-sonnet-5', // priced in the REAL config/substrate_price_table.json
    content: 'x'.repeat(800),
    input_tokens: 900,
    output_tokens: 300,
    latency_ms: 1800,
    error: null,
  };
  _emitCloudEscalationSavingsReceipt(successEnvelope, 'test:ladder_tier4_flagship:claude-sonnet-5:ok');

  const chain1 = verifySavingsChain(logFile);
  assert(chain1.ok === true && chain1.total_records === 1, 'one receipt written and chain intact after a successful cloud call', JSON.stringify(chain1));

  const lines1 = fs.readFileSync(logFile, 'utf-8').trim().split('\n');
  const rec1 = JSON.parse(lines1[0]);
  assert(rec1.tier === 'cloud_escalation', 'receipt tier is cloud_escalation', rec1.tier);
  assert(rec1.flagship_call_avoided === false, 'flagship_call_avoided is false (a paid call was made, not avoided)');
  assert(typeof rec1.actual_cost_usd === 'number' && rec1.actual_cost_usd > 0, 'actual_cost_usd is a REAL positive number, not UNMEASURED', String(rec1.actual_cost_usd));
  // 900/1e6 * input_rate + 300/1e6 * output_rate, whatever the live table's claude-sonnet-5 rate
  // is as of "now" -- assert it is the exact provider-reported-token computation, not a round
  // number/estimate, by recomputing independently from the SAME live price table file.
  const priceTable = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'config', 'substrate_price_table.json'), 'utf-8'));
  const nowIso = new Date().toISOString();
  const candidate = priceTable.rates
    .filter((r: any) => r.model_id === 'claude-sonnet-5' && new Date(r.effective_from).getTime() <= Date.now() && (!r.effective_until || new Date(r.effective_until).getTime() >= Date.now()))
    .sort((a: any, b: any) => new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime())[0];
  if (candidate) {
    const expected = (900 / 1_000_000) * candidate.input_per_mtok_usd + (300 / 1_000_000) * candidate.output_per_mtok_usd;
    assert(Math.abs(rec1.actual_cost_usd - expected) < 1e-9, 'actual_cost_usd matches an independent recomputation from the live price table (real tokens x real rate, not a guess)', `got ${rec1.actual_cost_usd}, expected ${expected}`);
  } else {
    console.warn('  (skip exact-rate check: no currently-effective claude-sonnet-5 rate found in the live price table at test run time)');
  }

  // 2: a failed/errored dispatch (no content, no tokens) still emits a receipt -- honestly
  // UNMEASURED, never fabricated, and never silently dropped.
  const errorEnvelope = {
    brain_id: 'claude-haiku-4-7',
    kind: 'flagship',
    model_id: 'claude-haiku-4-7',
    content: '',
    input_tokens: null,
    output_tokens: null,
    latency_ms: 50,
    error: 'No Anthropic API key configured -- add your own key in Settings to use this brain',
  };
  _emitCloudEscalationSavingsReceipt(errorEnvelope, 'test:ladder_tier3_cheap_cloud:claude-haiku-4-7:error');

  const chain2 = verifySavingsChain(logFile);
  assert(chain2.ok === true && chain2.total_records === 2, 'a second receipt is written (chained) even for a FAILED cloud attempt -- failure is a record, not a silent gap', JSON.stringify(chain2));

  const lines2 = fs.readFileSync(logFile, 'utf-8').trim().split('\n');
  const rec2 = JSON.parse(lines2[1]);
  assert(rec2.actual_cost_usd === UNMEASURED, 'a failed/no-credential cloud attempt resolves UNMEASURED, never a fabricated zero or guess', String(rec2.actual_cost_usd));
  assert(rec2.flagship_call_avoided === false, 'flagship_call_avoided is false even on a failed attempt (nothing was avoided by failing)');

  // 3: a non-fatal guarantee -- calling with a malformed envelope must never throw into the
  // caller (mirrors substrate_api.ts's _emitSavingsReceipt contract).
  let threw = false;
  try {
    _emitCloudEscalationSavingsReceipt(null, 'test:malformed');
  } catch {
    threw = true;
  }
  assert(threw === false, 'a malformed call never throws (non-fatal by design, the answer the user is waiting on must never break)');
} finally {
  _setLogPathForTests(null);
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
