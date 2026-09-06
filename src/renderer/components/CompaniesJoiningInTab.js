import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// CompaniesJoiningInTab.tsx — BP087 Wave 3 SEG-F2
// Displays live food-sector member businesses from entity_membership table
// Supabase client: src/renderer/lib/supabase.ts
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
function formatMonthYear(isoDate) {
    try {
        const d = new Date(isoDate);
        return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }
    catch {
        return isoDate;
    }
}
// ─── Entity Card ──────────────────────────────────────────────────────────────
function EntityCard({ entity }) {
    return (_jsxs("div", { style: {
            background: 'rgba(15,23,42,0.6)',
            border: '1px solid rgba(100,116,139,0.2)',
            borderRadius: 10, padding: '14px 16px',
            display: 'flex', flexDirection: 'column', gap: 5,
        }, children: [_jsx("div", { style: { fontSize: 13, fontWeight: 700, color: '#e2e8f0' }, children: entity.entity_name }), entity.city && (_jsx("div", { style: { fontSize: 11, color: '#94a3b8' }, children: entity.city })), _jsxs("div", { style: { fontSize: 10, color: '#475569', marginTop: 2 }, children: ["Member since ", formatMonthYear(entity.joined_at)] })] }));
}
// ─── Component ────────────────────────────────────────────────────────────────
export function CompaniesJoiningInTab() {
    const [entities, setEntities] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        let cancelled = false;
        async function fetchEntities() {
            setLoading(true);
            setError(null);
            try {
                const { data, error: sbErr } = await supabase
                    .from('entity_membership')
                    .select('entity_name,node_type,city,joined_at')
                    .eq('node_type', 'food')
                    .eq('status', 'live')
                    .order('joined_at', { ascending: false });
                if (cancelled)
                    return;
                if (sbErr) {
                    setError(sbErr.message);
                    setEntities(null);
                }
                else {
                    setEntities(data ?? []);
                }
            }
            catch (e) {
                if (!cancelled)
                    setError(String(e));
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        }
        void fetchEntities();
        return () => { cancelled = true; };
    }, []);
    return (_jsx("div", { style: { padding: '16px 20px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }, children: _jsxs("div", { style: { maxWidth: 580, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 15, fontWeight: 700, color: '#e2e8f0' }, children: "Member Businesses" }), _jsx("div", { style: { fontSize: 11, color: '#64748b', marginTop: 3, lineHeight: 1.5 }, children: "Food-sector cooperative members" })] }), loading && (_jsx("div", { style: {
                        textAlign: 'center', padding: '36px 0',
                        fontSize: 12, color: '#475569',
                    }, children: "Loading member businesses..." })), !loading && error && (_jsxs("div", { style: {
                        background: 'rgba(127,29,29,0.15)',
                        border: '1px solid rgba(248,113,113,0.3)',
                        borderRadius: 8, padding: '14px 16px',
                        fontSize: 11, color: '#fca5a5', lineHeight: 1.5,
                    }, children: [_jsx("div", { style: { fontWeight: 700, color: '#f87171', marginBottom: 4 }, children: "Failed to load" }), error] })), !loading && !error && entities !== null && entities.length === 0 && (_jsxs("div", { style: {
                        textAlign: 'center', padding: '48px 0',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                    }, children: [_jsx("span", { style: { fontSize: 32 }, children: "\uD83C\uDF31" }), _jsx("div", { style: { fontSize: 13, fontWeight: 600, color: '#e2e8f0' }, children: "No member businesses yet." }), _jsx("div", { style: { fontSize: 11, color: '#475569' }, children: "Be the first." })] })), !loading && !error && entities && entities.length > 0 && (_jsxs(_Fragment, { children: [_jsxs("div", { style: {
                                fontSize: 10, color: '#475569',
                                fontWeight: 600, letterSpacing: '0.05em',
                            }, children: [entities.length, " member", entities.length !== 1 ? 's' : ''] }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 10 }, children: entities.map((entity, i) => (_jsx(EntityCard, { entity: entity }, `${entity.entity_name}-${i}`))) })] }))] }) }));
}
