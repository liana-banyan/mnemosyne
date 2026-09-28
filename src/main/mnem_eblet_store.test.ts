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

// ── Test 4: watcher-triggered rebuilds are paced by the floor, not dropped ─────────
// D-BP223-BM0-X010-011 (INDEXLOOP fix): a root under continuous write traffic (e.g. the real
// HARDWIRE ledger tree, measured 101 real "[EbletIndex] Rebuilding index..." passes in ~15
// minutes, main.log 2026-09-10 12:41-12:56 Central, pid 23004 pinned ~92% of one core) can
// settle its per-root WATCH_DEBOUNCE_MS(1500ms) debounce every few seconds indefinitely --
// before this fix, EVERY settle re-ran a full loadOrRebuildIndex() unconditionally. This test
// proves MIN_REBUILD_INTERVAL_MS (env-overridable via MNEM_REBUILD_FLOOR_MS for a fast,
// deterministic run here) coalesces a burst that arrives inside the floor into exactly one
// deferred rebuild, rather than either (a) running immediately (the bug) or (b) silently
// dropping the change (which would violate the Founder's "substrate sees everything" bar).
console.log('\nTest 4: rebuild floor coalesces rapid watcher bursts (D-BP223-BM0-X010-011)');
{
  const scratchAppData4 = path.join(SCRATCH_ROOT, 'fake_appdata_4');
  const scratchEbletRoot4 = path.join(SCRATCH_ROOT, 'fake_eblet_root_4');
  fs.mkdirSync(scratchEbletRoot4, { recursive: true });

  const savedAppData = process.env.APPDATA;
  const savedRootsOverride = process.env.MNEM_EBLET_STORE_ROOTS;
  const savedRootsExclusive = process.env.MNEM_EBLET_STORE_ROOTS_EXCLUSIVE;
  const savedFloorOverride = process.env.MNEM_REBUILD_FLOOR_MS;
  process.env.APPDATA = scratchAppData4;
  process.env.MNEM_EBLET_STORE_ROOTS = scratchEbletRoot4;
  // Exclusive, not additive: isolates this test from the real (46k+ file) estate doctrine
  // roots Test 1/3 above pull in -- see MNEM_EBLET_STORE_ROOTS_EXCLUSIVE's own comment in
  // mnem_eblet_store.ts (resolveEbletStoreRoots()) for why that distinction now matters.
  process.env.MNEM_EBLET_STORE_ROOTS_EXCLUSIVE = '1';
  process.env.MNEM_REBUILD_FLOOR_MS = '3000'; // small floor so the test finishes in seconds, not 20s+

  const mod4 = freshRequire();

  let rebuildLogCount = 0;
  const originalConsoleLog = console.log;
  console.log = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('[EbletIndex] Rebuilding index')) {
      rebuildLogCount++;
    }
    originalConsoleLog(...args);
  };

  try {
    mod4.startEbletIndexWatchers();

    // File A: the very first watcher-triggered rebuild this process is unfloored (no prior
    // rebuild to measure elapsed time against) -- it must run.
    fs.writeFileSync(path.join(scratchEbletRoot4, 'floor_test_a.eblet.md'), '# A\n\nfirst', 'utf-8');
    await new Promise((r) => setTimeout(r, 2200)); // > WATCH_DEBOUNCE_MS(1500) -- lets rebuild #1 run and finish

    assert(rebuildLogCount === 1, 'exactly one real rebuild ran for the first watcher burst', `count=${rebuildLogCount}`);

    // File B: arrives well inside the 3000ms floor opened by rebuild #1 -- must NOT trigger an
    // immediate second rebuild (that back-to-back re-run, at scale, is the measured defect).
    fs.writeFileSync(path.join(scratchEbletRoot4, 'floor_test_b.eblet.md'), '# B\n\nsecond', 'utf-8');
    await new Promise((r) => setTimeout(r, 2200)); // debounce settles well before the floor opens

    assert(rebuildLogCount === 1, 'the second watcher burst, inside the floor, did NOT run an immediate rebuild', `count=${rebuildLogCount}`);

    // Wait past the floor -- the deferred rebuild must still fire and pick up file B, proving
    // the coalesced event was rescheduled, not dropped.
    await new Promise((r) => setTimeout(r, 2500));

    assert(rebuildLogCount === 2, 'the deferred rebuild ran once the floor opened (coalesced, not dropped)', `count=${rebuildLogCount}`);

    const scratchIndexPath4 = path.join(scratchAppData4, 'MnemosyneC', 'mnemosynec', 'substrate', 'eblet_index.jsonl');
    let foundBoth = false;
    if (fs.existsSync(scratchIndexPath4)) {
      const raw: string = fs.readFileSync(scratchIndexPath4, 'utf-8');
      foundBoth = raw.includes('floor_test_a.eblet.md') && raw.includes('floor_test_b.eblet.md');
    }
    assert(foundBoth, 'both files ended up indexed despite the second rebuild being deferred -- no coverage lost', scratchIndexPath4);
  } finally {
    console.log = originalConsoleLog;
    mod4.stopEbletIndexWatchers();
    process.env.APPDATA = savedAppData;
    process.env.MNEM_EBLET_STORE_ROOTS = savedRootsOverride;
    if (savedRootsExclusive === undefined) delete process.env.MNEM_EBLET_STORE_ROOTS_EXCLUSIVE;
    else process.env.MNEM_EBLET_STORE_ROOTS_EXCLUSIVE = savedRootsExclusive;
    if (savedFloorOverride === undefined) delete process.env.MNEM_REBUILD_FLOOR_MS;
    else process.env.MNEM_REBUILD_FLOOR_MS = savedFloorOverride;
  }
}

// ── Test 5: boot warm-up and a second entry point never run two concurrent walks ───
// D-BP223-BM0-X010-011B-STARTHANG: pre-fix, `_rebuildInFlight`/`_lastRebuildStartedAt` were
// private to triggerBackgroundRebuild() -- warmEbletIndex() (index.ts's boot-time, fire-and-
// forget warm-up, called BEFORE startEbletIndexWatchers()) called loadOrRebuildIndex() directly,
// invisible to both. On a live, continuously-writing estate the first watcher event to settle
// after boot could therefore start a SECOND, fully independent full-corpus walk while the boot
// warm-up's own walk was still running -- two synchronous, zero-yield statSync/readFileSync
// passes racing each other and racing the same eblet_index.jsonl.tmp write is the most direct,
// source-confirmed explanation this ticket found for a boot that never reaches a window (see
// BISHOP_DROPZONE\D-BP223-BM0-X010-011B-STARTHANG_REPORT.md for the full investigation,
// including why a literal infinite hang could not be reproduced in an isolated/quiescent repro
// even against the real ~51k-file estate -- every isolated variant completed in single-digit-to-
// low-teens seconds; the structural defect this test proves fixed is what stops that from
// compounding indefinitely under real concurrent load, regardless of the exact stall mechanism).
// This test proves two SEPARATE entry points (warmEbletIndex called twice concurrently, standing
// in for "boot warm-up" and "a watcher trigger that arrives before the warm-up finishes") now
// coalesce onto exactly ONE real rebuild walk instead of each starting its own.
console.log('\nTest 5: two concurrent rebuild entry points coalesce onto one walk (D-BP223-BM0-X010-011B-STARTHANG)');
{
  const scratchAppData5 = path.join(SCRATCH_ROOT, 'fake_appdata_5');
  const scratchEbletRoot5 = path.join(SCRATCH_ROOT, 'fake_eblet_root_5');
  fs.mkdirSync(scratchEbletRoot5, { recursive: true });
  fs.writeFileSync(path.join(scratchEbletRoot5, 'concurrent_a.eblet.md'), '# A\n\nconcurrent entry point test', 'utf-8');

  const savedAppData = process.env.APPDATA;
  const savedRootsOverride = process.env.MNEM_EBLET_STORE_ROOTS;
  const savedRootsExclusive = process.env.MNEM_EBLET_STORE_ROOTS_EXCLUSIVE;
  process.env.APPDATA = scratchAppData5;
  process.env.MNEM_EBLET_STORE_ROOTS = scratchEbletRoot5;
  process.env.MNEM_EBLET_STORE_ROOTS_EXCLUSIVE = '1';

  const mod5 = freshRequire();

  let rebuildLogCount = 0;
  const originalConsoleLog = console.log;
  console.log = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('[EbletIndex] Rebuilding index')) {
      rebuildLogCount++;
    }
    originalConsoleLog(...args);
  };

  try {
    // Fire two independent entry points into a rebuild in the SAME tick, before either has had
    // a chance to finish -- exactly the boot-warm-up-vs-watcher-trigger shape, minus timer
    // nondeterminism. Pre-fix, this would run TWO independent loadOrRebuildIndex() walks.
    const [stats1, stats2] = await Promise.all([mod5.warmEbletIndex(), mod5.warmEbletIndex()]);

    assert(rebuildLogCount === 1, 'two concurrent warmEbletIndex() calls ran exactly one real rebuild walk, not two', `count=${rebuildLogCount}`);
    assert(
      stats1.lastRefreshTimestamp === stats2.lastRefreshTimestamp && stats1.totalIndexed === stats2.totalIndexed,
      'both callers observed the SAME completed rebuild (shared in-flight promise), not two independent results',
      `stats1=${JSON.stringify(stats1)} stats2=${JSON.stringify(stats2)}`,
    );
    assert(stats1.status === 'ok' && stats1.totalIndexed >= 1, 'the shared rebuild actually indexed the scratch file (no coverage lost to coalescing)', JSON.stringify(stats1));

    // forceRefreshEbletIndex()'s own documented contract ("I just wrote a file, reread NOW")
    // must still hold: it awaits any in-flight rebuild, then guarantees one MORE guarded pass --
    // never a walk running concurrently with another, but never silently stale either.
    rebuildLogCount = 0;
    const [warmStats, forceStats] = await Promise.all([mod5.warmEbletIndex(), mod5.forceRefreshEbletIndex()]);
    assert(rebuildLogCount >= 1 && rebuildLogCount <= 2, 'warmEbletIndex()+forceRefreshEbletIndex() fired together never overlap a walk (1-2 sequential passes, never concurrent)', `count=${rebuildLogCount}`);
    assert(forceStats.status === 'ok' && warmStats.status === 'ok', 'both entry points still resolve ok when fired together', `warm=${JSON.stringify(warmStats)} force=${JSON.stringify(forceStats)}`);
  } finally {
    console.log = originalConsoleLog;
    process.env.APPDATA = savedAppData;
    process.env.MNEM_EBLET_STORE_ROOTS = savedRootsOverride;
    if (savedRootsExclusive === undefined) delete process.env.MNEM_EBLET_STORE_ROOTS_EXCLUSIVE;
    else process.env.MNEM_EBLET_STORE_ROOTS_EXCLUSIVE = savedRootsExclusive;
  }
}

// ── Test 6: MNEM_EBLET_INDEX_TRUST_CACHE skips the mtime walk + rebuild entirely ────
// D-BP223-BM0-X010-025C-ARMBFIX: the MMLU-Pro sweep harness (mmlu_pro_plow_sweep.cjs) spawns
// a brand-new subprocess per item (two, under --keep-the-win), so `_indexCache`'s 60s
// in-process TTL never helps it -- every item pays rootsMaxMtime()'s full tree walk from
// scratch, and on a root under continuous write traffic (the real HARDWIRE ledger) that walk
// routinely finds something newer than the on-disk index and triggers a full rebuild +
// Ollama re-embed, which is what turned arm B of the 700-item run into a 100% harness-timeout
// failure (see D-BP223-BM0-X010-025B-ARMB_REPORT.md). This test proves both halves of the
// fix's contract: (a) with the env ABSENT, behavior is unchanged -- a newer root file is still
// detected and still triggers a real rebuild; (b) with the env set to '1', a newer root file
// is present but NO rebuild runs and NO mtime walk's result is acted on -- the on-disk index
// is trusted as-is, byte-for-byte, even though it is now stale relative to the roots.
console.log('\nTest 6: MNEM_EBLET_INDEX_TRUST_CACHE (D-BP223-BM0-X010-025C-ARMBFIX)');
{
  const scratchAppData6 = path.join(SCRATCH_ROOT, 'fake_appdata_6');
  const scratchEbletRoot6 = path.join(SCRATCH_ROOT, 'fake_eblet_root_6');
  fs.mkdirSync(scratchEbletRoot6, { recursive: true });

  const savedAppData = process.env.APPDATA;
  const savedRootsOverride = process.env.MNEM_EBLET_STORE_ROOTS;
  const savedRootsExclusive = process.env.MNEM_EBLET_STORE_ROOTS_EXCLUSIVE;
  const savedTrustCache = process.env.MNEM_EBLET_INDEX_TRUST_CACHE;
  process.env.APPDATA = scratchAppData6;
  process.env.MNEM_EBLET_STORE_ROOTS = scratchEbletRoot6;
  process.env.MNEM_EBLET_STORE_ROOTS_EXCLUSIVE = '1';
  delete process.env.MNEM_EBLET_INDEX_TRUST_CACHE;

  let rebuildLogCount = 0;
  let trustCacheLogCount = 0;
  const originalConsoleLog = console.log;
  console.log = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('[EbletIndex] Rebuilding index')) {
      rebuildLogCount++;
    }
    if (typeof args[0] === 'string' && args[0].includes('MNEM_EBLET_INDEX_TRUST_CACHE=1: loaded')) {
      trustCacheLogCount++;
    }
    originalConsoleLog(...args);
  };

  try {
    // Step A: initial build, env absent -- file1 only.
    fs.writeFileSync(path.join(scratchEbletRoot6, 'trust_test_a.eblet.md'), '# A\n\ninitial', 'utf-8');
    const mod6a = freshRequire();
    const statsA = await mod6a.warmEbletIndex();
    assert(rebuildLogCount === 1, 'Step A: initial build ran exactly one real rebuild', `count=${rebuildLogCount}`);
    assert(statsA.status === 'ok' && statsA.totalIndexed === 1, 'Step A: index contains exactly file1', JSON.stringify(statsA));

    // Step B: env still ABSENT -- add file2 (bumps roots mtime past the index's), fresh module
    // (so no in-process _indexCache survives), confirm the EXISTING behavior holds: staleness
    // is still detected and a real rebuild still runs.
    rebuildLogCount = 0;
    await new Promise((r) => setTimeout(r, 20)); // ensure a distinct, later mtime on most filesystems
    fs.writeFileSync(path.join(scratchEbletRoot6, 'trust_test_b.eblet.md'), '# B\n\nsecond, env absent', 'utf-8');
    const mod6b = freshRequire();
    const statsB = await mod6b.warmEbletIndex();
    assert(rebuildLogCount === 1, 'Step B (env absent): a newer root file still triggers a real rebuild -- default behavior unchanged', `count=${rebuildLogCount}`);
    assert(statsB.status === 'ok' && statsB.totalIndexed === 2, 'Step B (env absent): index now contains both file1 and file2', JSON.stringify(statsB));

    // Step C: NOW set the env. Add file3 (bumps roots mtime past the index's again), fresh
    // module, confirm NO rebuild runs and NO mtime walk's result is acted on -- the on-disk
    // index (file1+file2 only) is trusted as-is despite file3 now existing.
    rebuildLogCount = 0;
    trustCacheLogCount = 0;
    await new Promise((r) => setTimeout(r, 20));
    fs.writeFileSync(path.join(scratchEbletRoot6, 'trust_test_c.eblet.md'), '# C\n\nthird, env=1, must be invisible', 'utf-8');
    process.env.MNEM_EBLET_INDEX_TRUST_CACHE = '1';
    const mod6c = freshRequire();
    const statsC = await mod6c.warmEbletIndex();
    assert(rebuildLogCount === 0, 'Step C (env=1): NO rebuild ran despite a newer root file existing', `count=${rebuildLogCount}`);
    assert(trustCacheLogCount === 1, 'Step C (env=1): the trust-cache fast-path log line fired exactly once', `count=${trustCacheLogCount}`);
    assert(statsC.status === 'ok' && statsC.totalIndexed === 2, 'Step C (env=1): index still reports only file1+file2 -- file3 is invisible, on-disk index trusted as-is', JSON.stringify(statsC));

    // Step D: env still '1', but now delete the on-disk index entirely -- the trust-cache path
    // must fall through to a real rebuild rather than silently returning nothing (the
    // `existsSync(indexPath)` guard in the fix). Proves this is a FAST PATH, not a way to hide
    // a genuinely missing index.
    rebuildLogCount = 0;
    trustCacheLogCount = 0;
    const scratchIndexPath6 = path.join(scratchAppData6, 'MnemosyneC', 'mnemosynec', 'substrate', 'eblet_index.jsonl');
    fs.rmSync(scratchIndexPath6, { force: true });
    const mod6d = freshRequire();
    const statsD = await mod6d.warmEbletIndex();
    assert(rebuildLogCount === 1, 'Step D (env=1, no on-disk index): falls through to a real rebuild rather than serving nothing', `count=${rebuildLogCount}`);
    assert(trustCacheLogCount === 0, 'Step D (env=1, no on-disk index): the fast-path log line did NOT fire (guard correctly required existsSync)', `count=${trustCacheLogCount}`);
    assert(statsD.status === 'ok' && statsD.totalIndexed === 3, 'Step D (env=1, no on-disk index): rebuild picks up all three files, including file3', JSON.stringify(statsD));
  } finally {
    console.log = originalConsoleLog;
    process.env.APPDATA = savedAppData;
    process.env.MNEM_EBLET_STORE_ROOTS = savedRootsOverride;
    if (savedRootsExclusive === undefined) delete process.env.MNEM_EBLET_STORE_ROOTS_EXCLUSIVE;
    else process.env.MNEM_EBLET_STORE_ROOTS_EXCLUSIVE = savedRootsExclusive;
    if (savedTrustCache === undefined) delete process.env.MNEM_EBLET_INDEX_TRUST_CACHE;
    else process.env.MNEM_EBLET_INDEX_TRUST_CACHE = savedTrustCache;
  }
}

// ── Test 7: a rebuild that finds no change does not rewrite the index ─────────────
// D-BP223-BM0-X030-004: MEASURED on M0 main.log 2026-09-16 17:30-17:31 local, every ~20 s pass
// logged "56907/56907 unchanged ... 0 new/changed" and still rewrote the 32.6 MB index (about
// 141 GB/day). Proves: (a) a non-indexable write under a root still reaches the rebuild path but
// the file is NOT rewritten (same file id, same bytes, skip log fires); (b) the next check after
// the mtime stamp loads from disk with no walk; (c) a real add and a real delete still rewrite.
console.log('\nTest 7: unchanged rebuild skips the index rewrite (D-BP223-BM0-X030-004)');
{
  const scratchAppData7 = path.join(SCRATCH_ROOT, 'fake_appdata_7');
  const scratchEbletRoot7 = path.join(SCRATCH_ROOT, 'fake_eblet_root_7');
  fs.mkdirSync(scratchEbletRoot7, { recursive: true });
  const savedAppData = process.env.APPDATA;
  const savedRootsOverride = process.env.MNEM_EBLET_STORE_ROOTS;
  const savedRootsExclusive = process.env.MNEM_EBLET_STORE_ROOTS_EXCLUSIVE;
  process.env.APPDATA = scratchAppData7;
  process.env.MNEM_EBLET_STORE_ROOTS = scratchEbletRoot7;
  process.env.MNEM_EBLET_STORE_ROOTS_EXCLUSIVE = '1';

  let rebuildLogCount = 0;
  let skipLogCount = 0;
  const originalConsoleLog = console.log;
  console.log = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('[EbletIndex] Rebuilding index')) rebuildLogCount++;
    if (typeof args[0] === 'string' && args[0].includes('skipped rewrite, stamped mtime only')) skipLogCount++;
    originalConsoleLog(...args);
  };
  const idxPath7 = path.join(scratchAppData7, 'MnemosyneC', 'mnemosynec', 'substrate', 'eblet_index.jsonl');
  try {
    fs.writeFileSync(path.join(scratchEbletRoot7, 'skip_test_a.eblet.md'), '# A\n\nfirst', 'utf-8');
    const mod7 = freshRequire();
    const s1 = await mod7.warmEbletIndex();
    assert(s1.status === 'ok' && s1.totalIndexed === 1, 'Step A: initial build indexed one file', JSON.stringify(s1));
    const statBefore = fs.statSync(idxPath7, { bigint: true });
    const bytesBefore = fs.readFileSync(idxPath7, 'utf-8');

    // Step B: non-indexable write bumps the root mtime past the index; force a pass.
    await new Promise((r) => setTimeout(r, 30));
    fs.writeFileSync(path.join(scratchEbletRoot7, 'noise_ledger.jsonl'), '{"n":1}\n', 'utf-8');
    rebuildLogCount = 0; skipLogCount = 0;
    const s2 = await mod7.forceRefreshEbletIndex();
    const statAfter = fs.statSync(idxPath7, { bigint: true });
    assert(rebuildLogCount === 1, 'Step B: the noise write still reached the rebuild walk', `count=${rebuildLogCount}`);
    assert(skipLogCount === 1, 'Step B: the skip-rewrite path fired', `count=${skipLogCount}`);
    assert(statAfter.ino === statBefore.ino, 'Step B: index file was NOT replaced (same file id)', `${statBefore.ino} vs ${statAfter.ino}`);
    assert(fs.readFileSync(idxPath7, 'utf-8') === bytesBefore, 'Step B: index bytes identical');
    assert(s2.totalIndexed === 1, 'Step B: still one entry', JSON.stringify(s2));

    // Step C: fresh module, nothing changed since the stamp: loads from disk, no walk.
    rebuildLogCount = 0;
    const mod7c = freshRequire();
    const s3 = await mod7c.warmEbletIndex();
    assert(rebuildLogCount === 0, 'Step C: after the stamp, a fresh process loads from disk with no rebuild', `count=${rebuildLogCount}`);
    assert(s3.totalIndexed === 1, 'Step C: still one entry', JSON.stringify(s3));

    // Step D: a real add rewrites.
    await new Promise((r) => setTimeout(r, 30));
    fs.writeFileSync(path.join(scratchEbletRoot7, 'skip_test_b.eblet.md'), '# B\n\nsecond', 'utf-8');
    skipLogCount = 0;
    const s4 = await mod7c.forceRefreshEbletIndex();
    assert(skipLogCount === 0 && s4.totalIndexed === 2 && fs.readFileSync(idxPath7, 'utf-8').includes('skip_test_b.eblet.md'), 'Step D: a real add is written (2 entries, no skip)', JSON.stringify(s4));

    // Step E: a real delete rewrites.
    await new Promise((r) => setTimeout(r, 30));
    fs.rmSync(path.join(scratchEbletRoot7, 'skip_test_a.eblet.md'));
    skipLogCount = 0;
    const s5 = await mod7c.forceRefreshEbletIndex();
    assert(skipLogCount === 0 && s5.totalIndexed === 1 && !fs.readFileSync(idxPath7, 'utf-8').includes('skip_test_a.eblet.md'), 'Step E: a real delete is written (1 entry, no skip)', JSON.stringify(s5));
  } finally {
    console.log = originalConsoleLog;
    process.env.APPDATA = savedAppData;
    process.env.MNEM_EBLET_STORE_ROOTS = savedRootsOverride;
    if (savedRootsExclusive === undefined) delete process.env.MNEM_EBLET_STORE_ROOTS_EXCLUSIVE;
    else process.env.MNEM_EBLET_STORE_ROOTS_EXCLUSIVE = savedRootsExclusive;
  }
}

// ── Test 8: the watcher ignores non-indexable churn, still sees indexable changes ─────
// D-BP223-BM0-X030-004: the live loop's trigger was non-indexable estate writes under watched
// roots. Proves continuous .jsonl/.json/.tmp churn fires ZERO rebuilds, and one .eblet.md write
// still fires exactly one.
console.log('\nTest 8: watcher filter ignores non-indexable churn (D-BP223-BM0-X030-004)');
{
  const scratchAppData8 = path.join(SCRATCH_ROOT, 'fake_appdata_8');
  const scratchEbletRoot8 = path.join(SCRATCH_ROOT, 'fake_eblet_root_8');
  fs.mkdirSync(path.join(scratchEbletRoot8, 'LEDGER'), { recursive: true });
  const savedAppData = process.env.APPDATA;
  const savedRootsOverride = process.env.MNEM_EBLET_STORE_ROOTS;
  const savedRootsExclusive = process.env.MNEM_EBLET_STORE_ROOTS_EXCLUSIVE;
  const savedFloorOverride = process.env.MNEM_REBUILD_FLOOR_MS;
  process.env.APPDATA = scratchAppData8;
  process.env.MNEM_EBLET_STORE_ROOTS = scratchEbletRoot8;
  process.env.MNEM_EBLET_STORE_ROOTS_EXCLUSIVE = '1';
  process.env.MNEM_REBUILD_FLOOR_MS = '0';

  const mod8 = freshRequire();
  const r = scratchEbletRoot8;
  assert(mod8.isWatchEventRelevant(r, 'LEDGER\\x.jsonl') === false, 'unit: nested .jsonl ignored');
  assert(mod8.isWatchEventRelevant(r, 'a.json') === false, 'unit: .json ignored');
  assert(mod8.isWatchEventRelevant(r, 'eblet_index.jsonl.tmp') === false, 'unit: .tmp ignored');
  assert(mod8.isWatchEventRelevant(r, 'x.superseded.20260916T000000Z.eblet.md') === false, 'unit: superseded sibling ignored');
  assert(mod8.isWatchEventRelevant(r, 'CANON\\y.eblet.md') === true, 'unit: nested .eblet.md relevant');
  assert(mod8.isWatchEventRelevant(r, 'HARDWIRE-99.md') === true, 'unit: HARDWIRE doc relevant');
  assert(mod8.isWatchEventRelevant(r, 'LEDGER', 'rename') === true, 'unit: directory rename event stays relevant');
  assert(mod8.isWatchEventRelevant(r, 'LEDGER', 'change') === false, 'unit: change on an existing directory (child modified) ignored');
  assert(mod8.isWatchEventRelevant(r, 'GONE_DIR', 'change') === true, 'unit: change on a vanished name stays relevant');
  assert(mod8.isWatchEventRelevant(r, null) === true, 'unit: null filename stays relevant');

  let rebuildLogCount = 0;
  const originalConsoleLog = console.log;
  console.log = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('[EbletIndex] Rebuilding index')) rebuildLogCount++;
    originalConsoleLog(...args);
  };
  try {
    // Initial index so later passes have a baseline; then start watchers.
    fs.writeFileSync(path.join(r, 'base.eblet.md'), '# base', 'utf-8');
    await mod8.warmEbletIndex();
    // Pre-write the churn file once, before watching, so its first creation is not the event under test.
    fs.writeFileSync(path.join(r, 'LEDGER', 'churn.jsonl'), '{"i":-1}\n', 'utf-8');
    await new Promise((res) => setTimeout(res, 300));
    rebuildLogCount = 0;
    mod8.startEbletIndexWatchers();
    for (let i = 0; i < 10; i++) {
      fs.appendFileSync(path.join(r, 'LEDGER', 'churn.jsonl'), `{"i":${i}}\n`, 'utf-8');
      fs.writeFileSync(path.join(r, 'state.json'), `{"i":${i}}`, 'utf-8');
      await new Promise((res) => setTimeout(res, 250));
    }
    await new Promise((res) => setTimeout(res, 2000)); // > WATCH_DEBOUNCE_MS
    assert(rebuildLogCount === 0, 'about 2.5 s of .jsonl/.json churn fired zero rebuilds', `count=${rebuildLogCount}`);

    fs.writeFileSync(path.join(r, 'LEDGER', 'real_change.eblet.md'), '# real', 'utf-8');
    await new Promise((res) => setTimeout(res, 2500));
    assert(rebuildLogCount === 1, 'one indexable write still fired exactly one rebuild', `count=${rebuildLogCount}`);
  } finally {
    console.log = originalConsoleLog;
    mod8.stopEbletIndexWatchers();
    process.env.APPDATA = savedAppData;
    process.env.MNEM_EBLET_STORE_ROOTS = savedRootsOverride;
    if (savedRootsExclusive === undefined) delete process.env.MNEM_EBLET_STORE_ROOTS_EXCLUSIVE;
    else process.env.MNEM_EBLET_STORE_ROOTS_EXCLUSIVE = savedRootsExclusive;
    if (savedFloorOverride === undefined) delete process.env.MNEM_REBUILD_FLOOR_MS;
    else process.env.MNEM_REBUILD_FLOOR_MS = savedFloorOverride;
  }
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
