// localPeerKeypair.signing.test.ts -- D-BP223-BM09-ARCHBISHOP-004-016 (REDO of 004-010)
// Tests signWithLocalPeerKey(), the new generic Ed25519 signing primitive added to the EXISTING
// local peer keypair module for "My Savings Receipt" (never a second keypair). Mirrors the exact
// electron/safeStorage mock setup localPeerKeypair.encrypt_private_key.test.ts already uses --
// same fake DPAPI, same scratch userData/PROGRAMDATA/user-profile env vars -- so no real key
// directory is ever read or written.

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verify, createPublicKey } from 'node:crypto';

let scratch: string;
let available = false;
const showMessageBox = vi.fn(async () => ({ response: 0 }));
const saved: Record<string, string | undefined> = {};

// Fake DPAPI, identical scheme to localPeerKeypair.encrypt_private_key.test.ts: "v10" + base64 of
// the reversed string, so the raw file never contains the key hex.
const enc = (s: string) => Buffer.concat([Buffer.from('v10'), Buffer.from(Buffer.from(s.split('').reverse().join('')).toString('base64'))]);
const dec = (b: Buffer) => Buffer.from(b.subarray(3).toString(), 'base64').toString().split('').reverse().join('');

const userData = () => join(scratch, 'userData');

beforeEach(() => {
  vi.resetModules();
  showMessageBox.mockClear();
  available = false;
  scratch = mkdtempSync(join(tmpdir(), 'x016-savings-signing-'));
  for (const k of ['APPDATA', 'LOCALAPPDATA', 'PROGRAMDATA', 'MNEMOSYNE_USERS_ROOT']) saved[k] = process.env[k];
  process.env.APPDATA = join(scratch, 'appdata');
  process.env.LOCALAPPDATA = join(scratch, 'localappdata');
  process.env.PROGRAMDATA = join(scratch, 'programdata');
  process.env.MNEMOSYNE_USERS_ROOT = join(scratch, 'users');
  vi.doMock('electron', () => ({
    app: { getPath: () => userData(), isReady: () => true },
    safeStorage: { isEncryptionAvailable: () => available, encryptString: enc, decryptString: dec },
    dialog: { showMessageBox },
  }));
});

afterEach(() => {
  vi.doUnmock('electron');
  for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  rmSync(scratch, { recursive: true, force: true });
});

describe('signWithLocalPeerKey (D-BP223-BM09-ARCHBISHOP-004-016)', () => {
  test('signs data, returns sig_alg "ed25519", and the signature verifies against the returned publicKeyHex', async () => {
    available = true;
    const m = await import('./localPeerKeypair');
    const { signatureHex, sigAlg, publicKeyHex } = m.signWithLocalPeerKey('hello savings receipt');
    expect(sigAlg).toBe('ed25519');
    expect(signatureHex).toMatch(/^[0-9a-f]{128}$/); // 64-byte Ed25519 signature, hex

    const pubKey = createPublicKey({ key: Buffer.from(publicKeyHex, 'hex'), format: 'der', type: 'spki' });
    const ok = verify(null, Buffer.from('hello savings receipt', 'utf8'), pubKey, Buffer.from(signatureHex, 'hex'));
    expect(ok).toBe(true);
  });

  test('the same install signs the same data identically on repeated calls (deterministic Ed25519), and never regenerates the keypair', async () => {
    available = true;
    const m = await import('./localPeerKeypair');
    const kp1 = m.ensureLocalPeerKeypair();
    const first = m.signWithLocalPeerKey('same text');
    const second = m.signWithLocalPeerKey('same text');
    expect(second.signatureHex).toBe(first.signatureHex);
    expect(second.publicKeyHex).toBe(kp1.publicKeyHex);
  });

  test('a DIFFERENT message produces a DIFFERENT signature from the same key', async () => {
    available = true;
    const m = await import('./localPeerKeypair');
    const a = m.signWithLocalPeerKey('message A');
    const b = m.signWithLocalPeerKey('message B');
    expect(a.signatureHex).not.toBe(b.signatureHex);
  });

  test('accepts a Buffer identically to the equivalent utf8 string', async () => {
    available = true;
    const m = await import('./localPeerKeypair');
    const viaString = m.signWithLocalPeerKey('buffer-equivalence-check');
    const viaBuffer = m.signWithLocalPeerKey(Buffer.from('buffer-equivalence-check', 'utf8'));
    expect(viaBuffer.signatureHex).toBe(viaString.signatureHex);
  });

  test('encrypted storage unavailable: throws LocalPeerIdentityUnavailableError, never signs', async () => {
    available = false;
    const m = await import('./localPeerKeypair');
    expect(() => m.signWithLocalPeerKey('anything')).toThrow(m.LocalPeerIdentityUnavailableError);
  });

  test('never logs the decrypted private-key hex', async () => {
    available = true;
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const m = await import('./localPeerKeypair');
      const kp = m.ensureLocalPeerKeypair();
      m.signWithLocalPeerKey('probe for leaked key material');
      const allLoggedText = [...logSpy.mock.calls, ...warnSpy.mock.calls].flat().map((a) => String(a)).join('\n');
      // We don't have the raw private-key hex in this test (by design, it's never returned) --
      // what we CAN assert is that the one value this module does expose, publicKeyHex, is the
      // only key-shaped hex string in the logs, i.e. no OTHER long hex string (the private key
      // would also be 64+ hex chars) appears that isn't the known-public one.
      const hexStrings = allLoggedText.match(/[0-9a-f]{64,}/g) ?? [];
      for (const h of hexStrings) {
        expect(h === kp.publicKeyHex || kp.publicKeyHex.includes(h) || h.includes(kp.peerId)).toBe(true);
      }
    } finally {
      logSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });
});
