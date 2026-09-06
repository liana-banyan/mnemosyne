// cost_instrument.ts -- D-BP164-M0-046/BISHOP/M0/seg-survey-gating-and-cost-wiring
//
// D-BP164-M0-044 MEASURED: D-BP159-009_cost_axis.js (tiktoken-based, dollar-priced, explicitly
// labels the Google leg) is wired into the STANDALONE D-BP150-014_measure_driver.js benchmark
// harness only -- NOT into production runLianaCycleQuestion(). Every real external call in
// survey_stage.ts routes through ONE channel, googleBlocks(ctx.askGoogle, query) -- but that
// channel itself only ever calls the `askGoogle` it was given; it does not originate calls of
// its own. So the true single wiring point, reachable from EVERY caller (every method, Survey,
// and Step 0's own "ask Google this"), is the raw `askGoogle` function itself -- decorating it
// ONCE, at its true source, counts every real call this run makes, the same "one injection
// point" principle D-BP152-051 (Assisted Mode) already established for this exact parameter
// (see liana_terminal_engine.ts's own "THE ONE INJECTION POINT" comment).
//
// WHAT THIS FILE DOES NOT DO, AND WHY (measured, not guessed): D-BP159-009_token_counter.js
// shells out to a Python subprocess for real tiktoken counts, reading FILES (not text directly).
// A direct measurement during this dispatch (a synchronous execFileSync call against
// celpane_tiktoken_count_pair.py, two short scratch files, no network target) HUNG past a 30s
// timeout using the git-bash-resident python3 -- tiktoken's cl100k_base encoding fetches its BPE
// merges file over the network on a cache miss, so a per-call subprocess invocation in the
// production hot path risks an unbounded stall on every single Google call, not just a slow one.
// That is exactly the "meaningful latency" this dispatch's own instruction requires reporting,
// not silently accepting -- so token counting is NOT wired synchronously into the awaited
// askGoogle path here. What this instrument DOES count and price, honestly:
//   - call count (every real call reaching askGoogle, ok or not)
//   - wall-clock latency per call (Date.now() before/after -- effectively free, no subprocess)
//   - dollars: the Google search leg's ACTUAL marginal cost is $0, an ARCHITECTURAL FACT (the
//     Founder's own logged-in browser/CDP session, no metered API behind it -- SAME ruling
//     D-BP159-009_price_table_map.json's `legs["google-cdp-browser-search"]` already records for
//     the benchmark instrument, read fresh from that same file here, never re-invented), AND a
//     COUNTERFACTUAL dollar figure (what the SAME call volume would have cost through a metered
//     search API) computed from that file's own `counterfactual_search_baseline` block --
//     call-count based (usd_per_1000 queries), not token-based, so no tokenizer is needed to
//     produce a real, sourced dollar figure at all.
// Token counts remain a documented gap (tokens: {measured:false, reason: ...}), not a guessed
// number -- "a guessed price is worse than a missing one" (D-BP159-009_cost_model.js's own rule),
// extended here to token counts for the same reason.
//
// D-BP164-M0-068/BISHOP/M0/seg-cu -- UNIFIED LLM/TOKEN LEG, ADDITIVE, BELOW.
//
// SEG-CI (D-BP164-M0-057) MEASURED, and this dispatch (D-BP164-M0-068) independently confirmed by
// re-reading the same source: `actual_usd` above is a hardcoded 0, `tokens.measured` is ALWAYS
// false, and the counterfactual above is priced against GOOGLE SEARCH CALL COUNT, never against
// an LLM/model token cost -- the `mmlu-pro-answer-generation` leg in
// D-BP159-009_price_table_map.json is explicitly `"kind": "not_instrumented_by_this_driver"` and
// lives in a SEPARATE, standalone Python harness
// (librarian-mcp\r10_cross_vendor\run_local_llm_k511_bp164.py +
// librarian-mcp\r10_cross_vendor\adapters\ollama_adapter.py), never wired into this file or into
// runLianaCycleQuestion(). That harness's own ollama_adapter.py (lines ~84-126) proved a free,
// exact, subprocess-free token count already exists for every local Ollama call: Ollama's own
// /api/generate and /api/chat responses carry `prompt_eval_count`/`eval_count` on every completed
// response, read directly off the JSON body already being parsed for other reasons -- NO
// tiktoken subprocess, so the 30-second-hang risk that justified `tokens.measured:false` on the
// Google leg (see TOKENS_NOT_MEASURED_REASON below) does NOT apply to this path.
//
// `LlmCallCostRecord`/`LlmCostSummary` below are the production-path mirror of that proven
// technique, wired at comparative_cascade.ts's gemmaExtract() (methods/comparative_cascade.ts --
// the one real Ollama/LLM call site reachable from runLianaCycleQuestion(), via the
// 'gemma' ambiguityQueryTransport and every classify/comparative-cascade method that calls it).
// gemmaExtract() already parses the Ollama response body (`res.json()`) for its own extraction
// purposes; `prompt_eval_count`/`eval_count` are read from that SAME parsed body, adding no new
// network call and no new latency of any kind.
//
// PER-NODE, NEVER AVERAGED (FD-BP164-03, reinforced FD-BP164-04 -- NOT FD-BP164-06, which is the
// Negative Space Doctrine, a different ruling; SEG-CI's own report corrected BISHOP-M0's citation
// of this and that correction is carried forward here). `machineId` (os.hostname()) is recorded on
// every LlmCallCostRecord and LlmCostSummary, exactly as the Google leg already does. Nothing in
// this file merges, sums, or averages a summary across machines -- a reader wanting an M0-vs-M3
// comparison reads two runs' separate summaries side by side, never one blended number.
//
// DIGEST, NEVER NAME ALONE (standing order, real discrepancy caught BP164: `gemma4:12b` on this
// machine is digest `4eb23ef187e2`, `gemma2:2b` is `8ccf136fdd52` -- a model TAG can be repointed
// at a different weights file without the tag string changing). `modelDigest` is resolved from
// Ollama's own `/api/tags` listing (comparative_cascade.ts's `resolveGemmaModelDigest()`) and
// carried on every record, null (never guessed) when it could not be resolved.
//
// ACTUAL vs COUNTERFACTUAL, SAME HONESTY RULE AS THE GOOGLE LEG ABOVE: `actual_usd` for local
// Ollama inference is a TRUE architectural $0 (local-member-hardware price-table row, which
// explicitly and correctly disclaims "Electricity and hardware amortization are real and NOT
// measured by this table" -- that caveat is read live from the row's own `note` field and carried
// into `actual_reason` below, never dropped). The counterfactual is priced against
// `substrate_price_table.json`'s own `default_counterfactual_model` (currently `claude-sonnet-5`,
// $2.00/$10.00 per MTok input/output, verified_on 2026-08-20, verified_by
// D-BP160-M0-033/BISHOP/M0, source_url recorded on that row) -- a NAMED model at a NAMED,
// SOURCED, DATED rate, read live every call, never a guess and never silently re-derived from a
// different number. A run whose token counts were not measured (a transport failure or an HTTP
// error response that carried no usage data) gets `counterfactual_priced: false` with a named
// reason, exactly the Google leg's own "a guessed price is worse than a missing one" discipline.

import os from 'node:os';
import { readFileSync } from 'node:fs';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { AskGoogleFn } from './method_registry';
// D-BP165-M0-007: same cap discipline (2000 chars, first-N, original length + truncated flag
// always recorded) compute_sidecar.ts's own per-sample capture uses, reused here rather than a
// second, potentially-diverging implementation -- see compute_sidecar.ts's own header comment on
// capRawModelOutput() for the full rationale. Only the SHAPE is imported here (the type); a caller
// wanting to CAP text calls compute_sidecar.ts's own capRawModelOutput() before ever reaching
// recordLlmCall() -- this file never caps a second time (see recordLlmCall's own doc comment).
import type { CappedRawOutput } from '../plow/compute_sidecar';

export interface GoogleCallCostRecord {
  callIndex: number;
  ts_start: string;
  ts_end: string;
  latency_ms: number;
  /** os.hostname() -- so a receipt from M0 and a receipt from M3 (different hardware, per the
   *  BP157/BP158 two-machine mesh) can never be silently conflated in the published paper's cost
   *  figures. */
  machineId: string;
  query: string;
  /** True when askGoogle returned a non-null BrowserAuthorityRawExtraction -- the same "did we
   *  get anything back at all" signal googleBlocks() itself uses, not a judgment about whether
   *  the answer was USEFUL (a non-null result with an empty snippet is still `ok: true` here,
   *  exactly as it is a real, billable/latency-bearing round trip either way). */
  ok: boolean;
  /** BrowserAuthorityRawExtraction carries no `via` field of its own (that string is
   *  googleBlocks()'s own later construction, not part of the raw askGoogle boundary) -- this
   *  instrument sits BELOW googleBlocks(), at the true source, so it reports the raw fields that
   *  actually exist: which authority answered, whether a source URL came back, and whether the
   *  call threw. */
  authority: string | null;
  sourceUrl: string | null;
  threw: boolean;
  leg: 'google-cdp-browser-search';
  tokens: { measured: false; reason: string };
  dollars: {
    actual_usd: number;
    actual_priced: boolean;
    actual_reason: string;
    counterfactual_usd: number | null;
    counterfactual_priced: boolean;
    counterfactual_reason: string;
    counterfactual_rate_source: string | null;
  };
}

export interface GoogleCostSummary {
  callCount: number;
  totalLatencyMs: number;
  totalActualUsd: number;
  totalCounterfactualUsd: number | null;
  machineId: string;
}

const TOKENS_NOT_MEASURED_REASON = 'Not measured on the production path -- D-BP164-M0-046 measured that a '
  + 'per-call synchronous tiktoken subprocess (D-BP159-009_token_counter.js\'s own mechanism) can hang past '
  + '30s on a cache miss (cl100k_base fetches its merges file over the network), so it was deliberately not '
  + 'wired into the awaited askGoogle path. Call count and dollars are measured; per-call token counts are an '
  + 'honest gap, not a guessed number.';

/** Reads D-BP159-009_price_table_map.json's `legs["google-cdp-browser-search"]` (actual cost,
 *  architectural $0) and `counterfactual_search_baseline` (the Founder-selected metered-API
 *  comparison rate) fresh on every call -- same "never fork the real table, read it live" rule
 *  D-BP159-009_cost_model.js's own header states, applied to this second, JSON-only consumer.
 *  Returns null-priced with a named reason on any read/parse failure -- never guesses a number. */
function priceGoogleLeg(callCount: number): GoogleCallCostRecord['dollars'] {
  const mapPath = 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\BISHOP_DROPZONE\\D-BP159-009_price_table_map.json';
  try {
    const map = JSON.parse(readFileSync(mapPath, 'utf-8'));
    const leg = map?.legs?.['google-cdp-browser-search'];
    const baseline = map?.counterfactual_search_baseline;
    const selectedKey: string | null = baseline?.selected_baseline ?? null;
    const selectedCandidate = selectedKey ? baseline?.candidates?.[selectedKey] : null;
    // ARCHITECTURAL $0, not derived from a rate: leg.input_per_mtok_usd/output_per_mtok_usd are
    // both 0 in the real map (checked, not assumed) -- read here only to confirm the map still
    // says what this comment claims, never to compute a different number from them.
    const actual_usd = 0;
    const actual_reason = typeof leg?.source === 'string'
      ? leg.source
      : 'google-cdp-browser-search leg: architectural $0 (Founder\'s own logged-in browser session, no metered API call) -- price map entry unreadable, falling back to this documented ruling verbatim';
    if (selectedCandidate && typeof selectedCandidate.usd_per_1000 === 'number') {
      const counterfactual_usd = (callCount / 1000) * selectedCandidate.usd_per_1000;
      return {
        actual_usd,
        actual_priced: true,
        actual_reason,
        counterfactual_usd,
        counterfactual_priced: true,
        counterfactual_reason: `${selectedCandidate.provider} ${selectedCandidate.product} at $${selectedCandidate.usd_per_1000}/1000 queries (selected_baseline: ${selectedKey})`,
        counterfactual_rate_source: selectedCandidate.source_url ?? null,
      };
    }
    return {
      actual_usd,
      actual_priced: true,
      actual_reason,
      counterfactual_usd: null,
      counterfactual_priced: false,
      counterfactual_reason: 'D-BP159-009_price_table_map.json has no selected_baseline set -- refusing to guess a counterfactual rate',
      counterfactual_rate_source: null,
    };
  } catch (err) {
    const reason = `price table read failed: ${err instanceof Error ? err.message : String(err)}`;
    return {
      actual_usd: 0,
      actual_priced: false,
      actual_reason: reason,
      counterfactual_usd: null,
      counterfactual_priced: false,
      counterfactual_reason: reason,
      counterfactual_rate_source: null,
    };
  }
}

/** D-BP152-051-style decorator: `sink` is called once per REAL call that reaches the wrapped
 *  function (every call, ok or not -- a failed/empty Google response is still a real network
 *  round trip that costs latency and belongs in the count). Byte-identical control flow to the
 *  unwrapped `askGoogle` on every path -- this never changes what is returned, only observes it.
 *  Never throws on its own account: a sink/pricing failure is caught and logged, never allowed to
 *  turn a real answer into a thrown error (same "an instrument that can kill a run is worse than
 *  no instrument" rule SC-01's own wiring already follows, D-BP152-016). */
export function wrapAskGoogleWithCostInstrument(
  askGoogle: AskGoogleFn,
  sink: (record: GoogleCallCostRecord) => void,
  machineId: string = os.hostname(),
): AskGoogleFn {
  let callIndex = 0;
  return async (query: string) => {
    const idx = ++callIndex;
    const ts_start = new Date().toISOString();
    const t0 = Date.now();
    let result: Awaited<ReturnType<AskGoogleFn>>;
    let threw: unknown = null;
    try {
      result = await askGoogle(query);
    } catch (e) {
      threw = e;
      result = null;
    }
    const t1 = Date.now();
    const ts_end = new Date().toISOString();
    try {
      const dollars = priceGoogleLeg(1);
      sink({
        callIndex: idx,
        ts_start,
        ts_end,
        latency_ms: t1 - t0,
        machineId,
        query,
        ok: result != null,
        authority: result?.authority ?? null,
        sourceUrl: result?.sourceUrl ?? null,
        threw: threw != null,
        leg: 'google-cdp-browser-search',
        tokens: { measured: false, reason: TOKENS_NOT_MEASURED_REASON },
        dollars,
      });
    } catch (sinkErr) {
      console.warn('[CostInstrument] sink/pricing failed (non-fatal, the real askGoogle result is unaffected):', sinkErr);
    }
    if (threw) throw threw;
    return result;
  };
}

/** Rolls a run's own cost ledger up into the summary attached to LianaTerminalOutcome. Pure
 *  arithmetic over records already produced above -- never re-derives a dollar figure. */
export function summarizeGoogleCostLedger(records: GoogleCallCostRecord[], machineId: string = os.hostname()): GoogleCostSummary {
  const totalActualUsd = records.reduce((s, r) => s + (r.dollars.actual_priced ? r.dollars.actual_usd : 0), 0);
  const anyUnpricedCounterfactual = records.some((r) => !r.dollars.counterfactual_priced);
  const totalCounterfactualUsd = anyUnpricedCounterfactual
    ? null
    : records.reduce((s, r) => s + (r.dollars.counterfactual_usd ?? 0), 0);
  return {
    callCount: records.length,
    totalLatencyMs: records.reduce((s, r) => s + r.latency_ms, 0),
    totalActualUsd,
    totalCounterfactualUsd,
    machineId,
  };
}

// ─────────────────────────── D-BP164-M0-068: UNIFIED LLM/TOKEN COST LEG ───────────────────────────
// See this file's own header comment (top) for the full finding and rationale.

/** One real Ollama round trip made by gemmaExtract() (methods/comparative_cascade.ts), the one
 *  LLM call site reachable from runLianaCycleQuestion() today. Deliberately mirrors
 *  GoogleCallCostRecord's shape field-for-field where the concept carries over (ts_start/ts_end,
 *  latency_ms, machineId, leg, tokens, dollars) so a reader who already knows one record shape
 *  reads the other for free. */
export interface LlmCallCostRecord {
  callIndex: number;
  ts_start: string;
  ts_end: string;
  latency_ms: number;
  /** os.hostname() -- same per-node, never-averaged discipline as GoogleCallCostRecord.machineId
   *  (FD-BP164-03, reinforced FD-BP164-04). */
  machineId: string;
  /** The raw Ollama model tag requested (e.g. 'gemma4:12b'), exactly as sent in the request body.
   *  NEVER trusted alone for identity -- see modelDigest below. */
  model: string;
  /** Resolved from Ollama's own /api/tags listing (comparative_cascade.ts's
   *  resolveGemmaModelDigest()). PIN BY DIGEST, NEVER BY NAME -- a standing order from a real
   *  discrepancy caught this session (a tag can be repointed at different weights without the tag
   *  string changing). Null, never guessed, when the digest could not be resolved (e.g. Ollama's
   *  /api/tags was unreachable). */
  modelDigest: string | null;
  leg: 'gemma-ollama-local-llm';
  /** True token counts read directly off Ollama's own `prompt_eval_count`/`eval_count` response
   *  fields (the SAME technique librarian-mcp's ollama_adapter.py already proved -- see this
   *  file's own header) -- NOT the tiktoken-subprocess path that risked hanging, and NOT an
   *  estimate. `measured:false` only when the round trip never reached a parsed Ollama response
   *  carrying those fields (transport failure, or an HTTP error body with no usage data) -- named,
   *  never silently zeroed. */
  tokens:
    | { measured: true; input_tokens: number; output_tokens: number }
    | { measured: false; reason: string };
  dollars: {
    actual_usd: number;
    actual_priced: boolean;
    actual_reason: string;
    counterfactual_usd: number | null;
    counterfactual_priced: boolean;
    counterfactual_reason: string;
    counterfactual_rate_source: string | null;
    /** The price-table model_id the counterfactual was priced against (e.g. 'claude-sonnet-5'),
     *  so a reader never has to re-derive which "counterfactual" this is from the reason string
     *  alone. Null when no counterfactual could be priced. */
    counterfactual_model: string | null;
  };
  /** D-BP165-M0-007, ADDITIVE OPTIONAL FIELD. LAW 2 finding this dispatch: this interface had NO
   *  text field at all before this line -- a real Ollama completion (ok, rejected, or disagreeing)
   *  was priced and timed but its actual content was never captured anywhere, making a rejected
   *  run undiagnosable (see this file's own D-BP165-M0-007 header note, and
   *  compute_sidecar.ts's matching capRawModelOutput()). Optional and undefined on every
   *  pre-existing call site (comparative_cascade.ts's gemmaExtract(), compute_gemma_cascade.ts's
   *  computeGemmaCallModel()) that does not pass it -- this field's absence changes nothing about
   *  those callers. Capped at RAW_MODEL_OUTPUT_CAP_CHARS (2000) chars, first-N, with
   *  originalLength/truncated always recorded -- see compute_sidecar.ts's capRawModelOutput() for
   *  the single shared implementation. Null when the call produced no text at all (a transport/
   *  HTTP failure) as opposed to undefined when the caller simply did not opt in to capturing it. */
  rawOutput?: CappedRawOutput | null;
}

export interface LlmCostSummary {
  callCount: number;
  totalLatencyMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalActualUsd: number;
  totalCounterfactualUsd: number | null;
  machineId: string;
}

/** Real, Founder-controlled, dated price table -- NOT the same file as the Google leg's
 *  D-BP159-009_price_table_map.json above. This is the table THAT map itself points to
 *  (`real_price_table_path`), read directly here because the LLM leg needs per-token rates
 *  (input_per_mtok_usd/output_per_mtok_usd) the map file does not carry on its own rows. */
const LLM_PRICE_TABLE_PATH = 'C:\\Users\\Administrator\\Documents\\mnemosyne\\config\\substrate_price_table.json';

/** Reads substrate_price_table.json fresh on every call (same "never fork the real table, read it
 *  live" rule priceGoogleLeg() above follows). `actual_usd` is the SAME architectural-$0 pattern
 *  as the Google leg -- local Ollama inference genuinely costs $0 in vendor-metered dollars -- but
 *  read from the `local-member-hardware` row's own `note` field so its "excludes hardware and
 *  electricity" caveat travels with every record rather than being silently dropped.
 *  `counterfactual_usd` is priced against the table's own `default_counterfactual_model`
 *  (currently claude-sonnet-5) at that model's real, sourced, dated per-token rate -- never a
 *  guess, and refused (not zeroed) if no currently-effective, non-cancelled rate row exists. */
function priceLlmLeg(tokens: LlmCallCostRecord['tokens']): LlmCallCostRecord['dollars'] {
  try {
    const table = JSON.parse(readFileSync(LLM_PRICE_TABLE_PATH, 'utf-8'));
    const rates: Array<Record<string, unknown>> = Array.isArray(table?.rates) ? table.rates : [];
    const localRow = rates.find((r) => r.model_id === 'local-member-hardware' && r.status !== 'CANCELLED');
    const actual_usd = 0;
    const actual_reason = typeof localRow?.note === 'string'
      ? (localRow.note as string)
      : 'local-member-hardware: architectural $0, local Ollama inference on this machine\'s own hardware, no metered API call behind it -- price table entry unreadable, falling back to this documented ruling verbatim (excludes electricity/hardware amortization, which are real and not measured here).';

    if (!tokens.measured) {
      return {
        actual_usd,
        actual_priced: true,
        actual_reason,
        counterfactual_usd: null,
        counterfactual_priced: false,
        counterfactual_reason: `token counts were not measured for this call, so no counterfactual can be priced: ${tokens.reason}`,
        counterfactual_rate_source: null,
        counterfactual_model: null,
      };
    }

    const defaultModel: string | null = typeof table?.default_counterfactual_model === 'string'
      ? table.default_counterfactual_model
      : null;
    if (!defaultModel) {
      return {
        actual_usd,
        actual_priced: true,
        actual_reason,
        counterfactual_usd: null,
        counterfactual_priced: false,
        counterfactual_reason: 'substrate_price_table.json has no default_counterfactual_model set -- refusing to guess a counterfactual rate',
        counterfactual_rate_source: null,
        counterfactual_model: null,
      };
    }

    const nowIsoDate = new Date().toISOString().slice(0, 10);
    const rateRow = rates.find((r) =>
      r.model_id === defaultModel
      && r.status !== 'CANCELLED'
      && typeof r.input_per_mtok_usd === 'number'
      && typeof r.output_per_mtok_usd === 'number'
      && (typeof r.effective_from !== 'string' || r.effective_from <= nowIsoDate)
      && (typeof r.effective_until !== 'string' || r.effective_until >= nowIsoDate));

    if (!rateRow) {
      return {
        actual_usd,
        actual_priced: true,
        actual_reason,
        counterfactual_usd: null,
        counterfactual_priced: false,
        counterfactual_reason: `no currently-effective, non-cancelled price-table row found for default_counterfactual_model "${defaultModel}" -- refusing to guess a counterfactual rate`,
        counterfactual_rate_source: null,
        counterfactual_model: defaultModel,
      };
    }

    const inputPerMtok = rateRow.input_per_mtok_usd as number;
    const outputPerMtok = rateRow.output_per_mtok_usd as number;
    const counterfactual_usd = (tokens.input_tokens / 1_000_000) * inputPerMtok
      + (tokens.output_tokens / 1_000_000) * outputPerMtok;
    return {
      actual_usd,
      actual_priced: true,
      actual_reason,
      counterfactual_usd,
      counterfactual_priced: true,
      counterfactual_reason: `${rateRow.model_id} (${rateRow.provider}) at $${inputPerMtok}/MTok input, $${outputPerMtok}/MTok output -- verified_on ${rateRow.verified_on ?? 'unknown'}, effective_from ${rateRow.effective_from ?? 'unknown'}, this estate's own default_counterfactual_model`,
      counterfactual_rate_source: typeof rateRow.source_url === 'string' ? rateRow.source_url : null,
      counterfactual_model: rateRow.model_id as string,
    };
  } catch (err) {
    const reason = `LLM price table read failed: ${err instanceof Error ? err.message : String(err)}`;
    return {
      actual_usd: 0,
      actual_priced: false,
      actual_reason: reason,
      counterfactual_usd: null,
      counterfactual_priced: false,
      counterfactual_reason: reason,
      counterfactual_rate_source: null,
      counterfactual_model: null,
    };
  }
}

/** PER-CALL-SCOPED ledger, not a module-level global array. A bare module array would leak
 *  records across concurrent runs sharing one Node process (index.ts can serve more than one
 *  'liana-terminal-run' IPC call in flight); AsyncLocalStorage gives each runLianaCycleQuestion()
 *  invocation its own isolated store, addressed automatically through every await in Inner and
 *  every method/gemmaExtract() call beneath it, with no parameter threading required through the
 *  ~20 intervening function signatures gemmaExtract() sits behind. */
const llmLedgerStorage = new AsyncLocalStorage<LlmCallCostRecord[]>();

/** Runs `fn` inside a fresh, empty LLM cost ledger scope and returns both fn's own result and the
 *  ledger any recordLlmCall() calls made anywhere underneath fn populated. Mirrors the Google
 *  leg's own closure-based wrapping (wrapAskGoogleWithCostInstrument) in spirit: one wrapping
 *  point, ALWAYS ON, never gated. */
export async function runWithLlmCostLedger<T>(fn: () => Promise<T>): Promise<{ result: T; ledger: LlmCallCostRecord[] }> {
  const ledger: LlmCallCostRecord[] = [];
  return llmLedgerStorage.run(ledger, async () => {
    const result = await fn();
    return { result, ledger };
  });
}

/** Called by comparative_cascade.ts's gemmaExtract() on every real Ollama round trip (ok or not),
 *  the SAME "every real call, ok or not" discipline wrapAskGoogleWithCostInstrument's sink already
 *  follows. Never throws on its own account -- a pricing failure is caught inside priceLlmLeg()
 *  and returns a named-reason unpriced record, never an exception that could kill a real
 *  extraction (same "an instrument that can kill a run is worse than no instrument" rule
 *  wrapAskGoogleWithCostInstrument's own doc comment states, SC-01's D-BP152-016). Safe to call
 *  with no active ledger scope (e.g. a test or a standalone script that calls gemmaExtract()
 *  directly without going through runLianaCycleQuestion()) -- the record is still computed and
 *  returned, it is simply not attached to any run's ledger, and a console.warn names why. */
export function recordLlmCall(input: {
  model: string;
  modelDigest: string | null;
  machineId?: string;
  ts_start: string;
  ts_end: string;
  latency_ms: number;
  tokens: LlmCallCostRecord['tokens'];
  /** D-BP165-M0-007, ADDITIVE OPTIONAL PARAMETER -- see LlmCallCostRecord.rawOutput's own doc
   *  comment. Every pre-existing call site omits this and is unaffected (undefined in, undefined
   *  out below). Pass the ALREADY-CAPPED result of compute_sidecar.ts's capRawModelOutput() --
   *  this function does not cap a second time, it only threads the field through. */
  rawOutput?: CappedRawOutput | null;
}): LlmCallCostRecord {
  const store = llmLedgerStorage.getStore();
  let dollars: LlmCallCostRecord['dollars'];
  try {
    dollars = priceLlmLeg(input.tokens);
  } catch (pricingErr) {
    console.warn('[CostInstrument] priceLlmLeg() failed unexpectedly (non-fatal, the real gemmaExtract() result is unaffected):', pricingErr);
    const reason = `pricing threw unexpectedly: ${pricingErr instanceof Error ? pricingErr.message : String(pricingErr)}`;
    dollars = {
      actual_usd: 0,
      actual_priced: false,
      actual_reason: reason,
      counterfactual_usd: null,
      counterfactual_priced: false,
      counterfactual_reason: reason,
      counterfactual_rate_source: null,
      counterfactual_model: null,
    };
  }
  const record: LlmCallCostRecord = {
    callIndex: (store?.length ?? 0) + 1,
    ts_start: input.ts_start,
    ts_end: input.ts_end,
    latency_ms: input.latency_ms,
    machineId: input.machineId ?? os.hostname(),
    model: input.model,
    modelDigest: input.modelDigest,
    leg: 'gemma-ollama-local-llm',
    tokens: input.tokens,
    dollars,
    ...(input.rawOutput !== undefined ? { rawOutput: input.rawOutput } : {}),
  };
  if (store) {
    store.push(record);
  } else {
    console.warn('[CostInstrument] recordLlmCall() invoked outside runWithLlmCostLedger() -- record computed but not attached to any run\'s ledger (expected for a standalone script or a test calling gemmaExtract() directly).');
  }
  return record;
}

/** D-BP200-M0-025, ADDITIVE EXPORT. Returns the LIVE array backing the currently-active
 *  AsyncLocalStorage ledger scope (the same store recordLlmCall() pushes onto), or null when no
 *  runWithLlmCostLedger() scope is active. Read-only use intended: a caller can snapshot
 *  `.length` before doing work and diff against a later snapshot to attribute a SUBSET of an
 *  in-flight ledger's records to one internal sub-step (e.g. plow_mc_answerer.ts's
 *  PLOW_ESCALATE_ON_VERBOSE needing to know just its own cheap first pass's output-token count
 *  without disturbing the outer harness's single whole-item ledger). Does not copy the array, so
 *  mutating the returned reference would corrupt the real ledger -- callers must only read it.
 *  Added because llmLedgerStorage itself is module-private by design (AsyncLocalStorage should
 *  not be handed out raw); this is a narrow, read-only peephole onto it, not a new sink. */
export function getCurrentLlmLedgerSnapshot(): LlmCallCostRecord[] | null {
  return llmLedgerStorage.getStore() ?? null;
}

/** Rolls a run's own LLM cost ledger up into a summary. Pure arithmetic over records already
 *  produced above -- never re-derives a dollar figure or a token count. Mirrors
 *  summarizeGoogleCostLedger()'s own empty-ledger convention: zero records summarizes to zero
 *  totals, not null (null is reserved for "records exist but at least one is unpriced"). */
export function summarizeLlmCostLedger(records: LlmCallCostRecord[], machineId: string = os.hostname()): LlmCostSummary {
  const totalInputTokens = records.reduce((s, r) => s + (r.tokens.measured ? r.tokens.input_tokens : 0), 0);
  const totalOutputTokens = records.reduce((s, r) => s + (r.tokens.measured ? r.tokens.output_tokens : 0), 0);
  const totalActualUsd = records.reduce((s, r) => s + (r.dollars.actual_priced ? r.dollars.actual_usd : 0), 0);
  const anyUnpricedCounterfactual = records.some((r) => !r.dollars.counterfactual_priced);
  const totalCounterfactualUsd = anyUnpricedCounterfactual
    ? null
    : records.reduce((s, r) => s + (r.dollars.counterfactual_usd ?? 0), 0);
  return {
    callCount: records.length,
    totalLatencyMs: records.reduce((s, r) => s + r.latency_ms, 0),
    totalInputTokens,
    totalOutputTokens,
    totalActualUsd,
    totalCounterfactualUsd,
    machineId,
  };
}
