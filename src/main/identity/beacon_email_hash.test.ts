// beacon_email_hash.test.ts -- D-BP223-BM0-X030-073 P1: per-install salted beacon email hash.
import { describe, test, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { getOrCreateBeaconSalt, saltedBeaconEmailHash, beaconEmailHashOrNull } from './beacon_email_hash';

describe('salted beacon email hash (X030-073 P1)', () => {
  test('same email, two different installs -> two different hashes; neither is the old unsalted hash', () => {
    const d = mkdtempSync(join(tmpdir(), 'x030073-salt-'));
    try {
      const saltA = getOrCreateBeaconSalt(join(d, 'installA', 'beacon_salt.json'));
      const saltB = getOrCreateBeaconSalt(join(d, 'installB', 'beacon_salt.json'));
      expect(saltA).not.toBe(saltB);
      const hA = saltedBeaconEmailHash('Someone@Example.org ', saltA);
      const hB = saltedBeaconEmailHash('someone@example.org', saltB);
      const unsalted = createHash('sha256').update('someone@example.org').digest('hex').slice(0, 32);
      expect(hA).toMatch(/^[0-9a-f]{32}$/);
      expect(hA).not.toBe(hB);
      expect(hA).not.toBe(unsalted);
      expect(hB).not.toBe(unsalted);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  test('one install is stable: the salt is created once and reused, so its hash does not change between runs', () => {
    const d = mkdtempSync(join(tmpdir(), 'x030073-salt-'));
    try {
      const p = join(d, 'beacon_salt.json');
      const s1 = getOrCreateBeaconSalt(p);
      expect(getOrCreateBeaconSalt(p)).toBe(s1);
      expect(beaconEmailHashOrNull('a@b.c', p)).toBe(beaconEmailHashOrNull('a@b.c', p));
      expect(JSON.parse(readFileSync(p, 'utf8')).salt).toBe(s1);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  test('the salt never appears in the hash output, and no email gives null', () => {
    const d = mkdtempSync(join(tmpdir(), 'x030073-salt-'));
    try {
      const p = join(d, 'beacon_salt.json');
      const salt = getOrCreateBeaconSalt(p);
      const h = beaconEmailHashOrNull('a@b.c', p) as string;
      expect(salt.includes(h)).toBe(false);
      expect(h.includes(salt.slice(0, 16))).toBe(false);
      expect(beaconEmailHashOrNull(null, p)).toBeNull();
      expect(beaconEmailHashOrNull('', p)).toBeNull();
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  test('a corrupt salt file is never overwritten, and the beacon then sends no email hash at all (never the unsalted one)', () => {
    const d = mkdtempSync(join(tmpdir(), 'x030073-salt-'));
    try {
      const p = join(d, 'beacon_salt.json');
      writeFileSync(p, '{"salt":"nothex"}');
      expect(() => getOrCreateBeaconSalt(p)).toThrow();
      expect(beaconEmailHashOrNull('a@b.c', p)).toBeNull();
      expect(readFileSync(p, 'utf8')).toBe('{"salt":"nothex"}');
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
});
