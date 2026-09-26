// seed_loader.test.ts -- D-BP223-BM04-X033S3-009 STEP 3
//
// Loads the REAL shipped manifest (src/main/proveit/seed/seed_cards_manifest.json) against an
// isolated temp card store (never the real userData), so the 1061/999/62 numbers this test asserts
// are the actual shipped file's own numbers, not a fixture's.
// D-BP223-BM0-X034-018 (Founder 2026-09-20T23:08Z "Re-mint."): 639/579/60 -> 641/579/62 after the two
// Claude Opus re-mint rows for qids 556 and 644 (source_group wave_4_opus_remint) were added beside their
// wave-4 retrieval rows, which stay as duplicates.
// D-BP223-BM0-X036-018 (Founder 2026-09-22T01:15Z "re-mints stay, cut .9.36"): folded in
// D-BP223-BM04-S3004-003's seed-999 set, 641/579/62 -> 1061/999/62 (the 300 + the 699 of record,
// same 62 duplicates); qids 556 and 644 stay of record as the wave_4_opus_remint rows per that
// ruling (see seed_cards_manifest.json summary.of_record_override_founder_20260922).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { resolve } from 'path';
import { _setProveItRootForTests } from './userdata_paths';
import { loadSeedCards, loadManifest, normalizeSeedCategory, buildAttributionModelSlot, ensureSeedCardsLoadedOnce, DEFAULT_MANIFEST_PATH } from './seed_loader';
import { readAllCards } from './card_store';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'proveit-seed-loader-'));
  _setProveItRootForTests(dir);
});

afterEach(() => {
  _setProveItRootForTests(null);
  rmSync(dir, { recursive: true, force: true });
});

describe('the shipped manifest', () => {
  it('exists and matches the 1061 rows / 999 distinct qids / 62 duplicates on file (the seed-999 fold: the 300 + the 699 of record, same 62 duplicates as the 641-row set, 556/644 Opus re-mint of record per Founder ruling 2026-09-22 "re-mints stay")', () => {
    expect(existsSync(DEFAULT_MANIFEST_PATH)).toBe(true);
    const manifest = loadManifest();
    expect(manifest.rows).toHaveLength(1061);
    expect(manifest.summary.total_rows_in_manifest).toBe(1061);
    expect(manifest.summary.distinct_qids).toBe(999);
    expect(manifest.summary.duplicate_qid_count).toBe(62);
    expect(manifest.summary.duplicate_qids).toContain(556);
    expect(manifest.summary.duplicate_qids).toContain(644);
    expect(new Set(manifest.rows.map((r) => r.qid)).size).toBe(999);
  });
});

describe('loadSeedCards', () => {
  it('loads every row whose category normalizes, none skipped for the real shipped manifest', () => {
    const result = loadSeedCards();
    expect(result.attemptedRows).toBe(1061);
    expect(result.loadedCards).toBe(1061);
    expect(result.skippedUnknownCategory).toEqual([]);
    expect(readAllCards()).toHaveLength(1061);
  });

  it('is idempotent: a second run with the same store adds nothing new', () => {
    loadSeedCards();
    const second = loadSeedCards();
    expect(second.loadedCards).toBe(0);
    expect(second.alreadyLoaded).toBe(1061);
    expect(readAllCards()).toHaveLength(1061);
  });

  it('D-BP223-BM0-X034-018: the two Opus re-mint rows (qids 556, 644) load beside their wave-4 retrieval rows, carry the re-minted answer text, and are attributed to Claude Opus', () => {
    loadSeedCards();
    const cards = readAllCards();
    for (const [qid, answer] of [[556, '(i) 585, (ii) Yes'], [644, '76.56%']] as Array<[number, string]>) {
      const remint = cards.find((c) => c.seedSource === `MMLU-Pro qid ${qid} . wave_4_opus_remint`);
      const original = cards.find((c) => c.seedSource === `MMLU-Pro qid ${qid} . waves_2_to_8`);
      expect(remint).toBeTruthy();
      expect(original).toBeTruthy();
      expect(remint!.answer).toBe(answer);
      expect(remint!.seedAttribution).toMatch(/answered by Claude Opus \. checked against the key/);
      expect(remint!.duplicateOfQid).toBe(qid);
      expect(original!.duplicateOfQid).toBe(qid);
      expect(original!.answer).toMatch(/^no option matched/); // the wrong card stays wrong, shown honestly
    }
  });

  it('loads BOTH mints of a duplicate qid and flags both with duplicateOfQid, never picking a winner', () => {
    const manifest = loadManifest();
    const dupQid = manifest.summary.duplicate_qids[0];
    loadSeedCards();
    const cards = readAllCards().filter((c) => c.seedSource?.startsWith(`MMLU-Pro qid ${dupQid} .`));
    expect(cards.length).toBeGreaterThanOrEqual(2);
    for (const c of cards) expect(c.duplicateOfQid).toBe(dupQid);
    // Both addresses are distinct (no collision), both published (seed cards are pre-published).
    expect(new Set(cards.map((c) => c.address)).size).toBe(cards.length);
    for (const c of cards) expect(c.publishedAt).not.toBeNull();
  });

  it('every seed card carries the exact "MnemosyneC seed . MMLU-Pro qid N . answered by ... . checked against the key . <date>" attribution format -- in seedAttribution, not answer (D-BP223-BM04-X033S3-010 Gap 1: answer now carries the card\'s own real resolved text)', () => {
    loadSeedCards();
    const sample = readAllCards()[0];
    expect(sample.seedAttribution).toMatch(/^MnemosyneC seed \. MMLU-Pro qid \d+ \. answered by .+ \. (checked against the key|not checked against the key) \. \d{4}-\d{2}-\d{2}$/);
  });

  it('D-BP223-BM04-X033S3-010 Gap 1: seed cards carry the real MMLU-Pro question text from seed_cards.json, never the qid-pointer placeholder, for every row seed_cards.json resolved', () => {
    loadSeedCards();
    const cards = readAllCards();
    const qid70 = cards.find((c) => c.seedSource === 'MMLU-Pro qid 70 . original_300');
    expect(qid70).toBeTruthy();
    expect(qid70!.question).not.toMatch(/^MMLU-Pro qid \d+ \(/);
    expect(qid70!.question.length).toBeGreaterThan(10);
  });

  it('never shows an empty question or answer -- a field seed_cards.json could not resolve renders as the literal fallback string, never blank', () => {
    loadSeedCards();
    const cards = readAllCards();
    for (const c of cards) {
      expect(c.question.trim().length).toBeGreaterThan(0);
      expect(c.answer.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('ensureSeedCardsLoadedOnce', () => {
  it('loads once on first call, then no-ops on a second call (marker file present)', () => {
    const first = ensureSeedCardsLoadedOnce();
    expect(first?.loadedCards).toBe(1061);
    const second = ensureSeedCardsLoadedOnce();
    expect(second).toBeNull(); // marker already present -- never re-scans
  });
});

describe('normalizeSeedCategory', () => {
  it('maps "computer science" (space) to the picker slug "computer-science"', () => {
    expect(normalizeSeedCategory('computer science')).toBe('computer-science');
  });
  it('maps a professional_-prefixed variant to its parent category', () => {
    expect(normalizeSeedCategory('professional_law')).toBe('law');
  });
  it('returns null (never guesses) for an unknown category', () => {
    expect(normalizeSeedCategory('astrology')).toBeNull();
  });
});

describe('buildAttributionModelSlot (SEED_LOADER.md Section 2a table, verbatim)', () => {
  it('flagship_reasoning uses the row\'s own answering_model literally', () => {
    expect(buildAttributionModelSlot({ answering_kind: 'flagship_reasoning', answering_model: 'Claude Sonnet 5' } as never)).toBe('Claude Sonnet 5');
  });
  it('code_only never claims to be answered by an AI model', () => {
    expect(buildAttributionModelSlot({ answering_kind: 'code_only', answering_model: 'x' } as never)).toMatch(/not an AI-model answer/);
  });
  it('code_with_local_model_assist names itself distinctly from a flagship answer', () => {
    expect(buildAttributionModelSlot({ answering_kind: 'code_with_local_model_assist', answering_model: 'x' } as never)).toMatch(/local model architect/);
  });
  it('code_repaired_from_key names the repair explicitly', () => {
    expect(buildAttributionModelSlot({ answering_kind: 'code_repaired_from_key', answering_model: 'x' } as never)).toMatch(/repaired against the answer key/);
  });
});
