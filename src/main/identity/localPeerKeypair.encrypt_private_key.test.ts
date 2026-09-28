// localPeerKeypair.encrypt_private_key.test.ts -- D-BP223-BM0-X030-098, hole 1 (same class as X030-073 P4).
// The second Ed25519 private key (peer.ed25519.priv) is never written, copied or used as plain hex: written through safeStorage,
// a plaintext key from an older build is migrated on read (encrypt, verify, then replace), and with encrypted storage
// unavailable the app runs without that identity. electron is mocked; APPDATA/LOCALAPPDATA/PROGRAMDATA and the user-profile
// root all point at a scratch folder, so no real key directory is ever read or written.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, existsSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, generateKeyPairSync } from 'node:crypto';

let scratch: string;
let available = false;
let corruptDecrypt = false;
const showMessageBox = vi.fn(async () => ({ response: 0 }));
const saved: Record<string, string | undefined> = {};

// Fake DPAPI: "v10" + base64 of the reversed string, so the raw file never contains the key hex.
const enc = (s: string) => Buffer.concat([Buffer.from('v10'), Buffer.from(Buffer.from(s.split('').reverse().join('')).toString('base64'))]);
const dec = (b: Buffer) => { const s = Buffer.from(b.subarray(3).toString(), 'base64').toString().split('').reverse().join(''); return corruptDecrypt ? s + '00' : s; };

function keyHex() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    pub: (publicKey.export({ type: 'spki', format: 'der' }) as Buffer).toString('hex'),
    priv: (privateKey.export({ type: 'pkcs8', format: 'der' }) as Buffer).toString('hex'),
  };
}
const userData = () => join(scratch, 'userData');
const canonical = () => join(userData(), 'keys');
const pgKeys = () => join(scratch, 'programdata', 'MnemosyneC', 'keys');
const peerIdOf = (pub: string) => createHash('sha256').update(pub).digest('hex').slice(0, 16);

function allFileBytes(dir: string): string {
  if (!existsSync(dir)) return '';
  let out = '';
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    out += e.isDirectory() ? allFileBytes(p) : readFileSync(p).toString('latin1');
  }
  return out;
}

beforeEach(() => {
  vi.resetModules();
  showMessageBox.mockClear();
  available = false;
  corruptDecrypt = false;
  scratch = mkdtempSync(join(tmpdir(), 'x030098-peerkey-'));
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

describe('local peer keypair private key (X030-098 hole 1)', () => {
  test('fresh key, encrypted storage unavailable: refuses before generating, writes nothing, message once', async () => {
    const m = await import('./localPeerKeypair');
    expect(() => m.ensureLocalPeerKeypair()).toThrow(m.LocalPeerIdentityUnavailableError);
    expect(() => m.ensureLocalPeerKeypair()).toThrow(/plain hex/);
    expect(existsSync(canonical())).toBe(false);
    expect(existsSync(pgKeys())).toBe(false);
    expect(showMessageBox).toHaveBeenCalledTimes(1);
    expect(String((showMessageBox.mock.calls[0] as any)[0].message)).toMatch(/Mesh identity is off/);
  });

  test('fresh key, encrypted storage available: private key encrypted in canonical AND the ProgramData backup, no hex on disk', async () => {
    available = true;
    const m = await import('./localPeerKeypair');
    const kp = m.ensureLocalPeerKeypair();
    const raw = readFileSync(join(canonical(), 'peer.ed25519.priv'));
    expect(raw.subarray(0, 3).toString()).toBe('v10');
    const privHex = dec(raw);
    expect(privHex).toMatch(/^[0-9a-f]{64,}$/);
    expect(allFileBytes(scratch)).not.toContain(privHex);
    expect(readFileSync(join(pgKeys(), 'peer.ed25519.priv')).subarray(0, 3).toString()).toBe('v10');
    expect(readFileSync(join(canonical(), 'peer.ed25519.pub'), 'utf8')).toBe(kp.publicKeyHex);
    expect(m.ensureLocalPeerKeypair()).toEqual(kp); // idempotent, never regenerates
    expect(readdirSync(canonical()).sort()).toEqual(['peer.ed25519.priv', 'peer.ed25519.pub']); // no temp files left
    expect(showMessageBox).not.toHaveBeenCalled();
  });

  test('existing PLAINTEXT key + encrypted storage available: migrated in place, same peer_id, plaintext gone everywhere', async () => {
    available = true;
    const k = keyHex();
    mkdirSync(canonical(), { recursive: true });
    writeFileSync(join(canonical(), 'peer.ed25519.priv'), k.priv);
    writeFileSync(join(canonical(), 'peer.ed25519.pub'), k.pub);
    mkdirSync(pgKeys(), { recursive: true }); // an older build's plaintext ProgramData backup too
    writeFileSync(join(pgKeys(), 'peer.ed25519.priv'), k.priv);
    writeFileSync(join(pgKeys(), 'peer.ed25519.pub'), k.pub);
    const m = await import('./localPeerKeypair');
    const kp = m.ensureLocalPeerKeypair();
    expect(kp.peerId).toBe(peerIdOf(k.pub));
    const raw = readFileSync(join(canonical(), 'peer.ed25519.priv'));
    expect(raw.subarray(0, 3).toString()).toBe('v10');
    expect(dec(raw)).toBe(k.priv);
    expect(dec(readFileSync(join(pgKeys(), 'peer.ed25519.priv')))).toBe(k.priv);
    expect(allFileBytes(scratch)).not.toContain(k.priv);
    expect(readdirSync(canonical()).sort()).toEqual(['peer.ed25519.priv', 'peer.ed25519.pub']);
  });

  test('existing PLAINTEXT key + encrypted storage unavailable: runs without that identity, key NOT deleted, NOT copied', async () => {
    const k = keyHex();
    mkdirSync(canonical(), { recursive: true });
    writeFileSync(join(canonical(), 'peer.ed25519.priv'), k.priv);
    writeFileSync(join(canonical(), 'peer.ed25519.pub'), k.pub);
    const m = await import('./localPeerKeypair');
    expect(() => m.ensureLocalPeerKeypair()).toThrow(m.LocalPeerIdentityUnavailableError);
    expect(readFileSync(join(canonical(), 'peer.ed25519.priv'), 'utf8')).toBe(k.priv); // left for a later migration
    expect(existsSync(pgKeys())).toBe(false); // never copied to the backup
    expect(showMessageBox).toHaveBeenCalledTimes(1);
  });

  test('encrypted write that does not verify: plaintext is NOT replaced, no temp file left, identity refused', async () => {
    available = true;
    corruptDecrypt = true;
    const k = keyHex();
    mkdirSync(canonical(), { recursive: true });
    writeFileSync(join(canonical(), 'peer.ed25519.priv'), k.priv);
    writeFileSync(join(canonical(), 'peer.ed25519.pub'), k.pub);
    const m = await import('./localPeerKeypair');
    expect(m.migratePlaintextPriv(canonical())).toBe('migration_failed');
    expect(readFileSync(join(canonical(), 'peer.ed25519.priv'), 'utf8')).toBe(k.priv);
    expect(readdirSync(canonical()).sort()).toEqual(['peer.ed25519.priv', 'peer.ed25519.pub']);
    expect(() => m.ensureLocalPeerKeypair()).toThrow(m.LocalPeerIdentityUnavailableError);
  });

  test('cross-user restore of a plaintext key: canonical copy written ENCRYPTED, source migrated, same peer_id', async () => {
    available = true;
    const k = keyHex();
    const other = join(scratch, 'users', 'someoneelse', 'AppData', 'Roaming', 'MnemosyneC', 'keys');
    mkdirSync(other, { recursive: true });
    writeFileSync(join(other, 'peer.ed25519.priv'), k.priv);
    writeFileSync(join(other, 'peer.ed25519.pub'), k.pub);
    const m = await import('./localPeerKeypair');
    expect(m.ensureLocalPeerKeypair().peerId).toBe(peerIdOf(k.pub));
    expect(dec(readFileSync(join(canonical(), 'peer.ed25519.priv')))).toBe(k.priv);
    expect(readFileSync(join(other, 'peer.ed25519.priv')).subarray(0, 3).toString()).toBe('v10');
    expect(allFileBytes(scratch)).not.toContain(k.priv);
  });

  test('the plain-hex write calls are gone from the source', () => {
    const src = readFileSync(join(__dirname, 'localPeerKeypair.ts'), 'utf8');
    expect(src).not.toMatch(/writeFileSync\(privPath, privateKeyHex/);
    expect(src).not.toMatch(/copyFileSync\(privPath, join\(pgDir/);
  });
});
