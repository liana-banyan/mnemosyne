/**
 * enroll_by_code.ts -- D-BP223-X043-007 follow-on (c). Enroll another machine by pasting its
 * enrollment code and typing the Founder's authenticator code. Pure node:crypto, no Electron,
 * fully offline-testable. The Electron glue (IPC, key access, the HTTP call) is
 * enroll_by_code_ipc.ts.
 *
 * WHY A NEW FILE AND NOT enroll_peer_order.ts's verifyAndApplyEnrollPeerOrder(). That path needs
 * (1) the ROOT private key on the enrolling machine to sign a GatedOrder and (2) the TOTP seed on
 * the same machine ('seed-on-this-machine'), and its step 6 insists the enrolled key derives the
 * peer id, i.e. it enrolls the peer IDENTITY key. None of that fits a two-click screen on any
 * machine: the root key must not be spread to every machine, the seed lives server-side, and the
 * registry's real readers (peer_server.ts resolveEnrolledSenderKey, constellation_discovery.ts
 * beacon checks, relay_v2_transport.ts) all verify signatures made by the THORAX key
 * (thorax/ed25519_keypair.ts), not by the identity key. Enrolling the identity key there would be
 * refused by every reader. (Other candidates checked before writing this file:
 * APPLY_ENROLL_ORDER.mjs and SIGN_ENROLL_M2/M3.mjs are root-key command-line scripts that write
 * the MIC-channel known_peers.json, a registry the app never reads.)
 *
 * WHAT IS REUSED, UNCHANGED:
 *   - peer_enrollment_registry.ts writeEnrollment() (Rule 66 sibling before every write) and its
 *     record shape;
 *   - enroll_peer_order.ts derivePeerIdFromPublicKey() (sha256(identity SPKI hex)[0:16] == peer id);
 *   - the Founder authenticator verify path: the `founder-code-verify` edge function (seed held
 *     server-side, one code burns once) and its receipt, signed by lb-attest-2026-01, verified here
 *     OFFLINE with the public key from auto_update_scheduler.ts's trust registry.
 *
 * THE CODE MACHINE A SHOWS proves three things, each checked on machine B:
 *   1. the identity key derives the claimed peer id;
 *   2. the holder of that identity key signed the statement naming the Thorax key;
 *   3. the holder of the Thorax key signed the same statement (possession of both).
 * B then binds (issuer B, subject A, nonce, both keys) into an order hash, the Founder's
 * authenticator code is verified server-side against THAT hash, and only a passed receipt with a
 * valid lb-attest signature over that same hash lets B write A's THORAX key into
 * peer_enrollment_registry.json.
 */

import { createHash, createPublicKey, randomBytes, verify as edVerify } from 'node:crypto';
import { derivePeerIdFromPublicKey } from './enroll_peer_order';
import { writeEnrollment, type EnrolledPeerRecord } from './peer_enrollment_registry';

export const ENROLL_CODE_PREFIX = 'MNEMO-ENROLL-1.';
const STATEMENT_LABEL = 'mnemosynec-enroll-code-v1';
const ORDER_LABEL = 'mnemosynec-enroll-by-code-v1';
const ED25519_SPKI_PREFIX = '302a300506032b6570032100';
export const ENROLL_CODE_MAX_AGE_SECONDS = 24 * 60 * 60;
const ENROLL_CODE_MAX_FUTURE_SECONDS = 5 * 60;
export const RECEIPT_MAX_AGE_SECONDS = 10 * 60;

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

/** Ed25519 SPKI DER hex (88 chars) to raw 32 bytes, or throws. */
export function spkiHexToRaw(spkiHex: string): Buffer {
  if (typeof spkiHex !== 'string' || !spkiHex.startsWith(ED25519_SPKI_PREFIX) || spkiHex.length !== 88) {
    throw new Error('not an Ed25519 SPKI public key (expected 88 hex chars with the Ed25519 prefix)');
  }
  return Buffer.from(spkiHex.slice(ED25519_SPKI_PREFIX.length), 'hex');
}
export function rawToSpkiHex(raw: Buffer): string {
  if (raw.length !== 32) throw new Error('raw Ed25519 public key must be 32 bytes');
  return ED25519_SPKI_PREFIX + raw.toString('hex');
}

function edVerifyHex(message: string, sigHex: string, spkiHex: string): boolean {
  try {
    return edVerify(null, Buffer.from(message, 'utf8'),
      createPublicKey({ key: Buffer.from(spkiHex, 'hex'), format: 'der', type: 'spki' }),
      Buffer.from(sigHex, 'hex'));
  } catch {
    return false;
  }
}

function cleanLabel(label: string): string {
  return String(label ?? '').replace(/[^A-Za-z0-9 _.-]/g, '').slice(0, 40);
}

export function enrollmentStatement(peerId: string, identitySpkiHex: string, thoraxSpkiHex: string, issuedAtUnix: number, label: string): string {
  return [STATEMENT_LABEL, peerId, identitySpkiHex, thoraxSpkiHex, String(issuedAtUnix), cleanLabel(label)].join('|');
}

export interface BuildCodeInput {
  peerId: string;
  label: string;
  identitySpkiHex: string;
  thoraxSpkiHex: string;
  /** Signs with this machine's identity key (localPeerKeypair.signWithLocalPeerKey). Returns sig hex. */
  signWithIdentity: (message: string) => string;
  /** Signs with this machine's Thorax key. Returns sig hex. */
  signWithThorax: (message: string) => string;
  nowUnixSeconds?: number;
}

/** Machine A: the code to show. About 300 characters; carries public keys and signatures only. */
export function buildEnrollmentCode(input: BuildCodeInput): string {
  const at = input.nowUnixSeconds ?? Math.floor(Date.now() / 1000);
  const label = cleanLabel(input.label);
  if (derivePeerIdFromPublicKey(input.identitySpkiHex) !== input.peerId) {
    throw new Error('this machine\'s identity key does not derive its peer id; refusing to build a code');
  }
  const statement = enrollmentStatement(input.peerId, input.identitySpkiHex, input.thoraxSpkiHex, at, label);
  const payload = {
    v: 1,
    p: input.peerId,
    l: label,
    i: b64url(spkiHexToRaw(input.identitySpkiHex)),
    t: b64url(spkiHexToRaw(input.thoraxSpkiHex)),
    at,
    si: b64url(Buffer.from(input.signWithIdentity(statement), 'hex')),
    st: b64url(Buffer.from(input.signWithThorax(statement), 'hex')),
  };
  return ENROLL_CODE_PREFIX + b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
}

export interface ParsedEnrollmentCode {
  peerId: string;
  label: string;
  identitySpkiHex: string;
  thoraxSpkiHex: string;
  issuedAtUnix: number;
}

export type ParseResult = { ok: true; code: ParsedEnrollmentCode } | { ok: false; reason: string };

/** Machine B: parse and verify a pasted code. Never throws. */
export function parseAndVerifyEnrollmentCode(pasted: string, nowUnixSeconds: number = Math.floor(Date.now() / 1000)): ParseResult {
  const text = String(pasted ?? '').replace(/\s+/g, '');
  if (!text.startsWith(ENROLL_CODE_PREFIX)) return { ok: false, reason: `not an enrollment code (it should start with ${ENROLL_CODE_PREFIX})` };
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(unb64url(text.slice(ENROLL_CODE_PREFIX.length)).toString('utf8')) as Record<string, unknown>;
  } catch {
    return { ok: false, reason: 'the code is damaged (could not be read); copy it again in full' };
  }
  if (!o || typeof o !== 'object' || o.v !== 1) return { ok: false, reason: 'unsupported enrollment code version' };
  const peerId = o.p, label = o.l, i = o.i, t = o.t, at = o.at, si = o.si, st = o.st;
  if (typeof peerId !== 'string' || !/^[0-9a-f]{16}$/.test(peerId)) return { ok: false, reason: 'peer id missing or malformed' };
  if (typeof label !== 'string' || typeof i !== 'string' || typeof t !== 'string' || typeof si !== 'string' || typeof st !== 'string' || typeof at !== 'number') {
    return { ok: false, reason: 'the code is missing a field' };
  }
  let identitySpkiHex: string, thoraxSpkiHex: string;
  try {
    identitySpkiHex = rawToSpkiHex(unb64url(i));
    thoraxSpkiHex = rawToSpkiHex(unb64url(t));
  } catch (err) {
    return { ok: false, reason: `a key in the code is malformed: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (identitySpkiHex === thoraxSpkiHex) return { ok: false, reason: 'identity and Thorax keys must differ' };
  if (nowUnixSeconds - at > ENROLL_CODE_MAX_AGE_SECONDS) return { ok: false, reason: 'the code is more than 24 hours old; make a fresh one on the other machine' };
  if (at - nowUnixSeconds > ENROLL_CODE_MAX_FUTURE_SECONDS) return { ok: false, reason: 'the code is dated in the future; check both machines\' clocks' };
  if (derivePeerIdFromPublicKey(identitySpkiHex) !== peerId) {
    return { ok: false, reason: 'the identity key in the code does not derive the peer id it claims' };
  }
  const statement = enrollmentStatement(peerId, identitySpkiHex, thoraxSpkiHex, at, label);
  if (!edVerifyHex(statement, unb64url(si).toString('hex'), identitySpkiHex)) {
    return { ok: false, reason: 'the identity signature does not verify (code altered, or not made by that machine)' };
  }
  if (!edVerifyHex(statement, unb64url(st).toString('hex'), thoraxSpkiHex)) {
    return { ok: false, reason: 'the Thorax signature does not verify (code altered, or not made by that machine)' };
  }
  return { ok: true, code: { peerId, label: cleanLabel(label), identitySpkiHex, thoraxSpkiHex, issuedAtUnix: at } };
}

export interface EnrollOrder {
  issuer: string;
  subject: string;
  scope: 'enroll-peer';
  nonce: string;
  created_at: string;
  thorax_public_key_hex: string;
  identity_public_key_hex: string;
  order_hash: string;
}

export function canonicalEnrollOrder(o: Omit<EnrollOrder, 'order_hash'>): string {
  return [ORDER_LABEL, o.issuer, o.subject, o.scope, o.nonce, o.created_at, o.thorax_public_key_hex, o.identity_public_key_hex].join('|');
}

/** Machine B: the order the Founder's code is bound to. */
export function makeEnrollOrder(selfPeerId: string, code: ParsedEnrollmentCode, now: Date = new Date(), nonce: string = randomBytes(8).toString('hex')): EnrollOrder {
  const base = {
    issuer: selfPeerId,
    subject: code.peerId,
    scope: 'enroll-peer' as const,
    nonce,
    created_at: now.toISOString(),
    thorax_public_key_hex: code.thoraxSpkiHex,
    identity_public_key_hex: code.identitySpkiHex,
  };
  return { ...base, order_hash: createHash('sha256').update(canonicalEnrollOrder(base), 'utf8').digest('hex') };
}

/** The founder-code-verify receipt shape (platform/supabase/functions/founder-code-verify/index.ts). */
export interface FounderCodeReceipt {
  passed: boolean;
  order_hash: string;
  code_window: number;
  code_commitment: string;
  custody: string;
  verified_at: string;
  rejection_reason?: string;
  attestation?: string;
}

/** Same field order as the edge function's canonicalReceiptString(). */
export function canonicalReceiptString(r: FounderCodeReceipt): string {
  return [r.order_hash, String(r.code_window), r.code_commitment, r.custody, r.verified_at].join('|');
}

export type ReceiptCheck = { ok: true } | { ok: false; reason: string };

/** Offline check of the receipt against the lb-attest public key and THIS order's hash. */
export function verifyFounderReceipt(receipt: unknown, order: EnrollOrder, attestPublicKeySpkiHex: string, nowUnixSeconds: number = Math.floor(Date.now() / 1000)): ReceiptCheck {
  if (!receipt || typeof receipt !== 'object') return { ok: false, reason: 'no receipt from the authenticator check' };
  const r = receipt as FounderCodeReceipt;
  if (r.passed !== true) return { ok: false, reason: `authenticator code refused: ${r.rejection_reason ?? 'no reason given'}` };
  if (r.order_hash !== order.order_hash) return { ok: false, reason: 'the receipt is for a different order; refusing' };
  if (r.custody !== 'seed-off-machine') return { ok: false, reason: 'the receipt does not come from the off-machine authenticator check' };
  if (typeof r.attestation !== 'string' || !/^[0-9a-f]{128}$/.test(r.attestation)) return { ok: false, reason: 'the receipt carries no attestation signature' };
  if (!/^[0-9a-f]{64}$/.test(String(r.code_commitment)) || !Number.isInteger(r.code_window)) return { ok: false, reason: 'the receipt is malformed' };
  const t = Date.parse(r.verified_at);
  if (Number.isNaN(t) || Math.abs(nowUnixSeconds - t / 1000) > RECEIPT_MAX_AGE_SECONDS) return { ok: false, reason: 'the receipt is stale or dated in the future' };
  if (!edVerifyHex(canonicalReceiptString(r), r.attestation, attestPublicKeySpkiHex)) {
    return { ok: false, reason: 'the receipt signature does not verify under lb-attest-2026-01; refusing' };
  }
  return { ok: true };
}

export type ApplyResult = { applied: true; peerId: string; label: string } | { applied: false; reason: string };

/** Machine B: write A's THORAX key into the registry, only after every check above passed. */
export function applyEnrollmentByCode(params: {
  selfPeerId: string;
  code: ParsedEnrollmentCode;
  order: EnrollOrder;
  receipt: unknown;
  attestPublicKeySpkiHex: string;
  registryPath: string;
  nowUnixSeconds?: number;
}): ApplyResult {
  const { code, order } = params;
  if (code.peerId === params.selfPeerId) return { applied: false, reason: 'that is this machine\'s own code; paste the code shown on the OTHER machine' };
  if (order.subject !== code.peerId || order.thorax_public_key_hex !== code.thoraxSpkiHex || order.identity_public_key_hex !== code.identitySpkiHex || order.issuer !== params.selfPeerId) {
    return { applied: false, reason: 'the order does not match the pasted code; refusing' };
  }
  const { order_hash: _h, ...unsigned } = order;
  const expectHash = createHash('sha256').update(canonicalEnrollOrder(unsigned), 'utf8').digest('hex');
  if (expectHash !== order.order_hash) return { applied: false, reason: 'order hash mismatch; refusing' };
  const rc = verifyFounderReceipt(params.receipt, order, params.attestPublicKeySpkiHex, params.nowUnixSeconds);
  if (!rc.ok) return { applied: false, reason: rc.reason };
  const r = params.receipt as FounderCodeReceipt;
  const record: EnrolledPeerRecord = {
    peer_id: code.peerId,
    // The key every registry reader verifies against (Thorax), not the identity key.
    public_key_hex: code.thoraxSpkiHex,
    key_id: `thorax-${code.peerId}`,
    enrolled_at: new Date().toISOString(),
    source:
      `enroll_by_code.ts (Settings screen); label=${code.label || '(none)'}; ` +
      `identity_public_key_hex=${code.identitySpkiHex}; issuer=${order.issuer}; nonce=${order.nonce}; ` +
      `order_hash=${order.order_hash}; founder-code-verify receipt window=${r.code_window} ` +
      `verified_at=${r.verified_at} custody=${r.custody} attestation(lb-attest-2026-01)=${r.attestation}`,
  };
  writeEnrollment(params.registryPath, record);
  return { applied: true, peerId: code.peerId, label: code.label };
}
