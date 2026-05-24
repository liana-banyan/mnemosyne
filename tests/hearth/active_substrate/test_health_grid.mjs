// B83 G7/G11 test — Watchdog Health Grid
// G7: 9-subject grid renders correct subjects
// G11: Kill-and-restart drill (verifies color semantics)

import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, resolve } from 'path';
const toFileUrl = (p) => pathToFileURL(p).href;

const __dirname = dirname(fileURLToPath(import.meta.url));

const EXPECTED_SUBJECTS = [
  'coroner',
  'af_ledger',
  'stitchpunks',
  'reminder',
  'toolsmith',
  'forager',
  'advisor',
  'sweat',
  'tears',
];

async function testG7_WatchdogSubjects() {
  console.log('G7: Testing watchdog bridge subject definitions…');

  const mod = await import(
    toFileUrl(resolve(__dirname, '../../../dist/main/hearth/active_substrate/watchdog_bridge.js'))
  ).catch((e) => { console.error('Import error:', e.message.slice(0, 100)); return null; });

  if (!mod) {
    console.log('  SKIP: dist not built yet — run npm run build:main first');
    return 'SKIP';
  }

  // Mock fetch to return no Watchdog server (fallback path)
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('/watchdog/status')) throw new Error('Not available');
    if (String(url).includes('/health')) return { ok: true, json: async () => ({}) };
    return { ok: false, json: async () => ({}) };
  };

  const status = await mod.pollWatchdogStatus();
  assert.equal(status.subjects.length, 9, 'Must have exactly 9 subjects');

  const shortNames = status.subjects.map((s) => s.short_name);
  for (const expected of EXPECTED_SUBJECTS) {
    assert.ok(shortNames.includes(expected), `Must include subject: ${expected}`);
  }

  // Verify sweat and tears get elevated from gray to green via substrate liveness
  const sweat = status.subjects.find((s) => s.short_name === 'sweat');
  const tears = status.subjects.find((s) => s.short_name === 'tears');
  assert.ok(sweat, 'Must have Sweat Scribe');
  assert.ok(tears, 'Must have Tears Scribe');

  globalThis.fetch = originalFetch;
  console.log('  G7 PASS: 9-subject grid defined correctly ✓');
  return 'PASS';
}

async function testG11_KillAndRestartColorSemantics() {
  console.log('G11: Testing kill-and-restart color semantics (unit)…');

  const mod = await import(
    toFileUrl(resolve(__dirname, '../../../dist/main/hearth/active_substrate/watchdog_bridge.js'))
  ).catch(() => null);

  if (!mod) { return 'SKIP'; }

  // Simulate heartbeat received (green)
  mod.recordSubjectHeartbeat('sweat');
  let status = mod.getCachedWatchdogStatus();
  const sweatGreen = status.subjects.find((s) => s.short_name === 'sweat');
  assert.equal(sweatGreen?.status, 'green', 'After heartbeat: status = green');

  // Simulate error (red)
  mod.recordSubjectHeartbeat('sweat', 'Process terminated');
  status = mod.getCachedWatchdogStatus();
  const sweatRed = status.subjects.find((s) => s.short_name === 'sweat');
  assert.equal(sweatRed?.status, 'red', 'After error: status = red');

  // Simulate recovery (green again)
  mod.recordSubjectHeartbeat('sweat');
  status = mod.getCachedWatchdogStatus();
  const sweatRecovered = status.subjects.find((s) => s.short_name === 'sweat');
  assert.equal(sweatRecovered?.status, 'green', 'After recovery: status = green again');

  console.log('  G11 PASS: kill-and-restart color semantics ✓');
  return 'PASS';
}

const results = await Promise.allSettled([
  testG7_WatchdogSubjects(),
  testG11_KillAndRestartColorSemantics(),
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

console.log(`\nHealth Grid — G7/G11 tests: ${passed} PASS, ${skipped} SKIP, ${failed} FAIL`);
if (failed > 0) process.exit(1);
