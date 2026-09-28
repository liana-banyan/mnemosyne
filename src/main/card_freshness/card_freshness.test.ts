// D-BP223-BM0-X030-073: stale class + cutoff + correction precedence, and the Conduit twin drift guard.
import { describe, test, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { classifyCard, decayScore, reuseDecision, CUTOFF_DAYS, DECAY_CONSTANT_DAYS, REAL_HALF_LIFE_DAYS, REUSE_LABELS, type FreshnessCardMeta, type CorrectionRecord } from './card_freshness';

const DAY = 86_400_000;
const NOW = Date.parse('2026-09-17T00:00:00Z');
const ago = (d: number) => NOW - d * DAY;

describe('class assignment is deterministic from card metadata', () => {
  test('canon markers: explicit, anchor, founder provenance, canon tag', () => {
    expect(classifyCard({ freshness_class: 'canon' })).toBe('canon');
    expect(classifyCard({ pheromone_class: 'anchor', question: 'what is the current price' })).toBe('canon');
    expect(classifyCard({ provenance: 'founder:k/0a8d1c96' })).toBe('canon');
    expect(classifyCard({ tags: ['Founder-Ruling'] })).toBe('canon');
  });
  test('volatile markers: prices, versions, counts, dates, current/latest', () => {
    for (const q of ['What is the price of X?', 'Which version of Node ships?', 'How many members are there?', 'What is the latest release?', 'Who is the current CEO?', 'What date is the deadline?']) {
      expect(classifyCard({ question: q })).toBe('volatile');
    }
  });
  test('unknown class = general (180 days); explicit freshness_class wins over text', () => {
    expect(classifyCard({ question: 'What is the boiling point of water at sea level?' })).toBe('general');
    expect(classifyCard({})).toBe('general');
    expect(classifyCard({ question: 'What is the price of X?', freshness_class: 'general' })).toBe('general');
  });
});

describe('cutoffs on the existing decay score', () => {
  test('decay score is pheromone.ts transient decay, constant 30 d, real half-life ~20.8 d', () => {
    expect(DECAY_CONSTANT_DAYS).toBe(30);
    expect(REAL_HALF_LIFE_DAYS).toBeCloseTo(20.79, 1);
    expect(decayScore(REAL_HALF_LIFE_DAYS)).toBeCloseTo(0.5, 6);
    expect(CUTOFF_DAYS).toEqual({ canon: Infinity, volatile: 30, general: 180 });
  });
  test('volatile: 29 days reusable, 31 days prior record re-verify', () => {
    expect(reuseDecision({ question: 'current price of gold', timestamp: ago(29) }, NOW).state).toBe('verified_reusable_answer');
    const d = reuseDecision({ question: 'current price of gold', timestamp: ago(31) }, NOW);
    expect(d.state).toBe('prior_record_reverify');
    expect(d.label).toBe('Prior record, re-verify');
    expect(d.decay_score!).toBeLessThan(d.threshold!);
  });
  test('general: 179 days reusable, 181 days prior record re-verify', () => {
    expect(reuseDecision({ question: 'boiling point of water', utc: new Date(ago(179)).toISOString() }, NOW).state).toBe('verified_reusable_answer');
    expect(reuseDecision({ question: 'boiling point of water', utc: new Date(ago(181)).toISOString() }, NOW).state).toBe('prior_record_reverify');
  });
  test('canon never decays, even at ten years', () => {
    const d = reuseDecision({ provenance: 'canon:bp132', question: 'latest price', timestamp: ago(3650) }, NOW);
    expect(d.state).toBe('verified_reusable_answer');
    expect(d.cutoff_days).toBeNull();
  });
  test('a card with no time on it is not served as verified', () => {
    expect(reuseDecision({ question: 'boiling point of water' }, NOW).state).toBe('prior_record_reverify');
  });
  test('a signed SOURCE addendum re-sources the card and restarts the clock', () => {
    const recs: CorrectionRecord[] = [{ addendum_type: 'source', corrects: { qid: 101 }, adds: { source: { retrieved_utc: new Date(ago(2)).toISOString() } } }];
    expect(reuseDecision({ qid: 101, timestamp: ago(400) }, NOW, recs).state).toBe('verified_reusable_answer');
  });
});

describe('correction precedence', () => {
  const fresh: FreshnessCardMeta = { sha256: 'aa11', question: 'boiling point of water', timestamp: ago(1) };
  test('an appended correction beats a fresh card: corrected, never the old answer', () => {
    const d = reuseDecision(fresh, NOW, [{ kind: 'correction', corrects: { sha256: 'AA11' }, utc: '2026-09-16T00:00:00Z', reason: 'wrong unit' }]);
    expect(d.state).toBe('corrected');
    expect(d.label).toBe(REUSE_LABELS.corrected);
    expect(d.correction?.reason).toBe('wrong unit');
    expect(d.correction?.signed).toBe(false);
  });
  test('a correction beats canon (a ruling can be superseded by a later ruling)', () => {
    expect(reuseDecision({ ...fresh, provenance: 'canon:x' }, NOW, [{ kind: 'supersede', supersedes: 'aa11', superseded_by: 'bb22' }]).state).toBe('corrected');
  });
  test('a correction addendum and a card.superseded_by both count; signature is reported', () => {
    expect(reuseDecision(fresh, NOW, [{ addendum_type: 'correction', corrects: ['aa11'], signature: 'sig' }]).correction).toMatchObject({ via: 'correction_addendum', signed: true });
    expect(reuseDecision({ ...fresh, superseded_by: 'bb22' }, NOW).state).toBe('corrected');
  });
  test('a correction for a different card does not touch this one; a source addendum is not a correction', () => {
    expect(reuseDecision(fresh, NOW, [{ kind: 'correction', corrects: { sha256: 'zz99' } }]).state).toBe('verified_reusable_answer');
    expect(reuseDecision(fresh, NOW, [{ addendum_type: 'source', corrects: 'aa11' }]).state).toBe('verified_reusable_answer');
  });
});

describe('Conduit twin cannot drift', () => {
  const TWIN = 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\BISHOP_DROPZONE\\MIC_CHANNEL\\conduit\\conduit_card_freshness.js';
  test.skipIf(!existsSync(TWIN))('same fixture table, same decisions', () => {
    const twin = createRequire(import.meta.url)(TWIN);
    const recs: CorrectionRecord[] = [{ kind: 'correction', corrects: { qid: 7 } }, { addendum_type: 'source', corrects: { qid: 8 }, adds: { source: { retrieved_utc: new Date(ago(3)).toISOString() } } }];
    const table: FreshnessCardMeta[] = [
      { question: 'current price', timestamp: ago(31) }, { question: 'current price', timestamp: ago(29) },
      { question: 'plain fact', utc: new Date(ago(181)).toISOString() }, { question: 'plain fact', utc: new Date(ago(179)).toISOString() },
      { provenance: 'founder:k/1', timestamp: ago(9999) }, { qid: 7, timestamp: ago(1) }, { qid: 8, timestamp: ago(500) },
      {}, { tags: ['volatile'], timestamp: ago(40) }, { superseded_by: 'x' },
    ];
    expect(twin.REUSE_LABELS).toEqual(REUSE_LABELS);
    expect(twin.RULE).toBe(reuseDecision({}, NOW).rule);
    for (const m of table) expect(twin.reuseDecision(m, NOW, recs)).toEqual(reuseDecision(m, NOW, recs));
  });
});
