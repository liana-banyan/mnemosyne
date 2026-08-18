// peer_server.plow_domain.test.ts — D-BP156-M0-014, HARDWIRE-24 mesh (onPlowDomain revival).
//
// OFFLINE. Proves handlePlowDomainRequestBody() (peer_server.ts): 503 with no onPlowDomain hook
// registered (the exact dead-code symptom this dispatch fixed -- every real /api/plow-domain
// caller, federated_andon.ts and mic_dispatcher.ts, got this before D-BP156-M0-014), 200 with
// the hook's result once registered, correct default ollamaBaseUrl/model substitution, and that
// resolvePlowDomainRequest's own auth/parse refusals still short-circuit before the hook is ever
// called. Mirrors peer_server.bishop_dispatch.test.ts's import/registerPeerServerHooks
// convention for the sibling onBishopDispatch hook.
//
// Run: npx vitest run src/main/federation/peer_server.plow_domain.test.ts

import { describe, test, expect, vi, beforeEach } from 'vitest';

describe('handlePlowDomainRequestBody — onPlowDomain hook revival', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test('returns 503 "not registered" when no onPlowDomain hook is registered -- the exact symptom every real LAN caller saw before this dispatch', async () => {
    const peerServer = await import('./peer_server');
    const { status, body } = await peerServer.handlePlowDomainRequestBody(
      JSON.stringify({ domain: 'chemistry', questions: ['q1'] }),
    );
    expect(status).toBe(503);
    expect(body).toMatchObject({ error: 'Plow domain handler not registered' });
  });

  test('a legacy unsigned request is refused (403) BEFORE the hook is invoked when unauthenticated LAN is disabled (default)', async () => {
    // Forced explicitly rather than relying on the host machine's real persisted setting
    // (mesh_trust_settings.ts reads a real file under %APPDATA% when present) -- this test must
    // be deterministic regardless of what any prior manual run of the app left on disk.
    vi.doMock('./mesh_trust_settings', () => ({ isUnauthenticatedLanDiscoveryAllowed: () => false }));
    const peerServer = await import('./peer_server');
    const hook = vi.fn(async () => ({ ebletsWritten: 0, quarantined: 0, andonEvents: 0, status: 'GREEN' }));
    peerServer.registerPeerServerHooks({ onPlowDomain: hook });

    const { status, body } = await peerServer.handlePlowDomainRequestBody(
      JSON.stringify({ domain: 'chemistry', questions: ['q1'] }),
    );

    expect(status).toBe(403);
    expect(body).toMatchObject({ error: expect.stringMatching(/refused/) });
    expect(hook).not.toHaveBeenCalled();
  });

  test('malformed JSON body is refused (400), hook never invoked', async () => {
    const peerServer = await import('./peer_server');
    const hook = vi.fn(async () => ({ ebletsWritten: 0, quarantined: 0, andonEvents: 0, status: 'GREEN' }));
    peerServer.registerPeerServerHooks({ onPlowDomain: hook });

    const { status } = await peerServer.handlePlowDomainRequestBody('not even json');

    expect(status).toBe(400);
    expect(hook).not.toHaveBeenCalled();
  });

  test('once registered, a request that clears authentication reaches the hook and returns its result as 200', async () => {
    vi.doMock('./mesh_trust_settings', () => ({ isUnauthenticatedLanDiscoveryAllowed: () => true }));
    const peerServer = await import('./peer_server');
    const hookResult = { ebletsWritten: 3, quarantined: 1, andonEvents: 0, status: 'GREEN' };
    const receivedArgs: unknown[] = [];
    const hook = vi.fn(async (...args: unknown[]) => {
      receivedArgs.push(...args);
      return hookResult;
    });
    peerServer.registerPeerServerHooks({ onPlowDomain: hook });

    const { status, body } = await peerServer.handlePlowDomainRequestBody(
      JSON.stringify({ domain: 'chemistry', questions: ['q1', 'q2'], ollamaBaseUrl: 'http://127.0.0.1:11434', model: 'gemma4:12b' }),
    );

    expect(status).toBe(200);
    expect(body).toEqual(hookResult);
    expect(hook).toHaveBeenCalledTimes(1);
    expect(receivedArgs).toEqual(['chemistry', ['q1', 'q2'], 'http://127.0.0.1:11434', 'gemma4:12b']);
  });

  test('missing ollamaBaseUrl/model fall back to the documented defaults', async () => {
    vi.doMock('./mesh_trust_settings', () => ({ isUnauthenticatedLanDiscoveryAllowed: () => true }));
    // getEffectiveOllamaModel() (peer_server.ts, module-private) falls through to
    // brain_registry.ts/ram_detector.ts when model is omitted, and both touch
    // electron's app.getPath('userData') -- undefined outside a real Electron main process
    // (same fact peer_server.bishop_dispatch.test.ts's header notes for ed25519_keypair.ts).
    // Mocked here purely so this test can observe the fallback CHAIN completes and produces
    // some string, without asserting on hardware-dependent model-selection logic that belongs
    // to those modules' own tests, not this one.
    vi.doMock('../brain_registry/brain_registry', () => ({ getActiveBrain: () => undefined, hasPersistedBrainChoice: () => false }));
    vi.doMock('../hardware/ram_detector', () => ({
      detectHardwareTier: () => ({ tier: 'core', ramGb: 16 }),
      getRecommendedModel: () => 'gemma4:12b',
      getCachedEffectiveModel: () => null,
    }));
    const peerServer = await import('./peer_server');
    const receivedArgs: unknown[] = [];
    const hook = vi.fn(async (...args: unknown[]) => {
      receivedArgs.push(...args);
      return { ebletsWritten: 0, quarantined: 0, andonEvents: 0, status: 'YELLOW' };
    });
    peerServer.registerPeerServerHooks({ onPlowDomain: hook });

    const { status } = await peerServer.handlePlowDomainRequestBody(JSON.stringify({ domain: 'physics', questions: [] }));

    expect(status).toBe(200);
    expect(hook).toHaveBeenCalledTimes(1);
    // arg[2] is ollamaBaseUrl -- must default, never be undefined, matching the pre-existing
    // inline behavior this function was extracted from verbatim.
    expect(receivedArgs[2]).toBe('http://127.0.0.1:11434');
    expect(typeof receivedArgs[3]).toBe('string');
    expect(receivedArgs[3]).not.toBe('');
  });

  test('a throwing hook is caught and reported as 500, never crashes', async () => {
    vi.doMock('./mesh_trust_settings', () => ({ isUnauthenticatedLanDiscoveryAllowed: () => true }));
    const peerServer = await import('./peer_server');
    const hook = vi.fn(async () => { throw new Error('boom'); });
    peerServer.registerPeerServerHooks({ onPlowDomain: hook });

    // model/ollamaBaseUrl supplied explicitly so this test isolates "the hook itself throws,"
    // never touching the model-fallback chain (see the dedicated defaults test above for that).
    const { status, body } = await peerServer.handlePlowDomainRequestBody(
      JSON.stringify({ domain: 'chemistry', questions: ['q1'], ollamaBaseUrl: 'http://127.0.0.1:11434', model: 'gemma4:12b' }),
    );

    expect(status).toBe(500);
    expect(body).toMatchObject({ error: expect.stringContaining('boom') });
  });
});
