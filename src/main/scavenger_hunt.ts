// scavenger_hunt.ts -- D-BP223-BM0-X033-022 (SEG, "Haystack Needle" test #2, inside Prove It Works)
//
// Founder ruling, 2026-09-19 23:27Z, verbatim: "'Haystack Needle Test' they then enter in a
// well-known phrase, and the substrate is searched for similar, asks to clarify, they pick one
// and it gives them the answer, with sources." "...propagate that with the most popular phrases
// from among the users that have already entered them in - and the way those get in is we use
// the matching capability, not from a dropdown ... when the user enters anything similar to
// ANYTHING that we have stored in the substrate, then it asks to change it to one of those, like
// it does on Addresses for most sites."
//
// HARDWIRE-22: a local model may only copy out what is literally present. This module makes NO
// model call of any kind, ever -- every function here is pure/synchronous except the two thin
// disk-read wrappers (loadCandidatePool, appendScavengerHuntLogRecord), and there is no import of
// any LLM/HTTP/Ollama/Anthropic client anywhere in this file (see
// scavenger_hunt.test.ts's "zero model call guard" test, which asserts this both structurally --
// a source-text import scan -- and behaviorally -- every emitted log record carries
// model_calls: 0, a literal, never a measured-then-hoped-zero value).
//
// REUSE, NOT REINVENTION -- three existing, already-shipped mechanisms are wired together here,
// none forked or reimplemented:
//   1. THE MATCHING CAPABILITY (the Answer Cache's own verbatim-serve gate, BP136/BP137 Yoke):
//      mnem_eblet_store.ts's computeQuestionSimilaritySymmetric() (a *question*<->*question*
//      token-overlap score, min of both directions -- see that function's own header for the
//      Euler-mismatch incident this exact fix closed) already implements normalize-then-compare
//      for phrases like "What was Mark Twain's birthday?" vs "When was Mark Twains' bday?" (that
//      literal pair is in that function's own worked examples). It is reused here VERBATIM, not
//      re-derived, so a phrase that would be auto-served verbatim by the Ask tab and a phrase
//      surfaced as a Scavenger Hunt "did you mean" candidate are scored by the exact same
//      arithmetic.
//   2. THE STORED SUBSTRATE: mnem_eblet_store.ts's loadAllVerifiedEblets() reads
//      {userData}/substrate/verified_eblets.jsonl, the SAME store the Answer Cache serves from --
//      real question/answer/provenance rows already on this machine, filtered to verified===true.
//      No new store is created for the candidate pool.
//   3. THE CELPANE TOKEN-BUDGET CONVENTION (the hex-connector receipt's own instrument):
//      connector_celpane.ts's estimateTokens() (ceil(chars/3.5), the SAME conservative estimator
//      cited in that file and in BISHOP_DROPZONE\MIC_CHANNEL\mic_channel_missive.js) is reused
//      here to MEASURE (not assume) the token size of what this feature actually hands back --
//      the celpane-shaped pointer object, never the full record.
//
// WHAT IS NEW IN THIS FILE (nothing above already did this):
//   - normalizePhrase(): a small, testable canonicalization step (lowercase, strip punctuation,
//     collapse whitespace) distinct from tokenizeQuestion() (which is a private, unexported
//     helper inside mnem_eblet_store.ts) -- this is what the panel shows back to a member as "you
//     normalized my phrase to: ...", and what the hash-chained log records as normalized_phrase.
//   - findScavengerHuntMatches(): ranks the candidate pool by computeQuestionSimilaritySymmetric,
//     applies a "did you mean" floor BELOW the Answer Cache's own SERVE_VERBATIM_THRESHOLD (0.6)
//     so a looser match still surfaces as a clarifying option instead of being silently dropped,
//     and caps the list at MAX_CANDIDATES so the panel is never "a dropdown of everything" (the
//     Founder's own words, ruled out explicitly).
//   - the hash-chained Scavenger Hunt run log -- a SIBLING log, not a write into
//     substrate_savings_receipt.ts's savings_receipts.jsonl. That log's own header states it is
//     single-purpose ("These receipts determine a bill" -- it prices real cloud/local model
//     calls against a licensing fee). A Scavenger Hunt run never calls a model and is not a
//     billing event, so writing it into the billing chain would silently misclassify a $0,
//     no-call lookup as a priced query the next aggregate/report reads. This module instead
//     reuses that log's PATTERN (canonicalize -> sha256 -> GENESIS sentinel -> prev_hash chain,
//     verifySavingsChain()'s exact algorithm) against its own file,
//     {userData}/substrate/scavenger_hunt_runs.jsonl, so both logs are independently verifiable
//     and neither can corrupt the other's chain.
//   - "most popular phrases": derived ONLY from this log's own normalized_phrase field (local
//     counts, no network, no separate curated list) -- literally "the way those get in is we use
//     the matching capability, not from a dropdown."

import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { createHash, randomUUID } from 'crypto';
import {
  computeQuestionSimilaritySymmetric,
  SERVE_VERBATIM_THRESHOLD,
  loadAllVerifiedEblets,
  type VerifiedEbletEntry,
} from './mnem_eblet_store';
import { estimateTokens } from './liana_cycle/evidence/connector_celpane';
import { applyAliases } from './scavenger_hunt_aliases';

// ─── Normalization ──────────────────────────────────────────────────────────

/**
 * Canonicalize a raw phrase the way the panel shows it back to the member and the way the run
 * log records it: lowercase, punctuation replaced with spaces (so "Ben Franklin's Bday?" and
 * "ben franklin s bday" compare identically downstream), whitespace collapsed and trimmed.
 * Deliberately the SAME character class (`[^a-z0-9\s]` after lowercasing) mnem_eblet_store.ts's
 * private tokenizeQuestion() already uses, so this module's notion of "normalized" never diverges
 * from what computeQuestionSimilaritySymmetric() is actually scoring under the hood -- confirmed
 * by scavenger_hunt.test.ts, not merely asserted here.
 */
export function normalizePhrase(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Matching ───────────────────────────────────────────────────────────────

/** Below SERVE_VERBATIM_THRESHOLD (0.6, the Answer Cache's own auto-serve bar) on purpose: a
 *  Scavenger Hunt candidate is a CLARIFYING SUGGESTION ("did you mean"), never an auto-served
 *  answer, so it is allowed to surface looser matches than the Ask tab would silently auto-serve.
 *  Still well above mnem_eblet_store.ts's QA_RELEVANCE_THRESHOLD (0.08, a much weaker "same
 *  topic at all" gate) so pure noise never appears in the list. */
export const DID_YOU_MEAN_FLOOR = 0.3;

/** Never "a dropdown of everything" (Founder, verbatim, ruling out that shape explicitly). */
export const MAX_CANDIDATES = 5;

export interface ScavengerHuntCandidate {
  /** Stable identifier for THIS candidate within one search response: its position in the
   *  ranked list. Re-derived fresh per search, never persisted -- selection happens in the same
   *  round-trip a search's candidate list was produced in. */
  index: number;
  question: string;
  similarity: number;
  /** True once similarity >= SERVE_VERBATIM_THRESHOLD -- shown so the panel can label a
   *  near-exact restatement differently from a looser suggestion, never used to skip the
   *  member's own pick (this test build always asks; see TASK.md's own worked flow). */
  wouldAutoServe: boolean;
}

export interface ScavengerHuntSearchResult {
  raw_phrase: string;
  normalized_phrase: string;
  /** Every hand-kept alias (scavenger_hunt_aliases.ts) that fired while matching THIS search,
   *  formatted "key->value" (e.g. "ben->benjamin"), in the order encountered. Empty when no
   *  alias in the table applies to this phrase -- never inferred, always the literal list
   *  applyAliases() returned. Recorded on the run log (see EmitRunInput/ScavengerHuntRunRecord
   *  below) so which aliases fired, per search, is auditable after the fact. */
  aliases_fired: string[];
  candidates: ScavengerHuntCandidate[];
  /** True when the local substrate has zero eligible rows at all (not merely zero matches for
   *  THIS phrase) -- the panel's own "Nothing stored yet. Ask a question first." copy is gated on
   *  this, never inferred from an empty candidates array alone (a real substrate with real rows
   *  that simply do not match this phrase must say "no similar phrase found", a different and
   *  honest message from "nothing is stored"). */
  substrate_empty: boolean;
}

/** class:'component' rows (mnem_eblet_store.ts's VerifiedEbletEntry.class) are answer FRAGMENTS,
 *  never served verbatim on their own -- same exclusion findNearestBySemanticCode() already
 *  applies for the Ask tab's own semantic path, reused here for consistency. */
function isWholeAnswerEntry(entry: VerifiedEbletEntry): boolean {
  return entry.class !== 'component';
}

/** Pure ranking function, no I/O -- unit-testable against a fixture pool without touching disk.
 *
 *  ALIAS EXPANSION (D-BP223-BM0-X033-060, "option C"): the raw phrase is normalized, then run
 *  through scavenger_hunt_aliases.ts's applyAliases() -- a hand-kept nickname/abbreviation
 *  table -- BEFORE it is handed to computeQuestionSimilaritySymmetric(). This closes the
 *  disclosed gap named in D-BP223-BM0-X033-022's own FINDINGS.md ("Ben Franklins Bday?" scoring
 *  0.0 against "What was Benjamin Franklin's birthday?" under bare token overlap), with zero
 *  model calls (a plain object lookup). When no alias in the table applies, the aliased phrase
 *  is byte-identical to the normalized phrase, so every phrase this matcher already handled
 *  correctly is scored exactly as before -- this is additive, not a replacement of the
 *  underlying token-overlap matcher. `normalized_phrase` in the returned result stays the bare
 *  normalization (what the panel shows back as "you searched for..."); the ALIASED phrase is
 *  used only for the similarity comparison itself. */
export function findScavengerHuntMatches(
  rawPhrase: string,
  pool: VerifiedEbletEntry[],
): ScavengerHuntSearchResult {
  const normalized_phrase = normalizePhrase(rawPhrase);
  const { expanded: aliasedPhrase, fired: aliases_fired } = applyAliases(normalized_phrase);
  const eligible = pool.filter(isWholeAnswerEntry);

  if (eligible.length === 0) {
    return { raw_phrase: rawPhrase, normalized_phrase, aliases_fired, candidates: [], substrate_empty: true };
  }

  const scored = eligible
    .map((entry) => ({
      entry,
      similarity: computeQuestionSimilaritySymmetric(aliasedPhrase, entry.question),
    }))
    .filter((s) => s.similarity >= DID_YOU_MEAN_FLOOR)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, MAX_CANDIDATES);

  const candidates: ScavengerHuntCandidate[] = scored.map((s, i) => ({
    index: i,
    question: s.entry.question,
    similarity: s.similarity,
    wouldAutoServe: s.similarity >= SERVE_VERBATIM_THRESHOLD,
  }));

  return { raw_phrase: rawPhrase, normalized_phrase, aliases_fired, candidates, substrate_empty: false };
}

/** Thin disk-read wrapper -- the only reason this function is `async` rather than pure. Kept
 *  separate from findScavengerHuntMatches() so the ranking logic above stays synchronously
 *  unit-testable against an in-memory fixture pool. */
export async function loadCandidatePool(): Promise<VerifiedEbletEntry[]> {
  return loadAllVerifiedEblets();
}

// ─── Answer + sources ───────────────────────────────────────────────────────

export interface ScavengerHuntAnswer {
  question: string;
  answer: string;
  /** Every source string this record actually carries, deduplicated, in the order found:
   *  entry.provenance first, then entry.provenanceDetail.corroboration_sources (when present).
   *  Never fabricated, never padded -- an entry with a single bare provenance string yields a
   *  single-element array, honestly. */
  sources: string[];
}

/** Copies ONLY what is literally present on the stored record (HARDWIRE-22) -- no synthesis, no
 *  paraphrase, no model call. */
export function buildScavengerHuntAnswer(entry: VerifiedEbletEntry): ScavengerHuntAnswer {
  const sources: string[] = [];
  if (entry.provenance) sources.push(entry.provenance);
  if (entry.provenanceDetail?.corroboration_sources) {
    for (const s of entry.provenanceDetail.corroboration_sources) {
      if (s && !sources.includes(s)) sources.push(s);
    }
  }
  return { question: entry.question, answer: entry.answer, sources };
}

// ─── Hash-chained run log (sibling of substrate_savings_receipt.ts's log; see header) ──────────

export interface ScavengerHuntRunRecord {
  run_id: string;
  ts: string;
  raw_phrase: string;
  normalized_phrase: string;
  candidates_shown: number;
  /** The selected candidate's stored question, or null when the member never picked one (a pure
   *  search with no selection, or a substrate_empty/no-match run). */
  selected_question: string | null;
  /** Every scavenger_hunt_aliases.ts alias that fired for this run's phrase, "key->value"
   *  (e.g. "ben->benjamin"), in encounter order -- literally ScavengerHuntSearchResult's own
   *  aliases_fired field, carried through unmodified so which aliases fired, per search, is
   *  auditable from the hash-chained log alone (D-BP223-BM0-X033-060 "option C"). Empty array
   *  when none fired -- never omitted, so old and new records both always have this key. */
  aliases_fired: string[];
  /** Literal 0, always -- see this file's header ("never a measured-then-hoped-zero value"). A
   *  test asserts every record satisfies this; it is not merely documentation. */
  model_calls: 0;
  /** Real measurement: estimateTokens() (connector_celpane.ts, reused verbatim) applied to the
   *  JSON of the actual celpane-shaped pointer this run returned to the renderer -- never a flat
   *  assumed constant like the 5.32B receipt's own "50 tokens" figure would be if merely copied
   *  here instead of remeasured per run. */
  tokens_used: number;
  latency_ms: number;
  sources_count: number;
  prev_hash: string;
  hash: string;
}

let _logPathOverride: string | null = null;

/** Test-only hook, same convention as substrate_savings_receipt.ts's _setLogPathForTests. */
export function _setScavengerHuntLogPathForTests(path: string | null): void {
  _logPathOverride = path;
}

function logPath(): string {
  if (_logPathOverride) return _logPathOverride;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = require('electron');
    return resolve(app.getPath('userData'), 'substrate', 'scavenger_hunt_runs.jsonl');
  } catch {
    return resolve(process.env.APPDATA || process.env.HOME || '.', 'AMPLIFY Computer', 'scavenger_hunt_runs.jsonl');
  }
}

export { logPath as _scavengerHuntLogPathForTests };

function ensureDir(path: string): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

const GENESIS_HASH = 'GENESIS';

/** Same canonical (key-sorted) JSON convention as substrate_savings_receipt.ts's canonicalize(),
 *  so hash computation is stable regardless of property insertion order -- reused pattern, this
 *  file's own copy (that function is not exported by substrate_savings_receipt.ts). */
function canonicalize(obj: Record<string, unknown>): string {
  const sortedKeys = Object.keys(obj).sort();
  const sorted: Record<string, unknown> = {};
  for (const k of sortedKeys) sorted[k] = obj[k];
  return JSON.stringify(sorted);
}

function computeHash(recordWithoutHash: Omit<ScavengerHuntRunRecord, 'hash'>): string {
  return createHash('sha256').update(canonicalize(recordWithoutHash)).digest('hex');
}

function readLastHash(path: string): string {
  if (!existsSync(path)) return GENESIS_HASH;
  const raw = readFileSync(path, 'utf-8').trim();
  if (!raw) return GENESIS_HASH;
  const lines = raw.split('\n');
  try {
    const last = JSON.parse(lines[lines.length - 1]) as ScavengerHuntRunRecord;
    return last.hash;
  } catch {
    return GENESIS_HASH;
  }
}

export interface EmitRunInput {
  raw_phrase: string;
  normalized_phrase: string;
  candidates_shown: number;
  selected_question: string | null;
  /** Defaults to [] when omitted, so every existing caller/test that pre-dates the alias table
   *  keeps compiling and keeps writing a valid record. */
  aliases_fired?: string[];
  tokens_used: number;
  latency_ms: number;
  sources_count: number;
  /** Overridable for tests; defaults to now. */
  as_of?: string;
  run_id?: string;
}

/** Appends one tamper-evident Scavenger Hunt run record. Mirrors
 *  substrate_savings_receipt.ts's emitSavingsReceipt() shape/discipline (canonicalize -> hash ->
 *  append), against this module's own sibling file. */
export function emitScavengerHuntRun(input: EmitRunInput): ScavengerHuntRunRecord {
  const path = logPath();
  ensureDir(path);
  const prev_hash = readLastHash(path);

  const withoutHash: Omit<ScavengerHuntRunRecord, 'hash'> = {
    run_id: input.run_id ?? randomUUID(),
    ts: input.as_of ?? new Date().toISOString(),
    raw_phrase: input.raw_phrase,
    normalized_phrase: input.normalized_phrase,
    candidates_shown: input.candidates_shown,
    selected_question: input.selected_question,
    aliases_fired: input.aliases_fired ?? [],
    model_calls: 0,
    tokens_used: input.tokens_used,
    latency_ms: input.latency_ms,
    sources_count: input.sources_count,
    prev_hash,
  };

  const hash = computeHash(withoutHash);
  const record: ScavengerHuntRunRecord = { ...withoutHash, hash };
  appendFileSync(path, JSON.stringify(record) + '\n', 'utf-8');
  return record;
}

export interface ScavengerHuntChainVerifyResult {
  ok: boolean;
  total_records: number;
  broken_at_index: number | null;
}

/** Same walk-and-report-first-break algorithm as substrate_savings_receipt.ts's
 *  verifySavingsChain(), against this module's own file. Tamper-EVIDENT only, same limits as
 *  that file's header documents (this module does not repeat that full disclosure -- see
 *  substrate_savings_receipt.ts's header for the complete statement, which applies identically
 *  here since the algorithm is the same). */
export function verifyScavengerHuntChain(path: string = logPath()): ScavengerHuntChainVerifyResult {
  if (!existsSync(path)) return { ok: true, total_records: 0, broken_at_index: null };
  const raw = readFileSync(path, 'utf-8').trim();
  if (!raw) return { ok: true, total_records: 0, broken_at_index: null };
  const lines = raw.split('\n');
  let expectedPrev = GENESIS_HASH;

  for (let i = 0; i < lines.length; i++) {
    let record: ScavengerHuntRunRecord;
    try {
      record = JSON.parse(lines[i]) as ScavengerHuntRunRecord;
    } catch {
      return { ok: false, total_records: lines.length, broken_at_index: i };
    }
    if (record.prev_hash !== expectedPrev) {
      return { ok: false, total_records: lines.length, broken_at_index: i };
    }
    const { hash, ...rest } = record;
    if (computeHash(rest) !== hash) {
      return { ok: false, total_records: lines.length, broken_at_index: i };
    }
    expectedPrev = record.hash;
  }
  return { ok: true, total_records: lines.length, broken_at_index: null };
}

function readAllRuns(path: string): ScavengerHuntRunRecord[] {
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, 'utf-8').trim();
  if (!raw) return [];
  const out: ScavengerHuntRunRecord[] = [];
  for (const line of raw.split('\n')) {
    try {
      out.push(JSON.parse(line) as ScavengerHuntRunRecord);
    } catch {
      // skip malformed line, consistent with substrate_savings_receipt.ts's readAllRecords
    }
  }
  return out;
}

export interface PopularPhrase {
  normalized_phrase: string;
  count: number;
}

/** "Most popular phrases": LOCAL counts only, derived from this log's own normalized_phrase
 *  field -- no network call, no curated/seeded list. Literally "the way those get in is we use
 *  the matching capability, not from a dropdown" (Founder, verbatim). */
export function computePopularPhrases(path: string = logPath(), limit: number = 10): PopularPhrase[] {
  const runs = readAllRuns(path);
  const counts = new Map<string, number>();
  for (const r of runs) {
    if (!r.normalized_phrase) continue;
    counts.set(r.normalized_phrase, (counts.get(r.normalized_phrase) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([normalized_phrase, count]) => ({ normalized_phrase, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Measures the celpane-shaped pointer actually returned for a search response -- reuses
 *  connector_celpane.ts's estimateTokens() verbatim (ceil(chars/3.5)), applied to the SAME
 *  shape the renderer receives (question + normalized phrase + candidate list), never to the
 *  full stored answer text (that would overstate what a "pointer" costs). */
export function measureSearchTokens(result: ScavengerHuntSearchResult): number {
  return estimateTokens({
    q: result.normalized_phrase,
    c: result.candidates.map((c) => ({ i: c.index, s: Math.round(c.similarity * 100) })),
  });
}

/** Measures the celpane-shaped pointer for a resolved answer -- the answer/sources text itself
 *  IS the payload being served (unlike the search step's pointer-only shape), so this measures
 *  the full ScavengerHuntAnswer object, honestly labeled as such by the caller's stats line. */
export function measureAnswerTokens(answer: ScavengerHuntAnswer): number {
  return estimateTokens(answer);
}
