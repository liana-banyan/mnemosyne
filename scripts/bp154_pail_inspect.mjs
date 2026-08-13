#!/usr/bin/env node
// scripts/bp154_pail_inspect.mjs -- throwaway inspection helper, D-BP154-010/BISHOP/S10/seg-thepail.
// Attaches to the live app's CDP target and evaluates an arbitrary expression passed as argv[0].
// Modeled on liana_run_cli.mjs's own CdpClient (same attach mechanism, proven working this session).

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import WebSocket from 'ws';

const port = 9333;

function cdpHttp(p, path) {
  return fetch(`http://127.0.0.1:${p}${path}`).then((r) => r.json());
}

async function findAppPageTarget(p) {
  const targets = await cdpHttp(p, '/json/list');
  const isHelperWindow = (u) => u.startsWith('data:') || u === 'about:blank';
  const isDevRenderer = (u) => /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\]):\d+\//.test(u);
  const pages = targets.filter((t) => t.type === 'page' && !isHelperWindow(t.url));
  const candidate = pages.find((t) => isDevRenderer(t.url));
  if (!candidate) throw new Error('no renderer target found');
  return candidate;
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
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
  bind() {
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
  close() { try { this.ws.close(); } catch { /* noop */ } }
}

async function main() {
  const expr = process.argv[2];
  const target = await findAppPageTarget(port);
  const client = new CdpClient(target.webSocketDebuggerUrl);
  client.bind();
  await client.open();
  await client.send('Runtime.enable');
  const result = await client.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) {
    console.error('EXCEPTION:', JSON.stringify(result.exceptionDetails, null, 2));
    client.close();
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify(result.result?.value, null, 2));
  client.close();
}
main().catch((e) => { console.error('fatal:', e); process.exitCode = 1; });
