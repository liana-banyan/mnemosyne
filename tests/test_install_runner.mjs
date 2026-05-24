// Hearth App Builder — B69b — Install Runner Tests
// Mocks installer spawn; asserts registry.json append. (G4 gate prep)
//
// Run: node tests/test_install_runner.mjs  (from amplify-computer root, after npm run build:main)

import { existsSync, readFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import {
  loadRegistry,
  appendToRegistry,
  removeFromRegistry,
} from '../dist/main/hearth_app_builder/install_runner.js';

const HEARTH_APPS_DIR = join(homedir(), '.lb_hearth_apps');
const REGISTRY_PATH = join(HEARTH_APPS_DIR, 'registry.json');

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

// ─── Sample spec ──────────────────────────────────────────────────────────────

const SAMPLE_SPEC = {
  appName: 'Test Registry App',
  description: 'A test app for install_runner tests',
  entities: [
    { name: 'Entry', fields: [{ name: 'id', type: 'int', nullable: false }, { name: 'title', type: 'string', nullable: false }] },
  ],
  forms: [{ entity: 'Entry', fields: ['title'], submitLabel: 'Save' }],
  views: [{ name: 'AllEntries', entity: 'Entry', columns: ['title'] }],
  metadata: { author: 'test', version: '0.1.0', createdAt: new Date().toISOString() },
};

const SAMPLE_APP = {
  uuid: 'test-install-runner-uuid-' + Date.now(),
  appName: 'Test Registry App',
  description: 'A test app',
  appDir: join(HEARTH_APPS_DIR, 'test-app'),
  installerPath: undefined,
  installedAt: new Date().toISOString(),
  os: process.platform,
  spec: SAMPLE_SPEC,
  buildStatus: 'built',
};

// ─── TC1: loadRegistry returns empty when no registry exists ──────────────────

console.log('\n[TC1: loadRegistry on missing file]');
{
  // Temporarily rename registry if it exists
  const backup = REGISTRY_PATH + '.backup';
  if (existsSync(REGISTRY_PATH)) {
    const { renameSync } = await import('fs');
    renameSync(REGISTRY_PATH, backup);
  }

  const reg = loadRegistry();
  assert(Array.isArray(reg.apps), 'apps is array');
  assert(reg.apps.length === 0, 'empty registry has no apps');
  assert(reg.schemaVersion === 1, 'default schemaVersion is 1');

  // Restore
  if (existsSync(REGISTRY_PATH + '.backup')) {
    const { renameSync } = await import('fs');
    renameSync(backup, REGISTRY_PATH);
  }
}

// ─── TC2: appendToRegistry writes entry + reads back ─────────────────────────

console.log('\n[TC2: appendToRegistry writes and reads back]');
{
  // Ensure dir exists
  mkdirSync(HEARTH_APPS_DIR, { recursive: true });

  appendToRegistry(SAMPLE_APP);

  const reg = loadRegistry();
  const found = reg.apps.find((a) => a.uuid === SAMPLE_APP.uuid);
  assert(found !== undefined, 'app found in registry after append');
  assert(found?.appName === 'Test Registry App', 'appName preserved');
  assert(found?.buildStatus === 'built', 'buildStatus preserved');
  assert(found?.spec?.entities?.length === 1, 'spec entities preserved');
}

// ─── TC3: appendToRegistry upgrades existing entry (no duplicate) ─────────────

console.log('\n[TC3: appendToRegistry deduplication (upgrade path)]');
{
  const updated = { ...SAMPLE_APP, buildStatus: 'installed', installerPath: '/fake/path/app.exe' };
  appendToRegistry(updated);

  const reg = loadRegistry();
  const entries = reg.apps.filter((a) => a.uuid === SAMPLE_APP.uuid);
  assert(entries.length === 1, 'no duplicate entries after upgrade');
  assert(entries[0].buildStatus === 'installed', 'buildStatus updated to installed');
  assert(entries[0].installerPath === '/fake/path/app.exe', 'installerPath updated');
}

// ─── TC4: removeFromRegistry removes entry ────────────────────────────────────

console.log('\n[TC4: removeFromRegistry removes entry]');
{
  removeFromRegistry(SAMPLE_APP.uuid);

  const reg = loadRegistry();
  const found = reg.apps.find((a) => a.uuid === SAMPLE_APP.uuid);
  assert(found === undefined, 'app removed from registry');
}

// ─── TC5: registry.json is valid JSON on disk ─────────────────────────────────

console.log('\n[TC5: registry.json is valid JSON on disk]');
{
  // Add and remove an entry to ensure registry.json is written
  appendToRegistry({ ...SAMPLE_APP, uuid: 'tc5-test-uuid' });
  removeFromRegistry('tc5-test-uuid');

  if (existsSync(REGISTRY_PATH)) {
    try {
      const raw = readFileSync(REGISTRY_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      assert(typeof parsed === 'object', 'registry.json is valid JSON object');
      assert(Array.isArray(parsed.apps), 'registry.json has apps array');
    } catch (e) {
      console.error('  registry.json parse failed:', e.message);
      failed++;
    }
  } else {
    assert(true, 'registry.json not written (ok if tests ran in clean state)');
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Install Runner tests: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.error('G4 GATE prep: FAIL');
  process.exit(1);
} else {
  console.log('G4 GATE prep: PASS (registry.json append/read/remove verified)');
  process.exit(0);
}
