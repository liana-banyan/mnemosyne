/**
 * car_capsule_access_gate.ts -- D-BP223-BM0-X015-007-CARWIRE (redispatched, unwedged, as
 * D-BP223-BM04-X015S3-R007 by BM04).
 *
 * WHAT THIS CLOSES. BOUNTY_POSTER_CAR_CAPSULE_ACCESS_ROSTER_BP210.md CONDITION 2 (WIRED): put
 * `verifyGatedOrder()` IN FRONT OF the `catacombs:fetch-package` IPC handler /
 * `fetchCategoryPackage()` in `src/main/index.ts`, which before this dispatch called it with NO
 * gate at all -- confirmed by direct grep of the handler and of `git diff` on `index.ts` before
 * any edit landed here. Confirmed via the estate's own build-verb prior-work gate that neither
 * `BOUNTY_POSTER_CAR_CAPSULE_ACCESS_ROSTER_BP210.md` (the spec this file implements, not a prior
 * implementation) nor `PROMPT_KNIGHT_SESSION_252_VIEWING_SCHEDULE_ACCESS_GATE_B074.md` (an
 * unrelated public Viewing-Schedule feature-flag design) is a pre-existing build of this.
 *
 * WHY THE CHECK LIVES HERE AND NOT INLINE IN index.ts. `index.ts` reaches this handler only
 * through an Electron `app.whenReady()`-scoped registration path, and the real root public key
 * comes from `ed25519_keypair.ts`'s `getOrCreateKeypair()`, which touches Electron's `app` and
 * `safeStorage` and therefore cannot run in a plain vitest process. Pulling the actual gate
 * decision out into this small, pure, Electron-free function (mirroring `enroll_peer_order.ts`'s
 * own convention of pulling `verifyEnrollmentBindingSignature()` / `derivePeerIdFromPublicKey()`
 * out for isolated testing) is what makes CONDITION 3 (TESTED) possible at all: index.ts becomes
 * a one-line caller of this function plus `getOrCreateKeypair()`, and this file is what the test
 * suite actually exercises.
 *
 * SCOPE CHOICE -- A JUDGMENT CALL, FLAGGED FOR THE FOUNDER, NOT DECIDED SILENTLY.
 * `gated_order.ts`'s `RATIFIED_SCOPES` is a CLOSED list (BP158: "deliberately no admin") and has
 * no member named "catacombs-access" or "capsule-access"; the Bounty Poster does not name one
 * either -- its Condition 2 says only "verifyGatedOrder() sits in front of" the call site, not
 * which scope. This file requires the badge's scope to be `"spend-resource"`, a
 * `GATE_REQUIRED_SCOPES` member (so a live Founder TOTP code was necessarily bound at mint time),
 * reasoned as the closest existing fit -- fetching a catacombs category package draws on a
 * shared/paid substrate resource, consistent with this estate's Cost+20% Immutable. THIS SCOPE
 * CHOICE IS NOT RATIFIED. This dispatch's REPORT names it as an open question: confirm
 * "spend-resource", or name the scope actually intended.
 *
 * WHY "gated" IS CHECKED EXPLICITLY, NOT JUST "valid && authorized". `verifyGatedOrder()` can
 * return `valid:true, authorized:true` for an UNGATED order when the scope is not
 * gate-required (e.g. `"dispatch-work"`). C.A.R.'s entire point (the Founder's own words: "start
 * the car with the key... drive it wherever I want without having to restart it every time") is
 * that a live Founder code was presented ONCE, at mint time. This file's explicit `gated` check
 * is defense in depth, mirroring `enroll_peer_order.ts`'s own step 4 ("a plain signed message is
 * not an authorization").
 *
 * FAILS CLOSED at every branch below: missing badge, wrong scope, invalid/tampered signature,
 * expired order, or an ungated order all REFUSE. None fall through to `fetchCategoryPackage()`.
 */

import { verifyGatedOrder, type GatedOrder } from './gated_order';

/** See the header note above: not a ratified scope, a reasoned judgment call flagged for the
 *  Founder to confirm or correct. */
export const CAR_CAPSULE_ACCESS_SCOPE = 'spend-resource' as const;

export interface CapsuleAccessCheckResult {
  allowed: boolean;
  reason: string;
}

/**
 * The actual C.A.R. gate for catacombs package access. Pure function: no Electron, no I/O, no
 * network. Callers (the real IPC handler, or a test) supply the badge, the root public key to
 * verify it against, and optionally a fixed "now" for deterministic testing.
 */
export function checkCapsuleAccessBadge(
  badge: GatedOrder | null | undefined,
  rootPublicKeyHex: string,
  nowUnixSeconds: number = Math.floor(Date.now() / 1000),
): CapsuleAccessCheckResult {
  if (!badge) {
    return {
      allowed: false,
      reason: 'no C.A.R. badge supplied. Refusing: this path requires a verifyGatedOrder()-' +
        `checked badge carrying scope "${CAR_CAPSULE_ACCESS_SCOPE}". A missing badge is treated ` +
        'exactly like an invalid one -- it does not fall through.',
    };
  }

  if (badge.scope !== CAR_CAPSULE_ACCESS_SCOPE) {
    return {
      allowed: false,
      reason: `badge scope is "${badge.scope}", not the required "${CAR_CAPSULE_ACCESS_SCOPE}". ` +
        'Refusing.',
    };
  }

  const check = verifyGatedOrder(badge, rootPublicKeyHex, nowUnixSeconds);
  if (!check.valid || !check.authorized) {
    return { allowed: false, reason: `badge refused: ${check.reason}` };
  }

  if (!check.gated) {
    // Structurally this should be unreachable for scope "spend-resource" (a GATE_REQUIRED_SCOPES
    // member -- issueGatedOrder() refuses to mint one without a bound code commitment), but it is
    // checked explicitly anyway, exactly as enroll_peer_order.ts's own step 4 does, so a future
    // change to gated_order.ts's scope table cannot silently turn this gate into a rubber stamp.
    return {
      allowed: false,
      reason: 'badge carries no evidence of a bound Founder TOTP code (gated=false). A plain ' +
        'signed message is not a Capsule Access Roster authorization. Refusing.',
    };
  }

  return { allowed: true, reason: check.reason };
}
