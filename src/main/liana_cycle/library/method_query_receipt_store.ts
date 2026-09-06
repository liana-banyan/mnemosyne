// method_query_receipt_store.ts -- D-BP164-M0-122/BISHOP-SEG-SILO/M0
//
// "we do need to record every time a query is run" -- Founder, BP164, relayed by BISHOP-M0 mid-
// dispatch, explicitly SEPARATE from the silo: "A QUERY RECORD IS NOT A SILO ENTRY... the silo
// holds durable facts/methods/algorithms; the query record is the audit trail of an execution."
//
// SAME SHAPE AS purpose_receipt_store.ts, NOT A NEW PATTERN. purpose_receipt_store.ts's own
// header states its own reasoning for this shape: "a content-hashed, append-only (Rule 66) JSONL
// eblet, sand stratum, matriculating under FD-BP154-09's ALREADY-RATIFIED criteria through the
// SAME strata_promote pipeline every other eblet in this estate uses." This file reuses that
// exact shape (content hash, `stratum: 'sand'`, one JSONL file per calendar day, malformed lines
// counted not dropped) for a DIFFERENT event: a method-silo query being run (a connector mint, a
// connector fetch, or a silo lookup) rather than a purpose-derivation step. Two different domains,
// same ratified receipt shape -- this is the reuse purpose_receipt_store.ts's own header describes
// measurement_receipts.ts already establishing, extended here rather than forked.
//
// WHAT THIS FILE IS NOT: it is not the silo (method_silo.ts, sibling in evidence/), and it carries
// no verdict/answer field -- only WHICH query ran, WHAT it resolved against (a demand kind / tag,
// never a specific answer), and WHETHER it succeeded.

import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveEvidenceDir } from '../evidence/evidence_store';

export type MethodQueryKind = 'connector_mint' | 'connector_fetch' | 'silo_mint' | 'silo_fetch';

export interface MethodQueryReceipt {
  schema: 'liana-method-query-receipt/1';
  id: string;
  stratum: 'sand';
  kind: MethodQueryKind;
  qid: number | null;
  demandKind: string | null;
  methodId: string | null;
  runId: string | null;
  dispatchId: string | null;
  ok: boolean;
  tokensEstimated: number | null;
  bytesFetched: number | null;
  withinBudget: boolean | null;
  reason: string | null;
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
  return join(dir, `METHOD_QUERY_RECEIPTS_${day}.jsonl`);
}

/** THE ONE PLACE a method-silo query receipt is minted and written -- mirrors
 *  purpose_receipt_store.ts's mintPurposeReceipt() exactly: a write failure here must never fail
 *  the query it describes. */
export function mintMethodQueryReceipt(
  input: {
    kind: MethodQueryKind;
    qid: number | null;
    demandKind: string | null;
    methodId: string | null;
    runId: string | null;
    dispatchId: string | null;
    ok: boolean;
    tokensEstimated?: number | null;
    bytesFetched?: number | null;
    withinBudget?: boolean | null;
    reason?: string | null;
  },
  dir?: string,
): MethodQueryReceipt {
  const base = {
    schema: 'liana-method-query-receipt/1' as const,
    stratum: 'sand' as const,
    kind: input.kind,
    qid: input.qid,
    demandKind: input.demandKind,
    methodId: input.methodId,
    runId: input.runId,
    dispatchId: input.dispatchId,
    ok: input.ok,
    tokensEstimated: input.tokensEstimated ?? null,
    bytesFetched: input.bytesFetched ?? null,
    withinBudget: input.withinBudget ?? null,
    reason: input.reason ?? null,
    recordedAt: new Date().toISOString(),
  };
  const receipt: MethodQueryReceipt = { ...base, id: contentHash(base) };
  const d = dir || resolveEvidenceDir();
  try {
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
    appendFileSync(fileForToday(d), `${JSON.stringify(receipt)}\n`, 'utf8');
  } catch {
    // Instrumentation failure only -- never fails the query it describes.
  }
  return receipt;
}

/** Reads every method-query receipt written for one calendar day (UTC). Malformed lines are
 *  skipped and counted, never silently dropped -- same discipline purpose_receipt_store.ts's own
 *  loadPurposeReceipts() applies. */
export function loadMethodQueryReceipts(
  day: string, dir?: string,
): { records: MethodQueryReceipt[]; malformedLines: number } {
  const d = dir || resolveEvidenceDir();
  const path = join(d, `METHOD_QUERY_RECEIPTS_${day}.jsonl`);
  if (!existsSync(path)) return { records: [], malformedLines: 0 };
  const lines = readFileSync(path, 'utf8').split('\n').filter((l) => l.trim().length > 0);
  const records: MethodQueryReceipt[] = [];
  let malformedLines = 0;
  for (const line of lines) {
    try {
      records.push(JSON.parse(line) as MethodQueryReceipt);
    } catch {
      malformedLines += 1;
    }
  }
  return { records, malformedLines };
}
