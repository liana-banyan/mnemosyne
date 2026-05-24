// B83b — Embedded Chrome Panel
// Embeds a Chromium webview via Electron's <webview> tag
// Patent novelty: auto-injection of cooperative-AI-substrate context into
//   third-party AI-backed search interface via embedded-browser content-script bridge.
// R-MECHANISM-VERIFY: Electron 31 supports <webview> with webviewTag: true in webPreferences
//
// Multi-browser deferral: Chrome only at v1 per Founder direct.
// B83-FOLLOWUP-MULTIBROWSER tracks Firefox/Edge/Brave/Safari support.

import { useState, useRef, useEffect, useCallback } from 'react';
import type { InjectionState } from './substrate_injection_content_script';
import { DEFAULT_INJECTION_STATE } from './substrate_injection_content_script';

const GOOGLE_SEARCH_AI_URL = 'https://www.google.com';

interface EmbeddedChromeProps {
  substrateContext: string | null;
  onInjectionResult?: (result: { success: boolean; url: string }) => void;
}

// Extend HTMLElement for Electron <webview> custom element
interface WebviewElement extends HTMLElement {
  src: string;
  preload?: string;
  send: (channel: string, ...args: unknown[]) => void;
  executeJavaScript: (code: string) => Promise<unknown>;
  getURL: () => string;
  loadURL: (url: string) => void;
  addEventListener(event: 'ipc-message', handler: (e: { channel: string; args: unknown[] }) => void): void;
  addEventListener(event: 'did-navigate' | 'did-finish-load', handler: (e: { url: string }) => void): void;
  addEventListener(event: string, handler: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
  removeEventListener(event: string, handler: EventListenerOrEventListenerObject): void;
}

export function EmbeddedChrome({ substrateContext, onInjectionResult }: EmbeddedChromeProps) {
  const webviewRef = useRef<WebviewElement | null>(null);
  const [currentUrl, setCurrentUrl] = useState(GOOGLE_SEARCH_AI_URL);
  const [urlInput, setUrlInput] = useState(GOOGLE_SEARCH_AI_URL);
  const [loading, setLoading] = useState(false);
  const [injectionState, setInjectionState] = useState<InjectionState>(DEFAULT_INJECTION_STATE);
  const [webviewReady, setWebviewReady] = useState(false);

  // Preload path: compiled by tsconfig.main.json → dist/main/hearth/embedded_browser/webview_preload.js
  // In dev, __dirname points to src/main; in prod, dist/main — both valid for preload resolution
  const preloadPath = window.amplify.getWebviewPreloadPath
    ? window.amplify.getWebviewPreloadPath()
    : undefined;

  // Push substrate context to webview when it changes
  useEffect(() => {
    if (!webviewReady || !webviewRef.current) return;
    if (substrateContext) {
      webviewRef.current.send('substrate-context-update', {
        context: substrateContext,
        enabled: injectionState.enabled,
      });
      setInjectionState((s) => ({
        ...s,
        context_loaded: true,
        context_length: substrateContext.length,
      }));
    }
  }, [substrateContext, webviewReady, injectionState.enabled]);

  const attachWebviewListeners = useCallback((wv: WebviewElement) => {
    wv.addEventListener('ipc-message', (e) => {
      const ev = e as { channel: string; args: unknown[] };
      if (ev.channel === 'webview-ready') {
        setWebviewReady(true);
        // Push current context on ready
        if (substrateContext) {
          wv.send('substrate-context-update', {
            context: substrateContext,
            enabled: injectionState.enabled,
          });
        }
      }
      if (ev.channel === 'substrate-injection-result') {
        const result = ev.args[0] as { success: boolean; url: string; injection_count: number };
        setInjectionState((s) => ({
          ...s,
          last_result: {
            success: result.success,
            url: result.url,
            injection_count: result.injection_count,
            selector_used: null,
          },
        }));
        onInjectionResult?.({ success: result.success, url: result.url });
      }
    });

    wv.addEventListener('did-navigate', (e) => {
      const nav = e as { url: string };
      setCurrentUrl(nav.url);
      setUrlInput(nav.url);
      setLoading(false);
    });

    wv.addEventListener('did-finish-load', () => {
      setLoading(false);
      // Re-push context after navigation
      if (substrateContext) {
        setTimeout(() => {
          wv.send('substrate-context-update', {
            context: substrateContext,
            enabled: injectionState.enabled,
          });
        }, 500); // wait for page JS to settle
      }
    });
  }, [substrateContext, injectionState.enabled, onInjectionResult]);

  // Mount webview listener once
  useEffect(() => {
    const wv = webviewRef.current;
    if (wv) attachWebviewListeners(wv);
  }, [attachWebviewListeners]);

  function navigateTo(url: string): void {
    let target = url.trim();
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = `https://${target}`;
    }
    setLoading(true);
    if (webviewRef.current) {
      webviewRef.current.loadURL(target);
    }
    setUrlInput(target);
  }

  function handleUrlKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') navigateTo(urlInput);
  }

  function toggleInjection(): void {
    const next = !injectionState.enabled;
    setInjectionState((s) => ({ ...s, enabled: next }));
    if (webviewRef.current && webviewReady) {
      webviewRef.current.send('substrate-injection-toggle', { enabled: next });
    }
  }

  const injectionIndicator = injectionState.last_result
    ? injectionState.last_result.success ? '✓ injected' : '⚠ injection miss'
    : injectionState.context_loaded ? '⏳ context ready' : '○ no context';

  const injectionColor = injectionState.last_result?.success
    ? '#22c55e'
    : injectionState.context_loaded
    ? '#f6ad55'
    : '#718096';

  return (
    <div style={styles.container}>
      {/* Browser chrome bar */}
      <div style={styles.browserBar}>
        <input
          style={styles.urlInput}
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={handleUrlKeyDown}
          placeholder="Enter URL or search…"
        />
        <button style={styles.goBtn} onClick={() => navigateTo(urlInput)} title="Navigate">
          {loading ? '⟳' : '→'}
        </button>
        <div style={{ ...styles.injectionBadge, color: injectionColor }} title={`Substrate injection: ${injectionIndicator}`}>
          {injectionState.enabled ? '🧬' : '○'}
          <span style={styles.injectionText}>{injectionIndicator}</span>
        </div>
        <button
          style={{ ...styles.toggleBtn, background: injectionState.enabled ? '#2c5282' : '#4a5568' }}
          onClick={toggleInjection}
          title={injectionState.enabled ? 'Disable substrate injection' : 'Enable substrate injection'}
        >
          {injectionState.enabled ? 'Auto-inject ON' : 'Auto-inject OFF'}
        </button>
      </div>

      {/* Webview — Electron 31 with webviewTag: true */}
      <div style={styles.webviewContainer}>
        {typeof window !== 'undefined' && (
          <webview
            ref={(el) => {
              if (el && el !== webviewRef.current) {
                webviewRef.current = el as unknown as WebviewElement;
                attachWebviewListeners(el as unknown as WebviewElement);
              }
            }}
            src={GOOGLE_SEARCH_AI_URL}
            preload={preloadPath}
            style={styles.webview}
            /* @ts-expect-error — webview is an Electron custom element not in React types */
            allowpopups="true"
          />
        )}
      </div>

      {/* Injection status (Founder visibility) */}
      {injectionState.context_loaded && (
        <div style={styles.contextStatus}>
          <span style={{ color: '#68d391' }}>Substrate context loaded</span>
          {' · '}{injectionState.context_length} chars
          {' · '}Enter key in Google Search AI triggers injection
        </div>
      )}

      {/* CSP fallback notice */}
      {!webviewReady && (
        <div style={styles.webviewNotice}>
          Embedded Chrome loading… If blocked by Content Security Policy, substrate context will be copied to clipboard for manual paste.
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#0f0f1a',
    borderRadius: '8px',
    overflow: 'hidden',
    border: '1px solid #2d3748',
  },
  browserBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.4rem 0.6rem',
    background: '#1a1a2e',
    borderBottom: '1px solid #2d3748',
  },
  urlInput: {
    flex: 1,
    background: '#2d3748',
    border: '1px solid #4a5568',
    borderRadius: '4px',
    padding: '0.3rem 0.5rem',
    color: '#e2e8f0',
    fontSize: '0.8rem',
    outline: 'none',
    fontFamily: 'monospace',
  },
  goBtn: {
    background: '#4a5568',
    border: 'none',
    borderRadius: '4px',
    padding: '0.3rem 0.6rem',
    color: '#e2e8f0',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  injectionBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: '0.75rem',
    minWidth: 120,
  },
  injectionText: { fontSize: '0.65rem' },
  toggleBtn: {
    border: 'none',
    borderRadius: '4px',
    padding: '0.25rem 0.5rem',
    color: '#e2e8f0',
    cursor: 'pointer',
    fontSize: '0.65rem',
    whiteSpace: 'nowrap',
  },
  webviewContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  webview: {
    width: '100%',
    height: '100%',
    display: 'block',
  },
  contextStatus: {
    padding: '0.25rem 0.6rem',
    background: '#0d1117',
    fontSize: '0.65rem',
    color: '#718096',
    borderTop: '1px solid #2d3748',
  },
  webviewNotice: {
    padding: '0.3rem 0.6rem',
    background: '#2d2000',
    fontSize: '0.65rem',
    color: '#f6ad55',
    textAlign: 'center',
  },
};
