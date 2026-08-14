// composer_claims_store.ts -- D-BP154-017/BISHOP-SEG/S17/seg-classify
//
// THE PERSISTENCE GAP THIS TICKET CLOSES (BISHOP_DROPZONE\THE_PAIL_BP154.md STAGE 4/dispatch
// D-BP154-017): "Acquisition id, timestamp, verbatim query and document URL already persist in
// HARDWIRE\LEDGER\LIANA_EVIDENCE\*.jsonl. The mechanism tag and the verbatim corroborating span do
// NOT -- computed transiently, discarded at run end." A click on an OLD acquisition's step result
// needs the classification/mechanism/span that produced it, and those exist today only in the
// in-memory ComposerStepOutcome.raw object handed back over IPC for the CURRENT run -- gone the
// moment the renderer state clears or the app restarts.
//
// DELIBERATELY NOT A CHANGE TO evidence_store.ts. That file's EvidenceRecord shape and
// `EvidenceAuthority = 'google' | 'conversational'` union are HARDWIRE-08 pinned (its own header:
// "before changing a character of this function", and evidence_store.crystal_conformance.test.ts
// pins its recipe against crystal_store.ts) and read by cross_acquisition.ts, a LOCKED commit
// (D-BP154-008, 7d001cff) this ticket may not touch. A composer step's classification is a
// DERIVED fact about a claim (which options were excluded/included/kind-typed, by which
// mechanism, with which corroborating span) -- a different kind of record from "authority X was
// asked query Y and got response Z" that the evidence store already owns. This file adds a
// SEPARATE, parallel, append-only ledger (same directory, same dependency on evidence_store.ts's
// own resolveEvidenceDir() -- imported read-only, never modified) rather than widening a pinned
// schema to carry a second kind of fact. `evidence_store.ts` itself is not imported for
// anything but that one path-resolution helper.
//
// APPEND-ONLY, SAME DISCIPLINE AS evidence_store.ts's appendEvidence(): no update, no delete, no
// handle capable of rewriting a line. A write failure here is caught by the caller
// (script_bridge.ts) and never allowed to fail the step it describes -- persisting the
// classification is additive instrumentation, not a gate on the run.

import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveEvidenceDir } from '../evidence/evidence_store';
import type { ComposerStepClass } from '../../../shared/composer_step_classification';

export interface ComposerClaimRecord {
  schema: 'liana-composer-claim/1';
  qid: number | null;
  acquisitionId: string;
  stepId: string;
  ts: string;
  ok: boolean;
  classification: ComposerStepClass;
  classificationDetail: string;
  /** The step's own query text, verbatim -- lets a later reader tie this claim back to the
   *  matching EvidenceRecord in EVIDENCE_*.jsonl by query text without a second key scheme. */
  query: string | null;
  mechanism: string | null;
  sourceId: string | null;
  mechanismDetail: string | null;
  corroboration: {
    attempted: boolean;
    corroborated: boolean;
    sourceUrl: string | null;
    sourceTitle: string | null;
    span: string | null;
  } | null;
}

function slugFor(qid: number | null): string {
  return qid != null ? `qid${qid}` : 'free-text';
}

function fileFor(dir: string, qid: number | null, acquisitionId: string): string {
  return join(dir, `CLAIMS_${slugFor(qid)}_${acquisitionId}.jsonl`);
}

/** Appends one composer-step claim record. Returns the record so the caller (script_bridge.ts)
 *  can report what it wrote, same shape as evidence_store.ts's appendEvidence(). Throws on a real
 *  filesystem failure -- the caller wraps this in try/catch and never lets a write failure here
 *  fail the step it describes (this is instrumentation, not a gate). */
export function appendComposerClaim(input: {
  qid: number | null;
  acquisitionId: string;
  stepId: string;
  ts: string;
  ok: boolean;
  classification: ComposerStepClass;
  classificationDetail: string;
  query: string | null;
  mechanism: string | null;
  sourceId: string | null;
  mechanismDetail: string | null;
  corroboration: ComposerClaimRecord['corroboration'];
  dir?: string;
}): ComposerClaimRecord {
  const dir = input.dir || resolveEvidenceDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const record: ComposerClaimRecord = {
    schema: 'liana-composer-claim/1',
    qid: input.qid,
    acquisitionId: input.acquisitionId,
    stepId: input.stepId,
    ts: input.ts,
    ok: input.ok,
    classification: input.classification,
    classificationDetail: input.classificationDetail,
    query: input.query,
    mechanism: input.mechanism,
    sourceId: input.sourceId,
    mechanismDetail: input.mechanismDetail,
    corroboration: input.corroboration,
  };
  appendFileSync(fileFor(dir, input.qid, input.acquisitionId), `${JSON.stringify(record)}\n`, 'utf8');
  return record;
}

/** Reads every claim record written for one acquisition. A malformed line is skipped and counted,
 *  never silently dropped -- same discipline as evidence_store.ts's own loadAcquisition(). */
export function loadComposerClaims(
  qid: number | null,
  acquisitionId: string,
  dir?: string,
): { records: ComposerClaimRecord[]; malformedLines: number } {
  const d = dir || resolveEvidenceDir();
  const path = fileFor(d, qid, acquisitionId);
  if (!existsSync(path)) return { records: [], malformedLines: 0 };
  const lines = readFileSync(path, 'utf8').split('\n').filter((l) => l.trim().length > 0);
  const records: ComposerClaimRecord[] = [];
  let malformedLines = 0;
  for (const line of lines) {
    try {
      records.push(JSON.parse(line) as ComposerClaimRecord);
    } catch {
      malformedLines += 1;
    }
  }
  return { records, malformedLines };
}

/** Every acquisition id this ledger has a claims file for, for one qid -- mirrors evidence_store.
 *  ts's listAcquisitions() shape (same sort, same read-only readdirSync). */
export function listComposerClaimAcquisitions(qid: number | null, dir?: string): string[] {
  const d = dir || resolveEvidenceDir();
  if (!existsSync(d)) return [];
  const prefix = `CLAIMS_${slugFor(qid)}_`;
  return readdirSync(d)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.jsonl'))
    .map((f) => f.slice(prefix.length, -'.jsonl'.length))
    .sort();
}
