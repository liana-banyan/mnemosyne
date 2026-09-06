import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// MnemosyneC — Helm Crown Dashboard
// MV-HELM-CROWN-AMB SAGA 6 BP045 W1
//
// Role-gated: helm-crown | founder
// Surfaces: Roll seat · ratification activity · veto history · Crown-to-Crown comms
import { useState, useEffect } from 'react';
// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
    bg: '#0a0f1a',
    surface: '#111827',
    border: '#1e2d45',
    text: '#e2e8f0',
    muted: '#64748b',
    accent: '#a78bfa',
    green: '#22c55e',
    amber: '#f59e0b',
    red: '#ef4444',
};
// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub }) {
    return (_jsxs("div", { style: {
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: '14px 16px',
            flex: 1,
            minWidth: 100,
        }, children: [_jsx("div", { style: { fontSize: 22, fontWeight: 700, color: C.text }, children: value }), _jsx("div", { style: { fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }, children: label }), sub && _jsx("div", { style: { fontSize: 10, color: C.accent, marginTop: 4 }, children: sub })] }));
}
export function HelmCrownDashboard({ userRole = 'helm-crown', displayName }) {
    const [ratifications, setRatifications] = useState([]);
    const [vetoHistory, setVetoHistory] = useState([]);
    const [comms, setComms] = useState([]);
    const [activeSection, setActiveSection] = useState('roll');
    useEffect(() => {
        // IPC fetch — non-fatal on absence
        const load = async () => {
            try {
                const r = await window.amplify?.helmGetRatifications?.();
                if (Array.isArray(r))
                    setRatifications(r);
            }
            catch { /* empty state */ }
            try {
                const v = await window.amplify?.helmGetVetoHistory?.();
                if (Array.isArray(v))
                    setVetoHistory(v);
            }
            catch { /* empty state */ }
            try {
                const c = await window.amplify?.helmGetComms?.();
                if (Array.isArray(c))
                    setComms(c);
            }
            catch { /* empty state */ }
        };
        void load();
    }, []);
    const pending = ratifications.filter((r) => r.status === 'pending');
    const unread = comms.filter((c) => !c.read).length;
    const SECTIONS = [
        { id: 'roll', label: `🎖️ Roll Seat` },
        { id: 'ratify', label: `🗳️ Ratify${pending.length > 0 ? ` (${pending.length})` : ''}` },
        { id: 'veto', label: '📜 Veto History' },
        { id: 'comms', label: `📡 C2C${unread > 0 ? ` (${unread})` : ''}` },
    ];
    return (_jsxs("div", { style: {
            background: C.bg,
            color: C.text,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
        }, children: [_jsxs("div", { style: {
                    padding: '16px 20px 12px',
                    borderBottom: `1px solid ${C.border}`,
                    background: '#0d1220',
                    flexShrink: 0,
                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }, children: [_jsx("span", { style: { fontSize: 22 }, children: "\uD83D\uDC51" }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 16, fontWeight: 700, color: C.text }, children: "Helm Crown Dashboard" }), _jsxs("div", { style: { fontSize: 10, color: C.muted }, children: [displayName ?? 'Helm Crown', " \u00B7 ", userRole === 'founder' ? 'Founder access' : 'Role: Helm Crown'] })] })] }), _jsxs("div", { style: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }, children: [_jsx(StatCard, { label: "Pending nominations", value: pending.length }), _jsx(StatCard, { label: "Veto decisions", value: vetoHistory.length }), _jsx(StatCard, { label: "Unread comms", value: unread })] })] }), _jsx("div", { style: { display: 'flex', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }, children: SECTIONS.map(({ id, label }) => (_jsx("button", { onClick: () => setActiveSection(id), style: {
                        flex: 1,
                        padding: '8px 4px',
                        border: 'none',
                        borderBottom: activeSection === id ? `2px solid ${C.accent}` : '2px solid transparent',
                        background: 'transparent',
                        color: activeSection === id ? C.accent : C.muted,
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 600,
                    }, children: label }, id))) }), _jsxs("div", { style: { flex: 1, overflowY: 'auto', padding: 20 }, children: [activeSection === 'roll' && (_jsxs("div", { children: [_jsx("h3", { style: { margin: '0 0 12px', fontSize: 14, color: C.text }, children: "Your Roll Seat" }), _jsx("div", { style: { fontSize: 11, color: C.muted, lineHeight: 1.7, marginBottom: 16 }, children: "As a Helm Crown, you hold a ratification seat on the Roll. Nominations require dual ratification (Founder + Helm Crown) to be confirmed. Either party may decline \u2014 EXCLUSION-WITHOUT-JUDGMENT is canon." }), _jsxs("div", { style: {
                                    background: C.surface,
                                    border: `1px solid ${C.border}`,
                                    borderRadius: 10,
                                    padding: '12px 16px',
                                }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 600, color: C.accent, marginBottom: 6 }, children: "Dual-veto structure" }), _jsxs("ul", { style: { margin: 0, paddingLeft: 18, fontSize: 11, color: C.muted, lineHeight: 1.8 }, children: [_jsx("li", { children: "Founder veto + Helm Crown veto \u2192 nomination reviewed" }), _jsx("li", { children: "Both ratify \u2192 candidate appears on public Roll" }), _jsx("li", { children: "Either declines \u2192 status: declined (reason private)" }), _jsx("li", { children: "No negative commentary on declined candidates \u2014 ever" })] })] })] })), activeSection === 'ratify' && (_jsxs("div", { children: [_jsx("h3", { style: { margin: '0 0 12px', fontSize: 14, color: C.text }, children: "Pending Nominations" }), pending.length === 0 ? (_jsx("div", { style: {
                                    textAlign: 'center', padding: '32px 16px',
                                    border: `1px dashed ${C.border}`, borderRadius: 10, color: C.muted, fontSize: 11,
                                }, children: "No pending nominations at this time." })) : (pending.map((item) => (_jsxs("div", { style: {
                                    background: C.surface, border: `1px solid ${C.border}`,
                                    borderRadius: 8, padding: '12px 14px', marginBottom: 8,
                                    display: 'flex', alignItems: 'center', gap: 12,
                                }, children: [_jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 600, color: C.text }, children: item.nomineeName }), _jsxs("div", { style: { fontSize: 10, color: C.muted, marginTop: 2 }, children: ["Submitted ", new Date(item.submittedAt).toLocaleDateString()] })] }), _jsx("button", { onClick: async () => {
                                            await window.amplify?.helmVote?.({ id: item.id, vote: 'ratify' });
                                        }, style: { ...btnStyle, borderColor: C.green, color: C.green }, children: "Ratify" }), _jsx("button", { onClick: async () => {
                                            await window.amplify?.helmVote?.({ id: item.id, vote: 'veto' });
                                        }, style: { ...btnStyle, borderColor: C.muted, color: C.muted }, children: "Decline" })] }, item.id))))] })), activeSection === 'veto' && (_jsxs("div", { children: [_jsx("h3", { style: { margin: '0 0 12px', fontSize: 14, color: C.text }, children: "Veto History" }), vetoHistory.length === 0 ? (_jsx("div", { style: {
                                    textAlign: 'center', padding: '32px 16px',
                                    border: `1px dashed ${C.border}`, borderRadius: 10, color: C.muted, fontSize: 11,
                                }, children: "No decisions on record yet." })) : (vetoHistory.map((v) => (_jsxs("div", { style: {
                                    background: C.surface, border: `1px solid ${C.border}`,
                                    borderRadius: 8, padding: '10px 14px', marginBottom: 6,
                                    display: 'flex', gap: 12, alignItems: 'center',
                                }, children: [_jsx("span", { style: {
                                            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 8,
                                            background: v.vote === 'ratify' ? '#0a1f0e' : '#1c0808',
                                            color: v.vote === 'ratify' ? C.green : C.red,
                                            border: `1px solid ${v.vote === 'ratify' ? C.green : C.red}44`,
                                        }, children: v.vote === 'ratify' ? 'RATIFIED' : 'DECLINED' }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: { fontSize: 11, color: C.text }, children: v.context }), _jsx("div", { style: { fontSize: 10, color: C.muted, marginTop: 2 }, children: new Date(v.decidedAt).toLocaleDateString() })] })] }, v.id))))] })), activeSection === 'comms' && (_jsxs("div", { children: [_jsx("h3", { style: { margin: '0 0 4px', fontSize: 14, color: C.text }, children: "Crown-to-Crown Comms" }), _jsx("div", { style: { fontSize: 10, color: C.muted, marginBottom: 16, lineHeight: 1.5 }, children: "Placeholder \u2014 secure Crown-to-Crown messaging channel. Full implementation pending federation mesh relay (SAGA 4 + relay hardening)." }), comms.length === 0 ? (_jsx("div", { style: {
                                    textAlign: 'center', padding: '32px 16px',
                                    border: `1px dashed ${C.border}`, borderRadius: 10, color: C.muted, fontSize: 11,
                                }, children: "No messages yet. Comms channel will activate when relay is connected." })) : (comms.map((m) => (_jsxs("div", { style: {
                                    background: m.read ? C.surface : '#111a2d',
                                    border: `1px solid ${m.read ? C.border : C.accent + '44'}`,
                                    borderRadius: 8, padding: '10px 14px', marginBottom: 6,
                                }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 4 }, children: [_jsx("span", { style: { fontSize: 11, fontWeight: 600, color: C.text }, children: m.from }), _jsx("span", { style: { fontSize: 10, color: C.muted }, children: m.at })] }), _jsx("div", { style: { fontSize: 11, color: C.muted }, children: m.preview })] }, m.id))))] }))] })] }));
}
const btnStyle = {
    background: 'transparent',
    border: '1px solid',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 10,
    fontWeight: 600,
    padding: '3px 10px',
};
