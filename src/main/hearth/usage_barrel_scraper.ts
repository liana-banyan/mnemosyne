// usage_barrel_scraper.ts -- KN-BP145-M1 ("Barrel 1 has no data source anywhere. The vendor
// already publishes it.")
//
// WHAT THIS FILE IS: a main-process module that scrapes the Anthropic claude.ai account's own
// "Settings > Usage" panel for the two rolling usage windows every claude.ai / Claude Code /
// Claude Max plan already tracks: the rolling 5-hour session window and the rolling 7-day
// ("Weekly") window, each shown as a consumed-percent plus a countdown-to-reset. Optionally a
// third row (a model-specific weekly cap, e.g. "Weekly - Opus" on Max plans) and a "Usage
// credits" pay-as-you-go balance. This module never invents a token count or a denominator --
// the vendor's own page never publishes one (confirmed in Phase 0, see the KN-BP145-M1 report)
// and this file does not pretend otherwise.
//
// PHASE 0 CORRECTION (report this, do not silently absorb it): the ticket's premise text calls
// the scrape target "a different site/vendor" than the existing nexus-authority bridge. That is
// not quite right -- Phase 0 research (see the KN-BP145-M1 report's cited sources) confirms the
// "5-hour limit" / "Weekly - all models" / "Resets in X hr Y min" terminology is Anthropic's own
// claude.ai Settings > Usage page, i.e. the SAME root domain (claude.ai) the existing
// nexus_authority_persistent_session.ts bridge already signs into for browser-authority second
// opinions. This module still uses its OWN isolated session partition (see below), but the real
// reason is to avoid navigating the SHARED nexus-authority <webview> away from an in-flight
// authority query, not because this is a genuinely separate vendor. A real, load-bearing
// consequence follows from that isolation choice: a brand-new Electron partition string starts
// with ZERO cookies. It cannot ride on the nexus-authority session's already-signed-in
// claude.ai cookies (Electron partitions are fully isolated from each other by design). This
// module's own session therefore needs its OWN one-time interactive sign-in
// (showUsageBarrelSessionForSignIn, mirroring showNexusAuthoritySessionForSignIn's exact
// contract) before any scrape here can ever return real data. Until a human completes that
// sign-in, every scrape honestly reports failureReason: 'not-signed-in-or-timeout' (or a more
// specific reason), never a fabricated percentage.
//
// MECHANISM (R-MECHANISM-VERIFY) -- mirrors nexus_authority_persistent_session.ts's own pattern,
// read for the pattern and NOT modified:
//   - One hidden BrowserWindow (`show: false`), lazily created on first use, kept alive for the
//     app's lifetime once created.
//   - That window's page hosts exactly one <webview>, with `partition="persist:usage-barrel-
//     scraper"` -- a durable, isolated Electron session partition distinct from
//     NEXUS_AUTHORITY_PARTITION ('persist:nexus-authority').
//   - The <webview>'s `preload` attribute points at the SAME compiled webview_preload.js that
//     the nexus-authority bridge and EmbeddedChrome.tsx already use -- this module never
//     duplicates or edits that file. It does not actually need any of that preload's
//     authority-scraping listeners (this module drives the guest page directly via
//     `<webview>.executeJavaScript()` from the host page, the same technique
//     probeNexusAuthoritySignInStatus() already uses) -- the shared preload is reused purely so
//     this module never needs a second copy of that file or a webview with no preload attribute
//     at all, keeping one convention across every hidden-webview surface in this codebase.
//   - Scraping is resilient-selector-plus-textual-fallback, never a single brittle CSS selector:
//     since no confirmed DOM markup for claude.ai's Settings > Usage page exists anywhere in
//     this codebase or this session's research (Phase 0 finding, reported honestly), the primary
//     extraction strategy scans rendered LINE TEXT (`document.body.innerText`, exactly the same
//     class of technique webview_preload.ts's own tiered selector-then-text-fallback approach
//     already relies on for its own last-resort tier) for the vendor's own label strings ("5-hour
//     limit" / "5 hour" / "weekly" / "usage credits") rather than guessing CSS class names that
//     would break on the vendor's next unannounced markup change. A best-effort CSS-selector
//     tier is still tried FIRST (in case a future maintenance pass pins real selectors), with the
//     line-text scan as the resilient fallback -- same tiered contract as
//     GOOGLE_ANSWER_SELECTORS/PERPLEXITY_ANSWER_SELECTORS in webview_preload.ts.
//   - HONESTY FIREWALL: on total scrape failure (no window matched neither the 5-hour nor the
//     weekly label anywhere in the rendered text), this module NEVER fabricates a percent or
//     substitutes zero for unknown. It returns success:false with an explicit failureReason and
//     captures a bounded DOM snapshot (mirroring webview_preload.ts's own captureDomSnapshot()
//     algorithm: last few meaningfully-sized text elements, per-field truncated, byte-budget
//     capped) for future selector maintenance -- written to a self-diagnostic JSONL log via this
//     module's OWN fs access. This module runs entirely in the unsandboxed main process, so
//     unlike webview_preload.ts's guest-context relay (which must forward every log line over
//     ipcRenderer to index.ts's 'embedded-browser-injection-log' handler because a sandboxed
//     <webview> guest has no Node fs/path), this module writes its diagnostic log directly --
//     no new IPC channel, no edit to index.ts required.
//
// RATE / OPERATIONAL-ANSWER DESIGN (the ticket's actual ask): the vendor gives percent-consumed
// plus a reset countdown, never an allocation or a token count, and none is invented here. Two
// windows (5-hour, weekly) run concurrently and either can bind first. This module keeps a small
// on-disk history of past scrapes (usage_barrel_history.jsonl under Electron userData) so it can
// compute a real consumption RATE (percent per millisecond) from at least two samples of the SAME
// window, then project a time-to-exhaustion for that window and compare it against that window's
// OWN parsed reset countdown. Whichever window (if any) is projected to hit 100% before its own
// reset is "the wall" the ticket asks about; if neither is, that is reported as fine, not a false
// alarm; if there is not yet enough history to compute a rate, that is reported as unknown, never
// as "0% risk."
//
// WIRING BOUNDARY (report this plainly, do not fabricate an IPC bridge that is not real): this
// ticket owns only this new module plus TwoBarrelMeter.tsx. The live path a real IPC round trip
// would need -- a preload.ts contextBridge export, an index.ts ipcMain handler that imports and
// calls scrapeVendorUsagePanel() below, and a ProveItWorksTab.tsx call site that passes the
// result down as TwoBarrelMeter's new `vendorUsage` prop -- touches three files this ticket does
// not own and that this same wave's other concurrent tickets may be actively editing (index.ts,
// preload.ts) or may already own for exactly this purpose (KN-BP145-M3's own untracked
// `.kn_bp145m3_ipc_map.txt` scratch file, observed live in the working tree during this ticket's
// Phase 0, strongly suggests M3 is the IPC-wiring ticket for this same wave). This module's
// exports below are therefore the complete, real, callable surface a future IPC handler needs --
// `scrapeVendorUsagePanel()` and `computeUsageBarrelOperationalSnapshot()` -- but nothing in this
// repo calls them yet, and this file does not pretend otherwise.

import { app, BrowserWindow } from 'electron';
import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// ─── Isolated session (separate from persist:nexus-authority) ─────────────────────────────────

export const USAGE_BARREL_PARTITION = 'persist:usage-barrel-scraper';

// Inferred from Phase 0 web research cited in the KN-BP145-M1 report (Anthropic's own claude.ai
// Settings > Usage page, reached today by a human via "sign in to claude.ai -> account initials,
// bottom-left -> Settings -> Usage"). Not live-verified against the real DOM in this session (no
// signed-in webview session exists yet in this new partition) -- see the header's honesty note.
export const VENDOR_USAGE_PAGE_URL = 'https://claude.ai/settings/usage';

let usageBarrelWindow: BrowserWindow | null = null;

function webviewPreloadPath(): string {
  // Same compiled artifact path nexus_authority_persistent_session.ts and EmbeddedChrome.tsx
  // already compute for their own <webview preload=...> -- reused, never duplicated or edited.
  return join(__dirname, 'embedded_browser', 'webview_preload.js');
}

function buildEmbedderHtml(): string {
  const preloadPath = webviewPreloadPath();
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body { margin: 0; padding: 0; height: 100vh; width: 100vw; display: flex; flex-direction: column; background: #0f0f1a; font-family: -apple-system, "Segoe UI", Arial, sans-serif; overflow: hidden; }
  #bar { display: flex; gap: 6px; align-items: center; padding: 6px 8px; background: #1a1a2e; border-bottom: 1px solid #2d3748; box-sizing: border-box; height: 38px; flex: 0 0 38px; }
  button { background: #2d3748; color: #e2e8f0; border: 1px solid #4a5568; border-radius: 4px; padding: 5px 10px; font-size: 12px; cursor: pointer; }
  button:hover { background: #374151; }
  #status { color: #94a3b8; font-size: 10px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: monospace; }
  #wvwrap { flex: 1 1 auto; position: relative; overflow: hidden; min-height: 0; }
  webview { position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%; display: flex; }
</style>
</head>
<body>
  <div id="bar">
    <button id="btn-signin" title="Navigate to the claude.ai usage page sign-in flow, one time">Sign in (claude.ai usage)</button>
    <span id="status">Usage Barrel Scraper -- isolated session (persist:usage-barrel-scraper)</span>
    <button id="btn-done" title="Hide this window (the session stays alive in the background)">Done -- hide</button>
  </div>
  <div id="wvwrap">
    <webview id="usage-barrel-webview" src="about:blank" partition="${USAGE_BARREL_PARTITION}" preload="${preloadPath}"></webview>
  </div>
  <script>
    var wv = document.getElementById('usage-barrel-webview');
    var statusEl = document.getElementById('status');
    document.getElementById('btn-signin').addEventListener('click', function () {
      wv.loadURL(${JSON.stringify(VENDOR_USAGE_PAGE_URL)});
    });
    document.getElementById('btn-done').addEventListener('click', function () {
      if (window.amplify && window.amplify.hideUsageBarrelSession) {
        window.amplify.hideUsageBarrelSession();
      }
    });
    wv.addEventListener('did-navigate', function (e) { statusEl.textContent = e.url; });
    wv.addEventListener('did-navigate-in-page', function (e) { statusEl.textContent = e.url; });
  </script>
</body>
</html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

/** Idempotent lazy creation, mirroring ensureNexusAuthoritySession()'s exact contract minus that
 *  file's separate researchArmMode/researchArmBrowserAuthority flag gate -- this module has no
 *  existing renderer Settings toggle of its own to mirror (adding one is out of this ticket's
 *  owned-file scope: NexusAuthoritySettings.tsx / SettingsTab.tsx are not owned here), so session
 *  creation here is gated only by "has anyone actually called scrapeVendorUsagePanel() or the
 *  sign-in opener yet" -- no hidden window, no partition, is ever touched before that. */
export function ensureUsageBarrelSession(): BrowserWindow {
  if (usageBarrelWindow && !usageBarrelWindow.isDestroyed()) {
    return usageBarrelWindow;
  }
  usageBarrelWindow = new BrowserWindow({
    width: 1024,
    height: 800,
    show: false,
    title: 'Usage Barrel Scraper -- isolated session',
    webPreferences: {
      preload: join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      devTools: true,
    },
  });
  usageBarrelWindow.loadURL(buildEmbedderHtml());
  usageBarrelWindow.on('closed', () => {
    usageBarrelWindow = null;
  });
  console.log(`[usage-barrel-scraper] isolated session created (partition: ${USAGE_BARREL_PARTITION}).`);
  return usageBarrelWindow;
}

export function getUsageBarrelWindow(): BrowserWindow | null {
  return usageBarrelWindow && !usageBarrelWindow.isDestroyed() ? usageBarrelWindow : null;
}

/** One-time interactive sign-in affordance, same contract as
 *  showNexusAuthoritySessionForSignIn(): shows the isolated session visibly, navigated at the
 *  vendor usage page, so a human (never this code) can complete the real login. This partition
 *  starts with zero cookies (see header) -- until a human does this once, every scrape below
 *  reports an honest not-signed-in-shaped failure, never a fabricated result. */
export function showUsageBarrelSessionForSignIn(): void {
  const win = ensureUsageBarrelSession();
  win.webContents.executeJavaScript(`
    (function () {
      try {
        var wv = document.getElementById('usage-barrel-webview');
        if (wv) { wv.loadURL(${JSON.stringify(VENDOR_USAGE_PAGE_URL)}); }
      } catch (e) { /* non-fatal */ }
    })();
  `).catch(() => { /* non-fatal -- the window still shows even if this pre-navigation nudge fails */ });
  win.show();
  win.focus();
}

export function hideUsageBarrelSession(): void {
  if (usageBarrelWindow && !usageBarrelWindow.isDestroyed()) {
    usageBarrelWindow.hide();
  }
}

// ─── Scrape result shape (never a fabricated number) ───────────────────────────────────────────

export interface VendorUsageWindowReading {
  /** The vendor's own label text as found on the page, e.g. "5-hour limit" or "Weekly - all
   *  models" -- kept verbatim rather than normalized, so a future maintainer can see exactly what
   *  matched. */
  label: string;
  /** 0-100, percent of an allocation the vendor never publishes. This is CONSUMED, not
   *  remaining -- confirmed in Phase 0 research (the vendor's own usage page shows usage
   *  consumed, e.g. "80%" means 80% used, not 80% left). */
  percentConsumed: number;
  /** The vendor's own reset text verbatim, e.g. "Resets in 4 hr 19 min" or "Resets on next
   *  request". Never dropped even when parseable, so a human can sanity-check the parse. */
  resetText: string;
  /** Best-effort parse of resetText into milliseconds-from-scrape-time. Null when unparseable
   *  (e.g. "Resets on next request" has no countdown -- see parseResetTextToMs's own doc). */
  resetInMs: number | null;
}

export interface VendorUsagePanelScrapeResult {
  success: boolean;
  scrapedAt: string;
  fiveHour: VendorUsageWindowReading | null;
  weeklyAllModels: VendorUsageWindowReading | null;
  /** A model-specific weekly row (e.g. "Weekly - Opus" / "Weekly - Fable" on Max plans). Null
   *  when absent from the page (a lower-tier plan may not have one at all -- absence here is not
   *  a scrape failure by itself, only "no fiveHour AND no weeklyAllModels" is treated as one). */
  weeklyModelSpecific: VendorUsageWindowReading | null;
  usageCredits: { usedUsd: number; limitUsd: number } | null;
  /** Null on success. A short machine-readable tag on failure, e.g. 'no-window', 'timeout',
   *  'not-signed-in-or-timeout', 'no-usage-rows-matched'. Never fabricated as a cover story for a
   *  real error. */
  failureReason: string | null;
  /** Present only when failureReason is set AND at least a page loaded far enough to read
   *  document.body -- a bounded, truncated dump of the last few meaningfully-sized text elements,
   *  for future selector maintenance. Mirrors webview_preload.ts's own captureDomSnapshot(). */
  domSnapshot: Array<Record<string, unknown>> | null;
}

const SCRAPE_TIMEOUT_MS = 20_000;
const SCRAPE_SETTLE_DELAY_MS = 1_500;

// Mirrors webview_preload.ts's DOM_SNAPSHOT_* budget constants exactly -- same diagnostic
// contract, different call site (this one runs main-process side after the Promise resolves,
// that one runs inside the sandboxed guest and must relay over ipcRenderer; the budget and shape
// stay identical either way).
const DOM_SNAPSHOT_MAX_ELEMENTS = 6;
const DOM_SNAPSHOT_CLASSNAME_MAX = 120;
const DOM_SNAPSHOT_TEXTHEAD_MAX = 80;
const DOM_SNAPSHOT_BYTE_BUDGET = 3000;

/** The in-guest-page extraction script, built as a string for `.executeJavaScript()` -- same
 *  technique buildSignInProbeScript() already uses in nexus_authority_persistent_session.ts.
 *  Tier (a) tries a small set of best-effort CSS candidates (unverified, kept short since there
 *  is no confirmed markup to pin against yet -- see header). Tier (b), the resilient fallback
 *  this ticket actually depends on, scans rendered line text for the vendor's own label strings.
 *  Never returns a fabricated percent: a row is only reported when both a label match AND a
 *  parseable percent are found near each other. */
function buildUsagePanelExtractionScript(): string {
  return `
    (function () {
      function captureDomSnapshot() {
        try {
          var root = document.querySelector('main') || document.body;
          if (!root) return [];
          var all = Array.prototype.slice.call(root.querySelectorAll('*'));
          var candidates = [];
          for (var i = 0; i < all.length; i++) {
            var el = all[i];
            var text = (el.innerText || '').trim();
            if (text.length > 20) candidates.push({ el: el, textLen: text.length });
          }
          var lastFew = candidates.slice(-${DOM_SNAPSHOT_MAX_ELEMENTS});
          var snapshot = lastFew.map(function (c) {
            var el = c.el;
            var dataTestid = {};
            var attrs = Array.prototype.slice.call(el.attributes || []);
            for (var a = 0; a < attrs.length; a++) {
              if (attrs[a].name.indexOf('data-testid') === 0) {
                dataTestid[attrs[a].name] = String(attrs[a].value).slice(0, 60);
              }
            }
            var text = (el.innerText || '').trim();
            var className = typeof el.className === 'string' ? el.className : '';
            return {
              tag: el.tagName.toLowerCase(),
              id: el.id || '',
              className: className.slice(0, ${DOM_SNAPSHOT_CLASSNAME_MAX}),
              dataTestid: dataTestid,
              textLen: c.textLen,
              textHead: text.slice(0, ${DOM_SNAPSHOT_TEXTHEAD_MAX}),
            };
          });
          while (snapshot.length > 1 && JSON.stringify(snapshot).length > ${DOM_SNAPSHOT_BYTE_BUDGET}) {
            snapshot = snapshot.slice(1);
          }
          return snapshot;
        } catch (e) {
          return [];
        }
      }

      function findPercentNear(lines, idx) {
        for (var d = 0; d <= 2; d++) {
          var j = idx + d;
          if (j < 0 || j >= lines.length) continue;
          var m = lines[j].match(/(\\d{1,3})\\s?%/);
          if (m) return parseInt(m[1], 10);
        }
        return null;
      }

      function findResetTextNear(lines, idx) {
        for (var d = 0; d <= 2; d++) {
          var j = idx + d;
          if (j < 0 || j >= lines.length) continue;
          if (/resets?\\s+(in|on)/i.test(lines[j])) return lines[j].trim();
        }
        return null;
      }

      try {
        // Tier (a): best-effort CSS candidates, unverified (see header). Tried first purely so a
        // future maintainer who pins real selectors gets them used automatically -- currently
        // expected to miss on every real page, which is fine, tier (b) is the load-bearing path.
        var cssCandidates = document.querySelectorAll('[class*="usage" i], [data-testid*="usage" i]');
        void cssCandidates;

        var bodyText = (document.body && document.body.innerText) || '';
        var rawLines = bodyText.split(String.fromCharCode(10));
        var lines = [];
        for (var i = 0; i < rawLines.length; i++) {
          var t = rawLines[i].trim();
          if (t.length > 0) lines.push(t);
        }

        var fiveHour = null;
        var weeklyAllModels = null;
        var weeklyModelSpecific = null;
        var usageCredits = null;

        for (var li = 0; li < lines.length; li++) {
          var line = lines[li];
          if (fiveHour === null && /5.?\\s?-?\\s?hour/i.test(line)) {
            var pct1 = findPercentNear(lines, li);
            var reset1 = findResetTextNear(lines, li);
            if (pct1 !== null) {
              fiveHour = { label: line, percentConsumed: pct1, resetText: reset1 || '' };
            }
          } else if (/weekly/i.test(line)) {
            var pct2 = findPercentNear(lines, li);
            var reset2 = findResetTextNear(lines, li);
            if (pct2 !== null) {
              var isAllModels = /all\\s*model/i.test(line);
              if (isAllModels && weeklyAllModels === null) {
                weeklyAllModels = { label: line, percentConsumed: pct2, resetText: reset2 || '' };
              } else if (!isAllModels && weeklyModelSpecific === null) {
                weeklyModelSpecific = { label: line, percentConsumed: pct2, resetText: reset2 || '' };
              }
            }
          } else if (usageCredits === null && /usage\\s*credits?/i.test(line)) {
            for (var d2 = 0; d2 <= 2; d2++) {
              var j2 = li + d2;
              if (j2 >= lines.length) continue;
              var m2 = lines[j2].match(/\\$\\s?([\\d.]+)\\s+of\\s+\\$\\s?([\\d.]+)/i);
              if (m2) {
                usageCredits = { usedUsd: parseFloat(m2[1]), limitUsd: parseFloat(m2[2]) };
                break;
              }
            }
          }
        }

        if (fiveHour === null && weeklyAllModels === null) {
          return {
            success: false,
            failureReason: 'no-usage-rows-matched',
            fiveHour: null,
            weeklyAllModels: null,
            weeklyModelSpecific: null,
            usageCredits: null,
            domSnapshot: captureDomSnapshot(),
          };
        }

        return {
          success: true,
          failureReason: null,
          fiveHour: fiveHour,
          weeklyAllModels: weeklyAllModels,
          weeklyModelSpecific: weeklyModelSpecific,
          usageCredits: usageCredits,
          domSnapshot: null,
        };
      } catch (e) {
        return {
          success: false,
          failureReason: 'extraction-threw',
          fiveHour: null,
          weeklyAllModels: null,
          weeklyModelSpecific: null,
          usageCredits: null,
          domSnapshot: null,
        };
      }
    })()
  `;
}

interface RawExtractionResult {
  success: boolean;
  failureReason: string | null;
  fiveHour: { label: string; percentConsumed: number; resetText: string } | null;
  weeklyAllModels: { label: string; percentConsumed: number; resetText: string } | null;
  weeklyModelSpecific: { label: string; percentConsumed: number; resetText: string } | null;
  usageCredits: { usedUsd: number; limitUsd: number } | null;
  domSnapshot: Array<Record<string, unknown>> | null;
}

function withResetMs(
  reading: { label: string; percentConsumed: number; resetText: string } | null,
): VendorUsageWindowReading | null {
  if (!reading) return null;
  return {
    label: reading.label,
    percentConsumed: reading.percentConsumed,
    resetText: reading.resetText,
    resetInMs: parseResetTextToMs(reading.resetText),
  };
}

/** Navigates the isolated session's <webview> to the vendor usage page, waits for load + a
 *  settle delay (same shape as probeNexusAuthoritySignInStatus's did-finish-load + timeout +
 *  settle-delay pattern), runs the extraction script, and returns an honest result. Every failure
 *  path -- no window, navigation timeout, extraction exception, not-signed-in-shaped empty page
 *  -- resolves with success:false and a labeled failureReason. Nothing here ever coerces a
 *  missing value into a fabricated percent or a zero. */
export async function scrapeVendorUsagePanel(): Promise<VendorUsagePanelScrapeResult> {
  const scrapedAt = new Date().toISOString();
  let win: BrowserWindow;
  try {
    win = ensureUsageBarrelSession();
  } catch {
    return {
      success: false,
      scrapedAt,
      fiveHour: null,
      weeklyAllModels: null,
      weeklyModelSpecific: null,
      usageCredits: null,
      failureReason: 'no-window',
      domSnapshot: null,
    };
  }

  const extractionScript = buildUsagePanelExtractionScript();
  const hostScript = `
    (function () {
      return new Promise(function (resolve) {
        try {
          var wv = document.getElementById('usage-barrel-webview');
          if (!wv) { resolve({ success: false, failureReason: 'no-webview', fiveHour: null, weeklyAllModels: null, weeklyModelSpecific: null, usageCredits: null, domSnapshot: null }); return; }
          var settled = false;
          var timeoutId = setTimeout(function () {
            if (settled) return;
            settled = true;
            wv.removeEventListener('did-finish-load', onLoad);
            resolve({ success: false, failureReason: 'timeout', fiveHour: null, weeklyAllModels: null, weeklyModelSpecific: null, usageCredits: null, domSnapshot: null });
          }, ${SCRAPE_TIMEOUT_MS});
          function onLoad() {
            wv.removeEventListener('did-finish-load', onLoad);
            setTimeout(function () {
              wv.executeJavaScript(${JSON.stringify(extractionScript)}).then(function (result) {
                if (settled) return;
                settled = true;
                clearTimeout(timeoutId);
                resolve(result && typeof result === 'object' ? result : { success: false, failureReason: 'bad-extraction-result', fiveHour: null, weeklyAllModels: null, weeklyModelSpecific: null, usageCredits: null, domSnapshot: null });
              }).catch(function () {
                if (settled) return;
                settled = true;
                clearTimeout(timeoutId);
                resolve({ success: false, failureReason: 'extraction-promise-rejected', fiveHour: null, weeklyAllModels: null, weeklyModelSpecific: null, usageCredits: null, domSnapshot: null });
              });
            }, ${SCRAPE_SETTLE_DELAY_MS});
          }
          wv.addEventListener('did-finish-load', onLoad);
          wv.loadURL(${JSON.stringify(VENDOR_USAGE_PAGE_URL)});
        } catch (err) {
          resolve({ success: false, failureReason: 'outer-threw', fiveHour: null, weeklyAllModels: null, weeklyModelSpecific: null, usageCredits: null, domSnapshot: null });
        }
      });
    })()
  `;

  try {
    const raw = (await win.webContents.executeJavaScript(hostScript)) as RawExtractionResult;
    const result: VendorUsagePanelScrapeResult = {
      success: !!raw.success,
      scrapedAt,
      fiveHour: withResetMs(raw.fiveHour),
      weeklyAllModels: withResetMs(raw.weeklyAllModels),
      weeklyModelSpecific: withResetMs(raw.weeklyModelSpecific),
      usageCredits: raw.usageCredits ?? null,
      failureReason: raw.failureReason ?? null,
      domSnapshot: raw.domSnapshot ?? null,
    };
    if (!result.success && result.domSnapshot) {
      logUsageBarrelDiagnostic(result.failureReason ?? 'unknown', result.domSnapshot);
    }
    if (result.success) {
      appendHistorySample(result);
    }
    return result;
  } catch (err) {
    return {
      success: false,
      scrapedAt,
      fiveHour: null,
      weeklyAllModels: null,
      weeklyModelSpecific: null,
      usageCredits: null,
      failureReason: `main-process-exception:${err instanceof Error ? err.message : String(err)}`,
      domSnapshot: null,
    };
  }
}

// ─── Self-diagnostic logging (main process, unsandboxed -- no IPC relay needed) ────────────────

function diagnosticLogPath(): string {
  return join(app.getPath('userData'), 'usage_barrel_scraper_diagnostics.jsonl');
}

/** Appends one line per selector-failure event, mirroring webview_preload.ts's own
 *  'embedded_browser_injection_log' -> appendFileSync relay contract, just without needing the
 *  ipcRenderer hop (this file already runs unsandboxed in the main process). Never throws --
 *  diagnostics must never block the real feature, same fail-soft contract as the bridge file. */
function logUsageBarrelDiagnostic(reason: string, domSnapshot: Array<Record<string, unknown>>): void {
  try {
    const dir = app.getPath('userData');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const line = JSON.stringify({ ts: new Date().toISOString(), event: 'usage_barrel_scrape_failed', reason, domSnapshot }) + '\n';
    appendFileSync(diagnosticLogPath(), line, 'utf-8');
  } catch {
    /* non-fatal -- logging must never break the real feature */
  }
}

// ─── Reset-text parsing (best-effort, never a fabricated countdown) ────────────────────────────

/** Parses vendor reset text like "Resets in 4 hr 19 min", "Resets in 2 hr", "Resets in 6d 3h"
 *  into milliseconds from now. Per claude.com's own account/usage docs (cited in the KN-BP145-M1
 *  report), "Resets on next request" means the window has already elapsed and the very next
 *  message clears it to 0% -- that is NOT a countdown, so it correctly parses to null here
 *  (never coerced to 0ms, which would falsely read as "resets immediately whether you send
 *  anything or not"). Any other unrecognized shape also parses to null -- honest unknown, not a
 *  guess. */
export function parseResetTextToMs(resetText: string): number | null {
  if (!resetText) return null;
  if (/resets?\s+on\s+next\s+request/i.test(resetText)) return null;
  let totalMs = 0;
  let matchedAny = false;
  const dayMatch = resetText.match(/(\d+)\s*d(?:ay)?s?\b/i);
  if (dayMatch) { totalMs += parseInt(dayMatch[1], 10) * 24 * 60 * 60 * 1000; matchedAny = true; }
  const hourMatch = resetText.match(/(\d+)\s*h(?:r|our)?s?\b/i);
  if (hourMatch) { totalMs += parseInt(hourMatch[1], 10) * 60 * 60 * 1000; matchedAny = true; }
  const minMatch = resetText.match(/(\d+)\s*m(?:in)?s?\b/i);
  if (minMatch) { totalMs += parseInt(minMatch[1], 10) * 60 * 1000; matchedAny = true; }
  return matchedAny ? totalMs : null;
}

// ─── History + consumption-rate + operational answer ───────────────────────────────────────────

interface UsageBarrelHistorySample {
  ts: number;
  fiveHourPercent: number | null;
  weeklyPercent: number | null;
}

const HISTORY_MAX_SAMPLES = 50;

function historyPath(): string {
  return join(app.getPath('userData'), 'usage_barrel_history.jsonl');
}

function readHistorySamples(): UsageBarrelHistorySample[] {
  try {
    const p = historyPath();
    if (!existsSync(p)) return [];
    const lines = readFileSync(p, 'utf-8').split('\n').filter((l) => l.trim().length > 0);
    const samples: UsageBarrelHistorySample[] = [];
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as UsageBarrelHistorySample;
        if (typeof parsed.ts === 'number') samples.push(parsed);
      } catch {
        /* skip a corrupt line rather than fail the whole read */
      }
    }
    return samples.slice(-HISTORY_MAX_SAMPLES);
  } catch {
    return [];
  }
}

function appendHistorySample(result: VendorUsagePanelScrapeResult): void {
  try {
    const dir = app.getPath('userData');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const sample: UsageBarrelHistorySample = {
      ts: Date.parse(result.scrapedAt),
      fiveHourPercent: result.fiveHour ? result.fiveHour.percentConsumed : null,
      weeklyPercent: result.weeklyAllModels ? result.weeklyAllModels.percentConsumed : null,
    };
    appendFileSync(historyPath(), JSON.stringify(sample) + '\n', 'utf-8');
  } catch {
    /* non-fatal -- a lost history sample just delays the next rate computation, never crashes */
  }
}

/** Rate in percent-per-millisecond from the oldest-to-newest pair of samples that looks like a
 *  single uninterrupted climb (percent never decreases -- a decrease means the window reset in
 *  between, which invalidates using that pair for a rate; this function skips over such a reset
 *  rather than silently computing a nonsensical negative rate). Returns null (honest
 *  "insufficient/invalid history"), never 0 as a stand-in for "no data yet" -- 0 would falsely
 *  read as "not consuming anything," which is a claim this function is not in a position to
 *  make with less than two valid samples. */
function computeRatePercentPerMs(
  samples: UsageBarrelHistorySample[],
  key: 'fiveHourPercent' | 'weeklyPercent',
): number | null {
  const valid = samples.filter((s) => s[key] !== null) as Array<UsageBarrelHistorySample & Record<typeof key, number>>;
  if (valid.length < 2) return null;
  const first = valid[0];
  const last = valid[valid.length - 1];
  if (last.ts <= first.ts) return null;
  if (last[key] < first[key]) return null; // a reset happened between samples -- do not use this pair
  const deltaPercent = last[key] - first[key];
  const deltaMs = last.ts - first.ts;
  if (deltaMs <= 0) return null;
  return deltaPercent / deltaMs;
}

export interface UsageBarrelOperationalSnapshot {
  scrape: VendorUsagePanelScrapeResult;
  fiveHourRatePercentPerMs: number | null;
  weeklyRatePercentPerMs: number | null;
  fiveHourTimeToExhaustionMs: number | null;
  weeklyTimeToExhaustionMs: number | null;
  /** Which window (if any) is projected to hit 100% BEFORE its own reset -- the "more
   *  constraining" window the ticket asks for, not just whichever is the 5-hour one. Null when
   *  neither is projected to, or when there is not yet enough history to project either. */
  constrainingWindow: 'fiveHour' | 'weeklyAllModels' | null;
  /** The human-readable answer to "will this finish before the wall, and if not, when may it
   *  resume" -- never mentions a token count or a denominator, per the ticket's explicit
   *  instruction; only percent-consumed, rate, and reset-time language. */
  operationalAnswer: string;
}

/** Combines the latest scrape with on-disk history into the operational answer the ticket asks
 *  for. Calling this ALSO performs the scrape (so a caller gets one function for "go get the real
 *  answer right now"); callers that already have a fresh `scrapeVendorUsagePanel()` result and
 *  just want the computed answer without a second network round trip should read this function's
 *  body as the two-step recipe (scrape, then combine with readHistorySamples()) rather than call
 *  it twice back-to-back. */
export async function computeUsageBarrelOperationalSnapshot(): Promise<UsageBarrelOperationalSnapshot> {
  const scrape = await scrapeVendorUsagePanel();
  const samples = readHistorySamples();

  if (!scrape.success) {
    return {
      scrape,
      fiveHourRatePercentPerMs: null,
      weeklyRatePercentPerMs: null,
      fiveHourTimeToExhaustionMs: null,
      weeklyTimeToExhaustionMs: null,
      constrainingWindow: null,
      operationalAnswer: `Unknown -- the vendor usage panel scrape failed (${scrape.failureReason ?? 'unlabeled failure'}). Not reporting a fabricated percent or rate.`,
    };
  }

  const fiveHourRate = computeRatePercentPerMs(samples, 'fiveHourPercent');
  const weeklyRate = computeRatePercentPerMs(samples, 'weeklyPercent');

  const fiveHourRemaining = scrape.fiveHour ? 100 - scrape.fiveHour.percentConsumed : null;
  const weeklyRemaining = scrape.weeklyAllModels ? 100 - scrape.weeklyAllModels.percentConsumed : null;

  const fiveHourTTE = fiveHourRate !== null && fiveHourRate > 0 && fiveHourRemaining !== null
    ? fiveHourRemaining / fiveHourRate
    : null;
  const weeklyTTE = weeklyRate !== null && weeklyRate > 0 && weeklyRemaining !== null
    ? weeklyRemaining / weeklyRate
    : null;

  const fiveHourResetMs = scrape.fiveHour?.resetInMs ?? null;
  const weeklyResetMs = scrape.weeklyAllModels?.resetInMs ?? null;

  const fiveHourWillExhaustFirst = fiveHourTTE !== null && fiveHourResetMs !== null && fiveHourTTE < fiveHourResetMs;
  const weeklyWillExhaustFirst = weeklyTTE !== null && weeklyResetMs !== null && weeklyTTE < weeklyResetMs;

  let constrainingWindow: 'fiveHour' | 'weeklyAllModels' | null = null;
  if (fiveHourWillExhaustFirst && weeklyWillExhaustFirst) {
    constrainingWindow = (fiveHourTTE as number) <= (weeklyTTE as number) ? 'fiveHour' : 'weeklyAllModels';
  } else if (fiveHourWillExhaustFirst) {
    constrainingWindow = 'fiveHour';
  } else if (weeklyWillExhaustFirst) {
    constrainingWindow = 'weeklyAllModels';
  }

  let operationalAnswer: string;
  if (fiveHourRate === null && weeklyRate === null) {
    const fiveHourDesc = scrape.fiveHour ? `5-hour at ${scrape.fiveHour.percentConsumed}% (${scrape.fiveHour.resetText || 'reset time unknown'})` : '5-hour window not read';
    const weeklyDesc = scrape.weeklyAllModels ? `weekly at ${scrape.weeklyAllModels.percentConsumed}% (${scrape.weeklyAllModels.resetText || 'reset time unknown'})` : 'weekly window not read';
    operationalAnswer = `Unknown whether this will finish before the wall -- insufficient consumption history yet (need at least two scrapes over time to compute a rate). Current snapshot: ${fiveHourDesc}; ${weeklyDesc}.`;
  } else if (constrainingWindow === 'fiveHour' && scrape.fiveHour) {
    operationalAnswer = `Will NOT finish before the wall on current trend -- the 5-hour window is projected to exhaust before it resets (${scrape.fiveHour.resetText}). May resume once that window resets.`;
  } else if (constrainingWindow === 'weeklyAllModels' && scrape.weeklyAllModels) {
    operationalAnswer = `Will NOT finish before the wall on current trend -- the weekly window is projected to exhaust before it resets (${scrape.weeklyAllModels.resetText}), even though the 5-hour window has headroom. May resume once the weekly window resets.`;
  } else {
    const parts: string[] = [];
    if (scrape.fiveHour) parts.push(`5-hour ${scrape.fiveHour.percentConsumed}% (${scrape.fiveHour.resetText || 'reset time unknown'})`);
    if (scrape.weeklyAllModels) parts.push(`weekly ${scrape.weeklyAllModels.percentConsumed}% (${scrape.weeklyAllModels.resetText || 'reset time unknown'})`);
    operationalAnswer = `Will finish before the wall on current trend -- neither window is projected to exhaust before its own reset. ${parts.join('; ')}.`;
  }

  return {
    scrape,
    fiveHourRatePercentPerMs: fiveHourRate,
    weeklyRatePercentPerMs: weeklyRate,
    fiveHourTimeToExhaustionMs: fiveHourTTE,
    weeklyTimeToExhaustionMs: weeklyTTE,
    constrainingWindow,
    operationalAnswer,
  };
}
