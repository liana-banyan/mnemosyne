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
//
// D-BP148-024/BISHOP (Ask Tab Ladder Wiring) ADDENDUM: sections 8-12 below additionally cover
// isPaidEscalationEnabled(), the money-safety gate added this ticket for the ladder's paid rungs
// (TIER 3/4) and the pre-existing explicit-flagship-brain-pick branch -- both an explicit
// settings opt-in AND a real configured Anthropic credential are required, DEFAULTS OFF (opposite
// of every flag tested in 1-7 above), and neither condition alone is sufficient. Skipped (not
// failed) rather than asserted against a dist/ build compiled before this ticket landed.

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
const { isEscalationLadderModeEnabled, resolveTier1Model, isPaidEscalationEnabled } = mod;

if (typeof isEscalationLadderModeEnabled !== 'function' || typeof resolveTier1Model !== 'function') {
  console.error('FATAL: expected exports isEscalationLadderModeEnabled/resolveTier1Model not found on the compiled module.');
  process.exit(2);
}

// D-BP148-024/BISHOP (Ask Tab Ladder Wiring): isPaidEscalationEnabled is a NEW export this
// ticket adds (money-safety gate for the ladder's TIER 3/4 rungs and the explicit-flagship-
// brain-pick branch). Not present on the module compiled before this ticket landed -- checked
// separately, non-fatally, so this harness still runs its pre-existing assertions 1-7 even
// against a stale dist/ build; section 8-12 below is skipped (not failed) in that case.
const hasIsPaidEscalationEnabled = typeof isPaidEscalationEnabled === 'function';
if (!hasIsPaidEscalationEnabled) {
  console.warn('[ai_dispatch_ipc_escalation_ladder.test.ts] isPaidEscalationEnabled not found on the compiled module -- section 8-12 (money-safety gate) will be SKIPPED. Run `npm run build:main` to pick up D-BP148-024.');
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

// ── 8-12: isPaidEscalationEnabled money-safety gate (D-BP148-024/BISHOP) ──────────────────
//
// What this proves (D-BP148-024's own acceptance bar, restated as assertions): reaching a paid
// rung (TIER 3/4 of the ladder, or the explicit-flagship-brain-pick branch) requires BOTH an
// explicit opt-in AND a real configured credential -- either one alone is not enough, and
// (unlike escalation_ladder_mode/answer_cache_mode/semantic_soccerball_mode above, which all
// DEFAULT ON) this flag DEFAULTS OFF, because it gates real money spend against a frozen budget.

if (hasIsPaidEscalationEnabled) {
  const savedKey = process.env.ANTHROPIC_API_KEY;
  const savedPaidEnv = process.env.PAID_ESCALATION_ENABLED;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.PAID_ESCALATION_ENABLED;

  // 8: undefined settings + no credential -> false. This is the real-world default state for
  // every install today (no settings UI writes this flag yet) -- the Ask tab must never spend
  // money out of the box.
  assert(
    isPaidEscalationEnabled({}) === false,
    'undefined paid_escalation_enabled + no credential resolves false (DEFAULTS OFF, unlike every other flag in this file)',
  );

  // 9: explicit opt-in, but no credential configured -> still false. Opting in alone is not
  // sufficient; per the ticket, "if no key/credential is configured... the ladder must stop".
  assert(
    isPaidEscalationEnabled({ paid_escalation_enabled: true }) === false,
    'explicit opt-in with NO Anthropic credential configured still resolves false',
  );

  // 10: explicit opt-in AND a real (here, fake-but-present) credential -> true. Both conditions
  // met is the only way this resolves true.
  process.env.ANTHROPIC_API_KEY = 'sk-ant-TEST-FAKE-KEY-do-not-use';
  assert(
    isPaidEscalationEnabled({ paid_escalation_enabled: true }) === true,
    'explicit opt-in + a configured credential resolves true (both conditions met)',
  );

  // 11: credential present, but NO explicit opt-in -> false. A credential being configured
  // (e.g. the Founder's own LockBox-loaded ANTHROPIC_API_KEY on a dev machine) must never be
  // read as implicit consent to spend -- this is the exact silent-spend scenario the ticket
  // names as a serious harm.
  assert(
    isPaidEscalationEnabled({}) === false,
    'a configured credential with NO explicit opt-in still resolves false -- credential presence alone is never implicit consent to spend',
  );
  assert(
    isPaidEscalationEnabled({ paid_escalation_enabled: false }) === false,
    'explicit false + a configured credential resolves false (explicit opt-out honored)',
  );

  // 12: PAID_ESCALATION_ENABLED=1 env override still requires a credential -- the env var forces
  // the OPT-IN half true (same OR-in convention as every other flag's env override in this
  // file), but the AND-with-credential half is never bypassed by it.
  process.env.PAID_ESCALATION_ENABLED = '1';
  assert(
    isPaidEscalationEnabled({ paid_escalation_enabled: false }) === true,
    'PAID_ESCALATION_ENABLED=1 env var forces the opt-in half true even over an explicit settings false, WITH a credential present',
  );
  delete process.env.ANTHROPIC_API_KEY;
  assert(
    isPaidEscalationEnabled({ paid_escalation_enabled: false }) === false,
    'PAID_ESCALATION_ENABLED=1 env var alone, with NO credential configured, still resolves false -- the env override cannot substitute for a real credential',
  );

  delete process.env.PAID_ESCALATION_ENABLED;
  if (savedKey !== undefined) process.env.ANTHROPIC_API_KEY = savedKey; else delete process.env.ANTHROPIC_API_KEY;
  if (savedPaidEnv !== undefined) process.env.PAID_ESCALATION_ENABLED = savedPaidEnv; else delete process.env.PAID_ESCALATION_ENABLED;
} else {
  skip('isPaidEscalationEnabled money-safety gate (8-12)', 'export not found on the compiled module -- run `npm run build:main` to pick up D-BP148-024');
}

// ── Summary ─────────────────────────────────────────────────────────────────────────────

console.log(`\n=== ${passed} passed, ${failed} failed, ${skipped} skipped ===\n`);
if (failed > 0) process.exit(1);

})().catch((err) => {
  console.error('FATAL: test harness threw:', err);
  process.exit(2);
});
