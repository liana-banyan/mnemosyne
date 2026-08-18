#!/usr/bin/env node
// scripts/bishop_dispatch_poll_reply_cli.mjs — D-BP157-023, HARDWIRE-24 mesh, the return leg's pull.
//
// THE GAP THIS CLOSES: pollForBishopDispatchReply (src/main/federation/bishop_dispatch_reply.ts)
// and its new IPC handler (src/main/federation/bishop_dispatch_poll_ipc.ts,
// 'bishop-dispatch:poll-reply') are the real, offline-tested READ side of the mesh's return leg
// -- but nothing called either of them: no CLI entry point, no npm script, no UI control. This
// script IS that entry point, mirroring scripts/bishop_dispatch_send_cli.mjs verbatim (same
// CDP-attach shape, same reason: window.amplify.* only exists inside an already-running,
// already-preloaded renderer).
//
// REQUIRES the app to be already running with --remote-debugging-port=<port> (see
// bishop_dispatch_send_cli.mjs's own header / package.json's "dev:main:cdp" script).
//
// Usage:
//   node scripts/bishop_dispatch_poll_reply_cli.mjs --routeId=<relay_routes row id> [--timeoutMs=<n>] [--port=<n>]
//
// Prints the reply's stage ('launch' or 'completion'), lifecycle, issues, and (for a completion
// reply) the worker log pointer and tail excerpt. Exit codes: 0 = a reply was found before the
// deadline. 1 = could not attach, validation failed, the poll itself errored, or no reply landed
// before the deadline (distinguishable in the printed output: "NOT FOUND" vs an attach/validation
// failure message).

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import WebSocket from 'ws';

// ─── CLI args ────────────────────────────────────────────────────────────────
const args = new Map();
for (const raw of process.argv.slice(2)) {
  const m = raw.match(/^--([^=]+)=?(.*)$/);
  if (m) args.set(m[1], m[2] === '' ? 'true' : m[2]);
}

const explicitPort = args.has('port') ? Number(args.get('port')) : null;
const routeId = args.get('routeId') ?? '';
const timeoutMs = args.has('timeoutMs') ? Number(args.get('timeoutMs')) : undefined;

if (!routeId) {
  console.error('[cli] missing required argument: --routeId');
  console.error(
    '[cli] usage: node scripts/bishop_dispatch_poll_reply_cli.mjs --routeId=<relay_routes row id> ' +
    '[--timeoutMs=<n>]',
  );
  process.exitCode = 1;
}

// ─── CDP port discovery (copied verbatim from scripts/bishop_dispatch_send_cli.mjs) ──────────
function discoverPort() {
  if (explicitPort) return explicitPort;
  const appData = process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming');
  for (const candidate of ['MnemosyneC', 'amplify-computer']) {
    const p = join(appData, candidate, 'DevToolsActivePort');
    if (existsSync(p)) {
      const firstLine = readFileSync(p, 'utf8').split('\n')[0].trim();
      const port = Number(firstLine);
      if (Number.isFinite(port) && port > 0) return port;
    }
  }
  return null;
}

function cdpHttp(port, path) {
  return fetch(`http://127.0.0.1:${port}${path}`).then((r) => r.json());
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    });
  }
  open() {
    return new Promise((resolve, reject) => {
      this.ws.once('open', resolve);
      this.ws.once('error', reject);
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { try { this.ws.close(); } catch { /* noop */ } }
}

async function findAppPageTarget(port) {
  const targets = await cdpHttp(port, '/json/list');
  const isHelperWindow = (u) => u.startsWith('data:') || u === 'about:blank';
  const isPackagedRenderer = (u) => u.includes('index.html');
  const isDevRenderer = (u) => /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\]):\d+\//.test(u);

  const pages = targets.filter((t) => t.type === 'page' && !isHelperWindow(t.url));
  const candidate =
    pages.find((t) => isPackagedRenderer(t.url)) ?? pages.find((t) => isDevRenderer(t.url));

  if (!candidate) {
    throw new Error(
      `No renderer page target found among ${targets.length} CDP target(s) on port ${port}. ` +
      `Targets seen: ${targets.map((t) => `${t.type}:${t.url.slice(0, 60)}`).join(' | ')}`,
    );
  }
  const buildKind = isPackagedRenderer(candidate.url) ? 'PACKAGED (asar)' : 'DEV (source)';
  console.log(`[cli] renderer build: ${buildKind} -- ${candidate.url.slice(0, 110)}`);
  return candidate;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  if (process.exitCode === 1) return; // arg validation already failed above

  const port = discoverPort();
  if (!port) {
    console.error(
      '[cli] Could not discover a CDP port. Is MnemosyneC running with ' +
      '--remote-debugging-port? Pass --port=<n> explicitly if DevToolsActivePort is not under ' +
      '%APPDATA%\\MnemosyneC or %APPDATA%\\amplify-computer.',
    );
    process.exitCode = 1;
    return;
  }
  console.log(`[cli] discovered CDP port ${port}`);

  const target = await findAppPageTarget(port);
  console.log(`[cli] attached target: "${target.title}" (${target.url})`);

  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.open();
  await client.send('Runtime.enable');

  const reqPayload = { routeId, ...(timeoutMs !== undefined ? { timeoutMs } : {}) };
  console.log(`[cli] polling for reply: routeId=${routeId} timeoutMs=${timeoutMs ?? '(default)'}`);

  const expression = `
    (async () => {
      if (!window.amplify || typeof window.amplify.bishopDispatchPollReply !== 'function') {
        throw new Error('window.amplify.bishopDispatchPollReply is not available on this page -- rebuild/relaunch needed');
      }
      return await window.amplify.bishopDispatchPollReply(${JSON.stringify(reqPayload)});
    })()
  `;

  let evalResult;
  try {
    evalResult = await client.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
  } catch (err) {
    console.error('[cli] CDP evaluate failed:', err.message);
    process.exitCode = 1;
    client.close();
    return;
  }
  client.close();

  if (evalResult.exceptionDetails) {
    console.error('[cli] poll threw:', evalResult.exceptionDetails.exception?.description ?? JSON.stringify(evalResult.exceptionDetails));
    process.exitCode = 1;
    return;
  }

  const result = evalResult.result?.value;
  if (!result || result.ok !== true) {
    console.error(`[cli] POLL FAILED: ${result?.error ?? '(no result value returned)'}`);
    process.exitCode = 1;
    return;
  }

  if (!result.found) {
    console.log(`[cli] NOT FOUND -- no reply landed for routeId=${routeId} before the deadline.`);
    process.exitCode = 1;
    return;
  }

  const a = result.answer;
  console.log(`[cli] REPLY FOUND -- stage=${a.stage} lifecycle=${a.lifecycle} ok=${a.ok} spawned=${a.spawned} processingMs=${result.processingMs}`);
  console.log(`[cli] reason: ${a.reason}`);
  if (a.effectiveId) console.log(`[cli] effectiveId: ${a.effectiveId}`);
  if (Array.isArray(a.issues) && a.issues.length > 0) {
    console.log('[cli] issues:');
    for (const issue of a.issues) {
      console.log(`  - [${issue.code}] ${issue.message} (evidence: ${issue.evidence})`);
    }
  }
  if (a.stage === 'completion') {
    if (a.workerLogPointer) console.log(`[cli] workerLogPointer: ${a.workerLogPointer}`);
    if (a.tailExcerpt) {
      console.log('[cli] tailExcerpt (last captured worker output):');
      console.log(a.tailExcerpt);
    }
  }
}

main().catch((err) => {
  console.error('[cli] fatal:', err?.stack ?? err);
  process.exitCode = 1;
});
