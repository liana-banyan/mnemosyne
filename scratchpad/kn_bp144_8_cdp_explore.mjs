// KN-BP144-8 Phase 1: CDP exploration helper -- connects to the already-running Electron
// instance's DevTools protocol (launched separately with --remote-debugging-port=9333) and
// evaluates arbitrary JS in the main window's renderer context. Read-only exploration.
import WebSocket from 'ws';

const TARGET_WS = process.argv[2];
const CODE = process.argv[3];

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
    await send('Runtime.enable', {});
    const result = await send('Runtime.evaluate', {
      expression: CODE,
      returnByValue: true,
      awaitPromise: true,
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('ERROR:', err);
    process.exitCode = 1;
  } finally {
    ws.close();
  }
});
ws.on('error', (err) => { console.error('WS ERROR:', err); process.exitCode = 1; });
