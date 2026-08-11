// nexus_authority_persistent_session.ts -- BP137 Yoke 0.9.12 Stage F1 ("persistent, always-on,
// logged-in browser authority").
//
// WHY THIS FILE EXISTS: BP137 Stage C/Integration-1 built a REAL Google/Perplexity DOM-scraping
// round trip (browser_authority_adapter.ts -> index.ts's runBrowserAuthorityQueryFromMain() ->
// hearthConjunctionWindow's live <webview>), but that round trip only ever fires when a VISIBLE
// hearthConjunctionWindow happens to be open (confirmed by 0.9.11's live mesh receipt: 0 of 20
// browser-authority attempts fired in a headless benchmark run, because hearthConjunctionWindow
// is never created outside interactive use). This module is the fix: a hidden, persistent,
// always-alive browser surface that exists for the app's entire lifetime, independent of any
// tab's open/close state, so the SAME scraping mechanism can run headlessly.
//
// MECHANISM (R-MECHANISM-VERIFY):
//   - One hidden BrowserWindow (`show: false`), created once, kept alive for the app's lifetime.
//   - That window's page hosts exactly one <webview> element, with `partition="persist:nexus-
//     authority"` -- a PERSISTED Electron session partition (cookies/localStorage survive an
//     app restart, confirmed by Electron's own partition-naming contract: any partition string
//     prefixed `persist:` is durable; omitting the prefix would mean in-memory/ephemeral).
//   - The <webview>'s `preload` attribute points at the SAME compiled webview_preload.js that
//     hearthConjunctionWindow's EmbeddedChrome.tsx already uses -- this module never duplicates
//     that file's DOM-scraping selectors/heuristics or its 'browser-authority-run-query' /
//     'browser-authority-extraction-result' IPC channel names; it only changes which window
//     instance drives that existing, unmodified preload script.
//   - The embedder page itself is a small self-contained inline HTML document (loaded via a
//     `data:` URL, not a new renderer route) with a 3-button chrome bar (Google / Perplexity /
//     Done-hide) so the ONE-TIME visible sign-in flow (item 3) has something to click without
//     requiring any change to this repo's React renderer bundle or its routing table -- this
//     keeps the whole module additive and collision-free against concurrent renderer work.
//
// GATING (byte-unchanged when the flag is off): every exported function in this file that has
// any observable side effect (creating the window, showing it, running a probe or a query)
// starts with `isNexusAuthorityFlagEnabled()` as its FIRST guard clause and returns a
// null/false/no-op honest result when that guard fails. researchArmMode +
// researchArmBrowserAuthority are both persisted redundantly here (a small JSON file under
// userData, mirroring the exact getAutoPrepareEnabled()/setAutoPrepareEnabled() convention
// index.ts already uses at its AUTO_PREPARE_* block) because the EXISTING settings store
// (nexus_authority_settings_store.ts) is renderer-localStorage-only and therefore invisible to
// this main-process module -- see that file's own header for its explicit acknowledgment of
// this exact cross-process gap. The renderer side of this Yoke (NexusAuthoritySignInPanel.tsx +
// a small additive push in nexus_authority_settings_store.ts) keeps this mirror in sync every
// time the user flips either toggle; this file's own guard always re-reads the mirror fresh
// (never caches a stale snapshot), so flipping the flag ON mid-session works with no restart.
//
// HONESTY FIREWALL (never fabricate "signed in"): probeNexusAuthoritySignInStatus() only ever
// returns `signedIn: true` when a real DOM marker element was found via document.querySelector
// inside the live guest page; every other path (no window, flag off, navigation/timeout
// failure, no marker found) returns `signedIn: false` with a labeled `reason`. There is no
// helper anywhere in this file that defaults to true or fabricates a placeholder marker.

import { app, BrowserWindow } from 'electron';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { BrowserAuthorityName, BrowserAuthorityQuery, BrowserAuthorityRawExtraction } from '../../shared/plow/browser_authority_types';
// D-BP152-033/BISHOP/seg-machine-drives-nexus -- buildBrowserAuthorityQueryUrl/
// isInteractiveBrowserAuthority are the SAME pure helpers index.ts's own static/interactive split
// already uses (browser_authority_types.ts); reused here, not re-derived, for the machine-driven
// query section near the end of this file.
import { isInteractiveBrowserAuthority, buildBrowserAuthorityQueryUrl } from '../../shared/plow/browser_authority_types';

// ─── Flag mirror (main-process-readable; renderer localStorage is the human-facing source) ────

const FLAGS_FILE_NAME = 'nexus_authority_flags.json';

interface NexusAuthorityFlagsFile {
  researchArmMode?: boolean;
  researchArmBrowserAuthority?: boolean;
}

function flagsFilePath(): string {
  return join(app.getPath('userData'), FLAGS_FILE_NAME);
}

/** Reads the current mirror. Never throws; absent/corrupt file reads as both flags false
 *  (the same safe-default convention nexus_authority_settings_store.ts's loadNexusAuthoritySettings()
 *  already uses on the renderer side). */
function readNexusAuthorityFlagsFile(): NexusAuthorityFlagsFile {
  try {
    const p = flagsFilePath();
    if (!existsSync(p)) return {};
    const parsed = JSON.parse(readFileSync(p, 'utf-8'));
    return {
      researchArmMode: parsed?.researchArmMode === true,
      researchArmBrowserAuthority: parsed?.researchArmBrowserAuthority === true,
    };
  } catch {
    return {};
  }
}

/** Called by the new IPC handler (index.ts's registerIPCHandlers(), 'nexus-authority-set-flags')
 *  every time the Settings panel's researchArmMode / researchArmBrowserAuthority toggles change,
 *  so this main-process mirror never drifts from the renderer's localStorage-based source of
 *  truth. Non-fatal on write failure (matches setAutoPrepareEnabled()'s own try/catch). */
export function setNexusAuthorityBrowserFlags(researchArmMode: boolean, researchArmBrowserAuthority: boolean): void {
  try {
    writeFileSync(
      flagsFilePath(),
      JSON.stringify({ researchArmMode, researchArmBrowserAuthority }),
      'utf-8',
    );
  } catch {
    /* non-fatal -- the mirror simply stays stale until the next successful write */
  }
}

/** The single AND-gate every exported side-effecting function in this file checks FIRST. Both
 *  flags must be true -- same master-switch-plus-sub-flag convention isBrowserAuthorityEnabled()
 *  (browser_authority_types.ts) already uses. Always re-reads the file fresh (no in-memory
 *  cache) so a same-session flag flip takes effect immediately without an app restart. */
export function isNexusAuthorityFlagEnabled(): boolean {
  const flags = readNexusAuthorityFlagsFile();
  return !!(flags.researchArmMode && flags.researchArmBrowserAuthority);
}

// ─── The persistent, always-on hidden session ──────────────────────────────────────────────────

export const NEXUS_AUTHORITY_PARTITION = 'persist:nexus-authority';

let nexusAuthorityWindow: BrowserWindow | null = null;

function webviewPreloadPath(): string {
  // Same compiled artifact path openHearthConjunctionWindow() already computes for
  // EmbeddedChrome.tsx's <webview preload=...> -- never a second copy of this file.
  return join(__dirname, '..', 'hearth', 'embedded_browser', 'webview_preload.js');
}

// ─── D-BP152-028/BISHOP/seg-nexus-browser-bar -- the 5 surfaces, as DATA ──────────────────────
//
// Founder, BP152, verbatim: "keep the 5 tabs we have at the top (which we will add to based on
// what users have access to)." This ticket's item 5: make the button list DATA rather than five
// hardcoded button blocks, so adding a surface later is one entry in this array. No UI to EDIT
// this list is built (not ordered) -- only the hardcoding is removed.
//
// URLs are byte-identical to what D-BP152-025/D-BP152-027 already shipped (Google's URL carries
// D-BP152-027's own fix: plain https://www.google.com, not the account page -- see that ticket's
// SEG return for the live defect this closes). This ticket changed none of the 5 URLs.
export interface NexusAuthoritySurface {
  id: string;
  label: string;
  url: string;
  title: string;
}

export const NEXUS_SURFACES: NexusAuthoritySurface[] = [
  { id: 'google', label: 'Google', url: 'https://www.google.com', title: 'Navigate the persistent session to Google search' },
  { id: 'perplexity', label: 'Perplexity', url: 'https://www.perplexity.ai/', title: 'Navigate the persistent session to Perplexity' },
  { id: 'claude', label: 'Claude', url: 'https://claude.ai/new', title: 'Navigate the persistent session to claude.ai/new sign-in' },
  { id: 'chatgpt', label: 'ChatGPT', url: 'https://chatgpt.com/auth/login', title: 'Navigate the persistent session to chatgpt.com sign-in' },
  { id: 'gemini', label: 'Gemini', url: 'https://accounts.google.com/ServiceLogin?continue=https%3A%2F%2Fgemini.google.com%2Fapp', title: 'Navigate the persistent session to gemini.google.com sign-in' },
];

/**
 * Pure address-bar resolution -- decides what a typed address-bar value means. Exported so it is
 * directly unit-testable (VERIFY item (a)); ITS OWN `.toString()` is embedded verbatim into
 * buildEmbedderHtml()'s inline script below, so the code that actually runs inside the browser
 * window IS the exact function this file's test suite exercises -- never a hand-duplicated copy
 * that could drift. Deliberately self-contained (no closures, no reference to anything outside
 * its own parameter) so `.toString()` produces valid standalone script.
 *
 * ATTRIBUTED: dispatch D-BP152-028, item 1, verbatim: "Type a URL or a search term, press Enter,
 * it navigates ... A bare term that is not a URL goes to a Google search for it."
 *
 * SECURITY DECISION (D-BP152-028's own SECURITY section, verbatim ask: "Navigating to a file://
 * or about: URL from the address bar: decide, state your decision and its reason ... and default
 * to refusing rather than silently allowing"). DECISION: REFUSE file:/about:/javascript:/data:/
 * chrome:/view-source:. REASON: the Founder's ask was "run the Google Chrome Browser" -- the web
 * -- and none of these schemes are the web. file:// specifically would let a typed address read
 * the local filesystem through a <webview> that already carries a preload script; the others are
 * the same class of risk (internal pages, script/markup injection, opaque payloads). Refusing is
 * the smaller, safer reading of the ask, not a widened gate -- no existing capability is removed,
 * only a new one that the ask did not request is withheld.
 */
export function resolveNexusAddressBarInput(raw: string): { blocked: boolean; reason?: string; url?: string } {
  var text = (raw || '').trim();
  if (!text) {
    return { blocked: false };
  }
  var blockedSchemeRe = /^(file|about|javascript|data|chrome|view-source):/i;
  if (blockedSchemeRe.test(text)) {
    return { blocked: true, reason: 'blocked-scheme' };
  }
  var hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text);
  if (hasScheme) {
    return { blocked: false, url: text };
  }
  var looksLikeHost = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:\d+)?([/?#].*)?$/i.test(text);
  var looksLikeLocalhost = /^localhost(:\d+)?([/?#].*)?$/i.test(text);
  if ((looksLikeHost || looksLikeLocalhost) && !/\s/.test(text)) {
    return { blocked: false, url: 'https://' + text };
  }
  return { blocked: false, url: 'https://www.google.com/search?q=' + encodeURIComponent(text) };
}

/** Builds the embedder page as an inline `data:` URL -- deliberately NOT a new renderer route
 *  (avoids touching App.tsx's routing table / any concurrent renderer work) and NOT the
 *  previously-rejected dotted-line transparent overlay. Escaping note: the only
 *  dynamically-interpolated value is a local filesystem path (never user-controlled text), and
 *  it is passed through encodeURIComponent() as part of the whole-document data: URL encoding
 *  below, so no separate HTML-attribute escaping is required.
 *
 *  D-BP152-028: this page now also carries an editable address bar, back/forward/reload/stop
 *  history controls, and a bookmarks bar -- all standard <webview>-tag/DOM operations, requiring
 *  no change to this window's webPreferences (see ensureNexusAuthoritySession() below,
 *  UNTOUCHED by this ticket: no nodeIntegration, contextIsolation stays true, webSecurity stays
 *  on). Bookmarks persistence goes through window.amplify.nexusAuthorityBookmarks*() (thin
 *  preload wraps, see preload.ts) because this page's own script has no fs access. */
export function buildEmbedderHtml(): string {
  const preloadPath = webviewPreloadPath();
  const surfacesJson = JSON.stringify(NEXUS_SURFACES);
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body { margin: 0; padding: 0; height: 100vh; width: 100vw; display: flex; flex-direction: column; background: #0f0f1a; font-family: -apple-system, "Segoe UI", Arial, sans-serif; overflow: hidden; }
  #bar { display: flex; gap: 6px; align-items: center; padding: 6px 8px; background: #1a1a2e; border-bottom: 1px solid #2d3748; box-sizing: border-box; height: 40px; flex: 0 0 40px; }
  button { background: #2d3748; color: #e2e8f0; border: 1px solid #4a5568; border-radius: 4px; padding: 5px 10px; font-size: 12px; cursor: pointer; flex: 0 0 auto; }
  button:hover { background: #374151; }
  button:disabled { opacity: 0.4; cursor: default; }
  button:disabled:hover { background: #2d3748; }
  #navgroup { display: flex; gap: 3px; flex: 0 0 auto; }
  #navgroup button { padding: 5px 8px; }
  #addressbar { flex: 1 1 auto; min-width: 60px; background: #0f0f1a; color: #e2e8f0; border: 1px solid #4a5568; border-radius: 4px; padding: 5px 8px; font-size: 12px; font-family: monospace; }
  #addressbar:focus { outline: 1px solid #63b3ed; }
  #surfaces { display: flex; gap: 6px; flex: 0 0 auto; }
  #bookmarksbar { display: flex; gap: 6px; align-items: center; padding: 3px 8px; background: #161625; border-bottom: 1px solid #2d3748; box-sizing: border-box; height: 26px; flex: 0 0 26px; overflow-x: auto; white-space: nowrap; }
  #bookmarksbar:empty::before { content: 'No bookmarks yet -- click "+ Bookmark" to add this page.'; color: #4a5568; font-size: 10px; font-family: monospace; }
  .bmchip { display: inline-flex; align-items: center; gap: 2px; background: #232338; border: 1px solid #383854; border-radius: 12px; padding: 1px 2px 1px 4px; flex: 0 0 auto; }
  .bmlink { background: transparent; border: none; color: #94a3b8; font-size: 10px; padding: 2px 4px; cursor: pointer; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bmlink:hover { color: #e2e8f0; }
  .bmremove { background: transparent; border: none; color: #64748b; font-size: 12px; line-height: 1; padding: 0 5px; cursor: pointer; }
  .bmremove:hover { color: #fc8181; }
  /* min-height:0 lets this flex child actually grow to fill; without it a flex item defaults to
     min-height:auto and the webview collapses to a fraction of the window (the 0.9.14 sliver). */
  #wvwrap { flex: 1 1 auto; position: relative; overflow: hidden; min-height: 0; }
  /* Absolute inset:0 sizes the webview to #wvwrap's real box regardless of the webview's
     unreliable percentage-height resolution -- this is the actual sliver root cause. */
  webview { position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%; display: flex; }
</style>
</head>
<body>
  <div id="bar">
    <div id="navgroup">
      <button id="btn-back" title="Back" disabled>&#8592;</button>
      <button id="btn-forward" title="Forward" disabled>&#8594;</button>
      <button id="btn-reload" title="Reload">&#8635;</button>
      <button id="btn-stop" title="Stop" disabled>&#10005;</button>
    </div>
    <input id="addressbar" type="text" placeholder="Search Google or type a web address" autocomplete="off" spellcheck="false" />
    <button id="btn-go" title="Go">Go</button>
    <button id="btn-bookmark-add" title="Bookmark this page">&#9733; Bookmark</button>
    <!-- D-BP152-028 item 5: the 5 surface buttons are rendered by a loop over NEXUS_SURFACES
         below, not five hardcoded blocks -- adding a surface is one entry in that array. -->
    <span id="surfaces"></span>
    <!-- D-BP152-025/BISHOP/seg-nexus-returns-answer -- Founder, BP152, ruled "make the nexus
         surface return what I type." Operator-triggered ONLY: type and submit your own query on
         this visible page exactly as before, then press this button when the answer you want is
         on screen. Never auto-typed, never auto-submitted, never auto-captured. UNCHANGED by
         D-BP152-028. -->
    <button id="btn-capture" title="Capture what is on screen right now and send it to the paused Liana Cycle run">Capture -&gt; Liana Cycle</button>
    <button id="btn-done" title="Hide this window (the session stays alive in the background)">Done -- hide</button>
  </div>
  <div id="bookmarksbar"></div>
  <div id="wvwrap">
    <webview id="nexus-authority-webview" src="about:blank" partition="${NEXUS_AUTHORITY_PARTITION}" preload="${preloadPath}"></webview>
  </div>
  <script>
    var wv = document.getElementById('nexus-authority-webview');
    var addressbar = document.getElementById('addressbar');
    var btnBack = document.getElementById('btn-back');
    var btnForward = document.getElementById('btn-forward');
    var btnReload = document.getElementById('btn-reload');
    var btnStop = document.getElementById('btn-stop');
    var btnGo = document.getElementById('btn-go');
    var btnBookmarkAdd = document.getElementById('btn-bookmark-add');
    var surfacesEl = document.getElementById('surfaces');
    var bookmarksBarEl = document.getElementById('bookmarksbar');

    // D-BP152-025 -- which of the 5 surfaces is currently loaded, tracked ONLY so a capture can
    // record honest provenance ("which surface was active"). Never read by any navigation logic,
    // never sent anywhere except as a label on a capture the operator explicitly triggers.
    // Declared with 'var' at this top-level script scope, so it is reachable from a SEPARATE
    // executeJavaScript() call (captureNexusAuthorityVisibleText(), this file's Node side) as
    // window.currentNexusAuthority. UNCHANGED by D-BP152-028.
    var currentNexusAuthority = null;

    // ── D-BP152-028 item 5: the 5 surfaces, rendered from data ──────────────────────────────
    var NEXUS_SURFACES = ${surfacesJson};
    NEXUS_SURFACES.forEach(function (surface) {
      var b = document.createElement('button');
      b.id = 'btn-' + surface.id;
      b.title = surface.title;
      b.textContent = surface.label;
      b.addEventListener('click', function () {
        currentNexusAuthority = surface.id;
        wv.loadURL(surface.url);
      });
      surfacesEl.appendChild(b);
    });

    // ── D-BP152-028 item 1: address bar (this IS resolveNexusAddressBarInput()'s own compiled
    // body, embedded verbatim via .toString() -- see that function's own comment in
    // nexus_authority_persistent_session.ts for the full attribution and security reasoning). ──
    ${resolveNexusAddressBarInput.toString()}

    function navigateFromAddressBar() {
      var resolved = resolveNexusAddressBarInput(addressbar.value);
      if (resolved.blocked) {
        addressbar.value = 'Blocked (' + resolved.reason + ') -- this address bar only opens http/https pages.';
        return;
      }
      if (resolved.url) {
        wv.loadURL(resolved.url);
      }
    }
    addressbar.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { navigateFromAddressBar(); }
    });
    btnGo.addEventListener('click', navigateFromAddressBar);

    // ── D-BP152-028 item 1 (sync half) + item 2 (history) ────────────────────────────────────
    function updateAddressBarFromUrl(url) {
      // Never clobber what the operator is currently typing.
      if (document.activeElement !== addressbar) {
        addressbar.value = url || '';
      }
    }
    function updateNavButtons() {
      try { btnBack.disabled = !(wv.canGoBack && wv.canGoBack()); } catch (e) { btnBack.disabled = true; }
      try { btnForward.disabled = !(wv.canGoForward && wv.canGoForward()); } catch (e) { btnForward.disabled = true; }
    }
    function onNavigate(e) {
      updateAddressBarFromUrl(e.url);
      updateNavButtons();
    }
    btnBack.addEventListener('click', function () { if (wv.canGoBack && wv.canGoBack()) { wv.goBack(); } });
    btnForward.addEventListener('click', function () { if (wv.canGoForward && wv.canGoForward()) { wv.goForward(); } });
    btnReload.addEventListener('click', function () { wv.reload(); });
    btnStop.addEventListener('click', function () { wv.stop(); });
    wv.addEventListener('did-navigate', onNavigate);
    wv.addEventListener('did-navigate-in-page', onNavigate);
    wv.addEventListener('dom-ready', updateNavButtons);
    wv.addEventListener('did-start-loading', function () { btnStop.disabled = false; });
    wv.addEventListener('did-stop-loading', function () { btnStop.disabled = true; updateNavButtons(); });

    // ── D-BP152-028 item 3: bookmarks (persisted to disk by main -- see
    // nexus_authority_bookmarks_store.ts for the chosen path and why) ───────────────────────────
    function renderBookmarks(list) {
      bookmarksBarEl.innerHTML = '';
      (list || []).forEach(function (bm) {
        var chip = document.createElement('span');
        chip.className = 'bmchip';
        var link = document.createElement('button');
        link.className = 'bmlink';
        link.textContent = bm.title || bm.url;
        link.title = bm.url;
        link.addEventListener('click', function () { wv.loadURL(bm.url); });
        var rm = document.createElement('button');
        rm.className = 'bmremove';
        rm.title = 'Remove bookmark';
        rm.textContent = '\\u00d7';
        rm.addEventListener('click', function () {
          if (window.amplify && window.amplify.nexusAuthorityBookmarksRemove) {
            window.amplify.nexusAuthorityBookmarksRemove(bm.id).then(function (res) {
              renderBookmarks(res && res.bookmarks ? res.bookmarks : []);
            });
          }
        });
        chip.appendChild(link);
        chip.appendChild(rm);
        bookmarksBarEl.appendChild(chip);
      });
    }
    function loadBookmarks() {
      if (window.amplify && window.amplify.nexusAuthorityBookmarksList) {
        window.amplify.nexusAuthorityBookmarksList().then(function (res) {
          renderBookmarks(res && res.bookmarks ? res.bookmarks : []);
        });
      }
    }
    btnBookmarkAdd.addEventListener('click', function () {
      var url = '';
      try { url = wv.getURL ? wv.getURL() : ''; } catch (e) { /* non-fatal */ }
      if (!url || url === 'about:blank') { return; }
      var title = url;
      try { title = (wv.getTitle && wv.getTitle()) || url; } catch (e) { /* non-fatal */ }
      if (window.amplify && window.amplify.nexusAuthorityBookmarksAdd) {
        window.amplify.nexusAuthorityBookmarksAdd(url, title).then(function (res) {
          renderBookmarks(res && res.bookmarks ? res.bookmarks : []);
        });
      }
    });
    loadBookmarks();

    // D-BP152-025 -- the ONLY new side-effecting control that ticket added. Fires exactly one IPC
    // round trip on click and nothing else; all extraction logic lives in main
    // (captureNexusAuthorityVisibleText(), below) so this handler stays a thin trigger, same
    // "thin forward, no logic in the button handler" discipline the other buttons already follow
    // (their own loadURL calls are the one exception, pre-existing). UNCHANGED by D-BP152-028.
    document.getElementById('btn-capture').addEventListener('click', function () {
      if (window.amplify && window.amplify.nexusAuthorityCapture) {
        window.amplify.nexusAuthorityCapture();
      }
    });
    document.getElementById('btn-done').addEventListener('click', function () {
      if (window.amplify && window.amplify.hideNexusAuthoritySession) {
        window.amplify.hideNexusAuthoritySession();
      }
    });
  </script>
</body>
</html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

/**
 * Creates the persistent hidden session if the flag is on and it doesn't already exist; returns
 * the existing window if it does. Returns null (honest, no side effect) when the flag is off --
 * this is the "unreachable new code when flag false" guarantee: no BrowserWindow is
 * constructed, no `persist:nexus-authority` session partition is ever touched, when
 * isNexusAuthorityFlagEnabled() is false. Idempotent and safe to call from multiple sites
 * (app-start warm-up, a lazy lookup call, or the Settings sign-in button) -- calling it a second
 * time while a live window already exists just returns that same window.
 */
export function ensureNexusAuthoritySession(): BrowserWindow | null {
  if (!isNexusAuthorityFlagEnabled()) {
    return null;
  }
  if (nexusAuthorityWindow && !nexusAuthorityWindow.isDestroyed()) {
    return nexusAuthorityWindow;
  }

  nexusAuthorityWindow = new BrowserWindow({
    width: 1024,
    height: 800,
    show: false,
    title: 'Nexus Authority -- persistent session',
    webPreferences: {
      preload: join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      devTools: true,
    },
  });

  nexusAuthorityWindow.loadURL(buildEmbedderHtml());

  nexusAuthorityWindow.on('closed', () => {
    nexusAuthorityWindow = null;
  });

  console.log(`[nexus-authority-session] persistent session created (partition: ${NEXUS_AUTHORITY_PARTITION}).`);
  return nexusAuthorityWindow;
}

/** Read-only accessor -- never creates. Used by callers that want "the surface if it already
 *  exists" without triggering a fresh creation (e.g. a status check that should not itself spin
 *  up a hidden window the user hasn't opted into this session). */
export function getNexusAuthorityWindow(): BrowserWindow | null {
  return nexusAuthorityWindow && !nexusAuthorityWindow.isDestroyed() ? nexusAuthorityWindow : null;
}

// ─── D-BP152-048/BISHOP/seg-webview-collision -- the machine-query window ──────────────────────
//
// THE LIVE FAILURE this section fixes: the Founder opened the Nexus window, navigated it to
// Gemini, signed in, then ran a question with send-to-Google. Result: "Google UNREACHABLE (no
// answer after 3 attempts)" (comparative_cascade.ts's googleBlocks(), after 3 real dispatch
// attempts each returned nothing).
//
// MEASURED CAUSE (file:line): `ensureNexusAuthoritySession()` above creates exactly ONE
// BrowserWindow holding exactly ONE <webview> (buildEmbedderHtml(), the `#wvwrap` element around
// line 265). The 5 chrome-bar surface buttons (lines 289-299, `wv.loadURL(surface.url)`) and the
// address bar (line 313) navigate THAT webview when the operator drives it by hand.
// probeNexusAuthoritySignInStatus() (above) and index.ts's runBrowserAuthorityQueryFromMainObserved
// -- the function askGoogle (index.ts) is a one-line closure around -- ALSO navigate that exact
// same webview (via `ensureNexusAuthoritySession()` / `document.querySelector('webview')`) when a
// machine-driven Google/Perplexity query runs. One webview, two purposes: when the operator had
// it open on Gemini, the machine's own sign-in probe and query navigation collided with his live
// page, on top of each other, on every one of googleBlocks()'s 3 attempts.
//
// FIX CHOSEN: a second, dedicated, ALWAYS-HIDDEN BrowserWindow/webview for machine-driven STATIC
// (Google/Perplexity) queries -- the two authorities askGoogle-shaped callers use -- sharing the
// SAME `persist:nexus-authority` partition (so the signed-in cookie jar is identical, per this
// file's own header MECHANISM note) but a SEPARATE window/webview instance. A machine query can
// then never navigate the page the operator is looking at, and the operator's own navigation can
// never be interrupted by or made to interfere with a machine query -- the two simply no longer
// share anything but cookies.
//
// REJECTED, and why:
//   1. Navigate-and-restore on the shared webview (run the query, then put the operator's page
//      back). Rejected per this ticket's own dispatch: it visibly steals his page mid-read and
//      races his typing -- the exact failure mode the D-BP152-033 hijack guard below (a DIFFERENT
//      shared-webview mechanism, for the conversational authorities) was built to prevent.
//   2. A refuse-when-visible guard alone (D-BP152-033's own `probeNexusAuthorityOperatorEngagement`
//      pattern, reused unchanged below for the Gemini meta-question path) applied to askGoogle
//      too. Rejected: refusing would mean a Google query simply FAILS whenever the operator has
//      the window open -- the opposite of the requirement that "the operator must be able to use
//      the Nexus window on any surface while the run issues Google queries." A second, separate
//      instance lets both happen concurrently instead of forcing a choice between them.
//
// webPreferences below are byte-identical to ensureNexusAuthoritySession()'s own (contextIsolation
// true, nodeIntegration false, webviewTag true, same preload.js, devTools true) -- no security
// setting is loosened or changed for this second window.

let nexusMachineQueryWindow: BrowserWindow | null = null;

/** Same minimal-chrome pattern as buildEmbedderHtml() above, stripped to just the one <webview>
 *  element this window exists for -- no chrome bar, no address bar, no buttons, since nothing
 *  here is ever shown to or driven by the operator. Same partition and same compiled preload
 *  artifact as the operator's own window (webviewPreloadPath(), NEXUS_AUTHORITY_PARTITION) --
 *  the SAME signed-in session, a DIFFERENT DOM. */
function buildMachineQueryEmbedderHtml(): string {
  const preloadPath = webviewPreloadPath();
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body { margin: 0; padding: 0; height: 100vh; width: 100vw; overflow: hidden; }
  webview { position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%; display: flex; }
</style>
</head>
<body>
  <webview id="nexus-machine-query-webview" src="about:blank" partition="${NEXUS_AUTHORITY_PARTITION}" preload="${preloadPath}"></webview>
</body>
</html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

/**
 * Creates the dedicated machine-query session if the flag is on and it doesn't already exist;
 * returns the existing window if it does -- same idempotent, flag-gated, "null when off, never
 * fabricated" contract as ensureNexusAuthoritySession() above, deliberately mirrored rather than
 * reinvented. `show` is never set to true anywhere in this file for this window -- there is no
 * code path, in this ticket or any other, that makes this window visible; it exists purely as a
 * second execution context for the SAME session, never as a second surface a human could open.
 */
export function ensureNexusMachineQuerySession(): BrowserWindow | null {
  if (!isNexusAuthorityFlagEnabled()) {
    return null;
  }
  if (nexusMachineQueryWindow && !nexusMachineQueryWindow.isDestroyed()) {
    return nexusMachineQueryWindow;
  }

  nexusMachineQueryWindow = new BrowserWindow({
    width: 1024,
    height: 800,
    show: false,
    title: 'Nexus Authority -- machine query session',
    webPreferences: {
      preload: join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      devTools: true,
    },
  });

  nexusMachineQueryWindow.loadURL(buildMachineQueryEmbedderHtml());

  nexusMachineQueryWindow.on('closed', () => {
    nexusMachineQueryWindow = null;
  });

  console.log(`[nexus-authority-session] machine-query session created (partition: ${NEXUS_AUTHORITY_PARTITION}).`);
  return nexusMachineQueryWindow;
}

/** Read-only accessor -- never creates. Mirrors getNexusAuthorityWindow()'s own contract. */
export function getNexusMachineQueryWindow(): BrowserWindow | null {
  return nexusMachineQueryWindow && !nexusMachineQueryWindow.isDestroyed() ? nexusMachineQueryWindow : null;
}

/**
 * Item 3 (Sign-in UX): opens the persistent session VISIBLY, one time, navigated to the
 * requested authority's sign-in-friendly URL, so a human can interactively log in. Returns
 * false (never throws) when the flag is off or the window can't be created.
 */
export function showNexusAuthoritySessionForSignIn(authority: BrowserAuthorityName): boolean {
  const win = ensureNexusAuthoritySession();
  if (!win) return false;

  const url =
    authority === 'user_perplexity' ? 'https://www.perplexity.ai/'
      : authority === 'user_claude' ? 'https://claude.ai/new'
        // BP140-K4: chatgpt.com/gemini.google.com sign-in-friendly URLs, same "navigate to a
        // page a human can log into" contract as the three branches above.
        : authority === 'user_chatgpt' ? 'https://chatgpt.com/auth/login'
          : authority === 'user_gemini' ? 'https://accounts.google.com/ServiceLogin?continue=https%3A%2F%2Fgemini.google.com%2Fapp'
            // D-BP152-027: this 'user_google' default is the SAME operator-facing path as the
            // embedder's own Google chrome-bar button (buildEmbedderHtml() above) -- both are
            // what the Founder reaches via "Open Google"/the new pause action. Founder, live:
            // "it is on My account page ... I'm just trying to search google." Plain search, not
            // the account/sign-in page. Sign-in is still reachable from google.com itself if
            // needed again (persist:nexus-authority keeps the session alive either way).
            : 'https://www.google.com';
  win.webContents.executeJavaScript(`
    (function () {
      try {
        var wv = document.querySelector('webview');
        if (wv) { wv.loadURL(${JSON.stringify(url)}); }
      } catch (e) { /* non-fatal */ }
    })();
  `).catch(() => { /* non-fatal -- the window still shows even if this pre-navigation nudge fails */ });

  win.show();
  win.focus();
  return true;
}

/** Hides the persistent session window (does NOT destroy it -- the session and its webview
 *  contents stay alive in the background, per item 1's "not tied to any tab's lifecycle"). */
export function hideNexusAuthoritySession(): void {
  if (nexusAuthorityWindow && !nexusAuthorityWindow.isDestroyed()) {
    nexusAuthorityWindow.hide();
  }
}

// ─── Honest sign-in status probe (item 3 + item 4's honesty firewall) ──────────────────────────

export interface NexusAuthoritySignInProbeResult {
  authority: BrowserAuthorityName;
  signedIn: boolean;
  reason: string;
  checkedAt: string;
}

// Best-effort, DOM-scraping heuristics against each vendor's OWN rendered page as of BP137
// 0.9.12 (2026) -- same "third-party page markup changes without notice" honesty disclaimer
// webview_preload.ts's GOOGLE_ANSWER_SELECTORS/PERPLEXITY_ANSWER_SELECTORS already carry. A
// selector miss is reported as `signedIn: false`, never coerced into a fake positive.
const GOOGLE_SIGNED_IN_MARKERS = [
  'a[aria-label^="Google Account:"]',
  'a[href*="myaccount.google.com"]',
  'img[alt="Google Account"]',
];
// Live-verified against the REAL logged-out perplexity.ai page during BP137 0.9.12 Stage F1's
// GUI-launch verification: 'a[href="/library"]' (an earlier candidate) is present even while
// signed OUT (confirmed false positive, removed) -- the two markers below were confirmed ABSENT
// on that same logged-out page, which is the only side of this heuristic this pass can verify
// without real Google/Perplexity credentials. Whether they are true positives once actually
// signed in remains UNVERIFIED pending a human completing the interactive login this Yoke's own
// acceptance bar requires -- see this file's SIGN_IN_CONTROL_MARKERS override below for the
// honesty-firewall safety net that additionally guards against a future false positive here.
// 0.9.14 -- broadened OR-match candidate set (keeps the original 2, adds 7 more) to reduce the
// false-negative risk of a HARD GATE marker list: a miss here blocks Perplexity for every query.
// Honesty note: only the original 2 markers above carry the BP137 0.9.12 logged-out-page
// absence verification; the 7 additions below are defensive candidates NOT yet live-verified
// against an actual signed-in Perplexity DOM -- pending that one live-verify pass.
const PERPLEXITY_SIGNED_IN_MARKERS = [
  '[data-testid="user-account-menu"]',
  'button[aria-label*="Account" i]',
  '[data-testid="user-avatar"]',
  'img[alt*="avatar" i]',
  'a[href="/account"]',
  'a[href^="/settings"]',
  '[class*="workspace" i][class*="switcher" i]',
  '[data-testid*="pro" i]',
  'button[aria-label*="workspace" i]',
];

// (this build pass) claude.ai/new markers -- NONE of these are live-verified against a real
// signed-in claude.ai session (same honesty caveat as the 7 defensive Perplexity additions
// above): best-effort candidates covering (a) the composer itself only ever renders once past
// any login wall, (b) a user/account affordance in the nav, (c) the conversation-history sidebar
// (also login-gated). The SIGN_IN_CONTROL_TEXT_PATTERN override below still applies FIRST, so a
// page that still shows a visible "Log in"/"Sign in" control can never be reported signedIn:true
// even if one of these matches (e.g. a marketing element outside the authed app shell).
const CLAUDE_SIGNED_IN_MARKERS = [
  'div[contenteditable="true"].ProseMirror',
  'div[aria-label="Write your prompt to Claude"]',
  'button[data-testid="user-menu-button"]',
  '[data-testid="chat-menu-trigger"]',
  'nav button[aria-haspopup="menu"]',
  'a[href="/chats"]',
  'button[aria-label*="Account" i]',
];

// BP140-K4: chatgpt.com/gemini.google.com markers -- same honesty caveat as the Claude markers
// above (NOT live-verified against a real signed-in session for either vendor). The composer
// itself only ever renders once past any login wall for both vendors, so it doubles as the
// strongest positive signal here, same as Claude's ProseMirror composer marker above.
const CHATGPT_SIGNED_IN_MARKERS = [
  '#prompt-textarea',
  'nav a[href="/"]',
  'button[data-testid="profile-button"]',
  '[data-testid="accounts-profile-button"]',
];
const GEMINI_SIGNED_IN_MARKERS = [
  'rich-textarea .ql-editor',
  '.ql-editor[contenteditable="true"]',
  'a[href="https://myaccount.google.com/"]',
  'img[alt="Google Account"]',
];

// Defense-in-depth for the honesty firewall: a page that is still showing an explicit sign-in
// control (any element whose visible text matches /log ?in|sign ?in/i) can never be reported
// signedIn:true, REGARDLESS of whether a positive marker above also happens to match -- this is
// exactly the failure mode the a[href="/library"] false positive (above) demonstrated live: a
// marketing/public-nav element unrelated to auth state matched while the SAME page still showed
// a visible "Log in" control. This override is checked FIRST and short-circuits to false.
const SIGN_IN_CONTROL_TEXT_PATTERN = 'log ?in|sign ?in';

function buildSignInProbeScript(authority: BrowserAuthorityName): string {
  const markers =
    authority === 'user_perplexity' ? PERPLEXITY_SIGNED_IN_MARKERS
      : authority === 'user_claude' ? CLAUDE_SIGNED_IN_MARKERS
        : authority === 'user_chatgpt' ? CHATGPT_SIGNED_IN_MARKERS
          : authority === 'user_gemini' ? GEMINI_SIGNED_IN_MARKERS
            : GOOGLE_SIGNED_IN_MARKERS;
  return `
    (function () {
      try {
        var signInControlRe = new RegExp(${JSON.stringify(SIGN_IN_CONTROL_TEXT_PATTERN)}, 'i');
        var candidates = document.querySelectorAll('a, button');
        for (var c = 0; c < candidates.length; c++) {
          var text = candidates[c].textContent || '';
          if (signInControlRe.test(text)) {
            return { signedIn: false, reason: 'sign-in-control-visible' };
          }
        }
      } catch (e) { /* non-fatal -- fall through to the marker check below */ }
      var markers = ${JSON.stringify(markers)};
      for (var i = 0; i < markers.length; i++) {
        try {
          if (document.querySelector(markers[i])) {
            return { signedIn: true, reason: 'marker:' + markers[i] };
          }
        } catch (e) { /* invalid selector on this page -- try the next candidate */ }
      }
      return { signedIn: false, reason: 'no-marker-found' };
    })()
  `;
}

const SIGN_IN_PROBE_TIMEOUT_MS = 15_000;
const SIGN_IN_PROBE_SETTLE_DELAY_MS = 1_200;

/**
 * Navigates a Nexus session's shared <webview> to `authority`'s own page and runs a cheap DOM
 * probe for a known logged-in marker element. Returns `signedIn: false` (never fabricated) for
 * every failure mode: flag off, no window, navigation timeout, or no marker found -- see this
 * file's header "HONESTY FIREWALL" note. This mutates the target session's current page (a side
 * effect visible only if that window happens to be shown at the same moment) -- same trade-off
 * the existing runBrowserAuthorityQueryFromMain() already accepts for its own query navigation.
 *
 * D-BP152-048/BISHOP/seg-webview-collision: `windowGetter` is ADDITIVE, defaulted to
 * `ensureNexusAuthoritySession` -- every pre-existing caller (probeAllNexusAuthorityStatuses(),
 * the Settings "Check status" action) that calls this with one argument gets byte-identical
 * behavior, still probing the operator's own shared window. index.ts's static (Google/
 * Perplexity) branch is the only caller that now passes `ensureNexusMachineQuerySession`
 * instead, so that probe's navigation lands on the dedicated machine-query window (same
 * partition, so the same signed-in cookies are visible) rather than colliding with whatever
 * surface the operator has the shared window open on.
 */
export async function probeNexusAuthoritySignInStatus(
  authority: BrowserAuthorityName,
  windowGetter: () => BrowserWindow | null = ensureNexusAuthoritySession,
): Promise<NexusAuthoritySignInProbeResult> {
  const checkedAt = new Date().toISOString();
  const win = windowGetter();
  if (!win) {
    return { authority, signedIn: false, reason: 'flag_off_or_unavailable', checkedAt };
  }

  const url =
    authority === 'user_perplexity' ? 'https://www.perplexity.ai/'
      : authority === 'user_claude' ? 'https://claude.ai/new'
        : authority === 'user_chatgpt' ? 'https://chatgpt.com/'
          : authority === 'user_gemini' ? 'https://gemini.google.com/app'
            : 'https://www.google.com/';
  const probeScript = buildSignInProbeScript(authority);

  const script = `
    (function () {
      return new Promise(function (resolve) {
        try {
          var wv = document.querySelector('webview');
          if (!wv) { resolve({ signedIn: false, reason: 'no-webview' }); return; }
          var settled = false;
          var timeoutId = setTimeout(function () {
            if (settled) return;
            settled = true;
            wv.removeEventListener('did-finish-load', onLoad);
            resolve({ signedIn: false, reason: 'timeout' });
          }, ${SIGN_IN_PROBE_TIMEOUT_MS});
          function onLoad() {
            wv.removeEventListener('did-finish-load', onLoad);
            setTimeout(function () {
              wv.executeJavaScript(${JSON.stringify(probeScript)}).then(function (result) {
                if (settled) return;
                settled = true;
                clearTimeout(timeoutId);
                resolve(result && typeof result === 'object' ? result : { signedIn: false, reason: 'bad-probe-result' });
              }).catch(function () {
                if (settled) return;
                settled = true;
                clearTimeout(timeoutId);
                resolve({ signedIn: false, reason: 'probe-threw' });
              });
            }, ${SIGN_IN_PROBE_SETTLE_DELAY_MS});
          }
          wv.addEventListener('did-finish-load', onLoad);
          wv.loadURL(${JSON.stringify(url)});
        } catch (err) {
          resolve({ signedIn: false, reason: 'outer-threw' });
        }
      });
    })()
  `;

  try {
    const result = await win.webContents.executeJavaScript(script);
    const r = result as { signedIn?: boolean; reason?: string } | null;
    return {
      authority,
      signedIn: r?.signedIn === true,
      reason: r?.reason ?? 'unknown',
      checkedAt,
    };
  } catch (err) {
    console.warn('[nexus-authority-session] sign-in probe executeJavaScript failed (non-fatal, honest false):', (err as Error)?.message ?? err);
    return { authority, signedIn: false, reason: 'probe-execute-failed', checkedAt };
  }
}

/** Convenience wrapper: probes both authorities. Runs sequentially (the two authorities share
 *  ONE <webview>, so a concurrent probe would race the same navigation) -- called by the
 *  Settings panel's "Check status" action. */
export async function probeAllNexusAuthorityStatuses(): Promise<NexusAuthoritySignInProbeResult[]> {
  if (!isNexusAuthorityFlagEnabled()) {
    const checkedAt = new Date().toISOString();
    return [
      { authority: 'user_google', signedIn: false, reason: 'flag_off_or_unavailable', checkedAt },
      { authority: 'user_perplexity', signedIn: false, reason: 'flag_off_or_unavailable', checkedAt },
      { authority: 'user_claude', signedIn: false, reason: 'flag_off_or_unavailable', checkedAt },
      { authority: 'user_chatgpt', signedIn: false, reason: 'flag_off_or_unavailable', checkedAt },
      { authority: 'user_gemini', signedIn: false, reason: 'flag_off_or_unavailable', checkedAt },
    ];
  }
  const google = await probeNexusAuthoritySignInStatus('user_google');
  const perplexity = await probeNexusAuthoritySignInStatus('user_perplexity');
  // (this build pass) claude.ai/new added, same sequential-share-one-webview discipline as
  // google/perplexity above (the three authorities share ONE <webview>, so a concurrent probe
  // would race the same navigation).
  const claude = await probeNexusAuthoritySignInStatus('user_claude');
  // BP140-K4: chatgpt.com/gemini.google.com added, same sequential-share-one-webview discipline.
  const chatgpt = await probeNexusAuthoritySignInStatus('user_chatgpt');
  const gemini = await probeNexusAuthoritySignInStatus('user_gemini');
  return [google, perplexity, claude, chatgpt, gemini];
}

// ─── Operator capture: return what the operator typed to the paused Liana Cycle run ────────────
//
// D-BP152-025/BISHOP/seg-nexus-returns-answer. Founder, BP152, verbatim: "why can't we pull up
// the headless google I am signed into on the nexus tab, as in, let that 5 tabbed interface come
// up and I literally just use that to ask the question, and the response comes back to the liana
// cycle?" Ruled: "do the second one, make the nexus surface return what I type."
//
// HE TYPES AND SUBMITS HIMSELF, on the visible surface above, exactly as before this ticket. This
// section adds exactly one new capability: read what is CURRENTLY on screen when he presses the
// new "Capture -> Liana Cycle" button (buildEmbedderHtml() above) and hand it to the caller
// (index.ts's 'nexus-authority-capture' handler, which resolves the paused Step 0 pause with it --
// see stepped_audible.ts's requestStepZeroPause(), 'nexus_capture' branch). Nothing here types,
// submits, navigates, or waits on the operator's behalf -- see getNexusAuthorityWindow() below,
// which is read-only and never creates a window (a capture with no window open has nothing to
// capture and returns ok:false honestly, matching this file's existing HONESTY FIREWALL
// convention).
//
// GENERIC EXTRACTION, NOT SELECTORS. D-BP152-024 (the SEG return this ticket acts on) measured
// that no selector in this codebase targets a generative answer, and that the five surfaces share
// no common DOM structure. So this reads the page's own visible main text -- `main`, else
// `article`, else `body` -- and returns it verbatim, untruncated, with no length cap and no
// vendor-specific selector list, matching webview_preload.ts's OWN extraction pattern
// (executeJavaScript into the guest page) without touching or importing anything from that file.

/** One reference link found inside the captured container -- generic `http(s)` anchor scrape,
 *  same "no selector guessing" discipline as the main-text extraction. `domain` is a mechanical
 *  hostname parse of `href` (never an interpretation of the link), null on an unparseable href. */
export interface NexusAuthorityCaptureCitation {
  href: string;
  text: string;
  domain: string | null;
}

export interface NexusAuthorityCaptureResult {
  ok: boolean;
  /** Which of the 5 chrome-bar buttons was last clicked ('google'|'perplexity'|'claude'|
   *  'chatgpt'|'gemini'), or null if none has been clicked yet this session. */
  authority: string | null;
  url: string;
  text: string;
  containerUsed: 'main' | 'article' | 'body' | 'none';
  citations: NexusAuthorityCaptureCitation[];
  reason?: string;
}

/** Pure, unit-testable: normalizes a citation href to its hostname (the "domain" the Founder's
 *  D-BP152-025 scope addition asked for -- "normalize to a domain for ledger keying... while
 *  retaining the full URL verbatim"). Returns null on an unparseable URL rather than throwing --
 *  malformed markup in a captured page must never crash a capture. */
export function normalizeCitationDomain(href: string): string | null {
  try {
    return new URL(href).hostname || null;
  } catch {
    return null;
  }
}

/** Runs INSIDE the guest webview's own page context (via wv.executeJavaScript below) -- same
 *  execution boundary webview_preload.ts's own extraction functions use, just invoked from this
 *  file's outer script instead of from that preload. Deliberately generic: `main`, else
 *  `article`, else `document.body` -- no vendor-specific selector anywhere. */
const CAPTURE_EXTRACT_SCRIPT = `
  (function () {
    try {
      var container = document.querySelector('main') || document.querySelector('article');
      var containerUsed = container ? (container.tagName && container.tagName.toLowerCase() === 'main' ? 'main' : 'article') : 'body';
      var root = container || document.body;
      var text = (root && root.innerText) || '';
      var anchors = root ? root.querySelectorAll('a[href]') : [];
      var citations = [];
      for (var i = 0; i < anchors.length; i++) {
        var href = anchors[i].getAttribute('href') || '';
        if (!/^https?:\\/\\//i.test(href)) continue;
        citations.push({ href: href, text: (anchors[i].textContent || '').trim() });
      }
      return { text: text, containerUsed: containerUsed, citations: citations };
    } catch (e) {
      return { text: '', containerUsed: 'none', citations: [] };
    }
  })()
`;

/**
 * Captures the Nexus window's CURRENT on-screen state: generic visible text (main/article/body,
 * verbatim, untruncated), the page URL, which of the 5 surfaces was last selected, and any
 * `http(s)` reference links inside the captured container. Fires exactly once, synchronously with
 * the operator's own button press -- never on a timer, never on navigation, never speculatively.
 *
 * Returns `ok: false` (never throws, never fabricates content) when: the window does not exist
 * (getNexusAuthorityWindow() is read-only and does not create one -- a capture attempted before
 * the operator has ever opened the Nexus window has nothing to read), the guest `<webview>` is
 * not present, or the in-page extraction itself throws. Same HONESTY FIREWALL convention as
 * probeNexusAuthoritySignInStatus() above: a failure is reported as a labeled `reason`, never
 * coerced into an empty-but-successful result.
 */
export async function captureNexusAuthorityVisibleText(): Promise<NexusAuthorityCaptureResult> {
  const win = getNexusAuthorityWindow();
  if (!win) {
    return { ok: false, authority: null, url: '', text: '', containerUsed: 'none', citations: [], reason: 'no_window' };
  }

  const script = `
    (function () {
      return new Promise(function (resolve) {
        try {
          var wv = document.querySelector('webview');
          if (!wv) { resolve({ ok: false, reason: 'no-webview' }); return; }
          var authority = (typeof currentNexusAuthority !== 'undefined' && currentNexusAuthority) ? currentNexusAuthority : null;
          var url = '';
          try { url = wv.getURL ? wv.getURL() : ''; } catch (e) { /* non-fatal */ }
          var extractScript = ${JSON.stringify(CAPTURE_EXTRACT_SCRIPT)};
          wv.executeJavaScript(extractScript).then(function (result) {
            resolve({
              ok: true,
              authority: authority,
              url: url,
              text: (result && result.text) || '',
              containerUsed: (result && result.containerUsed) || 'none',
              citations: (result && result.citations) || [],
            });
          }).catch(function () {
            resolve({ ok: false, reason: 'extract-threw' });
          });
        } catch (err) {
          resolve({ ok: false, reason: 'outer-threw' });
        }
      });
    })()
  `;

  try {
    const result = await win.webContents.executeJavaScript(script);
    const r = result as {
      ok?: boolean;
      authority?: string | null;
      url?: string;
      text?: string;
      containerUsed?: string;
      citations?: Array<{ href: string; text: string }>;
      reason?: string;
    } | null;
    if (!r || r.ok !== true) {
      return { ok: false, authority: null, url: '', text: '', containerUsed: 'none', citations: [], reason: r?.reason ?? 'bad-capture-result' };
    }
    const rawCitations = Array.isArray(r.citations) ? r.citations : [];
    const citations: NexusAuthorityCaptureCitation[] = rawCitations
      .filter((c) => c && typeof c.href === 'string')
      .map((c) => ({ href: c.href, text: (c.text ?? '').trim(), domain: normalizeCitationDomain(c.href) }));
    return {
      ok: true,
      authority: r.authority ?? null,
      url: r.url ?? '',
      text: r.text ?? '',
      containerUsed: (r.containerUsed as NexusAuthorityCaptureResult['containerUsed']) ?? 'none',
      citations,
    };
  } catch (err) {
    console.warn('[nexus-authority-session] capture executeJavaScript failed (non-fatal, honest empty):', (err as Error)?.message ?? err);
    return { ok: false, authority: null, url: '', text: '', containerUsed: 'none', citations: [], reason: 'execute-failed' };
  }
}

// ─── D-BP152-033/BISHOP/seg-machine-drives-nexus -- MACHINE-DRIVEN queries ─────────────────────
//
// Founder, BP152, verbatim, the whole mandate this section answers: "So make it talk to google
// using the interface I just used of the 5 browsers." He drove Gemini by hand in this exact
// window, got a real derived answer, and captured it (D-BP152-025's operator-capture section
// above). This section is the machine doing that itself: given a question and one of the 5
// surfaces, drive it, wait for the answer to actually finish, and extract it -- using the SAME
// window/webview/partition the operator's own capture already reuses, never a second one.
//
// THIS OVERRIDES D-BP152-025's "operator-triggered ONLY" rule for CAPTURE (that rule existed
// because auto-capture races a streaming answer -- see COMPLETION DETECTION below for how this
// section closes that exact race instead of ignoring it). The override is granted by the
// Founder's ruling above; it does NOT relax D-BP152-033's own NEW rule immediately below: a
// machine-driven query must never run against a window the operator is actively using.
//
// NOT WIRED INTO THE LIANA CYCLE. Same discipline D-BP152-030R/032 already established for
// threading and the answer-key exclusion re-ask: this section builds a standalone, directly
// callable, exported capability. It is deliberately NOT invoked from stepped_audible.ts's Step 0
// pause loop, any method's verdict logic, or demand_test.ts -- this ticket's own FORBIDDEN list
// bars touching any of those, and the capability is correct and ready without them (a future
// ticket decides which caller, if any, should be first to use it, mirroring the fork D-BP152-030R
// itself flagged for conversational-authority threading).

/** D-BP152-033. THE HIJACK GUARD. Founder's own bound on the override above: "NEVER HIJACK A
 *  WINDOW THE OPERATOR IS USING... A machine query that erases his typing is worse than no
 *  automation." Detection is deliberately the simplest MECHANICAL signal available, not a DOM
 *  heuristic that could itself race his typing: ensureNexusAuthoritySession() creates this window
 *  with `show: false` and it stays hidden for its entire lifetime unless the operator explicitly
 *  opens it (showNexusAuthoritySessionForSignIn(), the Settings sign-in button, or he is mid
 *  capture) -- no code path in this file, before or after this ticket, ever calls `.show()` on
 *  the machine's own behalf. So "the window is currently visible" IS "a human deliberately has it
 *  open" with no false-negative gap: a hidden window can never have his cursor or keyboard focus
 *  in it. `getNexusAuthorityWindow()` (read-only, never creates) is used here rather than
 *  ensureNexusAuthoritySession() so simply CHECKING engagement can never itself spin up a window
 *  the operator hasn't opted into. No window at all -> nothing to hijack -> not engaged. */
export interface NexusOperatorEngagementResult {
  engaged: boolean;
  reason: 'no_window' | 'window_hidden' | 'window_visible_operator_may_be_using_it';
}

export function probeNexusAuthorityOperatorEngagement(): NexusOperatorEngagementResult {
  const win = getNexusAuthorityWindow();
  if (!win) {
    return { engaged: false, reason: 'no_window' };
  }
  if (win.isVisible()) {
    return { engaged: true, reason: 'window_visible_operator_may_be_using_it' };
  }
  return { engaged: false, reason: 'window_hidden' };
}

// ─── Completion detection: the heart of this ticket ────────────────────────────────────────────
//
// Founder's dispatch, verbatim: "A generative answer streams. A fixed timeout reads a
// half-written answer... Detect settlement mechanically: poll the container's text and treat it
// as complete when it stops changing across a stability window. No model judges completion; it is
// string comparison over time." D-BP152-024 (read first, per this ticket's own dispatch) measured
// that the EXISTING static Google/Perplexity scrape (index.ts, untouched by this ticket) waits a
// flat setTimeout and never polls at all -- this is the new mechanism that closes that gap,
// additive and separate from that existing code.
//
// NAMED CONSTANTS, reasoning stated here (not buried in the helper below):
/** How often to re-read the on-screen text while waiting for a machine-driven answer to settle.
 *  900ms: close to webview_preload.ts's own CLAUDE_INTERACTIVE_POLL_MS (700ms), the precedent
 *  this codebase already uses for the identical "has this generative reply stopped growing"
 *  question for the composer-driven authorities (see the REUSE note below this section) --
 *  widened slightly here because each tick is a MAIN-PROCESS -> embedder-page -> guest-webview
 *  double executeJavaScript round trip (captureNexusAuthorityVisibleText's own boundary-crossing
 *  pattern, reused unchanged below), which carries more overhead than webview_preload.ts's
 *  in-page setInterval. */
export const MACHINE_QUERY_POLL_INTERVAL_MS = 900;
/** How many CONSECUTIVE unchanged, non-empty polls declare the answer settled. 3 -- the same
 *  number webview_preload.ts's CLAUDE_INTERACTIVE_STABLE_TICKS_REQUIRED uses for the identical
 *  question: 3 ticks (2.7s of observed silence at this interval) is enough to distinguish
 *  "finished" from "a brief pause mid-stream" without an arbitrary extra safety margin on top. */
export const MACHINE_QUERY_STABLE_TICKS_REQUIRED = 3;
/** Hard ceiling on total wait after navigation, independent of stability. 30s: longer than
 *  index.ts's BROWSER_AUTHORITY_MAIN_TIMEOUT_MS (20s, sized for a near-instant static box/organic
 *  scrape) because a generative "AI Overview"-style answer can render slower than that -- same
 *  reasoning index.ts's own BROWSER_AUTHORITY_INTERACTIVE_TIMEOUT_MS already applied when
 *  claude.ai's streamed replies needed more room. Still a FIRM ceiling: a page that never stops
 *  mutating (an ad carousel, a live-updating widget) cannot hang a run forever -- see
 *  decideNexusMachineQueryPollStep's 'ceiling' outcome below, which is ALWAYS reported as an
 *  explicit incomplete-capture outcome, never silently upgraded to a clean settled answer. */
export const MACHINE_QUERY_CEILING_MS = 30_000;
/** Separate budget for the initial navigation (did-finish-load) BEFORE polling even starts --
 *  20s, matching index.ts's own BROWSER_AUTHORITY_MAIN_TIMEOUT_MS for the same "a page load never
 *  fires its load event" honest-failure case. Deliberately NOT the same constant as
 *  MACHINE_QUERY_CEILING_MS: a navigation that never loads and a page that loads but never
 *  settles are different failures with different, individually honest reasons. */
export const MACHINE_QUERY_NAVIGATION_TIMEOUT_MS = 20_000;

/**
 * D-BP152-033. THE completion-detection decision itself -- a PURE function (no DOM, no Electron,
 * no I/O) so it is directly unit-testable exactly like resolveNexusAddressBarInput() above (same
 * file, same pattern: a pure decision function, tested for real, that production code calls
 * directly -- never a hand-duplicated copy that could drift). "No model judges completion; it is
 * string comparison over time" (dispatch, verbatim) -- this function does exactly that and
 * nothing else: an equality check against the previous tick's text, a counter, and two threshold
 * comparisons.
 */
export function decideNexusMachineQueryPollStep(
  currentText: string,
  lastText: string | null,
  stableTicksSoFar: number,
  ticksElapsed: number,
  pollIntervalMs: number,
  stableTicksRequired: number,
  ceilingMs: number,
): { action: 'continue' | 'settled' | 'ceiling'; nextStableTicks: number } {
  const textNonEmpty = currentText.length > 0;
  const unchanged = textNonEmpty && currentText === lastText;
  const nextStableTicks = unchanged ? stableTicksSoFar + 1 : 0;
  if (textNonEmpty && nextStableTicks >= stableTicksRequired) {
    return { action: 'settled', nextStableTicks };
  }
  if (ticksElapsed * pollIntervalMs >= ceilingMs) {
    return { action: 'ceiling', nextStableTicks };
  }
  return { action: 'continue', nextStableTicks };
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Navigates the shared webview and waits for `did-finish-load` before returning -- the SAME
 *  navigate-then-wait idiom probeNexusAuthoritySignInStatus() above already uses (outer
 *  executeJavaScript wrapping a Promise, an event listener, and a timeout fallback), reused here
 *  rather than re-derived, so a machine-driven query's FIRST poll tick reads the NEW page's
 *  content, never a stale pre-navigation page that merely happens to look "stable" because it
 *  has not started loading yet. */
async function navigateNexusSharedWebviewAndWaitForLoad(
  win: BrowserWindow,
  url: string,
): Promise<{ ok: boolean; reason?: string }> {
  const script = `
    (function () {
      return new Promise(function (resolve) {
        try {
          var wv = document.querySelector('webview');
          if (!wv) { resolve({ ok: false, reason: 'no-webview' }); return; }
          var settled = false;
          var timeoutId = setTimeout(function () {
            if (settled) return;
            settled = true;
            wv.removeEventListener('did-finish-load', onLoad);
            resolve({ ok: false, reason: 'load-timeout' });
          }, ${MACHINE_QUERY_NAVIGATION_TIMEOUT_MS});
          function onLoad() {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            wv.removeEventListener('did-finish-load', onLoad);
            resolve({ ok: true });
          }
          wv.addEventListener('did-finish-load', onLoad);
          wv.loadURL(${JSON.stringify(url)});
        } catch (err) {
          resolve({ ok: false, reason: 'outer-threw' });
        }
      });
    })()
  `;
  try {
    const result = await win.webContents.executeJavaScript(script);
    const r = result as { ok?: boolean; reason?: string } | null;
    return { ok: r?.ok === true, reason: r?.reason };
  } catch (err) {
    return { ok: false, reason: 'execute-failed' };
  }
}

export interface NexusStaticMachineQueryResult {
  ok: boolean;
  url: string;
  text: string;
  citations: NexusAuthorityCaptureCitation[];
  containerUsed: 'main' | 'article' | 'body' | 'none';
  /** 'settled' -- text stability declared completion before the ceiling. 'ceiling' -- the hard
   *  wait budget was reached with SOME non-empty text observed; `text` is whatever was last
   *  captured, reported as an explicit INCOMPLETE outcome, never as a clean settled answer.
   *  'failed' -- navigation never loaded, no webview, or the ceiling was reached with nothing
   *  ever captured at all. */
  outcome: 'settled' | 'ceiling' | 'failed';
  reason?: string;
  pollTicks: number;
  waitedMs: number;
}

/**
 * D-BP152-033. Google/Perplexity have no composer -- "asking" IS navigating to the query URL
 * (buildBrowserAuthorityQueryUrl, reused unchanged from browser_authority_types.ts; this function
 * never touches or calls index.ts's askGoogle closure or its static branch). What was missing per
 * D-BP152-024's own measurement was readiness detection and generic (non-selector-based)
 * extraction for whatever the page renders -- this function supplies both: navigate, wait for
 * genuine page load, then poll captureFn (D-BP152-025's own captureNexusAuthorityVisibleText(),
 * REUSED unmodified as the default, injected only so a test can supply a canned sequence) until
 * decideNexusMachineQueryPollStep declares settled or the ceiling trips.
 */
async function runMachineDrivenStaticNexusQuery(
  authority: 'user_google' | 'user_perplexity',
  question: string,
  mcOptions: string[] | undefined,
  captureFn: () => Promise<NexusAuthorityCaptureResult> = captureNexusAuthorityVisibleText,
): Promise<NexusStaticMachineQueryResult> {
  const win = ensureNexusAuthoritySession();
  if (!win) {
    return { ok: false, url: '', text: '', citations: [], containerUsed: 'none', outcome: 'failed', reason: 'flag_off_or_unavailable', pollTicks: 0, waitedMs: 0 };
  }

  const query: BrowserAuthorityQuery = {
    question,
    authority,
    ...(mcOptions && mcOptions.length ? { mcOptions, embedOptionsForGoogle: true } : {}),
  };
  const navigateUrl = buildBrowserAuthorityQueryUrl(query);

  const startedAt = Date.now();
  const navResult = await navigateNexusSharedWebviewAndWaitForLoad(win, navigateUrl);
  if (!navResult.ok) {
    return { ok: false, url: navigateUrl, text: '', citations: [], containerUsed: 'none', outcome: 'failed', reason: navResult.reason ?? 'navigation-failed', pollTicks: 0, waitedMs: Date.now() - startedAt };
  }

  let lastText: string | null = null;
  let stableTicks = 0;
  let ticks = 0;
  let lastCapture: NexusAuthorityCaptureResult | null = null;

  for (;;) {
    await sleepMs(MACHINE_QUERY_POLL_INTERVAL_MS);
    ticks++;
    const capture = await captureFn();
    lastCapture = capture;
    const currentText = capture.ok ? capture.text : '';
    const decision = decideNexusMachineQueryPollStep(
      currentText, lastText, stableTicks, ticks,
      MACHINE_QUERY_POLL_INTERVAL_MS, MACHINE_QUERY_STABLE_TICKS_REQUIRED, MACHINE_QUERY_CEILING_MS,
    );
    stableTicks = decision.nextStableTicks;
    lastText = currentText;

    if (decision.action === 'continue') continue;

    const waitedMs = Date.now() - startedAt;
    if (decision.action === 'settled') {
      return {
        ok: true, url: lastCapture.url || navigateUrl, text: lastCapture.text, citations: lastCapture.citations,
        containerUsed: lastCapture.containerUsed, outcome: 'settled', pollTicks: ticks, waitedMs,
      };
    }
    // 'ceiling' -- honest incomplete-capture outcome, NEVER reported as a clean answer.
    const hasText = currentText.length > 0;
    return {
      ok: hasText, url: lastCapture.url || navigateUrl, text: lastCapture.text, citations: lastCapture.citations,
      containerUsed: lastCapture.containerUsed, outcome: hasText ? 'ceiling' : 'failed',
      reason: hasText ? 'ceiling_reached_with_partial_text' : 'no_text_at_ceiling',
      pollTicks: ticks, waitedMs,
    };
  }
}

/** D-BP152-033. Duplicated from stepped_audible.ts:628's detectOptionContamination() -- that
 *  function is a private, unexported helper inside a file this ticket's own FORBIDDEN list bars
 *  touching ("Step 0, the pause plumbing"), so exporting it there was not an option. Same exact
 *  contract, verbatim: plain string containment against a lettered options pool, flag only, NEVER
 *  used to block or edit anything. Kept here (not skipped) so "the contamination guards stay on...
 *  apply to machine-driven answers exactly as to operator captures" (this ticket's own dispatch,
 *  s4) is true of THIS function's actual output, not merely compatible with a future wiring. */
export function detectOptionContaminationForMachineQuery(
  text: string,
  options: Record<string, string> | null,
): string[] {
  if (!options) return [];
  const hits: string[] = [];
  for (const letterKey of Object.keys(options)) {
    const optText = options[letterKey].trim();
    if (optText && text.includes(optText)) hits.push(`${letterKey}) ${optText}`);
  }
  return hits;
}

export interface RunMachineDrivenNexusQueryOptions {
  mcOptions?: string[];
  /** D-BP152-033. Per-authority thread fields for THIS call, computed by the caller via
   *  createNexusRunThreadContext().forQuery(authority) (D-BP152-031, reused unchanged). Passed in
   *  as the two plain fields rather than a NexusRunThreadContext instance, so this function has no
   *  dependency on that factory's shape beyond what BrowserAuthorityQuery already carries. THE
   *  NEVER-SHARE-ACROSS-AUTHORITIES GUARANTEE lives in that factory (an internal Map keyed by
   *  authority, D-BP152-031) -- this function only ever forwards what it is given for THIS
   *  authority; see runMachineDrivenNexusQueryFromMain (index.ts) for the one call site that
   *  actually derives these fields, always freshly, per authority, per call. */
  threadFields?: { threadId: string | undefined; continueThread: boolean };
  /** D-BP152-033. The ONLY way this function reaches an interactive (composer-driven) authority
   *  (user_claude/user_chatgpt/user_gemini). Injected rather than imported directly so this file
   *  never imports index.ts (index.ts already imports THIS file -- a direct import back would be
   *  circular). index.ts supplies its own runBrowserAuthorityQueryFromMainObserved (UNCHANGED,
   *  D-BP152-030R/031's existing full pipeline: thread-aware, sign-in-probe-skipping on a
   *  continuation, and ALREADY text-stability-poll-based internally -- see webview_preload.ts's
   *  CLAUDE_INTERACTIVE_STABLE_TICKS_REQUIRED / isClaudeStillStreaming, read, not rebuilt, this
   *  pass) as this argument. Tests inject a fake. Absent -> a conversational-authority call fails
   *  honestly with reason 'no_interactive_driver_injected', never a fabricated result. */
  runInteractiveQuery?: (query: BrowserAuthorityQuery) => Promise<{ raw: BrowserAuthorityRawExtraction | null; dispatchOutcome: string }>;
}

export interface MachineDrivenNexusQueryResult {
  ok: boolean;
  authority: BrowserAuthorityName;
  question: string;
  url: string;
  text: string;
  citations: NexusAuthorityCaptureCitation[];
  outcome: 'settled' | 'ceiling' | 'refused' | 'failed';
  reason?: string;
  threadStatus: 'new' | 'continued' | null;
  threadPosition: number | null;
  optionContamination: string[];
  machineDriven: true;
}

/**
 * D-BP152-033. THE machine-driven query capability -- "let the Liana Cycle ask a question on a
 * Nexus surface, wait for the answer to finish, and extract it" (dispatch, verbatim), the machine
 * doing what the operator did by hand for Gemini. Standalone and directly callable; NOT wired
 * into stepped_audible.ts/Step 0/any method's verdict logic (see this section's own header).
 *
 * `optionsRecord` mirrors stepped_audible.ts's own `options: Record<string, string> | null`
 * shape exactly, so a caller holding the same Step 0 options pool an operator capture would see
 * can pass it straight through for contamination flagging (detectOptionContaminationForMachineQuery
 * above) with no adaptation.
 *
 * REUSE, not rebuild, at every step: extraction/provenance/citations for the static authorities
 * come from captureNexusAuthorityVisibleText() (D-BP152-025, called via the default `captureFn`
 * inside runMachineDrivenStaticNexusQuery); threading comes from createNexusRunThreadContext()/
 * decideNexusThreadContinuation() (D-BP152-030R/031, via the caller-supplied threadFields and the
 * injected runInteractiveQuery); the interactive authorities' own type/submit/completion/scrape
 * sequence is runBrowserAuthorityQueryFromMainObserved() (index.ts, injected, unmodified).
 *
 * The returned shape ({ text, citations, url }) is deliberately compatible with
 * elements/answer_key_exclusion_reask.ts's CapturedAnswer contract (originalQuery/answerText/
 * sourcePassage/citations) -- a future caller holding a machine-driven result can run that
 * differential test against it exactly as against an operator capture, with no adaptation layer.
 * This function does not invoke it itself (that capability is Google-transport-specific and
 * already deliberately standalone/unwired per D-BP152-032's own build).
 */
export async function runMachineDrivenNexusQuery(
  authority: BrowserAuthorityName,
  question: string,
  optionsRecord: Record<string, string> | null,
  opts: RunMachineDrivenNexusQueryOptions = {},
): Promise<MachineDrivenNexusQueryResult> {
  const empty = { url: '', text: '', citations: [] as NexusAuthorityCaptureCitation[] };

  const engagement = probeNexusAuthorityOperatorEngagement();
  if (engagement.engaged) {
    console.log(`PARSER INSTRUMENT [nexus-machine-query, MACHINE-DRIVEN, D-BP152-033] authority=${authority} REFUSED reason=${engagement.reason}`);
    return {
      ok: false, authority, question, ...empty, outcome: 'refused', reason: engagement.reason,
      threadStatus: null, threadPosition: null, optionContamination: [], machineDriven: true,
    };
  }

  if (!isInteractiveBrowserAuthority(authority)) {
    const r = await runMachineDrivenStaticNexusQuery(authority as 'user_google' | 'user_perplexity', question, opts.mcOptions);
    const optionContamination = detectOptionContaminationForMachineQuery(r.text, optionsRecord);
    console.log(
      `PARSER INSTRUMENT [nexus-machine-query, MACHINE-DRIVEN, D-BP152-033] authority=${authority} outcome=${r.outcome} ` +
      `pollTicks=${r.pollTicks} waitedMs=${r.waitedMs} url="${r.url}" contamination=${optionContamination.length}`,
    );
    return {
      ok: r.ok, authority, question, url: r.url, text: r.text, citations: r.citations,
      outcome: r.outcome, reason: r.reason, threadStatus: null, threadPosition: null,
      optionContamination, machineDriven: true,
    };
  }

  if (!opts.runInteractiveQuery) {
    console.log(`PARSER INSTRUMENT [nexus-machine-query, MACHINE-DRIVEN, D-BP152-033] authority=${authority} FAILED reason=no_interactive_driver_injected`);
    return {
      ok: false, authority, question, ...empty, outcome: 'failed', reason: 'no_interactive_driver_injected',
      threadStatus: null, threadPosition: null, optionContamination: [], machineDriven: true,
    };
  }

  const threadFields = opts.threadFields ?? { threadId: undefined, continueThread: false };
  const query: BrowserAuthorityQuery = {
    question,
    authority,
    threadId: threadFields.threadId,
    continueThread: threadFields.continueThread,
    ...(opts.mcOptions && opts.mcOptions.length ? { mcOptions: opts.mcOptions } : {}),
  };
  const observation = await opts.runInteractiveQuery(query);
  const raw = observation.raw;
  if (!raw || !raw.snippet) {
    console.log(`PARSER INSTRUMENT [nexus-machine-query, MACHINE-DRIVEN, D-BP152-033] authority=${authority} FAILED dispatchOutcome=${observation.dispatchOutcome}`);
    return {
      ok: false, authority, question, ...empty,
      outcome: observation.dispatchOutcome === 'timeout' ? 'ceiling' : 'failed',
      reason: observation.dispatchOutcome, threadStatus: null, threadPosition: null,
      optionContamination: [], machineDriven: true,
    };
  }

  const citations: NexusAuthorityCaptureCitation[] = (raw.citations ?? []).map((c) => ({
    href: c.url, text: c.label, domain: normalizeCitationDomain(c.url),
  }));
  const optionContamination = detectOptionContaminationForMachineQuery(raw.snippet, optionsRecord);
  console.log(
    `PARSER INSTRUMENT [nexus-machine-query, MACHINE-DRIVEN, D-BP152-033] authority=${authority} outcome=settled ` +
    `threadStatus=${raw.threadStatus ?? 'new'} threadPosition=${raw.threadPosition ?? 'n/a'} url="${raw.sourceUrl}" contamination=${optionContamination.length}`,
  );
  return {
    ok: true, authority, question, url: raw.sourceUrl ?? '', text: raw.snippet, citations,
    outcome: 'settled', threadStatus: raw.threadStatus ?? 'new', threadPosition: raw.threadPosition ?? null,
    optionContamination, machineDriven: true,
  };
}
