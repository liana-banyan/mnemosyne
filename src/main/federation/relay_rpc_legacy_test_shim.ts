/**
 * relay_rpc_legacy_test_shim.ts -- D-BP223-X043-010-RB. TEST-ONLY helper (imported only by
 * *.test.ts files; nothing in the app imports it). Not related to relay_v1_legacy.ts (the old
 * v1 encryption); "legacy" here means the old direct-table request shape.
 *
 * The pre-existing federation suites were written against the old DIRECT table calls
 * (GET/PATCH/POST /rest/v1/relay_routes, /relay_route_replies, /peer_presence). The app now makes
 * those reads and writes through the Phase A RPCs (relay_rpc.ts). Rather than rewrite every
 * assertion in those suites, this shim sits in front of each suite's existing hand-rolled fake:
 * it accepts the NEW RPC requests, checks the owner secret is present in the BODY and absent
 * from the URL, records the RPC call, and replays it to the old fake in the old shape, then maps
 * the old fake's answer back to what the RPC returns. So every existing behavioral assertion
 * (which row, which status, conditional or not, what reply body) still runs unchanged against the
 * new code, and the RPC-level contract is asserted separately in relay_rpc.test.ts.
 */

import { setOwnerSecretProviderForTests } from './relay_rpc';

export const TEST_OWNER_SECRET = 'a'.repeat(32) + 'b'.repeat(32);

/** Every RPC the shim saw, for suites that want to assert on the new transport directly. */
export interface ShimRpcCall {
  fn: string;
  args: Record<string, unknown>;
  url: string;
  headers: Record<string, string>;
}

export function installTestOwnerSecret(secret: string = TEST_OWNER_SECRET): void {
  setOwnerSecretProviderForTests(() => secret);
}

export function uninstallTestOwnerSecret(): void {
  setOwnerSecretProviderForTests(null);
}

type AnyFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** Some legacy fakes return a plain object with only text(); read JSON either way. */
async function readJson(res: Response): Promise<unknown> {
  if (typeof (res as { text?: unknown }).text === 'function') {
    const t = await res.text();
    return t ? JSON.parse(t) : null;
  }
  return (res as { json: () => Promise<unknown> }).json();
}

function headersToRecord(h: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!h) return out;
  if (h instanceof Headers) { h.forEach((v, k) => { out[k] = v; }); return out; }
  if (Array.isArray(h)) { for (const [k, v] of h) out[k] = v; return out; }
  return { ...(h as Record<string, string>) };
}

/**
 * Wraps a legacy fake fetch. Non-RPC requests pass straight through. `rpcCalls` collects each RPC.
 * Throws (fails the test) if an RPC arrives without the owner secret in its body, or if the
 * secret ever appears in a URL.
 */
export function wrapLegacyFetch(
  legacy: AnyFetch,
  opts: { secret?: string; rpcCalls?: ShimRpcCall[] } = {},
): AnyFetch {
  const secret = opts.secret ?? TEST_OWNER_SECRET;
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (url.includes(secret)) throw new Error('TEST SHIM: the owner secret appeared in a URL');
    const m = url.match(/^(.*)\/rest\/v1\/rpc\/([a-z_]+)$/);
    if (!m) return legacy(input, init);
    const base = m[1];
    const fn = m[2];
    const args = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    const headers = headersToRecord(init?.headers);
    opts.rpcCalls?.push({ fn, args, url, headers });
    if (args.p_secret !== secret) throw new Error(`TEST SHIM: rpc ${fn} called without the owner secret in its body`);
    const legacyHeaders = { apikey: headers.apikey ?? '', Authorization: headers.Authorization ?? '', 'Content-Type': 'application/json' };
    const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status });

    if (fn === 'routes_fetch_mine') {
      const status = args.p_status == null ? '' : `&status=eq.${String(args.p_status)}`;
      const res = await legacy(
        `${base}/rest/v1/relay_routes?target_peer_id=eq.${encodeURIComponent(String(args.p_peer_id))}${status}&order=created_at.asc&limit=${String(args.p_limit)}`,
        { method: 'GET', headers: legacyHeaders, signal: init?.signal },
      );
      if (!res.ok) return res;
      return json(await readJson(res));
    }
    if (fn === 'route_set_status') {
      const cond = args.p_from_status == null ? '' : `&status=eq.${String(args.p_from_status)}`;
      const res = await legacy(`${base}/rest/v1/relay_routes?id=eq.${encodeURIComponent(String(args.p_route_id))}${cond}`, {
        method: 'PATCH', headers: legacyHeaders, body: JSON.stringify({ status: args.p_to_status }), signal: init?.signal,
      });
      if (!res.ok) return res;
      if (args.p_from_status == null) return json(true);
      let rows: unknown = [];
      try { rows = await readJson(res); } catch { rows = []; }
      return json(Array.isArray(rows) && rows.length > 0);
    }
    if (fn === 'presence_put_own') {
      const res = await legacy(`${base}/rest/v1/peer_presence?peer_id=eq.${encodeURIComponent(String(args.p_peer_id))}`, {
        method: 'PATCH', headers: legacyHeaders, body: JSON.stringify(args.p_fields ?? {}), signal: init?.signal,
      });
      return res.ok ? json('updated') : res;
    }
    if (fn === 'route_reply_put') {
      const res = await legacy(`${base}/rest/v1/relay_route_replies`, {
        method: 'POST', headers: legacyHeaders, signal: init?.signal,
        body: JSON.stringify({
          route_id: args.p_route_id, peer_id: args.p_peer_id, answer_json: args.p_answer_json, processing_ms: args.p_processing_ms,
        }),
      });
      return res.ok ? json('reply-id-from-shim') : res;
    }
    if (fn === 'route_send') {
      const res = await legacy(`${base}/rest/v1/relay_routes`, {
        method: 'POST', headers: { ...legacyHeaders, Prefer: 'return=representation' }, signal: init?.signal,
        body: JSON.stringify({
          target_peer_id: args.p_target_peer_id,
          hex_frame: args.p_hex_frame,
          payload_json: args.p_payload_json,
          status: 'pending',
          session_id: args.p_session_id,
          ttl_seconds: args.p_ttl_seconds,
          wire_format: args.p_wire_format,
        }),
      });
      if (!res.ok) return res;
      let rows: unknown = [];
      try { rows = await readJson(res); } catch { rows = []; }
      const id = Array.isArray(rows) && rows[0] && typeof (rows[0] as { id?: unknown }).id === 'string' ? (rows[0] as { id: string }).id : '';
      return json(id);
    }
    if (fn === 'route_replies_for_sender') {
      const ids = (args.p_route_ids as string[]) ?? [];
      const out: unknown[] = [];
      for (const id of ids) {
        const res = await legacy(
          `${base}/rest/v1/relay_route_replies?route_id=eq.${encodeURIComponent(id)}&select=answer_json,processing_ms&order=created_at.desc&limit=1`,
          { method: 'GET', headers: legacyHeaders, signal: init?.signal },
        );
        if (!res.ok) return res;
        const rows = (await readJson(res)) as Array<{ answer_json?: unknown; hex_reply?: string | null; processing_ms?: number; created_at?: string; peer_id?: string }>;
        if (!Array.isArray(rows) || rows.length === 0) {
          out.push({ route_id: id, route_status: 'pending', reply_id: null, reply_created_at: null, reply_peer_id: null, answer_json: null, hex_reply: null, processing_ms: null });
          continue;
        }
        rows.forEach((r, i) => out.push({
          route_id: id, route_status: 'answered', reply_id: `reply-${i}`, reply_created_at: r.created_at ?? null,
          reply_peer_id: r.peer_id ?? null, answer_json: r.answer_json ?? null, hex_reply: r.hex_reply ?? null, processing_ms: r.processing_ms ?? null,
        }));
      }
      return json(out);
    }
    throw new Error(`TEST SHIM: unhandled rpc ${fn}`);
  };
}
