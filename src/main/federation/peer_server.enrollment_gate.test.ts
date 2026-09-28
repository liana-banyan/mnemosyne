// peer_server.enrollment_gate.test.ts -- D-BP223-BM0-X010-004-MESHPLUMB
//
// Proves resolveEnrolledSenderKey()'s wiring into resolvePlowDomainRequest() and
// resolveSignedDiagnosisRequest(): an ENROLLED peer's signature is verified ONLY against its
// enrolled key (refused even when a self-declared key in the same frame would otherwise verify),
// and an UNENROLLED peer falls through to the pre-existing trust-on-first-use resolution
// unchanged -- proving this dispatch's own additive/non-regressive design decision, not just
// asserting it in a comment. `electron`'s `app.getPath('userData')` is mocked to a real scratch
// directory (mkdtempSync under os.tmpdir()) so the registry lookup actually runs instead of
// hitting the "path unavailable" catch branch every other test in this file's siblings exercises
// implicitly -- never <userData> on the real machine, never a real peer key.
//
// Run: npx vitest run src/main/federation/peer_server.enrollment_gate.test.ts

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function ephemeralKeypair(): { publicKeyHex: string; privateKeyHex: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });
  return {
    publicKeyHex: (publicKey as Buffer).toString('hex'),
    privateKeyHex: (privateKey as Buffer).toString('hex'),
  };
}

describe('peer_server enrollment gate -- D-BP223-BM0-X010-004-MESHPLUMB', () => {
  let scratchDir: string;

  beforeEach(() => {
    vi.resetModules();
    scratchDir = mkdtempSync(join(tmpdir(), 'meshplumb-peerserver-'));
    vi.doMock('electron', () => ({
      app: {
        getPath: () => scratchDir,
        getVersion: () => 'test-version',
        isPackaged: false,
        getAppPath: () => scratchDir,
      },
      BrowserWindow: { getAllWindows: () => [] },
    }));
  });

  afterEach(() => {
    rmSync(scratchDir, { recursive: true, force: true });
    vi.doUnmock('electron');
  });

  async function buildSignedFrame(payload: Record<string, unknown>, privateKeyHex: string): Promise<string> {
    const { encodeFrame } = await import('../wire/hex-encode');
    const { signFrame } = await import('../thorax/sign_verify');
    const raw = encodeFrame('test-dispatch-id', 'broadcast', payload);
    return signFrame(raw, privateKeyHex);
  }

  test('ENROLLED peer, real signature by its enrolled key -> ACCEPTED, even though the frame self-declares a different (bogus) key', async () => {
    const { writeEnrollment } = await import('../thorax/peer_enrollment_registry');
    const registryPath = join(scratchDir, 'peer_enrollment_registry.json');
    const real = ephemeralKeypair();
    const bogus = ephemeralKeypair();
    writeEnrollment(registryPath, {
      peer_id: 'peer-enrolled-1', public_key_hex: real.publicKeyHex, key_id: 'k1',
      enrolled_at: new Date().toISOString(), source: 'test',
    });

    const signedHex = await buildSignedFrame({
      sender_peer_id: 'peer-enrolled-1', domain: 'chemistry', questions: ['q1'],
      public_key_hex: bogus.publicKeyHex, // self-declared key deliberately WRONG
    }, real.privateKeyHex); // but genuinely signed with the ENROLLED key

    const peerServer = await import('./peer_server');
    const result = peerServer.resolvePlowDomainRequest(JSON.stringify({ signed_frame: signedHex }));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.domain).toBe('chemistry');
  });

  test('ENROLLED peer, signed by an IMPOSTOR key -> REFUSED, even though the impostor self-declares its own (real, verifiable) key', async () => {
    const { writeEnrollment } = await import('../thorax/peer_enrollment_registry');
    const registryPath = join(scratchDir, 'peer_enrollment_registry.json');
    const enrolledReal = ephemeralKeypair();
    const impostor = ephemeralKeypair();
    writeEnrollment(registryPath, {
      peer_id: 'peer-enrolled-2', public_key_hex: enrolledReal.publicKeyHex, key_id: 'k2',
      enrolled_at: new Date().toISOString(), source: 'test',
    });

    // Impostor claims to BE peer-enrolled-2, signs with its OWN key, and self-declares its own
    // (internally consistent, would-verify-under-TOFU) public key.
    const signedHex = await buildSignedFrame({
      sender_peer_id: 'peer-enrolled-2', domain: 'chemistry', questions: ['q1'],
      public_key_hex: impostor.publicKeyHex,
    }, impostor.privateKeyHex);

    const peerServer = await import('./peer_server');
    const result = peerServer.resolvePlowDomainRequest(JSON.stringify({ signed_frame: signedHex }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toMatch(/refused/i);
    }
  });

  test('UNENROLLED peer -- pre-existing trust-on-first-use resolution is unaffected (regression guard for this dispatch\'s additive design)', async () => {
    const selfDeclared = ephemeralKeypair();
    const signedHex = await buildSignedFrame({
      sender_peer_id: 'peer-never-enrolled', domain: 'physics', questions: ['q1'],
      public_key_hex: selfDeclared.publicKeyHex,
    }, selfDeclared.privateKeyHex);

    const peerServer = await import('./peer_server');
    const result = peerServer.resolvePlowDomainRequest(JSON.stringify({ signed_frame: signedHex }));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.domain).toBe('physics');
  });

  test('resolveSignedDiagnosisRequest: ENROLLED peer signed by an impostor key is refused (same gate, sibling entry point)', async () => {
    const { writeEnrollment } = await import('../thorax/peer_enrollment_registry');
    const registryPath = join(scratchDir, 'peer_enrollment_registry.json');
    const enrolledReal = ephemeralKeypair();
    const impostor = ephemeralKeypair();
    writeEnrollment(registryPath, {
      peer_id: 'peer-enrolled-3', public_key_hex: enrolledReal.publicKeyHex, key_id: 'k3',
      enrolled_at: new Date().toISOString(), source: 'test',
    });

    const signedHex = await buildSignedFrame({
      sender_peer_id: 'peer-enrolled-3', id: 'diag-1',
      public_key_hex: impostor.publicKeyHex,
    }, impostor.privateKeyHex);

    const peerServer = await import('./peer_server');
    const result = peerServer.resolveSignedDiagnosisRequest(JSON.stringify({ signed_frame: signedHex }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });
});
