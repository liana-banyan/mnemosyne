/**
 * MyIPLedgerTab.tsx — BP092 I12 · My IP Ledger UI Tab
 * Displays Ring Bearer identity (Ed25519 pubkey) and ip_ledger_entries from Postgres.
 * Postgres-only · gen_random_uuid() · Sonnet 4.6 · M25b
 */

import React, { useEffect, useState, useCallback } from 'react';

interface LedgerEntry {
  entry_id: string;
  contribution_type: string;
  stamped_at: string;
  mesh_replicated: boolean;
  payload_url?: string | null;
}

interface RingBearerIdentity {
  peer_id: string;
  public_key_hex: string;
}

const styles = {
  container: {
    padding: '20px 24px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#e2e8f0',
    maxWidth: 860,
  } as React.CSSProperties,
  heading: {
    fontSize: 16,
    fontWeight: 700,
    color: '#6ee7b7',
    marginBottom: 4,
    marginTop: 0,
  } as React.CSSProperties,
  subheading: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 20,
    marginTop: 0,
  } as React.CSSProperties,
  section: {
    marginBottom: 24,
  } as React.CSSProperties,
  sectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#94a3b8',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    marginBottom: 8,
  } as React.CSSProperties,
  pubkeyBox: {
    background: '#0f172a',
    border: '1px solid rgba(100,116,139,0.2)',
    borderRadius: 6,
    padding: '10px 14px',
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#6ee7b7',
    wordBreak: 'break-all' as const,
    lineHeight: 1.6,
  } as React.CSSProperties,
  peerId: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: 'monospace',
    marginTop: 6,
  } as React.CSSProperties,
  copyBtn: {
    marginTop: 8,
    background: 'none',
    border: '1px solid rgba(100,116,139,0.3)',
    borderRadius: 4,
    color: '#64748b',
    fontSize: 11,
    padding: '3px 10px',
    cursor: 'pointer',
  } as React.CSSProperties,
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: 12,
  } as React.CSSProperties,
  th: {
    textAlign: 'left' as const,
    padding: '6px 10px',
    color: '#64748b',
    fontWeight: 600,
    borderBottom: '1px solid rgba(100,116,139,0.15)',
    fontSize: 11,
  } as React.CSSProperties,
  td: {
    padding: '8px 10px',
    borderBottom: '1px solid rgba(100,116,139,0.08)',
    color: '#cbd5e1',
  } as React.CSSProperties,
  badge: (replicated: boolean): React.CSSProperties => ({
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: replicated ? '#6ee7b7' : '#475569',
    marginRight: 6,
    verticalAlign: 'middle',
  }),
  proofBtn: {
    background: 'none',
    border: '1px solid rgba(100,116,139,0.25)',
    borderRadius: 4,
    color: '#6ee7b7',
    fontSize: 10,
    padding: '2px 8px',
    cursor: 'pointer',
    opacity: 0.8,
  } as React.CSSProperties,
  emptyState: {
    color: '#475569',
    fontSize: 13,
    padding: '24px 0',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  error: {
    color: '#f87171',
    fontSize: 12,
    marginTop: 8,
  } as React.CSSProperties,
  refreshBtn: {
    background: 'none',
    border: '1px solid rgba(100,116,139,0.25)',
    borderRadius: 4,
    color: '#64748b',
    fontSize: 11,
    padding: '3px 10px',
    cursor: 'pointer',
    marginLeft: 8,
  } as React.CSSProperties,
};

export function MyIPLedgerTab() {
  const [identity, setIdentity] = useState<RingBearerIdentity | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const amplify = (window as unknown as { amplify?: Record<string, unknown> }).amplify;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const identityResult = await (amplify?.ipLedgerGetIdentity as (() => Promise<{ ok: boolean; peer_id?: string; public_key_hex?: string; error?: string }>) | undefined)?.();
      if (identityResult?.ok && identityResult.peer_id && identityResult.public_key_hex) {
        setIdentity({ peer_id: identityResult.peer_id, public_key_hex: identityResult.public_key_hex });
      } else if (identityResult?.error) {
        setError(identityResult.error);
      }

      const entriesResult = await (amplify?.ipLedgerGetPgEntries as (() => Promise<{ ok: boolean; entries: LedgerEntry[]; error?: string }>) | undefined)?.();
      if (entriesResult?.ok) {
        setEntries(entriesResult.entries ?? []);
      } else if (entriesResult?.error) {
        setError(entriesResult.error);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [amplify]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCopyPubkey = async () => {
    if (!identity?.public_key_hex) return;
    try {
      await navigator.clipboard.writeText(identity.public_key_hex);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* no-op */ }
  };

  const handleDownloadProof = async (entryId: string) => {
    setDownloadingId(entryId);
    try {
      const result = await (amplify?.ipLedgerGetEntryProof as ((id: string) => Promise<{ ok: boolean; proof?: unknown; error?: string }>) | undefined)?.(entryId);
      if (!result?.ok || !result.proof) {
        setError(result?.error ?? 'Proof download failed');
        return;
      }
      const blob = new Blob([JSON.stringify(result.proof, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ip_ledger_proof_${entryId.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(String(e));
    } finally {
      setDownloadingId(null);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>My IP Ledger</h2>
      <p style={styles.subheading}>
        Ring Bearer identity · Stamp-Certified contributions · Verifiable proofs
      </p>

      {/* Ring Bearer Identity */}
      <div style={styles.section}>
        <div style={styles.sectionLabel}>Ring Bearer Public Key</div>
        {identity ? (
          <>
            <div style={styles.pubkeyBox}>{identity.public_key_hex}</div>
            <div style={styles.peerId}>Peer ID: {identity.peer_id}</div>
            <button style={styles.copyBtn} onClick={handleCopyPubkey}>
              {copied ? 'Copied!' : 'Copy Pubkey'}
            </button>
          </>
        ) : loading ? (
          <div style={{ color: '#475569', fontSize: 12 }}>Loading identity…</div>
        ) : (
          <div style={styles.error}>Identity unavailable</div>
        )}
      </div>

      {/* Contributions Table */}
      <div style={styles.section}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <div style={styles.sectionLabel}>Stamped Contributions</div>
          <button style={styles.refreshBtn} onClick={() => void loadData()}>Refresh</button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {!loading && entries.length === 0 ? (
          <div style={styles.emptyState}>
            No contributions stamped yet. Submit via Battery Dispatch to begin your IP Ledger record.
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Entry ID</th>
                <th style={styles.th}>Type</th>
                <th style={styles.th}>Stamped At</th>
                <th style={styles.th}>Replicated</th>
                <th style={styles.th}>Proof</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.entry_id}>
                  <td style={{ ...styles.td, fontFamily: 'monospace', color: '#6ee7b7' }}>
                    {entry.entry_id.slice(0, 8)}…
                  </td>
                  <td style={styles.td}>{entry.contribution_type.replace(/_/g, ' ')}</td>
                  <td style={styles.td}>{formatDate(entry.stamped_at)}</td>
                  <td style={styles.td}>
                    <span style={styles.badge(entry.mesh_replicated)} />
                    {entry.mesh_replicated ? 'Yes' : 'Pending'}
                  </td>
                  <td style={styles.td}>
                    <button
                      style={styles.proofBtn}
                      onClick={() => void handleDownloadProof(entry.entry_id)}
                      disabled={downloadingId === entry.entry_id}
                    >
                      {downloadingId === entry.entry_id ? '…' : 'Download'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
