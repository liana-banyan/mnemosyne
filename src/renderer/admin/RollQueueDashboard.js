import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// MnemosyneC — Roll Queue Dashboard
// SAGA 14 BP045 W1 — Dual-veto nomination admin surface
//
// Role-gated: founder | helm-crown
// Surfaces: pending nominations queue · Founder/Helm-Crown veto buttons ·
//           decline rationale capture (private) · auto-promote on dual-ratification
import { useState, useEffect, useCallback } from 'react';
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
    red: '#ef4444',
    purple: '#a78bfa',
};
// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, color }) {
    return (_jsxs("div", { style: {
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
            padding: '12px 16px', flex: 1,
        }, children: [_jsx("div", { style: { fontSize: 22, fontWeight: 700, color: color ?? C.text }, children: value }), _jsx("div", { style: { fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }, children: label })] }));
}
// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
    const map = {
        pending: { label: 'Pending', color: C.amber, bg: '#1c1504' },
        ratified: { label: 'Ratified ✓', color: C.green, bg: '#0a1f0e' },
        declined: { label: 'Declined', color: C.muted, bg: C.surface },
        'awaiting-second': { label: 'Awaiting 2nd', color: C.accent, bg: '#0d1a2d' },
    };
    const m = map[status] ?? map.pending;
    return (_jsx("span", { style: {
            fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 8,
            background: m.bg, color: m.color, border: `1px solid ${m.color}44`,
            textTransform: 'uppercase', letterSpacing: '0.05em',
        }, children: m.label }));
}
// ─── Vote button ──────────────────────────────────────────────────────────────
function VoteBtn({ label, vote, onClick, disabled, existing, }) {
    const isRatify = vote === 'ratify';
    const alreadyVoted = existing === vote;
    const color = isRatify ? C.green : C.muted;
    return (_jsx("button", { onClick: onClick, disabled: disabled || alreadyVoted, title: alreadyVoted ? `Already voted ${vote}` : label, style: {
            background: alreadyVoted ? (isRatify ? '#0a1f0e' : '#1a1a1a') : 'transparent',
            border: `1px solid ${alreadyVoted ? color : C.border}`,
            borderRadius: 6,
            color: alreadyVoted ? color : C.muted,
            cursor: disabled || alreadyVoted ? 'not-allowed' : 'pointer',
            fontSize: 10,
            fontWeight: 600,
            padding: '3px 10px',
            opacity: disabled && !alreadyVoted ? 0.4 : 1,
        }, children: alreadyVoted ? `✓ ${vote}` : label }));
}
// ─── Nomination row ───────────────────────────────────────────────────────────
function NominationRow({ nom, vetoerType, onVote, }) {
    const [declining, setDeclining] = useState(false);
    const [rationale, setRationale] = useState('');
    const [busy, setBusy] = useState(false);
    const myVote = vetoerType === 'founder' ? nom.founderVote : nom.helmCrownVote;
    const isSettled = nom.status === 'ratified' || nom.status === 'declined';
    const handleVote = async (vote) => {
        if (vote === 'veto') {
            setDeclining(true);
            return;
        }
        setBusy(true);
        try {
            await onVote(nom.id, vote);
        }
        finally {
            setBusy(false);
        }
    };
    const handleDeclineConfirm = async () => {
        setBusy(true);
        try {
            await onVote(nom.id, 'veto', rationale.trim() || undefined);
            setDeclining(false);
            setRationale('');
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs("div", { style: {
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 10, padding: '12px 14px', marginBottom: 8,
        }, children: [_jsx("div", { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }, children: _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx("span", { style: { fontSize: 13, fontWeight: 700, color: C.text }, children: nom.nomineeName }), _jsx(StatusBadge, { status: nom.status })] }), nom.nomineeNote && (_jsx("div", { style: { fontSize: 11, color: C.muted, marginTop: 4, lineHeight: 1.5 }, children: nom.nomineeNote })), _jsxs("div", { style: { fontSize: 10, color: C.muted, marginTop: 4 }, children: ["Submitted ", new Date(nom.submittedAt).toLocaleDateString(), nom.submittedBy ? ` · by ${nom.submittedBy}` : ''] })] }) }), _jsxs("div", { style: {
                    display: 'flex', gap: 12, alignItems: 'center',
                    padding: '8px 0', borderTop: `1px solid ${C.border}`,
                    marginTop: 4,
                }, children: [_jsxs("div", { style: { fontSize: 10, color: C.muted }, children: [_jsx("span", { style: { marginRight: 4 }, children: "Founder:" }), _jsx("span", { style: { color: nom.founderVote === 'ratify' ? C.green : nom.founderVote === 'veto' ? C.muted : C.amber }, children: nom.founderVote ?? 'pending' })] }), _jsxs("div", { style: { fontSize: 10, color: C.muted }, children: [_jsx("span", { style: { marginRight: 4 }, children: "Helm Crown:" }), _jsx("span", { style: { color: nom.helmCrownVote === 'ratify' ? C.green : nom.helmCrownVote === 'veto' ? C.muted : C.amber }, children: nom.helmCrownVote ?? 'pending' })] }), !isSettled && !declining && (_jsxs("div", { style: { marginLeft: 'auto', display: 'flex', gap: 6 }, children: [_jsx(VoteBtn, { label: "Ratify", vote: "ratify", onClick: () => void handleVote('ratify'), disabled: busy, existing: myVote }), _jsx(VoteBtn, { label: "Decline", vote: "veto", onClick: () => void handleVote('veto'), disabled: busy, existing: myVote })] })), nom.status === 'ratified' && (_jsxs("div", { style: { marginLeft: 'auto', fontSize: 10, color: C.green }, children: ["\u2713 Published at /roll/", nom.nomineeSlug, "/"] }))] }), declining && (_jsxs("div", { style: {
                    marginTop: 10, padding: '10px 12px',
                    background: '#0f0a0a', border: `1px solid ${C.border}`,
                    borderRadius: 8,
                }, children: [_jsx("div", { style: { fontSize: 11, color: C.muted, marginBottom: 6 }, children: "Decline rationale (private, stored only in admin records \u2014 never shown publicly):" }), _jsx("textarea", { value: rationale, onChange: (e) => setRationale(e.target.value), placeholder: "Optional \u2014 rationale is private and never displayed", rows: 2, style: {
                            width: '100%', background: '#070d1a', border: `1px solid ${C.border}`,
                            borderRadius: 6, color: C.text, fontSize: 11, padding: '6px 10px',
                            resize: 'vertical', boxSizing: 'border-box', outline: 'none',
                        } }), _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 8 }, children: [_jsx("button", { onClick: () => void handleDeclineConfirm(), disabled: busy, style: {
                                    background: 'transparent', border: `1px solid ${C.muted}`,
                                    borderRadius: 6, color: C.muted, cursor: busy ? 'not-allowed' : 'pointer',
                                    fontSize: 10, fontWeight: 600, padding: '4px 12px',
                                }, children: busy ? 'Saving…' : 'Confirm decline' }), _jsx("button", { onClick: () => { setDeclining(false); setRationale(''); }, style: {
                                    background: 'transparent', border: 'none', color: C.muted,
                                    cursor: 'pointer', fontSize: 10, padding: '4px 8px',
                                }, children: "Cancel" })] }), _jsx("div", { style: { fontSize: 9, color: C.muted, marginTop: 6 }, children: "EXCLUSION-WITHOUT-JUDGMENT is canon. No negative commentary on declined candidates." })] }))] }));
}
export function RollQueueDashboard({ vetoerType, displayName }) {
    const [nominations, setNominations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('pending');
    const loadNominations = useCallback(async () => {
        try {
            const data = await window.amplify?.rollGetNominations?.();
            if (Array.isArray(data))
                setNominations(data);
        }
        catch { /* empty state */ }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { void loadNominations(); }, [loadNominations]);
    const handleVote = async (id, vote, rationale) => {
        try {
            await window.amplify?.rollCastVote?.({ id, vetoer_type: vetoerType, vote, rationale });
            await loadNominations();
        }
        catch (e) {
            alert('Vote failed: ' + String(e));
        }
    };
    const filtered = filter === 'all' ? nominations : nominations.filter((n) => n.status === filter);
    const pending = nominations.filter((n) => n.status === 'pending' || n.status === 'awaiting-second');
    const ratified = nominations.filter((n) => n.status === 'ratified');
    const declined = nominations.filter((n) => n.status === 'declined');
    const FILTERS = [
        { id: 'all', label: 'All' },
        { id: 'pending', label: `Pending (${pending.length})` },
        { id: 'awaiting-second', label: 'Awaiting 2nd' },
        { id: 'ratified', label: 'Ratified' },
        { id: 'declined', label: 'Declined' },
    ];
    return (_jsxs("div", { style: {
            background: C.bg,
            color: C.text,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
        }, children: [_jsxs("div", { style: {
                    padding: '16px 20px 14px',
                    borderBottom: `1px solid ${C.border}`,
                    background: '#0d1220',
                    flexShrink: 0,
                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }, children: [_jsx("span", { style: { fontSize: 20 }, children: "\uD83C\uDF96\uFE0F" }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 15, fontWeight: 700, color: C.text }, children: "Roll Queue \u2014 Admin" }), _jsxs("div", { style: { fontSize: 10, color: C.muted }, children: [displayName ?? vetoerType, " \u00B7 Dual-veto ratification"] })] })] }), _jsxs("div", { style: { display: 'flex', gap: 8 }, children: [_jsx(StatCard, { label: "Pending", value: pending.length, color: pending.length > 0 ? C.amber : C.muted }), _jsx(StatCard, { label: "Ratified", value: ratified.length, color: C.green }), _jsx(StatCard, { label: "Declined", value: declined.length })] })] }), _jsx("div", { style: { display: 'flex', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }, children: FILTERS.map(({ id, label }) => (_jsx("button", { onClick: () => setFilter(id), style: {
                        flex: 1, padding: '7px 4px', border: 'none',
                        borderBottom: filter === id ? `2px solid ${C.accent}` : '2px solid transparent',
                        background: 'transparent',
                        color: filter === id ? C.accent : C.muted,
                        cursor: 'pointer', fontSize: 10, fontWeight: 600,
                    }, children: label }, id))) }), _jsx("div", { style: { flex: 1, overflowY: 'auto', padding: 16 }, children: loading ? (_jsx("div", { style: { textAlign: 'center', color: C.muted, fontSize: 11, padding: 24 }, children: "Loading\u2026" })) : filtered.length === 0 ? (_jsx("div", { style: {
                        textAlign: 'center', padding: '32px 16px',
                        border: `1px dashed ${C.border}`, borderRadius: 10, color: C.muted, fontSize: 11,
                    }, children: "No nominations in this category." })) : (filtered.map((nom) => (_jsx(NominationRow, { nom: nom, vetoerType: vetoerType, onVote: handleVote }, nom.id)))) }), _jsxs("div", { style: {
                    padding: '8px 16px', borderTop: `1px solid ${C.border}`,
                    fontSize: 9, color: '#334155', lineHeight: 1.5, flexShrink: 0,
                }, children: ["EXCLUSION-WITHOUT-JUDGMENT is canon \u00B7 Decline rationale is private \u00B7 No negative commentary on declined or removed names \u00B7 Both votes required for ratification \u2192 auto-promotes to /roll/", '{slug}', "/"] })] }));
}
