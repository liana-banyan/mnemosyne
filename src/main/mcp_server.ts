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
 *   - mnem_share_eblet_to_peer  -> REAL, two directions (the KN-BP147-M1 not_implemented stub is history):
 *       pull (D-BP223-BM0-X029-007): copies a peer's mesh-shared Hollerith cards into this node's silo, by tag,
 *         keyword or connector, each file checked against the peer's signed manifest;
 *       push (D-BP223-PQ005-012-X041, Founder 2026-09-26 "make WORK the one-click share-to-a-peer"): offers ONE of
 *         this node's own verified cards to ONE peer; it lands there only on that peer's consent (same owner, an
 *         allow-listed peer, or a person pressing accept on the held offer) and the peer answers with a receipt it
 *         signs, which this node verifies and appends to {userData}\share_receipts\sent.jsonl.
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
// D-BP223-BM0-X030-059 INCEPTION: Stone Tablet exact-address lookup, called first inside mnem_query_substrate.
import { stoneTabletMatch, gateStoneTabletByRank1, decideRuleB, type StoneTabletMatch, type RuleBDecision } from './mnem_stone_tablet_lookup';
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
// D-BP207-SEG-09/BISHOP/seg-browser-authority-external -- closes the gap named in
// D-BP207-SEG-06/D-BP207-BM01-001: nothing outside this Electron main process could reach
// runBrowserAuthorityQueryFromMain (index.ts). distillExtraction is the SAME single choke
// point browser_authority_types.ts's own header requires every caller to pass a raw
// extraction through before it leaves this module's boundary ("components not answers") --
// this file does not invent a second distillation. Type-only + one pure function import,
// zero Electron dependency in browser_authority_types.ts, so this is a safe static import
// (unlike runBrowserAuthorityQueryFromMain itself -- see the new tool below for why that one
// is a dynamic, call-time-only import instead).
import { distillExtraction, type BrowserAuthorityName, type BrowserAuthorityQuery } from '../shared/plow/browser_authority_types';

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
      // D-BP223-BM0-X030-059 INCEPTION (Founder k/dd7cc937, k/97994e07): Stone Tablet lookup FIRST. An exact tablet hit
      // hands over the ruling's address (k/ id, connector, path) before any eblet search result; a non-exact one is omitted.
      // D-BP223-BM0-X030-103 (XO addendum, X030-100 measurement): the tablet never answers alone. It is served as stoneTablet
      // only when it names the same ruling as the ranked search's rank 1 (eblets[0]); otherwise it is a stoneTabletHint.
      const stone = stoneTabletMatch(args.question);
      const gated = gateStoneTabletByRank1(stone, eblets[0]);
      // D-BP223-BM0-X030-124 RULE B: this tool has ONE ranking (queryEbletStore). ruleB answers only when the exact tablet names
      // the same ruling as eblets[0]; otherwise it says "I don't know" with the top candidates as hints. eblets are unchanged.
      const ruleB = decideRuleB(args.question, { tablet: stone, rank1: eblets[0] ?? null, rankedTop: eblets.slice(0, 3) });
      const result: { stoneTablet?: StoneTabletMatch; stoneTabletHint?: StoneTabletMatch; ruleB: RuleBDecision; eblets: string[]; error?: string; indexStale?: boolean; staleReason?: string } = {
        ...gated,
        ruleB,
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
      description:
        'Share Hollerith card eblets with a peer, both directions. PUSH (default when ebletId names one card and no tags or ' +
        'keywords are given; D-BP223-PQ005-012-X041): offer ONE of this node\'s own mesh-shareable cards to ONE peer; it lands ' +
        'there only on that peer\'s consent (same owner, allow-listed, or a person accepting the held offer) and the peer answers ' +
        'with a receipt it signs, verified here and appended to {userData}\\share_receipts\\sent.jsonl. PULL (tags or keywords, or ' +
        'mode "pull"; D-BP223-BM0-X029-007): copy a peer\'s mesh-shared cards into this node\'s silo, each file verified against ' +
        'the peer\'s signed manifest. Needs peerBaseUrl (e.g. http://192.168.86.45:7474) or a saved peerId.',
      inputSchema: {
        ebletId: z.string().optional().describe('A 32-hex Hollerith card hex connector: the card to push, or the card to pull'),
        peerId: z.string().optional().describe('Peer id; for a push it resolves the saved constellation address and known key'),
        peerBaseUrl: z.string().optional().describe('Peer server base URL, e.g. http://192.168.86.45:7474'),
        mode: z.enum(['push', 'pull']).optional().describe('push = offer my card to the peer; pull = copy the peer\'s cards here'),
        file: z.string().optional().describe('push only: the card by file name in this node\'s silo, instead of ebletId'),
        tags: z.array(z.string()).optional().describe('pull: every tag must match, e.g. ["hollerith-card","business"]'),
        keywords: z.array(z.string()).optional().describe('pull: any keyword may match a tag, keyword or title word'),
        expectedPublisherKeyHex: z.string().optional().describe('The peer\'s Thorax public key, if already known (pull: publisher; push: receiver)'),
        limit: z.number().optional(),
      },
    },
    async (args: { ebletId?: string; peerId?: string; peerBaseUrl?: string; mode?: 'push' | 'pull'; file?: string; tags?: string[]; keywords?: string[]; expectedPublisherKeyHex?: string; limit?: number }) => {
      pushRecentCall('mnem_share_eblet_to_peer', 'mcp_client');
      // D-BP223-PQ005-012-X041: the PUSH. One card, one peer, the receiver's consent, a signed receipt back.
      const wantsPush = args.mode === 'push' || (args.mode !== 'pull' && (args.ebletId || args.file) && !args.tags?.length && !args.keywords?.length);
      if (wantsPush) {
        try {
          const ps = await import('./federation/peer_server');
          const receipt = await ps.pushEbletToPeerFromThisNode({ peerBaseUrl: args.peerBaseUrl, peerId: args.peerId, connector: args.ebletId, file: args.file, expectedReceiverKeyHex: args.expectedPublisherKeyHex ?? null });
          const success = receipt.receiptVerified && (receipt.action === 'written' || receipt.action === 'already_present' || receipt.action === 'replaced_with_superseded_sibling' || receipt.action === 'held_for_consent');
          return { content: [{ type: 'text' as const, text: JSON.stringify({ success, mode: 'push', receipt }) }] };
        } catch (e) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ success: false, mode: 'push', reason: 'push threw: ' + String(e) }) }] };
        }
      }
      // D-BP223-BM0-X029-007: the stub below is REPLACED. Dynamic imports keep peer_server/announce_frame (Electron-bound)
      // out of this module's static graph, the same pattern mnem_ask_browser_authority uses below.
      if (args.peerBaseUrl && (args.ebletId || args.tags?.length || args.keywords?.length)) {
        try {
          const lib = await import('./federation/hollerith_library_share');
          const ps = await import('./federation/peer_server');
          const af = await import('./federation/announce_frame');
          const ks = await import('./thorax/ed25519_keypair');
          const selfId = ps.getRegisteredPeerId() ?? ('self-' + ks.getOrCreateKeypair().public_key_hex.slice(-16));
          const receipt = await lib.pullLibraryFromPeer({
            peerBaseUrl: args.peerBaseUrl,
            senderPeerId: selfId,
            signPayload: (seed, payload) => af.signAnnouncePayload(seed, payload)?.signedHex ?? null,
            query: { tags: args.tags, keywords: args.keywords, connectors: args.ebletId ? [args.ebletId] : undefined, limit: args.limit },
            destDir: ps.hollerithSiloDir(),
            expectedPublisherKeyHex: args.expectedPublisherKeyHex ?? null,
            // D-BP223-BM0-X030-207: keep the served ORIGIN + TRAIL and append this copy's TRAIL hop, signed with this node's Thorax key.
            tags: await (async () => {
              const tg = await import('./federation/eblet_provenance_tags');
              const kp = ks.getOrCreateKeypair();
              return { tagsDir: ps.hollerithTagsDir(), signer: tg.signerFromKeypair(selfId, kp.public_key_hex, kp.private_key_hex) };
            })(),
          });
          let indexRefresh: unknown = null;
          if (receipt.written > 0) {
            try { indexRefresh = await forceRefreshEbletIndex(); } catch (e) { indexRefresh = { error: String(e) }; }
          }
          const summary = { success: !receipt.error && receipt.refused === 0, publisherPeerIdRequested: args.peerId ?? null, receipt: { ...receipt, files: receipt.files.filter((f) => f.action === 'refused').slice(0, 20) }, indexRefresh };
          return { content: [{ type: 'text' as const, text: JSON.stringify(summary) }] };
        } catch (e) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ success: false, reason: 'library pull threw: ' + String(e) }) }] };
        }
      }
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
      // D-BP223-BM0-X029-007: reached only when the call lacks peerBaseUrl or any selector. The pre-X029-007 text said
      // not_implemented; that is no longer true, so this now says exactly what is missing.
      const result: { success: boolean; reason?: string } = {
        success: false,
        reason:
          'missing arguments: pass peerBaseUrl (e.g. http://192.168.86.45:7474) and at least one of ebletId (32-hex ' +
          'connector), tags, keywords. The publisher must run MnemosyneC with POST /api/library/search and /api/library/fetch ' +
          '(D-BP223-BM0-X029-007).',
      };
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  // ── Tool 6: mnem_ask_browser_authority ────────────────────────────────────
  // D-BP207-SEG-09/BISHOP/seg-browser-authority-external -- THE ONE NEW SURFACE THIS DISPATCH
  // ADDS. D-BP207-SEG-06 and D-BP207-BM01-001 independently confirmed runBrowserAuthorityQueryFromMain
  // (index.ts) already drives the user's own logged-in browser sessions (Google/Perplexity/
  // Claude/ChatGPT/Gemini) at $0, own quota, but grepped both HTTP/MCP servers in this app and
  // found ZERO references to it in either -- every real caller was inside this same Electron
  // main process. This tool forwards to that SAME function, exactly the registerTool
  // (typed-args-in, JSON-out) shape every tool above already uses. No new webview, no new
  // session, no new mechanism -- one more tool on an existing board.
  server.registerTool(
    'mnem_ask_browser_authority',
    {
      description:
        "Ask a question through one of the user's own logged-in browser sessions (Google, " +
        "Perplexity, Claude, ChatGPT, or Gemini) via MnemosyneC's embedded Chromium webview -- " +
        "the user's own account, own quota, $0, never a metered API. Returns a distilled fact " +
        "plus its source URL, or success:false if the session is unavailable, signed out, or the " +
        "extraction produced nothing usable. Note: user_perplexity is one-shot today (no " +
        "multi-turn thread yet, unlike user_claude/user_chatgpt/user_gemini) -- see " +
        "D-BP207-SEG-06 for the named gap.",
      inputSchema: {
        question: z.string().describe('The question to ask'),
        authority: z.enum(['user_google', 'user_perplexity', 'user_claude', 'user_chatgpt', 'user_gemini'])
          .describe("Which of the user's own logged-in browser sessions to use"),
      },
    },
    async (args: { question: string; authority: BrowserAuthorityName }) => {
      pushRecentCall('mnem_ask_browser_authority', 'mcp_client');
      let result: { success: boolean; fact?: string; sourceUrl?: string; authority: BrowserAuthorityName; error?: string };
      try {
        // Dynamic, call-time-only import of index.ts's export -- NOT a static import. index.ts
        // already statically imports THIS file (to call startMcpServer(), see that file's own
        // `import { startMcpServer, ... } from './mcp_server'`), so a static import here of
        // anything FROM index.ts would be a real load-time circular require. This repo's own
        // established fix for that exact shape is plow_mc_answerer.ts's `await import('../index')`
        // pattern (used at multiple call sites there, e.g. its Stage F2/F3 browser-authority
        // bridges) -- this tool follows that existing convention rather than inventing a new one.
        const mainModule = await import('./index');
        const query: BrowserAuthorityQuery = { question: args.question, authority: args.authority };
        const raw = await mainModule.runBrowserAuthorityQueryFromMain(query);
        if (!raw) {
          result = {
            success: false,
            authority: args.authority,
            error: 'No extraction: session unavailable, signed out, or nothing usable was found (see the app log for the honest dispatchOutcome).',
          };
        } else {
          // HONESTY FIREWALL: distillExtraction() is the single choke point
          // browser_authority_types.ts's own header mandates -- the vendor's raw scraped snippet
          // never crosses this tool's boundary, only the distilled fact does ("components not
          // answers"). Returns null (never a fabricated result) on an empty snippet or missing URL.
          const distilled = distillExtraction(raw, args.question);
          if (!distilled) {
            result = {
              success: false,
              authority: args.authority,
              error: "Extraction returned an empty snippet or no source URL -- honestly reporting nothing usable, per this module's never-fabricate firewall.",
            };
          } else {
            result = { success: true, fact: distilled.fact, sourceUrl: distilled.sourceUrl, authority: distilled.authority };
          }
        }
      } catch (e) {
        console.error('[MCP] mnem_ask_browser_authority: threw:', e);
        result = { success: false, authority: args.authority, error: String(e) };
      }
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
      console.log('[MCP] 7 tools registered: mnem_query_substrate, mnem_force_refresh_substrate, mnem_record_qa, mnem_get_substrate_stats, mnem_run_giant_concordance, mnem_share_eblet_to_peer, mnem_ask_browser_authority');
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
