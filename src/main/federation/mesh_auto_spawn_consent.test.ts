// mesh_auto_spawn_consent.test.ts -- D-BP157-033/BISHOP/seg-worker-permission-consent.
//
// OFFLINE. No IPC, no Electron app singleton, no real %APPDATA%. process.env.APPDATA is pointed
// at a fresh os.tmpdir() subfolder per test and removed afterwards, mirroring
// bishop_dispatch_handler.test.ts's own LB_LEDGER_ROOT-via-tmpdir idiom. `ipcMain` is imported at
// module load time (registerMeshAutoSpawnConsentIpc's only Electron dependency) but never
// invoked by these tests -- only getMeshAutoSpawnConsentSettings / isMeshAutoSpawnConsentGranted /
// setMeshAutoSpawnConsentGranted / _resetMeshAutoSpawnConsentCacheForTests are exercised.
//
// Run: npx vitest run src/main/federation/mesh_auto_spawn_consent.test.ts

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let TEST_APPDATA: string;
let ORIGINAL_APPDATA: string | undefined;

beforeEach(async () => {
  TEST_APPDATA = mkdtempSync(join(tmpdir(), 'mesh-auto-spawn-consent-test-'));
  ORIGINAL_APPDATA = process.env.APPDATA;
  process.env.APPDATA = TEST_APPDATA;
  const { _resetMeshAutoSpawnConsentCacheForTests } = await import('./mesh_auto_spawn_consent');
  _resetMeshAutoSpawnConsentCacheForTests();
});

afterEach(async () => {
  if (ORIGINAL_APPDATA === undefined) delete process.env.APPDATA;
  else process.env.APPDATA = ORIGINAL_APPDATA;
  const { _resetMeshAutoSpawnConsentCacheForTests } = await import('./mesh_auto_spawn_consent');
  _resetMeshAutoSpawnConsentCacheForTests();
  rmSync(TEST_APPDATA, { recursive: true, force: true });
});

function settingsFile(): string {
  return join(TEST_APPDATA, 'MnemosyneC', 'config', 'mesh_auto_spawn_consent.json');
}

describe('getMeshAutoSpawnConsentSettings / isMeshAutoSpawnConsentGranted -- OFF by default', () => {
  test('first run, no settings file on disk: consentGranted is false', async () => {
    const { getMeshAutoSpawnConsentSettings, isMeshAutoSpawnConsentGranted } = await import('./mesh_auto_spawn_consent');
    expect(existsSync(settingsFile())).toBe(false);
    expect(getMeshAutoSpawnConsentSettings()).toEqual({ consentGranted: false });
    expect(isMeshAutoSpawnConsentGranted()).toBe(false);
  });

  test('corrupt settings file: fails CLOSED (false), never throws', async () => {
    const f = settingsFile();
    mkdirSync(join(TEST_APPDATA, 'MnemosyneC', 'config'), { recursive: true });
    writeFileSync(f, '{ not valid json', 'utf8');
    const { isMeshAutoSpawnConsentGranted } = await import('./mesh_auto_spawn_consent');
    expect(() => isMeshAutoSpawnConsentGranted()).not.toThrow();
    expect(isMeshAutoSpawnConsentGranted()).toBe(false);
  });

  test('settings file with consentGranted: true on disk: reads true', async () => {
    const f = settingsFile();
    mkdirSync(join(TEST_APPDATA, 'MnemosyneC', 'config'), { recursive: true });
    writeFileSync(f, JSON.stringify({ consentGranted: true }), 'utf8');
    const { isMeshAutoSpawnConsentGranted } = await import('./mesh_auto_spawn_consent');
    expect(isMeshAutoSpawnConsentGranted()).toBe(true);
  });

  test('a non-boolean consentGranted value on disk is coerced to false, not truthy-cast', async () => {
    const f = settingsFile();
    mkdirSync(join(TEST_APPDATA, 'MnemosyneC', 'config'), { recursive: true });
    writeFileSync(f, JSON.stringify({ consentGranted: 'true' }), 'utf8');
    const { isMeshAutoSpawnConsentGranted } = await import('./mesh_auto_spawn_consent');
    expect(isMeshAutoSpawnConsentGranted()).toBe(false);
  });
});

describe('setMeshAutoSpawnConsentGranted -- persists and flips the in-memory cache', () => {
  test('granting true persists a real file readable back as true', async () => {
    const { setMeshAutoSpawnConsentGranted, isMeshAutoSpawnConsentGranted, _resetMeshAutoSpawnConsentCacheForTests } =
      await import('./mesh_auto_spawn_consent');
    const result = setMeshAutoSpawnConsentGranted(true);
    expect(result).toEqual({ consentGranted: true });
    expect(isMeshAutoSpawnConsentGranted()).toBe(true);

    // Independent of the in-memory cache: re-read from a cleared cache proves it was really
    // written to disk, not just held in the module-local variable.
    _resetMeshAutoSpawnConsentCacheForTests();
    expect(isMeshAutoSpawnConsentGranted()).toBe(true);
    expect(existsSync(settingsFile())).toBe(true);
    expect(JSON.parse(readFileSync(settingsFile(), 'utf8'))).toEqual({ consentGranted: true });
  });

  test('revoking (false) after granting persists false, no confirmation ceremony required by this layer', async () => {
    const { setMeshAutoSpawnConsentGranted, isMeshAutoSpawnConsentGranted } = await import('./mesh_auto_spawn_consent');
    setMeshAutoSpawnConsentGranted(true);
    expect(isMeshAutoSpawnConsentGranted()).toBe(true);
    setMeshAutoSpawnConsentGranted(false);
    expect(isMeshAutoSpawnConsentGranted()).toBe(false);
  });

  test('a truthy non-boolean argument is coerced with === true, never truthy-cast', async () => {
    const { setMeshAutoSpawnConsentGranted } = await import('./mesh_auto_spawn_consent');
    // @ts-expect-error -- deliberately passing a non-boolean to prove the === true coercion holds
    const result = setMeshAutoSpawnConsentGranted('yes');
    expect(result).toEqual({ consentGranted: false });
  });
});
