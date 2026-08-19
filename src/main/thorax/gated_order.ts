/**
 * gated_order.ts -- D-BP158-M0-012. The TOTP gate wired INTO the signing path, so a Founder
 * order cannot be produced without a live code, and cannot be verified as gated unless it was.
 *
 * THE DESIGN RULE THIS FILE ENFORCES
 *   A gate you can route around is not a gate. `issueGatedOrder()` is the ONLY way to mint an
 *   order carrying a code commitment, and it will not sign until the code verifies. There is
 *   no "skip" parameter and no default seed. A caller that wants to bypass this has to stop
 *   using this module entirely, which is a visible act rather than a quiet flag.
 *
 * THE CODE NEVER TRAVELS
 *   The order carries `codeCommitment = sha256(code|window)`, not the code. The verifier
 *   rebuilds the canonical string from the commitment, so it can confirm A CODE WAS BOUND
 *   without ever seeing one. Carrying the raw code would work cryptographically and would put
 *   a live 6-digit code on the wire for the length of its window, for no gain.
 *
 *   The window is bound alongside the commitment because sha256 over six digits is trivially
 *   brute-forced on its own; including the window means a recovered code is already spent, and
 *   binding means it was never usable on any other order anyway.
 *
 * WHICH SCOPES REQUIRE A GATE
 *   Founder-ratified vocabulary, BP158. Gating is decided by what an order DOES, not by the
 *   caller's convenience:
 *     REQUIRE a live code -- mutate-system, ratify-canon, enroll-peer, revoke-peer,
 *                            publish-external, spend-resource
 *     may go ungated      -- dispatch-work
 *   dispatch-work is the ordinary high-frequency case: assigning work that writes files inside
 *   the estate. Requiring a phone tap for each one would make the Founder disable the gate, and
 *   a control that gets disabled protects nothing. Everything that changes a machine, spends
 *   money, crosses the private boundary, or changes who is trusted, requires the tap.
 *
 * VERIFICATION IS ASYMMETRIC AND STAYS THAT WAY
 *   M3 verifies with the PUBLIC key alone. It needs no seed, so it can never mint an order.
 *   It also cannot verify that the code was genuine, only that one was BOUND at signing. That
 *   is the correct division: the code proves human presence TO THE SIGNER, the signature proves
 *   authenticity TO EVERYONE. Conflating those two is how this design would rot.
 */

import { createHash } from 'node:crypto';
import { signFrame, verifyFrame, SIG_HEX_LEN } from './sign_verify';
import { verifyFounderCode, windowFor, CustodyRegime } from './founder_totp';

/** Founder-ratified scopes, BP158. Closed list: there is deliberately no `admin`. */
export const RATIFIED_SCOPES = [
  'enroll-peer', 'revoke-peer', 'mutate-system', 'dispatch-work',
  'spend-resource', 'publish-external', 'ratify-canon',
] as const;
export type RatifiedScope = typeof RATIFIED_SCOPES[number];

/** Everything except the ordinary work case. See the header for why dispatch-work is exempt. */
export const GATE_REQUIRED_SCOPES: ReadonlySet<string> = new Set([
  'enroll-peer', 'revoke-peer', 'mutate-system',
  'spend-resource', 'publish-external', 'ratify-canon',
]);

export interface GatedOrder {
  issuer: string;
  subject: string;
  scope: RatifiedScope;
  issuedAt: string;
  expiresAt: string;
  nonce: string;
  /** sha256(code|window). NOT the code. */
  codeCommitment: string;
  /** Which TOTP window the code came from. */
  codeWindow: number;
  /** Which custody regime produced the code, carried so the ledger keeps the distinction. */
  custody: CustodyRegime;
  signature: string;
}

export type UnsignedGatedOrder = Omit<GatedOrder, 'signature'>;

export function commitToCode(code: string, window: number): string {
  return createHash('sha256').update(`${code}|${window}`, 'utf8').digest('hex');
}

/** Fixed field order. Signer and verifier must build byte-identical strings. */
export function canonicalGatedOrder(o: UnsignedGatedOrder): string {
  return [o.issuer, o.subject, o.scope, o.issuedAt, o.expiresAt,
          o.nonce, o.codeCommitment, String(o.codeWindow), o.custody].join('|');
}

/** Burned (code, window) pairs. Binding stops cross-order reuse; only this stops the SAME
 *  order being replayed inside its own window. Process-local by design: a durable store is
 *  the right home for it and is a separate ticket, so this is stated rather than implied. */
const burned = new Set<string>();

export class GateRefusal extends Error {}

/**
 * Mint a signed order. REFUSES rather than signing when anything is wrong.
 *
 * Refusal cases, each distinct so a caller cannot mistake one for another:
 *   - scope not in the ratified vocabulary
 *   - scope requires a gate and no code was supplied
 *   - code does not verify against the seed
 *   - code already burned for that window
 *   - expiry missing or not after issuedAt
 */
export function issueGatedOrder(params: {
  issuer: string;
  subject: string;
  scope: RatifiedScope;
  ttlSeconds: number;
  nonce: string;
  privateKeyHex: string;
  /** Required for every gate-required scope. */
  code?: string;
  /** The seed. In the intended posture this lives OFF this machine and verification happens
   *  remotely; passing it here is the `seed-on-this-machine` regime and is labeled as such. */
  seed?: Buffer;
  custody: CustodyRegime;
  nowUnixSeconds?: number;
}): GatedOrder {
  const now = params.nowUnixSeconds ?? Math.floor(Date.now() / 1000);

  if (!(RATIFIED_SCOPES as readonly string[]).includes(params.scope)) {
    throw new GateRefusal(
      `scope "${params.scope}" is not in the Founder-ratified vocabulary. The list is closed: ` +
      RATIFIED_SCOPES.join(', '));
  }
  if (!params.ttlSeconds || params.ttlSeconds <= 0) {
    throw new GateRefusal('ttlSeconds must be positive. An order without an expiry is a permanent one.');
  }

  const needsGate = GATE_REQUIRED_SCOPES.has(params.scope);
  let commitment = '';
  let window = 0;

  if (needsGate) {
    if (!params.code || !params.seed) {
      throw new GateRefusal(
        `scope "${params.scope}" REQUIRES a live Founder code. Refusing to sign without one. ` +
        `Only "dispatch-work" may be issued ungated.`);
    }
    const res = verifyFounderCode(params.code, params.seed, params.custody, now);
    if (!res.valid) {
      throw new GateRefusal(`Founder code refused: ${res.reason}`);
    }
    window = windowFor(now);
    const burnKey = `${params.code}|${window}`;
    if (burned.has(burnKey)) {
      throw new GateRefusal(
        `that code was already used for window ${window}. Refusing: single use per window, ` +
        `otherwise one tap could authorize two orders.`);
    }
    burned.add(burnKey);
    commitment = commitToCode(params.code, window);
  }

  const unsigned: UnsignedGatedOrder = {
    issuer: params.issuer,
    subject: params.subject,
    scope: params.scope,
    issuedAt: new Date(now * 1000).toISOString(),
    expiresAt: new Date((now + params.ttlSeconds) * 1000).toISOString(),
    nonce: params.nonce,
    codeCommitment: commitment,
    codeWindow: window,
    custody: params.custody,
  };

  const signature = signFrame(canonicalGatedOrder(unsigned), params.privateKeyHex)
    .slice(0, SIG_HEX_LEN);
  return { ...unsigned, signature };
}

export interface GatedVerifyResult {
  valid: boolean;
  /** True only when the signature verified AND, for a gate-required scope, a code was bound. */
  authorized: boolean;
  /** Whether this order carries evidence a live code was presented at signing. */
  gated: boolean;
  reason: string;
}

/**
 * Verify a gated order with the PUBLIC key alone.
 *
 * A verifier can establish: the order is authentic, unaltered, in date, within the ratified
 * vocabulary, and that a code WAS bound when required. It cannot establish that the code was
 * genuine, because that needs the seed, and a verifier holding the seed could forge orders.
 * That limit is the design working, not a shortfall.
 */
export function verifyGatedOrder(
  order: GatedOrder,
  publicKeyHex: string,
  nowUnixSeconds: number = Math.floor(Date.now() / 1000),
): GatedVerifyResult {
  const fail = (reason: string, gated = false): GatedVerifyResult =>
    ({ valid: false, authorized: false, gated, reason });

  if (!(RATIFIED_SCOPES as readonly string[]).includes(order.scope)) {
    return fail(`scope "${order.scope}" is not in the ratified vocabulary`);
  }
  if (!order.expiresAt || !order.issuedAt) return fail('missing issuedAt or expiresAt');

  const needsGate = GATE_REQUIRED_SCOPES.has(order.scope);
  const hasCommitment = !!order.codeCommitment && order.codeCommitment.length === 64;
  if (needsGate && !hasCommitment) {
    return fail(
      `scope "${order.scope}" requires a Founder code and this order carries no code ` +
      `commitment. Refusing: an ungated order in a gated scope is exactly what the gate exists ` +
      `to stop.`);
  }

  // Signature BEFORE expiry, so a tampered expiry cannot decide its own validity.
  const ok = order.signature.length === SIG_HEX_LEN &&
             verifyFrame(order.signature + canonicalGatedOrder(order), publicKeyHex).valid;
  if (!ok) return fail('signature did not verify: order altered, or signed by another key', hasCommitment);

  if (new Date(order.expiresAt).getTime() / 1000 < nowUnixSeconds) {
    return { valid: false, authorized: false, gated: hasCommitment,
             reason: `expired at ${order.expiresAt}` };
  }

  return {
    valid: true,
    authorized: true,
    gated: hasCommitment,
    reason: hasCommitment
      ? `authorized, gated by a code from window ${order.codeWindow} (custody: ${order.custody})`
      : `authorized, ungated (scope "${order.scope}" does not require a code)`,
  };
}
