#!/usr/bin/env node
// kn_bp146_m6_nexus_live_stream_demo.mjs -- KN-BP146-M6 Task 3.
//
// A persistent, KEPT (not scratch-cleaned) live-streaming terminal demo proving THE NEXUS
// (src/main/openai_compat_server.ts) is on the REAL live Ask-tab free-text engine's actual
// request path (KN-BP146-M6): ai_dispatch_ipc.ts's 'ai-dispatch:query-engine' handler ->
// runCanonicalFreeTextQuestion() (canonical_pipeline.ts) -> callOllama() -> THE NEXUS's new
// Bearer-gated /api/generate route -> substrate injection -> real Ollama.
//
// Mirrors scripts/mesh-test-cli.mjs's live per-question terminal style: one line printed the
// MOMENT a question starts (before the network call resolves), a second line the moment its
// answer returns, ending in a summary line that is NOT the only output.
//
// ── PRECONDITION (read before running) ─────────────────────────────────────────────────────────
// The REAL MnemosyneC app must ALREADY be running (Ollama reachable + THE NEXUS listening on its
// real production port, default 127.0.0.1:11535) -- this script does NOT self-start an isolated
// instance. It reads the app's REAL Bearer token file from the app's REAL userData directory
// (%APPDATA%\MnemosyneC, falling back to %APPDATA%\amplify-computer) and plants its small,
// synthetic, self-contained fact+question pair directly into the REAL production substrate file
// ({userData}/substrate/verified_eblets.jsonl) -- this write is IDEMPOTENT (deduped by sha256 of
// question+answer, same convention as writeVerifiedEblet()'s own on-write dedupe), so rerunning
// this script never creates duplicate rows and never disturbs any other substrate content.
//
// Paste-ready command (from the mnemosyne repo root, app already running):
//   node scratchpad/kn_bp146_m6_nexus_live_stream_demo.mjs
//
// Optional overrides:
//   NEXUS_DEMO_MODEL=llama3.1:8b node scratchpad/kn_bp146_m6_nexus_live_stream_demo.mjs
//   OPENAI_COMPAT_PORT=11535 node scratchpad/kn_bp146_m6_nexus_live_stream_demo.mjs

import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';

const NEXUS_HOST = '127.0.0.1';
const NEXUS_PORT = Number(process.env.OPENAI_COMPAT_PORT ?? 11535);
const REAL_OLLAMA_URL = 'http://127.0.0.1:11434';
const MODEL = process.env.NEXUS_DEMO_MODEL ?? 'gemma4:12b';

// Small, fixed, self-contained synthetic fact+question pair (baked in, per Task 3's own
// instruction) -- a fake, invented fact no LLM could know on its own.
const PLANTED_QUESTION = 'What is the designated emergency callsign for the KN-BP146 lighthouse relay station?';
const PLANTED_MARKER = 'ZOLTAR-NINE-QUASAR-7742';
const PLANTED_ANSWER = `The designated emergency callsign for the KN-BP146 lighthouse relay station is ${PLANTED_MARKER}.`;

// Two real candidate userData folder names exist in the wild for this app: 'MnemosyneC' (the
// productName, used by a packaged/distributed build) and 'amplify-computer' (package.json
// "name", used by an unpackaged `electron .` dev-mode run that never called app.setName()).
// Folder EXISTENCE alone is not a reliable signal -- both can exist simultaneously on one
// machine (confirmed this session) from different run modes. The only reliable signal for
// "which one is THE NEXUS actually listening under, right now" is which candidate's own token
// file exists -- THE NEXUS always writes its token into app.getPath('userData') at boot, so
// whichever candidate has a live token file is the one currently running.
function resolveUserDataDir() {
  const appData = process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming');
  const candidates = ['MnemosyneC', 'amplify-computer'].map((name) => join(appData, name));
  const withLiveToken = candidates.find((dir) => existsSync(join(dir, 'openai_compat_server_token.txt')));
  if (withLiveToken) return withLiveToken;
  return candidates.find((dir) => existsSync(dir)) ?? candidates[0];
}

function readToken(userDataDir) {
  const p = join(userDataDir, 'openai_compat_server_token.txt');
  if (!existsSync(p)) return null;
  const t = readFileSync(p, 'utf8').trim();
  return t.length > 0 ? t : null;
}

/** Writes the row directly in the exact VerifiedEbletEntry JSONL shape queryVerifiedEbletsTopical
 *  reads (see mnem_eblet_store.ts). Deduped on (question+answer) sha256, same convention as the
 *  real writeVerifiedEblet()'s own "on collision, do NOT append" dedupe -- idempotent reruns. */
function plantFactIfAbsent(userDataDir) {
  const dir = join(userDataDir, 'substrate');
  const file = join(dir, 'verified_eblets.jsonl');
  const sha256 = createHash('sha256').update(PLANTED_QUESTION + PLANTED_ANSWER).digest('hex');
  if (existsSync(file) && readFileSync(file, 'utf8').includes(sha256)) {
    return { planted: false, file };
  }
  mkdirSync(dir, { recursive: true });
  const row = {
    question: PLANTED_QUESTION,
    answer: PLANTED_ANSWER,
    provenance: 'kn_bp146_m6_live_demo:planted_fact',
    verified: true,
    sha256,
    timestamp: Date.now(),
    verdict: 'verified',
  };
  appendFileSync(file, JSON.stringify(row) + '\n', 'utf8');
  return { planted: true, file };
}

async function askViaNexus(token, prompt) {
  const res = await fetch(`http://${NEXUS_HOST}:${NEXUS_PORT}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      stream: false,
      think: false,
      options: { temperature: 0.0, num_predict: 256 },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, response: body.response ?? '' };
}

async function askViaDirectOllama(prompt) {
  const res = await fetch(`${REAL_OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      stream: false,
      think: false,
      options: { temperature: 0.0, num_predict: 256 },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, response: body.response ?? '' };
}

const QUESTIONS = [
  {
    route: 'nexus',
    injection: 'on',
    prompt: `Answer this question in one short sentence: ${PLANTED_QUESTION}`,
    expectMarker: true,
  },
  {
    route: 'direct-ollama',
    injection: 'n/a',
    prompt: `Answer this question in one short sentence: ${PLANTED_QUESTION}`,
    expectMarker: false,
  },
];

async function main() {
  console.log('='.repeat(78));
  console.log('[nexus-live] KN-BP146-M6 -- live-streaming Nexus routing demo');
  console.log('='.repeat(78));

  const userDataDir = resolveUserDataDir();
  console.log(`[nexus-live] resolved userData dir: ${userDataDir}`);

  const token = readToken(userDataDir);
  if (!token) {
    console.error(
      `[nexus-live] FATAL: no Bearer token found at ${join(userDataDir, 'openai_compat_server_token.txt')}. ` +
      'Precondition not met -- start the real MnemosyneC app first (THE NEXUS generates its token file on first boot).',
    );
    process.exitCode = 1;
    return;
  }

  const plantResult = plantFactIfAbsent(userDataDir);
  console.log(
    `[nexus-live] planted fact ${plantResult.planted ? 'WRITTEN (new row)' : 'already present (idempotent rerun, no duplicate row)'} ` +
    `in ${plantResult.file}`,
  );

  const total = QUESTIONS.length;
  let passCount = 0;
  for (let i = 0; i < total; i++) {
    const q = QUESTIONS[i];
    // Printed the MOMENT this question starts, before the network call resolves.
    console.log(
      `[nexus-live] Q${i + 1}/${total} route=${q.route} peer=${MODEL} injection=${q.injection} -- asking: "${q.prompt}"`,
    );
    const t0 = Date.now();
    let result;
    try {
      result = q.route === 'nexus' ? await askViaNexus(token, q.prompt) : await askViaDirectOllama(q.prompt);
    } catch (err) {
      const latencyMs = Date.now() - t0;
      console.log(
        `[nexus-live] Q${i + 1}/${total} ERROR after latency_ms=${latencyMs}: ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }
    const latencyMs = Date.now() - t0;
    const markerDetected = result.response.includes(PLANTED_MARKER);
    const outcomeOk = markerDetected === q.expectMarker;
    if (outcomeOk) passCount++;
    const excerpt = result.response.length > 140 ? `${result.response.slice(0, 140)}...` : result.response;
    // Printed the MOMENT this question's answer returns.
    console.log(
      `[nexus-live] Q${i + 1}/${total} done: http_status=${result.status} marker_detected=${markerDetected} ` +
      `(expected=${q.expectMarker}) outcome=${outcomeOk ? 'PASS' : 'FAIL'} latency_ms=${latencyMs} answer="${excerpt}"`,
    );
  }

  console.log('='.repeat(78));
  console.log(`[nexus-live] SUMMARY: ${passCount}/${total} question(s) matched expected marker-presence outcome.`);
  console.log('='.repeat(78));
  process.exitCode = passCount === total ? 0 : 1;
}

main();
