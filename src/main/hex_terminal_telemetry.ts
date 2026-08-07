// hex_terminal_telemetry.ts
// SEG: D-BP148-001/KNIGHT/M4/seg-m4h2p
//
// M4 -- THE MEASUREMENT, WIRED FROM DAY ONE, NOT BOLTED ON.
//
// Implements the metrics governed by
// `C:\Users\Administrator\Documents\LianaBanyanPlatform\BISHOP_DROPZONE\HEX_CONNECTOR_MEASUREMENT_SPEC.md`
// ("the spec" below). This module's scope is exactly the WORK section of ticket M4: the four
// measurements plus the one derived mode field. It deliberately does NOT implement the spec's
// separate "CONDITIONAL TRANSFER IS A FIFTH MEASURED OUTCOME" section -- that section exists in
// the spec file but was not named in this ticket's WORK block, and this ticket's own text is
// explicit that "your OWNS block does not grow beyond the telemetry module and test file already
// named." See the M4 report for an explicit disclosure of this gap between the spec's five-part
// admissibility bar and this ticket's four-plus-one scope.
//
// THE FOUR MEASUREMENTS (spec "THE FOUR MEASUREMENTS", each cited by section number below) plus
// the fifth derived field (spec "TRANSPARENT-MODE FALLBACK IS A MEASURED OUTCOME"):
//
//   1. TOKENS AT THE WIRE (spec sec. 1) -- `handle_cost_tokens` / `prose_cost_tokens` below are
//      real counts of the actual text that would cross the wire, computed by `countWireTokens()`
//      at record time (send time) by the writer, appended to a JSONL file, and intended to be
//      read back by a DIFFERENT process than the one that wrote it (`readAllHexTelemetryRecords`
//      is a pure disk read with no in-memory cache, so a separate `node` process reading the same
//      file gets identical, independently-derived numbers -- see this module's test file and the
//      M4 far-end proof transcript for a live demonstration of that separate-process read-back).
//      Per the CELPANE LAW (spec sec. "THE CELPANE CHANGES WHAT IS BEING MEASURED"), the wire
//      count on the handle side is the handle PLUS the celpane, never the handle alone and never
//      full content -- `recordHexExchange` sums `countWireTokens(handle_address_text)` and
//      `countWireTokens(celpane_text)`, and a separate, explicit full-content fetch is its own
//      event type (`recordFullContentFetch` / `HexFullContentFetchRecord`), never folded into the
//      per-exchange baseline.
//   2. PAIRED WITHIN EACH EXCHANGE (spec sec. 2) -- every `HexExchangeRecord` carries both
//      `handle_cost_tokens` and `prose_cost_tokens` for the SAME content at the SAME moment
//      (both are computed inside the same `recordHexExchange` call from the same input, not from
//      two different calls or two different sessions).
//   3. BREAK-EVEN AS A REUSE COUNT N (spec sec. 3) -- `computeBreakEvenByHandle` reports, per
//      `content_address`, the reuse index N at which the cumulative real cost of the handle
//      scheme first drops to or below the cumulative cost the equivalent-prose scheme would have
//      carried across the same reuses -- an empirical crossing point computed from recorded
//      numbers, never a bare percentage.
//   4. RESOLUTION FAILURE RATE (spec sec. 4) -- `resolution_attempted` / `resolution_succeeded`
//      are recorded on every exchange where a handle was actually used, and
//      `computeResolutionFailureRate` reports failures/attempts as a first-class number, never
//      silently dropped. A failed resolution's `effective_cost_tokens` is charged the wasted
//      handle-side cost PLUS the full prose re-send, per spec sec. 4 HOW ("strictly worse than
//      never having used the connector at all on that exchange").
//   5. TRANSPARENT-MODE FALLBACK (spec sec. "TRANSPARENT-MODE FALLBACK IS A MEASURED OUTCOME") --
//      `mode_chosen` / `mode_reason` are derived fields on the SAME exchange record, computed
//      from the Measurement-2 pair (handle-side cost vs. prose cost) that drove the choice. This
//      is not a new module or file, per the ticket's explicit instruction.
//
// TOKENIZER DISCLOSURE (read before trusting absolute numbers): this repo has no tokenizer
// dependency installed (`node_modules` has no tiktoken / gpt-tokenizer / vendor tokenizer of any
// kind -- confirmed by directory search at build time), and adding one would mean touching
// package.json / package-lock.json / node_modules, which is outside this ticket's OWNS block ("a
// new telemetry module plus its own test file, nothing else"). `countWireTokens` below is
// therefore a real, deterministic, dependency-free lexical tokenizer (word-runs, digit-runs, and
// individual punctuation/symbol characters each count as one token) computed directly from the
// actual string that would cross the wire. It is a REAL COUNT of a REAL, reproducible unit --
// it is emphatically NOT "bytes divided by four", the exact malpractice the spec calls out and
// forbids (spec sec. 1 HOW: "Bishop did exactly that at BP147 and self-caught it; it is not a
// substitute for a real count"). It will NOT numerically match any specific vendor's BPE token
// count -- that discrepancy is disclosed here, in the module's exported `TOKENIZER_DISCLOSURE`
// string, and in the M4 report. Swapping in a real vendor tokenizer later is a pure drop-in
// replacement of `countWireTokens`'s body; nothing else in this module depends on its internals.

import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'fs';
import { resolve, join } from 'path';

// ─── Storage location ───────────────────────────────────────────────────────
// Mirrors src/main/crystal/crystal_store.ts's `resolveCrystalDir()` convention (env override
// first, then Electron userData if genuinely running inside Electron's main process, then the
// same computed Windows path with zero Electron dependency, else a loud hard error -- never a
// silent cwd-relative fallback). Reused rather than reinvented because this module must ALSO run
// standalone under plain `node` with no Electron runtime at all, for the far-end proof's
// separate-process read-back step.

const USERDATA_APP_NAME = 'amplify-computer';

function resolveHexTelemetryDir(): string {
  const envOverride = process.env.MNEM_HEX_TELEMETRY_DIR;
  if (envOverride) return resolve(envOverride);

  const attempted: string[] = [];

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electron = require('electron') as { app?: { getPath: (name: string) => string } };
    const app = electron?.app;
    if (app && typeof app.getPath === 'function') {
      return resolve(app.getPath('userData'), 'hex_terminal_telemetry');
    }
    attempted.push(
      "Electron app.getPath('userData') -- 'electron' module resolved but exposes no " +
        'app.getPath (this process is not Electron\'s main process)'
    );
  } catch {
    attempted.push(
      "Electron app.getPath('userData') -- 'electron' is not resolvable in this process " +
        '(not running inside Electron, e.g. tests / far-end proof scripts / a future CLI)'
    );
  }

  if (process.platform === 'win32') {
    const appData = process.env.APPDATA;
    if (appData) {
      return resolve(appData, USERDATA_APP_NAME, 'hex_terminal_telemetry');
    }
    attempted.push('Windows computed path -- %APPDATA% is not set in this process\'s environment');
  } else {
    attempted.push(
      `No verified non-Electron userData computation for process.platform === "${process.platform}" ` +
        '-- Electron\'s convention differs by platform and was not empirically confirmed here'
    );
  }

  throw new Error(
    '[hex_terminal_telemetry] could not resolve a telemetry storage directory. Tried, in order:\n' +
      attempted.map((a) => `  - ${a}`).join('\n') +
      '\n' +
      'Fix: set MNEM_HEX_TELEMETRY_DIR to an absolute directory path -- it is an override and ' +
      'wins outright over everything above. ' +
      `Expected default location on Windows: %APPDATA%\\${USERDATA_APP_NAME}\\hex_terminal_telemetry.`
  );
}

const HEX_TELEMETRY_DIR = resolveHexTelemetryDir();
const EXCHANGE_LOG_PATH = join(HEX_TELEMETRY_DIR, 'hex_terminal_telemetry.jsonl');

/** Absolute path to the telemetry JSONL file -- exported so a separate-process reader (e.g. the
 *  far-end proof's second `node -e` invocation) can locate it without recomputing this module's
 *  directory-resolution logic itself. */
export function getHexTelemetryLogPath(): string {
  return EXCHANGE_LOG_PATH;
}

function ensureDir(): void {
  if (!existsSync(HEX_TELEMETRY_DIR)) mkdirSync(HEX_TELEMETRY_DIR, { recursive: true });
}

// ─── Tokenizer (see TOKENIZER DISCLOSURE above) ────────────────────────────

export const TOKENIZER_DISCLOSURE =
  'countWireTokens() is a dependency-free lexical tokenizer (word-runs / digit-runs / individual ' +
  'punctuation-or-symbol characters each = 1 token), NOT a vendor BPE tokenizer -- no tokenizer ' +
  'package is installed in this repo and adding one is outside this ticket\'s OWNS scope. It is a ' +
  'real, deterministic count of the actual wire text, not bytes/4.';

const WIRE_TOKEN_PATTERN = /[A-Za-z]+|[0-9]+|[^\sA-Za-z0-9]/g;

/** Real, deterministic token count of `text` as it would actually cross the wire. See
 *  `TOKENIZER_DISCLOSURE` for exactly what unit this counts and why. */
export function countWireTokens(text: string): number {
  if (!text) return 0;
  const matches = text.match(WIRE_TOKEN_PATTERN);
  return matches ? matches.length : 0;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type HexConnectorMode = 'handle' | 'transparent';

/** Input to `recordHexExchange`. Content-agnostic by design: M1 (addressee registry), M2
 *  (prompt-to-handle hook), and M3 (UI) may not exist yet when this module is exercised (see the
 *  M4 report for which was actually used this run), so this module takes already-serialized
 *  handle/celpane/prose text rather than importing anything from those tickets' files. */
export interface HexExchangeInput {
  /** The handle/chonk address this exchange concerns (used to group reuses for break-even). */
  content_address: string;
  /** 1 = first-ever reference (mint), 2+ = Nth reuse of the same content_address. */
  reuse_index: number;
  /** The literal handle string that would be sent on the wire. */
  handle_address_text: string;
  /** The celpane payload -- per the CELPANE LAW, this is what crosses by default, not full content. */
  celpane_text: string;
  /** The equivalent full prose for the SAME content at the SAME moment (Measurement 2 pairing). */
  prose_text: string;
  /** Did an actor try to resolve the handle to its content on this exchange? */
  resolution_attempted: boolean;
  /** Only meaningful when resolution_attempted is true. */
  resolution_succeeded: boolean;
  /** One-time mint+write+resolve overhead paid on the exchange that actually mints this address
   *  (conventionally reuse_index 1) -- spec sec. 3 HOW: "you pay the mint, the write, and the
   *  resolve to save nothing on that first exchange." This is deliberately NOT folded into
   *  `handle_cost_tokens` (Measurement 1 is wire-bytes-only, per the CELPANE LAW: "the handle plus
   *  the celpane", nothing else) and deliberately NOT part of the Measurement-5 mode-choice
   *  comparison (that comparison is a pure per-message compressibility test, not an amortization
   *  decision). It DOES feed `effective_cost_tokens` and therefore Measurement 3's break-even
   *  accumulation, which is the one place the spec actually asks for it. Omit or pass 0 on
   *  reuse exchanges that mint nothing new. Defaults to 0. */
  first_reference_overhead_tokens?: number;
  /** Overrides the record timestamp; defaults to now. Exposed for deterministic tests. */
  ts?: string;
}

export interface HexExchangeRecord {
  record_type: 'exchange';
  ts: string;
  content_address: string;
  reuse_index: number;
  /** Measurement 1, handle side: tokens(handle_address_text) + tokens(celpane_text). Recorded
   *  regardless of which mode was finally chosen -- it is the comparison basis that drove the
   *  mode decision (Measurement 5 / TRANSPARENT-MODE FALLBACK). */
  handle_cost_tokens: number;
  /** Measurement 1, prose side / Measurement 2's pairing partner: tokens(prose_text). */
  prose_cost_tokens: number;
  /** Measurement 5 (derived field): which mode the connector chose for this exchange. */
  mode_chosen: HexConnectorMode;
  /** Measurement 5: human-readable comparison that drove the mode choice. */
  mode_reason: string;
  /** Measurement 4 input: was a resolution attempted on this exchange? */
  resolution_attempted: boolean;
  /** Measurement 4 input: did it succeed? Only meaningful if resolution_attempted. */
  resolution_succeeded: boolean;
  /** Echoed input, see HexExchangeInput -- kept on the record for audit/replay. */
  first_reference_overhead_tokens: number;
  /** Real cost actually incurred this exchange, feeding Measurement 3's break-even accumulation:
   *  (handle_cost_tokens in handle mode, or prose_cost_tokens in transparent mode)
   *  + first_reference_overhead_tokens
   *  + prose_cost_tokens again if resolution was attempted and failed (spec sec. 4 HOW: wasted
   *    round trip PLUS full re-send, strictly worse than never having used the connector). */
  effective_cost_tokens: number;
}

/** Per the CELPANE LAW (spec, "THE CELPANE CHANGES WHAT IS BEING MEASURED"): a separate, explicit
 *  full-content fetch is counted and reported as its OWN event, never folded silently into the
 *  per-exchange baseline in HexExchangeRecord. */
export interface HexFullContentFetchRecord {
  record_type: 'full_content_fetch';
  ts: string;
  content_address: string;
  full_content_cost_tokens: number;
  reason: string;
}

export type HexTelemetryRecord = HexExchangeRecord | HexFullContentFetchRecord;

// ─── Writer (Measurement 1 HOW: "instrumented by the sender at send time, appended to a file") ──

function appendRecord(record: HexTelemetryRecord): void {
  ensureDir();
  // Deliberately no try/catch swallow here (unlike some other meters in this tree): silently
  // dropping a telemetry write is exactly the kind of quiet data loss the spec's Measurement 4
  // ("not silently dropped") and Section 1.5 far-end-proof discipline exist to rule out for this
  // module's own numbers. A write failure should be loud, not absorbed.
  appendFileSync(EXCHANGE_LOG_PATH, JSON.stringify(record) + '\n', 'utf-8');
}

/** Record one paired exchange (Measurements 1, 2, 4, and the Measurement-5 mode field in one
 *  call, on one record, from one input -- see the pairing requirement in spec sec. 2 HOW). */
export function recordHexExchange(input: HexExchangeInput): HexExchangeRecord {
  const ts = input.ts ?? new Date().toISOString();

  const handleCostTokens =
    countWireTokens(input.handle_address_text) + countWireTokens(input.celpane_text);
  const proseCostTokens = countWireTokens(input.prose_text);

  // TRANSPARENT-MODE FALLBACK (spec sec. "TRANSPARENT-MODE FALLBACK IS A MEASURED OUTCOME"):
  // "falls back to transparent mode ... whenever handling would cost more than simply sending
  // it" -- so handling costing strictly MORE triggers the fallback; equal or cheaper keeps
  // handle mode.
  const modeChosen: HexConnectorMode = handleCostTokens > proseCostTokens ? 'transparent' : 'handle';
  const modeReason =
    `handle_side=${handleCostTokens}tok (handle+celpane) vs prose=${proseCostTokens}tok -> ` +
    (modeChosen === 'handle'
      ? 'handle side no more expensive than prose; handle mode chosen'
      : 'handle side costs more than prose; falling back to transparent mode (send prose), ' +
        'v.42bis-style per-exchange compressibility test');

  const firstReferenceOverheadTokens = input.first_reference_overhead_tokens ?? 0;
  const resolutionFailed = input.resolution_attempted && !input.resolution_succeeded;
  const baseCostTokens = modeChosen === 'transparent' ? proseCostTokens : handleCostTokens;
  const effectiveCostTokens =
    baseCostTokens + firstReferenceOverheadTokens + (resolutionFailed ? proseCostTokens : 0);

  const record: HexExchangeRecord = {
    record_type: 'exchange',
    ts,
    content_address: input.content_address,
    reuse_index: input.reuse_index,
    handle_cost_tokens: handleCostTokens,
    prose_cost_tokens: proseCostTokens,
    mode_chosen: modeChosen,
    mode_reason: modeReason,
    resolution_attempted: input.resolution_attempted,
    resolution_succeeded: input.resolution_succeeded,
    first_reference_overhead_tokens: firstReferenceOverheadTokens,
    effective_cost_tokens: effectiveCostTokens,
  };

  appendRecord(record);
  return record;
}

/** Record an explicit, separate full-content fetch event. Never call this from inside
 *  `recordHexExchange`'s per-exchange baseline -- per the CELPANE LAW, it must stay a distinct,
 *  separately-reported event. */
export function recordFullContentFetch(input: {
  content_address: string;
  full_content_text: string;
  reason: string;
  ts?: string;
}): HexFullContentFetchRecord {
  const record: HexFullContentFetchRecord = {
    record_type: 'full_content_fetch',
    ts: input.ts ?? new Date().toISOString(),
    content_address: input.content_address,
    full_content_cost_tokens: countWireTokens(input.full_content_text),
    reason: input.reason,
  };
  appendRecord(record);
  return record;
}

// ─── Reader (Measurement 1 HOW: "read back by a different process than the one that wrote it") ──
// Deliberately stateless / no in-memory cache: every call re-reads the file from disk, so a
// genuinely separate OS process calling this function gets numbers derived independently from
// the same bytes on disk, not from anything cached in the writer's process memory.

/** Read every telemetry record from disk. Corrupt / unparsable lines are skipped and counted in
 *  `parse_errors` rather than either crashing the reader or silently vanishing without a trace
 *  (Measurement 4's "not silently dropped" ethos applied to the reader's own reliability, too). */
export function readAllHexTelemetryRecords(): { records: HexTelemetryRecord[]; parse_errors: number } {
  if (!existsSync(EXCHANGE_LOG_PATH)) return { records: [], parse_errors: 0 };
  const raw = readFileSync(EXCHANGE_LOG_PATH, 'utf-8');
  const records: HexTelemetryRecord[] = [];
  let parseErrors = 0;
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line) as HexTelemetryRecord);
    } catch {
      parseErrors++;
    }
  }
  return { records, parse_errors: parseErrors };
}

// ─── Aggregation / reporting ────────────────────────────────────────────────

export interface HexWireTokenTotals {
  handle_side_total_tokens: number;
  prose_side_total_tokens: number;
  full_content_fetch_total_tokens: number;
  full_content_fetch_events: number;
}

/** Measurement 1 totals: tokens at the wire, handle side vs. prose side, plus the separately-
 *  tracked full-content-fetch events (never folded into the exchange totals). */
export function computeWireTokenTotals(records: HexTelemetryRecord[]): HexWireTokenTotals {
  const exchanges = records.filter((r): r is HexExchangeRecord => r.record_type === 'exchange');
  const fetches = records.filter(
    (r): r is HexFullContentFetchRecord => r.record_type === 'full_content_fetch'
  );
  return {
    handle_side_total_tokens: exchanges.reduce((s, r) => s + r.handle_cost_tokens, 0),
    prose_side_total_tokens: exchanges.reduce((s, r) => s + r.prose_cost_tokens, 0),
    full_content_fetch_total_tokens: fetches.reduce((s, r) => s + r.full_content_cost_tokens, 0),
    full_content_fetch_events: fetches.length,
  };
}

export interface HexBreakEvenResult {
  content_address: string;
  observed_reuses: number;
  cumulative_handle_scheme_tokens: number;
  cumulative_prose_scheme_tokens: number;
  /** N: the reuse_index at which cumulative handle-scheme cost first drops to or below cumulative
   *  prose-scheme cost. `null` if that crossing has not been observed within the recorded reuses
   *  (never fabricated/extrapolated -- an honest "not yet observed" beats a guessed N). */
  break_even_reuse_count: number | null;
}

/** Measurement 3: break-even reported as a reuse count N, per content_address, computed
 *  empirically from recorded effective_cost_tokens vs. the prose-scheme counterfactual -- never a
 *  bare percentage, and never fabricated when the crossing has not yet been observed. */
export function computeBreakEvenByHandle(records: HexTelemetryRecord[]): HexBreakEvenResult[] {
  const exchanges = records.filter((r): r is HexExchangeRecord => r.record_type === 'exchange');
  const byAddress = new Map<string, HexExchangeRecord[]>();
  for (const r of exchanges) {
    const list = byAddress.get(r.content_address) ?? [];
    list.push(r);
    byAddress.set(r.content_address, list);
  }

  const results: HexBreakEvenResult[] = [];
  for (const [address, list] of byAddress) {
    list.sort((a, b) => a.reuse_index - b.reuse_index);
    let cumHandle = 0;
    let cumProse = 0;
    let breakEven: number | null = null;
    for (const rec of list) {
      cumHandle += rec.effective_cost_tokens;
      cumProse += rec.prose_cost_tokens;
      if (breakEven === null && cumHandle <= cumProse) {
        breakEven = rec.reuse_index;
      }
    }
    results.push({
      content_address: address,
      observed_reuses: list.length,
      cumulative_handle_scheme_tokens: cumHandle,
      cumulative_prose_scheme_tokens: cumProse,
      break_even_reuse_count: breakEven,
    });
  }
  return results;
}

export interface HexResolutionFailureStats {
  attempts: number;
  failures: number;
  /** 0 when attempts === 0 -- callers must check `attempts` before treating this as meaningful. */
  failure_rate: number;
}

/** Measurement 4: resolution failure rate as a first-class, always-computed metric. */
export function computeResolutionFailureRate(records: HexTelemetryRecord[]): HexResolutionFailureStats {
  const attempted = records.filter(
    (r): r is HexExchangeRecord => r.record_type === 'exchange' && r.resolution_attempted
  );
  const failures = attempted.filter((r) => !r.resolution_succeeded).length;
  return {
    attempts: attempted.length,
    failures,
    failure_rate: attempted.length > 0 ? failures / attempted.length : 0,
  };
}

export interface HexModeStats {
  total_exchanges: number;
  handle_mode_count: number;
  transparent_mode_count: number;
  transparent_fallback_ratio: number;
}

/** Measurement 5 (derived field) rolled up: the ratio of exchanges that fell back to transparent
 *  mode -- "itself a headline result" per spec, reported alongside the four measurements, never
 *  buried. */
export function computeModeStats(records: HexTelemetryRecord[]): HexModeStats {
  const exchanges = records.filter((r): r is HexExchangeRecord => r.record_type === 'exchange');
  const transparent = exchanges.filter((r) => r.mode_chosen === 'transparent').length;
  return {
    total_exchanges: exchanges.length,
    handle_mode_count: exchanges.length - transparent,
    transparent_mode_count: transparent,
    transparent_fallback_ratio: exchanges.length > 0 ? transparent / exchanges.length : 0,
  };
}

export interface HexTelemetrySummary {
  wire_tokens: HexWireTokenTotals;
  mode: HexModeStats;
  resolution: HexResolutionFailureStats;
  break_even_by_handle: HexBreakEvenResult[];
  parse_errors: number;
}

/** Full rollup of all four measurements plus the Measurement-5 mode field, from a set of already-
 *  loaded records (pass in the result of `readAllHexTelemetryRecords().records`). */
export function computeHexTelemetrySummary(
  records: HexTelemetryRecord[],
  parseErrors = 0
): HexTelemetrySummary {
  return {
    wire_tokens: computeWireTokenTotals(records),
    mode: computeModeStats(records),
    resolution: computeResolutionFailureRate(records),
    break_even_by_handle: computeBreakEvenByHandle(records),
    parse_errors: parseErrors,
  };
}
