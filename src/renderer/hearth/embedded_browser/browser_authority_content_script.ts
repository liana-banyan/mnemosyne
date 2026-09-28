// browser_authority_content_script.ts -- BP137 Yoke v2b Stage C ("Chrome-MCP Nexus Authority")
//
// WHY THIS FILE EXISTS: mirrors substrate_injection_content_script.ts's existing convention
// exactly (same directory, same "types only, real runtime lives in webview_preload.ts" split)
// -- this repo's established pattern for the webview-preload boundary is that the renderer-side
// sibling file holds TYPES used by EmbeddedChrome.tsx to type its own state, while the actual
// DOM-querying/scraping code is a separate, duplicated implementation directly inside
// src/main/hearth/embedded_browser/webview_preload.ts (that file's own header explains why:
// "no cross-context import" between the main-process-compiled preload bundle and the renderer
// bundle). This file follows that same split rather than inventing a new one.
//
// Purpose of the round trip these types describe: ask a lookup-fact question inside the user's
// own already-logged-in Google or Perplexity session (the live <webview> EmbeddedChrome.tsx
// already embeds), then read the rendered answer back out and distill it to a fact + source
// URL -- never store or forward the vendor's full prose (ToS-safety, "components not answers").
// See src/shared/plow/browser_authority_types.ts for the shared vocabulary this pairs with, and
// src/main/plow/browser_authority_adapter.ts for the main-process-facing entry point + the
// honest accounting of what is/isn't wired across the process boundary this pass.

import type { BrowserAuthorityName } from '../../../shared/plow/browser_authority_types';

// ─── Request (host page -> webview preload, via webviewRef.current.send) ────────────────────

/** Payload sent on the 'browser-authority-run-query' channel, mirroring the shape already used
 *  by 'substrate-context-update' in EmbeddedChrome.tsx/webview_preload.ts. Sent AFTER the
 *  webview has finished navigating to the search-results page for `query` (EmbeddedChrome.tsx
 *  is responsible for the navigation itself via `loadURL` -- this message only asks the
 *  now-loaded page's preload script to scrape it). */
export interface BrowserAuthorityRunQueryRequest {
  query: string;
  authority: BrowserAuthorityName;
}

// ─── Response (webview preload -> host page, via ipcRenderer.sendToHost) ────────────────────

/** Payload received on the 'browser-authority-extraction-result' channel, mirroring the shape
 *  already used by 'substrate-injection-result'. `success: false` (with `snippet: ''`,
 *  `sourceUrl: null`) is the HONEST failure case -- webview_preload.ts's scraper must never
 *  invent a snippet or URL when its selectors find nothing on the page. */
export interface BrowserAuthorityExtractionResultMessage {
  success: boolean;
  authority: BrowserAuthorityName;
  /** Best-effort scraped answer text (unstripped of whitespace only; markup already removed by
   *  the scraper). Empty string when success is false. */
  snippet: string;
  /** window.location.href at scrape time, or null when success is false. Never a placeholder. */
  sourceUrl: string | null;
  /** Which DOM heuristic (see webview_preload.ts's BROWSER_AUTHORITY_SELECTORS) matched, or
   *  null when none did. Audit/debug field only. */
  selectorUsed: string | null;
}

// ─── Renderer-side UI state (used by EmbeddedChrome.tsx, mirrors InjectionState) ─────────────

export interface BrowserAuthorityRuntimeState {
  /** True while a runBrowserAuthorityQuery() call is in flight (navigating + waiting for the
   *  extraction reply) -- lets EmbeddedChrome.tsx show a lightweight busy indicator. */
  pending: boolean;
  last_result: BrowserAuthorityExtractionResultMessage | null;
}

export const DEFAULT_BROWSER_AUTHORITY_RUNTIME_STATE: BrowserAuthorityRuntimeState = {
  pending: false,
  last_result: null,
};

// ─── Timing constants shared by the request side (EmbeddedChrome.tsx) and documented for the
//     reply side (webview_preload.ts, duplicated there per this directory's no-cross-import
//     convention -- see that file's own copy of this constant). ──────────────────────────────

/** How long EmbeddedChrome.tsx waits, after did-finish-load, before sending the scrape request
 *  -- long enough for a typical Google/Perplexity results page's JS-rendered answer box to
 *  paint, matching the existing 500ms "wait for page JS to settle" delay already used by the
 *  substrate-context re-push logic in EmbeddedChrome.tsx's did-finish-load handler. */
export const BROWSER_AUTHORITY_SETTLE_DELAY_MS = 900;

/** Hard ceiling on how long runBrowserAuthorityQuery() waits for an extraction reply before
 *  resolving with a null result (never hangs forever, never fakes a late success).
 *
 *  D-BP223-BM0-X014-010-TRUNCFIX, RAISED 15000 -> 30000. webview_preload.ts's
 *  'browser-authority-run-query' handler -- the reply side of THIS request -- no longer scrapes
 *  once and answers; it polls the answer element to stability (pollUrlQueryAnswerUntilStable),
 *  because the single fixed scrape was measured live returning 306 characters of a reply that
 *  settled at 935. This ceiling had to move with it or this UI path would have started timing
 *  out on exactly the answers the fix exists to deliver whole. Arithmetic, same pattern as
 *  index.ts's BROWSER_AUTHORITY_MAIN_TIMEOUT_MS:
 *    6.0 s navigation + did-finish-load (measured live this ticket) + 0.9 s
 *    BROWSER_AUTHORITY_SETTLE_DELAY_MS above + 20.0 s URL_QUERY_SETTLE_MAX_WAIT_MS
 *    = 26.9 s worst case, ~3 s of margin under this cap. */
export const BROWSER_AUTHORITY_TIMEOUT_MS = 30000;
