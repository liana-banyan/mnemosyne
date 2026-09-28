// proveit_ui_logic.test.ts -- D-BP223-BM04-X033S3-009 STEP 3
//
// The brief's Renderer test requirement ("at least the region-D gray/un-gray and the by-hand
// completion") against the pure logic extracted into proveit_ui_logic.ts -- see that file's
// header for why: this repo has no @testing-library/react or jsdom/happy-dom in package.json,
// and the brief forbids any package.json change, so a real DOM-rendering test of
// ProveItWorksTab.tsx itself cannot run under this project's vitest setup today (vitest's default
// environment is 'node', no DOM). Testing the extracted pure rules directly still gives a real,
// passing, meaningful test of both behaviors; a full component-render test is flagged in
// REPORT.md as a [RULING NEEDED] for whoever can add the dev dependency.

import { describe, it, expect } from 'vitest';
import { isRegionDUnlocked, shouldCompleteFromPaste, filterByCategory, shouldShowUnlockHighlight } from './proveit_ui_logic';

describe('isRegionDUnlocked (spec Section 5: grayed until you have added one)', () => {
  it('is locked before any card has been published', () => {
    expect(isRegionDUnlocked(false)).toBe(false);
  });
  it('unlocks the moment a card has been published', () => {
    expect(isRegionDUnlocked(true)).toBe(true);
  });
});

describe('shouldShowUnlockHighlight (the one-time highlight on the gray -> unlocked transition)', () => {
  it('fires on the false -> true transition', () => {
    expect(shouldShowUnlockHighlight(false, true, false)).toBe(true);
  });
  it('never fires if already unlocked on mount', () => {
    expect(shouldShowUnlockHighlight(true, true, false)).toBe(false);
  });
  it('never fires twice', () => {
    expect(shouldShowUnlockHighlight(false, true, true)).toBe(false);
  });
});

describe('shouldCompleteFromPaste (spec Section 4: pasting completes the card, no second Ask)', () => {
  it('fires once real text is pasted', () => {
    expect(shouldCompleteFromPaste('', 'Jupiter has 97 moons.')).toBe(true);
  });
  it('never fires for empty/whitespace-only text', () => {
    expect(shouldCompleteFromPaste('', '   ')).toBe(false);
  });
  it('never re-fires for the exact same text (e.g. a re-render)', () => {
    expect(shouldCompleteFromPaste('Jupiter has 97 moons.', 'Jupiter has 97 moons.')).toBe(false);
  });
  it('fires again if the text actually changes (an edit after the first paste)', () => {
    expect(shouldCompleteFromPaste('Jupiter has 97 moons.', 'Jupiter has 97 moons, updated.')).toBe(true);
  });
});

describe('filterByCategory (region D category picker)', () => {
  const cards = [{ category: 'math', id: 1 }, { category: 'biology', id: 2 }, { category: 'math', id: 3 }];
  it('returns everything for "all"', () => {
    expect(filterByCategory(cards, 'all')).toHaveLength(3);
  });
  it('filters to the exact category', () => {
    expect(filterByCategory(cards, 'math').map((c) => c.id)).toEqual([1, 3]);
  });
});
