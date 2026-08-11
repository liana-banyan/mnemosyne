// D-BP152-031/BISHOP/seg-wire-threading-to-callers -- pure unit tests for
// createNexusRunThreadContext(), the run-scoped threadId/continueThread derivation this ticket
// adds. Founder ruling, BP152, verbatim: "I want it threaded" -- in answer to Bishop's own
// disclosure that D-BP152-030R's decideNexusThreadContinuation is built but "no caller passes
// threadId yet."
//
// No Electron import anywhere in this file -- createNexusRunThreadContext and
// decideNexusThreadContinuation are both pure (browser_authority_types.ts), so the full
// run-boundary mechanism this ticket wires into index.ts's askGoogle closure is exercised here
// without mocking Electron or a live window. Where a test combines the two functions (simulating
// what index.ts's module-level `nexusLiveThread` + decideNexusThreadContinuation loop actually
// does across a sequence of calls), that is noted inline.
import { describe, expect, it } from 'vitest';
import {
  createNexusRunThreadContext,
  decideNexusThreadContinuation,
  type NexusLiveThreadState,
} from './browser_authority_types';

describe('D-BP152-031 createNexusRunThreadContext', () => {
  // VERIFY (a): two queries to the same conversational authority in one run continue one thread,
  // with position incrementing. Combines forQuery() (this ticket) with
  // decideNexusThreadContinuation() (D-BP152-030R) the exact same way index.ts's runOnceObserved
  // does: threadDecision computed from the query, nexusLiveThread updated to threadDecision.nextState,
  // fed into the next call.
  it('two queries to the same conversational authority in one run continue one thread, position incrementing', () => {
    const run = createNexusRunThreadContext('seed-a');
    let live: NexusLiveThreadState | null = null;

    const q1Fields = run.forQuery('user_claude');
    expect(q1Fields.threadId).toBe('seed-a:user_claude');
    expect(q1Fields.continueThread).toBe(false); // first call in this run -- nothing to continue yet
    const d1 = decideNexusThreadContinuation({ authority: 'user_claude', ...q1Fields }, live);
    live = d1.nextState;
    expect(d1.continuing).toBe(false);
    expect(d1.threadPosition).toBe(1);

    const q2Fields = run.forQuery('user_claude');
    expect(q2Fields.threadId).toBe('seed-a:user_claude'); // SAME id -- same run, same authority
    expect(q2Fields.continueThread).toBe(true);
    const d2 = decideNexusThreadContinuation({ authority: 'user_claude', ...q2Fields }, live);
    live = d2.nextState;
    expect(d2.continuing).toBe(true);
    expect(d2.threadPosition).toBe(2);

    const q3Fields = run.forQuery('user_claude');
    const d3 = decideNexusThreadContinuation({ authority: 'user_claude', ...q3Fields }, live);
    expect(d3.continuing).toBe(true);
    expect(d3.threadPosition).toBe(3);
  });

  // VERIFY (b): a new run always starts a new thread -- nothing from the prior run is reachable.
  // THE GUARD THAT MATTERS MOST, per the dispatch. Enforced structurally: a fresh
  // createNexusRunThreadContext() call (no seed passed) always produces a different id space, and
  // its FIRST call for any authority always returns continueThread:false, so it can never be
  // mistaken for a continuation of a state left over from a previous run.
  describe('a new run never continues a prior run\'s thread (no cross-question leakage)', () => {
    it('two independently-created contexts mint different threadIds for the same authority', () => {
      const run1 = createNexusRunThreadContext();
      const run2 = createNexusRunThreadContext();
      const t1 = run1.forQuery('user_gemini').threadId;
      const t2 = run2.forQuery('user_gemini').threadId;
      expect(t1).toBeDefined();
      expect(t2).toBeDefined();
      expect(t1).not.toBe(t2); // structural: two runs never share an id, no caller discipline needed
    });

    it('a fresh run\'s first query cannot continue a live thread left over from a previous run', () => {
      // Simulates index.ts's module-level nexusLiveThread still holding run 1's last state at
      // the moment run 2 begins (the real code resets it to null on a non-conversational branch,
      // but the whole POINT of this guard is that run 2 must be safe even if it did not).
      const liveFromRun1: NexusLiveThreadState = { authority: 'user_claude', threadId: 'run1:user_claude', position: 4 };

      const run2 = createNexusRunThreadContext('run2-seed');
      const run2FirstQuery = run2.forQuery('user_claude');
      expect(run2FirstQuery.continueThread).toBe(false); // a run's own first call is never a continuation
      expect(run2FirstQuery.threadId).not.toBe(liveFromRun1.threadId);

      const decision = decideNexusThreadContinuation(
        { authority: 'user_claude', ...run2FirstQuery },
        liveFromRun1,
      );
      expect(decision.continuing).toBe(false); // run 1's thread is NOT reachable from run 2
      expect(decision.threadStatus).toBe('new');
      expect(decision.nextState).toEqual({ authority: 'user_claude', threadId: run2FirstQuery.threadId, position: 1 });
    });

    it('a different authority within the SAME run also gets its own independent thread', () => {
      const run = createNexusRunThreadContext('seed-multi');
      const claudeFields = run.forQuery('user_claude');
      const chatgptFields = run.forQuery('user_chatgpt');
      expect(claudeFields.threadId).not.toBe(chatgptFields.threadId);
      expect(claudeFields.continueThread).toBe(false);
      expect(chatgptFields.continueThread).toBe(false); // chatgpt's own first call, independent of claude's
    });
  });

  // VERIFY (c): Google and Perplexity remain one-shot -- forQuery() itself refuses to mint or
  // track an id for either, independent of and in addition to decideNexusThreadContinuation's own
  // identical gate (belt and suspenders, not a second source of truth).
  it('never mints or tracks a thread for user_google', () => {
    const run = createNexusRunThreadContext('seed-g');
    const first = run.forQuery('user_google');
    const second = run.forQuery('user_google');
    expect(first).toEqual({ threadId: undefined, continueThread: false });
    expect(second).toEqual({ threadId: undefined, continueThread: false }); // still one-shot on the 2nd call
  });

  it('never mints or tracks a thread for user_perplexity', () => {
    const run = createNexusRunThreadContext('seed-p');
    const first = run.forQuery('user_perplexity');
    expect(first).toEqual({ threadId: undefined, continueThread: false });
  });

  // VERIFY (d): a Google-only run is byte-identical to pre-ticket behavior. forQuery('user_google')
  // always returns { threadId: undefined, continueThread: false } -- spread onto a
  // BrowserAuthorityQuery, this is indistinguishable from a query object that never had these
  // optional fields set at all (their pre-D-BP152-030R shape). Proves the index.ts wiring adds no
  // observable field for the one caller (askGoogle) that exists in this engine today.
  it('the fields spread onto a google query are a no-op shape (both optional fields absent-equivalent)', () => {
    const run = createNexusRunThreadContext('seed-noop');
    const query = { question: 'q', authority: 'user_google' as const, ...run.forQuery('user_google') };
    expect(query).toEqual({ question: 'q', authority: 'user_google', threadId: undefined, continueThread: false });
    // decideNexusThreadContinuation (the real enforcement point) treats this identically to a
    // query that never carried threadId/continueThread at all -- see the D-BP152-030R test file's
    // own "never threads user_google" assertion for that half of the proof.
  });
});
