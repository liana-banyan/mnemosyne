// WAN Status Bar — SEG-WAN-2 · relay escalation heartbeat
// Listens on wan-status-update IPC; fades after 30s idle.

import React, { useState, useEffect } from 'react';

const FADE_MS = 300;
const STALE_MS = 30_000;

export function WanStatusBar() {
  const [wanStatus, setWanStatus] = useState('');
  const [visible, setVisible] = useState(false);
  const [lastTs, setLastTs] = useState(0);

  useEffect(() => {
    const onUpdate = (payload: { status: string; ts: string }) => {
      if (!payload?.status) return;
      setWanStatus(payload.status);
      setLastTs(Date.now());
      setVisible(true);
    };

    const unsub = (window.amplify as { onWanStatusUpdate?: (cb: (p: { status: string; ts: string }) => void) => () => void })
      ?.onWanStatusUpdate?.(onUpdate);

    const staleCheck = setInterval(() => {
      if (lastTs > 0 && Date.now() - lastTs > STALE_MS) {
        setVisible(false);
        setTimeout(() => setWanStatus(''), FADE_MS);
      }
    }, 1000);

    return () => {
      unsub?.();
      clearInterval(staleCheck);
    };
  }, [lastTs]);

  if (!wanStatus) return null;

  return (
    <div
      style={{
        fontSize: 10,
        color: '#94a3b8',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
        opacity: visible ? 1 : 0,
        transition: `opacity ${FADE_MS}ms ease`,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: '#38bdf8',
          display: 'inline-block',
          boxShadow: visible ? '0 0 4px #38bdf8' : 'none',
        }}
      />
      {wanStatus}
    </div>
  );
}
