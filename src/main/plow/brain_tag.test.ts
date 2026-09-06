/**
 * D-BP221-BM0-012: PROVE THE FAR END for THE BRAIN TAG.
 *
 * The SEG that traced this change verified it by READING the code and explicitly listed "the WAN
 * wire path was verified by code reading, not a live round-trip" as what it could not determine.
 * This calls the REAL exported boundary function -- the one every plowTrace object is required to
 * pass through -- rather than re-implementing its behavior in the test.
 */
import { describe, it, expect } from 'vitest';
import { buildPlowTraceReceipt } from './plow_mc_answerer';

describe('the brain tag survives the plowTrace jig', () => {
  it('carries modelIdentity through untouched', () => {
    const r = buildPlowTraceReceipt({
      modelIdentity: 'gemma4:12b',
      letterSource: 'majority',
      ensembleOutcomeCorroboration: 'x',
    }) as Record<string, unknown>;
    expect(r.modelIdentity).toBe('gemma4:12b');
  });

  it('DISTINGUISHES the two gemmas -- a family name would be worthless', () => {
    const a = buildPlowTraceReceipt({ modelIdentity: 'gemma2:2b', letterSource: 'm', ensembleOutcomeCorroboration: 'x' }) as Record<string, unknown>;
    const b = buildPlowTraceReceipt({ modelIdentity: 'gemma4:12b', letterSource: 'm', ensembleOutcomeCorroboration: 'x' }) as Record<string, unknown>;
    expect(a.modelIdentity).not.toBe(b.modelIdentity);
  });

  it('does not invent a modelIdentity when none was supplied -- absent stays absent', () => {
    const r = buildPlowTraceReceipt({ letterSource: 'm', ensembleOutcomeCorroboration: 'x' }) as Record<string, unknown>;
    expect('modelIdentity' in r).toBe(false);
    expect(r.modelIdentity).toBeUndefined();
  });

  it('survives a JSON round trip, which is how it crosses the WAN wire', () => {
    // plowTrace crosses as ONE object inside answer_json.plow_trace, so a JSON round trip is the
    // real transport, not a stand-in for it.
    const built = buildPlowTraceReceipt({
      modelIdentity: 'gemma2:2b', letterSource: 'majority', ensembleOutcomeCorroboration: 'x',
    });
    const acrossTheWire = JSON.parse(JSON.stringify({ plow_trace: built })).plow_trace;
    expect(acrossTheWire.modelIdentity).toBe('gemma2:2b');
  });

  it('still records a jig violation for a genuinely missing required key', () => {
    const r = buildPlowTraceReceipt({ modelIdentity: 'gemma2:2b' }) as Record<string, unknown>;
    expect(r.letterSource).toBe('unset');
    expect(Array.isArray(r.jigViolations)).toBe(true);
    // the brain tag must not have masked the pre-existing guard
    expect((r.jigViolations as string[]).length).toBe(2);
  });
});

describe('D-BP221-BM04-003 finding 2: the crash path keeps the brain tag', () => {
  it('a crash receipt still says WHICH brain crashed', () => {
    // Mirrors the shape built at the catch site: error plus the model that was in scope.
    const r = buildPlowTraceReceipt({ error: 'boom', modelIdentity: 'gemma4:12b' }) as Record<string, unknown>;
    expect(r.modelIdentity).toBe('gemma4:12b');
    expect(r.error).toBe('boom');
  });

  it('a crash receipt still records the missing required keys as violations', () => {
    // The brain tag must not have masked the pre-existing guard on the crash path either.
    const r = buildPlowTraceReceipt({ error: 'boom', modelIdentity: 'gemma2:2b' }) as Record<string, unknown>;
    expect(r.letterSource).toBe('unset');
    expect((r.jigViolations as string[]).length).toBe(2);
  });
});
