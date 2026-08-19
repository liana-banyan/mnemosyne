/**
 * signed_order.ts -- D-BP158-M0-009. Binds the signed-assertion primitive to the estate's
 * SHIPPED trust registry, so a Founder order can be verified by keyId rather than by being
 * handed a public key out of band.
 *
 * WHY THIS FILE EXISTS AND WHY IT IS SEPARATE
 *   signed_assertion.ts is deliberately PURE: no Electron import, no filesystem, no registry.
 *   That is why its 10 tests run headless in vitest. auto_update_scheduler.ts is the opposite,
 *   an Electron-bound module holding LB_PUBLIC_KEYS and the rotation overlay. Importing the
 *   second into the first would drag Electron into the pure module and cost the headless test
 *   run. This thin seam joins them without either giving up what makes it useful.
 *
 * WHAT WAS ACTUALLY MISSING, MEASURED at BP158
 *   It was NOT the root key. `LB_PUBLIC_KEYS['lb-root-2026-01'].publicKeyHex` already holds the
 *   real provisioned Ed25519 SPKI key with status 'active', VERIFIED byte-for-byte against
 *   C:\Users\Administrator\.lb-root-keys\lb-root-2026-01.private.json.pubkey.txt. A comment above
 *   that entry still described it as a placeholder, and a SEG read the comment rather than the
 *   value. Stale prose, live code: the same trap as HARDWIRE-25's doc reading "NOT YET LANDED"
 *   after its wiring commit landed.
 *
 *   What was genuinely missing is THIS: nothing connected an assertion's issuer to that registry.
 *   verifyAssertion() takes a public key as an argument, so every caller had to already know the
 *   key. A verifier that must be handed the key it verifies against is not a trust root, it is a
 *   parameter. That is the gap that kept signed orders from shipping.
 *
 * WHAT THIS MAKES POSSIBLE
 *   BishopM3 refused a system-modifying order this session on the grounds that it "cannot
 *   distinguish 'the Captain ordered it' from 'a dispatch says the Captain ordered it'." With
 *   this, M3 resolves the issuer keyId against its own compiled registry and verifies the
 *   Founder directly, trusting no intermediate agent, including BishopM0.
 */

import { verifyAssertion, SignedAssertion, VerifyOptions, VerifyResult } from './signed_assertion';

/**
 * Resolved LAZILY, not by a top-level import. auto_update_scheduler pulls Electron at module
 * load; a static import here would drag Electron into this file and, transitively, into any
 * headless test of it. Requiring inside the function keeps the Electron dependency on the call
 * path rather than the import path, so a test can inject a registry and never touch Electron.
 * This is the same reason signed_assertion.ts stayed pure.
 */
function defaultRegistry(): Record<string, { publicKeyHex: string; algorithm?: string; status?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('../auto_update_scheduler') as {
    getEffectiveKeyRegistry: () => Record<string, { publicKeyHex: string; algorithm?: string; status?: string }>;
  };
  return mod.getEffectiveKeyRegistry();
}

export interface OrderVerifyResult extends VerifyResult {
  /** Which registry entry the issuer resolved to, or null when it did not resolve. */
  resolvedKeyId: string | null;
  /** True only when the issuer was resolved from the registry AND the signature verified AND
   *  scope and expiry passed. Callers should gate on THIS, never on `valid` alone. */
  authorized: boolean;
}

/**
 * Verify a signed order against the shipped trust registry.
 *
 * FAILS CLOSED at every step, and says which step:
 *   - issuer names no known keyId            -> resolvedKeyId null, authorized false
 *   - the resolved entry is not 'active'     -> authorized false (covers revocation)
 *   - the entry is the placeholder sentinel  -> authorized false
 *   - signature, scope or expiry fails       -> authorized false, with verifyAssertion's reason
 *
 * `assertion.issuer` IS the keyId. That is deliberate: an order names the authority it claims,
 * and the verifier resolves that name locally. An issuer string that resolves to nothing is not
 * an error to be smoothed over, it is an unauthorized order.
 */
export function verifySignedOrder(
  assertion: SignedAssertion,
  opts: VerifyOptions = {},
  registry?: Record<string, { publicKeyHex: string; algorithm?: string; status?: string }>,
): OrderVerifyResult {
  const reg = registry ?? defaultRegistry();
  const entry = reg[assertion.issuer];

  if (!entry) {
    return {
      valid: false,
      reason: `issuer "${assertion.issuer}" does not resolve to any keyId in this installation's ` +
              `trust registry. An order from an unknown authority is not an order.`,
      resolvedKeyId: null,
      authorized: false,
    } as OrderVerifyResult;
  }

  if (entry.status && entry.status !== 'active') {
    return {
      valid: false,
      reason: `issuer "${assertion.issuer}" resolves to a key with status "${entry.status}", not ` +
              `"active". Refusing.`,
      resolvedKeyId: assertion.issuer,
      authorized: false,
    } as OrderVerifyResult;
  }

  // Defense in depth: auto_update_scheduler refuses the sentinel on its own path, and a signed
  // order must never be the one caller that forgets to.
  if (entry.publicKeyHex === 'PLACEHOLDER_KEY_NOT_PROVISIONED_DO_NOT_TRUST') {
    return {
      valid: false,
      reason: `issuer "${assertion.issuer}" resolves to the placeholder sentinel. Refusing.`,
      resolvedKeyId: assertion.issuer,
      authorized: false,
    } as OrderVerifyResult;
  }

  const base = verifyAssertion(assertion, entry.publicKeyHex, opts);
  return {
    ...base,
    resolvedKeyId: assertion.issuer,
    authorized: base.valid === true,
  };
}

/** True when this installation can verify orders from `keyId` at all. Lets a caller report
 *  "I cannot check this" distinctly from "I checked it and it failed", which are different
 *  facts and must never be collapsed. */
export function canVerifyIssuer(
  keyId: string,
  registry?: Record<string, { publicKeyHex: string; status?: string }>,
): boolean {
  const e = (registry ?? defaultRegistry())[keyId];
  return !!e && e.status !== 'revoked' &&
         e.publicKeyHex !== 'PLACEHOLDER_KEY_NOT_PROVISIONED_DO_NOT_TRUST';
}
