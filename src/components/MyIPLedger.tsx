/**
 * MyIPLedger.tsx -- IP Ledger display component
 * BP089 Marathon Session 2 -- Item D (I12) / I-C wire-up
 *
 * Displays ip_ledger rows for the current peer/member.
 * Data fetched via IPC: ip-ledger:get-entries handler wired in BP089 I-C.
 *
 * NOTE: Requires Bishop I12 migration for live data. Shows empty state until applied.
 */

import { useState, useEffect } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface IPLedgerRow {
  id: string;
  ring_bearer_id: string;
  entry_type: string;
  payload_hash: string;
  payload_json: Record<string, unknown>;
  ed25519_sig: string | null;
  stamp_seq: number;
  stamped_at: string;
  replicated_at: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function truncateHash(hash: string, len = 12): string {
  return hash.length > len ? hash.slice(0, len) + '...' : hash;
}

function formatDate(iso: string | null): string {
  if (!iso) return '--';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

// ─── Row component ───────────────────────────────────────────────────────────

function LedgerRow({ row }: { row: IPLedgerRow }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        style={{ cursor: 'pointer', background: expanded ? '#f0f8ff' : 'transparent' }}
        onClick={() => setExpanded(e => !e)}
      >
        <td style={TD}>{formatDate(row.stamped_at)}</td>
        <td style={TD}>
          <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', background: '#f5f5f5', padding: '0.1rem 0.3rem', borderRadius: 3 }}>
            {row.entry_type}
          </span>
        </td>
        <td style={TD}>
          <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{truncateHash(row.payload_hash)}</span>
        </td>
        <td style={{ ...TD, textAlign: 'center' }}>
          {row.replicated_at
            ? <span style={{ color: '#22863a', fontSize: '0.75rem' }}>replicated</span>
            : <span style={{ color: '#b08800', fontSize: '0.75rem' }}>local</span>
          }
        </td>
        <td style={{ ...TD, textAlign: 'center', color: '#888', fontSize: '0.75rem' }}>
          {expanded ? '-' : '+'}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} style={{ padding: '0.75rem 1rem', background: '#f8f8f8', borderBottom: '1px solid #e0e0e0' }}>
            <div style={{ fontSize: '0.82rem', fontFamily: 'monospace' }}>
              <div style={{ marginBottom: '0.4rem' }}>
                <strong>ID:</strong> {row.id}
              </div>
              <div style={{ marginBottom: '0.4rem' }}>
                <strong>ring_bearer_id:</strong> {row.ring_bearer_id}
              </div>
              <div style={{ marginBottom: '0.4rem' }}>
                <strong>stamp_seq:</strong> {row.stamp_seq}
              </div>
              <div style={{ marginBottom: '0.4rem' }}>
                <strong>payload_hash:</strong> {row.payload_hash}
              </div>
              {row.ed25519_sig && (
                <div style={{ marginBottom: '0.4rem' }}>
                  <strong>ed25519_sig:</strong> {truncateHash(row.ed25519_sig, 24)}
                </div>
              )}
              <div style={{ marginBottom: '0.4rem' }}>
                <strong>payload:</strong>
                <pre style={{ background: '#eee', padding: '0.5rem', borderRadius: 4, marginTop: '0.3rem', overflow: 'auto', fontSize: '0.78rem' }}>
                  {JSON.stringify(row.payload_json, null, 2)}
                </pre>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

const TD: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  borderBottom: '1px solid #e8e8e8',
  fontSize: '0.85rem',
  verticalAlign: 'middle',
};

// ─── Main component ───────────────────────────────────────────────────────────

interface MyIPLedgerProps {
  peerId?: string;
  entries?: IPLedgerRow[];
  loading?: boolean;
  error?: string;
}

export function MyIPLedger({ peerId, entries: propEntries, loading: propLoading = false, error: propError }: MyIPLedgerProps) {
  const [fetchedEntries, setFetchedEntries] = useState<IPLedgerRow[]>([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (propEntries !== undefined) return; // parent is managing entries; skip self-fetch
    if (!peerId) return;
    const api = (window as unknown as { electronAPI?: { ipLedgerGetEntries?: (id: string) => Promise<{ ok: boolean; entries: IPLedgerRow[]; error?: string }> } }).electronAPI;
    if (!api?.ipLedgerGetEntries) return;
    setFetchLoading(true);
    api.ipLedgerGetEntries(peerId)
      .then((result) => {
        if (result.ok) {
          setFetchedEntries(result.entries);
        } else {
          setFetchError(result.error ?? 'Unknown error');
        }
      })
      .catch((e: unknown) => setFetchError(String(e)))
      .finally(() => setFetchLoading(false));
  }, [peerId, propEntries]);

  const entries = propEntries ?? fetchedEntries;
  const loading = propLoading || fetchLoading;
  const error = propError ?? fetchError;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>IP Ledger</h3>
          {peerId && (
            <div style={{ fontSize: '0.75rem', color: '#888', fontFamily: 'monospace', marginTop: '0.2rem' }}>
              ring_bearer: {peerId.slice(0, 16)}...
            </div>
          )}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#aaa' }}>
          §16 Stamp-Certified
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#888', fontSize: '0.9rem' }}>
          Loading ledger...
        </div>
      )}

      {error && (
        <div style={{ background: '#fff0f0', border: '1px solid #ffcdd2', borderRadius: 6, padding: '0.75rem', fontSize: '0.85rem', color: '#c62828' }}>
          {error}
        </div>
      )}

      {!loading && !error && entries.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#aaa', fontSize: '0.85rem' }}>
          No ledger entries yet.
          {/* TODO: Trigger peerLaunchKeyCheck to generate first keypair_generated entry */}
        </div>
      )}

      {entries.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ ...TD, fontWeight: 600, textAlign: 'left' }}>Stamped At</th>
              <th style={{ ...TD, fontWeight: 600, textAlign: 'left' }}>Entry Type</th>
              <th style={{ ...TD, fontWeight: 600, textAlign: 'left' }}>Hash (12ch)</th>
              <th style={{ ...TD, fontWeight: 600, textAlign: 'center' }}>Replicated</th>
              <th style={{ ...TD, fontWeight: 600, textAlign: 'center' }}>Detail</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(row => (
              <LedgerRow key={row.id} row={row} />
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: '0.75rem', fontSize: '0.7rem', color: '#bbb', textAlign: 'right' }}>
        Pending I12 migration -- Bishop apply required
      </div>
    </div>
  );
}

export default MyIPLedger;
