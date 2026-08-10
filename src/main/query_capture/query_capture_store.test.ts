// query_capture_store.test.ts -- D-BP151-037/BISHOP/seg-query-capture-archive
//
// Manual assert() + console output + process.exit(1) on failure, no test-framework dependency
// -- same prior-art convention as homework_runner.test.ts, comparative_cascade.test.ts,
// rooting_rule.test.ts, crystal_store.test.ts, hex_terminal_telemetry.test.ts.
//
// Requires the COMPILED dist/main/query_capture/*.js (run `npm run build:main` first).
//
// Run:
//   node dist\main\query_capture\query_capture_store.test.js
//
// VAULT/PRODUCTION SAFETY: QUERY_CAPTURE_TEST_STORE_DIR / QUERY_CAPTURE_TEST_SETTINGS_DIR
// (this file's own env overrides, read by query_capture_store.ts / query_capture_settings.ts)
// redirect every write below into a scratchpad directory. Neither the real D:\OnDeck\
// QUERY_CAPTURE\ store nor the real userData settings file nor Asteroid-ProofVault is ever
// touched by this test.

(async function main(): Promise<void> {

const path = require('path');
const fs = require('fs');
const os = require('os');

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    console.log(`  [PASS] ${label}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${label}${detail ? ` -- ${detail}` : ''}`);
    failed++;
  }
}

// ── Scratchpad test store + settings dir (NEVER the real On-Deck store / userData) ─────────
const testStoreDir = path.join(os.tmpdir(), 'mnem_query_capture_test_store_' + Date.now().toString(36));
const testSettingsDir = path.join(os.tmpdir(), 'mnem_query_capture_test_settings_' + Date.now().toString(36));
process.env.QUERY_CAPTURE_TEST_STORE_DIR = testStoreDir;
process.env.QUERY_CAPTURE_TEST_SETTINGS_DIR = testSettingsDir;

const storeModPath = path.join(__dirname, '..', '..', '..', 'dist', 'main', 'query_capture', 'query_capture_store.js');
const settingsModPath = path.join(__dirname, '..', '..', '..', 'dist', 'main', 'query_capture', 'query_capture_settings.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const store = require(storeModPath) as typeof import('./query_capture_store');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const settings = require(settingsModPath) as typeof import('./query_capture_settings');

console.log('query_capture_store.test.ts -- D-BP151-037: three acts + consent gate + delete-leaves-nothing\n');
console.log(`  (writing test entries to scratchpad dir, NOT the real store: ${testStoreDir})`);
console.log(`  (writing test settings to scratchpad dir, NOT the real userData: ${testSettingsDir})\n`);

function settingsFileRaw(): string | null {
  const f = path.join(testSettingsDir, 'query_capture_substrate_processing.json');
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf-8') : null;
}

// ── 1. Default is OFF (fail closed), and nothing captured before consent ───────────────────
{
  settings._resetQueryCaptureSettingsCacheForTests();
  assert(settings.isQueryCaptureEnabled() === false, 'default state is OFF (no settings file yet)');

  const beforeFiles = fs.existsSync(testStoreDir) ? fs.readdirSync(testStoreDir) : [];
  const res = store.captureQuery({ question: 'What is the population density of South America?', source: 'ask_tab' });
  assert(res.ok === false, 'captureQuery() refuses to write while capture is OFF', JSON.stringify(res));
  const afterFiles = fs.existsSync(testStoreDir) ? fs.readdirSync(testStoreDir) : [];
  assert(beforeFiles.length === afterFiles.length, 'zero files created while OFF -- no partial/placeholder file either', `before=${beforeFiles.length} after=${afterFiles.length}`);
}

// ── 2. Turn ON. Settings file holds ONLY {enabled:true} -- no timestamp/history field ──────
{
  const setRes = settings.setQueryCaptureEnabled(true);
  assert(setRes.ok === true, 'setQueryCaptureEnabled(true) succeeds');
  settings._resetQueryCaptureSettingsCacheForTests();
  assert(settings.isQueryCaptureEnabled() === true, 'switch now reads ON');

  const raw = settingsFileRaw();
  assert(raw !== null, 'settings file was written');
  if (raw !== null) {
    const parsed = JSON.parse(raw);
    const keys = Object.keys(parsed).sort();
    assert(keys.length === 1 && keys[0] === 'enabled', 'settings file has EXACTLY one field (enabled) -- no timestamp/counter/history', `keys=${JSON.stringify(keys)}`);
  }
}

// ── 3. Capture is retained and findable ─────────────────────────────────────────────────────
let capturedId1 = '';
{
  const q1 = 'What specific definition and scale of world region is this question using?';
  const res = store.captureQuery({ question: q1, source: 'ask_tab' });
  assert(res.ok === true, 'captureQuery() succeeds while ON', JSON.stringify(res));
  if (res.ok) capturedId1 = res.id;

  const listed = store.listQueries('active');
  assert(listed.some((e) => e.id === capturedId1), 'captured entry appears in listQueries(active)');

  const found = store.findQueries('definition and scale');
  assert(found.some((e) => e.id === capturedId1), 'captured entry is findable by substring search');

  const foundCaseInsensitive = store.findQueries('WORLD REGION');
  assert(foundCaseInsensitive.some((e) => e.id === capturedId1), 'findQueries() is case-insensitive');
}

// ── 3b. askGoogle-source capture carries authority ──────────────────────────────────────────
let capturedId2 = '';
{
  const res = store.captureQuery({ question: 'population density threshold for densely populated', source: 'ask_google', authority: 'user_google' });
  assert(res.ok === true, 'captureQuery() succeeds for ask_google source', JSON.stringify(res));
  if (res.ok) capturedId2 = res.id;
  const listed = store.listQueries('active');
  const entry = listed.find((e) => e.id === capturedId2);
  assert(!!entry && entry.source === 'ask_google' && entry.authority === 'user_google', 'ask_google entry carries source+authority correctly');
}

// ── 4. CLEAR hides from active view but the record survives ────────────────────────────────
{
  const clearRes = store.setQueryStatus(capturedId1, 'cleared');
  assert(clearRes.ok === true, 'setQueryStatus(cleared) succeeds');

  const activeList = store.listQueries('active');
  assert(!activeList.some((e) => e.id === capturedId1), 'cleared entry no longer appears in active list');

  const clearedList = store.listQueries('cleared');
  assert(clearedList.some((e) => e.id === capturedId1), 'cleared entry appears in the cleared list');

  const found = store.findQueries('definition and scale');
  assert(found.some((e) => e.id === capturedId1), 'cleared entry is STILL findable by search -- the record survives');

  const rawHits = store._rawGrepStoreForTests('definition and scale');
  assert(rawHits.length === 1, 'cleared entry content still physically exists on disk (exactly one file)', `hits=${rawHits.length}`);
}

// ── 5. ARCHIVE retains and retrieves ────────────────────────────────────────────────────────
{
  const archiveRes = store.setQueryStatus(capturedId2, 'archived');
  assert(archiveRes.ok === true, 'setQueryStatus(archived) succeeds');

  const activeList = store.listQueries('active');
  assert(!activeList.some((e) => e.id === capturedId2), 'archived entry no longer appears in active list');

  const archivedList = store.listQueries('archived');
  assert(archivedList.some((e) => e.id === capturedId2), 'archived entry appears in the archived list');

  const found = store.findQueries('densely populated');
  assert(found.some((e) => e.id === capturedId2), 'archived entry is STILL findable by search -- retained AND retrievable');
}

// ── 6. DELETE actually removes, with nothing left behind -- search every store afterward ──
{
  const uniqueNeedle = 'zzz_unique_delete_probe_qid_98_south_america_density';
  const res = store.captureQuery({ question: `Probe question containing ${uniqueNeedle} for the delete test.`, source: 'ask_tab' });
  assert(res.ok === true, 'probe entry captured for the delete test', JSON.stringify(res));
  const probeId = res.ok ? res.id : '';
  const probeFilePath = res.ok ? res.path : '';

  // Before delete: it exists everywhere it should.
  assert(fs.existsSync(probeFilePath), 'probe file exists on disk before delete');
  assert(store.listQueries().some((e) => e.id === probeId), 'probe entry appears in listQueries() before delete');
  assert(store.findQueries(uniqueNeedle).length === 1, 'probe entry is findable before delete');
  assert(store._rawGrepStoreForTests(uniqueNeedle).length === 1, 'probe content exists in exactly one file before delete (raw grep)');

  const delRes = store.deleteQuery(probeId);
  assert(delRes.ok === true, 'deleteQuery() reports success', JSON.stringify(delRes));

  // After delete: gone from disk, gone from every read path this module exposes.
  assert(!fs.existsSync(probeFilePath), 'probe file no longer exists on disk after delete');
  assert(!store.listQueries().some((e) => e.id === probeId), 'probe entry absent from listQueries(ALL statuses) after delete');
  assert(!store.listQueries('active').some((e) => e.id === probeId), 'probe entry absent from listQueries(active) after delete');
  assert(!store.listQueries('cleared').some((e) => e.id === probeId), 'probe entry absent from listQueries(cleared) after delete');
  assert(!store.listQueries('archived').some((e) => e.id === probeId), 'probe entry absent from listQueries(archived) after delete');
  assert(store.findQueries(uniqueNeedle).length === 0, 'probe entry absent from findQueries() after delete');
  assert(store._rawGrepStoreForTests(uniqueNeedle).length === 0, 'probe content absent from EVERY raw file in the store after delete (byte-level search, not just the parsed index) -- nothing left behind');

  // The store dir itself is the ONLY place this module ever wrote the probe content (see this
  // module's own header: D:\OnDeck\QUERY_CAPTURE\ is not among mnem_eblet_store.ts's
  // resolveEbletStoreRoots(), so there is no separate BM25 index/sidecar for this content to
  // also survive in). A second, independent directory walk (not going through this module's
  // own functions at all) confirms no file anywhere under the test store dir contains the
  // needle.
  function walkAndGrep(dir: string, needle: string): string[] {
    const hits: string[] = [];
    if (!fs.existsSync(dir)) return hits;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) hits.push(...walkAndGrep(full, needle));
      else {
        try {
          if (fs.readFileSync(full, 'utf-8').toLowerCase().includes(needle.toLowerCase())) hits.push(full);
        } catch { /* skip */ }
      }
    }
    return hits;
  }
  const independentWalk = walkAndGrep(testStoreDir, uniqueNeedle);
  assert(independentWalk.length === 0, 'independent filesystem walk (bypassing this module entirely) finds zero files containing the deleted content', `hits=${JSON.stringify(independentWalk)}`);
}

// ── 7. Turn OFF again -- no new writes, and turning off/on leaves the settings file at
//       exactly one field (still no history accreting across multiple toggles) ─────────────
{
  const beforeCount = fs.existsSync(testStoreDir) ? fs.readdirSync(testStoreDir).length : 0;
  settings.setQueryCaptureEnabled(false);
  settings._resetQueryCaptureSettingsCacheForTests();
  assert(settings.isQueryCaptureEnabled() === false, 'switch reads OFF again after toggling back');

  const res = store.captureQuery({ question: 'This should never be written.', source: 'ask_tab' });
  assert(res.ok === false, 'captureQuery() refuses again once OFF');
  const afterCount = fs.existsSync(testStoreDir) ? fs.readdirSync(testStoreDir).length : 0;
  assert(beforeCount === afterCount, 'file count in the store is unchanged by a refused capture', `before=${beforeCount} after=${afterCount}`);

  // Toggle a few more times and confirm the settings file NEVER grows past one field/one value
  // -- i.e. there is no history array or counter accreting across repeated toggles.
  for (let i = 0; i < 4; i++) {
    settings.setQueryCaptureEnabled(i % 2 === 0);
    settings._resetQueryCaptureSettingsCacheForTests();
  }
  const raw = settingsFileRaw();
  const parsed = raw ? JSON.parse(raw) : null;
  const keys = parsed ? Object.keys(parsed).sort() : [];
  assert(keys.length === 1 && keys[0] === 'enabled', 'after five toggles, settings file STILL has exactly one field -- no accreting history', `keys=${JSON.stringify(keys)}`);
}

// ── 8. Empty question is refused even while ON (no blank/placeholder record) ───────────────
{
  settings.setQueryCaptureEnabled(true);
  settings._resetQueryCaptureSettingsCacheForTests();
  const res = store.captureQuery({ question: '   ', source: 'ask_tab' });
  assert(res.ok === false, 'captureQuery() refuses an empty/whitespace-only question');
}

// ── Cleanup: remove scratchpad dirs ─────────────────────────────────────────────────────────
try { fs.rmSync(testStoreDir, { recursive: true, force: true }); } catch { /* non-fatal */ }
try { fs.rmSync(testSettingsDir, { recursive: true, force: true }); } catch { /* non-fatal */ }

console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

})();
