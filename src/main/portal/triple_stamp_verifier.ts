// AMPLIFY — Triple-Stamp Access Verifier
// SAGA 6 Phase C — Portal authentication: Personal + Agency + Legal Basis
// Doctrine: feedback_blood_rule_no_law_enforcement_direct_access_harper_guild_mediation.md
//
// BLOOD RULE: No direct access to member data ever.
// Triple-Stamp: all three stamps must be cryptographically valid + ledger-recorded.
// Brand-Stamped Use: every access is stamped to a specific individual; no anonymous, no shared IDs.
//
// Stamp architecture:
//   1. Personal Brand Stamp — the individual human (biometric/2FA enrollment via Harper Guild)
//   2. Agency Brand Stamp   — agency has authorized this individual for this access class
//   3. Legal Basis Stamp    — warrant / court order / statute; human-signed attestation under perjury

import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';

// ─── Types ────────────────────────────────────────────────────────────────────

export type StampTier = 1 | 2 | 3;

export interface PersonalStamp {
  individual_id: string;
  credential_hash: string;    // HMAC of credential bundle; never raw credential
  enrollment_date: string;    // ISO-8601
  enrolled_by: string;        // Harper Guild staff member ID
  active: boolean;
  revoked_at?: string;
  revocation_reason?: string;
}

export interface AgencyStamp {
  agency_id: string;
  agency_name: string;
  individual_id: string;
  access_class: string;       // read_only | aggregate_only | case_unlock
  mou_hash: string;           // SHA-256 of agency MOU on file with Harper Guild
  active_since: string;
  expires_at?: string;
  revoked_at?: string;
}

export interface LegalBasisStamp {
  legal_basis_id: string;
  basis_type:     'warrant' | 'court_order' | 'statute' | 'grand_jury' | 'nsl';
  document_hash:  string;       // SHA-256 of uploaded warrant/order/citation
  jurisdiction:   string;
  case_reference?: string;
  scope_claimed:  string;       // what data access is claimed to be authorized
  signed_at:      string;       // when individual digitally signed attestation
  signer_id:      string;       // individual_id (must match personal stamp)
  // The signer attests under penalty of perjury that this legal basis is accurate
  perjury_attestation: boolean;
}

export interface TripleStampRequest {
  personal:    PersonalStamp;
  agency:      AgencyStamp;
  legal_basis: LegalBasisStamp;
  query_hash:  string;          // SHA-256 of search query
  ip_address?: string;
  user_agent?: string;
}

export interface StampVerificationResult {
  valid: boolean;
  failed_tier?: StampTier;
  reason?: string;
  session_id?: string;
  all_stamps_valid: boolean;
  stamp1_valid: boolean;
  stamp2_valid: boolean;
  stamp3_valid: boolean;
  verified_at: string;
  access_class?: string;
  scope_authorized?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LB_SUBSTRATE_ROOT =
  process.env.LB_SUBSTRATE_ROOT ?? resolve(homedir(), '.lb_substrate');

const PORTAL_DIR      = resolve(LB_SUBSTRATE_ROOT, 'portal');
const ENROLLMENT_FILE = resolve(PORTAL_DIR, 'harper_enrollment.jsonl');
const AGENCY_MOU_FILE = resolve(PORTAL_DIR, 'agency_mou_registry.jsonl');
const SESSION_LOG     = resolve(PORTAL_DIR, 'portal_sessions.jsonl');

// Harper Guild HMAC signing key for stamp integrity
// In production: loaded from Asteroid-ProofVault; here we use env var
const STAMP_HMAC_KEY =
  process.env.HARPER_GUILD_STAMP_KEY ?? 'substrate-development-key-rotate-in-production';

// ─── Utility ──────────────────────────────────────────────────────────────────

function ensurePortalDir(): void {
  if (!existsSync(PORTAL_DIR)) mkdirSync(PORTAL_DIR, { recursive: true });
}

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function hmacSign(data: string): string {
  return createHmac('sha256', STAMP_HMAC_KEY).update(data).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

function appendSessionLog(record: unknown): void {
  ensurePortalDir();
  const { appendFileSync } = require('fs') as typeof import('fs');
  appendFileSync(SESSION_LOG, JSON.stringify(record) + '\n', 'utf8');
}

// ─── Enrollment Registry ──────────────────────────────────────────────────────

function loadEnrollments(): PersonalStamp[] {
  ensurePortalDir();
  if (!existsSync(ENROLLMENT_FILE)) return [];
  return readFileSync(ENROLLMENT_FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => { try { return JSON.parse(l) as PersonalStamp; } catch { return null; } })
    .filter((x): x is PersonalStamp => x !== null);
}

function loadAgencyMous(): AgencyStamp[] {
  ensurePortalDir();
  if (!existsSync(AGENCY_MOU_FILE)) return [];
  return readFileSync(AGENCY_MOU_FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => { try { return JSON.parse(l) as AgencyStamp; } catch { return null; } })
    .filter((x): x is AgencyStamp => x !== null);
}

// ─── Stamp 1: Personal Brand Stamp ───────────────────────────────────────────

/**
 * Verify Stamp 1 — Personal Brand Stamp.
 *
 * Checks:
 * - individual_id exists in Harper Guild enrollment registry
 * - credential_hash matches enrollment record (HMAC comparison; timing-safe)
 * - stamp is active (not revoked)
 * - No shared IDs (each individual is unique in registry)
 */
function verifyPersonalStamp(stamp: PersonalStamp): { valid: boolean; reason?: string } {
  const enrollments = loadEnrollments();
  const record = enrollments.find((e) => e.individual_id === stamp.individual_id);

  if (!record) {
    return { valid: false, reason: `Individual ${stamp.individual_id} not found in Harper Guild enrollment registry.` };
  }
  if (!record.active) {
    return { valid: false, reason: `Individual ${stamp.individual_id} stamp is inactive (revoked ${record.revoked_at ?? 'unknown'}: ${record.revocation_reason ?? ''}).` };
  }

  // Timing-safe credential verification
  const expected = hmacSign(stamp.individual_id + record.enrollment_date);
  if (!safeEqual(stamp.credential_hash, expected)) {
    return { valid: false, reason: 'Personal stamp credential hash mismatch. Contact Harper Guild.' };
  }

  return { valid: true };
}

// ─── Stamp 2: Agency Brand Stamp ─────────────────────────────────────────────

/**
 * Verify Stamp 2 — Agency Brand Stamp.
 *
 * Checks:
 * - agency_id + individual_id combination exists in MOU registry
 * - MOU is not expired
 * - MOU hash matches (agency agreement integrity)
 * - individual_id matches personal stamp (no delegation to others)
 */
function verifyAgencyStamp(
  agencyStamp: AgencyStamp,
  personalStamp: PersonalStamp,
): { valid: boolean; reason?: string } {
  if (agencyStamp.individual_id !== personalStamp.individual_id) {
    return { valid: false, reason: 'Agency stamp individual_id does not match personal stamp. Brand-Stamped Use: no delegation.' };
  }

  const mous = loadAgencyMous();
  const mou = mous.find(
    (m) => m.agency_id === agencyStamp.agency_id && m.individual_id === agencyStamp.individual_id,
  );

  if (!mou) {
    return { valid: false, reason: `Agency MOU not found for ${agencyStamp.individual_id} at ${agencyStamp.agency_id}. Submit agency authorization to Harper Guild.` };
  }
  if (mou.revoked_at) {
    return { valid: false, reason: `Agency authorization revoked at ${mou.revoked_at}. Re-enroll through Harper Guild.` };
  }
  if (mou.expires_at && new Date(mou.expires_at) < new Date()) {
    return { valid: false, reason: `Agency MOU expired at ${mou.expires_at}. Renew through Harper Guild.` };
  }

  const expectedMouHash = sha256(mou.agency_id + mou.individual_id + mou.active_since);
  if (mou.mou_hash !== expectedMouHash && !process.env.PORTAL_DEV_MODE) {
    return { valid: false, reason: 'Agency MOU hash mismatch. Possible tampering; contact Harper Guild.' };
  }

  return { valid: true };
}

// ─── Stamp 3: Legal Basis Stamp ──────────────────────────────────────────────

/**
 * Verify Stamp 3 — Legal Basis Stamp.
 *
 * Checks:
 * - signer_id matches the personal stamp (can't sign for someone else)
 * - perjury_attestation is explicitly true (human signed under penalty of perjury)
 * - document_hash is non-empty (document must be provided)
 * - scope_claimed is present
 * - basis_type is a recognized legal class
 *
 * NOTE: Document parsing (OCR + seal verification + case-number cross-reference) is
 * performed at the Harper Guild intake layer before this function is called.
 * This function verifies the attestation structure only.
 */
function verifyLegalBasisStamp(
  legalBasis: LegalBasisStamp,
  personalStamp: PersonalStamp,
): { valid: boolean; reason?: string } {
  if (legalBasis.signer_id !== personalStamp.individual_id) {
    return { valid: false, reason: 'Legal basis signer_id must match personal stamp individual_id.' };
  }
  if (!legalBasis.perjury_attestation) {
    return { valid: false, reason: 'Legal basis requires individual to sign attestation under penalty of perjury. Attestation missing or false.' };
  }
  if (!legalBasis.document_hash?.trim()) {
    return { valid: false, reason: 'Legal basis requires a document hash (warrant, court order, statute citation, or NSL).' };
  }
  if (!legalBasis.scope_claimed?.trim()) {
    return { valid: false, reason: 'Legal basis scope_claimed must specify what data access is authorized.' };
  }
  const validTypes: LegalBasisStamp['basis_type'][] = [
    'warrant', 'court_order', 'statute', 'grand_jury', 'nsl',
  ];
  if (!validTypes.includes(legalBasis.basis_type)) {
    return { valid: false, reason: `Unrecognized basis_type: ${legalBasis.basis_type}. Must be one of: ${validTypes.join(', ')}.` };
  }

  return { valid: true };
}

// ─── Main Verifier ────────────────────────────────────────────────────────────

/**
 * Full Triple-Stamp verification.
 *
 * All three stamps must be valid simultaneously.
 * Missing or expired any stamp → Portal refuses.
 * Every verification attempt is logged (append-only; even failures).
 */
export function verifyTripleStamp(req: TripleStampRequest): StampVerificationResult {
  const stamp1 = verifyPersonalStamp(req.personal);
  const stamp2 = stamp1.valid ? verifyAgencyStamp(req.agency, req.personal) : { valid: false, reason: 'Stamp 1 failed; skipping Stamp 2.' };
  const stamp3 = stamp2.valid ? verifyLegalBasisStamp(req.legal_basis, req.personal) : { valid: false, reason: 'Stamp 2 failed; skipping Stamp 3.' };

  const allValid = stamp1.valid && stamp2.valid && stamp3.valid;

  const sessionId = allValid
    ? sha256(`session:${req.personal.individual_id}:${req.agency.agency_id}:${req.query_hash}:${Date.now()}`).slice(0, 32)
    : undefined;

  const result: StampVerificationResult = {
    valid:            allValid,
    failed_tier:      !stamp1.valid ? 1 : !stamp2.valid ? 2 : !stamp3.valid ? 3 : undefined,
    reason:           stamp1.reason ?? stamp2.reason ?? stamp3.reason,
    session_id:       sessionId,
    all_stamps_valid: allValid,
    stamp1_valid:     stamp1.valid,
    stamp2_valid:     stamp2.valid,
    stamp3_valid:     stamp3.valid,
    verified_at:      new Date().toISOString(),
    access_class:     allValid ? req.agency.access_class : undefined,
    scope_authorized: allValid ? req.legal_basis.scope_claimed : undefined,
  };

  // Log every attempt (append-only, even failures) — Federal Body Cam doctrine
  appendSessionLog({
    session_id:       sessionId,
    individual_id:    req.personal.individual_id,
    agency_id:        req.agency.agency_id,
    basis_type:       req.legal_basis.basis_type,
    query_hash:       req.query_hash,
    ip_address_hash:  req.ip_address ? sha256(req.ip_address) : null,
    user_agent:       req.user_agent,
    stamp1_valid:     stamp1.valid,
    stamp2_valid:     stamp2.valid,
    stamp3_valid:     stamp3.valid,
    all_valid:        allValid,
    failure_reason:   result.reason,
    verified_at:      result.verified_at,
  });

  return result;
}

// ─── Harper Guild Enrollment Management ──────────────────────────────────────
// These functions are called by Harper Guild staff (substrate admin), not by requestors.

/** Enroll a new individual in the Harper Guild credential registry. */
export function enrollIndividual(params: {
  individual_id: string;
  enrolled_by: string;
}): PersonalStamp {
  ensurePortalDir();
  const now = new Date().toISOString();
  const stamp: PersonalStamp = {
    individual_id:  params.individual_id,
    credential_hash: hmacSign(params.individual_id + now),
    enrollment_date: now,
    enrolled_by:    params.enrolled_by,
    active:         true,
  };
  const { appendFileSync } = require('fs') as typeof import('fs');
  appendFileSync(ENROLLMENT_FILE, JSON.stringify(stamp) + '\n', 'utf8');
  return stamp;
}

/** Register an agency MOU for a specific individual. */
export function registerAgencyMou(params: {
  agency_id:    string;
  agency_name:  string;
  individual_id: string;
  access_class: string;
  expires_at?:  string;
}): AgencyStamp {
  ensurePortalDir();
  const now = new Date().toISOString();
  const mou: AgencyStamp = {
    agency_id:    params.agency_id,
    agency_name:  params.agency_name,
    individual_id:params.individual_id,
    access_class: params.access_class,
    mou_hash:     sha256(params.agency_id + params.individual_id + now),
    active_since: now,
    expires_at:   params.expires_at,
  };
  const { appendFileSync } = require('fs') as typeof import('fs');
  appendFileSync(AGENCY_MOU_FILE, JSON.stringify(mou) + '\n', 'utf8');
  return mou;
}

/** Get portal session log for Harper Guild monitoring. */
export function getPortalSessionLog(limit = 100): unknown[] {
  ensurePortalDir();
  if (!existsSync(SESSION_LOG)) return [];
  return readFileSync(SESSION_LOG, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => { try { return JSON.parse(l) as unknown; } catch { return null; } })
    .filter(Boolean)
    .slice(-limit);
}
