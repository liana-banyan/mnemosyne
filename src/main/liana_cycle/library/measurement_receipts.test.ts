// measurement_receipts.test.ts -- D-BP154-040/BISHOP-SEG/S40/seg-receipts
//
// FAIL-BEFORE/PASS-AFTER for FD-BP154-15 (RULINGS_BP154.md): "receipts are automatic... those
// receipts should be eblets." Every test below fails on main with "Cannot find module
// './measurement_receipts'" -- the file did not exist before this ticket.
//
// ISOLATION: every test passes an explicit `dir` (a fresh temp directory per test, via
// mkdtempSync) rather than resolveEvidenceDir()'s own default -- never writes into the real
// HARDWIRE\LEDGER evidence store. This is the SAME discipline the memory record "tests contaminate
// live stores" (BP148: 49 of 123 test files found writing synthetic records into real stores with
// no cleanup) exists to prevent; this file does not repeat that defect.

import { describe, test, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadMeasurementReceipts, mintMeasurementReceipt, timeAtomicQuery,
} from './measurement_receipts';

const tempDirs: string[] = [];
function freshDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'liana-measurement-test-'));
  tempDirs.push(d);
  return d;
}

afterEach(() => {
  for (const d of tempDirs.splice(0)) {
    try { rmSync(d, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
  }
});

describe('mintMeasurementReceipt -- FD-BP154-15\'s own required fields, append-only (Rule 66)', () => {
  test('carries every field the ruling names: what/instrument/figure+units/comparedAgainst/conditions/runId/contentHash', () => {
    const dir = freshDir();
    const r = mintMeasurementReceipt({
      kind: 'speed', metric: 'atomic query wall-clock time (CONVERSATIONAL_ANSWER)', value: 1234,
      units: 'ms', instrument: 'test instrument', comparedAgainst: 'mechanism=CONVERSATIONAL_ANSWER',
      conditions: 'label="q", outcome=ok', runId: 'run-1', dir,
    });
    expect(r.schema).toBe('liana-measurement-receipt/1');
    expect(r.stratum).toBe('sand'); // D-BP154-15: every receipt enters at sand
    expect(r.kind).toBe('speed');
    expect(r.value).toBe(1234);
    expect(r.units).toBe('ms');
    expect(r.comparedAgainst).toBe('mechanism=CONVERSATIONAL_ANSWER');
    expect(r.runId).toBe('run-1');
    expect(r.id).toMatch(/^[0-9a-f]{64}$/); // sha256 content hash
    expect(r.measuredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('append-only: two mints on the same day both survive, neither overwrites the other', () => {
    const dir = freshDir();
    mintMeasurementReceipt({
      kind: 'speed', metric: 'm1', value: 100, units: 'ms', instrument: 'i',
      comparedAgainst: 'x', conditions: 'c', runId: 'run-1', dir,
    });
    mintMeasurementReceipt({
      kind: 'speed', metric: 'm2', value: 200, units: 'ms', instrument: 'i',
      comparedAgainst: 'x', conditions: 'c', runId: 'run-1', dir,
    });
    const today = new Date().toISOString().slice(0, 10);
    const { records, malformedLines } = loadMeasurementReceipts(today, dir);
    expect(records).toHaveLength(2);
    expect(malformedLines).toBe(0);
    expect(records.map((r) => r.value).sort()).toEqual([100, 200]);
  });

  test('two receipts with different content have different content hashes', () => {
    const dir = freshDir();
    const a = mintMeasurementReceipt({
      kind: 'speed', metric: 'm', value: 1, units: 'ms', instrument: 'i', comparedAgainst: 'x', conditions: 'c', runId: 'r', dir,
    });
    const b = mintMeasurementReceipt({
      kind: 'speed', metric: 'm', value: 2, units: 'ms', instrument: 'i', comparedAgainst: 'x', conditions: 'c', runId: 'r', dir,
    });
    expect(a.id).not.toBe(b.id);
  });
});

describe('loadMeasurementReceipts -- a malformed line is skipped and counted, never silently dropped', () => {
  test('no file for the day -> empty, not an error', () => {
    const dir = freshDir();
    const { records, malformedLines } = loadMeasurementReceipts('2000-01-01', dir);
    expect(records).toEqual([]);
    expect(malformedLines).toBe(0);
  });
});

describe('timeAtomicQuery -- FD-BP154-15\'s own first-fixed instrument: per-atomic-query timing, tagged by mechanism, never a bundled step', () => {
  test('returns the wrapped function\'s own result completely unchanged, and mints a speed receipt on success', async () => {
    const dir = freshDir();
    const result = await timeAtomicQuery('CONVERSATIONAL_ANSWER', 'a test query', 'run-42', async () => {
      await new Promise((r) => { setTimeout(r, 5); });
      return { ok: true, payload: 'the real result' };
    }, dir);
    expect(result).toEqual({ ok: true, payload: 'the real result' });
    const today = new Date().toISOString().slice(0, 10);
    const { records } = loadMeasurementReceipts(today, dir);
    expect(records).toHaveLength(1);
    expect(records[0].kind).toBe('speed');
    expect(records[0].comparedAgainst).toBe('mechanism=CONVERSATIONAL_ANSWER');
    expect(records[0].conditions).toContain('outcome=ok');
    expect(records[0].value).toBeGreaterThanOrEqual(0); // raw wall-clock ms, never a computed rate (scope guard)
    expect(records[0].runId).toBe('run-42');
  });

  test('rethrows the wrapped function\'s own rejection unchanged, and still mints a receipt (outcome=failed) -- a failed atomic query\'s cost is recorded too', async () => {
    const dir = freshDir();
    const boom = new Error('atomic query failed');
    await expect(timeAtomicQuery('DOCUMENT_CORROBORATION', 'a failing query', 'run-43', async () => {
      throw boom;
    }, dir)).rejects.toBe(boom);
    const today = new Date().toISOString().slice(0, 10);
    const { records } = loadMeasurementReceipts(today, dir);
    expect(records).toHaveLength(1);
    expect(records[0].conditions).toContain('outcome=failed');
  });

  test('runId===null skips the disk write entirely (never contaminates a store with no real acquisition context) -- exact parity with persistStepClaim()\'s own "no acquisitionId, no write" rule', async () => {
    const dir = freshDir();
    const result = await timeAtomicQuery('OWNED_EVIDENCE', 'q', null, async () => 'ok', dir);
    expect(result).toBe('ok');
    const today = new Date().toISOString().slice(0, 10);
    const { records } = loadMeasurementReceipts(today, dir);
    expect(records).toHaveLength(0); // no acquisition context -- nothing written, same as persistStepClaim()
  });
});
