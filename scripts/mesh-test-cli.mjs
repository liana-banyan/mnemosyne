#!/usr/bin/env node
// scripts/mesh-test-cli.mjs — KN-BP144-13 PHASE 1: CLI driver for the scored mesh-test run.
//
// This is a DRIVER, not a standalone headless runner. Per KN-BP144-13_REPORT.md's Phase 0
// finding (0.2/0.3): the scored run cannot go headless at all (loadQuestions() throws without
// a real Electron `app` singleton), and the Founder's actual scored-run config
// (researchArmMode:true) additionally needs an already-signed-in Electron <webview> session
// that only exists inside a live, running Electron process. So this script does NOT spawn its
// own Electron instance, does NOT create its own browser-authority session, and does NOT call
// into plow_mc_answerer.ts or one_click_mmlu_pro.ts directly (both are untouched by this
// ticket — one_click_mmlu_pro.ts included, see the report's Phase 1 section for why that
// hypothesis in the ticket did not hold up against the real code).
//
// MECHANISM: attaches to an ALREADY-RUNNING Electron instance via Chrome DevTools Protocol
// (CDP) and calls the EXACT SAME preload-exposed function
// (window.amplify.meshTestRunOneClick, src/main/preload.ts ~line 1373) that the Proof tab
// panel's own "Run the Test" button calls (OneClickMeshTestPanel.tsx handleRun(), ~line 1065).
// There is structurally one code path from here to the answering engine, not a second
// implementation that happens to produce similar results — this script presses the same
// button a human would, through the same contextBridge surface, over CDP instead of a mouse
// click. Zero new IPC handlers were added; index.ts, preload.ts, and plow_mc_answerer.ts are
// all byte-unchanged by this ticket.
//
// PRECEDENT: this exact app, on this exact machine, was already proven CDP-drivable by
// KN-BP144-8's own investigation (scratchpad/kn_bp144_8_cdp_explore.mjs,
// kn_bp144_8_cdp_screenshot.mjs) — this script reuses that same raw-WebSocket
// Runtime.evaluate pattern rather than inventing a new attachment mechanism, per this
// ticket's own "investigate before inventing" instruction.
//
// OPERATIONAL REQUIREMENT (not a code change): the target Electron instance must have been
// launched with a --remote-debugging-port=<port> flag. This is a launch-time argument to the
// `electron` binary / packaged executable — see package.json's "dev:main:cdp" script for the
// one-line dev-mode way to launch this way. Chromium writes the actual bound port to
// {userData}/DevToolsActivePort, which this script auto-discovers by default (no manual port
// bookkeeping needed on a normal relaunch); pass --port to override.
//
// RECEIPT: writes the exact same OneClickRunResult JSON shape (byte-for-byte
// JSON.stringify(result, null, 2), the same call OneClickMeshTestPanel.tsx's downloadReceipt()
// makes — see one_click_mmlu_pro.ts lines 142-239 for the schema) to disk directly via
// fs.writeFileSync, because — per this ticket's own Phase 0 finding (0.4) — downloadReceipt()
// is a renderer-only Blob/anchor-click DOM mechanism with no main-process equivalent to call
// into; this script's own write is the thing that closes that gap for a CLI caller, not a
// second copy of app logic.
//
// Usage:
//   node scripts/mesh-test-cli.mjs [--questionIds=1,7,14,20,27] [--maxTotalQuestions=20]
//                                  [--port=9333] [--out=<dir>] [--timeoutMs=1800000]
//                                  [--plowAndonEnabled=false]
//
// Exit codes: 0 = run completed and receipt written. 1 = could not attach, run did not
// complete, or the app reported a thrown error (e.g. "already in progress").

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
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
const questionIds = args.has('questionIds')
  ? args.get('questionIds').split(',').map((s) => s.trim()).filter(Boolean)
  : null;
const maxTotalQuestions = args.has('maxTotalQuestions') ? Number(args.get('maxTotalQuestions')) : 20;
const outDir = args.get('out') ?? join(homedir(), 'Downloads');
const timeoutMs = args.has('timeoutMs') ? Number(args.get('timeoutMs')) : 30 * 60 * 1000;
const plowAndonEnabled = args.has('plowAndonEnabled') ? args.get('plowAndonEnabled') !== 'false' : true;

// ─── CDP port discovery ──────────────────────────────────────────────────────
// DevToolsActivePort lives at {userData}/DevToolsActivePort once the target was launched with
// --remote-debugging-port. userData is normally {APPDATA}/MnemosyneC (this app overrides
// Electron's package.json-derived default at boot — confirmed live this session, boot log:
// "[BP083] MnemosyneC substrate scaffold ready at ...\AppData\Roaming\MnemosyneC"); the plain
// package.json "name" ("amplify-computer") is tried too as a fallback for any build that
// hasn't taken that override yet.
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

// ─── Locate the real app page (not the hidden nexus-authority helper window,
//     not its embedded <webview> guest target) ───────────────────────────────
async function findAppPageTarget(port) {
  const targets = await cdpHttp(port, '/json/list');
  // The main dashboard page loads dist/renderer/index.html — confirmed live this session
  // (CDP /json/list target: title "MnemosyneC", url ".../dist/renderer/index.html#/dashboard").
  // The nexus-authority helper window's own page is a data: URL and its guest <webview> is a
  // separate "webview"-typed target with an about:blank/live-authority url — neither carries
  // window.amplify in a way this script should ever touch.
  const candidate = targets.find((t) => t.type === 'page' && t.url.includes('index.html'));
  if (!candidate) {
    throw new Error(
      `No renderer page target found among ${targets.length} CDP target(s) on port ${port}. ` +
      `Targets seen: ${targets.map((t) => `${t.type}:${t.url.slice(0, 60)}`).join(' | ')}`,
    );
  }
  return candidate;
}

// ─── Progress line formatting ────────────────────────────────────────────────
let scored = 0;
let correct = 0;
function formatAuthorities(outcome) {
  const ao = outcome?.plowTrace?.authorityOutcomes;
  if (!ao || typeof ao !== 'object') return 'authorities=n/a';
  return Object.entries(ao)
    .map(([k, v]) => `${k}=${v && typeof v === 'object' ? v.outcome : v}`)
    .join(' ');
}
function printProgress(payload) {
  switch (payload.type) {
    case 'start':
      console.log(`[cli] run started — ${payload.total} unit(s) to answer`);
      break;
    case 'peers-discovered':
      console.log(`[cli] peers discovered: ${payload.count}`);
      break;
    case 'question-start':
      console.log(`[cli] Q${payload.index + 1}/${payload.total} category=${payload.category} — answering… "${String(payload.question).slice(0, 70)}${payload.question.length > 70 ? '…' : ''}"`);
      break;
    case 'question-complete': {
      const o = payload.outcome;
      if (o.parsedLetter !== null && o.parsedLetter !== undefined) scored++;
      if (o.isCorrect) correct++;
      const mark = o.isCorrect ? '✓' : (o.isAbstain ? '·' : '✗');
      console.log(
        `[cli] Q${payload.index + 1}/${payload.total} qid=${o.question_id} chosen=${o.parsedLetter ?? 'ABSTAIN'} correct=${o.correctLetter} ${mark}  ` +
        `running=${correct}/${scored}  ${formatAuthorities(o)}`,
      );
      break;
    }
    // 'complete' is deliberately not printed here — the awaited Runtime.evaluate resolution
    // below is the authoritative terminal event this script acts on (receipt write + exit
    // code); printing it again from the progress channel would just be a duplicate echo.
    default:
      break;
  }
}

// ─── Build the run config — mirrors OneClickMeshTestPanel.tsx's own handleRun()/
//     handleRunSubset() config shapes exactly (RECOMMENDED_DEFAULTS, lines 418-428), so a
//     CLI-driven run and a panel-triggered run send byte-identical config objects for the
//     same request shape. ────────────────────────────────────────────────────
function buildConfig() {
  const base = {
    mode: 'local_ollama',
    substrateEnabled: true,
    plowEnabled: true,
    plowAndonEnabled,
    researchArmMode: true,
    researchArmMeshSynergy: false,
    researchArmDecompose: false,
    federatedSubstrateEnabled: false,
  };
  if (questionIds) {
    // Mirrors handleRunSubset(): questionIds present -> omit maxTotalQuestions/exactPerCategory
    // entirely, since the main-process runner gives questionIds priority over both anyway
    // (one_click_mmlu_pro.ts's own questionIds doc comment) and the panel's own subset caller
    // never sends them either.
    return { ...base, questionIds };
  }
  return { ...base, maxTotalQuestions };
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const port = discoverPort();
  if (!port) {
    console.error(
      '[cli] Could not discover a CDP port. Is the target instance running with ' +
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
  await client.send('Runtime.addBinding', { name: 'kn_bp144_13_bridge' });
  client.onBinding = (params) => {
    if (params.name !== 'kn_bp144_13_bridge') return;
    try { printProgress(JSON.parse(params.payload)); } catch (e) { console.error('[cli] progress parse error:', e.message); }
  };

  const config = buildConfig();
  console.log(`[cli] config: ${JSON.stringify(config)}`);

  const expression = `
    (async () => {
      if (!window.amplify || typeof window.amplify.meshTestRunOneClick !== 'function') {
        throw new Error('window.amplify.meshTestRunOneClick is not available on this page');
      }
      const activeCheck = await window.amplify.meshTestIsActive();
      if (activeCheck && activeCheck.active) {
        throw new Error('A one-click test run is already active in this instance (e.g. the panel is mid-run) — refusing to double-run.');
      }
      let unsub = null;
      try {
        unsub = window.amplify.onMeshTestProgress((payload) => {
          try { window.kn_bp144_13_bridge(JSON.stringify(payload)); } catch (e) { /* noop */ }
        });
        const resp = await window.amplify.meshTestRunOneClick(${JSON.stringify(config)});
        return resp;
      } finally {
        if (unsub) unsub();
      }
    })()
  `;

  const timer = setTimeout(() => {
    console.error(`[cli] TIMED OUT after ${timeoutMs}ms waiting for the run to complete.`);
    client.close();
    process.exitCode = 1;
  }, timeoutMs);

  let evalResult;
  try {
    evalResult = await client.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
  } catch (err) {
    clearTimeout(timer);
    console.error('[cli] CDP evaluate failed:', err.message);
    process.exitCode = 1;
    client.close();
    return;
  }
  clearTimeout(timer);
  client.close();

  if (evalResult.exceptionDetails) {
    console.error('[cli] run threw:', evalResult.exceptionDetails.exception?.description ?? JSON.stringify(evalResult.exceptionDetails));
    process.exitCode = 1;
    return;
  }

  const resp = evalResult.result?.value;
  if (!resp || resp.ok !== true || !resp.result) {
    console.error('[cli] run did not complete successfully:', JSON.stringify(resp));
    process.exitCode = 1;
    return;
  }

  const result = resp.result;
  console.log(
    `[cli] run complete — dispatchMode=${result.dispatchMode} scored=${result.scored} correct=${result.correct} ` +
    `accuracy=${result.accuracy !== null ? (result.accuracy * 100).toFixed(1) + '%' : 'n/a'} cancelled=${!!result.cancelled}`,
  );

  // Same JSON.stringify(result, null, 2) OneClickMeshTestPanel.tsx's downloadReceipt() writes
  // (renderer-only there; this is the main-process/CLI-side equivalent write for this same
  // shape — see this file's header note and KN-BP144-13_REPORT.md section 0.4).
  const filename = `mnemo_mesh_test_receipt_${result.startedAt.replace(/[:.]/g, '-')}.json`;
  const outPath = join(outDir, filename);
  writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
  console.log(outPath);
}

main().catch((err) => {
  console.error('[cli] fatal:', err?.stack ?? err);
  process.exitCode = 1;
});
