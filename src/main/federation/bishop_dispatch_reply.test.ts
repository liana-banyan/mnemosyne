// bishop_dispatch_reply.test.ts — D-BP156-M0-014, HARDWIRE-24 mesh.
//
// OFFLINE, MOCKED. No real network call, no real Supabase. fetch and the poll-loop's sleep are
// both injected, matching this repo's existing convention (bishop_dispatch_relay_listener.test.ts's
// FetchLike injection). Proves: the write side POSTs the right shape to relay_route_replies using
// only anon-key-style headers; the read side finds a matching reply, ignores a non-matching one,
// and times out cleanly; and the pure isBishopDispatchReply predicate.
//
// Run: npx vitest run src/main/federation/bishop_dispatch_reply.test.ts

import { describe, test, expect, vi } from 'vitest';
import {
  writeBishopDispatchReply,
  pollForBishopDispatchReply,
  isBishopDispatchReply,
  type FetchLike,
} from './bishop_dispatch_reply';
import type { BishopDispatchResult } from './peer_server';

const SUPABASE_URL = 'https://example.supabase.co';
const ANON_KEY = 'anon-key-test';
const ROUTE_ID = 'route-abc-123';
const PEER_ID = 'peer-def-456';

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

    const ok = await writeBishopDispatchReply({ supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY, fetchImpl }, ROUTE_ID, PEER_ID, result, 4321);

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
      answer_json: { kind: 'bishop_dispatch_reply', stage: 'launch', ok: true, lifecycle: 'begun', issues: [], spawned: true, reason: 'spawned' },
      processing_ms: 4321,
    });
  });

  test('includes noticePath in answer_json only when the result carries one', async () => {
    const { fetchImpl, calls } = makeFetchMock(201);
    const result: BishopDispatchResult = { ok: true, lifecycle: 'refused', issues: [], spawned: false, reason: 'file-write-only', noticePath: 'C:\\notices\\n1.json' };

    await writeBishopDispatchReply({ supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY, fetchImpl }, ROUTE_ID, PEER_ID, result, 10);

    const body = JSON.parse(calls[0]?.init.body as string);
    expect(body.answer_json.noticePath).toBe('C:\\notices\\n1.json');
  });

  test('a non-2xx response is reported as failure (false), never throws', async () => {
    const { fetchImpl } = makeFetchMock(500);
    const result: BishopDispatchResult = { ok: true, lifecycle: 'begun', issues: [], spawned: true, reason: 'spawned' };

    await expect(
      writeBishopDispatchReply({ supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY, fetchImpl }, ROUTE_ID, PEER_ID, result, 10),
    ).resolves.toBe(false);
  });

  test('a network error is caught and reported as failure (false), never throws', async () => {
    const fetchImpl = (async () => { throw new Error('ECONNREFUSED'); }) as unknown as FetchLike;
    const result: BishopDispatchResult = { ok: true, lifecycle: 'begun', issues: [], spawned: true, reason: 'spawned' };

    await expect(
      writeBishopDispatchReply({ supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY, fetchImpl }, ROUTE_ID, PEER_ID, result, 10),
    ).resolves.toBe(false);
  });
});

describe('pollForBishopDispatchReply', () => {
  const instantSleep = (_ms: number) => Promise.resolve();

  test('finds a matching bishop_dispatch_reply row on the first poll', async () => {
    const fetchImpl = (async (input: RequestInfo | URL) => {
      expect(String(input)).toContain(`route_id=eq.${ROUTE_ID}`);
      return new Response(JSON.stringify([{ answer_json: { kind: 'bishop_dispatch_reply', ok: true, spawned: true, reason: 'spawned' }, processing_ms: 999 }]), { status: 200 });
    }) as unknown as FetchLike;

    const result = await pollForBishopDispatchReply({ supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY, fetchImpl, sleepImpl: instantSleep }, ROUTE_ID, 5000);

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
      { supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY, fetchImpl, sleepImpl: instantSleep, pollIntervalMs: 1 },
      ROUTE_ID,
      20,
    );

    expect(result).toBeNull();
    expect(calls).toBeGreaterThan(0);
  });

  test('times out and returns null when no reply ever appears', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify([]), { status: 200 })) as unknown as FetchLike;

    const result = await pollForBishopDispatchReply(
      { supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY, fetchImpl, sleepImpl: instantSleep, pollIntervalMs: 1 },
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
      { supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY, fetchImpl, sleepImpl: instantSleep, pollIntervalMs: 1 },
      ROUTE_ID,
      1000,
    );

    expect(attempt).toBeGreaterThanOrEqual(3);
    expect(result?.answer.ok).toBe(false);
  });
});
