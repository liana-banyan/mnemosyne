// MembershipTab.tsx — BP081 K-1
// Tab 19 · 💎 Membership
// Canonical: $5/year · 83.3% creator-keep · Cost+20% platform margin
// Three-currency system: Credits / Marks / Joules (no fiat at data layer)

import React, { useState, useEffect, useRef } from 'react';
import { MEMBERSHIP_ANNUAL_FEE_USD, CREATOR_KEEP_PERCENT } from '../../shared/membership_types';
import type { MembershipStatus, MembershipTier } from '../../shared/membership_types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MembershipStatusResult {
  tier: MembershipTier | string;
  status: MembershipStatus | string;
  annualFeeUsd: number;
}

type CheckoutPhase =
  | 'idle'
  | 'loading'
  | 'opened'
  | 'error';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tierBadge(tier: string): { label: string; color: string; bg: string } {
  switch (tier) {
    case 'founder':
      return { label: 'Founder', color: '#facc15', bg: 'rgba(250,204,21,0.12)' };
    case 'forked':
      return { label: 'Forked', color: '#94a3b8', bg: 'rgba(148,163,184,0.10)' };
    default:
      return { label: 'Standard', color: '#6ee7b7', bg: 'rgba(110,231,183,0.10)' };
  }
}

function statusLabel(status: string): { text: string; color: string } {
  switch (status) {
    case 'active':     return { text: 'Active',          color: '#4ade80' };
    case 'expired':    return { text: 'Expired',         color: '#f87171' };
    case 'pending_payment': return { text: 'Pending payment', color: '#fbbf24' };
    case 'cancelled':  return { text: 'Cancelled',       color: '#94a3b8' };
    default:           return { text: 'Not yet joined',  color: '#475569' };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MembershipTab() {
  const [memberStatus, setMemberStatus] = useState<MembershipStatusResult | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [checkoutPhase, setCheckoutPhase] = useState<CheckoutPhase>('idle');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Long-running heartbeat during checkout-session creation
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [heartbeatTick, setHeartbeatTick] = useState(0);
  const [heartbeatMsg, setHeartbeatMsg] = useState('Opening Stripe checkout...');

  const HEARTBEAT_MSGS = [
    'Opening Stripe checkout...',
    'Connecting to checkout...',
    'Almost there...',
    'Launching in your browser...',
  ];

  // Load membership status on mount
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await window.amplify?.membershipGetStatus?.();
        if (!cancelled && result) {
          setMemberStatus(result as MembershipStatusResult);
        }
      } catch {
        // silent — stub may not be wired yet
      } finally {
        if (!cancelled) setLoadingStatus(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Cleanup heartbeat on unmount
  useEffect(() => {
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, []);

  function startHeartbeat() {
    let tick = 0;
    heartbeatRef.current = setInterval(() => {
      tick += 1;
      setHeartbeatTick(tick);
      setHeartbeatMsg(HEARTBEAT_MSGS[tick % HEARTBEAT_MSGS.length]);
    }, 1800);
  }

  function stopHeartbeat() {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    setHeartbeatTick(0);
  }

  async function handleJoin() {
    if (checkoutPhase === 'loading') return;
    setCheckoutPhase('loading');
    setCheckoutError(null);
    startHeartbeat();

    try {
      const result = await window.amplify?.membershipStartCheckout?.();
      stopHeartbeat();
      if (result?.success) {
        setCheckoutPhase('opened');
      } else {
        setCheckoutPhase('error');
        setCheckoutError(result?.error ?? 'Checkout unavailable — try again shortly.');
      }
    } catch (err) {
      stopHeartbeat();
      setCheckoutPhase('error');
      setCheckoutError(String(err));
    }
  }

  // ─── Styles ───────────────────────────────────────────────────────────────

  const S = {
    container: {
      padding: '20px 24px',
      overflowY: 'auto' as const,
      height: '100%',
      color: '#e2e8f0',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: 640,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: 700,
      color: '#475569',
      letterSpacing: '0.08em',
      textTransform: 'uppercase' as const,
      marginBottom: 10,
    },
    card: {
      background: 'rgba(15,23,42,0.6)',
      border: '1px solid rgba(100,116,139,0.2)',
      borderRadius: 10,
      padding: '14px 18px',
    },
    row: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 6,
    },
    label: {
      fontSize: 12,
      color: '#64748b',
    },
    value: {
      fontSize: 12,
      fontWeight: 600,
      color: '#cbd5e1',
    },
    joinButton: (phase: CheckoutPhase): React.CSSProperties => ({
      width: '100%',
      padding: '12px 20px',
      background: phase === 'loading'
        ? 'rgba(110,231,183,0.05)'
        : 'rgba(110,231,183,0.13)',
      border: `1px solid ${phase === 'loading' ? 'rgba(110,231,183,0.2)' : 'rgba(110,231,183,0.45)'}`,
      borderRadius: 10,
      color: phase === 'loading' ? '#4ade80' : '#6ee7b7',
      fontSize: 14,
      fontWeight: 700,
      cursor: phase === 'loading' ? 'wait' : 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      transition: 'all 0.15s ease',
      letterSpacing: '0.01em',
    }),
    openedBanner: {
      background: 'rgba(34,197,94,0.08)',
      border: '1px solid rgba(34,197,94,0.3)',
      borderRadius: 10,
      padding: '12px 16px',
      fontSize: 12,
      color: '#4ade80',
      lineHeight: 1.6,
    },
    errorBanner: {
      background: 'rgba(239,68,68,0.08)',
      border: '1px solid rgba(239,68,68,0.3)',
      borderRadius: 8,
      padding: '8px 12px',
      fontSize: 11,
      color: '#f87171',
      marginTop: 8,
    },
    bullet: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
      fontSize: 12,
      color: '#94a3b8',
      lineHeight: 1.6,
      marginBottom: 8,
    },
    bulletDot: {
      color: '#6ee7b7',
      fontSize: 14,
      flexShrink: 0,
      marginTop: 1,
    },
    forkCard: {
      background: 'rgba(15,23,42,0.4)',
      border: '1px solid rgba(100,116,139,0.15)',
      borderRadius: 10,
      padding: '14px 18px',
    },
    link: {
      color: '#60a5fa',
      textDecoration: 'underline',
      cursor: 'pointer',
      fontSize: 11,
    },
    spinner: {
      display: 'inline-block',
      width: 14,
      height: 14,
      border: '2px solid rgba(110,231,183,0.3)',
      borderTopColor: '#6ee7b7',
      borderRadius: '50%',
      animation: 'membership-spin 0.8s linear infinite',
    },
  };

  const badge = memberStatus ? tierBadge(memberStatus.tier) : null;
  const status = memberStatus ? statusLabel(memberStatus.status) : null;
  const isNeverJoined = !memberStatus || memberStatus.status === 'never_joined';
  const isActive = memberStatus?.status === 'active';

  return (
    <div style={S.container}>
      {/* Spinner keyframes injected inline once */}
      <style>{`
        @keyframes membership-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes membership-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
      `}</style>

      {/* ── Section 1: Your Status ─────────────────────────────────────────── */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Your Status</div>
        <div style={S.card}>
          {loadingStatus ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={S.spinner} />
              <span style={{ fontSize: 12, color: '#475569' }}>Checking membership status...</span>
            </div>
          ) : memberStatus ? (
            <>
              <div style={S.row}>
                <span style={S.label}>Tier</span>
                {badge && (
                  <span style={{
                    background: badge.bg,
                    color: badge.color,
                    border: `1px solid ${badge.color}40`,
                    borderRadius: 12,
                    padding: '2px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                  }}>
                    {badge.label}
                  </span>
                )}
              </div>
              <div style={S.row}>
                <span style={S.label}>Status</span>
                {status && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: status.color }}>
                    {status.text}
                  </span>
                )}
              </div>
              <div style={S.row}>
                <span style={S.label}>Annual fee</span>
                <span style={S.value}>${MEMBERSHIP_ANNUAL_FEE_USD}/year</span>
              </div>
            </>
          ) : (
            <span style={{ fontSize: 12, color: '#475569' }}>Status unavailable</span>
          )}
        </div>
      </div>

      {/* ── Section 2: Join ────────────────────────────────────────────────── */}
      {!isActive && (
        <div style={S.section}>
          <div style={S.sectionTitle}>Join Liana Banyan — ${MEMBERSHIP_ANNUAL_FEE_USD}/year</div>

          {checkoutPhase === 'opened' ? (
            <div style={S.openedBanner}>
              ✓ Checkout opened in your browser.
              <br />
              Come back here once you've joined. Then close and reopen MnemosyneC
              to refresh your membership status.
            </div>
          ) : (
            <>
              <button
                style={S.joinButton(checkoutPhase)}
                onClick={handleJoin}
                disabled={checkoutPhase === 'loading'}
                aria-label={checkoutPhase === 'loading' ? 'Opening checkout...' : `Join Liana Banyan for $${MEMBERSHIP_ANNUAL_FEE_USD}/year`}
                title={`Join the cooperative — $${MEMBERSHIP_ANNUAL_FEE_USD}/year`}
              >
                {checkoutPhase === 'loading' ? (
                  <>
                    <span style={S.spinner} aria-hidden />
                    <span style={{ animation: 'membership-pulse 1.4s ease-in-out infinite' }}>
                      {heartbeatMsg}
                    </span>
                  </>
                ) : (
                  <>💎 Join · ${MEMBERSHIP_ANNUAL_FEE_USD}/year</>
                )}
              </button>

              {checkoutPhase === 'error' && checkoutError && (
                <div style={S.errorBanner} role="alert">
                  {checkoutError}
                </div>
              )}

              {checkoutPhase === 'idle' && isNeverJoined && (
                <div style={{ marginTop: 8, fontSize: 10, color: '#334155', textAlign: 'center' }}>
                  Free to use. Better to join.
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Section 3: Fork it ─────────────────────────────────────────────── */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Or fork it</div>
        <div style={S.forkCard}>
          <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.7, marginBottom: 10 }}>
            Free forever if you want to fork. Cost+20% if you stay.
          </div>
          <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.6, marginBottom: 10 }}>
            MnemosyneC ships under SSPL. You can fork it, self-host it, run it forever at zero cost.
            If you build a product on it, you share the stack (SSPL §13). If you stay in the cooperative,
            you get the full mesh — platform margin is Cost+20%, never more.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <a
              href="https://github.com/liana-banyan"
              target="_blank"
              rel="noopener noreferrer"
              style={S.link}
              onClick={(e) => {
                e.preventDefault();
                window.amplify?.openExternal?.('https://github.com/liana-banyan');
              }}
            >
              GitHub →
            </a>
            <span style={{ fontSize: 11, color: '#334155' }}>Pledge #2260 · SSPL</span>
          </div>
        </div>
      </div>

      {/* ── Section 4: What you get ────────────────────────────────────────── */}
      <div style={S.section}>
        <div style={S.sectionTitle}>What you get</div>
        <div style={S.card}>
          <div style={S.bullet}>
            <span style={S.bulletDot}>◆</span>
            <span>
              <strong style={{ color: '#e2e8f0' }}>{CREATOR_KEEP_PERCENT}% creator-keep</strong>
              {' '}— every time someone pays for your work, {CREATOR_KEEP_PERCENT}% goes directly to you.
              Never rounded. Never 83%.
            </span>
          </div>
          <div style={S.bullet}>
            <span style={S.bulletDot}>◆</span>
            <span>
              <strong style={{ color: '#e2e8f0' }}>No ads · No VC · Participation not equity</strong>
              {' '}— the cooperative earns Cost+20%, period. No extraction above that.
            </span>
          </div>
          <div style={S.bullet}>
            <span style={S.bulletDot}>◆</span>
            <span>
              <strong style={{ color: '#e2e8f0' }}>Your substrate. Your eblets. Your knowledge.</strong>
              {' '}Compounding locally. Shared by consent. Sovereign to you.
            </span>
          </div>
          <div style={S.bullet}>
            <span style={S.bulletDot}>◆</span>
            <span>
              <strong style={{ color: '#e2e8f0' }}>Access to Deep Test + peer mesh sharing</strong>
              {' '}— let your substrate grow with the mesh. Opt-in. Revocable. Always yours.
            </span>
          </div>
          <div style={S.bullet}>
            <span style={S.bulletDot}>◆</span>
            <span>
              <strong style={{ color: '#e2e8f0' }}>Three-currency system</strong>
              {' '}— Credits / Marks / Joules. Your internal economy. Never converted to fiat at the data layer.
            </span>
          </div>

          <div style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: '1px solid rgba(100,116,139,0.12)',
            fontSize: 10,
            color: '#334155',
            lineHeight: 1.7,
          }}>
            $5/year · Help each other help ourselves.
          </div>
        </div>
      </div>
    </div>
  );
}
