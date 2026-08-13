#!/usr/bin/env node
// scripts/bp154_pail_screenshot2.mjs -- throwaway. Scrolls the pail panel into view, then
// captures a CDP screenshot, synchronously, one WS connection, no polling.
import { writeFileSync } from 'node:fs';
import WebSocket from 'ws';

const port = 9333;
function cdpHttp(p, path) { return fetch(`http://127.0.0.1:${p}${path}`).then((r) => r.json()); }

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
  const outPath = process.argv[2];
  const target = await findAppPageTarget(port);
  const client = new CdpClient(target.webSocketDebuggerUrl);
  client.bind();
  await client.open();
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  // Scroll the "THE PAIL" panel into view, if present.
  await client.send('Runtime.evaluate', {
    expression: `
      (function(){
        var els = Array.from(document.querySelectorAll('div'));
        var target = els.find(function(d){ return d.textContent.trim().indexOf('THE PAIL') === 0; });
        if (target) { target.scrollIntoView({block:'center'}); return 'scrolled to pail'; }
        return 'pail panel not found in DOM';
      })()
    `,
    awaitPromise: true,
    returnByValue: true,
  });
  const shot = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
  console.log('wrote', outPath, Buffer.from(shot.data, 'base64').length, 'bytes');
  client.close();
}
main().catch((e) => { console.error('fatal:', e); process.exitCode = 1; });
