// list_somebody_else.test.ts -- D-BP223-BM04-X033S3-009 STEP 3

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { resolve } from 'path';
import { _setProveItRootForTests } from './userdata_paths';
import { buildAndWriteCard } from './card_writer';
import { addCardToSubstrate } from './substrate_publish';
import { listSomebodyElseCards } from './list_somebody_else';
import { updateCard } from './card_store';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'proveit-list-'));
  _setProveItRootForTests(dir);
});

afterEach(() => {
  _setProveItRootForTests(null);
  rmSync(dir, { recursive: true, force: true });
});

const ASKER = { kind: 'member' as const, display: 'J.Jones', stamped: true, id: 'user-1' };

describe('listSomebodyElseCards', () => {
  it('is locked until this install has published a card of its own, and unpublished cards never appear', () => {
    const { card } = buildAndWriteCard({ question: 'q', category: 'other', method: 'user_claude', answer: 'a', askedBy: ASKER });
    let result = listSomebodyElseCards();
    expect(result.unlocked).toBe(false);
    expect(result.cards).toEqual([]); // not yet published

    addCardToSubstrate(card!.address, { memberDisplay: 'J.Jones' });
    result = listSomebodyElseCards();
    expect(result.unlocked).toBe(true);
    expect(result.cards.map((c) => c.address)).toContain(card!.address);
  });

  it('sorts by votes descending, then by date descending as the tie-break', () => {
    const a = buildAndWriteCard({ question: 'a', category: 'math', method: 'user_claude', answer: 'x', askedBy: ASKER, madeAt: '2026-01-01T00:00:00.000Z' }).card!;
    const b = buildAndWriteCard({ question: 'b', category: 'math', method: 'user_claude', answer: 'y', askedBy: ASKER, madeAt: '2026-02-01T00:00:00.000Z' }).card!;
    const c = buildAndWriteCard({ question: 'c', category: 'math', method: 'user_claude', answer: 'z', askedBy: ASKER, madeAt: '2026-03-01T00:00:00.000Z' }).card!;
    addCardToSubstrate(a.address, {});
    addCardToSubstrate(b.address, {});
    addCardToSubstrate(c.address, {});
    updateCard(a.address, { voteCount: 5 });
    updateCard(b.address, { voteCount: 5 });
    updateCard(c.address, { voteCount: 1 });

    const { cards } = listSomebodyElseCards({ sortBy: 'votes' });
    // a and b tie on votes (5) -- b is newer, so b comes first; c (1 vote) last.
    expect(cards.map((x) => x.address)).toEqual([b.address, a.address, c.address]);
  });

  it('filters by category', () => {
    const mathCard = buildAndWriteCard({ question: 'm', category: 'math', method: 'user_claude', answer: 'x', askedBy: ASKER }).card!;
    const bioCard = buildAndWriteCard({ question: 'b', category: 'biology', method: 'user_claude', answer: 'y', askedBy: ASKER }).card!;
    addCardToSubstrate(mathCard.address, {});
    addCardToSubstrate(bioCard.address, {});

    const { cards } = listSomebodyElseCards({ category: 'math' });
    expect(cards.map((c) => c.address)).toEqual([mathCard.address]);
  });

  it('excludes a self-unpublished card', () => {
    const card = buildAndWriteCard({ question: 'q', category: 'other', method: 'user_claude', answer: 'a', askedBy: ASKER }).card!;
    addCardToSubstrate(card.address, {});
    updateCard(card.address, { unpublishedAt: new Date().toISOString() });
    const { cards } = listSomebodyElseCards();
    expect(cards.map((c) => c.address)).not.toContain(card.address);
  });
});
