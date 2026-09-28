// savings_receipt_milestones.test.ts -- D-BP223-BM09-ARCHBISHOP-004-016 (REDO of 004-010)
// Pure milestone/window math -- no Electron, no file I/O, clock injected via nowIso/firstRecordIso.

import { describe, it, expect } from 'vitest';
import {
  SAVINGS_WINDOWS,
  windowDurationMs,
  windowRange,
  elapsedGateReached,
  milestoneReached,
  daysInUse,
} from './savings_receipt_milestones';

const T0 = '2026-01-01T00:00:00.000Z';
const t0ms = new Date(T0).getTime();
const iso = (ms: number) => new Date(ms).toISOString();

describe('savings_receipt_milestones: SAVINGS_WINDOWS', () => {
  it('lists all seven windows, "all" first', () => {
    expect(SAVINGS_WINDOWS).toEqual(['all', 'hour', 'day', 'week', 'fortnight', 'month', 'quarter']);
  });
});

describe('savings_receipt_milestones: elapsedGateReached boundaries', () => {
  it('hour: 59 minutes elapsed is NOT reached, 60 minutes IS, 61 minutes IS', () => {
    expect(elapsedGateReached('hour', iso(t0ms + 59 * 60 * 1000), T0)).toBe(false);
    expect(elapsedGateReached('hour', iso(t0ms + 60 * 60 * 1000), T0)).toBe(true);
    expect(elapsedGateReached('hour', iso(t0ms + 61 * 60 * 1000), T0)).toBe(true);
  });

  it('fortnight: 13 days elapsed is NOT reached, 14 days IS reached', () => {
    const thirteenDays = t0ms + 13 * 24 * 60 * 60 * 1000;
    const fourteenDays = t0ms + 14 * 24 * 60 * 60 * 1000;
    expect(elapsedGateReached('fortnight', iso(thirteenDays), T0)).toBe(false);
    expect(elapsedGateReached('fortnight', iso(fourteenDays), T0)).toBe(true);
  });

  it('quarter: 90 days elapsed is NOT reached, 91 days IS reached', () => {
    const ninetyDays = t0ms + 90 * 24 * 60 * 60 * 1000;
    const ninetyOneDays = t0ms + 91 * 24 * 60 * 60 * 1000;
    expect(elapsedGateReached('quarter', iso(ninetyDays), T0)).toBe(false);
    expect(elapsedGateReached('quarter', iso(ninetyOneDays), T0)).toBe(true);
  });

  it('day: 23h59m is NOT reached, exactly 24h IS reached', () => {
    expect(elapsedGateReached('day', iso(t0ms + (24 * 60 - 1) * 60 * 1000), T0)).toBe(false);
    expect(elapsedGateReached('day', iso(t0ms + 24 * 60 * 60 * 1000), T0)).toBe(true);
  });

  it('week: 6 days 23h59m is NOT reached, exactly 7 days IS reached', () => {
    const almostWeek = t0ms + (7 * 24 * 60 - 1) * 60 * 1000;
    const exactlyWeek = t0ms + 7 * 24 * 60 * 60 * 1000;
    expect(elapsedGateReached('week', iso(almostWeek), T0)).toBe(false);
    expect(elapsedGateReached('week', iso(exactlyWeek), T0)).toBe(true);
  });

  it('month: 29 days is NOT reached, 30 days IS reached', () => {
    expect(elapsedGateReached('month', iso(t0ms + 29 * 24 * 60 * 60 * 1000), T0)).toBe(false);
    expect(elapsedGateReached('month', iso(t0ms + 30 * 24 * 60 * 60 * 1000), T0)).toBe(true);
  });

  it('returns false with no first-record timestamp at all, regardless of "now"', () => {
    expect(elapsedGateReached('hour', iso(t0ms + 999 * 24 * 60 * 60 * 1000), null)).toBe(false);
  });
});

describe('savings_receipt_milestones: milestoneReached (elapsed AND in-window use)', () => {
  it('elapsed but zero queries in the trailing window is NOT reached', () => {
    expect(milestoneReached('day', iso(t0ms + 25 * 60 * 60 * 1000), T0, 0)).toBe(false);
  });

  it('elapsed AND at least one query in the trailing window IS reached', () => {
    expect(milestoneReached('day', iso(t0ms + 25 * 60 * 60 * 1000), T0, 1)).toBe(true);
  });

  it('queries present but NOT yet elapsed is NOT reached', () => {
    expect(milestoneReached('day', iso(t0ms + 60 * 60 * 1000), T0, 5)).toBe(false);
  });
});

describe('savings_receipt_milestones: windowRange', () => {
  it('"all" spans from the first record to now', () => {
    const now = iso(t0ms + 5 * 24 * 60 * 60 * 1000);
    expect(windowRange('all', now, T0)).toEqual({ from: T0, to: now });
  });

  it('"all" with no first record falls back to an empty [now, now) range', () => {
    const now = iso(t0ms);
    expect(windowRange('all', now, null)).toEqual({ from: now, to: now });
  });

  it('trailing windows are exactly [now - duration, now]', () => {
    const now = iso(t0ms + 100 * 24 * 60 * 60 * 1000);
    const range = windowRange('week', now, T0);
    expect(new Date(range.to).getTime() - new Date(range.from).getTime()).toBe(windowDurationMs('week'));
    expect(range.to).toBe(now);
  });
});

describe('savings_receipt_milestones: daysInUse', () => {
  it('floors whole days elapsed, 0 with no first record', () => {
    expect(daysInUse(iso(t0ms + 36 * 60 * 60 * 1000), T0)).toBe(1); // 1.5 days -> 1
    expect(daysInUse(iso(t0ms + 48 * 60 * 60 * 1000), T0)).toBe(2);
    expect(daysInUse(iso(t0ms), null)).toBe(0);
  });
});
