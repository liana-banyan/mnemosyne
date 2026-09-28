/**
 * relay_x25519.ts -- D-BP223-X043-007-RELAY-X25519. Thorax relay encryption, wire version "v2".
 *
 * THE DEFECT THIS REPLACES (Daisy Chain design review, DAISY_CHAIN_DESIGN_v2.md section 2.4):
 * mic_dispatcher.ts's encryptForRelay() derived its AES-256-GCM key as
 * sha256(targetPeerId + ":thorax-relay-v1"), and every caller passed no shared secret. The target
 * peer id is public (peer_presence, readable with the anon key), and relay_routes rows are readable
 * with the anon key too, so anyone could derive the key and read every "v1" message. That was
 * obfuscation, not end-to-end secrecy.
 *
 * WHAT v2 DOES:
 *   1. Each node has a long-term X25519 keypair. It is DERIVED from the node's existing Thorax
 *      Ed25519 private key (thorax/ed25519_keypair.ts, already stored encrypted through Electron
 *      safeStorage) with HKDF-SHA256 and a fixed domain-separation label. Nothing new is written
 *      to disk, the X25519 private key exists only in memory, and it is never uploaded.
 *   2. The X25519 PUBLIC key is published with presence inside a small "announcement" signed by
 *      the node's Ed25519 key. The signed statement binds the peer id, so a key cannot be moved
 *      to another peer id, and a row edit that swaps the key without a valid signature is refused.
 *   3. Per message: shared = X25519(my_priv, their_pub); key = HKDF-SHA256(shared, salt, info)
 *      where salt is 32 fresh random bytes carried in the frame and info is
 *      "mnemosynec-relay-v2|<lower peer id>|<higher peer id>" (both ids sorted). AEAD is
 *      AES-256-GCM (chosen over chacha20-poly1305 because Electron's BoringSSL-based node:crypto
 *      does not reliably expose chacha20-poly1305 through createCipheriv) with a fresh random
 *      12-byte nonce. The associated data binds the wire version, algorithm, sender id,
 *      recipient id, message id, timestamp, salt and the sender's X25519 public key.
 *   4. The receiver refuses: a frame for another recipient, a stale or future-dated frame, a
 *      sender key announcement whose signature does not verify, any ciphertext or header tamper
 *      (AEAD failure), and a message id it has already accepted (replay).
 *
 * The Ed25519 signing of the plaintext payload (announce_frame.ts) is unchanged and still runs
 * INSIDE the encryption: v2 adds confidentiality, it does not replace origin authentication.
 *
 * This file is pure node:crypto. It imports nothing from Electron so it is fully offline-testable.
 * The Electron-side glue (loading this node's key, reading peer_presence, settings) lives in
 * relay_v2_transport.ts.
 */

import {
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  hkdfSync,
  randomBytes,
  sign as edSign,
  verify as edVerify,
  type KeyObject,
} from 'node:crypto';

export const RELAY_WIRE_V2 = 'v2' as const;
export const RELAY_V2_ALG = 'x25519-hkdf-sha256-aes-256-gcm' as const;
export const RELAY_V2_HKDF_INFO_PREFIX = 'mnemosynec-relay-v2';
const KEYGEN_SALT = 'mnemosynec-relay-x25519-keygen-v1';
const KEYGEN_INFO = 'thorax-ed25519-to-relay-x25519-static-private';
const ANNOUNCEMENT_LABEL = 'mnemosynec-relay-x25519-pub-v2';
const AAD_LABEL = 'mnemosynec-relay-v2-aad';

/** Default acceptance window for a v2 frame's timestamp. relay_routes rows carry ttl_seconds 300
 *  for bishop_dispatch; 10 minutes covers that plus clock drift. */
export const DEFAULT_MAX_AGE_MS = 10 * 60 * 1000;
export const DEFAULT_MAX_FUTURE_SKEW_MS = 2 * 60 * 1000;

// DER prefixes for raw 32-byte X25519 keys (RFC 8410).
const X25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b656e04220420', 'hex');
const X25519_SPKI_PREFIX = Buffer.from('302a300506032b656e032100', 'hex');

const HEX64 = /^[0-9a-f]{64}$/;

export interface RelayX25519Keypair {
  /** Raw 32-byte X25519 public key, lowercase hex (64 chars). Safe to publish. */
  publicKeyHex: string;
  /** In-memory only. Never serialize, log or upload. */
  privateKey: KeyObject;
}

/** Signed statement published with presence (capabilities.relay_x25519). */
export interface RelayX25519Announcement {
  v: 2;
  peer_id: string;
  x25519_pub: string;
  issued_at: string;
  /** Ed25519 signature (hex, 128 chars) over announcementMessage(peer_id, x25519_pub, issued_at). */
  sig: string;
}

export interface RelayV2Frame {
  v: typeof RELAY_WIRE_V2;
  alg: typeof RELAY_V2_ALG;
  from: string;
  to: string;
  mid: string;
  ts: number;
  salt: string;
  iv: string;
  ct: string;
  tag: string;
  /** Sender's X25519 public key announcement, so the receiver needs no database lookup. */
  spk: RelayX25519Announcement;
  /** Sender's self-declared Ed25519 SPKI hex. Used ONLY when the receiver has no enrolled or
   *  previously learned key for `from` (trust on first use, reported as such). */
  spk_ed: string;
}

export class RelayCryptoError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'RelayCryptoError';
  }
}

function b64(buf: Buffer): string { return buf.toString('base64'); }
function unb64(s: string, field: string): Buffer {
  if (typeof s !== 'string' || s.length === 0) throw new RelayCryptoError('MALFORMED_FRAME', `field ${field} missing`);
  return Buffer.from(s, 'base64');
}

/** Builds an X25519 private KeyObject from 32 raw bytes. */
export function x25519PrivateFromRaw(raw: Buffer): KeyObject {
  if (raw.length !== 32) throw new RelayCryptoError('BAD_KEY', 'X25519 private key must be 32 bytes');
  return createPrivateKey({ key: Buffer.concat([X25519_PKCS8_PREFIX, raw]), format: 'der', type: 'pkcs8' });
}

/** Builds an X25519 public KeyObject from a raw 32-byte hex string. */
export function x25519PublicFromHex(hex: string): KeyObject {
  if (typeof hex !== 'string' || !HEX64.test(hex)) {
    throw new RelayCryptoError('BAD_KEY', 'X25519 public key must be 64 lowercase hex chars');
  }
  return createPublicKey({ key: Buffer.concat([X25519_SPKI_PREFIX, Buffer.from(hex, 'hex')]), format: 'der', type: 'spki' });
}

function rawPublicHex(pub: KeyObject): string {
  const der = pub.export({ type: 'spki', format: 'der' }) as Buffer;
  return der.subarray(der.length - 32).toString('hex');
}

/**
 * Derives this node's long-term relay X25519 keypair from its Thorax Ed25519 private key
 * (PKCS8 DER hex, as held by getOrCreateKeypair()). Deterministic: the same Ed25519 key always
 * yields the same X25519 key, so nothing new has to be stored. HKDF with its own salt and info
 * label keeps the two uses of the key material separated.
 */
export function deriveRelayX25519FromEd25519(ed25519PrivatePkcs8Hex: string): RelayX25519Keypair {
  if (typeof ed25519PrivatePkcs8Hex !== 'string' || ed25519PrivatePkcs8Hex.length === 0) {
    throw new RelayCryptoError('BAD_KEY', 'Ed25519 private key missing');
  }
  const ikm = Buffer.from(ed25519PrivatePkcs8Hex, 'hex');
  const seed = Buffer.from(hkdfSync('sha256', ikm, Buffer.from(KEYGEN_SALT, 'utf8'), Buffer.from(KEYGEN_INFO, 'utf8'), 32));
  const privateKey = x25519PrivateFromRaw(seed);
  seed.fill(0);
  return { publicKeyHex: rawPublicHex(createPublicKey(privateKey)), privateKey };
}

/** Fresh random keypair. Tests only; production derives (above). */
export function generateRelayX25519Keypair(): RelayX25519Keypair {
  const privateKey = x25519PrivateFromRaw(randomBytes(32));
  return { publicKeyHex: rawPublicHex(createPublicKey(privateKey)), privateKey };
}

// ─── Signed public-key announcement ─────────────────────────────────────────────────────────

export function announcementMessage(peerId: string, x25519PubHex: string, issuedAt: string): Buffer {
  return Buffer.from(`${ANNOUNCEMENT_LABEL}\n${peerId}\n${x25519PubHex}\n${issuedAt}`, 'utf8');
}

export function signRelayX25519Announcement(
  peerId: string,
  x25519PubHex: string,
  ed25519PrivatePkcs8Hex: string,
  issuedAt: string = new Date().toISOString(),
): RelayX25519Announcement {
  const priv = createPrivateKey({ key: Buffer.from(ed25519PrivatePkcs8Hex, 'hex'), format: 'der', type: 'pkcs8' });
  const sig = edSign(null, announcementMessage(peerId, x25519PubHex, issuedAt), priv).toString('hex');
  return { v: 2, peer_id: peerId, x25519_pub: x25519PubHex, issued_at: issuedAt, sig };
}

export interface AnnouncementCheck {
  ok: boolean;
  reason: string;
}

/**
 * Verifies an announcement against a SPECIFIC Ed25519 public key (SPKI DER hex) and an expected
 * peer id. Never throws. The caller decides which Ed25519 key is trusted; a key read from the
 * same database row as the announcement proves nothing against someone who can edit that row.
 */
export function verifyRelayX25519Announcement(
  ann: unknown,
  expectedPeerId: string,
  trustedEd25519SpkiHex: string,
): AnnouncementCheck {
  if (!ann || typeof ann !== 'object') return { ok: false, reason: 'announcement missing' };
  const a = ann as Partial<RelayX25519Announcement>;
  if (a.v !== 2) return { ok: false, reason: 'announcement version is not 2' };
  if (typeof a.peer_id !== 'string' || a.peer_id !== expectedPeerId) {
    return { ok: false, reason: `announcement is for peer "${String(a.peer_id)}", expected "${expectedPeerId}"` };
  }
  if (typeof a.x25519_pub !== 'string' || !HEX64.test(a.x25519_pub)) return { ok: false, reason: 'announcement x25519_pub malformed' };
  if (typeof a.issued_at !== 'string' || a.issued_at.length === 0) return { ok: false, reason: 'announcement issued_at missing' };
  if (typeof a.sig !== 'string' || !/^[0-9a-f]{128}$/.test(a.sig)) return { ok: false, reason: 'announcement signature malformed' };
  if (typeof trustedEd25519SpkiHex !== 'string' || trustedEd25519SpkiHex.length === 0) {
    return { ok: false, reason: 'no Ed25519 key to verify the announcement against' };
  }
  try {
    const pub = createPublicKey({ key: Buffer.from(trustedEd25519SpkiHex, 'hex'), format: 'der', type: 'spki' });
    const good = edVerify(null, announcementMessage(a.peer_id, a.x25519_pub, a.issued_at), pub, Buffer.from(a.sig, 'hex'));
    return good ? { ok: true, reason: 'announcement signature verified' } : { ok: false, reason: 'announcement signature does not verify' };
  } catch (err) {
    return { ok: false, reason: `announcement verify error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ─── Key agreement ──────────────────────────────────────────────────────────────────────────

export function hkdfInfoFor(peerA: string, peerB: string): Buffer {
  const [lo, hi] = [peerA, peerB].sort();
  return Buffer.from(`${RELAY_V2_HKDF_INFO_PREFIX}|${lo}|${hi}`, 'utf8');
}

/** HKDF-SHA256(X25519(my_priv, their_pub), salt, info "mnemosynec-relay-v2|<sorted ids>"). */
export function deriveRelaySharedKey(
  myPrivateKey: KeyObject,
  theirX25519PubHex: string,
  myPeerId: string,
  theirPeerId: string,
  salt: Buffer,
): Buffer {
  const shared = diffieHellman({ privateKey: myPrivateKey, publicKey: x25519PublicFromHex(theirX25519PubHex) });
  // A low-order public key gives an all-zero shared secret; refuse it rather than encrypt under it.
  if (shared.every((b) => b === 0)) throw new RelayCryptoError('BAD_KEY', 'X25519 produced an all-zero shared secret');
  const key = Buffer.from(hkdfSync('sha256', shared, salt, hkdfInfoFor(myPeerId, theirPeerId), 32));
  shared.fill(0);
  return key;
}

function aadFor(f: Pick<RelayV2Frame, 'v' | 'alg' | 'from' | 'to' | 'mid' | 'ts' | 'salt'>, senderX25519Pub: string): Buffer {
  return Buffer.from([AAD_LABEL, f.v, f.alg, f.from, f.to, f.mid, String(f.ts), f.salt, senderX25519Pub].join('|'), 'utf8');
}

// ─── Seal / open ────────────────────────────────────────────────────────────────────────────

export interface SealV2Input {
  plaintext: string;
  selfPeerId: string;
  selfKeypair: RelayX25519Keypair;
  /** This node's own signed announcement (carried in the frame as `spk`). */
  selfAnnouncement: RelayX25519Announcement;
  /** This node's Ed25519 SPKI hex (carried as `spk_ed`, only used by a receiver with no better key). */
  selfEd25519PublicHex: string;
  recipientPeerId: string;
  /** Recipient's X25519 public key, ALREADY verified by the caller (verifyRelayX25519Announcement). */
  recipientX25519PubHex: string;
  nowMs?: number;
  messageId?: string;
}

export function sealRelayV2(input: SealV2Input): string {
  if (input.selfAnnouncement.x25519_pub !== input.selfKeypair.publicKeyHex || input.selfAnnouncement.peer_id !== input.selfPeerId) {
    throw new RelayCryptoError('BAD_KEY', 'self announcement does not match this node\'s relay key or peer id');
  }
  const salt = randomBytes(32);
  const iv = randomBytes(12);
  const header = {
    v: RELAY_WIRE_V2,
    alg: RELAY_V2_ALG,
    from: input.selfPeerId,
    to: input.recipientPeerId,
    mid: input.messageId ?? randomBytes(16).toString('hex'),
    ts: input.nowMs ?? Date.now(),
    salt: b64(salt),
  };
  const key = deriveRelaySharedKey(input.selfKeypair.privateKey, input.recipientX25519PubHex, input.selfPeerId, input.recipientPeerId, salt);
  try {
    const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
    cipher.setAAD(aadFor(header, input.selfKeypair.publicKeyHex));
    const ct = Buffer.concat([cipher.update(Buffer.from(input.plaintext, 'utf8')), cipher.final()]);
    const frame: RelayV2Frame = {
      ...header,
      iv: b64(iv),
      ct: b64(ct),
      tag: b64(cipher.getAuthTag()),
      spk: input.selfAnnouncement,
      spk_ed: input.selfEd25519PublicHex,
    };
    return JSON.stringify(frame);
  } finally {
    key.fill(0);
  }
}

/** Replay memory. The default is in-process; a restart forgets, and the timestamp window
 *  (DEFAULT_MAX_AGE_MS) bounds what a restart could let through. bishop_dispatch_handler.ts's
 *  per-dispatchId dedupe marker is a second, persistent line behind this one. */
export interface ReplayGuard {
  /** Returns true if (from, mid) is new and records it; false if it was already seen. */
  checkAndRemember(from: string, mid: string, ts: number, nowMs: number): boolean;
}

export class MemoryReplayGuard implements ReplayGuard {
  private readonly seen = new Map<string, number>();
  constructor(private readonly retainMs: number = DEFAULT_MAX_AGE_MS + DEFAULT_MAX_FUTURE_SKEW_MS) {}
  checkAndRemember(from: string, mid: string, _ts: number, nowMs: number): boolean {
    for (const [k, exp] of this.seen) if (exp < nowMs) this.seen.delete(k);
    const k = `${from}|${mid}`;
    if (this.seen.has(k)) return false;
    this.seen.set(k, nowMs + this.retainMs);
    return true;
  }
}

export type SenderKeySource = 'trusted' | 'self_declared';

export interface OpenV2Input {
  frameJson: string;
  selfPeerId: string;
  selfKeypair: RelayX25519Keypair;
  /** Enrolled or previously learned Ed25519 SPKI hex for a sender id, if this node has one. */
  resolveTrustedSenderEd25519: (peerId: string) => string | null | undefined;
  replayGuard: ReplayGuard;
  nowMs?: number;
  maxAgeMs?: number;
  maxFutureSkewMs?: number;
}

export interface OpenV2Result {
  plaintext: string;
  from: string;
  mid: string;
  /** 'trusted' = the sender's X25519 announcement verified against an enrolled/learned key;
   *  'self_declared' = against the Ed25519 key carried in the same frame (trust on first use). */
  senderKeySource: SenderKeySource;
}

export function isRelayV2Frame(parsed: unknown): boolean {
  return !!parsed && typeof parsed === 'object' && (parsed as { v?: unknown }).v === RELAY_WIRE_V2;
}

/** Opens a v2 frame or throws RelayCryptoError with a specific code. */
export function openRelayV2(input: OpenV2Input): OpenV2Result {
  let f: Partial<RelayV2Frame>;
  try {
    f = JSON.parse(input.frameJson) as Partial<RelayV2Frame>;
  } catch {
    throw new RelayCryptoError('MALFORMED_FRAME', 'frame is not JSON');
  }
  if (!f || typeof f !== 'object' || f.v !== RELAY_WIRE_V2) throw new RelayCryptoError('NOT_V2', 'frame is not wire version v2');
  if (f.alg !== RELAY_V2_ALG) throw new RelayCryptoError('BAD_ALG', `unsupported alg ${String(f.alg)}`);
  for (const k of ['from', 'to', 'mid', 'salt', 'iv', 'ct', 'tag', 'spk_ed'] as const) {
    if (typeof f[k] !== 'string' || (f[k] as string).length === 0) throw new RelayCryptoError('MALFORMED_FRAME', `field ${k} missing`);
  }
  if (typeof f.ts !== 'number' || !Number.isFinite(f.ts)) throw new RelayCryptoError('MALFORMED_FRAME', 'field ts missing');

  if (f.to !== input.selfPeerId) {
    throw new RelayCryptoError('WRONG_RECIPIENT', `frame is addressed to "${f.to}", this node is "${input.selfPeerId}"`);
  }
  const now = input.nowMs ?? Date.now();
  const maxAge = input.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const maxSkew = input.maxFutureSkewMs ?? DEFAULT_MAX_FUTURE_SKEW_MS;
  if (now - f.ts > maxAge) throw new RelayCryptoError('STALE', 'frame timestamp is older than the acceptance window');
  if (f.ts - now > maxSkew) throw new RelayCryptoError('FUTURE', 'frame timestamp is too far in the future');

  const trusted = input.resolveTrustedSenderEd25519(f.from!) ?? null;
  const verifyKey = trusted ?? f.spk_ed!;
  const annCheck = verifyRelayX25519Announcement(f.spk, f.from!, verifyKey);
  if (!annCheck.ok) {
    throw new RelayCryptoError('BAD_SENDER_KEY', `sender X25519 key refused: ${annCheck.reason}`);
  }
  const senderPub = (f.spk as RelayX25519Announcement).x25519_pub;

  const salt = unb64(f.salt!, 'salt');
  const iv = unb64(f.iv!, 'iv');
  const tag = unb64(f.tag!, 'tag');
  if (salt.length !== 32 || iv.length !== 12 || tag.length !== 16) {
    throw new RelayCryptoError('MALFORMED_FRAME', 'salt, iv or tag has the wrong length');
  }
  const key = deriveRelaySharedKey(input.selfKeypair.privateKey, senderPub, input.selfPeerId, f.from!, salt);
  let pt: Buffer;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
    decipher.setAAD(aadFor(f as RelayV2Frame, senderPub));
    decipher.setAuthTag(tag);
    pt = Buffer.concat([decipher.update(unb64(f.ct!, 'ct')), decipher.final()]);
  } catch {
    throw new RelayCryptoError('DECRYPT_FAILED', 'authentication failed (tampered frame, wrong key or wrong recipient)');
  } finally {
    key.fill(0);
  }

  // Replay is checked only AFTER authentication, so garbage frames cannot burn message ids.
  if (!input.replayGuard.checkAndRemember(f.from!, f.mid!, f.ts, now)) {
    throw new RelayCryptoError('REPLAY', `message id ${f.mid} from ${f.from} was already accepted`);
  }
  return { plaintext: pt.toString('utf8'), from: f.from!, mid: f.mid!, senderKeySource: trusted ? 'trusted' : 'self_declared' };
}
