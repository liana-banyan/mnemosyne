// CelPane Phase 3 Browser-Tier Runner — Bushel 60 Phase A (BP030)
// Runs Chromium headless, baseline vs substrate, 4 categories, N runs each.
// Writes JSONL to BISHOP_DROPZONE/14_CanonicalReferences/CELPANE_PHASE3_RAW_DATA_BP030/raw_runs.jsonl

import { chromium } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PAGE_PATH = resolve(__dirname, 'pages', 'harness.html');
const PAGE_URL = pathToFileURL(PAGE_PATH).href;

const RAW_DIR = resolve(__dirname, '..', '..', '..', 'BISHOP_DROPZONE', '14_CanonicalReferences', 'CELPANE_PHASE3_RAW_DATA_BP030');
fs.mkdirSync(RAW_DIR, { recursive: true });
const RAW_FILE = join(RAW_DIR, 'raw_runs.jsonl');

// CLI args
const argv = process.argv.slice(2);
function arg(name, def) {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return def;
  return argv[i+1];
}
const N = parseInt(arg('n', '30'), 10);
const CATEGORIES = arg('categories', 'cold,warm,update,borrow').split(',');

console.log(`[runner] N=${N} categories=${CATEGORIES.join(',')} url=${PAGE_URL}`);
console.log(`[runner] raw output: ${RAW_FILE}`);

function appendRecord(rec) {
  fs.appendFileSync(RAW_FILE, JSON.stringify(rec) + '\n');
}

async function runCold(browser, impl) {
  // Fresh context for cold start
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const t0 = performance.now();
  await page.goto(`${PAGE_URL}?impl=${impl}`);
  await page.waitForFunction(() => window.__harnessReady === true, { timeout: 10000 });
  // mount-end mark already fired in page; read the measure
  const mountMs = await page.evaluate(() => {
    const m = performance.getEntriesByName('mount')[0];
    return m ? m.duration : null;
  });
  const fcp = await page.evaluate(() => {
    const e = performance.getEntriesByType('paint').find(x => x.name === 'first-contentful-paint');
    return e ? e.startTime : null;
  });
  const totalMs = performance.now() - t0;
  await ctx.close();
  return { total_ms: totalMs, mount_ms: mountMs, fcp_ms: fcp };
}

async function runWarm(browser, impl, cycles=100) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${PAGE_URL}?impl=${impl}`);
  await page.waitForFunction(() => window.__harnessReady === true, { timeout: 10000 });
  // 5 warm-up cycles to settle
  await page.evaluate(() => { for (let i=0;i<5;i++) window.__harness.runCycle(); });
  // Measure
  const result = await page.evaluate((cycles) => {
    const t0 = performance.now();
    for (let i=0; i<cycles; i++) window.__harness.runCycle();
    const totalMs = performance.now() - t0;
    return { totalMs, cycles };
  }, cycles);
  await ctx.close();
  return { total_ms: result.totalMs, cycles: result.cycles, mean_frame_ms: result.totalMs / result.cycles };
}

async function runUpdate(browser, impl, cycles=50) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${PAGE_URL}?impl=${impl}`);
  await page.waitForFunction(() => window.__harnessReady === true, { timeout: 10000 });
  await page.evaluate(() => { for (let i=0;i<5;i++) window.__harness.runCycle(); });
  const result = await page.evaluate((cycles) => {
    // Per cadence: P11 every cycle, P5/P8/P12 every 2nd, P1/P7 every 4th, etc.
    const t0 = performance.now();
    for (let i=0; i<cycles; i++) {
      const dirty = ['P11','P12'];
      if (i % 2 === 0) dirty.push('P5','P6','P8');
      if (i % 4 === 0) dirty.push('P1','P7');
      if (i % 8 === 0) dirty.push('P2','P9');
      if (i % 16 === 0) dirty.push('P3','P4');
      window.__harness.mutateContent(dirty);
      window.__harness.runCycle();
    }
    const totalMs = performance.now() - t0;
    return { totalMs, cycles };
  }, cycles);
  await ctx.close();
  return { total_ms: result.totalMs, cycles: result.cycles, mean_update_ms: result.totalMs / result.cycles };
}

async function runBorrow(browser, impl, ops=50) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${PAGE_URL}?impl=${impl}`);
  await page.waitForFunction(() => window.__harnessReady === true, { timeout: 10000 });
  await page.evaluate(() => { for (let i=0;i<5;i++) window.__harness.runCycle(); });
  const edges = [
    ['P3','P4'],['P5','P6'],['P7','P8'],['P9','P11']
  ];
  const result = await page.evaluate(({ ops, edges }) => {
    const t0 = performance.now();
    for (let i=0; i<ops; i++) {
      const [from, to] = edges[i % edges.length];
      window.__harness.runBorrow(from, to);
    }
    const totalMs = performance.now() - t0;
    return { totalMs, ops };
  }, { ops, edges });
  await ctx.close();
  return { total_ms: result.totalMs, ops: result.ops, mean_borrow_ms: result.totalMs / result.ops };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const sessionId = crypto.randomUUID();
  console.log(`[runner] session ${sessionId}`);

  let runCount = 0;
  const startedAt = Date.now();

  for (const category of CATEGORIES) {
    for (const impl of ['baseline', 'substrate']) {
      console.log(`[runner] category=${category} impl=${impl} N=${N}`);
      for (let i=0; i<N; i++) {
        let metrics;
        try {
          if (category === 'cold') metrics = await runCold(browser, impl);
          else if (category === 'warm') metrics = await runWarm(browser, impl);
          else if (category === 'update') metrics = await runUpdate(browser, impl);
          else if (category === 'borrow') metrics = await runBorrow(browser, impl);
          else throw new Error('unknown category ' + category);
        } catch (err) {
          console.error(`[runner] ERROR run ${i} ${category} ${impl}: ${err.message}`);
          metrics = { error: err.message };
        }
        const rec = {
          run_id: crypto.randomUUID(),
          session_id: sessionId,
          run_index: i,
          implementation: impl,
          category,
          browser: 'chromium',
          viewport: 'desktop',
          ts_iso: new Date().toISOString(),
          ...metrics,
        };
        appendRecord(rec);
        runCount++;
        if (runCount % 20 === 0) {
          const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
          console.log(`[runner]   progress: ${runCount} runs, ${elapsed}s elapsed`);
        }
      }
    }
  }

  await browser.close();
  console.log(`[runner] done, ${runCount} runs in ${((Date.now()-startedAt)/1000).toFixed(1)}s`);
  console.log(`[runner] raw data: ${RAW_FILE}`);
}

main().catch(err => { console.error(err); process.exit(1); });
