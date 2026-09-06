import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// AppTab — BP054 · Application-002 UI Surfaces
// The unified member-services dashboard — 10 canonical cooperative sub-services.
// Services 1-4: partial implementations exist elsewhere — tiles link to relevant tabs/views.
// Services 5-10: new implementations (Application-002 surfaces).
//
// KN-BP143-3 D4: this file has zero importers anywhere in src/ (confirmed by exhaustive search)
// -- it is not reachable from CompassShell, CleanShell, or any other live route, so the 5
// 'coming-soon' tiles below were not actually visible to the Founder today. Still fixed rather
// than left as-is: cut per the ticket's "default to cutting" rule, in case this surface is ever
// re-wired later, it starts honest. Removed: Research, Bounty's App, Make Something, Pawn
// Walkthrough, Theia -- none of the five has a real implementation to link to. The remaining 5
// tiles (Peer Hosting, Recipe Pantry, Software Work, Atlas, Local Network) all have status:'open'
// and a real tabTarget.
import { useState, useRef } from 'react';
const SERVICES = [
    {
        id: 1,
        icon: '🌐',
        name: 'Peer Hosting',
        description: 'Asteroid-proof P2P hosting on the cooperative substrate — your files, redundantly held across member peers.',
        status: 'open',
        actionLabel: 'Open',
        tabTarget: 'kitchen-table',
    },
    {
        id: 3,
        icon: '🍽️',
        name: 'Recipe Pantry',
        description: 'Save, search, and share recipes with your household — meal planning and pantry management, zero ads.',
        status: 'open',
        actionLabel: 'Open',
        tabTarget: 'kitchen-table',
    },
    {
        id: 4,
        icon: '🛠️',
        name: 'Software Work',
        description: 'Build and deploy cooperative-class apps as a member-developer — Hearth App Builder with AI-assisted scaffolding.',
        status: 'open',
        actionLabel: 'Open',
        tabTarget: 'helm',
    },
    {
        id: 9,
        icon: '📅',
        name: 'Atlas',
        description: 'Family and team scheduling — multi-person calendar with P2P peer sync across local network and cooperative mesh.',
        status: 'open',
        actionLabel: 'Open',
        tabTarget: 'atlas',
    },
    {
        id: 10,
        icon: '🕸️',
        name: 'Local Network',
        description: 'Federation-ready local peer-mesh — discover and sync with cooperative members on your LAN, no cloud required.',
        status: 'open',
        actionLabel: 'Open',
        tabTarget: 'kitchen-table',
    },
];
export function AppTab({ authState, onNavigate }) {
    const isMember = authState?.status === 'member' || authState?.status === 'trial_active';
    const [hoveredId, setHoveredId] = useState(null);
    // MoneyPenny Orchestration Panel state
    const [mpOpen, setMpOpen] = useState(false);
    const [mpTask, setMpTask] = useState('');
    const [mpBusy, setMpBusy] = useState(false);
    const [mpResult, setMpResult] = useState(null);
    const mpInputRef = useRef(null);
    async function handleMpAsk() {
        const task = mpTask.trim();
        if (!task || mpBusy)
            return;
        setMpBusy(true);
        setMpResult(null);
        try {
            const res = await window.amplify?.moneypenny?.orchestrate(task);
            setMpResult(res ?? { briefing: null, error: 'no_response' });
        }
        catch {
            setMpResult({ briefing: null, error: 'librarian_unavailable' });
        }
        finally {
            setMpBusy(false);
        }
    }
    function handleAction(tile) {
        if (tile.status === 'coming-soon')
            return;
        if (tile.tabTarget && onNavigate) {
            onNavigate(tile.tabTarget);
            return;
        }
        if (tile.externalUrl) {
            window.amplify?.openExternal?.(tile.externalUrl);
        }
    }
    const implementedCount = SERVICES.filter((s) => s.status === 'open').length;
    const comingSoonCount = SERVICES.filter((s) => s.status === 'coming-soon').length;
    return (_jsxs("div", { style: {
            height: '100%', overflowY: 'auto', padding: '20px 20px 32px',
            boxSizing: 'border-box',
        }, children: [_jsxs("div", { style: { marginBottom: 20 }, children: [_jsx("div", { style: { fontSize: 16, fontWeight: 800, color: '#e2e8f0', letterSpacing: '-0.3px' }, children: "Cooperative Services" }), _jsxs("div", { style: { fontSize: 10, color: '#475569', marginTop: 4, lineHeight: 1.6 }, children: [implementedCount, " active \u00B7 ", comingSoonCount, " coming soon \u00B7 member-owned \u00B7 zero ads \u00B7 your IP retained"] }), !isMember && (_jsx("div", { style: {
                            marginTop: 10, padding: '8px 12px',
                            background: 'rgba(110,231,183,0.06)', border: '1px solid rgba(110,231,183,0.18)',
                            borderRadius: 8, fontSize: 10, color: '#6ee7b7',
                        }, children: "Some services require cooperative membership ($5/year) \u2014 free features are always available." }))] }), _jsx("div", { style: {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: 12,
                }, children: SERVICES.map((tile) => {
                    const isHovered = hoveredId === tile.id;
                    const isComingSoon = tile.status === 'coming-soon';
                    const isMemberOnly = tile.status === 'member-only' && !isMember;
                    return (_jsxs("div", { onMouseEnter: () => setHoveredId(tile.id), onMouseLeave: () => setHoveredId(null), style: {
                            background: isHovered && !isComingSoon
                                ? 'rgba(110,231,183,0.07)'
                                : 'rgba(15,23,42,0.6)',
                            border: `1px solid ${isHovered && !isComingSoon ? 'rgba(110,231,183,0.28)' : 'rgba(100,116,139,0.15)'}`,
                            borderRadius: 12,
                            padding: '16px 16px 14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            transition: 'all 0.15s',
                            opacity: isComingSoon ? 0.75 : 1,
                        }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsx("span", { style: { fontSize: 24 }, children: tile.icon }), _jsx("span", { style: {
                                            fontSize: 9, color: '#334155', fontWeight: 600,
                                            background: 'rgba(100,116,139,0.08)',
                                            borderRadius: 10, padding: '2px 6px',
                                        }, children: tile.id < 10 ? `0${tile.id}` : tile.id })] }), _jsx("div", { style: { fontSize: 12, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.3 }, children: tile.name }), _jsx("div", { style: {
                                    fontSize: 10, color: '#64748b', lineHeight: 1.6, flex: 1,
                                }, children: tile.description }), _jsx("button", { onClick: () => handleAction(tile), disabled: isComingSoon || isMemberOnly, style: {
                                    marginTop: 4,
                                    background: isComingSoon || isMemberOnly
                                        ? 'rgba(100,116,139,0.08)'
                                        : 'rgba(110,231,183,0.1)',
                                    border: `1px solid ${isComingSoon || isMemberOnly ? 'rgba(100,116,139,0.15)' : 'rgba(110,231,183,0.3)'}`,
                                    borderRadius: 7,
                                    color: isComingSoon || isMemberOnly ? '#334155' : '#6ee7b7',
                                    fontSize: 10,
                                    fontWeight: 600,
                                    padding: '6px 12px',
                                    cursor: isComingSoon || isMemberOnly ? 'default' : 'pointer',
                                    textAlign: 'center',
                                    transition: 'all 0.15s',
                                    width: '100%',
                                }, children: isMemberOnly ? '🔒 Members Only' : tile.actionLabel })] }, tile.id));
                }) }), _jsx("div", { style: {
                    marginTop: 24, textAlign: 'center', fontSize: 9, color: '#1e293b',
                }, children: "Cooperative-class services \u00B7 member IP retained \u00B7 zero ads \u00B7 $5/year to join" }), _jsxs("div", { style: { marginTop: 20 }, children: [_jsxs("button", { onClick: () => setMpOpen((o) => !o), style: {
                            width: '100%',
                            background: 'rgba(15,23,42,0.5)',
                            border: '1px solid rgba(100,116,139,0.18)',
                            borderRadius: 10,
                            padding: '10px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            color: '#94a3b8',
                            fontSize: 11,
                            fontWeight: 600,
                            textAlign: 'left',
                        }, children: [_jsx("span", { children: "\uD83E\uDD16 AI Orchestration" }), _jsx("span", { style: { fontSize: 9, opacity: 0.6 }, children: mpOpen ? '▲ collapse' : '▼ expand' })] }), mpOpen && (_jsxs("div", { style: {
                            marginTop: 8,
                            background: 'rgba(15,23,42,0.7)',
                            border: '1px solid rgba(100,116,139,0.15)',
                            borderRadius: 10,
                            padding: '14px 16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10,
                        }, children: [_jsx("div", { style: { fontSize: 10, color: '#64748b', lineHeight: 1.5 }, children: "Ask MoneyPenny to brief you on any task using the Librarian context engine." }), _jsxs("div", { style: { display: 'flex', gap: 8 }, children: [_jsx("input", { ref: mpInputRef, value: mpTask, onChange: (e) => setMpTask(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter')
                                            void handleMpAsk(); }, placeholder: "What would you like to do?", style: {
                                            flex: 1,
                                            background: 'rgba(30,41,59,0.8)',
                                            border: '1px solid rgba(100,116,139,0.25)',
                                            borderRadius: 7,
                                            color: '#e2e8f0',
                                            fontSize: 11,
                                            padding: '7px 10px',
                                            outline: 'none',
                                        } }), _jsx("button", { onClick: () => void handleMpAsk(), disabled: mpBusy || !mpTask.trim(), style: {
                                            background: mpBusy || !mpTask.trim()
                                                ? 'rgba(100,116,139,0.1)'
                                                : 'rgba(110,231,183,0.12)',
                                            border: `1px solid ${mpBusy || !mpTask.trim() ? 'rgba(100,116,139,0.15)' : 'rgba(110,231,183,0.3)'}`,
                                            borderRadius: 7,
                                            color: mpBusy || !mpTask.trim() ? '#475569' : '#6ee7b7',
                                            fontSize: 10,
                                            fontWeight: 600,
                                            padding: '7px 14px',
                                            cursor: mpBusy || !mpTask.trim() ? 'default' : 'pointer',
                                            whiteSpace: 'nowrap',
                                            transition: 'all 0.15s',
                                        }, children: mpBusy ? 'Asking…' : 'Ask MoneyPenny' })] }), mpResult && (_jsx("div", { style: { marginTop: 4 }, children: mpResult.error === 'librarian_unavailable' || (!mpResult.briefing && mpResult.error) ? (_jsx("div", { style: {
                                        fontSize: 10, color: '#f59e0b',
                                        background: 'rgba(245,158,11,0.06)',
                                        border: '1px solid rgba(245,158,11,0.18)',
                                        borderRadius: 7,
                                        padding: '8px 12px',
                                        lineHeight: 1.5,
                                    }, children: "MoneyPenny is offline \u2014 start the Librarian server to connect." })) : (_jsx("textarea", { readOnly: true, value: mpResult.briefing ?? '', rows: 6, style: {
                                        width: '100%',
                                        background: 'rgba(30,41,59,0.6)',
                                        border: '1px solid rgba(100,116,139,0.2)',
                                        borderRadius: 7,
                                        color: '#cbd5e1',
                                        fontSize: 10,
                                        padding: '8px 10px',
                                        resize: 'vertical',
                                        lineHeight: 1.6,
                                        boxSizing: 'border-box',
                                        fontFamily: 'inherit',
                                    } })) }))] }))] })] }));
}
