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
    // D-BP157-029/BISHOP/seg-rewire-vram-gate: the request below carries an explicit `model`
    // field, so resolveVramGatedPlowModel's wasExplicit=true branch never downgrades it -- this
    // fake detector reports ample VRAM purely so the gate's own execSync-based real detector is
    // never invoked in this offline suite (see peer_server.vram_gate.test.ts for the gate's own
    // dedicated coverage of insufficient/unknown VRAM).
    vi.doMock('../hardware/ram_detector', () => ({
      detectHardwareTier: () => ({ tier: 'ultra', ramGb: 64 }),
      getRecommendedModel: () => 'gemma4:12b',
      getCachedEffectiveModel: () => null,
      applyVramGate: (tierModel: string | null) => ({ model: tierModel }),
      requiredVramGb: () => 7.5,
      detectVramGbDetailed: () => ({ vramGb: 16, method: 'registry', confidence: 'measured' }),
    }));
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
    // D-BP157-029/BISHOP/seg-rewire-vram-gate: this mock now fully replaces '../hardware/
    // ram_detector' exports, so applyVramGate/requiredVramGb/detectVramGbDetailed (added to
    // peer_server.ts's import list by this dispatch) must be included here too, or they resolve
    // to undefined inside peer_server.ts and resolveVramGatedPlowModel throws. Ample VRAM +
    // "no smaller fallback known" (identity applyVramGate) keeps this test's own concern (the
    // fallback CHAIN, not VRAM-gating behavior) isolated -- gate behavior itself has its own
    // dedicated coverage in peer_server.vram_gate.test.ts.
    vi.doMock('../hardware/ram_detector', () => ({
      detectHardwareTier: () => ({ tier: 'core', ramGb: 16 }),
      getRecommendedModel: () => 'gemma4:12b',
      getCachedEffectiveModel: () => null,
      applyVramGate: (tierModel: string | null) => ({ model: tierModel }),
      requiredVramGb: () => null,
      detectVramGbDetailed: () => ({ vramGb: 16, method: 'registry', confidence: 'measured' }),
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
    // D-BP157-029/BISHOP/seg-rewire-vram-gate: same reasoning as the "once registered" test
    // above -- explicit model in the request, ample-VRAM fake detector keeps this offline.
    vi.doMock('../hardware/ram_detector', () => ({
      detectHardwareTier: () => ({ tier: 'ultra', ramGb: 64 }),
      getRecommendedModel: () => 'gemma4:12b',
      getCachedEffectiveModel: () => null,
      applyVramGate: (tierModel: string | null) => ({ model: tierModel }),
      requiredVramGb: () => 7.5,
      detectVramGbDetailed: () => ({ vramGb: 16, method: 'registry', confidence: 'measured' }),
    }));
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

// D-BP157-029/BISHOP/seg-rewire-vram-gate: direct unit coverage of resolveVramGatedPlowModel,
// the new VRAM-gate consultation this dispatch wires into handlePlowDomainRequestBody's model
// resolution (formerly `model ?? getEffectiveOllamaModel() ?? getRecommendedModel() ?? 'llama3.3:70b'`,
// which never consulted VRAM -- see SEG_RETURN_BP157_021_VRAM_GATE.md section 2, chain B). Tested
// directly against the exported pure function with an injected detector (3rd argument) so this
// suite never touches the real execSync-based detector -- fully offline, same convention as the
// HTTP-level tests above.
describe('resolveVramGatedPlowModel — VRAM gate consultation, D-BP157-029', () => {
  beforeEach(() => {
    vi.resetModules();
    // D-BP157-034/BISHOP/seg-fix-test-failures: the describe block above this one registers
    // `vi.doMock('../hardware/ram_detector', ...)` (identity applyVramGate, fixed requiredVramGb)
    // in several of its tests, most recently the "throwing hook" test. `vi.doMock` factories are
    // NOT cleared by `vi.resetModules()` -- resetModules only clears the module instance cache,
    // so the next dynamic import of '../hardware/ram_detector' still resolves through whatever
    // factory was last registered, even in a later, unrelated describe block in the same file.
    // Every test below calls resolveVramGatedPlowModel with its OWN injected `detector` argument
    // specifically so it exercises the REAL applyVramGate/requiredVramGb from ram_detector.ts --
    // proven by running any one of these tests in isolation (`vitest run ... -t "<name>"`), where
    // they pass; the leaked identity mock from the sibling describe block is what made them fail
    // when the whole file ran together. `vi.doUnmock` is the non-hoisted counterpart to
    // `vi.doMock` and undoes exactly that registration, restoring the real module for this block
    // without touching (or weakening) a single assertion below.
    vi.doUnmock('../hardware/ram_detector');
  });

  test('model fits -- unchanged, not downgraded, no note', async () => {
    const peerServer = await import('./peer_server');
    const out = peerServer.resolveVramGatedPlowModel(
      'gemma2:9b', false,
      () => ({ vramGb: 16, method: 'registry', confidence: 'measured' }),
    );
    expect(out.model).toBe('gemma2:9b');
    expect(out.downgraded).toBe(false);
    expect(out.note).toBeUndefined();
  });

  test('model does not fit -- stepped down, with an issue recorded', async () => {
    const peerServer = await import('./peer_server');
    const out = peerServer.resolveVramGatedPlowModel(
      'gemma4:12b', false,
      () => ({ vramGb: 3, method: 'registry', confidence: 'measured' }),
    );
    expect(out.model).not.toBe('gemma4:12b');
    expect(out.downgraded).toBe(true);
    expect(typeof out.note).toBe('string');
    expect(out.note!.length).toBeGreaterThan(0);
  });

  test('explicit /api/plow-domain "model" wins even when it does not fit, with an issue recorded', async () => {
    const peerServer = await import('./peer_server');
    const out = peerServer.resolveVramGatedPlowModel(
      'gemma4:12b', true,
      () => ({ vramGb: 3, method: 'registry', confidence: 'measured' }),
    );
    expect(out.model).toBe('gemma4:12b');
    expect(out.downgraded).toBe(false);
    expect(out.note).toMatch(/insufficient/);
  });

  test('VRAM unknown -- permitted through, recorded, never silently shrunk', async () => {
    const peerServer = await import('./peer_server');
    const out = peerServer.resolveVramGatedPlowModel(
      'gemma4:12b', false,
      () => ({ vramGb: null, method: 'none', confidence: 'unknown', note: 'No GPU adapter data available' }),
    );
    expect(out.model).toBe('gemma4:12b');
    expect(out.downgraded).toBe(false);
    expect(typeof out.note).toBe('string');
  });

  test('a capped ~4095 MiB CIM reading (cim-capped-rejected, vramGb: null) is never treated as a real 4 GB', async () => {
    const peerServer = await import('./peer_server');
    const out = peerServer.resolveVramGatedPlowModel(
      'gemma4:12b', false,
      () => ({
        vramGb: null,
        method: 'cim-capped-rejected',
        confidence: 'unknown',
        note: 'AdapterRAM reading sits at/above the Windows uint32 ~4 GiB ceiling -- reporting unknown rather than the capped, likely-wrong number',
      }),
    );
    expect(out.model).toBe('gemma4:12b');
    expect(out.vramGb).toBeNull();
    expect(out.vramMethod).toBe('cim-capped-rejected');
  });
});
