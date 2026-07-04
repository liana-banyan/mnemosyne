// MnemosyneC · v0.5.1 · BP082+BP085 · 2026-06-18
// §2 Truth-Always · §3 Sonnet 4.6 · Founder-ratified
//
// LeanShell — tab wrapper for first-time users.
// Feature-flag driven: localStorage 'mnemoUiMode' = 'lean' | 'advanced'
// New users default to 'lean'; existing users (mnemosynec_onboarding_complete) default to 'advanced'.
// Advanced mode passes through to MnemosyneTabView unchanged.
// v0.2.0 (BP082): added 4th "Help" tab — community + OAuth + eblet capture.
// v0.5.1 (BP085): added "Pipeline" tab — Founder↔Son peer copy/paste + screenshot pipeline.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MnemosyneTabView } from './MnemosyneTabView';
import { LeanHomeTab } from './LeanHomeTab';
import { LeanGauntletTab } from './LeanGauntletTab';
import { LeanAskTab } from './LeanAskTab';
import { LeanHelpTab } from './LeanHelpTab';
// BP082 v0.3.0 -- Battery Dispatch Publish Fan-Out
import { BatteryPublishTab } from './BatteryPublishTab';
// v0.4.0 BP083 -- The Diagnosis
import { TheDiagnosisTab } from './TheDiagnosisTab';
// v0.5.1 BP085 -- Help Tab peer pipeline
import { HelpTab } from './HelpTab';
// BP094 v0.8.0 -- CSIA-Hybrid in-app inference chat (replaces external URL stub)
import { CSIAHybridChat } from './CSIAHybridChat';
import type { FrameMode } from './FrameModeIndicator';
import type { AuthState } from '../amplify.d';

// ─── BP085 — openMembershipCheckout (shared by all 3 button surfaces) ────────

async function openMembershipCheckout(
  onError?: (msg: string) => void,
): Promise<void> {
  try {
    const result = await window.amplify?.openMembershipCheckout?.();
    if (!result) {
      window.open('https://lianabanyan.com/join?source=mnemosynec-app', '_blank', 'noopener');
      return;
    }
    if (!result.ok) {
      onError?.(`Couldn't open membership page: ${result.error ?? 'unknown error'}`);
    }
  } catch {
    onError?.('Membership page could not open. Please visit lianabanyan.com/join');
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

type LeanTab = 'home' | 'gauntlet' | 'ask' | 'help' | 'publish' | 'diagnosis' | 'pipeline' | 'csia-hybrid';
type UiMode = 'lean' | 'advanced';

const LS_UI_MODE = 'mnemoUiMode';
const LS_ONBOARDING_COMPLETE = 'mnemosynec_onboarding_complete';
const LS_LEAN_SETUP_DONE = 'lean_bg_setup_complete';

export interface LeanShellProps {
  currentMode: FrameMode;
  onModeChange: (mode: FrameMode) => void;
  onClose: () => void;
  authState: AuthState | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolves the initial UI mode for a user session.
 *
 * Resolution priority (highest to lowest):
 *  1. `mnemoUiMode = 'lean' | 'advanced'`  → returns that value (explicit user choice)
 *  2. Any other stored value for `mnemoUiMode` → cleared from localStorage, falls to step 3
 *  3. `mnemosynec_onboarding_complete` set  → `'advanced'` (existing user)
 *  4. No flags at all                       → `'lean'` (new user LEAN DEFAULT)
 *
 * In cases 3–4, the resolved mode is written back to `mnemoUiMode` for fast
 * reads on subsequent renders.
 *
 * SEG-V0152-P0-LEAN-DEFAULT verified: clean VM, no localStorage → opens to LEAN 3-tab UI.
 */
function resolveInitialUiMode(): UiMode {
  const stored = localStorage.getItem(LS_UI_MODE);
  if (stored === 'lean' || stored === 'advanced') return stored;
  // Guard: stored is non-null but not a recognised mode value — corrupted or legacy string.
  // Explicitly remove it so the new/existing-user fallback logic applies cleanly.
  if (stored !== null) {
    localStorage.removeItem(LS_UI_MODE);
  }
  // Only treat as 'advanced' when onboarding was completed with the current 'true' value.
  // Prior versions (pre-v0.1.51 LeanShell era) wrote '1' instead of 'true'. Those users
  // get 'lean' on fresh install — prevents Bp067FirstRunSpine full-window overlay on the
  // advanced path blocking the tab strip (P0 regression v0.1.60 → v0.1.61 hotfix).
  const isExistingUser =
    localStorage.getItem(LS_ONBOARDING_COMPLETE) === 'true' ||
    localStorage.getItem('mnemosyne-bp067-first-run-complete') === 'true';
  const mode: UiMode = isExistingUser ? 'advanced' : 'lean';
  localStorage.setItem(LS_UI_MODE, mode);
  return mode;
}

const LS_LEAN_NUDGE_DISMISSED = 'lean_nudge_dismissed';

// ─── LeanModeNudge ────────────────────────────────────────────────────────────

function LeanModeNudge({ onSwitch }: { onSwitch: () => void }) {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(LS_LEAN_NUDGE_DISMISSED) === '1'
  );
  const [switching, setSwitching] = useState(false);

  if (dismissed) return null;

  const handleSwitch = () => {
    setSwitching(true);
    setTimeout(() => onSwitch(), 200);
  };

  const handleDismiss = () => {
    localStorage.setItem(LS_LEAN_NUDGE_DISMISSED, '1');
    setDismissed(true);
  };

  return (
    <div style={{
      height: 32,
      background: '#0a1628',
      borderBottom: '1px solid #1e3a5c',
      display: 'flex',
      alignItems: 'center',
      paddingLeft: 12,
      paddingRight: 8,
      flexShrink: 0,
      gap: 8,
    }}>
      <button
        onClick={handleSwitch}
        disabled={switching}
        style={{
          background: 'none',
          border: 'none',
          color: switching ? '#94a3b8' : '#6ee7b7',
          fontSize: 12,
          cursor: switching ? 'default' : 'pointer',
          fontFamily: 'system-ui, sans-serif',
          padding: 0,
          textDecoration: 'underline',
          outline: 'none',
        }}
      >
        {switching ? 'Switching…' : '✨ Try the new simpler view (Lean Mode) →'}
      </button>
      <div style={{ flex: 1 }} />
      <button
        onClick={handleDismiss}
        title="Dismiss"
        style={{
          background: 'none',
          border: 'none',
          color: '#475569',
          fontSize: 14,
          cursor: 'pointer',
          padding: '0 4px',
          outline: 'none',
          lineHeight: 1,
        }}
      >
        ✕
      </button>
    </div>
  );
}

// ─── Tab bar ─────────────────────────────────────────────────────────────────

const TABS: Array<{ id: LeanTab; label: string }> = [
  { id: 'home',        label: 'Home' },
  { id: 'gauntlet',   label: 'Gauntlet' },
  { id: 'ask',        label: 'Ask' },
  { id: 'help',       label: 'Help' },
  { id: 'publish',    label: '🔥 Publish' },
  { id: 'diagnosis',  label: '🩺 Diagnosis' },
  { id: 'pipeline',   label: '📋 Pipeline' },
  { id: 'csia-hybrid', label: 'CSIA-Hybrid' },
];

function TabBar({
  active,
  onSelect,
  onSwitchAdvanced,
  isMember,
  onMemberCta,
}: {
  active: LeanTab;
  onSelect: (t: LeanTab) => void;
  onSwitchAdvanced: () => void;
  isMember: boolean;
  onMemberCta: () => void;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      background: '#0d1117',
      borderBottom: '1px solid #1e2a38',
      height: 40,
      paddingLeft: 8,
      paddingRight: 8,
      flexShrink: 0,
    }}>
      {TABS.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            style={{
              background: 'none',
              border: 'none',
              color: isActive ? '#f0fdf4' : '#64748b',
              fontFamily: 'system-ui, sans-serif',
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              padding: '0 16px',
              height: '100%',
              cursor: 'pointer',
              position: 'relative',
              transition: 'color 0.15s',
              borderBottom: isActive ? '2px solid #6ee7b7' : '2px solid transparent',
              outline: 'none',
            }}
          >
            {t.label}
          </button>
        );
      })}
      <div style={{ flex: 1 }} />
      {/* BP085 — Persistent member CTA, hidden for existing members */}
      {!isMember && (
        <button
          className="member-cta-topbar"
          onClick={onMemberCta}
          title="Join the Cooperative — $5/yr"
          style={{
            background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)',
            border: '1px solid #059669',
            borderRadius: 4,
            color: '#6ee7b7',
            fontSize: 11,
            fontWeight: 700,
            padding: '3px 10px',
            cursor: 'pointer',
            fontFamily: 'system-ui, sans-serif',
            outline: 'none',
            marginRight: 6,
            whiteSpace: 'nowrap',
          }}
        >
          Become a Member · $5/yr
        </button>
      )}
      <button
        onClick={onSwitchAdvanced}
        title="Switch to advanced mode (all tabs)"
        style={{
          background: 'none',
          border: '1px solid #1e2a38',
          borderRadius: 4,
          color: '#475569',
          fontSize: 11,
          padding: '3px 8px',
          cursor: 'pointer',
          fontFamily: 'system-ui, sans-serif',
          outline: 'none',
        }}
      >
        ⚙ Advanced
      </button>
    </div>
  );
}

// ─── Thin status bar ─────────────────────────────────────────────────────────

function BgStatusBar({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div style={{
      height: 24,
      background: '#0a0f1a',
      borderBottom: '1px solid #1e2a38',
      display: 'flex',
      alignItems: 'center',
      paddingLeft: 12,
      opacity: 0.8,
      flexShrink: 0,
    }}>
      <span style={{
        fontSize: 11,
        fontFamily: 'system-ui, sans-serif',
        color: '#6ee7b7',
        letterSpacing: '0.02em',
      }}>
        ◌ {msg}
      </span>
    </div>
  );
}

// ─── LeanShell ────────────────────────────────────────────────────────────────

export function LeanShell({ currentMode, onModeChange, onClose, authState }: LeanShellProps) {
  const [uiMode, setUiMode] = useState<UiMode>(resolveInitialUiMode);
  const [activeTab, setActiveTab] = useState<LeanTab>('home');
  const [bgStatus, setBgStatus] = useState<string | null>(null);
  const setupFiredRef = useRef(false);

  // BP085 — membership state
  const [isMember, setIsMember] = useState<boolean>(
    authState?.member?.is_member === true,
  );
  const [memberToast, setMemberToast] = useState<string | null>(null);

  const showMemberToast = useCallback((msg: string) => {
    setMemberToast(msg);
    setTimeout(() => setMemberToast(null), 4000);
  }, []);

  const handleMemberCta = useCallback(() => {
    void openMembershipCheckout((err) => showMemberToast(err));
  }, [showMemberToast]);

  // Sync isMember from authState changes
  useEffect(() => {
    setIsMember(authState?.member?.is_member === true);
  }, [authState]);

  // Check local membership status on mount (persisted by deep-link return)
  useEffect(() => {
    window.amplify?.checkLocalMembershipStatus?.().then((result) => {
      if (result?.is_member) setIsMember(true);
    }).catch(() => {});
  }, []);

  // Listen for membership activation result from mnemosynec:// deep-link
  useEffect(() => {
    const unsub = window.amplify?.onMembershipActivated?.((result) => {
      if (result.ok) {
        setIsMember(true);
        showMemberToast('Welcome to the Cooperative! You are now a member.');
      } else {
        showMemberToast(`Membership activation failed: ${result.error ?? 'unknown error'}`);
      }
    });
    return () => { unsub?.(); };
  }, [showMemberToast]);

  // Sync uiMode with localStorage changes from SettingsTab (advanced mode)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_UI_MODE && (e.newValue === 'lean' || e.newValue === 'advanced')) {
        setUiMode(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Auto-start background setup on first lean launch
  useEffect(() => {
    if (uiMode !== 'lean') return;
    if (setupFiredRef.current) return;
    if (localStorage.getItem(LS_LEAN_SETUP_DONE) === '1') return;
    setupFiredRef.current = true;

    const unsubStatus = window.amplify?.onLeanInstallStatus?.((data) => {
      if (data.step === 'model_ready' || data.step === 'model_complete') {
        setBgStatus(null);
        localStorage.setItem(LS_LEAN_SETUP_DONE, '1');
      } else if (data.step === 'ollama_ready') {
        setBgStatus('AI engine ready. Checking model…');
      } else if (data.step === 'starting_engine') {
        setBgStatus('Starting your AI engine…');
      } else if (data.step === 'pulling_model') {
        setBgStatus('Downloading your AI model… (this takes a few minutes)');
      } else if (data.step === 'waiting_ollama') {
        setBgStatus('Visit ollama.com to install Ollama, then relaunch MnemosyneC.');
      } else {
        setBgStatus(data.message);
      }
    });

    const unsubProgress = window.amplify?.onLeanInstallProgress?.((data) => {
      setBgStatus(`Downloading your AI model… ${data.percentComplete}%`);
    });

    const unsubError = window.amplify?.onLeanInstallError?.((data) => {
      if (!data.retryable) setBgStatus(null);
    });

    // Also listen for lean-bg-status events (future main-process emissions)
    const unsubBg = window.amplify?.onLeanBgStatus?.((payload) => {
      if (payload.type === 'setup-status' && payload.msg === 'ready') {
        setBgStatus(null);
        localStorage.setItem(LS_LEAN_SETUP_DONE, '1');
      } else if (payload.type === 'setup-progress') {
        setBgStatus(payload.msg + (payload.pct != null ? ` ${payload.pct}%` : ''));
      } else if (payload.type === 'mesh-status') {
        // Gauntlet federation panel will handle this
      } else {
        setBgStatus(payload.msg);
      }
    });

    // Fire background install silently
    window.amplify?.leanInstallStart?.().catch(() => {});

    return () => {
      unsubStatus?.();
      unsubProgress?.();
      unsubError?.();
      unsubBg?.();
    };
  }, [uiMode]);

  const switchToAdvanced = useCallback(() => {
    localStorage.setItem(LS_UI_MODE, 'advanced');
    setUiMode('advanced');
  }, []);

  const switchToLean = useCallback(() => {
    localStorage.setItem(LS_UI_MODE, 'lean');
    window.dispatchEvent(new StorageEvent('storage', { key: LS_UI_MODE, newValue: 'lean', storageArea: localStorage }));
    setUiMode('lean');
  }, []);

  // A-4 BP081 v0.1.59.1: Onboarding gate auto-flip
  // If Ollama healthy + Gemma present + Test It Out run ≥1 → auto-set onboarding complete
  useEffect(() => {
    const unsub = window.amplify?.onOnboardingAutoFlipCheck?.((data) => {
      if (data.ollamaHealthy && data.gemmaPresent) {
        const testItOutRunCount = parseInt(localStorage.getItem('mnemo_test_it_out_run_count') ?? '0', 10);
        if (testItOutRunCount >= 1) {
          const alreadyComplete = localStorage.getItem(LS_ONBOARDING_COMPLETE) === '1';
          if (!alreadyComplete) {
            localStorage.setItem(LS_ONBOARDING_COMPLETE, '1');
            console.log('[Onboarding] Auto-flip: conditions met, advanced view unlocked');
            // Trigger re-resolution of UI mode (existing user path → advanced)
            const resolved = resolveInitialUiMode();
            setUiMode(resolved);
          }
        }
      }
    });
    return () => { unsub?.(); };
  }, []);

  // Pass-through to full MnemosyneTabView for advanced users
  if (uiMode === 'advanced') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <LeanModeNudge onSwitch={switchToLean} />
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <MnemosyneTabView
            currentMode={currentMode}
            onModeChange={onModeChange}
            onClose={onClose}
            authState={authState}
          />
        </div>
      </div>
    );
  }

  // ── Lean 3-tab UI ─────────────────────────────────────────────────────────

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#0a0f1a',
      color: '#f0fdf4',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      overflow: 'hidden',
    }}>
      <BgStatusBar msg={bgStatus} />
      {/* BP085 — membership toast notification */}
      {memberToast && (
        <div style={{
          position: 'fixed', top: 48, right: 12, zIndex: 9999,
          background: isMember ? '#065f46' : '#7f1d1d',
          border: `1px solid ${isMember ? '#059669' : '#991b1b'}`,
          borderRadius: 6,
          padding: '8px 14px',
          fontSize: 12,
          color: isMember ? '#6ee7b7' : '#fca5a5',
          fontFamily: 'system-ui, sans-serif',
          maxWidth: 320,
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>
          {memberToast}
        </div>
      )}
      <TabBar
        active={activeTab}
        onSelect={setActiveTab}
        onSwitchAdvanced={switchToAdvanced}
        isMember={isMember}
        onMemberCta={handleMemberCta}
      />
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {activeTab === 'home' && (
          <LeanHomeTab onSwitchTab={setActiveTab} />
        )}
        {activeTab === 'gauntlet' && (
          <LeanGauntletTab authState={authState} />
        )}
        {activeTab === 'ask' && (
          <LeanAskTab onSwitchToHome={() => setActiveTab('home')} />
        )}
        {activeTab === 'help' && (
          <LeanHelpTab />
        )}
        {activeTab === 'publish' && (
          <BatteryPublishTab />
        )}
        {activeTab === 'diagnosis' && (
          <TheDiagnosisTab />
        )}
        {activeTab === 'pipeline' && (
          <HelpTab />
        )}
        {activeTab === 'csia-hybrid' && (
          <CSIAHybridChat />
        )}
      </div>
    </div>
  );
}
