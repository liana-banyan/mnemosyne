// CommunityConnectButton.tsx — SEG-3 v0.1.55 COMMUNITY-CONNECT
// Every-click-feedback canon: idle · connecting · success · fail (no silent states)

import React, { useState, useCallback, useEffect, useRef } from 'react';

type ConnectState = 'idle' | 'connecting' | 'success' | 'fail';

export function CommunityConnectButton(): React.ReactElement {
  const [state, setState] = useState<ConnectState>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectStartRef = useRef(0);

  const clearHeartbeat = useCallback((): void => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  useEffect(() => (): void => clearHeartbeat(), [clearHeartbeat]);

  const handleConnect = useCallback(async (): Promise<void> => {
    if (state === 'connecting') return;

    setState('connecting');
    setElapsedMs(0);
    connectStartRef.current = Date.now();
    clearHeartbeat();

    heartbeatRef.current = setInterval(() => {
      setElapsedMs(Date.now() - connectStartRef.current);
    }, 2000);

    try {
      const result = await window.amplify?.communityConnectHandshake?.();
      clearHeartbeat();

      if (result?.success) {
        setState('success');
      } else {
        setState('fail');
      }
    } catch {
      clearHeartbeat();
      setState('fail');
    }
  }, [state, clearHeartbeat]);

  const baseBtn: React.CSSProperties = {
    width: '100%',
    padding: '10px 16px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'background 150ms ease, border-color 150ms ease',
  };

  if (state === 'idle') {
    return (
      <button
        type="button"
        onClick={(): void => { void handleConnect(); }}
        style={{
          ...baseBtn,
          background: 'rgba(110, 231, 183, 0.08)',
          border: '1px solid rgba(110, 231, 183, 0.35)',
          color: '#6ee7b7',
        }}
        onMouseEnter={(e): void => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(110, 231, 183, 0.14)';
        }}
        onMouseLeave={(e): void => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(110, 231, 183, 0.08)';
        }}
      >
        Connect to MnemosyneC community
      </button>
    );
  }

  if (state === 'connecting') {
    return (
      <div
        style={{
          ...baseBtn,
          background: 'rgba(96, 165, 250, 0.08)',
          border: '1px solid rgba(96, 165, 250, 0.3)',
          color: '#93c5fd',
          cursor: 'default',
        }}
        aria-live="polite"
      >
        <span
          style={{
            width: 14,
            height: 14,
            border: '2px solid rgba(147, 197, 253, 0.3)',
            borderTopColor: '#93c5fd',
            borderRadius: '50%',
            animation: 'communityConnectSpin 0.8s linear infinite',
            flexShrink: 0,
          }}
        />
        Connecting to MnemosyneC community…
        {elapsedMs >= 2000 && (
          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>
            ({Math.round(elapsedMs / 1000)}s)
          </span>
        )}
        <style>{`@keyframes communityConnectSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div
        style={{
          ...baseBtn,
          background: 'rgba(34, 197, 94, 0.08)',
          border: '1px solid rgba(34, 197, 94, 0.35)',
          color: '#22c55e',
          cursor: 'default',
        }}
        aria-live="polite"
      >
        <span style={{ fontSize: 15, lineHeight: 1 }}>✓</span>
        Connected · 1 peer (FounderDenken)
      </div>
    );
  }

  // fail — retry button visible (every-click-feedback canon)
  return (
    <button
      type="button"
      onClick={(): void => { void handleConnect(); }}
      style={{
        ...baseBtn,
        background: 'rgba(239, 68, 68, 0.08)',
        border: '1px solid rgba(239, 68, 68, 0.35)',
        color: '#f87171',
      }}
      onMouseEnter={(e): void => {
        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239, 68, 68, 0.14)';
      }}
      onMouseLeave={(e): void => {
        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239, 68, 68, 0.08)';
      }}
      aria-live="polite"
    >
      <span style={{ fontSize: 15, lineHeight: 1 }}>✕</span>
      Relay unreachable — retry
    </button>
  );
}

export default CommunityConnectButton;
