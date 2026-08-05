// openai_compat_server.ts -- KN-BP145-M3, THE NEXUS, the involuntary read path.
//
// HardWire: HARDWIRE-04_THE_YOKE_MUTUAL_MONITORING.md, Layer 3. Design pass: BP135, Yoke #33.
//
// A local-only OpenAI-compatible HTTP server. Any third-party AI client or app that supports
// setting a custom `base_url` (the OpenAI SDK convention) can point it at this server and
// transparently receive MnemosyneC's verified-substrate context folded into its system prompt,
// with zero custom SDK required on the caller's side.
//
// Binds ONLY to 127.0.0.1. Refuses (throws) rather than warns if asked to bind anywhere else --
// no literal bind-time fail-closed precedent existed elsewhere in this codebase to copy verbatim
// (see KN-BP145-M3_REPORT.md Section 4 for the exhaustive search and honest gap statement); the
// nearest real analog is substrate_api.ts's per-request loopback check at its
// POST /mesh/progress/update route, which is request-time, not bind-time. This file adds the
// bind-time version.
//
// Auth: a single local Bearer-token file, generated on first run, read fresh on every request
// (no in-memory caching, so a manual token rotation on disk takes effect immediately with no
// restart). No other auth mechanism exists here by design -- see the ticket's own refusal:
// "Do not build authentication beyond the local Bearer file."
//
// Substrate injection: opt-out by default (request field `substrate_injection: false` to skip),
// via queryVerifiedEbletsTopical (mnem_eblet_store.ts) -- the topical/quarantined sibling of
// queryVerifiedEblets, never the exact-match function, so this server can never hand a caller
// an answer-key-shaped hit verbatim. Injection folds hits into the system message using the
// EXACT same string-build pattern ai_dispatch_ipc.ts already uses for the Ask tab (see that
// file's `verifiedContext` construction) -- this file does not invent a new injection style.
//
// Local model routing: the corrected callOllama (canonical_pipeline.ts), which carries the
// think:false fix (with a graceful HTTP-400 fallback for older Ollama daemons that reject the
// field outright). callOllama takes a single flat prompt string, not a messages array, so
// incoming OpenAI `messages` are flattened before the call.
//
// Cloud model routing: BYO-key via the existing persisted-key pattern (user_anthropic_key.ts),
// reused as-is -- zero adaptation needed, since this server's module code runs inside the same
// Electron main process (started from index.ts's INIT-CALL APPEND ZONE, after app.whenReady()),
// which is exactly the context that pattern already assumes (electron.safeStorage +
// app.getPath('userData')).

import * as http from 'node:http';
import * as crypto from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

import { getBrainRegistry, getActiveBrain, type BrainEntry } from './brain_registry/brain_registry';
import { resolveAnthropicApiKey } from './user_anthropic_key';
import { callOllama } from './plow/canonical_pipeline';
import { queryVerifiedEbletsTopical, type VerifiedEbletEntry } from './mnem_eblet_store';

export const OPENAI_COMPAT_SERVER_PORT = Number(process.env.OPENAI_COMPAT_PORT ?? 11535);
export const OPENAI_COMPAT_SERVER_HOST = '127.0.0.1';

const TOKEN_FILENAME = 'openai_compat_server_token.txt';

// ─── Bearer token (local-only secret, this app's own making) ──────────────────────────────────

export function getTokenFilePath(): string {
  return join(app.getPath('userData'), TOKEN_FILENAME);
}

/** Generates a fresh token on first run. Never logs the value. */
function ensureTokenFileExists(): void {
  const filePath = getTokenFilePath();
  if (existsSync(filePath)) return;
  const token = crypto.randomBytes(32).toString('hex');
  mkdirSync(join(filePath, '..'), { recursive: true });
  writeFileSync(filePath, token, { encoding: 'utf8', mode: 0o600 });
  console.log(`[openai_compat_server] generated a new Bearer token at ${filePath} (value never logged)`);
}

/**
 * Reads the token fresh on every call -- a manual on-disk rotation takes effect immediately.
 * Exported so that in-process agent-side clients (e.g. LocalRuntimeClient, KN-BP145-P3) can
 * attach the same Bearer token when their base_url is pointed at this server, without a second
 * token-file implementation. Never logs the value.
 */
export function readCurrentToken(): string | null {
  try {
    const filePath = getTokenFilePath();
    if (!existsSync(filePath)) return null;
    return readFileSync(filePath, 'utf8').trim();
  } catch (err) {
    console.error('[openai_compat_server] failed to read token file:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

function isAuthorized(req: http.IncomingMessage): boolean {
  const header = req.headers['authorization'];
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
  const presented = header.slice('Bearer '.length).trim();
  const current = readCurrentToken();
  if (!current || !presented) return false;
  // Constant-time comparison, only when lengths already match (timingSafeEqual throws otherwise).
  const a = Buffer.from(presented, 'utf8');
  const b = Buffer.from(current, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ─── Request/response helpers ──────────────────────────────────────────────────────────────────

function sendJson(res: http.ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(payload);
}

function sendOpenAiError(res: http.ServerResponse, statusCode: number, message: string, type = 'invalid_request_error'): void {
  sendJson(res, statusCode, { error: { message, type } });
}

function readRequestBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk.toString('utf8'); });
    req.on('end', () => resolve(body));
    req.on('error', (err) => reject(err));
  });
}

// ─── OpenAI-compatible types (minimum viable, non-streaming) ──────────────────────────────────

interface OpenAiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAiChatCompletionRequest {
  model?: string;
  messages: OpenAiChatMessage[];
  temperature?: number;
  max_tokens?: number;
  /** Non-standard, additive field, documented here: default/absent = substrate injection ON.
   *  Set to false to opt out of queryVerifiedEbletsTopical() injection for this request. */
  substrate_injection?: boolean;
  /** Non-standard, additive field: the domain hint queryVerifiedEbletsTopical() folds into its
   *  keyword scoring. Defaults to 'general', the same fallback literal index.ts's own
   *  eblet_topical WAN-relay handler uses for this exact function. */
  domain?: string;
}

// ─── Brain resolution ───────────────────────────────────────────────────────────────────────────

function resolveBrain(requestedModel: string | undefined): BrainEntry | undefined {
  const brains = getBrainRegistry();
  if (requestedModel) {
    const byId = brains.find((b) => b.brain_id === requestedModel || b.model_id === requestedModel);
    if (byId) return byId;
  }
  return getActiveBrain();
}

// ─── Substrate injection (mirrors ai_dispatch_ipc.ts's verifiedContext fold, not a new style) ──

async function buildVerifiedContext(userQuestion: string, domain: string): Promise<{ context: string; hits: VerifiedEbletEntry[] }> {
  let hits: VerifiedEbletEntry[] = [];
  try {
    hits = await queryVerifiedEbletsTopical(userQuestion, domain, 3);
  } catch (err) {
    console.warn('[openai_compat_server] queryVerifiedEbletsTopical failed (non-fatal, no injection this request):', err);
  }
  if (hits.length === 0) return { context: '', hits };
  const context =
    'Based on previously-verified knowledge:\n\n' +
    hits.map((h) => `Q: ${h.question}\nA: ${h.answer}`).join('\n\n') +
    '\n\nNow answer the following question:\n\n';
  return { context, hits };
}

// ─── Message flattening for callOllama's flat-prompt signature ────────────────────────────────

function flattenMessagesToPrompt(messages: OpenAiChatMessage[], injectedSystemContent: string): string {
  const lines: string[] = [];
  const systemMsg = messages.find((m) => m.role === 'system');
  const combinedSystem = injectedSystemContent + (systemMsg?.content ?? '');
  if (combinedSystem.trim().length > 0) lines.push(`System: ${combinedSystem}`);
  for (const m of messages) {
    if (m.role === 'system') continue;
    const roleLabel = m.role === 'user' ? 'User' : 'Assistant';
    lines.push(`${roleLabel}: ${m.content}`);
  }
  lines.push('Assistant:');
  return lines.join('\n\n');
}

// ─── Cloud (Anthropic) dispatch -- mirrors ai_dispatch_ipc.ts's dispatchViaBrain flagship branch,
//     not a new invented request shape; reuses resolveAnthropicApiKey() as-is ─────────────────

async function dispatchToCloudBrain(
  brain: BrainEntry,
  messages: OpenAiChatMessage[],
  injectedSystemContent: string,
  maxTokens: number,
): Promise<{ content: string; inputTokens: number | null; outputTokens: number | null; error: string | null }> {
  const apiKey = resolveAnthropicApiKey();
  if (!apiKey) {
    return { content: '', inputTokens: null, outputTokens: null, error: 'No Anthropic API key configured -- set your own key via the existing persisted-key pattern (user_anthropic_key.ts) to use a cloud brain through this server.' };
  }

  const systemMsg = messages.find((m) => m.role === 'system');
  const combinedSystem = injectedSystemContent + (systemMsg?.content ?? '');
  const chatMsgs = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));

  const body: Record<string, unknown> = {
    model: brain.model_id,
    max_tokens: maxTokens,
    messages: chatMsgs,
  };
  if (combinedSystem.trim().length > 0) body['system'] = combinedSystem;

  try {
    const res = await fetch(`${brain.api_endpoint}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      return { content: '', inputTokens: null, outputTokens: null, error: `Anthropic HTTP ${res.status}: ${errText.slice(0, 200)}` };
    }
    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const textBlock = (data.content ?? []).find((b) => b.type === 'text');
    return {
      content: textBlock?.text ?? '',
      inputTokens: data.usage?.input_tokens ?? null,
      outputTokens: data.usage?.output_tokens ?? null,
      error: null,
    };
  } catch (err) {
    return { content: '', inputTokens: null, outputTokens: null, error: String(err) };
  }
}

// ─── Route handlers ─────────────────────────────────────────────────────────────────────────────

function handleGetModels(_req: http.IncomingMessage, res: http.ServerResponse): void {
  // Live-sourced, never a hardcoded list -- see KN-BP145-M3_REPORT.md Section 2.
  const brains = getBrainRegistry();
  const data = brains.map((b) => ({
    id: b.brain_id,
    object: 'model',
    created: 0,
    owned_by: b.vendor,
  }));
  sendJson(res, 200, { object: 'list', data });
}

async function handleChatCompletions(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  let parsed: OpenAiChatCompletionRequest;
  try {
    const raw = await readRequestBody(req);
    parsed = JSON.parse(raw) as OpenAiChatCompletionRequest;
  } catch {
    sendOpenAiError(res, 400, 'Malformed JSON request body');
    return;
  }

  if (!Array.isArray(parsed.messages) || parsed.messages.length === 0) {
    sendOpenAiError(res, 400, '"messages" must be a non-empty array');
    return;
  }

  const brain = resolveBrain(parsed.model);
  if (!brain) {
    sendOpenAiError(res, 400, `No brain resolved for model "${parsed.model ?? '<none>'}" -- brain_registry is empty`);
    return;
  }

  const lastUserMessage = [...parsed.messages].reverse().find((m) => m.role === 'user');
  const userQuestion = lastUserMessage?.content ?? '';
  const domain = typeof parsed.domain === 'string' && parsed.domain.trim().length > 0 ? parsed.domain : 'general';

  // Substrate injection: opt-out by default is ON. Only an EXPLICIT `substrate_injection: false`
  // skips it -- absence of the field, or any other value, is treated as opt-in (ticket's own
  // wording: "opt-out by default").
  let injectedContext = '';
  let hotHits = 0;
  if (parsed.substrate_injection !== false && userQuestion.length > 0) {
    const { context, hits } = await buildVerifiedContext(userQuestion, domain);
    injectedContext = context;
    hotHits = hits.length;
  }

  const temperature = typeof parsed.temperature === 'number' ? parsed.temperature : 0.7;
  const maxTokens = typeof parsed.max_tokens === 'number' ? parsed.max_tokens : 1024;

  const t0 = Date.now();
  let content = '';
  let error: string | null = null;
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;

  if (brain.kind === 'local') {
    const prompt = flattenMessagesToPrompt(parsed.messages, injectedContext);
    const result = await callOllama(prompt, brain.api_endpoint, brain.model_id, temperature, maxTokens);
    if (result === null) {
      error = `Local Ollama brain "${brain.brain_id}" (${brain.model_id}) returned no result -- check the Ollama daemon is running at ${brain.api_endpoint}`;
    } else {
      content = result;
    }
  } else {
    const result = await dispatchToCloudBrain(brain, parsed.messages, injectedContext, maxTokens);
    content = result.content;
    error = result.error;
    inputTokens = result.inputTokens;
    outputTokens = result.outputTokens;
  }

  const latencyMs = Date.now() - t0;

  if (error) {
    console.warn(`[openai_compat_server] chat.completions error, brain=${brain.brain_id} latency_ms=${latencyMs}:`, error);
    sendOpenAiError(res, 502, error, 'upstream_error');
    return;
  }

  console.log(
    `[openai_compat_server] chat.completions ok, brain=${brain.brain_id} kind=${brain.kind} hotHits=${hotHits} latency_ms=${latencyMs}`,
  );

  sendJson(res, 200, {
    id: `chatcmpl-${crypto.randomBytes(12).toString('hex')}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: brain.brain_id,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content },
        finish_reason: 'stop',
      },
    ],
    usage: {
      // Local (Ollama, via callOllama) reports no token counts today -- 0, not fabricated.
      prompt_tokens: inputTokens ?? 0,
      completion_tokens: outputTokens ?? 0,
      total_tokens: (inputTokens ?? 0) + (outputTokens ?? 0),
    },
  });
}

// ─── Server bootstrap ──────────────────────────────────────────────────────────────────────────

/**
 * Starts THE NEXUS. Binds ONLY to 127.0.0.1 -- fail-closed: any other host argument throws
 * synchronously, before a net.Server is even constructed, rather than warning and continuing
 * with a public bind. See this file's header comment for why no literal existing bind-time
 * precedent was found to copy verbatim.
 */
export function startOpenAiCompatServer(
  port: number = OPENAI_COMPAT_SERVER_PORT,
  host: string = OPENAI_COMPAT_SERVER_HOST,
): http.Server {
  if (host !== '127.0.0.1') {
    throw new Error(
      `[openai_compat_server] REFUSED to start: bind target "${host}" is not 127.0.0.1. ` +
      `This server never binds to a non-loopback address -- fail-closed, never warn-and-continue.`,
    );
  }

  ensureTokenFileExists();

  const server = http.createServer((req, res) => {
    void (async () => {
      try {
        if (!isAuthorized(req)) {
          sendOpenAiError(res, 401, 'Unauthorized -- missing or invalid Bearer token', 'authentication_error');
          return;
        }

        if (req.method === 'GET' && req.url === '/v1/models') {
          handleGetModels(req, res);
          return;
        }

        if (req.method === 'POST' && req.url === '/v1/chat/completions') {
          await handleChatCompletions(req, res);
          return;
        }

        sendOpenAiError(res, 404, `Unknown route: ${req.method} ${req.url}`, 'not_found_error');
      } catch (err) {
        console.error('[openai_compat_server] unhandled request error:', err instanceof Error ? err.message : String(err));
        sendOpenAiError(res, 500, 'Internal server error', 'server_error');
      }
    })();
  });

  server.on('error', (err) => {
    console.error('[openai_compat_server] server error:', err instanceof Error ? err.message : String(err));
  });

  server.listen(port, host, () => {
    console.log(`[openai_compat_server] THE NEXUS listening on http://${host}:${port} (Bearer token at ${getTokenFilePath()})`);
  });

  return server;
}

/** No-arg init(), the KN-BP145-E convention for the INIT-CALL APPEND ZONE. */
export function initOpenAiCompatServer(): void {
  try {
    startOpenAiCompatServer();
  } catch (err) {
    console.error('[openai_compat_server] failed to start:', err instanceof Error ? err.message : String(err));
  }
}
