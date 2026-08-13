// evidence_store.ts -- D-BP153-002/BISHOP/evidence-store
//
// AN APPEND-ONLY, CONTENT-ADDRESSED STORE FOR EVERY AUTHORITY QUERY A RUN ISSUES.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// WHY THIS EXISTS. THE FOUNDER'S OWN CORRECTION, BP153.
//
// Bishop proposed this store on the framing "Google will never be deterministic, so stop trying
// to make it so." The Founder refuted the framing, and he was right:
//
//   "if no model can be deterministic, then can't we provide the framework that makes it
//    impossible for them to NOT be? My adage is true - if anyone can figure out the answer, then
//    we can too. and that has to be true for all the MMLU pro questions, at least."
//
// The correction matters and it changes what this file is for. The answer to an MMLU-Pro question
// is a FACT ABOUT THE WORLD. It does not vary. What varies is the CHANNEL: which passage Google
// returns on a Tuesday, how a model phrases an extraction. Those are two different things, and
// conflating them is what made the earlier framing wrong.
//
// So this store is NOT a concession that the answer is unstable. It is the INSTRUMENT THAT PROVES
// THE FRAMEWORK SQUEEZED THE CHANNEL OUT. Acquire the same question several times, independently,
// on different days, through different surfaces. Replay the derivation over each acquisition. If
// the verdict is identical across all of them, you have not asserted determinism, you have
// MEASURED it -- and you have measured the only kind that was ever available: determinism of the
// answer, despite variance in the channel.
//
// That is why the unit of storage here is the ACQUISITION, not the run. One acquisition is one
// independent pass at gathering evidence for a question. Many acquisitions per question is the
// point, not an accident.
//
// WHAT IT BUYS, CONCRETELY:
//   1. The derivation becomes a pure function of frozen evidence. Same evidence in, same verdict
//      out, forever, offline, free. Run it ten thousand times.
//   2. A rate limit stops blocking the campaign. Being blocked costs you NEW questions, not the
//      ability to work on the ones already acquired.
//   3. A regression becomes a diff instead of an expedition: replay every stored acquisition
//      through the new code and compare verdicts and shapes.
//   4. Convergence across independent acquisitions becomes measurable, which is the Founder's
//      point above made mechanical.
//
// WHAT IT IS NOT. It is not a cache. A cache exists to avoid work and is allowed to be
// transparent about nothing. This is a LEDGER: append-only, never mutated, and a replay that
// cannot find its evidence REFUSES LOUDLY rather than quietly returning nothing (see
// evidence_authority.ts). The whole defect class this estate keeps finding is "a value is missing
// and the message reads like a decision." A silent cache miss would be a new instance of exactly
// that bug.
// ─────────────────────────────────────────────────────────────────────────────────────────────
//
// HARDWIRE-08 CONFORMANCE, STATED RATHER THAN ASSUMED.
// HARDWIRE-08 requires that independent content-address implementations never SILENTLY drift.
// `mnemosyne`'s canonical Crystal address is derived at src/main/crystal/crystal_store.ts:218-223:
//
//     const hash = createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
//     return hash.slice(0, 32);
//
// `contentAddress()` below uses that EXACT recipe: sha256 over a JSON.stringify'd, sorted array,
// truncated to 32 hex characters. It does NOT import crystal_store, deliberately: that module is
// CommonJS (`require()` at its top, its own package.json with "type": "commonjs") and carries a
// documented history of location/loader breakage. Pulling it into the Liana Cycle run path to
// borrow four lines of hashing would trade a real runtime risk for a cosmetic DRY win.
//
// The drift is instead made LOUD rather than prevented by coupling: evidence_store.crystal_
// conformance.test.ts reads crystal_store.ts's source and fails if that recipe ever changes
// without this file changing with it. Silent drift is what HARDWIRE-08 forbids; a test that
// names the drift satisfies it. This is a considered departure, not an unnoticed one.

import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Which authority produced a record. These are DIFFERENT SHAPES on purpose (see
 *  method_registry.ts:59-72) and the store keeps them distinguishable rather than flattening
 *  them into a lowest-common-denominator blob it cannot faithfully replay. */
export type EvidenceAuthority = 'google' | 'conversational';

export interface EvidenceRecord {
  schema: 'liana-evidence/1';
  /** Content address of the RESPONSE payload. Two identical responses share an address. */
  address: string;
  /** Content address of {authority, query}. THE LOOKUP KEY a replay resolves against. */
  queryKey: string;
  authority: EvidenceAuthority;
  /** The query text exactly as it was issued, untruncated. */
  query: string;
  /** The authority's response verbatim: BrowserAuthorityRawExtraction for 'google',
   *  ConversationalAuthorityResult for 'conversational', or null when the authority returned
   *  nothing. A recorded null is a FACT ("we asked and got nothing"), and is not the same thing
   *  as an absent record ("we never asked"). The replay path distinguishes them; see
   *  evidence_authority.ts. */
  response: unknown;
  /** Wall-clock of the acquisition, ISO 8601 UTC. */
  ts: string;
  /** Groups every record gathered in ONE independent pass at a question. The unit of
   *  convergence measurement. */
  acquisitionId: string;
  qid: number | null;
  /** Monotonic within an acquisition, so a replay can tell issue-order from file order even if
   *  records are ever re-sorted. */
  seq: number;
}

/** One independent evidence-gathering pass at one question. */
export interface Acquisition {
  acquisitionId: string;
  qid: number | null;
  slug: string;
  records: EvidenceRecord[];
  /** From the first record. Null for an empty acquisition. */
  acquiredAt: string | null;
}

/** THE CRYSTAL RECIPE. See the HARDWIRE-08 note in this file's header before changing a
 *  character of this function. Its conformance to crystal_store.ts is pinned by
 *  evidence_store.crystal_conformance.test.ts. */
export function contentAddress(parts: string[]): string {
  const sorted = [...parts].sort();
  const hash = createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
  return hash.slice(0, 32);
}

/** The lookup key a replay resolves against. Deliberately derived from authority + query ONLY:
 *  a replay knows what it is about to ask and nothing about what came back, so the key must be
 *  computable from the request alone. */
export function deriveQueryKey(authority: EvidenceAuthority, query: string): string {
  return contentAddress([`authority:${authority}`, `query:${query}`]);
}

/** Follows the estate LEDGER convention (a fixed, named subdirectory of HARDWIRE\LEDGER, the
 *  same placement LIANA_RUNS and LIANA_LABORATORY use), NOT Electron's per-OS userData path.
 *  Env override first so tests never write into the real ledger. No electron import anywhere in
 *  this module: it must be runnable and testable outside Electron. */
export function resolveEvidenceDir(): string {
  return process.env.LB_EVIDENCE_DIR
    || 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\HARDWIRE\\LEDGER\\LIANA_EVIDENCE';
}

function slugFor(qid: number | null): string {
  return qid != null ? `qid${qid}` : 'free-text';
}

function fileFor(dir: string, qid: number | null, acquisitionId: string): string {
  return join(dir, `EVIDENCE_${slugFor(qid)}_${acquisitionId}.jsonl`);
}

/** Acquisition ids are caller-supplied rather than generated from a clock inside this module, so
 *  a test can pin one and a run can carry its own run id through. */
export function newAcquisitionId(stampIso: string, nonce: string): string {
  return `${stampIso.replace(/[:.]/g, '-')}_${nonce}`;
}

/**
 * Appends one record. Append-only by construction: there is no update or delete in this module,
 * and callers get no handle capable of rewriting a line.
 *
 * Returns the completed record (with its addresses filled in) so a caller can log what it wrote
 * without recomputing anything.
 */
export function appendEvidence(input: {
  authority: EvidenceAuthority;
  query: string;
  response: unknown;
  acquisitionId: string;
  qid: number | null;
  seq: number;
  ts: string;
  dir?: string;
}): EvidenceRecord {
  const dir = input.dir || resolveEvidenceDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const record: EvidenceRecord = {
    schema: 'liana-evidence/1',
    address: contentAddress([JSON.stringify(input.response ?? null)]),
    queryKey: deriveQueryKey(input.authority, input.query),
    authority: input.authority,
    query: input.query,
    response: input.response ?? null,
    ts: input.ts,
    acquisitionId: input.acquisitionId,
    qid: input.qid,
    seq: input.seq,
  };
  appendFileSync(fileFor(dir, input.qid, input.acquisitionId), `${JSON.stringify(record)}\n`, 'utf8');
  return record;
}

/** Loads one acquisition. A malformed line is SKIPPED AND COUNTED, never silently dropped:
 *  `malformedLines` is returned so a caller can refuse to trust a partially-readable
 *  acquisition rather than replay over a hole it cannot see. */
export function loadAcquisition(
  qid: number | null,
  acquisitionId: string,
  dir?: string,
): { acquisition: Acquisition | null; malformedLines: number } {
  const d = dir || resolveEvidenceDir();
  const path = fileFor(d, qid, acquisitionId);
  if (!existsSync(path)) return { acquisition: null, malformedLines: 0 };

  const lines = readFileSync(path, 'utf8').split('\n').filter((l) => l.trim().length > 0);
  const records: EvidenceRecord[] = [];
  let malformedLines = 0;
  for (const line of lines) {
    try {
      records.push(JSON.parse(line) as EvidenceRecord);
    } catch {
      malformedLines += 1;
    }
  }
  records.sort((a, b) => a.seq - b.seq);
  return {
    acquisition: {
      acquisitionId,
      qid,
      slug: slugFor(qid),
      records,
      acquiredAt: records.length ? records[0].ts : null,
    },
    malformedLines,
  };
}

/** Every acquisition on disk for a question, oldest first by id. This is the list a convergence
 *  measurement iterates: replay the derivation once per acquisition and compare the verdicts. */
export function listAcquisitions(qid: number | null, dir?: string): string[] {
  const d = dir || resolveEvidenceDir();
  if (!existsSync(d)) return [];
  const prefix = `EVIDENCE_${slugFor(qid)}_`;
  return readdirSync(d)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.jsonl'))
    .map((f) => f.slice(prefix.length, -'.jsonl'.length))
    .sort();
}

/** D-BP154-010/BISHOP/S10/seg-thepail -- THE PAIL, lock condition 4: "the evidence we already own
 *  is VISIBLE... 440 records, ~291 KB, 23 acquisition files... Read-only." This is the read side
 *  of that requirement: a whole-store summary across EVERY qid, not one question's acquisitions
 *  (listAcquisitions()/loadAcquisition() above are both scoped to a single `qid` -- this function
 *  is the first thing in this file that looks at the store as a whole).
 *
 *  STRICTLY READ-ONLY. `readdirSync`/`statSync`/`readFileSync` only -- no write, no rename, no
 *  delete, nowhere in this function. Calling it any number of times leaves every byte on disk
 *  unchanged; the evidence store's own append-only contract (this file's header) is untouched by
 *  its existence. A malformed line is counted, exactly as `loadAcquisition()` already does for one
 *  acquisition -- never silently absorbed into `totalRecords`. */
export interface EvidenceStoreSummary {
  dir: string;
  files: number;
  totalBytes: number;
  totalRecords: number;
  malformedLines: number;
}

export function summarizeEvidenceStore(dir?: string): EvidenceStoreSummary {
  const d = dir || resolveEvidenceDir();
  if (!existsSync(d)) return { dir: d, files: 0, totalBytes: 0, totalRecords: 0, malformedLines: 0 };
  const files = readdirSync(d).filter((f) => f.startsWith('EVIDENCE_') && f.endsWith('.jsonl'));
  let totalBytes = 0;
  let totalRecords = 0;
  let malformedLines = 0;
  for (const f of files) {
    const p = join(d, f);
    totalBytes += statSync(p).size;
    const lines = readFileSync(p, 'utf8').split('\n').filter((l) => l.trim().length > 0);
    for (const line of lines) {
      try {
        JSON.parse(line);
        totalRecords += 1;
      } catch {
        malformedLines += 1;
      }
    }
  }
  return { dir: d, files: files.length, totalBytes, totalRecords, malformedLines };
}
