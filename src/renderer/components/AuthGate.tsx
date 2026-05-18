// Mnemosyne — Auth Gate
// B37 Phase 7 — First-launch modal; shown when status === 'unauthenticated' or 'validating'
// BP046B — Moved from always-on-top overlay to HearthConjunctionWindow (normal OS window)
//           so the user can ALWAYS escape: native X button, Alt+F4, Esc key, or click
//           "Use Free Forever". Single-monitor safe.

import React, { useState, useEffect, useRef } from 'react';

interface AuthGateProps {
  isValidating?: boolean;
}

export const AuthGate: React.FC<AuthGateProps> = ({ isValidating = false }) => {
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const signInTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // "Use Free Forever" — the primary escape path.
  // Calling authStartTrial() moves auth state from unauthenticated/validating → trial_active,
  // which dismisses this gate. No account required. No countdown shown to the user.
  const handleFreeForever = () => {
    window.amplify.authStartTrial();
  };

  const handleSignIn = () => {
    setSigningIn(true);
    setSignInError(null);
    window.amplify.authSignIn();
    // 30-second UX timeout — show error + retry; auth IPC may still be pending in background
    signInTimerRef.current = setTimeout(() => {
      setSigningIn(false);
      setSignInError('Sign-in timed out. Check your browser and try again, or use Free Forever.');
    }, 30_000);
  };

  const handleJoin = () => {
    window.amplify.authOpenJoin();
  };

  const handleCancelSignIn = () => {
    if (signInTimerRef.current) {
      clearTimeout(signInTimerRef.current);
      signInTimerRef.current = null;
    }
    setSigningIn(false);
    setSignInError(null);
    handleFreeForever();
  };

  // Esc key → Use Free Forever (works because HearthConjunctionWindow is focusable)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (signingIn) {
          handleCancelSignIn();
        } else {
          handleFreeForever();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (signInTimerRef.current) clearTimeout(signInTimerRef.current);
    };
  }, [signingIn]);

  const showSpinner = (isValidating || signingIn) && !signInError;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10, 15, 28, 0.96)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9000,
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#1e293b',
          border: '1px solid rgba(245,158,11,0.25)',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 0 60px rgba(245,158,11,0.08)',
          position: 'relative',
        }}
      >
        {/* Gold top stripe */}
        <div
          style={{
            height: 3,
            background: 'linear-gradient(90deg, #f59e0b, #fbbf24, #f59e0b)',
          }}
        />

        {/* X close button — always visible; clicking = "Use Free Forever" */}
        <button
          onClick={showSpinner ? handleCancelSignIn : handleFreeForever}
          title="Continue without account — Use Free Forever (Esc)"
          aria-label="Continue without account"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.5)',
            fontSize: 18,
            lineHeight: 1,
            cursor: 'pointer',
            padding: '3px 8px',
            borderRadius: 6,
            zIndex: 1,
          }}
        >
          ×
        </button>

        <div style={{ padding: '28px 28px 24px' }}>
          {/* Logo + title */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                background: 'rgba(245,158,11,0.12)',
                border: '1px solid rgba(245,158,11,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                margin: '0 auto 14px',
                fontWeight: 900,
                color: '#f59e0b',
              }}
            >
              M
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: '#e2e8f0',
                marginBottom: 6,
              }}
            >
              Mnemosyne
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
              Memory, powered by CAI · Free to use. Better to join.
            </div>
          </div>

          {showSpinner ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  border: '3px solid rgba(245,158,11,0.2)',
                  borderTopColor: '#f59e0b',
                  borderRadius: '50%',
                  margin: '0 auto 14px',
                  animation: 'spin 0.9s linear infinite',
                }}
              />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>
                Waiting for browser sign-in…
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>
                Complete sign-in in your browser, then return here
              </div>
              <button
                onClick={handleCancelSignIn}
                style={{
                  marginTop: 16,
                  background: 'none',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 8,
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: 12,
                  cursor: 'pointer',
                  padding: '7px 18px',
                }}
              >
                Cancel → Use Free Forever
              </button>
            </div>
          ) : (
            <>
              {/* Value props */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: 10,
                  padding: '14px 16px',
                  marginBottom: 20,
                }}
              >
                {[
                  { icon: '🌿', text: 'Local AI inference — zero cloud cost for substrate hits' },
                  { icon: '🔒', text: 'Your data stays on your machine' },
                  { icon: '🤝', text: 'Cooperative substrate network — help each other help ourselves' },
                ].map((item) => (
                  <div
                    key={item.icon}
                    style={{
                      display: 'flex',
                      gap: 10,
                      marginBottom: 10,
                      alignItems: 'flex-start',
                    }}
                  >
                    <span style={{ fontSize: 15, flexShrink: 0 }}>{item.icon}</span>
                    <span
                      style={{
                        fontSize: 12,
                        color: 'rgba(255,255,255,0.6)',
                        lineHeight: 1.5,
                      }}
                    >
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>

              {signInError && (
                <div
                  style={{
                    fontSize: 12,
                    color: '#fca5a5',
                    marginBottom: 14,
                    textAlign: 'center',
                    background: 'rgba(239,68,68,0.08)',
                    borderRadius: 8,
                    padding: '8px 12px',
                  }}
                >
                  {signInError}
                </div>
              )}

              {/* CTAs — ordered by canon: Free Forever first */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Primary: Use Free Forever */}
                <button
                  onClick={handleFreeForever}
                  style={{
                    width: '100%',
                    padding: '13px 0',
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    border: 'none',
                    borderRadius: 10,
                    color: '#000',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Use Free Forever
                </button>

                {/* Secondary: Join cooperative */}
                <button
                  onClick={handleJoin}
                  style={{
                    width: '100%',
                    padding: '12px 0',
                    background: 'rgba(245,158,11,0.08)',
                    border: '1px solid rgba(245,158,11,0.3)',
                    borderRadius: 10,
                    color: '#f59e0b',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Join LB Cooperative · $5/year
                </button>

                {/* Tertiary: Sign in */}
                <button
                  onClick={handleSignIn}
                  style={{
                    width: '100%',
                    padding: '11px 0',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 10,
                    color: 'rgba(255,255,255,0.65)',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Sign in with existing LB Account
                </button>
              </div>

              {/* Canon explanatory text — no trial language */}
              <div
                style={{
                  marginTop: 16,
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.28)',
                  textAlign: 'center',
                  lineHeight: 1.5,
                }}
              >
                Free to use. Better to join. Joining unlocks cooperative-class peer-mesh sharing,
                Banyan Metric stats publishing, and Roll/Roll-vet participation.
                <br />
                Membership: $5/year · lianabanyan.com
              </div>

              <div
                style={{
                  marginTop: 10,
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.15)',
                  textAlign: 'center',
                }}
              >
                Press Esc or click × to continue free
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthGate;
