#!/usr/bin/env node
// scripts/bp154_bring_to_front.mjs -- throwaway. Calls CDP Page.bringToFront on the given target so
// a hidden/backgrounded Electron BrowserWindow actually composites before Page.captureScreenshot
// is attempted (document.hidden/visibilityState confirmed the window was not visible, which is why
// captureScreenshot was hanging).
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
  const client = new CdpClient(wsUrl);
  client.bind();
  await client.open();
  await client.send('Page.enable');
  const r = await client.send('Page.bringToFront');
  console.log('bringToFront result:', JSON.stringify(r));
  client.close();
}
main().catch((e) => { console.error('fatal:', e); process.exitCode = 1; });
