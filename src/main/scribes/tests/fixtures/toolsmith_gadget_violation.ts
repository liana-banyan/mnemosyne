/**
 * toolsmith_gadget_violation.ts -- Wave II-B smoke-test fixture
 *
 * BP089 · Mountain 2 · Knight Marathon 5
 * Fixture path: src/main/scribes/tests/fixtures/toolsmith_gadget_violation.ts
 *
 * Injects a dispatch containing `bash grep -r "pheromone"` into the ToolsmithScribe
 * scan queue. Expected: Alpha seat flags. Auto-rewrite true if 2-of-3; false if 1-of-3.
 * Also injects a comment-only dispatch to verify zero false positives on "grep" in comments.
 *
 * Usage (Wave II-B smoke test):
 *   1. Instantiate ToolsmithScribe with a test config
 *   2. Push GADGET_VIOLATION_DISPATCH and COMMENT_DISPATCH into fetchPendingDispatches()
 *   3. Run one scan cycle
 *   4. Assert: GADGET_FIRST_VIOLATION pearl emitted for GADGET_VIOLATION · no pearl for COMMENT
 */

import type { Dispatch } from '../../types';

/** §17 bash discovery violation: contains `bash grep -r` */
export const GADGET_VIOLATION_DISPATCH: Dispatch = {
  id: 'test:toolsmith:violation:001',
  agentId: 'test_knight_agent',
  text: 'To find pheromone records, run: bash grep -r "pheromone" ./librarian-mcp/stitchpunks/',
  createdAt: new Date().toISOString(),
  channel: 'toolsmith_test',
  meta: { fixture: true, expectedForbiddenPattern: 'bash grep' },
};

/** Clean comment dispatch: mentions "grep" only in a narrative sentence */
export const COMMENT_DISPATCH: Dispatch = {
  id: 'test:toolsmith:clean:001',
  agentId: 'test_knight_agent',
  text: 'Note: the canonical salience system replaces legacy grep searches entirely.',
  createdAt: new Date().toISOString(),
  channel: 'toolsmith_test',
  meta: { fixture: true, expectedViolation: false },
};

/**
 * Expected fields on the GADGET_FIRST_VIOLATION pearl for GADGET_VIOLATION_DISPATCH.
 */
export const EXPECTED_GADGET_PEARL = {
  type: 'GADGET_FIRST_VIOLATION',
  statute: '§17',
  scribe: 'toolsmith_scribe',
  violator: 'test_knight_agent',
  forbiddenPattern: 'bash grep',
  suggestedGadget: 'pheromone_query',
  'councilVote.alpha': true,
} as const;

/** Pass criteria (Wave II-B) */
export const PASS_CRITERIA = {
  pearlWithin5s: true,
  forbiddenPatternField: 'bash grep',
  suggestedGadgetField: 'pheromone_query',
  councilAlphaTrue: true,
  zeroFalsePositivesOnComment: true,
} as const;
