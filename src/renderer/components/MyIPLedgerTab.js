import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * MyIPLedgerTab.tsx — BP092 I12 · My IP Ledger UI Tab
 * Displays Ring Bearer identity (Ed25519 pubkey) and ip_ledger_entries from Postgres.
 * Postgres-only · gen_random_uuid() · Sonnet 4.6 · M25b
 */
import { useEffect, useState, useCallback } from 'react';
const styles = {
    container: {
        padding: '20px 24px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#e2e8f0',
        maxWidth: 860,
    },
    heading: {
        fontSize: 16,
        fontWeight: 700,
        color: '#6ee7b7',
        marginBottom: 4,
        marginTop: 0,
    },
    subheading: {
        fontSize: 12,
        color: '#64748b',
        marginBottom: 20,
        marginTop: 0,
    },
    section: {
        marginBottom: 24,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: 600,
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 8,
    },
    pubkeyBox: {
        background: '#0f172a',
        border: '1px solid rgba(100,116,139,0.2)',
        borderRadius: 6,
        padding: '10px 14px',
        fontFamily: 'monospace',
        fontSize: 11,
        color: '#6ee7b7',
        wordBreak: 'break-all',
        lineHeight: 1.6,
    },
    peerId: {
        fontSize: 12,
        color: '#94a3b8',
        fontFamily: 'monospace',
        marginTop: 6,
    },
    copyBtn: {
        marginTop: 8,
        background: 'none',
        border: '1px solid rgba(100,116,139,0.3)',
        borderRadius: 4,
        color: '#64748b',
        fontSize: 11,
        padding: '3px 10px',
        cursor: 'pointer',
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 12,
    },
    th: {
        textAlign: 'left',
        padding: '6px 10px',
        color: '#64748b',
        fontWeight: 600,
        borderBottom: '1px solid rgba(100,116,139,0.15)',
        fontSize: 11,
    },
    td: {
        padding: '8px 10px',
        borderBottom: '1px solid rgba(100,116,139,0.08)',
        color: '#cbd5e1',
    },
    badge: (replicated) => ({
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
    },
    emptyState: {
        color: '#475569',
        fontSize: 13,
        padding: '24px 0',
        textAlign: 'center',
    },
    error: {
        color: '#f87171',
        fontSize: 12,
        marginTop: 8,
    },
    refreshBtn: {
        background: 'none',
        border: '1px solid rgba(100,116,139,0.25)',
        borderRadius: 4,
        color: '#64748b',
        fontSize: 11,
        padding: '3px 10px',
        cursor: 'pointer',
        marginLeft: 8,
    },
};
export function MyIPLedgerTab() {
    const [identity, setIdentity] = useState(null);
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(false);
    const [downloadingId, setDownloadingId] = useState(null);
    const amplify = window.amplify;
    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const identityResult = await amplify?.ipLedgerGetIdentity?.();
            if (identityResult?.ok && identityResult.peer_id && identityResult.public_key_hex) {
                setIdentity({ peer_id: identityResult.peer_id, public_key_hex: identityResult.public_key_hex });
            }
            else if (identityResult?.error) {
                setError(identityResult.error);
            }
            const entriesResult = await amplify?.ipLedgerGetPgEntries?.();
            if (entriesResult?.ok) {
                setEntries(entriesResult.entries ?? []);
            }
            else if (entriesResult?.error) {
                setError(entriesResult.error);
            }
        }
        catch (e) {
            setError(String(e));
        }
        finally {
            setLoading(false);
        }
    }, [amplify]);
    useEffect(() => {
        void loadData();
    }, [loadData]);
    const handleCopyPubkey = async () => {
        if (!identity?.public_key_hex)
            return;
        try {
            await navigator.clipboard.writeText(identity.public_key_hex);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        }
        catch { /* no-op */ }
    };
    const handleDownloadProof = async (entryId) => {
        setDownloadingId(entryId);
        try {
            const result = await amplify?.ipLedgerGetEntryProof?.(entryId);
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
        }
        catch (e) {
            setError(String(e));
        }
        finally {
            setDownloadingId(null);
        }
    };
    const formatDate = (iso) => {
        try {
            return new Date(iso).toLocaleString();
        }
        catch {
            return iso;
        }
    };
    return (_jsxs("div", { style: styles.container, children: [_jsx("h2", { style: styles.heading, children: "My IP Ledger" }), _jsx("p", { style: styles.subheading, children: "Ring Bearer identity \u00B7 Stamp-Certified contributions \u00B7 Verifiable proofs" }), _jsxs("div", { style: styles.section, children: [_jsx("div", { style: styles.sectionLabel, children: "Ring Bearer Public Key" }), identity ? (_jsxs(_Fragment, { children: [_jsx("div", { style: styles.pubkeyBox, children: identity.public_key_hex }), _jsxs("div", { style: styles.peerId, children: ["Peer ID: ", identity.peer_id] }), _jsx("button", { style: styles.copyBtn, onClick: handleCopyPubkey, children: copied ? 'Copied!' : 'Copy Pubkey' })] })) : loading ? (_jsx("div", { style: { color: '#475569', fontSize: 12 }, children: "Loading identity\u2026" })) : (_jsx("div", { style: styles.error, children: "Identity unavailable" }))] }), _jsxs("div", { style: styles.section, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', marginBottom: 8 }, children: [_jsx("div", { style: styles.sectionLabel, children: "Stamped Contributions" }), _jsx("button", { style: styles.refreshBtn, onClick: () => void loadData(), children: "Refresh" })] }), error && _jsx("div", { style: styles.error, children: error }), !loading && entries.length === 0 ? (_jsx("div", { style: styles.emptyState, children: "No contributions stamped yet. Submit via Battery Dispatch to begin your IP Ledger record." })) : (_jsxs("table", { style: styles.table, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: styles.th, children: "Entry ID" }), _jsx("th", { style: styles.th, children: "Type" }), _jsx("th", { style: styles.th, children: "Stamped At" }), _jsx("th", { style: styles.th, children: "Replicated" }), _jsx("th", { style: styles.th, children: "Proof" })] }) }), _jsx("tbody", { children: entries.map((entry) => (_jsxs("tr", { children: [_jsxs("td", { style: { ...styles.td, fontFamily: 'monospace', color: '#6ee7b7' }, children: [entry.entry_id.slice(0, 8), "\u2026"] }), _jsx("td", { style: styles.td, children: entry.contribution_type.replace(/_/g, ' ') }), _jsx("td", { style: styles.td, children: formatDate(entry.stamped_at) }), _jsxs("td", { style: styles.td, children: [_jsx("span", { style: styles.badge(entry.mesh_replicated) }), entry.mesh_replicated ? 'Yes' : 'Pending'] }), _jsx("td", { style: styles.td, children: _jsx("button", { style: styles.proofBtn, onClick: () => void handleDownloadProof(entry.entry_id), disabled: downloadingId === entry.entry_id, children: downloadingId === entry.entry_id ? '…' : 'Download' }) })] }, entry.entry_id))) })] }))] })] }));
}
