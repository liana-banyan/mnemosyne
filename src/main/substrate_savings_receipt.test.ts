// substrate_savings_receipt.test.ts -- D-BP155-024 / BISHOP / seg-savings-meter
//
// Every test points the receipt log AND the price table at files under a per-run temp
// directory (never the real userData store, never the real config/substrate_price_table.json)
// so running these tests can never contaminate a live store. See Return item (f)/contamination
// note for the before/after hash proof on the real files.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { resolve, join } from 'path';
import {
  emitSavingsReceipt,
  verifySavingsChain,
  computePeriodAggregate,
  _setLogPathForTests,
  UNMEASURED,
} from './substrate_savings_receipt';

let tmpDir: string;
let logFile: string;
let priceTablePath: string;

const FRESH_TABLE = {
  table_version: 'test-table-v1',
  stale_after_days: 90,
  default_counterfactual_model: 'claude-sonnet-5',
  counterfactual_tokens_per_char: { value: 0.25, basis: 'test heuristic' },
  rates: [
    {
      model_id: 'claude-sonnet-5',
      provider: 'anthropic',
      input_per_mtok_usd: 2.0,
      output_per_mtok_usd: 10.0,
      effective_from: '2026-01-01',
      effective_until: null,
      source_url: 'test-fixture',
      verified_on: '2026-08-03',
      verified_by: 'test',
    },
    {
      model_id: 'qwen2.5:0.5b',
      provider: 'local',
      input_per_mtok_usd: 0,
      output_per_mtok_usd: 0,
      effective_from: '2026-01-01',
      effective_until: null,
      source_url: 'test-fixture',
      verified_on: '2026-08-03',
      verified_by: 'test',
    },
  ],
};

const STALE_TABLE = {
  ...FRESH_TABLE,
  table_version: 'test-table-stale',
  rates: FRESH_TABLE.rates.map((r) => ({ ...r, verified_on: '2020-01-01' })), // far outside stale_after_days
};

function writeTable(table: unknown): void {
  writeFileSync(priceTablePath, JSON.stringify(table, null, 2), 'utf-8');
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'mnemo-savings-receipt-test-'));
  logFile = resolve(tmpDir, 'savings_receipts.jsonl');
  priceTablePath = resolve(tmpDir, 'price_table.json');
  writeTable(FRESH_TABLE);
  _setLogPathForTests(logFile);
});

afterEach(() => {
  _setLogPathForTests(null);
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('substrate_savings_receipt: basic emission', () => {
  it('emits a substrate_hit receipt with a real zero actual cost, chained from GENESIS', () => {
    const r = emitSavingsReceipt({
      tier: 'substrate_hit',
      routing_raw: 'substrate_hit',
      model_used: null,
      input_tokens: null,
      output_tokens: null,
      served_text_chars: 400,
      latency_ms: 5,
      degraded: false,
      as_of: '2026-08-15T00:00:00.000Z',
      price_table_path: priceTablePath,
    });
    expect(r.actual_cost_usd).toBe(0);
    expect(r.prev_hash).toBe('GENESIS');
    expect(r.flagship_call_avoided).toBe(true);
    expect(typeof r.counterfactual_cost_usd).toBe('number');
    expect(typeof r.cost_avoided_usd).toBe('number');
    expect(existsSync(logFile)).toBe(true);
  });

  it('chains a second record to the first record\'s hash', () => {
    const first = emitSavingsReceipt({
      tier: 'substrate_hit', routing_raw: 'substrate_hit', model_used: null,
      input_tokens: null, output_tokens: null, served_text_chars: 100, latency_ms: 1,
      degraded: false, as_of: '2026-08-15T00:00:00.000Z', price_table_path: priceTablePath,
    });
    const second = emitSavingsReceipt({
      tier: 'abstain', routing_raw: 'miss', model_used: null,
      input_tokens: null, output_tokens: null, served_text_chars: null, latency_ms: 1,
      degraded: false, as_of: '2026-08-15T00:01:00.000Z', price_table_path: priceTablePath,
    });
    expect(second.prev_hash).toBe(first.hash);
  });
});

describe('substrate_savings_receipt: (b) hash chain detects an edited record', () => {
  it('verifySavingsChain reports ok on an untouched chain', () => {
    emitSavingsReceipt({
      tier: 'local_model', routing_raw: 'local_ollama', model_used: 'qwen2.5:0.5b',
      input_tokens: 50, output_tokens: 120, served_text_chars: 480, latency_ms: 900,
      degraded: false, as_of: '2026-08-15T00:00:00.000Z', price_table_path: priceTablePath,
    });
    emitSavingsReceipt({
      tier: 'substrate_hit', routing_raw: 'substrate_hit', model_used: null,
      input_tokens: null, output_tokens: null, served_text_chars: 200, latency_ms: 3,
      degraded: false, as_of: '2026-08-15T00:01:00.000Z', price_table_path: priceTablePath,
    });
    const result = verifySavingsChain(logFile);
    expect(result.ok).toBe(true);
    expect(result.total_records).toBe(2);
    expect(result.broken_at_index).toBe(null);
  });

  it('names the FIRST break when an early record is edited after the fact', () => {
    emitSavingsReceipt({
      tier: 'local_model', routing_raw: 'local_ollama', model_used: 'qwen2.5:0.5b',
      input_tokens: 50, output_tokens: 120, served_text_chars: 480, latency_ms: 900,
      degraded: false, as_of: '2026-08-15T00:00:00.000Z', price_table_path: priceTablePath,
    });
    const second = emitSavingsReceipt({
      tier: 'substrate_hit', routing_raw: 'substrate_hit', model_used: null,
      input_tokens: null, output_tokens: null, served_text_chars: 200, latency_ms: 3,
      degraded: false, as_of: '2026-08-15T00:01:00.000Z', price_table_path: priceTablePath,
    });
    const third = emitSavingsReceipt({
      tier: 'abstain', routing_raw: 'miss', model_used: null,
      input_tokens: null, output_tokens: null, served_text_chars: null, latency_ms: 1,
      degraded: false, as_of: '2026-08-15T00:02:00.000Z', price_table_path: priceTablePath,
    });

    // Tamper: rewrite the FIRST line's latency_ms after the fact, as a licensee trying to make
    // a query look slower/cheaper/whatever would do. Re-derive prev_hash chain naively (as an
    // unsophisticated tamperer would -- just editing the JSON, not recomputing anything).
    const lines = readFileSync(logFile, 'utf-8').trim().split('\n');
    const tampered = JSON.parse(lines[0]);
    tampered.latency_ms = 1; // was 900
    lines[0] = JSON.stringify(tampered);
    writeFileSync(logFile, lines.join('\n') + '\n', 'utf-8');

    const result = verifySavingsChain(logFile);
    expect(result.ok).toBe(false);
    // First break must be reported at index 0 (the record that was actually edited), not later.
    expect(result.broken_at_index).toBe(0);
    expect(result.reason).toMatch(/recomputes to/);
    // Sanity: second/third records were never touched, confirming this is specifically about
    // the edited record being named, not a global failure.
    expect(second.hash).not.toBe('');
    expect(third.hash).not.toBe('');
  });

  it('detects deletion of a middle record via a prev_hash mismatch', () => {
    emitSavingsReceipt({
      tier: 'local_model', routing_raw: 'local_ollama', model_used: 'qwen2.5:0.5b',
      input_tokens: 50, output_tokens: 120, served_text_chars: 480, latency_ms: 900,
      degraded: false, as_of: '2026-08-15T00:00:00.000Z', price_table_path: priceTablePath,
    });
    emitSavingsReceipt({
      tier: 'substrate_hit', routing_raw: 'substrate_hit', model_used: null,
      input_tokens: null, output_tokens: null, served_text_chars: 200, latency_ms: 3,
      degraded: false, as_of: '2026-08-15T00:01:00.000Z', price_table_path: priceTablePath,
    });
    emitSavingsReceipt({
      tier: 'abstain', routing_raw: 'miss', model_used: null,
      input_tokens: null, output_tokens: null, served_text_chars: null, latency_ms: 1,
      degraded: false, as_of: '2026-08-15T00:02:00.000Z', price_table_path: priceTablePath,
    });

    const lines = readFileSync(logFile, 'utf-8').trim().split('\n');
    lines.splice(1, 1); // delete the middle record entirely
    writeFileSync(logFile, lines.join('\n') + '\n', 'utf-8');

    const result = verifySavingsChain(logFile);
    expect(result.ok).toBe(false);
    expect(result.broken_at_index).toBe(1); // the (formerly third) record now fails its prev_hash check
    expect(result.reason).toMatch(/prev_hash/);
  });
});

describe('substrate_savings_receipt: (c) missing rate yields UNMEASURED and is excluded', () => {
  it('a model with no price-table entry produces UNMEASURED actual cost', () => {
    const r = emitSavingsReceipt({
      tier: 'local_model', routing_raw: 'local_ollama', model_used: 'some-unpriced-model:9000b',
      input_tokens: 100, output_tokens: 100, served_text_chars: 400, latency_ms: 500,
      degraded: false, as_of: '2026-08-15T00:00:00.000Z', price_table_path: priceTablePath,
    });
    expect(r.actual_cost_usd).toBe(UNMEASURED);
    expect(r.actual_cost_basis).toMatch(/no_rate_for_model/);
    expect(r.cost_avoided_usd).toBe(UNMEASURED);
  });

  it('a stale price table (verified_on past stale_after_days) also produces UNMEASURED, never a guess', () => {
    writeTable(STALE_TABLE);
    const r = emitSavingsReceipt({
      tier: 'local_model', routing_raw: 'local_ollama', model_used: 'qwen2.5:0.5b',
      input_tokens: 100, output_tokens: 100, served_text_chars: 400, latency_ms: 500,
      degraded: false, as_of: '2026-08-15T00:00:00.000Z', price_table_path: priceTablePath,
    });
    // qwen local rate is $0/$0 so actual_cost_usd would be a real 0 even if priced; use the
    // counterfactual side instead, which prices claude-sonnet-5 and IS affected by staleness.
    expect(r.counterfactual_cost_usd).toBe(UNMEASURED);
    expect(r.counterfactual_basis).toMatch(/stale_price_table/);
  });

  it('the period aggregate excludes UNMEASURED records from the sum and reports the exclusion count', () => {
    // One priced record (counts toward the sum) ...
    emitSavingsReceipt({
      tier: 'substrate_hit', routing_raw: 'substrate_hit', model_used: null,
      input_tokens: null, output_tokens: null, served_text_chars: 400, latency_ms: 5,
      degraded: false, as_of: '2026-08-15T00:00:00.000Z', price_table_path: priceTablePath,
    });
    // ... and one unpriced record (must be excluded, not defaulted to zero).
    emitSavingsReceipt({
      tier: 'local_model', routing_raw: 'local_ollama', model_used: 'some-unpriced-model:9000b',
      input_tokens: 100, output_tokens: 100, served_text_chars: 400, latency_ms: 500,
      degraded: false, as_of: '2026-08-15T00:01:00.000Z', price_table_path: priceTablePath,
    });

    const agg = computePeriodAggregate(
      'test-window', '2026-08-14T00:00:00.000Z', '2026-08-16T00:00:00.000Z', logFile,
    );
    expect(agg.total_queries).toBe(2);
    expect(agg.records_with_measured_saving).toBe(1);
    expect(agg.records_excluded_unmeasured).toBe(1);
    expect(agg.confidence).toMatch(/1\/2 records had a computable saving/);
    expect(agg.confidence).toMatch(/1 excluded as UNMEASURED/);
  });
});

describe('substrate_savings_receipt: (d) a zero-savings period reports zero, not absence', () => {
  it('an all-abstain period reports cost_avoided_usd = 0 with real record counts, not "no data"', () => {
    emitSavingsReceipt({
      tier: 'abstain', routing_raw: 'miss', model_used: null,
      input_tokens: null, output_tokens: null, served_text_chars: null, latency_ms: 2,
      degraded: false, as_of: '2026-08-15T00:00:00.000Z', price_table_path: priceTablePath,
    });
    emitSavingsReceipt({
      tier: 'abstain', routing_raw: 'peer_sync', model_used: null,
      input_tokens: null, output_tokens: null, served_text_chars: null, latency_ms: 2,
      degraded: false, as_of: '2026-08-15T00:01:00.000Z', price_table_path: priceTablePath,
    });

    const agg = computePeriodAggregate(
      'test-window', '2026-08-14T00:00:00.000Z', '2026-08-16T00:00:00.000Z', logFile,
    );
    expect(agg.total_queries).toBe(2);
    expect(agg.cost_avoided_usd).toBe(0);
    expect(agg.flagship_calls_avoided).toBe(0);
    expect(agg.flagship_calls_made).toBe(0);
    expect(agg.by_tier.abstain).toBe(2);
    // The number 0 must actually be present (not undefined/null) -- this is the "cannot produce
    // an unflattering number is not an instrument" test.
    expect(agg.cost_avoided_usd).not.toBeUndefined();
    expect(typeof agg.cost_avoided_usd).toBe('number');
  });

  it('an empty period (no records at all) still returns a well-formed zero report', () => {
    const agg = computePeriodAggregate(
      'empty-window', '2026-08-14T00:00:00.000Z', '2026-08-16T00:00:00.000Z', logFile,
    );
    expect(agg.total_queries).toBe(0);
    expect(agg.cost_avoided_usd).toBe(0);
    expect(agg.confidence).toBe('no records in this window');
  });
});

describe('substrate_savings_receipt: cloud_escalation and abstain never claim an avoided flagship call', () => {
  it('cloud_escalation records flagship_call_avoided=false and UNMEASURED actual cost when no real tokens/model were carried (the substrate_router.ts routing-signal-only path)', () => {
    const r = emitSavingsReceipt({
      tier: 'cloud_escalation', routing_raw: 'cloud_escalation', model_used: null,
      input_tokens: null, output_tokens: null, served_text_chars: null, latency_ms: 10,
      degraded: false, as_of: '2026-08-15T00:00:00.000Z', price_table_path: priceTablePath,
    });
    expect(r.flagship_call_avoided).toBe(false);
    expect(r.actual_cost_usd).toBe(UNMEASURED);
  });
});

describe('substrate_savings_receipt: (D-BP155-029) cloud_escalation prices real tokens exactly like local_model, closing the survivorship-bias defect', () => {
  it('a cloud_escalation record WITH real provider-reported tokens and a priced model produces a real actual_cost_usd, not UNMEASURED', () => {
    // Mirrors ai_dispatch_ipc.ts's dispatchViaBrain() flagship branch: real Anthropic usage
    // field-reported input/output tokens, a real model_used. Model id matches the FRESH_TABLE
    // fixture's priced entry so this proves the PRICING branch, not a missing-rate exclusion.
    const r = emitSavingsReceipt({
      tier: 'cloud_escalation', routing_raw: 'ladder_tier4_flagship:claude-sonnet-5:ok',
      model_used: 'claude-sonnet-5', input_tokens: 1200, output_tokens: 400,
      served_text_chars: 1600, latency_ms: 2200,
      degraded: false, as_of: '2026-08-15T00:00:00.000Z', price_table_path: priceTablePath,
    });
    expect(r.flagship_call_avoided).toBe(false); // a paid call was made, never "avoided"
    expect(typeof r.actual_cost_usd).toBe('number');
    // 1200/1e6 * 2.00 + 400/1e6 * 10.00 = 0.0024 + 0.004 = 0.0064
    expect(r.actual_cost_usd).toBeCloseTo(0.0064, 10);
    expect(r.actual_cost_basis).toMatch(/priced at claude-sonnet-5 table rate/);
    expect(r.actual_cost_basis).toMatch(/real provider-reported token counts/);
  });

  it('a cloud_escalation record with real tokens but NO price-table rate for the model still resolves UNMEASURED, never guessed', () => {
    const r = emitSavingsReceipt({
      tier: 'cloud_escalation', routing_raw: 'ladder_tier3_cheap_cloud:claude-haiku-4-7:ok',
      model_used: 'claude-haiku-4-7', input_tokens: 500, output_tokens: 150,
      served_text_chars: 600, latency_ms: 900,
      degraded: false, as_of: '2026-08-15T00:00:00.000Z', price_table_path: priceTablePath,
    });
    expect(r.actual_cost_usd).toBe(UNMEASURED);
    expect(r.actual_cost_basis).toMatch(/no_rate_for_model/);
    expect(r.cost_avoided_usd).toBe(UNMEASURED);
  });

  it('period aggregate: before/after on the SAME window shows the lower-bound-shaped number becoming a real net figure once a cloud escalation is priced, and states measurement_scope + records_excluded_unmeasured_by_tier explicitly', () => {
    // "Before": one substrate hit only -- the pre-fix shape (a lower bound over substrate/local
    // hits; nothing paid ever entered the sum because cloud_escalation was hardcoded UNMEASURED).
    emitSavingsReceipt({
      tier: 'substrate_hit', routing_raw: 'substrate_hit', model_used: null,
      input_tokens: null, output_tokens: null, served_text_chars: 400, latency_ms: 5,
      degraded: false, as_of: '2026-08-15T00:00:00.000Z', price_table_path: priceTablePath,
    });
    const before = computePeriodAggregate(
      'before-window', '2026-08-14T00:00:00.000Z', '2026-08-16T00:00:00.000Z', logFile,
    );
    expect(before.total_queries).toBe(1);
    expect(before.by_tier.cloud_escalation).toBe(0);
    const beforeCostAvoided = before.cost_avoided_usd;

    // "After": a REAL priced cloud escalation lands in the SAME window (the actual fix this
    // ticket makes reachable -- a real Anthropic call's real usage tokens flowing to the meter).
    // Capture the individual receipt's OWN cost_avoided_usd independently of the aggregate call.
    const secondReceipt = emitSavingsReceipt({
      tier: 'cloud_escalation', routing_raw: 'ladder_tier4_flagship:claude-sonnet-5:ok',
      model_used: 'claude-sonnet-5', input_tokens: 1200, output_tokens: 400,
      served_text_chars: 1600, latency_ms: 2200,
      degraded: false, as_of: '2026-08-15T00:02:00.000Z', price_table_path: priceTablePath,
    });
    expect(typeof secondReceipt.cost_avoided_usd).toBe('number');
    const after = computePeriodAggregate(
      'after-window', '2026-08-14T00:00:00.000Z', '2026-08-16T00:00:00.000Z', logFile,
    );
    expect(after.total_queries).toBe(2);
    expect(after.by_tier.cloud_escalation).toBe(1);
    expect(after.records_with_measured_saving).toBe(2);
    expect(after.records_excluded_unmeasured).toBe(0);
    expect(after.records_excluded_unmeasured_by_tier.cloud_escalation).toBe(0);
    // The net figure now reflects a REAL paid call's cost eating into savings -- verify the
    // aggregate is EXACTLY the independently-computed sum of the two individual receipts' own
    // cost_avoided_usd values (a true net sum across tiers), never silently clamped, dropped, or
    // re-flattered. This ties computePeriodAggregate's output back to per-record ground truth
    // instead of trusting the aggregate's own arithmetic in isolation.
    expect(after.cost_avoided_usd).toBeCloseTo(
      beforeCostAvoided + (secondReceipt.cost_avoided_usd as number), 10,
    );

    // The instrument must SAY what it is, in the output itself -- not leave a reader to assume.
    expect(after.measurement_scope).toMatch(/NET figure across ALL traffic/);
    expect(after.measurement_scope).toMatch(/NOT a lower bound/);
    expect(after.measurement_scope).toContain('records_excluded_unmeasured_by_tier');
  });

  it('period aggregate: an UNPRICED cloud escalation is visible in records_excluded_unmeasured_by_tier, so a reader can never mistake silence for zero spend', () => {
    emitSavingsReceipt({
      tier: 'cloud_escalation', routing_raw: 'ladder_tier3_cheap_cloud:claude-haiku-4-7:ok',
      model_used: 'claude-haiku-4-7', input_tokens: 500, output_tokens: 150,
      served_text_chars: 600, latency_ms: 900,
      degraded: false, as_of: '2026-08-15T00:00:00.000Z', price_table_path: priceTablePath,
    });
    const agg = computePeriodAggregate(
      'unpriced-cloud-window', '2026-08-14T00:00:00.000Z', '2026-08-16T00:00:00.000Z', logFile,
    );
    expect(agg.total_queries).toBe(1);
    expect(agg.by_tier.cloud_escalation).toBe(1);
    expect(agg.cost_avoided_usd).toBe(0); // nothing measurable this window
    expect(agg.records_excluded_unmeasured).toBe(1);
    expect(agg.records_excluded_unmeasured_by_tier.cloud_escalation).toBe(1);
  });
});
