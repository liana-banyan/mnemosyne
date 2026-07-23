// AMPLIFY Computer — Librarian MCP Bridge
// v0.1.14 SEG-C wiring
//
// Gate J: JSON-RPC query path → brief_me / search_knowledge / pheromone_query
// Gate M: memory/session write path → update_session / scribe_log
//
// The Librarian MCP HTTP wrapper listens on LIBRARIAN_MCP_PORT (default 3001).
// If the server is not running every call returns null/false — never throws.
// Configure with env vars:
//   LIBRARIAN_MCP_HOST  (default: 127.0.0.1)
//   LIBRARIAN_MCP_PORT  (default: 3001)

import { randomUUID } from 'crypto';

// ─── Config ───────────────────────────────────────────────────────────────────

const LIBRARIAN_PORT = parseInt(
  process.env.LIBRARIAN_MCP_PORT ?? '3001',
  10,
);
const LIBRARIAN_HOST = process.env.LIBRARIAN_MCP_HOST ?? '127.0.0.1';
const LIBRARIAN_BASE = `http://${LIBRARIAN_HOST}:${LIBRARIAN_PORT}`;

/** Hard timeout per call — prevents blocking the electron main process. */
const REQUEST_TIMEOUT_MS = 5_000;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LibrarianQueryResult {
  hit: boolean;
  tool: string;
  content?: string;
  raw?: unknown;
  latency_ms: number;
}

export interface LibrarianWriteResult {
  ok: boolean;
  tool: string;
  latency_ms: number;
  error?: string;
}

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string;
  result?: {
    content?: Array<{ type: string; text?: string }>;
    [key: string]: unknown;
  };
  error?: { code: number; message: string; data?: unknown };
}

// ─── Internal: JSON-RPC call ──────────────────────────────────────────────────

async function callMcpTool(
  toolName: string,
  toolArgs: Record<string, unknown>,
): Promise<JsonRpcResponse | null> {
  const body: JsonRpcRequest = {
    jsonrpc: '2.0',
    id: randomUUID(),
    method: 'tools/call',
    params: { name: toolName, arguments: toolArgs },
  };

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${LIBRARIAN_BASE}/jsonrpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(`[mcp-bridge] Librarian HTTP ${res.status} on "${toolName}"`);
      return null;
    }

    return (await res.json()) as JsonRpcResponse;
  } catch (err) {
    const isTimeout = (err as Error).name === 'AbortError';
    if (isTimeout) {
      console.warn(
        `[mcp-bridge] Librarian timeout on "${toolName}" (${REQUEST_TIMEOUT_MS}ms). ` +
        `Is librarian-mcp HTTP wrapper running on ${LIBRARIAN_BASE}?`,
      );
    } else {
      console.warn(
        `[mcp-bridge] Librarian unreachable for "${toolName}": ${String(err)}. ` +
        `Start librarian-mcp or set LIBRARIAN_MCP_PORT env var.`,
      );
    }
    return null;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

/** Extract text payload from a JSON-RPC MCP response. */
function extractText(response: JsonRpcResponse): string | undefined {
  const content = response.result?.content;
  if (Array.isArray(content)) {
    const joined = content
      .filter((c) => c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text as string)
      .join('\n')
      .trim();
    return joined || undefined;
  }
  if (typeof response.result === 'string') return response.result;
  return undefined;
}

// ─── Gate J — Query path ──────────────────────────────────────────────────────
//
// Gate J connects to the Librarian's read surface.
// brief_me  → intent-aware context fetch (~600 word digest)
// search_knowledge → semantic Cathedral search
// pheromone_query  → fast pheromone-trail substrate lookup

/**
 * Gate J: call `brief_me` on the Librarian MCP.
 * Returns a compact context summary for the given task description.
 */
export async function briefMe(task: string): Promise<LibrarianQueryResult> {
  const t0 = Date.now();
  const tool = 'brief_me';

  const response = await callMcpTool(tool, { task });
  const latency_ms = Date.now() - t0;

  if (!response) return { hit: false, tool, latency_ms };

  if (response.error) {
    console.warn(
      `[mcp-bridge] Gate J brief_me error ${response.error.code}: ${response.error.message}`,
    );
    return { hit: false, tool, latency_ms };
  }

  const content = extractText(response);
  return { hit: Boolean(content), tool, content, raw: response.result, latency_ms };
}

/**
 * Gate J: call `search_knowledge` on the Librarian MCP.
 * Semantic search over the Cathedral knowledge base.
 */
export async function searchKnowledge(
  query: string,
  limit = 5,
): Promise<LibrarianQueryResult> {
  const t0 = Date.now();
  const tool = 'search_knowledge';

  const response = await callMcpTool(tool, { query, limit });
  const latency_ms = Date.now() - t0;

  if (!response) return { hit: false, tool, latency_ms };

  if (response.error) {
    console.warn(
      `[mcp-bridge] Gate J search_knowledge error ${response.error.code}: ${response.error.message}`,
    );
    return { hit: false, tool, latency_ms };
  }

  const content = extractText(response);
  return { hit: Boolean(content), tool, content, raw: response.result, latency_ms };
}

/**
 * Gate J: call `pheromone_query` on the Librarian MCP.
 * Fast pheromone-trail substrate lookup (lower latency than brief_me).
 */
export async function pheromoneQuery(query: string): Promise<LibrarianQueryResult> {
  const t0 = Date.now();
  const tool = 'pheromone_query';

  const response = await callMcpTool(tool, { query });
  const latency_ms = Date.now() - t0;

  if (!response) return { hit: false, tool, latency_ms };

  if (response.error) {
    console.warn(
      `[mcp-bridge] Gate J pheromone_query error ${response.error.code}: ${response.error.message}`,
    );
    return { hit: false, tool, latency_ms };
  }

  const content = extractText(response);
  return { hit: Boolean(content), tool, content, raw: response.result, latency_ms };
}

// ─── Gate M — Memory/session write path ───────────────────────────────────────
//
// Gate M connects to the Librarian's write surface.
// update_session     → persist session record to Cathedral Scribes
// scribe_log         → append memory entry to a named Scribe log

/**
 * Gate M: call `update_session` on the Librarian MCP.
 * Persists a session summary (session ID + summary text) into the Cathedral.
 */
export async function updateSession(
  sessionId: string,
  summary: string,
  metadata?: Record<string, unknown>,
): Promise<LibrarianWriteResult> {
  const t0 = Date.now();
  const tool = 'update_session';

  const args: Record<string, unknown> = {
    session_id: sessionId,
    summary,
    ...metadata,
  };

  const response = await callMcpTool(tool, args);
  const latency_ms = Date.now() - t0;

  if (!response) {
    return { ok: false, tool, latency_ms, error: 'librarian_unreachable' };
  }

  if (response.error) {
    console.warn(
      `[mcp-bridge] Gate M update_session error ${response.error.code}: ${response.error.message}`,
    );
    return { ok: false, tool, latency_ms, error: response.error.message };
  }

  return { ok: true, tool, latency_ms };
}

/**
 * Gate M: call `scribe_log` on the Librarian MCP.
 * Appends a memory entry to a named Cathedral Scribe log.
 */
export async function scribeLog(
  scribeId: string,
  content: string,
  tags?: string[],
): Promise<LibrarianWriteResult> {
  const t0 = Date.now();
  const tool = 'scribe_log';

  const args: Record<string, unknown> = { scribe_id: scribeId, content };
  if (tags?.length) args.tags = tags;

  const response = await callMcpTool(tool, args);
  const latency_ms = Date.now() - t0;

  if (!response) {
    return { ok: false, tool, latency_ms, error: 'librarian_unreachable' };
  }

  if (response.error) {
    console.warn(
      `[mcp-bridge] Gate M scribe_log error ${response.error.code}: ${response.error.message}`,
    );
    return { ok: false, tool, latency_ms, error: response.error.message };
  }

  return { ok: true, tool, latency_ms };
}

// ─── Health ───────────────────────────────────────────────────────────────────

/**
 * Returns true if the Librarian MCP HTTP endpoint is reachable.
 * Non-blocking — times out in 2 s.
 */
export async function isLibrarianReachable(): Promise<boolean> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 2_000);
  try {
    const res = await fetch(`${LIBRARIAN_BASE}/health`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

// ─── LibrarianBridge convenience class ───────────────────────────────────────

/**
 * LibrarianBridge — thin stateless wrapper exposing Gate J and Gate M.
 *
 * Usage:
 *   import { librarianBridge } from './mcp_bridge';
 *   const ctx = await librarianBridge.query('cooperative AI session start');
 *   await librarianBridge.logSession('K999', 'built X, landed Y');
 */
export class LibrarianBridge {
  /** Gate J — read surface */
  readonly gateJ = {
    briefMe,
    searchKnowledge,
    pheromoneQuery,
  } as const;

  /** Gate M — write surface */
  readonly gateM = {
    updateSession,
    scribeLog,
  } as const;

  /** Health check */
  isReachable = isLibrarianReachable;

  /**
   * Gate J convenience: try pheromone_query first (fast), fall back to brief_me.
   */
  async query(task: string): Promise<LibrarianQueryResult> {
    const fast = await pheromoneQuery(task);
    if (fast.hit) return fast;
    return briefMe(task);
  }

  /**
   * Gate M convenience: log session closeout to the Librarian Cathedral.
   */
  async logSession(
    sessionId: string,
    summary: string,
  ): Promise<LibrarianWriteResult> {
    return updateSession(sessionId, summary);
  }
}

/** Singleton bridge instance — import and use directly. */
export const librarianBridge = new LibrarianBridge();
