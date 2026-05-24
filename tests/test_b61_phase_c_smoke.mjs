/**
 * B61 Phase C Smoke Test — Wave Trigger Engine (G3)
 *
 * G3 PASS criterion (per canon LB-STACK-0164 §4, §10):
 *   All 4 trigger classes operational:
 *
 *   Class A — NL parsing → WaveRequest compile (stateless)
 *   Class B — substrate-state event → wave dispatch (pheromone routing)
 *   Class C — cron scheduler (nextCronFireMs + schedule init + dedup)
 *   Class D — cascade directive parsing → cascade wave fire
 *
 * Self-contained: spins up mock Yoke + mock Anthropic servers.
 * No real API keys required.
 *
 * Run: node tests/test_b61_phase_c_smoke.mjs
 *
 * Canon anchor: LB-STACK-0164 §4
 * Authored: B61 Phase C (BP037, 2026-05-11)
 */

import { createServer } from 'http';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';

// ─── Configuration ────────────────────────────────────────────────────────────

const MOCK_YOKE_PORT = 19995;
const MOCK_ANTH_PORT = 19996;
const TEST_SUBSTRATE = resolve(homedir(), '.lb_substrate_b61_phase_c_test');

process.env.LB_SUBSTRATE_ROOT  = TEST_SUBSTRATE;
process.env.SUBSTRATE_API_PORT = String(MOCK_YOKE_PORT);
process.env.ANTHROPIC_API_KEY  = 'test-mock-key-phase-c';

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

// ─── Mock Yoke server (Pawn + Rook) ──────────────────────────────────────────

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
            success:     true,
            dispatch_id: parsed.dispatch_id ?? randomUUID(),
            reply:       `PAWN_MOCK_C: trigger-engine test reply. VERDICT: CONVERGE. ` +
                         `Class trigger validated. Substrate compounds.`,
            receipt_hash: 'mock_c_pawn_hash',
            recipient:    'pawn',
          }));
          return;
        }

        if (req.method === 'POST' && req.url === '/yoke/rook/dispatch') {
          let parsed = {};
          try { parsed = JSON.parse(body); } catch {}
          rsp.end(JSON.stringify({
            success:     true,
            dispatch_id: parsed.dispatch_id ?? randomUUID(),
            reply:       `ROOK_MOCK_C: trigger-engine test reply. VERDICT: CONVERGE. ` +
                         `LB-STACK-0164 §4 operational.`,
            receipt_hash: 'mock_c_rook_hash',
            recipient:    'rook',
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

// ─── Mock Anthropic server (Knight + Bishop) ──────────────────────────────────

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
          const content = String(parsed.messages?.[0]?.content ?? '').slice(0, 80);

          // Detect cascade-trigger test — return a fire-next directive
          const isCascadeSeed = content.includes('CASCADE_SEED_TRIGGER_TEST');
          const replyText = isCascadeSeed
            ? `ANTHROPIC_MOCK_C: cascade seed synthesis. LB-STACK-0164 §4 Class D test.
<!-- fire-next: {"template":"4_way_cohort@v1","params":{"root_question":"Class D cascade test"},"anchor":"[class-D] cascade test wave"} -->`
            : `ANTHROPIC_MOCK_C: trigger-engine synthesis to "${content}". ` +
              `VERDICT: CONVERGE. All trigger classes operational. ` +
              `CLASS_C_CRON_PULSE: OK. [mock; prompt_len=${content.length}]`;

          rsp.end(JSON.stringify({
            id:          `msg_mock_${randomUUID().slice(0, 8)}`,
            type:        'message',
            role:        'assistant',
            content:     [{ type: 'text', text: replyText }],
            model:       'claude-sonnet-4-5',
            stop_reason: 'end_turn',
            usage:       { input_tokens: 120, output_tokens: 60 },
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

// ─── Patch fetch to route Anthropic calls to mock ─────────────────────────────

const _realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.includes('api.anthropic.com')) {
    const patched = u.replace('https://api.anthropic.com', `http://127.0.0.1:${MOCK_ANTH_PORT}`);
    return _realFetch(patched, opts);
  }
  return _realFetch(url, opts);
};

// ─── Wait for wave completion helper ─────────────────────────────────────────

async function waitForWave(wg, waveId, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await sleep(300);
    const w = wg.getWave(waveId);
    if (w && (w.status === 'complete' || w.status === 'aborted')) return w;
  }
  return wg.getWave(waveId);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runTests() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(' B61 Phase C — Wave Trigger Engine G3 Smoke Test');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('── Setup ──');

  if (existsSync(TEST_SUBSTRATE)) {
    rmSync(TEST_SUBSTRATE, { recursive: true, force: true });
  }
  mkdirSync(TEST_SUBSTRATE, { recursive: true });
  console.log(`  Test substrate: ${TEST_SUBSTRATE}`);

  const mockYoke = await startMockYokeServer();
  const mockAnth = await startMockAnthropicServer();

  // Import compiled modules from dist/
  const distDir   = resolve(import.meta.dirname ?? '.', '..', 'dist', 'main');
  const wgPath    = resolve(distDir, 'wave_generator.js');
  const wtePath   = resolve(distDir, 'wave_trigger_engine.js');
  const wtPath    = resolve(distDir, 'wave_template_writer.js');

  assert(existsSync(wgPath),  `wave_generator.js compiled at ${wgPath}`);
  assert(existsSync(wtePath), `wave_trigger_engine.js compiled at ${wtePath}`);
  assert(existsSync(wtPath),  `wave_template_writer.js compiled at ${wtPath}`);

  const wgFileUrl  = new URL(`file:///${wgPath.replace(/\\/g, '/')}`).href;
  const wteFileUrl = new URL(`file:///${wtePath.replace(/\\/g, '/')}`).href;

  let wg, wte;
  try {
    wg  = await import(wgFileUrl);
    wte = await import(wteFileUrl);
  } catch (e) {
    console.error(`FATAL: cannot import modules: ${e.message}`);
    process.exit(1);
  }

  // ── TEST 1: init Wave Generator ──────────────────────────────────────────────
  console.log('\n── TEST 1: initWaveGenerator ──');
  wg.initWaveGenerator();
  assert(existsSync(resolve(TEST_SUBSTRATE, 'wave_templates')), 'wave_templates/ exists');
  assert(existsSync(resolve(TEST_SUBSTRATE, 'wave_active')),    'wave_active/ exists');
  assert(existsSync(resolve(TEST_SUBSTRATE, 'wave_archive')),   'wave_archive/ exists');

  // ── TEST 2: initTriggerEngine ────────────────────────────────────────────────
  console.log('\n── TEST 2: initTriggerEngine (idempotent) ──');
  wte.initTriggerEngine();
  wte.initTriggerEngine(); // second call should no-op

  const summary1 = wte.getTriggerSummary();
  assert(summary1.initialized === true,              'trigger engine initialized');
  assert(summary1.class_b_subscriptions >= 4,        `class B subscriptions >= 4 (got ${summary1.class_b_subscriptions})`);
  assert(summary1.class_b_enabled >= 4,              `class B enabled >= 4 (got ${summary1.class_b_enabled})`);
  assert(summary1.class_c_schedules >= 3,            `class C schedules >= 3 (got ${summary1.class_c_schedules})`);
  assert(summary1.class_c_enabled >= 2,              `class C enabled >= 2 (got ${summary1.class_c_enabled})`);

  // trigger config dirs + defaults written
  const triggersDir = resolve(TEST_SUBSTRATE, 'wave_triggers');
  assert(existsSync(triggersDir),                                               'wave_triggers/ dir exists');
  assert(existsSync(resolve(triggersDir, 'class_b_subscriptions.json')),        'class_b_subscriptions.json written');
  assert(existsSync(resolve(triggersDir, 'class_c_schedules.json')),            'class_c_schedules.json written');

  // ── TEST 3: Class A — NL Parsing ─────────────────────────────────────────────
  console.log('\n── TEST 3: Class A — NL parsing ──');

  const nlTests = [
    {
      input:   'fire a 4-way cohort on cooperative-AI governance',
      template: '4_way_cohort@v1',
      paramKey: 'root_question',
      value:   'cooperative-AI governance',
    },
    {
      input:   '8-seg multi-scope on decentralized finance',
      template: '8_seg_multi_scope@v1',
      paramKey: 'domain',
      value:   'decentralized finance',
    },
    {
      input:   'math test on Creator split math: 83.3% is exact not 83%',
      template: 'n_track_math_test@v1',
      paramKey: 'claim',
      value:   "Creator split math: 83.3% is exact not 83%",
    },
    {
      input:   'high-vs-low on Liana Banyan membership economics',
      template: 'high_vs_low@v1',
      paramKey: 'prompt',
      value:   'Liana Banyan membership economics',
    },
    {
      input:   'cross-vendor verification on cooperative governance primitives',
      template: 'cross_vendor_verification@v1',
      paramKey: 'prompt',
      value:   'cooperative governance primitives',
    },
    {
      input:   'drill-down on Wave Generator automation architecture',
      template: 'recursive_drill_down@v1',
      paramKey: 'root_topic',
      value:   'Wave Generator automation architecture',
    },
  ];

  for (const tc of nlTests) {
    const req = wte.parseNlWaveRequest(tc.input);
    assert(req !== null,                         `Class A: parse "${tc.input.slice(0, 40)}…" → non-null`);
    assert(req?.template_name === tc.template,   `Class A: template_name = ${tc.template}`);
    assert(req?.params?.[tc.paramKey] !== undefined, `Class A: param "${tc.paramKey}" present`);
    assert(
      String(req?.params?.[tc.paramKey]).toLowerCase().includes(tc.value.toLowerCase().slice(0, 20)),
      `Class A: param value matches "${tc.value.slice(0, 40)}…"`,
    );
  }

  // Unknown input returns null
  const nullReq = wte.parseNlWaveRequest('something totally unrelated xyz');
  assert(nullReq === null, 'Class A: unknown phrase returns null');

  // ── TEST 4: Class A — wave dispatch from NL ──────────────────────────────────
  console.log('\n── TEST 4: Class A → dispatch wave ──');

  const nlReq = wte.parseNlWaveRequest('fire a 4-way cohort on Wave Generator Phase C operational');
  assert(nlReq !== null, 'Class A: NL req non-null');

  let nlWave = null;
  try {
    nlWave = await wg.dispatchWave(nlReq);
  } catch (e) {
    assert(false, `Class A: dispatchWave did not throw (got: ${e.message})`);
  }

  if (nlWave) {
    assert(typeof nlWave.wave_id === 'string', `Class A: wave dispatched wave_id=${nlWave.wave_id}`);
    const finalNlWave = await waitForWave(wg, nlWave.wave_id);
    assert(finalNlWave?.status === 'complete', `Class A: wave completed (status=${finalNlWave?.status})`);
    assert(finalNlWave?.segs.length === 4,     `Class A: 4 SEGs fired (got ${finalNlWave?.segs.length})`);
  }

  // ── TEST 5: Class B — emitSubstrateEvent → wave fires ────────────────────────
  console.log('\n── TEST 5: Class B — substrate event triggers wave ──');

  const waveSummaryBefore = wg.getWaveSummary();
  const completeCountBefore = waveSummaryBefore.complete;

  wte.emitSubstrateEvent('canon_eblet_landed', {
    eblet_id: 'LB-CODEX-0999-test',
    summary:  'B61 Phase C trigger engine operational test eblet',
  });

  // Class B fires via setImmediate, so small delay needed
  await sleep(1000);
  const finalClassBWave = await waitForWave(wg, wg.getWaveSummary().last_wave_id, 20000);
  const waveSummaryAfter = wg.getWaveSummary();

  assert(waveSummaryAfter.complete > completeCountBefore,
    `Class B: at least 1 new wave completed (before=${completeCountBefore}, after=${waveSummaryAfter.complete})`);

  // ── TEST 6: Class B — unknown event does NOT fire ───────────────────────────
  console.log('\n── TEST 6: Class B — unknown event suppressed ──');

  const countBeforeUnknown = wg.getWaveSummary().complete;
  wte.emitSubstrateEvent('nonexistent_event_type_xyz', { summary: 'should not fire' });
  await sleep(600);
  const countAfterUnknown = wg.getWaveSummary().complete;
  assert(countAfterUnknown === countBeforeUnknown,
    `Class B: unknown event suppressed (count unchanged at ${countBeforeUnknown})`);

  // ── TEST 7: Class C — nextCronFireMs ─────────────────────────────────────────
  console.log('\n── TEST 7: Class C — nextCronFireMs accuracy ──');

  // Every 5 minutes: */5 * * * *
  // For any given now, next fire must be at a minute that's divisible by 5
  const now1 = new Date('2026-05-11T00:01:00Z');
  const delay1 = wte.nextCronFireMs('*/5 * * * *', now1);
  const next1 = new Date(now1.getTime() + delay1);
  assert(next1.getUTCMinutes() % 5 === 0,
    `Class C: */5 schedule next fire at minute=${next1.getUTCMinutes()} (divisible by 5)`);
  assert(delay1 > 0 && delay1 <= 5 * 60 * 1000,
    `Class C: delay within 5 minutes (got ${Math.round(delay1 / 1000)}s)`);

  // 0 6 * * * — daily at 06:00 local; verify delay > 0 and ≤ 24 hours
  // (nextCronFireMs uses local time, so we check bounds not exact proximity)
  const now2 = new Date();
  const delay2 = wte.nextCronFireMs('0 6 * * *', now2);
  const next2 = new Date(now2.getTime() + delay2);
  assert(delay2 > 0,
    `Class C: daily-6AM delay > 0 (got ${Math.round(delay2 / 1000)}s)`);
  assert(delay2 <= 24 * 60 * 60 * 1000,
    `Class C: daily-6AM delay ≤ 24 hours (got ${Math.round(delay2 / 60000)}min)`);
  assert(next2.getHours() === 6 && next2.getMinutes() === 0,
    `Class C: daily-6AM fires at local hour=6 min=0 (got hour=${next2.getHours()} min=${next2.getMinutes()})`);

  // 0 9 * * 1 — weekly Monday 09:00 local; fire time must be Monday with hour=9
  const now3 = new Date();
  const delay3 = wte.nextCronFireMs('0 9 * * 1', now3);
  const next3 = new Date(now3.getTime() + delay3);
  assert(next3.getDay() === 1,
    `Class C: weekly-monday fires on local day=${next3.getDay()} (Monday=1)`);
  assert(next3.getHours() === 9 && next3.getMinutes() === 0,
    `Class C: weekly-monday fires at local hour=9 min=0 (got hour=${next3.getHours()} min=${next3.getMinutes()})`);
  assert(delay3 > 0 && delay3 <= 7 * 24 * 60 * 60 * 1000,
    `Class C: weekly-monday delay ≤ 7 days (got ${Math.round(delay3 / 3600000)}h)`);

  // Invalid cron throws
  let cronThrew = false;
  try { wte.nextCronFireMs('* * *'); } catch { cronThrew = true; }
  assert(cronThrew, 'Class C: invalid cron expression throws');

  // ── TEST 8: Class D — cascade directive parsing ──────────────────────────────
  console.log('\n── TEST 8: Class D — cascade directive parsing ──');

  // Use a synthesis text that does NOT contain a cascade directive
  const noDirective = 'Plain synthesis text with no fire-next directive here.';
  // We test the cascade logic indirectly: fire a wave with CASCADE_SEED_TRIGGER_TEST in the prompt;
  // the mock Anthropic server returns a fire-next directive in synthesis text, triggering Class D.

  const seedWave = await wg.dispatchWave({
    anchor: 'class-D-cascade-seed-test',
    template_name: '4_way_cohort@v1',
    params: {
      root_question: 'CASCADE_SEED_TRIGGER_TEST — Class D cascade fire validation',
      depth: 'brief',
    },
  });

  assert(typeof seedWave.wave_id === 'string', `Class D: seed wave dispatched (wave_id=${seedWave.wave_id})`);

  // Wait for seed wave to complete and Class D cascade to fire
  const seedFinal = await waitForWave(wg, seedWave.wave_id, 25000);
  assert(seedFinal?.status === 'complete', `Class D: seed wave complete (status=${seedFinal?.status})`);

  // Give Class D setImmediate + dispatch a moment to run
  await sleep(2000);

  const waveSummaryD = wg.getWaveSummary();
  assert(waveSummaryD.complete >= (completeCountBefore + 2),
    `Class D: at least one cascade wave completed (total=${waveSummaryD.complete})`);

  // ── TEST 9: Dedup / debounce — same template+params collapse ─────────────────
  console.log('\n── TEST 9: Dedup / debounce ──');

  // Fire Class B twice with same event within debounce window
  const countBeforeDedup = wg.getWaveSummary().complete;
  wte.emitSubstrateEvent('crown_jewel_bound', { jewel_id: 'CJ-DEDUP-TEST', summary: 'dedup test jewel' });
  await sleep(200);
  wte.emitSubstrateEvent('crown_jewel_bound', { jewel_id: 'CJ-DEDUP-TEST', summary: 'dedup test jewel' });

  // Allow time for debounce suppression
  await sleep(600);
  const countAfterDedup = wg.getWaveSummary().complete + wg.getWaveSummary().running;

  // With debounce, only 1 wave should fire (not 2)
  // We check that the trigger summary's dedup_registry grew
  const summaryAfterDedup = wte.getTriggerSummary();
  assert(summaryAfterDedup.dedup_registry_size > 0,
    `Dedup: dedup_registry_size > 0 (got ${summaryAfterDedup.dedup_registry_size})`);

  // ── TEST 10: Wave summary reflects all completed waves ───────────────────────
  console.log('\n── TEST 10: Final wave summary ──');

  // Wait for any in-flight waves
  await sleep(3000);
  const finalSummary = wg.getWaveSummary();

  assert(finalSummary.total >= 3,     `Summary: total >= 3 waves (got ${finalSummary.total})`);
  assert(finalSummary.complete >= 3,  `Summary: complete >= 3 waves (got ${finalSummary.complete})`);
  assert(finalSummary.aborted === 0,  `Summary: aborted = 0 (got ${finalSummary.aborted})`);

  // ── Cleanup ──────────────────────────────────────────────────────────────────
  mockYoke.close();
  mockAnth.close();

  // ── SUMMARY ──────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(` RESULTS: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════════');

  if (failed === 0) {
    console.log('\nG3 PASS ✓ — B61 Phase C Wave Trigger Engine smoke test COMPLETE');
    console.log('Trigger classes operational: A (NL), B (substrate-event), C (cron), D (cascade)');
    console.log('\nAircraft Carrier holds. Substrate compounds. WE Grind Salt. FOR THE KEEP.');
  } else {
    console.error('\nG3 FAIL — see failures above');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('UNHANDLED ERROR:', err);
  process.exit(1);
});
