// evidence_store.test.ts -- D-BP153-002/BISHOP/evidence-store
//
// Covers the store, the HARDWIRE-08 conformance pin, and the replay contract.
//
// Deterministic and offline: no network, no Electron, no clock dependence (timestamps are
// injected). Writes only into an OS temp directory via the LB_EVIDENCE_DIR override, never into
// the real HARDWIRE\LEDGER tree -- an estate discipline earned the hard way, since a BP148
// adversarial pass found 49 of 123 test files writing synthetic records into live stores with no
// cleanup.

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  appendEvidence,
  contentAddress,
  deriveQueryKey,
  listAcquisitions,
  loadAcquisition,
  newAcquisitionId,
  summarizeEvidenceStore,
} from './evidence_store';
import {
  buildReplay,
  EvidenceReplayMiss,
  newAcquisitionSession,
  recordingAskGoogle,
  recordingConversationalAuthority,
} from './evidence_authority';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'lb-evidence-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const T = '2026-08-12T03:00:00.000Z';

describe('HARDWIRE-08 conformance: the Crystal recipe has not drifted', () => {
  // This is the whole reason evidence_store.ts is allowed to hold its own copy of the address
  // recipe instead of importing the CommonJS crystal_store module into the run path. HARDWIRE-08
  // forbids SILENT drift. This test makes drift loud.
  test('crystal_store.ts still derives its address the way contentAddress() does', () => {
    const crystalPath = resolve(__dirname, '..', '..', 'crystal', 'crystal_store.ts');
    expect(existsSync(crystalPath)).toBe(true);
    const src = readFileSync(crystalPath, 'utf8');

    // The three load-bearing elements of the recipe, pinned individually so a failure names
    // WHICH part moved rather than just that something did.
    expect(src).toContain('const sorted = [...pearls].sort()');
    expect(src).toContain('createHash("sha256").update(JSON.stringify(sorted)).digest("hex")');
    expect(src).toContain('return hash.slice(0, 32)');
  });

  test('contentAddress() reproduces that recipe exactly, for a fixed input', () => {
    const parts = ['zebra', 'apple', 'mango'];
    const sorted = [...parts].sort();
    const expected = createHash('sha256').update(JSON.stringify(sorted)).digest('hex').slice(0, 32);
    expect(contentAddress(parts)).toBe(expected);
    expect(contentAddress(parts)).toHaveLength(32);
  });

  test('the address is order-independent, like the Crystal it mirrors', () => {
    expect(contentAddress(['a', 'b'])).toBe(contentAddress(['b', 'a']));
  });
});

describe('the evidence store is an append-only ledger', () => {
  test('a record round-trips with its addresses and sequence intact', () => {
    const acquisitionId = newAcquisitionId(T, 'test1');
    appendEvidence({
      authority: 'google', query: 'density of south america', response: { snippet: '24 per km2' },
      acquisitionId, qid: 98, seq: 0, ts: T, dir,
    });
    const { acquisition, malformedLines } = loadAcquisition(98, acquisitionId, dir);
    expect(malformedLines).toBe(0);
    expect(acquisition).not.toBeNull();
    expect(acquisition!.records).toHaveLength(1);
    expect(acquisition!.records[0].queryKey).toBe(deriveQueryKey('google', 'density of south america'));
    expect(acquisition!.records[0].schema).toBe('liana-evidence/1');
    expect(acquisition!.acquiredAt).toBe(T);
  });

  test('appending never rewrites: two records means two lines, both preserved', () => {
    const acquisitionId = newAcquisitionId(T, 'test2');
    appendEvidence({ authority: 'google', query: 'q1', response: { snippet: 'one' }, acquisitionId, qid: 98, seq: 0, ts: T, dir });
    appendEvidence({ authority: 'google', query: 'q2', response: { snippet: 'two' }, acquisitionId, qid: 98, seq: 1, ts: T, dir });
    const raw = readFileSync(join(dir, `EVIDENCE_qid98_${acquisitionId}.jsonl`), 'utf8');
    expect(raw.trim().split('\n')).toHaveLength(2);
    const { acquisition } = loadAcquisition(98, acquisitionId, dir);
    expect(acquisition!.records.map((r) => r.query)).toEqual(['q1', 'q2']);
  });

  test('a recorded null is preserved as a fact, not lost', () => {
    // "We asked and got nothing" is real evidence. It must survive the round trip, because the
    // replay side treats it differently from "we never asked".
    const acquisitionId = newAcquisitionId(T, 'test3');
    appendEvidence({ authority: 'google', query: 'unanswerable', response: null, acquisitionId, qid: 98, seq: 0, ts: T, dir });
    const { acquisition } = loadAcquisition(98, acquisitionId, dir);
    expect(acquisition!.records[0].response).toBeNull();
  });

  test('acquisitions are listed per question, which is what convergence iterates', () => {
    const a1 = newAcquisitionId(T, 'aaa');
    const a2 = newAcquisitionId('2026-08-13T03:00:00.000Z', 'bbb');
    appendEvidence({ authority: 'google', query: 'q', response: null, acquisitionId: a1, qid: 98, seq: 0, ts: T, dir });
    appendEvidence({ authority: 'google', query: 'q', response: null, acquisitionId: a2, qid: 98, seq: 0, ts: T, dir });
    appendEvidence({ authority: 'google', query: 'q', response: null, acquisitionId: a1, qid: 85, seq: 0, ts: T, dir });
    expect(listAcquisitions(98, dir).sort()).toEqual([a1, a2].sort());
    expect(listAcquisitions(85, dir)).toEqual([a1]);
  });

  test('a malformed line is counted, never silently skipped', () => {
    const acquisitionId = newAcquisitionId(T, 'test4');
    appendEvidence({ authority: 'google', query: 'q', response: null, acquisitionId, qid: 98, seq: 0, ts: T, dir });
    const path = join(dir, `EVIDENCE_qid98_${acquisitionId}.jsonl`);
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    require('node:fs').appendFileSync(path, '{ this is not json\n', 'utf8');
    const { acquisition, malformedLines } = loadAcquisition(98, acquisitionId, dir);
    expect(malformedLines).toBe(1);
    expect(acquisition!.records).toHaveLength(1);
  });
});

describe('the recording wrappers are transparent', () => {
  test('askGoogle recording returns exactly what the inner function returned', async () => {
    const session = newAcquisitionSession({ acquisitionId: newAcquisitionId(T, 'rec1'), qid: 98, dir, now: () => T });
    const inner = async (_q: string) => ({ snippet: 'inner value' } as never);
    const wrapped = recordingAskGoogle(inner, session);
    const got = await wrapped('a question');
    expect(got).toEqual({ snippet: 'inner value' });
    expect(session.written).toHaveLength(1);
    expect(session.written[0].authority).toBe('google');
  });

  test('BOTH authorities share one sequence, so replay reproduces issue ORDER', async () => {
    // The Gemini path bypasses the askGoogle seam entirely (index.ts:3855). If the two wrappers
    // kept separate counters, a replay could not reconstruct which of the two came first.
    const session = newAcquisitionSession({ acquisitionId: newAcquisitionId(T, 'rec2'), qid: 98, dir, now: () => T });
    const g = recordingAskGoogle(async () => null, session);
    const c = recordingConversationalAuthority(
      async () => ({ ok: true, text: 'gemini said', citations: [], via: 'test', authority: 'user_gemini' }),
      session,
    );
    await c('asked gemini first');
    await g('asked google second');
    expect(session.written.map((r) => [r.seq, r.authority])).toEqual([[0, 'conversational'], [1, 'google']]);
  });

  test('a throw from the inner function is not swallowed', async () => {
    const session = newAcquisitionSession({ acquisitionId: newAcquisitionId(T, 'rec3'), qid: 98, dir, now: () => T });
    const wrapped = recordingAskGoogle(async () => { throw new Error('browser died'); }, session);
    await expect(wrapped('q')).rejects.toThrow('browser died');
  });
});

describe('replay is deterministic, and refuses loudly when evidence is missing', () => {
  async function acquire() {
    const acquisitionId = newAcquisitionId(T, 'replay');
    const session = newAcquisitionSession({ acquisitionId, qid: 98, dir, now: () => T });
    const g = recordingAskGoogle(async (q: string) => ({ snippet: `answer to ${q}` } as never), session);
    await g('first');
    await g('second');
    return acquisitionId;
  }

  test('replaying the same acquisition twice gives byte-identical answers', async () => {
    const acquisitionId = await acquire();
    const { acquisition } = loadAcquisition(98, acquisitionId, dir);

    const runOnce = async () => {
      const r = buildReplay(acquisition!);
      return [await r.askGoogle('first'), await r.askGoogle('second')];
    };
    expect(JSON.stringify(await runOnce())).toBe(JSON.stringify(await runOnce()));
  });

  test('a query the acquisition never recorded THROWS rather than returning null', async () => {
    const acquisitionId = await acquire();
    const { acquisition } = loadAcquisition(98, acquisitionId, dir);
    const r = buildReplay(acquisition!);
    // Returning null here would be indistinguishable from "Google answered nothing" -- the exact
    // defect shape this estate keeps finding. It must be loud.
    await expect(r.askGoogle('never asked this')).rejects.toThrow(EvidenceReplayMiss);
  });

  test('onMiss collect records the miss instead of throwing, and still never lies', async () => {
    const acquisitionId = await acquire();
    const { acquisition } = loadAcquisition(98, acquisitionId, dir);
    const r = buildReplay(acquisition!, { onMiss: 'collect' });
    const got = await r.askGoogle('never asked this');
    expect(got).toBeNull();
    expect(r.misses()).toEqual([{ authority: 'google', query: 'never asked this' }]);
  });

  test('repeated identical queries are replayed in order, not collapsed', async () => {
    const acquisitionId = newAcquisitionId(T, 'dupes');
    const session = newAcquisitionSession({ acquisitionId, qid: 98, dir, now: () => T });
    let n = 0;
    const g = recordingAskGoogle(async () => { n += 1; return { snippet: `call ${n}` } as never; }, session);
    await g('same query');
    await g('same query');

    const { acquisition } = loadAcquisition(98, acquisitionId, dir);
    const r = buildReplay(acquisition!);
    expect(await r.askGoogle('same query')).toEqual({ snippet: 'call 1' });
    expect(await r.askGoogle('same query')).toEqual({ snippet: 'call 2' });
    // A third call has no recorded answer left and must not silently reuse the second.
    await expect(r.askGoogle('same query')).rejects.toThrow(EvidenceReplayMiss);
  });

  test('evidence the derivation never consumed is reported, not ignored', async () => {
    const acquisitionId = await acquire();
    const { acquisition } = loadAcquisition(98, acquisitionId, dir);
    const r = buildReplay(acquisition!);
    await r.askGoogle('first');
    expect(r.unconsumed().map((u) => u.query)).toEqual(['second']);
  });
});

// D-BP154-010/BISHOP/S10/seg-thepail -- THE PAIL, lock condition 4: the store we already own must
// be VISIBLE, read-only, unchanged by looking at it. These tests cover summarizeEvidenceStore()
// itself (in a scratch temp dir, per this file's own no-real-ledger-writes discipline above); the
// deliverable doc for this ticket separately hashes the REAL ledger directory before/after this
// session's work to prove this function's own read-only claim held against the real store too.
describe('summarizeEvidenceStore() -- read-only, whole-store, never scoped to one qid', () => {
  test('an empty/non-existent dir summarizes to all zeros, never throws', () => {
    const missing = join(dir, 'does-not-exist');
    expect(summarizeEvidenceStore(missing)).toEqual({
      dir: missing, files: 0, totalBytes: 0, totalRecords: 0, malformedLines: 0,
    });
  });

  test('counts records across MULTIPLE qids and MULTIPLE acquisitions -- not scoped to one qid, unlike listAcquisitions()', async () => {
    const s1 = newAcquisitionSession({ acquisitionId: newAcquisitionId(T, 'a'), qid: 98, dir, now: () => T });
    await recordingAskGoogle(async () => ({ snippet: 'x' } as never), s1)('q1');
    await recordingAskGoogle(async () => ({ snippet: 'y' } as never), s1)('q2');
    const s2 = newAcquisitionSession({ acquisitionId: newAcquisitionId(T, 'b'), qid: 85, dir, now: () => T });
    await recordingAskGoogle(async () => ({ snippet: 'z' } as never), s2)('q3');

    const summary = summarizeEvidenceStore(dir);
    expect(summary.files).toBe(2); // one file per (qid, acquisitionId)
    expect(summary.totalRecords).toBe(3);
    expect(summary.malformedLines).toBe(0);
    expect(summary.totalBytes).toBeGreaterThan(0);
  });

  test('calling it never writes, renames, or deletes anything -- the store is byte-identical before and after', async () => {
    const s1 = newAcquisitionSession({ acquisitionId: newAcquisitionId(T, 'c'), qid: 98, dir, now: () => T });
    await recordingAskGoogle(async () => ({ snippet: 'x' } as never), s1)('q1');
    const before = readFileSync(join(dir, `EVIDENCE_qid98_${s1.acquisitionId}.jsonl`), 'utf8');
    summarizeEvidenceStore(dir);
    summarizeEvidenceStore(dir);
    const after = readFileSync(join(dir, `EVIDENCE_qid98_${s1.acquisitionId}.jsonl`), 'utf8');
    expect(after).toBe(before);
  });

  test('a malformed line is counted, never silently folded into totalRecords', () => {
    const acquisitionId = newAcquisitionId(T, 'malformed');
    const filePath = join(dir, `EVIDENCE_qid98_${acquisitionId}.jsonl`);
    writeFileSync(filePath, '{"schema":"liana-evidence/1","ok":true}\nnot valid json\n{"also":"ok"}\n', 'utf8');
    const summary = summarizeEvidenceStore(dir);
    expect(summary.files).toBe(1);
    expect(summary.totalRecords).toBe(2);
    expect(summary.malformedLines).toBe(1);
  });
});
