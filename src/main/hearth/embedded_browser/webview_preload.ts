/// <reference lib="dom" />
// B83b — Webview Preload Script
// Runs in the <webview> renderer context (NOT the main renderer, NOT main process)
// Compiled to dist/main/hearth/embedded_browser/webview_preload.js by tsconfig.main.json
// Triple-slash DOM reference above enables DOM types for this browser-context file.
//
// Mechanism (R-MECHANISM-VERIFY):
// 1. Preload registered via <webview preload="..."> attribute
// 2. Listens for 'substrate-context-update' from renderer via ipcRenderer
// 3. On Enter key in Google Search AI input → prepends substrate-context preamble
//
// Patent novelty: auto-injection of cooperative-AI-substrate context into
// third-party AI-backed search interface via embedded-browser content-script bridge

import { ipcRenderer } from 'electron';

// ─── State ────────────────────────────────────────────────────────────────────

let currentContext: string | null = null;
let injectionEnabled = true;
let injectionCount = 0;

// ─── Logging (injection receipts) ─────────────────────────────────────────────
// BP138 Yoke 0.9.15 FIX 1 (CDP-verified root cause, prior session): this webview's guest
// context runs under Electron's default sandbox (sandbox: true, Electron 31 default for a
// <webview> guest page with no webPreferences override disabling it). Node built-ins (fs/path)
// do NOT exist in a sandboxed context -- the former top-level `import { appendFileSync,
// mkdirSync } from 'fs'` + `import { resolve } from 'path'` threw at MODULE LOAD time, before
// ANY listener in this file (including 'browser-authority-run-query' below) ever attached.
// That is the confirmed root cause of every browser-authority call resolving null.
//
// Bishop's explicit, final decision (BP138): the sandbox stays ON. This <webview> holds the
// user's real logged-in Google/Perplexity session while loading untrusted remote third-party
// pages -- un-sandboxing it would hand that remote content elevated privilege on that
// credential surface. `webpreferences="sandbox=no"` must never be added here.
//
// Fix: relay every log line to the main process over `ipcRenderer.send` -- ipcRenderer itself
// IS sandbox-safe (it is a contextBridge-adjacent Electron primitive, not a Node built-in);
// only fs/path/etc are the problem. The actual mkdirSync/appendFileSync now happens in
// index.ts's 'embedded-browser-injection-log' handler (main process, unsandboxed), writing to
// the exact same path this file used to target directly. See that handler's own comment for
// the main-process half of this relay.
function logInjectionEvent(event: string, details: Record<string, unknown>): void {
  try {
    ipcRenderer.send('embedded-browser-injection-log', {
      ts: new Date().toISOString(),
      event,
      ...details,
    });
  } catch {
    /* non-fatal -- logging must never break the real feature (same fail-soft contract the old
       in-webview try/catch already had) */
  }
}

// ─── IPC: Receive substrate context from renderer ────────────────────────────

ipcRenderer.on('substrate-context-update', (_event, payload: { context: string; enabled: boolean }) => {
  currentContext = payload.context;
  injectionEnabled = payload.enabled;
  logInjectionEvent('context_received', { length: payload.context.length, enabled: payload.enabled });
});

ipcRenderer.on('substrate-injection-toggle', (_event, { enabled }: { enabled: boolean }) => {
  injectionEnabled = enabled;
});

// ─── DOM injection machinery ─────────────────────────────────────────────────

// Google Search AI input selectors — maintained in auto_inject_rules.ts (browser-side)
// These are duplicated here for the preload context (no cross-context import)
const SELECTORS = [
  'textarea[aria-label*="Ask"]',
  'textarea[aria-label*="Search"]',
  '[contenteditable="true"][role="textbox"]',
  'textarea[placeholder*="Ask"]',
  'div[contenteditable="true"]',
  'input[type="text"][aria-label*="Ask"]',
];

function findSearchInput(): HTMLElement | null {
  for (const sel of SELECTORS) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) return el;
  }
  return null;
}

function injectContext(input: HTMLElement): boolean {
  if (!currentContext || !injectionEnabled) return false;

  const preamble = currentContext + '\n\n';

  try {
    if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
      const existing = input.value;
      input.value = preamble + existing;
      // Trigger React synthetic event
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value',
      )?.set;
      nativeInputValueSetter?.call(input, preamble + existing);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    } else if (input.isContentEditable) {
      const existing = input.innerText;
      input.innerText = preamble + existing;
      // Move cursor to end
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(input);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

// ─── Intercept Enter key on Google Search AI input ───────────────────────────

function attachEnterInterceptor(): void {
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || e.shiftKey || !currentContext || !injectionEnabled) return;

    const input = findSearchInput();
    if (!input || input !== document.activeElement) return;

    // Only inject if preamble not already present
    const text = input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement
      ? input.value
      : input.innerText;

    if (text.includes('[LB Cooperative-AI Substrate context')) return; // already injected

    const injected = injectContext(input);
    injectionCount++;

    logInjectionEvent(injected ? 'injection_success' : 'injection_failed', {
      url: window.location.href,
      selector_found: !!input,
      injection_count: injectionCount,
    });

    // Notify renderer of injection result
    ipcRenderer.sendToHost('substrate-injection-result', {
      success: injected,
      url: window.location.href,
      injection_count: injectionCount,
    });
  }, true); // capture phase — before React handlers
}

// ─── BP137 Yoke v2b Stage C: browser-authority answer extraction ─────────────
// ADDITIVE ONLY -- everything below this banner is new code reachable ONLY when
// EmbeddedChrome.tsx's new (also-additive) runBrowserAuthorityQuery() method sends the
// 'browser-authority-run-query' channel, which it only does when the caller opted in via
// BP137's researchArmMode + researchArmBrowserAuthority flags (see
// src/shared/plow/browser_authority_types.ts). No existing listener, selector, or behavior
// above this line is modified. When the new channel is never sent (every pre-BP137 caller,
// and every BP137 caller with the flags off), this block never executes.
//
// WHY duplicated selectors instead of importing from browser_authority_content_script.ts:
// following this file's own pre-existing convention at line 60-61 above ("duplicated here for
// the preload context (no cross-context import)") -- this preload script compiles under
// tsconfig.main.json while that sibling type file compiles under tsconfig.renderer.json; the
// two projects do not share a module graph.
//
// HONESTY FIREWALL: these selectors are best-effort heuristics against Google's and
// Perplexity's rendered-page DOM as of BP137 (2026). Third-party page markup changes without
// notice and is not something this repo controls or can pin -- that is an inherent property of
// any DOM-scraping approach against a page you do not own, called out here explicitly rather
// than glossed over. A selector miss is reported as `success: false` with no fabricated
// snippet/URL, never silently coerced into a fake success.

type BrowserAuthorityName = 'user_google' | 'user_perplexity' | 'user_claude';

interface BrowserAuthorityRunQueryRequest {
  query: string;
  authority: BrowserAuthorityName;
}

interface BrowserAuthorityExtractionResultMessage {
  success: boolean;
  authority: BrowserAuthorityName;
  snippet: string;
  sourceUrl: string | null;
  selectorUsed: string | null;
}

// Best-effort Google featured-snippet / answer-box selectors, most-specific first.
const GOOGLE_ANSWER_SELECTORS = [
  '[data-attrid="wa:/description"]',
  '[data-attrid*="answer"]',
  '.hgKElc',
  '.LGOjhe',
  '.kno-rdesc span',
  '.Z0LcW',
  '.BNeawe.iBp4i.AP7Wnd',
];

// Best-effort Perplexity answer-container selectors, most-specific first.
const PERPLEXITY_ANSWER_SELECTORS = [
  '[data-testid="answer-content"]',
  'main [class*="answer"]',
  'main article',
  'main [class*="prose"]',
];

function firstNonEmptyTextMatch(selectors: string[]): { text: string; selector: string } | null {
  for (const sel of selectors) {
    try {
      const el = document.querySelector<HTMLElement>(sel);
      const text = el?.innerText?.trim();
      if (text && text.length >= 20) return { text, selector: sel };
    } catch {
      /* invalid selector or DOM access error -- try the next candidate */
    }
  }
  return null;
}

function extractBrowserAuthorityAnswer(authority: BrowserAuthorityName): BrowserAuthorityExtractionResultMessage {
  const selectors = authority === 'user_perplexity' ? PERPLEXITY_ANSWER_SELECTORS : GOOGLE_ANSWER_SELECTORS;
  const match = firstNonEmptyTextMatch(selectors);

  if (!match) {
    return { success: false, authority, snippet: '', sourceUrl: null, selectorUsed: null };
  }

  return {
    success: true,
    authority,
    snippet: match.text.replace(/\s+/g, ' ').trim(),
    sourceUrl: window.location.href,
    selectorUsed: match.selector,
  };
}

ipcRenderer.on('browser-authority-run-query', (_event, payload: BrowserAuthorityRunQueryRequest) => {
  logInjectionEvent('browser_authority_run_query_received', {
    authority: payload.authority,
    url: window.location.href,
  });

  const result = extractBrowserAuthorityAnswer(payload.authority);

  logInjectionEvent('browser_authority_extraction_result', {
    success: result.success,
    selector_used: result.selectorUsed,
    url: window.location.href,
  });

  ipcRenderer.sendToHost('browser-authority-extraction-result', result);
});

// ─── (this build pass) claude.ai/new interactive browser authority ──────────────────────────
// ADDITIVE ONLY, same "unreachable unless the new channel is sent" guarantee as the static
// extraction block above. claude.ai/new has NO query-URL form (unlike Google/Perplexity's
// search?q= URLs) -- the caller (index.ts's runBrowserAuthorityQueryFromMain, gated by
// browser_authority_types.ts's isInteractiveBrowserAuthority()) navigates here to a fixed
// 'https://claude.ai/new' landing page and then sends 'browser-authority-run-interactive-query'
// instead of the static 'browser-authority-run-query' above. This handler does the actual
// type -> submit -> wait-for-stream-completion -> scrape sequence entirely inside this guest
// page context.
//
// HONESTY FIREWALL (same bar as the static extraction above): every selector below is a
// best-effort heuristic against claude.ai's rendered DOM as of this build pass -- UNVERIFIED
// against a real logged-in session (no live credentials available to this build). A composer
// miss, a submit miss, or a scrape miss is reported as `success: false` with no fabricated
// snippet/URL; there is no code path in this block that invents a placeholder answer.

interface BrowserAuthorityRunInteractiveQueryRequest {
  query: string;
  authority: BrowserAuthorityName;
}

interface BrowserAuthorityInteractiveResultMessage {
  success: boolean;
  authority: BrowserAuthorityName;
  snippet: string;
  sourceUrl: string | null;
  selectorUsed: string | null;
  // (this fix pass) optional, diagnostics-only -- never load-bearing for success/failure, which is
  // still decided purely by `success`/`snippet`/`sourceUrl` above. Lets index.ts's console-visible
  // fail log (STEP 3) say WHY a null came back (not_signed_in / composer_not_found_timeout / etc.)
  // instead of just "no result".
  reason?: string;
}

// Best-effort composer selectors, most-specific first. claude.ai's composer is a ProseMirror
// contenteditable div; the plain `div[contenteditable="true"]` catch-all is last-resort in case
// the editor library or its class name changes.
const CLAUDE_COMPOSER_SELECTORS = [
  'div[contenteditable="true"].ProseMirror',
  'div[aria-label="Write your prompt to Claude"]',
  'fieldset div[contenteditable="true"]',
  'div[contenteditable="true"][role="textbox"]',
  'div[contenteditable="true"]',
];

// Best-effort send-button selectors, most-specific first. Clicking the real button is preferred
// over simulating an Enter keypress because a composer's onKeyDown handler may special-case
// Enter (e.g. newline-vs-submit logic) in ways a synthetic KeyboardEvent cannot reliably trigger.
const CLAUDE_SEND_BUTTON_SELECTORS = [
  'button[aria-label="Send Message"]',
  'button[aria-label="Send message"]',
  'button[data-testid="send-button"]',
  'fieldset button[type="submit"]',
];

// Presence of ANY of these means the assistant turn is still streaming. Checked every poll tick
// so completion-detection never fires on a page that merely LOOKS finished mid-stream.
const CLAUDE_STOP_BUTTON_SELECTORS = [
  'button[aria-label="Stop Response"]',
  'button[aria-label="Stop response"]',
  'button[data-testid="stop-button"]',
];

// Best-effort assistant-message-container selectors, most-specific first. Unlike Google/
// Perplexity's single-answer-box scrape, claude.ai renders a whole conversation thread -- this
// module always takes the LAST matching element (the most recent assistant turn), never the
// first, via lastNonEmptyTextMatch below.
const CLAUDE_ASSISTANT_MESSAGE_SELECTORS = [
  '[data-testid="conversation-turn"] .font-claude-message',
  '.font-claude-message',
  '[data-testid="conversation-turn"]',
  'main [data-is-streaming]',
];

function lastNonEmptyTextMatch(selectors: string[]): { text: string; selector: string } | null {
  for (const sel of selectors) {
    try {
      const matches = document.querySelectorAll<HTMLElement>(sel);
      if (matches.length === 0) continue;
      const el = matches[matches.length - 1];
      const text = el?.innerText?.trim();
      if (text && text.length >= 1) return { text, selector: sel };
    } catch {
      /* invalid selector or DOM access error -- try the next candidate */
    }
  }
  return null;
}

function findFirstMatch(selectors: string[]): HTMLElement | null {
  for (const sel of selectors) {
    try {
      const el = document.querySelector<HTMLElement>(sel);
      if (el) return el;
    } catch {
      /* invalid selector -- try the next candidate */
    }
  }
  return null;
}

function isClaudeStillStreaming(): boolean {
  return findFirstMatch(CLAUDE_STOP_BUTTON_SELECTORS) !== null;
}

/** Sets `text` into a composer element and dispatches the input events real typing would
 *  produce. Tries document.execCommand('insertText', ...) FIRST for a contentEditable element
 *  (the standard resilient way to feed text into a rich-text editor like ProseMirror -- it fires
 *  the editor's own 'beforeinput'/'input' pipeline, unlike a raw innerText assignment, which many
 *  such editors silently ignore or fail to pick up into their internal document model). Falls
 *  back to the direct-assignment + dispatchEvent('input') technique this file's own pre-existing
 *  injectContext() (line ~89 above) already uses for a plain contentEditable/textarea, for parity
 *  with that already-working convention. Returns false (never throws) on any DOM access failure
 *  -- a false here is reported as success:false upstream, never a fabricated result. */
function setComposerText(el: HTMLElement, text: string): boolean {
  try {
    el.focus();
    if (el.isContentEditable) {
      // Clear any existing content first (a fresh https://claude.ai/new load should already be
      // empty, but this is defensive against a reused/navigated-back composer).
      const selectAllOk = document.execCommand('selectAll', false, undefined);
      if (selectAllOk) document.execCommand('delete', false, undefined);
      const inserted = document.execCommand('insertText', false, text);
      if (!inserted) {
        // execCommand unsupported/failed -- fall back to direct DOM mutation + synthetic input
        // event (same technique injectContext() above already uses for a plain contentEditable).
        el.innerText = text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return true;
    }
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      const nativeValueSetter = Object.getOwnPropertyDescriptor(
        el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
        'value',
      )?.set;
      nativeValueSetter?.call(el, text);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/** Submits the composer: prefers clicking a real send button (most reliable against a React
 *  app's own submit handler); falls back to a synthetic Enter keydown/keypress/keyup on the
 *  composer element (bubbles:true, same dispatch pattern attachEnterInterceptor() above already
 *  uses successfully against Google's search box) when no send button is found or it's disabled.
 *  Returns which method fired, for logging only -- never throws. */
function submitComposer(composerEl: HTMLElement): 'button' | 'enter-key' | 'failed' {
  try {
    const sendButton = findFirstMatch(CLAUDE_SEND_BUTTON_SELECTORS);
    if (sendButton && !(sendButton as HTMLButtonElement).disabled) {
      sendButton.click();
      return 'button';
    }
    const enterInit: KeyboardEventInit = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
    composerEl.dispatchEvent(new KeyboardEvent('keydown', enterInit));
    composerEl.dispatchEvent(new KeyboardEvent('keypress', enterInit));
    composerEl.dispatchEvent(new KeyboardEvent('keyup', enterInit));
    return 'enter-key';
  } catch {
    return 'failed';
  }
}

const CLAUDE_INTERACTIVE_POLL_MS = 700;
// (this fix pass) FAST-FAIL ROOT CAUSE FIX: a live run showed one question taking 123s because
// this reply-stream poll loop burned its FULL prior 75_000ms budget on a page where the composer
// selector's last-resort catch-all (`div[contenteditable="true"]`) matched something OTHER than
// the real composer (e.g. a login-wall page has no real composer, but the catch-all can still
// hit an unrelated contenteditable node), typed/submitted into it, then polled for a reply that
// could never arrive. Cut from 75_000 -> 18_000: paired with the NEW composer-find fast-fail below
// (CLAUDE_COMPOSER_FIND_MAX_WAIT_MS) and index.ts's shortened BROWSER_AUTHORITY_INTERACTIVE_
// TIMEOUT_MS (90_000 -> 25_000), the worst-case total interactive round trip is now ~2s (main's
// load-settle) + 3s (composer find) + 0.4s (submit settle) + 18s (this poll) = ~23.4s, comfortably
// under the new 25s outer cap, instead of the old ~92s worst case.
const CLAUDE_INTERACTIVE_MAX_WAIT_MS = 18_000;
// How many consecutive no-change poll ticks (with no stop-button visible) are required before
// completion is declared when NO streaming indicator was ever observed (fast answer, or the
// stop-button selector missed it) -- see the stableAndDone comment below for the full logic.
const CLAUDE_INTERACTIVE_STABLE_TICKS_REQUIRED = 3; // 3 * 700ms = 2.1s of no growth

// (this fix pass) Composer fast-fail: how long to POLL for the composer to appear before giving
// up, instead of the prior single synchronous querySelector check. Polling (rather than one shot)
// gives a slow-mounting claude.ai app shell a fair chance; capping at ~3s (well inside the "~3-4
// seconds" fast-fail window) means a page that will NEVER have a composer (login wall, dead page,
// selector drift) is reported back almost immediately instead of falling through to the 18s reply
// poll above with no real composer typed into.
const CLAUDE_COMPOSER_FIND_POLL_MS = 400;
const CLAUDE_COMPOSER_FIND_MAX_WAIT_MS = 3_000;

// (this fix pass) Best-effort sign-in-wall markers. Presence of ANY of these (or a /login URL)
// while the composer is absent is reported as reason:'not_signed_in' rather than a generic
// composer-not-found timeout, so the Founder's console tells the difference between "claude.ai's
// DOM changed" and "this session isn't logged in" without guessing.
const CLAUDE_SIGNIN_MARKER_SELECTORS = [
  'a[href*="/login"]',
  'button[data-testid="login-button"]',
  'input[name="email"]',
  'input[type="password"]',
];

function isClaudeLoginWall(): boolean {
  try {
    if (/\/login(?:[/?]|$)/i.test(window.location.href)) return true;
    for (const sel of CLAUDE_SIGNIN_MARKER_SELECTORS) {
      try {
        if (document.querySelector(sel)) return true;
      } catch {
        /* invalid selector -- try the next candidate */
      }
    }
  } catch {
    return false;
  }
  return false;
}

/** Polls for the composer up to CLAUDE_COMPOSER_FIND_MAX_WAIT_MS. Calls onFound as soon as a
 *  composer selector matches; calls onNotFound(reason) as soon as either (a) a login-wall marker
 *  is detected (immediate, does not wait out the full window) or (b) the window elapses with no
 *  composer and no login-wall marker seen ('composer_not_found_timeout'). Never throws. */
function findComposerFast(
  onFound: (composer: HTMLElement) => void,
  onNotFound: (reason: string) => void,
): void {
  const startedAt = Date.now();
  const tick = () => {
    const composer = findFirstMatch(CLAUDE_COMPOSER_SELECTORS);
    if (composer) {
      onFound(composer);
      return;
    }
    if (isClaudeLoginWall()) {
      onNotFound('not_signed_in');
      return;
    }
    if (Date.now() - startedAt >= CLAUDE_COMPOSER_FIND_MAX_WAIT_MS) {
      onNotFound('composer_not_found_timeout');
      return;
    }
    setTimeout(tick, CLAUDE_COMPOSER_FIND_POLL_MS);
  };
  tick();
}

function runClaudeInteractiveQuery(promptText: string): void {
  const reportFailure = (reason?: string) => {
    ipcRenderer.sendToHost('browser-authority-interactive-result', {
      success: false, authority: 'user_claude', snippet: '', sourceUrl: null, selectorUsed: null,
      ...(reason ? { reason } : {}),
    } as BrowserAuthorityInteractiveResultMessage);
  };

  // (this fix pass) STEP 2 fast-fail: composer lookup is now a bounded poll (findComposerFast),
  // not a single synchronous check -- see that function's header for why (gives a slow-mounting
  // app shell a fair ~3s chance, but never falls through to the 18s reply-poll budget on a page
  // that has no real composer at all).
  findComposerFast(
    (composer) => {
      logInjectionEvent('claude_interactive_composer_found', { url: window.location.href });
      proceedWithComposer(composer);
    },
    (reason) => {
      logInjectionEvent(
        reason === 'not_signed_in' ? 'claude_interactive_not_signed_in' : 'claude_interactive_composer_not_found',
        { reason, url: window.location.href },
      );
      reportFailure(reason);
    },
  );

  function proceedWithComposer(composer: HTMLElement): void {
    const typed = setComposerText(composer, promptText);
    logInjectionEvent('claude_interactive_typed', { ok: typed, url: window.location.href });
    if (!typed) {
      reportFailure('type_failed');
      return;
    }

    // A short settle delay before submit -- mirrors the settle-delay convention
    // runBrowserAuthorityQueryFromMain (index.ts) already uses after did-finish-load, giving the
    // editor's own React state a moment to catch up with the just-dispatched input event before
    // the submit handler reads it.
    setTimeout(() => {
      const submitMethod = submitComposer(composer);
      logInjectionEvent('claude_interactive_submitted', { method: submitMethod, url: window.location.href });
      if (submitMethod === 'failed') {
        reportFailure('submit_failed');
        return;
      }

      let ticksSinceChange = 0;
      let lastText = '';
      let hasSeenStreaming = false;
      let loggedStreamingDetected = false;
      let lastSelector: string | null = null;
      const startedAt = Date.now();

      const finish = (success: boolean) => {
        clearInterval(pollHandle);
        // (this fix pass) STEP 3 diagnostics: distinct stage lines for the two ways this can end,
        // in addition to the existing summary line below (kept for the jsonl-file consumer).
        if (success) {
          logInjectionEvent('claude_interactive_stream_complete', { textLength: lastText.length, url: window.location.href });
          logInjectionEvent('claude_interactive_scraped', { length: lastText.length, url: window.location.href });
        } else {
          logInjectionEvent('claude_interactive_empty_scrape', { sawStreaming: hasSeenStreaming, url: window.location.href });
        }
        logInjectionEvent('claude_interactive_result', {
          success, textLength: lastText.length, sawStreaming: hasSeenStreaming, url: window.location.href,
        });
        ipcRenderer.sendToHost('browser-authority-interactive-result', {
          success,
          authority: 'user_claude',
          snippet: success ? lastText.replace(/\s+/g, ' ').trim() : '',
          sourceUrl: success ? window.location.href : null,
          selectorUsed: success ? lastSelector : null,
          ...(success ? {} : { reason: 'stream_timeout_or_empty' }),
        } as BrowserAuthorityInteractiveResultMessage);
      };

      const pollHandle = setInterval(() => {
        const streaming = isClaudeStillStreaming();
        if (streaming) hasSeenStreaming = true;
        if (streaming && !loggedStreamingDetected) {
          loggedStreamingDetected = true;
          logInjectionEvent('claude_interactive_streaming_detected', { url: window.location.href });
        }

        const match = lastNonEmptyTextMatch(CLAUDE_ASSISTANT_MESSAGE_SELECTORS);
        const currentText = match?.text ?? '';
        if (match) lastSelector = match.selector;

        if (currentText.length > 0 && currentText === lastText) {
          ticksSinceChange++;
        } else {
          ticksSinceChange = 0;
          lastText = currentText;
        }

        // Completion is declared when: (a) we've seen the stop-button appear at some earlier tick
        // and it is now gone (strong, fast signal -- naturally requires at least one repeated
        // no-change reading first, since ticksSinceChange only increments on a REPEATED value), OR
        // (b) the text has held steady for CLAUDE_INTERACTIVE_STABLE_TICKS_REQUIRED consecutive
        // ticks even though no streaming indicator was ever observed (fallback for a fast answer
        // or a stop-button selector miss). Either way this returns AS SOON AS stability is
        // detected -- it never waits out the rest of the poll budget once the answer is done.
        const stableAndDone =
          currentText.length > 0 && !streaming &&
          (hasSeenStreaming ? ticksSinceChange >= 1 : ticksSinceChange >= CLAUDE_INTERACTIVE_STABLE_TICKS_REQUIRED);

        if (stableAndDone) {
          finish(true);
          return;
        }

        if (Date.now() - startedAt > CLAUDE_INTERACTIVE_MAX_WAIT_MS) {
          // Timed out -- report honestly with whatever text (if any) was last observed. Empty
          // lastText reports success:false (no fabricated snippet); a non-empty-but-possibly-
          // still-growing lastText is reported success:true as a best-effort partial, but is never
          // silently upgraded to "verified" upstream (distillExtraction's own length-based
          // `verified` heuristic in browser_authority_types.ts is the only thing that judges that).
          logInjectionEvent('claude_interactive_timeout', {
            elapsedMs: Date.now() - startedAt, textLength: currentText.length, url: window.location.href,
          });
          finish(currentText.length > 0);
        }
      }, CLAUDE_INTERACTIVE_POLL_MS);
    }, 400);
  }
}

ipcRenderer.on('browser-authority-run-interactive-query', (_event, payload: BrowserAuthorityRunInteractiveQueryRequest) => {
  logInjectionEvent('claude_interactive_query_received', { authority: payload.authority, url: window.location.href });
  if (payload.authority !== 'user_claude') {
    // Only claude.ai is wired to the interactive path this build pass -- any other authority
    // arriving on this channel is a caller bug, not a scrape failure; report honestly rather
    // than attempting Claude-specific selectors against an unrelated vendor's page.
    ipcRenderer.sendToHost('browser-authority-interactive-result', {
      success: false, authority: payload.authority, snippet: '', sourceUrl: null, selectorUsed: null,
    } as BrowserAuthorityInteractiveResultMessage);
    return;
  }
  runClaudeInteractiveQuery(payload.query);
});

// ─── Watch for navigation (Google Search AI may be SPA) ──────────────────────

function onDOMReady(): void {
  attachEnterInterceptor();
  logInjectionEvent('preload_ready', { url: window.location.href });
  ipcRenderer.sendToHost('webview-ready', { url: window.location.href });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', onDOMReady);
} else {
  onDOMReady();
}
