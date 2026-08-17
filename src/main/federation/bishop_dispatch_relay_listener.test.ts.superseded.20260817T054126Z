// bishop_dispatch_relay_listener.test.ts — D-BP156-M0-013, HARDWIRE-24 mesh.
//
// OFFLINE, MOCKED. No real network call, no real Supabase, no real electron main process.
// fetch is a hand-rolled router keyed on method + URL substring, matching this repo's existing
// convention (see bishop_dispatch_handler.test.ts's injected SpawnFn) of injecting the one
// side-effecting dependency rather than mocking the global. handleEnvelope is injected too, so
// these tests never touch peer_server.ts's real module state (electron app.getPath, real
// Ed25519 keys) -- that path is already covered separately by peer_server.bishop_dispatch.test.ts.
//
// Run: npx vitest run src/main/federation/bishop_dispatch_relay_listener.test.ts

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  pollBishopDispatchRoutesOnce,
  extractEncryptedEnvelope,
  hasBishopDispatchKind,
  isBishopDispatchPayload,
  isRowExpired,
  startBishopDispatchRelayListener,
  type RelayRouteRow,
  type FetchLike,
  type BishopRelayListenerConfig,
} from './bishop_dispatch_relay_listener';
import type { BishopDispatchResult } from './peer_server';

const PEER_ID = 'self-peer-id-abc123';
const SUPABASE_URL = 'https://example.supabase.co';
const ANON_KEY = 'anon-key-test';

function makeRow(overrides: Partial<RelayRouteRow> = {}): RelayRouteRow {
  return {
    id: 'row-1',
    created_at: new Date('2026-08-17T00:00:00.000Z').toISOString(),
    payload_json: { kind: 'bishop_dispatch', payload_encrypted: JSON.stringify({ iv: 'aa', ct: 'bb' }) },
    hex_frame: null,
    status: 'pending',
    wire_format: 'json-legacy',
    ttl_seconds: 150,
    session_id: null,
    ...overrides,
  };
}

/** Records every call, routes GET (select pending rows) vs PATCH (claim/finalize/heartbeat) by
 *  URL substring. `claimSucceeds` controls whether a conditional-claim PATCH (contains
 *  `status=eq.pending` in its URL) reports a win (non-empty representation array) or a loss
 *  (empty array) -- this is how the "claim lost" / row-level-idempotency scenario is simulated
 *  without needing a real database. */
function makeFetchMock(opts: {
  rows: RelayRouteRow[];
  claimSucceeds?: boolean;
}): { fetchImpl: FetchLike; calls: Array<{ method: string; url: string; body?: unknown }> } {
  const calls: Array<{ method: string; url: string; body?: unknown }> = [];
  const claimSucceeds = opts.claimSucceeds ?? true;

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ method, url, body });

    if (method === 'GET' && url.includes('/rest/v1/relay_routes')) {
      return new Response(JSON.stringify(opts.rows), { status: 200 });
    }
    if (method === 'PATCH' && url.includes('/rest/v1/relay_routes')) {
      // Conditional claim/expire PATCHes carry `status=eq.pending` in the query string;
      // unconditional finalize PATCHes (post-claim) carry only `id=eq.<id>`.
      const isConditional = url.includes('status=eq.pending');
      if (isConditional && !claimSucceeds) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response(JSON.stringify([{ id: 'row-1' }]), { status: 200 });
    }
    if (method === 'PATCH' && url.includes('/rest/v1/peer_presence')) {
      return new Response(null, { status: 204 });
    }
    return new Response(JSON.stringify({ error: 'unhandled in test mock' }), { status: 500 });
  }) as unknown as FetchLike;

  return { fetchImpl, calls };
}

function baseConfig(fetchImpl: FetchLike, handleEnvelope: BishopRelayListenerConfig['handleEnvelope']): BishopRelayListenerConfig {
  return {
    peerId: PEER_ID,
    supabaseUrl: SUPABASE_URL,
    anonKey: ANON_KEY,
    fetchImpl,
    handleEnvelope,
    nowMs: () => new Date('2026-08-17T00:00:10.000Z').getTime(), // 10s after the row's created_at
  };
}

describe('pure predicates', () => {
  test('extractEncryptedEnvelope: matches a well-formed bishop_dispatch row', () => {
    const row = makeRow();
    expect(extractEncryptedEnvelope(row)).toBe(JSON.stringify({ iv: 'aa', ct: 'bb' }));
  });

  test('extractEncryptedEnvelope: null payload_json is not a match', () => {
    expect(extractEncryptedEnvelope(makeRow({ payload_json: null }))).toBeNull();
  });

  test('extractEncryptedEnvelope: an MC-question shaped row (no kind field) is not a match', () => {
    const mcRow = makeRow({ payload_json: { domain: 'chemistry', prompt: 'what is X?', question_id: 1 } });
    expect(extractEncryptedEnvelope(mcRow)).toBeNull();
    expect(hasBishopDispatchKind(mcRow)).toBe(false);
  });

  test('extractEncryptedEnvelope: kind matches but payload_encrypted is missing/wrong type', () => {
    expect(extractEncryptedEnvelope(makeRow({ payload_json: { kind: 'bishop_dispatch' } }))).toBeNull();
    expect(extractEncryptedEnvelope(makeRow({ payload_json: { kind: 'bishop_dispatch', payload_encrypted: 12345 } }))).toBeNull();
    // But hasBishopDispatchKind is still true -- "ours to claim" is a separate question from
    // "usable envelope inside it."
    expect(hasBishopDispatchKind(makeRow({ payload_json: { kind: 'bishop_dispatch' } }))).toBe(true);
  });

  test('isRowExpired: a row past created_at + ttl_seconds is expired', () => {
    const row = makeRow({ created_at: '2026-08-17T00:00:00.000Z', ttl_seconds: 150 });
    const now = new Date('2026-08-17T00:05:00.000Z').getTime(); // 300s later > 150s ttl
    expect(isRowExpired(row, now)).toBe(true);
  });

  test('isRowExpired: a fresh row within ttl_seconds is not expired', () => {
    const row = makeRow({ created_at: '2026-08-17T00:00:00.000Z', ttl_seconds: 360 });
    const now = new Date('2026-08-17T00:00:10.000Z').getTime(); // 10s later < 360s ttl
    expect(isRowExpired(row, now)).toBe(false);
  });

  test('isRowExpired: fails open (not expired) on missing/non-positive ttl_seconds', () => {
    expect(isRowExpired(makeRow({ ttl_seconds: null }), Date.now())).toBe(false);
    expect(isRowExpired(makeRow({ ttl_seconds: 0 }), Date.now())).toBe(false);
  });

  test('isRowExpired: fails open (not expired) on an unparseable created_at', () => {
    expect(isRowExpired(makeRow({ created_at: 'not-a-date' }), Date.now())).toBe(false);
  });

  // D-BP156-M0-016: isBishopDispatchPayload is the discriminator index.ts's startRelayRoutePoll
  // reuses (rather than re-implementing) to skip a bishop_dispatch row -- see index.ts and this
  // file's own hasBishopDispatchKind, which is now defined IN TERMS OF isBishopDispatchPayload
  // so the two callers can never drift out of agreement on which rows belong to which poller.
  describe('isBishopDispatchPayload', () => {
    test('true for a bishop_dispatch-shaped payload_json', () => {
      expect(isBishopDispatchPayload({ kind: 'bishop_dispatch', payload_encrypted: '{}' })).toBe(true);
    });
    test('false for an ordinary MC-question payload_json (no kind field)', () => {
      expect(isBishopDispatchPayload({ domain: 'chemistry', prompt: 'what is X?', question_id: 1 })).toBe(false);
    });
    test('false for null/undefined payload_json', () => {
      expect(isBishopDispatchPayload(null)).toBe(false);
      expect(isBishopDispatchPayload(undefined)).toBe(false);
    });
    test('false for a different kind value', () => {
      expect(isBishopDispatchPayload({ kind: 'eblet_topical' })).toBe(false);
    });
    test('agrees with hasBishopDispatchKind on the same row', () => {
      const bishopRow = makeRow();
      const mcRow = makeRow({ payload_json: { domain: 'chemistry', prompt: 'x' } });
      expect(isBishopDispatchPayload(bishopRow.payload_json)).toBe(hasBishopDispatchKind(bishopRow));
      expect(isBishopDispatchPayload(mcRow.payload_json)).toBe(hasBishopDispatchKind(mcRow));
    });
  });
});

describe('pollBishopDispatchRoutesOnce', () => {
  test('a well-formed bishop_dispatch row is claimed, handed to the envelope handler, and marked answered', async () => {
    const row = makeRow();
    const { fetchImpl, calls } = makeFetchMock({ rows: [row] });
    const handleEnvelope = vi.fn(async (): Promise<BishopDispatchResult> => ({ ok: true, spawned: true, reason: 'spawned' }));

    const summary = await pollBishopDispatchRoutesOnce(baseConfig(fetchImpl, handleEnvelope), 1);

    expect(summary).toMatchObject({ seen: 1, processed: 1, errored: 0, malformed: 0, expired: 0, claimLost: 0, skippedNotOurs: 0 });
    expect(handleEnvelope).toHaveBeenCalledTimes(1);
    expect(handleEnvelope).toHaveBeenCalledWith(JSON.stringify({ iv: 'aa', ct: 'bb' }));

    const finalize = calls.find((c) => c.method === 'PATCH' && c.url.includes(`id=eq.${row.id}`) && !c.url.includes('status=eq.pending'));
    expect(finalize?.body).toEqual({ status: 'answered' });
  });

  test('an expired row (ttl_seconds) is skipped: never handed to the envelope handler, marked expired', async () => {
    const row = makeRow({ created_at: '2026-08-17T00:00:00.000Z', ttl_seconds: 150 });
    const { fetchImpl, calls } = makeFetchMock({ rows: [row] });
    const handleEnvelope = vi.fn(async (): Promise<BishopDispatchResult> => ({ ok: true, spawned: true, reason: 'spawned' }));

    // nowMs is 10s after created_at in baseConfig; override to be well past the 150s ttl.
    const config = { ...baseConfig(fetchImpl, handleEnvelope), nowMs: () => new Date('2026-08-17T00:10:00.000Z').getTime() };
    const summary = await pollBishopDispatchRoutesOnce(config, 1);

    expect(summary.expired).toBe(1);
    expect(summary.processed).toBe(0);
    expect(handleEnvelope).not.toHaveBeenCalled();

    const claim = calls.find((c) => c.method === 'PATCH' && c.url.includes('status=eq.pending'));
    expect(claim?.body).toEqual({ status: 'expired' });
  });

  test('an unrecognized payload shape (MC-question row) is a logged no-op: never claimed, never PATCHed, never handed to the handler', async () => {
    const mcRow = makeRow({
      id: 'mc-row-1',
      payload_json: { domain: 'chemistry', prompt: 'what is X?', question_id: 1, wire_format: 'json-legacy' },
    });
    const { fetchImpl, calls } = makeFetchMock({ rows: [mcRow] });
    const handleEnvelope = vi.fn(async (): Promise<BishopDispatchResult> => ({ ok: true, spawned: true, reason: 'spawned' }));

    const summary = await pollBishopDispatchRoutesOnce(baseConfig(fetchImpl, handleEnvelope), 1);

    expect(summary.skippedNotOurs).toBe(1);
    expect(handleEnvelope).not.toHaveBeenCalled();
    const anyPatchOnMcRow = calls.some((c) => c.method === 'PATCH' && c.url.includes('mc-row-1'));
    expect(anyPatchOnMcRow).toBe(false);
  });

  test('a row already claimed by something else before we could (lost the conditional-claim race) is skipped, not re-fired', async () => {
    const row = makeRow();
    const { fetchImpl, calls } = makeFetchMock({ rows: [row], claimSucceeds: false });
    const handleEnvelope = vi.fn(async (): Promise<BishopDispatchResult> => ({ ok: true, spawned: true, reason: 'spawned' }));

    const summary = await pollBishopDispatchRoutesOnce(baseConfig(fetchImpl, handleEnvelope), 1);

    expect(summary.claimLost).toBe(1);
    expect(summary.processed).toBe(0);
    expect(handleEnvelope).not.toHaveBeenCalled();
    // Only the (failed) conditional claim PATCH happened -- no unconditional finalize PATCH,
    // since we never actually owned the row.
    const finalize = calls.find((c) => c.method === 'PATCH' && c.url.includes(`id=eq.${row.id}`) && !c.url.includes('status=eq.pending'));
    expect(finalize).toBeUndefined();
  });

  test('a re-read of the SAME row on a second poll tick does not re-fire once it is no longer pending', async () => {
    // Simulates "a row re-read on the next poll must not re-fire" (scope item 6) end to end: the
    // mock's GET always returns the row (a real Supabase GET filtered on status=eq.pending would
    // not, once PATCHed away -- this directly exercises the claim gate that makes that true).
    const row = makeRow();
    const { fetchImpl: fetchTick1 } = makeFetchMock({ rows: [row], claimSucceeds: true });
    const handleEnvelope = vi.fn(async (): Promise<BishopDispatchResult> => ({ ok: true, spawned: true, reason: 'spawned' }));
    const summary1 = await pollBishopDispatchRoutesOnce(baseConfig(fetchTick1, handleEnvelope), 1);
    expect(summary1.processed).toBe(1);

    // Second tick: the row is no longer really 'pending' in a real database, which is exactly
    // what claimSucceeds:false models here (the conditional PATCH's WHERE status=eq.pending now
    // matches nothing) -- proving the SAME row cannot be processed twice even if some caller
    // mistakenly re-fetched it.
    const { fetchImpl: fetchTick2 } = makeFetchMock({ rows: [row], claimSucceeds: false });
    const summary2 = await pollBishopDispatchRoutesOnce(baseConfig(fetchTick2, handleEnvelope), 2);
    expect(summary2.claimLost).toBe(1);
    expect(summary2.processed).toBe(0);
    expect(handleEnvelope).toHaveBeenCalledTimes(1); // still only the one call from tick 1
  });

  test('a non-allowlisted sender (refused by the real guardrail chain, ok:true/spawned:false) is marked answered, never crashes', async () => {
    const row = makeRow();
    const { fetchImpl, calls } = makeFetchMock({ rows: [row] });
    // Mirrors bishop_dispatch_handler.ts's real refusal shape for guardrail (a), sender allowlist.
    const handleEnvelope = vi.fn(async (): Promise<BishopDispatchResult> => ({
      ok: true,
      spawned: false,
      reason: 'sender not on allowlist (verified=null, allowed=[1a78f7c9bdd5e830])',
    }));

    const summary = await pollBishopDispatchRoutesOnce(baseConfig(fetchImpl, handleEnvelope), 1);

    expect(summary.processed).toBe(1);
    expect(summary.errored).toBe(0);
    const finalize = calls.find((c) => c.method === 'PATCH' && c.url.includes(`id=eq.${row.id}`) && !c.url.includes('status=eq.pending'));
    expect(finalize?.body).toEqual({ status: 'answered' });
  });

  test('a malformed inbound payload (envelope handler returns ok:false) never crashes the poll loop, marks error', async () => {
    const row = makeRow();
    const { fetchImpl, calls } = makeFetchMock({ rows: [row] });
    const handleEnvelope = vi.fn(async (): Promise<BishopDispatchResult> => ({ ok: false, spawned: false, reason: 'decrypt failed: bad tag' }));

    const summary = await pollBishopDispatchRoutesOnce(baseConfig(fetchImpl, handleEnvelope), 1);

    expect(summary.errored).toBe(1);
    const finalize = calls.find((c) => c.method === 'PATCH' && c.url.includes(`id=eq.${row.id}`) && !c.url.includes('status=eq.pending'));
    expect(finalize?.body).toEqual({ status: 'error' });
  });

  test('a THROWING envelope handler is caught, never crashes the poll loop, marks error', async () => {
    const row = makeRow();
    const { fetchImpl, calls } = makeFetchMock({ rows: [row] });
    const handleEnvelope = vi.fn(async (): Promise<BishopDispatchResult> => {
      throw new Error('boom — simulated bug inside the real handler');
    });

    await expect(pollBishopDispatchRoutesOnce(baseConfig(fetchImpl, handleEnvelope), 1)).resolves.toMatchObject({ errored: 1 });
    const finalize = calls.find((c) => c.method === 'PATCH' && c.url.includes(`id=eq.${row.id}`) && !c.url.includes('status=eq.pending'));
    expect(finalize?.body).toEqual({ status: 'error' });
  });

  test('a row with kind=bishop_dispatch but a malformed payload_encrypted is claimed and marked error, handler never called', async () => {
    const row = makeRow({ payload_json: { kind: 'bishop_dispatch', payload_encrypted: 42 } });
    const { fetchImpl, calls } = makeFetchMock({ rows: [row] });
    const handleEnvelope = vi.fn(async (): Promise<BishopDispatchResult> => ({ ok: true, spawned: true, reason: 'spawned' }));

    const summary = await pollBishopDispatchRoutesOnce(baseConfig(fetchImpl, handleEnvelope), 1);

    expect(summary.malformed).toBe(1);
    expect(handleEnvelope).not.toHaveBeenCalled();
    const finalize = calls.find((c) => c.method === 'PATCH' && c.url.includes(`id=eq.${row.id}`) && !c.url.includes('status=eq.pending'));
    expect(finalize?.body).toEqual({ status: 'error' });
  });

  test('a failed GET (non-2xx) never throws and returns an empty summary', async () => {
    const fetchImpl = (async () => new Response('server error', { status: 500 })) as unknown as FetchLike;
    const handleEnvelope = vi.fn(async (): Promise<BishopDispatchResult> => ({ ok: true, spawned: true, reason: 'spawned' }));
    await expect(pollBishopDispatchRoutesOnce(baseConfig(fetchImpl, handleEnvelope), 1)).resolves.toMatchObject({ seen: 0 });
  });

  test('a network error on the GET never throws and returns an empty summary', async () => {
    const fetchImpl = (async () => { throw new Error('ECONNREFUSED'); }) as unknown as FetchLike;
    const handleEnvelope = vi.fn(async (): Promise<BishopDispatchResult> => ({ ok: true, spawned: true, reason: 'spawned' }));
    await expect(pollBishopDispatchRoutesOnce(baseConfig(fetchImpl, handleEnvelope), 1)).resolves.toMatchObject({ seen: 0 });
  });

  test('multiple rows: only the bishop_dispatch-shaped ones are claimed, MC rows are left alone', async () => {
    const bishopRow = makeRow({ id: 'bishop-1' });
    const mcRow = makeRow({ id: 'mc-1', payload_json: { domain: 'physics', prompt: 'q' } });
    const { fetchImpl, calls } = makeFetchMock({ rows: [mcRow, bishopRow] });
    const handleEnvelope = vi.fn(async (): Promise<BishopDispatchResult> => ({ ok: true, spawned: true, reason: 'spawned' }));

    const summary = await pollBishopDispatchRoutesOnce(baseConfig(fetchImpl, handleEnvelope), 1);

    expect(summary.seen).toBe(2);
    expect(summary.skippedNotOurs).toBe(1);
    expect(summary.processed).toBe(1);
    expect(handleEnvelope).toHaveBeenCalledTimes(1);
    expect(calls.some((c) => c.url.includes('mc-1') && c.method === 'PATCH')).toBe(false);
  });

  test('the peer_presence heartbeat is written every tick, independent of whether any row was found', async () => {
    const { fetchImpl, calls } = makeFetchMock({ rows: [] });
    const handleEnvelope = vi.fn(async (): Promise<BishopDispatchResult> => ({ ok: true, spawned: true, reason: 'spawned' }));

    await pollBishopDispatchRoutesOnce(baseConfig(fetchImpl, handleEnvelope), 7);

    const heartbeat = calls.find((c) => c.method === 'PATCH' && c.url.includes('/peer_presence'));
    expect(heartbeat?.body).toMatchObject({ relay_poller_poll_count: 7 });
    expect(typeof (heartbeat?.body as { relay_poller_heartbeat_at?: string })?.relay_poller_heartbeat_at).toBe('string');
  });
});

describe('startBishopDispatchRelayListener', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  test('polls immediately, then on the configured interval, and stop() halts further polling', async () => {
    let getCount = 0;
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if ((init?.method ?? 'GET') === 'GET' && url.includes('/rest/v1/relay_routes')) getCount++;
      if (url.includes('/rest/v1/relay_routes')) return new Response(JSON.stringify([]), { status: 200 });
      return new Response(null, { status: 204 });
    }) as unknown as FetchLike;
    const handleEnvelope = vi.fn(async (): Promise<BishopDispatchResult> => ({ ok: true, spawned: true, reason: 'spawned' }));
    const config: BishopRelayListenerConfig = { peerId: PEER_ID, supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY, fetchImpl, handleEnvelope };

    const handle = startBishopDispatchRelayListener(config, 1000);
    await vi.advanceTimersByTimeAsync(0); // let the immediate first tick's microtasks flush
    expect(getCount).toBe(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(getCount).toBe(2);
    await vi.advanceTimersByTimeAsync(1000);
    expect(getCount).toBe(3);

    handle.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(getCount).toBe(3); // no further ticks after stop()
  });

  test('an overlapping slow tick is not double-started (non-overlapping poll)', async () => {
    let inFlightCount = 0;
    let maxObservedConcurrency = 0;
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if ((init?.method ?? 'GET') === 'GET' && url.includes('/rest/v1/relay_routes')) {
        inFlightCount++;
        maxObservedConcurrency = Math.max(maxObservedConcurrency, inFlightCount);
        await new Promise((r) => setTimeout(r, 5000)); // slower than the poll interval below
        inFlightCount--;
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response(null, { status: 204 });
    }) as unknown as FetchLike;
    const handleEnvelope = vi.fn(async (): Promise<BishopDispatchResult> => ({ ok: true, spawned: true, reason: 'spawned' }));
    const config: BishopRelayListenerConfig = { peerId: PEER_ID, supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY, fetchImpl, handleEnvelope };

    const handle = startBishopDispatchRelayListener(config, 1000); // interval shorter than the 5s fake GET
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(5000); // let the first slow GET resolve

    handle.stop();
    expect(maxObservedConcurrency).toBe(1); // never two GETs in flight at once
  });
});
