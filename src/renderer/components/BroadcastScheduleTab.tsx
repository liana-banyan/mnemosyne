// BroadcastScheduleTab.tsx — BP063 SEG-2 · Tab 14
// Opening Gambit Broadcast Schedule / TV-Guide embedded view.
// Loads platform route /staff/launch-schedule via Electron <webview>.
// Fallback: open-in-platform button when webview tag is unavailable.
//
// Opening Gambit: 7-day coordinated social launch sequence across
// Twitter/X, Bluesky, LinkedIn — 4 posts/day, 2h minimum spacing.
// "As You Wish" confirmation gate before any post fires.

import React, { useRef, useState, useCallback, useEffect } from 'react';

const SCHEDULE_URL = 'https://lianabanyan.com/staff/launch-schedule';
const AS_YOU_WISH_URL = 'https://lianabanyan.com/as-you-wish';

interface WebviewElement extends HTMLElement {
  src: string;
  loadURL: (url: string) => void;
  getURL: () => string;
  addEventListener(event: 'did-navigate' | 'did-finish-load' | 'did-start-loading', handler: (e: { url?: string }) => void): void;
  addEventListener(event: string, handler: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
  removeEventListener(event: string, handler: EventListenerOrEventListenerObject): void;
}

export function BroadcastScheduleTab() {
  const webviewRef = useRef<WebviewElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUrl, setCurrentUrl] = useState(SCHEDULE_URL);
  const [webviewAvailable] = useState(() => {
    // Electron webview tag is available when running inside Electron with webviewTag: true
    try {
      return typeof window !== 'undefined' && typeof (window as { amplify?: unknown }).amplify !== 'undefined';
    } catch {
      return false;
    }
  });

  const attachListeners = useCallback((wv: WebviewElement) => {
    wv.addEventListener('did-start-loading', () => setLoading(true));
    wv.addEventListener('did-finish-load', () => setLoading(false));
    wv.addEventListener('did-navigate', (e) => {
      const url = (e as { url?: string }).url;
      if (url) setCurrentUrl(url);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const wv = webviewRef.current;
    if (wv) attachListeners(wv);
  }, [attachListeners]);

  function openExternal(url: string) {
    (window as { amplify?: { openExternal?: (u: string) => void } }).amplify?.openExternal?.(url);
  }

  function reload() {
    if (webviewRef.current) {
      setLoading(true);
      webviewRef.current.loadURL(currentUrl);
    }
  }

  return (
    <div style={styles.container}>
      {/* Header bar */}
      <div style={styles.headerBar}>
        <div style={styles.headerLeft}>
          <span style={styles.headerIcon}>📡</span>
          <div>
            <div style={styles.headerTitle}>Broadcast Schedule</div>
            <div style={styles.headerSub}>Opening Gambit · 7-day social launch sequence</div>
          </div>
        </div>
        <div style={styles.headerActions}>
          {loading && (
            <span style={styles.loadingBadge}>loading…</span>
          )}
          <button
            style={styles.actionBtn}
            onClick={reload}
            title="Reload broadcast schedule"
          >
            ↺ Reload
          </button>
          <button
            style={{ ...styles.actionBtn, ...styles.actionBtnGreen }}
            onClick={() => openExternal(AS_YOU_WISH_URL)}
            title="Open As You Wish confirmation gate"
          >
            ⚔️ As You Wish
          </button>
          <button
            style={styles.actionBtn}
            onClick={() => openExternal(SCHEDULE_URL)}
            title="Open in platform browser"
          >
            ↗ Open in Platform
          </button>
        </div>
      </div>

      {/* Webview or fallback */}
      <div style={styles.body}>
        {webviewAvailable ? (
          <webview
            ref={(el) => {
              if (el && el !== webviewRef.current) {
                webviewRef.current = el as unknown as WebviewElement;
                attachListeners(el as unknown as WebviewElement);
              }
            }}
            src={SCHEDULE_URL}
            style={styles.webview}
            /* @ts-expect-error — webview is an Electron custom element not in React types */
            allowpopups="true"
          />
        ) : (
          <FallbackView onOpen={() => openExternal(SCHEDULE_URL)} />
        )}
      </div>

      {/* Footer: day legend */}
      <div style={styles.footer}>
        <span style={styles.footerItem}>Day 1 · THE PAIN</span>
        <span style={styles.footerDot}>·</span>
        <span style={styles.footerItem}>Day 2 · THE VISION</span>
        <span style={styles.footerDot}>·</span>
        <span style={styles.footerItem}>Day 3 · THE PROOF</span>
        <span style={styles.footerDot}>·</span>
        <span style={styles.footerItem}>Days 4–7 · PEOPLE · ARCHITECTURE · CONSOLIDATION</span>
        <span style={styles.footerDot}>·</span>
        <span style={{ ...styles.footerItem, color: '#facc15' }}>max 4 posts/day · 2h min gap · NOTHING fires without "As You Wish"</span>
      </div>
    </div>
  );
}

function FallbackView({ onOpen }: { onOpen: () => void }) {
  const days = [
    { day: 1, theme: 'THE PAIN', platforms: 'Twitter/X · Bluesky', posts: 4 },
    { day: 2, theme: 'THE VISION', platforms: 'Twitter/X · LinkedIn', posts: 4 },
    { day: 3, theme: 'THE PROOF', platforms: 'Twitter/X · LinkedIn · Bluesky', posts: 3 },
    { day: 4, theme: 'THE PEOPLE', platforms: 'Twitter/X · LinkedIn', posts: 3 },
    { day: 5, theme: 'THE ARCHITECTURE', platforms: 'LinkedIn · Twitter/X', posts: 3 },
    { day: 6, theme: 'CONSOLIDATION', platforms: 'All platforms', posts: 0, engagement: true },
    { day: 7, theme: 'CONSOLIDATION', platforms: 'All platforms', posts: 0, engagement: true },
  ];

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '20px 24px 32px' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
          Opening Gambit — 7-Day TV Guide
        </div>
        <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.6, marginBottom: 12 }}>
          Coordinated multi-platform launch sequence. Loaded into The Battery.
          Nothing fires until "As You Wish" confirmation.
        </div>
        <button
          onClick={onOpen}
          style={{
            background: 'rgba(110,231,183,0.12)',
            border: '1px solid rgba(110,231,183,0.3)',
            borderRadius: 8,
            color: '#6ee7b7',
            fontSize: 11,
            fontWeight: 600,
            padding: '8px 16px',
            cursor: 'pointer',
          }}
        >
          Open Full Schedule in Platform →
        </button>
      </div>

      {/* Day grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {days.map(({ day, theme, platforms, posts, engagement }) => (
          <div
            key={day}
            style={{
              background: 'rgba(15,23,42,0.6)',
              border: '1px solid rgba(100,116,139,0.15)',
              borderRadius: 10,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
              background: engagement ? 'rgba(100,116,139,0.15)' : 'rgba(110,231,183,0.1)',
              border: `1px solid ${engagement ? 'rgba(100,116,139,0.3)' : 'rgba(110,231,183,0.3)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 800,
              color: engagement ? '#475569' : '#6ee7b7',
            }}>
              D{day}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>
                {theme}
              </div>
              <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>
                {platforms}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {engagement ? (
                <span style={{ fontSize: 9, color: '#475569', fontStyle: 'italic' }}>engage only</span>
              ) : (
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  color: '#6ee7b7',
                  background: 'rgba(110,231,183,0.08)',
                  border: '1px solid rgba(110,231,183,0.2)',
                  borderRadius: 6, padding: '2px 8px',
                }}>
                  {posts} post{posts !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: 16, padding: '10px 14px',
        background: 'rgba(250,204,21,0.06)',
        border: '1px solid rgba(250,204,21,0.18)',
        borderRadius: 8, fontSize: 10, color: '#fbbf24',
        lineHeight: 1.6,
      }}>
        ⚔️ All posts require "As You Wish" confirmation before firing.
        Max 4 posts/day · minimum 2 hours between posts.
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
  headerBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    background: 'rgba(15,23,42,0.8)',
    borderBottom: '1px solid rgba(100,116,139,0.2)',
    flexShrink: 0,
    gap: 12,
    flexWrap: 'wrap' as const,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    fontSize: 22,
    lineHeight: 1,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: '#e2e8f0',
  },
  headerSub: {
    fontSize: 9,
    color: '#475569',
    marginTop: 1,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap' as const,
  },
  loadingBadge: {
    fontSize: 9,
    color: '#6ee7b7',
    background: 'rgba(110,231,183,0.08)',
    border: '1px solid rgba(110,231,183,0.2)',
    borderRadius: 10,
    padding: '2px 8px',
    animation: 'none',
  },
  actionBtn: {
    background: 'rgba(100,116,139,0.1)',
    border: '1px solid rgba(100,116,139,0.25)',
    borderRadius: 6,
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: 600,
    padding: '4px 10px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  actionBtnGreen: {
    background: 'rgba(110,231,183,0.08)',
    border: '1px solid rgba(110,231,183,0.25)',
    color: '#6ee7b7',
  },
  body: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative' as const,
  },
  webview: {
    width: '100%',
    height: '100%',
    display: 'block',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap' as const,
    padding: '4px 12px',
    background: 'rgba(10,15,26,0.9)',
    borderTop: '1px solid rgba(100,116,139,0.12)',
    flexShrink: 0,
  },
  footerItem: {
    fontSize: 8,
    color: '#334155',
    whiteSpace: 'nowrap' as const,
  },
  footerDot: {
    fontSize: 8,
    color: '#1e293b',
  },
};
