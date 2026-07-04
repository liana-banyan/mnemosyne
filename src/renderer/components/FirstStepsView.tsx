// FirstStepsView.tsx -- BP078 Scope 5
// Intent capture: three single-select cards (Pawn Section 4) + checkout trigger.
// DELTA binding: intent capture fires INSIDE the $5 join flow, never before.
// After checkout success + verifyStatus active: write intent tag, then onRoutePath.

import React, { useCallback, useState } from 'react';

// ─── Types (Pawn Section 7 drop-in) ──────────────────────────────────────────

export type JoinIntent = 'need_help' | 'want_to_help' | 'make_money';

export interface FirstStepsViewProps {
  selectedIntent?: JoinIntent | null;
  membershipActive?: boolean;
  onSelectIntent: (intent: JoinIntent) => void;
  onCheckout: (intent: JoinIntent) => void;
  onRoutePath: (intent: JoinIntent) => void;
  analytics?: {
    track: (event: string, payload?: Record<string, unknown>) => void;
  };
}

export const intentRoutingMap: Record<JoinIntent, {
  cluster: string;
  initiatives: string[];
  banner: string;
  primaryAction: string;
}> = {
  need_help: {
    cluster: 'household_and_savings',
    initiatives: ['lets-make-dinner', 'lets-get-groceries', 'household-concierge'],
    banner: 'Opened for: I need help. You can change your path anytime.',
    primaryAction: 'Start with Dinner',
  },
  want_to_help: {
    cluster: 'community_contribution',
    initiatives: ['harper-guild', 'didasko', 'health-accords'],
    banner: 'Opened for: I want to help. You can change your path anytime.',
    primaryAction: 'See where help is needed',
  },
  make_money: {
    cluster: 'commerce_and_work',
    initiatives: ['lets-go-shopping', 'defense-klaus', 'lets-make-bread'],
    banner: 'Opened for: I want to make money. You can change your path anytime.',
    primaryAction: 'Open earning-ready initiatives',
  },
};

const INTENT_CARDS: Array<{ id: JoinIntent; label: string; subtitle: string }> = [
  {
    id: 'need_help',
    label: 'I need help',
    subtitle: 'Show me the tools and services most likely to save me money, time, or stress first.',
  },
  {
    id: 'want_to_help',
    label: 'I want to help',
    subtitle: 'Show me where I can contribute, host, review, teach, or support other members.',
  },
  {
    id: 'make_money',
    label: 'I want to make money',
    subtitle: 'Show me the initiatives with the clearest earning, service, or venture pathways first.',
  },
];

// ─── Styles ───────────────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#0d1117',
  zIndex: 9600,
  padding: 16,
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const card: React.CSSProperties = {
  background: '#111827',
  border: '1px solid rgba(100,116,139,0.2)',
  borderRadius: 12,
  padding: '36px 32px 28px',
  maxWidth: 500,
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
};

const brandLine: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: '#6ee7b7',
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  marginBottom: 20,
};

const headingStyle: React.CSSProperties = {
  margin: '0 0 8px',
  fontSize: 20,
  fontWeight: 800,
  color: '#e2e8f0',
  lineHeight: 1.25,
};

const helperStyle: React.CSSProperties = {
  margin: '0 0 24px',
  fontSize: 13,
  color: '#64748b',
  lineHeight: 1.6,
};

const primaryBtnBase: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '13px 20px',
  background: 'rgba(110,231,183,0.13)',
  border: '1px solid rgba(110,231,183,0.4)',
  borderRadius: 8,
  color: '#6ee7b7',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  textAlign: 'center' as const,
  marginBottom: 10,
  fontFamily: 'inherit',
};

const primaryBtnDisabled: React.CSSProperties = {
  ...primaryBtnBase,
  background: 'rgba(110,231,183,0.04)',
  border: '1px solid rgba(110,231,183,0.12)',
  color: '#475569',
  cursor: 'not-allowed',
};

const ghostBtn: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'center' as const,
  background: 'none',
  border: 'none',
  color: '#475569',
  fontSize: 12,
  cursor: 'pointer',
  padding: '5px 0',
  fontFamily: 'inherit',
};

const errorBox: React.CSSProperties = {
  fontSize: 12,
  color: '#f87171',
  background: 'rgba(248,113,113,0.08)',
  border: '1px solid rgba(248,113,113,0.2)',
  borderRadius: 6,
  padding: '8px 12px',
  marginBottom: 12,
};

const successBox: React.CSSProperties = {
  fontSize: 12,
  color: '#6ee7b7',
  background: 'rgba(6,78,59,0.15)',
  border: '1px solid rgba(110,231,183,0.25)',
  borderRadius: 6,
  padding: '10px 14px',
  marginBottom: 12,
  lineHeight: 1.6,
};

// ─── Component ────────────────────────────────────────────────────────────────

type Phase = 'select' | 'checkout_pending' | 'verifying';

export function FirstStepsView({
  selectedIntent: initialIntent = null,
  membershipActive = false,
  onSelectIntent,
  onCheckout,
  onRoutePath,
  analytics,
}: FirstStepsViewProps): React.ReactElement {
  const [intent, setIntent] = useState<JoinIntent | null>(initialIntent);
  const [phase, setPhase] = useState<Phase>(membershipActive ? 'checkout_pending' : 'select');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectIntent = useCallback((id: JoinIntent) => {
    setIntent(id);
    onSelectIntent(id);
    analytics?.track('membership_intent_selected', {
      source: 'first_steps_intent',
      intent: id,
      selection_surface: 'join_modal',
      preselected: false,
    });
  }, [onSelectIntent, analytics]);

  const handleOpenPath = useCallback(async () => {
    if (!intent) return;
    setError(null);
    onCheckout(intent);
    try {
      const result = await window.amplify?.membership?.createCheckout(false);
      if (result?.ok) {
        const url = (result as { ok: boolean; url?: string }).url;
        window.amplify?.openExternal?.(url ?? 'https://lianabanyan.com/join');
      } else {
        window.amplify?.openExternal?.('https://lianabanyan.com/join');
      }
    } catch {
      window.amplify?.openExternal?.('https://lianabanyan.com/join');
    }
    setPhase('checkout_pending');
  }, [intent, onCheckout]);

  const handleVerify = useCallback(async () => {
    if (!intent) return;
    setVerifying(true);
    setError(null);
    try {
      const result = await window.amplify?.membership?.verifyStatus?.();
      if (result?.membership_active === true) {
        analytics?.track('membership_path_routed', {
          source: 'post_join_routing',
          intent,
          destination_surface: 'helm',
          destination_cluster: intentRoutingMap[intent].cluster,
          destination_initiatives: intentRoutingMap[intent].initiatives,
          membership_status: 'active',
        });
        onRoutePath(intent);
      } else {
        setError("Membership not confirmed yet. Please wait a moment and try again.");
      }
    } catch {
      setError('Verification failed. Check your connection and try again.');
    } finally {
      setVerifying(false);
    }
  }, [intent, onRoutePath, analytics]);

  const handleReopenCheckout = useCallback(async () => {
    setError(null);
    try {
      const result = await window.amplify?.membership?.createCheckout(false);
      const url = (result as { ok: boolean; url?: string })?.url;
      window.amplify?.openExternal?.(url ?? 'https://lianabanyan.com/join');
    } catch {
      window.amplify?.openExternal?.('https://lianabanyan.com/join');
    }
  }, []);

  // ── Select phase ─────────────────────────────────────────────────────────────

  if (phase === 'select') {
    return (
      <div style={overlay}>
        <div style={card}>
          <div style={brandLine}>MnemosyneC</div>
          <h2 style={headingStyle}>{"What brings you in first?"}</h2>
          <p style={helperStyle}>
            Pick the path you want opened by default. You can explore everything later.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {INTENT_CARDS.map((c) => {
              const selected = intent === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectIntent(c.id)}
                  style={{
                    padding: '14px 16px',
                    background: selected ? 'rgba(6,78,59,0.2)' : 'rgba(15,23,42,0.5)',
                    border: selected ? '1.5px solid rgba(110,231,183,0.5)' : '1px solid rgba(100,116,139,0.2)',
                    borderRadius: 10,
                    textAlign: 'left' as const,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    position: 'relative' as const,
                  }}
                >
                  {selected && (
                    <span
                      aria-hidden="true"
                      style={{
                        position: 'absolute' as const,
                        top: 10,
                        right: 12,
                        fontSize: 14,
                        color: '#6ee7b7',
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <path d="M2.5 7l3 3 6-6" stroke="#6ee7b7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                  )}
                  <div style={{ fontSize: 14, fontWeight: 700, color: selected ? '#6ee7b7' : '#e2e8f0', marginBottom: 4 }}>
                    {c.label}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                    {c.subtitle}
                  </div>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            style={intent ? primaryBtnBase : primaryBtnDisabled}
            disabled={!intent}
            onClick={() => { void handleOpenPath(); }}
          >
            Open my path -- Join $5/year
          </button>

          {/* SEG-UX-5: "Use free" path -- explicit no-payment supported option */}
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(100,116,139,0.1)' }}>
            <button
              type="button"
              style={ghostBtn}
              onClick={() => onRoutePath('need_help')}
            >
              Use free forever -- no account needed
            </button>
            <div style={{ fontSize: 10, color: '#334155', textAlign: 'center' as const, marginTop: 4 }}>
              All local AI features work without an account. Join later anytime from $ LB Account.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Checkout pending phase ────────────────────────────────────────────────────

  return (
    <div style={overlay}>
      <div style={card}>
        <div style={brandLine}>MnemosyneC</div>
        <h2 style={headingStyle}>Complete your membership</h2>
        <p style={helperStyle}>
          Finish the checkout in your browser, then click below to confirm.
        </p>

        <div style={successBox}>
          Checkout opened in your browser. Complete the $5 payment, then click the button below.
        </div>

        {error && <div style={errorBox}>{error}</div>}

        <button
          type="button"
          style={verifying ? primaryBtnDisabled : primaryBtnBase}
          disabled={verifying}
          onClick={() => { void handleVerify(); }}
        >
          {verifying ? 'Verifying...' : 'I have completed checkout'}
        </button>

        <button type="button" style={ghostBtn} onClick={() => { void handleReopenCheckout(); }}>
          Need to open checkout again?
        </button>
      </div>
    </div>
  );
}

export default FirstStepsView;
