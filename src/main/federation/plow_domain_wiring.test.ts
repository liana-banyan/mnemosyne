// plow_domain_wiring.test.ts — D-BP156-M0-014, HARDWIRE-24 mesh (onPlowDomain revival).
//
// OFFLINE, MOCKED. Proves two things:
//   1. registerPlowDomainMeshHook() actually calls peer_server.ts's registerPeerServerHooks
//      with an onPlowDomain hook -- this is the test the ticket required ("if you revive it,
//      prove registration with a test that fails when the wiring is removed"): delete the
//      registerPeerServerHooks({ onPlowDomain: ... }) call inside registerPlowDomainMeshHook()
//      and the first test below fails.
//   2. handlePlowDomainRequest() (the real hook implementation) drives runCanonicalPlow/
//      writeVerifiedEblet (mocked here) with the right config shape and aggregates the result
//      the same way mic_ipc.ts's proven runSelfDomain() closure already does.
//
// canonical_pipeline/mnem_eblet_store are imported DYNAMICALLY inside handlePlowDomainRequest
// (lazy import, matching mic_ipc.ts's own runSelfDomain convention), so vi.doMock can target
// them without needing vi.resetModules() gymnastics for that part -- resetModules is still used
// so registerPlowDomainMeshHook()'s internal `_registered` idempotency flag starts fresh per test.
//
// Run: npx vitest run src/main/federation/plow_domain_wiring.test.ts

import { describe, test, expect, vi, beforeEach } from 'vitest';

describe('registerPlowDomainMeshHook — proves the wiring registration itself', () => {
  beforeEach(() => { vi.resetModules(); });

  test('calls registerPeerServerHooks with a real onPlowDomain function', async () => {
    const registerSpy = vi.fn();
    vi.doMock('./peer_server', () => ({ registerPeerServerHooks: registerSpy }));

    const { registerPlowDomainMeshHook } = await import('./plow_domain_wiring');
    registerPlowDomainMeshHook();

    expect(registerSpy).toHaveBeenCalledTimes(1);
    const hooks = registerSpy.mock.calls[0]?.[0] as { onPlowDomain?: unknown };
    expect(typeof hooks.onPlowDomain).toBe('function');
  });

  test('is idempotent -- calling twice registers only once, matching bishop_dispatch_wiring.ts convention', async () => {
    const registerSpy = vi.fn();
    vi.doMock('./peer_server', () => ({ registerPeerServerHooks: registerSpy }));

    const { registerPlowDomainMeshHook } = await import('./plow_domain_wiring');
    registerPlowDomainMeshHook();
    registerPlowDomainMeshHook();

    expect(registerSpy).toHaveBeenCalledTimes(1);
  });
});

describe('handlePlowDomainRequest — the real implementation behind the hook', () => {
  beforeEach(() => { vi.resetModules(); });

  test('runs runCanonicalPlow for exactly the requested domain, using the caller-supplied questions verbatim, and aggregates the result', async () => {
    const runCanonicalPlowMock = vi.fn(async (
      config: { domains: string[]; questionsPerDomain: number; ollamaBaseUrl?: string; model?: string },
      writeEbletFn: (eblet: unknown) => Promise<void>,
      onProgress: (evt: { type: string; ebletsWrittenThisQuestion?: number }) => void,
      _cancelToken: { cancelled: boolean },
      sampleQuestionsForDomain: (domain: string, n: number) => string[],
    ) => {
      // Exercise the sampler exactly like the real pipeline would.
      const qs = sampleQuestionsForDomain(config.domains[0] as string, config.questionsPerDomain);
      expect(qs).toEqual(['q1', 'q2']);
      onProgress({ type: 'scribe-done', ebletsWrittenThisQuestion: 2 });
      onProgress({ type: 'andon-trigger' });
      await writeEbletFn({ question: 'q1', answer: 'a1', provenance: 'p', verified: true, sha256: 'x', timestamp: 1 });
      return {
        config, startedAt: 0, completedAt: 1,
        domainResults: [{
          domain: config.domains[0], questionResults: [], totalEbletsWritten: 2, avgBmvScore: 0,
          verifiedCount: 1, quarantinedCount: 0, pendingHumanCount: 0, andonEvents: 1, status: 'GREEN',
        }],
        totalEbletsWritten: 2, totalQuarantined: 0, overallStatus: 'GREEN',
      };
    });
    const writeVerifiedEbletMock = vi.fn(async () => 'sha-abc');
    vi.doMock('../plow/canonical_pipeline', () => ({ runCanonicalPlow: runCanonicalPlowMock }));
    vi.doMock('../mnem_eblet_store', () => ({ writeVerifiedEblet: writeVerifiedEbletMock }));

    const { handlePlowDomainRequest } = await import('./plow_domain_wiring');
    const result = await handlePlowDomainRequest('chemistry', ['q1', 'q2'], 'http://127.0.0.1:11434', 'gemma4:12b');

    expect(runCanonicalPlowMock).toHaveBeenCalledTimes(1);
    const config = runCanonicalPlowMock.mock.calls[0]?.[0] as { domains: string[]; questionsPerDomain: number; ollamaBaseUrl?: string; model?: string };
    expect(config).toMatchObject({ domains: ['chemistry'], questionsPerDomain: 2, ollamaBaseUrl: 'http://127.0.0.1:11434', model: 'gemma4:12b' });
    expect(writeVerifiedEbletMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ebletsWritten: 2, quarantined: 0, andonEvents: 1, status: 'GREEN' });
  });

  test('falls back to running progress-event totals when domainResults[0] is absent (defensive)', async () => {
    const runCanonicalPlowMock = vi.fn(async (
      _config: unknown,
      _writeEbletFn: (eblet: unknown) => Promise<void>,
      onProgress: (evt: { type: string; ebletsWrittenThisQuestion?: number }) => void,
    ) => {
      onProgress({ type: 'scribe-done', ebletsWrittenThisQuestion: 1 });
      return { config: {}, startedAt: 0, completedAt: 1, domainResults: [], totalEbletsWritten: 0, totalQuarantined: 0, overallStatus: 'YELLOW' };
    });
    vi.doMock('../plow/canonical_pipeline', () => ({ runCanonicalPlow: runCanonicalPlowMock }));
    vi.doMock('../mnem_eblet_store', () => ({ writeVerifiedEblet: vi.fn(async () => 'x') }));

    const { handlePlowDomainRequest } = await import('./plow_domain_wiring');
    const result = await handlePlowDomainRequest('physics', ['q1'], 'http://127.0.0.1:11434', 'gemma4:12b');

    expect(result).toEqual({ ebletsWritten: 1, quarantined: 0, andonEvents: 0, status: 'YELLOW' });
  });

  test('an empty questions array never crashes -- runCanonicalPlow skips a domain with no questions, hook returns the (empty) aggregate', async () => {
    const runCanonicalPlowMock = vi.fn(async () => ({
      config: {}, startedAt: 0, completedAt: 1, domainResults: [], totalEbletsWritten: 0, totalQuarantined: 0, overallStatus: 'YELLOW',
    }));
    vi.doMock('../plow/canonical_pipeline', () => ({ runCanonicalPlow: runCanonicalPlowMock }));
    vi.doMock('../mnem_eblet_store', () => ({ writeVerifiedEblet: vi.fn(async () => 'x') }));

    const { handlePlowDomainRequest } = await import('./plow_domain_wiring');
    const result = await handlePlowDomainRequest('chemistry', [], 'http://127.0.0.1:11434', 'gemma4:12b');

    expect(result).toEqual({ ebletsWritten: 0, quarantined: 0, andonEvents: 0, status: 'YELLOW' });
  });
});
