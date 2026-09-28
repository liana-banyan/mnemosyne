/**
 * peer_enrollment_registry.ts -- D-BP223-BM0-X010-004-MESHPLUMB.
 *
 * WHY THIS FILE EXISTS. HARDWIRE-03 names peer authentication and authorization scoping as
 * absent on every live mesh path. D-BP223-BM0-X009-027-MESHWIRE built mesh_eblet_gate.ts as a
 * proven, freestanding enroll-then-verify primitive for exactly one path (single-eblet reads)
 * but its own header states plainly it "does not touch peer discovery (constellation_discovery.
 * ts), the unauthenticated LAN HTTP surface (peer_server.ts), WAN dispatch, or revocation." This
 * file is the shared, generic REGISTRY those three live surfaces now read from: peer_id ->
 * enrolled Ed25519 public key. Fail-closed by construction: a peer_id absent from this registry
 * resolves to `null` from every lookup below, never to a self-declared or trust-on-first-use key
 * -- that is the caller's job to decide what to do with `null`, not this module's.
 *
 * HOW A KEY LEGITIMATELY GETS IN HERE. Only through enroll_peer_order.ts's
 * verifyAndApplyEnrollPeerOrder(), which requires a GatedOrder (thorax/gated_order.ts, UNCHANGED
 * by this dispatch) carrying evidence of a live Founder TOTP code for scope 'enroll-peer'.
 * writeEnrollment() below is the only write path this module exposes, and it performs NO
 * authorization check of its own -- it must never be called directly by peer_server.ts,
 * constellation_discovery.ts, or any WAN-path code. Those files only ever READ this registry via
 * lookupEnrolledPeerPublicKey()/isPeerEnrolled().
 *
 * TWO SEPARATE REGISTRIES, ON PURPOSE, NEVER DEFAULTED. Every function below takes an explicit
 * `registryPath` argument -- there is no built-in default and no fallback to a hardcoded path.
 * Production callers (peer_server.ts, constellation_discovery.ts) resolve
 * `<userData>/peer_enrollment_registry.json` themselves via Electron's `app.getPath('userData')`
 * (mirroring ed25519_keypair.ts's own storage location, one directory up); every test in this
 * dispatch (peer_enrollment_registry.test.ts, enroll_peer_order.test.ts, and the new
 * peer_server/constellation_discovery gate test files) passes an explicit scratch path under
 * `os.tmpdir()` instead. This file never imports `electron` and never can silently touch a real
 * peer's trust root.
 *
 * RULE 66. writeEnrollment() copies any existing registry file to a `.superseded.<UTC>.json`
 * sibling before every overwrite, exactly like APPLY_ENROLL_ORDER.mjs already does for
 * known_peers.json (BISHOP_DROPZONE\APPLY_ENROLL_ORDER.mjs, D-BP202-BM01-006) -- the same
 * discipline, now inside the shipped TypeScript module instead of only in a one-off script.
 */

import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export interface EnrolledPeerRecord {
  peer_id: string;
  public_key_hex: string;
  key_id: string;
  enrolled_at: string;
  /** Free-text provenance -- which order/nonce authorized this entry. Audit only, never parsed. */
  source: string;
  /** D-BP223-BM0-X030-067: the PERSON-level owner id (LB email hash, lowercase hex) this peer belongs to, written only by
   *  a TOTP-gated enrollment order that carried it. Absent on older records = owner unknown = never same-owner. */
  owner_id?: string;
}

export type PeerEnrollmentRegistry = Record<string, EnrolledPeerRecord>;

/**
 * Fail-closed: a missing, empty, or unparsable file is an EMPTY registry (nobody enrolled yet --
 * the expected state on every machine before the Founder ever runs enroll-peer), never an error
 * silently upgraded into "trust everyone." Never throws.
 */
export function loadPeerEnrollmentRegistry(registryPath: string): PeerEnrollmentRegistry {
  try {
    if (!existsSync(registryPath)) return {};
    const parsed: unknown = JSON.parse(readFileSync(registryPath, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as PeerEnrollmentRegistry;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * THE one authoritative lookup every gate function this dispatch wires into peer_server.ts and
 * constellation_discovery.ts calls. Returns `null` for anything not enrolled -- callers MUST
 * treat `null` as "refuse" or "fall through to a clearly-labeled weaker check," never silently
 * substitute a different key.
 */
export function lookupEnrolledPeerPublicKey(registryPath: string, peerId: string): string | null {
  const reg = loadPeerEnrollmentRegistry(registryPath);
  return reg[peerId]?.public_key_hex ?? null;
}

/** D-BP223-BM0-X030-067: the owner_id bound to an enrolled peer, or null (not enrolled, or enrolled without an owner). */
export function lookupEnrolledPeerOwnerId(registryPath: string, peerId: string): string | null {
  const rec = loadPeerEnrollmentRegistry(registryPath)[peerId];
  if (!rec || !rec.public_key_hex) return null;
  const o = typeof rec.owner_id === 'string' ? rec.owner_id.trim().toLowerCase() : '';
  return /^[0-9a-f]{16,64}$/.test(o) ? o : null;
}

export function isPeerEnrolled(registryPath: string, peerId: string): boolean {
  return lookupEnrolledPeerPublicKey(registryPath, peerId) !== null;
}

/**
 * Rule 66: an existing registry file is copied to a `.superseded.<UTC>.json` sibling BEFORE any
 * overwrite. Called ONLY from enroll_peer_order.ts's verifyAndApplyEnrollPeerOrder() after ITS
 * OWN gate (a verified GatedOrder plus the enrollment-binding signature) has already passed --
 * this function performs no authorization check of its own and must never be called directly
 * from any live dispatch path.
 */
export function writeEnrollment(registryPath: string, record: EnrolledPeerRecord): void {
  mkdirSync(dirname(registryPath), { recursive: true });
  if (existsSync(registryPath)) {
    const ts = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    const sib = registryPath.replace(/\.json$/, `.superseded.${ts}.json`);
    copyFileSync(registryPath, sib);
  }
  const reg = loadPeerEnrollmentRegistry(registryPath);
  reg[record.peer_id] = record;
  writeFileSync(registryPath, JSON.stringify(reg, null, 2), 'utf8');
}
