// presence_owner_secret.test.ts -- D-BP223-X043-010-RB. Tests presence_owner_secret.ts (the app
// side). The MIC channel's mic_channel_owner_secret.js is a READER of the same store, tested there.
//
// OFFLINE. Temp directories only; the real %APPDATA% store and the real M0 import file are never
// touched. safeStorage is replaced by a reversible fake that writes the same "v10" prefix the real
// Windows output starts with, so the format checks are exercised.
//
// Run: npx vitest run src/main/federation/presence_owner_secret.test.ts

import { describe, test, expect, beforeEach } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  getPresenceOwnerSecret, importOwnerSecretFromFile, ownerSecretStorePath, m0ImportFilePath,
  OwnerSecretUnavailableError, _resetOwnerSecretCacheForTests, type OwnerSecretDeps,
} from './presence_owner_secret';

const PEER = '1a78f7c9bdd5e830';
let root = '';
let logs: string[] = [];

function fakeDeps(over: Partial<OwnerSecretDeps> = {}): OwnerSecretDeps {
  const mask = (b: Buffer) => Buffer.from(b.map((x) => x ^ 0x5a));
  return {
    encryptionAvailable: () => true,
    encryptString: (p) => Buffer.concat([Buffer.from('v10', 'latin1'), mask(Buffer.from(p, 'utf8'))]),
    decryptString: (b) => {
      if (b.subarray(0, 3).toString('latin1') !== 'v10') throw new Error('not encrypted');
      return mask(b.subarray(3)).toString('utf8');
    },
    userDataDir: () => join(root, 'userData'),
    importDir: () => join(root, 'exports'),
    random32: () => randomBytes(32),
    log: (l) => logs.push(l),
    ...over,
  };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'x043-010-owner-'));
  mkdirSync(join(root, 'exports'), { recursive: true });
  logs = [];
  _resetOwnerSecretCacheForTests();
});

describe('presence owner secret: fresh install', () => {
  test('generates 32 random bytes (64 hex), stores ONLY an encrypted blob, and returns the same value next time', () => {
    const deps = fakeDeps();
    const s1 = getPresenceOwnerSecret(PEER, deps);
    expect(s1).toMatch(/^[0-9a-f]{64}$/);
    const raw = readFileSync(ownerSecretStorePath(deps, PEER));
    expect(raw.subarray(0, 3).toString('latin1')).toBe('v10');
    expect(raw.toString('latin1')).not.toContain(s1); // never plaintext on disk
    _resetOwnerSecretCacheForTests();
    expect(getPresenceOwnerSecret(PEER, deps)).toBe(s1);
    expect(logs.join('\n')).not.toContain(s1); // never logged
  });

  test('one store per peer id: a second id gets its own secret and file', () => {
    const deps = fakeDeps();
    const a = getPresenceOwnerSecret(PEER, deps);
    const b = getPresenceOwnerSecret('0123456789abcdef-sa', deps);
    expect(a).not.toBe(b);
    expect(existsSync(ownerSecretStorePath(deps, '0123456789abcdef-sa'))).toBe(true);
  });

  test('encrypted storage unavailable: REFUSES, writes nothing (no plaintext fallback)', () => {
    const deps = fakeDeps({ encryptionAvailable: () => false });
    expect(() => getPresenceOwnerSecret(PEER, deps)).toThrow(OwnerSecretUnavailableError);
    expect(existsSync(ownerSecretStorePath(deps, PEER))).toBe(false);
  });

  test('an unreadable store is NOT overwritten (unreadable is not absent)', () => {
    const deps = fakeDeps();
    mkdirSync(join(root, 'userData'), { recursive: true });
    const p = ownerSecretStorePath(deps, PEER);
    writeFileSync(p, Buffer.from('v10garbage-not-json'));
    const before = readFileSync(p);
    expect(() => getPresenceOwnerSecret(PEER, deps)).toThrow(/could not be decrypted|unexpected shape/);
    expect(readFileSync(p).equals(before)).toBe(true);
  });

  test('a plain-text store is refused and left alone', () => {
    const deps = fakeDeps();
    mkdirSync(join(root, 'userData'), { recursive: true });
    const p = ownerSecretStorePath(deps, PEER);
    writeFileSync(p, 'a'.repeat(64));
    expect(() => getPresenceOwnerSecret(PEER, deps)).toThrow(/not in encrypted format/);
    expect(readFileSync(p, 'utf8')).toBe('a'.repeat(64));
  });

  test('a store naming a different peer id is refused, never reused', () => {
    const deps = fakeDeps();
    mkdirSync(join(root, 'userData'), { recursive: true });
    writeFileSync(ownerSecretStorePath(deps, PEER), deps.encryptString(JSON.stringify({ v: 1, peer_id: 'ffffffffffffffff', secret: 'b'.repeat(64) })));
    expect(() => getPresenceOwnerSecret(PEER, deps)).toThrow(/belongs to peer/);
  });
});

describe('presence owner secret: M0 one-time import', () => {
  test('imports the registered secret, verifies the read-back, THEN shreds the import file; the server hash matches', () => {
    const deps = fakeDeps();
    const secret = randomBytes(32).toString('hex');
    const serverHash = createHash('sha256').update(secret, 'utf8').digest('hex'); // what Phase A stored
    const importPath = m0ImportFilePath(deps, PEER);
    writeFileSync(importPath, secret); // 64 hex, no newline (the real file's format)
    const got = getPresenceOwnerSecret(PEER, deps);
    expect(createHash('sha256').update(got, 'utf8').digest('hex')).toBe(serverHash);
    expect(existsSync(importPath)).toBe(false); // shredded after verification
    expect(logs.join('\n')).toMatch(/import verified for peer 1a78f7c9bdd5e830; import file shredded=true/);
    expect(logs.join('\n')).not.toContain(secret);
  });

  test('a trailing newline in the import file is tolerated', () => {
    const deps = fakeDeps();
    const secret = randomBytes(32).toString('hex');
    writeFileSync(m0ImportFilePath(deps, PEER), secret + '\r\n');
    expect(getPresenceOwnerSecret(PEER, deps)).toBe(secret);
  });

  test('a malformed import file is NOT imported and NOT shredded', () => {
    const deps = fakeDeps();
    const p = m0ImportFilePath(deps, PEER);
    writeFileSync(p, 'not-hex');
    expect(() => getPresenceOwnerSecret(PEER, deps)).toThrow(/64 lowercase hex/);
    expect(readFileSync(p, 'utf8')).toBe('not-hex');
    expect(existsSync(ownerSecretStorePath(deps, PEER))).toBe(false);
  });

  test('encryption unavailable: import refused, file KEPT', () => {
    const deps = fakeDeps({ encryptionAvailable: () => false });
    const p = m0ImportFilePath(deps, PEER);
    const secret = randomBytes(32).toString('hex');
    writeFileSync(p, secret);
    expect(() => getPresenceOwnerSecret(PEER, deps)).toThrow(OwnerSecretUnavailableError);
    expect(readFileSync(p, 'utf8')).toBe(secret);
  });

  test('a store that decrypts differently than written (broken encryption) aborts; file KEPT, no store left', () => {
    let n = 0;
    const base = fakeDeps();
    const deps = fakeDeps({ decryptString: (b) => (++n === 1 ? JSON.stringify({ v: 1, peer_id: PEER, secret: 'c'.repeat(64) }) : base.decryptString(b)) });
    const p = m0ImportFilePath(deps, PEER);
    writeFileSync(p, 'e'.repeat(64));
    expect(() => importOwnerSecretFromFile(p, PEER, deps)).toThrow(/verification of the encrypted write failed/);
    expect(existsSync(p)).toBe(true);
    expect(existsSync(ownerSecretStorePath(deps, PEER))).toBe(false);
  });

  test('a DIFFERENT secret already stored: import refused, both kept', () => {
    const deps = fakeDeps();
    const existing = getPresenceOwnerSecret(PEER, deps); // generated
    _resetOwnerSecretCacheForTests();
    const p = m0ImportFilePath(deps, PEER);
    writeFileSync(p, 'f'.repeat(64));
    expect(() => importOwnerSecretFromFile(p, PEER, deps)).toThrow(/DIFFERENT owner secret/);
    expect(existsSync(p)).toBe(true);
    expect(getPresenceOwnerSecret(PEER, deps)).toBe(existing);
  });

  test('store written earlier (MIC-side import) with the import file KEPT: the app shreds it on first read, after its own verify', () => {
    const deps = fakeDeps();
    const secret = randomBytes(32).toString('hex');
    mkdirSync(join(root, 'userData'), { recursive: true });
    writeFileSync(ownerSecretStorePath(deps, PEER), deps.encryptString(JSON.stringify({ v: 1, peer_id: PEER, secret })));
    const p = m0ImportFilePath(deps, PEER);
    writeFileSync(p, secret);
    expect(getPresenceOwnerSecret(PEER, deps)).toBe(secret);
    expect(existsSync(p)).toBe(false);
  });

  test('store present and a DIFFERENT import file: the store wins, the file is kept and the refusal is logged', () => {
    const deps = fakeDeps();
    const secret = randomBytes(32).toString('hex');
    mkdirSync(join(root, 'userData'), { recursive: true });
    writeFileSync(ownerSecretStorePath(deps, PEER), deps.encryptString(JSON.stringify({ v: 1, peer_id: PEER, secret })));
    const p = m0ImportFilePath(deps, PEER);
    writeFileSync(p, '9'.repeat(64));
    expect(getPresenceOwnerSecret(PEER, deps)).toBe(secret);
    expect(existsSync(p)).toBe(true);
    expect(logs.join('\n')).toMatch(/NOT shredded/);
  });

  test('the same secret already stored: the leftover import file is shredded', () => {
    const deps = fakeDeps();
    const secret = randomBytes(32).toString('hex');
    const p = m0ImportFilePath(deps, PEER);
    writeFileSync(p, secret);
    getPresenceOwnerSecret(PEER, deps);
    writeFileSync(p, secret); // a second copy reappears
    const r = importOwnerSecretFromFile(p, PEER, deps);
    expect(r).toEqual({ imported: false, verified: true, shredded: true });
    expect(existsSync(p)).toBe(false);
  });
});
