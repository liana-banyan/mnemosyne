#!/usr/bin/env node
// scripts/liana_acquire_fact_cli.mjs -- D-BP154-044/BISHOP-SEG/S44/seg-acquire
//
// Drives window.amplify.lianaAcquireFact(authority, question, mcOptions) over CDP -- the
// standalone acquisition entry point (index.ts's 'liana-acquire-fact' handler). Modeled on
// scripts/liana_composer_run_cli.mjs's own CDP attach/eval mechanism.
//
// Usage:
//   node scripts/liana_acquire_fact_cli.mjs --authority=user_perplexity --question="..." [--port=9333] [--timeoutMs=120000]

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
const authority = args.get('authority') ?? 'user_perplexity';
const question = args.get('question') ?? '';
const timeoutMs = args.has('timeoutMs') ? Number(args.get('timeoutMs')) : 120000;

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
  const candidate = pages.find((t) => isPackagedRenderer(t.url)) ?? pages.find((t) => isDevRenderer(t.url));
  if (!candidate) {
    throw new Error(`No renderer page target found among ${targets.length} target(s).`);
  }
  return candidate;
}

async function main() {
  const port = discoverPort();
  if (!port) {
    console.error('[liana_acquire_fact_cli] no CDP port discovered; pass --port <n>');
    process.exitCode = 1;
    return;
  }
  if (!question) {
    console.error('[liana_acquire_fact_cli] --question is required');
    process.exitCode = 1;
    return;
  }
  console.log(`[liana_acquire_fact_cli] CDP port ${port}`);
  console.log(`[liana_acquire_fact_cli] authority=${authority}`);
  console.log(`[liana_acquire_fact_cli] question=${question}`);
  const target = await findAppPageTarget(port);
  console.log(`[liana_acquire_fact_cli] attached: "${target.title}" (${target.url})`);

  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.open();
  await client.send('Runtime.enable');

  const expression = `
    (async () => {
      if (!window.amplify || typeof window.amplify.lianaAcquireFact !== 'function') {
        throw new Error('window.amplify.lianaAcquireFact is not available on this page');
      }
      const response = await window.amplify.lianaAcquireFact(${JSON.stringify(authority)}, ${JSON.stringify(question)});
      return { response };
    })()
  `;

  const timer = setTimeout(() => {
    console.error(`[liana_acquire_fact_cli] TIMED OUT after ${timeoutMs}ms`);
    client.close();
    process.exitCode = 1;
  }, timeoutMs);

  let evalResult;
  try {
    evalResult = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  } catch (err) {
    clearTimeout(timer);
    console.error('[liana_acquire_fact_cli] CDP evaluate failed:', err.message);
    process.exitCode = 1;
    client.close();
    return;
  }
  clearTimeout(timer);
  client.close();

  if (evalResult.exceptionDetails) {
    console.error('[liana_acquire_fact_cli] run threw:', evalResult.exceptionDetails.exception?.description ?? JSON.stringify(evalResult.exceptionDetails));
    process.exitCode = 1;
    return;
  }
  const resp = evalResult.result?.value?.response;
  console.log('[liana_acquire_fact_cli] FULL JSON RESULT:');
  console.log(JSON.stringify(resp, null, 2));
}
main().catch((err) => { console.error('[liana_acquire_fact_cli] fatal:', err?.stack ?? err); process.exitCode = 1; });
