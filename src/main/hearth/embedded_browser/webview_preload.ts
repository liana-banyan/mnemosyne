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

// BP140-K4: 'user_chatgpt' | 'user_gemini' added -- both wired below via the generic interactive
// driver (runGenericInteractiveQuery), mirroring claude.ai's own hand-written driver shape.
type BrowserAuthorityName = 'user_google' | 'user_perplexity' | 'user_claude' | 'user_chatgpt' | 'user_gemini';

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

// (this fix pass) RESILIENT TEXT FALLBACK, tier (b): claude.ai's DOM has drifted enough that
// CLAUDE_ASSISTANT_MESSAGE_SELECTORS above now reliably matches nothing (3 identical live runs:
// composer_found -> typed -> submitted -> streaming_detected -> textLength:0 for the whole poll
// -> empty_scrape, even though the URL becoming claude.ai/chat/<id> proves Claude DID answer).
// This broad, deliberately over-inclusive set only needs to CONTAIN the answer text -- it feeds
// downstream letter-matching, not a strict DOM contract -- so casting a wide net here is fine as
// long as findBroadFallbackMatch below filters out the echoed user prompt and trivial text.
const CLAUDE_FALLBACK_MESSAGE_SELECTORS = [
  '[data-testid*="message"]',
  '[class*="message"]',
  '[class*="claude"]',
  '[class*="prose"]',
  '[class*="markdown"]',
];

// Minimum text length for a candidate extraction to be considered "substantial" rather than
// trivial/empty noise, per the fix-pass spec (">~15 chars, not equal to the prompt").
const RESILIENT_TEXT_MIN_LENGTH = 15;

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

/** True when `text` IS (or merely echoes the start of) the prompt we just submitted -- guards
 *  every fallback tier below against re-scraping the user's own just-typed question back out of
 *  a container that happens to wrap both turns (e.g. a loose `[class*="message"]` match). Never
 *  throws; whitespace/case-insensitive so minor DOM formatting differences don't defeat it. */
function isEchoedPrompt(text: string, promptText: string): boolean {
  const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  const t = normalize(text);
  const p = normalize(promptText);
  if (!p) return false;
  return t === p || t.startsWith(p);
}

/** RESILIENT TEXT FALLBACK, tier (b): walks CLAUDE_FALLBACK_MESSAGE_SELECTORS' combined match
 *  set from the END of DOM order backwards (the conversation thread appends at the bottom, so
 *  this naturally favors the most recent turn, matching this module's existing "always take the
 *  last matching element" convention -- see the header comment above
 *  CLAUDE_ASSISTANT_MESSAGE_SELECTORS). Returns the first candidate that clears the
 *  substantial-text bar and is not the echoed user prompt; null if nothing qualifies. Never
 *  throws -- a selector-parse failure just means an empty combined query, handled by the
 *  try/catch below. */
function findBroadFallbackMatch(promptText: string): { text: string; selector: string } | null {
  try {
    const combinedSelector = CLAUDE_FALLBACK_MESSAGE_SELECTORS.join(',');
    const matches = Array.from(document.querySelectorAll<HTMLElement>(combinedSelector));
    for (let i = matches.length - 1; i >= 0; i--) {
      const el = matches[i];
      const text = el?.innerText?.trim() ?? '';
      if (text.length < RESILIENT_TEXT_MIN_LENGTH || isEchoedPrompt(text, promptText)) continue;
      let matchedSelector = 'broad-fallback';
      for (const sel of CLAUDE_FALLBACK_MESSAGE_SELECTORS) {
        try {
          if (el.matches(sel)) {
            matchedSelector = sel;
            break;
          }
        } catch {
          /* invalid selector -- keep the generic label */
        }
      }
      return { text, selector: matchedSelector };
    }
  } catch {
    /* invalid combined selector or DOM access error */
  }
  return null;
}

/** RESILIENT TEXT FALLBACK, tier (c) -- final fallback: reads `main`'s (or `document.body`'s)
 *  innerText with known chrome (composer, send button, nav/aside/header) stripped out of a clone
 *  first, then takes the TAIL after the last occurrence of the submitted prompt text (so the
 *  echoed question itself is excluded from what's returned). If the prompt text can't be located
 *  verbatim (e.g. the editor reformatted whitespace), falls back to the full stripped text --
 *  over-inclusive is acceptable per the fix-pass spec since this only needs to CONTAIN the
 *  answer. Returns null if the result doesn't clear the substantial-text bar or is itself just
 *  the echoed prompt. Never throws. */
function findMainRegionTailFallback(promptText: string): { text: string; selector: string } | null {
  try {
    const root = document.querySelector('main') ?? document.body;
    if (!root) return null;
    const clone = root.cloneNode(true) as HTMLElement;
    const stripSelectors = ['nav', 'aside', 'header', ...CLAUDE_COMPOSER_SELECTORS, ...CLAUDE_SEND_BUTTON_SELECTORS];
    for (const sel of stripSelectors) {
      try {
        clone.querySelectorAll(sel).forEach((n) => n.remove());
      } catch {
        /* invalid selector -- skip stripping it */
      }
    }
    const fullText = clone.innerText?.trim() ?? '';
    if (!fullText) return null;
    const normalizedPrompt = promptText.trim();
    let tail = fullText;
    if (normalizedPrompt) {
      const idx = fullText.lastIndexOf(normalizedPrompt);
      if (idx >= 0) tail = fullText.slice(idx + normalizedPrompt.length).trim();
    }
    if (tail.length >= RESILIENT_TEXT_MIN_LENGTH && !isEchoedPrompt(tail, promptText)) {
      return { text: tail, selector: 'main-tail-fallback' };
    }
  } catch {
    /* DOM access error */
  }
  return null;
}

/** RESILIENT TEXT FALLBACK entry point: tries the existing specific selectors first (unchanged
 *  behavior, tier (a)), then the broad-container fallback (tier (b)), then the main-region tail
 *  fallback (tier (c)) -- returns the FIRST tier that yields non-trivial (>= 15 char), non-
 *  echoed-prompt text. Never fabricates: returns null (not a placeholder string) when every tier
 *  comes up empty, exactly like the pre-fix lastNonEmptyTextMatch-only path did. */
function getResilientAssistantText(promptText: string): { text: string; selector: string } | null {
  const specific = lastNonEmptyTextMatch(CLAUDE_ASSISTANT_MESSAGE_SELECTORS);
  if (specific && specific.text.length >= RESILIENT_TEXT_MIN_LENGTH && !isEchoedPrompt(specific.text, promptText)) {
    return specific;
  }
  const broad = findBroadFallbackMatch(promptText);
  if (broad) return broad;
  const tail = findMainRegionTailFallback(promptText);
  if (tail) return tail;
  return null;
}

// (this fix pass) DOM-SNAPSHOT DIAGNOSTIC: captured right before an empty_scrape is declared, so
// the Founder's console shows the REAL answer-element shape from the failing run instead of just
// "textLength:0". Bounded to the last ~6 elements (in DOM order under `main`/body) with
// textLength > 20, each field truncated so total payload stays well under the ~2-3KB cap this
// fix pass specifies. Never throws -- any failure here just yields an empty array, and the
// empty_scrape log below still fires either way (diagnostics must never block the real feature).
const DOM_SNAPSHOT_MAX_ELEMENTS = 6;
const DOM_SNAPSHOT_CLASSNAME_MAX = 120;
const DOM_SNAPSHOT_TEXTHEAD_MAX = 80;
const DOM_SNAPSHOT_BYTE_BUDGET = 3000;

function captureDomSnapshot(): Array<Record<string, unknown>> {
  try {
    const root = document.querySelector('main') ?? document.body;
    if (!root) return [];
    const all = Array.from(root.querySelectorAll<HTMLElement>('*'));
    const candidates: Array<{ el: HTMLElement; textLen: number }> = [];
    for (const el of all) {
      const text = el.innerText?.trim() ?? '';
      if (text.length > 20) candidates.push({ el, textLen: text.length });
    }
    const lastFew = candidates.slice(-DOM_SNAPSHOT_MAX_ELEMENTS);
    let snapshot = lastFew.map(({ el, textLen }) => {
      const dataTestid: Record<string, string> = {};
      for (const attr of Array.from(el.attributes)) {
        if (attr.name.startsWith('data-testid')) dataTestid[attr.name] = attr.value.slice(0, 60);
      }
      const text = el.innerText?.trim() ?? '';
      const className = typeof el.className === 'string' ? el.className : '';
      return {
        tag: el.tagName.toLowerCase(),
        id: el.id || '',
        className: className.slice(0, DOM_SNAPSHOT_CLASSNAME_MAX),
        dataTestid,
        textLen,
        textHead: text.slice(0, DOM_SNAPSHOT_TEXTHEAD_MAX),
      };
    });
    // Belt-and-suspenders size cap: the per-field truncation above should already keep this well
    // under budget, but if attribute-heavy elements still push it over, progressively drop the
    // oldest (earliest-DOM-order) entries rather than truncate JSON mid-string.
    while (snapshot.length > 1 && JSON.stringify(snapshot).length > DOM_SNAPSHOT_BYTE_BUDGET) {
      snapshot = snapshot.slice(1);
    }
    return snapshot;
  } catch {
    return [];
  }
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
          // (this fix pass) FIX 2: capture a bounded DOM snapshot right before declaring the
          // empty scrape, so the next run's console shows the REAL answer-element shape instead
          // of just "textLength:0" -- see captureDomSnapshot's header comment above.
          const domSnapshot = captureDomSnapshot();
          logInjectionEvent('claude_interactive_dom_snapshot', { elements: domSnapshot, url: window.location.href });
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

        // (this fix pass) FIX 1: completion detection now keys off the RESILIENT text (tiers
        // a/b/c above), not just the specific CLAUDE_ASSISTANT_MESSAGE_SELECTORS -- those
        // selectors alone were confirmed (3 identical live runs) to match nothing on claude.ai's
        // current DOM even while streaming was correctly detected, so `currentText` here used to
        // stay empty for the whole poll no matter how long we waited.
        const match = getResilientAssistantText(promptText);
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

// ─── BP140-K4: generic interactive browser-authority driver (ChatGPT / Gemini) ──────────────
// ADDITIVE ONLY, same "unreachable unless the new channel is sent" guarantee as every block
// above. Mirrors claude.ai's own hand-written driver (runClaudeInteractiveQuery and its
// CLAUDE_*-prefixed helpers above) EXACTLY in shape -- composer find -> type -> submit -> poll
// for stream completion -> resilient tier a/b/c scrape -> bounded dom_snapshot on empty scrape
// -> honest result. Factored into one generic runner parameterized by a small per-vendor
// selector config instead of two more ~250-line hand-copies of the Claude block, so a selector
// fix for one vendor can never accidentally be applied to the other and the lifecycle logic
// itself only has to be correct in one place. This does NOT touch or reuse a single line of the
// CLAUDE_* constants/functions above -- claude.ai's own driver is completely untouched by this
// addition; it only reuses the vendor-agnostic shared helpers (findFirstMatch,
// lastNonEmptyTextMatch, isEchoedPrompt, setComposerText, captureDomSnapshot,
// RESILIENT_TEXT_MIN_LENGTH, CLAUDE_INTERACTIVE_*_MS budgets, CLAUDE_COMPOSER_FIND_*_MS budgets)
// that already carried no vendor-specific selector inside them.
//
// HONESTY FIREWALL (same bar as every block above): every selector below is a best-effort
// heuristic against chatgpt.com's / gemini.google.com's rendered DOM as of this build pass,
// researched from public DOM-selector references (chatgpt.com's `data-message-author-role`
// attribute and `#prompt-textarea` id are documented as stable across multiple redesigns;
// Gemini's Quill-based `.ql-editor` composer and `model-response`/`message-content` custom
// elements are documented as more stable than its obfuscated Angular class names) --
// UNVERIFIED against a real logged-in session (no live ChatGPT/Gemini credentials available to
// this build pass). A composer miss, a submit miss, or a scrape miss is reported as
// `success: false` with no fabricated snippet/URL; there is no code path in this block that
// invents a placeholder answer. On an empty scrape, the SAME captureDomSnapshot() diagnostic the
// Claude block already uses (fully vendor-agnostic, no change needed) fires so the real answer
// DOM prints for the next selector-pinning pass.

interface InteractiveAuthorityDriverConfig {
  authority: 'user_chatgpt' | 'user_gemini';
  /** Log-event prefix per the BP140-K4 spec: 'chatgpt_interactive' / 'gemini_interactive'. */
  logPrefix: string;
  composerSelectors: string[];
  sendButtonSelectors: string[];
  /** Presence of ANY of these means the assistant turn is still streaming (mirrors
   *  CLAUDE_STOP_BUTTON_SELECTORS' role exactly). */
  streamingIndicatorSelectors: string[];
  /** Tier (a): most-specific assistant-message selectors, tried first. */
  assistantMessageSelectorsTierA: string[];
  /** Tier (b)/(c): broader containers, mirrors CLAUDE_FALLBACK_MESSAGE_SELECTORS' role. */
  fallbackMessageSelectorsTierB: string[];
  /** Best-effort sign-in-wall markers, mirrors CLAUDE_SIGNIN_MARKER_SELECTORS' role. */
  signInMarkerSelectors: string[];
  /** Regex tested against window.location.href; a match means "still on a login page". */
  signInUrlPattern: RegExp;
}

// ChatGPT selectors -- tier a: [data-message-author-role="assistant"] is OpenAI's own stable
// data attribute (documented stable across multiple redesigns); #prompt-textarea is the
// documented-stable composer id (a contenteditable div, not a real <textarea>, despite the id).
const CHATGPT_COMPOSER_SELECTORS = [
  '#prompt-textarea',
  'div.ProseMirror[contenteditable="true"]',
  'div[contenteditable="true"][data-placeholder]',
  'div[contenteditable="true"][role="textbox"]',
  'div[contenteditable="true"]',
];

const CHATGPT_SEND_BUTTON_SELECTORS = [
  'button[data-testid="send-button"]',
  'button[aria-label*="Send" i]',
  'form button[type="submit"]',
];

const CHATGPT_STOP_BUTTON_SELECTORS = [
  'button[data-testid="stop-button"]',
  'button[aria-label*="Stop" i]',
];

const CHATGPT_ASSISTANT_MESSAGE_SELECTORS_TIER_A = [
  '[data-message-author-role="assistant"] .markdown',
  '[data-message-author-role="assistant"] .prose',
  '[data-message-author-role="assistant"]',
];

// Tier (b)/(c): broader containers -- only needs to CONTAIN the answer text, same
// over-inclusive-is-fine contract as CLAUDE_FALLBACK_MESSAGE_SELECTORS.
const CHATGPT_FALLBACK_MESSAGE_SELECTORS_TIER_B = [
  '.agent-turn',
  'div.markdown',
  'div.prose',
  '[class*="markdown"]',
  '[class*="message"]',
];

const CHATGPT_SIGNIN_MARKER_SELECTORS = [
  'a[href*="/auth/login"]',
  'button[data-testid="login-button"]',
  'input[name="username"]',
  'input[type="password"]',
];

const CHATGPT_DRIVER_CONFIG: InteractiveAuthorityDriverConfig = {
  authority: 'user_chatgpt',
  logPrefix: 'chatgpt_interactive',
  composerSelectors: CHATGPT_COMPOSER_SELECTORS,
  sendButtonSelectors: CHATGPT_SEND_BUTTON_SELECTORS,
  streamingIndicatorSelectors: CHATGPT_STOP_BUTTON_SELECTORS,
  assistantMessageSelectorsTierA: CHATGPT_ASSISTANT_MESSAGE_SELECTORS_TIER_A,
  fallbackMessageSelectorsTierB: CHATGPT_FALLBACK_MESSAGE_SELECTORS_TIER_B,
  signInMarkerSelectors: CHATGPT_SIGNIN_MARKER_SELECTORS,
  signInUrlPattern: /\/auth\/login(?:[/?]|$)/i,
};

// Gemini selectors -- tier a: `model-response`/`message-content` are Gemini's own custom
// web-component tags (documented more stable than its Angular-obfuscated class names). Composer
// is a Quill-based rich-textarea; `.ql-editor` is the documented-stable inner contenteditable.
const GEMINI_COMPOSER_SELECTORS = [
  'rich-textarea .ql-editor',
  '.ql-editor[contenteditable="true"]',
  '[aria-label="Enter a prompt here"]',
  'div[contenteditable="true"][role="textbox"]',
  'div[contenteditable="true"]',
];

const GEMINI_SEND_BUTTON_SELECTORS = [
  'button.send-button[aria-label="Send message"]',
  'button.send-button',
  'button[aria-label="Send message"]',
  'button[aria-label*="Send" i]',
];

const GEMINI_STOP_BUTTON_SELECTORS = [
  'button[aria-label="Stop response"]',
  'button[aria-label*="Stop" i]',
];

const GEMINI_ASSISTANT_MESSAGE_SELECTORS_TIER_A = [
  'model-response message-content .markdown',
  'model-response .markdown',
  'message-content[data-response] .markdown',
  'message-content',
];

// Tier (b)/(c): broader containers, same over-inclusive-is-fine contract as above.
const GEMINI_FALLBACK_MESSAGE_SELECTORS_TIER_B = [
  '.response-container',
  '[data-role="model"]',
  '.model-response-text',
  '[class*="response-content"]',
  '.response',
];

const GEMINI_SIGNIN_MARKER_SELECTORS = [
  'a[href*="accounts.google.com/ServiceLogin"]',
  'a[href*="accounts.google.com/signin"]',
  'input[type="email"]',
  'input[type="password"]',
];

const GEMINI_DRIVER_CONFIG: InteractiveAuthorityDriverConfig = {
  authority: 'user_gemini',
  logPrefix: 'gemini_interactive',
  composerSelectors: GEMINI_COMPOSER_SELECTORS,
  sendButtonSelectors: GEMINI_SEND_BUTTON_SELECTORS,
  streamingIndicatorSelectors: GEMINI_STOP_BUTTON_SELECTORS,
  assistantMessageSelectorsTierA: GEMINI_ASSISTANT_MESSAGE_SELECTORS_TIER_A,
  fallbackMessageSelectorsTierB: GEMINI_FALLBACK_MESSAGE_SELECTORS_TIER_B,
  signInMarkerSelectors: GEMINI_SIGNIN_MARKER_SELECTORS,
  signInUrlPattern: /accounts\.google\.com\/(ServiceLogin|signin)/i,
};

function isGenericLoginWall(config: InteractiveAuthorityDriverConfig): boolean {
  try {
    if (config.signInUrlPattern.test(window.location.href)) return true;
    for (const sel of config.signInMarkerSelectors) {
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

/** Parameterized twin of findComposerFast above. */
function findComposerFastGeneric(
  config: InteractiveAuthorityDriverConfig,
  onFound: (composer: HTMLElement) => void,
  onNotFound: (reason: string) => void,
): void {
  const startedAt = Date.now();
  const tick = () => {
    const composer = findFirstMatch(config.composerSelectors);
    if (composer) {
      onFound(composer);
      return;
    }
    if (isGenericLoginWall(config)) {
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

function isGenericStillStreaming(config: InteractiveAuthorityDriverConfig): boolean {
  return findFirstMatch(config.streamingIndicatorSelectors) !== null;
}

/** Parameterized twin of findBroadFallbackMatch above (tier b). */
function findBroadFallbackMatchGeneric(
  selectors: string[],
  promptText: string,
): { text: string; selector: string } | null {
  try {
    const combinedSelector = selectors.join(',');
    const matches = Array.from(document.querySelectorAll<HTMLElement>(combinedSelector));
    for (let i = matches.length - 1; i >= 0; i--) {
      const el = matches[i];
      const text = el?.innerText?.trim() ?? '';
      if (text.length < RESILIENT_TEXT_MIN_LENGTH || isEchoedPrompt(text, promptText)) continue;
      let matchedSelector = 'broad-fallback';
      for (const sel of selectors) {
        try {
          if (el.matches(sel)) {
            matchedSelector = sel;
            break;
          }
        } catch {
          /* invalid selector -- keep the generic label */
        }
      }
      return { text, selector: matchedSelector };
    }
  } catch {
    /* invalid combined selector or DOM access error */
  }
  return null;
}

/** Parameterized twin of findMainRegionTailFallback above (tier c). */
function findMainRegionTailFallbackGeneric(
  config: InteractiveAuthorityDriverConfig,
  promptText: string,
): { text: string; selector: string } | null {
  try {
    const root = document.querySelector('main') ?? document.body;
    if (!root) return null;
    const clone = root.cloneNode(true) as HTMLElement;
    const stripSelectors = ['nav', 'aside', 'header', ...config.composerSelectors, ...config.sendButtonSelectors];
    for (const sel of stripSelectors) {
      try {
        clone.querySelectorAll(sel).forEach((n) => n.remove());
      } catch {
        /* invalid selector -- skip stripping it */
      }
    }
    const fullText = clone.innerText?.trim() ?? '';
    if (!fullText) return null;
    const normalizedPrompt = promptText.trim();
    let tail = fullText;
    if (normalizedPrompt) {
      const idx = fullText.lastIndexOf(normalizedPrompt);
      if (idx >= 0) tail = fullText.slice(idx + normalizedPrompt.length).trim();
    }
    if (tail.length >= RESILIENT_TEXT_MIN_LENGTH && !isEchoedPrompt(tail, promptText)) {
      return { text: tail, selector: 'main-tail-fallback' };
    }
  } catch {
    /* DOM access error */
  }
  return null;
}

/** Parameterized twin of getResilientAssistantText above: tier a (specific) -> tier b (broad)
 *  -> tier c (main-region tail). */
function getResilientAssistantTextGeneric(
  config: InteractiveAuthorityDriverConfig,
  promptText: string,
): { text: string; selector: string } | null {
  const specific = lastNonEmptyTextMatch(config.assistantMessageSelectorsTierA);
  if (specific && specific.text.length >= RESILIENT_TEXT_MIN_LENGTH && !isEchoedPrompt(specific.text, promptText)) {
    return specific;
  }
  const broad = findBroadFallbackMatchGeneric(config.fallbackMessageSelectorsTierB, promptText);
  if (broad) return broad;
  const tail = findMainRegionTailFallbackGeneric(config, promptText);
  if (tail) return tail;
  return null;
}

/** Parameterized twin of submitComposer above. */
function submitComposerGeneric(composerEl: HTMLElement, sendButtonSelectors: string[]): 'button' | 'enter-key' | 'failed' {
  try {
    const sendButton = findFirstMatch(sendButtonSelectors);
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

/** The generic interactive lifecycle runner: composer find, type, submit, poll for stream
 *  completion, resilient scrape, honest result. Mirrors runClaudeInteractiveQuery's own
 *  structure and timing constants exactly (same CLAUDE_INTERACTIVE_ and CLAUDE_COMPOSER_FIND_
 *  budgets, deliberately NOT re-derived per vendor, since the fast-fail rationale documented
 *  above those constants is itself vendor-agnostic: a short composer-find window plus a bounded
 *  reply-poll window). Emits the exact 6 lifecycle events this build pass's spec requires
 *  (query_received is logged by the dispatcher below before this runs), each prefixed with
 *  config.logPrefix -- 'chatgpt_interactive_...' or 'gemini_interactive_...'. */
function runGenericInteractiveQuery(config: InteractiveAuthorityDriverConfig, promptText: string): void {
  const reportFailure = (reason?: string) => {
    ipcRenderer.sendToHost('browser-authority-interactive-result', {
      success: false, authority: config.authority, snippet: '', sourceUrl: null, selectorUsed: null,
      ...(reason ? { reason } : {}),
    } as BrowserAuthorityInteractiveResultMessage);
  };

  findComposerFastGeneric(
    config,
    (composer) => {
      logInjectionEvent(`${config.logPrefix}_composer_found`, { url: window.location.href });
      proceedWithComposer(composer);
    },
    (reason) => {
      logInjectionEvent(
        reason === 'not_signed_in' ? `${config.logPrefix}_not_signed_in` : `${config.logPrefix}_composer_not_found`,
        { reason, url: window.location.href },
      );
      reportFailure(reason);
    },
  );

  function proceedWithComposer(composer: HTMLElement): void {
    const typed = setComposerText(composer, promptText);
    logInjectionEvent(`${config.logPrefix}_typed`, { ok: typed, url: window.location.href });
    if (!typed) {
      reportFailure('type_failed');
      return;
    }

    setTimeout(() => {
      const submitMethod = submitComposerGeneric(composer, config.sendButtonSelectors);
      logInjectionEvent(`${config.logPrefix}_submitted`, { method: submitMethod, url: window.location.href });
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
        if (success) {
          logInjectionEvent(`${config.logPrefix}_stream_complete`, { textLength: lastText.length, url: window.location.href });
          logInjectionEvent(`${config.logPrefix}_scraped`, { length: lastText.length, url: window.location.href });
        } else {
          const domSnapshot = captureDomSnapshot();
          logInjectionEvent(`${config.logPrefix}_dom_snapshot`, { elements: domSnapshot, url: window.location.href });
          logInjectionEvent(`${config.logPrefix}_empty_scrape`, { sawStreaming: hasSeenStreaming, url: window.location.href });
        }
        logInjectionEvent(`${config.logPrefix}_result`, {
          success, textLength: lastText.length, sawStreaming: hasSeenStreaming, url: window.location.href,
        });
        ipcRenderer.sendToHost('browser-authority-interactive-result', {
          success,
          authority: config.authority,
          snippet: success ? lastText.replace(/\s+/g, ' ').trim() : '',
          sourceUrl: success ? window.location.href : null,
          selectorUsed: success ? lastSelector : null,
          ...(success ? {} : { reason: 'stream_timeout_or_empty' }),
        } as BrowserAuthorityInteractiveResultMessage);
      };

      const pollHandle = setInterval(() => {
        const streaming = isGenericStillStreaming(config);
        if (streaming) hasSeenStreaming = true;
        if (streaming && !loggedStreamingDetected) {
          loggedStreamingDetected = true;
          logInjectionEvent(`${config.logPrefix}_streaming_detected`, { url: window.location.href });
        }

        const match = getResilientAssistantTextGeneric(config, promptText);
        const currentText = match?.text ?? '';
        if (match) lastSelector = match.selector;

        if (currentText.length > 0 && currentText === lastText) {
          ticksSinceChange++;
        } else {
          ticksSinceChange = 0;
          lastText = currentText;
        }

        const stableAndDone =
          currentText.length > 0 && !streaming &&
          (hasSeenStreaming ? ticksSinceChange >= 1 : ticksSinceChange >= CLAUDE_INTERACTIVE_STABLE_TICKS_REQUIRED);

        if (stableAndDone) {
          finish(true);
          return;
        }

        if (Date.now() - startedAt > CLAUDE_INTERACTIVE_MAX_WAIT_MS) {
          logInjectionEvent(`${config.logPrefix}_timeout`, {
            elapsedMs: Date.now() - startedAt, textLength: currentText.length, url: window.location.href,
          });
          finish(currentText.length > 0);
        }
      }, CLAUDE_INTERACTIVE_POLL_MS);
    }, 400);
  }
}

ipcRenderer.on('browser-authority-run-interactive-query', (_event, payload: BrowserAuthorityRunInteractiveQueryRequest) => {
  // BP140-K4: dispatch by authority. user_claude keeps its own hand-written driver, byte-
  // unchanged; user_chatgpt/user_gemini route to the new generic driver above; any other
  // authority arriving on this channel is a caller bug, not a scrape failure -- reported
  // honestly rather than attempting the wrong vendor's selectors against an unrelated page.
  if (payload.authority === 'user_claude') {
    logInjectionEvent('claude_interactive_query_received', { authority: payload.authority, url: window.location.href });
    runClaudeInteractiveQuery(payload.query);
    return;
  }
  if (payload.authority === 'user_chatgpt') {
    logInjectionEvent('chatgpt_interactive_query_received', { authority: payload.authority, url: window.location.href });
    runGenericInteractiveQuery(CHATGPT_DRIVER_CONFIG, payload.query);
    return;
  }
  if (payload.authority === 'user_gemini') {
    logInjectionEvent('gemini_interactive_query_received', { authority: payload.authority, url: window.location.href });
    runGenericInteractiveQuery(GEMINI_DRIVER_CONFIG, payload.query);
    return;
  }
  logInjectionEvent('interactive_query_unsupported_authority', { authority: payload.authority, url: window.location.href });
  ipcRenderer.sendToHost('browser-authority-interactive-result', {
    success: false, authority: payload.authority, snippet: '', sourceUrl: null, selectorUsed: null,
  } as BrowserAuthorityInteractiveResultMessage);
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
