// ai_dispatch_ipc_vram_gate.test.ts
// D-BP157-029/BISHOP/seg-rewire-vram-gate
//
// Test harness for resolveVramGatedModel() (ai_dispatch_ipc.ts) -- the new VRAM-gate consultation
// this dispatch wires into 'ai-dispatch:query' and 'ai-dispatch:query-engine's model-resolution
// chains (see this dispatch's own ticket and SEG_RETURN_BP157_021_VRAM_GATE.md section 2, chain
// A). Proves: an explicit pick (model_override) is NEVER downgraded even when it does not fit,
// but the shortfall IS recorded (never silent); a non-explicit/persisted/heuristic pick that
// does not fit IS stepped down via applyVramGate, also recorded; unknown VRAM permits rather than
// blocks or silently shrinks; and the Windows CIM uint32 ~4 GiB ceiling value is never mistaken
// for a real 4 GB reading.
//
// Same constraint as ai_dispatch_ipc_escalation_ladder.test.ts (see that file's header): this
// module imports `electron` (ipcMain, app) at module scope, so it must run against the COMPILED
// dist output via plain `node`, not vitest/ts-node directly. resolveVramGatedModel itself never
// dereferences ipcMain/app -- only applyVramGate/requiredVramGb (ram_detector.ts, confirmed by
// D-BP157-025's own return to have zero electron dependency) and an injected `detector` function
// supplied by every test below, so the real (execSync-based) detector is never invoked here --
// this suite is fully offline.
//
// Run (after `npm run build:main`):
//   node dist\main\ai_dispatch_ipc_vram_gate.test.js

export {};

const fs = require('fs');
const path = require('path');

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

const DIST_MODULE_PATH = path.join(__dirname, '..', '..', 'dist', 'main', 'ai_dispatch_ipc');
if (!fs.existsSync(DIST_MODULE_PATH + '.js')) {
  console.error(
    `FATAL: ${DIST_MODULE_PATH}.js does not exist. Run \`npm run build:main\` first -- ` +
      'this test requires the COMPILED output (see file header for why).',
  );
  process.exit(2);
}

const mod = require(DIST_MODULE_PATH);
const { resolveVramGatedModel } = mod;

if (typeof resolveVramGatedModel !== 'function') {
  console.error('FATAL: expected export resolveVramGatedModel not found on the compiled module.');
  process.exit(2);
}

console.log('\n=== ai_dispatch_ipc VRAM-gate harness (D-BP157-029) ===\n');

type FakeDetection = { vramGb: number | null; method: string; confidence: string; note?: string };
function fakeDetector(result: FakeDetection): () => FakeDetection {
  return () => result;
}

// ── 1: model fits -- unchanged, no downgrade, no note ──────────────────────────────────────
{
  const out = resolveVramGatedModel(
    'gemma2:9b', false,
    fakeDetector({ vramGb: 16, method: 'registry', confidence: 'measured' }),
  );
  assert(out.model === 'gemma2:9b', 'fits: model unchanged', `got "${out.model}"`);
  assert(out.downgraded === false, 'fits: downgraded === false');
  assert(out.note === undefined, 'fits: no note emitted', `got note="${out.note}"`);
}

// ── 2: model does not fit -- downgraded, with an issue recorded ────────────────────────────
{
  // gemma4:12b requires ~8.9 GB; 3 GB VRAM cannot hold it or gemma2:9b (~9.0 GB), lands on
  // gemma2:2b -- the SAME step-down-past-the-unreachable-rung scenario D-BP157-025's own
  // ram_detector.vram_detect.test.ts asserts for the detector layer; this proves the CALLER now
  // actually reaches that behavior instead of never invoking the gate at all.
  const out = resolveVramGatedModel(
    'gemma4:12b', false,
    fakeDetector({ vramGb: 3, method: 'registry', confidence: 'measured' }),
  );
  assert(out.model !== 'gemma4:12b', 'does not fit: model was changed (stepped down)', `got "${out.model}"`);
  assert(out.downgraded === true, 'does not fit: downgraded === true');
  assert(typeof out.note === 'string' && out.note.length > 0, 'does not fit: a legible note was recorded, never silent');
}

// ── 3: explicit override wins even when it does not fit, WITH an issue recorded ────────────
{
  const out = resolveVramGatedModel(
    'gemma4:12b', true,
    fakeDetector({ vramGb: 3, method: 'registry', confidence: 'measured' }),
  );
  assert(out.model === 'gemma4:12b', 'explicit + insufficient: explicit pick still wins, never downgraded', `got "${out.model}"`);
  assert(out.wasExplicit === true, 'explicit + insufficient: wasExplicit === true');
  assert(out.downgraded === false, 'explicit + insufficient: downgraded === false (explicit is never downgraded)');
  assert(
    typeof out.note === 'string' && /insufficient/.test(out.note),
    'explicit + insufficient: a legible issue is still recorded even though the pick was honored',
    `got note="${out.note}"`,
  );
}

// ── 3b: explicit override, sufficient VRAM -- no note, model unchanged ─────────────────────
{
  const out = resolveVramGatedModel(
    'gemma4:12b', true,
    fakeDetector({ vramGb: 16, method: 'registry', confidence: 'measured' }),
  );
  assert(out.model === 'gemma4:12b', 'explicit + sufficient: model unchanged');
  assert(out.note === undefined, 'explicit + sufficient: no note (nothing to flag)');
}

// ── 4: VRAM unknown -- permitted, with a note, never silently shrunk ───────────────────────
{
  const out = resolveVramGatedModel(
    'gemma4:12b', false,
    fakeDetector({ vramGb: null, method: 'none', confidence: 'unknown', note: 'No GPU adapter data available' }),
  );
  assert(out.model === 'gemma4:12b', 'unknown VRAM: candidate is permitted through unchanged, never silently shrunk', `got "${out.model}"`);
  assert(out.downgraded === false, 'unknown VRAM: downgraded === false');
  assert(typeof out.note === 'string' && out.note.length > 0, 'unknown VRAM: a note is still recorded (honest, not silent)');
}

// ── 5: the 4095 MiB CIM ceiling value is never treated as a real 4 GB ──────────────────────
{
  // detectVramGbDetailed()'s own ceiling-rejection logic (D-BP157-025, ram_detector.ts) turns a
  // capped ~4095 MiB CIM reading into vramGb: null, confidence: 'unknown', method:
  // 'cim-capped-rejected' -- never a plausible-looking 4.0 GB. This test proves the CALLER
  // (resolveVramGatedModel) honors that null/unknown as genuinely unknown (case 4's policy),
  // not as "4 GB is available," which would silently under-gate a model that needs more.
  const out = resolveVramGatedModel(
    'gemma4:12b', false,
    fakeDetector({
      vramGb: null,
      method: 'cim-capped-rejected',
      confidence: 'unknown',
      note: 'AdapterRAM reading sits at/above the Windows uint32 ~4 GiB ceiling -- reporting unknown rather than the capped, likely-wrong number',
    }),
  );
  assert(out.model === 'gemma4:12b', 'ceiling-rejected reading: treated as unknown (permit), never as a real 4 GB downgrade trigger', `got "${out.model}"`);
  assert(out.vramGb === null, 'ceiling-rejected reading: vramGb surfaced as null, never a fabricated 4.0');
  assert(out.vramMethod === 'cim-capped-rejected', 'ceiling-rejected reading: method is surfaced honestly in the outcome');
}

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
