// FirstStepsView.tsx — $5/year membership join flow
// BP067 Phase 1A · MnemosyneC v0.1.23
//
// Spec: plain-English benefits · auto-renew checkbox (default unchecked) · Stripe LIVE
// On click: IPC membership:create-checkout → main process → Supabase edge fn → Stripe URL
// → shell.openExternal

import React, { useState, useCallback } from 'react';

const BENEFITS = [
  {
    icon: '🤝',
    headline: 'You help keep the lights on',
    body: 'Your $5 goes directly to running the cooperative — servers, legal, and keeping the AI working for everyone, not just investors.',
  },
  {
    icon: '🏛️',
    headline: 'You become a founding member-owner',
    body: 'Members hold a stake in Liana Banyan Corporation. This is not a subscription to a product — it\'s a seat at the cooperative table.',
  },
  {
    icon: '🧭',
    headline: 'You unlock the Helm and Federation',
    body: 'Members get access to Tab 2 (Helm), the LB platform bridge, peer mesh features, and the Banyan Metric™ sharing pool.',
  },
  {
    icon: '🌱',
    headline: 'Early access as we grow',
    body: 'Founding-circle members get first access to new initiatives, cooperative tools, and the Let\'s Make Dinner, VSL, Atlas, and Harper Guild features as they ship.',
  },
];

interface FirstStepsViewProps {
  onClose: () => void;
}

export function FirstStepsView({ onClose }: FirstStepsViewProps) {
  const [autoRenew, setAutoRenew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await (window.amplify as any)?.membership?.createCheckout?.(autoRenew) as
        | { ok: boolean; url?: string; error?: string }
        | undefined;

      if (result?.ok && result.url) {
        window.amplify?.openExternal?.(result.url);
        onClose();
      } else if (result?.error) {
        setError(result.error);
      } else {
        // Fallback: open the web join page if IPC not yet live
        window.amplify?.openExternal?.('https://lianabanyan.com/join');
        onClose();
      }
    } catch (e) {
      // Graceful fallback if IPC unavailable
      window.amplify?.openExternal?.('https://lianabanyan.com/join');
      onClose();
    } finally {
      setLoading(false);
    }
  }, [autoRenew, onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: 480,
          maxWidth: '94vw',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: '#0a0f1a',
          border: '1px solid rgba(110,231,183,0.3)',
          borderRadius: 14,
          boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
        }}
      >
        {/* Header */}
        <div style={{ padding: '24px 28px 16px', borderBottom: '1px solid rgba(100,116,139,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6ee7b7', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Join the Cooperative
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 18, padding: '0 4px', lineHeight: 1 }}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0', marginBottom: 6 }}>
            $5/year — Founding Member
          </div>
          <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
            Free to use. Better to join. This is a cooperative, not a SaaS product.
          </div>
        </div>

        {/* Benefits */}
        <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {BENEFITS.map((b) => (
            <div key={b.headline} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{b.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 2 }}>{b.headline}</div>
                <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.6 }}>{b.body}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Auto-renew + CTA */}
        <div style={{ padding: '16px 28px 24px', borderTop: '1px solid rgba(100,116,139,0.15)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoRenew}
              onChange={(e) => setAutoRenew(e.target.checked)}
              style={{ accentColor: '#6ee7b7', marginTop: 2, flexShrink: 0 }}
            />
            <span style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
              <strong style={{ color: '#e2e8f0' }}>Auto-renew each year</strong> — keep your founding-member stake without having to rejoin.
              Unchecked = one-time $5 payment (you can rejoin next year).
            </span>
          </label>

          {error && (
            <div style={{ fontSize: 11, color: '#f87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 6, padding: '8px 12px' }}>
              {error}
            </div>
          )}

          <button
            onClick={handleJoin}
            disabled={loading}
            style={{
              padding: '12px 20px',
              background: loading ? 'rgba(110,231,183,0.05)' : 'rgba(110,231,183,0.12)',
              border: '1px solid rgba(110,231,183,0.4)',
              borderRadius: 8,
              color: '#6ee7b7',
              fontSize: 14,
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              textAlign: 'center',
            }}
          >
            {loading ? 'Opening checkout…' : `Join for $5${autoRenew ? '/year · auto-renews' : ' · one-time'} →`}
          </button>

          <div style={{ fontSize: 10, color: '#334155', textAlign: 'center', lineHeight: 1.5 }}>
            Secure checkout via Stripe · Cancel or change anytime · Share and Save.
          </div>
        </div>
      </div>
    </div>
  );
}
