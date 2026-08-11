// D-BP152-030R/BISHOP/seg-threaded-askgoogle -- pure unit tests for the thread-continuation
// decision point. Founder ruling, BP152, verbatim: "make askGoogle keep the thread instead of
// one-shot." No Electron import anywhere in this file -- decideNexusThreadContinuation is a pure
// function (browser_authority_types.ts), so every VERIFY assertion this ticket asks for that
// concerns the DECISION LOGIC (as opposed to the live webview mechanics, which need a real
// window -- see the SEG return's UNVERIFIED section) is exercised here without mocking Electron.
import { describe, expect, it } from 'vitest';
import {
  decideNexusThreadContinuation,
  isInteractiveBrowserAuthority,
  type NexusLiveThreadState,
} from './browser_authority_types';

describe('D-BP152-030R decideNexusThreadContinuation', () => {
  // VERIFY (a): two queries in one question continue one thread.
  it('continues the same thread across two queries for the same threadId', () => {
    let state: NexusLiveThreadState | null = null;

    const first = decideNexusThreadContinuation(
      { authority: 'user_claude', threadId: 'q1', continueThread: false },
      state,
    );
    state = first.nextState;
    expect(first.continuing).toBe(false); // first message of a question always starts fresh
    expect(first.threadStatus).toBe('new');
    expect(first.threadPosition).toBe(1);

    const second = decideNexusThreadContinuation(
      { authority: 'user_claude', threadId: 'q1', continueThread: true },
      state,
    );
    state = second.nextState;
    expect(second.continuing).toBe(true);
    expect(second.threadStatus).toBe('continued');
    expect(second.threadPosition).toBe(2);
    expect(state).toEqual({ authority: 'user_claude', threadId: 'q1', position: 2 });

    // a third follow-up keeps advancing the same thread
    const third = decideNexusThreadContinuation(
      { authority: 'user_claude', threadId: 'q1', continueThread: true },
      state,
    );
    expect(third.continuing).toBe(true);
    expect(third.threadPosition).toBe(3);
  });

  // VERIFY (b): a new question ALWAYS starts a new thread -- no state, text, or option string
  // from the prior question is reachable. This is THE GUARD THAT MATTERS MOST per the dispatch.
  describe('a new question never continues a prior one (no cross-question leakage)', () => {
    it('a different threadId forces a fresh navigation, even if the caller asks to continue', () => {
      const liveFromQ1: NexusLiveThreadState = { authority: 'user_claude', threadId: 'q1', position: 2 };

      const decision = decideNexusThreadContinuation(
        { authority: 'user_claude', threadId: 'q2', continueThread: true },
        liveFromQ1,
      );

      expect(decision.continuing).toBe(false); // never reuses q1's live page for q2
      expect(decision.threadStatus).toBe('new');
      // the new state carries ONLY q2's identity, reset to position 1 -- nothing of q1 survives
      // in the tracked state (no merged fields, no carried position, no leftover authority).
      expect(decision.nextState).toEqual({ authority: 'user_claude', threadId: 'q2', position: 1 });
    });

    it('a different authority on the same threadId never continues (cross-authority leak guard)', () => {
      const liveFromClaude: NexusLiveThreadState = { authority: 'user_claude', threadId: 'q1', position: 3 };

      const decision = decideNexusThreadContinuation(
        { authority: 'user_gemini', threadId: 'q1', continueThread: true },
        liveFromClaude,
      );

      expect(decision.continuing).toBe(false);
      expect(decision.threadStatus).toBe('new');
      expect(decision.nextState).toEqual({ authority: 'user_gemini', threadId: 'q1', position: 1 });
    });

    it('continueThread:false on a genuinely new call always resets even with a live thread present', () => {
      const live: NexusLiveThreadState = { authority: 'user_claude', threadId: 'q1', position: 5 };
      const decision = decideNexusThreadContinuation(
        { authority: 'user_claude', threadId: 'q1', continueThread: false },
        live,
      );
      expect(decision.continuing).toBe(false);
      expect(decision.threadStatus).toBe('new');
    });

    it('no threadId at all is always untracked and always fresh (legacy-shaped caller)', () => {
      const live: NexusLiveThreadState = { authority: 'user_claude', threadId: 'q1', position: 2 };
      const decision = decideNexusThreadContinuation(
        { authority: 'user_claude', continueThread: true },
        live,
      );
      expect(decision.continuing).toBe(false);
      expect(decision.nextState).toBeNull();
      expect(decision.threadPosition).toBeNull();
    });
  });

  // VERIFY (c): the decision object is exactly what index.ts's PARSER INSTRUMENT log line and
  // the raw-extraction threadStatus/threadPosition fields are populated from -- asserting the
  // shape here proves the data a transcript reader needs is always present and correctly typed.
  it('always reports a closed threadStatus vocabulary and a position when tracked', () => {
    const d1 = decideNexusThreadContinuation({ authority: 'user_chatgpt', threadId: 'q9', continueThread: false }, null);
    expect(['new', 'continued']).toContain(d1.threadStatus);
    expect(typeof d1.threadPosition).toBe('number');
  });

  // VERIFY (d): google.com (and, per this codebase's static-URL driver, perplexity) stay
  // one-shot and are NEVER eligible to continue, regardless of what the caller passes.
  it('never threads user_google, even with a matching live-looking state and continueThread:true', () => {
    const decision = decideNexusThreadContinuation(
      { authority: 'user_google', threadId: 'q1', continueThread: true },
      // intentionally malformed/impossible state (google can never BE the live authority) to
      // prove the authority check short-circuits before any state comparison happens.
      { authority: 'user_google', threadId: 'q1', position: 4 },
    );
    expect(decision.continuing).toBe(false);
    expect(decision.nextState).toBeNull();
    expect(decision.threadStatus).toBe('new');
    expect(decision.threadPosition).toBeNull();
  });

  it('never threads user_perplexity (static driver in this codebase, not interactive)', () => {
    expect(isInteractiveBrowserAuthority('user_perplexity')).toBe(false);
    const decision = decideNexusThreadContinuation(
      { authority: 'user_perplexity', threadId: 'q1', continueThread: true },
      null,
    );
    expect(decision.continuing).toBe(false);
    expect(decision.nextState).toBeNull();
  });

  it('confirms the exact conversational set this build treats as threadable', () => {
    expect(isInteractiveBrowserAuthority('user_claude')).toBe(true);
    expect(isInteractiveBrowserAuthority('user_chatgpt')).toBe(true);
    expect(isInteractiveBrowserAuthority('user_gemini')).toBe(true);
    expect(isInteractiveBrowserAuthority('user_google')).toBe(false);
    expect(isInteractiveBrowserAuthority('user_perplexity')).toBe(false);
  });
});
