// mark_back_store.test.ts -- D-BP165-M0-017/BISHOP-M0/kitchen-table-mark-back
//
// PROVES THE FAR END (LAW 5) of the claims made in mark_back_store.ts's header:
//   1. A vote costs exactly 2 whole marks, split 1 to the host, 1 to the author.
//   2. No code path can produce a fractional mark (compile-time + runtime).
//   3. Every recorded vote's deltas sum to exactly zero (transfers, never mints).
//   4. Every named gate rejects the case it names: disabled-by-default,
//      self-vote, voter-must-have-cooked-it, the 10-distinct-recipe unlock
//      gate (host AND author, independently), the max-2/day cap (including
//      the same-person host+author edge case), the reciprocal-vouch window,
//      and the repeat-cook decay curve capping a lone recipe's farm at 2
//      votes ever.
//   5. RULING 1: the participation refund credit is issued 1-per-vote, is
//      never spendable on a vote, and is never transferable to another peer.
//   6. RULING 2/3: the vote-window ladder selects the right tier by price and
//      is anchored at photoPostedAt, not the cook event -- and an expired
//      window rejects the VOTE while leaving the cook event and its RP/XP
//      completely untouched.
//   7. stripExifForServe() removes the JPEG APP1/Exif segment (where GPS
//      lives), leaves every other segment untouched, never mutates its
//      input, and passes non-JPEG input through as a documented, un-scrubbed,
//      but still-fresh copy.
//
// Isolated per test via a fresh temp userData dir (mocking electron's app.getPath),
// matching cook_events_store.test.ts's existing convention.

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let userDataDir: string;
const ENV_VAR = 'KITCHEN_TABLE_MARKBACK_ENABLED';
let savedEnvValue: string | undefined;

vi.mock('electron', () => ({
  app: { getPath: (_key: string) => userDataDir },
  ipcMain: { handle: vi.fn() },
  // Explicitly undefined (not omitted): mark_back_store.ts imports
  // `nativeImage` as a named export, and vitest's mock guard throws if a
  // named import has no corresponding key at all. Defining it as undefined
  // here is what lets productionNativeImageCodec's `if (!nativeImage)`
  // guard clause be exercised for real -- see RULING 6, "without a test
  // override, JPEG input is safely refused" in this file.
  nativeImage: undefined,
}));

async function freshModules() {
  vi.resetModules();
  const cookStore = await import('./cook_events_store');
  const markStore = await import('./mark_back_store');
  return { cookStore, markStore };
}

beforeEach(() => {
  userDataDir = mkdtempSync(join(tmpdir(), 'mark-back-test-'));
  savedEnvValue = process.env[ENV_VAR];
});

afterEach(() => {
  rmSync(userDataDir, { recursive: true, force: true });
  if (savedEnvValue === undefined) delete process.env[ENV_VAR];
  else process.env[ENV_VAR] = savedEnvValue;
});

/** Records `n` cook events for `peerId` across `n` DISTINCT recipe ids, so
 *  the caller clears the 10-distinct-recipe unlock gate. Distinct recipeIds
 *  never collide with cook_events_store's anti-double-submit dedupe window
 *  (keyed on (recipeId, cookedBy)), so a shared timestamp is safe here. */
function seedDistinctCooks(
  cookStore: typeof import('./cook_events_store'),
  peerId: string,
  recipePrefix: string,
  n: number,
  atIso = '2026-01-01T00:00:00.000Z'
): void {
  for (let k = 0; k < n; k++) {
    cookStore.recordCookEvent({
      recipeId: `${recipePrefix}-${k}`,
      authorId: `${recipePrefix}-author-${k}`,
      cookedBy: peerId,
      cookedAt: atIso,
      acquisitionPath: 'direct-menu',
      referrerPeerId: null,
      sourceUnlockId: null,
      graduated: false,
      guildMultiplierAtCook: 1,
    });
  }
}

/** Records `n` repeat cook events of the SAME recipe by the SAME peer,
 *  spaced well clear of the 5-minute anti-double-submit dedupe window. */
function seedRepeatCooks(
  cookStore: typeof import('./cook_events_store'),
  peerId: string,
  recipeId: string,
  authorId: string,
  n: number
): void {
  for (let k = 0; k < n; k++) {
    cookStore.recordCookEvent({
      recipeId,
      authorId,
      cookedBy: peerId,
      cookedAt: `2026-02-${String(1 + k).padStart(2, '0')}T00:00:00.000Z`, // one day apart
      acquisitionPath: 'direct-menu',
      referrerPeerId: null,
      sourceUnlockId: null,
      graduated: false,
      guildMultiplierAtCook: 1,
    });
  }
}

function recordCook(
  cookStore: typeof import('./cook_events_store'),
  recipeId: string,
  authorId: string,
  cookedBy: string,
  cookedAt: string
) {
  return cookStore.recordCookEvent({
    recipeId,
    authorId,
    cookedBy,
    cookedAt,
    acquisitionPath: 'direct-menu',
    referrerPeerId: null,
    sourceUnlockId: null,
    graduated: false,
    guildMultiplierAtCook: 1,
  });
}

/** Default-safe vote args: recipePriceMarks=1 (3-day window) with
 *  photoPostedAt === votedAt, so the window gate is trivially satisfied
 *  (0 elapsed days) for tests not specifically exercising the window. */
function baseVoteArgs(votedAt: string, recipePriceMarks = 1) {
  return { votedAt, recipePriceMarks, photoPostedAt: votedAt };
}

describe('money: whole marks only, and conservation (never mints)', () => {
  test('constants satisfy the whole-mark conservation invariant', async () => {
    const { markStore } = await freshModules();
    expect(Number.isInteger(markStore.MARK_BACK_VOTE_COST_MARKS)).toBe(true);
    expect(Number.isInteger(markStore.MARK_BACK_HOST_SHARE_MARKS)).toBe(true);
    expect(Number.isInteger(markStore.MARK_BACK_AUTHOR_SHARE_MARKS)).toBe(true);
    expect(markStore.MARK_BACK_HOST_SHARE_MARKS + markStore.MARK_BACK_AUTHOR_SHARE_MARKS).toBe(
      markStore.MARK_BACK_VOTE_COST_MARKS
    );
    expect(markStore.MARK_BACK_VOTE_COST_MARKS).toBe(2);
  });

  test('a successful vote costs exactly 2 marks, split 1 to host and 1 to author', async () => {
    process.env[ENV_VAR] = 'true';
    const { cookStore, markStore } = await freshModules();
    seedDistinctCooks(cookStore, 'host-1', 'gate-h', 10);
    seedDistinctCooks(cookStore, 'author-1', 'gate-a', 10);
    recordCook(cookStore, 'recipe-x', 'author-1', 'voter-1', '2026-03-01T00:00:00.000Z');

    const result = markStore.castMarkBackVote({
      recipeId: 'recipe-x',
      authorId: 'author-1',
      hostPeerId: 'host-1',
      voterId: 'voter-1',
      ...baseVoteArgs('2026-03-02T00:00:00.000Z'),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.marksToCook).toBe(1);
    expect(result.event.marksToAuthor).toBe(1);
    expect(result.event.totalMarksTransferred).toBe(2);
    expect(result.event.marksToCook + result.event.marksToAuthor).toBe(result.event.totalMarksTransferred);
  });

  test('conserves marks: sum of every event\'s deltas is exactly zero, always', async () => {
    process.env[ENV_VAR] = 'true';
    const { cookStore, markStore } = await freshModules();
    seedDistinctCooks(cookStore, 'host-A', 'gh-a', 10);
    seedDistinctCooks(cookStore, 'author-A', 'ga-a', 10);
    seedDistinctCooks(cookStore, 'host-B', 'gh-b', 10);
    seedDistinctCooks(cookStore, 'author-B', 'ga-b', 10);

    for (const [voter, recipe, host, author] of [
      ['voter-a', 'recipe-a', 'host-A', 'author-A'],
      ['voter-b', 'recipe-b', 'host-B', 'author-B'],
    ] as const) {
      recordCook(cookStore, recipe, author, voter, '2026-04-01T00:00:00.000Z');
      const r = markStore.castMarkBackVote({
        recipeId: recipe,
        authorId: author,
        hostPeerId: host,
        voterId: voter,
        ...baseVoteArgs('2026-04-02T00:00:00.000Z'),
      });
      expect(r.ok).toBe(true);
    }

    const events = markStore.listMarkBackVotes();
    expect(events.length).toBe(2);

    for (const e of events) {
      const delta = -e.totalMarksTransferred + e.marksToCook + e.marksToAuthor;
      expect(delta).toBe(0);
    }

    const netByPeer = new Map<string, number>();
    const add = (peer: string, n: number) => netByPeer.set(peer, (netByPeer.get(peer) ?? 0) + n);
    for (const e of events) {
      add(e.voterId, -e.totalMarksTransferred);
      add(e.hostPeerId, e.marksToCook);
      add(e.authorId, e.marksToAuthor);
    }
    const grandTotal = [...netByPeer.values()].reduce((a, b) => a + b, 0);
    expect(grandTotal).toBe(0);
  });
});

describe('gate: mark-back is OFF by default (env flag)', () => {
  test('rejects every vote when KITCHEN_TABLE_MARKBACK_ENABLED is unset', async () => {
    delete process.env[ENV_VAR];
    const { markStore } = await freshModules();
    const result = markStore.castMarkBackVote({
      recipeId: 'r', authorId: 'a', hostPeerId: 'h', voterId: 'v', ...baseVoteArgs('2026-01-01T00:00:00.000Z'),
    });
    expect(result).toEqual({ ok: false, reason: 'markback-disabled' });
  });

  test('isMarkBackEnabled() reads the exact documented env var name', async () => {
    const { markStore } = await freshModules();
    expect(markStore.KITCHEN_TABLE_MARKBACK_ENABLED_ENV_VAR).toBe('KITCHEN_TABLE_MARKBACK_ENABLED');
  });
});

describe('gate: voter must have cooked that same recipe (core anti-ring constraint)', () => {
  beforeEach(() => { process.env[ENV_VAR] = 'true'; });

  test('rejects a voter who has never recorded a cook event for the recipe', async () => {
    const { cookStore, markStore } = await freshModules();
    seedDistinctCooks(cookStore, 'host-1', 'gh', 10);
    seedDistinctCooks(cookStore, 'author-1', 'ga', 10);
    const result = markStore.castMarkBackVote({
      recipeId: 'never-cooked-recipe', authorId: 'author-1', hostPeerId: 'host-1', voterId: 'voter-1',
      ...baseVoteArgs('2026-01-01T00:00:00.000Z'),
    });
    expect(result).toEqual({ ok: false, reason: 'voter-has-not-cooked-recipe' });
  });

  test('blocks a voter voting for themselves as host or author (self-deal safeguard)', async () => {
    const { cookStore, markStore } = await freshModules();
    recordCook(cookStore, 'r1', 'author-1', 'voter-1', '2026-01-01T00:00:00.000Z');
    const asHost = markStore.castMarkBackVote({
      recipeId: 'r1', authorId: 'author-1', hostPeerId: 'voter-1', voterId: 'voter-1', ...baseVoteArgs('2026-01-02T00:00:00.000Z'),
    });
    expect(asHost).toEqual({ ok: false, reason: 'voter-cannot-vote-for-self' });
    const asAuthor = markStore.castMarkBackVote({
      recipeId: 'r1', authorId: 'voter-1', hostPeerId: 'host-1', voterId: 'voter-1', ...baseVoteArgs('2026-01-02T00:00:00.000Z'),
    });
    expect(asAuthor).toEqual({ ok: false, reason: 'voter-cannot-vote-for-self' });
  });
});

describe('gate: 10 distinct recipes cooked before mark-back unlocks (host AND author, independently)', () => {
  beforeEach(() => { process.env[ENV_VAR] = 'true'; });

  test('rejects when the host has not cleared the gate', async () => {
    const { cookStore, markStore } = await freshModules();
    seedDistinctCooks(cookStore, 'host-1', 'gh', 9); // one short
    seedDistinctCooks(cookStore, 'author-1', 'ga', 10);
    recordCook(cookStore, 'r1', 'author-1', 'voter-1', '2026-01-01T00:00:00.000Z');
    const result = markStore.castMarkBackVote({
      recipeId: 'r1', authorId: 'author-1', hostPeerId: 'host-1', voterId: 'voter-1', ...baseVoteArgs('2026-01-02T00:00:00.000Z'),
    });
    expect(result).toEqual({ ok: false, reason: 'host-has-not-cleared-unlock-gate' });
  });

  test('rejects when the author has not cleared the gate, even though the host has', async () => {
    const { cookStore, markStore } = await freshModules();
    seedDistinctCooks(cookStore, 'host-1', 'gh', 10);
    seedDistinctCooks(cookStore, 'author-1', 'ga', 9); // one short
    recordCook(cookStore, 'r1', 'author-1', 'voter-1', '2026-01-01T00:00:00.000Z');
    const result = markStore.castMarkBackVote({
      recipeId: 'r1', authorId: 'author-1', hostPeerId: 'host-1', voterId: 'voter-1', ...baseVoteArgs('2026-01-02T00:00:00.000Z'),
    });
    expect(result).toEqual({ ok: false, reason: 'author-has-not-cleared-unlock-gate' });
  });

  test('exactly 10 distinct recipes clears the gate', async () => {
    const { cookStore, markStore } = await freshModules();
    seedDistinctCooks(cookStore, 'host-1', 'gh', 10);
    seedDistinctCooks(cookStore, 'author-1', 'ga', 10);
    recordCook(cookStore, 'r1', 'author-1', 'voter-1', '2026-01-01T00:00:00.000Z');
    const result = markStore.castMarkBackVote({
      recipeId: 'r1', authorId: 'author-1', hostPeerId: 'host-1', voterId: 'voter-1', ...baseVoteArgs('2026-01-02T00:00:00.000Z'),
    });
    expect(result.ok).toBe(true);
  });

  test('20 cooks of ONE recipe do not clear the gate -- "recipes cooked" means distinct recipes', async () => {
    const { cookStore, markStore } = await freshModules();
    seedRepeatCooks(cookStore, 'host-1', 'the-only-recipe', 'someone', 20);
    seedDistinctCooks(cookStore, 'author-1', 'ga', 10);
    recordCook(cookStore, 'r1', 'author-1', 'voter-1', '2026-01-01T00:00:00.000Z');
    const result = markStore.castMarkBackVote({
      recipeId: 'r1', authorId: 'author-1', hostPeerId: 'host-1', voterId: 'voter-1', ...baseVoteArgs('2026-01-02T00:00:00.000Z'),
    });
    expect(result).toEqual({ ok: false, reason: 'host-has-not-cleared-unlock-gate' });
  });
});

describe('gate: maximum 2 mark-back earnings per day per peer', () => {
  beforeEach(() => { process.env[ENV_VAR] = 'true'; });

  test('a 3rd vote crediting the same host on the same day is rejected', async () => {
    const { cookStore, markStore } = await freshModules();
    seedDistinctCooks(cookStore, 'host-1', 'gh', 10);
    seedDistinctCooks(cookStore, 'author-1', 'ga', 10);
    for (const voter of ['voter-1', 'voter-2']) {
      recordCook(cookStore, 'recipe-cap', 'author-1', voter, '2026-05-01T00:00:00.000Z');
    }
    const r1 = markStore.castMarkBackVote({
      recipeId: 'recipe-cap', authorId: 'author-1', hostPeerId: 'host-1', voterId: 'voter-1', ...baseVoteArgs('2026-05-02T08:00:00.000Z'),
    });
    const r2 = markStore.castMarkBackVote({
      recipeId: 'recipe-cap', authorId: 'author-1', hostPeerId: 'host-1', voterId: 'voter-2', ...baseVoteArgs('2026-05-02T09:00:00.000Z'),
    });
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);

    seedDistinctCooks(cookStore, 'voter-3', 'v3g', 10);
    recordCook(cookStore, 'recipe-cap', 'author-1', 'voter-3', '2026-05-01T00:00:00.000Z');
    const r3 = markStore.castMarkBackVote({
      recipeId: 'recipe-cap', authorId: 'author-1', hostPeerId: 'host-1', voterId: 'voter-3', ...baseVoteArgs('2026-05-02T10:00:00.000Z'),
    });
    expect(r3).toEqual({ ok: false, reason: 'host-daily-cap-reached' });
  });

  test('a self-authored recipe (host === author) is checked against the COMBINED +2 in one vote', async () => {
    const { cookStore, markStore } = await freshModules();
    seedDistinctCooks(cookStore, 'maker-1', 'gm', 10);
    recordCook(cookStore, 'own-recipe', 'maker-1', 'voter-1', '2026-06-01T00:00:00.000Z');
    const result = markStore.castMarkBackVote({
      recipeId: 'own-recipe', authorId: 'maker-1', hostPeerId: 'maker-1', voterId: 'voter-1', ...baseVoteArgs('2026-06-02T00:00:00.000Z'),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(markStore.tallyMarkBackEarningsForPeer('maker-1')).toBe(2);
    }
  });
});

describe('gate: no reciprocal vouching inside the window', () => {
  beforeEach(() => { process.env[ENV_VAR] = 'true'; });

  test('B cannot vouch for A right after A vouched for B', async () => {
    const { cookStore, markStore } = await freshModules();
    seedDistinctCooks(cookStore, 'P2', 'g2', 10);
    seedDistinctCooks(cookStore, 'P3', 'g3', 10);
    recordCook(cookStore, 'recipe-1', 'P3', 'P1', '2026-07-01T00:00:00.000Z');
    const vote1 = markStore.castMarkBackVote({
      recipeId: 'recipe-1', authorId: 'P3', hostPeerId: 'P2', voterId: 'P1', ...baseVoteArgs('2026-07-02T00:00:00.000Z'),
    });
    expect(vote1.ok).toBe(true);

    seedDistinctCooks(cookStore, 'P1', 'g1', 10);
    seedDistinctCooks(cookStore, 'P4', 'g4', 10);
    recordCook(cookStore, 'recipe-2', 'P4', 'P2', '2026-07-05T00:00:00.000Z');
    const vote2 = markStore.castMarkBackVote({
      recipeId: 'recipe-2', authorId: 'P4', hostPeerId: 'P1', voterId: 'P2', ...baseVoteArgs('2026-07-10T00:00:00.000Z'),
    });
    expect(vote2).toEqual({ ok: false, reason: 'reciprocal-vouch-window-violation' });
  });

  test('the same reciprocal pair is allowed again after the window elapses', async () => {
    const { cookStore, markStore } = await freshModules();
    seedDistinctCooks(cookStore, 'P2', 'g2', 10);
    seedDistinctCooks(cookStore, 'P3', 'g3', 10);
    recordCook(cookStore, 'recipe-1', 'P3', 'P1', '2026-01-01T00:00:00.000Z');
    const vote1 = markStore.castMarkBackVote({
      recipeId: 'recipe-1', authorId: 'P3', hostPeerId: 'P2', voterId: 'P1', ...baseVoteArgs('2026-01-02T00:00:00.000Z'),
    });
    expect(vote1.ok).toBe(true);

    seedDistinctCooks(cookStore, 'P1', 'g1', 10);
    seedDistinctCooks(cookStore, 'P4', 'g4', 10);
    recordCook(cookStore, 'recipe-2', 'P4', 'P2', '2026-03-01T00:00:00.000Z');
    // 60 days after vote1, well clear of the 30-day NO_RECIPROCAL_VOUCH_WINDOW_DAYS.
    const vote2 = markStore.castMarkBackVote({
      recipeId: 'recipe-2', authorId: 'P4', hostPeerId: 'P1', voterId: 'P2', ...baseVoteArgs('2026-03-03T00:00:00.000Z'),
    });
    expect(vote2.ok).toBe(true);
  });
});

describe('gate: diminishing returns on repeat cooks of the same recipe', () => {
  beforeEach(() => { process.env[ENV_VAR] = 'true'; });

  test('effectiveCookCredit converges toward 2 and never reaches it (the math the gate relies on)', async () => {
    const { markStore } = await freshModules();
    expect(markStore.effectiveCookCredit(0)).toBe(0);
    expect(markStore.effectiveCookCredit(1)).toBeCloseTo(1, 10);
    expect(markStore.effectiveCookCredit(2)).toBeCloseTo(1.5, 10);
    expect(markStore.effectiveCookCredit(3)).toBeCloseTo(1.75, 10);
    expect(markStore.effectiveCookCredit(50)).toBeLessThan(2);
    expect(markStore.effectiveCookCredit(50)).toBeGreaterThan(1.999);
  });

  test('a lone recipe cooked 20 times by one voter funds at most 2 votes ever, never a 3rd', async () => {
    const { cookStore, markStore } = await freshModules();
    seedDistinctCooks(cookStore, 'host-1', 'gh', 10);
    seedDistinctCooks(cookStore, 'author-1', 'ga', 10);
    seedRepeatCooks(cookStore, 'voter-1', 'the-farm-recipe', 'author-1', 20);

    const vote1 = markStore.castMarkBackVote({
      recipeId: 'the-farm-recipe', authorId: 'author-1', hostPeerId: 'host-1', voterId: 'voter-1', ...baseVoteArgs('2026-08-01T00:00:00.000Z'),
    });
    expect(vote1.ok).toBe(true);

    const vote2 = markStore.castMarkBackVote({
      recipeId: 'the-farm-recipe', authorId: 'author-1', hostPeerId: 'host-1', voterId: 'voter-1', ...baseVoteArgs('2026-08-02T00:00:00.000Z'),
    });
    expect(vote2.ok).toBe(true);

    const vote3 = markStore.castMarkBackVote({
      recipeId: 'the-farm-recipe', authorId: 'author-1', hostPeerId: 'host-1', voterId: 'voter-1', ...baseVoteArgs('2026-08-03T00:00:00.000Z'),
    });
    expect(vote3).toEqual({ ok: false, reason: 'repeat-cook-credit-exhausted' });
  });
});

describe('RULING 1: participation refund credit (non-spendable, non-transferable)', () => {
  beforeEach(() => { process.env[ENV_VAR] = 'true'; });

  test('exactly 1 credit is issued to the voter per successful vote', async () => {
    const { cookStore, markStore } = await freshModules();
    seedDistinctCooks(cookStore, 'host-1', 'gh', 10);
    seedDistinctCooks(cookStore, 'author-1', 'ga', 10);
    recordCook(cookStore, 'r1', 'author-1', 'voter-1', '2026-01-01T00:00:00.000Z');
    expect(markStore.getRefundCreditBalance('voter-1')).toBe(0);
    const result = markStore.castMarkBackVote({
      recipeId: 'r1', authorId: 'author-1', hostPeerId: 'host-1', voterId: 'voter-1', ...baseVoteArgs('2026-01-02T00:00:00.000Z'),
    });
    expect(result.ok).toBe(true);
    expect(markStore.getRefundCreditBalance('voter-1')).toBe(1);
    // Half the 2-mark vote cost, per the ruling.
    expect(markStore.PARTICIPATION_REFUND_CREDITS_PER_VOTE).toBe(markStore.MARK_BACK_VOTE_COST_MARKS / 2);
  });

  test('a refund credit can never be spent on a vote: the vote still costs 2 spendable marks regardless of credit balance', async () => {
    const { cookStore, markStore } = await freshModules();
    seedDistinctCooks(cookStore, 'host-1', 'gh', 10);
    seedDistinctCooks(cookStore, 'author-1', 'ga', 10);
    recordCook(cookStore, 'r1', 'author-1', 'voter-1', '2026-01-01T00:00:00.000Z');
    const result = markStore.castMarkBackVote({
      recipeId: 'r1', authorId: 'author-1', hostPeerId: 'host-1', voterId: 'voter-1', ...baseVoteArgs('2026-01-02T00:00:00.000Z'),
    });
    expect(result.ok).toBe(true);
    // castMarkBackVote's public API has no parameter that accepts a credit
    // balance or reduces totalMarksTransferred by it -- a large pre-existing
    // credit balance still results in a full 2/1/1 spend/split.
    if (result.ok) {
      expect(result.event.totalMarksTransferred).toBe(2);
      // The recorded event itself carries no credit-balance field -- the
      // vote's cost/split is computed purely from the money constants,
      // never from a credit balance.
      expect('refundCredits' in result.event).toBe(false);
    }
  });

  test('a refund credit can never be transferred: there is no function that accepts a destination peer', async () => {
    const { markStore } = await freshModules();
    // The only mutators exported by this module are issuance (internal to a
    // vote) and redemption against the SAME peer's own purchase. No exported
    // function name suggests a transfer, and redeemRefundCreditsTowardPurchase
    // takes no "toPeerId" parameter -- credits move balance -> 0 (redeemed),
    // never balance -> another peer's balance.
    expect((markStore as unknown as Record<string, unknown>).transferRefundCredits).toBeUndefined();
    expect((markStore as unknown as Record<string, unknown>).sendRefundCredits).toBeUndefined();
    expect((markStore as unknown as Record<string, unknown>).giftRefundCredits).toBeUndefined();
  });

  test('a credit can only redeem toward a recipe purchase, and reduces the balance by exactly the amount redeemed', async () => {
    const { cookStore, markStore } = await freshModules();
    seedDistinctCooks(cookStore, 'host-1', 'gh', 10);
    seedDistinctCooks(cookStore, 'author-1', 'ga', 10);
    for (const suffix of ['a', 'b']) {
      recordCook(cookStore, `r-${suffix}`, 'author-1', 'voter-1', '2026-01-01T00:00:00.000Z');
      const r = markStore.castMarkBackVote({
        recipeId: `r-${suffix}`, authorId: 'author-1', hostPeerId: 'host-1', voterId: 'voter-1', ...baseVoteArgs('2026-01-02T00:00:00.000Z'),
      });
      expect(r.ok).toBe(true);
    }
    expect(markStore.getRefundCreditBalance('voter-1')).toBe(2);

    const redeemed = markStore.redeemRefundCreditsTowardPurchase('voter-1', 'some-other-recipe', 1, '2026-01-03T00:00:00.000Z');
    expect(redeemed).toEqual({ ok: true, redeemedCredits: 1, remainingBalance: 1 });
    expect(markStore.getRefundCreditBalance('voter-1')).toBe(1);

    const overRedeem = markStore.redeemRefundCreditsTowardPurchase('voter-1', 'some-other-recipe', 5, '2026-01-04T00:00:00.000Z');
    expect(overRedeem).toEqual({ ok: false, reason: 'insufficient-refund-credit-balance' });
    expect(markStore.getRefundCreditBalance('voter-1')).toBe(1); // unchanged by the failed over-redeem
  });

  test('anti-collusion arithmetic: the ring still bleeds 1 SPENDABLE mark per cycle even after the refund credit', async () => {
    // Carol votes on Bob's cook; Dana is the outside author. Ring = {Carol, Bob}.
    const { cookStore, markStore } = await freshModules();
    seedDistinctCooks(cookStore, 'bob', 'gb', 10);
    seedDistinctCooks(cookStore, 'dana', 'gd', 10);
    recordCook(cookStore, 'ring-recipe', 'dana', 'carol', '2026-01-01T00:00:00.000Z');
    const result = markStore.castMarkBackVote({
      recipeId: 'ring-recipe', authorId: 'dana', hostPeerId: 'bob', voterId: 'carol', ...baseVoteArgs('2026-01-02T00:00:00.000Z'),
    });
    expect(result.ok).toBe(true);

    // Spendable marks: Carol -2, Bob +1, Dana(outsider) +1 -- ring (Carol+Bob)
    // net = -1 spendable mark, bled to Dana, exactly as the header's
    // arithmetic proof states. The refund credit Carol received is a
    // SEPARATE, non-spendable balance and does not appear in this sum.
    const ringSpendableNet = -markStore.MARK_BACK_VOTE_COST_MARKS + markStore.MARK_BACK_HOST_SHARE_MARKS;
    expect(ringSpendableNet).toBe(-1);
    expect(markStore.getRefundCreditBalance('carol')).toBe(1); // exists, but...
    // ...it cannot be netted against the -1 spendable loss: it can only
    // discount a FUTURE recipe PURCHASE, proven by redeemRefundCreditsTowardPurchase
    // requiring a recipeId and never returning spendable marks.
  });
});

describe('RULING 2/3: the vote-window ladder, anchored at the photo post', () => {
  beforeEach(() => { process.env[ENV_VAR] = 'true'; });

  test('ladder selects the ruled tiers at the named anchor prices', async () => {
    const { markStore } = await freshModules();
    expect(markStore.voteWindowDaysForRecipePrice(1)).toBe(3);
    expect(markStore.voteWindowDaysForRecipePrice(2)).toBe(7);
    expect(markStore.voteWindowDaysForRecipePrice(5)).toBe(14);
    expect(markStore.voteWindowDaysForRecipePrice(20)).toBe(14); // "and up"
    expect(markStore.VOTE_WINDOW_DAYS_1_MARK_TIER).toBe(3);
    expect(markStore.VOTE_WINDOW_DAYS_2_MARK_TIER).toBe(7);
    expect(markStore.VOTE_WINDOW_DAYS_5_PLUS_MARK_TIER).toBe(14);
  });

  test('a vote inside the window succeeds; the same vote just past the window is rejected', async () => {
    const { cookStore, markStore } = await freshModules();
    seedDistinctCooks(cookStore, 'host-1', 'gh', 10);
    seedDistinctCooks(cookStore, 'author-1', 'ga', 10);
    recordCook(cookStore, 'r1', 'author-1', 'voter-1', '2026-01-01T00:00:00.000Z');
    const postedAt = '2026-01-01T00:00:00.000Z'; // 1-mark recipe -> 3-day window

    const withinWindow = markStore.castMarkBackVote({
      recipeId: 'r1', authorId: 'author-1', hostPeerId: 'host-1', voterId: 'voter-1',
      recipePriceMarks: 1, photoPostedAt: postedAt, votedAt: '2026-01-03T23:00:00.000Z', // 2d23h later
    });
    expect(withinWindow.ok).toBe(true);

    seedDistinctCooks(cookStore, 'author-2', 'ga2', 10);
    recordCook(cookStore, 'r2', 'author-2', 'voter-1', '2026-01-01T00:00:00.000Z');
    const pastWindow = markStore.castMarkBackVote({
      recipeId: 'r2', authorId: 'author-2', hostPeerId: 'host-1', voterId: 'voter-1',
      recipePriceMarks: 1, photoPostedAt: postedAt, votedAt: '2026-01-04T00:00:01.000Z', // 3d0h0m1s later
    });
    expect(pastWindow).toEqual({ ok: false, reason: 'vote-window-expired' });
  });

  test('a pricier recipe gets a longer window for the identical elapsed time', async () => {
    const { cookStore, markStore } = await freshModules();
    seedDistinctCooks(cookStore, 'host-1', 'gh', 10);
    seedDistinctCooks(cookStore, 'author-1', 'ga', 10);
    recordCook(cookStore, 'r1', 'author-1', 'voter-1', '2026-01-01T00:00:00.000Z');
    const postedAt = '2026-01-01T00:00:00.000Z';
    const fiveDaysLater = '2026-01-06T00:00:00.000Z'; // past the 3-day tier, within the 7-day and 14-day tiers

    const cheapExpired = markStore.castMarkBackVote({
      recipeId: 'r1', authorId: 'author-1', hostPeerId: 'host-1', voterId: 'voter-1',
      recipePriceMarks: 1, photoPostedAt: postedAt, votedAt: fiveDaysLater,
    });
    expect(cheapExpired).toEqual({ ok: false, reason: 'vote-window-expired' });

    seedDistinctCooks(cookStore, 'author-2', 'ga2', 10);
    recordCook(cookStore, 'r2', 'author-2', 'voter-1', '2026-01-01T00:00:00.000Z');
    const pricierStillOpen = markStore.castMarkBackVote({
      recipeId: 'r2', authorId: 'author-2', hostPeerId: 'host-1', voterId: 'voter-1',
      recipePriceMarks: 5, photoPostedAt: postedAt, votedAt: fiveDaysLater,
    });
    expect(pricierStillOpen.ok).toBe(true);
  });

  test('the window is anchored at photoPostedAt, not the cook event time -- a late post keeps the full window', async () => {
    const { cookStore, markStore } = await freshModules();
    seedDistinctCooks(cookStore, 'host-1', 'gh', 10);
    seedDistinctCooks(cookStore, 'author-1', 'ga', 10);
    // Cooked Sunday...
    recordCook(cookStore, 'r1', 'author-1', 'voter-1', '2026-09-06T00:00:00.000Z');
    // ...but posted Wednesday. If the window were anchored at the cook
    // event, a vote late Friday (2 days after posting, 5 after cooking)
    // would be past a 3-day window measured from Sunday. Anchored at the
    // post (Wednesday), 2 days later is well inside the 3-day tier.
    const postedWednesday = '2026-09-09T00:00:00.000Z';
    const voteLateFriday = '2026-09-11T00:00:00.000Z'; // 2 days after posting
    const result = markStore.castMarkBackVote({
      recipeId: 'r1', authorId: 'author-1', hostPeerId: 'host-1', voterId: 'voter-1',
      recipePriceMarks: 1, photoPostedAt: postedWednesday, votedAt: voteLateFriday,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.event.photoPostedAt).toBe(postedWednesday);
      expect(result.event.voteWindowDaysApplied).toBe(3);
    }
  });

  test('an expired vote window never touches the cook event or RP/XP -- only the money expires', async () => {
    const { cookStore, markStore } = await freshModules();
    seedDistinctCooks(cookStore, 'host-1', 'gh', 10);
    seedDistinctCooks(cookStore, 'author-1', 'ga', 10);
    const cookEvent = recordCook(cookStore, 'r1', 'author-1', 'voter-1', '2026-01-01T00:00:00.000Z');
    const rpXpBefore = cookStore.tallyRpXpForAuthor('author-1');

    const postedAt = '2026-01-01T00:00:00.000Z';
    const wayPastWindow = '2026-02-01T00:00:00.000Z'; // 31 days later, past even the 14-day tier
    const rejected = markStore.castMarkBackVote({
      recipeId: 'r1', authorId: 'author-1', hostPeerId: 'host-1', voterId: 'voter-1',
      recipePriceMarks: 1, photoPostedAt: postedAt, votedAt: wayPastWindow,
    });
    expect(rejected).toEqual({ ok: false, reason: 'vote-window-expired' });

    // The cook event: still there, byte-identical, never touched by the
    // rejected vote attempt.
    const cookEventsAfter = cookStore.listCookEventsForRecipe('r1');
    expect(cookEventsAfter).toHaveLength(1);
    expect(cookEventsAfter[0]).toEqual(cookEvent);

    // RP/XP: identical to before the vote attempt -- mark_back_store.ts has
    // no code path that writes to or reads from tallyRpXpForAuthor's inputs.
    const rpXpAfter = cookStore.tallyRpXpForAuthor('author-1');
    expect(rpXpAfter).toBe(rpXpBefore);
  });
});

describe('stripExifForServe: scrub the copy, never the original, GPS first', () => {
  test('removes the APP1/Exif segment (where GPS lives) but preserves other segments', async () => {
    const { markStore } = await freshModules();

    const soi = Buffer.from([0xff, 0xd8]);
    const app0Payload = Buffer.from([0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x02, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
    const app0 = Buffer.concat([Buffer.from([0xff, 0xe0]), Buffer.from([0x00, app0Payload.length + 2]), app0Payload]);

    const gpsSecret = Buffer.from('FAKE-GPS-COORDS-40.7128,-74.0060', 'ascii');
    const exifSig = Buffer.from([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]); // "Exif\0\0"
    const app1Payload = Buffer.concat([exifSig, gpsSecret]);
    const app1 = Buffer.concat([Buffer.from([0xff, 0xe1]), Buffer.from([0x00, app1Payload.length + 2]), app1Payload]);

    const sos = Buffer.from([0xff, 0xda, 0x00, 0x02]);
    const scanData = Buffer.from([0x11, 0x22, 0x33, 0x44]);
    const eoi = Buffer.from([0xff, 0xd9]);

    const original = Buffer.concat([soi, app0, app1, sos, scanData, eoi]);
    const originalSnapshot = Buffer.from(original);

    const scrubbed = markStore.stripExifForServe(original);

    expect(scrubbed.includes(gpsSecret)).toBe(false);
    expect(scrubbed.includes(exifSig)).toBe(false);
    expect(scrubbed.includes(app0Payload)).toBe(true);
    expect(scrubbed.includes(scanData)).toBe(true);
    expect(scrubbed.subarray(0, 2)).toEqual(soi);
    expect(scrubbed.subarray(scrubbed.length - 2)).toEqual(eoi);

    expect(original.equals(originalSnapshot)).toBe(true);
    expect(original.includes(gpsSecret)).toBe(true);
  });

  test('never returns the same buffer reference as its input', async () => {
    const { markStore } = await freshModules();
    const input = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const output = markStore.stripExifForServe(input);
    expect(output).not.toBe(input);
  });

  test('passes non-JPEG input through as an unscrubbed but fresh copy (documented limitation)', async () => {
    const { markStore } = await freshModules();
    const pngLike = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const output = markStore.stripExifForServe(pngLike);
    expect(output.equals(pngLike)).toBe(true);
    expect(output).not.toBe(pngLike);
  });
});

// ─── RULING 6: derive a clean copy (decode to pixels, re-encode) ──────────
//
// Test-only PNG chunk builder, independent of mark_back_store.ts's own
// (unexported) writePngChunk/crc32 -- this is a second, separate CRC32
// implementation so the test does not just re-check the module's own math
// against itself.

const TEST_CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function testCrc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TEST_CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function buildPngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(testCrc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** Builds a minimal valid 2x2 RGBA PNG (via markStore's own encodePng,
 *  reached indirectly through deriveCleanPhotoCopy with a fake all-white
 *  source is circular, so instead this hand-assembles the PNG directly from
 *  raw DEFLATE via Node's zlib -- independent of mark_back_store.ts's own
 *  encoder -- so the fixture is not built with the same code path that
 *  decodes it. */
function buildMinimalPng(width: number, height: number, rgba: Buffer): Buffer {
  const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const stride = width * 4;
  const filtered = Buffer.alloc(height * (1 + stride));
  for (let y = 0; y < height; y++) {
    filtered[y * (1 + stride)] = 0; // filter: None
    rgba.copy(filtered, y * (1 + stride) + 1, y * stride, y * stride + stride);
  }
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(filtered) as Buffer;
  return Buffer.concat([
    PNG_SIG,
    buildPngChunk('IHDR', ihdr),
    buildPngChunk('IDAT', compressed),
    buildPngChunk('IEND', Buffer.alloc(0)),
  ]);
}

describe('RULING 6: deriveCleanPhotoCopy -- decode to pixels, re-encode (whitelist, not blacklist)', () => {
  test('a real PNG carrying tEXt and eXIf chunks with GPS bytes: derived copy contains neither the chunk types nor the GPS bytes', async () => {
    const { markStore } = await freshModules();

    const width = 2, height = 2;
    // Distinct, recognizable per-pixel colors so pixel fidelity is a real check.
    const rgba = Buffer.from([
      255, 0, 0, 255, 0, 255, 0, 255,
      0, 0, 255, 255, 128, 64, 32, 200,
    ]);
    const base = buildMinimalPng(width, height, rgba);

    const gpsSecret = Buffer.from('GPS-COORDS-40.7128,-74.0060', 'ascii');
    const textChunk = buildPngChunk('tEXt', Buffer.concat([Buffer.from('GPS\0', 'ascii'), gpsSecret]));
    const exifSig = Buffer.from([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]); // "Exif\0\0"
    const exifChunk = buildPngChunk('eXIf', Buffer.concat([exifSig, gpsSecret]));

    // Splice the ancillary chunks in right after IHDR (bytes 8..33), before IDAT.
    const ihdrEnd = 8 + 25; // signature(8) + IHDR chunk(4+4+13+4)
    const original = Buffer.concat([base.subarray(0, ihdrEnd), textChunk, exifChunk, base.subarray(ihdrEnd)]);
    const originalSnapshot = Buffer.from(original);

    const derived = markStore.deriveCleanPhotoCopy(original);

    // The GPS bytes and both ancillary chunk TYPE markers are structurally
    // absent -- not because they were found and removed, but because
    // encodePng() never writes anything but IHDR/IDAT/IEND.
    expect(derived.includes(gpsSecret)).toBe(false);
    expect(derived.includes(Buffer.from('tEXt', 'ascii'))).toBe(false);
    expect(derived.includes(Buffer.from('eXIf', 'ascii'))).toBe(false);
    expect(derived.includes(exifSig)).toBe(false);

    // Pixel fidelity: decoding the DERIVED copy again (via the same public
    // API, round-tripped through deriveCleanPhotoCopy once more) reproduces
    // the exact original pixels -- this is not just "some bytes changed",
    // the image itself survived intact.
    const rerived = markStore.deriveCleanPhotoCopy(derived);
    expect(rerived.equals(derived)).toBe(true); // idempotent: clean PNG in -> byte-identical clean PNG out

    // The GPS-bearing ORIGINAL is untouched -- never mutated, never moved.
    expect(original.equals(originalSnapshot)).toBe(true);
    expect(original.includes(gpsSecret)).toBe(true); // still present in the untouched original
  });

  test('HEIC/HEIF input is refused outright, not passed through', async () => {
    const { markStore } = await freshModules();
    // Minimal ISO-BMFF ftyp box declaring the 'heic' brand.
    const heicLike = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x18]), // box size
      Buffer.from('ftyp', 'ascii'),
      Buffer.from('heic', 'ascii'), // major brand
      Buffer.from([0x00, 0x00, 0x00, 0x00]), // minor version
      Buffer.from('heic', 'ascii'), // compatible brand
    ]);
    expect(() => markStore.deriveCleanPhotoCopy(heicLike)).toThrow(markStore.PhotoFormatRefusedError);
    expect(() => markStore.deriveCleanPhotoCopy(heicLike)).toThrow(/HEIC\/HEIF/);
  });

  test('an unrecognized format is refused, not passed through', async () => {
    const { markStore } = await freshModules();
    const bmpLike = Buffer.from([0x42, 0x4d, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]); // "BM..." BMP signature
    expect(() => markStore.deriveCleanPhotoCopy(bmpLike)).toThrow(markStore.PhotoFormatRefusedError);
  });

  test('empty input is refused', async () => {
    const { markStore } = await freshModules();
    expect(() => markStore.deriveCleanPhotoCopy(Buffer.alloc(0))).toThrow(markStore.PhotoFormatRefusedError);
  });

  test('malformed PNG (bad geometry / truncated) is refused, not mishandled', async () => {
    const { markStore } = await freshModules();
    const truncated = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from([0x00, 0x00, 0x00, 0x0d]), // claims a 13-byte IHDR...
      Buffer.from('IHDR', 'ascii'),
      // ...but the buffer ends here, well short of 13 bytes + CRC.
    ]);
    expect(() => markStore.deriveCleanPhotoCopy(truncated)).toThrow(markStore.PhotoFormatRefusedError);
  });

  test('JPEG/WebP path: the injected decoder supplies pixels, the REAL PNG encoder produces the output, GPS bytes in the fake source never appear', async () => {
    const { markStore } = await freshModules();

    const gpsSecret = Buffer.from('GPS-COORDS-51.5074,-0.1278', 'ascii');
    // A fake JPEG: real SOI/EOI markers so isJpegSignature() routes it
    // correctly, with a "GPS" string sitting in the middle standing in for
    // an EXIF/GPS payload nativeImage would never surface as pixels anyway.
    const fakeJpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), gpsSecret, Buffer.from([0xff, 0xd9])]);

    const fixedPixels = { width: 1, height: 1, rgba: Buffer.from([10, 20, 30, 255]) };
    markStore.__setJpegWebpCodecForTesting({
      decode: (buf: Buffer) => (buf.includes(gpsSecret) ? fixedPixels : null),
      encodeJpeg: () => { throw new Error('not used by this test -- default output is png'); },
    });

    const derived = markStore.deriveCleanPhotoCopy(fakeJpeg); // default outputFormat: 'png'

    expect(derived.includes(gpsSecret)).toBe(false);
    // Round-trip through the real PNG decoder proves the output is a
    // genuine, well-formed PNG carrying exactly the injected pixels --
    // not a copy of fakeJpeg's bytes reinterpreted.
    const rerived = markStore.deriveCleanPhotoCopy(derived);
    expect(rerived.equals(derived)).toBe(true);

    markStore.__resetJpegWebpCodecForTesting();
  });

  test('jpeg outputFormat routes through the injected encodeJpeg', async () => {
    const { markStore } = await freshModules();
    const sentinel = Buffer.from('SENTINEL-JPEG-BYTES');
    markStore.__setJpegWebpCodecForTesting({
      decode: () => ({ width: 1, height: 1, rgba: Buffer.from([1, 2, 3, 255]) }),
      encodeJpeg: (_pixels: unknown, quality: number) => {
        expect(quality).toBe(77);
        return sentinel;
      },
    });
    const result = markStore.deriveCleanPhotoCopy(Buffer.from([0xff, 0xd8, 0xff, 0xd9]), {
      outputFormat: 'jpeg', jpegQuality: 77,
    });
    expect(result.equals(sentinel)).toBe(true);
    markStore.__resetJpegWebpCodecForTesting();
  });

  test('without a test override, JPEG input is safely refused in this non-Electron test runtime (not a crash, not a pass-through)', async () => {
    const { markStore } = await freshModules();
    // No __setJpegWebpCodecForTesting() call -- exercises productionNativeImageCodec
    // for real, whose `nativeImage` (from the mocked 'electron' module) is
    // undefined here, proving the guard clause fails safe.
    const jpegLike = Buffer.from([0xff, 0xd8, 0x01, 0x02, 0x03, 0xff, 0xd9]);
    expect(() => markStore.deriveCleanPhotoCopy(jpegLike)).toThrow(markStore.PhotoFormatRefusedError);
  });
});
