// ed25519_keypair.refuse_plaintext.test.ts -- D-BP223-BM0-X030-073 P4: if Windows encrypted storage is unavailable, the mesh
// identity key is NOT written in plain JSON; a clear message is shown once; nothing is on disk; callers run without it.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let dir: string;
let available = false;
const showMessageBox = vi.fn(async () => ({ response: 0 }));

beforeEach(() => {
  vi.resetModules();
  showMessageBox.mockClear();
  dir = mkdtempSync(join(tmpdir(), 'x030073-key-'));
  vi.doMock('electron', () => ({
    app: { getPath: () => dir, isReady: () => true },
    safeStorage: {
      isEncryptionAvailable: () => available,
      encryptString: (s: string) => Buffer.concat([Buffer.from('v10'), Buffer.from(s)]),
      decryptString: (b: Buffer) => b.subarray(3).toString(),
    },
    dialog: { showMessageBox },
  }));
});
afterEach(() => { vi.doUnmock('electron'); rmSync(dir, { recursive: true, force: true }); });

describe('mesh identity key store (X030-073 P4)', () => {
  test('encrypted storage unavailable: refuses, writes NO file, shows the clear message once', async () => {
    available = false;
    const m = await import('./ed25519_keypair');
    expect(() => m.getOrCreateKeypair()).toThrow(m.MeshIdentityUnavailableError);
    expect(() => m.getOrCreateKeypair()).toThrow(/REFUSING to store a private key in plain JSON/);
    expect(existsSync(join(dir, 'thorax_ed25519.json'))).toBe(false);
    expect(readdirSync(dir)).toEqual([]);
    expect(showMessageBox).toHaveBeenCalledTimes(1);
    expect(String((showMessageBox.mock.calls[0] as any)[0].message)).toMatch(/Mesh identity is off/);
    expect(m.getMeshIdentityStatus()).toMatchObject({ available: false });
  });

  test('a caller that signs runs without mesh identity instead of crashing (signAnnouncePayload fails soft)', async () => {
    available = false;
    const { signAnnouncePayload } = await import('../federation/announce_frame');
    expect(signAnnouncePayload('seed', { a: 1 })).toBeNull();
    expect(existsSync(join(dir, 'thorax_ed25519.json'))).toBe(false);
  });

  test('encrypted storage available: key written encrypted (never plain JSON), read back, no message', async () => {
    available = true;
    const m = await import('./ed25519_keypair');
    const kp = m.getOrCreateKeypair();
    const { readFileSync } = await import('node:fs');
    const raw = readFileSync(join(dir, 'thorax_ed25519.json'));
    expect(raw.subarray(0, 3).toString()).toBe('v10');
    expect(m.getOrCreateKeypair()).toEqual(kp);
    expect(showMessageBox).not.toHaveBeenCalled();
  });

  test('the plain-JSON write branch is gone from the source', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(join(__dirname, 'ed25519_keypair.ts'), 'utf8');
    expect(src).not.toMatch(/writeFileSync\(filePath, plaintext, 'utf8'\)/);
  });
});
