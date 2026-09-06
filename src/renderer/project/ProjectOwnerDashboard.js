import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// MnemosyneC — Project Owner Dashboard
// MV-HELM-CROWN-AMB SAGA 6 BP045 W1
//
// Role-gated: project-owner | founder
// Surfaces: own initiative (Sweet 16) · contributor roster
import { useState, useEffect } from 'react';
import { SWEET_SIXTEEN, getInitiativeBySlug } from '../../shared/roles';
// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
    bg: '#0a0f1a',
    surface: '#111827',
    border: '#1e2d45',
    text: '#e2e8f0',
    muted: '#64748b',
    accent: '#22c55e',
    amber: '#f59e0b',
    purple: '#a78bfa',
};
export function ProjectOwnerDashboard({ slug, userRole = 'project-owner', displayName }) {
    const [contributors, setContributors] = useState([]);
    const [loading, setLoading] = useState(true);
    const initiative = getInitiativeBySlug(slug);
    useEffect(() => {
        const load = async () => {
            try {
                const c = await window.amplify?.projectGetContributors?.({ slug });
                if (Array.isArray(c))
                    setContributors(c);
            }
            catch { /* empty state */ }
            finally {
                setLoading(false);
            }
        };
        void load();
    }, [slug]);
    if (!initiative) {
        return (_jsxs("div", { style: {
                background: C.bg, color: C.text,
                fontFamily: 'system-ui, sans-serif',
                padding: 24, textAlign: 'center',
            }, children: [_jsxs("div", { style: { fontSize: 11, color: C.muted }, children: ["Initiative not found: ", _jsx("code", { children: slug })] }), _jsxs("div", { style: { marginTop: 16, fontSize: 11, color: C.muted }, children: ["Valid slugs: ", SWEET_SIXTEEN.map((i) => i.slug).join(', ')] })] }));
    }
    const active = contributors.filter((c) => c.active);
    const inactive = contributors.filter((c) => !c.active);
    return (_jsxs("div", { style: {
            background: C.bg,
            color: C.text,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            height: '100%',
            overflowY: 'auto',
        }, children: [_jsxs("div", { style: {
                    padding: '16px 20px 14px',
                    borderBottom: `1px solid ${C.border}`,
                    background: '#0d1220',
                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }, children: [_jsx("span", { style: { fontSize: 22 }, children: "\uD83C\uDF31" }), _jsxs("div", { children: [_jsxs("div", { style: { fontSize: 16, fontWeight: 700, color: C.text }, children: ["#", initiative.number, " \u2014 ", initiative.name] }), _jsxs("div", { style: { fontSize: 10, color: C.muted }, children: ["Project Owner: ", displayName ?? 'Owner', " \u00B7 ", userRole === 'founder' ? 'Founder access' : 'Role: Project Owner'] })] })] }), _jsx("div", { style: { display: 'flex', gap: 8, marginTop: 8 }, children: [
                            { label: 'Active', value: active.length },
                            { label: 'Total', value: contributors.length },
                            initiative.crown ? { label: 'Crown', value: initiative.crown, wide: true } : null,
                        ].filter(Boolean).map((s) => (_jsxs("div", { style: {
                                background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
                                padding: '8px 12px', flex: s.wide ? 2 : 1,
                            }, children: [_jsx("div", { style: { fontSize: s.wide ? 11 : 18, fontWeight: 700, color: C.text }, children: s.value }), _jsx("div", { style: { fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }, children: s.label })] }, s.label))) })] }), _jsxs("div", { style: { padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }, children: [_jsxs("section", { children: [_jsxs("h3", { style: { margin: '0 0 10px', fontSize: 13, color: C.accent }, children: ["Active Contributors (", active.length, ")"] }), loading ? (_jsx("div", { style: { color: C.muted, fontSize: 11 }, children: "Loading\u2026" })) : active.length === 0 ? (_jsx("div", { style: {
                                    textAlign: 'center', padding: '24px 16px',
                                    border: `1px dashed ${C.border}`, borderRadius: 10, color: C.muted, fontSize: 11,
                                }, children: "No contributors yet. Invite members to join this initiative." })) : (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: active.map((c) => (_jsx(ContributorRow, { contributor: c }, c.id))) }))] }), inactive.length > 0 && (_jsxs("section", { children: [_jsxs("h3", { style: { margin: '0 0 10px', fontSize: 13, color: C.muted }, children: ["Past Contributors (", inactive.length, ")"] }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: inactive.map((c) => (_jsx(ContributorRow, { contributor: c, dim: true }, c.id))) })] })), _jsxs("section", { children: [_jsx("h3", { style: { margin: '0 0 10px', fontSize: 13, color: C.purple }, children: "Initiative Context" }), _jsxs("div", { style: {
                                    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
                                    padding: 14, fontSize: 11, color: C.muted, lineHeight: 1.7,
                                }, children: [_jsxs("div", { style: { marginBottom: 6 }, children: [_jsx("strong", { style: { color: C.text }, children: "Discipline reminder:" }), " Initiative #11 = \"Let's Make Bread\" \u00B7 #15 = \"Power to the People\" \u00B7 Bonfire (#17) is a SPINOUT, not an Initiative."] }), _jsxs("div", { children: ["Creator-keep on this platform: ", _jsx("strong", { style: { color: C.text }, children: "83.3%" }), " of every transaction (NEVER 83%, NEVER 84%). Platform margin: Cost + 20%. Membership: $5/year. Workers ", _jsx("em", { children: "may earn" }), " \u2014 always use variance-bands, never point-estimates."] })] })] })] })] }));
}
function ContributorRow({ contributor, dim }) {
    return (_jsxs("div", { style: {
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px',
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            opacity: dim ? 0.6 : 1,
        }, children: [_jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 600, color: C.text }, children: contributor.displayName }), _jsxs("div", { style: { fontSize: 10, color: C.muted, marginTop: 2 }, children: [contributor.role, " \u00B7 joined ", new Date(contributor.joinedAt).toLocaleDateString()] })] }), _jsx("span", { style: {
                    fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 8,
                    background: contributor.active ? '#0a1f0e' : C.border,
                    color: contributor.active ? C.accent : C.muted,
                    border: `1px solid ${contributor.active ? C.accent + '44' : C.border}`,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                }, children: contributor.active ? 'Active' : 'Past' })] }));
}
