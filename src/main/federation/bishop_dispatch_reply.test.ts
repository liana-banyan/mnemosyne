// bishop_dispatch_reply.test.ts — D-BP156-M0-014, HARDWIRE-24 mesh.
//
// OFFLINE, MOCKED. No real network call, no real Supabase. fetch and the poll-loop's sleep are
// both injected, matching this repo's existing convention (bishop_dispatch_relay_listener.test.ts's
// FetchLike injection). Proves: the write side POSTs the right shape to relay_route_replies using
// only anon-key-style headers; the read side finds a matching reply, ignores a non-matching one,
// and times out cleanly; and the pure isBishopDispatchReply predicate.
//
// D-BP157-030: 'electron' is now mocked too (vi.mock('electron', ...), matching
// bishop_dispatch_send_ipc.test.ts's existing convention for a file that imports `app`) so the
// new responderVersion/responderBuildKind fields and the VERSION_SKEW annotation can be tested
// deterministically instead of relying on the unmocked-electron fallback (which always yields
// `undefined` -- see bishop_dispatch_reply.ts's own getResponderVersionInfo() doc comment).
//
// Run: npx vitest run src/main/federation/bishop_dispatch_reply.test.ts

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.mock factories are hoisted above imports/consts, so the mock object it closes over must be
// created via vi.hoisted() (bishop_dispatch_send_ipc.test.ts's own documented reason).
const mockApp = vi.hoisted(() => ({
  getVersion: vi.fn(() => '0.9.25'),
  isPackaged: true,
}));

vi.mock('electron', () => ({ app: mockApp }));
// D-BP223-X043-010-RB: the reply path now reads/writes through the Phase A RPCs; the sender's peer id
// comes from getStablePeerId() when not passed, pinned here so no real identity is touched.
vi.mock('./peer-discovery', () => ({ getStablePeerId: () => 'p'.repeat(16) }));

import {
  writeBishopDispatchReply,
  writeBishopDispatchCompletionReply,
  pollForBishopDispatchReply,
  isBishopDispatchReply,
  type FetchLike,
} from './bishop_dispatch_reply';
import type { BishopDispatchResult } from './peer_server';
import { installTestOwnerSecret, wrapLegacyFetch } from './relay_rpc_legacy_test_shim';

installTestOwnerSecret();
/** Replays each Phase A RPC to the suite's legacy-shaped fake (see relay_rpc_legacy_test_shim.ts). */
const shim = (f: FetchLike): FetchLike => wrapLegacyFetch(f as unknown as Parameters<typeof wrapLegacyFetch>[0]) as unknown as FetchLike;

const SUPABASE_URL = 'https://example.supabase.co';
const ANON_KEY = 'anon-key-test';
const ROUTE_ID = 'route-abc-123';
const PEER_ID = 'peer-def-456';

// getResponderVersionInfo()'s buildKind reads process.env.NODE_ENV directly, so it is pinned to
// a known, definitely-not-'development' value for every test in this file (saved/restored, never
// left mutated for other test files that may run in the same process) rather than trusting
// whatever the ambient test-runner value happens to be.
let savedNodeEnv: string | undefined;
beforeEach(() => {
  mockApp.getVersion.mockReturnValue('0.9.25');
  mockApp.isPackaged = true;
  savedNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'bishop-test-fixed';
});
afterEach(() => {
  process.env.NODE_ENV = savedNodeEnv;
});

describe('isBishopDispatchReply', () => {
  test('true for a bishop_dispatch_reply-shaped answer_json', () => {
    expect(isBishopDispatchReply({ kind: 'bishop_dispatch_reply', ok: true, spawned: false, reason: 'x' })).toBe(true);
  });
  test('false for an ordinary MC-question answer_json (no kind field)', () => {
    expect(isBishopDispatchReply({ answer: 'D', answered_by: 'plow' })).toBe(false);
  });
  test('false for null/undefined', () => {
    expect(isBishopDispatchReply(null)).toBe(false);
    expect(isBishopDispatchReply(undefined)).toBe(false);
  });
  test('false for a different kind value', () => {
    expect(isBishopDispatchReply({ kind: 'eblet_topical' })).toBe(false);
  });
});

describe('writeBishopDispatchReply', () => {
  function makeFetchMock(status: number): { fetchImpl: FetchLike; calls: Array<{ url: string; init: RequestInit }> } {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init: init ?? {} });
      return new Response(status < 300 ? null : JSON.stringify({ error: 'nope' }), { status });
    }) as unknown as FetchLike;
    return { fetchImpl, calls };
  }

  test('POSTs to relay_route_replies with route_id/peer_id/answer_json/processing_ms, using only anon-key headers', async () => {
    const { fetchImpl, calls } = makeFetchMock(201);
    const result: BishopDispatchResult = { ok: true, lifecycle: 'begun', issues: [], spawned: true, reason: 'spawned' };

    const ok = await writeBishopDispatchReply({ supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY, fetchImpl: shim(fetchImpl) }, ROUTE_ID, PEER_ID, result, 4321);

    expect(ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`${SUPABASE_URL}/rest/v1/relay_route_replies`);
    expect(calls[0]?.init.method).toBe('POST');
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers.apikey).toBe(ANON_KEY);
    expect(headers.Authorization).toBe(`Bearer ${ANON_KEY}`);
    // Never a service-role-shaped header anywhere on this request.
    expect(Object.keys(headers).some((k) => /service.?role/i.test(k))).toBe(false);
    const body = JSON.parse(calls[0]?.init.body as string);
    expect(body).toEqual({
      route_id: ROUTE_ID,
      peer_id: PEER_ID,
      answer_json: {
        kind: 'bishop_dispatch_reply', stage: 'launch', ok: true, lifecycle: 'begun', issues: [], spawned: true, reason: 'spawned',
        // D-BP157-030: derived from the mocked app.getVersion()/app.isPackaged, not hardcoded
        // in bishop_dispatch_reply.ts itself -- see getResponderVersionInfo().
        responderVersion: '0.9.25', responderBuildKind: 'installed',
      },
      processing_ms: 4321,
    });
  });

  test('D-BP157-030: responderVersion/responderBuildKind reflect app.getVersion()/isPackaged, and buildKind is "dev" when unpackaged', async () => {
    mockApp.getVersion.mockReturnValue('0.9.23');
    mockApp.isPackaged = false;
    const { fetchImpl, calls } = makeFetchMock(201);
    const result: BishopDispatchResult = { ok: true, lifecycle: 'begun', issues: [], spawned: true, reason: 'spawned' };

    await writeBishopDispatchReply({ supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY, fetchImpl: shim(fetchImpl) }, ROUTE_ID, PEER_ID, result, 1);

    const body = JSON.parse(calls[0]?.init.body as string);
    expect(body.answer_json.responderVersion).toBe('0.9.23');
    expect(body.answer_json.responderBuildKind).toBe('dev');
  });

  test('D-BP157-030: omits responderVersion/responderBuildKind entirely (never a fabricated value) when app.getVersion() throws', async () => {
    mockApp.getVersion.mockImplementation(() => { throw new Error('app not ready'); });
    const { fetchImpl, calls } = makeFetchMock(201);
    const result: BishopDispatchResult = { ok: true, lifecycle: 'begun', issues: [], spawned: true, reason: 'spawned' };

    await writeBishopDispatchReply({ supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY, fetchImpl: shim(fetchImpl) }, ROUTE_ID, PEER_ID, result, 1);

    const body = JSON.parse(calls[0]?.init.body as string);
    expect('responderVersion' in body.answer_json).toBe(false);
    expect('responderBuildKind' in body.answer_json).toBe(false);
  });

  test('includes noticePath in answer_json only when the result carries one', async () => {
    const { fetchImpl, calls } = makeFetchMock(201);
    const result: BishopDispatchResult = { ok: true, lifecycle: 'refused', issues: [], spawned: false, reason: 'file-write-only', noticePath: 'C:\\notices\\n1.json' };

    await writeBishopDispatchReply({ supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY, fetchImpl: shim(fetchImpl) }, ROUTE_ID, PEER_ID, result, 10);

    const body = JSON.parse(calls[0]?.init.body as string);
    expect(body.answer_json.noticePath).toBe('C:\\notices\\n1.json');
  });

  test('a non-2xx response is reported as failure (false), never throws', async () => {
    const { fetchImpl } = makeFetchMock(500);
    const result: BishopDispatchResult = { ok: true, lifecycle: 'begun', issues: [], spawned: true, reason: 'spawned' };

    await expect(
      writeBishopDispatchReply({ supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY, fetchImpl: shim(fetchImpl) }, ROUTE_ID, PEER_ID, result, 10),
    ).resolves.toBe(false);
  });

  test('a network error is caught and reported as failure (false), never throws', async () => {
    const fetchImpl = (async () => { throw new Error('ECONNREFUSED'); }) as unknown as FetchLike;
    const result: BishopDispatchResult = { ok: true, lifecycle: 'begun', issues: [], spawned: true, reason: 'spawned' };

    await expect(
      writeBishopDispatchReply({ supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY, fetchImpl: shim(fetchImpl) }, ROUTE_ID, PEER_ID, result, 10),
    ).resolves.toBe(false);
  });
});

describe('writeBishopDispatchCompletionReply', () => {
  function makeFetchMock(status: number): { fetchImpl: FetchLike; calls: Array<{ url: string; init: RequestInit }> } {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init: init ?? {} });
      return new Response(status < 300 ? null : JSON.stringify({ error: 'nope' }), { status });
    }) as unknown as FetchLike;
    return { fetchImpl, calls };
  }

  test('D-BP157-030: the stage-2/completion row also carries responderVersion/responderBuildKind', async () => {
    mockApp.getVersion.mockReturnValue('0.9.25');
    mockApp.isPackaged = true;
    const { fetchImpl, calls } = makeFetchMock(201);

    await writeBishopDispatchCompletionReply(
      { supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY, fetchImpl: shim(fetchImpl) },
      ROUTE_ID,
      PEER_ID,
      { effectiveId: 'D-BP157-030-W1', lifecycle: 'completed', issues: [], workerLogPointer: 'C:\\log.txt', tailExcerpt: 'done' },
      50,
    );

    const body = JSON.parse(calls[0]?.init.body as string);
    expect(body.answer_json.stage).toBe('completion');
    expect(body.answer_json.responderVersion).toBe('0.9.25');
    expect(body.answer_json.responderBuildKind).toBe('installed');
  });
});

describe('pollForBishopDispatchReply', () => {
  const instantSleep = (_ms: number) => Promise.resolve();

  test('finds a matching bishop_dispatch_reply row on the first poll', async () => {
    const fetchImpl = (async (input: RequestInfo | URL) => {
      expect(String(input)).toContain(`route_id=eq.${ROUTE_ID}`);
      return new Response(JSON.stringify([{ answer_json: { kind: 'bishop_dispatch_reply', ok: true, spawned: true, reason: 'spawned' }, processing_ms: 999 }]), { status: 200 });
    }) as unknown as FetchLike;

    const result = await pollForBishopDispatchReply({ supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY, fetchImpl: shim(fetchImpl), sleepImpl: instantSleep }, ROUTE_ID, 5000);

    expect(result).not.toBeNull();
    expect(result?.answer.ok).toBe(true);
    expect(result?.processingMs).toBe(999);
  });

  test('ignores a row whose answer_json is not bishop_dispatch_reply-shaped, keeps polling until timeout', async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      return new Response(JSON.stringify([{ answer_json: { answer: 'D', answered_by: 'plow' }, processing_ms: 1 }]), { status: 200 });
    }) as unknown as FetchLike;

    // Fake clock advance via a sleepImpl that also advances a local deadline check: use a tiny
    // real timeoutMs with an instant sleep so the while-loop's Date.now() deadline is what ends
    // the test, not real wall-clock waiting.
    const result = await pollForBishopDispatchReply(
      { supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY, fetchImpl: shim(fetchImpl), sleepImpl: instantSleep, pollIntervalMs: 1 },
      ROUTE_ID,
      20,
    );

    expect(result).toBeNull();
    expect(calls).toBeGreaterThan(0);
  });

  test('times out and returns null when no reply ever appears', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify([]), { status: 200 })) as unknown as FetchLike;

    const result = await pollForBishopDispatchReply(
      { supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY, fetchImpl: shim(fetchImpl), sleepImpl: instantSleep, pollIntervalMs: 1 },
      ROUTE_ID,
      20,
    );

    expect(result).toBeNull();
  });

  test('a transient fetch error does not abort the poll -- keeps trying until deadline', async () => {
    let attempt = 0;
    const fetchImpl = (async () => {
      attempt++;
      if (attempt < 3) throw new Error('ECONNRESET');
      return new Response(JSON.stringify([{ answer_json: { kind: 'bishop_dispatch_reply', ok: false, spawned: false, reason: 'x' }, processing_ms: 5 }]), { status: 200 });
    }) as unknown as FetchLike;

    const result = await pollForBishopDispatchReply(
      { supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY, fetchImpl: shim(fetchImpl), sleepImpl: instantSleep, pollIntervalMs: 1 },
      ROUTE_ID,
      1000,
    );

    expect(attempt).toBeGreaterThanOrEqual(3);
    expect(result?.answer.ok).toBe(false);
  });

  test('D-BP157-030: appends a VERSION_SKEW WorkIssue (observation, not a refusal) when the reply\'s responderVersion differs from this machine\'s own', async () => {
    mockApp.getVersion.mockReturnValue('0.9.25'); // this machine
    const fetchImpl = (async () => new Response(JSON.stringify([{
      answer_json: {
        kind: 'bishop_dispatch_reply', ok: true, spawned: true, reason: 'spawned', issues: [],
        responderVersion: '0.9.23', responderBuildKind: 'installed', // the peer that replied
      },
      processing_ms: 5,
    }]), { status: 200 })) as unknown as FetchLike;

    const result = await pollForBishopDispatchReply({ supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY, fetchImpl: shim(fetchImpl), sleepImpl: instantSleep }, ROUTE_ID, 5000);

    expect(result).not.toBeNull();
    // Observation only -- ok/lifecycle/spawned untouched, the peer still did its work.
    expect(result?.answer.ok).toBe(true);
    expect(result?.answer.spawned).toBe(true);
    const skewIssue = result?.answer.issues.find((i) => i.code === 'VERSION_SKEW');
    expect(skewIssue).toBeDefined();
    expect(skewIssue?.evidence).toBe('local=0.9.25 responder=0.9.23');
    expect(skewIssue?.observedBy).toBe('pollForBishopDispatchReply');
  });

  test('D-BP157-030: no VERSION_SKEW issue when responderVersion matches this machine\'s own', async () => {
    mockApp.getVersion.mockReturnValue('0.9.25');
    const fetchImpl = (async () => new Response(JSON.stringify([{
      answer_json: { kind: 'bishop_dispatch_reply', ok: true, spawned: true, reason: 'spawned', issues: [], responderVersion: '0.9.25' },
      processing_ms: 5,
    }]), { status: 200 })) as unknown as FetchLike;

    const result = await pollForBishopDispatchReply({ supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY, fetchImpl: shim(fetchImpl), sleepImpl: instantSleep }, ROUTE_ID, 5000);

    expect(result?.answer.issues.some((i) => i.code === 'VERSION_SKEW')).toBe(false);
  });

  test('D-BP157-030: no VERSION_SKEW issue when the peer reply predates this field (older peer, responderVersion absent)', async () => {
    mockApp.getVersion.mockReturnValue('0.9.25');
    const fetchImpl = (async () => new Response(JSON.stringify([{
      answer_json: { kind: 'bishop_dispatch_reply', ok: true, spawned: true, reason: 'spawned', issues: [] },
      processing_ms: 5,
    }]), { status: 200 })) as unknown as FetchLike;

    const result = await pollForBishopDispatchReply({ supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY, fetchImpl: shim(fetchImpl), sleepImpl: instantSleep }, ROUTE_ID, 5000);

    expect(result?.answer.issues.some((i) => i.code === 'VERSION_SKEW')).toBe(false);
  });
});
