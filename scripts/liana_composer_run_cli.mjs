#!/usr/bin/env node
// scripts/liana_composer_run_cli.mjs -- D-BP154-030/BISHOP-SEG/S30/seg-humannuance
//
// Drives window.amplify.lianaScriptRun(input, steps) over CDP -- THE COMPOSER's own IPC entry
// (preload.ts:792-796 -> 'liana-script-run' -> script_bridge.ts's runScratchComposer()), NOT the
// plain-terminal window.amplify.lianaTerminalRun() scripts/liana_run_cli.mjs already drives (that
// path never runs a stacked, operator-authored step like HumanNuance:1 at all). Modeled
// line-for-line on liana_run_cli.mjs's own CDP attach/eval mechanism (a NEW, separate script --
// liana_run_cli.mjs itself is not modified, per this ticket's own boundary discipline).
//
// Usage:
//   node scripts/liana_composer_run_cli.mjs --qid=98 --steps=StateTheQuestion:1,Softballs:1,NamedSet:1,Discriminator:1,HumanNuance:1,Magnitude:1,Terminator:1 [--port=9333] [--timeoutMs=300000]
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
const steps = (args.get('steps') ?? 'StateTheQuestion:1,Softballs:1,NamedSet:1,Discriminator:1,HumanNuance:1,Magnitude:1,Terminator:1').split(',').filter(Boolean);
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
    throw new Error(`No renderer page target found among ${targets.length} target(s). Targets seen: ${targets.map((t) => `${t.type}:${t.url.slice(0, 60)}`).join(' | ')}`);
  }
  const buildKind = isPackagedRenderer(candidate.url) ? 'PACKAGED (asar)' : 'DEV (source)';
  console.log(`[liana_composer_run_cli] renderer build: ${buildKind} -- ${candidate.url.slice(0, 110)}`);
  return candidate;
}

async function main() {
  const port = discoverPort();
  if (!port) {
    console.error('[liana_composer_run_cli] no CDP port discovered; pass --port <n>');
    process.exitCode = 1;
    return;
  }
  console.log(`[liana_composer_run_cli] CDP port ${port}`);
  console.log(`[liana_composer_run_cli] qid=${qid} steps=${steps.join(',')}`);
  const target = await findAppPageTarget(port);
  console.log(`[liana_composer_run_cli] attached: "${target.title}" (${target.url})`);

  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.open();
  await client.send('Runtime.enable');
  await client.send('Runtime.addBinding', { name: 'liana_composer_run_cli_bridge' });
  client.onBinding = (params) => {
    try {
      const p = JSON.parse(params.payload);
      console.log(`[liana_composer_run_cli][event] ${p.kind}: ${String(p.text).slice(0, 240)}`);
    } catch { /* noop */ }
  };

  const expression = `
    (async () => {
      if (!window.amplify || typeof window.amplify.lianaScriptRun !== 'function') {
        throw new Error('window.amplify.lianaScriptRun is not available on this page');
      }
      const events = [];
      const unsub = window.amplify.onLianaTerminalEvent
        ? window.amplify.onLianaTerminalEvent((evt) => {
            events.push(evt);
            try { window.liana_composer_run_cli_bridge(JSON.stringify({ kind: evt.kind, text: evt.text })); } catch (e) {}
          })
        : () => {};
      try {
        const response = await window.amplify.lianaScriptRun(${JSON.stringify(String(qid))}, ${JSON.stringify(steps)});
        return { response, eventCount: events.length };
      } finally {
        unsub();
      }
    })()
  `;

  const timer = setTimeout(() => {
    console.error(`[liana_composer_run_cli] TIMED OUT after ${timeoutMs}ms`);
    client.close();
    process.exitCode = 1;
  }, timeoutMs);

  let evalResult;
  try {
    evalResult = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  } catch (err) {
    clearTimeout(timer);
    console.error('[liana_composer_run_cli] CDP evaluate failed:', err.message);
    process.exitCode = 1;
    client.close();
    return;
  }
  clearTimeout(timer);
  client.close();

  if (evalResult.exceptionDetails) {
    console.error('[liana_composer_run_cli] run threw:', evalResult.exceptionDetails.exception?.description ?? JSON.stringify(evalResult.exceptionDetails));
    process.exitCode = 1;
    return;
  }
  const resp = evalResult.result?.value?.response;
  console.log(`[liana_composer_run_cli] mode=${resp?.mode}`);
  if (resp?.mode === 'stack') {
    console.log(`[liana_composer_run_cli] result.ok=${resp.result?.ok} error=${resp.result?.error ?? '(none)'}`);
    for (const s of resp.result?.steps ?? []) {
      console.log(`[liana_composer_run_cli]   step ${s.id}: status=${s.status} durationMs=${s.durationMs} whatChanged=${String(s.whatChanged).slice(0, 160)}`);
    }
    console.log('[liana_composer_run_cli] FULL JSON RESULT:');
    console.log(JSON.stringify(resp, null, 2));
  } else {
    console.log('[liana_composer_run_cli] FULL JSON RESPONSE:');
    console.log(JSON.stringify(resp, null, 2));
  }
}
main().catch((err) => { console.error('[liana_composer_run_cli] fatal:', err?.stack ?? err); process.exitCode = 1; });
