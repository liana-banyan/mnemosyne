import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// MnemosyneC — Ambassador Dashboard
// MV-HELM-CROWN-AMB SAGA 6 BP045 W1
//
// Role-gated: ambassador | founder
// Surfaces: nominating Crown · scope · peer-witness
import { useState, useEffect } from 'react';
// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
    bg: '#0a0f1a',
    surface: '#111827',
    border: '#1e2d45',
    text: '#e2e8f0',
    muted: '#64748b',
    accent: '#f59e0b',
    green: '#22c55e',
};
export function AmbassadorDashboard({ userRole = 'ambassador', displayName }) {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const load = async () => {
            try {
                const p = await window.amplify?.ambassadorGetProfile?.();
                if (p)
                    setProfile(p);
            }
            catch { /* empty state */ }
            finally {
                setLoading(false);
            }
        };
        void load();
    }, []);
    return (_jsxs("div", { style: {
            background: C.bg,
            color: C.text,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            height: '100%',
            overflowY: 'auto',
        }, children: [_jsx("div", { style: {
                    padding: '16px 20px 14px',
                    borderBottom: `1px solid ${C.border}`,
                    background: '#0d1220',
                }, children: _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10 }, children: [_jsx("span", { style: { fontSize: 22 }, children: "\uD83C\uDF3F" }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 16, fontWeight: 700, color: C.text }, children: "Ambassador Dashboard" }), _jsxs("div", { style: { fontSize: 10, color: C.muted }, children: [displayName ?? 'Ambassador', " \u00B7 ", userRole === 'founder' ? 'Founder access' : 'Role: Ambassador'] })] })] }) }), _jsxs("div", { style: { padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }, children: [_jsxs("section", { children: [_jsx("h3", { style: { margin: '0 0 10px', fontSize: 13, color: C.accent }, children: "Ambassador Profile" }), loading ? (_jsx("div", { style: { color: C.muted, fontSize: 11 }, children: "Loading\u2026" })) : profile ? (_jsxs("div", { style: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }, children: [_jsx(Row, { label: "Name", value: profile.displayName }), _jsx(Row, { label: "Nominating Crown", value: profile.nominatingCrown ?? '—' }), _jsx(Row, { label: "Scope", value: profile.scope ?? '—' }), _jsx(Row, { label: "Ratified", value: profile.ratifiedAt ? new Date(profile.ratifiedAt).toLocaleDateString() : '—' })] })) : (_jsxs("div", { style: {
                                    textAlign: 'center', padding: '24px 16px',
                                    border: `1px dashed ${C.border}`, borderRadius: 10, color: C.muted, fontSize: 11,
                                }, children: ["Ambassador profile not yet established.", _jsx("br", {}), "Contact your nominating Crown to complete onboarding."] }))] }), _jsxs("section", { children: [_jsx("h3", { style: { margin: '0 0 10px', fontSize: 13, color: C.accent }, children: "Peer Witnesses" }), profile && profile.peerWitnesses.length > 0 ? (_jsx("div", { style: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }, children: profile.peerWitnesses.map((w, i) => (_jsx("div", { style: {
                                        fontSize: 11, color: C.text, padding: '4px 0',
                                        borderBottom: i < profile.peerWitnesses.length - 1 ? `1px solid ${C.border}` : 'none',
                                    }, children: w }, i))) })) : (_jsx("div", { style: {
                                    textAlign: 'center', padding: '20px 16px',
                                    border: `1px dashed ${C.border}`, borderRadius: 10, color: C.muted, fontSize: 11,
                                }, children: "No peer witnesses on record." }))] }), _jsxs("section", { children: [_jsx("h3", { style: { margin: '0 0 10px', fontSize: 13, color: C.accent }, children: "Ambassador Charter" }), _jsxs("div", { style: {
                                    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14,
                                    fontSize: 11, color: C.muted, lineHeight: 1.7,
                                }, children: [_jsx("p", { style: { margin: '0 0 8px' }, children: "Ambassadors represent the cooperative in their scope \u2014 not as an authority, but as a presence. An Ambassador's role is to make the cooperative legible and trustworthy in their domain." }), _jsxs("ul", { style: { margin: 0, paddingLeft: 18, lineHeight: 1.8 }, children: [_jsx("li", { children: "Nominated by a Helm Crown; ratified by dual-veto" }), _jsx("li", { children: "Scope is bounded \u2014 no ambassador speaks for all Initiatives" }), _jsx("li", { children: "Peer witnesses confirm presence in the domain" }), _jsx("li", { children: "Term: active until scope changes or role is voluntarily released" })] })] })] })] })] }));
}
function Row({ label, value }) {
    return (_jsxs("div", { style: {
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            padding: '6px 0',
            borderBottom: `1px solid ${C.border}`,
        }, children: [_jsx("span", { style: { fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }, children: label }), _jsx("span", { style: { fontSize: 12, color: C.text }, children: value })] }));
}
