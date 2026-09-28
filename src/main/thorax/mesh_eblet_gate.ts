/**
 * mesh_eblet_gate.ts -- D-BP223-BM0-X009-027-MESHWIRE
 *
 * WHY THIS FILE EXISTS. HARDWIRE-03 (`HARDWIRE\HARDWIRE-03_MESH_TRUST_AND_NODE_RECIPROCITY.md`)
 * names three gaps as the whole point of that document: (1) peer authentication is absent on
 * every live mesh path, (2) authorization scoping of what a remote peer may read/write "does not
 * exist as a concept in this code," and (3) revocation does not exist. This file closes gaps (1)
 * and (2) for exactly ONE narrow path -- a peer reading a single named eblet from another peer's
 * local store -- and leaves (3) and every other mesh surface untouched and still gap-named. It
 * does not attempt the full designed mesh-trust surface.
 *
 * NOT A NEW CRYPTO PRIMITIVE. Every signature in this file is produced and checked by
 * `issueAssertion()`/`verifyAssertion()` in `./signed_assertion.ts`, which itself calls
 * `signFrame()`/`verifyFrame()` in `./sign_verify.ts` unchanged. This file adds zero new calls
 * into `node:crypto`. It adds: (a) a peer-enrollment record shape (peer_id -> public key ->
 * allowed eblet ids/prefixes) -- the "authorization scoping" HARDWIRE-03 says does not exist yet
 * -- and (b) an auditable JSONL record on every grant and every refusal.
 *
 * NEVER TOUCHES `gated_order.ts` or `founder_totp.ts`. The scope used here (`eblet-read`) is
 * deliberately NOT one of `GATE_REQUIRED_SCOPES` (`enroll-peer`, `revoke-peer`, `mutate-system`,
 * `spend-resource`, `publish-external`, `ratify-canon`) -- reading one eblet a peer is already
 * enrolled and scoped for is not one of the six actions the Founder ruled must carry a live TOTP.
 * If a future caller wants to use this module to GRANT a peer enrollment itself (i.e. widen what
 * a peer may read), that is `enroll-peer` and belongs behind `gated_order.ts`, not here.
 *
 * WHAT THIS DOES NOT DO. It does not touch peer discovery (`constellation_discovery.ts`), the
 * unauthenticated LAN HTTP surface (`peer_server.ts`), WAN dispatch, or revocation. A peer
 * enrollment removed from the caller's in-memory/on-disk registry stops that peer locally; there
 * is still no mesh-wide revocation signal (HARDWIRE-03 gap 3, unchanged).
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { issueAssertion, verifyAssertion, type SignedAssertion } from './signed_assertion';

/** The one scope this module issues and checks. Deliberately outside GATE_REQUIRED_SCOPES. */
export const EBLET_READ_SCOPE = 'eblet-read';

/**
 * An enrolled peer, from the verifying node's point of view. `allowed_eblets` is the
 * authorization-scoping list HARDWIRE-03 section 4 gap 2 says does not exist anywhere in this
 * codebase today: exact eblet ids, or a prefix ending in '*' to allow a whole family.
 */
export interface PeerEnrollment {
  peer_id: string;
  public_key_hex: string;
  allowed_eblets: string[];
}

export interface EbletGateAuditRecord {
  ts: string;
  node: string;
  event: 'request_signed' | 'response_received' | 'grant' | 'refuse';
  peer_id: string;
  eblet_id: string;
  reason: string;
}

/** Append-only JSONL audit trail. Called on the signing side and the serving side independently
 *  -- each node keeps its own record, neither depends on the other's file existing or being
 *  reachable. */
export function appendEbletGateAudit(logPath: string, record: EbletGateAuditRecord): void {
  mkdirSync(dirname(logPath), { recursive: true });
  appendFileSync(logPath, JSON.stringify(record) + '\n', 'utf8');
}

/**
 * Called by the REQUESTING peer, with its own persisted (or, in a test, ephemeral) private key.
 * Produces a signed, time-boxed, single-eblet read request. `subject` carries the eblet id so
 * the signature binds WHICH eblet was requested, not just that "some read" was requested.
 */
export function signEbletRequest(params: {
  peerId: string;
  ebletId: string;
  privateKeyHex: string;
  ttlSeconds?: number;
  auditLogPath?: string;
}): SignedAssertion {
  const assertion = issueAssertion({
    issuer: params.peerId,
    subject: params.ebletId,
    scope: EBLET_READ_SCOPE,
    ttlSeconds: params.ttlSeconds ?? 300,
    issuerPrivateKeyHex: params.privateKeyHex,
  });
  if (params.auditLogPath) {
    appendEbletGateAudit(params.auditLogPath, {
      ts: new Date().toISOString(),
      node: params.peerId,
      event: 'request_signed',
      peer_id: params.peerId,
      eblet_id: params.ebletId,
      reason: `signed eblet-read request for "${params.ebletId}", expires ${assertion.expiresAt}`,
    });
  }
  return assertion;
}

function isAllowed(ebletId: string, allowList: readonly string[]): boolean {
  return allowList.some((entry) =>
    entry.endsWith('*') ? ebletId.startsWith(entry.slice(0, -1)) : entry === ebletId,
  );
}

export interface EbletGateResult {
  granted: boolean;
  reason: string;
  peer_id: string;
  eblet_id: string;
  payload?: unknown;
}

/**
 * Called by the SERVING peer. Verifies the sender (signature + expiry + scope, via
 * `verifyAssertion()` -- the same primitive `relay_origin.ts` reuses for the same reason), then
 * checks the resolved peer's `allowed_eblets` scoping list before ever touching `loadEblet()`.
 * FAILS CLOSED at every step and logs an auditable reason for both the grant and every refusal
 * path -- an unenrolled peer, a bad/expired/wrong-scope signature, and an enrolled-but-out-of-
 * scope request are three DIFFERENT refusal reasons, not collapsed into one "denied".
 */
export function verifyAndServeEbletRequest(params: {
  assertion: SignedAssertion;
  servingNodeId: string;
  resolvePeer: (peerId: string) => PeerEnrollment | null;
  loadEblet: (ebletId: string) => unknown | null | undefined;
  auditLogPath: string;
}): EbletGateResult {
  const { assertion, servingNodeId, resolvePeer, loadEblet, auditLogPath } = params;
  const ebletId = assertion.subject;
  const peerId = assertion.issuer;

  const record = (event: 'grant' | 'refuse', reason: string): void => {
    appendEbletGateAudit(auditLogPath, {
      ts: new Date().toISOString(), node: servingNodeId, event, peer_id: peerId, eblet_id: ebletId, reason,
    });
  };

  const enrollment = resolvePeer(peerId);
  if (!enrollment) {
    const reason = `peer "${peerId}" is not enrolled with node "${servingNodeId}". Refusing rather ` +
      `than trusting on first use.`;
    record('refuse', reason);
    return { granted: false, reason, peer_id: peerId, eblet_id: ebletId };
  }

  const check = verifyAssertion(assertion, enrollment.public_key_hex, { requiredScope: EBLET_READ_SCOPE });
  if (!check.valid) {
    const reason = `signature/scope/expiry check failed for peer "${peerId}": ${check.reason}`;
    record('refuse', reason);
    return { granted: false, reason, peer_id: peerId, eblet_id: ebletId };
  }

  if (!isAllowed(ebletId, enrollment.allowed_eblets)) {
    const reason = `peer "${peerId}" is enrolled and its signature verified, but it is not ` +
      `authorized to read eblet "${ebletId}" (allowed: ${enrollment.allowed_eblets.join(', ') || '(none)'})`;
    record('refuse', reason);
    return { granted: false, reason, peer_id: peerId, eblet_id: ebletId };
  }

  const payload = loadEblet(ebletId);
  if (payload === null || payload === undefined) {
    const reason = `peer "${peerId}" is authorized for "${ebletId}" but this node has no such eblet`;
    record('refuse', reason);
    return { granted: false, reason, peer_id: peerId, eblet_id: ebletId };
  }

  const reason = `verified sender "${peerId}" against enrolled key, authorized for "${ebletId}", served`;
  record('grant', reason);
  return { granted: true, reason, peer_id: peerId, eblet_id: ebletId, payload };
}
