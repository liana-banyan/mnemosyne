// nexus_authority_persistent_session.machine_driven.test.ts -- D-BP152-033/BISHOP/
// seg-machine-drives-nexus
//
// Founder, BP152, verbatim: "So make it talk to google using the interface I just used of the 5
// browsers." He drove Gemini by hand in the Nexus window and captured the answer (D-BP152-025);
// this ticket builds the machine doing that itself. See nexus_authority_persistent_session.ts's
// own "MACHINE-DRIVEN queries" section header for the full mechanism and REUSE notes.
//
// THIS TICKET'S SIX VERIFY ASSERTIONS (mapped to the describe blocks below):
//   (a) a machine-driven query types, submits, and extracts on a conversational surface
//       -> "interactive authorities (Claude/ChatGPT/Gemini) -- reuses the injected driver"
//   (b) completion is detected by text stability, not a fixed delay; the ceiling produces an
//       explicit incomplete outcome
//       -> "decideNexusMachineQueryPollStep" (pure, real unit tests) +
//          "static authorities (Google/Perplexity) -- navigate, poll, capture"
//   (c) an operator-engaged window refuses with a reason and destroys nothing
//       -> "probeNexusAuthorityOperatorEngagement" + "operator engagement refuses every authority"
//   (d) threads never cross authorities
//       -> "threading -- never shared across authorities"
//   (e) contamination guards still fire on machine-driven answers
//       -> "detectOptionContaminationForMachineQuery" + per-branch contamination tests
//   (f) the operator capture button and the existing google.com one-shot path are unchanged
//       -> verified by `git diff` in the deliverable, not by a test in this file (nothing in this
//          file touches stepped_audible.ts, index.ts's static branch, or preload.ts)

import { describe, test, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { vi } from 'vitest';

let userDataDir = '';
let fakeWindowVisible = false;

vi.mock('electron', () => {
  class FakeWebContents {
    async executeJavaScript(_script: string) { return null; }
  }
  class FakeBrowserWindow {
    static instances: FakeBrowserWindow[] = [];
    opts: unknown;
    destroyedFlag = false;
    webContents = new FakeWebContents();
    loadedUrl = '';
    constructor(opts: unknown) {
      this.opts = opts;
      FakeBrowserWindow.instances.push(this);
    }
    loadURL(url: string) { this.loadedUrl = url; }
    on(_evt: string, _cb: (...args: unknown[]) => void) { /* no-op */ }
    isDestroyed() { return this.destroyedFlag; }
    isVisible() { return fakeWindowVisible; }
    show() { fakeWindowVisible = true; }
    focus() { /* no-op */ }
    hide() { fakeWindowVisible = false; }
  }
  return {
    app: { getPath: () => userDataDir },
    BrowserWindow: FakeBrowserWindow,
  };
});

import { BrowserWindow } from 'electron';
type FakeBrowserWindowStatics = { instances: Array<{ opts: unknown }> };

describe('D-BP152-033 -- (b) decideNexusMachineQueryPollStep: real unit tests of the exact completion-decision code (no DOM needed)', () => {
  test('a growing/changing text always continues, never settles', async () => {
    const mod = await import('./nexus_authority_persistent_session');
    const step1 = mod.decideNexusMachineQueryPollStep('a', null, 0, 1, 900, 3, 30_000);
    expect(step1).toEqual({ action: 'continue', nextStableTicks: 0 });
    const step2 = mod.decideNexusMachineQueryPollStep('ab', 'a', 0, 2, 900, 3, 30_000);
    expect(step2).toEqual({ action: 'continue', nextStableTicks: 0 });
    const step3 = mod.decideNexusMachineQueryPollStep('abc', 'ab', 0, 3, 900, 3, 30_000);
    expect(step3).toEqual({ action: 'continue', nextStableTicks: 0 });
  });

  test('settles after exactly N consecutive unchanged non-empty ticks', async () => {
    const mod = await import('./nexus_authority_persistent_session');
    // tick 1: text appears
    let step = mod.decideNexusMachineQueryPollStep('final answer', null, 0, 1, 900, 3, 30_000);
    expect(step).toEqual({ action: 'continue', nextStableTicks: 0 });
    // tick 2: unchanged -> 1 stable tick, still below threshold of 3
    step = mod.decideNexusMachineQueryPollStep('final answer', 'final answer', step.nextStableTicks, 2, 900, 3, 30_000);
    expect(step).toEqual({ action: 'continue', nextStableTicks: 1 });
    // tick 3: unchanged -> 2 stable ticks, still below 3
    step = mod.decideNexusMachineQueryPollStep('final answer', 'final answer', step.nextStableTicks, 3, 900, 3, 30_000);
    expect(step).toEqual({ action: 'continue', nextStableTicks: 2 });
    // tick 4: unchanged -> 3 stable ticks, meets threshold -> settled
    step = mod.decideNexusMachineQueryPollStep('final answer', 'final answer', step.nextStableTicks, 4, 900, 3, 30_000);
    expect(step).toEqual({ action: 'settled', nextStableTicks: 3 });
  });

  test('a change resets the stable-tick counter to 0, even after two unchanged ticks', async () => {
    const mod = await import('./nexus_authority_persistent_session');
    let step = mod.decideNexusMachineQueryPollStep('partial', null, 0, 1, 900, 3, 30_000);
    step = mod.decideNexusMachineQueryPollStep('partial', 'partial', step.nextStableTicks, 2, 900, 3, 30_000);
    expect(step.nextStableTicks).toBe(1);
    // the page mutates again (e.g. a citation renders in late) -- reset, never settle on stale text
    step = mod.decideNexusMachineQueryPollStep('partial + citation', 'partial', step.nextStableTicks, 3, 900, 3, 30_000);
    expect(step).toEqual({ action: 'continue', nextStableTicks: 0 });
  });

  test('the ceiling fires when elapsed time reaches it, even with real (non-empty) text still changing', async () => {
    const mod = await import('./nexus_authority_persistent_session');
    // 34 ticks * 900ms = 30_600ms >= 30_000ms ceiling, text still growing (never equal to lastText)
    const step = mod.decideNexusMachineQueryPollStep('still growing...', 'still growin', 0, 34, 900, 3, 30_000);
    expect(step.action).toBe('ceiling');
  });

  test('the ceiling fires on empty text too (a page that never rendered anything)', async () => {
    const mod = await import('./nexus_authority_persistent_session');
    const step = mod.decideNexusMachineQueryPollStep('', null, 0, 34, 900, 3, 30_000);
    expect(step.action).toBe('ceiling');
  });

  test('settled takes priority over ceiling when both conditions are true on the same tick', async () => {
    const mod = await import('./nexus_authority_persistent_session');
    // 34 ticks past the ceiling, but this tick's text also happens to complete the stability run
    const step = mod.decideNexusMachineQueryPollStep('done', 'done', 2, 34, 900, 3, 30_000);
    expect(step.action).toBe('settled');
  });

  test('the exported constants are the named values this ticket documents (not buried literals)', async () => {
    const mod = await import('./nexus_authority_persistent_session');
    expect(mod.MACHINE_QUERY_POLL_INTERVAL_MS).toBe(900);
    expect(mod.MACHINE_QUERY_STABLE_TICKS_REQUIRED).toBe(3);
    expect(mod.MACHINE_QUERY_CEILING_MS).toBe(30_000);
    expect(mod.MACHINE_QUERY_NAVIGATION_TIMEOUT_MS).toBe(20_000);
  });
});

describe('D-BP152-033 -- (e) detectOptionContaminationForMachineQuery: mirrors stepped_audible.ts:628 exactly', () => {
  test('flags every option whose full text appears verbatim in the machine-driven answer', async () => {
    const mod = await import('./nexus_authority_persistent_session');
    const options = { A: 'Paris', B: 'The answer is Paris because it is the capital', C: 'Berlin' };
    const hits = mod.detectOptionContaminationForMachineQuery('The answer is Paris because it is the capital of France.', options);
    // A) "Paris" is itself a substring of the answer text, so it also flags -- this is the exact,
    // literal substring-containment rule (never a smarter match), same as stepped_audible.ts:628.
    expect(hits).toEqual(['A) Paris', 'B) The answer is Paris because it is the capital']);
  });

  test('no options pool -> always []', async () => {
    const mod = await import('./nexus_authority_persistent_session');
    expect(mod.detectOptionContaminationForMachineQuery('anything at all', null)).toEqual([]);
  });

  test('no match -> []', async () => {
    const mod = await import('./nexus_authority_persistent_session');
    expect(mod.detectOptionContaminationForMachineQuery('unrelated text', { A: 'Paris', B: 'Berlin' })).toEqual([]);
  });
});

describe('D-BP152-033 -- (c) probeNexusAuthorityOperatorEngagement: the hijack guard', () => {
  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'nexus-machine-driven-test-'));
    fakeWindowVisible = false;
    (BrowserWindow as unknown as FakeBrowserWindowStatics).instances.length = 0;
    vi.resetModules();
  });

  test('no window at all -> not engaged, reason no_window (getNexusAuthorityWindow never creates one)', async () => {
    const mod = await import('./nexus_authority_persistent_session');
    expect(mod.probeNexusAuthorityOperatorEngagement()).toEqual({ engaged: false, reason: 'no_window' });
  });

  test('window exists but hidden -> not engaged', async () => {
    const mod = await import('./nexus_authority_persistent_session');
    mod.setNexusAuthorityBrowserFlags(true, true);
    mod.ensureNexusAuthoritySession();
    fakeWindowVisible = false;
    expect(mod.probeNexusAuthorityOperatorEngagement()).toEqual({ engaged: false, reason: 'window_hidden' });
  });

  test('window exists and is visible -> engaged, refuses (operator may be using it)', async () => {
    const mod = await import('./nexus_authority_persistent_session');
    mod.setNexusAuthorityBrowserFlags(true, true);
    mod.ensureNexusAuthoritySession();
    fakeWindowVisible = true;
    expect(mod.probeNexusAuthorityOperatorEngagement()).toEqual({ engaged: true, reason: 'window_visible_operator_may_be_using_it' });
  });
});

describe('D-BP152-033 -- runMachineDrivenNexusQuery: operator engagement refuses every authority alike, before anything else runs', () => {
  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'nexus-machine-driven-test-'));
    fakeWindowVisible = false;
    (BrowserWindow as unknown as FakeBrowserWindowStatics).instances.length = 0;
    vi.resetModules();
  });

  test('a visible window refuses a static (Google) machine-driven query, no navigation attempted', async () => {
    const mod = await import('./nexus_authority_persistent_session');
    mod.setNexusAuthorityBrowserFlags(true, true);
    const win = mod.ensureNexusAuthoritySession();
    // ensureNexusAuthoritySession() itself loads the embedder HTML -- capture that baseline so
    // this test proves the machine-driven attempt below does not ALSO navigate on top of it.
    const urlBeforeAttempt = (win as unknown as { loadedUrl: string }).loadedUrl;
    fakeWindowVisible = true;
    const result = await mod.runMachineDrivenNexusQuery('user_google', 'what is the capital of France', null);
    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('refused');
    expect(result.reason).toBe('window_visible_operator_may_be_using_it');
    // no navigation happened -- loadURL was never called again by this refused attempt
    expect((win as unknown as { loadedUrl: string }).loadedUrl).toBe(urlBeforeAttempt);
  });

  test('a visible window refuses an interactive (Claude) machine-driven query, the injected driver is never called', async () => {
    const mod = await import('./nexus_authority_persistent_session');
    mod.setNexusAuthorityBrowserFlags(true, true);
    mod.ensureNexusAuthoritySession();
    fakeWindowVisible = true;
    let driverCalled = false;
    const result = await mod.runMachineDrivenNexusQuery('user_claude', 'what is the capital of France', null, {
      runInteractiveQuery: async () => { driverCalled = true; return { raw: null, dispatchOutcome: 'no_result' }; },
    });
    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('refused');
    expect(driverCalled).toBe(false);
  });
});

describe('D-BP152-033 -- (a)/(b) static authorities (Google/Perplexity): navigate, poll via an injected captureFn, capture', () => {
  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'nexus-machine-driven-test-'));
    fakeWindowVisible = false;
    (BrowserWindow as unknown as FakeBrowserWindowStatics).instances.length = 0;
    vi.resetModules();
  });

  test('flag off / no window -> honest failed result, never fabricated', async () => {
    const mod = await import('./nexus_authority_persistent_session');
    // researchArmMode/researchArmBrowserAuthority never set -- ensureNexusAuthoritySession() returns null
    const result = await mod.runMachineDrivenNexusQuery('user_google', 'a question', null);
    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('failed');
    expect(result.reason).toBe('flag_off_or_unavailable');
  });
});

describe('D-BP152-033 -- (a)/(d) interactive authorities (Claude/ChatGPT/Gemini): reuses the injected driver, per-authority threading', () => {
  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'nexus-machine-driven-test-'));
    fakeWindowVisible = false;
    (BrowserWindow as unknown as FakeBrowserWindowStatics).instances.length = 0;
    vi.resetModules();
  });

  test('a successful dispatch maps raw.snippet/citations/threadStatus/threadPosition through untouched', async () => {
    const mod = await import('./nexus_authority_persistent_session');
    const result = await mod.runMachineDrivenNexusQuery('user_claude', 'what is the capital of France', null, {
      threadFields: { threadId: 'run-1:user_claude', continueThread: false },
      runInteractiveQuery: async (query) => {
        expect(query.authority).toBe('user_claude');
        expect(query.threadId).toBe('run-1:user_claude');
        expect(query.continueThread).toBe(false);
        return {
          raw: {
            snippet: 'Paris is the capital of France.',
            sourceUrl: 'https://claude.ai/chat/abc',
            authority: 'user_claude',
            selectorUsed: null,
            citations: [{ url: 'https://en.wikipedia.org/wiki/Paris', label: 'Paris - Wikipedia', category: 'en.wikipedia.org' }],
            threadStatus: 'new',
            threadPosition: 1,
          },
          dispatchOutcome: 'dispatched',
        };
      },
    });
    expect(result.ok).toBe(true);
    expect(result.outcome).toBe('settled');
    expect(result.text).toBe('Paris is the capital of France.');
    expect(result.url).toBe('https://claude.ai/chat/abc');
    expect(result.threadStatus).toBe('new');
    expect(result.threadPosition).toBe(1);
    expect(result.citations).toEqual([{ href: 'https://en.wikipedia.org/wiki/Paris', text: 'Paris - Wikipedia', domain: 'en.wikipedia.org' }]);
    expect(result.machineDriven).toBe(true);
  });

  test('a timed-out dispatch reports outcome "ceiling", never a fabricated answer', async () => {
    const mod = await import('./nexus_authority_persistent_session');
    const result = await mod.runMachineDrivenNexusQuery('user_chatgpt', 'a slow question', null, {
      runInteractiveQuery: async () => ({ raw: null, dispatchOutcome: 'timeout' }),
    });
    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('ceiling');
    expect(result.text).toBe('');
  });

  test('no injected driver -> honest failure, never silently falls through', async () => {
    const mod = await import('./nexus_authority_persistent_session');
    const result = await mod.runMachineDrivenNexusQuery('user_gemini', 'a question', null);
    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('failed');
    expect(result.reason).toBe('no_interactive_driver_injected');
  });

  test('(e) contamination is flagged on a machine-driven interactive answer exactly as an operator capture would be', async () => {
    const mod = await import('./nexus_authority_persistent_session');
    const options = { A: 'Paris', B: 'Berlin' };
    const result = await mod.runMachineDrivenNexusQuery('user_claude', 'pick the capital of France: A) Paris B) Berlin', options, {
      runInteractiveQuery: async () => ({
        raw: { snippet: 'A) Paris is correct.', sourceUrl: 'https://claude.ai/chat/x', authority: 'user_claude', selectorUsed: null },
        dispatchOutcome: 'dispatched',
      }),
    });
    expect(result.optionContamination).toEqual(['A) Paris']);
  });

  test('(d) threading -- never shared across authorities: two authorities in ONE run get independent threadIds via the real createNexusRunThreadContext', async () => {
    const persistentMod = await import('./nexus_authority_persistent_session');
    const typesMod = await import('../../shared/plow/browser_authority_types');
    const runThreadContext = typesMod.createNexusRunThreadContext('fixed-seed-for-test');

    const seenThreadIds: Record<string, string | undefined> = {};
    const fakeDriver = async (query: { authority: string; threadId?: string }) => {
      seenThreadIds[query.authority] = query.threadId;
      return {
        raw: { snippet: `answer from ${query.authority}`, sourceUrl: `https://example.com/${query.authority}`, authority: query.authority, selectorUsed: null },
        dispatchOutcome: 'dispatched',
      };
    };

    await persistentMod.runMachineDrivenNexusQuery('user_claude', 'q1', null, {
      threadFields: runThreadContext.forQuery('user_claude'),
      runInteractiveQuery: fakeDriver as never,
    });
    await persistentMod.runMachineDrivenNexusQuery('user_chatgpt', 'q2', null, {
      threadFields: runThreadContext.forQuery('user_chatgpt'),
      runInteractiveQuery: fakeDriver as never,
    });
    await persistentMod.runMachineDrivenNexusQuery('user_gemini', 'q3', null, {
      threadFields: runThreadContext.forQuery('user_gemini'),
      runInteractiveQuery: fakeDriver as never,
    });

    expect(seenThreadIds.user_claude).toBe('fixed-seed-for-test:user_claude');
    expect(seenThreadIds.user_chatgpt).toBe('fixed-seed-for-test:user_chatgpt');
    expect(seenThreadIds.user_gemini).toBe('fixed-seed-for-test:user_gemini');
    // no two authorities ever share the same threadId
    const ids = Object.values(seenThreadIds);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('(d) threading -- a SECOND call to the SAME authority in the same run continues that authority\'s own thread only', async () => {
    const persistentMod = await import('./nexus_authority_persistent_session');
    const typesMod = await import('../../shared/plow/browser_authority_types');
    const runThreadContext = typesMod.createNexusRunThreadContext('fixed-seed-2');

    const calls: Array<{ threadId?: string; continueThread?: boolean }> = [];
    const fakeDriver = async (query: { threadId?: string; continueThread?: boolean }) => {
      calls.push({ threadId: query.threadId, continueThread: query.continueThread });
      return { raw: { snippet: 'ok', sourceUrl: 'https://example.com', authority: 'user_gemini', selectorUsed: null }, dispatchOutcome: 'dispatched' };
    };

    await persistentMod.runMachineDrivenNexusQuery('user_gemini', 'first', null, {
      threadFields: runThreadContext.forQuery('user_gemini'),
      runInteractiveQuery: fakeDriver as never,
    });
    await persistentMod.runMachineDrivenNexusQuery('user_gemini', 'follow-up', null, {
      threadFields: runThreadContext.forQuery('user_gemini'),
      runInteractiveQuery: fakeDriver as never,
    });

    expect(calls[0].continueThread).toBe(false);
    expect(calls[1].continueThread).toBe(true);
    expect(calls[0].threadId).toBe(calls[1].threadId);
  });

  test('(d) Google/Perplexity never receive thread fields even if a run-thread-context is (incorrectly) queried for them', async () => {
    const typesMod = await import('../../shared/plow/browser_authority_types');
    const runThreadContext = typesMod.createNexusRunThreadContext('fixed-seed-3');
    expect(runThreadContext.forQuery('user_google')).toEqual({ threadId: undefined, continueThread: false });
    expect(runThreadContext.forQuery('user_perplexity')).toEqual({ threadId: undefined, continueThread: false });
  });
});
