// ore_store.ts -- D-BP219-BM0-034/BM0/canonical-pipeline-ore-capture
//
// USE EVERY PART OF THE BUFFALO. Founder verbatim: "we don't throw that away, NONE OF IT.
// ... we KEEP all those bites of ORE to sift through for maybe emeralds or silver, or anything
// else we might need. We EBLET and TAG ALL OF IT." And on why: "EVERY STAGE of our process
// has provenance. That is what makes it true, or attributable wrongness."
//
// WHAT THIS FIXES (traced by D-BP219-BM0-033, canonical_pipeline.ts Stage 5/6):
//   LEAK ONE, the residue: runSaladin() returns { passed, challenged }. The caller discarded
//   `challenged` after only logging it -- fully materialized, never written anywhere.
//   LEAK TWO, the seventh: candidates that PASSED Saladin but ranked below postFurnaceCap
//   (default 6) were silently sliced off and dropped, with no path back at all. The Founder's
//   own words: gold burned along with the slag, purely for being seventh.
//
// This module is the ONE ore store both leaks write into, with the two classes kept distinct
// per the Founder's explicit instruction -- CHALLENGED (Saladin found a real weakness) must
// never be confused with CAPPED (passed Saladin, lost only to rank), because CAPPED is the
// more valuable class and must be findable on its own.
//
// STORAGE CHOICE: append-only JSONL under a directory keyed off LB_SUBSTRATE_ROOT's own
// established convention (src/main/ip_ledger/ip_ledger_store.ts: "local JSONL substrate,
// offline-first", `process.env.LB_SUBSTRATE_ROOT ?? resolve(homedir(), '.lb_substrate')`).
// This file follows that SAME pattern rather than the Electron-app-userData pattern used by
// kitchen_table/cook_events_store.ts, for two reasons: (1) canonical_pipeline.ts itself has no
// `electron` import today and this change must not add one just to find a directory, and (2) a
// substrate-root-relative path is trivially fixture-testable with no Electron mock required.
// Deliberately NOT under `dist` (a build output directory, wiped/regenerated, wrong place for
// anything meant to persist) and NOT hardcoded -- MNEM_ORE_DIR overrides it outright.
//
// HASH: socceriHash is IMPORTED, not reimplemented, from
// C:/Users/Administrator/Documents/LianaBanyanPlatform/BISHOP_DROPZONE/MIC_CHANNEL/
// mic_channel_crypto.js, exactly as this dispatch's own instruction requires ("REUSE IT. Do not
// write a second hash function."). That file lives outside this repo's src/ tree, so it is
// loaded with a runtime `require(<absolute path>)` (the same lazy-require-with-cast pattern
// already used in this same plow/ directory, see liana_cycle_runner.ts's `require('electron')
// as typeof import('electron')`), never a static `import`, so tsc's rootDir/module-resolution
// never has to reach outside src/main for a type it does not need.
//
// NO ANSWER KEY EVER ENTERS THIS STORE: buildOreRecord() below copies fields off a
// CandidateEblet by an explicit ALLOW-LIST (source, content, weight, sid, domain), never a
// `...spread`. CandidateEblet (specialist_adapters.ts) carries no answer/gold/option-letter
// field as of this dispatch, and this allow-list means one being added to the type later still
// could not silently start flowing into ore -- only these five named fields are ever read.

import { existsSync, mkdirSync, appendFileSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';

// ─── Reuse socceriHash, do not reimplement it ──────────────────────────────────

const MIC_CHANNEL_CRYPTO_PATH =
  'C:/Users/Administrator/Documents/LianaBanyanPlatform/BISHOP_DROPZONE/MIC_CHANNEL/mic_channel_crypto.js';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { socceriHash } = require(MIC_CHANNEL_CRYPTO_PATH) as {
  socceriHash: (payloadBytes: string | Buffer) => string;
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type OreClass = 'CHALLENGED' | 'CAPPED';

/** The minimal shape ore capture needs off a candidate. Deliberately a SUBSET of
 *  CandidateEblet (specialist_adapters.ts), not the whole interface, so this file compiles
 *  against any object carrying at least these fields -- and so a field this file does not name
 *  here can never reach buildOreRecord's allow-list copy below even by accident. */
export interface OreCandidateInput {
  source: string;
  content: string;
  weight: number;
  sid: string;
  domain?: string;
}

export interface OreRecord {
  runId: string;
  class: OreClass;
  /** Which stage produced this ore -- "the shark that bit it". 'Saladin' for CHALLENGED
   *  (the Adversarial Fence rejected it outright); 'Furnace' for CAPPED (it passed Saladin but
   *  was cut by the postFurnaceCap slice feeding Furnace). */
  stage: 'Saladin' | 'Furnace';
  content: string;
  sid: string;
  weight: number;
  source: string | null;
  sourceMissingReason: string | null;
  domain: string | null;
  domainMissingReason: string | null;
  questionId: string;
  question: string;
  /** 1-based rank among Saladin-passed candidates sorted by weight descending. Only ever set
   *  for class CAPPED -- a CHALLENGED candidate was removed before ranking ever happened, so its
   *  rank is not merely unknown, it is inapplicable. */
  rank: number | null;
  cap: number | null;
  rankMissingReason: string | null;
  timestampUtc: string;
  /** SHA-512 hex via socceriHash(), over a stable subset of this record's own fields. */
  contentHash: string;
}

export interface BuildOreRecordParams {
  runId: string;
  class: OreClass;
  stage: 'Saladin' | 'Furnace';
  candidate: OreCandidateInput;
  questionId: string;
  question: string;
  /** 1-based rank; pass null for CHALLENGED (see OreRecord.rank doc). */
  rank: number | null;
  /** The cap that excluded it (postFurnaceCap); pass null for CHALLENGED. */
  cap: number | null;
}

// ─── Storage location ──────────────────────────────────────────────────────────

const LB_SUBSTRATE_ROOT =
  process.env.LB_SUBSTRATE_ROOT ?? resolve(homedir(), '.lb_substrate');

const ORE_DIR = process.env.MNEM_ORE_DIR ?? resolve(LB_SUBSTRATE_ROOT, 'ore');
const ORE_FILE = resolve(ORE_DIR, 'candidate_ore.jsonl');

/** Exposed for tests and callers that want to read back what was written. Re-resolves ORE_DIR
 *  from the live env var each call is NOT done here (ORE_DIR is a module-load-time constant,
 *  matching ip_ledger_store.ts's own LB_SUBSTRATE_ROOT constant) -- set MNEM_ORE_DIR before this
 *  module is first imported (see ore_store.test.ts's vi.resetModules() pattern) if a test needs
 *  a fresh directory. */
export function getOreFilePath(): string {
  return ORE_FILE;
}

function ensureOreDir(): void {
  if (!existsSync(ORE_DIR)) mkdirSync(ORE_DIR, { recursive: true });
}

// ─── Record construction ────────────────────────────────────────────────────────

export function buildOreRecord(params: BuildOreRecordParams): OreRecord {
  const { runId, class: oreClass, stage, candidate, questionId, question, rank, cap } = params;

  // ALLOW-LIST COPY -- never `...candidate`. See file header: this is the one place a future
  // field on CandidateEblet (an answer key included) cannot silently enter the ore store.
  const content = candidate.content;
  const sid = candidate.sid;
  const weight = candidate.weight;
  // `||`, not `??`, deliberately: an empty-string source/domain is exactly as uninformative as
  // a missing one, and the FIREARM rule (a field that cannot be determined is null WITH an
  // explanatory sibling, never a bare empty string) applies to that case too.
  const source = candidate.source || null;
  const domain = candidate.domain || null;

  const isCapped = oreClass === 'CAPPED';

  const record: Omit<OreRecord, 'contentHash'> = {
    runId,
    class: oreClass,
    stage,
    content,
    sid,
    weight,
    source,
    sourceMissingReason: source === null
      ? 'candidate.source was falsy at ore-capture time (CandidateEblet.source is a required ' +
        'field, so this indicates an upstream defect, not a legitimate absence)'
      : null,
    domain,
    domainMissingReason: domain === null
      ? 'CandidateEblet.domain is optional and was not set by the specialist adapter that ' +
        'produced this candidate'
      : null,
    questionId,
    question,
    rank: isCapped ? rank : null,
    cap: isCapped ? cap : null,
    rankMissingReason: isCapped
      ? null
      : 'CHALLENGED candidates were removed by Saladin before the postFurnaceCap ranking/slice ' +
        'was ever applied, so rank and cap do not apply to this record',
    timestampUtc: new Date().toISOString(),
  };

  // Hash over a stable, deterministic subset (never the volatile timestamp, never an answer
  // key -- there is none in `record` to begin with). Sorted-key JSON so a re-run over the same
  // logical candidate always reproduces the same hash regardless of property order.
  const hashPayload = JSON.stringify({
    class: record.class,
    stage: record.stage,
    sid: record.sid,
    content: record.content,
    source: record.source,
    domain: record.domain,
    questionId: record.questionId,
    rank: record.rank,
    cap: record.cap,
  });

  return { ...record, contentHash: socceriHash(hashPayload) };
}

// ─── Writer ────────────────────────────────────────────────────────────────────

/** Append one or more ore records as JSONL lines. A no-op on an empty array (no empty write,
 *  no empty file created for a question that lost nothing). Ore is a bonus write, never a gate
 *  -- callers should catch and log, never let a write failure here break the answer path (see
 *  canonical_pipeline.ts's call site). */
export function writeOreRecords(records: OreRecord[]): void {
  if (records.length === 0) return;
  ensureOreDir();
  const lines = records.map((r) => JSON.stringify(r)).join('\n') + '\n';
  appendFileSync(ORE_FILE, lines, 'utf-8');
}
