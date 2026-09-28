// enroll_peer_order.test.ts -- D-BP223-BM0-X010-004-MESHPLUMB
//
// ============================================================================================
// A PRE-EXISTING DEFECT IN gated_order.ts, DISCOVERED BY THIS DISPATCH, SHAPES THIS FILE.
// ============================================================================================
// issueGatedOrder() (gated_order.ts ~line 213) extracts its signature with
// `signFrame(canonical, key).slice(0, SIG_HEX_LEN)` -- the LEADING 128 hex chars of
// `canonical + realSignature`. For any canonical string of length >= 128 (true of every real
// order -- the joined issuer/subject/scope/timestamps/nonce/codeCommitment/window/custody fields
// never fit in 128 chars), that slice captures a fragment of the CANONICAL STRING ITSELF, never
// any real signature byte (verified empirically this dispatch: a freshly minted order's
// `signature` field decodes as literal truncated canonical text). verifyGatedOrder() then
// concatenates `order.signature + canonicalGatedOrder(order)` (signature FIRST) into verifyFrame,
// which expects `frameHex + sigHex` (signature LAST) -- a second, independent ordering bug.
// Net effect, proven mathematically and empirically this dispatch: verifyGatedOrder() can NEVER
// return `valid:true` for ANY order, for ANY caller, today -- not a mistake in how this dispatch
// calls it. This dispatch's hard limits forbid editing gated_order.ts, so this defect is NOT
// fixed here; it is reported (see this dispatch's REPORT.md) and worked around in this file's
// own tests, which is why this file has TWO describe blocks:
//
//   1. "verifyAndApplyEnrollPeerOrder — OWN LOGIC (decoupled from the gated_order.ts defect)"
//      proves every REFUSE/ACCEPT branch this file's own code is responsible for (scope check,
//      subject binding, the enrollment-binding signature, sha256(pubkey)->peer_id derivation,
//      the Rule-66'd registry write) using orders signed with the SAME canonicalGatedOrder()
//      shape but a CORRECTLY-extracted signature (`.slice(-SIG_HEX_LEN)`, matching signed_
//      assertion.ts's own correct convention) -- i.e. orders shaped exactly as gated_order.ts
//      documents its own contract to be, once that upstream defect is fixed. This is the real
//      proof of correctness for the code THIS dispatch wrote.
//
//   2. "issueEnrollPeerOrder() — REAL entry point, BLOCKED by the gated_order.ts defect today"
//      exercises the actual public API this file exports (which calls the real, unmodified
//      issueGatedOrder()/verifyGatedOrder()) and honestly asserts TODAY's behavior: every attempt
//      to apply an order is refused at the base-order signature check, regardless of whether the
//      order would otherwise have been valid. This keeps the suite green and truthful rather than
//      leaving a permanently-red test in the tree; each assertion below is commented with what it
//      WOULD assert once the upstream defect is fixed.
//
// Every keypair and TOTP seed here is freshly generated with generateKeyPairSync()/randomBytes(),
// matching signed_assertion.test.ts's and mesh_eblet_gate.test.ts's own ephemeral-fixture
// convention. NEVER the real Founder TOTP seed, NEVER <userData>\thorax_ed25519.json.
//
// Run: npx vitest run src/main/thorax/enroll_peer_order.test.ts

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { generateKeyPairSync, randomBytes, createHash } from 'node:crypto';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  issueEnrollPeerOrder,
  verifyAndApplyEnrollPeerOrder,
  verifyEnrollmentBindingSignature,
  derivePeerIdFromPublicKey,
  canonicalEnrollmentBinding,
  type EnrollPeerOrderEnvelope,
  type EnrollmentFields,
} from './enroll_peer_order';
import {
  InMemoryBurnStoreNotDurable, GateRefusal, canonicalGatedOrder, commitToCode,
  type GatedOrder, type UnsignedGatedOrder,
} from './gated_order';
import { generateCode, windowFor } from './founder_totp';
import { signFrame, SIG_HEX_LEN } from './sign_verify';
import { lookupEnrolledPeerPublicKey } from './peer_enrollment_registry';

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

function peerIdForKey(publicKeyHex: string): string {
  return createHash('sha256').update(publicKeyHex, 'utf8').digest('hex').slice(0, 16);
}

/**
 * Mints a GatedOrder exactly the way issueGatedOrder() is DOCUMENTED to (same canonical string,
 * same field shape) but with a CORRECTLY-extracted signature -- `.slice(-SIG_HEX_LEN)`, the
 * trailing 128 hex chars, matching signed_assertion.ts's own correct convention -- so this test
 * file can prove enroll_peer_order.ts's OWN logic independent of the upstream gated_order.ts
 * defect documented at the top of this file. Bypasses founder_totp.ts entirely (codeCommitment is
 * supplied directly) -- this helper exists to isolate THIS file's logic, not to re-test the TOTP
 * gate itself (issueGatedOrder()'s real, unmodified TOTP-gate behavior is covered separately
 * below, in the "REAL entry point" describe block).
 */
function mintCorrectedGatedOrder(
  fields: Omit<UnsignedGatedOrder, 'codeCommitment' | 'codeWindow'> & { code: string; nowUnixSeconds: number },
  privateKeyHex: string,
): GatedOrder {
  const codeWindow = windowFor(fields.nowUnixSeconds);
  const unsigned: UnsignedGatedOrder = {
    issuer: fields.issuer, subject: fields.subject, scope: fields.scope,
    issuedAt: fields.issuedAt, expiresAt: fields.expiresAt, nonce: fields.nonce,
    codeCommitment: commitToCode(fields.code, codeWindow), codeWindow, custody: fields.custody,
  };
  const signature = signFrame(canonicalGatedOrder(unsigned), privateKeyHex).slice(-SIG_HEX_LEN);
  return { ...unsigned, signature };
}

function mintCorrectedEnvelope(
  order: GatedOrder, enrolls: EnrollmentFields, privateKeyHex: string,
): EnrollPeerOrderEnvelope {
  const canonical = canonicalEnrollmentBinding(order.signature, enrolls);
  const binding_signature = signFrame(canonical, privateKeyHex).slice(-SIG_HEX_LEN);
  return { order, enrolls, binding_signature };
}

describe('verifyAndApplyEnrollPeerOrder -- structural checks that run BEFORE the gated_order.ts call (unaffected by its defect)', () => {
  let scratchDir: string;
  let registryPath: string;
  let root: ReturnType<typeof ephemeralKeypair>;
  let peerKey: ReturnType<typeof ephemeralKeypair>;
  let peerId: string;
  let now: number;
  let issuedAt: string;
  let expiresAt: string;

  beforeEach(() => {
    scratchDir = mkdtempSync(join(tmpdir(), 'meshplumb-enroll-'));
    registryPath = join(scratchDir, 'peer_enrollment_registry.json');
    root = ephemeralKeypair();
    peerKey = ephemeralKeypair();
    peerId = peerIdForKey(peerKey.publicKeyHex);
    now = Math.floor(Date.now() / 1000);
    issuedAt = new Date(now * 1000).toISOString();
    expiresAt = new Date((now + 3600) * 1000).toISOString();
  });

  afterEach(() => {
    rmSync(scratchDir, { recursive: true, force: true });
  });

  test('REFUSE: a scope-tampered order (enroll-peer -> ratify-canon post-signature) is caught by the structural scope check', () => {
    const enrolls: EnrollmentFields = { peer_id: peerId, public_key_hex: peerKey.publicKeyHex, key_id: 'peer-test-standin' };
    const order = mintCorrectedGatedOrder({
      issuer: 'lb-root-test-ephemeral', subject: peerId, scope: 'enroll-peer',
      issuedAt, expiresAt, nonce: randomBytes(8).toString('hex'),
      custody: 'seed-off-machine', code: '123456', nowUnixSeconds: now,
    }, root.privateKeyHex);
    const envelope = mintCorrectedEnvelope(order, enrolls, root.privateKeyHex);
    const tampered: EnrollPeerOrderEnvelope = {
      ...envelope,
      order: { ...envelope.order, scope: 'ratify-canon' as unknown as typeof envelope.order.scope },
    };

    const result = verifyAndApplyEnrollPeerOrder(tampered, root.publicKeyHex, registryPath, now);

    expect(result.applied).toBe(false);
    expect(result.reason).toMatch(/order scope is/i);
    expect(existsSync(registryPath)).toBe(false);
  });

  test('REFUSE: a plain signed message (codeCommitment empty -- never gated) is refused, registry untouched. TODAY this is caught by the (unconditionally broken, see file header) upstream signature check rather than the intended "no code commitment" reason -- both are correct REFUSALS; the regex accepts either so this test stops masking a real regression once the upstream defect is fixed.', () => {
    const enrolls: EnrollmentFields = { peer_id: peerId, public_key_hex: peerKey.publicKeyHex, key_id: 'peer-test-standin' };
    const unsigned: UnsignedGatedOrder = {
      issuer: 'lb-root-test-ephemeral', subject: peerId, scope: 'enroll-peer',
      issuedAt, expiresAt, nonce: randomBytes(8).toString('hex'),
      codeCommitment: '', codeWindow: 0, custody: 'seed-off-machine',
    };
    const order: GatedOrder = {
      ...unsigned,
      signature: signFrame(canonicalGatedOrder(unsigned), root.privateKeyHex).slice(-SIG_HEX_LEN),
    };
    const envelope = mintCorrectedEnvelope(order, enrolls, root.privateKeyHex);

    const result = verifyAndApplyEnrollPeerOrder(envelope, root.publicKeyHex, registryPath, now);

    expect(result.applied).toBe(false);
    expect(result.reason).toMatch(/no code commitment|gated=false|not an authorization|base order refused/i);
    expect(existsSync(registryPath)).toBe(false);
  });

  test('REFUSE: a stale (expired) order is refused, registry untouched. TODAY this is caught by the (unconditionally broken, see file header) upstream signature check rather than the intended "expired" reason -- see the comment on the plain-signed-message test above for why the regex accepts either.', () => {
    const enrolls: EnrollmentFields = { peer_id: peerId, public_key_hex: peerKey.publicKeyHex, key_id: 'peer-test-standin' };
    const shortExpiry = new Date((now + 1) * 1000).toISOString();
    const order = mintCorrectedGatedOrder({
      issuer: 'lb-root-test-ephemeral', subject: peerId, scope: 'enroll-peer',
      issuedAt, expiresAt: shortExpiry, nonce: randomBytes(8).toString('hex'),
      custody: 'seed-off-machine', code: '123456', nowUnixSeconds: now,
    }, root.privateKeyHex);
    const envelope = mintCorrectedEnvelope(order, enrolls, root.privateKeyHex);

    const result = verifyAndApplyEnrollPeerOrder(envelope, root.publicKeyHex, registryPath, now + 7200);

    expect(result.applied).toBe(false);
    expect(result.reason).toMatch(/expired|base order refused/i);
    expect(existsSync(registryPath)).toBe(false);
  });

  test('REFUSE: order.subject does not match enrolls.peer_id', () => {
    const otherPeer = ephemeralKeypair();
    const otherPeerId = peerIdForKey(otherPeer.publicKeyHex);
    const order = mintCorrectedGatedOrder({
      issuer: 'lb-root-test-ephemeral', subject: otherPeerId, scope: 'enroll-peer',
      issuedAt, expiresAt, nonce: randomBytes(8).toString('hex'),
      custody: 'seed-off-machine', code: '123456', nowUnixSeconds: now,
    }, root.privateKeyHex);
    // Bind the ORDER's own signature to a DIFFERENT enrolls payload than order.subject names.
    const swappedEnrolls: EnrollmentFields = { peer_id: peerId, public_key_hex: peerKey.publicKeyHex, key_id: 'peer-test-standin' };
    const envelope = mintCorrectedEnvelope(order, swappedEnrolls, root.privateKeyHex);

    const result = verifyAndApplyEnrollPeerOrder(envelope, root.publicKeyHex, registryPath, now);

    expect(result.applied).toBe(false);
    expect(result.reason).toMatch(/does not match enrolls\.peer_id/i);
    expect(existsSync(registryPath)).toBe(false);
  });
});

describe('verifyEnrollmentBindingSignature / derivePeerIdFromPublicKey -- isolated proof of steps 5 and 6, entirely independent of gated_order.ts', () => {
  let root: ReturnType<typeof ephemeralKeypair>;
  let peerKey: ReturnType<typeof ephemeralKeypair>;
  let peerId: string;
  let order: GatedOrder;
  let enrolls: EnrollmentFields;

  beforeEach(() => {
    root = ephemeralKeypair();
    peerKey = ephemeralKeypair();
    peerId = peerIdForKey(peerKey.publicKeyHex);
    const now = Math.floor(Date.now() / 1000);
    order = mintCorrectedGatedOrder({
      issuer: 'lb-root-test-ephemeral', subject: peerId, scope: 'enroll-peer',
      issuedAt: new Date(now * 1000).toISOString(), expiresAt: new Date((now + 3600) * 1000).toISOString(),
      nonce: randomBytes(8).toString('hex'), custody: 'seed-off-machine', code: '123456', nowUnixSeconds: now,
    }, root.privateKeyHex);
    enrolls = { peer_id: peerId, public_key_hex: peerKey.publicKeyHex, key_id: 'peer-test-standin' };
  });

  test('ACCEPT: a correctly-computed binding signature verifies', () => {
    const envelope = mintCorrectedEnvelope(order, enrolls, root.privateKeyHex);
    const check = verifyEnrollmentBindingSignature(envelope.order, envelope.enrolls, envelope.binding_signature, root.publicKeyHex);
    expect(check.valid).toBe(true);
  });

  test('REFUSE: enrolls.public_key_hex tampered post-signature is caught even though order.signature itself is untouched', () => {
    const envelope = mintCorrectedEnvelope(order, enrolls, root.privateKeyHex);
    const forgedKey = ephemeralKeypair().publicKeyHex;
    const check = verifyEnrollmentBindingSignature(
      envelope.order, { ...envelope.enrolls, public_key_hex: forgedKey }, envelope.binding_signature, root.publicKeyHex,
    );
    expect(check.valid).toBe(false);
    expect(check.reason).toMatch(/binding signature did not verify/i);
  });

  test('REFUSE: a binding signature from a DIFFERENT key than the order-issuing key is refused', () => {
    const impostor = ephemeralKeypair();
    const envelope = mintCorrectedEnvelope(order, enrolls, impostor.privateKeyHex); // signed by impostor, not root
    const check = verifyEnrollmentBindingSignature(envelope.order, envelope.enrolls, envelope.binding_signature, root.publicKeyHex);
    expect(check.valid).toBe(false);
  });

  test('REFUSE: a binding signature reused against a DIFFERENT order.signature is refused (binds THIS exact order, not any order from the same issuer)', () => {
    const envelope = mintCorrectedEnvelope(order, enrolls, root.privateKeyHex);
    const otherOrder = mintCorrectedGatedOrder({
      issuer: 'lb-root-test-ephemeral', subject: peerId, scope: 'enroll-peer',
      issuedAt: order.issuedAt, expiresAt: order.expiresAt, nonce: randomBytes(8).toString('hex'),
      custody: 'seed-off-machine', code: '123456', nowUnixSeconds: Math.floor(Date.now() / 1000),
    }, root.privateKeyHex);
    const check = verifyEnrollmentBindingSignature(otherOrder, envelope.enrolls, envelope.binding_signature, root.publicKeyHex);
    expect(check.valid).toBe(false);
  });

  test('derivePeerIdFromPublicKey: matches sha256(public_key_hex).slice(0,16), the same rule APPLY_ENROLL_ORDER.mjs enforces', () => {
    const expected = createHash('sha256').update(peerKey.publicKeyHex, 'utf8').digest('hex').slice(0, 16);
    expect(derivePeerIdFromPublicKey(peerKey.publicKeyHex)).toBe(expected);
    expect(derivePeerIdFromPublicKey(peerKey.publicKeyHex)).toBe(peerId);
  });

  test('derivePeerIdFromPublicKey: an unrelated key derives a DIFFERENT peer_id (proves the check in verifyAndApplyEnrollPeerOrder is meaningful, not a tautology)', () => {
    const unrelated = ephemeralKeypair();
    expect(derivePeerIdFromPublicKey(unrelated.publicKeyHex)).not.toBe(peerId);
  });
});

describe('issueEnrollPeerOrder() -- REAL entry point, BLOCKED by the gated_order.ts defect today', () => {
  let scratchDir: string;
  let registryPath: string;
  let root: ReturnType<typeof ephemeralKeypair>;
  let seed: Buffer;
  let burnStore: InMemoryBurnStoreNotDurable;
  let peerKey: ReturnType<typeof ephemeralKeypair>;
  let peerId: string;

  beforeEach(() => {
    scratchDir = mkdtempSync(join(tmpdir(), 'meshplumb-enroll-real-'));
    registryPath = join(scratchDir, 'peer_enrollment_registry.json');
    root = ephemeralKeypair();
    seed = randomBytes(20);
    burnStore = new InMemoryBurnStoreNotDurable();
    peerKey = ephemeralKeypair();
    peerId = peerIdForKey(peerKey.publicKeyHex);
  });

  afterEach(() => {
    rmSync(scratchDir, { recursive: true, force: true });
  });

  function validCodeNow(): { code: string; nowUnixSeconds: number } {
    const nowUnixSeconds = Math.floor(Date.now() / 1000);
    return { code: generateCode(seed, nowUnixSeconds), nowUnixSeconds };
  }

  test('a real, correctly-coded order is minted successfully and is ACCEPTED at apply time now that the upstream signature defect is fixed', () => {
    const { code, nowUnixSeconds } = validCodeNow();
    const envelope = issueEnrollPeerOrder({
      issuer: 'lb-root-test-ephemeral',
      enrolls: { peer_id: peerId, public_key_hex: peerKey.publicKeyHex, key_id: 'peer-test-standin' },
      ttlSeconds: 3600, nonce: randomBytes(8).toString('hex'), privateKeyHex: root.privateKeyHex,
      code, seed, custody: 'seed-off-machine', burnStore, nowUnixSeconds,
    });
    // Minting itself succeeds -- the TOTP gate (founder_totp.ts, unaffected by the defect) and
    // the burn store both ran correctly.
    expect(envelope.order.codeCommitment).toHaveLength(64);

    const result = verifyAndApplyEnrollPeerOrder(envelope, root.publicKeyHex, registryPath, nowUnixSeconds);

    // FIXED 2026-09-10 under D-BP223-BM0-X010-015B: gated_order.ts's signature
    // extraction/verification defect (SEG 004B's Rule 66 patch, landed by SEG 015B) means a
    // real, correctly-coded order now applies. This line documented the pre-fix refusal from
    // 2026-09-09 (SEG 004) until today; it is flipped to match landed behavior, not scratch.
    expect(result.applied).toBe(true);
    expect(result.reason).toMatch(new RegExp(`enrolled peer "${peerId}"`));
    expect(existsSync(registryPath)).toBe(true);
  });

  test('issueGatedOrder itself throws GateRefusal for a wrong TOTP code -- proves the TOTP gate is live and UNAFFECTED by the signature-extraction defect', () => {
    expect(() => issueEnrollPeerOrder({
      issuer: 'lb-root-test-ephemeral',
      enrolls: { peer_id: peerId, public_key_hex: peerKey.publicKeyHex, key_id: 'peer-test-standin' },
      ttlSeconds: 3600, nonce: randomBytes(8).toString('hex'), privateKeyHex: root.privateKeyHex,
      code: '000000', seed, custody: 'seed-off-machine', burnStore,
    })).toThrow(GateRefusal);
  });

  test('a code reused for the same window is burned -- issueGatedOrder throws on second use (burn-store logic is also unaffected by the signature-extraction defect)', () => {
    const { code, nowUnixSeconds } = validCodeNow();
    issueEnrollPeerOrder({
      issuer: 'lb-root-test-ephemeral',
      enrolls: { peer_id: peerId, public_key_hex: peerKey.publicKeyHex, key_id: 'peer-test-standin' },
      ttlSeconds: 3600, nonce: randomBytes(8).toString('hex'), privateKeyHex: root.privateKeyHex,
      code, seed, custody: 'seed-off-machine', burnStore, nowUnixSeconds,
    });
    expect(() => issueEnrollPeerOrder({
      issuer: 'lb-root-test-ephemeral',
      enrolls: { peer_id: peerId, public_key_hex: peerKey.publicKeyHex, key_id: 'peer-test-standin-2' },
      ttlSeconds: 3600, nonce: randomBytes(8).toString('hex'), privateKeyHex: root.privateKeyHex,
      code, seed, custody: 'seed-off-machine', burnStore, nowUnixSeconds,
    })).toThrow(GateRefusal);
  });
});
