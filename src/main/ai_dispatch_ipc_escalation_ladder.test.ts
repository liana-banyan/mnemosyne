// ai_dispatch_ipc_escalation_ladder.test.ts
// SEG: D-BP148-022/BISHOP/local-first-ladder
//
// Test harness for the local-first escalation-ladder default flip landed this ticket
// (ai_dispatch_ipc.ts): escalation_ladder_mode now DEFAULTS ON (was off), and TIER 1's model
// choice now prefers the strongest confirmed-installed local model (llama3.3:70b) UNLESS the
// caller made an explicit pick. Mirrors this tree's own prior-art convention for same-domain
// main-module tests (src/main/mnem_eblet_store_serve_ranking.test.ts, src/main/hex_terminal_
// telemetry.test.ts): manual assert() + console output + process.exit(1) on failure, no
// test-framework dependency.
//
// Same constraint as the other tests in this tree: ai_dispatch_ipc.ts imports `electron`
// (ipcMain, app) at module scope. Outside a real Electron process, Node's `require('electron')`
// resolves to a plain path STRING (not an object), so `import { ipcMain, app } from 'electron'`
// destructures to `ipcMain === undefined, app === undefined` -- this does NOT throw at import
// time, and neither function under test here (isEscalationLadderModeEnabled, resolveTier1Model)
// ever dereferences ipcMain/app, so requiring the COMPILED dist/main/ai_dispatch_ipc.js directly
// via plain `node` works. This test never calls registerAiDispatchIPC() (that's the function
// that would touch ipcMain).
//
// Run (after `npm run build:main`):
//   node src\main\ai_dispatch_ipc_escalation_ladder.test.ts
//
// What this proves (this ticket's own acceptance bar, restated as assertions):
//   1. isEscalationLadderModeEnabled: undefined (every settings file written before this
//      ticket) resolves true -- the actual default flip.
//   2. isEscalationLadderModeEnabled: explicit `false` resolves false -- the opt-out still
//      works, preserving explicit user intent to turn the ladder off entirely.
//   3. isEscalationLadderModeEnabled: explicit `true` resolves true (unaffected).
//   4. isEscalationLadderModeEnabled: ESCALATION_LADDER_MODE=1 env var forces true even over
//      an explicit settings `false` -- same OR-in precedent as every other mode resolver in
//      this file.
//   5. resolveTier1Model: an explicit model pick is NEVER overridden, even when the preferred
//      strong model is installed -- explicit user/setting intent wins over the new default.
//   6. resolveTier1Model: with no explicit pick and Ollama reachable, if llama3.3:70b is
//      installed it is preferred over the fallback -- the actual "make local Ollama the first
//      MODEL rung, strongest available" behavior this ticket adds. SKIPPED (not failed) if
//      Ollama at 127.0.0.1:11434 is unreachable or llama3.3:70b is not installed on this
//      machine -- this assertion is real-network-dependent by design (there is no mock
//      injection point for ollamaManager in this file), consistent with this ticket's
//      "measure, do not assert" mandate: it proves the real local daemon's real state, not a
//      simulated one.
//   7. resolveTier1Model: with no explicit pick and Ollama unreachable (or the preferred model
//      not installed), falls back to `fallbackModel` untouched -- never throws, never widens.

(async function main(): Promise<void> {

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;
let skipped = 0;

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ` -- ${detail}` : ''}`);
    failed++;
  }
}

function skip(label: string, reason: string): void {
  console.log(`  ○ SKIPPED ${label} -- ${reason}`);
  skipped++;
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
const { isEscalationLadderModeEnabled, resolveTier1Model } = mod;

if (typeof isEscalationLadderModeEnabled !== 'function' || typeof resolveTier1Model !== 'function') {
  console.error('FATAL: expected exports isEscalationLadderModeEnabled/resolveTier1Model not found on the compiled module.');
  process.exit(2);
}

console.log('\n=== ai_dispatch_ipc escalation-ladder local-first harness (D-BP148-022) ===\n');

// ── 1-4: isEscalationLadderModeEnabled default-flip + precedence ──────────────────────────

const savedEnv = process.env.ESCALATION_LADDER_MODE;
delete process.env.ESCALATION_LADDER_MODE;

assert(
  isEscalationLadderModeEnabled({}) === true,
  'undefined escalation_ladder_mode resolves true (the default flip this ticket makes)',
);

assert(
  isEscalationLadderModeEnabled({ escalation_ladder_mode: false }) === false,
  'explicit false resolves false (opt-out preserved, no env override)',
);

assert(
  isEscalationLadderModeEnabled({ escalation_ladder_mode: true }) === true,
  'explicit true resolves true',
);

process.env.ESCALATION_LADDER_MODE = '1';
assert(
  isEscalationLadderModeEnabled({ escalation_ladder_mode: false }) === true,
  'ESCALATION_LADDER_MODE=1 env var forces true even over an explicit settings false',
);
delete process.env.ESCALATION_LADDER_MODE;
if (savedEnv !== undefined) process.env.ESCALATION_LADDER_MODE = savedEnv;

// ── 5: resolveTier1Model never overrides an explicit pick ─────────────────────────────────

const explicitResult = await resolveTier1Model('gemma4:12b', 'qwen2.5:0.5b');
assert(
  explicitResult === 'qwen2.5:0.5b',
  'explicit model pick is honored: fallbackModel returned untouched, never the preferred strong model',
  `got "${explicitResult}"`,
);

// ── 6-7: resolveTier1Model with no explicit pick, against the REAL local Ollama daemon ────

const FALLBACK_SENTINEL = 'qwen2.5:0.5b-TEST-FALLBACK-SENTINEL';
let ollamaReachable = false;
let llama70bInstalled = false;
try {
  const pingCtrl = new AbortController();
  const pingTmo = setTimeout(() => pingCtrl.abort(), 3000);
  const res = await fetch('http://127.0.0.1:11434/api/tags', { signal: pingCtrl.signal });
  clearTimeout(pingTmo);
  if (res.ok) {
    ollamaReachable = true;
    const data = await res.json() as { models?: Array<{ name: string }> };
    llama70bInstalled = (data.models ?? []).some((m) => m.name === 'llama3.3:70b');
  }
} catch {
  ollamaReachable = false;
}

if (ollamaReachable && llama70bInstalled) {
  const noExplicitResult = await resolveTier1Model(undefined, FALLBACK_SENTINEL);
  assert(
    noExplicitResult === 'llama3.3:70b',
    'no explicit pick + llama3.3:70b installed -> TIER 1 prefers llama3.3:70b over the fallback',
    `got "${noExplicitResult}"`,
  );
} else {
  skip(
    'no explicit pick + llama3.3:70b installed -> prefers llama3.3:70b',
    `real Ollama daemon at 127.0.0.1:11434 ${ollamaReachable ? 'reachable but llama3.3:70b not installed' : 'unreachable'} on this machine`,
  );
}

if (!ollamaReachable) {
  const unreachableResult = await resolveTier1Model(undefined, FALLBACK_SENTINEL);
  assert(
    unreachableResult === FALLBACK_SENTINEL,
    'Ollama unreachable + no explicit pick -> falls back to fallbackModel untouched, never throws',
    `got "${unreachableResult}"`,
  );
} else {
  skip(
    'Ollama unreachable -> falls back to fallbackModel untouched',
    'real Ollama daemon at 127.0.0.1:11434 IS reachable on this machine -- cannot exercise the unreachable branch without a mock injection point',
  );
}

// ── Summary ─────────────────────────────────────────────────────────────────────────────

console.log(`\n=== ${passed} passed, ${failed} failed, ${skipped} skipped ===\n`);
if (failed > 0) process.exit(1);

})().catch((err) => {
  console.error('FATAL: test harness threw:', err);
  process.exit(2);
});
