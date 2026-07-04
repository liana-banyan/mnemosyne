// OptInPrompt.tsx — Contextual 3-strikes opt-in prompt for Frontier / LB Account
// canon: canon_frontier_lb_account_opt_in_contextual_3_strikes_prompt_not_buried_tab_bp065
// BP065 · Founder direct: contextual, not a buried tab; max 3 asks; respectful, never nagware.
//
// Rendered as a fixed overlay above the main UI.
// Buttons:
//   YES — link my LB Account now → triggers auth flow → closes prompt
//   Once a day for 3 days / Once a week for 3 weeks → remind cadence → records strike
//   Never ask again → sets decision = 'never' → closes prompt
//   Tell me where to find this → shows path to Tab 14 LB Account → closes prompt

import React, { useState, useMemo } from 'react';
import { recordStrike, setDecision, setCadence, type OptInCadence } from '../lib/opt_in_strike_tracker';
import { getHenNarration } from '../lib/little_red_hen';

interface OptInPromptProps {
  onClose: () => void;
  onYes: (email: string) => void;
  onNavigateToTab: () => void;
}

export function OptInPrompt({ onClose, onYes, onNavigateToTab }: OptInPromptProps) {
  const [phase, setPhase] = useState<'main' | 'yes-email' | 'tell-me-where'>('main');
  // LRH narration is stable for the lifetime of this prompt instance
  const henNarration = useMemo(() => getHenNarration('join'), []);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  function handleRemind(cadence: OptInCadence) {
    setCadence(cadence);
    recordStrike(cadence);
    onClose();
  }

  function handleNever() {
    setDecision('never');
    onClose();
  }

  function handleTellMe() {
    setPhase('tell-me-where');
  }

  function handleYesSubmit() {
    if (!email.trim() || !email.includes('@')) {
      setEmailError('Enter a valid email address.');
      return;
    }
    onYes(email.trim());
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        pointerEvents: 'none',
        padding: '0 16px 80px',
      }}
    >
      <div
        style={{
          pointerEvents: 'auto',
          background: 'rgba(10,15,26,0.97)',
          border: '1px solid rgba(110,231,183,0.3)',
          borderRadius: 12,
          padding: '18px 20px',
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {phase === 'main' && <MainPhase onRemind={handleRemind} onNever={handleNever} onYes={() => setPhase('yes-email')} onTellMe={handleTellMe} henNarration={henNarration} />}
        {phase === 'yes-email' && (
          <YesEmailPhase
            email={email}
            emailError={emailError}
            setEmail={setEmail}
            onSubmit={handleYesSubmit}
            onBack={() => setPhase('main')}
          />
        )}
        {phase === 'tell-me-where' && (
          <TellMeWherePhase
            onNavigate={() => { onNavigateToTab(); onClose(); }}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

// ─── Main phase ───────────────────────────────────────────────────────────────

function MainPhase({
  onRemind,
  onNever,
  onYes,
  onTellMe,
  henNarration,
}: {
  onRemind: (c: OptInCadence) => void;
  onNever: () => void;
  onYes: () => void;
  onTellMe: () => void;
  henNarration: string;
}) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>🌐</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.4 }}>
            This result came from the cooperative substrate.
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, lineHeight: 1.6 }}>
            Linking your Liana Banyan account lets your device join the Frontier — a cooperative mesh
            where members share substrate and multiply what MnemosyneC knows. Free to use. Better together.
          </div>
          {/* Little Red Hen narration — join context */}
          <div style={{ fontSize: 10, color: '#475569', marginTop: 6, fontStyle: 'italic' }}>
            {henNarration}
          </div>
        </div>
      </div>

      <button
        style={{
          width: '100%',
          padding: '9px 14px',
          background: 'rgba(110,231,183,0.12)',
          border: '1px solid rgba(110,231,183,0.35)',
          borderRadius: 8,
          color: '#6ee7b7',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          textAlign: 'left' as const,
        }}
        onClick={onYes}
      >
        ✓ YES — link my LB Account now
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, letterSpacing: '0.05em' }}>
          REMIND ME INSTEAD
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            style={remindBtn}
            onClick={() => onRemind('3days')}
          >
            Once a day for 3 days
          </button>
          <button
            style={remindBtn}
            onClick={() => onRemind('3weeks')}
          >
            Once a week for 3 weeks
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          style={{ background: 'none', border: 'none', color: '#475569', fontSize: 10, cursor: 'pointer', padding: 0 }}
          onClick={onTellMe}
        >
          Tell me where to find this later →
        </button>
        <button
          style={{ background: 'none', border: 'none', color: '#334155', fontSize: 10, cursor: 'pointer', padding: 0 }}
          onClick={onNever}
        >
          Never ask again
        </button>
      </div>
    </>
  );
}

const remindBtn: React.CSSProperties = {
  flex: 1,
  padding: '6px 10px',
  background: 'rgba(100,116,139,0.08)',
  border: '1px solid rgba(100,116,139,0.2)',
  borderRadius: 6,
  color: '#94a3b8',
  fontSize: 10,
  fontWeight: 500,
  cursor: 'pointer',
  textAlign: 'center' as const,
};

// ─── Yes / email phase ────────────────────────────────────────────────────────

function YesEmailPhase({
  email,
  emailError,
  setEmail,
  onSubmit,
  onBack,
}: {
  email: string;
  emailError: string;
  setEmail: (v: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}) {
  return (
    <>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
        Link your LB Account
      </div>
      <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.6 }}>
        Enter your email — we'll send a one-click magic link. No password needed.
      </div>
      <input
        type="email"
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
        autoFocus
        style={{
          width: '100%',
          padding: '8px 12px',
          background: 'rgba(15,23,42,0.9)',
          border: '1px solid rgba(100,116,139,0.35)',
          borderRadius: 6,
          color: '#e2e8f0',
          fontSize: 13,
          outline: 'none',
          boxSizing: 'border-box' as const,
        }}
      />
      {emailError && (
        <div style={{ fontSize: 10, color: '#f87171' }}>⚠ {emailError}</div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          style={{
            flex: 1, padding: '8px 14px',
            background: 'rgba(110,231,183,0.12)', border: '1px solid rgba(110,231,183,0.35)',
            borderRadius: 6, color: '#6ee7b7', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}
          onClick={onSubmit}
        >
          Send magic link →
        </button>
        <button
          style={{
            padding: '8px 14px',
            background: 'none', border: '1px solid rgba(100,116,139,0.2)',
            borderRadius: 6, color: '#64748b', fontSize: 11, cursor: 'pointer',
          }}
          onClick={onBack}
        >
          Back
        </button>
      </div>
    </>
  );
}

// ─── Tell me where phase ──────────────────────────────────────────────────────

function TellMeWherePhase({ onNavigate, onClose }: { onNavigate: () => void; onClose: () => void }) {
  return (
    <>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
        Where to find this later
      </div>
      <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>
        In MnemosyneC, look for the{' '}
        <strong style={{ color: '#fbbf24' }}>LB Account</strong>{' '}
        tab in the tab bar at the top.
        <br /><br />
        From there you can link your account and join the Frontier any time you're ready.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          style={{
            flex: 1, padding: '8px 14px',
            background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.25)',
            borderRadius: 6, color: '#fbbf24', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
          onClick={onNavigate}
        >
          Take me there now →
        </button>
        <button
          style={{
            padding: '8px 14px',
            background: 'none', border: '1px solid rgba(100,116,139,0.2)',
            borderRadius: 6, color: '#64748b', fontSize: 11, cursor: 'pointer',
          }}
          onClick={onClose}
        >
          Got it
        </button>
      </div>
    </>
  );
}
