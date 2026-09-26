// card_writer.test.ts -- D-BP223-BM04-X033S3-009 STEP 3
//
// Isolates every test's card store under a per-run temp dir via _setProveItRootForTests, same
// convention as scavenger_hunt.test.ts's _setScavengerHuntLogPathForTests.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { resolve } from 'path';
import { _setProveItRootForTests } from './userdata_paths';
import { buildAndWriteCard, supersedeCard, classifyValidity, validUntilFor, liftSourcesFromText } from './card_writer';
import { findCardByAddress, readAllCards } from './card_store';
import { getRunEvents, _clearTickerLogForTests } from './ticker';
import { seedAskedBy } from '../../shared/proveit_contract';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'proveit-card-writer-'));
  _setProveItRootForTests(dir);
  _clearTickerLogForTests();
});

afterEach(() => {
  _setProveItRootForTests(null);
  rmSync(dir, { recursive: true, force: true });
});

const MEMBER_ASKER = { kind: 'member' as const, display: 'J.Jones', stamped: true, id: 'user-1' };

describe('buildAndWriteCard', () => {
  it('writes every literal field the contract requires', () => {
    const { card } = buildAndWriteCard({
      question: 'How many moons does Jupiter have, and what are their names?',
      category: 'physics',
      method: 'user_claude',
      answer: 'Jupiter has 97 known moons as of 2026.',
      askedBy: MEMBER_ASKER,
      madeAt: '2026-09-20T06:11:09.887Z',
    });
    expect(card).not.toBeNull();
    expect(card!.question).toBe('How many moons does Jupiter have, and what are their names?');
    expect(card!.answer).toBe('Jupiter has 97 known moons as of 2026.');
    expect(card!.category).toBe('physics');
    expect(card!.answeredBy).toBe('claude');
    expect(card!.askedBy).toEqual(MEMBER_ASKER);
    expect(card!.madeAt).toBe('2026-09-20T06:11:09.887Z');
    expect(card!.address).toMatch(/^[0-9a-f]{32}$/);
    expect(card!.supersedes).toBeNull();
    expect(card!.supersededBy).toBeNull();
    expect(card!.isSeed).toBe(false);
    expect(card!.voteCount).toBe(0);
    expect(card!.publishedAt).toBeNull();
    expect(card!.answerMethod).toBe('user_claude');
    // Written to the local store, findable by its own address.
    expect(findCardByAddress(card!.address)?.address).toBe(card!.address);
  });

  it('returns a null card and an error ticker line when the answer is empty', () => {
    const { runId, card } = buildAndWriteCard({
      question: 'Anything', category: 'other', method: 'user_google', answer: '   ', askedBy: seedAskedBy(),
    });
    expect(card).toBeNull();
    const events = getRunEvents(runId);
    expect(events.some((e) => e.step === 'error')).toBe(true);
    expect(events.find((e) => e.step === 'error')?.error?.byHandOffered).toBe(true);
  });

  it('emits the full ticker sequence in order for a normal ask', () => {
    const { runId } = buildAndWriteCard({
      question: 'What is the boiling point of water at 3,000 m?',
      category: 'physics',
      method: 'user_perplexity',
      answer: 'About 90 C at 3,000 m elevation.',
      askedBy: MEMBER_ASKER,
    });
    const steps = getRunEvents(runId).map((e) => e.step);
    expect(steps).toEqual(['question_received', 'category_confirmed', 'brain_selected', 'answer_received', 'card_written', 'meter_delta']);
    // Every event carries a real ms timestamp, non-decreasing in emission order.
    const times = getRunEvents(runId).map((e) => e.atMs);
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
  });

  it('lifts links out of a by-hand pasted answer into sources, and flags unsourced when there are none', () => {
    const withLink = buildAndWriteCard({
      question: 'q1', category: 'history', method: 'by_hand',
      answer: 'The wall fell in 1989. See https://example.com/berlin-wall for details.',
      askedBy: MEMBER_ASKER,
    }).card!;
    expect(withLink.sources).toEqual([{ label: 'https://example.com/berlin-wall', url: 'https://example.com/berlin-wall' }]);
    expect(withLink.unsourced).toBe(false);

    const noLink = buildAndWriteCard({
      question: 'q2', category: 'history', method: 'by_hand', answer: 'No links here at all.', askedBy: MEMBER_ASKER,
    }).card!;
    expect(noLink.sources).toEqual([]);
    expect(noLink.unsourced).toBe(true);
  });
});

describe('liftSourcesFromText', () => {
  it('de-duplicates and caps at 8 links', () => {
    const many = Array.from({ length: 12 }, (_, i) => `https://example.com/${i}`).join(' ');
    expect(liftSourcesFromText(many)).toHaveLength(8);
    expect(liftSourcesFromText('https://a.com https://a.com')).toHaveLength(1);
  });
});

describe('classifyValidity / validUntilFor (spec Section 12 defaults)', () => {
  const madeAtMs = Date.parse('2026-09-20T00:00:00.000Z');

  it('prices/stock-style facts default to 1 day', () => {
    expect(classifyValidity('What is the current stock price of Acme Corp?')).toBe('day');
    const until = validUntilFor('day', madeAtMs);
    expect(until).toBe(new Date(madeAtMs + 24 * 60 * 60 * 1000).toISOString());
  });

  it('other volatile lookup facts (counts, populations) default to 1 year', () => {
    expect(classifyValidity('How many moons does Jupiter have?')).toBe('year');
    const until = validUntilFor('year', madeAtMs);
    expect(until).toBe(new Date(madeAtMs + 365 * 24 * 60 * 60 * 1000).toISOString());
  });

  it('historical/canon facts never expire', () => {
    expect(classifyValidity('What year did the Berlin Wall fall')).toBe('forever');
    expect(validUntilFor('forever', madeAtMs)).toBeNull();
  });

  it('an AI-stated date wins outright, never guessed', () => {
    expect(classifyValidity('Some question', '2027-01-01T00:00:00.000Z')).toBe('ai_dated');
    expect(validUntilFor('ai_dated', madeAtMs, '2027-01-01T00:00:00.000Z')).toBe('2027-01-01T00:00:00.000Z');
  });
});

describe('supersedeCard (spec Section 5 provenance law)', () => {
  it('never edits the old card except supersededBy; the old row still exists unchanged', () => {
    const original = buildAndWriteCard({
      question: 'How many moons does Jupiter have?', category: 'physics', method: 'user_claude',
      answer: '95 moons, as of last year.', askedBy: MEMBER_ASKER, madeAt: '2025-01-01T00:00:00.000Z',
    }).card!;

    const { card: next } = supersedeCard(original.address, {
      question: 'How many moons does Jupiter have?', category: 'physics', method: 'user_claude',
      answer: '97 moons, as of 2026.', askedBy: MEMBER_ASKER, madeAt: '2026-09-20T00:00:00.000Z',
    });

    expect(next).not.toBeNull();
    expect(next!.address).not.toBe(original.address);
    expect(next!.supersedes).toBe(original.address);

    const all = readAllCards();
    const oldRow = all.find((c) => c.address === original.address)!;
    expect(oldRow.supersededBy).toBe(next!.address);
    // Nothing else on the old row changed.
    expect(oldRow.question).toBe(original.question);
    expect(oldRow.answer).toBe(original.answer);
    expect(oldRow.madeAt).toBe(original.madeAt);
    expect(oldRow.askedBy).toEqual(original.askedBy);
    // Both rows are present -- the old one was never removed.
    expect(all).toHaveLength(2);
  });
});
