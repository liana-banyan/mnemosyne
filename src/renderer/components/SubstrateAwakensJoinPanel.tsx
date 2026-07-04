// SubstrateAwakensJoinPanel.tsx — BP084 SEG-3
// Settings panel: "Substrate Awakens — Join Live Event"
// Guides a fresh installer through the email-token → mesh-handshake join flow.

import React, { useState, useEffect } from 'react';

type FlowState = 'loading' | 'not-joined' | 'token-sent' | 'joining' | 'joined' | 'error';

interface JoinedInfo {
  peerId: string;
  displayName: string;
  joinedAt?: string;
}

const s = {
  section: {
    marginBottom: 16,
  } as React.CSSProperties,
  header: {
    fontSize: 11,
    fontWeight: 600,
    color: '#94a3b8',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 8,
  } as React.CSSProperties,
  card: {
    background: 'rgba(15,23,42,0.7)',
    border: '1px solid rgba(51,65,85,0.5)',
    borderRadius: 8,
    padding: '14px 16px',
  } as React.CSSProperties,
  label: {
    fontSize: 10,
    color: '#94a3b8',
    marginBottom: 4,
    fontWeight: 500,
  } as React.CSSProperties,
  input: {
    width: '100%',
    background: 'rgba(30,41,59,0.8)',
    border: '1px solid rgba(71,85,105,0.6)',
    borderRadius: 6,
    color: '#e2e8f0',
    fontSize: 12,
    padding: '7px 10px',
    outline: 'none',
    boxSizing: 'border-box' as const,
    marginBottom: 10,
  } as React.CSSProperties,
  btn: {
    background: 'rgba(99,102,241,0.15)',
    border: '1px solid rgba(99,102,241,0.4)',
    borderRadius: 6,
    color: '#818cf8',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    padding: '7px 14px',
  } as React.CSSProperties,
  btnGreen: {
    background: 'rgba(52,211,153,0.15)',
    border: '1px solid rgba(52,211,153,0.4)',
    borderRadius: 6,
    color: '#34d399',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    padding: '7px 14px',
  } as React.CSSProperties,
  btnLink: {
    background: 'none',
    border: 'none',
    color: '#64748b',
    fontSize: 10,
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
  } as React.CSSProperties,
  hint: {
    fontSize: 9,
    color: '#475569',
    lineHeight: 1.6,
    marginTop: 4,
  } as React.CSSProperties,
  errorBox: {
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 6,
    color: '#f87171',
    fontSize: 10,
    padding: '8px 10px',
    marginTop: 8,
  } as React.CSSProperties,
  successBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: 'rgba(52,211,153,0.1)',
    border: '1px solid rgba(52,211,153,0.35)',
    borderRadius: 6,
    color: '#34d399',
    fontSize: 11,
    fontWeight: 600,
    padding: '6px 10px',
  } as React.CSSProperties,
  tierBadge: {
    display: 'inline-block',
    background: 'rgba(99,102,241,0.1)',
    border: '1px solid rgba(99,102,241,0.3)',
    borderRadius: 5,
    color: '#a5b4fc',
    fontSize: 9,
    padding: '3px 8px',
    marginTop: 6,
  } as React.CSSProperties,
  numList: {
    paddingLeft: 18,
    margin: '0 0 12px 0',
    fontSize: 10,
    color: '#64748b',
    lineHeight: 1.7,
  } as React.CSSProperties,
  spinner: {
    display: 'inline-block',
    width: 14,
    height: 14,
    border: '2px solid rgba(99,102,241,0.3)',
    borderTopColor: '#818cf8',
    borderRadius: '50%',
    animation: 'sa-spin 0.8s linear infinite',
    marginRight: 8,
    verticalAlign: 'middle',
  } as React.CSSProperties,
};

export function SubstrateAwakensJoinPanel(): JSX.Element {
  const [flow, setFlow] = useState<FlowState>('loading');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [token, setToken] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [joinedInfo, setJoinedInfo] = useState<JoinedInfo | null>(null);
  const [tierLabel, setTierLabel] = useState('Detecting...');
  const [tierModel, setTierModel] = useState('');

  // Detect hardware tier via register call (just to display info; no side effects)
  // We use a lightweight approach: call getState on mount and show tier from that context.
  // Tier detection happens in the handshake call on the main side.
  useEffect(() => {
    // Restore joined state from previous session
    (async () => {
      try {
        const state = await window.amplify?.substrateAwakensGetState?.();
        if (state?.joined && state.peerId && state.displayName) {
          setJoinedInfo({ peerId: state.peerId, displayName: state.displayName, joinedAt: state.joinedAt });
          setFlow('joined');
        } else {
          setFlow('not-joined');
        }
      } catch {
        setFlow('not-joined');
      }
    })();

    // Detect tier label client-side from navigator.deviceMemory if available, else show generic
    const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
    if (mem) {
      if (mem < 12) { setTierLabel('Lightweight'); setTierModel('gemma2:2b'); }
      else if (mem < 16) { setTierLabel('Standard'); setTierModel('qwen2.5:7b'); }
      else { setTierLabel('Premium'); setTierModel('gemma4:12b'); }
    } else {
      setTierLabel('Premium'); setTierModel('gemma4:12b');
    }
  }, []);

  async function handleRegister() {
    if (!email.trim() || !displayName.trim()) {
      setErrorMsg('Please enter your email and a display name.');
      return;
    }
    setErrorMsg('');
    setFlow('joining');

    try {
      const result = await window.amplify?.substrateAwakensRegister?.(
        email.trim(),
        displayName.trim(),
        tierLabel.toLowerCase(),
      );
      if (result?.success) {
        setFlow('token-sent');
      } else {
        setErrorMsg(result?.error ?? 'Registration failed. Please try again.');
        setFlow('not-joined');
      }
    } catch (err) {
      setErrorMsg(`Unexpected error: ${String(err)}`);
      setFlow('not-joined');
    }
  }

  async function handleHandshake() {
    if (!token.trim()) {
      setErrorMsg('Please paste your token from the email.');
      return;
    }
    setErrorMsg('');
    setFlow('joining');

    try {
      const result = await window.amplify?.substrateAwakensHandshake?.(
        token.trim(),
        email.trim(),
        displayName.trim(),
      );
      if (result?.success && result.peerId) {
        setJoinedInfo({ peerId: result.peerId, displayName: result.displayName ?? displayName });
        setFlow('joined');
      } else {
        setErrorMsg(result?.error ?? 'Handshake failed. Check your token and try again.');
        setFlow('token-sent');
      }
    } catch (err) {
      setErrorMsg(`Unexpected error: ${String(err)}`);
      setFlow('token-sent');
    }
  }

  function handleBack() {
    setErrorMsg('');
    setToken('');
    setFlow('not-joined');
  }

  if (flow === 'loading') {
    return (
      <section style={s.section}>
        <div style={s.header}>Substrate Awakens: Join Live Event</div>
        <div style={s.card}>
          <div style={{ fontSize: 10, color: '#64748b', fontStyle: 'italic' }}>Loading…</div>
        </div>
      </section>
    );
  }

  if (flow === 'joined' && joinedInfo) {
    return (
      <section style={s.section}>
        <div style={s.header}>Substrate Awakens: Join Live Event</div>
        <div style={s.card}>
          <div style={s.successBadge}>
            <span>✓</span>
            <span>Connected to live mesh as {joinedInfo.displayName}</span>
          </div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 8 }}>
            Peer ID: <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>{joinedInfo.peerId}</span>
          </div>
          {joinedInfo.joinedAt && (
            <div style={s.hint}>Joined: {new Date(joinedInfo.joinedAt).toLocaleString()}</div>
          )}
          <div style={{ marginTop: 10 }}>
            <button
              style={s.btnGreen}
              onClick={() => window.amplify?.openExternal?.('https://mnemosynec.ai/live/SubstrateAwakens/')}
            >
              View dashboard →
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (flow === 'token-sent' || flow === 'joining') {
    const isBusy = flow === 'joining';
    return (
      <section style={s.section}>
        <div style={s.header}>Substrate Awakens: Join Live Event</div>
        <div style={s.card}>
          <div style={{ fontSize: 11, color: '#e2e8f0', fontWeight: 600, marginBottom: 6 }}>
            {isBusy ? (
              <>
                <span style={s.spinner} />
                Connecting to live mesh…
              </>
            ) : (
              'Check your email for your heartbeat token'
            )}
          </div>
          {!isBusy && (
            <div style={s.hint}>
              An email was sent to <strong style={{ color: '#94a3b8' }}>{email}</strong>. Paste your token below.
            </div>
          )}
          {!isBusy && (
            <>
              <div style={{ marginTop: 10 }}>
                <div style={s.label}>Token from email</div>
                <input
                  style={s.input}
                  type="text"
                  placeholder="Paste your token here…"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  disabled={isBusy}
                />
              </div>
              {errorMsg && <div style={s.errorBox}>{errorMsg}</div>}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
                <button style={s.btnGreen} onClick={handleHandshake} disabled={isBusy}>
                  Join Live Mesh
                </button>
                <button style={s.btnLink} onClick={handleBack}>
                  ← Back
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    );
  }

  // not-joined (default) + error state
  return (
    <section style={s.section}>
      <div style={s.header}>Substrate Awakens: Join Live Event</div>
      <div style={s.card}>
        <ol style={s.numList}>
          <li>Enter your email + display name below</li>
          <li>Click "Send me my token" · we'll email you an HMAC token</li>
          <li>Paste the token back here</li>
          <li>Click "Join Live Mesh" · your node handshakes with the relay</li>
          <li>See your presence confirmed and visit the live dashboard</li>
        </ol>

        <div style={s.tierBadge}>
          Your machine: {tierLabel} · you'll run {tierModel}
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={s.label}>Email</div>
          <input
            style={s.input}
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <div style={s.label}>Display name</div>
          <input
            style={s.input}
            type="text"
            placeholder="e.g. Alice M0"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>

        {errorMsg && <div style={s.errorBox}>{errorMsg}</div>}

        <button style={s.btn} onClick={handleRegister}>
          Send me my token →
        </button>
      </div>
      {/* keyframes injected inline — minimal, scoped */}
      <style>{`@keyframes sa-spin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}
