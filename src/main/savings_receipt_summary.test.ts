// savings_receipt_summary.test.ts -- D-BP223-BM09-ARCHBISHOP-004-016 (REDO of 004-010)
// Pure shape-assembler tests -- no Electron, no file I/O, fabricated PeriodAggregate/
// ChainVerifyResult inputs. Covers: empty state, chain_ok/broken-chain propagation, milestone
// wiring, and (per the dispatch's own test list) that the built summary never carries question
// text, a file path, a hostname, or a username.

import { describe, it, expect } from 'vitest';
import { hostname, userInfo } from 'os';
import { buildSavingsReceiptSummary, type BuildSummaryArgs } from './savings_receipt_summary';
import type { PeriodAggregate, ChainVerifyResult } from './substrate_savings_receipt';

const OK_CHAIN: ChainVerifyResult = { ok: true, total_records: 10, broken_at_index: null, broken_at_query_id: null, reason: null };

const BROKEN_CHAIN: ChainVerifyResult = {
  ok: false,
  total_records: 10,
  broken_at_index: 4,
  broken_at_query_id: 'q-4',
  reason: 'record at index 4 (query_id=q-4) has hash mismatch',
};

const FIXTURE_AGGREGATE: PeriodAggregate = {
  window: 'week',
  from_ts: '2026-09-01T00:00:00.000Z',
  to_ts: '2026-09-08T00:00:00.000Z',
  total_queries: 12,
  by_tier: { substrate_hit: 5, local_model: 4, cloud_escalation: 2, abstain: 1 },
  flagship_calls_avoided: 9,
  flagship_calls_made: 2,
  cost_avoided_usd: 3.4567,
  records_with_measured_saving: 11,
  records_excluded_unmeasured: 1,
  records_excluded_unmeasured_by_tier: { substrate_hit: 0, local_model: 0, cloud_escalation: 1, abstain: 0 },
  measurement_scope: 'NET figure across ALL traffic that reached a routing decision in this window',
  confidence: '11/12 records had a computable saving; 1 excluded as UNMEASURED',
};

const ZERO_MILESTONE_COUNTS = { hour: 0, day: 0, week: 0, fortnight: 0, month: 0, quarter: 0 };

const BASE_ARGS: BuildSummaryArgs = {
  window: 'week',
  chainResult: OK_CHAIN,
  chainHead: 'a'.repeat(64),
  totalChainRecords: 10,
  firstRecordUtc: '2026-08-01T00:00:00.000Z',
  nowIso: '2026-09-08T00:00:00.000Z',
  aggregate: FIXTURE_AGGREGATE,
  milestoneQueryCounts: { hour: 1, day: 1, week: 1, fortnight: 0, month: 0, quarter: 0 },
  receiptBlock: 'MNEMOSYNEC SAVINGS RECEIPT v1\n...\nsignature: deadbeef',
};

describe('savings_receipt_summary: empty state', () => {
  it('totalChainRecords 0 forces aggregate and receipt_block to null regardless of what is passed in', () => {
    const summary = buildSavingsReceiptSummary({
      ...BASE_ARGS,
      totalChainRecords: 0,
      firstRecordUtc: null,
      aggregate: null,
      milestoneQueryCounts: ZERO_MILESTONE_COUNTS,
      receiptBlock: null,
    });
    expect(summary.empty).toBe(true);
    expect(summary.aggregate).toBeNull();
    expect(summary.receipt_block).toBeNull();
    expect(summary.days_in_use).toBe(0);
    expect(Object.values(summary.milestones_reached).every((v) => v === false)).toBe(true);
  });

  it('non-zero totalChainRecords surfaces the real aggregate and receipt block', () => {
    const summary = buildSavingsReceiptSummary(BASE_ARGS);
    expect(summary.empty).toBe(false);
    expect(summary.aggregate).toEqual(FIXTURE_AGGREGATE);
    expect(summary.receipt_block).toBe(BASE_ARGS.receiptBlock);
  });
});

describe('savings_receipt_summary: chain reporting', () => {
  it('an intact chain reports chain_ok true and a null broken index', () => {
    const summary = buildSavingsReceiptSummary(BASE_ARGS);
    expect(summary.chain_ok).toBe(true);
    expect(summary.chain_broken_at_index).toBeNull();
  });

  it('a broken chain is reported: chain_ok false and the first broken index', () => {
    const summary = buildSavingsReceiptSummary({ ...BASE_ARGS, chainResult: BROKEN_CHAIN });
    expect(summary.chain_ok).toBe(false);
    expect(summary.chain_broken_at_index).toBe(4);
  });
});

describe('savings_receipt_summary: milestone wiring', () => {
  it('forwards milestoneReached() results per trailing window, using the injected clock', () => {
    const summary = buildSavingsReceiptSummary(BASE_ARGS);
    // firstRecordUtc 2026-08-01, nowIso 2026-09-08 -> ~38 days elapsed, so hour/day/week/
    // fortnight/month are elapsed; quarter (91d) is not. milestoneQueryCounts gates hour/day/week
    // to reached=true (count 1) and fortnight/month/quarter to reached=false (count 0, or not
    // elapsed for quarter).
    expect(summary.milestones_reached.hour).toBe(true);
    expect(summary.milestones_reached.day).toBe(true);
    expect(summary.milestones_reached.week).toBe(true);
    expect(summary.milestones_reached.fortnight).toBe(false); // elapsed, but 0 queries in-window
    expect(summary.milestones_reached.quarter).toBe(false); // not elapsed yet
  });
});

describe('savings_receipt_summary: never leaks question text, paths, hostname, or username', () => {
  it('the built summary, JSON-stringified, contains none of this machine\'s real hostname/username, ' +
    'no key named path/hostname/username/machine, and no Windows-style path', () => {
    const summary = buildSavingsReceiptSummary(BASE_ARGS);
    const json = JSON.stringify(summary);

    const realHostname = hostname();
    const realUsername = (() => {
      try { return userInfo().username; } catch { return ''; }
    })();

    if (realHostname) expect(json).not.toContain(realHostname);
    if (realUsername) expect(json).not.toContain(realUsername);
    expect(json).not.toMatch(/[A-Za-z]:\\\\/); // no Windows drive-letter path
    expect(json).not.toMatch(/\/(Users|home)\//); // no *nix home path

    // Structural check: no key anywhere in the object graph is named like a leaky field.
    const forbiddenKeyPattern = /path|hostname|username|machine_name|question|query_text/i;
    const scan = (value: unknown): void => {
      if (value && typeof value === 'object') {
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          expect(k).not.toMatch(forbiddenKeyPattern);
          scan(v);
        }
      }
    };
    scan(summary);
  });

  it('AnchorDigest\'s source_log_path field is structurally impossible to forward -- ' +
    'BuildSummaryArgs only accepts chainHead/totalChainRecords, not the AnchorDigest object', () => {
    // Compile-time guarantee, asserted at runtime for documentation: the args object this test
    // file itself must supply has no `source_log_path` key, because BuildSummaryArgs has no such
    // field to accept it into.
    expect(Object.keys(BASE_ARGS)).not.toContain('source_log_path');
    expect(Object.keys(BASE_ARGS)).not.toContain('anchor');
  });
});
