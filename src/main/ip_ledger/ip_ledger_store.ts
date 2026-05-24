// AMPLIFY — IP Ledger Store (local JSONL substrate, offline-first)
// SAGA 6 Phase B — Append-only ledger at ~/.lb_substrate/ip_ledger/ledger.jsonl
// Doctrine: project_ip_ledger_correction_branch_supersedes_pattern_bp041.md
//
// Federal Body Cam doctrine: entries are ALWAYS recorded, NEVER updated, NEVER deleted.
// Supersedes-chain enables correction without erasure.
// BLOOD RULE: registered_by = cooperative-substrate member_id ONLY; never real-name.

import {
  existsSync,
  mkdirSync,
  appendFileSync,
  readFileSync,
} from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';
import { randomUUID, createHash } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LedgerEntryType =
  | 'registration'
  | 'correction'
  | 'supersession_marker'
  | 'adjudication';

export type LedgerStatus = 'active' | 'superseded' | 'disputed';

export type SupersedesReason =
  | 'ip_theft_proven'
  | 'honest_mistake'
  | 'prior_art_discovered'
  | 'misattribution';

export type LedgerCategory =
  | 'innovation'
  | 'crown'
  | 'paper'
  | 'provisional'
  | 'sub-panel'
  | 'portal_search'
  | 'plugin'
  | 'correction'
  | 'other';

export interface IpLedgerEntry {
  ledger_id: string;
  type: LedgerEntryType;
  registered_at: string;
  /** BLOOD RULE: cooperative-substrate member_id ONLY; never real-name */
  registered_by: string;
  claim: string;
  claim_body?: string;
  evidence: string[];
  category: LedgerCategory;
  supersedes?: string | null;
  superseded_by?: string | null;
  supersedes_reason?: SupersedesReason | null;
  adjudicators: string[];
  adjudication_evidence: string[];
  status: LedgerStatus;
}

export interface DisputeRequest {
  /** Member submitting the correction */
  submitted_by: string;
  claim: string;
  claim_body?: string;
  evidence: string[];
  supersedes: string;
  supersedes_reason: SupersedesReason;
  /** Detective + Counsel adjudicator IDs (minimum 2 required) */
  adjudicators: string[];
  adjudication_evidence: string[];
}

export interface OwnerResult {
  claim: string;
  owner: string;
  ledger_id: string;
  registered_at: string;
  status: LedgerStatus;
  has_correction: boolean;
  correction_chain_depth: number;
}

export interface HistoryResult {
  claim: string;
  entries: IpLedgerEntry[];
  canonical_owner: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LB_SUBSTRATE_ROOT =
  process.env.LB_SUBSTRATE_ROOT ?? resolve(homedir(), '.lb_substrate');

const LEDGER_DIR  = resolve(LB_SUBSTRATE_ROOT, 'ip_ledger');
const LEDGER_FILE = resolve(LEDGER_DIR, 'ledger.jsonl');

const MAX_CHAIN_DEPTH = 32; // prevent infinite loops in malformed data

// ─── Store Implementation ─────────────────────────────────────────────────────

function ensureLedgerDir(): void {
  if (!existsSync(LEDGER_DIR)) mkdirSync(LEDGER_DIR, { recursive: true });
}

/** SHA-256 shorthand for ledger_id generation. */
function shortHash(data: string): string {
  return createHash('sha256').update(data).digest('hex').slice(0, 16);
}

/**
 * Load all entries from the local JSONL ledger.
 * Returns entries in append order (oldest first).
 */
export function loadAllEntries(): IpLedgerEntry[] {
  ensureLedgerDir();
  if (!existsSync(LEDGER_FILE)) return [];
  const raw = readFileSync(LEDGER_FILE, 'utf8');
  const entries: IpLedgerEntry[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed) as IpLedgerEntry);
    } catch {
      // Skip malformed lines (tamper detection; log but continue)
      console.warn('[ip_ledger] malformed entry skipped');
    }
  }
  return entries;
}

/**
 * Append a single entry to the ledger (append-only; no UPDATE ever).
 * Federal Body Cam doctrine: every write is permanent.
 */
function appendEntry(entry: IpLedgerEntry): void {
  ensureLedgerDir();
  appendFileSync(LEDGER_FILE, JSON.stringify(entry) + '\n', 'utf8');
}

/**
 * Register a new IP claim.
 * Returns the ledger_id of the new entry.
 */
export function registerClaim(params: {
  registered_by: string;
  claim: string;
  claim_body?: string;
  evidence?: string[];
  category?: LedgerCategory;
}): IpLedgerEntry {
  const entry: IpLedgerEntry = {
    ledger_id:            `ipl_${shortHash(params.claim + params.registered_by + Date.now())}`,
    type:                 'registration',
    registered_at:        new Date().toISOString(),
    registered_by:        params.registered_by,
    claim:                params.claim,
    claim_body:           params.claim_body,
    evidence:             params.evidence ?? [],
    category:             params.category ?? 'innovation',
    supersedes:           null,
    superseded_by:        null,
    supersedes_reason:    null,
    adjudicators:         [],
    adjudication_evidence:[],
    status:               'active',
  };
  appendEntry(entry);
  return entry;
}

/**
 * Submit a dispute / correction entry.
 *
 * Validates:
 * - supersedes target exists + is active
 * - adjudicators count >= 2
 * - evidence chain non-empty
 *
 * On success appends:
 * 1. correction entry (new canonical owner; status=active; supersedes=original)
 * 2. supersession_marker entry (backfills original ledger_id as superseded)
 *
 * Returns the correction entry ledger_id.
 */
export function submitDispute(req: DisputeRequest): {
  correction_id: string;
  marker_id: string;
  status: 'submitted' | 'rejected';
  reason?: string;
} {
  if (req.adjudicators.length < 2) {
    return { correction_id: '', marker_id: '', status: 'rejected', reason: 'Minimum 2 adjudicators required (Detective + Counsel or 2 peer reviewers).' };
  }
  if (!req.evidence.length) {
    return { correction_id: '', marker_id: '', status: 'rejected', reason: 'Evidence chain required for dispute submission.' };
  }

  const entries = loadAllEntries();
  const original = entries.find((e) => e.ledger_id === req.supersedes);
  if (!original) {
    return { correction_id: '', marker_id: '', status: 'rejected', reason: `Original entry ${req.supersedes} not found.` };
  }
  if (original.status === 'superseded') {
    return { correction_id: '', marker_id: '', status: 'rejected', reason: `Entry ${req.supersedes} is already superseded.` };
  }

  const correction: IpLedgerEntry = {
    ledger_id:             `ipl_${shortHash('correction' + req.supersedes + req.submitted_by + Date.now())}`,
    type:                  'correction',
    registered_at:         new Date().toISOString(),
    registered_by:         req.submitted_by,
    claim:                 req.claim,
    claim_body:            req.claim_body ?? original.claim_body,
    evidence:              req.evidence,
    category:              'correction',
    supersedes:            req.supersedes,
    superseded_by:         null,
    supersedes_reason:     req.supersedes_reason,
    adjudicators:          req.adjudicators,
    adjudication_evidence: req.adjudication_evidence,
    status:                'active',
  };
  appendEntry(correction);

  // Supersession marker — backfills the original entry as superseded (append-only; no UPDATE)
  const marker: IpLedgerEntry = {
    ledger_id:             `ipl_${shortHash('marker' + req.supersedes + correction.ledger_id)}`,
    type:                  'supersession_marker',
    registered_at:         new Date().toISOString(),
    registered_by:         'substrate',
    claim:                 original.claim,
    evidence:              [`supersedes:${req.supersedes}`, `correction:${correction.ledger_id}`],
    category:              'other',
    supersedes:            req.supersedes,
    superseded_by:         correction.ledger_id,
    supersedes_reason:     req.supersedes_reason,
    adjudicators:          req.adjudicators,
    adjudication_evidence: req.adjudication_evidence,
    status:                'superseded',
  };
  appendEntry(marker);

  return { correction_id: correction.ledger_id, marker_id: marker.ledger_id, status: 'submitted' };
}

/**
 * Walk the supersedes chain forward to find the canonical (current) owner.
 * Returns the latest active entry not pointed-to by a superseded_by reference.
 *
 * Query semantics (doctrine §Query):
 * 1. Find all registrations with claim == X and status == active
 * 2. Walk forward through any supersedes chains
 * 3. Return the LATEST entry whose status == active and not pointed to by superseded_by
 */
export function findOwner(claim: string): OwnerResult | null {
  const entries = loadAllEntries();
  const candidates = entries.filter(
    (e) => e.claim === claim && (e.type === 'registration' || e.type === 'correction'),
  );
  if (!candidates.length) return null;

  // Build a superseded_by map from supersession_markers
  const supersededMap = new Map<string, string>();
  for (const e of entries) {
    if (e.type === 'supersession_marker' && e.supersedes && e.superseded_by) {
      supersededMap.set(e.supersedes, e.superseded_by);
    }
  }

  // Walk chain from any active candidate that is not itself superseded
  let best: IpLedgerEntry | null = null;
  let depth = 0;
  for (const candidate of candidates) {
    if (supersededMap.has(candidate.ledger_id)) continue; // this one was superseded
    if (candidate.status !== 'active') continue;
    if (!best || new Date(candidate.registered_at) > new Date(best.registered_at)) {
      best = candidate;
    }
  }

  // Count correction chain depth
  if (best) {
    let cursor: string | undefined = best.supersedes ?? undefined;
    while (cursor && depth < MAX_CHAIN_DEPTH) {
      cursor = candidates.find((e) => e.ledger_id === cursor)?.supersedes ?? undefined;
      depth++;
    }
  }

  if (!best) return null;
  return {
    claim:                  best.claim,
    owner:                  best.registered_by,
    ledger_id:              best.ledger_id,
    registered_at:          best.registered_at,
    status:                 best.status,
    has_correction:         depth > 0,
    correction_chain_depth: depth,
  };
}

/**
 * Return full chronological history for a claim (all entry types).
 * Member-facing: renders supersession banners, adjudication badges, evidence links.
 */
export function getHistory(claim: string): HistoryResult {
  const entries = loadAllEntries();
  const relevant = entries.filter((e) => e.claim === claim);
  const canonical = findOwner(claim);
  return {
    claim,
    entries:        relevant,
    canonical_owner: canonical?.owner ?? null,
  };
}

/**
 * Append a portal_search entry to the IP Ledger.
 * Every Portal interaction is a first-class ledger event (Brand-Stamped Use).
 */
export function appendPortalSearchEntry(params: {
  stamped_individual_id: string;
  agency_id?: string;
  query_hash: string;
  legal_basis_ref?: string;
  result_scope: 'full' | 'aggregate' | 'none';
  stamp1_personal: boolean;
  stamp2_agency: boolean;
  stamp3_legal_basis: boolean;
  ip_address_hash?: string;
  user_agent?: string;
}): IpLedgerEntry {
  const entry: IpLedgerEntry = {
    ledger_id:             `ipl_portal_${shortHash(params.stamped_individual_id + params.query_hash + Date.now())}`,
    type:                  'registration',
    registered_at:         new Date().toISOString(),
    registered_by:         params.stamped_individual_id,
    claim:                 `portal_search:${params.query_hash}`,
    claim_body:            JSON.stringify({
      agency_id:          params.agency_id,
      query_hash:         params.query_hash,
      legal_basis_ref:    params.legal_basis_ref,
      result_scope:       params.result_scope,
      stamp1_personal:    params.stamp1_personal,
      stamp2_agency:      params.stamp2_agency,
      stamp3_legal_basis: params.stamp3_legal_basis,
      ip_address_hash:    params.ip_address_hash,
      user_agent:         params.user_agent,
    }),
    evidence:              [],
    category:              'portal_search',
    supersedes:            null,
    superseded_by:         null,
    supersedes_reason:     null,
    adjudicators:          [],
    adjudication_evidence: [],
    status:                'active',
  };
  appendEntry(entry);
  return entry;
}

/** Count total entries and active claims for transparency report. */
export function getLedgerStats(): {
  total_entries: number;
  active_claims: number;
  corrections: number;
  portal_searches: number;
  ledger_path: string;
} {
  const entries = loadAllEntries();
  return {
    total_entries:  entries.length,
    active_claims:  entries.filter((e) => e.status === 'active' && e.type === 'registration').length,
    corrections:    entries.filter((e) => e.type === 'correction').length,
    portal_searches:entries.filter((e) => e.category === 'portal_search').length,
    ledger_path:    LEDGER_FILE,
  };
}
