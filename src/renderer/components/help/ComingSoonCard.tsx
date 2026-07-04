// MnemosyneC · v0.2.0 · BP082 · LeanHelpTab — Coming Soon Card
// Sonnet 4.6 · Founder-ratified

import React, { useState } from 'react';

interface ComingSoonCardProps {
  name: string;
  why: string;
  eta: string;
  icon?: string;
}

const LS_NOTIFY_PREFIX = 'mnemo_notify_me_';

export function ComingSoonCard({ name, why, eta, icon = '🚀' }: ComingSoonCardProps) {
  const key = LS_NOTIFY_PREFIX + name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const [notified, setNotified] = useState(() => localStorage.getItem(key) === '1');
  const [justSet, setJustSet] = useState(false);

  const handleNotify = () => {
    localStorage.setItem(key, '1');
    setNotified(true);
    setJustSet(true);
    setTimeout(() => setJustSet(false), 2000);
  };

  return (
    <div style={s.card}>
      <div style={s.header}>
        <span style={s.icon}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={s.name}>{name}</div>
          <div style={s.eta}>Coming {eta}</div>
        </div>
        {notified ? (
          <span style={s.notifiedBadge}>
            {justSet ? '✓ You\'re on the list!' : '📬 Notified'}
          </span>
        ) : (
          <button
            type="button"
            onClick={handleNotify}
            style={s.notifyBtn}
            title="Get notified when this launches"
          >
            📬 Notify me
          </button>
        )}
      </div>
      <p style={s.why}>{why}</p>
    </div>
  );
}

const s = {
  card: {
    background: '#0a0f1a',
    border: '1px solid #1e2a38',
    borderRadius: 8,
    padding: '14px 16px',
    marginBottom: 10,
    opacity: 0.85,
  } as React.CSSProperties,
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 6,
  } as React.CSSProperties,
  icon: {
    fontSize: 18,
    flexShrink: 0,
    marginTop: 2,
  } as React.CSSProperties,
  name: {
    fontSize: 13,
    fontWeight: 600,
    color: '#e2e8f0',
  } as React.CSSProperties,
  eta: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
  } as React.CSSProperties,
  why: {
    margin: 0,
    fontSize: 12,
    color: '#64748b',
    lineHeight: 1.6,
  } as React.CSSProperties,
  notifyBtn: {
    background: 'none',
    border: '1px solid #334155',
    borderRadius: 5,
    color: '#94a3b8',
    fontSize: 11,
    padding: '3px 9px',
    cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif',
    outline: 'none',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
  notifiedBadge: {
    fontSize: 11,
    color: '#6ee7b7',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
};
