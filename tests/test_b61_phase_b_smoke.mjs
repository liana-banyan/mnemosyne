/**
 * B61 Phase B Smoke Test — Six Wave Templates (G2)
 *
 * G2 PASS criterion (per prompt spec):
 *   For each of the six templates:
 *   1. Template loads from wave_templates/ (HMAC present)
 *   2. Wave dispatched with template_name + parameter binding
 *   3. Daemon decomposes via template → N parallel SEG dispatches fire
 *   4. All N SEGs return DONE
 *   5. Synthesis SEG fires with all N receipts
 *   6. synthesis_receipt.eblet.md written + HMAC-bound to wave_archive/
 *   7. Eblet references template name + has substantive content
 *
 * Self-contained: spins up mock Yoke + mock Anthropic servers.
 * No real API keys required.
 *
 * Run: node tests/test_b61_phase_b_smoke.mjs
 *
 * Templates under test:
 *   1. 4_way_cohort@v1
 *   2. 8_seg_multi_scope@v1
 *   3. n_track_math_test@v1
 *   4. high_vs_low@v1
 *   5. cross_vendor_verification@v1
 *   6. recursive_drill_down@v1
 */

import { createServer } from 'http';
import { existsSync, readFileSync, mkdirSync, rmSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';

// ─── Configuration ────────────────────────────────────────────────────────────

const MOCK_YOKE_PORT = 19993;
const MOCK_ANTH_PORT = 19994;
const TEST_SUBSTRATE = resolve(homedir(), '.lb_substrate_b61_phase_b_test');

process.env.LB_SUBSTRATE_ROOT  = TEST_SUBSTRATE;
process.env.SUBSTRATE_API_PORT = String(MOCK_YOKE_PORT);
process.env.ANTHROPIC_API_KEY  = 'test-mock-key-phase-b';

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

// ─── Mock Yoke server (Pawn + Rook + wave endpoints not used here) ────────────

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
          const prompt = String(parsed.prompt ?? '').slice(0, 60);
          rsp.end(JSON.stringify({
            success:      true,
            dispatch_id:  parsed.dispatch_id ?? randomUUID(),
            reply:        `PAWN_MOCK_B: partition research on "${prompt}" — cooperative commerce drives $5/yr membership value.`,
            receipt_hash: 'mock_b_pawn_hash',
            recipient:    'pawn',
          }));
          return;
        }

        if (req.method === 'POST' && req.url === '/yoke/rook/dispatch') {
          let parsed = {};
          try { parsed = JSON.parse(body); } catch {}
          const prompt = String(parsed.prompt ?? '').slice(0, 60);
          rsp.end(JSON.stringify({
            success:      true,
            dispatch_id:  parsed.dispatch_id ?? randomUUID(),
            reply:        `ROOK_MOCK_B: cross-domain analysis on "${prompt}" — Wave Generator §3 templates operational.`,
            receipt_hash: 'mock_b_rook_hash',
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

// ─── Mock Anthropic server (Knight + Bishop via /v1/messages) ─────────────────

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
          rsp.end(JSON.stringify({
            id:          `msg_mock_${randomUUID().slice(0, 8)}`,
            type:        'message',
            role:        'assistant',
            content: [{
              type: 'text',
              text: `ANTHROPIC_MOCK_B: synthesis/analysis response to "${content}" — ` +
                    `LB-STACK-0164 §3 template fire confirmed. ` +
                    `Wave Generator Phase B operational. ` +
                    `Creator keeps 83.3%. Substrate compounds. ` +
                    `[mock; prompt_len=${content.length}]`,
            }],
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
      console.log(`  [mock-anth]  Anthropic (Knight+Bishop) mock on port ${MOCK_ANTH_PORT}`);
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

// ─── Template fire + validate helper ─────────────────────────────────────────

async function fireTemplate(wg, templateName, params, expectedSegCount, label) {
  console.log(`\n── ${label} ──`);

  const req = {
    anchor:        `g2-test-${templateName}`,
    template_name: templateName,
    params,
  };

  let wave;
  try {
    wave = await wg.dispatchWave(req);
  } catch (e) {
    assert(false, `${label}: dispatchWave did not throw (got: ${e.message})`);
    return null;
  }

  assert(typeof wave.wave_id === 'string' && wave.wave_id.startsWith('wave-'),
    `${label}: wave_id valid (${wave.wave_id})`);
  assert(wave.segs.length === expectedSegCount,
    `${label}: ${expectedSegCount} SEGs decomposed (got ${wave.segs.length})`);

  // Wait for completion
  const waveId = wave.wave_id;
  let finalWave = null;
  for (let i = 0; i < 80; i++) {
    await sleep(400);
    const w = wg.getWave(waveId);
    if (w && (w.status === 'complete' || w.status === 'aborted')) {
      finalWave = w;
      break;
    }
  }

  assert(finalWave !== null, `${label}: wave completed within 32s`);
  if (!finalWave) return null;

  assert(finalWave.status === 'complete',
    `${label}: status=complete (got ${finalWave.status})`);

  const doneCount = finalWave.segs.filter(s => s.status === 'done').length;
  assert(doneCount === expectedSegCount,
    `${label}: all ${expectedSegCount} SEGs done (got ${doneCount})`);

  assert(typeof finalWave.synthesis_text === 'string' && finalWave.synthesis_text.length > 20,
    `${label}: synthesis_text present (len=${(finalWave.synthesis_text ?? '').length})`);

  // Validate archive artifacts
  const archiveDir = resolve(TEST_SUBSTRATE, 'wave_archive', waveId);
  const ebletPath  = resolve(archiveDir, 'synthesis_receipt.eblet.md');
  const hmacPath   = resolve(archiveDir, 'wave.hmac');

  assert(existsSync(archiveDir),  `${label}: wave_archive/${waveId}/ exists`);
  assert(existsSync(ebletPath),   `${label}: synthesis_receipt.eblet.md exists`);
  assert(existsSync(hmacPath),    `${label}: wave.hmac exists`);

  if (existsSync(ebletPath)) {
    const eblet = readFileSync(ebletPath, 'utf8');
    assert(eblet.includes('Wave Synthesis Receipt'), `${label}: Eblet has receipt header`);
    assert(eblet.includes(waveId),                  `${label}: Eblet contains wave_id`);
    assert(eblet.includes(templateName),             `${label}: Eblet references template name`);
    assert(eblet.includes('LB-STACK-0164'),          `${label}: Eblet has canon anchor`);
    assert(eblet.length > 400,                       `${label}: Eblet is substantive (${eblet.length} chars)`);
  }

  if (existsSync(hmacPath)) {
    const hmac = readFileSync(hmacPath, 'utf8').trim();
    assert(hmac.length === 64, `${label}: HMAC is 64-char hex (len=${hmac.length})`);
    assert(/^[0-9a-f]+$/.test(hmac), `${label}: HMAC is valid hex`);
  }

  return { waveId, ebletPath };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runTests() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(' B61 Phase B — Six Wave Templates G2 Smoke Test');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('── Setup ──');

  if (existsSync(TEST_SUBSTRATE)) {
    rmSync(TEST_SUBSTRATE, { recursive: true, force: true });
  }
  mkdirSync(TEST_SUBSTRATE, { recursive: true });
  console.log(`  Test substrate: ${TEST_SUBSTRATE}`);

  const mockYoke = await startMockYokeServer();
  const mockAnth = await startMockAnthropicServer();

  // Import compiled wave_generator + wave_template_writer from dist/
  const distDir   = resolve(import.meta.dirname ?? '.', '..', 'dist', 'main');
  const wgPath    = resolve(distDir, 'wave_generator.js');
  const wtPath    = resolve(distDir, 'wave_template_writer.js');

  assert(existsSync(wgPath), `wave_generator.js compiled at ${wgPath}`);
  assert(existsSync(wtPath), `wave_template_writer.js compiled at ${wtPath}`);

  const wgFileUrl = new URL(`file:///${wgPath.replace(/\\/g, '/')}`).href;
  let wg;
  try {
    wg = await import(wgFileUrl);
  } catch (e) {
    console.error(`FATAL: cannot import wave_generator.js: ${e.message}`);
    process.exit(1);
  }

  // ── TEST 1: init + template registration ────────────────────────────────────
  console.log('\n── TEST 1: initWaveGenerator + template registration ──');

  wg.initWaveGenerator();

  const templateDir = resolve(TEST_SUBSTRATE, 'wave_templates');
  assert(existsSync(templateDir), 'wave_templates/ directory created');

  const EXPECTED_TEMPLATES = [
    '4_way_cohort@v1',
    '8_seg_multi_scope@v1',
    'n_track_math_test@v1',
    'high_vs_low@v1',
    'cross_vendor_verification@v1',
    'recursive_drill_down@v1',
  ];

  for (const name of EXPECTED_TEMPLATES) {
    const tmplPath = resolve(templateDir, `${name}.tmpl.json`);
    assert(existsSync(tmplPath), `template file ${name}.tmpl.json written`);

    if (existsSync(tmplPath)) {
      const spec = JSON.parse(readFileSync(tmplPath, 'utf8'));
      assert(typeof spec.hmac === 'string' && spec.hmac.length === 64,
        `${name}: HMAC present and 64-char hex`);
      assert(spec.canon_anchor.includes('LB-STACK-0164'),
        `${name}: canon anchor references LB-STACK-0164`);
      assert(Array.isArray(spec.segs) || spec.seg_expand,
        `${name}: has segs[] or seg_expand`);
      assert(spec.synthesis && spec.synthesis.recipient,
        `${name}: has synthesis shape with recipient`);
    }
  }

  // ── TEST 2: listTemplates() ──────────────────────────────────────────────────
  console.log('\n── TEST 2: listTemplates() ──');

  const listed = wg.listTemplates();
  assert(listed.length === 6, `listTemplates returns 6 templates (got ${listed.length})`);
  for (const name of EXPECTED_TEMPLATES) {
    assert(listed.includes(name), `listTemplates includes ${name}`);
  }

  // ── TEST 3: loadTemplate + HMAC verification ─────────────────────────────────
  console.log('\n── TEST 3: loadTemplate + HMAC verification ──');

  for (const name of EXPECTED_TEMPLATES) {
    let spec;
    try {
      spec = wg.loadTemplate(name);
    } catch (e) {
      assert(false, `loadTemplate("${name}") did not throw (got: ${e.message})`);
      continue;
    }
    assert(spec.template_name === name.split('@')[0],
      `${name}: template_name matches`);
    assert(spec.version === name.split('@')[1],
      `${name}: version matches`);
  }

  // ── TEST 4–9: Fire each template ────────────────────────────────────────────

  const results = [];

  // Template 1 — 4_way_cohort@v1 (4 Pawn SEGs + 1 Bishop synthesis = watch 4 SEGs)
  results.push(await fireTemplate(wg,
    '4_way_cohort@v1',
    { root_question: 'How does cooperative commerce benefit small producers?', depth: 'brief' },
    4,
    'TEST 4: 4_way_cohort@v1',
  ));

  // Template 2 — 8_seg_multi_scope@v1 (8 Bishop SEGs + 1 Knight synthesis)
  results.push(await fireTemplate(wg,
    '8_seg_multi_scope@v1',
    { domain: 'cooperative platform economics' },
    8,
    'TEST 5: 8_seg_multi_scope@v1',
  ));

  // Template 3 — n_track_math_test@v1 (3 tracks default)
  results.push(await fireTemplate(wg,
    'n_track_math_test@v1',
    { claim: 'The Wave Generator is the canonical next-tier abstraction on top of Yoke routing (LB-STACK-0164).' },
    3,
    'TEST 6: n_track_math_test@v1',
  ));

  // Template 4 — high_vs_low@v1 (2 SEGs fixed)
  results.push(await fireTemplate(wg,
    'high_vs_low@v1',
    { prompt: 'What is the cooperative advantage of the Liana Banyan 83.3% creator keep model?' },
    2,
    'TEST 7: high_vs_low@v1',
  ));

  // Template 5 — cross_vendor_verification@v1 (3 vendors default)
  results.push(await fireTemplate(wg,
    'cross_vendor_verification@v1',
    { prompt: 'Is cooperative commerce a viable alternative to platform capitalism?' },
    3,
    'TEST 8: cross_vendor_verification@v1',
  ));

  // Template 6 — recursive_drill_down@v1 (4 branches default)
  results.push(await fireTemplate(wg,
    'recursive_drill_down@v1',
    { root_topic: 'Wave Generator automation architecture' },
    4,
    'TEST 9: recursive_drill_down@v1',
  ));

  // ── TEST 10: all 6 receipts in wave_archive ──────────────────────────────────
  console.log('\n── TEST 10: all 6 receipts archived ──');

  const completedFires = results.filter(r => r !== null);
  assert(completedFires.length === 6,
    `All 6 template fires completed (got ${completedFires.length})`);

  for (const r of completedFires) {
    if (r) {
      assert(existsSync(r.ebletPath),
        `synthesis_receipt.eblet.md exists for ${r.waveId.slice(0, 20)}…`);
    }
  }

  // ── TEST 11: wave summary reflects 6 complete waves ─────────────────────────
  console.log('\n── TEST 11: wave summary ──');

  const summary = wg.getWaveSummary();
  assert(summary.complete >= 6,
    `summary.complete >= 6 (got ${summary.complete})`);
  assert(summary.aborted === 0,
    `summary.aborted = 0 (got ${summary.aborted})`);

  // ── Cleanup ──────────────────────────────────────────────────────────────────
  mockYoke.close();
  mockAnth.close();

  // ── SUMMARY ──────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(` RESULTS: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════════');

  if (failed === 0) {
    console.log('\nG2 PASS ✓ — B61 Phase B Six Wave Templates smoke test COMPLETE');
    console.log(`Templates registered: ${EXPECTED_TEMPLATES.join(', ')}`);
    console.log(`Template fires: 6/6`);
    console.log(`Eblets archived: 6/6`);
    console.log('\nAircraft Carrier holds. Substrate compounds. WE Grind Salt.');
  } else {
    console.error('\nG2 FAIL — see failures above');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('UNHANDLED ERROR:', err);
  process.exit(1);
});
