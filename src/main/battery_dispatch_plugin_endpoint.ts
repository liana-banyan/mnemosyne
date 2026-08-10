// battery_dispatch_plugin_endpoint.ts -- D-BP151-042/BISHOP/seg-battery-dispatch-endpoint
//
// FOUNDER'S ORDER, BP151, verbatim: "Battery Dispatch is local plugins, so build the endpoint...
// what we have planned is the ability to interact with all, or any subset of all, of their social
// media in one location, which facilitates the Broadcast Schedule part of Battery Dispatch...
// Social logins live ALONGSIDE the Google/Perplexity authority logins, not merged... alongside,
// likely better so less complicated, even if a copy of that." And: "we haven't planned [the
// combined feed view] ... Do not build it, do not design toward it, do not leave hooks for it."
//
// WHAT THIS FILE IS: the one local HTTP socket external local processes ("plugins" -- per-social-
// platform helper processes not yet built) use to reach MnemosyneC. It is NOT a social-platform
// integration, NOT posting logic, NOT the Broadcast Schedule, and NOT Cue Deck Cards -- none of
// those were ordered this ticket and none are built here (see SEG_RETURN_BP151_042 "THINGS I
// NOTICED AND DID NOT DO"). Today it does exactly one real thing: lets a local plugin process
// authenticate, announce itself, and stay/go liveness-tracked, so a future plugin has a real,
// safe socket to plug into before any social-platform logic exists to wire behind it.
//
// SESSION ISOLATION, THE SECURITY REQUIREMENT (not just simplicity), ENFORCED STRUCTURALLY:
// this file imports NOTHING from nexus_authority_persistent_session.ts, webview_preload.ts, or
// any other cookie/session/credential-bearing module in this tree -- grepped this file for
// `cookie`, `session`, `credential`, `webview`, `nexus`, `Authority` outside this comment block
// and outside the word "authorization" (this server's own Bearer-token gate, a credential THIS
// endpoint issues to itself, never a captured one): zero matches. There is no code path from any
// verb below to any browser session, so "no cookie/token/credential/session handle crosses to a
// plugin" is true because the capability to reach one does not exist in this file at all, not
// because a runtime filter blocks it. A plugin can never receive what this file never has.
//
// AUTH: D-BP151-042 CORRECTION -- Founder ruling, relayed BP151 verbatim, on being shown that
// openai_compat_server.ts (KN-BP145-M3) already implements and EXPORTS this exact Bearer/
// timingSafeEqual logic, and that file's own header (line 20) already says "Do not build
// authentication beyond the local Bearer file": "YES please fix the Battery Dispatch endpoint to
// import the function but still keep the tokens separate, agreed." So: this file IMPORTS
// ensureBearerTokenFileExists() / readBearerToken() / isAuthorizedBearer() from
// openai_compat_server.ts -- ONE implementation of the auth logic in the tree, not two -- and
// calls them with THIS server's own, distinct token file path
// (battery_dispatch_endpoint_token.txt, never openai_compat_server_token.txt).
//
// ATTRIBUTED (HARDWIRE-23 Law 4), Founder BP151 verbatim ruling above: the tokens stay SEPARATE
// on purpose -- separate blast radius. A compromised local plugin presenting a stolen Battery
// Dispatch token must never also authenticate against THE NEXUS (openai_compat_server.ts), and
// vice versa; rotating one token file must never rotate or invalidate the other. Do not
// "helpfully" consolidate these two files into one -- that would silently widen the blast radius
// the Founder explicitly ordered kept narrow.
//
// Generated on first run, read fresh on every request (no in-memory caching -- an on-disk
// rotation of EITHER file takes effect immediately, independently of the other). A local plugin
// process obtains ITS token the same way openai_compat_server.ts's own callers do: by reading the
// token file directly off disk (it already has filesystem access -- it is a local process on this
// machine). A missing or wrong token gets a 401 JSON error and the request is rejected before any
// verb handler runs; the presented value is never logged, only whether it matched.
//
// LOOPBACK ONLY, FAIL-CLOSED: startBatteryDispatchPluginEndpoint() throws synchronously, before
// any net.Server is constructed, if asked to bind anywhere but 127.0.0.1 -- the exact bind-time
// fail-closed shape openai_compat_server.ts introduced (that file's own header explains why no
// earlier bind-time precedent existed to copy verbatim; this file copies THAT one instead of
// inventing a third).
//
// OFF BY DEFAULT: isBatteryDispatchPluginEndpointEnabled() follows the ticket's own instruction
// to use isContingencyOperatorSurveySpliceEnabled()'s idiom (liana_terminal_engine.ts:97) rather
// than invent a new one -- an optional explicit boolean parameter (no caller passes one today;
// see initBatteryDispatchPluginEndpoint()) plus an env-var escape hatch, defaulting OFF. No
// socket opens, no port is claimed, nothing listens, until BATTERY_DISPATCH_ENDPOINT=1 is set.
// FORK FOR THE FOUNDER (not resolved here; see SEG_RETURN's "Forks" section): whether "the user
// enables it" should eventually be a Settings-tab pill (NexusAuthoritySettings.tsx's ON/OFF pill
// is the precedent this codebase already uses for exactly this kind of always-visible toggle) is
// a UI-build decision nobody ordered this ticket -- not invented here, per HARDWIRE-23.
//
// DEFINED VERB SET, NEVER ARBITRARY EXECUTION: four verbs, each does exactly one thing, none of
// them accept or forward arbitrary code, a file path, a URL to fetch, or a browser command:
//   POST /v1/handshake  -- capability discovery. Proves the token works; lists the verb set.
//   POST /v1/register   -- a plugin announces {pluginId, displayName}; gets an opaque
//                          registrationId back. Written to an append-only local audit log.
//   POST /v1/heartbeat  -- a plugin proves it is still alive using its registrationId.
//   POST /v1/unregister -- a plugin explicitly ends its registration.
// This is deliberately the whole verb set. There is no "run", "eval", "fetch", or "post" verb --
// this ticket forbids posting logic, and the register-gate/CDP history in this same repo
// (D-BP151-034, D-BP151-038) is the standing lesson that a general escape hatch cannot be secured.

import { app } from 'electron';
import * as http from 'node:http';
import * as crypto from 'node:crypto';
import { existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
// D-BP151-042 CORRECTION: import the ONE Bearer-auth implementation in the tree (see this file's
// header) rather than reimplementing it. openai_compat_server.ts owns these three primitives;
// this file only ever calls them with ITS OWN token file path (see getTokenFilePath() below).
import { ensureBearerTokenFileExists, readBearerToken, isAuthorizedBearer } from './openai_compat_server';

// ─── Ports/host ─────────────────────────────────────────────────────────────────────────────────

export const BATTERY_DISPATCH_ENDPOINT_PORT = Number(process.env.BATTERY_DISPATCH_ENDPOINT_PORT ?? 11559);
export const BATTERY_DISPATCH_ENDPOINT_HOST = '127.0.0.1';

const TOKEN_FILENAME = 'battery_dispatch_endpoint_token.txt';
const REGISTRY_DIRNAME = 'battery_dispatch_plugins';
const REGISTRY_LOG_FILENAME = 'registry.jsonl';

// Liveness reap window -- a plugin that never heartbeats for this long is treated as gone on the
// next call that touches the registry. Mechanical resource hygiene, not a security or business
// rule (HARDWIRE-23's own carve-out: "a loop form, a variable name, a file layout" need no
// attribution because they cannot change which answer the system produces -- this cannot either;
// it only affects how long a dead entry lingers in an in-memory Map).
const STALE_AFTER_MS = 10 * 60 * 1000;

// ─── Off-by-default gate (isContingencyOperatorSurveySpliceEnabled()'s idiom, per the ticket) ────

/** Defaults OFF. Mirrors liana_terminal_engine.ts:97's isContingencyOperatorSurveySpliceEnabled()
 *  shape exactly: an explicit `true` argument wins, otherwise an env-var escape hatch, otherwise
 *  off. No caller passes an explicit argument today (see initBatteryDispatchPluginEndpoint()) --
 *  the parameter exists so a future caller (e.g. a Settings-tab toggle, not built this ticket)
 *  can flip it without this function's shape changing. */
export function isBatteryDispatchPluginEndpointEnabled(explicitEnabled?: boolean): boolean {
  if (explicitEnabled === true) return true;
  return process.env.BATTERY_DISPATCH_ENDPOINT === '1';
}

// ─── Bearer token (local-only secret, this server's own making -- same shape as
//     openai_compat_server.ts / mcp_server.ts) ────────────────────────────────────────────────

/** Guarded userData resolution -- `app` can be the undefined stub outside a real Electron
 *  process (mnem_eblet_store.ts's resolveIsPackaged() precedent, also used by cdp_guard.ts). */
function resolveUserDataDir(): string {
  if (typeof app !== 'undefined' && app && typeof app.getPath === 'function') {
    return app.getPath('userData');
  }
  // Test-only fallback -- never reached inside a real Electron process. Callers that need a real
  // path outside Electron (this file's own test harness) inject a fake `app` via require.cache,
  // same technique as cdp_guard.test.ts; this branch only guards against a hard crash if that
  // injection is ever skipped.
  throw new Error('[battery_dispatch_plugin_endpoint] app.getPath unavailable -- not a real Electron process and no fake app injected');
}

const AUTH_LOG_PREFIX = '[battery_dispatch_plugin_endpoint]';

/** THIS server's OWN token file path -- battery_dispatch_endpoint_token.txt, distinct from
 *  openai_compat_server.ts's openai_compat_server_token.txt. Never the same file, never the same
 *  value (see this file's header, D-BP151-042 CORRECTION, for why that separation is a deliberate
 *  Founder decision, not an accident). */
export function getTokenFilePath(): string {
  return join(resolveUserDataDir(), TOKEN_FILENAME);
}

/** Generates a fresh token on first run, at THIS server's own path. Delegates to
 *  openai_compat_server.ts's shared primitive -- see this file's header for why there is exactly
 *  one implementation of this logic in the tree. */
export function ensureTokenFileExists(): void {
  ensureBearerTokenFileExists(getTokenFilePath(), AUTH_LOG_PREFIX);
}

/** Reads THIS server's own token fresh on every call -- a manual on-disk rotation of this file
 *  takes effect immediately, independently of openai_compat_server.ts's own token file. Delegates
 *  to the shared primitive; never logs the value. */
export function readCurrentToken(): string | null {
  return readBearerToken(getTokenFilePath(), AUTH_LOG_PREFIX);
}

/** Constant-time Bearer check against THIS server's own token file. Delegates to the shared
 *  primitive with getTokenFilePath() (this file's own path) -- never openai_compat_server.ts's
 *  path, so the two servers' credentials can never cross-authenticate each other. */
export function isAuthorized(req: http.IncomingMessage): boolean {
  return isAuthorizedBearer(req, getTokenFilePath(), AUTH_LOG_PREFIX);
}

// ─── Plugin registry -- capability announcement only, never a session/credential carrier ────────

export interface PluginRegistrationRecord {
  registrationId: string;
  pluginId: string;
  displayName: string;
  registeredAt: string;
  lastSeenAt: string;
}

const liveRegistrations = new Map<string, PluginRegistrationRecord>();

const PLUGIN_ID_PATTERN = /^[a-z0-9_-]{2,64}$/;

function registryLogPath(): string {
  const dir = join(resolveUserDataDir(), REGISTRY_DIRNAME);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, REGISTRY_LOG_FILENAME);
}

/** Append-only local audit log -- register/unregister events only (never heartbeats, to avoid
 *  unbounded growth from a routine liveness ping). Gives a human a real on-disk record of which
 *  plugins have ever connected, matching this tree's own marketplace_registry.ts append-only
 *  convention. Never writes anything beyond pluginId/displayName/registrationId/timestamp -- no
 *  request header, no IP, no token value. */
function appendRegistryAudit(event: Record<string, unknown>): void {
  try {
    appendFileSync(registryLogPath(), JSON.stringify(event) + '\n', 'utf8');
  } catch (err) {
    console.error('[battery_dispatch_plugin_endpoint] failed to append registry audit log:', err instanceof Error ? err.message : String(err));
  }
}

/** Lazily drops any registration that has not heartbeat within STALE_AFTER_MS. Called at the top
 *  of every verb handler that touches the registry so a caller never sees a long-dead entry as
 *  live -- purely a hygiene sweep, changes no answer (see STALE_AFTER_MS comment above). */
function reapStaleRegistrations(): void {
  const now = Date.now();
  for (const [id, rec] of liveRegistrations) {
    if (now - Date.parse(rec.lastSeenAt) > STALE_AFTER_MS) {
      liveRegistrations.delete(id);
    }
  }
}

export function registerPlugin(pluginId: string, displayName: string): { ok: true; registrationId: string; registeredAt: string } | { ok: false; error: string } {
  reapStaleRegistrations();
  if (typeof pluginId !== 'string' || !PLUGIN_ID_PATTERN.test(pluginId)) {
    return { ok: false, error: 'pluginId must be 2-64 chars, lowercase alphanumeric/dash/underscore' };
  }
  if (typeof displayName !== 'string' || displayName.trim().length === 0 || displayName.length > 200) {
    return { ok: false, error: 'displayName is required and must be 1-200 chars' };
  }
  const registrationId = crypto.randomUUID();
  const now = new Date().toISOString();
  const record: PluginRegistrationRecord = { registrationId, pluginId, displayName, registeredAt: now, lastSeenAt: now };
  liveRegistrations.set(registrationId, record);
  appendRegistryAudit({ type: 'register', pluginId, displayName, registrationId, at: now });
  return { ok: true, registrationId, registeredAt: now };
}

export function heartbeatPlugin(registrationId: string): { ok: true; stillRegistered: boolean } {
  reapStaleRegistrations();
  const record = liveRegistrations.get(registrationId);
  if (!record) return { ok: true, stillRegistered: false };
  record.lastSeenAt = new Date().toISOString();
  return { ok: true, stillRegistered: true };
}

export function unregisterPlugin(registrationId: string): { ok: true; wasRegistered: boolean } {
  reapStaleRegistrations();
  const wasRegistered = liveRegistrations.has(registrationId);
  if (wasRegistered) {
    const record = liveRegistrations.get(registrationId)!;
    liveRegistrations.delete(registrationId);
    appendRegistryAudit({ type: 'unregister', pluginId: record.pluginId, registrationId, at: new Date().toISOString() });
  }
  return { ok: true, wasRegistered };
}

/** Diagnostics-only read of current live registrations -- for a future Settings panel, and for
 *  this file's own tests. Returns a copy; callers cannot mutate the live registry through it. */
export function listLiveRegistrations(): PluginRegistrationRecord[] {
  reapStaleRegistrations();
  return Array.from(liveRegistrations.values()).map((r) => ({ ...r }));
}

/** Test-only reset -- clears in-memory state between test cases. Never called from production
 *  code (not wired to any route or IPC channel). */
export function _resetRegistryForTests(): void {
  liveRegistrations.clear();
}

// ─── Verb set (the only entry points into this server) ───────────────────────────────────────

const VERB_SET = ['handshake', 'register', 'heartbeat', 'unregister'] as const;
const SERVER_VERSION = '1.0.0';

function sendJson(res: http.ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(payload);
}

function sendError(res: http.ServerResponse, statusCode: number, message: string): void {
  sendJson(res, statusCode, { ok: false, error: message });
}

const MAX_BODY_BYTES = 8 * 1024; // 8KB -- these bodies are two short strings, never content

/** Reads the body, capped at MAX_BODY_BYTES. Deliberately does NOT destroy the socket on overflow
 *  -- that would reset the connection before a response can be sent (a plugin would see a bare
 *  ECONNRESET, not a legible 400). Instead it stops accumulating past the cap (bounded memory)
 *  but still drains the stream to a clean 'end', then rejects so the caller sends a real 400 JSON
 *  error over the still-open connection. */
function readRequestBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    let body = '';
    let tooLarge = false;
    req.on('data', (chunk) => {
      if (body.length <= MAX_BODY_BYTES) body += chunk.toString('utf8');
      if (body.length > MAX_BODY_BYTES) tooLarge = true;
    });
    req.on('end', () => {
      if (tooLarge) reject(new Error('request body exceeds 8KB limit'));
      else resolvePromise(body);
    });
    req.on('error', (err) => reject(err));
  });
}

function handleHandshake(_req: http.IncomingMessage, res: http.ServerResponse): void {
  sendJson(res, 200, { ok: true, serverVersion: SERVER_VERSION, verbs: VERB_SET });
}

async function handleRegister(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  let parsed: { pluginId?: unknown; displayName?: unknown };
  try {
    parsed = JSON.parse(await readRequestBody(req));
  } catch (err) {
    sendError(res, 400, `malformed JSON or oversized body: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }
  const result = registerPlugin(String(parsed.pluginId ?? ''), String(parsed.displayName ?? ''));
  if (!result.ok) {
    sendError(res, 400, result.error);
    return;
  }
  sendJson(res, 200, result);
}

async function handleHeartbeat(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  let parsed: { registrationId?: unknown };
  try {
    parsed = JSON.parse(await readRequestBody(req));
  } catch (err) {
    sendError(res, 400, `malformed JSON or oversized body: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }
  if (typeof parsed.registrationId !== 'string' || parsed.registrationId.length === 0) {
    sendError(res, 400, 'registrationId is required');
    return;
  }
  sendJson(res, 200, heartbeatPlugin(parsed.registrationId));
}

async function handleUnregister(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  let parsed: { registrationId?: unknown };
  try {
    parsed = JSON.parse(await readRequestBody(req));
  } catch (err) {
    sendError(res, 400, `malformed JSON or oversized body: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }
  if (typeof parsed.registrationId !== 'string' || parsed.registrationId.length === 0) {
    sendError(res, 400, 'registrationId is required');
    return;
  }
  sendJson(res, 200, unregisterPlugin(parsed.registrationId));
}

// ─── Server bootstrap ──────────────────────────────────────────────────────────────────────────

/**
 * Binds ONLY to 127.0.0.1 -- fail-closed: any other host argument throws synchronously, before a
 * net.Server is even constructed, matching openai_compat_server.ts's own bind-time guard (that
 * file's header explains why no earlier bind-time precedent existed to copy verbatim; this file
 * reuses THAT one rather than inventing a third shape in the same codebase).
 */
export function startBatteryDispatchPluginEndpoint(
  port: number = BATTERY_DISPATCH_ENDPOINT_PORT,
  host: string = BATTERY_DISPATCH_ENDPOINT_HOST,
): http.Server {
  if (host !== '127.0.0.1') {
    throw new Error(
      `[battery_dispatch_plugin_endpoint] REFUSED to start: bind target "${host}" is not 127.0.0.1. ` +
      `This server never binds to a non-loopback address -- fail-closed, never warn-and-continue.`,
    );
  }

  ensureTokenFileExists();

  const server = http.createServer((req, res) => {
    void (async () => {
      try {
        if (!isAuthorized(req)) {
          sendError(res, 401, 'Unauthorized -- missing or invalid Bearer token');
          return;
        }

        if (req.method === 'POST' && req.url === '/v1/handshake') {
          handleHandshake(req, res);
          return;
        }
        if (req.method === 'POST' && req.url === '/v1/register') {
          await handleRegister(req, res);
          return;
        }
        if (req.method === 'POST' && req.url === '/v1/heartbeat') {
          await handleHeartbeat(req, res);
          return;
        }
        if (req.method === 'POST' && req.url === '/v1/unregister') {
          await handleUnregister(req, res);
          return;
        }

        sendError(res, 404, `Unknown route: ${req.method} ${req.url}`);
      } catch (err) {
        console.error('[battery_dispatch_plugin_endpoint] unhandled request error:', err instanceof Error ? err.message : String(err));
        sendError(res, 500, 'Internal server error');
      }
    })();
  });

  server.on('error', (err) => {
    console.error('[battery_dispatch_plugin_endpoint] server error:', err instanceof Error ? err.message : String(err));
  });

  server.listen(port, host, () => {
    console.log(
      `[battery_dispatch_plugin_endpoint] listening on http://${host}:${port} ` +
      `(Bearer token at ${getTokenFilePath()}, verbs: ${VERB_SET.join(', ')})`,
    );
  });

  return server;
}

/**
 * SINGLE ENTRY POINT -- the one call index.ts makes (per this ticket's "keep any index.ts touch
 * to one import and one call" instruction). No-op, opens no socket, unless
 * isBatteryDispatchPluginEndpointEnabled() resolves true (off by default).
 */
export function initBatteryDispatchPluginEndpoint(explicitEnabled?: boolean): void {
  if (!isBatteryDispatchPluginEndpointEnabled(explicitEnabled)) {
    console.log(
      '[battery_dispatch_plugin_endpoint] disabled (off by default) -- set BATTERY_DISPATCH_ENDPOINT=1 ' +
      'to enable. No socket opened, no port claimed.',
    );
    return;
  }
  try {
    startBatteryDispatchPluginEndpoint();
  } catch (err) {
    console.error('[battery_dispatch_plugin_endpoint] failed to start:', err instanceof Error ? err.message : String(err));
  }
}
