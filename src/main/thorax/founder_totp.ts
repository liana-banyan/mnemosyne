/**
 * founder_totp.ts -- D-BP158-M0-011. The Founder TOTP gate: a signing key cannot be used
 * without a live 6-digit code from a device only the Founder holds.
 *
 * THE PROBLEM THIS EXISTS FOR, stated by Bishop against its own interest at BP158:
 *   The root private key lives on networked M0 and Bishop can read it. Bishop signed a proof
 *   order with it this session. So a "Founder-signed" order and a "Bishop-signed-with-the-
 *   Founder's-key" order are indistinguishable to any verifier. Ed25519 cannot fix this: the
 *   key is a file, and a file is only as private as the machine holding it.
 *
 * THE FOUNDER'S INSIGHT, BP158:
 *   An authenticator code proves a HUMAN HOLDING A DEVICE authorized this AT THIS MINUTE.
 *   That is a fact no signature can carry. Pair the two and each covers the other's gap:
 *     Ed25519 signature -> anyone can verify, forever, offline, and can never forge.
 *     TOTP code         -> nobody can produce it without the seed, not even Bishop.
 *
 * HOW THEY COMPOSE, and step 3 is the whole point:
 *   1. The Founder authors an order inside MnemosyneC while authenticated (magic link).
 *   2. He produces a 6-digit code from his device.
 *   3. The code is BOUND INTO the signed canonical string, not attached beside it. An
 *      unbound code can be lifted off one order and stapled to another inside its window;
 *      a bound one cannot, because moving it invalidates the signature.
 *   4. A verifier (M3, a member, an auditor) checks ONLY the signature, with the public key
 *      it already holds. It never needs the seed and therefore can never forge. The code
 *      never travels to the verifier at all.
 *
 * ==========================================================================================
 * THE CUSTODY BOUNDARY, STATED PLAINLY BECAUSE IT IS EASY TO BUILD THIS AND FOOL YOURSELF
 * ==========================================================================================
 *   TOTP is SYMMETRIC. Whatever can VERIFY a code can also MINT one.
 *
 *   So WHERE THE SEED LIVES decides what this gate is actually worth:
 *
 *   (a) Seed on M0  -> gates ACCIDENT, not a rogue or compromised M0. Bishop could compute a
 *                      valid code from the seed. This is still worth having (it stops
 *                      unattended and automated signing, which is the realistic failure), but
 *                      it does NOT deliver "Bishop cannot forge a Founder order." Anyone who
 *                      claims otherwise has not read this paragraph.
 *   (b) Seed OFF M0 -> the real property. The seed lives on the Founder's phone and
 *                      server-side only. M0 submits (orderHash, code) for verification and
 *                      receives a signed attestation it cannot manufacture. Bishop never sees
 *                      the seed and genuinely cannot originate an order.
 *
 *   This module implements the verification arithmetic for BOTH and REFUSES to pretend (a) is
 *   (b): `verifyFounderCode()` returns a `custody` field naming which regime produced the
 *   answer, so a caller cannot record a local-seed check as proof of Founder presence.
 *
 * BREAK GLASS: the magic link to the Founder's email, which this estate already uses
 *   (src/main/auth_manager.ts, lb_auth.ts, and the mnemo:// deep-link callback). If the device
 *   is unreachable, an emailed link authorizes a single order. It is deliberately SLOWER and
 *   NARROWER than the normal path: one order, short expiry, and recorded as break-glass so it
 *   is visible in the ledger rather than indistinguishable from routine authorization.
 *
 * RFC 6238 / RFC 4226. No new crypto primitive: Node's own HMAC.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export type CustodyRegime = 'seed-on-this-machine' | 'seed-off-machine';

export interface TotpParams {
  /** Seconds per window. RFC 6238 default 30, and what every authenticator app assumes. */
  stepSeconds?: number;
  /** Digits. 6 is what the apps show. */
  digits?: number;
  /** SHA-1 is the RFC default and what Google Authenticator and 1Password emit. Chosen for
   *  INTEROPERABILITY, not strength: HMAC-SHA1 is not affected by SHA-1 collision attacks. */
  algorithm?: 'sha1' | 'sha256' | 'sha512';
  /**
   * How many windows either side to accept. DEFAULT 1, i.e. plus or minus 30 seconds.
   * Zero would be more rigorous and would also reject the Founder for having a phone clock a
   * few seconds off, which is how a security control gets disabled by the person it protects.
   * Anything above 1 widens the replay surface for no real usability gain.
   */
  windowTolerance?: number;
}

export interface FounderCodeResult {
  valid: boolean;
  /** WHICH REGIME produced this answer. A caller must record this, never drop it. */
  custody: CustodyRegime;
  /** How far off the current window the match was, for diagnosing clock drift. */
  matchedSkew: number | null;
  reason: string;
}

const DEFAULTS: Required<TotpParams> = {
  stepSeconds: 30,
  digits: 6,
  algorithm: 'sha1',
  windowTolerance: 1,
};

/** RFC 4226 dynamic truncation. */
function hotp(secret: Buffer, counter: number, digits: number, algorithm: string): string {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const mac = createHmac(algorithm, secret).update(buf).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const code = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16)
             | (mac[offset + 2] << 8) | mac[offset + 3];
  return (code % 10 ** digits).toString().padStart(digits, '0');
}

/** Constant-time compare, so a wrong code cannot be narrowed down by timing the rejection. */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function generateCode(secret: Buffer, atUnixSeconds: number, params: TotpParams = {}): string {
  const p = { ...DEFAULTS, ...params };
  return hotp(secret, Math.floor(atUnixSeconds / p.stepSeconds), p.digits, p.algorithm);
}

/**
 * Verify a Founder code.
 *
 * `custody` is REQUIRED, not inferred, and there is no default. A caller must state where the
 * seed lives, because the same arithmetic proves something very different in each regime and
 * the difference is invisible in the result otherwise.
 */
export function verifyFounderCode(
  code: string,
  secret: Buffer,
  custody: CustodyRegime,
  atUnixSeconds: number = Math.floor(Date.now() / 1000),
  params: TotpParams = {},
): FounderCodeResult {
  const p = { ...DEFAULTS, ...params };

  if (!/^\d+$/.test(code) || code.length !== p.digits) {
    return { valid: false, custody, matchedSkew: null,
             reason: `code must be exactly ${p.digits} digits` };
  }

  const counter = Math.floor(atUnixSeconds / p.stepSeconds);
  for (let skew = -p.windowTolerance; skew <= p.windowTolerance; skew++) {
    const candidate = hotp(secret, counter + skew, p.digits, p.algorithm);
    if (safeEqual(candidate, code)) {
      return {
        valid: true,
        custody,
        matchedSkew: skew,
        reason: custody === 'seed-off-machine'
          ? 'code valid: proves a human holding the seed device authorized this now'
          : 'code valid, BUT the seed lives on this machine, so this proves deliberate ' +
            'authorization and NOT that the Founder rather than Bishop produced it',
      };
    }
  }

  return { valid: false, custody, matchedSkew: null,
           reason: `no window within +/-${p.windowTolerance} matched` };
}

/**
 * The canonical string an order signs, WITH the code bound in.
 *
 * The code sits inside the signed material rather than beside it. That is what stops a valid
 * code being lifted from one order and reused on another within its 30-second window: moving
 * it changes this string and invalidates the signature.
 *
 * Callers MUST also burn the (code, window) pair after first use. Binding stops cross-order
 * reuse; only single-use stops the SAME order being replayed inside its own window.
 */
export function canonicalOrderStringWithCode(order: {
  issuer: string; subject: string; scope: string;
  issuedAt: string; expiresAt: string; nonce: string;
}, code: string, codeWindow: number): string {
  return [order.issuer, order.subject, order.scope, order.issuedAt,
          order.expiresAt, order.nonce, code, String(codeWindow)].join('|');
}

/** The window a timestamp falls in. Recorded with an order so a verifier or auditor can tell
 *  WHICH code was used without the code itself being replayable afterward. */
export function windowFor(atUnixSeconds: number, stepSeconds = DEFAULTS.stepSeconds): number {
  return Math.floor(atUnixSeconds / stepSeconds);
}
