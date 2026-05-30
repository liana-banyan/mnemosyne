// BatteryDispatchTab — BP063 SEG-1 · Battery Dispatch as first-class Mnemosyne tab
// Loads the Battery Dispatch fire-control UI from the LB platform via embedded webview.
// Route: https://lianabanyan.com/the-battery (admin routes · marketplace + upekrithen portals)
// Canon: canon_battery_dispatch_dedicated_mnemosyne_tab_bp063 · pearl_9e27a127e207072a

import { useState, useRef, useEffect, useCallback } from 'react';

const BATTERY_DISPATCH_URL = 'https://lianabanyan.com/the-battery';

// Extend HTMLElement for Electron <webview> custom element
interface WebviewElement extends HTMLElement {
  src: string;
  loadURL: (url: string) => void;
  getURL: () => string;
  addEventListener(event: 'did-navigate' | 'did-finish-load' | 'did-fail-load', handler: (e: Record<string, unknown>) => void): void;
  addEventListener(event: string, handler: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
  removeEventListener(event: string, handler: EventListenerOrEventListenerObject): void;
}

export function BatteryDispatchTab() {
  const webviewRef = useRef<WebviewElement | null>(null);
  const [urlInput, setUrlInput] = useState(BATTERY_DISPATCH_URL);
  const [currentUrl, setCurrentUrl] = useState(BATTERY_DISPATCH_URL);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const preloadPath = (window as typeof window & { amplify?: { getWebviewPreloadPath?: () => string } })
    .amplify?.getWebviewPreloadPath?.();

  const attachListeners = useCallback((wv: WebviewElement) => {
    wv.addEventListener('did-navigate', (e) => {
      const nav = e as { url: string };
      if (nav.url) {
        setCurrentUrl(nav.url);
        setUrlInput(nav.url);
      }
      setLoading(false);
      setLoadError(null);
    });

    wv.addEventListener('did-finish-load', () => {
      setLoading(false);
      setLoadError(null);
    });

    wv.addEventListener('did-fail-load', (e) => {
      const ev = e as { errorDescription?: string; errorCode?: number };
      // Ignore -3 (ABORTED) which fires on redirect-style navigations
      if (ev.errorCode === -3) return;
      setLoading(false);
      setLoadError(ev.errorDescription || 'Page failed to load');
    });
  }, []);

  useEffect(() => {
    const wv = webviewRef.current;
    if (wv) attachListeners(wv);
  }, [attachListeners]);

  function navigateTo(url: string): void {
    let target = url.trim();
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = `https://${target}`;
    }
    setLoading(true);
    setLoadError(null);
    if (webviewRef.current) {
      webviewRef.current.loadURL(target);
    }
    setUrlInput(target);
    setCurrentUrl(target);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') navigateTo(urlInput);
  }

  function handleReload(): void {
    navigateTo(currentUrl);
  }

  return (
    <div style={styles.container}>
      {/* Browser bar */}
      <div style={styles.bar}>
        <div style={styles.batteryBadge} title="Battery Dispatch — coordinated social media barrage">
          🔋
        </div>
        <input
          style={styles.urlInput}
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Battery Dispatch URL…"
          aria-label="URL"
        />
        <button style={styles.navBtn} onClick={() => navigateTo(urlInput)} title="Navigate">
          {loading ? '⟳' : '→'}
        </button>
        <button style={styles.navBtn} onClick={handleReload} title="Reload Battery Dispatch">
          ↺
        </button>
        <button
          style={styles.homeBtn}
          onClick={() => navigateTo(BATTERY_DISPATCH_URL)}
          title="Return to Battery Dispatch"
        >
          Home
        </button>
      </div>

      {/* Webview */}
      <div style={styles.webviewWrap}>
        {typeof window !== 'undefined' && (
          <webview
            ref={(el) => {
              if (el && el !== webviewRef.current) {
                webviewRef.current = el as unknown as WebviewElement;
                attachListeners(el as unknown as WebviewElement);
              }
            }}
            src={BATTERY_DISPATCH_URL}
            preload={preloadPath}
            style={styles.webview}
            /* @ts-expect-error — webview is an Electron custom element not in React types */
            allowpopups="true"
          />
        )}

        {/* Loading overlay */}
        {loading && (
          <div style={styles.overlay}>
            <div style={styles.overlayContent}>
              <div style={styles.spinner}>🔋</div>
              <div style={styles.overlayText}>Loading Battery Dispatch…</div>
            </div>
          </div>
        )}

        {/* Error state */}
        {loadError && !loading && (
          <div style={styles.errorBanner}>
            <span style={{ color: '#f87171' }}>⚠ {loadError}</span>
            <button style={styles.retryBtn} onClick={handleReload}>Retry</button>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div style={styles.statusBar}>
        <span style={{ color: '#4ade80', fontWeight: 600 }}>🔋 Battery Dispatch</span>
        <span style={styles.statusUrl}>{currentUrl}</span>
        <span style={{ color: loading ? '#fbbf24' : '#4ade80' }}>
          {loading ? '● loading' : '● ready'}
        </span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#0a0f1a',
    overflow: 'hidden',
  },
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.4rem 0.75rem',
    background: '#0d1117',
    borderBottom: '1px solid rgba(100,116,139,0.2)',
    flexShrink: 0,
  },
  batteryBadge: {
    fontSize: 16,
    flexShrink: 0,
    cursor: 'default',
  },
  urlInput: {
    flex: 1,
    background: '#1e2533',
    border: '1px solid rgba(100,116,139,0.3)',
    borderRadius: 4,
    padding: '0.3rem 0.5rem',
    color: '#e2e8f0',
    fontSize: '0.78rem',
    outline: 'none',
    fontFamily: 'monospace',
  },
  navBtn: {
    background: 'rgba(100,116,139,0.15)',
    border: '1px solid rgba(100,116,139,0.25)',
    borderRadius: 4,
    padding: '0.3rem 0.6rem',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '0.85rem',
    flexShrink: 0,
  },
  homeBtn: {
    background: 'rgba(74,222,128,0.08)',
    border: '1px solid rgba(74,222,128,0.25)',
    borderRadius: 4,
    padding: '0.3rem 0.7rem',
    color: '#4ade80',
    cursor: 'pointer',
    fontSize: '0.72rem',
    fontWeight: 600,
    flexShrink: 0,
    whiteSpace: 'nowrap' as const,
  },
  webviewWrap: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  webview: {
    width: '100%',
    height: '100%',
    display: 'block',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(10,15,26,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  overlayContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  spinner: {
    fontSize: 32,
    animation: 'mnemo-pulse 1.5s ease-in-out infinite',
  },
  overlayText: {
    color: '#94a3b8',
    fontSize: '0.8rem',
    fontWeight: 500,
  },
  errorBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    background: 'rgba(30,10,10,0.95)',
    borderTop: '1px solid rgba(248,113,113,0.3)',
    padding: '0.5rem 0.75rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '0.75rem',
    zIndex: 10,
  },
  retryBtn: {
    background: 'rgba(248,113,113,0.15)',
    border: '1px solid rgba(248,113,113,0.3)',
    borderRadius: 4,
    padding: '0.25rem 0.6rem',
    color: '#f87171',
    cursor: 'pointer',
    fontSize: '0.7rem',
    fontWeight: 600,
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.2rem 0.75rem',
    background: '#0d1117',
    borderTop: '1px solid rgba(100,116,139,0.15)',
    fontSize: '0.65rem',
    flexShrink: 0,
  },
  statusUrl: {
    flex: 1,
    color: '#475569',
    fontFamily: 'monospace',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
};
