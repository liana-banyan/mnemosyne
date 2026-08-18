// trust_root_ceremony_scripts.roundtrip.test.ts -- D-BP157-036/BISHOP/seg-offline-key-ceremony
//
// PROVES THE CEREMONY WILL WORK before the Founder spends his own time on it.
//
// This test spawns the two real ceremony scripts as actual child processes -- exactly as the
// Founder will run them by hand -- against a THROWAWAY keypair in a throwaway temp directory
// (never inside this repo, never inside a git working tree, never inside a cloud-synced
// folder -- os.tmpdir() on this machine, verified NOT to have a `.git` ancestor and NOT to sit
// under any OneDrive/Dropbox/Google Drive path). It then feeds the signed output into the
// REAL, imported verifyManifestEntrySignature() from auto_update_scheduler.ts -- not a
// reimplementation, not a mock of the verifier -- and asserts acceptance. It then tampers with
// one field and asserts rejection. This is the one test that matters: it proves
// scripts/trust_root_keygen.mjs + scripts/trust_root_sign_manifest.mjs produce output the
// shipped verifier actually accepts.
//
// The throwaway private key never leaves the throwaway temp directory, is deleted in
// afterAll(), and is never printed by this test (only by the script's own stdout, which this
// test does not echo further -- it only greps two fields out of it).
//
// Run: npx vitest run src/main/trust_root_ceremony_scripts.roundtrip.test.ts

import { describe, test, expect, vi, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHash } from 'node:crypto';

// ─── Mock 'electron' + the mesh module so importing auto_update_scheduler.ts is safe outside
// a real Electron process -- same pattern auto_update_scheduler.trust_root.test.ts already
// uses. This test never calls any function that would touch a real Electron API; the mock only
// exists to let the module-level `import { app, ... } from 'electron'` resolve cleanly.
const mockApp = vi.hoisted(() => ({
  getPath: vi.fn(() => ''),
  getVersion: vi.fn(() => '0.9.25'),
}));
vi.mock('electron', () => ({
  app: mockApp,
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: class {},
  Notification: class {
    static isSupported() { return false; }
    show() { /* noop */ }
  },
}));
vi.mock('./keys_engines/mesh_update_propagation', () => ({
  findNewerPeers: vi.fn(async () => []),
  pullAndVerifyFromPeers: vi.fn(async () => ({ ok: false, error: 'not used by this suite' })),
  seedLocalArtifactCache: vi.fn(),
}));

import { verifyManifestEntrySignature, canonicalManifestEntryString } from './auto_update_scheduler';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const KEYGEN_SCRIPT = path.join(REPO_ROOT, 'scripts', 'trust_root_keygen.mjs');
const SIGN_SCRIPT = path.join(REPO_ROOT, 'scripts', 'trust_root_sign_manifest.mjs');

let tmpDir: string;
let privateKeyPath: string;
let pubkeySidecarPath: string;
let publicKeyHex: string;
const TEST_KEY_ID = 'test-throwaway-keyid-do-not-use';

beforeAll(() => {
  // A THROWAWAY directory, NOT inside this repo, NOT inside any git working tree, NOT inside a
  // cloud-synced folder. os.tmpdir() resolves to AppData\Local\Temp on this machine -- verified
  // (this test's own assertions below) to have no .git ancestor and no OneDrive/Dropbox/Google
  // Drive path component, which is exactly what trust_root_keygen.mjs's own refusal gates check.
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trust-root-roundtrip-test-'));
  privateKeyPath = path.join(tmpDir, 'throwaway-root.private.json');
  pubkeySidecarPath = `${privateKeyPath}.pubkey.txt`;
});

afterAll(() => {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

describe('trust root ceremony scripts: sanity of the throwaway location', () => {
  test('os.tmpdir() has no .git ancestor (keygen would refuse otherwise)', () => {
    let dir = path.resolve(os.tmpdir());
    for (;;) {
      expect(fs.existsSync(path.join(dir, '.git'))).toBe(false);
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  });

  test('os.tmpdir() path does not contain a known cloud-sync folder name', () => {
    const p = os.tmpdir().toLowerCase();
    for (const needle of ['onedrive', 'dropbox', 'google drive', 'icloud']) {
      expect(p.includes(needle)).toBe(false);
    }
  });
});

describe('trust_root_keygen.mjs: refusal gates (against THIS repo, proving they fire)', () => {
  test('refuses to write inside this repository', () => {
    const insideRepoPath = path.join(REPO_ROOT, 'scratchpad', 'should-never-be-written.json');
    expect(() =>
      execFileSync(process.execPath, [KEYGEN_SCRIPT, insideRepoPath], { stdio: 'pipe' }),
    ).toThrow();
    expect(fs.existsSync(insideRepoPath)).toBe(false);
  });

  test('refuses to write inside a detected cloud-sync path (OneDrive env var)', () => {
    const oneDrive = process.env.OneDrive;
    if (!oneDrive) {
      // This machine has no OneDrive env var set -- nothing to prove here, skip cleanly.
      return;
    }
    const cloudPath = path.join(oneDrive, 'should-never-be-written.json');
    expect(() =>
      execFileSync(process.execPath, [KEYGEN_SCRIPT, cloudPath], { stdio: 'pipe' }),
    ).toThrow();
    expect(fs.existsSync(cloudPath)).toBe(false);
  });
});

describe('trust root ceremony round trip: keygen -> sign -> REAL app verifier', () => {
  let signedEntryPath: string;
  let signedEntry: {
    version: string; url: string; sha256: string; tier: string; keyId: string; signature: string;
  };
  const testVersion = '9.9.9-throwaway-test';
  const testUrl = 'https://example.invalid/MnemosyneC-Setup-9.9.9-throwaway-test.exe';
  const testSha256 = createHash('sha256').update('throwaway-test-payload-not-a-real-installer').digest('hex');

  beforeAll(() => {
    // Step 1: run the REAL keygen script exactly as the Founder will run it.
    const keygenStdout = execFileSync(
      process.execPath,
      [KEYGEN_SCRIPT, privateKeyPath, '--keyid', TEST_KEY_ID],
      { encoding: 'utf8' },
    );
    expect(keygenStdout).toContain(TEST_KEY_ID);
    expect(keygenStdout).not.toMatch(/privateKeyHex/); // stdout must never carry the private key
    expect(fs.existsSync(privateKeyPath)).toBe(true);
    expect(fs.existsSync(pubkeySidecarPath)).toBe(true);

    const pubSidecarText = fs.readFileSync(pubkeySidecarPath, 'utf8');
    const m = pubSidecarText.match(/publicKeyHex:\s*([0-9a-f]+)/i);
    if (!m) throw new Error('pubkey sidecar missing publicKeyHex line');
    publicKeyHex = m[1];

    // Step 2: run the REAL signing script exactly as the Founder will run it, once per release.
    signedEntryPath = path.join(tmpDir, 'signed-entry.json');
    const signStdout = execFileSync(
      process.execPath,
      [
        SIGN_SCRIPT,
        '--key', privateKeyPath,
        '--version', testVersion,
        '--url', testUrl,
        '--sha256', testSha256,
        '--keyid', TEST_KEY_ID,
        '--out', signedEntryPath,
      ],
      { encoding: 'utf8' },
    );
    expect(signStdout).toContain('No network call was made');
    expect(fs.existsSync(signedEntryPath)).toBe(true);
    signedEntry = JSON.parse(fs.readFileSync(signedEntryPath, 'utf8'));
  });

  test('signing script bound the exact canonical string the app derives', () => {
    const expectedCanonical = canonicalManifestEntryString({
      keyId: TEST_KEY_ID,
      tier: 'latest',
      version: testVersion,
      url: testUrl,
      sha256: testSha256,
    });
    // entry.signature is canonical + 128 hex sig chars (thorax sign_verify.ts wire shape).
    expect(signedEntry.signature.startsWith(expectedCanonical)).toBe(true);
    expect(signedEntry.signature.length).toBe(expectedCanonical.length + 128);
  });

  test('a signature produced by trust_root_sign_manifest.mjs is ACCEPTED by the real, imported verifyManifestEntrySignature()', () => {
    const registry = {
      [TEST_KEY_ID]: { publicKeyHex, algorithm: 'ed25519' as const, status: 'active' as const },
    };
    const result = verifyManifestEntrySignature(signedEntry, registry);
    expect(result).toEqual({ ok: true });
  });

  test('a tampered sha256 is REJECTED by the real verifier', () => {
    const registry = {
      [TEST_KEY_ID]: { publicKeyHex, algorithm: 'ed25519' as const, status: 'active' as const },
    };
    const tampered = { ...signedEntry, sha256: createHash('sha256').update('different-payload').digest('hex') };
    const result = verifyManifestEntrySignature(tampered, registry);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/signature verification failed/);
  });

  test('a tampered url is REJECTED by the real verifier', () => {
    const registry = {
      [TEST_KEY_ID]: { publicKeyHex, algorithm: 'ed25519' as const, status: 'active' as const },
    };
    const tampered = { ...signedEntry, url: 'https://example.invalid/a-different-file.exe' };
    const result = verifyManifestEntrySignature(tampered, registry);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/signature verification failed/);
  });

  test('the same signature under an unknown keyId is REJECTED (fail closed, not "any known signature")', () => {
    const registry = {
      'a-completely-different-keyid': { publicKeyHex, algorithm: 'ed25519' as const, status: 'active' as const },
    };
    const result = verifyManifestEntrySignature(signedEntry, registry);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/unknown keyId/);
  });
});
