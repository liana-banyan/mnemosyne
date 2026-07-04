/**
 * reminder_canon_violation.ts -- Wave II-A smoke-test fixture
 *
 * BP089 · Mountain 2 · Knight Marathon 5
 * Fixture path: src/main/scribes/tests/fixtures/reminder_canon_violation.ts
 *
 * Injects a hard pricing-violation dispatch into the ReminderScribe scan queue.
 * Expected: all 3 Council members flag → severity: 'HARD' · 3-of-3 councilVote.
 * Also injects a clean dispatch simultaneously to verify zero false positives.
 *
 * Usage (Wave II-A smoke test):
 *   1. Instantiate ReminderScribe with a test config
 *   2. Push VIOLATION_DISPATCH and CLEAN_DISPATCH into fetchPendingDispatches()
 *   3. Run one scan cycle
 *   4. Assert: pearl emitted for VIOLATION · no pearl for CLEAN
 */

import type { Dispatch } from '../../types';

/** Hard pricing violation: "Members pay $10/year" -- unambiguous canon breach */
export const VIOLATION_DISPATCH: Dispatch = {
  id: 'test:reminder:violation:001',
  agentId: 'test_bishop_agent',
  text: 'Members pay $10/year for full platform access to all cooperative services.',
  createdAt: new Date().toISOString(),
  channel: 'reminder_scribe_test',
  meta: { fixture: true, expectedSeverity: 'HARD' },
};

/** Clean dispatch: correct pricing, no violations */
export const CLEAN_DISPATCH: Dispatch = {
  id: 'test:reminder:clean:001',
  agentId: 'test_bishop_agent',
  text: 'Membership is $5/year. Welcome to the cooperative — your account is now active.',
  createdAt: new Date().toISOString(),
  channel: 'reminder_scribe_test',
  meta: { fixture: true, expectedSeverity: null },
};

/**
 * Expected pearl payload for VIOLATION_DISPATCH.
 * Knight fills in runtime fields (timestamp, pearlId) at Wave II execution.
 */
export const EXPECTED_VIOLATION_PEARL = {
  type: 'CANON_VIOLATION',
  severity: 'HARD',
  canon: 'membership_obviously_better_5_per_year',
  scribe: 'reminder_scribe',
  violator: 'test_bishop_agent',
  councilVote: {
    memberA: true,
    memberB: true,
    memberC: true,
    consensus: 'HARD',
  },
} as const;

/** Pass criteria (Wave II-A) */
export const PASS_CRITERIA = {
  pearlWithin5s: true,
  severity: 'HARD' as const,
  councilVoteAll3True: true,
  violationsLogRowPresent: true,
  zeroFalsePositivesOnClean: true,
} as const;
