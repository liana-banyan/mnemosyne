// purpose_receipt_store.ts -- D-BP154-041/BISHOP-SEG/S41/seg-purpose, PART 1/3
//
// FD-BP154-16: "Purpose enters the receipt store at stratum sand (FD-BP154-09) so it can be
// affirmed or refuted across runs." Same shape/discipline measurement_receipts.ts's own
// MeasurementReceipt already establishes for FD-BP154-15's speed/cost/accuracy receipts: a
// content-hashed, append-only (Rule 66) JSONL eblet, sand stratum, matriculating under FD-BP154-09's
// ALREADY-RATIFIED criteria through the SAME strata_promote pipeline every other eblet in this
// estate uses -- this file mints the sand-stratum record only and builds no second promotion
// mechanism.
//
// WHY A SEPARATE STORE FROM composer_claims_store.ts. That store's ComposerStepClassificationWithKey
// shape (PROVEN/CORROBORATED/ANSWERED/ABSTAIN) answers "how well-evidenced is this ANSWER", a
// question Purpose:1 does not answer -- it never eliminates an option or names a verdict letter.
// Forcing a purpose receipt through that classifier would be a category error, not a reuse. This
// mirrors composer_claims_store.ts's own header reasoning for why IT is a separate ledger from
// evidence_store.ts (HARDWIRE-08 pinned).

import { createHash } from 'node:crypto';
import {
  appendFileSync, existsSync, mkdirSync, readFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { resolveEvidenceDir } from '../evidence/evidence_store';
import type { PurposeResult } from './purpose_step';

export interface PurposeReceipt {
  schema: 'liana-purpose-receipt/1';
  /** Content hash of every OTHER field. */
  id: string;
  stratum: 'sand';
  qid: number | null;
  acquisitionId: string;
  purposeType: string;
  ok: boolean;
  candidates: Array<{ id: string; source: string; statement: string; span: string }>;
  survivors: Array<{ id: string; source: string; statement: string; span: string }>;
  eliminated: Array<{ candidateId: string; reason: string }>;
  error: string | null;
  recordedAt: string;
}

function canonicalStringify(value: unknown): string {
  const walk = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(walk);
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) out[k] = walk((v as Record<string, unknown>)[k]);
    return out;
  };
  return JSON.stringify(walk(value));
}

function contentHash(value: unknown): string {
  return createHash('sha256').update(canonicalStringify(value)).digest('hex');
}

function fileForToday(dir: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return join(dir, `PURPOSE_RECEIPTS_${day}.jsonl`);
}

/** THE ONE PLACE a purpose receipt is minted and written. Append-only (Rule 66) -- same discipline
 *  as mintMeasurementReceipt() (measurement_receipts.ts). A write failure here must never fail the
 *  step it describes -- caught and swallowed by the caller (purpose_step.ts's runPurposeStep()),
 *  same as every other instrumentation-only write in this estate. */
export function mintPurposeReceipt(
  qid: number | null,
  acquisitionId: string,
  result: PurposeResult,
  dir?: string,
): PurposeReceipt {
  const base = {
    schema: 'liana-purpose-receipt/1' as const,
    stratum: 'sand' as const,
    qid,
    acquisitionId,
    purposeType: result.purposeType,
    ok: result.ok,
    candidates: result.candidates.map((c) => ({
      id: c.id, source: c.source, statement: c.statement, span: c.span,
    })),
    survivors: result.survivors.map((c) => ({
      id: c.id, source: c.source, statement: c.statement, span: c.span,
    })),
    eliminated: result.eliminated.map((e) => ({ candidateId: e.candidate.id, reason: e.reason })),
    error: result.error ?? null,
    recordedAt: new Date().toISOString(),
  };
  const receipt: PurposeReceipt = { ...base, id: contentHash(base) };
  const d = dir || resolveEvidenceDir();
  try {
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
    appendFileSync(fileForToday(d), `${JSON.stringify(receipt)}\n`, 'utf8');
  } catch {
    // Instrumentation failure only -- never fails the step it describes (caller also catches, this
    // is defense in depth against a partially-writable directory).
  }
  return receipt;
}

/** Reads every purpose receipt written for one calendar day (UTC). A malformed line is skipped and
 *  counted, never silently dropped -- same discipline measurement_receipts.ts's own
 *  loadMeasurementReceipts() already applies. */
export function loadPurposeReceipts(
  day: string, dir?: string,
): { records: PurposeReceipt[]; malformedLines: number } {
  const d = dir || resolveEvidenceDir();
  const path = join(d, `PURPOSE_RECEIPTS_${day}.jsonl`);
  if (!existsSync(path)) return { records: [], malformedLines: 0 };
  const lines = readFileSync(path, 'utf8').split('\n').filter((l) => l.trim().length > 0);
  const records: PurposeReceipt[] = [];
  let malformedLines = 0;
  for (const line of lines) {
    try {
      records.push(JSON.parse(line) as PurposeReceipt);
    } catch {
      malformedLines += 1;
    }
  }
  return { records, malformedLines };
}
