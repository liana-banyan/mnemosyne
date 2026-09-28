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
import { execFileSync } from 'child_process';
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

// D-BP223-M0-h2cbpo68-032/SEG-M0/BP223-SAVINGS_INSTRUMENT ("Make it work then." -- fix the two
// defects blocking a real dollar figure on a real cloud-escalation query, prove one real receipt
// prices).
//
// DELIBERATE DEVIATION from this file's own header discipline ("never the real config/
// substrate_price_table.json"): the tests above prove the GENERIC pricing/UNMEASURED logic
// against an isolated fixture, which is correct for unit coverage but cannot prove the actual,
// current production defect (item 8 in SAVINGS_METER_AUDITOR_DISPUTE_LIST_BP155.md: the table
// not covering the model ids the product actually dispatches) is closed. This block reads the
// REAL, live C:\Users\Administrator\Documents\mnemosyne\config\substrate_price_table.json
// (read-only -- never written to; only the receipt LOG is redirected to a per-run temp file, via
// the same _setLogPathForTests() every other block in this file uses) so a passing assertion
// here means the shipped price table, today, actually prices a model id the shipped product
// actually dispatches -- not merely that the pricing FUNCTION works in the abstract. This mirrors
// the existing convention already established in this codebase's own
// ai_dispatch_ipc_cloud_escalation_receipt.test.ts (same "read the real table, redirect only the
// log" pattern), but runs under vitest directly (no dist build required) rather than against
// compiled dist output.
describe('substrate_savings_receipt: (D-BP223-M0-h2cbpo68-032) the REAL production price table now prices a REAL dispatched cloud-escalation model id', () => {
  const REAL_TABLE_PATH = resolve(__dirname, '..', '..', 'config', 'substrate_price_table.json');

  function loadRealTable(): any {
    return JSON.parse(readFileSync(REAL_TABLE_PATH, 'utf-8'));
  }

  function currentRate(table: any, modelId: string): any {
    const nowMs = Date.now();
    return table.rates
      .filter(
        (r: any) =>
          r.model_id === modelId &&
          new Date(r.effective_from).getTime() <= nowMs &&
          (!r.effective_until || new Date(r.effective_until).getTime() >= nowMs),
      )
      .sort((a: any, b: any) => new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime())[0];
  }

  it('(a) a cloud_escalation receipt for claude-sonnet-4-6 -- brain_registry.ts DEFAULT_BRAINS\' flagship id, the model ai_dispatch_ipc.ts\'s dispatchViaBrain() TIER 4 branch actually sends to the Anthropic API -- prices a REAL positive actual_cost_usd, and the counterfactual side prices a REAL positive counterfactual_cost_usd sourced from a table entry carrying a source_url', () => {
    const table = loadRealTable();
    const dispatchedRate = currentRate(table, 'claude-sonnet-4-6');
    // If this fails, the census claim in this table's own change_log ("claude-sonnet-4-6 is
    // already priced") is stale -- fail loudly rather than silently skipping.
    expect(dispatchedRate, 'claude-sonnet-4-6 must have a currently-effective rate in the REAL price table').toBeTruthy();
    expect(typeof dispatchedRate.source_url).toBe('string');
    expect(dispatchedRate.source_url.length).toBeGreaterThan(0);

    const r = emitSavingsReceipt({
      tier: 'cloud_escalation',
      routing_raw: 'ladder_tier4_flagship:claude-sonnet-4-6:ok',
      model_used: 'claude-sonnet-4-6',
      input_tokens: 900,
      output_tokens: 300,
      served_text_chars: 1200,
      latency_ms: 1800,
      degraded: false,
      as_of: new Date().toISOString(),
      price_table_path: REAL_TABLE_PATH,
    });

    expect(typeof r.actual_cost_usd).toBe('number');
    expect(r.actual_cost_usd as number).toBeGreaterThan(0);
    const expectedActual =
      (900 / 1_000_000) * dispatchedRate.input_per_mtok_usd + (300 / 1_000_000) * dispatchedRate.output_per_mtok_usd;
    expect(r.actual_cost_usd as number).toBeCloseTo(expectedActual, 10);

    // Counterfactual side: sized from served_text_chars against the table's OWN declared
    // default_counterfactual_model (claude-sonnet-5), independently of model_used above --
    // must ALSO be a real positive number sourced from a table entry with a source_url.
    const cfRate = currentRate(table, table.default_counterfactual_model);
    expect(cfRate, `default_counterfactual_model "${table.default_counterfactual_model}" must have a currently-effective rate`).toBeTruthy();
    expect(typeof cfRate.source_url).toBe('string');
    expect(cfRate.source_url.length).toBeGreaterThan(0);
    expect(typeof r.counterfactual_cost_usd).toBe('number');
    expect(r.counterfactual_cost_usd as number).toBeGreaterThan(0);
    expect(r.counterfactual_model).toBe(table.default_counterfactual_model);
  });

  it('(b) a local_model receipt priced against the REAL "local-member-hardware" row carries the hardware/power disclaimer ON THE RECEIPT ITSELF, not just in the price table\'s JSON note field', () => {
    const table = loadRealTable();
    const localRate = currentRate(table, 'local-member-hardware');
    expect(localRate, 'local-member-hardware must have a currently-effective rate in the REAL price table').toBeTruthy();
    expect(localRate.provider).toBe('local');

    const r = emitSavingsReceipt({
      tier: 'local_model',
      routing_raw: 'local_ollama',
      model_used: 'local-member-hardware',
      input_tokens: 400,
      output_tokens: 150,
      served_text_chars: 600,
      latency_ms: 700,
      degraded: false,
      as_of: new Date().toISOString(),
      price_table_path: REAL_TABLE_PATH,
    });

    expect(r.actual_cost_usd).toBe(0); // real, known zero -- a local $0/mtok rate, not a guess
    // THE FIX (D-BP155-029 item 4): this field did not exist before this dispatch. Its presence
    // and exact content is the proof the disclaimer reaches the receipt, not just the JSON.
    expect(r.local_cost_basis).toBe('excludes hardware and power; see price table disclaimer');
  });

  it('(b-negative) local_cost_basis is null (not the disclaimer, not an empty string) when the tier is NOT a local-provider-priced receipt', () => {
    const r = emitSavingsReceipt({
      tier: 'substrate_hit', routing_raw: 'substrate_hit', model_used: null,
      input_tokens: null, output_tokens: null, served_text_chars: 400, latency_ms: 5,
      degraded: false, as_of: '2026-08-15T00:00:00.000Z', price_table_path: priceTablePath,
    });
    expect(r.local_cost_basis).toBeNull();
  });

  it('(c) claude-haiku-4-7 -- a model id ai_dispatch_ipc.ts\'s CHEAP_CLOUD_BRAIN really dispatches to the Anthropic API -- is confirmed ABSENT from the REAL price table and resolves UNMEASURED with a DOCUMENTED reason, never a guessed rate and never a silent zero', () => {
    const table = loadRealTable();
    const haikuRate = currentRate(table, 'claude-haiku-4-7');
    // This assertion is the fact this whole block exists to prove stays true: if a Founder-
    // approved rate is ever added for this model_id, this test's job shifts to test (a)'s shape
    // and this specific assertion should then be updated, not deleted silently.
    expect(haikuRate, 'claude-haiku-4-7 must remain absent from the REAL price table until a vendor SKU exists for it').toBeUndefined();

    const documented = (table.unpriced_models || []).find((u: any) => u.model_id === 'claude-haiku-4-7');
    expect(documented, 'claude-haiku-4-7 must be recorded in unpriced_models with a documented reason, not merely silently missing').toBeTruthy();

    const r = emitSavingsReceipt({
      tier: 'cloud_escalation',
      routing_raw: 'ladder_tier3_cheap_cloud:claude-haiku-4-7:ok',
      model_used: 'claude-haiku-4-7',
      input_tokens: 500,
      output_tokens: 150,
      served_text_chars: 600,
      latency_ms: 900,
      degraded: false,
      as_of: new Date().toISOString(),
      price_table_path: REAL_TABLE_PATH,
    });

    // The codebase's own never-guess sentinel (UNMEASURED) is this repo's equivalent of "null
    // with a reason" -- SavingsReceipt has never used a bare `null` for a missing dollar figure
    // (see the Unmeasured type at the top of substrate_savings_receipt.ts); asserting UNMEASURED
    // here, never 0 and never a fabricated number, is the faithful form of that requirement
    // against this repo's actual, established type contract.
    expect(r.actual_cost_usd).toBe(UNMEASURED);
    expect(r.actual_cost_usd).not.toBe(0);
    expect(r.cost_avoided_usd).toBe(UNMEASURED);
    // The reason must be the DOCUMENTED one (checked twice, confirmed absent), not a bare
    // "no_rate_for_model" -- proves getUnpricedReason() wiring reaches the receipt.
    expect(r.actual_cost_basis).toMatch(/no_rate_for_model/);
    expect(r.actual_cost_basis).toMatch(/DOCUMENTED:/);
    expect(r.actual_cost_basis).toMatch(/Not listed on the vendor's own pricing page/);
  });

  // D-BP223-BM04-h2cbpv9w-170/Y001/BM04/seg-counterfactual-baseline: the counterfactual this
  // table's own default_counterfactual_model field prices is "what the naive, no-cascade approach
  // would have cost" -- i.e. every call sent straight to the flagship, config/model_roster.json's
  // brain.opus role, with no routing and no cheaper-tier resolution at all. If
  // default_counterfactual_model is ever repointed at a CHEAPER rung's actual model_id (brain.sonnet
  // or brain.haiku), a real savings receipt for a dispatch on that same rung prices its actual cost
  // against an IDENTICAL counterfactual rate, and the delta is a REAL zero by construction -- not
  // because the dispatch stopped saving money, but because the baseline and the actual silently
  // became the same SKU. This is exactly the defect flagged (and left unactioned) in PLATFORM/
  // BISHOP_DROPZONE/D-BP223-M0-h2cbpmt4-047_ROSTER_SONNET5_OPUS5.md section g, when
  // default_counterfactual_model was claude-sonnet-5 and model_roster.json's brain.sonnet role was
  // ALSO set to claude-sonnet-5 by the same-day 03:18:39Z roster ruling. This test fails loudly, on
  // both the REAL price table and the REAL roster, if that class of defect ever recurs -- against
  // brain.sonnet OR brain.haiku, either one being a "cheaper rung" than the flagship.
  it('(D-BP223-BM04-h2cbpv9w-170) default_counterfactual_model must never equal a cheaper rung\'s actual dispatched model (brain.sonnet or brain.haiku), or the savings meter zeroes for that rung', () => {
    const table = loadRealTable();
    const roster = JSON.parse(
      readFileSync(resolve(__dirname, '..', '..', 'config', 'model_roster.json'), 'utf-8'),
    );

    const cheaperRungModelIds: string[] = [
      roster.roles?.['brain.sonnet']?.model_id,
      roster.roles?.['brain.haiku']?.model_id,
    ].filter((id): id is string => typeof id === 'string' && id.length > 0);

    // Sanity check on the fixture-reading itself -- if the roster's shape ever changes so neither
    // id resolves, this test would otherwise pass vacuously and stop proving anything.
    expect(cheaperRungModelIds.length).toBe(2);

    expect(
      cheaperRungModelIds,
      `default_counterfactual_model "${table.default_counterfactual_model}" must not equal either ` +
        `cheaper rung's actual model_id (brain.sonnet=${roster.roles?.['brain.sonnet']?.model_id}, ` +
        `brain.haiku=${roster.roles?.['brain.haiku']?.model_id}) -- a counterfactual equal to a ` +
        `cheaper rung's real dispatched model zeroes that rung's savings receipts by construction.`,
    ).not.toContain(table.default_counterfactual_model);

    // The current, Founder-ruled value is the flagship (brain.opus) -- assert that positively too,
    // so a future edit that merely avoids the two cheaper rungs (e.g. an unrelated third model id)
    // without restoring the intended flagship-baseline semantics is still caught.
    expect(table.default_counterfactual_model).toBe(roster.roles?.['brain.opus']?.model_id);
  });
});

// D-BP223-M0-h2cbpo68-MODEL_ROSTER/SEG-M0/BP223-MODEL_ROSTER: "the savings meter ... must price
// the model that actually ran." These three tests match the dispatch brief's three requirements
// verbatim: (a) a provider-reported model id that differs from the requested id is priced on the
// provider's id, (b) a roster id missing from the price table yields unpriced-with-reason (not a
// guess, not a silent zero), (c) the standalone drift-check script (HARDWIRE\tools\controls\
// model_roster_drift_check.mjs, a sibling-repo tool -- see that file's own header) exits 2 with a
// QUEUE-FINDING line on a seeded drift and exits 0 with none when the fixtures agree.
describe('substrate_savings_receipt: (D-BP223-M0-h2cbpo68-MODEL_ROSTER) price what actually ran', () => {
  it('(a) a cloud_escalation receipt whose PROVIDER-REPORTED model_id differs from the REQUESTED model_used is priced on the provider-reported id, and actual_cost_basis says so explicitly', () => {
    // Requested claude-haiku-4-5 (cheap-cloud rung) but the vendor's own response echoed back
    // claude-sonnet-5 (a real row in FRESH_TABLE, priced completely differently) -- an
    // artificial-but-representative stand-in for "the vendor served a different model than
    // asked", the exact scenario model_id_from_provider exists to catch and price correctly.
    writeTable({
      ...FRESH_TABLE,
      rates: [
        ...FRESH_TABLE.rates,
        {
          model_id: 'claude-haiku-4-5',
          provider: 'anthropic',
          input_per_mtok_usd: 1.0,
          output_per_mtok_usd: 5.0,
          effective_from: '2026-01-01',
          effective_until: null,
          source_url: 'test-fixture',
          verified_on: '2026-08-03',
          verified_by: 'test',
        },
      ],
    });

    const r = emitSavingsReceipt({
      tier: 'cloud_escalation',
      routing_raw: 'ladder_tier3_cheap_cloud:claude-haiku-4-5:ok',
      model_used: 'claude-haiku-4-5',
      model_id_from_provider: 'claude-sonnet-5',
      input_tokens: 900,
      output_tokens: 300,
      served_text_chars: 1200,
      latency_ms: 500,
      degraded: false,
      as_of: '2026-08-15T00:00:00.000Z',
      price_table_path: priceTablePath,
    });

    // Priced against claude-sonnet-5 ($2/$10), NOT claude-haiku-4-5 ($1/$5) -- proves the
    // provider-reported id, not the requested id, drove the actual price.
    const expectedActual = (900 / 1_000_000) * 2.0 + (300 / 1_000_000) * 10.0;
    const wrongIfPricedOnRequested = (900 / 1_000_000) * 1.0 + (300 / 1_000_000) * 5.0;
    expect(r.actual_cost_usd).toBeCloseTo(expectedActual, 10);
    expect(r.actual_cost_usd).not.toBeCloseTo(wrongIfPricedOnRequested, 10);
    expect(r.model_id_actual).toBe('claude-sonnet-5');
    expect(r.model_used).toBe('claude-haiku-4-5'); // the requested id is still preserved, unmutated
    expect(r.actual_cost_basis).toMatch(/PROVIDER-CONFIRMED/);
    expect(r.actual_cost_basis).toMatch(/requested was "claude-haiku-4-5"/);
  });

  it('(a-negative) when no provider-reported model id is carried through, pricing falls back to the requested id and model_id_actual stays null (never fabricated)', () => {
    const r = emitSavingsReceipt({
      tier: 'cloud_escalation',
      routing_raw: 'ladder_tier4_flagship:claude-sonnet-5:ok',
      model_used: 'claude-sonnet-5',
      // model_id_from_provider deliberately omitted -- e.g. an errored call that never reached
      // a response body.
      input_tokens: 900,
      output_tokens: 300,
      served_text_chars: 1200,
      latency_ms: 500,
      degraded: false,
      as_of: '2026-08-15T00:00:00.000Z',
      price_table_path: priceTablePath,
    });
    expect(typeof r.actual_cost_usd).toBe('number');
    expect(r.model_id_actual).toBeNull();
    expect(r.actual_cost_basis).toMatch(/REQUESTED model id/);
  });

  it('(b) a roster id (claude-haiku-4-7, the pre-fix ghost SKU) missing from the price table yields UNMEASURED with a DOCUMENTED unpriced reason, never a guessed rate and never a silent zero', () => {
    writeTable({
      ...FRESH_TABLE,
      unpriced_models: [
        {
          model_id: 'claude-haiku-4-7',
          dispatched_from: 'test fixture standing in for ai_dispatch_ipc.ts pre-fix CHEAP_CLOUD_BRAIN',
          unpriced_reason: 'test fixture: confirmed absent from the vendor pricing page',
          checked_on: '2026-09-08',
        },
      ],
    });

    const r = emitSavingsReceipt({
      tier: 'cloud_escalation',
      routing_raw: 'ladder_tier3_cheap_cloud:claude-haiku-4-7:ok',
      model_used: 'claude-haiku-4-7',
      model_id_from_provider: 'claude-haiku-4-7',
      input_tokens: 500,
      output_tokens: 150,
      served_text_chars: 600,
      latency_ms: 900,
      degraded: false,
      as_of: '2026-08-15T00:00:00.000Z',
      price_table_path: priceTablePath,
    });

    expect(r.actual_cost_usd).toBe(UNMEASURED);
    expect(r.actual_cost_usd).not.toBe(0);
    expect(r.model_id_actual).toBeNull(); // never claim a priced id when nothing was actually priced
    expect(r.actual_cost_basis).toMatch(/no_rate_for_model/);
    expect(r.actual_cost_basis).toMatch(/DOCUMENTED:/);
    expect(r.actual_cost_basis).toMatch(/confirmed absent from the vendor pricing page/);
  });

  const DRIFT_CHECK_SCRIPT = resolve(
    __dirname, '..', '..', '..', 'LianaBanyanPlatform', 'HARDWIRE', 'tools', 'controls', 'model_roster_drift_check.mjs',
  );
  const driftCheckExists = existsSync(DRIFT_CHECK_SCRIPT);

  function runDriftCheck(rosterPath: string, tablePath: string): { status: number; stdout: string } {
    try {
      const stdout = execFileSync(
        process.execPath,
        [DRIFT_CHECK_SCRIPT, '--no-vendor-fetch', '--roster', rosterPath, '--price-table', tablePath],
        { encoding: 'utf-8' },
      );
      return { status: 0, stdout };
    } catch (err: any) {
      // execFileSync throws on non-zero exit; the real stdout/status are still on the error object.
      return { status: typeof err.status === 'number' ? err.status : 1, stdout: String(err.stdout ?? '') };
    }
  }

  describe.skipIf(!driftCheckExists)('(c) the standalone model_roster_drift_check.mjs script', () => {
    it('exits 2 with a QUEUE-FINDING line on a seeded drift (a roster role the price table cannot price)', () => {
      const driftRosterPath = resolve(tmpDir, 'drift_roster.json');
      const driftTablePath = resolve(tmpDir, 'drift_table.json');
      writeFileSync(driftRosterPath, JSON.stringify({
        schema_version: 1,
        roster_version: 'test',
        roles: {
          'brain.haiku': { model_id: 'claude-haiku-4-7', source_url: 'test', fetched_utc: '2026-09-08T00:00:00Z', replaces: null },
        },
      }));
      writeFileSync(driftTablePath, JSON.stringify({
        table_version: 'test',
        rates: [],
        unpriced_models: [{ model_id: 'claude-haiku-4-7', unpriced_reason: 'seeded test gap', checked_on: '2026-09-08' }],
      }));

      const { status, stdout } = runDriftCheck(driftRosterPath, driftTablePath);
      expect(status).toBe(2);
      expect(stdout).toMatch(/QUEUE-FINDING:/);
      expect(stdout).toMatch(/claude-haiku-4-7/);
    });

    it('exits 0 with no QUEUE-FINDING line when the roster and price table agree', () => {
      const alignedRosterPath = resolve(tmpDir, 'aligned_roster.json');
      const alignedTablePath = resolve(tmpDir, 'aligned_table.json');
      writeFileSync(alignedRosterPath, JSON.stringify({
        schema_version: 1,
        roster_version: 'test',
        roles: {
          'brain.haiku': { model_id: 'claude-haiku-4-5', source_url: 'test', fetched_utc: '2026-09-08T00:00:00Z', replaces: 'claude-haiku-4-7' },
        },
      }));
      writeFileSync(alignedTablePath, JSON.stringify({
        table_version: 'test',
        rates: [{
          model_id: 'claude-haiku-4-5', provider: 'anthropic',
          input_per_mtok_usd: 1.0, output_per_mtok_usd: 5.0,
          effective_from: '2026-01-01', effective_until: null,
          source_url: 'test', verified_on: '2026-08-03', verified_by: 'test',
        }],
      }));

      const { status, stdout } = runDriftCheck(alignedRosterPath, alignedTablePath);
      expect(status).toBe(0);
      expect(stdout).not.toMatch(/QUEUE-FINDING:/);
      expect(stdout).toMatch(/No drift found/);
    });
  });
});
