// MnemosyneC — Make Yourself Comfortable Wizard + OnboardingWizard (sidebar)
// BP041 Canon: "What do you want substrate access to for yourself?"
// Folder picker → dual-checkbox (Pixie-lated for ME / Shared with Federation)
// Pantheon dispatch progress (LiveSegWatch-style)
// Member sovereignty: all OFF by default; member must explicitly check.
//
// BP065 v0.1.23 — OnboardingWizard revamp: 6-click → minimal-click per canon:
//   canon_onboarding_minimal_clicks_sensible_defaults_skip_everything_explain_or_skip_bp065
//   canon_mnemosynec_minimum_install_substrate_only_no_ollama_no_key_any_hardware_bp065
//   canon_ai_burst_works_key_free_by_default_api_key_optional_never_block_untech_bp065
// Now 3 screens: Welcome · Quick Setup · All Set. Keypair auto-generated silently.
// Ollama card removed from sidebar (jargon, not needed at onboarding).
// "Skip all → open the app" on every screen.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ScreenWelcome,
  ScreenSetup,
  ScreenAllSet,
  type SetupPrefs,
} from './OnboardingScreens';
import { LocFaqModal } from '../../components/LocFaqPanel';

// ─── OnboardingWizard (non-blocking sidebar) ──────────────────────────────────
// KniPr012: converted from full-page replacement to position:fixed right sidebar.
// Main app content is visible and interactive behind it.
// BP065: reduced to 3 screens, Ollama card removed, keypair auto-generated silently.

const ONBOARDED_KEY = 'mnemosyne-onboarded';
const TOTAL_STEPS = 3;

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

type OnboardingScreen = 1 | 2 | 3;

// ─── OnboardingWizard ─────────────────────────────────────────────────────────
// BP065 v0.1.23: 3-screen minimal flow. Ollama card removed (jargon).
// Keypair auto-generated silently in ScreenWelcome. Skip-all on every screen.
// Setup prefs (shortcut, startup, apiKey) applied via IPC on Screen 2 → 3 transition.

export function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<OnboardingScreen>(1);
  const [collected, setCollected] = useState<Record<string, unknown>>({});
  const [showLocFaq, setShowLocFaq] = useState(false);

  const finish = () => {
    try { localStorage.setItem(ONBOARDED_KEY, 'true'); } catch { /* ignore */ }
    onComplete();
  };

  const applySetupPrefs = async (prefs: SetupPrefs) => {
    try {
      await (window as any).amplify?.applyOnboardingPrefs?.(prefs);
    } catch { /* non-fatal: prefs are best-effort */ }
  };

  const handleNext = (data?: Record<string, unknown>) => {
    const merged = data ? { ...collected, ...data } : collected;
    setCollected(merged);

    if (step === TOTAL_STEPS) {
      finish();
    } else {
      // On transition from Screen 2 (setup), apply prefs in background
      if (step === 2 && data) {
        void applySetupPrefs({
          displayName: (data.displayName as string) ?? '',
          addDesktopShortcut: (data.addDesktopShortcut as boolean) ?? true,
          addStartupItem: (data.addStartupItem as boolean) ?? false,
          apiKey: (data.apiKey as string) ?? '',
        });
      }
      setStep((prev) => (prev + 1) as OnboardingScreen);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep((prev) => (prev - 1) as OnboardingScreen);
  };

  const screenProps = {
    onNext: handleNext,
    onBack: handleBack,
    onSkip: finish,
    step,
    totalSteps: TOTAL_STEPS,
    collected,
  };

  return (
    <>
      {/* Click-through semi-transparent backdrop — does NOT block clicks on main UI */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.25)',
          zIndex: 800,
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      />

      {/* Sidebar panel */}
      <div
        role="dialog"
        aria-modal="false"
        aria-label="MnemosyneC first-run setup"
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          height: '100%',
          width: 400,
          background: C.bg,
          borderLeft: `1px solid ${C.border}`,
          boxShadow: '-8px 0 32px rgba(0,0,0,0.6)',
          zIndex: 801,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Dismiss × — always available, always skips to app */}
        <button
          onClick={finish}
          aria-label="Skip setup — open the app now"
          style={{
            position: 'absolute',
            top: 12,
            right: 14,
            background: 'none',
            border: 'none',
            color: C.muted,
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
            padding: '2px 4px',
            zIndex: 1,
          }}
          title="Skip setup — all options available in Settings later"
        >
          ×
        </button>

        {/* Step counter */}
        <div style={{ fontSize: 10, color: C.muted, textAlign: 'center', paddingTop: 20 }}>
          Step {step} of {TOTAL_STEPS}
        </div>

        {/* Screen content */}
        <div style={{ flex: 1, padding: '8px 24px 20px' }}>
          {step === 1 && <ScreenWelcome {...screenProps} />}
          {step === 2 && <ScreenSetup {...screenProps} />}
          {step === 3 && <ScreenAllSet {...screenProps} />}
        </div>

        {/* Sidebar footer — Grand Project link */}
        <div style={{
          borderTop: '1px solid rgba(100,116,139,0.15)',
          padding: '10px 24px',
          flexShrink: 0,
        }}>
          <button
            onClick={() => setShowLocFaq(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#6ee7b7',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 500,
              padding: 0,
              textDecoration: 'underline',
              textDecorationColor: 'rgba(110,231,183,0.35)',
              fontFamily: 'inherit',
            }}
          >
            Learn about the Grand Project →
          </button>
          <div style={{ fontSize: 9, color: '#334155', marginTop: 2 }}>
            Library of Congress · 10,000-node cooperative network
          </div>
        </div>
      </div>

      {showLocFaq && <LocFaqModal onClose={() => setShowLocFaq(false)} />}
    </>
  );
}

// ─── OnboardingGate ───────────────────────────────────────────────────────────
// Renders OnboardingWizard sidebar on first launch, then renders children.
// KniPr012: sidebar is non-blocking — children are always rendered.

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setOnboarded(localStorage.getItem(ONBOARDED_KEY) === 'true');
    } catch {
      setOnboarded(true); // fail-open: don't gate on storage errors
    }
  }, []);

  if (onboarded === null) return <>{children}</>; // render children immediately; sidebar appears after hydration

  return (
    <>
      {children}
      {!onboarded && (
        <OnboardingWizard onComplete={() => setOnboarded(true)} />
      )}
    </>
  );
}


// ─── Types (inline to avoid cross-context import issues) ─────────────────────

interface FolderPref {
  folder_path: string;
  pixelated: boolean;
  federation_shared: boolean;
  subfolder_overrides: Array<{ folder_path: string; pixelated: boolean; federation_shared: boolean }>;
  added_at: string;
  last_mined_at?: string;
  tablet_counts?: { iron: number; stone: number };
}

interface AllFolderPrefs {
  member_id: string;
  updated_at: string;
  folders: FolderPref[];
}

interface PantheonProgress {
  session_id: string;
  persona: string;
  persona_label: string;
  persona_icon: string;
  phase: 'scanning' | 'generating' | 'done' | 'error';
  message: string;
  tablets_written?: number;
  total_so_far?: number;
}

interface TabletCounts { iron: number; stone: number; total: number }

const PERSONA_DISPLAY: Record<string, { icon: string; label: string }> = {
  miner: { icon: '🛠️', label: 'Miners' },
  fates: { icon: '🧶', label: 'Fates' },
  forager: { icon: '🦊', label: 'Foragers' },
  pixies: { icon: '🧚', label: 'Pixies' },
  shadow_spider: { icon: '🕷️', label: 'Shadow E-Spiders' },
  shadow_sprite: { icon: '🧝', label: 'Shadow E-Sprites' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function PersonaProgressRow({ evt }: { evt: PantheonProgress }) {
  const meta = PERSONA_DISPLAY[evt.persona] ?? { icon: '🔮', label: evt.persona };
  const isDone = evt.phase === 'done';
  const isError = evt.phase === 'error';
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0',
      opacity: isDone ? 0.75 : 1,
    }}>
      <span style={{ fontSize: 16, minWidth: 22 }}>{meta.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#c9d1d9' }}>{meta.label}</span>
          {isDone && <span style={{ fontSize: 10, color: '#3fb950' }}>✓</span>}
          {isError && <span style={{ fontSize: 10, color: '#f85149' }}>✗</span>}
          {evt.tablets_written !== undefined && evt.tablets_written > 0 && (
            <span style={{ fontSize: 10, color: '#58a6ff', marginLeft: 'auto' }}>
              +{evt.tablets_written} tablets
            </span>
          )}
        </div>
        <div style={{ fontSize: 10, color: isError ? '#f85149' : '#8b949e', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {evt.message}
        </div>
      </div>
    </div>
  );
}

function FolderRow({
  pref,
  onToggle,
  onRemove,
  onMine,
  isMining,
}: {
  pref: FolderPref;
  onToggle: (field: 'pixelated' | 'federation_shared', val: boolean) => void;
  onRemove: () => void;
  onMine: () => void;
  isMining: boolean;
}) {
  const short = pref.folder_path.split(/[\\/]/).slice(-2).join('/');
  return (
    <div style={{
      background: '#161b22',
      border: '1px solid #30363d',
      borderRadius: 8,
      padding: '12px 14px',
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 16 }}>📂</span>
        <span style={{ flex: 1, fontSize: 12, color: '#c9d1d9', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={pref.folder_path}>
          {short}
        </span>
        <button
          onClick={onRemove}
          style={{ background: 'none', border: 'none', color: '#6e7681', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
          title="Remove folder"
        >✕</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={pref.pixelated}
            onChange={(e) => onToggle('pixelated', e.target.checked)}
            style={{ accentColor: '#58a6ff' }}
          />
          <span style={{ fontSize: 11, color: '#c9d1d9' }}>
            🧚 <strong>Pixie-lated for ME</strong>
            <span style={{ color: '#8b949e', marginLeft: 4 }}>(private substrate)</span>
          </span>
        </label>

        <label style={{
          display: 'flex', alignItems: 'center', gap: 8, cursor: pref.pixelated ? 'pointer' : 'not-allowed',
          opacity: pref.pixelated ? 1 : 0.4,
        }}>
          <input
            type="checkbox"
            checked={pref.federation_shared}
            disabled={!pref.pixelated}
            onChange={(e) => onToggle('federation_shared', e.target.checked)}
            style={{ accentColor: '#3fb950' }}
          />
          <span style={{ fontSize: 11, color: '#c9d1d9' }}>
            🌐 <strong>Shared with Federation</strong>
            <span style={{ color: '#8b949e', marginLeft: 4 }}>(cooperative opt-in)</span>
          </span>
        </label>
      </div>

      {pref.tablet_counts && (
        <div style={{ fontSize: 10, color: '#8b949e', marginBottom: 8 }}>
          {pref.tablet_counts.iron} Iron Tablets · {pref.tablet_counts.stone} Stone Tablets
          {pref.last_mined_at && <span style={{ marginLeft: 8 }}>· last mined {pref.last_mined_at.slice(0, 10)}</span>}
        </div>
      )}

      <button
        onClick={onMine}
        disabled={!pref.pixelated || isMining}
        style={{
          background: pref.pixelated && !isMining ? '#1f6feb' : '#21262d',
          border: '1px solid #30363d',
          borderRadius: 6,
          color: pref.pixelated && !isMining ? '#fff' : '#6e7681',
          cursor: pref.pixelated && !isMining ? 'pointer' : 'not-allowed',
          fontSize: 11,
          padding: '5px 12px',
          width: '100%',
        }}
      >
        {isMining ? '⏳ Pantheon descending...' : '🪄 Begin Mining →'}
      </button>
    </div>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export function MakeYourselfComfortableWizard() {
  const [memberId] = useState<string>('founder'); // Phase A: founder-id; Phase B: from auth
  const [prefs, setPrefs] = useState<AllFolderPrefs | null>(null);
  const [progressLog, setProgressLog] = useState<PantheonProgress[]>([]);
  const [miningFolder, setMiningFolder] = useState<string | null>(null);
  const [miningReceipt, setMiningReceipt] = useState<unknown>(null);
  const [tabletCounts, setTabletCounts] = useState<TabletCounts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const progressEndRef = useRef<HTMLDivElement>(null);

  const loadPrefs = useCallback(async () => {
    try {
      const p = (await window.amplify.pantheonGetPrefs(memberId)) as AllFolderPrefs;
      setPrefs(p);
    } catch (e) {
      setError(String(e));
    }
  }, [memberId]);

  const loadTabletCounts = useCallback(async () => {
    try {
      const c = await window.amplify.pantheonCountTablets(memberId);
      setTabletCounts(c);
    } catch { /* non-fatal */ }
  }, [memberId]);

  useEffect(() => {
    void loadPrefs();
    void loadTabletCounts();

    const unsub = window.amplify.onPantheonProgress((evt: unknown) => {
      const progress = evt as PantheonProgress;
      setProgressLog((prev) => {
        const idx = prev.findLastIndex?.((e) => e.persona === progress.persona) ?? -1;
        if (idx >= 0 && prev[idx].phase !== 'done' && prev[idx].phase !== 'error') {
          const next = [...prev];
          next[idx] = progress;
          return next;
        }
        return [...prev, progress];
      });

      if (progress.phase === 'done' || progress.phase === 'error') {
        void loadTabletCounts();
      }
    });

    return () => unsub();
  }, [loadPrefs, loadTabletCounts]);

  useEffect(() => {
    progressEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [progressLog]);

  const handlePickFolder = async () => {
    const folder = await window.amplify.pantheonPickFolder();
    if (!folder) return;
    await window.amplify.pantheonSetPref(memberId, folder, true, false);
    await loadPrefs();
  };

  const handleToggle = async (
    folderPath: string,
    field: 'pixelated' | 'federation_shared',
    val: boolean,
  ) => {
    const current = prefs?.folders.find((f) => f.folder_path === folderPath);
    if (!current) return;
    const pixelated = field === 'pixelated' ? val : current.pixelated;
    const federation_shared = field === 'federation_shared' ? val : current.federation_shared;
    await window.amplify.pantheonSetPref(memberId, folderPath, pixelated, federation_shared);
    await loadPrefs();
  };

  const handleRemove = async (folderPath: string) => {
    await window.amplify.pantheonRemovePref(memberId, folderPath);
    await loadPrefs();
  };

  const handleMine = async (pref: FolderPref) => {
    if (miningFolder) return;
    setMiningFolder(pref.folder_path);
    setProgressLog([]);
    setMiningReceipt(null);
    setError(null);
    try {
      const scope = pref.federation_shared ? 'federation' : 'private';
      const receipt = await window.amplify.pantheonDispatch(memberId, pref.folder_path, scope);
      setMiningReceipt(receipt);
      await loadPrefs();
      await loadTabletCounts();
    } catch (e) {
      setError(String(e));
    } finally {
      setMiningFolder(null);
    }
  };

  const handleWipe = async () => {
    if (!confirm('Wipe all your Tablets? This cannot be undone.')) return;
    const result = await window.amplify.pantheonWipe(memberId);
    setProgressLog([]);
    setMiningReceipt(null);
    await loadTabletCounts();
    alert(`Wiped ${result.wiped} tablets. Your substrate is clear.`);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{
      background: '#0d1117',
      color: '#c9d1d9',
      fontFamily: 'system-ui, sans-serif',
      height: '100%',
      overflowY: 'auto',
      padding: 16,
    }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 20 }}>🪑</span>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Make Yourself Comfortable</h2>
        </div>
        <p style={{ margin: 0, fontSize: 11, color: '#8b949e', lineHeight: 1.5 }}>
          What do you want substrate access to for yourself?<br />
          The Pantheon descends on your chosen folders:&nbsp;
          <span style={{ color: '#c9d1d9' }}>Miners · Fates · Foragers · Pixies · Spiders · Sprites</span>
        </p>
      </div>

      {/* Tablet counts */}
      {tabletCounts && tabletCounts.total > 0 && (
        <div style={{
          background: '#161b22',
          border: '1px solid #30363d',
          borderRadius: 8,
          padding: '8px 14px',
          marginBottom: 12,
          display: 'flex',
          gap: 16,
          alignItems: 'center',
        }}>
          <span style={{ fontSize: 12 }}>🗂️ Your Substrate</span>
          <span style={{ fontSize: 11, color: '#8b949e' }}>
            ⚙️ {tabletCounts.iron} Iron Tablets
          </span>
          <span style={{ fontSize: 11, color: '#e3b341' }}>
            🗿 {tabletCounts.stone} Stone Tablets
          </span>
          <button
            onClick={handleWipe}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: '1px solid #6e7681',
              borderRadius: 4,
              color: '#6e7681',
              cursor: 'pointer',
              fontSize: 10,
              padding: '2px 8px',
            }}
          >
            Wipe Substrate
          </button>
        </div>
      )}

      {/* Sovereignty notice */}
      <div style={{
        background: '#0f1923',
        border: '1px solid #1f3a52',
        borderRadius: 8,
        padding: '8px 12px',
        marginBottom: 12,
        fontSize: 10,
        color: '#58a6ff',
        lineHeight: 1.6,
      }}>
        🛡️ Your data stays on <strong>YOUR computer</strong>. Federation sharing is per-folder opt-in only.
        You can stop, pause, or wipe your substrate at any time.
      </div>

      {/* Folder list */}
      {error && (
        <div style={{ color: '#f85149', fontSize: 11, marginBottom: 8, padding: '6px 10px', background: '#1c0a0a', borderRadius: 6 }}>
          ✗ {error}
        </div>
      )}

      {prefs?.folders.map((pref) => (
        <FolderRow
          key={pref.folder_path}
          pref={pref}
          onToggle={(field, val) => void handleToggle(pref.folder_path, field, val)}
          onRemove={() => void handleRemove(pref.folder_path)}
          onMine={() => void handleMine(pref)}
          isMining={miningFolder === pref.folder_path}
        />
      ))}

      {/* Add folder button */}
      <button
        onClick={() => void handlePickFolder()}
        style={{
          background: '#21262d',
          border: '1px dashed #30363d',
          borderRadius: 8,
          color: '#58a6ff',
          cursor: 'pointer',
          fontSize: 12,
          padding: '10px 14px',
          width: '100%',
          marginBottom: 12,
          textAlign: 'left',
        }}
      >
        + Add folder...
      </button>

      {/* Progress log */}
      {progressLog.length > 0 && (
        <div style={{
          background: '#0f1117',
          border: '1px solid #30363d',
          borderRadius: 8,
          padding: '10px 12px',
          marginBottom: 10,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#8b949e', marginBottom: 6 }}>
            🪄 Pantheon descending
            {miningFolder && <span style={{ color: '#58a6ff', marginLeft: 6, fontFamily: 'monospace', fontSize: 10 }}>
              {miningFolder.split(/[\\/]/).slice(-1)[0]}
            </span>}
          </div>
          {progressLog.map((evt, i) => (
            <PersonaProgressRow key={`${evt.persona}-${i}`} evt={evt} />
          ))}
          <div ref={progressEndRef} />
        </div>
      )}

      {/* Receipt */}
      {miningReceipt && (() => {
        const r = miningReceipt as { total_tablets: number; iron_tablets: number; stone_tablets: number; completed_at: string };
        return (
          <div style={{
            background: '#0f1a0f',
            border: '1px solid #238636',
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 11,
            color: '#3fb950',
          }}>
            ✓ Mining complete — {r.total_tablets} Tablets generated
            ({r.iron_tablets} Iron, {r.stone_tablets} Stone)
            <span style={{ color: '#8b949e', marginLeft: 8 }}>{r.completed_at?.slice(0, 19).replace('T', ' ')}</span>
          </div>
        );
      })()}

      {/* Footer: skip / begin prompt if no folders yet */}
      {(!prefs?.folders || prefs.folders.length === 0) && (
        <div style={{
          marginTop: 8,
          textAlign: 'center',
          fontSize: 10,
          color: '#6e7681',
        }}>
          No folders selected. Add a folder above to let the Pantheon descend.
          <br />
          <span style={{ fontStyle: 'italic' }}>Your substrate respects "no permission to scan" as canonical state.</span>
        </div>
      )}
    </div>
  );
}
