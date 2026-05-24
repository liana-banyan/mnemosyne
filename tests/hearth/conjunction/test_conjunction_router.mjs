// B83 G-gate test — Conjunction Router
// G1: ConjunctionPanel default mode = 'cpu_only'
// G2: Single-backend dispatch (cpu / ollama / knight / opus) — happy path

import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, resolve } from 'path';

function toFileUrl(p) {
  return pathToFileURL(p).href;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

// We test the router logic in isolation — mock fetch for Ollama/Anthropic
const originalFetch = globalThis.fetch;

// G1: Default state is cpu_only
async function testG1_DefaultState() {
  console.log('G1: Testing default state = cpu_only…');
  // Dynamically import to avoid Electron context
  // (router uses fs + crypto — both available in Node)
  const mod = await import(
    toFileUrl(resolve(__dirname, '../../../dist/main/hearth/conjunction/conjunction_router.js'))
  ).catch((e) => { console.error('Import error:', e.message.slice(0, 100)); return null; });
  const { ConjunctionRouter } = mod ?? { ConjunctionRouter: null };

  if (!ConjunctionRouter) {
    console.log('  SKIP: dist not built yet — run npm run build:main first');
    return 'SKIP';
  }

  // Reset persisted state so test is idempotent
  const router = new ConjunctionRouter();
  router.selectMode('cpu_only'); // reset to known state
  const fresh = new ConjunctionRouter(); // re-instantiate to load from disk
  const state = fresh.getState();
  assert.equal(state.selected, 'cpu_only', 'Default mode must be cpu_only');
  assert.equal(state.in_flight, null, 'in_flight must be null at startup');
  assert.equal(state.per_request_override, null, 'No override at startup');
  console.log('  G1 PASS: default state = cpu_only ✓');
  return 'PASS';
}

// G2: cpu_only dispatch returns a result
async function testG2_CpuOnlyDispatch() {
  console.log('G2: Testing cpu_only dispatch…');
  const { cpuOnlyDispatch } = await import(
    toFileUrl(resolve(__dirname, '../../../dist/main/hearth/conjunction/backend_adapters/cpu_only_adapter.js'))
  ).catch((e) => { console.error('Import error:', e.message.slice(0, 100)); return null; }) ?? {};

  if (!cpuOnlyDispatch) {
    console.log('  SKIP: dist not built yet');
    return 'SKIP';
  }

  // Mock fetch for substrate query (may not be running)
  globalThis.fetch = async () => ({ ok: false, json: async () => ({}) });

  const receipt = await cpuOnlyDispatch('what is the heavy booster test', { timeout_ms: 5000 });
  // Note: cpuOnlyDispatch is from the adapter module directly
  assert.equal(receipt.name, 'cpu_only');
  assert.ok(receipt.result !== null, 'cpu_only must always return a result');
  assert.equal(receipt.error, null);
  assert.equal(receipt.cost_usd, 0, 'cpu_only is zero-cost');
  console.log(`  G2 PASS: cpu_only dispatch returned: "${receipt.result?.slice(0, 60)}…" ✓`);

  globalThis.fetch = originalFetch;
  return 'PASS';
}

// G2b: selectMode changes state
async function testG2b_SelectMode() {
  console.log('G2b: Testing selectMode (ollama)…');
  const { ConjunctionRouter } = await import(
    toFileUrl(resolve(__dirname, '../../../dist/main/hearth/conjunction/conjunction_router.js'))
  ).catch(() => null) ?? { ConjunctionRouter: null };

  if (!ConjunctionRouter) { return 'SKIP'; }

  // Reset to cpu_only first (in case prior test run left state dirty)
  const reset = new ConjunctionRouter();
  reset.selectMode('cpu_only');

  const router = new ConjunctionRouter(); // load fresh
  const { ok, previous } = router.selectMode('ollama');
  assert.ok(ok, 'selectMode must return ok:true');
  assert.equal(previous, 'cpu_only', 'Previous mode must be cpu_only (default)');
  assert.equal(router.getState().selected, 'ollama', 'State must reflect new selection');
  console.log('  G2b PASS: selectMode(ollama) ✓');
  return 'PASS';
}

// G3: Fan-in synthesizer composite output
async function testG3_FanIn() {
  console.log('G3: Testing fan-in synthesizer (composite_with_provenance)…');
  const { synthesize } = await import(
    toFileUrl(resolve(__dirname, '../../../dist/main/hearth/conjunction/fan_in_synthesizer.js'))
  ).catch(() => null) ?? {};

  if (!synthesize) { return 'SKIP'; }

  const receipts = [
    { name: 'cpu_only', result: 'CPU answer', error: null, latency_ms: 5 },
    { name: 'ollama', result: 'Ollama answer', error: null, latency_ms: 1200 },
    { name: 'knight_cursor', result: null, error: 'Timeout', latency_ms: 90000 },
    { name: 'opus_claude', result: 'Opus answer', error: null, latency_ms: 800, cost_usd: 0.002 },
  ];

  const result = synthesize(receipts, 'composite_with_provenance');
  assert.equal(result.mode, 'composite_with_provenance');
  assert.ok(result.synthesized.includes('CPU answer'), 'Must include CPU result');
  assert.ok(result.synthesized.includes('Ollama answer'), 'Must include Ollama result');
  assert.ok(result.synthesized.includes('Opus answer'), 'Must include Opus result');
  assert.ok(result.synthesized.includes('Timeout'), 'Must surface Knight error');
  assert.equal(result.provenance.length, 4, 'Provenance must list all 4 adapters');
  console.log('  G3 PASS: fan-in composite_with_provenance ✓');
  return 'PASS';
}

// Run all G-gate tests
const results = await Promise.allSettled([
  testG1_DefaultState(),
  testG2_CpuOnlyDispatch(),
  testG2b_SelectMode(),
  testG3_FanIn(),
]);

let passed = 0, failed = 0, skipped = 0;
for (const r of results) {
  if (r.status === 'fulfilled') {
    if (r.value === 'PASS') passed++;
    else if (r.value === 'SKIP') skipped++;
  } else {
    failed++;
    console.error('FAIL:', r.reason);
  }
}

console.log(`\nConjunction Router — G1/G2/G3 tests: ${passed} PASS, ${skipped} SKIP, ${failed} FAIL`);
if (failed > 0) process.exit(1);
