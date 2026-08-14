#!/usr/bin/env node
// scripts/bp154_console_watch.mjs -- throwaway diagnostic. Attaches Runtime.consoleAPICalled to a
// named CDP target and prints every console message for N seconds, then exits. Used to watch the
// Gemini guest webview's OWN console directly (bypassing the injection-log IPC relay chain) during
// a live automated dispatch, to see whether webview_preload.ts's code runs there at all.
import WebSocket from 'ws';

class CdpClient {
  constructor(wsUrl) { this.ws = new WebSocket(wsUrl); this.nextId = 1; this.pending = new Map(); this.onEvent = null; }
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
      } else if (msg.method && this.onEvent) {
        this.onEvent(msg.method, msg.params);
      }
    });
  }
  close() { try { this.ws.close(); } catch { /* noop */ } }
}

async function main() {
  const wsUrl = process.argv[2];
  const seconds = Number(process.argv[3] || 20);
  const client = new CdpClient(wsUrl);
  client.bind();
  await client.open();
  client.onEvent = (method, params) => {
    if (method === 'Runtime.consoleAPICalled') {
      const args = (params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
      console.log(`[console.${params.type}] ${args}`);
    }
    if (method === 'Page.frameNavigated') {
      console.log(`[frameNavigated] ${params.frame?.url}`);
    }
    if (method === 'Page.frameStartedLoading') {
      console.log(`[frameStartedLoading] ${params.frameId}`);
    }
  };
  await client.send('Runtime.enable');
  await client.send('Page.enable');
  console.log(`watching for ${seconds}s...`);
  await new Promise((r) => setTimeout(r, seconds * 1000));
  client.close();
}
main().catch((e) => { console.error('fatal:', e); process.exitCode = 1; });
