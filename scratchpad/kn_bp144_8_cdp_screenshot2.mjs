import WebSocket from 'ws';
import { writeFileSync } from 'node:fs';

const TARGET_WS = process.argv[2];
const OUT_PATH = process.argv[3];

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`TIMEOUT: ${label}`)), ms)),
  ]);
}

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

ws.on('open', async () => {
  try {
    await withTimeout(send('Page.enable', {}), 5000, 'Page.enable');
    console.log('Page.enable OK');
    try {
      await withTimeout(send('Page.bringToFront', {}), 5000, 'Page.bringToFront');
      console.log('Page.bringToFront OK');
    } catch (e) { console.log('bringToFront failed/timed out:', e.message); }
    const result = await withTimeout(
      send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false }),
      10000,
      'Page.captureScreenshot',
    );
    writeFileSync(OUT_PATH, Buffer.from(result.data, 'base64'));
    console.log('Saved screenshot to', OUT_PATH);
    process.exitCode = 0;
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exitCode = 1;
  } finally {
    try { ws.close(); } catch {}
    process.exit(process.exitCode || 0);
  }
});
ws.on('error', (err) => { console.error('WS ERROR:', err); process.exit(1); });
