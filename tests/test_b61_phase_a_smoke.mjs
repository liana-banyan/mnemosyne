/**
 * B61 Phase A Smoke Test — Wave Generator Daemon
 *
 * G1 PASS criterion (per prompt spec):
 *   1. Submit hand-authored wave-class request (inline decomposition; 4 SEGs)
 *   2. Daemon fires 4 parallel Yoke calls (via mock Yoke server on MOCK_YOKE_PORT)
 *   3. All 4 SEGs return DONE
 *   4. Synthesis SEG fires with 4 receipts (via mock Anthropic endpoint)
 *   5. synthesis_receipt.eblet.md written to wave_archive/{wave_id}/
 *   6. wave.hmac attached (64-char SHA-256 hex)
 *   7. wave.json in archive reflects status=complete
 *
 * Self-contained: spins up a mock HTTP server that intercepts Pawn/Rook Yoke
 * calls AND a mock Anthropic endpoint so no real API keys are required.
 * Imports wave_generator.js from dist/main/ directly (no Electron needed).
 *
 * Run: node tests/test_b61_phase_a_smoke.mjs
 */

import { createServer } from 'http';
import { existsSync, readFileSync, mkdirSync, rmSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';

// ─── Configuration ────────────────────────────────────────────────────────────

const MOCK_YOKE_PORT = 19991;   // mock Yoke (Pawn + Rook endpoints)
const MOCK_ANTH_PORT = 19992;   // mock Anthropic (synthesis / knight)
const TEST_SUBSTRATE = resolve(homedir(), '.lb_substrate_b61_phase_a_test');

// Override env so wave_generator targets our mock ports + test substrate dir
process.env.LB_SUBSTRATE_ROOT   = TEST_SUBSTRATE;
process.env.SUBSTRATE_API_PORT  = String(MOCK_YOKE_PORT);
process.env.ANTHROPIC_API_KEY   = 'test-mock-key-phase-a';

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Mock Yoke server (Pawn + Rook endpoints) ─────────────────────────────────

async function startMockYokeServer() {
  return new Promise((res, rej) => {
    const server = createServer((req, rsp) => {
      let body = '';
      req.on('data', c => (body += c));
      req.on('end', () => {
        rsp.setHeader('Content-Type', 'application/json');

        if (req.method === 'POST' && req.url === '/yoke/pawn/dispatch') {
          let parsed = {};
          try { parsed = JSON.parse(body); } catch {}
          rsp.end(JSON.stringify({
            success: true,
            dispatch_id: parsed.dispatch_id ?? randomUUID(),
            reply: `PAWN_MOCK: cooperative answer to "${String(parsed.prompt ?? '').slice(0, 50)}"`,
            receipt_hash: 'mockhash_pawn',
            recipient: 'pawn',
          }));
          return;
        }

        if (req.method === 'POST' && req.url === '/yoke/rook/dispatch') {
          let parsed = {};
          try { parsed = JSON.parse(body); } catch {}
          rsp.end(JSON.stringify({
            success: true,
            dispatch_id: parsed.dispatch_id ?? randomUUID(),
            reply: `ROOK_MOCK: diagram answer to "${String(parsed.prompt ?? '').slice(0, 50)}"`,
            receipt_hash: 'mockhash_rook',
            recipient: 'rook',
          }));
          return;
        }

        rsp.statusCode = 404;
        rsp.end(JSON.stringify({ error: 'mock: route not found', url: req.url }));
      });
    });

    server.listen(MOCK_YOKE_PORT, '127.0.0.1', () => {
      console.log(`  [mock-yoke]  Pawn + Rook mock on port ${MOCK_YOKE_PORT}`);
      res(server);
    });
    server.on('error', rej);
  });
}

// ─── Mock Anthropic server (synthesis / knight endpoint) ──────────────────────

async function startMockAnthropicServer() {
  return new Promise((res, rej) => {
    const server = createServer((req, rsp) => {
      let body = '';
      req.on('data', c => (body += c));
      req.on('end', () => {
        rsp.setHeader('Content-Type', 'application/json');

        if (req.method === 'POST' && req.url === '/v1/messages') {
          let parsed = {};
          try { parsed = JSON.parse(body); } catch {}
          const prompt = parsed.messages?.[0]?.content ?? '';
          rsp.end(JSON.stringify({
            id: `msg_mock_${randomUUID().slice(0, 8)}`,
            type: 'message',
            role: 'assistant',
            content: [{
              type: 'text',
              text: `KNIGHT_MOCK_SYNTHESIS: This is the synthesized result combining all 4 SEG receipts. ` +
                    `Cooperative commerce unites producers and consumers. ` +
                    `The 83.3% creator keep is enshrined in bylaws. ` +
                    `The Wave Generator operates in 6 stages. ` +
                    `[mock response; prompt length=${prompt.length}]`,
            }],
            model: 'claude-sonnet-4-5',
            stop_reason: 'end_turn',
            usage: { input_tokens: 100, output_tokens: 50 },
          }));
          return;
        }

        rsp.statusCode = 404;
        rsp.end(JSON.stringify({ error: 'mock: route not found', url: req.url }));
      });
    });

    server.listen(MOCK_ANTH_PORT, '127.0.0.1', () => {
      console.log(`  [mock-anth]  Anthropic mock on port ${MOCK_ANTH_PORT}`);
      res(server);
    });
    server.on('error', rej);
  });
}

// ─── Patch global fetch to route Anthropic calls to mock ─────────────────────
//
// wave_generator.ts calls https://api.anthropic.com/v1/messages directly.
// We intercept via a patched fetch that rewrites the host.

const _realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.includes('api.anthropic.com')) {
    const patched = u.replace('https://api.anthropic.com', `http://127.0.0.1:${MOCK_ANTH_PORT}`);
    return _realFetch(patched, opts);
  }
  return _realFetch(url, opts);
};

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runTests() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log(' B61 Phase A — Wave Generator G1 Smoke Test');
  console.log('═══════════════════════════════════════════════════\n');

  console.log('── Setup ──');

  // Clean up test substrate from any previous run
  if (existsSync(TEST_SUBSTRATE)) {
    rmSync(TEST_SUBSTRATE, { recursive: true, force: true });
  }
  mkdirSync(TEST_SUBSTRATE, { recursive: true });
  console.log(`  Test substrate dir: ${TEST_SUBSTRATE}`);

  // Start mock servers
  const mockYoke = await startMockYokeServer();
  const mockAnth = await startMockAnthropicServer();

  // Import wave_generator from compiled dist (use file:// URL for Windows compat)
  const wgPath    = resolve(import.meta.dirname ?? '.', '..', 'dist', 'main', 'wave_generator.js');
  const wgFileUrl = new URL(`file:///${wgPath.replace(/\\/g, '/')}`).href;
  assert(existsSync(wgPath), `wave_generator.js compiled at ${wgPath}`);

  let wg;
  try {
    wg = await import(wgFileUrl);
  } catch (e) {
    console.error(`  FATAL: cannot import wave_generator.js: ${e.message}`);
    process.exit(1);
  }

  // ── TEST 1: initWaveGenerator + substrate directories ─────────────────────
  console.log('\n── TEST 1: initWaveGenerator + substrate directories ──');

  wg.initWaveGenerator();

  assert(existsSync(resolve(TEST_SUBSTRATE, 'wave_queue')),     'wave_queue/ created');
  assert(existsSync(resolve(TEST_SUBSTRATE, 'wave_active')),    'wave_active/ created');
  assert(existsSync(resolve(TEST_SUBSTRATE, 'wave_archive')),   'wave_archive/ created');
  assert(existsSync(resolve(TEST_SUBSTRATE, 'wave_templates')), 'wave_templates/ created');

  // ── TEST 2: dispatch inline 4-SEG wave ────────────────────────────────────
  console.log('\n── TEST 2: dispatch inline 4-SEG wave ──');

  const waveRequest = {
    anchor: 'test-wave-b61-phase-a-g1',
    segs: [
      { seg_id: 'seg_01', recipient: 'pawn', prompt: 'What is cooperative commerce? One sentence.' },
      { seg_id: 'seg_02', recipient: 'pawn', prompt: 'What is the 83.3% creator keep principle? One sentence.' },
      { seg_id: 'seg_03', recipient: 'rook', prompt: 'Describe the 6 Wave Generator operations briefly.' },
      { seg_id: 'seg_04', recipient: 'rook', prompt: 'List the 4 substrate wave directories.' },
    ],
    synthesis_prompt:
      'Synthesize the following 4 SEG replies into a 3-sentence executive summary:\n\n{receipts}',
    synthesis_recipient: 'knight',
  };

  const wave = await wg.dispatchWave(waveRequest);

  assert(typeof wave.wave_id === 'string' && wave.wave_id.startsWith('wave-'),
    `wave_id valid (${wave.wave_id})`);
  assert(wave.anchor === 'test-wave-b61-phase-a-g1', 'anchor preserved');
  assert(wave.segs.length === 4, `4 SEGs in wave (got ${wave.segs.length})`);
  assert(wave.status === 'queued' || wave.status === 'running',
    `initial status queued/running (${wave.status})`);

  const waveId = wave.wave_id;
  console.log(`  wave_id: ${waveId}`);

  // ── TEST 3: wave completes (all SEGs DONE + synthesis) ───────────────────
  console.log('\n── TEST 3: wave completes — all SEGs DONE + synthesis ──');
  console.log('  Waiting up to 30s for wave completion…');

  let finalWave = null;
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    const w = wg.getWave(waveId);
    if (w && (w.status === 'complete' || w.status === 'aborted')) {
      finalWave = w;
      break;
    }
  }

  assert(finalWave !== null, 'wave completed within 30s');

  if (finalWave) {
    assert(finalWave.status === 'complete', `wave.status = complete (got ${finalWave.status})`);

    const doneSegs = finalWave.segs.filter(s => s.status === 'done');
    assert(doneSegs.length === 4, `all 4 SEGs status=done (got ${doneSegs.length})`);

    for (const seg of finalWave.segs) {
      assert(typeof seg.reply === 'string' && seg.reply.length > 10,
        `${seg.seg_id} has reply (len=${(seg.reply ?? '').length})`);
    }

    assert(typeof finalWave.synthesis_text === 'string' && finalWave.synthesis_text.length > 20,
      `synthesis_text present (len=${(finalWave.synthesis_text ?? '').length})`);
  }

  // ── TEST 4: synthesis_receipt.eblet.md in wave_archive ───────────────────
  console.log('\n── TEST 4: synthesis_receipt.eblet.md in wave_archive ──');

  const archiveDir  = resolve(TEST_SUBSTRATE, 'wave_archive', waveId);
  const ebletPath   = resolve(archiveDir, 'synthesis_receipt.eblet.md');
  const hmacPath    = resolve(archiveDir, 'wave.hmac');
  const waveJPath   = resolve(archiveDir, 'wave.json');

  assert(existsSync(archiveDir),  `wave_archive/${waveId}/ exists`);
  assert(existsSync(ebletPath),   'synthesis_receipt.eblet.md exists');
  assert(existsSync(hmacPath),    'wave.hmac exists');
  assert(existsSync(waveJPath),   'wave.json exists in archive');

  if (existsSync(ebletPath)) {
    const eblet = readFileSync(ebletPath, 'utf8');
    assert(eblet.includes('Wave Synthesis Receipt'), 'Eblet has receipt header');
    assert(eblet.includes(waveId),                  'Eblet contains wave_id');
    assert(eblet.includes('seg_01'),                'Eblet references seg_01');
    assert(eblet.includes('seg_04'),                'Eblet references seg_04');
    assert(eblet.includes('LB-STACK-0164'),         'Eblet has canon anchor LB-STACK-0164');
    assert(eblet.includes('Synthesis Content Hash'),'Eblet has content hash field');
    assert(eblet.length > 500,                      `Eblet is substantive (${eblet.length} chars)`);
    console.log(`\n  Eblet preview:\n${'─'.repeat(60)}`);
    console.log(eblet.slice(0, 500));
    console.log('─'.repeat(60));
  }

  if (existsSync(hmacPath)) {
    const hmac = readFileSync(hmacPath, 'utf8').trim();
    assert(hmac.length === 64, `HMAC is 64-char SHA-256 hex (len=${hmac.length})`);
    assert(/^[0-9a-f]+$/.test(hmac), 'HMAC is valid hex');
  }

  if (existsSync(waveJPath)) {
    const wJson = JSON.parse(readFileSync(waveJPath, 'utf8'));
    assert(wJson.status === 'complete',    'wave.json.status = complete');
    assert(wJson.wave_id === waveId,       'wave.json.wave_id matches');
    assert(typeof wJson.hmac === 'string', 'wave.json.hmac present');
  }

  // ── TEST 5: per-SEG progress event logs in wave_active ───────────────────
  console.log('\n── TEST 5: per-SEG Live Progress event logs ──');

  const activeDir = resolve(TEST_SUBSTRATE, 'wave_active', waveId);
  for (const segId of ['seg_01', 'seg_02', 'seg_03', 'seg_04']) {
    const eventsPath = resolve(activeDir, `${segId}_progress`, 'events.jsonl');
    assert(existsSync(eventsPath), `${segId} progress log exists`);
    if (existsSync(eventsPath)) {
      const events = readFileSync(eventsPath, 'utf8')
        .split('\n').filter(l => l.trim())
        .map(l => JSON.parse(l));
      const evtNames = events.map(e => e.event);
      assert(evtNames.includes('STARTED'), `${segId} has STARTED event`);
      assert(evtNames.includes('DONE'),    `${segId} has DONE event`);
    }
  }

  // ── TEST 6: wave_queue/ entry persisted at dispatch time ─────────────────
  console.log('\n── TEST 6: wave_queue request file persisted ──');

  const queuePath = resolve(TEST_SUBSTRATE, 'wave_queue', `${waveId}.wave.json`);
  assert(existsSync(queuePath), `wave_queue/${waveId}.wave.json exists`);

  // ── TEST 7: abortWave rejects completed waves ─────────────────────────────
  console.log('\n── TEST 7: abortWave rejects terminal waves ──');

  const abortResult = wg.abortWave(waveId);
  assert(abortResult === false, 'abortWave returns false for completed wave');

  // ── TEST 8: getWaveSummary reflects completion ────────────────────────────
  console.log('\n── TEST 8: getWaveSummary ──');

  const summary = wg.getWaveSummary();
  assert(summary.total >= 1,    `summary.total >= 1 (got ${summary.total})`);
  assert(summary.complete >= 1, `summary.complete >= 1 (got ${summary.complete})`);
  assert(summary.last_wave_id === waveId, `summary.last_wave_id = ${waveId}`);

  // ── SUMMARY ───────────────────────────────────────────────────────────────

  mockYoke.close();
  mockAnth.close();

  console.log('\n═══════════════════════════════════════════════════');
  console.log(` RESULTS: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════');

  if (failed === 0) {
    console.log('\nG1 PASS ✓ — B61 Phase A Wave Generator smoke test COMPLETE');
    console.log(`wave_id:  ${waveId}`);
    console.log(`archive:  ${ebletPath}`);
    console.log('\nAircraft Carrier holds. Substrate compounds. WE Grind Salt.');
  } else {
    console.error('\nG1 FAIL — see failures above');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('UNHANDLED ERROR:', err);
  process.exit(1);
});
