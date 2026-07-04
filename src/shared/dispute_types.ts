// SEG-5 v0.1.56 — Provisional Dispute Submission types
// Infrastructure-only type layer; no migrations run.
// Full provisional filing data lives in genesis_mint_exec.ts / ip_ledger_store.ts.
// This module provides a unified submission shape for UI and future API routes.

// ─── Provisional metadata ─────────────────────────────────────────────────────

export type ProvNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21;

export interface ProvisionalRef {
  /** Provisional application number (1–21) */
  prov_number: ProvNumber;
  /** Docket label e.g. "PROV-001" */
  docket: string;
  /** Official filing title — required for Provs 1–11 dispute resolution */
  title: string;
  /**
   * Filing date (ISO-8601).
   * Mandatory for Provs 10, 11, 12 which had date ambiguities requiring correction.
   */
  filing_date: string;
  /** Optional application number assigned by patent office */
  app_number?: string;
  /** Optional confirmation number */
  conf?: string;
}

// ─── Dispute submission ───────────────────────────────────────────────────────

export type DisputeBodyKind =
  | 'title_correction'    // wrong title filed for provisional
  | 'date_correction'     // wrong filing date recorded
  | 'claim_correction'    // claim text error
  | 'attribution_error'   // wrong registered_by member
  | 'other';

export interface ProvisionalDisputeSubmission {
  /** Member submitting the dispute (cooperative-substrate member_id ONLY — never real name) */
  submitted_by: string;
  /** Which provisional application(s) this dispute covers */
  provisionals: ProvisionalRef[];
  /** Nature of the dispute */
  kind: DisputeBodyKind;
  /** Human-readable description of the error and the correct information */
  body: string;
  /** Supporting evidence references (ledger IDs, file paths, receipt hashes) */
  evidence: string[];
  /** Detective + Counsel adjudicator IDs (minimum 2 required per ip_ledger doctrine) */
  adjudicators: string[];
  /** ISO-8601 timestamp of submission */
  submitted_at: string;
}

// ─── Convenience: blank submission factory ───────────────────────────────────

export function blankProvisionalDispute(submittedBy: string): ProvisionalDisputeSubmission {
  return {
    submitted_by: submittedBy,
    provisionals: [],
    kind: 'title_correction',
    body: '',
    evidence: [],
    adjudicators: [],
    submitted_at: new Date().toISOString(),
  };
}
