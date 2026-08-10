// cdp_guard.test.ts -- D-BP151-038/BISHOP/seg-cdp-guard
//
// Test harness for cdp_guard.ts. Mirrors this tree's own prior-art convention for same-domain
// main-module tests (src/main/mnem_eblet_store.test.ts, src/main/ai_dispatch_ipc_escalation_
// ladder.test.ts): manual assert() + console output + process.exit(1) on failure, no
// test-framework dependency (this repo has no vitest config wired to a run script).
//
// Requires the COMPILED output (`npm run build:main` first) -- same reason as ai_dispatch_ipc_
// escalation_ladder.test.ts: `import { app } from 'electron'` resolves `app` to `undefined`
// outside a real Electron process (require('electron') resolves to a plain path STRING there),
// and the packaged-refusal branches need a REAL fake `app` object injected via require.cache
// (mnem_eblet_store.test.ts's own precedent, Test 3, "real-Electron passthrough") to exercise
// enforcePackagedCdpRefusal()'s true/false branches deterministically, without ever spawning a
// real Electron process or actually calling process.exit from inside this harness.
//
// Run (after `npm run build:main`):
//   node src\main\cdp_guard.test.ts
//
// What this proves (this ticket's own acceptance bar, restated as assertions):
//   1. isCdpRequested / getRequestedCdpPort: correct argv parsing, including the no-value and
//      malformed-value cases (never guesses a port).
//   2. enforcePackagedCdpRefusal: refuses (calls app.exit(1), returns true) ONLY when BOTH
//      app.isPackaged===true AND the CDP switch is present -- never on packaged-without-CDP,
//      never on CDP-without-packaged (dev:main:cdp's own exact shape), matching the guard's
//      whole reason to exist (D-BP151-034 table B6 / Founder BP151 "Build the guard.").
//   3. logCdpDevExposureBanner: logs exactly once per process even across repeated calls (no
//      log-flooding a long dev session).
//   4. startCdpAttachWatcher: returns null when CDP was not requested (the overwhelmingly common
//      case -- must never start a timer then); returns a live, stoppable handle when it was.

(async function main(): Promise<void> {

const fs = require('fs');
const path = require('path');
const Module = require('module');

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

const DIST_MODULE_PATH = path.join(__dirname, '..', '..', 'dist', 'main', 'cdp_guard');
if (!fs.existsSync(DIST_MODULE_PATH + '.js')) {
  console.error(
    `FATAL: ${DIST_MODULE_PATH}.js does not exist. Run \`npm run build:main\` first -- ` +
      'this test requires the COMPILED output (see file header for why).',
  );
  process.exit(2);
}

const electronResolvedPath = require.resolve('electron');
const distResolvedPath = require.resolve(DIST_MODULE_PATH);

/** Injects a fake `electron` module (require.cache injection, NOT a real Electron process --
 *  same technique as mnem_eblet_store.test.ts Test 3) exposing the given `app` shape, then
 *  requires a FRESH copy of the compiled cdp_guard module so its static
 *  `import { app } from 'electron'` binding picks up the fake. Always deletes both cache
 *  entries afterward via the returned restore() so nothing later in this process (or a require
 *  of the real module elsewhere) observes the mock. */
function freshCdpGuardWithFakeApp(fakeApp: Record<string, unknown> | undefined): { mod: any; restore: () => void } {
  const savedElectronEntry = require.cache[electronResolvedPath];
  const savedDistEntry = require.cache[distResolvedPath];
  delete require.cache[distResolvedPath];
  if (fakeApp === undefined) {
    delete require.cache[electronResolvedPath];
  } else {
    require.cache[electronResolvedPath] = {
      id: electronResolvedPath,
      filename: electronResolvedPath,
      loaded: true,
      exports: { app: fakeApp },
    } as any;
  }
  const mod = require(DIST_MODULE_PATH);
  const restore = () => {
    delete require.cache[distResolvedPath];
    if (savedElectronEntry) require.cache[electronResolvedPath] = savedElectronEntry;
    else delete require.cache[electronResolvedPath];
    if (savedDistEntry) require.cache[distResolvedPath] = savedDistEntry;
  };
  return { mod, restore };
}

console.log('\n=== cdp_guard harness (D-BP151-038) ===\n');

// ── 1: isCdpRequested / getRequestedCdpPort -- pure argv parsing ──────────────────────────
{
  const { isCdpRequested, getRequestedCdpPort, CDP_PORT } = require(DIST_MODULE_PATH);

  assert(CDP_PORT === 9333, 'CDP_PORT constant matches package.json:12\'s --remote-debugging-port value (9333)', String(CDP_PORT));

  assert(
    isCdpRequested(['electron', '.', '--remote-debugging-port=9333']) === true,
    'isCdpRequested: true for --remote-debugging-port=9333 (the exact dev:main:cdp invocation)',
  );
  assert(
    isCdpRequested(['electron', '.', '--remote-debugging-port']) === true,
    'isCdpRequested: true for bare --remote-debugging-port (no =value)',
  );
  assert(
    isCdpRequested(['electron', '.']) === false,
    'isCdpRequested: false for a plain launch (npm run dev:main shape)',
  );
  assert(
    isCdpRequested(['electron', '.', '--remote-debugging-port-foo=1']) === false,
    'isCdpRequested: does not false-positive on a switch that merely starts with the same prefix',
  );

  assert(
    getRequestedCdpPort(['electron', '--remote-debugging-port=9333']) === 9333,
    'getRequestedCdpPort: parses the explicit port value',
  );
  assert(
    getRequestedCdpPort(['electron', '--remote-debugging-port']) === null,
    'getRequestedCdpPort: null (never a guess) when the switch has no =value',
  );
  assert(
    getRequestedCdpPort(['electron', '--remote-debugging-port=notanumber']) === null,
    'getRequestedCdpPort: null (never a guess) on a malformed non-numeric value',
  );
  assert(
    getRequestedCdpPort(['electron']) === null,
    'getRequestedCdpPort: null when the switch is absent entirely',
  );
}

// ── 2: enforcePackagedCdpRefusal -- the hard-refuse decision table ────────────────────────
{
  const CDP_ARGV = ['electron', '.', '--remote-debugging-port=9333'];
  const PLAIN_ARGV = ['electron', '.'];

  // 2a: packaged + CDP requested -> REFUSES (app.exit(1) called, returns true)
  {
    const exitCalls: number[] = [];
    const { mod, restore } = freshCdpGuardWithFakeApp({ isPackaged: true, exit: (code: number) => exitCalls.push(code) });
    const refused = mod.enforcePackagedCdpRefusal(CDP_ARGV);
    restore();
    assert(refused === true, 'enforcePackagedCdpRefusal: returns true for packaged + CDP requested (dev:main:cdp shape run in a packaged build)');
    assert(exitCalls.length === 1 && exitCalls[0] === 1, 'enforcePackagedCdpRefusal: calls app.exit(1) exactly once', JSON.stringify(exitCalls));
  }

  // 2b: packaged, CDP NOT requested -> does NOT refuse (a normal packaged launch is unaffected)
  {
    const exitCalls: number[] = [];
    const { mod, restore } = freshCdpGuardWithFakeApp({ isPackaged: true, exit: (code: number) => exitCalls.push(code) });
    const refused = mod.enforcePackagedCdpRefusal(PLAIN_ARGV);
    restore();
    assert(refused === false, 'enforcePackagedCdpRefusal: false for packaged WITHOUT the CDP switch (a normal packaged app launch is never touched)');
    assert(exitCalls.length === 0, 'enforcePackagedCdpRefusal: never calls app.exit when CDP was not requested', JSON.stringify(exitCalls));
  }

  // 2c: NOT packaged, CDP requested -> does NOT refuse (this is npm run dev:main:cdp exactly --
  //     the dev debug/inspect path -- MUST stay untouched. As of D-BP151-041/56afd84f this is no
  //     longer the register gate's path -- register_gate.mjs no longer uses CDP at all -- but the
  //     guard's dev-launch shape is still tested here for its own sake)
  {
    const exitCalls: number[] = [];
    const { mod, restore } = freshCdpGuardWithFakeApp({ isPackaged: false, exit: (code: number) => exitCalls.push(code) });
    const refused = mod.enforcePackagedCdpRefusal(CDP_ARGV);
    restore();
    assert(refused === false, 'enforcePackagedCdpRefusal: false for dev (isPackaged=false) + CDP requested -- THIS IS `npm run dev:main:cdp`, and it must never refuse');
    assert(exitCalls.length === 0, 'enforcePackagedCdpRefusal: never calls app.exit in the dev:main:cdp shape', JSON.stringify(exitCalls));
  }

  // 2d: electron entirely absent (app undefined, e.g. this exact test harness run via plain
  //     node with no mock) -> never refuses, never throws
  {
    const { mod, restore } = freshCdpGuardWithFakeApp(undefined);
    let threw = false;
    let refused = false;
    try { refused = mod.enforcePackagedCdpRefusal(CDP_ARGV); } catch { threw = true; }
    restore();
    assert(threw === false, 'enforcePackagedCdpRefusal: never throws when electron itself is unavailable (plain node context)');
    assert(refused === false, 'enforcePackagedCdpRefusal: false when electron is unavailable (resolveIsPackaged() safely defaults false)');
  }
}

// ── 3: logCdpDevExposureBanner -- logs once per process, never blocks ─────────────────────
{
  const { mod, restore } = freshCdpGuardWithFakeApp({ isPackaged: false, exit: () => {} });
  const originalWarn = console.warn;
  const warnCalls: string[] = [];
  console.warn = (msg: string) => { warnCalls.push(String(msg)); };
  try {
    mod.logCdpDevExposureBanner(['electron', '--remote-debugging-port=9333']);
    mod.logCdpDevExposureBanner(['electron', '--remote-debugging-port=9333']);
    mod.logCdpDevExposureBanner(['electron', '--remote-debugging-port=9333']);
  } finally {
    console.warn = originalWarn;
  }
  restore();
  assert(warnCalls.length === 1, 'logCdpDevExposureBanner: logs exactly once across 3 calls in the same process (no log-flooding a long dev session)', `got ${warnCalls.length} calls`);
  assert(warnCalls.length > 0 && /CDP is ACTIVE/.test(warnCalls[0]), 'logCdpDevExposureBanner: the one log line is the loud CDP-active banner, not silent', warnCalls[0] ?? '(none)');
}

// ── 4: startCdpAttachWatcher -- no-op when CDP absent, live handle when present ───────────
{
  const { mod, restore } = freshCdpGuardWithFakeApp({ isPackaged: false, exit: () => {} });
  const handleAbsent = mod.startCdpAttachWatcher(['electron', '.'], 9333, 5000);
  assert(handleAbsent === null, 'startCdpAttachWatcher: returns null (never starts a timer) when CDP was not requested');

  const handlePresent = mod.startCdpAttachWatcher(['electron', '--remote-debugging-port=9333'], 9333, 60000);
  assert(handlePresent !== null && typeof handlePresent.stop === 'function', 'startCdpAttachWatcher: returns a live handle with stop() when CDP was requested');
  if (handlePresent) handlePresent.stop();
  restore();
}

// ── Summary ─────────────────────────────────────────────────────────────────────────────

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);

})().catch((err) => {
  console.error('FATAL: test harness threw:', err);
  process.exit(2);
});
