// substrate_price_table.real_table_sonnet5_row.test.ts -- D-BP223-X043-002-0940-BUILD
//
// Guard test for the spec claim in
// LianaBanyanPlatform/BISHOP_DROPZONE/D-BP223-PQ005-028-CONDUIT-ASK-TWICE/
// CONDUIT_ASK_TWICE_DORA_METER_SPEC_v1.md ("One defective row: the second claude-sonnet-5
// row has effective_from 2026-09-01 and effective_until 2026-08-20 (it ends before it
// starts), so lookupRate() can never match it. Not on this demo's path; flagged for
// whoever owns the table.").
//
// This reads the REAL config/substrate_price_table.json (never a fixture), because the
// question is about the table as it actually ships, not a synthetic stand-in.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { lookupRate, DEFAULT_TABLE_PATH } from './substrate_price_table';

const TABLE_PATH = resolve(__dirname, '..', '..', 'config', 'substrate_price_table.json');

describe('substrate_price_table.json: claude-sonnet-5 rows', () => {
  it('parses as valid JSON', () => {
    const raw = readFileSync(TABLE_PATH, 'utf-8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('has exactly one claude-sonnet-5 row effective at 2026-09-27, priced at $2/$10 per MTok', () => {
    const result = lookupRate('claude-sonnet-5', '2026-09-27', DEFAULT_TABLE_PATH);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rate.input_per_mtok_usd).toBe(2.0);
      expect(result.rate.output_per_mtok_usd).toBe(10.0);
      expect(result.rate.effective_until).toBeNull();
    }
  });

  it('the cancelled/withdrawn claude-sonnet-5 row ($3/$15, effective_from 2026-09-01, ' +
    'effective_until 2026-08-20) can never be selected by lookupRate() at any timestamp, ' +
    'because its window is inverted by construction', () => {
    const raw = readFileSync(TABLE_PATH, 'utf-8');
    const table = JSON.parse(raw) as { rates: Array<Record<string, unknown>> };
    const cancelledRow = table.rates.find(
      (r) => r.model_id === 'claude-sonnet-5' && r.status === 'CANCELLED',
    );
    expect(cancelledRow).toBeDefined();
    expect(cancelledRow?.effective_from).toBe('2026-09-01');
    expect(cancelledRow?.effective_until).toBe('2026-08-20');

    // Probe a wide spread of dates, including both endpoints of the row's own inverted
    // window and points before/after each, and confirm the $3/$15 rate is never returned.
    const probeDates = [
      '2026-01-01',
      '2026-08-19',
      '2026-08-20',
      '2026-08-21',
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
      '2026-09-27',
      '2027-01-01',
    ];
    for (const asOf of probeDates) {
      const result = lookupRate('claude-sonnet-5', asOf, DEFAULT_TABLE_PATH);
      if (result.ok) {
        expect(
          result.rate.input_per_mtok_usd === 3.0 && result.rate.output_per_mtok_usd === 15.0,
        ).toBe(false);
      }
      // If not ok, that's fine too (e.g. stale_price_table) -- the only forbidden outcome
      // is a match against the cancelled $3/$15 row.
    }
  });

  it('every claude-sonnet-5 row (including the cancelled one) carries every field ' +
    'lookupRate() reads: model_id, effective_from, effective_until (present, possibly ' +
    'null), verified_on', () => {
    const raw = readFileSync(TABLE_PATH, 'utf-8');
    const table = JSON.parse(raw) as { rates: Array<Record<string, unknown>> };
    const sonnet5Rows = table.rates.filter((r) => r.model_id === 'claude-sonnet-5');
    expect(sonnet5Rows.length).toBeGreaterThanOrEqual(2);
    for (const row of sonnet5Rows) {
      expect(typeof row.model_id).toBe('string');
      expect(typeof row.effective_from).toBe('string');
      expect('effective_until' in row).toBe(true);
      expect(typeof row.verified_on).toBe('string');
    }
  });
});
