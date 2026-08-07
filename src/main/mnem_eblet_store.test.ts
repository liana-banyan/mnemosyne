// mnem_eblet_store.test.ts
// SEG: D-BP148-007/KNIGHT/M1/seg-e7c1
//
// Test harness for the non-Electron fallback + failure-shape fix landed on
// mnem_eblet_store.ts this ticket. Mirrors this tree's own prior-art convention for
// same-domain main-module tests (src/main/crystal/crystal_store.test.ts,
// src/main/hex_terminal_telemetry.test.ts): manual assert() + console output +
// process.exit(1) on failure, no test-framework dependency.
//
// DEVIATION FROM THAT CONVENTION, STATED EXPLICITLY (do not "fix" this by re-trying the
// raw-.ts path -- it was tried and empirically fails, see below): crystal_store.ts and
// hex_terminal_telemetry.ts have NO sibling .ts imports, so Node's native TypeScript
// type-stripping can `require()` them directly with zero build step. mnem_eblet_store.ts
// is NOT like that -- it has its own PRE-EXISTING (not introduced by this ticket)
// extensionless imports of sibling .ts modules (`from './semantic_soccerball'`,
// `from './rooting_rule'`). Node's require-time type-stripping resolves those via strict
// ESM resolution rules, which do NOT probe the `.ts` extension the way tsc's own
// moduleResolution does -- confirmed by direct repro this session:
//   node -e "require('./src/main/mnem_eblet_store.ts')"
//   -> Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...\semantic_soccerball'
// So THIS test, unlike its two prior-art siblings, requires the COMPILED
// dist/main/mnem_eblet_store.js -- run `npm run build:main` first. This is not a
// workaround invented for convenience: it is the exact same constraint ticket M1's own
// "far end" proof imposes (drive the compiled output, not ts-node/raw TypeScript), for
// the same underlying reason, and this file inherits it rather than inventing a second
// standard.
//
// Run (after `npm run build:main`):
//   $env:MNEM_EBLET_TEST_SCRATCH = "C:\...\_mnem_eblet_test_scratch"
//   node src\main\mnem_eblet_store.test.ts
// (this file itself has no problematic sibling imports, so Node strips ITS OWN types
// fine; it is the target module it requires that needed the compiled path.)
//
// Tests:
//   1. Non-Electron fallback actually runs: warmEbletIndex() resolves (does not
//      throw/reject) with a scratch %APPDATA% + scratch MNEM_EBLET_STORE_ROOTS, and the
//      resulting index is written under that SCRATCH path (proven by reading it back and
//      finding the synthetic eblet's real path in it) -- never the real production path.
//   2. warmEbletIndex() failure shape (M1.b): with %APPDATA% unset (forcing the
//      fallback's own documented hard error, on a fresh module instance so no earlier
//      test's cache can hide it), the function still resolves (non-fatal) but now returns
//      status:'failed' with a real, non-empty `error` naming the actual cause --
//      distinguishable from a legitimately empty store, which was the M1.b defect.
//   3. Real-Electron passthrough is byte-identical (M1.a acceptance bar): with a MOCKED
//      `electron` module (require.cache injection, not a real Electron process) exposing
//      a fake `app.getPath`, getEbletIndexStats() resolves the index path via EXACTLY
//      that mock's return value (proven by planting a file at the exact path the mock's
//      getPath('userData') return value implies, and confirming its real mtime comes back
//      unchanged) -- proving the real-Electron branch was not touched, not merely
//      reasoning about the diff.

(async function main(): Promise<void> {

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    console.log(`  \u2713 ${label}`);
    passed++;
  } else {
    console.error(`  \u2717 ${label}${detail ? ` -- ${detail}` : ''}`);
    failed++;
  }
}

const SCRATCH_ROOT = process.env.MNEM_EBLET_TEST_SCRATCH;
if (!SCRATCH_ROOT) {
  console.error(
    'FATAL: set MNEM_EBLET_TEST_SCRATCH to a scratch directory before running this test ' +
      'file (see file header). Refusing to run against an unspecified/shared location.',
  );
  process.exit(2);
}
if (fs.existsSync(SCRATCH_ROOT)) fs.rmSync(SCRATCH_ROOT, { recursive: true, force: true });
fs.mkdirSync(SCRATCH_ROOT, { recursive: true });

const DIST_MODULE_PATH = path.join(__dirname, '..', '..', 'dist', 'main', 'mnem_eblet_store');
if (!fs.existsSync(DIST_MODULE_PATH + '.js')) {
  console.error(
    `FATAL: ${DIST_MODULE_PATH}.js does not exist. Run \`npm run build:main\` first -- ` +
      'this test requires the COMPILED output (see file header for why).',
  );
  process.exit(2);
}

function freshRequire(): any {
  const resolved = require.resolve(DIST_MODULE_PATH);
  delete require.cache[resolved];
  return require(DIST_MODULE_PATH);
}

const REAL_PRODUCTION_INDEX_PATH = path.join(
  process.env.APPDATA || '',
  'amplify-computer',
  'mnemosynec',
  'substrate',
  'eblet_index.jsonl',
);
const realProdMtimeBefore = fs.existsSync(REAL_PRODUCTION_INDEX_PATH)
  ? fs.statSync(REAL_PRODUCTION_INDEX_PATH).mtimeMs
  : null;

console.log('\n=== mnem_eblet_store Electron-fallback + failure-shape harness (D-BP148-007/KNIGHT/M1) ===');
console.log(`    scratch dir: ${SCRATCH_ROOT}\n`);

// ── Test 1: non-Electron fallback actually runs, writes ONLY under the scratch path ──
console.log('Test 1: non-Electron fallback (warmEbletIndex succeeds, writes under scratch %APPDATA%)');
{
  const scratchAppData = path.join(SCRATCH_ROOT, 'fake_appdata_1');
  const scratchEbletRoot = path.join(SCRATCH_ROOT, 'fake_eblet_root_1');
  fs.mkdirSync(scratchEbletRoot, { recursive: true });
  const syntheticPath = path.join(scratchEbletRoot, 'synthetic_test.eblet.md');
  fs.writeFileSync(
    syntheticPath,
    '# Synthetic Test Eblet\n\nBody planted by D-BP148-007/KNIGHT/M1/seg-e7c1 test harness.',
    'utf-8',
  );

  const savedAppData = process.env.APPDATA;
  const savedRootsOverride = process.env.MNEM_EBLET_STORE_ROOTS;
  process.env.APPDATA = scratchAppData;
  process.env.MNEM_EBLET_STORE_ROOTS = scratchEbletRoot;

  const mod1 = freshRequire();
  let threw: unknown = null;
  let stats: any = null;
  try {
    stats = await mod1.warmEbletIndex();
  } catch (e) {
    threw = e;
  }

  process.env.APPDATA = savedAppData;
  process.env.MNEM_EBLET_STORE_ROOTS = savedRootsOverride;

  assert(threw === null, 'warmEbletIndex() did not throw/reject outside Electron', String(threw));
  assert(!!stats, 'warmEbletIndex() resolved with a value');
  assert(!!stats && stats.status === 'ok', 'status === "ok"', JSON.stringify(stats));
  assert(!!stats && stats.totalIndexed >= 1, 'at least one entry indexed', JSON.stringify(stats));

  const scratchIndexPath = path.join(scratchAppData, 'amplify-computer', 'mnemosynec', 'substrate', 'eblet_index.jsonl');
  assert(fs.existsSync(scratchIndexPath), 'index file was written under the SCRATCH %APPDATA% path', scratchIndexPath);

  let foundSynthetic = false;
  if (fs.existsSync(scratchIndexPath)) {
    const raw: string = fs.readFileSync(scratchIndexPath, 'utf-8');
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      try {
        const rec = JSON.parse(t);
        if (rec.path === syntheticPath) { foundSynthetic = true; break; }
      } catch { /* skip */ }
    }
  }
  assert(foundSynthetic, 'the synthetic eblet (via MNEM_EBLET_STORE_ROOTS override) round-trips through the scratch index', syntheticPath);

  const realProdMtimeAfter = fs.existsSync(REAL_PRODUCTION_INDEX_PATH)
    ? fs.statSync(REAL_PRODUCTION_INDEX_PATH).mtimeMs
    : null;
  assert(
    realProdMtimeAfter === realProdMtimeBefore,
    'the REAL production eblet_index.jsonl mtime is unchanged by this test',
    `before=${realProdMtimeBefore} after=${realProdMtimeAfter}`,
  );
}

// ── Test 2: warmEbletIndex() failure shape is unmissable, not a bare zero ──────────
console.log('\nTest 2: warmEbletIndex() failure shape (M1.b -- distinguishable from legitimately empty)');
{
  const savedAppData = process.env.APPDATA;
  delete process.env.APPDATA; // still process.platform === 'win32' -- forces fallbackUserDataPath()'s documented hard error

  const mod2 = freshRequire(); // fresh module instance: no earlier test's _indexCache can hide the failure
  let threw: unknown = null;
  let stats: any = null;
  try {
    stats = await mod2.warmEbletIndex();
  } catch (e) {
    threw = e;
  }

  process.env.APPDATA = savedAppData;

  assert(threw === null, 'warmEbletIndex() still resolves (non-fatal to app boot) even on hard internal failure', String(threw));
  assert(!!stats, 'warmEbletIndex() resolved with a value');
  assert(!!stats && stats.status === 'failed', 'status === "failed" (not silently "ok")', JSON.stringify(stats));
  assert(
    !!stats && typeof stats.error === 'string' && stats.error.length > 0,
    'a real, non-empty `error` describing the actual cause is present',
    JSON.stringify(stats),
  );
  assert(
    !!stats && typeof stats.error === 'string' && /APPDATA/.test(stats.error),
    'the error names the actual underlying cause (APPDATA), not a generic message',
    stats ? stats.error : '(no stats)',
  );
  assert(!!stats && stats.totalIndexed === 0, 'totalIndexed is still 0 on failure (shape is additive, not a lie about count)', JSON.stringify(stats));
}

// ── Test 3: real-Electron passthrough is byte-identical ────────────────────────────
console.log('\nTest 3: real-Electron passthrough is byte-identical (mocked electron, not a real process)');
{
  const scratchElectronUserData = path.join(SCRATCH_ROOT, 'fake_electron_userdata');
  const plantedIndexPath = path.join(scratchElectronUserData, 'mnemosynec', 'substrate', 'eblet_index.jsonl');
  fs.mkdirSync(path.dirname(plantedIndexPath), { recursive: true });
  fs.writeFileSync(plantedIndexPath, '', 'utf-8');
  const distinctiveMtime = new Date('2026-01-01T00:00:00Z');
  fs.utimesSync(plantedIndexPath, distinctiveMtime, distinctiveMtime);

  const getPathCalls: string[] = [];
  const fakeApp = {
    getPath: (name: string) => { getPathCalls.push(name); return scratchElectronUserData; },
    isPackaged: false,
    getAppPath: () => scratchElectronUserData,
  };

  const electronResolvedPath = require.resolve('electron');
  const savedElectronCacheEntry = require.cache[electronResolvedPath];
  require.cache[electronResolvedPath] = {
    id: electronResolvedPath,
    filename: electronResolvedPath,
    loaded: true,
    exports: { app: fakeApp, BrowserWindow: { getAllWindows: () => [] } },
  } as any;

  const mod3 = freshRequire();
  const stats = mod3.getEbletIndexStats();

  // Restore the real (unresolved-outside-Electron) electron cache entry so nothing after
  // this test in the same process accidentally observes the mock.
  if (savedElectronCacheEntry) {
    require.cache[electronResolvedPath] = savedElectronCacheEntry;
  } else {
    delete require.cache[electronResolvedPath];
  }

  assert(getPathCalls.includes('userData'), "the mock's app.getPath('userData') was actually called", JSON.stringify(getPathCalls));
  assert(
    stats.lastRefreshTimestamp === distinctiveMtime.getTime(),
    "getIndexPath() resolved to EXACTLY the mock's app.getPath('userData') return value + the SAME suffix path the real code has always used",
    `expected ${distinctiveMtime.getTime()}, got ${stats.lastRefreshTimestamp}`,
  );
}

// ─── Summary ──────────────────────────────────────────────────────────────
console.log(`\n${'='.repeat(70)}`);
console.log(`Results: ${passed} passed \u00b7 ${failed} failed`);
if (failed === 0) {
  console.log('\u2713 ALL TESTS PASSED');
  process.exit(0);
} else {
  console.error(`\u2717 ${failed} TESTS FAILED`);
  process.exit(1);
}

})().catch((e) => {
  console.error('FATAL: unhandled error in test harness:', e);
  process.exit(1);
});
