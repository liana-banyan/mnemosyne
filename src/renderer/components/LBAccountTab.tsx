// LBAccountTab.tsx — Tab 14 "LB Account"
// BP065 Part A (SEG-D2a) + Part B (SEG-C2b) · Mnemosyne v0.1.22
//
// States:
//   Unlinked  — email input + "Link My LB Account" CTA
//   Linking   — spinner + "Check your email…" message
//   Linked    — account info + Frontier registration section + Unlink button
//
// Frontier section (gated on LB Account being linked):
//   Unregistered — "Join the Frontier" button (explicit opt-in with disclosure)
//   Registered   — node info + last heartbeat + "Leave the Frontier" button

import React, { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LBAccountState {
  linked: boolean;
  user_id?: string;
  email?: string;
  peer_id?: string;
  linked_at?: string;
  crewman_number?: number;
}

interface FrontierState {
  registered: boolean;
  frontier_node_id?: string;
  last_heartbeat?: string;
}

type LinkPhase = 'idle' | 'sending' | 'sent' | 'error';

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  root: {
    padding: 24,
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: 20,
    maxWidth: 560,
  },
  heading: {
    fontSize: 15,
    fontWeight: 700,
    color: '#e2e8f0',
    margin: 0,
  },
  sub: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 1.6,
    margin: 0,
  },
  card: {
    background: 'rgba(15,23,42,0.6)',
    border: '1px solid rgba(100,116,139,0.25)',
    borderRadius: 10,
    padding: '16px 18px',
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: 12,
  },
  cardGreen: {
    background: 'rgba(6,78,59,0.2)',
    border: '1px solid rgba(110,231,183,0.3)',
    borderRadius: 10,
    padding: '16px 18px',
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: 12,
  },
  label: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: 600,
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
  },
  value: {
    fontSize: 12,
    color: '#e2e8f0',
    fontFamily: 'monospace',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    background: 'rgba(15,23,42,0.8)',
    border: '1px solid rgba(100,116,139,0.35)',
    borderRadius: 6,
    color: '#e2e8f0',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  btnPrimary: {
    padding: '8px 18px',
    background: 'rgba(110,231,183,0.12)',
    border: '1px solid rgba(110,231,183,0.35)',
    borderRadius: 6,
    color: '#6ee7b7',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  btnDanger: {
    padding: '6px 14px',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: 6,
    color: '#f87171',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnFrontier: {
    padding: '8px 18px',
    background: 'rgba(250,204,21,0.08)',
    border: '1px solid rgba(250,204,21,0.3)',
    borderRadius: 6,
    color: '#facc15',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  error: {
    fontSize: 11,
    color: '#f87171',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 6,
    padding: '6px 10px',
  },
  success: {
    fontSize: 11,
    color: '#6ee7b7',
    background: 'rgba(110,231,183,0.08)',
    border: '1px solid rgba(110,231,183,0.2)',
    borderRadius: 6,
    padding: '6px 10px',
  },
  row: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  tag: (color: string) => ({
    fontSize: 9,
    fontWeight: 700,
    padding: '2px 6px',
    borderRadius: 10,
    background: `rgba(${color},0.12)`,
    border: `1px solid rgba(${color},0.3)`,
    color: `rgb(${color})`,
    whiteSpace: 'nowrap' as const,
  }),
};

// ─── Component ────────────────────────────────────────────────────────────────

export function LBAccountTab() {
  const [accountState, setAccountState] = useState<LBAccountState>({ linked: false });
  const [frontierState, setFrontierState] = useState<FrontierState>({ registered: false });
  const [email, setEmail] = useState('');
  const [linkPhase, setLinkPhase] = useState<LinkPhase>('idle');
  const [linkError, setLinkError] = useState('');
  const [frontierBusy, setFrontierBusy] = useState(false);
  const [frontierError, setFrontierError] = useState('');
  const [revokeBusy, setRevokeBusy] = useState(false);

  const loadState = useCallback(async () => {
    if (!window.amplify?.lbGetSession) return;
    try {
      const session = await window.amplify.lbGetSession();
      setAccountState(session);
      if (session.linked) {
        const frontier = await window.amplify.lbGetFrontierStatus?.();
        if (frontier) setFrontierState(frontier);
      }
    } catch {
      // Ignore load errors
    }
  }, []);

  useEffect(() => {
    void loadState();

    // Listen for auth-complete broadcasts (from deep-link or link-device IPC)
    const cleanup = window.amplify?.onLbAuthComplete?.((session: { user_id: string; email: string; peer_id: string; crewman_number?: number }) => {
      setAccountState({ linked: true, ...session });
      setLinkPhase('idle');
    });

    return cleanup ?? undefined;
  }, [loadState]);

  async function handleStartAuth() {
    if (!email.trim() || !window.amplify?.lbStartAuth) return;
    setLinkPhase('sending');
    setLinkError('');
    try {
      const result = await window.amplify.lbStartAuth(email.trim());
      if (result.ok) {
        setLinkPhase('sent');
      } else {
        setLinkError(result.error ?? 'Failed to send magic link. Check your email and try again.');
        setLinkPhase('error');
      }
    } catch (err) {
      setLinkError((err as Error).message);
      setLinkPhase('error');
    }
  }

  async function handleRevoke() {
    if (!window.amplify?.lbRevokeDevice) return;
    setRevokeBusy(true);
    try {
      await window.amplify.lbWithdrawFrontierNode?.();
      await window.amplify.lbRevokeDevice();
      setAccountState({ linked: false });
      setFrontierState({ registered: false });
      setLinkPhase('idle');
      setEmail('');
    } catch {
      // Ignore
    } finally {
      setRevokeBusy(false);
    }
  }

  async function handleJoinFrontier() {
    if (!window.amplify?.lbRegisterFrontierNode) return;
    setFrontierBusy(true);
    setFrontierError('');
    try {
      const result = await window.amplify.lbRegisterFrontierNode();
      if (result.ok) {
        setFrontierState({ registered: true, frontier_node_id: result.frontier_node_id });
      } else {
        setFrontierError(result.error ?? 'Registration failed.');
      }
    } catch (err) {
      setFrontierError((err as Error).message);
    } finally {
      setFrontierBusy(false);
    }
  }

  async function handleLeaveFrontier() {
    if (!window.amplify?.lbWithdrawFrontierNode) return;
    setFrontierBusy(true);
    try {
      await window.amplify.lbWithdrawFrontierNode();
      setFrontierState({ registered: false });
    } catch {
      // Ignore
    } finally {
      setFrontierBusy(false);
    }
  }

  return (
    <div style={s.root}>
      {/* Header */}
      <div>
        <h2 style={s.heading}>LB Account</h2>
        <p style={{ ...s.sub, marginTop: 6 }}>
          Link your Liana Banyan cooperative account to this device. Enables
          Frontier node registration, shared-substrate credits, and Crewman attribution.
        </p>
      </div>

      {/* ── Linked State ── */}
      {accountState.linked ? (
        <>
          <div style={s.cardGreen}>
            <div style={s.row}>
              <span style={{ fontSize: 18 }}>✅</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#6ee7b7' }}>LB Account Linked</div>
                {accountState.crewman_number && (
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    Crewman #{accountState.crewman_number} on this device
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {accountState.email && (
                <div>
                  <div style={s.label}>Email</div>
                  <div style={s.value}>{accountState.email}</div>
                </div>
              )}
              {accountState.linked_at && (
                <div>
                  <div style={s.label}>Linked</div>
                  <div style={{ ...s.value, fontSize: 11 }}>
                    {new Date(accountState.linked_at).toLocaleDateString()}
                  </div>
                </div>
              )}
              {accountState.peer_id && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={s.label}>Peer ID</div>
                  <div style={{ ...s.value, fontSize: 10, opacity: 0.7 }}>
                    {accountState.peer_id.slice(0, 20)}…
                  </div>
                </div>
              )}
            </div>
            <div>
              <button
                style={s.btnDanger}
                onClick={handleRevoke}
                disabled={revokeBusy}
              >
                {revokeBusy ? 'Unlinking…' : 'Unlink This Device'}
              </button>
            </div>
          </div>

          {/* ── Frontier Section (gated on linked) ── */}
          <FrontierSection
            frontierState={frontierState}
            busy={frontierBusy}
            error={frontierError}
            onJoin={handleJoinFrontier}
            onLeave={handleLeaveFrontier}
          />
        </>
      ) : (
        /* ── Unlinked State ── */
        <div style={s.card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
            Connect your Liana Banyan account
          </div>
          <p style={s.sub}>
            Enter your LB account email. We'll send a one-click magic link — no password needed.
            Click the link in your email and this device links automatically.
          </p>

          {linkPhase === 'sent' ? (
            <div style={s.success}>
              ✉️ Magic link sent to <strong>{email}</strong>. Check your email and click the link to complete linking.
              The tab will update automatically when your device is linked.
            </div>
          ) : (
            <>
              <div style={s.row}>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleStartAuth()}
                  style={s.input}
                  disabled={linkPhase === 'sending'}
                  autoComplete="email"
                />
                <button
                  style={s.btnPrimary}
                  onClick={handleStartAuth}
                  disabled={linkPhase === 'sending' || !email.trim()}
                >
                  {linkPhase === 'sending' ? '⟳ Sending…' : 'Link →'}
                </button>
              </div>
              {linkError && <div style={s.error}>⚠ {linkError}</div>}
              {linkPhase !== 'sending' && (
                <p style={{ ...s.sub, fontSize: 10 }}>
                  Don't have an LB account?{' '}
                  <button
                    style={{ background: 'none', border: 'none', color: '#6ee7b7', cursor: 'pointer', fontSize: 10, padding: 0, textDecoration: 'underline' }}
                    onClick={() => window.amplify?.openExternal?.('https://lianabanyan.com/join')}
                  >
                    Join — $5/year →
                  </button>
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Frontier Section ─────────────────────────────────────────────────────────

function FrontierSection({
  frontierState,
  busy,
  error,
  onJoin,
  onLeave,
}: {
  frontierState: FrontierState;
  busy: boolean;
  error: string;
  onJoin: () => void;
  onLeave: () => void;
}) {
  return (
    <div style={s.card}>
      <div style={s.row}>
        <span style={{ fontSize: 16 }}>🌐</span>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
          The Frontier
        </div>
        {frontierState.registered && (
          <span style={s.tag('110,231,183')}>REGISTERED</span>
        )}
      </div>

      {frontierState.registered ? (
        <>
          <p style={s.sub}>
            Your device is visible in the cooperative Frontier mesh. Withdraw anytime — this only
            removes your node from the public registry, not from the cooperative.
          </p>
          {frontierState.frontier_node_id && (
            <div>
              <div style={s.label}>Node ID</div>
              <div style={{ ...s.value, fontSize: 10 }}>
                {frontierState.frontier_node_id.slice(0, 28)}…
              </div>
            </div>
          )}
          <div style={s.row}>
            <span style={{ fontSize: 10, color: '#475569' }}>
              Heartbeat: every 5 minutes
            </span>
          </div>
          <button style={s.btnDanger} onClick={onLeave} disabled={busy}>
            {busy ? 'Withdrawing…' : 'Leave the Frontier'}
          </button>
        </>
      ) : (
        <>
          <p style={s.sub}>
            Making your device visible in the Frontier cooperative mesh enables substrate
            peer-sync and shared memory across nodes. You can withdraw at any time.
          </p>
          <p style={{ ...s.sub, fontSize: 10, color: '#475569' }}>
            ⚠ This makes your device visible in the cooperative mesh. Withdraw anytime. Reinstalling
            Mnemosyne creates a new peer ID — the old node will be orphaned until you withdraw it.
          </p>
          {error && <div style={s.error}>⚠ {error}</div>}
          <button style={s.btnFrontier} onClick={onJoin} disabled={busy}>
            {busy ? 'Registering…' : 'Join the Frontier →'}
          </button>
        </>
      )}
    </div>
  );
}
