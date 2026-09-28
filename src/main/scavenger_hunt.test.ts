// scavenger_hunt.test.ts -- D-BP223-BM0-X033-022 (SEG, "Haystack Needle" test #2)
//
// Every test points the run log at a per-run temp file (never the real userData store) via
// _setScavengerHuntLogPathForTests, same isolation convention as
// substrate_savings_receipt.test.ts's _setLogPathForTests.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { resolve, join } from 'path';
import {
  normalizePhrase,
  findScavengerHuntMatches,
  buildScavengerHuntAnswer,
  emitScavengerHuntRun,
  verifyScavengerHuntChain,
  computePopularPhrases,
  measureSearchTokens,
  measureAnswerTokens,
  _setScavengerHuntLogPathForTests,
  DID_YOU_MEAN_FLOOR,
  MAX_CANDIDATES,
  type ScavengerHuntRunRecord,
} from './scavenger_hunt';
import { computeQuestionSimilaritySymmetric, type VerifiedEbletEntry } from './mnem_eblet_store';

// ─── Fixtures ───────────────────────────────────────────────────────────────

function fixtureEntry(overrides: Partial<VerifiedEbletEntry>): VerifiedEbletEntry {
  return {
    question: 'What was Benjamin Franklin\'s birthday?',
    answer: 'January 17, 1706.',
    provenance: 'spider:wikipedia:test-session',
    verified: true,
    sha256: 'deadbeef',
    timestamp: 1700000000000,
    ...overrides,
  };
}

const POOL: VerifiedEbletEntry[] = [
  fixtureEntry({
    question: "What was Benjamin Franklin's birthday?",
    answer: 'January 17, 1706.',
    provenance: 'spider:wikipedia:sess-1',
  }),
  fixtureEntry({
    question: "When was Ayn Rand's birthday?",
    answer: 'February 2, 1905.',
    provenance: 'spider:wikipedia:sess-2',
  }),
  fixtureEntry({
    question: 'What is the capital of France?',
    answer: 'Paris.',
    provenance: 'spider:wikipedia:sess-3',
  }),
  fixtureEntry({
    question: 'A fragment used inside another answer',
    answer: 'fragment text',
    provenance: 'spider:wikipedia:sess-4',
    class: 'component',
  }),
];

// ─── normalizePhrase ────────────────────────────────────────────────────────

describe('normalizePhrase', () => {
  it('lowercases, strips punctuation, and collapses whitespace', () => {
    expect(normalizePhrase("Ben Franklin's Bday?")).toBe('ben franklin s bday');
  });

  it('collapses repeated internal whitespace to single spaces', () => {
    expect(normalizePhrase('What   is\t\tthe   capital?')).toBe('what is the capital');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizePhrase('  hello world  ')).toBe('hello world');
  });

  it('is idempotent (normalizing twice is the same as once)', () => {
    const once = normalizePhrase("What is Benjamin Franklin's birthday?");
    expect(normalizePhrase(once)).toBe(once);
  });

  it('produces non-empty comparable output for two real paraphrases from the worked example', () => {
    // Not asserting equality of the FULL normalized string (word order/spelling still differ) --
    // the actual "are these the same question" judgment is computeQuestionSimilaritySymmetric's
    // job, exercised separately below.
    const a = normalizePhrase("What is Benjamin Franklin's birthday?");
    const b = normalizePhrase('Ben Franklins Bday?');
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
  });
});

// ─── findScavengerHuntMatches ───────────────────────────────────────────────

// NOTE ON MATCHING LIMITS, DISCLOSED RATHER THAN GLOSSED OVER: computeQuestionSimilaritySymmetric
// (reused verbatim from mnem_eblet_store.ts) is TOKEN-OVERLAP matching, not spelling/nickname/
// abbreviation resolution. A phrase that swaps in a nickname or abbreviation for every
// discriminating word ("Ben Franklins Bday?" vs stored "What was Benjamin Franklin's
// birthday?" -- "ben"!="benjamin", "franklins"!="franklin", "bday"!="birthday", zero shared
// tokens) scores 0 under this matcher and will NOT surface as a candidate. Catching that case
// would need the embedding/SimHash path mnem_eblet_store.ts's own BP137 Yoke already built
// (findNearestBySemanticCode) -- but that path requires embedding the NEW query at search time
// (ollamaManager.embed()), which is a model call, and this ticket's own law (HARDWIRE-22 / "zero
// model calls at answer time") rules that out for this feature. The tests below use realistic
// near-restatements (missing/extra words, tense changes, reordering) -- the class of paraphrase
// this zero-model-call matcher CAN honestly catch -- rather than the nickname/abbreviation case,
// which is a named, disclosed gap (see FINDINGS.md), not a silently-claimed capability.
describe('findScavengerHuntMatches', () => {
  it('reports substrate_empty when the pool is empty', () => {
    const result = findScavengerHuntMatches('anything', []);
    expect(result.substrate_empty).toBe(true);
    expect(result.candidates).toEqual([]);
  });

  it('reports substrate_empty when the pool has only component fragments', () => {
    const result = findScavengerHuntMatches('anything', [POOL[3]]);
    expect(result.substrate_empty).toBe(true);
  });

  it('finds a near-restatement of a stored question above the did-you-mean floor', () => {
    const result = findScavengerHuntMatches("When is Benjamin Franklin's birthday date?", POOL);
    expect(result.substrate_empty).toBe(false);
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0].question).toBe("What was Benjamin Franklin's birthday?");
    expect(result.candidates[0].similarity).toBeGreaterThanOrEqual(DID_YOU_MEAN_FLOOR);
  });

  it('never returns an unrelated question above the floor for a specific phrase', () => {
    const result = findScavengerHuntMatches("When is Benjamin Franklin's birthday date?", POOL);
    const capitalMatch = result.candidates.find((c) => c.question.includes('capital of France'));
    expect(capitalMatch).toBeUndefined();
  });

  it('excludes class:"component" fragment rows from candidates', () => {
    const result = findScavengerHuntMatches('A fragment used inside another answer', POOL);
    const fragmentMatch = result.candidates.find((c) => c.question.includes('fragment'));
    expect(fragmentMatch).toBeUndefined();
  });

  it('caps the candidate list at MAX_CANDIDATES ("never a dropdown of everything")', () => {
    const bigPool: VerifiedEbletEntry[] = Array.from({ length: 20 }, (_, i) =>
      fixtureEntry({ question: `What was Benjamin Franklin's birthday number ${i}?`, provenance: `spider:test:${i}` }),
    );
    const result = findScavengerHuntMatches("What was Benjamin Franklin's birthday?", bigPool);
    expect(result.candidates.length).toBeLessThanOrEqual(MAX_CANDIDATES);
  });

  it('sorts candidates by descending similarity', () => {
    const result = findScavengerHuntMatches("When is Benjamin Franklin's birthday date?", POOL);
    for (let i = 1; i < result.candidates.length; i++) {
      expect(result.candidates[i - 1].similarity).toBeGreaterThanOrEqual(result.candidates[i].similarity);
    }
  });

  it('marks wouldAutoServe only at/above SERVE_VERBATIM_THRESHOLD (0.6)', () => {
    const result = findScavengerHuntMatches("What was Benjamin Franklin's birthday?", POOL);
    const exact = result.candidates[0];
    expect(exact.similarity).toBeGreaterThanOrEqual(0.6);
    expect(exact.wouldAutoServe).toBe(true);
  });

  it('says "no similar phrase found" honestly (empty candidates, substrate NOT empty) for a phrase with no match', () => {
    const result = findScavengerHuntMatches('completely unrelated gibberish zzy qqx', POOL);
    expect(result.substrate_empty).toBe(false);
    expect(result.candidates).toEqual([]);
  });

  it('reports an empty aliases_fired list for a phrase with no alias-table hits', () => {
    const result = findScavengerHuntMatches("When is Benjamin Franklin's birthday date?", POOL);
    expect(result.aliases_fired).toEqual([]);
  });
});

// ─── Alias-table integration (D-BP223-BM0-X033-060, "option C") ────────────────────────────
//
// The gap named directly above (and in D-BP223-BM0-X033-022's own FINDINGS.md, "Disclosed
// matching-capability gap") is closed here: the Founder's own worked example now matches, via
// scavenger_hunt_aliases.ts's hand-kept table, with zero model calls. See
// scavenger_hunt_aliases.test.ts for the alias table's own unit tests (a dozen+ beyond this one).
describe('findScavengerHuntMatches with the alias table (Founder worked example)', () => {
  it('matches "Ben Franklins Bday?" against "What was Benjamin Franklin\'s birthday?" via aliases', () => {
    const result = findScavengerHuntMatches('Ben Franklins Bday?', POOL);
    expect(result.substrate_empty).toBe(false);
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0].question).toBe("What was Benjamin Franklin's birthday?");
    expect(result.candidates[0].similarity).toBeGreaterThanOrEqual(DID_YOU_MEAN_FLOOR);
  });

  it('reports exactly which aliases fired, in order, for the worked example', () => {
    const result = findScavengerHuntMatches('Ben Franklins Bday?', POOL);
    expect(result.aliases_fired).toEqual(['ben->benjamin', 'franklins->franklin', 'bday->birthday']);
  });

  it('leaves normalized_phrase as the bare (unaliased) normalization, not the expanded form', () => {
    const result = findScavengerHuntMatches('Ben Franklins Bday?', POOL);
    expect(result.normalized_phrase).toBe('ben franklins bday');
  });

  it('without the alias table the same phrase would score 0 (regression guard for the disclosed gap)', () => {
    // Direct call to the underlying matcher with the RAW phrase, bypassing alias expansion --
    // documents the exact defect this ticket closed, so a future refactor that accidentally
    // routes the raw (unaliased) phrase back into the matcher fails loudly here, not silently.
    const raw = 'Ben Franklins Bday?';
    const direct = computeQuestionSimilaritySymmetric(raw, "What was Benjamin Franklin's birthday?");
    expect(direct).toBe(0);
  });
});

// ─── buildScavengerHuntAnswer ───────────────────────────────────────────────

describe('buildScavengerHuntAnswer', () => {
  it('copies question/answer verbatim and reports the bare provenance as the sole source', () => {
    const out = buildScavengerHuntAnswer(POOL[0]);
    expect(out.question).toBe(POOL[0].question);
    expect(out.answer).toBe(POOL[0].answer);
    expect(out.sources).toEqual(['spider:wikipedia:sess-1']);
  });

  it('never fabricates a source: an entry with no provenanceDetail yields exactly one source', () => {
    const out = buildScavengerHuntAnswer(POOL[1]);
    expect(out.sources.length).toBe(1);
  });

  it('includes corroboration_sources, deduplicated, when present', () => {
    const entry = fixtureEntry({
      provenance: 'spider:wikipedia:sess-5',
      provenanceDetail: {
        source: 'wikipedia',
        method: 'test',
        corroboration_sources: ['spider:wikipedia:sess-5', 'sprite:archive:sess-6'],
        hash: 'x',
        ts: '2026-01-01T00:00:00Z',
      },
    });
    const out = buildScavengerHuntAnswer(entry);
    expect(out.sources).toEqual(['spider:wikipedia:sess-5', 'sprite:archive:sess-6']);
  });
});

// ─── Zero-model-call guard ──────────────────────────────────────────────────

describe('zero-model-call guard', () => {
  it('every emitted run record carries the literal model_calls: 0', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scavhunt-'));
    const logFile = resolve(dir, 'runs.jsonl');
    _setScavengerHuntLogPathForTests(logFile);
    try {
      const rec = emitScavengerHuntRun({
        raw_phrase: 'test',
        normalized_phrase: 'test',
        candidates_shown: 1,
        selected_question: 'test?',
        tokens_used: 12,
        latency_ms: 3,
        sources_count: 1,
      });
      expect(rec.model_calls).toBe(0);
      const onDisk = JSON.parse(readFileSync(logFile, 'utf-8').trim()) as ScavengerHuntRunRecord;
      expect(onDisk.model_calls).toBe(0);
    } finally {
      _setScavengerHuntLogPathForTests(null);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("this module's own source imports no LLM/HTTP/model client (structural check)", () => {
    const source = readFileSync(resolve(__dirname, 'scavenger_hunt.ts'), 'utf-8');
    const forbidden = [
      /from ['"].*ollama_manager['"]/i,
      /from ['"]@anthropic-ai\/sdk['"]/i,
      /from ['"]@google\/generative-ai['"]/i,
      /\bfetch\(/,
      /require\(['"]https?['"]\)/,
    ];
    for (const pattern of forbidden) {
      expect(source).not.toMatch(pattern);
    }
  });

  it('measureSearchTokens/measureAnswerTokens are pure arithmetic over already-computed data', () => {
    const result = findScavengerHuntMatches("When is Benjamin Franklin's birthday date?", POOL);
    const tokens = measureSearchTokens(result);
    expect(typeof tokens).toBe('number');
    expect(tokens).toBeGreaterThan(0);
    const answer = buildScavengerHuntAnswer(POOL[0]);
    const answerTokens = measureAnswerTokens(answer);
    expect(answerTokens).toBeGreaterThan(0);
  });
});

// ─── Hash-chained log ───────────────────────────────────────────────────────

describe('scavenger hunt run log (hash chain)', () => {
  let dir: string;
  let logFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'scavhunt-chain-'));
    logFile = resolve(dir, 'runs.jsonl');
    _setScavengerHuntLogPathForTests(logFile);
  });

  afterEach(() => {
    _setScavengerHuntLogPathForTests(null);
    rmSync(dir, { recursive: true, force: true });
  });

  it('an empty/nonexistent log verifies ok with zero records', () => {
    const result = verifyScavengerHuntChain(logFile);
    expect(result).toEqual({ ok: true, total_records: 0, broken_at_index: null });
  });

  it('chains prev_hash correctly across multiple appends and verifies ok', () => {
    emitScavengerHuntRun({
      raw_phrase: 'a', normalized_phrase: 'a', candidates_shown: 1,
      selected_question: 'a?', tokens_used: 10, latency_ms: 1, sources_count: 1,
    });
    emitScavengerHuntRun({
      raw_phrase: 'b', normalized_phrase: 'b', candidates_shown: 2,
      selected_question: 'b?', tokens_used: 11, latency_ms: 2, sources_count: 1,
    });
    emitScavengerHuntRun({
      raw_phrase: 'c', normalized_phrase: 'c', candidates_shown: 0,
      selected_question: null, tokens_used: 5, latency_ms: 1, sources_count: 0,
    });
    const result = verifyScavengerHuntChain(logFile);
    expect(result.ok).toBe(true);
    expect(result.total_records).toBe(3);

    const lines = readFileSync(logFile, 'utf-8').trim().split('\n').map((l) => JSON.parse(l) as ScavengerHuntRunRecord);
    expect(lines[0].prev_hash).toBe('GENESIS');
    expect(lines[1].prev_hash).toBe(lines[0].hash);
    expect(lines[2].prev_hash).toBe(lines[1].hash);
  });

  it('detects a broken chain when a record is edited after the fact', () => {
    emitScavengerHuntRun({
      raw_phrase: 'a', normalized_phrase: 'a', candidates_shown: 1,
      selected_question: 'a?', tokens_used: 10, latency_ms: 1, sources_count: 1,
    });
    emitScavengerHuntRun({
      raw_phrase: 'b', normalized_phrase: 'b', candidates_shown: 2,
      selected_question: 'b?', tokens_used: 11, latency_ms: 2, sources_count: 1,
    });
    const lines = readFileSync(logFile, 'utf-8').trim().split('\n');
    const tampered = JSON.parse(lines[0]) as ScavengerHuntRunRecord;
    (tampered as unknown as { tokens_used: number }).tokens_used = 99999; // edit without recomputing hash
    lines[0] = JSON.stringify(tampered);
    writeFileSync(logFile, lines.join('\n') + '\n', 'utf-8');

    const result = verifyScavengerHuntChain(logFile);
    expect(result.ok).toBe(false);
    expect(result.broken_at_index).toBe(0);
  });
});

// ─── Popular phrases ────────────────────────────────────────────────────────

describe('computePopularPhrases', () => {
  let dir: string;
  let logFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'scavhunt-popular-'));
    logFile = resolve(dir, 'runs.jsonl');
    _setScavengerHuntLogPathForTests(logFile);
  });

  afterEach(() => {
    _setScavengerHuntLogPathForTests(null);
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns an empty list against an empty log', () => {
    expect(computePopularPhrases(logFile)).toEqual([]);
  });

  it('ranks by local occurrence count of normalized_phrase only', () => {
    for (const phrase of ['ben franklins bday', 'ben franklins bday', 'capital of france']) {
      emitScavengerHuntRun({
        raw_phrase: phrase, normalized_phrase: phrase, candidates_shown: 1,
        selected_question: null, tokens_used: 5, latency_ms: 1, sources_count: 0,
      });
    }
    const popular = computePopularPhrases(logFile);
    expect(popular[0]).toEqual({ normalized_phrase: 'ben franklins bday', count: 2 });
    expect(popular[1]).toEqual({ normalized_phrase: 'capital of france', count: 1 });
  });

  it('respects the limit parameter', () => {
    for (let i = 0; i < 5; i++) {
      emitScavengerHuntRun({
        raw_phrase: `phrase ${i}`, normalized_phrase: `phrase ${i}`, candidates_shown: 0,
        selected_question: null, tokens_used: 1, latency_ms: 1, sources_count: 0,
      });
    }
    expect(computePopularPhrases(logFile, 2).length).toBe(2);
  });
});
