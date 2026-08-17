#!/usr/bin/env node
// scripts/bishop_dispatch_send_cli.mjs — D-BP156-M0-020, HARDWIRE-24 mesh.
//
// THE GAP THIS CLOSES: dispatchBishopDispatchViaRelay (src/main/federation/mic_dispatcher.ts)
// and its new IPC handler (src/main/federation/bishop_dispatch_send_ipc.ts,
// 'bishop-dispatch:send-via-relay') are the real, offline-tested send path for a bishop_dispatch
// WAN relay row -- but as of D-BP156-M0-016 nothing called either of them: no CLI entry point,
// no npm script, no UI control. This script IS that entry point.
//
// WHY CDP-ATTACH-TO-A-RUNNING-INSTANCE, NOT A STANDALONE SCRIPT (investigated before writing
// this file): dispatchBishopDispatchViaRelay signs its plaintext with signAnnouncePayload()
// (announce_frame.ts), which calls getOrCreateKeypair() (thorax/ed25519_keypair.ts), which does
// `import { app } from 'electron'; app.getPath('userData')` -- a hard dependency on a REAL,
// running Electron app singleton (the Ed25519 keypair is persisted at
// <userData>/thorax_ed25519.json and only that already-running app process can read it).
// Confirmed directly: node_modules/electron/index.js resolves to a plain string (the path to
// the electron binary) whenever 'electron' is required from a bare Node process, so a standalone
// script gets `app === undefined` and signAnnouncePayload's own try/catch swallows the resulting
// throw into a null return, falling back to an UNSIGNED envelope that the receiver's origin
// allowlist guardrail will always refuse. The proven precedent in THIS codebase for exactly this
// shape of problem is scripts/mesh-test-cli.mjs (its own header: "the scored run cannot go
// headless at all -- loadQuestions() throws without a real Electron `app` singleton") -- it
// attaches to an already-running instance over Chrome DevTools Protocol and calls a
// preload-exposed window.amplify.* function. This script reuses that exact CdpClient/port-
// discovery/target-matching shape verbatim (copied from mesh-test-cli.mjs, not reimplemented)
// and calls window.amplify.bishopDispatchSendViaRelay(...) instead of meshTestRunOneClick(...).
//
// REQUIRES the app to be already running with --remote-debugging-port=<port> (see
// mesh-test-cli.mjs's own header / package.json's "dev:main:cdp" script for how to launch that
// way). This script does not, and cannot, spawn its own signing-capable process.
//
// Usage:
//   node scripts/bishop_dispatch_send_cli.mjs --targetPeerId=<peer id> --dispatchId=<D-BPnnn-Mn-nnn>
//     (--promptText=<text> | --promptFile=<path>) --workingDir=<absolute path> [--port=<n>]
//
// Prints the relay_routes row id and target peer id on success (the sender's own receipt).
// Exit codes: 0 = send succeeded (result.ok === true). 1 = could not attach, validation failed,
// or the send itself failed.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import WebSocket from 'ws';

// ─── CLI args ────────────────────────────────────────────────────────────────
const args = new Map();
for (const raw of process.argv.slice(2)) {
  const m = raw.match(/^--([^=]+)=?(.*)$/);
  if (m) args.set(m[1], m[2] === '' ? 'true' : m[2]);
}

const explicitPort = args.has('port') ? Number(args.get('port')) : null;
const targetPeerId = args.get('targetPeerId') ?? '';
const dispatchId = args.get('dispatchId') ?? '';
const workingDir = args.get('workingDir') ?? '';
let promptText = args.get('promptText') ?? '';
if (!promptText && args.has('promptFile')) {
  try {
    promptText = readFileSync(args.get('promptFile'), 'utf8');
  } catch (err) {
    console.error(`[cli] could not read --promptFile: ${err.message}`);
    process.exitCode = 1;
  }
}

if (process.exitCode !== 1) {
  const missing = [];
  if (!targetPeerId) missing.push('--targetPeerId');
  if (!dispatchId) missing.push('--dispatchId');
  if (!promptText) missing.push('--promptText or --promptFile');
  if (!workingDir) missing.push('--workingDir');
  if (missing.length > 0) {
    console.error(`[cli] missing required argument(s): ${missing.join(', ')}`);
    console.error(
      '[cli] usage: node scripts/bishop_dispatch_send_cli.mjs --targetPeerId=<id> ' +
      '--dispatchId=<D-BPnnn-Mn-nnn> (--promptText=<text> | --promptFile=<path>) --workingDir=<path>',
    );
    process.exitCode = 1;
  }
}

// ─── CDP port discovery (copied verbatim from scripts/mesh-test-cli.mjs) ────────────────────
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
  const candidate =
    pages.find((t) => isPackagedRenderer(t.url)) ?? pages.find((t) => isDevRenderer(t.url));

  if (!candidate) {
    throw new Error(
      `No renderer page target found among ${targets.length} CDP target(s) on port ${port}. ` +
      `Targets seen: ${targets.map((t) => `${t.type}:${t.url.slice(0, 60)}`).join(' | ')}`,
    );
  }
  const buildKind = isPackagedRenderer(candidate.url) ? 'PACKAGED (asar)' : 'DEV (source)';
  console.log(`[cli] renderer build: ${buildKind} -- ${candidate.url.slice(0, 110)}`);
  return candidate;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  if (process.exitCode === 1) return; // arg validation already failed above

  const port = discoverPort();
  if (!port) {
    console.error(
      '[cli] Could not discover a CDP port. Is MnemosyneC running with ' +
      '--remote-debugging-port? Pass --port=<n> explicitly if DevToolsActivePort is not under ' +
      '%APPDATA%\\MnemosyneC or %APPDATA%\\amplify-computer.',
    );
    process.exitCode = 1;
    return;
  }
  console.log(`[cli] discovered CDP port ${port}`);

  const target = await findAppPageTarget(port);
  console.log(`[cli] attached target: "${target.title}" (${target.url})`);

  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.open();
  await client.send('Runtime.enable');

  const reqPayload = { targetPeerId, dispatchId, promptText, workingDir };
  console.log(`[cli] sending bishop_dispatch: targetPeerId=${targetPeerId} dispatchId=${dispatchId} workingDir=${workingDir}`);

  const expression = `
    (async () => {
      if (!window.amplify || typeof window.amplify.bishopDispatchSendViaRelay !== 'function') {
        throw new Error('window.amplify.bishopDispatchSendViaRelay is not available on this page -- rebuild/relaunch needed');
      }
      return await window.amplify.bishopDispatchSendViaRelay(${JSON.stringify(reqPayload)});
    })()
  `;

  let evalResult;
  try {
    evalResult = await client.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
  } catch (err) {
    console.error('[cli] CDP evaluate failed:', err.message);
    process.exitCode = 1;
    client.close();
    return;
  }
  client.close();

  if (evalResult.exceptionDetails) {
    console.error('[cli] send threw:', evalResult.exceptionDetails.exception?.description ?? JSON.stringify(evalResult.exceptionDetails));
    process.exitCode = 1;
    return;
  }

  const result = evalResult.result?.value;
  if (!result || result.ok !== true) {
    console.error(`[cli] SEND FAILED: ${result?.error ?? '(no result value returned)'}`);
    process.exitCode = 1;
    return;
  }

  // This IS the receipt: relay_routes row id + target peer id, straight from the real send path.
  console.log(`[cli] SEND OK -- relay_routes row id=${result.routeId ?? '(unknown -- insert response had no id)'} target_peer_id=${result.targetPeerId}`);
}

main().catch((err) => {
  console.error('[cli] fatal:', err?.stack ?? err);
  process.exitCode = 1;
});
