// cook_events_store.test.ts -- D-BP165-M0-014/BISHOP-M0/build-the-cook-event-recording
//
// PROVES THE FAR END (LAW 5) of the claims made in cook_events_store.ts's header:
//   1. Cook events are recorded (append-only), not counted.
//   2. Attribution accrues identically whether or not the recipe has graduated /
//      hit its earnings cap -- the payment path and the attribution path are
//      structurally independent.
//   3. Provenance (acquisitionPath, referrerPeerId, sourceUnlockId) flows through
//      from unlock into the cook record intact.
//   4. The anti-double-submit dedupe window suppresses a rapid duplicate but never
//      a distinct later cook, and never mutates an existing entry.
//
// Isolated per test via a fresh temp userData dir (mocking electron's app.getPath),
// matching this repo's existing convention of never touching a real user data dir
// in tests.

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let userDataDir: string;

vi.mock('electron', () => ({
  app: { getPath: (_key: string) => userDataDir },
  ipcMain: { handle: vi.fn() },
}));

async function freshStoreModule() {
  vi.resetModules();
  return import('./cook_events_store');
}

beforeEach(() => {
  userDataDir = mkdtempSync(join(tmpdir(), 'cook-events-test-'));
});

afterEach(() => {
  rmSync(userDataDir, { recursive: true, force: true });
});

describe('recordCookEvent: append-only ledger, not a counter', () => {
  test('writes one JSONL line per cook, readable back as distinct entries', async () => {
    const store = await freshStoreModule();
    store.recordCookEvent({
      recipeId: 'recipe-1',
      authorId: 'author-1',
      cookedBy: 'peer-a',
      cookedAt: '2026-08-01T00:00:00.000Z',
      acquisitionPath: 'direct-menu',
      referrerPeerId: null,
      sourceUnlockId: 'unlock-1',
      graduated: false,
      guildMultiplierAtCook: 1,
    });
    store.recordCookEvent({
      recipeId: 'recipe-1',
      authorId: 'author-1',
      cookedBy: 'peer-a',
      cookedAt: '2026-08-08T00:00:00.000Z', // one week later -- clear of dedupe window
      acquisitionPath: 'direct-menu',
      referrerPeerId: null,
      sourceUnlockId: 'unlock-1',
      graduated: false,
      guildMultiplierAtCook: 1,
    });

    const all = store.listCookEvents();
    expect(all).toHaveLength(2);
    expect(new Set(all.map((e) => e.id)).size).toBe(2); // distinct ids, not one row incremented

    const path = join(userDataDir, 'kitchen_table_cook_events.jsonl');
    const lines = readFileSync(path, 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(2); // one physical line per event, not a rewritten total
  });

  test('a malformed line does not take down the whole ledger read', async () => {
    const store = await freshStoreModule();
    store.recordCookEvent({
      recipeId: 'recipe-1',
      authorId: 'author-1',
      cookedBy: 'peer-a',
      cookedAt: '2026-08-01T00:00:00.000Z',
      acquisitionPath: 'direct-menu',
      referrerPeerId: null,
      sourceUnlockId: 'unlock-1',
      graduated: false,
      guildMultiplierAtCook: 1,
    });
    const path = join(userDataDir, 'kitchen_table_cook_events.jsonl');
    const { appendFileSync } = await import('fs');
    appendFileSync(path, 'not-json\n', 'utf-8');

    expect(store.listCookEvents()).toHaveLength(1);
  });
});

describe('attribution survives graduation independently of payment (constraint 3)', () => {
  test('a graduated (capped) recipe keeps recording cook events and accruing RP/XP identically to an ungraduated one', async () => {
    const store = await freshStoreModule();

    // Recipe A: never graduated, always earning marks (payment path, not modeled
    // in this file at all -- see the "two code paths" header comment).
    store.recordCookEvent({
      recipeId: 'recipe-A-active',
      authorId: 'author-A',
      cookedBy: 'peer-1',
      cookedAt: '2026-08-01T00:00:00.000Z',
      acquisitionPath: 'direct-menu',
      referrerPeerId: null,
      sourceUnlockId: 'unlock-A1',
      graduated: false,
      guildMultiplierAtCook: 1,
    });

    // Recipe B: graduated (cap reached, free forever per section 4). Cooked from
    // the commons, no unlock record backs this cook at all.
    store.recordCookEvent({
      recipeId: 'recipe-B-graduated',
      authorId: 'author-B',
      cookedBy: 'peer-2',
      cookedAt: '2026-08-01T00:00:00.000Z',
      acquisitionPath: 'graduated-commons',
      referrerPeerId: null,
      sourceUnlockId: null,
      graduated: true,
      guildMultiplierAtCook: 1,
    });

    // Both recorded -- graduation did not suppress the write.
    expect(store.listCookEventsForRecipe('recipe-A-active')).toHaveLength(1);
    expect(store.listCookEventsForRecipe('recipe-B-graduated')).toHaveLength(1);

    // Both accrue RP/XP identically -- tallyRpXpForAuthor never reads `graduated`.
    expect(store.tallyRpXpForAuthor('author-A')).toBe(1);
    expect(store.tallyRpXpForAuthor('author-B')).toBe(1);
  });

  test('a recipe that graduates mid-lifetime keeps accruing after the flag flips, at the same rate', async () => {
    const store = await freshStoreModule();

    store.recordCookEvent({
      recipeId: 'recipe-mid',
      authorId: 'author-mid',
      cookedBy: 'peer-1',
      cookedAt: '2026-01-01T00:00:00.000Z',
      acquisitionPath: 'direct-menu',
      referrerPeerId: null,
      sourceUnlockId: 'unlock-1',
      graduated: false, // before the cap
      guildMultiplierAtCook: 2,
    });
    store.recordCookEvent({
      recipeId: 'recipe-mid',
      authorId: 'author-mid',
      cookedBy: 'peer-2', // different cook, so the dedupe window does not apply
      cookedAt: '2026-01-01T00:05:00.000Z',
      acquisitionPath: 'graduated-commons',
      referrerPeerId: null,
      sourceUnlockId: null,
      graduated: true, // after the cap, same day
      guildMultiplierAtCook: 2,
    });

    expect(store.listCookEventsForRecipe('recipe-mid')).toHaveLength(2);
    // Guild-doubled rate (section 10: double the rate, double the cap) applies
    // identically pre- and post-graduation -- 2 + 2, not 2 + 0.
    expect(store.tallyRpXpForAuthor('author-mid')).toBe(4);
  });
});

describe('provenance flow-through (section 3 + Founder: "flow-through to sources")', () => {
  test('acquisitionPath, referrerPeerId, and sourceUnlockId round-trip unchanged from a share-path cook', async () => {
    const store = await freshStoreModule();
    const written = store.recordCookEvent({
      recipeId: 'recipe-shared',
      authorId: 'author-shared',
      cookedBy: 'peer-recipient',
      cookedAt: '2026-08-01T00:00:00.000Z',
      acquisitionPath: 'share',
      referrerPeerId: 'peer-sharer',
      sourceUnlockId: 'unlock-77',
      graduated: false,
      guildMultiplierAtCook: 1,
    });

    const [readBack] = store.listCookEventsForRecipe('recipe-shared');
    expect(readBack.id).toBe(written.id);
    expect(readBack.acquisitionPath).toBe('share');
    expect(readBack.referrerPeerId).toBe('peer-sharer');
    expect(readBack.sourceUnlockId).toBe('unlock-77');
  });

  test('a commons cook (never unlocked) records null referrerPeerId and null sourceUnlockId honestly, not a guess', async () => {
    const store = await freshStoreModule();
    const written = store.recordCookEvent({
      recipeId: 'recipe-commons',
      authorId: 'author-commons',
      cookedBy: 'peer-x',
      cookedAt: '2026-08-01T00:00:00.000Z',
      acquisitionPath: 'graduated-commons',
      referrerPeerId: null,
      sourceUnlockId: null,
      graduated: true,
      guildMultiplierAtCook: 1,
    });

    expect(written.sourceUnlockId).toBeNull();
    expect(written.referrerPeerId).toBeNull();
  });
});

describe('anti-double-submit dedupe (documented policy, not a per-day cap)', () => {
  test('a second identical cook within the window is suppressed and returns the prior entry, not a new row', async () => {
    const store = await freshStoreModule();
    const first = store.recordCookEvent({
      recipeId: 'recipe-dupe',
      authorId: 'author-dupe',
      cookedBy: 'peer-a',
      cookedAt: '2026-08-01T12:00:00.000Z',
      acquisitionPath: 'direct-menu',
      referrerPeerId: null,
      sourceUnlockId: 'unlock-1',
      graduated: false,
      guildMultiplierAtCook: 1,
    });
    const second = store.recordCookEvent({
      recipeId: 'recipe-dupe',
      authorId: 'author-dupe',
      cookedBy: 'peer-a',
      cookedAt: '2026-08-01T12:01:00.000Z', // 60s later, inside the 5-minute window
      acquisitionPath: 'direct-menu',
      referrerPeerId: null,
      sourceUnlockId: 'unlock-1',
      graduated: false,
      guildMultiplierAtCook: 1,
    });

    expect(second.id).toBe(first.id); // no new row written
    expect(store.listCookEventsForRecipe('recipe-dupe')).toHaveLength(1);
  });

  test('a cook outside the window is recorded as a distinct event (does not under-count real re-cooks)', async () => {
    const store = await freshStoreModule();
    store.recordCookEvent({
      recipeId: 'recipe-recook',
      authorId: 'author-recook',
      cookedBy: 'peer-a',
      cookedAt: '2026-08-01T12:00:00.000Z',
      acquisitionPath: 'direct-menu',
      referrerPeerId: null,
      sourceUnlockId: 'unlock-1',
      graduated: false,
      guildMultiplierAtCook: 1,
    });
    store.recordCookEvent({
      recipeId: 'recipe-recook',
      authorId: 'author-recook',
      cookedBy: 'peer-a',
      cookedAt: '2026-08-01T12:06:00.000Z', // 6 minutes later, outside the 5-minute window
      acquisitionPath: 'direct-menu',
      referrerPeerId: null,
      sourceUnlockId: 'unlock-1',
      graduated: false,
      guildMultiplierAtCook: 1,
    });

    expect(store.listCookEventsForRecipe('recipe-recook')).toHaveLength(2);
  });

  test('a different cook of the same recipe in the same instant is never suppressed by another cooks dedupe window', async () => {
    const store = await freshStoreModule();
    store.recordCookEvent({
      recipeId: 'recipe-shared-dish',
      authorId: 'author-z',
      cookedBy: 'peer-a',
      cookedAt: '2026-08-01T12:00:00.000Z',
      acquisitionPath: 'direct-menu',
      referrerPeerId: null,
      sourceUnlockId: 'unlock-a',
      graduated: false,
      guildMultiplierAtCook: 1,
    });
    store.recordCookEvent({
      recipeId: 'recipe-shared-dish',
      authorId: 'author-z',
      cookedBy: 'peer-b', // different cook
      cookedAt: '2026-08-01T12:00:00.000Z',
      acquisitionPath: 'direct-menu',
      referrerPeerId: null,
      sourceUnlockId: 'unlock-b',
      graduated: false,
      guildMultiplierAtCook: 1,
    });

    expect(store.listCookEventsForRecipe('recipe-shared-dish')).toHaveLength(2);
  });
});
