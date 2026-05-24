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
import { appendFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

// ─── State ────────────────────────────────────────────────────────────────────

let currentContext: string | null = null;
let injectionEnabled = true;
let injectionCount = 0;

// ─── Logging (injection receipts) ─────────────────────────────────────────────

const LOG_DIR = resolve(
  process.env.APPDATA || process.env.HOME || '.',
  'AMPLIFY Computer',
  'hearth_conjunction',
);

function logInjectionEvent(event: string, details: Record<string, unknown>): void {
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(
      resolve(LOG_DIR, 'embedded_browser_injection.jsonl'),
      JSON.stringify({ ts: new Date().toISOString(), event, ...details }) + '\n',
      'utf8',
    );
  } catch {
    /* non-fatal */
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
