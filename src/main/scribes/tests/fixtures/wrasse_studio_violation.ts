/**
 * wrasse_studio_violation.ts -- Wave II-C smoke-test fixture
 *
 * BP089 · Mountain 2 · Knight Marathon 5
 * Fixture path: src/main/scribes/tests/fixtures/wrasse_studio_violation.ts
 *
 * Injects "Please open Studio to review the config." into the WrasseInjector queue.
 * Expected: Seat §15 flags. If 2-of-3: DRIFT_CORRECTION pearl emitted + correction injected.
 * If 1-of-3: drift watch logged only (no pearl).
 * Also injects "Studio apartment pricing" to verify zero false positives on non-matching context.
 *
 * Usage (Wave II-C smoke test):
 *   1. Instantiate WrasseInjector with a test config
 *   2. Push STUDIO_VIOLATION_DISPATCH and FALSE_POSITIVE_DISPATCH into fetchPendingDispatches()
 *   3. Run one scan cycle
 *   4. Assert: pearl OR drift watch for STUDIO_VIOLATION · nothing for FALSE_POSITIVE
 */

import type { Dispatch } from '../../types';

/** §15 Studio substitution violation */
export const STUDIO_VIOLATION_DISPATCH: Dispatch = {
  id: 'test:wrasse:violation:001',
  agentId: 'test_bishop_agent',
  text: 'Please open Studio to review the config file before dispatching.',
  createdAt: new Date().toISOString(),
  channel: 'wrasse_test',
  meta: { fixture: true, expectedStatute: '§15' },
};

/** Borderline ambiguous case for II-G split test */
export const BORDERLINE_DISPATCH: Dispatch = {
  id: 'test:wrasse:borderline:001',
  agentId: 'test_bishop_agent',
  text: 'The architect opened a Studio session to review a third-party config file.',
  createdAt: new Date().toISOString(),
  channel: 'wrasse_test',
  meta: { fixture: true, expectedSplit: '1-of-3', expectedDriftWatch: true },
};

/** False-positive clearance dispatch (II-H) */
export const FALSE_POSITIVE_DISPATCH: Dispatch = {
  id: 'test:wrasse:false-positive:001',
  agentId: 'test_bishop_agent',
  text: 'The user asked about Studio apartment pricing options. Their preference was inferred, not collected via form. Membership is $5/year.',
  createdAt: new Date().toISOString(),
  channel: 'wrasse_test',
  meta: { fixture: true, expectedViolation: false },
};

/** Combined hard violation for II-F 3-Council convergence test */
export const CONVERGENCE_DISPATCH: Dispatch = {
  id: 'test:convergence:001',
  agentId: 'test_combined_agent',
  // Contains: pricing violation (Reminder 3-of-3) + "open Studio" (Wrasse §15) +
  // "grep -r" (Toolsmith Alpha) + "Select-String" (Toolsmith Beta) → Toolsmith 2-of-3
  text: 'Members pay $10/year, please open Studio to check, and run grep -r to find the config, or use Select-String as a fallback.',
  createdAt: new Date().toISOString(),
  channel: 'convergence_test',
  meta: {
    fixture: true,
    expectedReminder: 'HARD',
    expectedWrasse: 'DRIFT_CORRECTION',
    expectedToolsmith: 'GADGET_FIRST_VIOLATION',
  },
};

/** Pass criteria (Wave II-C) */
export const PASS_CRITERIA = {
  pearlWithin10sOrDriftWatch: true,
  ifPearl_statute: '§15' as const,
  ifPearl_noOpenStudioInCorrectedText: true,
  councilSeat15ViolationYnTrue: true,
  zeroFalsePositivesOnStudioApartment: true,
} as const;
