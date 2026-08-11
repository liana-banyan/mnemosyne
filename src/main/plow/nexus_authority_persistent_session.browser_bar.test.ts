// nexus_authority_persistent_session.browser_bar.test.ts -- D-BP152-028/BISHOP/
// seg-nexus-browser-bar
//
// Founder, BP152, verbatim: "it would be most useful, I think, if we put in the browser Bar and
// bookmarks ... just run the Google Chrome Browser, but still keep the 5 tabs we have at the
// top ... as linked to the Ask page." And the live failure this closes: "I can't get to the
// address area. it doesn't display, only the search text input ... it's listed at the top, but
// not editable." This ticket adds an editable address bar, back/forward/reload/stop history
// controls, and persisted bookmarks to the SAME window D-BP152-025/027 already built, and makes
// the 5 surface buttons data-driven instead of five hardcoded blocks -- see
// nexus_authority_persistent_session.ts's own D-BP152-028 section headers for the full mechanism.
//
// THIS TICKET'S SIX VERIFY ASSERTIONS:
//   (a) a typed URL navigates and a typed non-URL becomes a Google search
//   (b) the address bar reflects the current URL after navigation
//   (c) back/forward/reload call the webview's own methods and disable when unavailable
//   (d) bookmarks add/list/navigate/remove and survive a restart (persistence read back from disk)
//   (e) the 5 surface buttons, Capture, and Done behave exactly as at d09d8e50
//   (f) the partition and preload are unchanged
//
// (a) is a REAL unit test against resolveNexusAddressBarInput() -- a pure, exported function
// whose OWN .toString() is embedded verbatim into the embedder page's inline script (see that
// function's own header comment), so this test exercises the exact code that runs in the
// browser window, not a hand-duplicated copy.
// (b)/(c)/(e, surface-button wiring)/(d, "navigate" half) are DOM event wiring that lives inside
// an inline <script> string, executed only inside a live Electron BrowserWindow's own page --
// this repo has no jsdom/happy-dom dependency (checked: neither is in package.json) and adding
// one would be exactly the scope-widening D-BP152-028's own FORBIDDEN list rules out ("do not
// widen a gate"). These are verified instead as BOUNDED SOURCE-TEXT assertions against the
// decoded embedder HTML/script -- same convention nexus_authority_persistent_session.
// open_from_pause.test.ts's own (a)/(b) already established for renderer wiring it could not
// execute either. True end-to-end behavior is UNVERIFIED, see this ticket's own deliverable for
// the exact post-restart check.
// (d)'s add/list/remove halves are REAL tests against nexus_authority_bookmarks_store.ts, in that
// file's own nexus_authority_bookmarks_store.test.ts (real disk I/O, not source-text).
// (f) is a REAL test against a fake BrowserWindow's captured constructor options, same pattern
// nexus_authority_persistent_session.open_from_pause.test.ts's (c)/(d) tests already use.

import { describe, test, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { vi } from 'vitest';

let userDataDir = '';

vi.mock('electron', () => {
  class FakeWebContents {
    async executeJavaScript(_script: string) { return null; }
  }
  class FakeBrowserWindow {
    static instances: FakeBrowserWindow[] = [];
    opts: unknown;
    destroyedFlag = false;
    webContents = new FakeWebContents();
    loadedUrl = '';
    constructor(opts: unknown) {
      this.opts = opts;
      FakeBrowserWindow.instances.push(this);
    }
    loadURL(url: string) { this.loadedUrl = url; }
    on(_evt: string, _cb: (...args: unknown[]) => void) { /* no-op */ }
    isDestroyed() { return this.destroyedFlag; }
    show() { /* no-op */ }
    focus() { /* no-op */ }
    hide() { /* no-op */ }
  }
  return {
    app: { getPath: () => userDataDir },
    BrowserWindow: FakeBrowserWindow,
  };
});

import { BrowserWindow } from 'electron';
type FakeBrowserWindowStatics = {
  instances: Array<{
    opts: {
      webPreferences?: { preload?: string; contextIsolation?: boolean; nodeIntegration?: boolean; webviewTag?: boolean; webSecurity?: boolean };
    };
    loadedUrl: string;
  }>;
};

/** Decodes buildEmbedderHtml()'s data: URL back into the raw HTML/script text so a test can
 *  make bounded source-text assertions against it. */
function decodeEmbedderHtml(dataUrl: string): string {
  const prefix = 'data:text/html;charset=utf-8,';
  expect(dataUrl.startsWith(prefix), 'buildEmbedderHtml() still returns a data: URL, unchanged encoding scheme').toBe(true);
  return decodeURIComponent(dataUrl.slice(prefix.length));
}

describe('D-BP152-028 -- (a) resolveNexusAddressBarInput: real unit tests, no DOM needed', () => {
  test('a typed URL with an explicit scheme navigates verbatim', async () => {
    const mod = await import('./nexus_authority_persistent_session');
    expect(mod.resolveNexusAddressBarInput('https://example.com/path?q=1')).toEqual({ blocked: false, url: 'https://example.com/path?q=1' });
    expect(mod.resolveNexusAddressBarInput('http://example.com')).toEqual({ blocked: false, url: 'http://example.com' });
  });

  test('a bare term that is not a URL becomes a Google search (dispatch item 1, verbatim)', async () => {
    const mod = await import('./nexus_authority_persistent_session');
    const res = mod.resolveNexusAddressBarInput('best coffee near me');
    expect(res.blocked).toBe(false);
    expect(res.url).toBe('https://www.google.com/search?q=' + encodeURIComponent('best coffee near me'));
  });

  test('text that looks like a bare host gets an https:// prefix, not a search', async () => {
    const mod = await import('./nexus_authority_persistent_session');
    expect(mod.resolveNexusAddressBarInput('example.com')).toEqual({ blocked: false, url: 'https://example.com' });
    expect(mod.resolveNexusAddressBarInput('en.wikipedia.org/wiki/Cat')).toEqual({ blocked: false, url: 'https://en.wikipedia.org/wiki/Cat' });
    expect(mod.resolveNexusAddressBarInput('localhost:3000')).toEqual({ blocked: false, url: 'https://localhost:3000' });
  });

  test('an empty/whitespace-only address bar is a no-op (never navigates, never searches)', async () => {
    const mod = await import('./nexus_authority_persistent_session');
    expect(mod.resolveNexusAddressBarInput('')).toEqual({ blocked: false });
    expect(mod.resolveNexusAddressBarInput('   ')).toEqual({ blocked: false });
  });

  test('SECURITY: file:// is refused (default-refuse decision, D-BP152-028 SECURITY section)', async () => {
    const mod = await import('./nexus_authority_persistent_session');
    const res = mod.resolveNexusAddressBarInput('file:///C:/Users/Administrator/secrets.txt');
    expect(res.blocked).toBe(true);
    expect(res.reason).toBe('blocked-scheme');
    expect(res.url).toBeUndefined();
  });

  test('SECURITY: about:, javascript:, data:, chrome:, view-source: are all refused', async () => {
    const mod = await import('./nexus_authority_persistent_session');
    for (const scheme of ['about:blank', 'about:settings', 'javascript:alert(1)', 'data:text/html,<h1>x</h1>', 'chrome://settings', 'view-source:https://example.com']) {
      const res = mod.resolveNexusAddressBarInput(scheme);
      expect(res.blocked, `${scheme} must be blocked`).toBe(true);
      expect(res.reason).toBe('blocked-scheme');
    }
  });

  test('a search TERM that merely contains the word "data" or "about" is NOT blocked -- only a leading scheme prefix is', async () => {
    const mod = await import('./nexus_authority_persistent_session');
    const res = mod.resolveNexusAddressBarInput('tell me about data science');
    expect(res.blocked).toBe(false);
    expect(res.url).toContain('google.com/search');
  });
});

describe('D-BP152-028 -- (e) NEXUS_SURFACES: the 5 surfaces are DATA, byte-identical to d09d8e50', () => {
  test('exactly 5 surfaces, in order, with the exact ids/urls already shipped', async () => {
    const mod = await import('./nexus_authority_persistent_session');
    expect(mod.NEXUS_SURFACES.map((s) => s.id)).toEqual(['google', 'perplexity', 'claude', 'chatgpt', 'gemini']);
    expect(mod.NEXUS_SURFACES.map((s) => s.url)).toEqual([
      'https://www.google.com',
      'https://www.perplexity.ai/',
      'https://claude.ai/new',
      'https://chatgpt.com/auth/login',
      'https://accounts.google.com/ServiceLogin?continue=https%3A%2F%2Fgemini.google.com%2Fapp',
    ]);
  });
});

describe('D-BP152-028 -- embedder HTML source-text assertions ((b), (c), (d)-navigate-half, (e)-wiring-half)', () => {
  let html = '';

  beforeEach(async () => {
    userDataDir = mkdtempSync(join(tmpdir(), 'nexus-browser-bar-test-'));
    vi.resetModules();
    const mod = await import('./nexus_authority_persistent_session');
    html = decodeEmbedderHtml(mod.buildEmbedderHtml());
  });

  test('an editable address bar exists (not the old read-only #status span)', () => {
    expect(html).toMatch(/<input id="addressbar"/);
    expect(html).not.toMatch(/id="status"/);
  });

  test('the 5 surface buttons are rendered from NEXUS_SURFACES data, not five hardcoded <button> blocks', async () => {
    const mod = await import('./nexus_authority_persistent_session');
    // The static markup no longer contains a literal hardcoded button per surface...
    expect(html).not.toMatch(/<button id="btn-google"/);
    expect(html).not.toMatch(/<button id="btn-perplexity"/);
    // ...instead the exact same array this test's own (e) suite already verified is JSON-embedded
    // and rendered by a loop -- single source of truth, no drift between the array and the page.
    const embeddedMatch = html.match(/var NEXUS_SURFACES = (\[[\s\S]*?\]);/);
    expect(embeddedMatch, 'NEXUS_SURFACES JSON is embedded in the script').not.toBeNull();
    const embedded = JSON.parse(embeddedMatch![1]);
    expect(embedded).toEqual(mod.NEXUS_SURFACES);
    expect(html).toContain('NEXUS_SURFACES.forEach(function (surface)');
    expect(html).toContain('wv.loadURL(surface.url)');
    expect(html).toContain('currentNexusAuthority = surface.id');
  });

  test('resolveNexusAddressBarInput\'s own compiled body is embedded verbatim (no hand-duplicated copy)', () => {
    expect(html).toContain('function resolveNexusAddressBarInput(raw)');
    expect(html).toContain('blockedSchemeRe');
    expect(html).toContain('navigateFromAddressBar');
    expect(html).toContain("addressbar.addEventListener('keydown'");
  });

  test('(b) the address bar is kept in sync with the webview\'s current URL on did-navigate / did-navigate-in-page, without clobbering active typing', () => {
    expect(html).toContain("wv.addEventListener('did-navigate', onNavigate)");
    expect(html).toContain("wv.addEventListener('did-navigate-in-page', onNavigate)");
    expect(html).toContain('function updateAddressBarFromUrl(url)');
    expect(html).toContain('if (document.activeElement !== addressbar)');
    expect(html).toContain("addressbar.value = url || ''");
  });

  test('(c) back/forward/reload/stop call the webview\'s own history methods', () => {
    expect(html).toContain('wv.goBack()');
    expect(html).toContain('wv.goForward()');
    expect(html).toContain('wv.reload()');
    expect(html).toContain('wv.stop()');
  });

  test('(c) back/forward are disabled based on the webview\'s own canGoBack()/canGoForward(), not left to no-op silently', () => {
    expect(html).toContain('function updateNavButtons()');
    expect(html).toContain('btnBack.disabled = !(wv.canGoBack && wv.canGoBack())');
    expect(html).toContain('btnForward.disabled = !(wv.canGoForward && wv.canGoForward())');
    // Initial markup state: back/forward/stop start disabled (no page loaded yet, src="about:blank").
    expect(html).toMatch(/<button id="btn-back" title="Back" disabled>/);
    expect(html).toMatch(/<button id="btn-forward" title="Forward" disabled>/);
    expect(html).toMatch(/<button id="btn-stop" title="Stop" disabled>/);
    expect(html).not.toMatch(/<button id="btn-reload" title="Reload" disabled>/);
  });

  test('(d) bookmarks: add/list/remove go through window.amplify, and a bookmark click navigates the webview (the "navigate" half of (d))', () => {
    expect(html).toContain('window.amplify.nexusAuthorityBookmarksList');
    expect(html).toContain('window.amplify.nexusAuthorityBookmarksAdd');
    expect(html).toContain('window.amplify.nexusAuthorityBookmarksRemove');
    expect(html).toContain("link.addEventListener('click', function () { wv.loadURL(bm.url); })");
    expect(html).toMatch(/<div id="bookmarksbar">/);
    expect(html).toMatch(/<button id="btn-bookmark-add"/);
  });

  test('(e) Capture -> Liana Cycle and Done -- hide are present, unchanged wiring (window.amplify.nexusAuthorityCapture / hideNexusAuthoritySession)', () => {
    expect(html).toContain('Capture -&gt; Liana Cycle');
    expect(html).toContain('Done -- hide');
    expect(html).toContain('window.amplify.nexusAuthorityCapture');
    expect(html).toContain('window.amplify.hideNexusAuthoritySession');
    expect(html).toMatch(/<button id="btn-capture"/);
    expect(html).toMatch(/<button id="btn-done"/);
  });

  test('(f) the webview element still carries the SAME persisted partition and the SAME preload path', async () => {
    const mod = await import('./nexus_authority_persistent_session');
    expect(mod.NEXUS_AUTHORITY_PARTITION).toBe('persist:nexus-authority');
    expect(html).toContain(`partition="${mod.NEXUS_AUTHORITY_PARTITION}"`);
    expect(html).toMatch(/preload="[^"]*webview_preload\.js"/);
    expect(html).toContain('id="nexus-authority-webview"');
  });
});

describe('D-BP152-028 -- (f) ensureNexusAuthoritySession(): webPreferences unchanged (no nodeIntegration, contextIsolation stays true)', () => {
  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'nexus-browser-bar-webprefs-test-'));
    (BrowserWindow as unknown as FakeBrowserWindowStatics).instances.length = 0;
    vi.resetModules();
  });

  test('nodeIntegration stays false, contextIsolation stays true, no webSecurity override -- the sandbox was not weakened to make navigation work', async () => {
    const mod = await import('./nexus_authority_persistent_session');
    mod.setNexusAuthorityBrowserFlags(true, true);
    mod.ensureNexusAuthoritySession();

    const instances = (BrowserWindow as unknown as FakeBrowserWindowStatics).instances;
    expect(instances).toHaveLength(1);
    const prefs = instances[0].opts.webPreferences;
    expect(prefs?.nodeIntegration).toBe(false);
    expect(prefs?.contextIsolation).toBe(true);
    expect(prefs?.webviewTag).toBe(true);
    // webSecurity was never set before this ticket and is not set now -- Electron's own default
    // (true / on) applies, unweakened. Asserting the key is simply absent from this object proves
    // this ticket did not add an override either way.
    expect(prefs && 'webSecurity' in prefs).toBe(false);
    expect(prefs?.preload).toMatch(/preload\.js$/);
    expect(prefs?.preload).not.toMatch(/webview_preload/);
  });
});
