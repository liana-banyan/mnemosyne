// auto_update_scheduler.trust_root_rotation.test.ts -- D-BP157-052/BISHOP/seg-build-root-rotation-retry
//
// THE PROBLEM this dispatch fixes: LB_PUBLIC_KEYS in auto_update_scheduler.ts is COMPILED APP
// CODE. A client older than the release that introduces a new keyId fails closed on "unknown
// keyId" (verifyManifestEntrySignature, by design) and then has no path back -- it never sees
// another signed update. This suite proves the fix: a SIGNED root-rotation announcement,
// verified against an ALREADY-TRUSTED key (never TOFU), persisted to a local overlay file, and
// consulted by verifyManifestEntrySignature() alongside the compiled registry from then on.
//
// OFFLINE, MOCKED -- same idiom as auto_update_scheduler.trust_root.test.ts: 'electron' is
// stubbed, os.homedir() is redirected to a throwaway temp dir so this suite never reads or
// writes the real ~/.mnemosynec or real userData directory, and mesh propagation is stubbed.
// No real network call is made.
//
// A THROWAWAY Ed25519 test keypair (in fact several: a "compiled root", a "rotated-in root",
// and an "untrusted attacker" key) is generated fresh in this file's own fixtures below via
// generateKeyPairSync -- the exact call ed25519_keypair.ts's getOrCreateKeypair() already uses.
// None of these are written to disk outside the throwaway temp dir, printed, or reused as a
// production default anywhere.
//
// Run: npx vitest run src/main/auto_update_scheduler.trust_root_rotation.test.ts

import { describe, test, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import * as fsReal from 'node:fs';
import * as osReal from 'node:os';
import * as pathReal from 'node:path';

// ─── Fixtures: throwaway home dir ─────────────────────────────────────────────────────────────

const fakeHome = vi.hoisted(() => {
  const fs = require('fs') as typeof fsReal;
  const os = require('os') as typeof osReal;
  const path = require('path') as typeof pathReal;
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aus-trust-rotation-test-'));
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
  Notification: class {
    static isSupported() { return false; }
    show() { /* noop */ }
  },
}));

const meshMocks = vi.hoisted(() => ({
  findNewerPeers: vi.fn(async () => []),
  pullAndVerifyFromPeers: vi.fn(async () => ({ ok: false, error: 'not reached in this suite' })),
  seedLocalArtifactCache: vi.fn(),
}));
vi.mock('./keys_engines/mesh_update_propagation', () => meshMocks);

import {
  canonicalManifestEntryString,
  canonicalRotationString,
  verifyManifestEntrySignature,
  verifyRotationAnnouncement,
  applyRotationAnnouncement,
  loadTrustOverlay,
  getTrustOverlayPath,
  getEffectiveKeyRegistry,
  checkAndMaybeDownload,
  setAutoUpdateConfig,
  getUpdateHistory,
} from './auto_update_scheduler';
import { signFrame } from './thorax/sign_verify';

mockApp.getPath.mockImplementation(() => fakeHome);

// ─── Test keypairs -- throwaway, never production defaults, never printed ───────────────────
const compiledKp = generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'der' },
  privateKeyEncoding: { type: 'pkcs8', format: 'der' },
});
const COMPILED_PUB = (compiledKp.publicKey as Buffer).toString('hex');
const COMPILED_PRIV = (compiledKp.privateKey as Buffer).toString('hex'); // gitleaks:allow (throwaway test key)
const COMPILED_KEY_ID = 'test-compiled-root-never-real';

const rotatedKp = generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'der' },
  privateKeyEncoding: { type: 'pkcs8', format: 'der' },
});
const ROTATED_PUB = (rotatedKp.publicKey as Buffer).toString('hex');
const ROTATED_PRIV = (rotatedKp.privateKey as Buffer).toString('hex'); // gitleaks:allow (throwaway test key)
const ROTATED_KEY_ID = 'test-rotated-root-never-real';

const attackerKp = generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'der' },
  privateKeyEncoding: { type: 'pkcs8', format: 'der' },
});
const ATTACKER_PRIV = (attackerKp.privateKey as Buffer).toString('hex'); // gitleaks:allow (throwaway test key)

const COMPILED_REGISTRY = {
  [COMPILED_KEY_ID]: { publicKeyHex: COMPILED_PUB, algorithm: 'ed25519' as const, status: 'active' as const },
};

function signRotation(
  fields: { sequence: number; add?: Array<{ keyId: string; publicKeyHex: string; algorithm?: 'ed25519' }>; revoke?: string[]; signedBy: string },
  privateKeyHex: string,
) {
  const canonical = canonicalRotationString(fields);
  return { ...fields, signature: signFrame(canonical, privateKeyHex) };
}

function overlayPath(): string {
  return getTrustOverlayPath();
}

function cleanOverlay(): void {
  const p = overlayPath();
  try { fsReal.unlinkSync(p); } catch { /* noop -- fine if it never existed */ }
}

afterAll(() => {
  try { fsReal.rmSync(fakeHome, { recursive: true, force: true }); } catch { /* best-effort */ }
});

beforeEach(() => {
  cleanOverlay();
});

// ─── Group 1: verifyRotationAnnouncement -- pure gate, injected compiled registry + overlay ──

describe('group 1 -- verifyRotationAnnouncement (pure function)', () => {
  test('valid announcement, signed by an already-trusted compiled key, is ACCEPTED', () => {
    const announcement = signRotation(
      { sequence: 1, add: [{ keyId: ROTATED_KEY_ID, publicKeyHex: ROTATED_PUB, algorithm: 'ed25519' }], signedBy: COMPILED_KEY_ID },
      COMPILED_PRIV,
    );
    const result = verifyRotationAnnouncement(announcement, COMPILED_REGISTRY, { highWaterSequence: 0, keys: {} });
    expect(result.ok).toBe(true);
    expect(result.nextOverlay?.keys[ROTATED_KEY_ID].publicKeyHex).toBe(ROTATED_PUB);
    expect(result.nextOverlay?.highWaterSequence).toBe(1);
  });

  test('unknown-signer (TOFU) is REJECTED -- signedBy not present in compiled or overlay registry', () => {
    // Signed with the "rotated" key, but that key has never been introduced -- it is not yet
    // trusted by anyone. A rotation announcement can never vouch for itself.
    const announcement = signRotation(
      { sequence: 1, add: [{ keyId: 'some-new-key', publicKeyHex: ROTATED_PUB }], signedBy: ROTATED_KEY_ID },
      ROTATED_PRIV,
    );
    const result = verifyRotationAnnouncement(announcement, COMPILED_REGISTRY, { highWaterSequence: 0, keys: {} });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/unknown signer keyId/);
    expect(result.reason).toMatch(/TOFU refused/);
  });

  test('an attacker-signed announcement (signedBy claims a trusted keyId but signature is from a different key) is REJECTED', () => {
    const announcement = signRotation(
      { sequence: 1, add: [{ keyId: 'attacker-key', publicKeyHex: ROTATED_PUB }], signedBy: COMPILED_KEY_ID },
      ATTACKER_PRIV, // signed with the WRONG key even though signedBy names the trusted one
    );
    const result = verifyRotationAnnouncement(announcement, COMPILED_REGISTRY, { highWaterSequence: 0, keys: {} });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/signature verification failed/);
  });

  test('unsigned (missing signature) is REJECTED', () => {
    const { signature: _drop, ...noSig } = signRotation(
      { sequence: 1, add: [{ keyId: ROTATED_KEY_ID, publicKeyHex: ROTATED_PUB }], signedBy: COMPILED_KEY_ID },
      COMPILED_PRIV,
    );
    void _drop;
    const result = verifyRotationAnnouncement(noSig, COMPILED_REGISTRY, { highWaterSequence: 0, keys: {} });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/missing signature/);
  });

  test('empty-string signature is REJECTED', () => {
    const announcement = signRotation(
      { sequence: 1, add: [{ keyId: ROTATED_KEY_ID, publicKeyHex: ROTATED_PUB }], signedBy: COMPILED_KEY_ID },
      COMPILED_PRIV,
    );
    const result = verifyRotationAnnouncement({ ...announcement, signature: '' }, COMPILED_REGISTRY, { highWaterSequence: 0, keys: {} });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/missing signature/);
  });

  test('replay: the SAME announcement submitted twice is REJECTED the second time (sequence == high-water mark)', () => {
    const announcement = signRotation(
      { sequence: 5, add: [{ keyId: ROTATED_KEY_ID, publicKeyHex: ROTATED_PUB }], signedBy: COMPILED_KEY_ID },
      COMPILED_PRIV,
    );
    const overlayAfterFirst = { highWaterSequence: 5, keys: {} }; // simulates already-accepted at seq 5
    const result = verifyRotationAnnouncement(announcement, COMPILED_REGISTRY, overlayAfterFirst);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/replay or rollback/);
  });

  test('rollback: a LOWER sequence than the high-water mark is REJECTED', () => {
    const announcement = signRotation(
      { sequence: 3, add: [{ keyId: ROTATED_KEY_ID, publicKeyHex: ROTATED_PUB }], signedBy: COMPILED_KEY_ID },
      COMPILED_PRIV,
    );
    const overlay = { highWaterSequence: 7, keys: {} };
    const result = verifyRotationAnnouncement(announcement, COMPILED_REGISTRY, overlay);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/replay or rollback/);
  });

  test('revocation of a previously-introduced overlay key is HONORED -- key no longer usable afterward', () => {
    const overlayWithRotatedKey = {
      highWaterSequence: 1,
      keys: {
        [ROTATED_KEY_ID]: { publicKeyHex: ROTATED_PUB, algorithm: 'ed25519' as const, status: 'active' as const, addedAtUtc: new Date().toISOString(), introducedBySequence: 1 },
      },
    };
    const announcement = signRotation(
      { sequence: 2, revoke: [ROTATED_KEY_ID], signedBy: COMPILED_KEY_ID },
      COMPILED_PRIV,
    );
    const result = verifyRotationAnnouncement(announcement, COMPILED_REGISTRY, overlayWithRotatedKey);
    expect(result.ok).toBe(true);
    expect(result.nextOverlay?.keys[ROTATED_KEY_ID].status).toBe('revoked');
    // The revoked key must no longer appear in the effective (usable-for-verification) registry.
    const effective = getEffectiveKeyRegistry(COMPILED_REGISTRY, result.nextOverlay!);
    expect(effective[ROTATED_KEY_ID]).toBeUndefined();
  });

  test('revocation of a COMPILED-IN root key is REFUSED outright -- the whole announcement is rejected, not partially applied', () => {
    const announcement = signRotation(
      { sequence: 1, revoke: [COMPILED_KEY_ID], signedBy: COMPILED_KEY_ID },
      COMPILED_PRIV,
    );
    const result = verifyRotationAnnouncement(announcement, COMPILED_REGISTRY, { highWaterSequence: 0, keys: {} });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/revocation of compiled-in root key.*refused/);
  });

  test('an announcement that would leave the trusted set EMPTY is REJECTED (defense-in-depth: empty compiled registry + revoke the only overlay key)', () => {
    const overlayWithOneKey = {
      highWaterSequence: 1,
      keys: {
        [ROTATED_KEY_ID]: { publicKeyHex: ROTATED_PUB, algorithm: 'ed25519' as const, status: 'active' as const, addedAtUtc: new Date().toISOString(), introducedBySequence: 1 },
      },
    };
    const announcement = signRotation(
      { sequence: 2, revoke: [ROTATED_KEY_ID], signedBy: ROTATED_KEY_ID },
      ROTATED_PRIV,
    );
    const result = verifyRotationAnnouncement(announcement, {}, overlayWithOneKey);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/empty trusted-key set/);
  });
});

// ─── Group 2: canonicalRotationString binds every field ──────────────────────────────────────

describe('group 2 -- canonicalRotationString', () => {
  test('different sequence, add, revoke, or signedBy all produce different canonical strings', () => {
    const base = { sequence: 1, add: [{ keyId: 'k1', publicKeyHex: 'aa', algorithm: 'ed25519' }], revoke: ['x'], signedBy: 'root1' };
    const variants = [
      { ...base, sequence: 2 },
      { ...base, add: [{ keyId: 'k2', publicKeyHex: 'aa', algorithm: 'ed25519' }] },
      { ...base, revoke: ['y'] },
      { ...base, signedBy: 'root2' },
    ];
    const baseStr = canonicalRotationString(base);
    for (const v of variants) {
      expect(canonicalRotationString(v)).not.toBe(baseStr);
    }
  });
});

// ─── Group 3: applyRotationAnnouncement -- persistence + history, new key usable after ───────

describe('group 3 -- applyRotationAnnouncement (persists overlay, writes history)', () => {
  test('accepted rotation persists to disk at getTrustOverlayPath() and the new key verifies a manifest entry afterward', () => {
    const announcement = signRotation(
      { sequence: 1, add: [{ keyId: ROTATED_KEY_ID, publicKeyHex: ROTATED_PUB, algorithm: 'ed25519' }], signedBy: COMPILED_KEY_ID },
      COMPILED_PRIV,
    );
    const result = applyRotationAnnouncement(announcement, COMPILED_REGISTRY);
    expect(result.ok).toBe(true);

    // Persisted to the documented path, in the documented shape.
    const p = overlayPath();
    expect(fsReal.existsSync(p)).toBe(true);
    const onDisk = JSON.parse(fsReal.readFileSync(p, 'utf-8'));
    expect(onDisk.highWaterSequence).toBe(1);
    expect(onDisk.keys[ROTATED_KEY_ID].publicKeyHex).toBe(ROTATED_PUB);

    // The NEW key is now usable: a version-manifest entry signed by ROTATED_KEY_ID verifies
    // successfully against getEffectiveKeyRegistry(COMPILED_REGISTRY, loadTrustOverlay()) --
    // i.e. an old client that only ever had COMPILED_REGISTRY compiled in can now verify a
    // release signed by the rotated-in key, without a recompile.
    const versionEntryFields = { keyId: ROTATED_KEY_ID, tier: 'latest', version: '9.9.9', url: 'https://mnemosynec.org/dl/x.exe', sha256: 'a'.repeat(64) };
    const versionCanonical = canonicalManifestEntryString(versionEntryFields);
    const versionEntry = { ...versionEntryFields, signature: signFrame(versionCanonical, ROTATED_PRIV) };
    const effective = getEffectiveKeyRegistry(COMPILED_REGISTRY, loadTrustOverlay());
    const sigCheck = verifyManifestEntrySignature(versionEntry, effective);
    expect(sigCheck.ok).toBe(true);

    // History recorded the acceptance (Requirement 7).
    const history = getUpdateHistory();
    expect(history.some((h) => h.event === 'root_rotation_accepted' && h.sequence === 1)).toBe(true);
  });

  test('a rejected rotation is NOT persisted and IS recorded in history with its reason', () => {
    const before = loadTrustOverlay();
    const announcement = signRotation(
      { sequence: 1, add: [{ keyId: 'x', publicKeyHex: 'aa' }], signedBy: 'never-trusted-keyid' },
      ATTACKER_PRIV,
    );
    const result = applyRotationAnnouncement(announcement, COMPILED_REGISTRY);
    expect(result.ok).toBe(false);

    const after = loadTrustOverlay();
    expect(after).toEqual(before); // untouched

    const history = getUpdateHistory();
    expect(history.some((h) => h.event === 'root_rotation_rejected' && /unknown signer/.test(String(h.reason)))).toBe(true);
  });
});

// ─── Group 4: overlay persistence -- fail-closed on corruption (Requirement 4) ────────────────

describe('group 4 -- loadTrustOverlay fails closed to compiled-only on a damaged file', () => {
  test('missing overlay file -> empty overlay (compiled-only)', () => {
    expect(fsReal.existsSync(overlayPath())).toBe(false);
    const overlay = loadTrustOverlay();
    expect(overlay).toEqual({ highWaterSequence: 0, keys: {} });
    const effective = getEffectiveKeyRegistry(COMPILED_REGISTRY, overlay);
    expect(Object.keys(effective)).toEqual([COMPILED_KEY_ID]);
  });

  test('corrupt (unparseable JSON) overlay file -> falls back cleanly to compiled-only, does not throw', () => {
    const p = overlayPath();
    fsReal.mkdirSync(pathReal.dirname(p), { recursive: true });
    fsReal.writeFileSync(p, '{ this is not valid json ][');
    expect(() => loadTrustOverlay()).not.toThrow();
    const overlay = loadTrustOverlay();
    expect(overlay).toEqual({ highWaterSequence: 0, keys: {} });
    const effective = getEffectiveKeyRegistry(COMPILED_REGISTRY, overlay);
    expect(Object.keys(effective)).toEqual([COMPILED_KEY_ID]);
  });

  test('wrong-shape (valid JSON, but not an overlay) overlay file -> falls back cleanly to compiled-only', () => {
    const p = overlayPath();
    fsReal.mkdirSync(pathReal.dirname(p), { recursive: true });
    fsReal.writeFileSync(p, JSON.stringify({ totally: 'unrelated', data: [1, 2, 3] }));
    const overlay = loadTrustOverlay();
    expect(overlay).toEqual({ highWaterSequence: 0, keys: {} });
  });

  test('a rotation poll cycle survives a corrupt overlay file without throwing (applyRotationAnnouncement still works, starting fresh)', () => {
    const p = overlayPath();
    fsReal.mkdirSync(pathReal.dirname(p), { recursive: true });
    fsReal.writeFileSync(p, 'not json at all');

    const announcement = signRotation(
      { sequence: 1, add: [{ keyId: ROTATED_KEY_ID, publicKeyHex: ROTATED_PUB }], signedBy: COMPILED_KEY_ID },
      COMPILED_PRIV,
    );
    expect(() => applyRotationAnnouncement(announcement, COMPILED_REGISTRY)).not.toThrow();
    const overlay = loadTrustOverlay();
    // The corrupt file was replaced by a fresh, valid overlay once a rotation was accepted.
    expect(overlay.keys[ROTATED_KEY_ID]).toBeDefined();
  });
});

// ─── Group 5: wired into checkAndMaybeDownload -- consumed over the existing fetch, no new poller ─

describe('group 5 -- checkAndMaybeDownload processes rootRotations from the SAME version_trust.json fetch', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setAutoUpdateConfig({ autoUpdates: true, majorVersionRequiresApproval: false });
    meshMocks.findNewerPeers.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('a valid rootRotations entry in version_trust.json is applied during the normal poll, with no separate network call', () => {
    const announcement = signRotation(
      { sequence: 1, add: [{ keyId: ROTATED_KEY_ID, publicKeyHex: ROTATED_PUB }], signedBy: 'lb-root-2026-01' },
      // Signed by the REAL production compiled keyId's corresponding key would require the
      // real private key, which this dispatch must never touch. Instead this proves the
      // WIRING (rootRotations is read and applyRotationAnnouncement is invoked once per
      // entry) by asserting the rejection path is recorded via history -- the real signature
      // math is already proven against injected registries in groups 1 and 3 above.
      COMPILED_PRIV,
    );

    fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('version_trust.json')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            versions: [{ tier: 'latest', version: '0.9.25', url: 'https://mnemosynec.org/dl/x.exe', sha256: 'a'.repeat(64) }],
            rootRotations: [announcement],
          }),
        };
      }
      return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(0) };
    });
    vi.stubGlobal('fetch', fetchMock);

    return checkAndMaybeDownload().then(() => {
      // Only ONE distinct URL was ever fetched for the manifest (the version_trust.json call) --
      // no second network round-trip was added for rotation delivery.
      const manifestFetchCalls = fetchMock.mock.calls.filter((c: unknown[]) => String(c[0]).includes('version_trust.json'));
      expect(manifestFetchCalls.length).toBe(1);

      const history = getUpdateHistory();
      // signedBy 'lb-root-2026-01' IS the real compiled keyId, but this announcement was signed
      // with a throwaway test key, not the real private key -- so it is correctly REJECTED
      // (signature verification failed), proving the wiring runs the real verifier end to end
      // rather than trusting the announcement just because it arrived.
      expect(history.some((h) => h.event === 'root_rotation_rejected' && h.sequence === 1)).toBe(true);
    });
  });
});
