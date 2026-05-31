// MnemosyneC — Onboarding Screen Components
// BP065 v0.1.23 — Minimal-click revamp per canon eblets:
//   canon_onboarding_minimal_clicks_sensible_defaults_skip_everything_explain_or_skip_bp065
//   canon_mnemosynec_minimum_install_substrate_only_no_ollama_no_key_any_hardware_bp065
//   canon_ai_burst_works_key_free_by_default_api_key_optional_never_block_untech_bp065
//
// NEW flow: 3 screens · minimum 2 clicks · or 1-click "Skip all → open the app"
//   Screen 1: Welcome + Skip-all affordance
//   Screen 2: ~4 optional questions, all with defaults, all skippable
//   Screen 3: All Set — auto-proceeds after 3 seconds
//
// Replaces 5-screen, 6-click flow (Welcome, Identity, FirstBanyan, Federation, Roll).

import React, { useState, useEffect } from 'react';

// ─── Shared props ─────────────────────────────────────────────────────────────

export interface ScreenProps {
  onNext: (data?: Record<string, unknown>) => void;
  onBack: () => void;
  onSkip: () => void;
  step: number;
  totalSteps: number;
  collected: Record<string, unknown>;
}

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  bg: '#0a0f1a',
  surface: '#111827',
  border: '#1e2d45',
  text: '#e2e8f0',
  muted: '#64748b',
  accent: '#3b82f6',
  green: '#22c55e',
  amber: '#f59e0b',
};

// ─── Progress indicator ───────────────────────────────────────────────────────

export function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', margin: '20px 0 0' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === step - 1 ? 20 : 8,
            height: 8,
            borderRadius: 4,
            background: i < step ? C.accent : i === step - 1 ? C.accent : C.border,
            opacity: i < step ? 0.5 : 1,
            transition: 'all 0.3s',
          }}
        />
      ))}
    </div>
  );
}

// ─── Screen 1: Welcome ────────────────────────────────────────────────────────
// Canon: explain in plain English, no jargon, "Skip all" prominent.
// Keypair auto-generated silently on mount — no click needed.

export function ScreenWelcome({ onNext, onSkip, step, totalSteps }: ScreenProps) {
  useEffect(() => {
    // Silent background keypair generation — no user action or UI required.
    try {
      void (window as any).amplify?.generateMemberKeypair?.();
    } catch { /* non-fatal */ }
  }, []);

  return (
    <div style={s.screen}>
      <div style={{ fontSize: 48, marginBottom: 12, textAlign: 'center' }}>🌿</div>
      <h1 style={s.title}>Welcome to MnemosyneC™</h1>
      <p style={s.body}>
        Your private AI memory that runs on <em>your</em> computer.
        No account required. No cloud upload. Free forever.
      </p>

      <div style={s.infoBox}>
        <div style={{ fontWeight: 700, fontSize: 12, color: C.text, marginBottom: 6 }}>
          🛡️ What MnemosyneC does
        </div>
        <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.7 }}>
          Reads folders you choose, builds a private memory index, and lets you search
          and query your own knowledge using local AI — entirely offline if you prefer.
          Your files are never moved, modified, or uploaded.
        </div>
      </div>

      <button onClick={() => onNext()} style={s.primaryBtn}>
        Get Started →
      </button>
      <button onClick={onSkip} style={s.skipAllBtn}>
        Skip all → open the app
      </button>

      <ProgressDots step={step} total={totalSteps} />
    </div>
  );
}

// ─── Screen 2: Quick Setup ────────────────────────────────────────────────────
// Canon: ~6 optional questions with sensible defaults, all skippable.
// Explain-or-skip: every field has a plain-English description.
// Shortcut question required per canon (taskbar/desktop, default yes).
// AI key optional — AI Burst works without it.

export interface SetupPrefs {
  displayName: string;
  addDesktopShortcut: boolean;
  addStartupItem: boolean;
  apiKey: string;
}

export function ScreenSetup({ onNext, onSkip, step, totalSteps }: ScreenProps) {
  const [displayName, setDisplayName] = useState('');
  const [addDesktopShortcut, setAddDesktopShortcut] = useState(true);
  const [addStartupItem, setAddStartupItem] = useState(false);
  const [apiKey, setApiKey] = useState('');

  const handleApply = () => {
    onNext({ displayName, addDesktopShortcut, addStartupItem, apiKey });
  };

  return (
    <div style={s.screen}>
      <h2 style={s.title}>Quick Setup</h2>
      <p style={{ ...s.body, marginBottom: 18 }}>
        All optional. Sensible defaults are already set — just change what you want.
      </p>

      {/* Q1: Display name */}
      <div style={s.question}>
        <div style={s.questionLabel}>
          What should we call you?
          <span style={s.optTag}>optional</span>
        </div>
        <p style={s.questionDesc}>Used only on this device — never shared or uploaded.</p>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your name or nickname"
          style={s.input}
          maxLength={60}
        />
      </div>

      {/* Q2: Desktop shortcut */}
      <div style={s.question}>
        <label style={s.checkRow}>
          <input
            type="checkbox"
            checked={addDesktopShortcut}
            onChange={(e) => setAddDesktopShortcut(e.target.checked)}
            style={{ accentColor: C.accent, width: 15, height: 15, flexShrink: 0 }}
          />
          <span style={s.questionLabel}>Add a shortcut to your Desktop</span>
        </label>
        <p style={{ ...s.questionDesc, marginLeft: 23 }}>
          Makes it easy to launch MnemosyneC anytime by double-clicking the icon.
        </p>
      </div>

      {/* Q3: Startup */}
      <div style={s.question}>
        <label style={s.checkRow}>
          <input
            type="checkbox"
            checked={addStartupItem}
            onChange={(e) => setAddStartupItem(e.target.checked)}
            style={{ accentColor: C.accent, width: 15, height: 15, flexShrink: 0 }}
          />
          <span style={s.questionLabel}>Start automatically when Windows starts?</span>
        </label>
        <p style={{ ...s.questionDesc, marginLeft: 23 }}>
          MnemosyneC will be ready in the background before you need it. Change anytime in Settings.
        </p>
      </div>

      {/* Q4: API key */}
      <div style={s.question}>
        <div style={s.questionLabel}>
          AI key for cloud-enhanced results
          <span style={s.optTag}>optional</span>
        </div>
        <p style={s.questionDesc}>
          AI Burst works <strong style={{ color: C.green }}>free and local</strong> without
          a key — local AI already gives strong results. Add a key later in Settings if you
          want cloud-frontier analysis.
        </p>
        <input
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-ant-... (leave blank — AI Burst works without it)"
          style={s.input}
          type="password"
          autoComplete="off"
        />
      </div>

      <button onClick={handleApply} style={{ ...s.primaryBtn, marginTop: 16 }}>
        Apply &amp; Continue →
      </button>
      <button onClick={onSkip} style={s.skipAllBtn}>
        Skip all → open the app
      </button>

      <ProgressDots step={step} total={totalSteps} />
    </div>
  );
}

// ─── Screen 3: All Set ────────────────────────────────────────────────────────
// Canon: confirm, auto-proceed after 3 seconds.

export function ScreenAllSet({ onNext, onSkip, step, totalSteps }: ScreenProps) {
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (countdown <= 0) {
      onNext();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, onNext]);

  return (
    <div style={s.screen}>
      <div style={{ fontSize: 48, marginBottom: 12, textAlign: 'center' }}>✅</div>
      <h2 style={s.title}>You're all set.</h2>
      <p style={s.body}>
        MnemosyneC is ready. Your private memory is running.
        No account required. No cloud upload.
      </p>
      <p style={{ fontSize: 11, color: C.muted, textAlign: 'center', marginBottom: 20 }}>
        You can add folders to index from the Substrate tab anytime.
      </p>
      <button onClick={() => onNext()} style={s.primaryBtn}>
        Open MnemosyneC{countdown > 0 ? ` (${countdown})` : ''} →
      </button>
      <button onClick={onSkip} style={{ ...s.skipAllBtn, opacity: 0.6 }}>
        Skip
      </button>
      <ProgressDots step={step} total={totalSteps} />
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  screen: {
    maxWidth: 420,
    margin: '0 auto',
    padding: '0 4px',
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    margin: '0 0 10px',
    fontSize: 20,
    fontWeight: 700,
    color: C.text,
    textAlign: 'center',
  },
  body: {
    margin: '0 0 16px',
    fontSize: 12,
    color: C.muted,
    lineHeight: 1.7,
    textAlign: 'center',
  },
  infoBox: {
    background: '#0f1923',
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: '12px 14px',
    marginBottom: 20,
  },
  primaryBtn: {
    background: '#1e3a5f',
    border: `1px solid ${C.accent}`,
    borderRadius: 8,
    color: C.accent,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 700,
    padding: '11px 20px',
    width: '100%',
    marginBottom: 10,
    fontFamily: 'inherit',
  },
  skipAllBtn: {
    background: 'transparent',
    border: 'none',
    color: C.muted,
    cursor: 'pointer',
    fontSize: 11,
    textDecoration: 'underline',
    padding: '4px 0',
    width: '100%',
    textAlign: 'center' as const,
    display: 'block',
  },
  question: {
    marginBottom: 16,
  },
  questionLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    fontWeight: 600,
    color: C.text,
    marginBottom: 3,
  },
  optTag: {
    fontSize: 10,
    fontWeight: 400,
    color: C.muted,
    background: '#1e2d45',
    padding: '1px 6px',
    borderRadius: 10,
    letterSpacing: '0.02em',
  },
  questionDesc: {
    margin: '0 0 6px',
    fontSize: 10,
    color: C.muted,
    lineHeight: 1.6,
  },
  checkRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    cursor: 'pointer',
    marginBottom: 2,
  },
  input: {
    background: '#070d1a',
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    color: C.text,
    fontSize: 12,
    padding: '8px 12px',
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
  },
};
