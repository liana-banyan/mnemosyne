// peer_enrollment_registry.test.ts -- D-BP223-BM0-X010-004-MESHPLUMB
//
// OFFLINE. Every path here uses an explicit scratch registry file under os.tmpdir() -- never
// <userData>/peer_enrollment_registry.json, never any real peer key.

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadPeerEnrollmentRegistry,
  lookupEnrolledPeerPublicKey,
  isPeerEnrolled,
  writeEnrollment,
  type EnrolledPeerRecord,
} from './peer_enrollment_registry';

describe('peer_enrollment_registry -- D-BP223-BM0-X010-004-MESHPLUMB', () => {
  let scratchDir: string;
  let registryPath: string;

  beforeEach(() => {
    scratchDir = mkdtempSync(join(tmpdir(), 'meshplumb-registry-'));
    registryPath = join(scratchDir, 'peer_enrollment_registry.json');
  });

  afterEach(() => {
    rmSync(scratchDir, { recursive: true, force: true });
  });

  test('a missing registry file loads as empty, never throws', () => {
    expect(loadPeerEnrollmentRegistry(registryPath)).toEqual({});
    expect(lookupEnrolledPeerPublicKey(registryPath, 'anyone')).toBeNull();
    expect(isPeerEnrolled(registryPath, 'anyone')).toBe(false);
  });

  test('a corrupt/non-JSON registry file loads as empty (fail closed), never throws', () => {
    writeFileSync(registryPath, 'not json at all {{{', 'utf8');
    expect(loadPeerEnrollmentRegistry(registryPath)).toEqual({});
    expect(lookupEnrolledPeerPublicKey(registryPath, 'anyone')).toBeNull();
  });

  test('a JSON array (wrong shape) loads as empty, never throws, never indexed as a registry', () => {
    writeFileSync(registryPath, '[1,2,3]', 'utf8');
    expect(loadPeerEnrollmentRegistry(registryPath)).toEqual({});
  });

  test('writeEnrollment() creates the file and directory, then lookupEnrolledPeerPublicKey finds it', () => {
    const record: EnrolledPeerRecord = {
      peer_id: 'peer-abc123',
      public_key_hex: 'deadbeef',
      key_id: 'peer-test-standin',
      enrolled_at: new Date().toISOString(),
      source: 'test',
    };
    expect(existsSync(registryPath)).toBe(false);
    writeEnrollment(registryPath, record);
    expect(existsSync(registryPath)).toBe(true);
    expect(lookupEnrolledPeerPublicKey(registryPath, 'peer-abc123')).toBe('deadbeef');
    expect(isPeerEnrolled(registryPath, 'peer-abc123')).toBe(true);
    expect(isPeerEnrolled(registryPath, 'someone-else')).toBe(false);
  });

  test('writeEnrollment() is Rule-66\'d: an existing file is copied to a .superseded.<UTC>.json sibling before being overwritten', () => {
    writeEnrollment(registryPath, {
      peer_id: 'peer-1', public_key_hex: 'aaaa', key_id: 'k1',
      enrolled_at: new Date().toISOString(), source: 'test-1',
    });
    const beforeFiles = new Set(require('node:fs').readdirSync(scratchDir));

    writeEnrollment(registryPath, {
      peer_id: 'peer-2', public_key_hex: 'bbbb', key_id: 'k2',
      enrolled_at: new Date().toISOString(), source: 'test-2',
    });
    const afterFiles: string[] = require('node:fs').readdirSync(scratchDir);
    const newSiblings = afterFiles.filter((f) => !beforeFiles.has(f));
    expect(newSiblings.length).toBeGreaterThanOrEqual(1);
    expect(newSiblings.some((f) => /\.superseded\.\d{8}T\d{6}Z\.json$/.test(f))).toBe(true);

    // The sibling preserves the pre-overwrite content (peer-1 only, not peer-2).
    const siblingName = newSiblings.find((f) => f.includes('.superseded.'))!;
    const siblingContent = JSON.parse(readFileSync(join(scratchDir, siblingName), 'utf8'));
    expect(siblingContent).toHaveProperty('peer-1');
    expect(siblingContent).not.toHaveProperty('peer-2');

    // The live file now holds BOTH peers (writeEnrollment merges, never replaces wholesale).
    const live = loadPeerEnrollmentRegistry(registryPath);
    expect(live).toHaveProperty('peer-1');
    expect(live).toHaveProperty('peer-2');
  });

  test('re-enrolling the same peer_id with a different key overwrites the entry (rotation is a plain overwrite at THIS layer -- policy about whether that should be allowed lives in enroll_peer_order.ts, not here)', () => {
    writeEnrollment(registryPath, {
      peer_id: 'peer-1', public_key_hex: 'aaaa', key_id: 'k1',
      enrolled_at: new Date().toISOString(), source: 'first',
    });
    writeEnrollment(registryPath, {
      peer_id: 'peer-1', public_key_hex: 'cccc', key_id: 'k1-v2',
      enrolled_at: new Date().toISOString(), source: 'second',
    });
    expect(lookupEnrolledPeerPublicKey(registryPath, 'peer-1')).toBe('cccc');
  });
});
