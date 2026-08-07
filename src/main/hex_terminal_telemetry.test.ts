// hex_terminal_telemetry.test.ts
// SEG: D-BP148-001/KNIGHT/M4/seg-m4h2p
//
// Test harness for hex_terminal_telemetry.ts. Mirrors this tree's own prior-art convention for
// same-process-runnable main-module tests (src/main/crystal/crystal_store.test.ts,
// src/main/wire/hex-encode.test.ts): manual assert() + console output + process.exit(1) on
// failure, no test-framework dependency (this repo has no vitest config wired to a run script),
// runnable directly via plain `node` thanks to Node 24's built-in TypeScript type-stripping
// (confirmed empirically this session: v24.5.0, commonjs mode, no build step needed).
//
// REQUIRES the caller to set MNEM_HEX_TELEMETRY_DIR to a scratch directory before invoking this
// file (same reasoning as crystal_store.test.ts: the module resolves its storage location once
// at load time, and this harness needs a clean, disposable directory for deterministic counts
// across repeated runs). Example:
//   $env:MNEM_HEX_TELEMETRY_DIR = "C:\...\_hex_telemetry_test_scratch"
//   node src\main\hex_terminal_telemetry.test.ts
//
// Tests:
//   1. countWireTokens is a real, deterministic count (not bytes/4; empty string = 0).
//   2. recordHexExchange pairs handle_cost_tokens and prose_cost_tokens on ONE record from ONE
//      call (Measurement 2).
//   3. mode_chosen derivation: cheaper handle side -> 'handle'; more expensive -> 'transparent'
//      (Measurement 5).
//   4. Resolution failure charges effective_cost_tokens = handle + prose (Measurement 4 HOW).
//   5. Full-content-fetch events are recorded separately and never folded into exchange totals
//      (CELPANE LAW).
//   6. readAllHexTelemetryRecords reads back everything just written, from disk, with 0 parse
//      errors on a well-formed log.
//   7. computeBreakEvenByHandle finds the real reuse-count crossing on a synthetic multi-reuse
//      sequence, and reports null (not a guess) when the crossing has not yet been observed.
//   8. computeResolutionFailureRate and computeModeStats roll up correctly across a mixed set.

// NOTE ON require() placement: everything -- including the `fs` require -- lives INSIDE the
// IIFE below, not at top level. This file has no ESM import/export marker, so tsc treats it as
// global-script scope (same reasoning as crystal_store.test.ts's header comment); a top-level
// `const { existsSync, ... } = require('fs')` here collides with sibling test files in this tree
// that declare an identically-named top-level `existsSync` the same way (confirmed empirically:
// `tsc -p tsconfig.main.json` reported exactly this TS2451 redeclare error against
// crystal_store.test.ts until this was moved inside the IIFE). Wrapping everything in the IIFE's
// function scope avoids the collision without touching any file this ticket doesn't own.
(function main(): void {

const { existsSync, mkdirSync, rmSync } = require('fs');

const SCRATCH_DIR = process.env.MNEM_HEX_TELEMETRY_DIR;
if (!SCRATCH_DIR) {
  console.error(
    'FATAL: set MNEM_HEX_TELEMETRY_DIR to a scratch directory before running this test file.'
  );
  process.exit(2);
}
if (existsSync(SCRATCH_DIR)) rmSync(SCRATCH_DIR, { recursive: true, force: true });
mkdirSync(SCRATCH_DIR, { recursive: true });

const {
  countWireTokens,
  recordHexExchange,
  recordFullContentFetch,
  readAllHexTelemetryRecords,
  computeWireTokenTotals,
  computeBreakEvenByHandle,
  computeResolutionFailureRate,
  computeModeStats,
  computeHexTelemetrySummary,
  getHexTelemetryLogPath,
} = require('./hex_terminal_telemetry.ts');

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    console.log(`  \u2713 ${label}`);
    passed++;
  } else {
    console.error(`  \u2717 FAIL: ${label}${detail ? ' -- ' + detail : ''}`);
    failed++;
  }
}

// ── Test 1: countWireTokens is real and deterministic ──────────────────────
console.log('\nTest 1: countWireTokens');
{
  assert(countWireTokens('') === 0, 'empty string = 0 tokens');
  const a = countWireTokens('hello, world!');
  const b = countWireTokens('hello, world!');
  assert(a === b, 'deterministic (same input -> same count)', `${a} vs ${b}`);
  assert(a > 0, 'non-empty text produces > 0 tokens', String(a));
  // "hello" "," "world" "!" = 4 lexical units -- NOT text.length/4 (13/4 = 3.25).
  assert(a === 4, 'counts lexical units, not bytes/4', `got ${a}, expected 4`);
}

// ── Test 2: paired handle/prose cost on one record (Measurement 2) ─────────
console.log('\nTest 2: recordHexExchange pairs handle+prose cost on one record');
{
  const rec = recordHexExchange({
    content_address: 'sid:test-pair-001',
    reuse_index: 1,
    handle_address_text: 'sid:test-pair-001',
    celpane_text: 'celpane: 3-line summary of a design doc',
    prose_text:
      'This is the full prose content that the handle and celpane stand in for, on the ' +
      'same exchange, at the same moment, so the comparison is never contaminated by a ' +
      'different run or different content.',
    resolution_attempted: true,
    resolution_succeeded: true,
  });
  assert(rec.record_type === 'exchange', 'record_type = exchange');
  assert(typeof rec.handle_cost_tokens === 'number' && rec.handle_cost_tokens > 0, 'handle_cost_tokens present and > 0');
  assert(typeof rec.prose_cost_tokens === 'number' && rec.prose_cost_tokens > 0, 'prose_cost_tokens present and > 0');
  assert(rec.prose_cost_tokens > rec.handle_cost_tokens, 'prose costs more than handle+celpane in this example', `${rec.prose_cost_tokens} vs ${rec.handle_cost_tokens}`);
}

// ── Test 3: mode_chosen derivation (Measurement 5) ──────────────────────────
console.log('\nTest 3: mode_chosen derivation');
{
  const cheapHandle = recordHexExchange({
    content_address: 'sid:test-mode-cheap',
    reuse_index: 1,
    handle_address_text: 'sid:abc',
    celpane_text: 'x',
    prose_text: 'this is a much longer piece of prose than the tiny handle and celpane above',
    resolution_attempted: true,
    resolution_succeeded: true,
  });
  assert(cheapHandle.mode_chosen === 'handle', 'cheap handle side -> mode=handle', cheapHandle.mode_chosen);

  const expensiveHandle = recordHexExchange({
    content_address: 'sid:test-mode-expensive',
    reuse_index: 1,
    handle_address_text: 'sid:this-handle-address-is-actually-quite-long-for-a-handle',
    celpane_text: 'and the celpane here is also padded out with a lot of extra descriptive text on top',
    prose_text: 'hi',
    resolution_attempted: true,
    resolution_succeeded: true,
  });
  assert(expensiveHandle.mode_chosen === 'transparent', 'expensive handle side -> mode=transparent', expensiveHandle.mode_chosen);
  assert(expensiveHandle.effective_cost_tokens === expensiveHandle.prose_cost_tokens, 'transparent mode charges prose cost as the effective cost');
}

// ── Test 4: resolution failure cost (Measurement 4 HOW) ─────────────────────
console.log('\nTest 4: resolution failure charges handle+prose');
{
  const failed_ = recordHexExchange({
    content_address: 'sid:test-resfail',
    reuse_index: 2,
    handle_address_text: 'sid:test-resfail',
    celpane_text: 'celpane summary',
    prose_text: 'the full prose content this handle would have stood in for on this exchange',
    resolution_attempted: true,
    resolution_succeeded: false,
  });
  assert(
    failed_.effective_cost_tokens === failed_.handle_cost_tokens + failed_.prose_cost_tokens,
    'failed resolution: effective_cost_tokens = handle_cost_tokens + prose_cost_tokens',
    `${failed_.effective_cost_tokens} vs ${failed_.handle_cost_tokens} + ${failed_.prose_cost_tokens}`
  );
}

// ── Test 5: full-content-fetch is a separate event (CELPANE LAW) ───────────
console.log('\nTest 5: full-content-fetch recorded separately, not folded into exchange totals');
{
  const before = computeWireTokenTotals(readAllHexTelemetryRecords().records);
  const fetchRec = recordFullContentFetch({
    content_address: 'sid:test-pair-001',
    full_content_text: 'the complete, un-summarized original document, fetched explicitly, on purpose',
    reason: 'test: explicit full-content fetch',
  });
  assert(fetchRec.record_type === 'full_content_fetch', 'record_type = full_content_fetch');
  const after = computeWireTokenTotals(readAllHexTelemetryRecords().records);
  assert(
    after.handle_side_total_tokens === before.handle_side_total_tokens &&
      after.prose_side_total_tokens === before.prose_side_total_tokens,
    'exchange-side totals unchanged by a full-content-fetch event'
  );
  assert(
    after.full_content_fetch_total_tokens === before.full_content_fetch_total_tokens + fetchRec.full_content_cost_tokens,
    'full_content_fetch_total_tokens increased by exactly this event\'s cost'
  );
  assert(after.full_content_fetch_events === before.full_content_fetch_events + 1, 'full_content_fetch_events incremented');
}

// ── Test 6: read-back from disk matches what was written ───────────────────
console.log('\nTest 6: readAllHexTelemetryRecords reads back everything written, no parse errors');
{
  const { records, parse_errors } = readAllHexTelemetryRecords();
  assert(records.length >= 5, 'at least the 5 records written above are present', String(records.length));
  assert(parse_errors === 0, 'no parse errors on a well-formed log', String(parse_errors));
  const logPath = getHexTelemetryLogPath();
  assert(existsSync(logPath), 'log file physically exists on disk at the reported path', logPath);
}

// ── Test 7: break-even is a real reuse count N, not a fabricated guess ─────
console.log('\nTest 7: computeBreakEvenByHandle -- real crossing point, honest null when unreached');
{
  // Hand-verifiable arithmetic, using single-letter-word "tokens" so countWireTokens' word-run
  // rule makes the token count equal to the word count exactly:
  //   handle_address_text='h' celpane_text='c' -> handle_cost_tokens = 1 + 1 = 2
  //   prose_text = 12 x 'p' -> prose_cost_tokens = 12
  //   mode: 2 <= 12 -> 'handle' chosen every exchange below (never falls back).
  //   reuse 1: first_reference_overhead_tokens=15 (mint+write+resolve) ->
  //     effective = 2 + 15 = 17.  cumHandle=17 cumProse=12 -> 17 <= 12 is FALSE: net loss,
  //     exactly as spec sec. 3 says the first reference always is.
  //   reuse 2: no overhead -> effective = 2. cumHandle=19 cumProse=24 -> 19 <= 24 is TRUE:
  //     break-even reached at N=2.
  const addr = 'sid:test-breakeven-001';
  const PROSE_12 = 'p p p p p p p p p p p p';

  recordHexExchange({
    content_address: addr,
    reuse_index: 1,
    handle_address_text: 'h',
    celpane_text: 'c',
    prose_text: PROSE_12,
    resolution_attempted: true,
    resolution_succeeded: true,
    first_reference_overhead_tokens: 15,
  });
  for (let i = 2; i <= 5; i++) {
    recordHexExchange({
      content_address: addr,
      reuse_index: i,
      handle_address_text: 'h',
      celpane_text: 'c',
      prose_text: PROSE_12,
      resolution_attempted: true,
      resolution_succeeded: true,
    });
  }
  const results = computeBreakEvenByHandle(readAllHexTelemetryRecords().records);
  const mine = results.find((r: any) => r.content_address === addr);
  assert(!!mine, 'break-even result present for this content_address');
  assert(mine.observed_reuses === 5, 'observed_reuses = 5', String(mine.observed_reuses));
  assert(mine.break_even_reuse_count === 2, 'break_even_reuse_count = 2, hand-verified against the arithmetic above', String(mine.break_even_reuse_count));

  // A handle that pays mint overhead once and is NEVER reused: must stay a net loss forever,
  // i.e. break-even must be null (honest "not yet observed"), never fabricated.
  const neverReused = 'sid:test-breakeven-never-reused';
  recordHexExchange({
    content_address: neverReused,
    reuse_index: 1,
    handle_address_text: 'h',
    celpane_text: 'c',
    prose_text: PROSE_12,
    resolution_attempted: true,
    resolution_succeeded: true,
    first_reference_overhead_tokens: 15,
  });
  const neverResults = computeBreakEvenByHandle(readAllHexTelemetryRecords().records);
  const neverMine = neverResults.find((r: any) => r.content_address === neverReused);
  assert(neverMine.break_even_reuse_count === null, 'single net-loss reference with no reuse -> break_even_reuse_count = null (not fabricated)', String(neverMine.break_even_reuse_count));
}

// ── Test 8: rollups across a mixed set ──────────────────────────────────────
console.log('\nTest 8: computeResolutionFailureRate / computeModeStats rollups');
{
  const { records } = readAllHexTelemetryRecords();
  const resStats = computeResolutionFailureRate(records);
  assert(resStats.attempts > 0, 'resolution attempts counted', String(resStats.attempts));
  assert(resStats.failures >= 1, 'at least the one deliberate failure from Test 4 is counted', String(resStats.failures));
  assert(
    Math.abs(resStats.failure_rate - resStats.failures / resStats.attempts) < 1e-9,
    'failure_rate = failures / attempts'
  );

  const modeStats = computeModeStats(records);
  assert(modeStats.total_exchanges === modeStats.handle_mode_count + modeStats.transparent_mode_count, 'handle + transparent counts sum to total');
  assert(modeStats.transparent_mode_count >= 1, 'at least the one deliberate transparent-mode case from Test 3 is counted', String(modeStats.transparent_mode_count));

  const summary = computeHexTelemetrySummary(records, 0);
  assert(summary.wire_tokens.handle_side_total_tokens > 0, 'summary rolls up wire token totals');
  assert(summary.break_even_by_handle.length >= 1, 'summary rolls up break-even results');
}

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\nhex_terminal_telemetry.test.ts: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

})();
