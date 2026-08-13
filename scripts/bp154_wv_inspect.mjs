#!/usr/bin/env node
// scripts/bp154_wv_inspect.mjs -- throwaway diagnostic. Evaluates JS directly inside a specific
// CDP target (e.g. the Gemini guest webview) given its own ws debugger URL.
import WebSocket from 'ws';

class CdpClient {
  constructor(wsUrl) { this.ws = new WebSocket(wsUrl); this.nextId = 1; this.pending = new Map(); }
  open() { return new Promise((res, rej) => { this.ws.once('open', res); this.ws.once('error', rej); }); }
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
        if (msg.error) reject(new Error(JSON.stringify(msg.error))); else resolve(msg.result);
      }
    });
  }
  close() { try { this.ws.close(); } catch { /* noop */ } }
}

async function main() {
  const wsUrl = process.argv[2];
  const expr = process.argv[3];
  const client = new CdpClient(wsUrl);
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
