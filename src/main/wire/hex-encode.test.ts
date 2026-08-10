// BP087 MAMBA-δ1: unit test for hex wire format v1
// Run: node src/main/wire/hex-encode.test.ts
//
// NOTE ON require() vs import (D-BP151-039): this file previously used ESM `import` syntax
// against an extensionless sibling path (`from './hex-encode'`). TypeScript's `import` is
// ESM-shaped even under a CommonJS compile target, so Node's native type-stripping resolved
// it via strict ESM rules, which do NOT probe the `.ts` extension the way tsc's own
// moduleResolution does -- this threw ERR_MODULE_NOT_FOUND on every run (confirmed empirically
// this session), even though `hex-encode.ts` itself has zero sibling .ts imports and is
// otherwise directly `require()`-able with zero build step. Mirrors this tree's own prior-art
// convention (src/main/crystal/crystal_store.test.ts, src/main/rooting_rule.test.ts): plain
// `require()` with an explicit `.ts` extension, not `import`.

const { encodeFrame, decodeFrame, FRAME_TYPE_MAP } = require('./hex-encode.ts') as typeof import('./hex-encode');

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string): void {
  if (condition) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
  }
}

// ── Test 1: round-trip question frame ────────────────────────────────────────
console.log('\nTest 1 — round-trip question frame');
{
  const payload = { prompt: 'What is 2+2?', options: ['3', '4', '5'] };
  const frame   = encodeFrame('abc123', 'question', payload);
  const decoded = decodeFrame(frame);

  assert(decoded.crcValid,                               'CRC valid');
  assert(decoded.frameType === 'question',               'frameType = question');
  assert((decoded.payload as { prompt: string }).prompt === 'What is 2+2?', 'prompt round-trips');
  assert(
    JSON.stringify((decoded.payload as { options: string[] }).options) === JSON.stringify(['3', '4', '5']),
    'options array round-trips'
  );
  assert(decoded.dispatchId === 'abc123000000000000'.slice(0, 16), 'dispatchId normalised');

  const jsonLen  = JSON.stringify(payload).length;
  const frameLen = frame.length / 2;
  console.log(`  Frame length  : ${frame.length} chars = ${frameLen} bytes`);
  console.log(`  JSON length   : ${jsonLen} chars`);
  console.log(`  Overhead      : ${frameLen - jsonLen} bytes (header 10 + footer 4 + hex doubling)`);
}

// ── Test 2: all frame types encode correctly ──────────────────────────────────
console.log('\nTest 2 — all frame types');
{
  for (const [type, code] of Object.entries(FRAME_TYPE_MAP)) {
    const frame   = encodeFrame('deadbeef12345678', type as import('./hex-encode').FrameType, { x: 1 });
    const decoded = decodeFrame(frame);
    assert(decoded.frameType === type,   `frameType=${type} round-trips (code=${code})`);
    assert(decoded.crcValid,             `CRC valid for ${type}`);
  }
}

// ── Test 3: CRC detects corruption ───────────────────────────────────────────
console.log('\nTest 3 — CRC detects corruption');
{
  const frame   = encodeFrame('cafebabe12345678', 'noop', { ok: true });
  // Flip a char in the body
  const corrupt = frame.slice(0, 25) + (frame[25] === 'a' ? 'b' : 'a') + frame.slice(26);
  const decoded = decodeFrame(corrupt);
  assert(!decoded.crcValid, 'corrupted frame fails CRC');
}

// ── Test 4: broadcast frame with version field ────────────────────────────────
console.log('\nTest 4 — broadcast frame');
{
  const frame   = encodeFrame('00000000-0000-0000-0000-000000000001', 'broadcast', {
    version: '0.5.10',
    restart_mode: 'prompt',
  });
  const decoded = decodeFrame(frame);
  assert(decoded.crcValid,                                               'CRC valid');
  assert(decoded.frameType === 'broadcast',                              'frameType = broadcast');
  assert((decoded.payload as { version: string }).version === '0.5.10', 'version round-trips');
}

// ── Test 5: minimum-size frame (empty payload) ────────────────────────────────
console.log('\nTest 5 — empty payload');
{
  const frame   = encodeFrame('0000000000000000', 'noop', {});
  const decoded = decodeFrame(frame);
  assert(decoded.crcValid,             'CRC valid for empty payload');
  assert(decoded.frameType === 'noop', 'frameType = noop for empty payload');
  console.log(`  Minimum frame : ${frame.length} chars = ${frame.length / 2} bytes`);
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\nhex-encode unit test: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
