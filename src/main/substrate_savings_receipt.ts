// substrate_savings_receipt.ts -- D-BP155-024 / BISHOP / seg-savings-meter
//
// The Founder's order, quoting his own licensing-paper analysis:
//   "This mechanism doesn't -- unless the substrate itself emits the measurement, which it
//   could, and which would be worth building into the license terms rather than the honor
//   system."
//
// This is that instrument. The license charges 20% of MEASURED savings (50% under Tier 2).
// A licensee self-reporting the number that sets its own bill has every incentive to report
// zero. This module emits one tamper-evident receipt per query, at the point the substrate
// router (substrate_router.ts query()) decides which tier answered it, and produces a period
// aggregate that shows what it could NOT measure as prominently as what it could.
//
// Design follows LianaBanyanPlatform/BISHOP_DROPZONE/
// SPEC_THE_COUPON_CLIPPER_PRICE_AWARE_ROUTING_AND_SAVINGS_METER_BP143.md Part Three, with one
// addition the spec left implicit and this dispatch made explicit: hash-chained tamper evidence,
// because these receipts determine a bill.
//
// TAMPER-EVIDENCE LIMITS (stated here and in the Return, per dispatch instruction):
//   - This is tamper-EVIDENT, not tamper-PROOF. Node's crypto.createHash('sha256') chains each
//     record to the previous record's hash, so editing or deleting a past line changes that
//     line's hash and breaks every hash after it -- verifyChain() finds the FIRST broken link.
//   - It does NOT stop a party who controls the whole file from deleting it and rewriting the
//     entire chain from scratch (no external anchor, no signature key, no append-only
//     filesystem enforcement). A verifier that only ever sees the file the licensee hands over
//     cannot distinguish "this chain is intact because nothing was edited" from "this chain is
//     intact because the whole thing was regenerated." True tamper-proofing needs an external
//     anchor (e.g. periodic hash publication somewhere the licensee does not control) which is
//     out of scope for this ticket and is named as an open item in the Return.
//
// D-BP155-029/BISHOP/seg-meter-net-and-auditlist (Founder-ordered fix, survivorship bias):
//   The meter's own author (this file) named the flaw and the Founder ordered it closed: "Cloud
//   escalations always record UNMEASURED actual cost, so the expensive queries never enter the
//   total. The aggregate is a lower bound over queries the substrate fully handled, not a net
//   statement across all your traffic." The cloud_escalation branch of emitSavingsReceipt() below
//   no longer hardcodes UNMEASURED -- it prices real provider-reported tokens exactly like
//   local_model does, whenever a caller carries them through (see ai_dispatch_ipc.ts's
//   dispatchViaBrain() + _emitCloudEscalationSavingsReceipt, the codebase's actual real-money
//   cloud-call site). computePeriodAggregate()'s new `measurement_scope` field states plainly, in
//   the output itself, that cost_avoided_usd is a NET figure across all traffic, not a lower
//   bound -- and `records_excluded_unmeasured_by_tier` shows, per tier, how much of that net
//   figure is still honestly unpriced (see the price-table-provenance gap named in the Return
//   and in SAVINGS_METER_AUDITOR_DISPUTE_LIST_BP155.md item 1).

import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { createHash, randomUUID } from 'crypto';
import { lookupRate, getCounterfactualDefaults, getUnpricedReason, type RateLookupResult } from './substrate_price_table';

// D-BP223-M0-h2cbpo68-032/SEG-M0/BP223-SAVINGS_INSTRUMENT: fixed, stable literal (the price
// table's local-member-hardware row's own `note` text is stable and long; this is the same
// disclaimer content in the short form the spec's hard rule requires actually reach a receipt).
const LOCAL_COST_BASIS_DISCLAIMER = 'excludes hardware and power; see price table disclaimer';

/** Appends a documented unpriced-model reason (see substrate_price_table.ts's
 *  UnpricedModelEntry) to a base "no rate found" basis string, when one has been recorded --
 *  distinguishes "confirmed absent from vendor pricing" from a bare, uninvestigated gap. */
function withUnpricedContext(baseMessage: string, modelId: string, tablePath: string | undefined): string {
  const documented = getUnpricedReason(modelId, tablePath);
  if (!documented) return baseMessage;
  return `${baseMessage}; DOCUMENTED: ${documented.unpriced_reason} (checked_on=${documented.checked_on})`;
}

// ─── Types ──────────────────────────────────────────────────────────────────

/** Which tier actually answered the query, mapped from substrate_router.ts's QueryResult.routing. */
export type SavingsTier = 'substrate_hit' | 'local_model' | 'cloud_escalation' | 'abstain';

export type Unmeasured = 'UNMEASURED';
export const UNMEASURED: Unmeasured = 'UNMEASURED';

export interface SavingsReceiptInput {
  /** Stable id for this query. Caller-supplied if the caller already has one, else generated. */
  query_id?: string;
  tier: SavingsTier;
  /** The router's own routing string, unmapped -- kept verbatim for audit against substrate_router.ts. */
  routing_raw: string;
  /** Model the caller REQUESTED (e.g. an Ollama tag, or the model_id sent in the Anthropic
   *  Messages API request body). Kept as the fallback pricing id -- see model_id_from_provider. */
  model_used: string | null;
  /** D-BP223-M0-h2cbpo68-MODEL_ROSTER/SEG-M0/BP223-MODEL_ROSTER: the exact model_id string the
   *  PROVIDER'S OWN RESPONSE echoed back (Anthropic Messages API's top-level `model` field on a
   *  successful response), when the caller carried one through. This is deliberately a SEPARATE
   *  field from model_used, not a replacement for it: model_used is what was requested, this is
   *  what the vendor says actually ran. They are usually identical, but a hardcoded/stale
   *  requested id, a vendor-side alias, or a future routing feature could make them differ --
   *  when they do, THIS is the id emitSavingsReceipt() prices against, per the Founder's own
   *  point that the savings meter (the licensing fee basis) must price the model that actually
   *  ran, not the one the code merely asked for. null/undefined when no provider response model
   *  field was carried through (e.g. a failed call, a provider/path that never reports one, or a
   *  local Ollama call -- see emitSavingsReceipt's own basis-string wording for how this is
   *  disclosed either way). */
  model_id_from_provider?: string | null;
  /** Real provider-reported token counts. null when the provider did not report one, or no call was made. */
  input_tokens: number | null;
  output_tokens: number | null;
  /** Real length in characters of the text actually served, if any -- used ONLY to size the
   *  counterfactual (hypothetical) flagship response, never the actual-cost side. */
  served_text_chars: number | null;
  latency_ms: number;
  degraded: boolean;
  /** ISO timestamp to price against. Defaults to now. Overridable for tests. */
  as_of?: string;
  /** Override table path -- tests point this at a fixture, never the real config file. */
  price_table_path?: string;
}

export interface SavingsReceipt {
  query_id: string;
  ts: string;
  tier: SavingsTier;
  routing_raw: string;
  model_used: string | null;
  /** D-BP223-M0-h2cbpo68-MODEL_ROSTER/SEG-M0/BP223-MODEL_ROSTER: the model_id THIS receipt's
   *  actual_cost_usd was actually priced against, ONLY when that id was confirmed by the
   *  provider's own response (never the requested id, never a guess). null whenever no
   *  provider-reported model id was carried through -- in that case, if actual_cost_usd is a real
   *  number at all, it was priced against model_used (the requested id) instead, and
   *  actual_cost_basis says so explicitly in words so a reader never mistakes "assumed from the
   *  request" for "confirmed by the vendor". See SavingsReceiptInput.model_id_from_provider. */
  model_id_actual: string | null;
  input_tokens: number | Unmeasured;
  output_tokens: number | Unmeasured;
  latency_ms: number;
  degraded: boolean;
  flagship_call_avoided: boolean;
  actual_cost_usd: number | Unmeasured;
  actual_cost_basis: string;
  /** D-BP155-029 item 4 / D-BP223-M0-h2cbpo68-032: present (non-null) ONLY when actual_cost_usd
   *  was priced against a price-table rate whose provider is "local" (i.e. a real $0 model-call
   *  cost, not an UNMEASURED gap). The spec's own hard rule (SPEC_...BP143.md:125): "Never claim
   *  a local-model cost of exactly zero... Either measure them or label the figure 'excluding
   *  hardware and power.'" The price table's local-member-hardware row has always carried this
   *  disclaimer in its own `note` field, but substrate_savings_receipt.ts never read that field
   *  before this fix -- the disclaimer existed and never reached a receipt. Null (not the empty
   *  string) whenever no local-provider rate was used this receipt, so a consumer can tell
   *  "not applicable" apart from "somehow blank." */
  local_cost_basis: string | null;
  counterfactual_model: string | Unmeasured;
  counterfactual_tokens_estimated: boolean;
  counterfactual_cost_usd: number | Unmeasured;
  counterfactual_basis: string;
  cost_avoided_usd: number | Unmeasured;
  price_table_version: string | Unmeasured;
  prev_hash: string;
  hash: string;
}

export interface ChainVerifyResult {
  ok: boolean;
  total_records: number;
  broken_at_index: number | null;
  broken_at_query_id: string | null;
  reason: string | null;
}

export interface PeriodAggregate {
  window: string;
  from_ts: string;
  to_ts: string;
  total_queries: number;
  by_tier: Record<SavingsTier, number>;
  flagship_calls_avoided: number;
  flagship_calls_made: number;
  /** Sum of cost_avoided_usd over records where it was a real number -- excludes UNMEASURED.
   *  See `measurement_scope` below for what this sum represents (NET, not a lower bound). */
  cost_avoided_usd: number;
  /** How many of total_queries contributed a numeric cost_avoided_usd to the sum above. */
  records_with_measured_saving: number;
  /** How many were excluded from the sum because a rate, count, or served text was missing. */
  records_excluded_unmeasured: number;
  /** D-BP155-029/BISHOP/seg-meter-net-and-auditlist: same exclusion count as
   *  records_excluded_unmeasured, broken out per tier, so a reader can see WHICH tier(s) are
   *  contributing the unmeasured count -- e.g. cloud_escalation records excluded because the
   *  price table has no rate for the model actually dispatched, even though real provider token
   *  counts were captured. This is what tells "instrumented but unpriced" (a config/price-table
   *  gap) apart from "never instrumented" (an architecture gap) -- see the dispute list. */
  records_excluded_unmeasured_by_tier: Record<SavingsTier, number>;
  /** D-BP155-029/BISHOP/seg-meter-net-and-auditlist (Founder-ordered fix, closing the
   *  survivorship-bias defect): states, unconditionally and in the output itself, what
   *  cost_avoided_usd above represents -- a NET figure across ALL traffic that reached a
   *  routing decision in this window (substrate_hit, local_model, cloud_escalation, abstain
   *  are ALL included in by_tier and in the from/to window scan), summed only over records
   *  where both actual_cost_usd and counterfactual_cost_usd were real numbers. It is NOT a
   *  lower bound restricted to substrate/local hits: a cloud_escalation record enters the sum
   *  exactly like any other tier once its provider reports real token counts AND the price
   *  table carries a rate for the model used. When cloud escalations are UNMEASURED (see
   *  records_excluded_unmeasured_by_tier.cloud_escalation), the resulting number is honestly a
   *  net figure over the SUBSET of traffic that was priceable this window, not a claim that no
   *  cloud spend occurred -- read this field together with records_excluded_unmeasured_by_tier,
   *  never cost_avoided_usd alone. */
  measurement_scope: string;
  confidence: string;
}

// ─── Paths ──────────────────────────────────────────────────────────────────

let _logPathOverride: string | null = null;

/** Test-only hook: point the receipt log at a temp file so tests never touch the real store. */
export function _setLogPathForTests(path: string | null): void {
  _logPathOverride = path;
}

function logPath(): string {
  if (_logPathOverride) return _logPathOverride;
  // Mirrors the existing meter convention (answer_cache_meter.ts, csia_meter.ts): under
  // Electron's userData/substrate. Falls back to a local path when `electron` isn't available
  // (e.g. running under vitest outside Electron's runtime).
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = require('electron');
    return resolve(app.getPath('userData'), 'substrate', 'savings_receipts.jsonl');
  } catch {
    return resolve(process.env.APPDATA || process.env.HOME || '.', 'AMPLIFY Computer', 'savings_receipts.jsonl');
  }
}

function ensureDir(path: string): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// ─── Hashing ────────────────────────────────────────────────────────────────

const GENESIS_HASH = 'GENESIS';

/** Canonical (key-sorted) JSON so hash computation is stable regardless of property insertion order. */
function canonicalize(obj: Record<string, unknown>): string {
  const sortedKeys = Object.keys(obj).sort();
  const sorted: Record<string, unknown> = {};
  for (const k of sortedKeys) sorted[k] = obj[k];
  return JSON.stringify(sorted);
}

function computeHash(recordWithoutHash: Omit<SavingsReceipt, 'hash'>): string {
  return createHash('sha256').update(canonicalize(recordWithoutHash)).digest('hex');
}

function readLastHash(path: string): string {
  if (!existsSync(path)) return GENESIS_HASH;
  const raw = readFileSync(path, 'utf-8').trim();
  if (!raw) return GENESIS_HASH;
  const lines = raw.split('\n');
  try {
    const last = JSON.parse(lines[lines.length - 1]) as SavingsReceipt;
    return last.hash;
  } catch {
    return GENESIS_HASH;
  }
}

// ─── Cost computation ───────────────────────────────────────────────────────

const M = 1_000_000;

function actualCostFromRate(
  rate: RateLookupResult,
  inputTokens: number,
  outputTokens: number,
): number {
  if (!rate.ok) return NaN;
  return (inputTokens / M) * rate.rate.input_per_mtok_usd + (outputTokens / M) * rate.rate.output_per_mtok_usd;
}

/**
 * Build and append one tamper-evident savings receipt. Returns the record that was written.
 * Never fabricates a number: every field that could not be honestly measured is UNMEASURED,
 * and cost_avoided_usd is UNMEASURED whenever either side of the subtraction is.
 */
export function emitSavingsReceipt(input: SavingsReceiptInput): SavingsReceipt {
  const asOf = input.as_of ?? new Date().toISOString();
  const tablePath = input.price_table_path;
  const queryId = input.query_id ?? randomUUID();

  // ── Actual cost: real counts + real rate only, or a true (not guessed) zero, or UNMEASURED.
  let actual_cost_usd: number | Unmeasured = UNMEASURED;
  let actual_cost_basis: string;
  let flagship_call_avoided: boolean;
  // D-BP155-029 item 4 / D-BP223-M0-h2cbpo68-032: null unless a local-provider rate priced this
  // receipt -- see the SavingsReceipt field's own doc comment for why this must reach the
  // receipt itself, not stay buried in the price table's JSON `note` field.
  let local_cost_basis: string | null = null;
  // D-BP223-M0-h2cbpo68-MODEL_ROSTER: null unless a provider-reported model id (never the
  // requested id) priced this receipt's actual_cost_usd -- see the SavingsReceipt field's doc.
  let model_id_actual: string | null = null;

  if (input.tier === 'substrate_hit') {
    // No model call happened at all -- a real, known zero, not an estimate.
    actual_cost_usd = 0;
    actual_cost_basis = 'substrate hit served from an existing local record; no model call was made, so actual cost is a real zero, not an estimate';
    flagship_call_avoided = true;
  } else if (input.tier === 'local_model') {
    flagship_call_avoided = true;
    if (input.input_tokens == null || input.output_tokens == null || !input.model_used) {
      actual_cost_basis = 'local model served the query but real token counts were not reported by the provider; recorded as UNMEASURED rather than guessed';
    } else {
      // D-BP223-M0-h2cbpo68-MODEL_ROSTER: price what actually ran. When the provider's own
      // response carried a model id, price THAT id and record it as model_id_actual; only when
      // it did not do we fall back to pricing the requested id (model_used), and the basis string
      // says explicitly which of the two happened so a reader never confuses the two.
      const pricedModelId = input.model_id_from_provider ?? input.model_used;
      const rate = lookupRate(pricedModelId, asOf, tablePath);
      if (!rate.ok) {
        actual_cost_basis = withUnpricedContext(
          `local model "${pricedModelId}" cost could not be priced: ${rate.reason} (${rate.detail})`,
          pricedModelId,
          tablePath,
        );
      } else {
        actual_cost_usd = actualCostFromRate(rate, input.input_tokens, input.output_tokens);
        model_id_actual = input.model_id_from_provider ?? null;
        actual_cost_basis = input.model_id_from_provider
          ? `priced at ${pricedModelId} table rate (PROVIDER-CONFIRMED model id, requested was "${input.model_used}"), price_table_version=${rate.table_version}, real provider token counts`
          : `priced at ${pricedModelId} table rate (REQUESTED model id; provider did not report a model field to confirm what actually ran), price_table_version=${rate.table_version}, real provider token counts`;
        if (rate.rate.provider === 'local') {
          // D-BP155-029 item 4: the spec's hard rule ("Never claim a local-model cost of exactly
          // zero... label the figure 'excluding hardware and power'") was satisfied in the price
          // table's own JSON `note` field since 2026-08-03 but never read by this file until now.
          local_cost_basis = LOCAL_COST_BASIS_DISCLAIMER;
        }
      }
    }
  } else if (input.tier === 'cloud_escalation') {
    // D-BP155-029/BISHOP/seg-meter-net-and-auditlist: this branch used to hardcode UNMEASURED
    // for every cloud_escalation record regardless of what `input` carried -- exactly the
    // survivorship-bias defect the Founder named: "Cloud escalations always record UNMEASURED
    // actual cost, so the expensive queries never enter the total." Fixed by pricing this
    // EXACTLY like local_model above: a real provider-reported input/output token count, a
    // real model_used, and a price-table rate for that model_id together produce a real number;
    // anything missing produces UNMEASURED, never a guess. The caller now carries real usage
    // through this path for the calls that actually spend money -- see
    // ai_dispatch_ipc.ts's dispatchViaBrain() (Anthropic Messages API's own `usage.input_tokens`/
    // `usage.output_tokens` field) and its _emitCloudEscalationSavingsReceipt call sites. The
    // OTHER cloud_escalation source in this codebase, substrate_router.ts's SubstrateRouter.query()
    // Step 3, is a routing SIGNAL that never itself makes a network call (see that file's own
    // comment at Step 3) -- receipts emitted from THAT path still correctly resolve UNMEASURED
    // below, honestly, because no real tokens/model ever reach this function from there.
    flagship_call_avoided = false;
    if (input.input_tokens == null || input.output_tokens == null || !input.model_used) {
      actual_cost_basis = 'cloud escalation was triggered but real provider-reported token counts and/or a model_used were not carried through to this receipt (this is expected from substrate_router.ts\'s routing-signal-only cloud_escalation, which never itself makes a network call); recorded as UNMEASURED rather than guessed';
    } else {
      // D-BP223-M0-h2cbpo68-MODEL_ROSTER/SEG-M0/BP223-MODEL_ROSTER: "the savings meter ... must
      // price the model that actually ran." When ai_dispatch_ipc.ts's dispatchViaBrain() carried
      // the Anthropic Messages API response's own top-level `model` field through as
      // model_id_from_provider, THAT id is what gets priced and recorded as model_id_actual --
      // never the requested id, even though in practice they are usually identical. Only when no
      // provider-confirmed id is available do we fall back to pricing the requested id
      // (model_used), and the basis string always says explicitly which of the two happened.
      const pricedModelId = input.model_id_from_provider ?? input.model_used;
      const rate = lookupRate(pricedModelId, asOf, tablePath);
      if (!rate.ok) {
        actual_cost_basis = withUnpricedContext(
          `cloud model "${pricedModelId}" cost could not be priced: ${rate.reason} (${rate.detail})`,
          pricedModelId,
          tablePath,
        );
      } else {
        actual_cost_usd = actualCostFromRate(rate, input.input_tokens, input.output_tokens);
        model_id_actual = input.model_id_from_provider ?? null;
        actual_cost_basis = input.model_id_from_provider
          ? `priced at ${pricedModelId} table rate (PROVIDER-CONFIRMED model id via Anthropic Messages API response's own \`model\` field, requested was "${input.model_used}"), price_table_version=${rate.table_version}, real provider-reported token counts`
          : `priced at ${pricedModelId} table rate (REQUESTED model id; the Anthropic Messages API response did not carry a \`model\` field through to this receipt to confirm what actually ran), price_table_version=${rate.table_version}, real provider-reported token counts`;
      }
    }
  } else {
    // abstain (miss / peer_sync)
    actual_cost_usd = 0;
    flagship_call_avoided = false;
    actual_cost_basis = 'no tier answered the query (abstain); no call was made by the substrate layer, so actual cost is a real zero, but nothing was served either';
  }

  // ── Counterfactual: what a named flagship model would have cost for this SAME query.
  // Only computable when we know how much text was actually produced (substrate_hit / local_model)
  // to size the hypothetical response. Character length is REAL; the chars->tokens conversion is
  // a disclosed approximation, never presented as a measured count.
  let counterfactual_model: string | Unmeasured = UNMEASURED;
  let counterfactual_cost_usd: number | Unmeasured = UNMEASURED;
  let counterfactual_basis: string;
  let counterfactual_tokens_estimated = false;

  const cfDefaults = getCounterfactualDefaults(tablePath);
  if (!cfDefaults) {
    counterfactual_basis = 'price table unreadable; counterfactual defaults unavailable';
  } else if (input.served_text_chars == null || input.served_text_chars <= 0) {
    counterfactual_basis = 'no served text to size a hypothetical flagship response against (tier did not produce an answer at this hop)';
  } else {
    const estTokens = Math.max(1, Math.round(input.served_text_chars * cfDefaults.tokensPerChar));
    const cfRate = lookupRate(cfDefaults.defaultModel, asOf, tablePath);
    counterfactual_model = cfDefaults.defaultModel;
    counterfactual_tokens_estimated = true;
    if (!cfRate.ok) {
      counterfactual_basis = `counterfactual model "${cfDefaults.defaultModel}" could not be priced: ${cfRate.reason} (${cfRate.detail})`;
    } else {
      // Counterfactual assumes the same served length would have been the flagship's output;
      // no input-token counterfactual is claimed (input is identical regardless of tier and is
      // not counted here to avoid double-charging it against both sides of the comparison).
      counterfactual_cost_usd = (estTokens / M) * cfRate.rate.output_per_mtok_usd;
      counterfactual_basis = `assumes a single ${cfDefaults.defaultModel} call would have produced the same served length (${input.served_text_chars} chars, ~${estTokens} tokens via ${cfDefaults.tokensPerChar} tokens/char, ${cfDefaults.basis}), priced at output rate only, table_version=${cfRate.table_version}. This is a STATED ASSUMPTION, not a fact -- disagree with it by disagreeing with the response-length estimate.`;
    }
  }

  const cost_avoided_usd: number | Unmeasured =
    typeof actual_cost_usd === 'number' && typeof counterfactual_cost_usd === 'number'
      ? counterfactual_cost_usd - actual_cost_usd
      : UNMEASURED;

  const path = logPath();
  ensureDir(path);
  const prev_hash = readLastHash(path);

  const withoutHash: Omit<SavingsReceipt, 'hash'> = {
    query_id: queryId,
    ts: asOf,
    tier: input.tier,
    routing_raw: input.routing_raw,
    model_used: input.model_used,
    model_id_actual,
    input_tokens: input.input_tokens ?? UNMEASURED,
    output_tokens: input.output_tokens ?? UNMEASURED,
    latency_ms: input.latency_ms,
    degraded: input.degraded,
    flagship_call_avoided,
    actual_cost_usd,
    local_cost_basis,
    actual_cost_basis,
    counterfactual_model,
    counterfactual_tokens_estimated,
    counterfactual_cost_usd,
    counterfactual_basis,
    cost_avoided_usd,
    price_table_version: cfDefaults ? (lookupRate(cfDefaults.defaultModel, asOf, tablePath).table_version) : UNMEASURED,
    prev_hash,
  };

  // prev_hash is included in withoutHash (and therefore in the hashed content) precisely so
  // that tampering with a record's prev_hash pointer is itself detected -- see verifySavingsChain.
  const hash = computeHash(withoutHash);
  const record: SavingsReceipt = { ...withoutHash, hash };

  appendFileSync(path, JSON.stringify(record) + '\n', 'utf-8');
  return record;
}

// ─── Verification ───────────────────────────────────────────────────────────

/**
 * Walk the hash chain and report the FIRST broken link, if any.
 * Tamper-EVIDENT only -- see the header comment for what this cannot detect.
 */
export function verifySavingsChain(path: string = logPath()): ChainVerifyResult {
  if (!existsSync(path)) {
    return { ok: true, total_records: 0, broken_at_index: null, broken_at_query_id: null, reason: null };
  }
  const raw = readFileSync(path, 'utf-8').trim();
  if (!raw) {
    return { ok: true, total_records: 0, broken_at_index: null, broken_at_query_id: null, reason: null };
  }
  const lines = raw.split('\n');
  let expectedPrev = GENESIS_HASH;

  for (let i = 0; i < lines.length; i++) {
    let record: SavingsReceipt;
    try {
      record = JSON.parse(lines[i]) as SavingsReceipt;
    } catch {
      return {
        ok: false,
        total_records: lines.length,
        broken_at_index: i,
        broken_at_query_id: null,
        reason: `line ${i} is not valid JSON (malformed or truncated)`,
      };
    }

    if (record.prev_hash !== expectedPrev) {
      return {
        ok: false,
        total_records: lines.length,
        broken_at_index: i,
        broken_at_query_id: record.query_id,
        reason: `record at index ${i} (query_id=${record.query_id}) has prev_hash="${record.prev_hash}" but the chain expected "${expectedPrev}" -- a record before it was edited, deleted, or reordered`,
      };
    }

    const { hash, ...rest } = record;
    const recomputed = computeHash(rest);
    if (recomputed !== hash) {
      return {
        ok: false,
        total_records: lines.length,
        broken_at_index: i,
        broken_at_query_id: record.query_id,
        reason: `record at index ${i} (query_id=${record.query_id}) has hash="${hash}" but its own content recomputes to "${recomputed}" -- this record's fields were edited after it was written`,
      };
    }

    expectedPrev = record.hash;
  }

  return { ok: true, total_records: lines.length, broken_at_index: null, broken_at_query_id: null, reason: null };
}

// ─── External anchor (item 6, cheapest form) ───────────────────────────────

export interface AnchorDigest {
  /** The hash-chain's current tip, i.e. the `hash` field of the last record in the log, or the
   *  GENESIS sentinel if the log is empty. Identical to what readLastHash() computes internally
   *  for the NEXT record's prev_hash -- this is that same value, exposed for external publication. */
  chain_head_hash: string;
  /** How many records the chain has as of this snapshot -- lets a verifier notice a HEAD that
   *  moved without the record count moving (would itself be a red flag) or vice versa. */
  total_records: number;
  /** UTC ISO timestamp this digest was computed, NOT the timestamp of the last record. */
  anchored_at: string;
  /** Which receipts log this digest was computed from -- carried through so a published anchor
   *  is self-describing without needing separate context. */
  source_log_path: string;
}

/**
 * D-BP155-029 item 6 (cheapest credible mitigation) / D-BP223-M0-h2cbpo68-032: the hash chain
 * (verifySavingsChain above) is tamper-EVIDENT against edits to an existing file, but -- as this
 * file's own header has said since the meter was first built -- it cannot detect a party who
 * controls the whole file deleting it and regenerating a clean chain from scratch. This function
 * is the read side of the cheapest real fix named in the dispute list: compute the current
 * chain's tip hash and UTC time so SOMETHING outside the licensee's own file can publish it.
 * This function does NOT publish anywhere itself -- it has no scheduler, no network call, and no
 * opinion about where the digest goes. See HARDWIRE/tools/controls/savings_anchor_publish.mjs
 * for the (also unscheduled, run-by-hand) append-only publish step. Wiring EITHER of these to a
 * timer is MUTATE-SYSTEM (a standing, persistent, automated behavior change) and is above any
 * seat's rank per this estate's own discipline -- named here, not built here.
 */
export function anchorDigest(path: string = logPath()): AnchorDigest {
  return {
    chain_head_hash: readLastHash(path),
    total_records: readAllRecordsForAnchor(path),
    anchored_at: new Date().toISOString(),
    source_log_path: path,
  };
}

/** Local helper so anchorDigest() does not need to import readAllRecords() before it is declared
 *  further down this file (readAllRecords is defined in the Period Aggregate section below). A
 *  plain line count is sufficient here -- malformed lines are verifySavingsChain's job to catch,
 *  not this counter's. */
function readAllRecordsForAnchor(path: string): number {
  if (!existsSync(path)) return 0;
  const raw = readFileSync(path, 'utf-8').trim();
  if (!raw) return 0;
  return raw.split('\n').length;
}

// ─── Period aggregate ───────────────────────────────────────────────────────

const TIER_ORDER: SavingsTier[] = ['substrate_hit', 'local_model', 'cloud_escalation', 'abstain'];

function readAllRecords(path: string): SavingsReceipt[] {
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, 'utf-8').trim();
  if (!raw) return [];
  const out: SavingsReceipt[] = [];
  for (const line of raw.split('\n')) {
    try {
      out.push(JSON.parse(line) as SavingsReceipt);
    } catch {
      // skip malformed line -- verifySavingsChain is the tool for detecting this, not this aggregate
    }
  }
  return out;
}

/**
 * Explicit reporting step -- never computed automatically on every write (per spec: "a human or
 * an explicit reporting step produces a total"). Shows what could NOT be measured as prominently
 * as what could: records_excluded_unmeasured and confidence are always present, never buried.
 * A zero-savings period reports zero, not "no data" -- see the d) test.
 */
export function computePeriodAggregate(
  windowLabel: string,
  fromIso: string,
  toIso: string,
  path: string = logPath(),
): PeriodAggregate {
  const all = readAllRecords(path);
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  const inWindow = all.filter((r) => {
    const t = new Date(r.ts).getTime();
    return t >= from && t <= to;
  });

  const by_tier = TIER_ORDER.reduce((acc, t) => {
    acc[t] = 0;
    return acc;
  }, {} as Record<SavingsTier, number>);
  for (const r of inWindow) by_tier[r.tier] = (by_tier[r.tier] ?? 0) + 1;

  const flagship_calls_avoided = inWindow.filter((r) => r.flagship_call_avoided).length;
  const flagship_calls_made = inWindow.filter((r) => r.tier === 'cloud_escalation').length;

  const measured = inWindow.filter((r) => typeof r.cost_avoided_usd === 'number');
  const cost_avoided_usd = measured.reduce((s, r) => s + (r.cost_avoided_usd as number), 0);
  const records_with_measured_saving = measured.length;
  const records_excluded_unmeasured = inWindow.length - measured.length;

  const records_excluded_unmeasured_by_tier = TIER_ORDER.reduce((acc, t) => {
    acc[t] = 0;
    return acc;
  }, {} as Record<SavingsTier, number>);
  for (const r of inWindow) {
    if (typeof r.cost_avoided_usd !== 'number') {
      records_excluded_unmeasured_by_tier[r.tier] = (records_excluded_unmeasured_by_tier[r.tier] ?? 0) + 1;
    }
  }

  const measurement_scope =
    'NET figure across ALL traffic that reached a routing decision in this window ' +
    '(substrate_hit, local_model, cloud_escalation, abstain all included) -- NOT a lower bound ' +
    'restricted to substrate/local hits. cost_avoided_usd sums only records where both ' +
    'actual_cost_usd and counterfactual_cost_usd were real numbers; see ' +
    'records_excluded_unmeasured_by_tier for which tier(s) contributed the exclusions -- a ' +
    'nonzero cloud_escalation count there means real cloud spend occurred this window that is ' +
    'NOT reflected in cost_avoided_usd (unpriced, not unmeasured-by-design). Read this field ' +
    'together with records_excluded_unmeasured_by_tier, never cost_avoided_usd alone.';

  const confidence =
    inWindow.length === 0
      ? 'no records in this window'
      : `${records_with_measured_saving}/${inWindow.length} records had a computable saving; ${records_excluded_unmeasured} excluded as UNMEASURED (missing rate, missing token count, or no served text to size a counterfactual)`;

  return {
    window: windowLabel,
    from_ts: fromIso,
    to_ts: toIso,
    total_queries: inWindow.length,
    by_tier,
    flagship_calls_avoided,
    flagship_calls_made,
    cost_avoided_usd,
    records_with_measured_saving,
    records_excluded_unmeasured,
    records_excluded_unmeasured_by_tier,
    measurement_scope,
    confidence,
  };
}

/**
 * D-BP223-BM09-ARCHBISHOP-004-016 ("My Savings Receipt"): the first record's own `ts`, or null
 * when the chain is empty. Used to compute days-in-use and the elapsed-time half of the launch
 * incentive's milestone gates (see savings_receipt_milestones.ts) -- reads the raw file directly
 * via the same readAllRecords() every other reporting function here uses, rather than duplicating
 * its parse-and-skip-malformed-lines logic at the call site.
 */
export function getFirstRecordTimestamp(path: string = logPath()): string | null {
  const all = readAllRecords(path);
  return all.length > 0 ? all[0].ts : null;
}

export { logPath as _savingsReceiptLogPathForTests };
