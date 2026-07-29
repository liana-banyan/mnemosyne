// browser_authority_adapter.ts -- BP137 Yoke v2b Stage C ("Chrome-MCP Nexus Authority"), item 1.
//
// WHY THIS FILE EXISTS (Bishop audit): chrome-mcp-google/perplexity is ABSENT from this repo.
// `ai-providers/perplexity-client.ts` is a PAID metered API and must NOT be used here -- this
// module never imports it, never calls api.perplexity.ai, and never reads
// PERPLEXITY_API_KEY/ANTHROPIC_API_KEY/any metered credential. Every code path below routes
// through the user's OWN already-logged-in Google/Perplexity browser session (their quota,
// $0), per the Bishop prompt's explicit "components not answers" / ToS-safety design.
//
// Most of this module's real logic (types, flag gate, query-URL builder, fact distillation)
// lives in ../../shared/plow/browser_authority_types.ts, NOT here -- see that file's header for
// why: this repo's tsconfig split (tsconfig.main.json vs tsconfig.renderer.json) means a file
// under src/main/plow/ is invisible to the renderer TypeScript project, but src/shared/** is
// visible to BOTH (the same convention src/shared/membership_types.ts already uses). This file
// is the thin main-process-facing surface: it re-exports the shared vocabulary under this
// module's canonical location (the path the BP137 Stage C task prompt named explicitly), and it
// adds the one piece that is genuinely main-process-only -- the `BrowserAuthorityBridge`
// wiring seam and an HONEST accounting of why no live implementation of that seam ships this
// pass.
//
// ── THE GENUINE GAP, REPORTED HONESTLY (never fake a result) ──────────────────────────────────
//
// The real, working, DOM-scraping extraction round trip (navigate the embedded webview to a
// Google/Perplexity search results page, wait for load, ask the page-side preload script to
// scrape an answer, read the scraped fact back) is fully built and wired this pass, but it
// lives entirely on the RENDERER side of the process boundary:
//   - src/renderer/hearth/embedded_browser/EmbeddedChrome.tsx (additive `runBrowserAuthorityQuery`
//     method, new in this Yoke) drives the actual live <webview> element.
//   - src/main/hearth/embedded_browser/webview_preload.ts (additive `browser-authority-run-query`
//     handler, new in this Yoke) runs inside the webview's own guest page context and does the
//     real DOM scraping via document.querySelector against Google/Perplexity's rendered page.
//
// What is genuinely ABSENT is the leg connecting a MAIN-PROCESS caller (e.g. a future
// plow_mc_answerer.ts Stage-4 lookup_fact branch) to that renderer-side capability. Electron's
// contextIsolation means the renderer can only invoke main-process channels that preload.ts has
// explicitly exposed via contextBridge.exposeInMainWorld('amplify', {...}) -- confirmed by
// direct read of src/main/preload.ts, which hand-registers roughly 60 distinct
// `ipcRenderer.on('<channel>', ...)` subscription wrappers (e.g. line 1808's
// 'show-restart-prompt') with NO generic pass-through channel. Wiring a new
// 'nexus-browser-authority-run-query' round trip therefore requires:
//   (1) src/main/preload.ts -- one new contextBridge-exposed method, following the exact
//       pattern of its ~60 existing siblings (a `window.amplify.runBrowserAuthorityQuery(...)`
//       -shaped call that wraps `ipcRenderer.invoke(...)` or a send/on pair).
//   (2) src/main/index.ts -- inside `openHearthConjunctionWindow()` (module-level
//       `hearthConjunctionWindow` reference, function starts at line 1378, `new BrowserWindow`
//       at line 1390, `webviewTag: true` at line 1404) -- an `ipcMain.handle(...)` registration
//       that forwards the request to that window's renderer (which owns the live
//       `EmbeddedChrome` instance and its `runBrowserAuthorityQuery` method) and relays the
//       reply back to the calling main-process code.
// Both files are on this Stage C task's explicit collision-risk list (a concurrent tab has
// real, uncommitted edits in both per `git status` at investigation time) and were deliberately
// left byte-for-byte untouched this pass, per the Founder's explicit constraint for this Yoke.
// This is the ABSENT/deferred mount point -- exactly the same category of deferral the Bishop
// prompt already sanctioned for item 4 (wiring the classifier's lookup_fact branch), just one
// process-boundary hop earlier. `createNotWiredBridge()` below is the honest placeholder for
// this gap: it never claims success, it always resolves to `null` with a labeled reason.

import {
  distillExtraction,
  isBrowserAuthorityEnabled,
  type BrowserAuthorityAdapterConfig,
  type BrowserAuthorityLookupResult,
  type BrowserAuthorityName,
  type BrowserAuthorityQuery,
  type BrowserAuthorityRawExtraction,
} from '../../shared/plow/browser_authority_types';

export type {
  BrowserAuthorityAdapterConfig,
  BrowserAuthorityLookupResult,
  BrowserAuthorityName,
  BrowserAuthorityQuery,
  BrowserAuthorityRawExtraction,
} from '../../shared/plow/browser_authority_types';
export { buildBrowserAuthorityQueryUrl, distillExtraction, isBrowserAuthorityEnabled } from '../../shared/plow/browser_authority_types';

// ─── The wiring seam a real caller must supply ───────────────────────────────────────────────

/**
 * What a main-process caller needs in order to actually reach the user's browser: something
 * that can run a query in the live EmbeddedChrome webview and hand back the raw scraped
 * payload. The REAL implementation of this interface is renderer-side (see EmbeddedChrome.tsx's
 * `runBrowserAuthorityQuery`) and reaching it from main requires the IPC wiring described in
 * this file's header (genuinely absent this pass). This interface exists so that:
 *   (a) runBrowserAuthorityLookup() below is fully testable/callable today with any bridge
 *       implementation (including a real one, once wired), and
 *   (b) the eventual Stage-4 wiring has an exact, pre-agreed shape to implement against instead
 *       of inventing one under time pressure.
 */
export interface BrowserAuthorityBridge {
  runQueryInUserBrowser(query: BrowserAuthorityQuery): Promise<BrowserAuthorityRawExtraction | null>;
}

/**
 * Honest placeholder bridge. Calling this is indistinguishable, from the caller's point of
 * view, from "the browser bridge returned no usable answer" -- it NEVER returns a fabricated
 * BrowserAuthorityRawExtraction, and it never throws (a thrown error could be mistaken for a
 * network failure rather than "not wired yet"). Use this only as an explicit, self-documenting
 * stand-in until the real IPC wiring described above lands; a future Stage-4 pass should delete
 * this function's call sites, not delete this function's honesty.
 */
export function createNotWiredBridge(): BrowserAuthorityBridge {
  return {
    async runQueryInUserBrowser(_query: BrowserAuthorityQuery): Promise<null> {
      console.warn(
        '[browser_authority_adapter] runQueryInUserBrowser called against createNotWiredBridge() -- ' +
        'the main-process <-> renderer-webview IPC leg described in this file\'s header has not ' +
        'been wired this pass (BP137 Yoke v2b Stage C). Returning null, never a fabricated result.',
      );
      return null;
    },
  };
}

// ─── The flag-gated entry point ──────────────────────────────────────────────────────────────

/**
 * Given a lookup-fact question, attempt to answer it via the user's own logged-in Google or
 * Perplexity session. Early-returns `null` the instant the flag gate fails -- provable by
 * inspection: every subsequent line in this function is unreachable when
 * isBrowserAuthorityEnabled(config) is false, so any existing/future caller that never sets
 * researchArmMode+researchArmBrowserAuthority true sees byte-identical behavior to this
 * module not existing at all (it is simply never invoked, and even if it were, it would no-op).
 *
 * `bridge` is caller-supplied (dependency injection) rather than looked up internally, so this
 * function never itself reaches into `ipcMain`/`BrowserWindow` -- see this file's header for
 * why that lookup cannot be built this pass without touching forbidden/collision-risk files.
 * Pass `createNotWiredBridge()` until the real wiring lands; pass a real implementation once it
 * does, and this function's behavior becomes fully live with no further changes needed here.
 */
export async function runBrowserAuthorityLookup(
  question: string,
  config: BrowserAuthorityAdapterConfig,
  bridge: BrowserAuthorityBridge,
): Promise<BrowserAuthorityLookupResult | null> {
  if (!isBrowserAuthorityEnabled(config)) return null;

  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) return null;

  const authority: BrowserAuthorityName = config.preferredAuthority ?? 'user_google';
  const query: BrowserAuthorityQuery = { question: trimmedQuestion, authority };

  const raw = await bridge.runQueryInUserBrowser(query);
  if (!raw) return null;

  return distillExtraction(raw, trimmedQuestion);
}

// ─── BP138 Yoke 0.9.15 FIX 3: raw fact+source primitive (no MC match required) ────────────────
//
// WHY THIS EXISTS (R-MECHANISM-VERIFY): plow_mc_answerer.ts's Stage F2 (around its "browser-
// authority-first routing" block) and Stage F3 (its "mesh-synergy" block) are the only two
// callers of runBrowserAuthorityLookup() above, and BOTH force the result through
// matchFreeTextAnswerToOption(...) to land on an MC letter -- there was NO path anywhere in
// this repo that returned a distilled fact+sourceUrl as a standalone answer for an OPEN-ENDED
// (non-multiple-choice) question. An open-ended Ask-tab question could therefore never resolve
// via the browser authority even with perfect DOM extraction working, because the only exposed
// contract required an MC option list to match against.
//
// This function is that missing primitive. It is a thin, additive wrapper around
// runBrowserAuthorityLookup() above -- it duplicates none of that function's flag-gating,
// bridge-calling, or distillation logic, it only reshapes the same BrowserAuthorityLookupResult
// into a standalone-fact contract with no MC awareness at all.
//
// FUTURE USE (named with this in mind, per the BP138 Yoke prompt): the BP138 decompose-and-
// eliminate engine will need to ask "is option X true?" as a per-option foundation-fact check --
// a raw fact+source lookup, never an MC-letter vote. This is exactly that primitive's contract,
// available now for FIX 4's Ask-tab wiring (src/main/index.ts's 'nexus-ask-lookup-fact' handler)
// and reusable later by that engine with zero changes needed here.
//
// NOT wired into Stage F2/F3's existing call sites (plow_mc_answerer.ts is left byte-unchanged
// by this Yoke) -- see this Yoke's final report for the explicit reasoning: Stage F2/F3's
// "MC-matching behavior must not change at all" requirement is trivially, provably satisfied by
// never touching those call sites, rather than risking a refactor of already-working code under
// this Yoke's time budget. A future pass MAY have Stage F2/F3 call this function internally
// (to stop duplicating the runBrowserAuthorityLookup call) and layer matchFreeTextAnswerToOption
// on top of its output -- this function's shape already supports that without modification.
export interface RawBrowserAuthorityFact {
  /** The distilled FACT text -- same value as BrowserAuthorityLookupResult.fact, never the
   *  vendor's full prose response (see distillExtraction()'s MAX_FACT_CHARS cap). */
  fact: string;
  /** Genuinely extracted source URL. Never a placeholder -- see runBrowserAuthorityLookup()'s
   *  own honesty-firewall doc; this function returns null (not a fake URL) when that one does. */
  sourceUrl: string;
  authority: BrowserAuthorityName;
  /** Coarse confidence signal derived from BrowserAuthorityLookupResult.verified (a real,
   *  non-empty scraped snippet of substantive length) -- NOT a model-calibrated probability.
   *  0.8 when verified, 0.4 when a fact was returned but didn't clear that bar. Callers that
   *  need a stricter bar should additionally check `verified` semantics via the wrapped
   *  BrowserAuthorityLookupResult (not exposed here to keep this primitive's shape minimal). */
  confidence: number;
}

/**
 * Returns a standalone `{ fact, sourceUrl, authority, confidence }` for ANY question -- multiple
 * choice or open-ended -- without requiring or attempting an MC-option match. Never fabricates:
 * returns null in every case runBrowserAuthorityLookup() does (flag off, empty question, or the
 * underlying browser-authority call itself returned nothing usable).
 */
export async function getRawBrowserAuthorityFact(
  question: string,
  config: BrowserAuthorityAdapterConfig,
  bridge: BrowserAuthorityBridge,
): Promise<RawBrowserAuthorityFact | null> {
  const result = await runBrowserAuthorityLookup(question, config, bridge);
  if (!result) return null;

  return {
    fact: result.fact,
    sourceUrl: result.sourceUrl,
    authority: result.authority,
    confidence: result.verified ? 0.8 : 0.4,
  };
}
