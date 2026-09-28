#!/usr/bin/env node
// proveit_screenshot.mjs -- D-BP223-BM04-X033S3-010 Gap 3
//
// Connects Playwright to a running MnemosyneC dev instance over CDP (chromium.connectOverCDP),
// navigates to the Compass shell's "Proof" tab (compass/ProofTab.tsx mounts ProveItWorksTab.tsx
// at the top of that tab, no scroll needed), waits for region D to render seed cards, screenshots
// it, then clicks "Ask this one" on a seed row and screenshots the resulting ticker + card.
//
// USAGE: node scripts/proveit_screenshot.mjs <cdpPort> <outDir>
//   <cdpPort>  the --remote-debugging-port the target instance was launched with (default 9333,
//              the port dev:main:cdp itself uses -- pass the actual port if a different one was
//              used to avoid colliding with another already-running instance, see PROGRESS.log).
//   <outDir>   directory to write 01_prove_it_tab.png / 02_ask_this_one_ticker.png / ticker_run.log
//              (default: this dispatch's own screenshots/ folder).

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const CDP_PORT = process.argv[2] || '9333';
const OUT_DIR = process.argv[3] || resolve(
  'C:/Users/Administrator/Documents/LianaBanyanPlatform/BISHOP_DROPZONE',
  'D-BP223-BM04-X033S3-010-PROVE-IT-SEED-TEXT-ASK-PATH-AND-LIVE-CHECK',
  'screenshots',
);
mkdirSync(OUT_DIR, { recursive: true });

function log(msg) {
  console.log(`[proveit_screenshot] ${msg}`);
}

async function main() {
  log(`connecting to ws over CDP at http://127.0.0.1:${CDP_PORT} ...`);
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
  const contexts = browser.contexts();
  if (contexts.length === 0) throw new Error('no browser contexts found over CDP -- is the app actually open?');
  let page = null;
  for (const ctx of contexts) {
    for (const p of ctx.pages()) {
      const url = p.url();
      // The Electron main window loads the Vite dev URL (127.0.0.1:5173) or, in prod, a
      // file:// index.html -- skip devtools:// / about:blank / any embedded <webview> guest
      // page a Browser Authority window might already have open.
      if (url.startsWith('http://127.0.0.1:5173') || url.startsWith('file://')) {
        page = p;
        break;
      }
    }
    if (page) break;
  }
  if (!page) {
    // Fall back to the first non-devtools page if the URL match above found nothing (e.g. the
    // window is still on about:blank a beat after launch) -- log every page seen either way so
    // a failure here is diagnosable, never a silent wrong-page screenshot.
    const all = contexts.flatMap((c) => c.pages());
    log(`no 127.0.0.1:5173/file:// page found; pages seen: ${all.map((p) => p.url()).join(', ')}`);
    page = all.find((p) => !p.url().startsWith('devtools://')) || all[0];
  }
  if (!page) throw new Error('no usable page found over CDP at all.');
  log(`using page: ${page.url()}`);

  await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);

  // Navigate to the Compass shell's "Proof" tab (5-tab nav: Ask, Proof, Library, Social, More --
  // CompassShell.tsx TABS array). ProveItWorksTab.tsx is mounted at the top of that tab.
  const proofTabButton = page.getByRole('button', { name: 'Proof', exact: true });
  await proofTabButton.waitFor({ state: 'visible', timeout: 30000 });
  await proofTabButton.click();
  log('clicked the "Proof" tab.');

  // Region D: "Use a question somebody else asked" -- wait for at least one seed row to render
  // (the seed loader materializes on first IPC registration, spec Section 6 "day one").
  const regionDHeading = page.getByText('D. Use a question somebody else asked', { exact: false });
  await regionDHeading.waitFor({ state: 'visible', timeout: 30000 });
  const askThisOneButtons = page.getByRole('button', { name: 'Ask this one', exact: true });
  await askThisOneButtons.first().waitFor({ state: 'visible', timeout: 30000 });
  const seedRowCount = await askThisOneButtons.count();
  log(`region D rendered with ${seedRowCount} "Ask this one" row(s).`);

  const screenshot1 = resolve(OUT_DIR, '01_prove_it_tab.png');
  await page.screenshot({ path: screenshot1, fullPage: true });
  log(`saved ${screenshot1}`);

  // Click "Ask this one" on the first seed row -- per D-BP223-BM04-X033S3-010's own Region D
  // per-row-unlock fix (ProveItWorksTab.tsx), a seed row is always clickable even before this
  // install has published a card of its own.
  await askThisOneButtons.first().click();
  log('clicked "Ask this one" on the first seed row.');

  // Wait for the ticker panel ("B. Watch it work") and its "0 model calls" meter-delta line,
  // which ask_this_one.ts always emits on a real hit (never fabricated -- see that file's own
  // 'THIS ask: 0 model calls . our cost $0.00' literal).
  const tickerHeading = page.getByText('B. Watch it work', { exact: false });
  await tickerHeading.waitFor({ state: 'visible', timeout: 15000 });
  await page.getByText('0 model calls', { exact: false }).first().waitFor({ state: 'visible', timeout: 15000 }).catch((e) => {
    log(`WARNING: "0 model calls" text did not appear within timeout: ${e.message}`);
  });
  await page.waitForTimeout(500); // let the last ticker line's fade-in settle for the screenshot

  const screenshot2 = resolve(OUT_DIR, '02_ask_this_one_ticker.png');
  await page.screenshot({ path: screenshot2, fullPage: true });
  log(`saved ${screenshot2}`);

  // Save the ticker's own text content (Region B's lines) to ticker_run.log.
  const tickerPanel = page.locator('div', { hasText: 'B. Watch it work' }).first();
  let tickerText = '';
  try {
    tickerText = await tickerPanel.innerText({ timeout: 5000 });
  } catch (e) {
    tickerText = `(could not read ticker panel text: ${e.message})`;
  }
  const tickerLogPath = resolve(OUT_DIR, '..', 'ticker_run.log');
  writeFileSync(tickerLogPath, `${new Date().toISOString()}\n\n${tickerText}\n`, 'utf-8');
  log(`saved ${tickerLogPath}`);

  await browser.close();
  log('done.');
}

main().catch((err) => {
  console.error('[proveit_screenshot] FAILED:', err);
  process.exitCode = 1;
});
