// auto_update_scheduler.trust_root.test.ts -- D-BP157-035/BISHOP/seg-build-trust-root
//
// FOUNDER RULING FD-BP157-12: fix the trust-root hole using the certificate + the IP ledger +
// the Ed25519 chaining already designed for eblet provenance. This file proves the fix.
//
// THE TWO MEASURED DEFECTS this dispatch fixes in auto_update_scheduler.ts:
//   1. LB_PUBLIC_KEY was hardcoded to `null` -- the signature gate was permanently inert.
//   2. The old gate called `crypto.createVerify('ed25519')`, which Node does NOT support for
//      streaming Sign/Verify -- it would THROW at runtime even with a real key present, not
//      merely no-op. Test group 0 below re-proves this against the Node actually running this
//      suite, and proves the replacement API (`crypto.verify(null, message, keyObject, sig)`,
//      the same shape thorax/sign_verify.ts's verifyFrame() already uses elsewhere in this
//      codebase) works correctly.
//
// OFFLINE, MOCKED. 'electron' (app/ipcMain/BrowserWindow/Notification) and
// keys_engines/mesh_update_propagation are both stubbed; os.homedir() is redirected to a
// throwaway temp dir so this suite never reads or writes the real ~/.mnemosynec directory on
// the machine running it (same reasoning peer_artifact_verify.test.ts already documents for
// never touching a real, meaningful user directory). No real network call is made -- global
// fetch is stubbed per test.
//
// A THROWAWAY Ed25519 test keypair is generated fresh in this file's own fixtures below (via
// generateKeyPairSync, the exact call ed25519_keypair.ts's getOrCreateKeypair() already uses).
// It is TEST-ONLY: it exists only to exercise verifyManifestEntrySignature()'s "valid
// signature accepted" and "tampered manifest rejected" cases via an INJECTED key registry
// parameter (verifyManifestEntrySignature(entry, keyRegistry)) -- it is never written to disk,
// never printed, and never used as (or substituted for) any production default. The
// PRODUCTION LB_PUBLIC_KEYS registry shipped in auto_update_scheduler.ts is never touched by
// this file and still contains only the placeholder sentinel -- see group 3 below, which
// proves the REAL shipped registry fails closed end-to-end.
//
// Run: npx vitest run src/main/auto_update_scheduler.trust_root.test.ts

import { describe, test, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import { generateKeyPairSync, createVerify, createHash } from 'node:crypto';
import * as fsReal from 'node:fs';
import * as osReal from 'node:os';
import * as pathReal from 'node:path';

// ─── Fixtures: throwaway home dir + throwaway Ed25519 test keypair ──────────────────────────

// vi.mock factories are hoisted above imports/consts, so the value they close over must come
// from vi.hoisted() (bishop_dispatch_reply.test.ts's own documented reason for the same
// pattern) rather than a plain top-level const.
const fakeHome = vi.hoisted(() => {
  const fs = require('fs') as typeof fsReal;
  const os = require('os') as typeof osReal;
  const path = require('path') as typeof pathReal;
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aus-trust-root-test-'));
});

vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os');
  return { ...actual, homedir: () => fakeHome };
});

const mockApp = vi.hoisted(() => ({
  getPath: vi.fn(() => ''),
  getVersion: vi.fn(() => '0.9.25'),
}));
vi.mock('electron', () => ({
  app: mockApp,
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: class {},
  // Notification.isSupported() -> false means .show() is never reached; this suite never pops
  // a real OS notification.
  Notification: class {
    static isSupported() { return false; }
    show() { /* noop */ }
  },
}));

// The mesh path is exercised only far enough to prove it is NEVER CONSULTED when the manifest
// signature gate fails (group 4) -- these mocks let the module import cleanly without a real
// Supabase config and let the test assert on call counts.
const meshMocks = vi.hoisted(() => ({
  findNewerPeers: vi.fn(async () => []),
  pullAndVerifyFromPeers: vi.fn(async () => ({ ok: false, error: 'not reached in this suite' })),
  seedLocalArtifactCache: vi.fn(),
}));
vi.mock('./keys_engines/mesh_update_propagation', () => meshMocks);

import {
  canonicalManifestEntryString,
  verifyManifestEntrySignature,
  approveMajorVersionUpdate,
  checkAndMaybeDownload,
  setAutoUpdateConfig,
  getUpdateHistory,
} from './auto_update_scheduler';
import { signFrame } from './thorax/sign_verify';

mockApp.getPath.mockImplementation(() => fakeHome);

// Throwaway Ed25519 test keypair -- SAME DER SPKI/PKCS8 hex encoding getOrCreateKeypair() uses
// in ed25519_keypair.ts, generated fresh for this file only. NEVER reused as a production
// default anywhere. NEVER printed.
const testKeypair = generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'der' },
  privateKeyEncoding: { type: 'pkcs8', format: 'der' },
});
const TEST_PUBLIC_KEY_HEX = (testKeypair.publicKey as Buffer).toString('hex');
const TEST_PRIVATE_KEY_HEX = (testKeypair.privateKey as Buffer).toString('hex'); // gitleaks:allow (throwaway test-only key, never a production default)

const TEST_KEY_ID = 'test-only-lb-root-never-real';
const TEST_REGISTRY = {
  [TEST_KEY_ID]: { publicKeyHex: TEST_PUBLIC_KEY_HEX, algorithm: 'ed25519' as const, status: 'active' as const },
};

function signedEntry(overrides: Partial<{
  version: string; url: string; sha256: string; tier: string; keyId: string;
}> = {}) {
  const base = {
    version: '1.2.3',
    url: 'https://mnemosynec.org/downloads/MnemosyneC-Setup-1.2.3.exe',
    sha256: 'a'.repeat(64),
    tier: 'latest',
    keyId: TEST_KEY_ID,
    ...overrides,
  };
  const canonical = canonicalManifestEntryString(base);
  return { ...base, signature: signFrame(canonical, TEST_PRIVATE_KEY_HEX) };
}

afterAll(() => {
  try { fsReal.rmSync(fakeHome, { recursive: true, force: true }); } catch { /* best-effort */ }
});

// ─── Group 0: the underlying Node bug this dispatch fixes, proven against THIS Node ──────────

describe('group 0 -- proof of the two measured defects against the installed Node', () => {
  test('crypto.createVerify("ed25519") throws (construction or .verify()) -- the OLD code path was broken, not merely inert', () => {
    // MEASURED (this dispatch, `node -e` against the installed Node before this test suite was
    // written): construction succeeds but v.verify() throws `TypeError: Invalid digest`. Under
    // vitest's runner the throw was observed at construction instead -- both are "the old call
    // shape throws," which is the property this test guards; the exact throw point is not load
    // bearing, only that the sequence never completes without throwing.
    expect(() => {
      const v = createVerify('ed25519');
      v.update(Buffer.from('anything'));
      v.verify(Buffer.from(TEST_PUBLIC_KEY_HEX, 'hex'), Buffer.alloc(64));
    }).toThrow();
  });

  test('the replacement API (verifyFrame -> crypto.verify(null, msg, KeyObject, sig)) works correctly', () => {
    const entry = signedEntry();
    const result = verifyManifestEntrySignature(entry, TEST_REGISTRY);
    expect(result.ok).toBe(true);
  });
});

// ─── Group 1: verifyManifestEntrySignature -- the pure, hard, fail-closed gate ───────────────

describe('group 1 -- verifyManifestEntrySignature (pure function, injected test registry)', () => {
  test('valid signature from a registered active key is ACCEPTED', () => {
    const entry = signedEntry();
    const result = verifyManifestEntrySignature(entry, TEST_REGISTRY);
    expect(result).toEqual({ ok: true });
  });

  test('tampered manifest (sha256 changed after signing) is REJECTED', () => {
    const entry = signedEntry();
    const tampered = { ...entry, sha256: 'b'.repeat(64) };
    const result = verifyManifestEntrySignature(tampered, TEST_REGISTRY);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/signature verification failed/);
  });

  test('tampered manifest (url swapped after signing) is REJECTED', () => {
    const entry = signedEntry();
    const tampered = { ...entry, url: 'https://evil.example.com/MnemosyneC-Setup-1.2.3.exe' };
    const result = verifyManifestEntrySignature(tampered, TEST_REGISTRY);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/signature verification failed/);
  });

  test('absent signature is REJECTED', () => {
    const entry = signedEntry();
    const { signature: _drop, ...noSig } = entry;
    void _drop;
    const result = verifyManifestEntrySignature(noSig, TEST_REGISTRY);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/missing signature/);
  });

  test('empty-string signature is REJECTED', () => {
    const entry = signedEntry();
    const result = verifyManifestEntrySignature({ ...entry, signature: '' }, TEST_REGISTRY);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/missing signature/);
  });

  test('unknown keyId is REJECTED', () => {
    const entry = signedEntry({ keyId: 'some-keyid-never-registered' });
    const result = verifyManifestEntrySignature(entry, TEST_REGISTRY);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/unknown keyId/);
  });

  test('missing keyId is REJECTED', () => {
    const entry = signedEntry();
    const { keyId: _drop, ...noKeyId } = entry;
    void _drop;
    const result = verifyManifestEntrySignature(noKeyId, TEST_REGISTRY);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/missing keyId/);
  });

  test('a registered but PLACEHOLDER key is REJECTED even though the entry is otherwise well-formed', () => {
    // Simulates the real shipped LB_PUBLIC_KEYS state (group 3 proves the actual production
    // registry directly) using a locally-built registry so this test does not depend on the
    // real registry's keyId string never changing.
    const placeholderRegistry = {
      [TEST_KEY_ID]: { publicKeyHex: 'PLACEHOLDER_KEY_NOT_PROVISIONED_DO_NOT_TRUST', algorithm: 'ed25519' as const, status: 'placeholder' as const },
    };
    const entry = signedEntry();
    const result = verifyManifestEntrySignature(entry, placeholderRegistry);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/placeholder/);
  });

  test('incomplete entry (missing sha256) is REJECTED before any crypto runs', () => {
    const entry = signedEntry();
    const { sha256: _drop, ...noSha } = entry;
    void _drop;
    const result = verifyManifestEntrySignature(noSha, TEST_REGISTRY);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/incomplete manifest entry/);
  });
});

// ─── Group 2: canonicalManifestEntryString binds every field the signature must protect ──────

describe('group 2 -- canonicalManifestEntryString', () => {
  test('different keyId, tier, version, url, or sha256 all produce different canonical strings', () => {
    const base = { keyId: 'k1', tier: 'latest', version: '1.0.0', url: 'https://a', sha256: 'x'.repeat(64) };
    const variants = [
      { ...base, keyId: 'k2' },
      { ...base, tier: 'beta' },
      { ...base, version: '1.0.1' },
      { ...base, url: 'https://b' },
      { ...base, sha256: 'y'.repeat(64) },
    ];
    const baseStr = canonicalManifestEntryString(base);
    for (const v of variants) {
      expect(canonicalManifestEntryString(v)).not.toBe(baseStr);
    }
  });
});

// ─── Group 3: downloadAndVerify's hard gate via approveMajorVersionUpdate (REAL production
//     registry -- proves the actual shipped placeholder-only LB_PUBLIC_KEYS fails closed) ─────

describe('group 3 -- downloadAndVerify hard gate, exercised via approveMajorVersionUpdate() against the REAL shipped registry', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setAutoUpdateConfig({ autoUpdates: true, majorVersionRequiresApproval: true });
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Real installer bytes + their real SHA-256, so entry.sha256 below can be set to the value
  // that ACTUALLY matches what gets "downloaded" -- letting the SHA-256 gate (unchanged,
  // already correct) pass and the run fall through to the Ed25519 signature gate this
  // dispatch fixes, which is what each test in this group is actually proving.
  const FAKE_INSTALLER_BYTES = new TextEncoder().encode('fake installer bytes for D-BP157-035 group 3');
  const FAKE_INSTALLER_SHA256 = createHash('sha256').update(FAKE_INSTALLER_BYTES).digest('hex');

  function stubManifestFetch(entry: Record<string, unknown>) {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('version_trust.json')) {
        return { ok: true, status: 200, json: async () => ({ versions: [{ tier: 'latest', sha256: FAKE_INSTALLER_SHA256, ...entry }] }) };
      }
      return { ok: true, status: 200, arrayBuffer: async () => FAKE_INSTALLER_BYTES.buffer };
    });
  }

  function readyPathFor(version: string): string {
    return pathReal.join(fakeHome, '.mnemosynec', 'updates', `MnemosyneC-Setup-${version}.exe.ready`);
  }

  test('no signature at all: REFUSED, no .ready file, history records the rejection', async () => {
    const version = '9.9.101';
    stubManifestFetch({
      version,
      url: 'https://mnemosynec.org/downloads/x.exe',
      // no signature, no keyId
    });

    const result = await approveMajorVersionUpdate(version);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/missing signature/);
    expect(fsReal.existsSync(readyPathFor(version))).toBe(false);
    const history = getUpdateHistory();
    expect(history.some((h) => h.event === 'signature_rejected' && h.version === version)).toBe(true);
  });

  test('unknown keyId: REFUSED, no .ready file', async () => {
    const version = '9.9.102';
    stubManifestFetch({
      version,
      url: 'https://mnemosynec.org/downloads/x.exe',
      keyId: 'definitely-not-a-registered-keyid',
      signature: 'deadbeef'.repeat(20),
    });

    const result = await approveMajorVersionUpdate(version);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/unknown keyId/);
    expect(fsReal.existsSync(readyPathFor(version))).toBe(false);
  });

  // BP157: lb-root-2026-01 was a PLACEHOLDER when this suite was written and is now a REAL,
  // PROVISIONED key (status 'active', public half installed 2026-08-18). The security property
  // under test is unchanged -- a manifest we cannot verify is REFUSED and no .ready file is
  // written. Only the REASON changed, from 'placeholder' to a genuine signature failure. The
  // assertion is updated to the new truth rather than loosened: it still requires a refusal.
  test('the REAL shipped keyId (lb-root-2026-01) REFUSES a bogus signature, no .ready file', async () => {
    const version = '9.9.103';
    stubManifestFetch({
      version,
      url: 'https://mnemosynec.org/downloads/x.exe',
      keyId: 'lb-root-2026-01', // real, provisioned, active -- signature below is deliberately junk
      signature: 'deadbeef'.repeat(20),
    });

    const result = await approveMajorVersionUpdate(version);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/signature verification failed/);
    expect(fsReal.existsSync(readyPathFor(version))).toBe(false);
  });
});

// ─── Group 4: mesh delivery inherits trust, never grants it ─────────────────────────────────

describe('group 4 -- checkAndMaybeDownload: manifest signature gate runs BEFORE the mesh path', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    meshMocks.findNewerPeers.mockClear();
    meshMocks.pullAndVerifyFromPeers.mockClear();
    meshMocks.seedLocalArtifactCache.mockClear();
    setAutoUpdateConfig({ autoUpdates: true, majorVersionRequiresApproval: false });
    fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('version_trust.json')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            versions: [{
              tier: 'latest',
              version: '9.9.200', // newer than mockApp.getVersion() = 0.9.25
              url: 'https://mnemosynec.org/downloads/x.exe',
              sha256: 'f'.repeat(64),
              // no signature/keyId -- an unsigned/tampered manifest
            }],
          }),
        };
      }
      return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(0) };
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('an unsigned manifest entry never reaches findNewerPeers/pullAndVerifyFromPeers at all', async () => {
    await checkAndMaybeDownload();

    // The strongest form of "a peer-offered artifact whose hash is not in a verified manifest
    // is rejected": the mesh path is never even consulted, so no peer's self-reported hash --
    // or the manifest's own unverified sha256 -- is ever used to accept anything from a peer.
    expect(meshMocks.findNewerPeers).not.toHaveBeenCalled();
    expect(meshMocks.pullAndVerifyFromPeers).not.toHaveBeenCalled();

    const history = getUpdateHistory();
    expect(history.some((h) => h.event === 'manifest_signature_rejected' && h.version === '9.9.200')).toBe(true);
  });
});
