// MnemosyneC · v0.2.0 · BP082 · LeanHelpTab — Connect Reddit Card
// Sonnet 4.6 · Founder-ratified
//
// Mirror of ConnectDiscordCard for Reddit OAuth.
// Scopes: identity, read, submit, vote, subscribe, mysubreddits
// Client ID from REDDIT_OAUTH_CLIENT_ID env var (main process).
// Redirect: mnemo://oauth/reddit/callback

import React, { useState, useCallback } from 'react';

interface RedditState {
  connected: boolean;
  username?: string;
  scopes?: string[];
}

const LS_REDDIT_STATE = 'mnemo_reddit_connection';

function loadRedditState(): RedditState {
  try {
    const raw = localStorage.getItem(LS_REDDIT_STATE);
    if (!raw) return { connected: false };
    return JSON.parse(raw) as RedditState;
  } catch {
    return { connected: false };
  }
}

function saveRedditState(state: RedditState) {
  localStorage.setItem(LS_REDDIT_STATE, JSON.stringify(state));
}

interface ConnectRedditCardProps {
  onMarksAccrued?: (delta: number) => void;
}

export function ConnectRedditCard({ onMarksAccrued }: ConnectRedditCardProps) {
  const [state, setState] = useState<RedditState>(loadRedditState);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const result = await window.amplify?.oauth?.startFlow?.('reddit');
      if (!result) {
        setError('OAuth not available — app registration required. See yoke-return for setup steps.');
        return;
      }
      if (result.needsRegistration) {
        setError('Reddit OAuth app not yet registered. Founder: visit reddit.com/prefs/apps to register "MnemosyneC Substrate Filter" and add REDDIT_OAUTH_CLIENT_ID to your env.');
        return;
      }
      if (!result.success) {
        setError(result.error ?? 'Connection failed. Please try again.');
        return;
      }
      const newState: RedditState = {
        connected: true,
        username: result.username,
        scopes: result.scopes,
      };
      setState(newState);
      saveRedditState(newState);
      void window.amplify?.oauth?.accrueConnectMarks?.('reddit', 5);
      onMarksAccrued?.(5);
      showToast('✦ Connected! +5 Marks earned.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unexpected error. Please try again.');
    } finally {
      setConnecting(false);
    }
  }, [onMarksAccrued, showToast]);

  const handleDisconnect = useCallback(() => {
    const ok = window.confirm('Disconnect your Reddit account from MnemosyneC?');
    if (!ok) return;
    const cleared = { connected: false };
    setState(cleared);
    saveRedditState(cleared);
    void window.amplify?.oauth?.revokeToken?.('reddit');
    showToast('Reddit disconnected.');
  }, [showToast]);

  return (
    <div style={s.card}>
      <div style={s.header}>
        <span style={s.platformIcon}>🟠</span>
        <div style={{ flex: 1 }}>
          <div style={s.platformName}>Reddit</div>
          <div style={s.platformSub}>
            {state.connected
              ? `Connected as u/${state.username}`
              : 'Full read-write · posts, comments, votes'}
          </div>
        </div>
        {state.connected && (
          <span style={s.connectedBadge}>● Connected</span>
        )}
      </div>

      {!state.connected && (
        <p style={s.description}>
          Join r/LianaBanyanGuild. Use Reddit through MnemosyneC — save any answer to your
          Substrate with one click. Earn <strong style={{ color: '#6ee7b7' }}>✦ 5 Marks</strong> for connecting.
        </p>
      )}

      {error && (
        <div style={s.errorBox} role="alert">
          {error}
        </div>
      )}

      {toast && (
        <div style={s.toastBox} role="status" aria-live="polite">
          {toast}
        </div>
      )}

      {!state.connected ? (
        <button
          type="button"
          onClick={handleConnect}
          disabled={connecting}
          style={{ ...s.connectBtn, opacity: connecting ? 0.6 : 1 }}
        >
          {connecting ? 'Connecting…' : '🟠 Connect Reddit'}
        </button>
      ) : (
        <div style={s.connectedControls}>
          <p style={s.connectedHelp}>
            📚 Save any Reddit post or comment to your Substrate — each capture earns{' '}
            <strong style={{ color: '#6ee7b7' }}>✦ 1 Mark</strong>.
          </p>
          <button
            type="button"
            onClick={() => window.amplify?.openExternal?.('https://www.reddit.com/r/LianaBanyanGuild/')}
            style={s.openBtn}
          >
            Open Reddit →
          </button>
          <button
            type="button"
            onClick={handleDisconnect}
            style={s.disconnectBtn}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

const s = {
  card: {
    background: '#0d1117',
    border: '1px solid #1e2a38',
    borderRadius: 8,
    padding: '14px 16px',
    marginBottom: 10,
  } as React.CSSProperties,
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  } as React.CSSProperties,
  platformIcon: {
    fontSize: 20,
    flexShrink: 0,
  } as React.CSSProperties,
  platformName: {
    fontSize: 14,
    fontWeight: 700,
    color: '#f0fdf4',
  } as React.CSSProperties,
  platformSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  } as React.CSSProperties,
  connectedBadge: {
    fontSize: 11,
    color: '#4ade80',
    flexShrink: 0,
  } as React.CSSProperties,
  description: {
    margin: '0 0 10px',
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 1.6,
  } as React.CSSProperties,
  errorBox: {
    background: '#1a0a0a',
    border: '1px solid #4a1515',
    borderRadius: 5,
    padding: '7px 10px',
    fontSize: 11,
    color: '#f87171',
    marginBottom: 10,
    lineHeight: 1.55,
  } as React.CSSProperties,
  toastBox: {
    background: '#064e3b',
    border: '1px solid #059669',
    borderRadius: 5,
    padding: '5px 10px',
    fontSize: 11,
    color: '#6ee7b7',
    marginBottom: 10,
  } as React.CSSProperties,
  connectBtn: {
    background: '#ff4500',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '7px 16px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif',
    outline: 'none',
    transition: 'opacity 0.15s',
  } as React.CSSProperties,
  connectedControls: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 8,
    alignItems: 'flex-start',
  } as React.CSSProperties,
  connectedHelp: {
    width: '100%',
    margin: '0 0 8px',
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 1.6,
  } as React.CSSProperties,
  openBtn: {
    background: '#ff4500',
    color: '#fff',
    border: 'none',
    borderRadius: 5,
    padding: '5px 12px',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif',
    outline: 'none',
  } as React.CSSProperties,
  disconnectBtn: {
    background: 'none',
    border: '1px solid #334155',
    borderRadius: 5,
    color: '#64748b',
    fontSize: 11,
    padding: '5px 10px',
    cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif',
    outline: 'none',
  } as React.CSSProperties,
};
