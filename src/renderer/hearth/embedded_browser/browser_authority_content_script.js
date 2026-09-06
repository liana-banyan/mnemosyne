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
export const DEFAULT_BROWSER_AUTHORITY_RUNTIME_STATE = {
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
 *  resolving with a null result (never hangs forever, never fakes a late success). */
export const BROWSER_AUTHORITY_TIMEOUT_MS = 15000;
