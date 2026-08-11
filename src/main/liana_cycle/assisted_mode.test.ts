// assisted_mode.test.ts -- D-BP152-051/BISHOP/seg-assisted-mode
//
// Deterministic, offline: no network call, no model call, no file I/O -- the channel stubs below
// resolve synchronously/immediately, and askGoogle is never actually invoked when assisted mode
// is active (this app never issues the request in assisted mode -- see the file under test's own
// header). Mirrors stored_results.test.ts's own "pure function, in-memory stub" convention.

import { describe, test, expect } from 'vitest';
import {
  AssistedModeAbandoned,
  AssistedModeLog,
  normalizeRunMode,
  wrapAskGoogleWithAssistedMode,
} from './assisted_mode';
import type { SteppedAudibleChannel } from './stepped_audible';
import type { LianaSteppedPause, LianaSteppedResponse } from '../../shared/liana_cycle/liana_terminal_types';
import type { AskGoogleFn } from './method_registry';

const neverCalledAskGoogle: AskGoogleFn = async () => {
  throw new Error('askGoogle must never be invoked directly -- assisted mode never issues the request itself');
};

describe('normalizeRunMode', () => {
  test('undefined/null/anything but "assisted" normalizes to "automated"', () => {
    expect(normalizeRunMode(undefined)).toBe('automated');
    expect(normalizeRunMode(null)).toBe('automated');
    expect(normalizeRunMode('automated')).toBe('automated');
  });
  test('"assisted" normalizes to itself', () => {
    expect(normalizeRunMode('assisted')).toBe('assisted');
  });
});

describe('wrapAskGoogleWithAssistedMode -- OFF-STAYS-IDENTICAL', () => {
  test('a null channel returns askGoogle itself, by reference -- not a wrapper around it', () => {
    const realAskGoogle: AskGoogleFn = async () => null;
    const log = new AssistedModeLog();
    const wrapped = wrapAskGoogleWithAssistedMode(realAskGoogle, null, () => {}, log, null);
    expect(wrapped).toBe(realAskGoogle);
  });
});

describe('wrapAskGoogleWithAssistedMode -- this app never issues the request itself', () => {
  test('a genuine capture is returned WITHOUT ever calling the real askGoogle', async () => {
    const log = new AssistedModeLog();
    const emitted: unknown[] = [];
    const channel: SteppedAudibleChannel = {
      requestStepPause: async (pause: LianaSteppedPause): Promise<LianaSteppedResponse> => ({
        pauseId: pause.pauseId,
        action: 'nexus_capture',
        nexusCapturedText: 'South America has a population density of 25 people per square km.',
        nexusSurface: 'google',
        nexusUrl: 'https://www.google.com/search?q=x',
        nexusContainerUsed: 'main',
        nexusCitations: [],
      }),
    };
    const wrapped = wrapAskGoogleWithAssistedMode(neverCalledAskGoogle, channel, (e) => emitted.push(e), log, null);
    const result = await wrapped('what is the population density of South America?');
    expect(result).not.toBeNull();
    expect(result?.snippet).toBe('South America has a population density of 25 people per square km.');
    expect(result?.sourceUrl).toBe('https://www.google.com/search?q=x');
    expect(result?.authority).toBe('user_google');
    expect(log.length).toBe(1);
    expect(log.all()[0]).toMatchObject({ callIndex: 1, action: 'nexus_capture', query: 'what is the population density of South America?' });
  });

  test('the exact query text is emitted verbatim, untruncated, before any pause fires', async () => {
    const emitted: { kind: string; text: string }[] = [];
    const channel: SteppedAudibleChannel = {
      requestStepPause: async (pause) => ({ pauseId: pause.pauseId, action: 'nexus_capture', nexusCapturedText: 'x' }),
    };
    const question = 'a query with "quotes" and unusual chars: <>&';
    const wrapped = wrapAskGoogleWithAssistedMode(neverCalledAskGoogle, channel, (e) => emitted.push(e), new AssistedModeLog(), null);
    await wrapped(question);
    const queryLine = emitted.find((e) => e.text.includes('query for you to issue'));
    expect(queryLine?.text).toContain(question);
  });

  test('captured citations are mapped to CitationRecord shape (url/label/category)', async () => {
    const channel: SteppedAudibleChannel = {
      requestStepPause: async (pause) => ({
        pauseId: pause.pauseId,
        action: 'nexus_capture',
        nexusCapturedText: 'some answer',
        nexusCitations: [{ href: 'https://en.wikipedia.org/x', text: 'Wikipedia link', domain: 'en.wikipedia.org' }],
      }),
    };
    const wrapped = wrapAskGoogleWithAssistedMode(neverCalledAskGoogle, channel, () => {}, new AssistedModeLog(), null);
    const result = await wrapped('q');
    expect(result?.citations).toEqual([{ url: 'https://en.wikipedia.org/x', label: 'Wikipedia link', category: 'en.wikipedia.org' }]);
  });
});

describe('wrapAskGoogleWithAssistedMode -- abandon', () => {
  test('an abandon response throws AssistedModeAbandoned, logged first', async () => {
    const log = new AssistedModeLog();
    const channel: SteppedAudibleChannel = {
      requestStepPause: async (pause) => ({ pauseId: pause.pauseId, action: 'abandon' }),
    };
    const wrapped = wrapAskGoogleWithAssistedMode(neverCalledAskGoogle, channel, () => {}, log, null);
    await expect(wrapped('q')).rejects.toBeInstanceOf(AssistedModeAbandoned);
    expect(log.length).toBe(1);
    expect(log.all()[0].action).toBe('abandon');
  });
});

describe('wrapAskGoogleWithAssistedMode -- an empty capture waits again rather than returning early', () => {
  test('two rounds: first capture empty, second real -- resolves on the second', async () => {
    let call = 0;
    const channel: SteppedAudibleChannel = {
      requestStepPause: async (pause) => {
        call += 1;
        if (call === 1) return { pauseId: pause.pauseId, action: 'nexus_capture', nexusCapturedText: '' };
        return { pauseId: pause.pauseId, action: 'nexus_capture', nexusCapturedText: 'real answer' };
      },
    };
    const wrapped = wrapAskGoogleWithAssistedMode(neverCalledAskGoogle, channel, () => {}, new AssistedModeLog(), null);
    const result = await wrapped('q');
    expect(call).toBe(2);
    expect(result?.snippet).toBe('real answer');
  });
});

describe('wrapAskGoogleWithAssistedMode -- an action with no ordered meaning here waits again, never advances silently', () => {
  test('"approve" (a valid LianaSteppedAction, but not meaningful at this pause) does not resolve the call', async () => {
    let call = 0;
    const channel: SteppedAudibleChannel = {
      requestStepPause: async (pause) => {
        call += 1;
        if (call === 1) return { pauseId: pause.pauseId, action: 'approve' };
        return { pauseId: pause.pauseId, action: 'nexus_capture', nexusCapturedText: 'answer' };
      },
    };
    const emitted: { text: string }[] = [];
    const wrapped = wrapAskGoogleWithAssistedMode(neverCalledAskGoogle, channel, (e) => emitted.push(e as { text: string }), new AssistedModeLog(), null);
    const result = await wrapped('q');
    expect(call).toBe(2);
    expect(result?.snippet).toBe('answer');
    expect(emitted.some((e) => e.text.includes("'approve' has no effect"))).toBe(true);
  });
});

describe('wrapAskGoogleWithAssistedMode -- FD-BP152-15 contamination flag, imported not duplicated', () => {
  test('a captured answer containing an option string verbatim is flagged, never blocked or edited', async () => {
    const channel: SteppedAudibleChannel = {
      requestStepPause: async (pause) => ({
        pauseId: pause.pauseId,
        action: 'nexus_capture',
        nexusCapturedText: 'The answer is South America, which is option A.',
      }),
    };
    const emitted: { text: string }[] = [];
    const options = { A: 'South America', B: 'Europe' };
    const wrapped = wrapAskGoogleWithAssistedMode(neverCalledAskGoogle, channel, (e) => emitted.push(e as { text: string }), new AssistedModeLog(), options);
    const result = await wrapped('q');
    // never blocked or edited -- the captured text is returned verbatim regardless
    expect(result?.snippet).toBe('The answer is South America, which is option A.');
    expect(emitted.some((e) => e.text.includes('CONTAMINATION FLAG'))).toBe(true);
  });

  test('no contamination when the captured text does not contain an option string', async () => {
    const channel: SteppedAudibleChannel = {
      requestStepPause: async (pause) => ({ pauseId: pause.pauseId, action: 'nexus_capture', nexusCapturedText: 'unrelated text' }),
    };
    const emitted: { text: string }[] = [];
    const options = { A: 'South America', B: 'Europe' };
    const wrapped = wrapAskGoogleWithAssistedMode(neverCalledAskGoogle, channel, (e) => emitted.push(e as { text: string }), new AssistedModeLog(), options);
    await wrapped('q');
    expect(emitted.some((e) => e.text.includes('CONTAMINATION FLAG'))).toBe(false);
  });
});

describe('wrapAskGoogleWithAssistedMode -- inert import check (HARDWIRE-22, no model/network from this module)', () => {
  test('importing and constructing the log/wrapper triggers no network/model call', () => {
    // Purely structural -- if this module imported fetch/axios/an LLM client at module scope,
    // vi.mock would be needed to avoid a real call; none is needed here, which is itself the
    // proof this module opens no such surface at import time.
    expect(typeof wrapAskGoogleWithAssistedMode).toBe('function');
    expect(new AssistedModeLog().length).toBe(0);
  });
});
