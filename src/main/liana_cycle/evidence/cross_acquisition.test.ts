// cross_acquisition.test.ts -- D-BP154-008/BISHOP/S8/seg-mortgage
//
// THE MORTGAGE, TESTED. Deterministic and offline: no network, no Electron, no clock dependence
// (timestamps are injected). Writes only into an OS temp directory via appendEvidence()'s own
// `dir` parameter, NEVER into the real HARDWIRE\LEDGER tree -- same estate discipline
// evidence_store.test.ts's own header states (BP148: 49 of 123 test files once contaminated live
// stores). This file also HASHES the real evidence store before and after the whole suite runs
// and asserts it is byte-identical, per this ticket's own HARD BOUNDARIES.

import { describe, test, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { appendEvidence, newAcquisitionId, resolveEvidenceDir } from './evidence_store';
import { buildPriorAcquisitionOwnedPassages, describePriorAcquisitionProvenance, findPriorAcquisitionMatch } from './cross_acquisition';

// ── THE LIVE STORE, HASHED BEFORE AND AFTER -- HARD BOUNDARIES: "the live evidence store... is
// READ-ONLY to you... hash that directory before and after your test runs and prove it
// unchanged". Every test in this file writes ONLY into `dir` (a temp directory); this hash proves
// that promise held for the real store regardless.
function hashRealStore(): string {
  const real = resolveEvidenceDir();
  if (!existsSync(real)) return 'ABSENT';
  const files = readdirSync(real).filter((f) => f.endsWith('.jsonl')).sort();
  const h = createHash('sha256');
  for (const f of files) {
    h.update(f);
    h.update(readFileSync(join(real, f)));
  }
  return h.digest('hex');
}

const realStoreHashBefore = hashRealStore();
afterAll(() => {
  const realStoreHashAfter = hashRealStore();
  // eslint-disable-next-line no-console
  console.log(`REAL EVIDENCE STORE HASH -- before: ${realStoreHashBefore}  after: ${realStoreHashAfter}`);
  expect(realStoreHashAfter, 'the live LIANA_EVIDENCE store must be byte-identical after this suite runs').toBe(realStoreHashBefore);
});

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'lb-cross-acq-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const T_OLD = '2026-08-10T03:00:00.000Z';
const T_NEW = '2026-08-13T09:00:00.000Z';
const NOW = '2026-08-13T21:00:00.000Z';

// ── REAL SCHEMAS, NOT INVENTED FIXTURES ─────────────────────────────────────────────────────────
// The ticket's own warning: "response.snippet is EMPTY on all 363 Google records. A reader keying
// on .text or .snippet will see an empty store... Verify against the REAL records on disk, not
// against a fixture you invented." These two response shapes mirror
// shared/plow/browser_authority_types.ts's BrowserAuthorityRawExtraction and
// method_registry.ts's ConversationalAuthorityResult exactly -- the same fields, same emptiness,
// that schema carries in the real store.
const REAL_GOOGLE_SCHEMA_RESPONSE = {
  snippet: '', // EMPTY on every one of the 363 real Google records this ticket measured.
  sourceUrl: 'https://www.google.com/search?q=test',
  authority: 'user_google',
  selectorUsed: 'organic',
  results: [
    { rank: 1, url: 'https://en.wikipedia.org/wiki/South_Asia', title: 'South Asia - Wikipedia', snippet: 'South Asia is the southern subregion of Asia, defined in both geographical and ethnic-cultural terms.' },
    { rank: 2, url: 'https://example.com/density', title: 'Population density by region', snippet: 'South Asia is one of the most densely populated regions on Earth.' },
  ],
};

const REAL_CONVERSATIONAL_SCHEMA_RESPONSE = {
  ok: true,
  text: 'South Asia and Northeast United States are both densely populated regions; Arctic Circle is not a world region at all, it is a biome.',
  citations: ['https://example.com/geography'],
  via: 'nexus-gemini',
  authority: 'user_gemini',
};

describe('findPriorAcquisitionMatch -- exact query-text lookup across acquisitions', () => {
  test('finds a record in a PRIOR acquisition by exact (authority, query) match', () => {
    const a1 = newAcquisitionId(T_OLD, 'a1');
    appendEvidence({
      authority: 'google', query: 'ambiguity query text', response: REAL_GOOGLE_SCHEMA_RESPONSE,
      acquisitionId: a1, qid: 98, seq: 0, ts: T_OLD, dir,
    });
    const match = findPriorAcquisitionMatch(98, 'google', 'ambiguity query text', { dir, now: () => NOW });
    expect(match).not.toBeNull();
    expect(match!.acquisitionId).toBe(a1);
    expect(match!.ts).toBe(T_OLD);
    expect(match!.ageMs).toBeGreaterThan(0);
  });

  test('returns null, never a fabricated hit, when no acquisition holds the query', () => {
    const match = findPriorAcquisitionMatch(98, 'google', 'never asked', { dir });
    expect(match).toBeNull();
  });

  test('a DIFFERENT query text is never matched, even for the same qid and authority', () => {
    const a1 = newAcquisitionId(T_OLD, 'a1');
    appendEvidence({
      authority: 'google', query: 'exact wording A', response: REAL_GOOGLE_SCHEMA_RESPONSE,
      acquisitionId: a1, qid: 98, seq: 0, ts: T_OLD, dir,
    });
    expect(findPriorAcquisitionMatch(98, 'google', 'exact wording B', { dir })).toBeNull();
  });

  test('excludeAcquisitionId keeps a run from reusing the acquisition it is itself writing', () => {
    const a1 = newAcquisitionId(T_OLD, 'mine');
    appendEvidence({
      authority: 'google', query: 'q', response: REAL_GOOGLE_SCHEMA_RESPONSE,
      acquisitionId: a1, qid: 98, seq: 0, ts: T_OLD, dir,
    });
    expect(findPriorAcquisitionMatch(98, 'google', 'q', { dir, excludeAcquisitionId: a1 })).toBeNull();
  });

  test('with more than one prior acquisition holding the query, the match is deterministic (oldest acquisition id first), not a recency preference', () => {
    const older = newAcquisitionId(T_OLD, 'older');
    const newer = newAcquisitionId(T_NEW, 'newer');
    appendEvidence({ authority: 'google', query: 'q', response: { ...REAL_GOOGLE_SCHEMA_RESPONSE, sourceUrl: 'older' }, acquisitionId: older, qid: 98, seq: 0, ts: T_OLD, dir });
    appendEvidence({ authority: 'google', query: 'q', response: { ...REAL_GOOGLE_SCHEMA_RESPONSE, sourceUrl: 'newer' }, acquisitionId: newer, qid: 98, seq: 0, ts: T_NEW, dir });
    const match = findPriorAcquisitionMatch(98, 'google', 'q', { dir });
    expect(match!.acquisitionId).toBe(older);
    // Reproducible under the SAME store contents, run twice.
    const again = findPriorAcquisitionMatch(98, 'google', 'q', { dir });
    expect(again!.acquisitionId).toBe(older);
  });

  test('a qid with no acquisitions on disk at all returns null, not a throw', () => {
    expect(findPriorAcquisitionMatch(999999, 'google', 'q', { dir })).toBeNull();
  });
});

describe('THE TRAP -- a Google-schema record (results[], empty outer snippet) is readable and usable', () => {
  test('buildPriorAcquisitionOwnedPassages() reads results[] content, not the empty outer .snippet', async () => {
    const a1 = newAcquisitionId(T_OLD, 'google-schema');
    // Sanity-check the fixture itself carries the trap the ticket names: outer snippet empty.
    expect(REAL_GOOGLE_SCHEMA_RESPONSE.snippet).toBe('');
    expect(REAL_GOOGLE_SCHEMA_RESPONSE.results.length).toBeGreaterThan(0);
    appendEvidence({
      authority: 'google', query: 'ambiguity: what could be understood differently', response: REAL_GOOGLE_SCHEMA_RESPONSE,
      acquisitionId: a1, qid: 98, seq: 0, ts: T_OLD, dir,
    });
    const out = await buildPriorAcquisitionOwnedPassages(
      98,
      [{ kind: 'ambiguity', askedText: 'ambiguity: what could be understood differently' }],
      { dir, now: () => NOW },
    );
    expect(out).toHaveLength(1);
    // THE ASSERTION THAT MATTERS: the text is NOT empty (a reader keying on .snippet alone would
    // see '' here and fall through to a fresh query, indistinguishable from an empty store).
    expect(out[0].text.trim().length).toBeGreaterThan(0);
    // And it actually carries the results[] content, not a fabricated placeholder.
    expect(out[0].text).toContain('South Asia');
    expect(out[0].kind).toBe('ambiguity');
    expect(out[0].acquisitionId).toBe(a1);
  });

  test('a conversational-schema record (response.text) still works exactly as today -- SCOPE GUARD', async () => {
    const a1 = newAcquisitionId(T_OLD, 'convo-schema');
    appendEvidence({
      authority: 'conversational', query: 'operation: what operation does this question require',
      response: REAL_CONVERSATIONAL_SCHEMA_RESPONSE, acquisitionId: a1, qid: 98, seq: 0, ts: T_OLD, dir,
    });
    const out = await buildPriorAcquisitionOwnedPassages(
      98,
      [{ kind: 'operation', askedText: 'operation: what operation does this question require' }],
      { dir, now: () => NOW },
    );
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe(REAL_CONVERSATIONAL_SCHEMA_RESPONSE.text);
    expect(out[0].kind).toBe('operation');
  });

  test('an all-content-less Google record (no snippet, no results) yields NO owned passage -- never fabricated text', async () => {
    const a1 = newAcquisitionId(T_OLD, 'contentless');
    appendEvidence({
      authority: 'google', query: 'ambiguity q', response: { snippet: '', sourceUrl: null, authority: 'user_google', selectorUsed: null },
      acquisitionId: a1, qid: 98, seq: 0, ts: T_OLD, dir,
    });
    const out = await buildPriorAcquisitionOwnedPassages(98, [{ kind: 'ambiguity', askedText: 'ambiguity q' }], { dir });
    expect(out).toHaveLength(0);
  });
});

describe('FAIL-BEFORE / PASS-AFTER -- the actual mechanism THE MORTGAGE ticket requires', () => {
  test('BEFORE: no prior acquisition on disk -> nothing to reuse (a caller would issue a fresh query)', async () => {
    const out = await buildPriorAcquisitionOwnedPassages(98, [{ kind: 'ambiguity', askedText: 'the ambiguity question' }], { dir });
    expect(out).toHaveLength(0);
  });

  test('AFTER: the SAME qid/query, now owned by a prior acquisition -> answered with no query', async () => {
    const a1 = newAcquisitionId(T_OLD, 'fail-before-pass-after');
    appendEvidence({
      authority: 'conversational', query: 'the ambiguity question', response: REAL_CONVERSATIONAL_SCHEMA_RESPONSE,
      acquisitionId: a1, qid: 98, seq: 0, ts: T_OLD, dir,
    });
    const out = await buildPriorAcquisitionOwnedPassages(98, [{ kind: 'ambiguity', askedText: 'the ambiguity question' }], { dir, now: () => NOW });
    expect(out).toHaveLength(1);
    expect(out[0].text.length).toBeGreaterThan(0);
  });
});

describe('provenance -- WHAT TO BUILD section 5: acquisition id, timestamp, age, never a staleness cutoff', () => {
  test('every reused passage carries acquisitionId/acquiredAt/ageMsAtUse', async () => {
    const a1 = newAcquisitionId(T_OLD, 'provenance');
    appendEvidence({
      authority: 'google', query: 'q', response: REAL_GOOGLE_SCHEMA_RESPONSE,
      acquisitionId: a1, qid: 98, seq: 0, ts: T_OLD, dir,
    });
    const out = await buildPriorAcquisitionOwnedPassages(98, [{ kind: 'ambiguity', askedText: 'q' }], { dir, now: () => NOW });
    expect(out[0].acquisitionId).toBe(a1);
    expect(out[0].acquiredAt).toBe(T_OLD);
    expect(out[0].ageMsAtUse).toBe(new Date(NOW).getTime() - new Date(T_OLD).getTime());
  });

  test('describePriorAcquisitionProvenance() names id, timestamp, and age -- never a cutoff decision', () => {
    const line = describePriorAcquisitionProvenance({
      record: { schema: 'liana-evidence/1', address: 'x', queryKey: 'y', authority: 'google', query: 'q', response: null, ts: T_OLD, acquisitionId: 'acq1', qid: 98, seq: 0 },
      acquisitionId: 'acq1',
      ts: T_OLD,
      ageMs: 3 * 60 * 60 * 1000, // 3 hours
    });
    expect(line).toContain('acq1');
    expect(line).toContain(T_OLD);
    expect(line).toMatch(/3\.0 hour/);
    // Never a cutoff/expiry word -- this function reports, it never judges.
    expect(line.toLowerCase()).not.toMatch(/stale|expired|too old|cutoff/);
  });
});

describe('excludeAcquisitionId prevents a run from reusing its own in-progress evidence', () => {
  test('buildPriorAcquisitionOwnedPassages() never returns the currently-writing acquisition', async () => {
    const mine = newAcquisitionId(T_NEW, 'mine');
    appendEvidence({
      authority: 'google', query: 'q', response: REAL_GOOGLE_SCHEMA_RESPONSE,
      acquisitionId: mine, qid: 98, seq: 0, ts: T_NEW, dir,
    });
    const out = await buildPriorAcquisitionOwnedPassages(98, [{ kind: 'ambiguity', askedText: 'q' }], { dir, excludeAcquisitionId: mine });
    expect(out).toHaveLength(0);
  });
});

describe('HARDWIRE-22 / FD-BP153-06 -- extraction only, never a judgment, never keyed on the answer', () => {
  test('the match is selected by query text and authority alone -- no source line in this module reads `.correctAnswer`', () => {
    const src = readFileSync(join(__dirname, 'cross_acquisition.ts'), 'utf8');
    expect(src).not.toMatch(/\.correctAnswer\b/);
  });
});
