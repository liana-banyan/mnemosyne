// Mnemosyne — LB Account Tab
// BP065 · Tier-2 Onboarding · Part A (SEG-D2a) + Part B (SEG-C2b)
// Tab: Connect your Liana Banyan account (2a) + Join the Frontier (2b)
//
// States:
//   Not linked → "Connect your Liana Banyan account" CTA (email input + send magic link)
//   Linking    → "Check your email for a magic link…"
//   Linked     → email, peer id, linked date, Crewman #X, Unlink button
//   Frontier   → opt-in CTA (gated on 2a) + registered state + Withdraw
//
// Authored: 2026-05-30T21:30:00Z · Knight BP065

import React, { useState, useEffect, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LBSessionInfo {
  user_id: string;
  email: string;
  peer_id: string;
  linked_at: string;
}

interface FrontierStatus {
  linked: boolean;
  registered: boolean;
  peer_id?: string;
  my_node?: {
    id: string;
    peer_id: string;
    node_label: string | null;
    app_version: string | null;
    registered_at: string;
    last_heartbeat_at: string;
    withdrawn_at: string | null;
  } | null;
  nodes: Array<{
    id: string;
    user_id: string;
    peer_id: string;
    node_label: string | null;
    app_version: string | null;
    registered_at: string;
    last_heartbeat_at: string;
    withdrawn_at: string | null;
  }>;
  heartbeat_active: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shortPeerId(peerId: string): string {
  if (!peerId) return '—';
  return peerId.slice(0, 8) + '…' + peerId.slice(-4);
}

function crewmanNumber(userId: string): string {
  if (!userId) return '?';
  // Derive a stable display number from user_id (first 6 hex digits as decimal, mod 999999)
  const hex = userId.replace(/-/g, '').slice(0, 8);
  const n = parseInt(hex, 16) % 999999;
  return String(n + 1).padStart(5, '0');
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = {
  container: {
    padding: 20,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 20,
    color: '#e2e8f0',
    fontFamily: 'system-ui, sans-serif',
    fontSize: 13,
  },
  section: {
    background: 'rgba(30,41,59,0.5)',
    border: '1px solid rgba(100,116,139,0.2)',
    borderRadius: 10,
    padding: 16,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#6ee7b7',
    marginBottom: 2,
  },
  sectionSub: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 1.5,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  label: {
    color: '#64748b',
    fontSize: 11,
  },
  value: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'monospace',
  },
  input: {
    width: '100%',
    background: 'rgba(15,23,42,0.8)',
    border: '1px solid rgba(100,116,139,0.3)',
    borderRadius: 6,
    color: '#e2e8f0',
    fontSize: 13,
    padding: '8px 10px',
    outline: 'none',
  } as React.CSSProperties,
  btn: (color: string, bg: string): React.CSSProperties => ({
    background: bg,
    border: `1px solid ${color}`,
    borderRadius: 7,
    color,
    fontSize: 12,
    fontWeight: 700,
    padding: '7px 16px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'opacity 0.15s',
  }),
  pill: (color: string): React.CSSProperties => ({
    background: `rgba(${color},0.12)`,
    border: `1px solid rgba(${color},0.3)`,
    borderRadius: 10,
    color: `rgb(${color})`,
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 8px',
    whiteSpace: 'nowrap',
  }),
  error: {
    color: '#f87171',
    fontSize: 11,
    marginTop: 2,
  },
  success: {
    color: '#6ee7b7',
    fontSize: 11,
    marginTop: 2,
  },
  nodeCard: {
    background: 'rgba(15,23,42,0.6)',
    border: '1px solid rgba(100,116,139,0.15)',
    borderRadius: 8,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

export function LBAccountTab() {
  const [session, setSession] = useState<LBSessionInfo | null | undefined>(undefined);
  const [frontier, setFrontier] = useState<FrontierStatus | null>(null);

  // Auth flow state
  const [email, setEmail] = useState('');
  const [authStep, setAuthStep] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [authError, setAuthError] = useState('');
  const [authMsg, setAuthMsg] = useState('');

  // Frontier action state
  const [frontierBusy, setFrontierBusy] = useState(false);
  const [frontierMsg, setFrontierMsg] = useState('');
  const [frontierError, setFrontierError] = useState('');

  const amplify = window.amplify;

  const refreshSession = useCallback(async () => {
    const s = await amplify?.lbGetSession?.() ?? null;
    setSession(s);
    if (s) {
      const f = await amplify?.lbGetFrontierStatus?.() ?? null;
      setFrontier(f);
    } else {
      setFrontier(null);
    }
  }, [amplify]);

  useEffect(() => {
    refreshSession();

    // Listen for deep-link auth-complete events
    const cleanup = amplify?.onLBAuthComplete?.((result) => {
      if (result.ok) {
        setAuthStep('idle');
        setAuthMsg('');
        refreshSession();
      } else {
        setAuthStep('error');
        setAuthError(result.error ?? 'Auth failed — please try again.');
      }
    });

    return () => { cleanup?.(); };
  }, [refreshSession, amplify]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleSendMagicLink() {
    if (!email.trim()) return;
    setAuthStep('sending');
    setAuthError('');
    const result = await amplify?.lbStartAuth?.(email.trim());
    if (result?.ok) {
      setAuthStep('sent');
    } else {
      setAuthStep('error');
      setAuthError(result?.error ?? 'Could not send magic link.');
    }
  }

  async function handleUnlink() {
    setFrontierMsg('');
    setFrontierError('');
    if (frontier?.registered) {
      await amplify?.lbWithdrawFrontierNode?.();
    }
    await amplify?.lbRevokeDevice?.();
    setSession(null);
    setFrontier(null);
    setAuthStep('idle');
  }

  async function handleRegisterFrontier() {
    setFrontierBusy(true);
    setFrontierMsg('');
    setFrontierError('');
    const result = await amplify?.lbRegisterFrontierNode?.();
    if (result?.ok) {
      setFrontierMsg('Your device is now part of the Frontier mesh.');
      await refreshSession();
    } else {
      setFrontierError(result?.error ?? 'Registration failed.');
    }
    setFrontierBusy(false);
  }

  async function handleWithdrawFrontier() {
    setFrontierBusy(true);
    setFrontierMsg('');
    setFrontierError('');
    const result = await amplify?.lbWithdrawFrontierNode?.();
    if (result?.ok) {
      setFrontierMsg('Withdrawn from the Frontier mesh.');
      await refreshSession();
    } else {
      setFrontierError(result?.error ?? 'Withdraw failed.');
    }
    setFrontierBusy(false);
  }

  // ── Render: loading ────────────────────────────────────────────────────────

  if (session === undefined) {
    return (
      <div style={{ ...s.container, alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <span style={{ color: '#64748b', fontSize: 12 }}>Loading…</span>
      </div>
    );
  }

  // ── Render: not linked ─────────────────────────────────────────────────────

  if (!session) {
    return (
      <div style={s.container}>
        {/* 2a — Connect CTA */}
        <div style={s.section}>
          <div style={s.sectionTitle}>🔗 Connect your Liana Banyan account</div>
          <div style={s.sectionSub}>
            Link this Mnemosyne device to your LB membership.
            Enter your LB email — we'll send a magic link to your inbox.
          </div>

          {authStep !== 'sent' ? (
            <>
              <input
                style={s.input}
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSendMagicLink(); }}
                disabled={authStep === 'sending'}
              />
              <div style={s.row}>
                <button
                  style={s.btn('#6ee7b7', 'rgba(110,231,183,0.1)')}
                  onClick={handleSendMagicLink}
                  disabled={authStep === 'sending' || !email.trim()}
                >
                  {authStep === 'sending' ? 'Sending…' : 'Send magic link →'}
                </button>
                {authMsg && <span style={s.success}>{authMsg}</span>}
              </div>
              {authError && <div style={s.error}>{authError}</div>}
            </>
          ) : (
            <>
              <div style={{ ...s.sectionSub, color: '#6ee7b7' }}>
                ✓ Magic link sent to <strong>{email}</strong> — check your inbox and click the link.
              </div>
              <div style={s.sectionSub}>
                Once you click the link, Mnemosyne will complete the connection automatically.
              </div>
              <button
                style={{ ...s.btn('#64748b', 'transparent'), alignSelf: 'flex-start' }}
                onClick={() => { setAuthStep('idle'); setAuthError(''); }}
              >
                Use a different email
              </button>
            </>
          )}
        </div>

        {/* Frontier section — disabled (requires 2a) */}
        <div style={{ ...s.section, opacity: 0.45, pointerEvents: 'none' }}>
          <div style={s.sectionTitle}>🌐 Join the Frontier</div>
          <div style={s.sectionSub}>
            Connect your LB account first to join the public cooperative Frontier mesh.
          </div>
        </div>
      </div>
    );
  }

  // ── Render: linked ─────────────────────────────────────────────────────────

  return (
    <div style={s.container}>
      {/* 2a — Linked state */}
      <div style={s.section}>
        <div style={{ ...s.row, marginBottom: 2 }}>
          <div style={s.sectionTitle}>🔗 Liana Banyan Account</div>
          <span style={s.pill('110,231,183')}>LINKED</span>
        </div>

        <div style={s.row}>
          <span style={s.label}>Account</span>
          <span style={s.value}>{session.email}</span>
        </div>
        <div style={s.row}>
          <span style={s.label}>Peer ID</span>
          <span style={s.value} title={session.peer_id}>{shortPeerId(session.peer_id)}</span>
        </div>
        <div style={s.row}>
          <span style={s.label}>Linked</span>
          <span style={s.value}>{fmtDate(session.linked_at)}</span>
        </div>
        <div style={s.row}>
          <span style={s.label}>Crewman #</span>
          <span style={{ ...s.value, color: '#6ee7b7' }}>#{crewmanNumber(session.user_id)}</span>
        </div>

        <div style={{ marginTop: 4 }}>
          <button
            style={s.btn('#f87171', 'rgba(248,113,113,0.08)')}
            onClick={handleUnlink}
          >
            Unlink this device
          </button>
        </div>
      </div>

      {/* 2b — Frontier section */}
      <div style={s.section}>
        <div style={{ ...s.row, marginBottom: 2 }}>
          <div style={s.sectionTitle}>🌐 The Frontier</div>
          {frontier?.registered && (
            <span style={s.pill('110,231,183')}>NODE ACTIVE</span>
          )}
        </div>

        {!frontier?.registered ? (
          <>
            <div style={s.sectionSub}>
              Make your device visible in the public cooperative Frontier mesh — the synaptic network
              of Nodes of Socceri. You can withdraw anytime.
            </div>
            <div style={s.sectionSub}>
              <strong style={{ color: '#e2e8f0' }}>This makes your device visible.</strong> Active
              (non-withdrawn) nodes are readable by all authenticated members of the cooperative.
            </div>
            <button
              style={s.btn('#6ee7b7', 'rgba(110,231,183,0.1)')}
              onClick={handleRegisterFrontier}
              disabled={frontierBusy}
            >
              {frontierBusy ? 'Registering…' : 'Join the Frontier →'}
            </button>
          </>
        ) : (
          <>
            {frontier.my_node && (
              <div style={s.nodeCard}>
                <div style={{ ...s.row }}>
                  <span style={s.label}>Node</span>
                  <span style={s.value} title={frontier.my_node.peer_id}>
                    {shortPeerId(frontier.my_node.peer_id)}
                  </span>
                </div>
                <div style={s.row}>
                  <span style={s.label}>Version</span>
                  <span style={s.value}>{frontier.my_node.app_version ?? '—'}</span>
                </div>
                <div style={s.row}>
                  <span style={s.label}>Last heartbeat</span>
                  <span style={s.value}>{fmtDate(frontier.my_node.last_heartbeat_at)}</span>
                </div>
                <div style={s.row}>
                  <span style={s.label}>Heartbeat</span>
                  <span style={s.pill(frontier.heartbeat_active ? '110,231,183' : '100,116,139')}>
                    {frontier.heartbeat_active ? '● active' : '○ stopped'}
                  </span>
                </div>
              </div>
            )}

            <div style={s.sectionSub}>
              {frontier.nodes.length} active node{frontier.nodes.length !== 1 ? 's' : ''} on the
              Frontier (including yours).
            </div>

            <div style={{ ...s.sectionSub, color: '#fbbf24' }}>
              Reinstalling Mnemosyne generates a new peer_id — your old node will remain until
              you withdraw it here.
            </div>

            <button
              style={s.btn('#fbbf24', 'rgba(251,191,36,0.08)')}
              onClick={handleWithdrawFrontier}
              disabled={frontierBusy}
            >
              {frontierBusy ? 'Withdrawing…' : 'Withdraw from Frontier'}
            </button>
          </>
        )}

        {frontierMsg && <div style={s.success}>{frontierMsg}</div>}
        {frontierError && <div style={s.error}>{frontierError}</div>}
      </div>
    </div>
  );
}
