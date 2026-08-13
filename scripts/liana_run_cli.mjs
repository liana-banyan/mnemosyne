#!/usr/bin/env node
// scripts/liana_run_cli.mjs — D-BP154-004/BISHOP-SEG/S4/seg-runqid98.
//
// Drives window.amplify.lianaTerminalRun(input, audible, steppedAudible,
// contingencyOperatorSurvey, ambiguityQueryTransport) over Chrome DevTools Protocol (CDP),
// modeled line-for-line on this same folder's scripts/mesh-test-cli.mjs, which already proves
// this attach mechanism works against this exact app (a different IPC call,
// window.amplify.meshTestRunOneClick). Zero main-process/preload files touched by this script.
//
// Argument shape verified directly against source this session, not copied on trust:
//   - preload.ts (~line 760-782): the bridge forwards exactly
//     (input, audible, steppedAudible, contingencyOperatorSurvey, ambiguityQueryTransport) —
//     'mode' is NOT part of the preload signature at all.
//   - src/main/index.ts safeHandle('liana-terminal-run', ...) (~line 3799): destructures
//     { input, audible, steppedAudible, contingencyOperatorSurvey, ambiguityQueryTransport, mode }
//     — 'mode' is only reachable server-side and always arrives undefined from any renderer/CDP
//     caller, defaulting to 'automated'. Matches every existing qid-98 receipt's
//     "MODE: AUTOMATED" transcript line.
//
// audible/steppedAudible MUST be false — either true opens a human-only pause
// (onLianaAudiblePause / lianaAudibleRespond) that a headless script can never answer.
// contingencyOperatorSurvey/ambiguityQueryTransport MUST be undefined (never an explicit value),
// per preload.ts's own comment: an explicit value short-circuits the env-var default.
//
// Usage:
//   node scripts/liana_run_cli.mjs [--qid=98] [--port=9333] [--timeoutMs=300000]
//
// Exit codes: 0 = run completed (any verdict, including abstain) and the outcome was returned.
// 1 = could not attach, run did not complete, or the app reported a thrown error.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import WebSocket from 'ws';

const args = new Map();
for (const raw of process.argv.slice(2)) {
  const m = raw.match(/^--([^=]+)=?(.*)$/);
  if (m) args.set(m[1], m[2] === '' ? 'true' : m[2]);
}

const explicitPort = args.has('port') ? Number(args.get('port')) : null;
const qid = args.get('qid') ?? '98';
const timeoutMs = args.has('timeoutMs') ? Number(args.get('timeoutMs')) : 5 * 60 * 1000; // measured real runs: 116-152s

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
    this.onBinding = null;
    this.ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method === 'Runtime.bindingCalled' && this.onBinding) {
        this.onBinding(msg.params);
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

// Same matcher logic as mesh-test-cli.mjs's findAppPageTarget() — accepts either a packaged
// renderer (index.html) or a dev renderer (loopback http origin), and explicitly excludes the
// hidden nexus-authority helper window (data:/about:blank).
async function findAppPageTarget(port) {
  const targets = await cdpHttp(port, '/json/list');
  const isHelperWindow = (u) => u.startsWith('data:') || u === 'about:blank';
  const isPackagedRenderer = (u) => u.includes('index.html');
  const isDevRenderer = (u) => /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\]):\d+\//.test(u);
  const pages = targets.filter((t) => t.type === 'page' && !isHelperWindow(t.url));
  const candidate = pages.find((t) => isPackagedRenderer(t.url)) ?? pages.find((t) => isDevRenderer(t.url));
  if (!candidate) {
    throw new Error(
      `No renderer page target found among ${targets.length} target(s). ` +
      `Targets seen: ${targets.map((t) => `${t.type}:${t.url.slice(0, 60)}`).join(' | ')}`,
    );
  }
  const buildKind = isPackagedRenderer(candidate.url) ? 'PACKAGED (asar)' : 'DEV (source)';
  console.log(`[liana_run_cli] renderer build: ${buildKind} -- ${candidate.url.slice(0, 110)}`);
  return candidate;
}

async function main() {
  const port = discoverPort();
  if (!port) {
    console.error('[liana_run_cli] no CDP port discovered; pass --port <n>');
    process.exitCode = 1;
    return;
  }
  console.log(`[liana_run_cli] CDP port ${port}`);
  const target = await findAppPageTarget(port);
  console.log(`[liana_run_cli] attached: "${target.title}" (${target.url})`);

  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.open();
  await client.send('Runtime.enable');
  await client.send('Runtime.addBinding', { name: 'liana_run_cli_bridge' });
  client.onBinding = (params) => {
    try {
      const p = JSON.parse(params.payload);
      console.log(`[liana_run_cli][event] ${p.kind}: ${String(p.text).slice(0, 200)}`);
    } catch { /* noop */ }
  };

  // Pre-flight: confirm the Nexus authority sign-in status BEFORE triggering the run. This is
  // reported back to the caller (stdout, marked so it's greppable) — the caller (Bishop SEG)
  // decides whether to proceed based on this, per D-BP154-004's explicit gate instruction.
  const signInExpr = `
    (async () => {
      if (!window.amplify || typeof window.amplify.checkNexusAuthoritySignInStatus !== 'function') {
        return { unavailable: true };
      }
      return await window.amplify.checkNexusAuthoritySignInStatus();
    })()
  `;
  const signInResult = await client.send('Runtime.evaluate', { expression: signInExpr, awaitPromise: true, returnByValue: true });
  console.log(`[liana_run_cli] NEXUS_SIGNIN_STATUS: ${JSON.stringify(signInResult.result?.value)}`);

  if (args.get('checkOnly') === 'true') {
    client.close();
    return;
  }

  const expression = `
    (async () => {
      if (!window.amplify || typeof window.amplify.lianaTerminalRun !== 'function') {
        throw new Error('window.amplify.lianaTerminalRun is not available on this page');
      }
      const events = [];
      const unsub = window.amplify.onLianaTerminalEvent((evt) => {
        events.push(evt);
        try { window.liana_run_cli_bridge(JSON.stringify({ kind: evt.kind, text: evt.text })); } catch (e) {}
      });
      try {
        const outcome = await window.amplify.lianaTerminalRun(${JSON.stringify(String(qid))}, false, false, undefined, undefined);
        return { outcome, eventCount: events.length };
      } finally {
        unsub();
      }
    })()
  `;

  const timer = setTimeout(() => {
    console.error(`[liana_run_cli] TIMED OUT after ${timeoutMs}ms`);
    client.close();
    process.exitCode = 1;
  }, timeoutMs);

  let evalResult;
  try {
    evalResult = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  } catch (err) {
    clearTimeout(timer);
    console.error('[liana_run_cli] CDP evaluate failed:', err.message);
    process.exitCode = 1;
    client.close();
    return;
  }
  clearTimeout(timer);
  client.close();

  if (evalResult.exceptionDetails) {
    console.error('[liana_run_cli] run threw:', evalResult.exceptionDetails.exception?.description ?? JSON.stringify(evalResult.exceptionDetails));
    process.exitCode = 1;
    return;
  }
  const resp = evalResult.result?.value;
  console.log(`[liana_run_cli] outcome: verdict=${resp?.outcome?.verdict} correct=${resp?.outcome?.correct} ok=${resp?.outcome?.ok} abstain=${resp?.outcome?.abstain}`);
  console.log('[liana_run_cli] the full receipt was already written to disk by the main process.');
}
main().catch((err) => { console.error('[liana_run_cli] fatal:', err?.stack ?? err); process.exitCode = 1; });
