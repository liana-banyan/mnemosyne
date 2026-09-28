// relay_rpc_callers.test.ts -- D-BP223-X043-010-RB. The app call sites that moved from direct
// table access to the Phase A RPCs (relay_rpc.ts) or that now send the owner proof to an edge
// function. (Checked before writing: no existing test covers heartbeat_worker, relay_answer/worker,
// wan_dispatch's insert/poll, or peerKeyGen's presence write.)
//
// OFFLINE. The global fetch is stubbed; no request leaves the process. Each test asserts:
//   * the call goes to /rest/v1/rpc/<function> (never /rest/v1/relay_routes, /relay_route_replies
//     or a non-GET /rest/v1/peer_presence);
//   * the owner secret is in the JSON body (RPC) or the x-lb-owner-secret header (edge function),
//     and never in a URL.
//
// Run: npx vitest run src/main/federation/relay_rpc_callers.test.ts

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./peer-discovery', () => ({ getStablePeerId: () => '1a78f7c9bdd5e830' }));
vi.mock('../shared/anon_key', () => ({
  getAnonKey: () => 'anon-key-test',
  getSupabaseUrl: () => 'https://example.invalid',
  getAnonKeyHeaders: (extra?: Record<string, string>) => ({ apikey: 'anon-key-test', Authorization: 'Bearer anon-key-test', ...(extra ?? {}) }),
  SUPABASE_ANON_KEY_FALLBACK: 'anon-key-test',
  SUPABASE_URL_FALLBACK: 'https://example.invalid',
}));

import { setOwnerSecretProviderForTests } from './relay_rpc';

const SECRET = 'e'.repeat(64);
const SELF = '1a78f7c9bdd5e830';
type Call = { url: string; method: string; headers: Record<string, string>; body: string };
let calls: Call[] = [];
let respond: (url: string, body: string) => { status: number; body: unknown } = () => ({ status: 200, body: null });

function assertNoDirectTableAccess(): void {
  for (const c of calls) {
    expect(c.url).not.toContain(SECRET);
    expect(c.url).not.toMatch(/\/rest\/v1\/relay_route/);
    if (c.url.includes('/rest/v1/peer_presence')) expect(c.method).toBe('GET');
  }
}

beforeEach(() => {
  calls = [];
  setOwnerSecretProviderForTests(() => SECRET);
  vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => {
    const headers = { ...((init?.headers as Record<string, string>) ?? {}) };
    const body = String(init?.body ?? '');
    calls.push({ url: String(input), method: (init?.method ?? 'GET').toUpperCase(), headers, body });
    const r = respond(String(input), body);
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status });
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  setOwnerSecretProviderForTests(null);
});

describe('heartbeat_worker.ts (worker thread): presence_put_own with the secret handed over in workerData', () => {
  test('one RPC, secret in the body, version field, no direct PATCH', async () => {
    const { sendHeartbeatOnce } = await import('./heartbeat_worker');
    respond = () => ({ status: 200, body: 'updated' });
    const ok = await sendHeartbeatOnce({ supabaseUrl: 'https://example.invalid', supabaseAnonKey: 'anon-key-test', peerId: SELF, version: '0.9.40', ownerSecret: SECRET });
    expect(ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://example.invalid/rest/v1/rpc/presence_put_own');
    expect(JSON.parse(calls[0].body)).toEqual({ p_peer_id: SELF, p_secret: SECRET, p_fields: { version: '0.9.40' } });
    assertNoDirectTableAccess();
  });

  test('no secret: nothing is sent', async () => {
    const { sendHeartbeatOnce } = await import('./heartbeat_worker');
    const ok = await sendHeartbeatOnce({ supabaseUrl: 'https://example.invalid', supabaseAnonKey: 'k', peerId: SELF, version: 'v', ownerSecret: '' });
    expect(ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe('relay_answer/worker.ts (forked child): fetch, heartbeat and reply', () => {
  test('fetchPendingRoutes uses routes_fetch_mine (pending, limit 5) and keeps the old row shape', async () => {
    const { fetchPendingRoutes } = await import('../relay_answer/worker');
    respond = () => ({ status: 200, body: [{ id: 'r1', payload_json: { prompt: 'q' }, target_peer_id: SELF, status: 'pending', hex_frame: 'x' }] });
    const rows = await fetchPendingRoutes('https://example.invalid', 'anon-key-test', SELF, SECRET);
    expect(rows).toEqual([{ id: 'r1', payload_json: { prompt: 'q' }, target_peer_id: SELF }]);
    expect(calls[0].url).toBe('https://example.invalid/rest/v1/rpc/routes_fetch_mine');
    expect(JSON.parse(calls[0].body)).toEqual({ p_peer_id: SELF, p_secret: SECRET, p_status: 'pending', p_limit: 5 });
    assertNoDirectTableAccess();
  });

  test('fetchPendingRoutes without a secret makes no request', async () => {
    const { fetchPendingRoutes } = await import('../relay_answer/worker');
    expect(await fetchPendingRoutes('https://example.invalid', 'k', SELF, '')).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  test('writePollerHeartbeat uses presence_put_own (server stamps the time)', async () => {
    const { writePollerHeartbeat } = await import('../relay_answer/worker');
    respond = () => ({ status: 200, body: 'updated' });
    writePollerHeartbeat('https://example.invalid', 'anon-key-test', SELF, 9, SECRET);
    await new Promise((r) => setTimeout(r, 10));
    expect(calls[0].url).toBe('https://example.invalid/rest/v1/rpc/presence_put_own');
    expect(JSON.parse(calls[0].body)).toEqual({ p_peer_id: SELF, p_secret: SECRET, p_fields: { relay_poller_heartbeat_at: true, relay_poller_poll_count: 9 } });
    assertNoDirectTableAccess();
  });

  test('submitReplyViaEdgeFunction sends the owner proof as a HEADER, never in the body', async () => {
    const { submitReplyViaEdgeFunction } = await import('../relay_answer/worker');
    respond = () => ({ status: 200, body: { ok: true } });
    const ok = await submitReplyViaEdgeFunction('https://example.invalid', 'anon-key-test', SECRET, 'r1', SELF, 'B', 12);
    expect(ok).toBe(true);
    expect(calls[0].url).toBe('https://example.invalid/functions/v1/submit-relay-route-reply');
    expect(calls[0].headers['x-lb-owner-secret']).toBe(SECRET);
    expect(calls[0].body).not.toContain(SECRET);
  });
});

describe('mesh_test/wan_dispatch.ts: insert through route_send, replies through route_replies_for_sender', () => {
  test('insertRelayRoute -> route_send with the row fields; returns the new id', async () => {
    const { insertRelayRoute } = await import('../mesh_test/wan_dispatch');
    respond = () => ({ status: 200, body: 'route-uuid-1' });
    const id = await insertRelayRoute(
      { url: 'https://example.invalid', anonKey: 'anon-key-test' }, 'target-peer',
      { question_id: 1, question: 'Q?', options: ['a', 'b'], answer: 'A', answer_index: 0, category: 'math', src: 't' } as never,
      'sess-1', 120, false, false, false,
    );
    expect(id).toBe('route-uuid-1');
    expect(calls[0].url).toBe('https://example.invalid/rest/v1/rpc/route_send');
    const b = JSON.parse(calls[0].body);
    expect(b.p_sender_peer_id).toBe(SELF);
    expect(b.p_secret).toBe(SECRET);
    expect(b.p_target_peer_id).toBe('target-peer');
    expect(b.p_session_id).toBe('sess-1');
    expect(b.p_ttl_seconds).toBe(120);
    expect(b.p_wire_format).toBe('json-legacy');
    expect(typeof b.p_hex_frame).toBe('string');
    expect(b.p_payload_json).toBeTypeOf('object');
    assertNoDirectTableAccess();
  });

  test('insertRelayRoute returns null on a 42501 refusal (not the owner)', async () => {
    const { insertRelayRoute } = await import('../mesh_test/wan_dispatch');
    respond = () => ({ status: 403, body: { code: '42501', message: 'route_send: sender not proven' } });
    const id = await insertRelayRoute({ url: 'https://example.invalid', anonKey: 'k' }, 't',
      { question_id: 1, question: 'Q?', options: ['a'], answer: 'A', answer_index: 0, category: 'c', src: 't' } as never, 's', 60, false, false, false);
    expect(id).toBeNull();
  });

  test('pollForReply reads via route_replies_for_sender and returns the first reply', async () => {
    const { pollForReply } = await import('../mesh_test/wan_dispatch');
    respond = () => ({ status: 200, body: [
      { route_id: 'r1', route_status: 'answered', reply_id: 'x1', reply_created_at: 't1', reply_peer_id: 'p', answer_json: { answer: 'C' }, hex_reply: null, processing_ms: 77 },
    ] });
    const r = await pollForReply({ url: 'https://example.invalid', anonKey: 'anon-key-test' }, 'r1', 5000);
    expect(r).toEqual({ answerJson: { answer: 'C' }, processingMs: 77 });
    expect(calls[0].url).toBe('https://example.invalid/rest/v1/rpc/route_replies_for_sender');
    expect(JSON.parse(calls[0].body)).toEqual({ p_peer_id: SELF, p_secret: SECRET, p_route_ids: ['r1'] });
    assertNoDirectTableAccess();
  }, 10_000);
});

describe('substrate/peerKeyGen.ts: public key write and clear go through presence_put_own', () => {
  test('clearPeerPublicKey sends public_key_hex null through the RPC (private key column never touched)', async () => {
    const { clearPeerPublicKey } = await import('../../substrate/peerKeyGen');
    respond = () => ({ status: 200, body: 'updated' });
    const ok = await clearPeerPublicKey(SELF, { supabaseUrl: 'https://example.invalid', anonKey: 'anon-key-test' });
    expect(ok).toBe(true);
    expect(calls[0].url).toBe('https://example.invalid/rest/v1/rpc/presence_put_own');
    expect(JSON.parse(calls[0].body)).toEqual({ p_peer_id: SELF, p_secret: SECRET, p_fields: { public_key_hex: null } });
    expect(calls[0].body).not.toContain('private_key_hex_encrypted');
    assertNoDirectTableAccess();
  });
});
