/**
 * D-BP221-BM0-005: PROVE THE FAR END. The gate is only real if the browser bridge is NEVER TOUCHED.
 *
 * A browser lookup against an unburned benchmark item burns it for measurement forever. Asserting
 * that the function "returns null" is not enough -- it could return null AFTER dispatching. These
 * tests fail if the bridge is called even once.
 */
import { describe, it, expect } from 'vitest';
import {
  runBrowserAuthorityLookup,
  runBrowserAuthorityLookupObserved,
  type BrowserAuthorityAdapterConfig,
} from './browser_authority_adapter';

function spyBridge() {
  const calls: string[] = [];
  return {
    calls,
    bridge: {
      runQueryInUserBrowser: async () => { calls.push('runQueryInUserBrowser'); return null; },
      runQueryInUserBrowserObserved: async () => {
        calls.push('runQueryInUserBrowserObserved');
        return { raw: null, dispatchOutcome: 'no_result' as const };
      },
    },
  };
}

const ENABLED: BrowserAuthorityAdapterConfig = {
  researchArmMode: true,
  researchArmBrowserAuthority: true,
};

describe('the hard admission gate at the chokepoint', () => {
  it('REFUSES an MMLU-Pro lookup and never touches the bridge', async () => {
    const s = spyBridge();
    const r = await runBrowserAuthorityLookup('what is the answer', { ...ENABLED, benchmarkCorpusId: 'MMLU-Pro' }, s.bridge as never);
    expect(r).toBeNull();
    expect(s.calls).toEqual([]);            // THE ASSERTION THAT MATTERS
  });

  it('REFUSES on the observed path too, reporting disabled rather than no_result', async () => {
    const s = spyBridge();
    const o = await runBrowserAuthorityLookupObserved('what is the answer', { ...ENABLED, benchmarkCorpusId: 'MMLU-Pro' }, s.bridge as never);
    expect(o.result).toBeNull();
    expect(o.dispatchOutcome).toBe('disabled');
    expect(s.calls).toEqual([]);            // never dispatched, so never "no_result"
  });

  it('PERMITS when no corpus id is supplied -- the declared fail-open -- and DOES reach the bridge', async () => {
    const s = spyBridge();
    await runBrowserAuthorityLookup('an ordinary question', ENABLED, s.bridge as never);
    expect(s.calls.length).toBeGreaterThan(0);
  });

  it('PERMITS a non-benchmark corpus id and reaches the bridge', async () => {
    const s = spyBridge();
    await runBrowserAuthorityLookup('an ordinary question', { ...ENABLED, benchmarkCorpusId: 'some-private-corpus' }, s.bridge as never);
    expect(s.calls.length).toBeGreaterThan(0);
  });
});

describe('the gate cannot be opened by spelling, and covers all four legs', () => {
  const variants = ['MMLU-Pro', 'mmlu-pro', 'MMLU_Pro', 'mmlu pro', '  MMLU-Pro  ', 'MMLU-PRO'];
  for (const v of variants) {
    it(`REFUSES the variant ${JSON.stringify(v)} and never touches the bridge`, async () => {
      const s = spyBridge();
      const r = await runBrowserAuthorityLookup('q', { ...ENABLED, benchmarkCorpusId: v }, s.bridge as never);
      expect(r).toBeNull();
      expect(s.calls).toEqual([]);
    });
  }
  for (const leg of ['ASDiv', 'GSM8K', 'OlympiadBench', 'asdiv', 'gsm8k', 'olympiadbench']) {
    it(`REFUSES the Big Kahuna leg ${leg}`, async () => {
      const s = spyBridge();
      await runBrowserAuthorityLookup('q', { ...ENABLED, benchmarkCorpusId: leg }, s.bridge as never);
      expect(s.calls).toEqual([]);
    });
  }
  it('does NOT over-refuse an unrelated corpus that merely shares a word', async () => {
    const s = spyBridge();
    await runBrowserAuthorityLookup('q', { ...ENABLED, benchmarkCorpusId: 'my-private-mmlu-pro-notes' }, s.bridge as never);
    expect(s.calls.length).toBeGreaterThan(0);
  });
});
