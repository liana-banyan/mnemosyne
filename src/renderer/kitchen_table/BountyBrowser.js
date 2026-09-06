import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// BountyBrowser.tsx — KniPr036 · Bounty Board publication UI scaffold
// Bounties are Pawn Phase 3 Trail Eblets published for members to attempt.
// Members accept a Bounty, complete the walk-through, and earn Marks.
import { useState } from 'react';
// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_BOUNTIES = [
    { id: 'V001', difficulty: 'Moderate', marks: 25, surface: 'mnemo', status: 'Available' },
    { id: 'V002', difficulty: 'Easy', marks: 10, surface: 'cephas', status: 'Available' },
    { id: 'V013', difficulty: 'Strenuous', marks: 60, surface: 'cephas', status: 'Available' },
    { id: 'V025', difficulty: 'Easy', marks: 10, surface: 'platform', status: 'Available' },
    { id: 'V037', difficulty: 'Very Strenuous', marks: 140, surface: 'cross', status: 'Available' },
];
// ─── Difficulty config ────────────────────────────────────────────────────────
const DIFFICULTY_CONFIG = {
    'Easy': { color: '#4ade80', bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.3)' },
    'Moderate': { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.3)' },
    'Strenuous': { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.3)' },
    'Very Strenuous': { color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)' },
    'Extreme': { color: '#c084fc', bg: 'rgba(192,132,252,0.12)', border: 'rgba(192,132,252,0.3)' },
};
const DIFFICULTY_ORDER = ['Easy', 'Moderate', 'Strenuous', 'Very Strenuous', 'Extreme'];
// ─── Surface label ────────────────────────────────────────────────────────────
const SURFACE_LABELS = {
    mnemo: '🧠 mnemo',
    cephas: '📜 cephas',
    platform: '🌐 platform',
    cross: '⚡ cross-surface',
};
// ─── Filter / Sort helpers ────────────────────────────────────────────────────
function applyFilterSort(bounties, filter, sort) {
    let result = filter === 'All' ? bounties : bounties.filter((b) => b.difficulty === filter);
    if (sort === 'Highest Marks') {
        result = [...result].sort((a, b) => b.marks - a.marks);
    }
    else if (sort === 'Difficulty ▲') {
        result = [...result].sort((a, b) => DIFFICULTY_ORDER.indexOf(a.difficulty) - DIFFICULTY_ORDER.indexOf(b.difficulty));
    }
    else if (sort === 'Difficulty ▼') {
        result = [...result].sort((a, b) => DIFFICULTY_ORDER.indexOf(b.difficulty) - DIFFICULTY_ORDER.indexOf(a.difficulty));
    }
    // 'Newest' keeps insertion order (source-order)
    return result;
}
// ─── BountyCard ───────────────────────────────────────────────────────────────
function BountyCard({ bounty }) {
    const diff = DIFFICULTY_CONFIG[bounty.difficulty];
    // KN-BP143-3 D4: these buttons used to fire a blocking native alert() claiming the action was
    // "coming soon" -- on a live button, that's a fabricated interaction (the click appears to do
    // something, it just tells you it doesn't). Neither Pawn Phase 3 publication (accept) nor
    // KniPr035's TrailEbletViewer-to-Bounty-ID wiring (view trail) exists yet, so both actions are
    // cut: the buttons render disabled with an honest tooltip instead of pretending to respond.
    return (_jsxs("div", { style: {
            background: 'rgba(15,23,42,0.7)',
            border: '1px solid rgba(100,116,139,0.2)',
            borderRadius: 10,
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            transition: 'border-color 0.15s',
        }, onMouseEnter: (e) => { e.currentTarget.style.borderColor = 'rgba(110,231,183,0.25)'; }, onMouseLeave: (e) => { e.currentTarget.style.borderColor = 'rgba(100,116,139,0.2)'; }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsx("span", { style: { fontSize: 14, fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.3px' }, children: bounty.id }), _jsx("span", { style: {
                            fontSize: 10, fontWeight: 700,
                            color: diff.color,
                            background: diff.bg,
                            border: `1px solid ${diff.border}`,
                            borderRadius: 10,
                            padding: '2px 8px',
                        }, children: bounty.difficulty })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10 }, children: [_jsxs("span", { style: {
                            fontSize: 12, fontWeight: 600, color: '#fbbf24',
                            background: 'rgba(251,191,36,0.08)',
                            border: '1px solid rgba(251,191,36,0.25)',
                            borderRadius: 8,
                            padding: '2px 8px',
                        }, children: [bounty.marks, " Marks"] }), _jsx("span", { style: { fontSize: 10, color: '#64748b' }, children: SURFACE_LABELS[bounty.surface] })] }), _jsxs("div", { style: { fontSize: 10, color: '#94a3b8' }, children: ["Status: ", _jsx("span", { style: { color: bounty.status === 'Available' ? '#4ade80' : '#94a3b8', fontWeight: 600 }, children: bounty.status })] }), _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 2 }, children: [_jsx("button", { disabled: true, title: "Bounty acceptance is not live yet -- Pawn Phase 3 publication is in progress.", style: {
                            flex: 1,
                            padding: '6px 10px',
                            background: 'rgba(100,116,139,0.08)',
                            border: '1px solid rgba(100,116,139,0.15)',
                            borderRadius: 6,
                            color: '#334155',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'default',
                        }, children: "Accept Bounty" }), _jsx("button", { disabled: true, title: `Trail viewer for ${bounty.id} is not wired yet -- KniPr035 (TrailEbletViewer) does not yet map to Bounty IDs.`, style: {
                            flex: 1,
                            padding: '6px 10px',
                            background: 'rgba(100,116,139,0.08)',
                            border: '1px solid rgba(100,116,139,0.15)',
                            borderRadius: 6,
                            color: '#334155',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'default',
                        }, children: "View Trail" })] })] }));
}
// ─── Empty state ──────────────────────────────────────────────────────────────
function BountyEmptyState() {
    return (_jsxs("div", { style: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 12,
            padding: 32,
            textAlign: 'center',
        }, children: [_jsx("div", { style: { fontSize: 36 }, children: "\uD83C\uDFF9" }), _jsx("div", { style: { fontSize: 14, fontWeight: 700, color: '#e2e8f0' }, children: "Bounty Board is warming up." }), _jsxs("div", { style: { fontSize: 12, color: '#64748b', maxWidth: 300, lineHeight: 1.7 }, children: ["Pawn Phase 3 Trails are being reviewed for publication.", _jsx("br", {}), "Check back soon \u2014 first Bounties expected within 24 hours."] })] }));
}
// ─── BountyBrowser (main export) ─────────────────────────────────────────────
export function BountyBrowser() {
    const [filter, setFilter] = useState('All');
    const [sort, setSort] = useState('Newest');
    const [showPreview, setShowPreview] = useState(false);
    const filters = ['All', 'Easy', 'Moderate', 'Strenuous', 'Very Strenuous', 'Extreme'];
    const sorts = ['Newest', 'Highest Marks', 'Difficulty ▲', 'Difficulty ▼'];
    const displayedBounties = showPreview
        ? applyFilterSort(MOCK_BOUNTIES, filter, sort)
        : [];
    return (_jsxs("div", { style: {
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            background: '#0a0f1a',
            color: '#e2e8f0',
        }, children: [_jsxs("div", { style: {
                    padding: '10px 14px 8px',
                    borderBottom: '1px solid rgba(100,116,139,0.15)',
                    flexShrink: 0,
                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }, children: [_jsx("div", { style: { fontSize: 14, fontWeight: 700, color: '#e2e8f0' }, children: "\uD83C\uDFF9 Bounty Board" }), _jsxs("label", { style: {
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    fontSize: 10, color: '#64748b', cursor: 'pointer', userSelect: 'none',
                                }, children: [_jsx("div", { onClick: () => setShowPreview((p) => !p), style: {
                                            width: 28, height: 16, borderRadius: 8,
                                            background: showPreview ? 'rgba(110,231,183,0.4)' : 'rgba(100,116,139,0.25)',
                                            border: `1px solid ${showPreview ? 'rgba(110,231,183,0.6)' : 'rgba(100,116,139,0.4)'}`,
                                            position: 'relative', cursor: 'pointer', transition: 'all 0.2s',
                                        }, children: _jsx("div", { style: {
                                                position: 'absolute', top: 1, left: showPreview ? 13 : 1,
                                                width: 12, height: 12, borderRadius: '50%',
                                                background: showPreview ? '#6ee7b7' : '#64748b',
                                                transition: 'left 0.2s',
                                            } }) }), "Show Preview"] })] }), _jsx("div", { style: { borderBottom: '1px solid rgba(100,116,139,0.2)', marginBottom: 8 } }), _jsxs("div", { style: { display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }, children: [_jsx("span", { style: { fontSize: 9, color: '#475569', fontWeight: 600, alignSelf: 'center', marginRight: 4 }, children: "FILTER" }), filters.map((f) => {
                                const active = filter === f;
                                const diffConf = f !== 'All' ? DIFFICULTY_CONFIG[f] : null;
                                return (_jsx("button", { onClick: () => setFilter(f), style: {
                                        padding: '2px 9px',
                                        borderRadius: 10,
                                        fontSize: 10,
                                        fontWeight: active ? 700 : 400,
                                        cursor: 'pointer',
                                        background: active
                                            ? (diffConf ? diffConf.bg : 'rgba(110,231,183,0.12)')
                                            : 'transparent',
                                        border: `1px solid ${active
                                            ? (diffConf ? diffConf.border : 'rgba(110,231,183,0.3)')
                                            : 'rgba(100,116,139,0.25)'}`,
                                        color: active
                                            ? (diffConf ? diffConf.color : '#6ee7b7')
                                            : '#64748b',
                                        transition: 'all 0.15s',
                                    }, children: f }, f));
                            })] }), _jsxs("div", { style: { display: 'flex', gap: 4, flexWrap: 'wrap' }, children: [_jsx("span", { style: { fontSize: 9, color: '#475569', fontWeight: 600, alignSelf: 'center', marginRight: 4 }, children: "SORT" }), sorts.map((s) => {
                                const active = sort === s;
                                return (_jsx("button", { onClick: () => setSort(s), style: {
                                        padding: '2px 9px',
                                        borderRadius: 10,
                                        fontSize: 10,
                                        fontWeight: active ? 700 : 400,
                                        cursor: 'pointer',
                                        background: active ? 'rgba(100,116,139,0.15)' : 'transparent',
                                        border: `1px solid ${active ? 'rgba(100,116,139,0.4)' : 'rgba(100,116,139,0.2)'}`,
                                        color: active ? '#94a3b8' : '#475569',
                                        transition: 'all 0.15s',
                                    }, children: s }, s));
                            })] })] }), _jsx("div", { style: { flex: 1, overflowY: 'auto', padding: '10px 14px' }, children: displayedBounties.length > 0 ? (_jsx("div", { style: {
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                        gap: 10,
                    }, children: displayedBounties.map((bounty) => (_jsx(BountyCard, { bounty: bounty }, bounty.id))) })) : (_jsx(BountyEmptyState, {})) }), showPreview && (_jsx("div", { style: {
                    padding: '5px 14px',
                    borderTop: '1px solid rgba(100,116,139,0.1)',
                    fontSize: 9,
                    color: '#334155',
                    flexShrink: 0,
                }, children: "Preview mode \u2014 showing 5 mock bounties (V001 V002 V013 V025 V037). Real data pending Pawn Phase 3 publication." }))] }));
}
