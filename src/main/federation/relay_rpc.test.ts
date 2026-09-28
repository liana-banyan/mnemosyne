// relay_rpc.test.ts -- D-BP223-X043-010-RB. Tests relay_rpc.ts (no existing test covered it).
//
// OFFLINE. No network, no database. Proves the RPC client (relay_rpc.ts) speaks the Phase A
// functions exactly as PHASE_A_APPLY_20260928T030926Z.sql defines them, and that the presence
// owner secret goes ONLY into the POST body: never a URL, never a header, never an error string.
//
// Run: npx vitest run src/main/federation/relay_rpc.test.ts

import { describe, test, expect, afterEach } from 'vitest';
import {
  presencePutOwn, routeSend, routesFetchMine, routeSetStatus, routeReplyPut, routeRepliesForSender,
  repliesOnly, ownerProofHeaders, OWNER_PROOF_HEADER, setOwnerSecretProviderForTests, type FetchLike,
} from './relay_rpc';

const URL_ = 'https://example.invalid';
const ANON = 'anon-key-test';
const SECRET = '0123456789abcdef'.repeat(4);
const PEER = '1a78f7c9bdd5e830';

type Call = { url: string; init: RequestInit };
function fakeFetch(reply: (fn: string, args: Record<string, unknown>) => Response): { fetchImpl: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    const fn = String(input).split('/rest/v1/rpc/')[1] ?? '';
    return reply(fn, JSON.parse(String(init?.body ?? '{}')));
  }) as unknown as FetchLike;
  return { fetchImpl, calls };
}
const ok = (v: unknown) => new Response(JSON.stringify(v), { status: 200 });

function assertSecretOnlyInBody(calls: Call[]): void {
  for (const c of calls) {
    expect(c.url).not.toContain(SECRET);
    expect(JSON.stringify(c.init.headers ?? {})).not.toContain(SECRET);
    expect(String(c.init.body)).toContain(SECRET);
    expect((c.init.method ?? '').toUpperCase()).toBe('POST');
    const h = c.init.headers as Record<string, string>;
    expect(h.apikey).toBe(ANON);
    expect(h.Authorization).toBe(`Bearer ${ANON}`);
  }
}

describe('relay_rpc: each Phase A function, exact arguments', () => {
  afterEach(() => setOwnerSecretProviderForTests(null));

  test('presence_put_own', async () => {
    setOwnerSecretProviderForTests(() => SECRET);
    const { fetchImpl, calls } = fakeFetch(() => ok('updated'));
    const r = await presencePutOwn({ supabaseUrl: URL_, anonKey: ANON, fetchImpl, peerId: PEER, fields: { relay_poller_poll_count: 3, relay_poller_heartbeat_at: true } });
    expect(r).toMatchObject({ ok: true, data: 'updated' });
    expect(calls[0].url).toBe(`${URL_}/rest/v1/rpc/presence_put_own`);
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ p_peer_id: PEER, p_secret: SECRET, p_fields: { relay_poller_poll_count: 3, relay_poller_heartbeat_at: true } });
    assertSecretOnlyInBody(calls);
  });

  test('route_send returns the new id and passes every column', async () => {
    setOwnerSecretProviderForTests(() => SECRET);
    const { fetchImpl, calls } = fakeFetch(() => ok('11111111-2222-3333-4444-555555555555'));
    const r = await routeSend({
      supabaseUrl: URL_, anonKey: ANON, fetchImpl, senderPeerId: PEER, targetPeerId: 'target', hexFrame: 'abcd',
      payloadJson: { kind: 'x' }, sessionId: 's1', ttlSeconds: 150, wireFormat: 'json-legacy',
    });
    expect(r.data).toBe('11111111-2222-3333-4444-555555555555');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      p_sender_peer_id: PEER, p_secret: SECRET, p_target_peer_id: 'target', p_hex_frame: 'abcd',
      p_payload_json: { kind: 'x' }, p_session_id: 's1', p_ttl_seconds: 150, p_wire_format: 'json-legacy',
    });
    assertSecretOnlyInBody(calls);
  });

  test('routes_fetch_mine defaults to pending, passes limit, tolerates a non-array body', async () => {
    setOwnerSecretProviderForTests(() => SECRET);
    const { fetchImpl, calls } = fakeFetch(() => ok([{ id: 'r1' }]));
    const r = await routesFetchMine({ supabaseUrl: URL_, anonKey: ANON, fetchImpl, peerId: PEER, limit: 7 });
    expect(r.data).toEqual([{ id: 'r1' }]);
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ p_peer_id: PEER, p_secret: SECRET, p_status: 'pending', p_limit: 7 });
    const all = await routesFetchMine({ supabaseUrl: URL_, anonKey: ANON, fetchImpl: fakeFetch(() => ok(null)).fetchImpl, peerId: PEER, status: null });
    expect(all.data).toEqual([]);
    assertSecretOnlyInBody(calls);
  });

  test('route_set_status: conditional claim and unconditional finalize', async () => {
    setOwnerSecretProviderForTests(() => SECRET);
    const { fetchImpl, calls } = fakeFetch((_fn, a) => ok(a.p_from_status === 'pending'));
    const won = await routeSetStatus({ supabaseUrl: URL_, anonKey: ANON, fetchImpl, routeId: 'r1', peerId: PEER, fromStatus: 'pending', toStatus: 'processing' });
    expect(won.data).toBe(true);
    await routeSetStatus({ supabaseUrl: URL_, anonKey: ANON, fetchImpl, routeId: 'r1', peerId: PEER, fromStatus: null, toStatus: 'answered' });
    expect(JSON.parse(String(calls[1].init.body))).toEqual({ p_route_id: 'r1', p_peer_id: PEER, p_secret: SECRET, p_from_status: null, p_to_status: 'answered' });
    assertSecretOnlyInBody(calls);
  });

  test('route_reply_put rounds processing_ms and nulls missing fields', async () => {
    setOwnerSecretProviderForTests(() => SECRET);
    const { fetchImpl, calls } = fakeFetch(() => ok('reply-1'));
    await routeReplyPut({ supabaseUrl: URL_, anonKey: ANON, fetchImpl, routeId: 'r1', peerId: PEER, answerJson: { a: 1 }, processingMs: 12.6 });
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      p_route_id: 'r1', p_peer_id: PEER, p_secret: SECRET, p_answer_json: { a: 1 }, p_hex_reply: null, p_processing_ms: 13,
    });
    assertSecretOnlyInBody(calls);
  });

  test('route_replies_for_sender and repliesOnly drop the no-reply placeholder', async () => {
    setOwnerSecretProviderForTests(() => SECRET);
    const rows = [
      { route_id: 'r1', route_status: 'pending', reply_id: null, reply_created_at: null, reply_peer_id: null, answer_json: null, hex_reply: null, processing_ms: null },
      { route_id: 'r2', route_status: 'answered', reply_id: 'x', reply_created_at: 't', reply_peer_id: 'p', answer_json: { a: 1 }, hex_reply: null, processing_ms: 5 },
    ];
    const { fetchImpl, calls } = fakeFetch(() => ok(rows));
    const r = await routeRepliesForSender({ supabaseUrl: URL_, anonKey: ANON, fetchImpl, peerId: PEER, routeIds: ['r1', 'r2'] });
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ p_peer_id: PEER, p_secret: SECRET, p_route_ids: ['r1', 'r2'] });
    expect(repliesOnly(r.data).map((x) => x.route_id)).toEqual(['r2']);
  });
});

describe('relay_rpc: refusals and secrecy', () => {
  afterEach(() => setOwnerSecretProviderForTests(null));

  test('a 42501 refusal surfaces the SQLSTATE and never echoes the secret, even if the server did', async () => {
    setOwnerSecretProviderForTests(() => SECRET);
    const { fetchImpl } = fakeFetch(() => new Response(JSON.stringify({ code: '42501', message: `not the owner (${SECRET})` }), { status: 403 }));
    const r = await presencePutOwn({ supabaseUrl: URL_, anonKey: ANON, fetchImpl, peerId: PEER, fields: {} });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('42501');
    expect(r.status).toBe(403);
    expect(r.error).not.toContain(SECRET);
    expect(r.error).toContain('[redacted]');
  });

  test('no owner secret: no request is made at all (fail closed)', async () => {
    setOwnerSecretProviderForTests(() => { throw new Error('encrypted storage unavailable'); });
    const { fetchImpl, calls } = fakeFetch(() => ok('x'));
    const r = await routeSend({ supabaseUrl: URL_, anonKey: ANON, fetchImpl, senderPeerId: PEER, targetPeerId: 't', hexFrame: 'h' });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(0);
    expect(calls.length).toBe(0);
    expect(ownerProofHeaders(PEER)).toBeNull();
  });

  test('a network error is reported, not thrown, and is scrubbed', async () => {
    setOwnerSecretProviderForTests(() => SECRET);
    const fetchImpl = (async () => { throw new Error(`boom ${SECRET}`); }) as unknown as FetchLike;
    const r = await routesFetchMine({ supabaseUrl: URL_, anonKey: ANON, fetchImpl, peerId: PEER });
    expect(r.ok).toBe(false);
    expect(r.error).not.toContain(SECRET);
  });

  test('ownerProofHeaders is the one header the edge functions read', () => {
    setOwnerSecretProviderForTests(() => SECRET);
    expect(OWNER_PROOF_HEADER).toBe('x-lb-owner-secret');
    expect(ownerProofHeaders(PEER)).toEqual({ 'x-lb-owner-secret': SECRET });
  });
});
