// ore_store.test.ts -- D-BP219-BM0-034/BM0/canonical-pipeline-ore-capture
//
// Exercises the ore writer DIRECTLY with synthetic CHALLENGED and CAPPED candidates. Does NOT
// run the live pipeline (canonical_pipeline.ts) per this dispatch's own hard constraint.
//
// Proves:
//   1. CHALLENGED and CAPPED are written as distinct, never-merged class labels.
//   2. rank/cap are populated for CAPPED and null-with-reason for CHALLENGED (FIREARM rule).
//   3. Every record carries a socceriHash contentHash (SHA-512 hex, 128 chars), reused not
//      reimplemented, and it differs between distinct candidates.
//   4. No answer-key-shaped field (answer / correctAnswer / correct_answer_letter / option
//      letter) ever appears in a written record.
//   5. writeOreRecords([]) is a true no-op -- no file created for a question that lost nothing.

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let oreDir: string;

beforeEach(() => {
  oreDir = mkdtempSync(join(tmpdir(), 'ore-store-test-'));
  process.env.MNEM_ORE_DIR = oreDir;
});

afterEach(() => {
  delete process.env.MNEM_ORE_DIR;
  rmSync(oreDir, { recursive: true, force: true });
});

/** ORE_DIR is resolved once at module load time (matches ip_ledger_store.ts's own
 *  LB_SUBSTRATE_ROOT constant), so MNEM_ORE_DIR must be set (done in beforeEach above) BEFORE
 *  each test's fresh import. */
async function freshStore() {
  vi.resetModules();
  return import('./ore_store');
}

describe('ore_store: captures both Stage 5/6 discards, distinctly labelled', () => {
  test('writes CHALLENGED and CAPPED as separate labelled JSONL lines with hash + no answer key', async () => {
    const store = await freshStore();

    const challengedCandidate = {
      source: 'wikipedia',
      content: 'Photosynthesis converts light energy into chemical energy in plants.',
      weight: 0.7,
      sid: 'sid-challenged-1',
      domain: 'biology',
    };
    const cappedCandidate = {
      source: 'arxiv',
      content: 'A seventh-ranked candidate that passed Saladin but missed the postFurnaceCap.',
      weight: 0.65,
      sid: 'sid-capped-1',
      domain: 'biology',
    };

    const challengedRecord = store.buildOreRecord({
      runId: 'run-fixture-1',
      class: 'CHALLENGED',
      stage: 'Saladin',
      candidate: challengedCandidate,
      questionId: 'q-1',
      question: 'What does photosynthesis do?',
      rank: null,
      cap: null,
    });
    const cappedRecord = store.buildOreRecord({
      runId: 'run-fixture-1',
      class: 'CAPPED',
      stage: 'Furnace',
      candidate: cappedCandidate,
      questionId: 'q-1',
      question: 'What does photosynthesis do?',
      rank: 7,
      cap: 6,
    });

    store.writeOreRecords([challengedRecord, cappedRecord]);

    const orePath = store.getOreFilePath();
    expect(existsSync(orePath)).toBe(true);

    const rawLines = readFileSync(orePath, 'utf-8').trim().split('\n');
    expect(rawLines.length).toBe(2);
    const lines = rawLines.map((l) => JSON.parse(l));

    // console output of the actual JSONL lines produced, for the dispatch report
    // eslint-disable-next-line no-console
    console.log('ORE JSONL LINES:\n' + rawLines.join('\n'));

    expect(lines[0].class).toBe('CHALLENGED');
    expect(lines[0].stage).toBe('Saladin');
    expect(lines[0].rank).toBeNull();
    expect(lines[0].cap).toBeNull();
    expect(lines[0].rankMissingReason).toMatch(/Saladin/);

    expect(lines[1].class).toBe('CAPPED');
    expect(lines[1].stage).toBe('Furnace');
    expect(lines[1].rank).toBe(7);
    expect(lines[1].cap).toBe(6);
    expect(lines[1].rankMissingReason).toBeNull();

    // no answer key ever enters the ore, on either record
    const forbiddenKeys = ['answer', 'correctAnswer', 'correct_answer_letter', 'gold', 'optionLetter'];
    for (const line of lines) {
      for (const key of forbiddenKeys) {
        expect(Object.prototype.hasOwnProperty.call(line, key)).toBe(false);
      }
    }

    // hash present, SHA-512 hex (128 chars), reused via socceriHash, distinct per candidate
    expect(lines[0].contentHash).toMatch(/^[0-9a-f]{128}$/);
    expect(lines[1].contentHash).toMatch(/^[0-9a-f]{128}$/);
    expect(lines[0].contentHash).not.toBe(lines[1].contentHash);

    // run id present on both, for joining back to the receipt
    expect(lines[0].runId).toBe('run-fixture-1');
    expect(lines[1].runId).toBe('run-fixture-1');
  });

  test('writeOreRecords([]) is a true no-op: no file created for a question that lost nothing', async () => {
    const store = await freshStore();
    store.writeOreRecords([]);
    expect(existsSync(store.getOreFilePath())).toBe(false);
  });

  test('a candidate missing source/domain gets null + an explanatory reason, never blank/0 (FIREARM rule)', async () => {
    const store = await freshStore();
    const record = store.buildOreRecord({
      runId: 'run-fixture-2',
      class: 'CHALLENGED',
      stage: 'Saladin',
      candidate: { source: '', content: 'edge case content over one hundred characters long to satisfy Miner-shaped expectations in this fixture test scenario.', weight: 0.5, sid: 'sid-edge-1' },
      questionId: 'q-2',
      question: 'Edge case question.',
      rank: null,
      cap: null,
    });
    expect(record.source).toBeNull();
    expect(record.sourceMissingReason).not.toBeNull();
    expect(record.domain).toBeNull();
    expect(record.domainMissingReason).not.toBeNull();
  });
});
