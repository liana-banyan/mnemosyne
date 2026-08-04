// KN-BP144-8 Phase 1: CDP screenshot helper -- captures a PNG of the given DevTools page target.
import WebSocket from 'ws';
import { writeFileSync } from 'node:fs';

const TARGET_WS = process.argv[2];
const OUT_PATH = process.argv[3];

const ws = new WebSocket(TARGET_WS);
let id = 1;
function send(method, params) {
  return new Promise((resolve, reject) => {
    const thisId = id++;
    const handler = (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === thisId) {
        ws.off('message', handler);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id: thisId, method, params }));
  });
}

const TIMEOUT_MS = 12000;
const timer = setTimeout(() => {
  console.error('TIMED OUT waiting for CDP response');
  process.exitCode = 1;
  try { ws.close(); } catch {}
  process.exit(1);
}, TIMEOUT_MS);

ws.on('open', async () => {
  try {
    await send('Page.enable', {});
    const result = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(OUT_PATH, Buffer.from(result.data, 'base64'));
    console.log('Saved screenshot to', OUT_PATH);
  } catch (err) {
    console.error('ERROR:', err);
    process.exitCode = 1;
  } finally {
    clearTimeout(timer);
    ws.close();
    process.exit(process.exitCode || 0);
  }
});
ws.on('error', (err) => { console.error('WS ERROR:', err); process.exitCode = 1; clearTimeout(timer); process.exit(1); });
