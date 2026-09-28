// savings_receipt_milestones.ts -- D-BP223-BM09-ARCHBISHOP-004-016 (REDO of 004-010)
//
// Pure window/milestone math for the "My Savings Receipt" launch incentive (Founder ruling:
// "DOWNLOAD IT and PROVE IT and POST IT" -- Blue Crow Feathers at an hour, a day, a week, a
// fortnight, a month, a quarter of use). No Electron import, no file I/O, no Date.now() call --
// every function here takes "now" as an explicit ISO string so tests can inject a clock instead
// of racing the real one. ai_dispatch_ipc.ts's 'savings-receipt:summary' handler is the only
// caller; it supplies the real current time and the real per-window query counts (read from
// substrate_savings_receipt.ts's computePeriodAggregate(), which needs the receipts log file this
// module deliberately knows nothing about). Confirmed before writing this file: neither
// substrate_savings_receipt.ts nor its .test.ts sibling has any milestone/window-reached concept
// -- they emit and verify receipts and compute a period aggregate, nothing about elapsed-time
// gates or Blue Crow Feather thresholds.

export type SavingsReceiptWindow = 'all' | 'hour' | 'day' | 'week' | 'fortnight' | 'month' | 'quarter';
export type SavingsReceiptTrailingWindow = Exclude<SavingsReceiptWindow, 'all'>;

export const SAVINGS_WINDOWS: SavingsReceiptWindow[] = ['all', 'hour', 'day', 'week', 'fortnight', 'month', 'quarter'];

/** Trailing-window durations. 'month' is a flat 30 days and 'quarter' a flat 91 days (not
 *  calendar months/quarters) -- deliberately simple and unambiguous for a receipt whose numbers
 *  a stranger has to be able to check by hand. */
const WINDOW_MS: Record<SavingsReceiptTrailingWindow, number> = {
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  fortnight: 14 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  quarter: 91 * 24 * 60 * 60 * 1000,
};

export function windowDurationMs(window: SavingsReceiptTrailingWindow): number {
  return WINDOW_MS[window];
}

/** [from, to] ISO range for a window. 'all' spans from the first record ever emitted to now
 *  (falling back to `nowIso` itself, i.e. an empty range, when there is no first record yet);
 *  every other window is the trailing duration up to now. */
export function windowRange(
  window: SavingsReceiptWindow,
  nowIso: string,
  firstRecordIso: string | null,
): { from: string; to: string } {
  if (window === 'all') {
    return { from: firstRecordIso ?? nowIso, to: nowIso };
  }
  const now = new Date(nowIso).getTime();
  const from = new Date(now - WINDOW_MS[window]).toISOString();
  return { from, to: nowIso };
}

/**
 * D-BP223-BM09-ARCHBISHOP-004-016 milestone definition, stated here because the dispatch required
 * it in a comment: a trailing window (hour/day/week/fortnight/month/quarter) is REACHED when BOTH
 *   1. at least that window's full duration has elapsed since the member's first-ever receipt
 *      (elapsedGateReached below) -- they have been a member long enough to have completed one
 *      full window, not just crossed a calendar boundary the same minute they installed, and
 *   2. at least one receipt falls inside the most recent such trailing window -- there was actual
 *      measured use in that window, not just elapsed clock time with the app untouched.
 * Condition 2 needs a real query count from computePeriodAggregate() (file I/O), so it is passed
 * in by the caller as `queriesInTrailingWindow` rather than computed here -- this keeps this
 * module pure and lets condition 1's boundary math (the 59-vs-61-minute, 13-vs-14-day,
 * 90-vs-91-day edge cases) be unit-tested with a fabricated clock and no substrate file at all.
 */
export function elapsedGateReached(
  window: SavingsReceiptTrailingWindow,
  nowIso: string,
  firstRecordIso: string | null,
): boolean {
  if (!firstRecordIso) return false;
  const elapsedMs = new Date(nowIso).getTime() - new Date(firstRecordIso).getTime();
  return elapsedMs >= WINDOW_MS[window];
}

export function milestoneReached(
  window: SavingsReceiptTrailingWindow,
  nowIso: string,
  firstRecordIso: string | null,
  queriesInTrailingWindow: number,
): boolean {
  return elapsedGateReached(window, nowIso, firstRecordIso) && queriesInTrailingWindow >= 1;
}

/** Whole days elapsed since the first record, floored, never negative. 0 when there is no first
 *  record yet (member has not asked a first question). */
export function daysInUse(nowIso: string, firstRecordIso: string | null): number {
  if (!firstRecordIso) return 0;
  const elapsedMs = new Date(nowIso).getTime() - new Date(firstRecordIso).getTime();
  return Math.max(0, Math.floor(elapsedMs / (24 * 60 * 60 * 1000)));
}
