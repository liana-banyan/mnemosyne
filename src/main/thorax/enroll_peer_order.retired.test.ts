// enroll_peer_order.retired.test.ts -- D-BP223-X043-010-RB. The identity-key enrollment WRITE is retired.
// (Checked before writing: enroll_peer_order.test.ts covers minting and verification; its minting tests
// are being changed by seat X044-003 right now, so this proof lives in its own file.)
//
// OFFLINE, temp registry only. gated_order.ts's verifyGatedOrder is stubbed to "valid, authorized, gated"
// ON PURPOSE: this file proves only what enroll_peer_order.ts itself does AFTER a genuine order has passed
// the gate (X044-003 is changing how orders are minted in gated_order.ts, and this proof must not depend
// on that). Steps 5 (binding signature) and 6 (key derives peer id) run for real.
//
// Run: npx vitest run src/main/thorax/enroll_peer_order.retired.test.ts

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateKeyPairSync, createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('./gated_order', async (orig) => {
  const real = await orig<typeof import('./gated_order')>();
  return { ...real, verifyGatedOrder: () => ({ valid: true, authorized: true, gated: true, reason: 'stubbed: valid gated order' }) };
});

import { verifyAndApplyEnrollPeerOrder, canonicalEnrollmentBinding, type EnrollPeerOrderEnvelope } from './enroll_peer_order';
import { signFrame, SIG_HEX_LEN } from './sign_verify';
import type { GatedOrder } from './gated_order';

function kp() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' }, privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });
  return { pub: (publicKey as Buffer).toString('hex'), priv: (privateKey as Buffer).toString('hex') };
}

let dir = '';
let registryPath = '';
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'x043-010-retired-')); registryPath = join(dir, 'peer_enrollment_registry.json'); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

function envelopeFor(identityPub: string, root: { priv: string }): EnrollPeerOrderEnvelope {
  const peerId = createHash('sha256').update(identityPub, 'utf8').digest('hex').slice(0, 16);
  const order = {
    issuer: 'lb-root-test', subject: peerId, scope: 'enroll-peer', issuedAt: 1, expiresAt: 2,
    nonce: randomBytes(8).toString('hex'), codeCommitment: 'c'.repeat(64), codeWindow: 1, custody: 'seed-off-machine',
    signature: 'a'.repeat(SIG_HEX_LEN),
  } as unknown as GatedOrder;
  const enrolls = { peer_id: peerId, public_key_hex: identityPub, key_id: 'peer-identity' };
  const binding_signature = signFrame(canonicalEnrollmentBinding(order.signature, enrolls), root.priv).slice(-SIG_HEX_LEN);
  return { order, enrolls, binding_signature };
}

describe('enroll-peer orders no longer write the registry (retired identity-key rule)', () => {
  test('a fully verifying order is REFUSED to write: applied=false, reason names the Thorax-key replacement, no registry file', () => {
    const root = kp();
    const env = envelopeFor(kp().pub, root);
    const r = verifyAndApplyEnrollPeerOrder(env, root.pub, registryPath);
    expect(r.applied).toBe(false);
    expect(r.peer_id).toBe(env.enrolls.peer_id);
    expect(r.reason).toMatch(/^RETIRED: this order verified for peer/);
    expect(r.reason).toMatch(/THORAX key/);
    expect(r.reason).toMatch(/Enroll my machines/);
    expect(existsSync(registryPath)).toBe(false);
  });

  test('an existing registry (Thorax keys from enroll_by_code) is never touched', () => {
    const root = kp();
    const env = envelopeFor(kp().pub, root);
    const before = JSON.stringify({ [env.enrolls.peer_id]: { peer_id: env.enrolls.peer_id, public_key_hex: 'thorax-key', key_id: 'thorax' } });
    writeFileSync(registryPath, before);
    verifyAndApplyEnrollPeerOrder(env, root.pub, registryPath);
    expect(readFileSync(registryPath, 'utf8')).toBe(before);
  });

  test('the verification steps still run: a tampered binding or a non-deriving key is still refused with its own reason', () => {
    const root = kp();
    const env = envelopeFor(kp().pub, root);
    const tampered = { ...env, enrolls: { ...env.enrolls, key_id: 'swapped' } };
    expect(verifyAndApplyEnrollPeerOrder(tampered, root.pub, registryPath).reason).toMatch(/binding signature did not verify/);
    const other = kp().pub;
    const wrongKey = { ...env.enrolls, public_key_hex: other };
    const wrongEnv = { ...env, enrolls: wrongKey, binding_signature: signFrame(canonicalEnrollmentBinding(env.order.signature, wrongKey), root.priv).slice(-SIG_HEX_LEN) };
    expect(verifyAndApplyEnrollPeerOrder(wrongEnv, root.pub, registryPath).reason).toMatch(/does not derive that peer id/);
    expect(existsSync(registryPath)).toBe(false);
  });
});
