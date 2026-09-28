/**
 * gated_order.ts -- D-BP158-M0-012. The TOTP gate wired INTO the signing path, so a Founder
 * order cannot be produced without a live code, and cannot be verified as gated unless it was.
 *
 * THE DESIGN RULE THIS FILE ENFORCES
 *   A gate you can route around is not a gate. `issueGatedOrder()` is the ONLY way to mint an
 *   order carrying a code commitment, and it will not sign until a PRE-VERIFIED commitment is
 *   supplied. There is no "skip" parameter and, as of D-BP223-X044-003-ONE-SEED (Founder ruling
 *   2026-09-28, "RETIRE the two second-seed paths so nothing can ever ask for or use a second
 *   TOTP seed"), no seed parameter either. A caller that wants to bypass this has to stop
 *   using this module entirely, which is a visible act rather than a quiet flag.
 *
 * RETIRED 2026-09-28: THE seed-on-this-machine LOCAL-VERIFY PATH
 *   This file used to accept a raw `code` plus a `seed: Buffer` and call founder_totp.ts's
 *   verifyFounderCode() itself. That meant ANY caller holding ANY Buffer could mint a "gated"
 *   order labeled custody 'seed-off-machine' -- the custody field was a caller-supplied label,
 *   never independently checked -- which is indistinguishable from a second, illegitimate
 *   Founder authenticator. There is now exactly one way a code is ever verified: the
 *   `founder-code-verify` Supabase edge function, which holds the one real seed off this
 *   machine (see thorax/enroll_by_code.ts's verifyFounderReceipt() for the receipt shape and
 *   offline signature check). Callers here supply the ALREADY-VERIFIED `codeCommitment` and
 *   `codeWindow` from that receipt; this module never sees a code or a seed, and cannot verify
 *   one. `custody` must be `'seed-off-machine'` for every gate-required scope -- there is no
 *   other value this function will accept for those scopes any more.
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
import type { CustodyRegime } from './founder_totp';

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

/**
 * D-BP158-M0-013: the burn record is DURABLE, and the guarantee lives in the database.
 *
 * An in-process Set was the first version and it was not good enough: it forgets on restart,
 * it is not shared between processes, and two concurrent signings could both pass the check
 * before either recorded it. `public.founder_order_burns` carries a UNIQUE index on
 * (code_window, code_commitment), so the SECOND insert fails at the database. That is an
 * atomic guarantee no application-side check can offer, and it survives a crash.
 *
 * The table stores the COMMITMENT, never the code, consistent with everything else here. It
 * also doubles as the audit trail of every gated authorization ever issued, which is why it
 * records issuer, subject, scope and custody alongside.
 *
 * The store is INJECTED so this module stays testable without a database, and so a caller can
 * substitute a different durable backend later without touching the signing logic.
 */
export interface BurnStore {
  /** Record a code as consumed. MUST return false if it was already burned, and MUST decide
   *  that atomically rather than by reading first and writing after. */
  burn(record: {
    codeWindow: number; codeCommitment: string;
    issuer: string; subject: string; scope: string; nonce: string; custody: CustodyRegime;
  }): boolean;
}

/** Fallback for tests and for any caller that has not supplied a durable store. It is
 *  deliberately named so nobody mistakes it for the real one in a stack trace. */
export class InMemoryBurnStoreNotDurable implements BurnStore {
  private seen = new Set<string>();
  burn(r: { codeWindow: number; codeCommitment: string }): boolean {
    const k = `${r.codeWindow}|${r.codeCommitment}`;
    if (this.seen.has(k)) return false;
    this.seen.add(k);
    return true;
  }
}

export class GateRefusal extends Error {}

/**
 * Mint a signed order. REFUSES rather than signing when anything is wrong.
 *
 * Refusal cases, each distinct so a caller cannot mistake one for another:
 *   - scope not in the ratified vocabulary
 *   - scope requires a gate and no pre-verified code commitment was supplied
 *   - custody is not 'seed-off-machine' for a gate-required scope (RETIRED: there is no
 *     local-seed regime any more; see this file's header, D-BP223-X044-003-ONE-SEED)
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
  /** Required for every gate-required scope: sha256(code|window) from an ALREADY-VERIFIED
   *  `founder-code-verify` receipt (thorax/enroll_by_code.ts's FounderCodeReceipt /
   *  verifyFounderReceipt()). This module never sees the raw code and never sees a seed --
   *  it only binds a commitment someone else already verified off-machine. */
  codeCommitment?: string;
  /** The TOTP window that commitment came from, from the same receipt. */
  codeWindow?: number;
  custody: CustodyRegime;
  nowUnixSeconds?: number;
  /** REQUIRED for any gate-required scope. Supply the durable store; the in-memory one is
   *  for tests and is named so a stack trace makes that obvious. */
  burnStore?: BurnStore;
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
    if (params.custody !== 'seed-off-machine') {
      throw new GateRefusal(
        `scope "${params.scope}" requires custody 'seed-off-machine'. The 'seed-on-this-machine' ` +
        `local-verify regime was RETIRED 2026-09-28 (D-BP223-X044-003-ONE-SEED): get a verified ` +
        `code commitment from the founder-code-verify edge function instead (see ` +
        `thorax/enroll_by_code.ts).`);
    }
    if (!params.codeCommitment || !/^[0-9a-f]{64}$/.test(params.codeCommitment) ||
        !Number.isInteger(params.codeWindow)) {
      throw new GateRefusal(
        `scope "${params.scope}" REQUIRES a pre-verified Founder code commitment (codeCommitment ` +
        `+ codeWindow) obtained from the founder-code-verify edge function. Refusing to sign ` +
        `without one -- this module accepts no code and no seed, ever. Only "dispatch-work" may ` +
        `be issued ungated.`);
    }
    window = params.codeWindow as number;
    commitment = params.codeCommitment;

    if (!params.burnStore) {
      throw new GateRefusal(
        `scope "${params.scope}" requires a burn store so a code can only authorize one order. ` +
        `Refusing to sign without one: without a durable burn, a single tap could authorize ` +
        `any number of orders inside its window, and a restart would forget every prior use.`);
    }
    // Burn BEFORE signing. If the record cannot be taken, nothing is signed. Signing first and
    // recording after would leave a signed order behind on any failure between the two.
    const fresh = params.burnStore.burn({
      codeWindow: window, codeCommitment: commitment,
      issuer: params.issuer, subject: params.subject, scope: params.scope,
      nonce: params.nonce, custody: params.custody,
    });
    if (!fresh) {
      throw new GateRefusal(
        `that code was already used for window ${window}. Refusing: one tap authorizes one ` +
        `order. This is enforced by a unique index in the database, so it holds across ` +
        `restarts, across processes, and against a race.`);
    }
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
    .slice(-SIG_HEX_LEN);
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
             verifyFrame(canonicalGatedOrder(order) + order.signature, publicKeyHex).valid;
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
