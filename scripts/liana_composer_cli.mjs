#!/usr/bin/env node
// scripts/liana_composer_cli.mjs -- D-BP154-013/BISHOP-SEG/S13/seg-composerstep.
//
// Drives window.amplify.lianaScriptRun(input, steps) over Chrome DevTools Protocol (CDP), same
// attach mechanism as this folder's own liana_run_cli.mjs (which drives lianaTerminalRun, the
// DEFAULT/no-stack path) -- this is the COMPOSER path, used to prove a stacked step (e.g.
// 'Softballs:1') actually runs in the live app, not merely that its unit tests pass. Zero main-
// process/preload/renderer files touched by this script.
//
// Usage:
//   node scripts/liana_composer_cli.mjs --input="<free text or qid>" --steps=Softballs:1[,Other:1] [--port=9333] [--timeoutMs=300000]

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import WebSocket from 'ws';

const args = new Map();
for (const raw of process.argv.slice(2)) {
  const m = raw.match(/^--([^=]+)=?([\s\S]*)$/);
  if (m) args.set(m[1], m[2] === '' ? 'true' : m[2]);
}

const explicitPort = args.has('port') ? Number(args.get('port')) : null;
const input = args.get('input') ?? '98';
const steps = (args.get('steps') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const timeoutMs = args.has('timeoutMs') ? Number(args.get('timeoutMs')) : 5 * 60 * 1000;

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

async function findAppPageTarget(port) {
  const targets = await cdpHttp(port, '/json/list');
  const isHelperWindow = (u) => u.startsWith('data:') || u === 'about:blank';
  const isPackagedRenderer = (u) => u.includes('index.html');
  const isDevRenderer = (u) => /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\]):\d+\//.test(u);
  const pages = targets.filter((t) => t.type === 'page' && !isHelperWindow(t.url));
  const candidate = pages.find((t) => isPackagedRenderer(t.url)) ?? pages.find((t) => isDevRenderer(t.url));
  if (!candidate) {
    throw new Error(
      `No renderer page target found among ${targets.length} target(s). `
      + `Targets seen: ${targets.map((t) => `${t.type}:${t.url.slice(0, 60)}`).join(' | ')}`,
    );
  }
  return candidate;
}

async function main() {
  const port = discoverPort();
  if (!port) {
    console.error('[liana_composer_cli] no CDP port discovered; pass --port <n>');
    process.exitCode = 1;
    return;
  }
  console.log(`[liana_composer_cli] CDP port ${port}`);
  const target = await findAppPageTarget(port);
  console.log(`[liana_composer_cli] attached: "${target.title}" (${target.url})`);

  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.open();
  await client.send('Runtime.enable');
  await client.send('Runtime.addBinding', { name: 'liana_composer_cli_bridge' });
  client.onBinding = (params) => {
    try {
      const p = JSON.parse(params.payload);
      console.log(`[liana_composer_cli][event] ${p.kind}: ${String(p.text).slice(0, 300)}`);
    } catch { /* noop */ }
  };

  const expression = `
    (async () => {
      if (!window.amplify || typeof window.amplify.lianaScriptRun !== 'function') {
        throw new Error('window.amplify.lianaScriptRun is not available on this page');
      }
      const events = [];
      const unsub = window.amplify.onLianaTerminalEvent((evt) => {
        events.push(evt);
        try { window.liana_composer_cli_bridge(JSON.stringify({ kind: evt.kind, text: evt.text })); } catch (e) {}
      });
      try {
        const response = await window.amplify.lianaScriptRun(${JSON.stringify(input)}, ${JSON.stringify(steps)});
        return { response, eventCount: events.length };
      } finally {
        unsub();
      }
    })()
  `;

  const timer = setTimeout(() => {
    console.error(`[liana_composer_cli] TIMED OUT after ${timeoutMs}ms`);
    client.close();
    process.exitCode = 1;
  }, timeoutMs);

  let evalResult;
  try {
    evalResult = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  } catch (err) {
    clearTimeout(timer);
    console.error('[liana_composer_cli] CDP evaluate failed:', err.message);
    process.exitCode = 1;
    client.close();
    return;
  }
  clearTimeout(timer);
  client.close();

  if (evalResult.exceptionDetails) {
    console.error('[liana_composer_cli] run threw:', evalResult.exceptionDetails.exception?.description ?? JSON.stringify(evalResult.exceptionDetails));
    process.exitCode = 1;
    return;
  }
  const resp = evalResult.result?.value;
  console.log(`[liana_composer_cli] FULL RESPONSE JSON:\n${JSON.stringify(resp, null, 2)}`);
}
main().catch((err) => { console.error('[liana_composer_cli] fatal:', err?.stack ?? err); process.exitCode = 1; });
