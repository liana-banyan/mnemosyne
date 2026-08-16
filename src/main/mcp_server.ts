/**
 * MnemosyneC local MCP server — BP081 K-2 scaffold
 * Exposes substrate tools to local MCP clients (Claude Desktop, Cursor, etc.)
 * Default port: 11456. stdio transport also supported via standalone spawn mode.
 *
 * KN-BP147-M1 (BP147 D-BP147-002, "put the doctrine in MnemosyneC and make it consumed"):
 * the prior header here claimed "v0.1.61 wires real business logic into tool stubs" while
 * every tool below was a hardcoded stub returning zeros/empty/not_implemented regardless of
 * input -- a component reporting work it never did. That claim is corrected now to state
 * what is ACTUALLY wired as of this Yoke:
 *   - mnem_query_substrate      -> real queryEbletStore()        (mnem_eblet_store.ts)
 *   - mnem_get_substrate_stats  -> real getEbletIndexStats()     (mnem_eblet_store.ts)
 *   - mnem_record_qa            -> real writeVerifiedEblet()     (mnem_eblet_store.ts)
 *   - mnem_run_giant_concordance -> real runGiantConcordance()   (plow/giant_concordance.ts) --
 *     HARDWIRE-05 Prior Work Blood Rule check found this real 3-voter Ollama implementation
 *     already existed and matches this tool's exact (question, candidateAnswer) contract; the
 *     ticket's premise that it might have "no real implementation" is REFUTED.
 *   - mnem_share_eblet_to_peer  -> checked federation/*, keys_engines/peer_artifact_*,
 *     mesh_test/wan_dispatch.ts, kitchen_table/p2p_discovery.ts: rich peer/mesh infrastructure
 *     exists for presence, app-update-artifact transfer, and batch mesh-test dispatch, but NONE
 *     of it shares a single existing verified eblet (by id) to one peer on consent. No real
 *     implementation exists behind this tool -- it stays an HONEST, EXPLICIT not_implemented
 *     stub (a truthful stub beats a lying wire) rather than an invented concordance.
 *
 * Transport strategy in Electron context:
 *  - HTTP/StreamableHTTP on port 11456 (primary for running app connections)
 *  - stdio available when process is spawned as standalone MCP server subprocess
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { queryEbletStore, getEbletIndexStats, writeVerifiedEblet, getIndexFreshnessSignal, forceRefreshEbletIndex } from './mnem_eblet_store';
import { runGiantConcordance, type ConcordanceResult } from './plow/giant_concordance';
// D-BP154-074/BISHOP-SEG/S74/seg-ambient -- AMBIENT BROWSER CAPTURE. See ambient_capture_auth.ts's
// own header for why this is a SEPARATE, narrower-privileged key from _authToken above, and
// ambient_capture.ts's own header for why recordAmbientBrowserCapture() is a NEW CALLER into the
// existing evidence_store.ts, not a new writer.
import { isValidCaptureKey, getOrCreateCaptureKey, getCaptureKeyPath } from './ambient_capture_auth';
import { recordAmbientBrowserCapture, type AmbientCapturePayload } from './liana_cycle/evidence/ambient_capture';
import { notifyAmbientCapture } from './ambient_capture_bridge';
// D-BP155-021/BISHOP/seg-oneclick-pairing -- ONE-CLICK PAIRING. See ambient_capture_pairing.ts's
// own header for the full security design; this route only validates transport-level constraints
// (loopback, extension origin) and delegates the actual grant/deny decision -- which always means
// a native confirmation, never an automatic yes -- to requestPairing().
import { requestPairing } from './ambient_capture_pairing';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RecentCall {
  tool: string;
  ts: number;
  clientId: string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const DEFAULT_MCP_PORT = 11456;

function getMcpPort(): number {
  const envVal = process.env.MNEMO_MCP_PORT;
  if (envVal) {
    const n = parseInt(envVal, 10);
    if (!isNaN(n) && n > 0 && n < 65536) return n;
  }
  return DEFAULT_MCP_PORT;
}

// ── Module-level state ────────────────────────────────────────────────────────

let _running = false;
let _activePort: number | null = null;
let _httpServer: http.Server | null = null;
let _authToken: string | null = null;

export const connectedClients: Map<string, { name: string; connectedAt: number; callCount: number }> = new Map();

const _recentCalls: RecentCall[] = [];

// ── D-BP154-074/BISHOP-SEG/S74/seg-ambient: ambient browser capture state ─────────────────────
// Per-acquisition monotonic seq counter (evidence_store.ts requires "monotonic within an
// acquisition" -- see appendEvidence()'s own doc comment). Reset is never needed: a fresh
// acquisitionId is derived per (surface, capturedAt), so this map only ever grows by a few
// entries per session and is intentionally never persisted (it exists purely to satisfy the
// ledger's own ordering contract for records that land in the SAME millisecond+surface).
const _ambientSeqByAcquisition: Map<string, number> = new Map();
let _ambientCaptureCount = 0;
let _ambientCaptureLastAt: string | null = null;

function nextAmbientSeq(acquisitionId: string): number {
  const n = _ambientSeqByAcquisition.get(acquisitionId) ?? 0;
  _ambientSeqByAcquisition.set(acquisitionId, n + 1);
  return n;
}

function pushRecentCall(tool: string, clientId = 'unknown'): void {
  _recentCalls.unshift({ tool, ts: Date.now(), clientId });
  if (_recentCalls.length > 10) _recentCalls.length = 10;
}

// ── Token auth ────────────────────────────────────────────────────────────────

function getTokenPath(): string {
  // Lazy require to avoid Electron app not being ready at module load time
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { app: electronApp } = require('electron') as typeof import('electron');
  return path.join(electronApp.getPath('userData'), 'mcp_auth_token.txt');
}

function loadOrCreateAuthToken(): string {
  try {
    const tokenPath = getTokenPath();
    if (fs.existsSync(tokenPath)) {
      const t = fs.readFileSync(tokenPath, 'utf8').trim();
      if (t.length >= 32) return t;
    }
    const newToken = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(tokenPath, newToken, 'utf8');
    console.log('[MCP] Auth token created at userData/mcp_auth_token.txt');
    return newToken;
  } catch (e) {
    console.error('[MCP] Failed to load/create auth token, using ephemeral token:', e);
    return crypto.randomBytes(32).toString('hex');
  }
}

// ── MCP server factory — one fresh instance per stateless request ─────────────

function buildMcpServer(): McpServer {
  const server = new McpServer({ name: 'mnemosynec', version: '0.1.0' });

  // ── Tool 1: mnem_query_substrate ──────────────────────────────────────────
  server.registerTool(
    'mnem_query_substrate',
    {
      description: 'Query the user\'s local MnemosyneC substrate for verified answers matching a question.',
      inputSchema: {
        question: z.string().describe('The question to search in the substrate'),
      },
    },
    async (args: { question: string }) => {
      pushRecentCall('mnem_query_substrate', 'mcp_client');
      // KN-BP147-M1: was `_args` (argument ignored, always []). Now calls the real BM25
      // retrieval path over the persistent eblet index and returns its actual snippet output
      // verbatim. queryEbletStore() returns pre-formatted `[title] [category: X]\ncontent`
      // strings, not a {id, domain, confidence}-shaped record -- that structured shape never
      // existed upstream, so it is not fabricated here (a truthful shape beats a lying one).
      let eblets: string[] = [];
      let error: string | undefined;
      try {
        eblets = await queryEbletStore(args.question);
      } catch (e) {
        console.error('[MCP] mnem_query_substrate: queryEbletStore threw:', e);
        error = String(e);
      }
      // D-BP155-018: "a refresh failure must be NAMED, never silent" -- getIndexFreshnessSignal()
      // is a cheap timestamp comparison (no disk I/O), safe to call on every query. When the
      // index is known-possibly-behind-disk (a background rebuild failed, a detected change
      // hasn't been incorporated yet, or no keep-current watcher is even running), this
      // response carries that fact alongside the results rather than returning results that
      // LOOK current with no way for the caller to tell otherwise.
      const freshness = getIndexFreshnessSignal();
      const result: { eblets: string[]; error?: string; indexStale?: boolean; staleReason?: string } = {
        eblets,
        ...(error ? { error } : {}),
        ...(freshness.stale ? { indexStale: true, staleReason: freshness.reason } : {}),
      };
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  // ── Tool 1b: mnem_force_refresh_substrate ─────────────────────────────────
  // D-BP155-018 constraint 3's "belt and suspenders": explicit force-refresh for a caller that
  // KNOWS it just wrote a file and wants a synchronous reread NOW, rather than waiting on the
  // debounced fs.watch path (typically <=WATCH_DEBOUNCE_MS + rebuild time, but not
  // instantaneous). Does not replace the automatic path -- it is additive, same contract as
  // SubstratedFolderWatcher's manual controls alongside its own automatic watching.
  server.registerTool(
    'mnem_force_refresh_substrate',
    {
      description: 'Force an immediate substrate index rebuild (bypasses the normal 60s lazy check and the debounced file watcher). Use right after writing/editing a file you need to be queryable immediately.',
      inputSchema: {},
    },
    async () => {
      pushRecentCall('mnem_force_refresh_substrate', 'mcp_client');
      const stats = await forceRefreshEbletIndex();
      return { content: [{ type: 'text' as const, text: JSON.stringify(stats) }] };
    },
  );

  // ── Tool 2: mnem_record_qa ────────────────────────────────────────────────
  server.registerTool(
    'mnem_record_qa',
    {
      description: 'Record a Q+A pair into the MnemosyneC substrate pipeline.',
      inputSchema: {
        question: z.string().describe('The question'),
        answer: z.string().describe('The answer to record'),
        provenance: z.string().optional().describe('Source / origin of this Q+A'),
        verified: z.boolean().optional().describe('Whether this answer is pre-verified'),
      },
    },
    async (args: { question: string; answer: string; provenance?: string; verified?: boolean }) => {
      pushRecentCall('mnem_record_qa', 'mcp_client');
      console.log('[MCP] mnem_record_qa called — q:', String(args.question ?? '').slice(0, 60));
      // KN-BP147-M1: was a hardcoded `{success:true, routedTo:'plow_queue'}` that never wrote
      // disk regardless of input -- the exact "component reports success for work it did not
      // do" defect this ticket names. Now calls the real writeVerifiedEblet() (verified this
      // session by reading its appendFileSync write path, and by the BP141 series of commits
      // that already exercise it in production call sites). `verified`/`verdict` are always
      // re-derived by writeVerifiedEblet()'s own honesty gate (computeHonestVerification()),
      // never trusted verbatim from this caller-supplied `verified` hint.
      const provenance = args.provenance && args.provenance.trim().length > 0
        ? args.provenance
        : `mcp:mnem_record_qa:${Date.now()}`;
      const timestamp = Date.now();
      const sha256 = crypto.createHash('sha256').update(args.question + args.answer).digest('hex');
      let result: { success: boolean; ebletId?: string; routedTo: 'direct_write'; error?: string };
      try {
        const writtenSha = await writeVerifiedEblet({
          question: args.question,
          answer: args.answer,
          provenance,
          verified: args.verified ?? false,
          sha256,
          timestamp,
        });
        result = { success: true, ebletId: writtenSha, routedTo: 'direct_write' };
      } catch (e) {
        console.error('[MCP] mnem_record_qa: writeVerifiedEblet threw:', e);
        result = { success: false, routedTo: 'direct_write', error: String(e) };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  // ── Tool 3: mnem_get_substrate_stats ──────────────────────────────────────
  server.registerTool(
    'mnem_get_substrate_stats',
    {
      description: 'Get current substrate statistics.',
    },
    async () => {
      pushRecentCall('mnem_get_substrate_stats', 'mcp_client');
      // KN-BP147-M1 (ticket spec, mcp_server.ts:54/72 in the ticket doc): wired to the real
      // getEbletIndexStats() (mnem_eblet_store.ts:409-428) exactly as specified. Its actual
      // return shape (totalIndexed/byCategory/lastRefreshTimestamp) differs from the old
      // stub's invented shape (totalEblets/verifiedCount/topDomains) -- returning the REAL
      // shape rather than force-fitting fabricated field names that this function does not
      // compute. (Note for the record: mnem_eblet_store.ts's separate queryStats() function,
      // not named by this ticket, happens to match the old stub's field names exactly --
      // flagged in the M1 report as a possible ticket-authoring mismatch, not acted on here
      // since the ticket is unambiguous about which function to call.)
      let stats: { totalIndexed: number; byCategory: Record<string, number>; lastRefreshTimestamp: number | null; error?: string };
      try {
        const real = getEbletIndexStats();
        stats = { totalIndexed: real.totalIndexed, byCategory: real.byCategory, lastRefreshTimestamp: real.lastRefreshTimestamp };
      } catch (e) {
        console.error('[MCP] mnem_get_substrate_stats: getEbletIndexStats threw:', e);
        stats = { totalIndexed: 0, byCategory: {}, lastRefreshTimestamp: null, error: String(e) };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(stats) }] };
    },
  );

  // ── Tool 4: mnem_run_giant_concordance ────────────────────────────────────
  server.registerTool(
    'mnem_run_giant_concordance',
    {
      description: 'Run Shadow E-Giant concordance verification on a candidate answer.',
      inputSchema: {
        question: z.string().describe('The question to verify'),
        candidateAnswer: z.string().describe('The candidate answer to evaluate'),
      },
    },
    async (args: { question: string; candidateAnswer: string }) => {
      pushRecentCall('mnem_run_giant_concordance', 'mcp_client');
      // KN-BP147-M1: was a hardcoded `{verdict:'rejected', confidence:0, votes:[]}` regardless
      // of input. HARDWIRE-05 Prior Work Blood Rule check (this session): grepped this repo
      // for GiantConcordance/giant_concordance before assuming nothing backs this tool, and
      // found a real implementation at plow/giant_concordance.ts's runGiantConcordance() --
      // a genuine 3-voter Ollama dispatch with perspective-diverse prompts, exact
      // (question, candidateAnswer) signature match. Wired to the real function; it can
      // honestly return 'inconclusive' (not fabricated as 'verified' or 'rejected') when
      // fewer than 2 voters respond, e.g. Ollama unreachable on this machine.
      let result: ConcordanceResult;
      try {
        result = await runGiantConcordance(args.question, args.candidateAnswer);
      } catch (e) {
        console.error('[MCP] mnem_run_giant_concordance: runGiantConcordance threw:', e);
        result = { verdict: 'inconclusive', confidence: 0, votes: [], error: String(e) };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  // ── Tool 5: mnem_share_eblet_to_peer ──────────────────────────────────────
  server.registerTool(
    'mnem_share_eblet_to_peer',
    {
      description: 'Share a verified eblet to a peer node (opt-in, user-consent-gated).',
      inputSchema: {
        ebletId: z.string().describe('ID of the eblet to share'),
        peerId: z.string().optional().describe('Target peer ID (omit to broadcast to trusted peers)'),
      },
    },
    async (_args: { ebletId: string; peerId?: string }) => {
      pushRecentCall('mnem_share_eblet_to_peer', 'mcp_client');
      // KN-BP147-M1: HARDWIRE-05 Prior Work Blood Rule check (this session) searched
      // federation/* (peer_server.ts, constellation_discovery.ts, presence_autoconnect.ts,
      // mic_dispatcher.ts), keys_engines/peer_artifact_client.ts + peer_artifact_server.ts,
      // mesh_test/wan_dispatch.ts, and kitchen_table/p2p_discovery.ts. Real peer/mesh
      // infrastructure exists there, but for presence/discovery, app-UPDATE-artifact transfer,
      // and batch mesh-TEST-question dispatch to many peers -- none of it shares ONE existing
      // verified eblet (by id) to a specific peer on user consent, which is this tool's exact
      // contract. No real implementation exists behind this tool. Left as an honest, explicit
      // not_implemented stub per the ticket's own instruction ("a truthful stub beats a lying
      // wire") -- HARD RULE observed: nothing invented here.
      const result: { success: boolean; reason?: string } = {
        success: false,
        reason:
          'not_implemented: no real single-eblet peer-share function exists in this repo as of ' +
          'KN-BP147-M1 (checked federation/*, keys_engines/peer_artifact_*, mesh_test/wan_dispatch.ts, ' +
          'kitchen_table/p2p_discovery.ts — all cover presence, app-update-artifact transfer, or ' +
          'batch mesh-test dispatch, not single-eblet peer sharing by id)',
      };
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  return server;
}

// ── HTTP request handler ──────────────────────────────────────────────────────

async function handleMcpHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const clientId = req.socket.remoteAddress || 'unknown';

  // CORS pre-flight. D-BP154-074/seg-ambient FIX: the prior header was the bare literal
  // '127.0.0.1' (no scheme, no port), which can never equal a real browser Origin header (e.g.
  // 'https://claude.ai' or a 'chrome-extension://<id>' background-worker origin) — BP154_
  // AMBIENT_CAPTURE_GAP.md Part 2c named this as a real blocking bug for any browser-originated
  // fetch. Reflecting the request's own Origin is safe HERE specifically because this server sets
  // no cookies and reads no cookie/session state keyed by Origin — auth is a single shared-secret
  // header (Authorization Bearer for /mcp, X-Mnemo-Capture-Key for /capture below), so there is no
  // credentialed cross-site state for a reflected Origin to steal. Falls back to the old literal
  // for non-browser clients (Claude Desktop/Cursor MCP stdio-over-HTTP clients typically send no
  // Origin header at all) so nothing that worked before this fix stops working.
  const requestOrigin = (req.headers['origin'] || '') as string;
  res.setHeader('Access-Control-Allow-Origin', requestOrigin || '127.0.0.1');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept, Mcp-Session-Id, X-Mnemo-Capture-Key');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // D-BP154-074/seg-ambient, ADDITIVE, BEFORE the /mcp Bearer gate: the ambient-capture routes use
  // their OWN, separately-minted, narrower-privileged key (ambient_capture_auth.ts) — never the
  // full-privilege MCP Bearer token. See that file's header for the least-privilege rationale.
  // Handled and returned here so neither route falls through to the /mcp-only logic below.
  if (req.url === '/capture' || req.url === '/capture/status') {
    await handleAmbientCaptureRequest(req, res, clientId);
    return;
  }

  // D-BP155-021/seg-oneclick-pairing, ADDITIVE, also BEFORE the /mcp Bearer gate and BEFORE the
  // /capture key gate above -- this is the ONE route on this server a caller with no key of any
  // kind may reach, by necessity (the whole point is to hand out the /capture key in the first
  // place). See handlePairingRequest() below and ambient_capture_pairing.ts for what actually
  // keeps this safe: loopback+extension-origin transport checks here, then a mandatory native
  // confirmation with default-deny, single-flight, and rate-limiting in that module.
  if (req.url === '/pair') {
    await handlePairingRequest(req, res, clientId);
    return;
  }

  // Auth gate: Bearer token
  const authHeader = (req.headers['authorization'] || '') as string;
  if (!_authToken || !authHeader.startsWith('Bearer ') || authHeader.slice(7) !== _authToken) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized — provide Bearer <mcp_auth_token>' }));
    return;
  }

  if (req.url !== '/mcp') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found — endpoint is /mcp' }));
    return;
  }

  // Collect body (POST only; GET handled by transport as SSE stream)
  let parsedBody: unknown = undefined;
  if (req.method === 'POST') {
    const bodyChunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      req.on('data', (chunk: Buffer) => bodyChunks.push(chunk));
      req.on('end', () => resolve());
      req.on('error', reject);
    });
    try {
      parsedBody = JSON.parse(Buffer.concat(bodyChunks).toString('utf8'));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      return;
    }
  }

  // Per-request server + transport (stateless mode)
  const server = buildMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  transport.onclose = () => {
    console.log(`[MCP] Transport closed for client ${clientId}`);
    const clientState = connectedClients.get(clientId);
    if (clientState) {
      clientState.callCount++;
    }
  };

  transport.onerror = (err: Error) => {
    console.error(`[MCP] Transport error for client ${clientId}:`, err.message);
  };

  try {
    await server.connect(transport);

    // Track client
    if (!connectedClients.has(clientId)) {
      connectedClients.set(clientId, { name: clientId, connectedAt: Date.now(), callCount: 0 });
      console.log(`[MCP] New client: ${clientId}`);
    }

    await transport.handleRequest(req, res, parsedBody);
  } catch (e) {
    console.error('[MCP] Error handling request:', e);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  } finally {
    try { await transport.close(); } catch { /* noop */ }
  }
}

// ── D-BP154-074/BISHOP-SEG/S74/seg-ambient: ambient browser capture routes ────────────────────
//
// TWO ROUTES, ONE NARROW KEY (ambient_capture_auth.ts):
//   POST /capture         -- body: AmbientCapturePayload (see ambient_capture.ts). Writes ONE
//                             record via recordAmbientBrowserCapture() -> appendEvidence()
//                             (evidence_store.ts, UNCHANGED except the additive authority-union
//                             edit documented in that file's own header).
//   GET  /capture/status   -- {running, capturesRecorded, lastCaptureAt}. Lets the extension's
//                             popup show real connectivity instead of the prior GET_STATUS stub
//                             (browser-extension/background/service_worker.js, before this
//                             ticket, always returned connected:false unconditionally).
//
// Both require X-Mnemo-Capture-Key: <the file ambient_capture_auth.ts mints>, never the /mcp
// route's Authorization Bearer token — see that file's header for why this is deliberately a
// separate, narrower-privileged secret.

async function handleAmbientCaptureRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  clientId: string,
): Promise<void> {
  const keyHeader = (req.headers['x-mnemo-capture-key'] || '') as string;
  if (!isValidCaptureKey(keyHeader)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized — provide X-Mnemo-Capture-Key' }));
    return;
  }

  if (req.url === '/capture/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      connected: true,
      running: _running,
      capturesRecorded: _ambientCaptureCount,
      lastCaptureAt: _ambientCaptureLastAt,
    }));
    return;
  }

  if (req.url === '/capture' && req.method === 'POST') {
    const bodyChunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      req.on('data', (chunk: Buffer) => bodyChunks.push(chunk));
      req.on('end', () => resolve());
      req.on('error', reject);
    });
    let parsed: unknown;
    try {
      parsed = JSON.parse(Buffer.concat(bodyChunks).toString('utf8'));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      return;
    }
    const p = parsed as Partial<AmbientCapturePayload> | null;
    if (!p || typeof p !== 'object' || typeof p.query !== 'string' || typeof p.answer !== 'string'
      || typeof p.surface !== 'string' || typeof p.url !== 'string') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Payload must include query, answer, surface, url (strings)' }));
      return;
    }
    const payload: AmbientCapturePayload = {
      query: p.query,
      answer: p.answer,
      surface: p.surface as AmbientCapturePayload['surface'],
      url: p.url,
      capturedAt: typeof p.capturedAt === 'string' && p.capturedAt ? p.capturedAt : new Date().toISOString(),
    };
    const acquisitionId = `ambient_${payload.surface}_${payload.capturedAt.replace(/[:.]/g, '-')}`;
    const seq = nextAmbientSeq(acquisitionId);
    let result: ReturnType<typeof recordAmbientBrowserCapture>;
    try {
      result = recordAmbientBrowserCapture(payload, parsed, seq, undefined);
    } catch (e) {
      console.error('[AmbientCapture] recordAmbientBrowserCapture threw:', e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error recording capture' }));
      return;
    }
    if (!result.ok) {
      console.log(`[AmbientCapture] REJECTED (${payload.surface}): ${result.reason}`);
      res.writeHead(422, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ recorded: false, reason: result.reason }));
      return;
    }
    _ambientCaptureCount += 1;
    _ambientCaptureLastAt = result.record.ts;
    console.log(`[AmbientCapture] recorded (${payload.surface}): queryKey=${result.record.queryKey.slice(0, 12)}… address=${result.record.address.slice(0, 12)}…`);
    // Indicator leg: tells index.ts's registered listener (ambient_capture_bridge.ts) to ensure
    // the dashed overlay is showing and pulse it once for this capture. Never blocks or fails the
    // HTTP response — the capture is already durably written above regardless of whether anything
    // is listening.
    notifyAmbientCapture({
      surface: payload.surface, url: payload.url, query: payload.query, ts: result.record.ts,
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      recorded: true,
      queryKey: result.record.queryKey,
      address: result.record.address,
      acquisitionId: result.record.acquisitionId,
      ts: result.record.ts,
    }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: `Not found — ${req.method} ${req.url}` }));
  void clientId; // reserved for future per-client capture accounting; unused today, kept named for readability at call site
}

// ── D-BP155-021/BISHOP/seg-oneclick-pairing: one-click pairing route ──────────────────────────
//
// POST /pair -- the extension's replacement for "hand-copy the key out of a tray dialog and paste
// it into the options page". Body is ignored; the requesting extension's id comes from its own
// Origin header (Chrome sets this to `chrome-extension://<id>` on every fetch an extension page --
// including a background service worker -- makes, and a page script in a normal tab has no way to
// forge that scheme). UNAUTHENTICATED BY NECESSITY (see ambient_capture_pairing.ts's header for
// why that is safe): every check below runs BEFORE any native confirmation is raised, so an
// unqualified request never even reaches the Founder's screen.

function isLoopbackAddress(addr: string): boolean {
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

const CHROME_EXTENSION_ORIGIN_RE = /^chrome-extension:\/\/([a-p]{32})$/;

async function handlePairingRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  clientId: string,
): Promise<void> {
  const deny = (status: number, reason: string) => {
    console.log(`[AmbientCapturePairing] REJECT (pre-dialog) reason=${reason} clientId=${clientId}`);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ paired: false, reason }));
  };

  // Belt-and-suspenders re-check of the network-layer bind: startMcpServer() below already binds
  // 127.0.0.1 only, but re-checking the actual peer address here means this route stays refused
  // even if that bind were ever loosened without this file being touched.
  if (!isLoopbackAddress(clientId)) {
    deny(403, 'not_loopback');
    return;
  }

  if (req.method !== 'POST') {
    deny(404, 'method_not_allowed');
    return;
  }

  const origin = (req.headers['origin'] || '') as string;
  const originMatch = CHROME_EXTENSION_ORIGIN_RE.exec(origin);
  if (!originMatch) {
    deny(403, 'origin_not_extension');
    return;
  }

  // Host header re-check, defense in depth alongside the clientId loopback check above -- a
  // proxy or a future change that forwards a non-loopback Host through to this handler is still
  // refused.
  const hostHeader = ((req.headers['host'] || '') as string).split(':')[0].toLowerCase();
  if (hostHeader !== '127.0.0.1' && hostHeader !== 'localhost') {
    deny(403, 'host_not_loopback');
    return;
  }

  const extensionId = originMatch[1];
  const port = _activePort || getMcpPort();
  const outcome = await requestPairing(extensionId, port);
  res.writeHead(outcome.status, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify(
      outcome.granted
        ? { paired: true, key: outcome.key, port: outcome.port }
        : { paired: false, reason: outcome.reason },
    ),
  );
}

// ── Lifecycle: startMcpServer / stopMcpServer ─────────────────────────────────

export async function startMcpServer(): Promise<void> {
  if (_running) {
    console.log('[MCP] Server already running');
    return;
  }

  const port = getMcpPort();

  _authToken = loadOrCreateAuthToken();
  // D-BP154-074/seg-ambient: mint (or load) the ambient-capture key eagerly at server start, not
  // lazily on first /capture request, so its file exists and its path can be logged the moment
  // the server comes up -- the Founder needs to find and paste this value into the extension's
  // options page BEFORE the first capture attempt, not discover it only after one fails.
  const captureKeyPreview = getOrCreateCaptureKey().slice(0, 8);

  await new Promise<void>((resolve, reject) => {
    const httpSrv = http.createServer(handleMcpHttpRequest);

    httpSrv.on('error', (e) => {
      console.error(`[MCP] HTTP server error on port ${port}:`, e);
      reject(e);
    });

    httpSrv.listen(port, '127.0.0.1', () => {
      _httpServer = httpSrv;
      _running = true;
      _activePort = port;
      console.log(`[MCP] Server listening on http://127.0.0.1:${port}/mcp`);
      console.log('[MCP] 6 tools registered: mnem_query_substrate, mnem_force_refresh_substrate, mnem_record_qa, mnem_get_substrate_stats, mnem_run_giant_concordance, mnem_share_eblet_to_peer');
      console.log(`[MCP] Ambient browser capture routes: POST/GET http://127.0.0.1:${port}/capture{,/status} (key starts ${captureKeyPreview}…, full value at ${getCaptureKeyPath()})`);
      console.log(`[MCP] One-click pairing route: POST http://127.0.0.1:${port}/pair (loopback + chrome-extension:// origin only; hands out the capture key ONLY after an explicit Allow click)`);
      resolve();
    });
  });
}

export async function stopMcpServer(): Promise<void> {
  if (!_running) return;

  _running = false;
  _activePort = null;

  if (_httpServer) {
    await new Promise<void>((resolve) => {
      _httpServer!.close(() => resolve());
    });
    _httpServer = null;
  }

  connectedClients.clear();
  console.log('[MCP] Server stopped');
}

// ── Status query ──────────────────────────────────────────────────────────────

export function getMcpServerStatus(): {
  running: boolean;
  port: number | null;
  connectedClients: number;
  recentCalls: RecentCall[];
} {
  return {
    running: _running,
    port: _activePort,
    connectedClients: connectedClients.size,
    recentCalls: [..._recentCalls],
  };
}

// ── Stdio transport mode (for standalone spawn by MCP clients) ────────────────
// Called externally if the process is launched with --mcp-stdio flag.
// Not activated automatically in the Electron app lifecycle.

export async function runStdioMode(): Promise<void> {
  const server = buildMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP] stdio server running — waiting for client messages on stdin');
}
