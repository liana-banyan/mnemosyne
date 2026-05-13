// SAGA 4 BP041 — Settings → API Keys section
// Masked input per agent — R16 NO-API-KEY-EXPOSURE binding throughout.
// Keys flow: Renderer → IPC write → Main (store + env) → never returned back.
// Status returned: boolean isSet only (never key value).
// 8-dim accessibility: aria-label, aria-describedby, input type=password, role.

import { useState, useEffect, useCallback } from 'react';

// ─── Agent key metadata (no actual key values) ────────────────────────────────

interface AgentKeyMeta {
  agentId: string;
  displayName: string;
  icon: string;
  envVarName: string;
  docUrl?: string;
  placeholder: string;
}

const AGENT_KEY_META: AgentKeyMeta[] = [
  {
    agentId: 'pawn',
    displayName: 'Pawn (Perplexity)',
    icon: '♟',
    envVarName: 'PERPLEXITY_API_KEY',
    docUrl: 'https://docs.perplexity.ai/',
    placeholder: 'pplx-…',
  },
  {
    agentId: 'rook',
    displayName: 'Rook (Gemini)',
    icon: '♜',
    envVarName: 'GOOGLE_API_KEY',
    docUrl: 'https://aistudio.google.com/app/apikey',
    placeholder: 'AIza…',
  },
  {
    agentId: 'bishop',
    displayName: 'Bishop (Claude)',
    icon: '♝',
    envVarName: 'ANTHROPIC_API_KEY',
    docUrl: 'https://console.anthropic.com/keys',
    placeholder: 'sk-ant-…',
  },
];

interface ApiKeysSettingsProps {
  /** Initial isSet status per agentId (from main via IPC) — R16: values never here */
  initialKeyStatus: Record<string, boolean>;
  focusAgentId?: string;
  onKeySet: (agentId: string, keyValue: string) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}

interface RowState {
  input: string;
  saving: boolean;
  saved: boolean;
  error: string | null;
  isSet: boolean;
}

export function ApiKeysSettings({ initialKeyStatus, focusAgentId, onKeySet, onClose }: ApiKeysSettingsProps) {
  const [rows, setRows] = useState<Record<string, RowState>>(() => {
    const init: Record<string, RowState> = {};
    for (const meta of AGENT_KEY_META) {
      init[meta.agentId] = {
        input: '',
        saving: false,
        saved: false,
        error: null,
        isSet: initialKeyStatus[meta.agentId] ?? false,
      };
    }
    return init;
  });

  // Focus the target row on open
  useEffect(() => {
    if (focusAgentId) {
      const el = document.getElementById(`apikey-input-${focusAgentId}`);
      if (el) (el as HTMLInputElement).focus();
    }
  }, [focusAgentId]);

  const handleSave = useCallback(async (agentId: string) => {
    const row = rows[agentId];
    if (!row || !row.input.trim()) return;

    setRows((prev) => ({
      ...prev,
      [agentId]: { ...prev[agentId], saving: true, error: null, saved: false },
    }));

    const result = await onKeySet(agentId, row.input.trim());

    setRows((prev) => ({
      ...prev,
      [agentId]: {
        ...prev[agentId],
        saving: false,
        saved: result.ok,
        error: result.ok ? null : (result.error ?? 'Failed to save key'),
        input: result.ok ? '' : prev[agentId].input,
        isSet: result.ok ? true : prev[agentId].isSet,
      },
    }));
  }, [rows, onKeySet]);

  const handleInput = useCallback((agentId: string, value: string) => {
    setRows((prev) => ({
      ...prev,
      [agentId]: { ...prev[agentId], input: value, saved: false, error: null },
    }));
  }, []);

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-label="API Keys Settings">
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <span style={styles.headerTitle}>⚙ Settings — API Keys</span>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close settings">✕</button>
        </div>

        {/* R16 notice */}
        <div style={styles.notice}>
          <span style={styles.noticeIcon}>🔒</span>
          Keys are stored encrypted on your machine and never sent to Liana Banyan servers.
          They only travel to the AI provider you enable.
        </div>

        {/* Key rows */}
        <div style={styles.rows}>
          {AGENT_KEY_META.map((meta) => {
            const row = rows[meta.agentId];
            const isTarget = meta.agentId === focusAgentId;

            return (
              <div
                key={meta.agentId}
                style={{
                  ...styles.row,
                  ...(isTarget ? styles.rowHighlighted : {}),
                }}
                id={`apikey-row-${meta.agentId}`}
              >
                {/* Agent label */}
                <div style={styles.rowLabel}>
                  <span style={styles.rowIcon} aria-hidden="true">{meta.icon}</span>
                  <div>
                    <div style={styles.rowName}>{meta.displayName}</div>
                    <code style={styles.rowEnvVar}>{meta.envVarName}</code>
                  </div>
                  {/* Status pill */}
                  <span
                    style={{
                      ...styles.statusPill,
                      background: row.isSet ? '#276749' : '#742a2a',
                      color: row.isSet ? '#9ae6b4' : '#feb2b2',
                    }}
                    aria-label={row.isSet ? 'Key is set' : 'Key not set'}
                  >
                    {row.isSet ? '● set' : '○ not set'}
                  </span>
                </div>

                {/* Input row */}
                <div style={styles.inputRow}>
                  <input
                    id={`apikey-input-${meta.agentId}`}
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={row.isSet ? '••••••••• (update key)' : meta.placeholder}
                    value={row.input}
                    onChange={(e) => handleInput(meta.agentId, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSave(meta.agentId); }}
                    style={styles.input}
                    aria-label={`API key for ${meta.displayName}`}
                    aria-describedby={`apikey-desc-${meta.agentId}`}
                    disabled={row.saving}
                  />
                  <button
                    style={{
                      ...styles.saveBtn,
                      opacity: row.input.trim() ? 1 : 0.45,
                      cursor: row.input.trim() ? 'pointer' : 'default',
                    }}
                    onClick={() => handleSave(meta.agentId)}
                    disabled={!row.input.trim() || row.saving}
                    aria-label={`Save API key for ${meta.displayName}`}
                  >
                    {row.saving ? '…' : row.saved ? '✓ saved' : 'Save'}
                  </button>
                </div>

                {/* Feedback */}
                <div id={`apikey-desc-${meta.agentId}`} style={styles.feedback} aria-live="polite">
                  {row.error && <span style={styles.errorText}>✗ {row.error}</span>}
                  {row.saved && <span style={styles.savedText}>✓ Key saved — agent will be probed on next select</span>}
                  {meta.docUrl && !row.error && !row.saved && (
                    <a
                      href={meta.docUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.docLink}
                      aria-label={`Get ${meta.displayName} API key (opens in browser)`}
                    >
                      Get {meta.displayName} key ↗
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <span style={styles.footerNote}>
            Knight (Cursor) and Hearth (Ollama) do not require API keys.
          </span>
          <button style={styles.doneBtn} onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#1a1a2e',
    border: '1px solid #4a5568',
    borderRadius: '12px',
    width: '480px',
    maxWidth: '95vw',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    padding: '0.75rem 1rem',
    borderBottom: '1px solid #2d3748',
  },
  headerTitle: {
    flex: 1,
    fontWeight: 700,
    fontSize: '0.95rem',
    color: '#f6ad55',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#718096',
    fontSize: '1rem',
    cursor: 'pointer',
    padding: '0 4px',
  },
  notice: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.5rem',
    background: '#1a2744',
    borderBottom: '1px solid #2d3748',
    padding: '0.6rem 1rem',
    fontSize: '0.72rem',
    color: '#a0aec0',
    lineHeight: 1.4,
  },
  noticeIcon: { flexShrink: 0 },
  rows: {
    flex: 1,
    overflowY: 'auto',
    padding: '0.75rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  row: {
    background: '#2d3748',
    borderRadius: '8px',
    padding: '0.65rem 0.75rem',
    border: '1px solid #4a5568',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  rowHighlighted: {
    borderColor: '#f6ad55',
    background: '#2d2a00',
  },
  rowLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  rowIcon: { fontSize: '1rem', flexShrink: 0 },
  rowName: { fontWeight: 600, fontSize: '0.85rem', color: '#e2e8f0' },
  rowEnvVar: {
    fontSize: '0.65rem',
    color: '#718096',
    fontFamily: 'monospace',
  },
  statusPill: {
    marginLeft: 'auto',
    borderRadius: '20px',
    padding: '2px 8px',
    fontSize: '0.65rem',
    fontWeight: 600,
    flexShrink: 0,
  },
  inputRow: {
    display: 'flex',
    gap: '0.4rem',
  },
  input: {
    flex: 1,
    background: '#1a202c',
    border: '1px solid #4a5568',
    borderRadius: '6px',
    padding: '0.4rem 0.6rem',
    color: '#e2e8f0',
    fontSize: '0.8rem',
    fontFamily: 'monospace',
    outline: 'none',
  },
  saveBtn: {
    background: '#2c5282',
    border: '1px solid #63b3ed',
    borderRadius: '6px',
    padding: '0.4rem 0.75rem',
    color: '#bee3f8',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  feedback: {
    fontSize: '0.68rem',
    minHeight: '1rem',
  },
  errorText: { color: '#fc8181' },
  savedText: { color: '#68d391' },
  docLink: {
    color: '#63b3ed',
    textDecoration: 'none',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    padding: '0.65rem 1rem',
    borderTop: '1px solid #2d3748',
    gap: '0.5rem',
  },
  footerNote: {
    flex: 1,
    fontSize: '0.68rem',
    color: '#718096',
    fontStyle: 'italic',
  },
  doneBtn: {
    background: '#276749',
    border: '1px solid #38a169',
    borderRadius: '6px',
    padding: '0.4rem 1rem',
    color: '#9ae6b4',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
  },
};
