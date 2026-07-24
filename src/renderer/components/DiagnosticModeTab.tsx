// DiagnosticModeTab.tsx — BP132 Yoke #22 Help tab addition
//
// The BP099-K16 remote-hand Diagnostic Mode poller (src/main/diagnostic_mode/index.ts)
// existed only as a headless backend module with zero renderer UI — this is that UI.
// It shows local poller status and lets the user grant/revoke a TTL'd local permission
// window (the poller executes nothing until this is active; commands are limited to a
// hardcoded 6-key READ_ONLY allowlist: ollama_tags, peer_presence_self, bonfire_lit_self,
// log_tail, env_loader_status, relay_answer_poller_state).

import React, { useCallback, useEffect, useState } from 'react';

interface DiagnosticStatus {
  pollerStarted: boolean;
  lastPollAt: string | null;
  lastError: string | null;
  permissionActive: boolean;
}

export function DiagnosticModeTab(): React.ReactElement {
  const [status, setStatus] = useState<DiagnosticStatus | null>(null);
  const [ttl, setTtl] = useState(10);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const s = await (window as any).amplify?.diagnosticModeGetStatus?.();
      if (s) setStatus(s);
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    void refresh();
    const iv = setInterval(() => void refresh(), 5000);
    return () => clearInterval(iv);
  }, [refresh]);

  const grant = useCallback(async () => {
    setBusy(true);
    try {
      await (window as any).amplify?.diagnosticModeActivatePermission?.(ttl);
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [ttl, refresh]);

  const revoke = useCallback(async () => {
    setBusy(true);
    try {
      await (window as any).amplify?.diagnosticModeRevokePermission?.();
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  return (
    <div style={{
      background: '#0d1117', border: '1px solid #1e2a38', borderRadius: 10,
      padding: 16, fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#f0fdf4', marginBottom: 4 }}>
        🩺 Diagnostic Mode (remote-hand)
      </div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12, lineHeight: 1.5 }}>
        Lets a trusted remote operator (e.g. Bishop/Founder support) run a small,
        hardcoded set of READ_ONLY checks on this machine to help diagnose issues —
        never write/admin commands. Nothing runs unless you grant a time-limited window below.
      </div>

      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#94a3b8', marginBottom: 12, flexWrap: 'wrap' as const }}>
        <div>
          Poller: <strong style={{ color: status?.pollerStarted ? '#4ade80' : '#f87171' }}>
            {status?.pollerStarted ? 'running' : 'not started'}
          </strong>
        </div>
        <div>
          Local permission: <strong style={{ color: status?.permissionActive ? '#fbbf24' : '#475569' }}>
            {status?.permissionActive ? 'ACTIVE (commands can run)' : 'inactive'}
          </strong>
        </div>
        {status?.lastPollAt && (
          <div>Last poll: {new Date(status.lastPollAt).toLocaleTimeString()}</div>
        )}
        {status?.lastError && (
          <div style={{ color: '#f87171' }}>Last error: {status.lastError}</div>
        )}
      </div>

      {!status?.permissionActive ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>Grant for</span>
          <input
            type="number" min={1} max={60} value={ttl}
            onChange={(e) => setTtl(Math.max(1, Math.min(60, Number(e.target.value))))}
            style={{
              width: 50, background: '#111827', border: '1px solid #1e2d45', borderRadius: 4,
              color: '#e2e8f0', fontSize: 11, padding: '3px 6px', outline: 'none',
            }}
          />
          <span style={{ fontSize: 11, color: '#94a3b8' }}>minutes</span>
          <button
            onClick={() => void grant()}
            disabled={busy}
            style={{
              background: '#10b981', color: '#fff', border: 'none', borderRadius: 6,
              padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'system-ui, sans-serif', opacity: busy ? 0.6 : 1,
            }}
          >
            Grant remote diagnostic access
          </button>
        </div>
      ) : (
        <button
          onClick={() => void revoke()}
          disabled={busy}
          style={{
            background: 'none', color: '#f87171', border: '1px solid #7f1d1d', borderRadius: 6,
            padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'system-ui, sans-serif', opacity: busy ? 0.6 : 1,
          }}
        >
          Revoke access now
        </button>
      )}
    </div>
  );
}

export default DiagnosticModeTab;
