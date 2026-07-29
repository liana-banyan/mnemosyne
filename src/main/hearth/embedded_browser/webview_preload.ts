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

type BrowserAuthorityName = 'user_google' | 'user_perplexity';

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
