// SettingsTab — Mnemosyne CAI Amplifier Settings
// Tab 4 (always visible) — BP047 W1
// Sections: Update · Appearance · AI Model Assignment · Substrate · Developer Mode
// Auto-updater is top-priority item (Founder direct)

import React, { useState, useEffect } from 'react';
import type { AuthState } from '../amplify.d';

interface SettingsTabProps {
  authState: AuthState | null;
  onDevModeToggle?: (enabled: boolean) => void;
  devEnabled?: boolean;
}

type Theme = 'dark' | 'light' | 'system';
type SubstrateMode = 'ai_burst' | 'normal' | 'fallback';
type ModelAssignment = 'ollama_local' | 'anthropic_cloud' | 'manual';

interface UpdateStatus {
  checking: boolean;
  upToDate: boolean | null;
  currentVersion: string;
  latestVersion: string | null;
  error: string | null;
}

interface PieceModels {
  bishop: ModelAssignment;
  knight: ModelAssignment;
  pawn: ModelAssignment;
  rook: ModelAssignment;
}

const MODEL_OPTIONS: Array<{ id: ModelAssignment; label: string; desc: string }> = [
  { id: 'ollama_local', label: 'Ollama (local)',      desc: 'Free · runs on your hardware · no API key needed' },
  { id: 'anthropic_cloud', label: 'Anthropic (cloud)', desc: 'Claude family · requires API key' },
  { id: 'manual',       label: 'Manual / Other',       desc: 'Enter endpoint + key yourself' },
];

const THEME_OPTIONS: Array<{ id: Theme; label: string; icon: string }> = [
  { id: 'dark',   label: 'Dark',   icon: '🌑' },
  { id: 'light',  label: 'Light',  icon: '☀️' },
  { id: 'system', label: 'System', icon: '💻' },
];

const MODE_OPTIONS: Array<{ id: SubstrateMode; label: string; desc: string }> = [
  { id: 'ai_burst',  label: '🔥 AI Burst',  desc: 'Maximum throughput · all AI channels open' },
  { id: 'normal',    label: '🪵 Normal',     desc: 'Balanced · recommended for most tasks' },
  { id: 'fallback',  label: '❄️ Fallback',   desc: 'Substrate-only · no AI required · Stage 2 mode' },
];

export function SettingsTab({ authState, onDevModeToggle, devEnabled = false }: SettingsTabProps) {
  const isMember = authState?.status === 'member' || authState?.status === 'trial_active';
  const isFounder = (authState as any)?.member?.is_founder === true;

  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    checking: false,
    upToDate: null,
    currentVersion: '',
    latestVersion: null,
    error: null,
  });

  const [theme, setTheme] = useState<Theme>(() =>
    (localStorage.getItem('mnemo_theme') as Theme | null) ?? 'dark'
  );

  const [substrateMode, setSubstrateMode] = useState<SubstrateMode>(() =>
    (localStorage.getItem('mnemo_default_mode') as SubstrateMode | null) ?? 'normal'
  );

  const [pieceModels, setPieceModels] = useState<PieceModels>(() => {
    const saved = localStorage.getItem('mnemo_piece_models');
    if (saved) {
      try { return JSON.parse(saved) as PieceModels; } catch { /* fall through */ }
    }
    return { bishop: 'ollama_local', knight: 'ollama_local', pawn: 'ollama_local', rook: 'ollama_local' };
  });

  useEffect(() => {
    const ver = (window as any).amplify?.getVersion?.();
    if (ver) {
      setUpdateStatus((s) => ({ ...s, currentVersion: ver }));
    }
  }, []);

  async function handleCheckForUpdate() {
    setUpdateStatus((s) => ({ ...s, checking: true, upToDate: null, error: null }));
    try {
      const result = await (window as any).amplify?.checkForUpdate?.();
      if (result === null || result === undefined) {
        setUpdateStatus((s) => ({ ...s, checking: false, upToDate: true, latestVersion: s.currentVersion }));
      } else {
        setUpdateStatus((s) => ({ ...s, checking: false, upToDate: false, latestVersion: result }));
      }
    } catch (err) {
      setUpdateStatus((s) => ({ ...s, checking: false, error: 'Update check failed — try again later.' }));
    }
  }

  function handleThemeChange(t: Theme) {
    setTheme(t);
    localStorage.setItem('mnemo_theme', t);
  }

  function handleModeChange(m: SubstrateMode) {
    setSubstrateMode(m);
    localStorage.setItem('mnemo_default_mode', m);
  }

  function handleModelChange(piece: keyof PieceModels, model: ModelAssignment) {
    const updated = { ...pieceModels, [piece]: model };
    setPieceModels(updated);
    localStorage.setItem('mnemo_piece_models', JSON.stringify(updated));
  }

  const s = styles;

  return (
    <div style={s.container}>

      {/* ── Section 1: MNEMOSYNE UPDATE ─────────────────────────────────── */}
      <section style={s.section}>
        <div style={s.sectionHeader}>⬆️ Mnemosyne™ Update</div>
        <div style={s.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={s.label}>Current strain</div>
              <div style={s.value}>{updateStatus.currentVersion || '—'}</div>
            </div>
            {updateStatus.latestVersion && !updateStatus.upToDate && (
              <div>
                <div style={s.label}>Available</div>
                <div style={{ ...s.value, color: '#6ee7b7' }}>{updateStatus.latestVersion}</div>
              </div>
            )}
            <button
              onClick={handleCheckForUpdate}
              disabled={updateStatus.checking}
              style={{ ...s.btn, opacity: updateStatus.checking ? 0.6 : 1 }}
            >
              {updateStatus.checking ? 'Checking…' : 'Check for update'}
            </button>
          </div>

          {updateStatus.upToDate === true && (
            <div style={s.successMsg}>✓ You're on the latest strain</div>
          )}
          {updateStatus.upToDate === false && updateStatus.latestVersion && (
            <div style={{ ...s.card, marginTop: 8, background: 'rgba(110,231,183,0.06)' }}>
              <div style={{ fontSize: 11, color: '#6ee7b7', fontWeight: 600, marginBottom: 6 }}>
                Mnemosyne {updateStatus.latestVersion} is available
              </div>
              <button
                style={{ ...s.btn, background: 'rgba(110,231,183,0.15)', borderColor: 'rgba(110,231,183,0.4)' }}
                onClick={() => (window as any).amplify?.installUpdate?.()}
              >
                Install + Restart →
              </button>
            </div>
          )}
          {updateStatus.error && (
            <div style={{ fontSize: 10, color: '#f87171', marginTop: 6 }}>{updateStatus.error}</div>
          )}
        </div>
      </section>

      {/* ── Section 2: APPEARANCE ────────────────────────────────────────── */}
      <section style={s.section}>
        <div style={s.sectionHeader}>🎨 Appearance</div>
        <div style={s.card}>
          <div style={s.label}>Theme</div>
          <div style={s.toggleRow}>
            {THEME_OPTIONS.map((t) => (
              <button
                key={t.id}
                onClick={() => handleThemeChange(t.id)}
                style={{
                  ...s.chip,
                  ...(theme === t.id ? s.chipActive : {}),
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 3: AI MODEL ASSIGNMENT ──────────────────────────────── */}
      <section style={s.section}>
        <div style={s.sectionHeader}>🤖 AI Model Assignment</div>
        <div style={s.note}>
          FREE AI: Ollama (onboard by default) — no cloud account, no API key, no cost
        </div>
        {(['bishop', 'knight', 'pawn', 'rook'] as const).map((piece) => (
          <div key={piece} style={{ ...s.card, marginBottom: 6 }}>
            <div style={s.label}>
              {piece === 'bishop' ? '✍️ Bishop' : piece === 'knight' ? '♞ Knight' : piece === 'pawn' ? '♟ Pawn' : '♜ Rook'}
            </div>
            <div style={s.toggleRow}>
              {MODEL_OPTIONS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleModelChange(piece, m.id)}
                  style={{
                    ...s.chip,
                    ...(pieceModels[piece] === m.id ? s.chipActive : {}),
                  }}
                  title={m.desc}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* ── Section 4: SUBSTRATE MODE ────────────────────────────────────── */}
      <section style={s.section}>
        <div style={s.sectionHeader}>⚙️ Substrate Default Mode</div>
        <div style={s.card}>
          <div style={s.toggleRow}>
            {MODE_OPTIONS.map((m) => (
              <button
                key={m.id}
                onClick={() => handleModeChange(m.id)}
                style={{
                  ...s.chip,
                  ...(substrateMode === m.id ? s.chipActive : {}),
                }}
                title={m.desc}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 9, color: '#475569', marginTop: 6 }}>
            {MODE_OPTIONS.find((m) => m.id === substrateMode)?.desc}
          </div>
        </div>
      </section>

      {/* ── Section 5: DEVELOPER MODE ────────────────────────────────────── */}
      {(isMember || isFounder) && (
        <section style={s.section}>
          <div style={s.sectionHeader}>🔧 Developer Mode</div>
          <div style={s.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={s.label}>Cooperative Defensive Patent Pledge #2260</div>
                <div style={{ fontSize: 9, color: '#475569', marginTop: 2 }}>
                  {devEnabled ? 'Developer mode active · submit variants · fork strains · SEG controls' : 'Requires membership + Pledge #2260 agreement'}
                </div>
              </div>
              <button
                onClick={() => onDevModeToggle?.(!devEnabled)}
                style={{
                  ...s.chip,
                  ...(devEnabled ? { ...s.chipActive, color: '#f59e0b', borderColor: 'rgba(245,158,11,0.4)' } : {}),
                }}
              >
                {devEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </section>
      )}

    </div>
  );
}

const styles = {
  container: {
    padding: '12px 16px',
    overflowY: 'auto' as const,
    height: '100%',
    boxSizing: 'border-box' as const,
  },
  section: {
    marginBottom: 16,
  } as React.CSSProperties,
  sectionHeader: {
    fontSize: 11,
    fontWeight: 700,
    color: '#94a3b8',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginBottom: 6,
  },
  card: {
    background: 'rgba(15,23,42,0.6)',
    border: '1px solid rgba(100,116,139,0.15)',
    borderRadius: 8,
    padding: '10px 12px',
  } as React.CSSProperties,
  label: {
    fontSize: 10,
    color: '#64748b',
    marginBottom: 4,
  },
  value: {
    fontSize: 12,
    fontWeight: 600,
    color: '#e2e8f0',
  },
  toggleRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 4,
  },
  chip: {
    background: 'rgba(100,116,139,0.08)',
    border: '1px solid rgba(100,116,139,0.2)',
    borderRadius: 6,
    color: '#64748b',
    fontSize: 10,
    fontWeight: 500,
    padding: '4px 10px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  } as React.CSSProperties,
  chipActive: {
    background: 'rgba(110,231,183,0.1)',
    borderColor: 'rgba(110,231,183,0.35)',
    color: '#6ee7b7',
    fontWeight: 700,
  } as React.CSSProperties,
  btn: {
    background: 'rgba(100,116,139,0.1)',
    border: '1px solid rgba(100,116,139,0.25)',
    borderRadius: 6,
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: 600,
    padding: '5px 12px',
    cursor: 'pointer',
  } as React.CSSProperties,
  note: {
    fontSize: 10,
    color: '#6ee7b7',
    background: 'rgba(110,231,183,0.06)',
    border: '1px solid rgba(110,231,183,0.15)',
    borderRadius: 6,
    padding: '5px 10px',
    marginBottom: 6,
  },
  successMsg: {
    fontSize: 10,
    color: '#22c55e',
    marginTop: 6,
    fontWeight: 600,
  },
};
