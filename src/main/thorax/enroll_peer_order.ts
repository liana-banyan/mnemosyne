/**
 * enroll_peer_order.ts -- D-BP223-BM0-X010-004-MESHPLUMB.
 *
 * THE FOUNDER'S ORDER THIS FILE ANSWERS, VERBATIM (k/c6cb1842): "Peer enrollment itself is not
 * built. How a key legitimately enters that registry is the whole security question, and it
 * belongs behind enroll-peer and your TOTP gate -- which the seat correctly refused to touch."
 * This is that path, built end to end, reusing thorax/gated_order.ts UNCHANGED for the
 * TOTP-gated signing and verification -- this dispatch's hard limits forbid editing gated_order.
 * ts or founder_totp.ts, and nothing here needs to: the base 'enroll-peer' GatedOrder is minted
 * and verified exactly as that file already defines, with its own code-gate, burn-store, and
 * expiry logic completely untouched.
 *
 * WHAT GATED_ORDER.TS CANNOT CARRY, AND HOW THIS FILE CLOSES THAT GAP WITHOUT EDITING IT. A
 * GatedOrder's `subject` is one string -- enough to NAME who the order is about (a peer_id) but
 * not enough to also carry the public key and key_id being enrolled. Bolting extra fields onto a
 * GatedOrder object without binding them into the signed material would be worse than useless:
 * verifyGatedOrder() only ever re-derives canonicalGatedOrder() from ITS OWN known fields, so an
 * attacker could swap out any extra, unsigned field after signing and the base signature would
 * still verify. This file avoids that trap with a SECOND, separate signature -- a binding layer,
 * the same pattern relay_origin.ts already uses for its own origin fields -- built directly from
 * sign_verify.ts's signFrame/verifyFrame (unchanged), covering (the base order's OWN signature,
 * peer_id, public_key_hex, key_id). Because the base order's signature cannot be produced without
 * gated_order.ts's TOTP gate passing, and the binding signature covers that exact value plus the
 * enrollment fields, tampering with EITHER half breaks verification: swap the enrollment payload
 * and the binding signature no longer matches it; swap in a different base order's signature and
 * the binding signature (computed over THIS order's signature) no longer matches either. Both
 * signatures are produced by the SAME issuer private key (the root key, in production) -- this is
 * not a second authority, it is one authority's order plus that same authority's binding of extra
 * fields onto it.
 *
 * THIS PATH IS THE SAME PATH APPLY_ENROLL_ORDER.mjs ALREADY PROVED ONCE, MADE REAL, NOT A SECOND
 * ONE. `HARDWIRE\LEDGER\ORDERS\ORDER_enroll-peer_*.json` shows a real enrollment (peer 7317b202
 * 48c782fe, M2/HOUSEVIRIDISCOM) already happened through a hand-built order shape (order_hash
 * over a joined field list, plus a separate lb-attest-2026-01 attestation object) that predates
 * gated_order.ts/founder_totp.ts shipping as reusable, tested TypeScript modules. This file
 * performs the SAME action -- mint an authorization binding a peer_id to a public key, gated by a
 * live Founder TOTP code, applied to a registry only after multi-step verification, Rule-66'd
 * before every write -- rebuilt on the now-shipped, unit-tested, UNCHANGED gated_order.ts
 * primitive instead of re-deriving a second ad hoc attestation scheme.
 *
 * WHAT THIS FILE DOES NOT DO. It does not decide WHO may run issueEnrollPeerOrder() -- that is
 * every other piece of this design working correctly (the private key and the TOTP seed are the
 * gate). It does not implement revocation (HARDWIRE-03 gap 3, still open, still named). It does
 * not touch known_peers.json (the MIC-channel registry APPLY_ENROLL_ORDER.mjs writes to) --
 * peer_enrollment_registry.ts is a SEPARATE registry for the peer_server.ts/constellation_
 * discovery.ts/WAN surfaces this dispatch wires in a sibling change; unifying the two registries
 * is future work, named here rather than done silently.
 */

import { createHash } from 'node:crypto';
import { signFrame, verifyFrame, SIG_HEX_LEN } from './sign_verify';
import {
  issueGatedOrder,
  verifyGatedOrder,
  type GatedOrder,
  type RatifiedScope,
  type BurnStore,
} from './gated_order';
import type { CustodyRegime } from './founder_totp';
import {
  writeEnrollment,
  type EnrolledPeerRecord,
} from './peer_enrollment_registry';

export interface EnrollmentFields {
  peer_id: string;
  public_key_hex: string;
  key_id: string;
  /** D-BP223-BM0-X030-067: optional PERSON-level owner id (LB email hash). When present it is bound into the enrollment
   *  signature and written to the registry record; same-owner library sharing (pick B) reads it from there. */
  owner_id?: string;
}

export interface EnrollPeerOrderEnvelope {
  order: GatedOrder;
  enrolls: EnrollmentFields;
  /** Second signature, by the SAME private key as `order`, binding order.signature + enrolls to
   *  each other. See this file's header for why a second signature is necessary. */
  binding_signature: string;
}

/** Fixed field order, mirroring canonicalOriginString()/canonicalGatedOrder()'s own discipline:
 *  signer and verifier must build byte-identical strings or every signature fails for the wrong
 *  reason. */
export function canonicalEnrollmentBinding(orderSignature: string, enrolls: EnrollmentFields): string {
  // X030-067: owner_id is appended ONLY when present, so every pre-existing order and its signature is byte-identical.
  const parts = [orderSignature, enrolls.peer_id, enrolls.public_key_hex, enrolls.key_id];
  if (typeof enrolls.owner_id === 'string' && enrolls.owner_id.length > 0) parts.push('owner=' + enrolls.owner_id);
  return parts.join('|');
}

export interface IssueEnrollPeerOrderParams {
  issuer: string;
  enrolls: EnrollmentFields;
  ttlSeconds: number;
  nonce: string;
  privateKeyHex: string;
  /** sha256(code|window) from an ALREADY-VERIFIED founder-code-verify receipt. RETIRED
   *  2026-09-28 (D-BP223-X044-003-ONE-SEED): this function no longer accepts a raw code or a
   *  seed; see gated_order.ts's header for why. Obtain this from
   *  thorax/enroll_by_code.ts's FounderCodeReceipt (`receipt.code_commitment`). */
  codeCommitment: string;
  /** The TOTP window that commitment came from (`receipt.code_window`). */
  codeWindow: number;
  custody: CustodyRegime;
  burnStore: BurnStore;
  nowUnixSeconds?: number;
}

/**
 * Mint the enroll-peer order. Delegates the ENTIRE TOTP gate to issueGatedOrder() (thorax/
 * gated_order.ts) with scope='enroll-peer' -- it throws GateRefusal if the commitment is
 * missing/malformed, custody is not 'seed-off-machine', or the commitment was already burned
 * for that window, exactly as that file already guarantees for every caller in this codebase.
 * This function adds NOTHING to that gate; it only binds the enrollment payload on top of an
 * order that already passed it. As of D-BP223-X044-003-ONE-SEED it never sees a code or a seed.
 */
export function issueEnrollPeerOrder(params: IssueEnrollPeerOrderParams): EnrollPeerOrderEnvelope {
  const order = issueGatedOrder({
    issuer: params.issuer,
    subject: params.enrolls.peer_id,
    scope: 'enroll-peer' as RatifiedScope,
    ttlSeconds: params.ttlSeconds,
    nonce: params.nonce,
    privateKeyHex: params.privateKeyHex,
    codeCommitment: params.codeCommitment,
    codeWindow: params.codeWindow,
    custody: params.custody,
    nowUnixSeconds: params.nowUnixSeconds,
    burnStore: params.burnStore,
  });

  // D-BP223-BM0-X010-004-MESHPLUMB FINDING, recorded here so the fix travels with the code it
  // fixes: signFrame() returns `frameHex + sigHex` (signature LAST, per sign_verify.ts's own doc
  // comment) -- the signature-only slice must therefore be `.slice(-SIG_HEX_LEN)` (the trailing
  // 128 hex chars), exactly as signed_assertion.ts's issueAssertion() already does it correctly.
  // gated_order.ts's own issueGatedOrder() (`.slice(0, SIG_HEX_LEN)`, line ~213) and relay_origin.
  // ts's signatureOnly() (`.slice(0, SIG_HEX_LEN)`, line ~55) both take the LEADING 128 chars
  // instead -- for any canonical string of length >= 128 (true of every real order: the joined
  // issuer/subject/scope/timestamps/nonce/codeCommitment/window/custody fields never fit in 128
  // chars) that slice captures a piece of the CANONICAL STRING ITSELF, never any real signature
  // byte. Proven empirically this dispatch: a freshly issueGatedOrder()'d order's `signature`
  // field decodes as literal truncated canonical text, and verifyGatedOrder() on that same,
  // unmodified order returns `valid:false` unconditionally -- not a mistake in how this dispatch
  // called it, a defect in the file itself, present before this dispatch touched anything. Full
  // writeup in this dispatch's REPORT.md; gated_order.ts is NOT edited here per this dispatch's
  // hard limits, so this file's OWN signing (below) simply does it correctly instead of copying
  // the same mistake.
  const canonical = canonicalEnrollmentBinding(order.signature, params.enrolls);
  const binding_signature = signFrame(canonical, params.privateKeyHex).slice(-SIG_HEX_LEN);

  return { order, enrolls: params.enrolls, binding_signature };
}

export interface EnrollApplyResult {
  applied: boolean;
  reason: string;
  peer_id?: string;
}

/**
 * Verify AND, only on success, apply an enroll-peer order to the given registry file. FAILS
 * CLOSED at every step below, in order, and REFUSES (never partially applies) on any failure:
 *
 *   1. order.scope is exactly 'enroll-peer' -- defense in depth; verifyGatedOrder() already
 *      checks vocabulary membership but not WHICH ratified scope this order claims. Purely
 *      structural, no cryptography -- checked before the expensive/gated step 3 below.
 *   2. order.subject === enrolls.peer_id -- the base order names the same peer the enrollment
 *      payload claims to be about; a mismatch means the two halves were assembled from different
 *      orders. Also purely structural, also checked before step 3.
 *   3. verifyGatedOrder(order, rootPublicKeyHex) reports valid+authorized -- signature,
 *      expiry, and scope checks, entirely inside the unchanged gated_order.ts.
 *   4. the order is GATED (a TOTP code commitment was bound at signing) -- for scope
 *      'enroll-peer' (a GATE_REQUIRED_SCOPES member) this already fails inside verifyGatedOrder
 *      itself with "no code commitment"; re-checked here explicitly so THIS function's own
 *      refusal reason is self-explanatory without a reader having to open gated_order.ts. This is
 *      exactly "a plain signed message" refused: a real signature by the real issuer key, never
 *      gated by a live Founder code.
 *   5. binding_signature verifies against the SAME rootPublicKeyHex over
 *      canonicalEnrollmentBinding(order.signature, enrolls) -- proves the root issued THIS exact
 *      (peer_id, public_key_hex, key_id) triple bound to THIS exact order's signature, not a
 *      substituted one. Catches both a scope-tampered order (order.signature itself would already
 *      have failed step 3, since scope is inside canonicalGatedOrder()) and an enrollment-field-
 *      tampered payload (order.signature stays valid, but this binding check fails). Pulled out
 *      into verifyEnrollmentBindingSignature() below so it is unit-testable without going through
 *      step 3's call into gated_order.ts.
 *   6. sha256(public_key_hex).slice(0,16) === peer_id -- the SAME rule APPLY_ENROLL_ORDER.mjs
 *      already enforces for the shipped known_peers.json path (its own header calls this "the
 *      registry's own stated rule, checked rather than trusted"), enforced here too so a
 *      peer_id/public_key pairing that does not derive from each other is refused even if steps
 *      1-5 all passed. Pulled out into derivePeerIdFromPublicKey() below for the same reason.
 *
 * On success, delegates the write to peer_enrollment_registry.ts's writeEnrollment() (Rule 66'd).
 *
 * TESTABILITY NOTE, D-BP223-BM0-X010-004-MESHPLUMB. Steps 5 and 6 are pulled out below into their
 * own exported, pure functions (verifyEnrollmentBindingSignature, derivePeerIdFromPublicKey) so
 * this file's OWN logic can be unit-tested in complete isolation from step 2's call into
 * gated_order.ts's verifyGatedOrder() -- which this dispatch discovered and documented (see
 * issueEnrollPeerOrder()'s header comment and this dispatch's REPORT.md) is UNCONDITIONALLY
 * broken today (it can never return valid:true for any order), and which this dispatch's hard
 * limits forbid fixing. Without this split, every test that reaches step 2 would be blocked by
 * that upstream defect regardless of what steps 3-6 are meant to prove.
 */

/** Step 6, pulled out for isolated testing. sha256(public_key_hex).slice(0,16) -- the SAME rule
 *  APPLY_ENROLL_ORDER.mjs already enforces for known_peers.json ("the registry's own stated
 *  rule, checked rather than trusted"). */
export function derivePeerIdFromPublicKey(publicKeyHex: string): string {
  return createHash('sha256').update(publicKeyHex, 'utf8').digest('hex').slice(0, 16);
}

export interface BindingCheckResult {
  valid: boolean;
  reason: string;
}

/** Step 5, pulled out for isolated testing: verifies binding_signature against rootPublicKeyHex
 *  over canonicalEnrollmentBinding(order.signature, enrolls) -- proves the root issued THIS exact
 *  (peer_id, public_key_hex, key_id) triple bound to THIS exact order's signature. Does NOT touch
 *  gated_order.ts at all -- only sign_verify.ts's verifyFrame(), unchanged, called with the
 *  CORRECT frameHex-then-sigHex concatenation order (see issueEnrollPeerOrder()'s header comment
 *  for the sibling defect in gated_order.ts/relay_origin.ts this avoids). */
export function verifyEnrollmentBindingSignature(
  order: GatedOrder,
  enrolls: EnrollmentFields,
  binding_signature: string,
  rootPublicKeyHex: string,
): BindingCheckResult {
  if (!binding_signature || binding_signature.length !== SIG_HEX_LEN) {
    return { valid: false, reason: 'binding_signature missing or wrong length. Refusing.' };
  }
  const canonical = canonicalEnrollmentBinding(order.signature, enrolls);
  const check = verifyFrame(canonical + binding_signature, rootPublicKeyHex);
  if (!check.valid || check.frameHex !== canonical) {
    return {
      valid: false,
      reason: 'binding signature did not verify: the enrollment fields were altered after ' +
        'signing, signed by a different key, or never signed by the order-issuing key. Refusing.',
    };
  }
  return { valid: true, reason: 'binding signature verified' };
}

export function verifyAndApplyEnrollPeerOrder(
  envelope: EnrollPeerOrderEnvelope,
  rootPublicKeyHex: string,
  registryPath: string,
  nowUnixSeconds: number = Math.floor(Date.now() / 1000),
): EnrollApplyResult {
  const { order, enrolls, binding_signature } = envelope;

  // Steps 1 and (moved up) the subject/peer_id match are cheap, purely structural checks with no
  // cryptographic dependency -- checked first, before the expensive/gated verifyGatedOrder() call
  // below, so a malformed envelope is refused uniformly regardless of whether it happens to carry
  // a validly-shaped base order (same "check shape before signature" discipline signed_assertion.
  // ts's verifyAssertion() already documents for its own field ordering).
  if (order.scope !== 'enroll-peer') {
    return { applied: false, reason: `order scope is "${order.scope}", not "enroll-peer". Refusing.` };
  }
  if (order.subject !== enrolls.peer_id) {
    return {
      applied: false,
      reason: `order.subject "${order.subject}" does not match enrolls.peer_id "${enrolls.peer_id}". ` +
        'Refusing: the two halves do not describe the same peer.',
    };
  }

  const gateCheck = verifyGatedOrder(order, rootPublicKeyHex, nowUnixSeconds);
  if (!gateCheck.valid || !gateCheck.authorized) {
    return { applied: false, reason: `base order refused: ${gateCheck.reason}` };
  }
  if (!gateCheck.gated) {
    return {
      applied: false,
      reason: 'base order carries no evidence of a bound Founder TOTP code (gated=false). ' +
        'A plain signed message is not an authorization to enroll a peer. Refusing.',
    };
  }

  const bindingCheck = verifyEnrollmentBindingSignature(order, enrolls, binding_signature, rootPublicKeyHex);
  if (!bindingCheck.valid) {
    return { applied: false, reason: bindingCheck.reason };
  }

  const derivedPeerId = derivePeerIdFromPublicKey(enrolls.public_key_hex);
  if (derivedPeerId !== enrolls.peer_id) {
    return {
      applied: false,
      reason: `sha256(public_key_hex).slice(0,16) = "${derivedPeerId}" does not equal claimed ` +
        `peer_id "${enrolls.peer_id}". This key does not derive that peer id. Refusing.`,
    };
  }

  // D-BP223-X043-010-RB: THE WRITE BELOW IS RETIRED (Founder word "all as recommended",
  // 2026-09-28, item "retire the old identity-key enrollment rule"). Steps 1 to 6 above still run
  // in full, so this function still answers "is this a genuine, Founder-gated order for this
  // identity key?", but it NO LONGER writes the registry. Reason: step 6 only admits a key that
  // derives the peer id, which is the peer IDENTITY key (keys\peer.ed25519). Every reader of
  // peer_enrollment_registry.json (peer_server.ts resolveEnrolledSenderKey, constellation_
  // discovery.ts beacons, relay_v2_transport.ts for the relay X25519 fix) verifies THORAX-key
  // signatures, so an identity key written here makes all of them REFUSE that peer (a trusted key
  // that fails is a hard refusal). The only enrollment writer is now thorax/enroll_by_code.ts
  // (Settings > "Enroll my machines"), which writes the Thorax key with three proofs (identity key
  // derives the peer id, identity key signs the statement naming the Thorax key, Thorax key signs
  // it) plus the Founder authenticator receipt. The old write is kept below as text for the
  // record (Addendum, never Deletion) and is unreachable.
  // The HARDWIRE\LEDGER\ORDERS\ORDER_enroll-peer_* files are marked superseded beside them.
  return {
    applied: false,
    reason: `RETIRED: this order verified for peer "${enrolls.peer_id}", but enroll-peer orders no longer write ` +
      'the enrollment registry: they carry the IDENTITY key and every registry reader checks the THORAX key. ' +
      'Enroll through Settings > "Enroll my machines" (thorax/enroll_by_code.ts), which writes the Thorax key.',
    peer_id: enrolls.peer_id,
  };
}

/** D-BP223-X043-010-RB: the retired write path, kept as text for the record. Not exported, not
 *  called. See verifyAndApplyEnrollPeerOrder above. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _retiredIdentityKeyEnrollmentWrite(
  order: GatedOrder,
  enrolls: EnrollmentFields,
  registryPath: string,
): EnrollApplyResult {
  const record: EnrolledPeerRecord = {
    peer_id: enrolls.peer_id,
    public_key_hex: enrolls.public_key_hex,
    key_id: enrolls.key_id,
    enrolled_at: new Date().toISOString(),
    source: `enroll_peer_order.ts, order nonce=${order.nonce}, issuer=${order.issuer}, ` +
      `codeWindow=${order.codeWindow}, custody=${order.custody}`,
  };
  if (typeof enrolls.owner_id === 'string' && /^[0-9a-f]{16,64}$/.test(enrolls.owner_id.trim().toLowerCase())) {
    record.owner_id = enrolls.owner_id.trim().toLowerCase();
  }
  writeEnrollment(registryPath, record);

  return {
    applied: true,
    reason: `enrolled peer "${enrolls.peer_id}" (key_id=${enrolls.key_id})`,
    peer_id: enrolls.peer_id,
  };
}
