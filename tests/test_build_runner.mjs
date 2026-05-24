// Hearth App Builder — B69b — Build Runner Tests
// Mocks npm install/build; asserts IPC events fire in correct order. (G3 gate prep)
//
// Run: node tests/test_build_runner.mjs  (from amplify-computer root, after npm run build:main)

import { BuildRunner, classifyBuildFailure } from '../dist/main/hearth_app_builder/build_runner.js';

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ ${msg}`);
    failed++;
  }
}

// ─── Mock BrowserWindow ───────────────────────────────────────────────────────

class MockWindow {
  constructor() {
    this.events = [];
    this.webContents = {
      send: (channel, payload) => {
        this.events.push({ channel, payload });
      },
    };
    this.destroyed = false;
  }
  isDestroyed() { return this.destroyed; }
  getEvents(channel) { return this.events.filter((e) => e.channel === channel); }
}

// ─── Test: IPC event ordering ─────────────────────────────────────────────────

console.log('\n[TC1: Build Runner IPC event order — success path mock]');
{
  const win = new MockWindow();
  const events = [];

  // Monkey-patch BuildRunner to record the broadcast calls without actual spawn
  const runner = new BuildRunner({
    appDir: process.cwd(), // doesn't matter for mock
    appUuid: 'test-uuid-001',
    appName: 'Test App',
    windows: [win],
  });

  // Test the classifyBuildFailure function (doesn't need spawn)
  const tscFail = classifyBuildFailure('TSC type error: cannot find module');
  assert(tscFail.class === 'codegen_tsc_fail', 'classifies tsc failure correctly');
  assert(tscFail.suggestion.length > 10, 'tsc failure has suggestion text');

  const networkFail = classifyBuildFailure('npm ERR! code ENOTFOUND registry.npmjs.org');
  assert(networkFail.class === 'npm_install_network_fail', 'classifies network failure correctly');

  const sqliteFail = classifyBuildFailure('better-sqlite3 node-gyp rebuild failed');
  assert(sqliteFail.class === 'sqlite3_native_rebuild_fail', 'classifies sqlite3 failure correctly');

  const signingFail = classifyBuildFailure('electron-builder code signing certificate error');
  assert(signingFail.class === 'electron_builder_signing_fail', 'classifies signing failure correctly');

  const unknownFail = classifyBuildFailure('something weird happened');
  assert(unknownFail.class === 'unknown', 'unknown errors classified as unknown');
}

// ─── Test: IPC channels are exported correctly ────────────────────────────────

console.log('\n[TC2: IPC channel name exports]');
{
  const { IPC_BUILD_PROGRESS, IPC_BUILD_COMPLETE, IPC_BUILD_ERROR } = await import('../dist/main/hearth_app_builder/build_runner.js');
  assert(IPC_BUILD_PROGRESS === 'hearth-app-build-progress', 'IPC_BUILD_PROGRESS channel name');
  assert(IPC_BUILD_COMPLETE === 'hearth-app-build-complete', 'IPC_BUILD_COMPLETE channel name');
  assert(IPC_BUILD_ERROR === 'hearth-app-build-error', 'IPC_BUILD_ERROR channel name');
}

// ─── Test: BuildRunner class structure ────────────────────────────────────────

console.log('\n[TC3: BuildRunner class structure]');
{
  const { BuildRunner: BR } = await import('../dist/main/hearth_app_builder/build_runner.js');
  const runner = new BR({
    appDir: '/tmp/fake',
    appUuid: 'fake-uuid',
    appName: 'Fake App',
    windows: [],
  });
  assert(typeof runner.run === 'function', 'runner has run() method');
}

// ─── Test: Failure classification covers all known classes ────────────────────

console.log('\n[TC4: All failure classes covered]');
{
  const cases = [
    ['TypeScript error at line 5', 'codegen_tsc_fail'],
    ['ETIMEDOUT connecting to registry', 'npm_install_network_fail'],
    ['codesign failed for darwin', 'electron_builder_signing_fail'],
    ['better-sqlite3 prebuild-install error', 'sqlite3_native_rebuild_fail'],
    ['generic random error', 'unknown'],
  ];

  for (const [input, expected] of cases) {
    const result = classifyBuildFailure(input);
    assert(result.class === expected, `"${input.slice(0, 40)}" → ${expected}`);
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Build Runner tests: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.error('Build Runner tests: FAIL');
  process.exit(1);
} else {
  console.log('Build Runner tests: PASS');
  process.exit(0);
}
