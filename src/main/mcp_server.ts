/**
 * MnemosyneC local MCP server — BP081 K-2 scaffold
 * Exposes substrate tools to local MCP clients (Claude Desktop, Cursor, etc.)
 * Default port: 11456. stdio transport also supported via standalone spawn mode.
 * v0.1.61 wires real business logic into tool stubs.
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
    async (_args: { question: string }) => {
      const result: { eblets: Array<{ id: string; answer: string; domain: string; confidence: number }> } = {
        eblets: [],
      };
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
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
      console.log('[MCP] mnem_record_qa called — q:', String(args.question ?? '').slice(0, 60));
      const result: { success: boolean; ebletId?: string; routedTo: 'direct_write' | 'plow_queue' } = {
        success: true,
        routedTo: 'plow_queue',
      };
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
      const result: {
        totalEblets: number;
        verifiedCount: number;
        lastWriteTimestamp: number | null;
        topDomains: Array<{ domain: string; count: number }>;
      } = {
        totalEblets: 0,
        verifiedCount: 0,
        lastWriteTimestamp: null,
        topDomains: [],
      };
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
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
    async (_args: { question: string; candidateAnswer: string }) => {
      const result: {
        verdict: 'verified' | 'rejected' | 'split';
        confidence: number;
        votes: Array<{ voter: number; verdict: string }>;
      } = {
        verdict: 'rejected',
        confidence: 0,
        votes: [],
      };
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
      const result: { success: boolean; reason?: string } = {
        success: false,
        reason: 'not_implemented',
      };
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  return server;
}

// ── HTTP request handler ──────────────────────────────────────────────────────

async function handleMcpHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const clientId = req.socket.remoteAddress || 'unknown';

  // CORS pre-flight
  res.setHeader('Access-Control-Allow-Origin', '127.0.0.1');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept, Mcp-Session-Id');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
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

// ── Lifecycle: startMcpServer / stopMcpServer ─────────────────────────────────

export async function startMcpServer(): Promise<void> {
  if (_running) {
    console.log('[MCP] Server already running');
    return;
  }

  const port = getMcpPort();

  _authToken = loadOrCreateAuthToken();

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
      console.log('[MCP] 5 tools registered: mnem_query_substrate, mnem_record_qa, mnem_get_substrate_stats, mnem_run_giant_concordance, mnem_share_eblet_to_peer');
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
