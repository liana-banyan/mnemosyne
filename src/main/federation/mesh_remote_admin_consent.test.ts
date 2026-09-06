// mesh_remote_admin_consent.test.ts -- D-BP202-M0-01-h2cbp8us-001/BISHOP/BM01.
//
// OFFLINE. No IPC, no Electron app singleton, no real %APPDATA%. process.env.APPDATA is pointed
// at a fresh os.tmpdir() subfolder per test and removed afterwards, mirroring
// mesh_auto_spawn_consent.test.ts's own idiom exactly. `ipcMain` is imported at module load time
// (registerMeshRemoteAdminConsentIpc's only Electron dependency) but never invoked by these
// tests -- only getMeshRemoteAdminConsentSettings / isRemoteAdministrationConsentGranted /
// setRemoteAdministrationConsentGranted / _resetMeshRemoteAdminConsentCacheForTests are exercised.
//
// Run: npx vitest run src/main/federation/mesh_remote_admin_consent.test.ts

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let TEST_APPDATA: string;
let ORIGINAL_APPDATA: string | undefined;

beforeEach(async () => {
  TEST_APPDATA = mkdtempSync(join(tmpdir(), 'mesh-remote-admin-consent-test-'));
  ORIGINAL_APPDATA = process.env.APPDATA;
  process.env.APPDATA = TEST_APPDATA;
  const { _resetMeshRemoteAdminConsentCacheForTests } = await import('./mesh_remote_admin_consent');
  _resetMeshRemoteAdminConsentCacheForTests();
});

afterEach(async () => {
  if (ORIGINAL_APPDATA === undefined) delete process.env.APPDATA;
  else process.env.APPDATA = ORIGINAL_APPDATA;
  const { _resetMeshRemoteAdminConsentCacheForTests } = await import('./mesh_remote_admin_consent');
  _resetMeshRemoteAdminConsentCacheForTests();
  rmSync(TEST_APPDATA, { recursive: true, force: true });
});

function settingsFile(): string {
  return join(TEST_APPDATA, 'MnemosyneC', 'config', 'mesh_remote_admin_consent.json');
}

function autoSpawnSettingsFile(): string {
  return join(TEST_APPDATA, 'MnemosyneC', 'config', 'mesh_auto_spawn_consent.json');
}

describe('getMeshRemoteAdminConsentSettings / isRemoteAdministrationConsentGranted -- OFF by default', () => {
  test('first run, no settings file on disk: consentGranted is false', async () => {
    const { getMeshRemoteAdminConsentSettings, isRemoteAdministrationConsentGranted } =
      await import('./mesh_remote_admin_consent');
    expect(existsSync(settingsFile())).toBe(false);
    expect(getMeshRemoteAdminConsentSettings()).toEqual({ consentGranted: false });
    expect(isRemoteAdministrationConsentGranted()).toBe(false);
  });

  test('corrupt settings file: fails CLOSED (false), never throws', async () => {
    const f = settingsFile();
    mkdirSync(join(TEST_APPDATA, 'MnemosyneC', 'config'), { recursive: true });
    writeFileSync(f, '{ not valid json', 'utf8');
    const { isRemoteAdministrationConsentGranted } = await import('./mesh_remote_admin_consent');
    expect(() => isRemoteAdministrationConsentGranted()).not.toThrow();
    expect(isRemoteAdministrationConsentGranted()).toBe(false);
  });

  test('settings file with consentGranted: true on disk: reads true', async () => {
    const f = settingsFile();
    mkdirSync(join(TEST_APPDATA, 'MnemosyneC', 'config'), { recursive: true });
    writeFileSync(f, JSON.stringify({ consentGranted: true }), 'utf8');
    const { isRemoteAdministrationConsentGranted } = await import('./mesh_remote_admin_consent');
    expect(isRemoteAdministrationConsentGranted()).toBe(true);
  });

  test('a non-boolean consentGranted value on disk is coerced to false, not truthy-cast', async () => {
    const f = settingsFile();
    mkdirSync(join(TEST_APPDATA, 'MnemosyneC', 'config'), { recursive: true });
    writeFileSync(f, JSON.stringify({ consentGranted: 'true' }), 'utf8');
    const { isRemoteAdministrationConsentGranted } = await import('./mesh_remote_admin_consent');
    expect(isRemoteAdministrationConsentGranted()).toBe(false);
  });
});

describe('setRemoteAdministrationConsentGranted -- persists and flips the in-memory cache', () => {
  test('granting true persists a real file readable back as true', async () => {
    const {
      setRemoteAdministrationConsentGranted,
      isRemoteAdministrationConsentGranted,
      _resetMeshRemoteAdminConsentCacheForTests,
    } = await import('./mesh_remote_admin_consent');
    const result = setRemoteAdministrationConsentGranted(true);
    expect(result).toEqual({ consentGranted: true });
    expect(isRemoteAdministrationConsentGranted()).toBe(true);

    // Independent of the in-memory cache: re-read from a cleared cache proves it was really
    // written to disk, not just held in the module-local variable.
    _resetMeshRemoteAdminConsentCacheForTests();
    expect(isRemoteAdministrationConsentGranted()).toBe(true);
    expect(existsSync(settingsFile())).toBe(true);
    expect(JSON.parse(readFileSync(settingsFile(), 'utf8'))).toEqual({ consentGranted: true });
  });

  test('revoking (false) after granting persists false, no confirmation ceremony required by this layer', async () => {
    const { setRemoteAdministrationConsentGranted, isRemoteAdministrationConsentGranted } =
      await import('./mesh_remote_admin_consent');
    setRemoteAdministrationConsentGranted(true);
    expect(isRemoteAdministrationConsentGranted()).toBe(true);
    setRemoteAdministrationConsentGranted(false);
    expect(isRemoteAdministrationConsentGranted()).toBe(false);
  });

  test('a truthy non-boolean argument is coerced with === true, never truthy-cast', async () => {
    const { setRemoteAdministrationConsentGranted } = await import('./mesh_remote_admin_consent');
    // @ts-expect-error -- deliberately passing a non-boolean to prove the === true coercion holds
    const result = setRemoteAdministrationConsentGranted('yes');
    expect(result).toEqual({ consentGranted: false });
  });
});

// ── THE POINT OF THE WHOLE FILE: IT IS A THIRD, INDEPENDENT DECISION ───────────────────────────
//
// The reason this module exists rather than a fourth boolean on an existing settings object is
// that permitting administration of an entire operating system is materially different from
// permitting a version bump or permitting tool execution inside one app. If these two flags ever
// share storage, or one is ever made to imply the other, that distinction is quietly gone and no
// existing test would notice. These two tests would.
describe('independence from mesh_auto_spawn_consent -- a separate decision, separately stored', () => {
  test('granting remote admin does NOT write or flip the auto-spawn consent file', async () => {
    const { setRemoteAdministrationConsentGranted } = await import('./mesh_remote_admin_consent');
    const { isMeshAutoSpawnConsentGranted, _resetMeshAutoSpawnConsentCacheForTests } =
      await import('./mesh_auto_spawn_consent');
    _resetMeshAutoSpawnConsentCacheForTests();

    setRemoteAdministrationConsentGranted(true);

    expect(existsSync(settingsFile())).toBe(true);
    expect(existsSync(autoSpawnSettingsFile())).toBe(false);
    _resetMeshAutoSpawnConsentCacheForTests();
    expect(isMeshAutoSpawnConsentGranted()).toBe(false);
  });

  test('granting auto-spawn does NOT grant remote admin', async () => {
    const { setMeshAutoSpawnConsentGranted } = await import('./mesh_auto_spawn_consent');
    const { isRemoteAdministrationConsentGranted, _resetMeshRemoteAdminConsentCacheForTests } =
      await import('./mesh_remote_admin_consent');

    setMeshAutoSpawnConsentGranted(true);

    _resetMeshRemoteAdminConsentCacheForTests();
    expect(isRemoteAdministrationConsentGranted()).toBe(false);
    expect(existsSync(settingsFile())).toBe(false);
  });
});
