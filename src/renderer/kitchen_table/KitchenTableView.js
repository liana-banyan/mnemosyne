import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Kitchen Table™ composite view — MnemosyneC™ v0.1.8 · SEG-FT-8 · BP052 NOVACULA
// KniPr035: Trail Eblets tab added alongside Recipes + P2P
// KniPr036: Bounty Board tab added
import { useState } from 'react';
import { RecipesView } from './RecipesView';
import { P2PDiscoveryPanel } from './P2PDiscoveryPanel';
import { WanStatusBar } from '../components/WanStatusBar';
import { TrailEbletViewer } from './TrailEbletViewer';
import { BountyBrowser } from './BountyBrowser';
const TAB_ITEMS = [
    { id: 'kitchen', label: '🍽️ Kitchen' },
    { id: 'trails', label: '🥾 Trail Eblets' },
    { id: 'bounty-board', label: '🏹 Bounty Board' },
];
export function KitchenTableView({ onScheduleMeal } = {}) {
    const [activeTab, setActiveTab] = useState('kitchen');
    return (_jsxs("div", { style: {
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
            fontFamily: 'system-ui, -apple-system, sans-serif',
        }, children: [_jsxs("div", { style: {
                    padding: '6px 14px 0',
                    borderBottom: '1px solid rgba(100,116,139,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0,
                    flexShrink: 0,
                }, children: [TAB_ITEMS.map((tab) => (_jsx("button", { onClick: () => setActiveTab(tab.id), style: {
                            background: 'transparent',
                            border: 'none',
                            borderBottom: activeTab === tab.id ? '2px solid rgba(99,102,241,0.7)' : '2px solid transparent',
                            color: activeTab === tab.id ? '#e2e8f0' : '#64748b',
                            fontSize: 11,
                            fontWeight: activeTab === tab.id ? 700 : 400,
                            padding: '4px 12px 6px',
                            cursor: 'pointer',
                            transition: 'color 0.12s, border-color 0.12s',
                            flexShrink: 0,
                        }, children: tab.label }, tab.id))), _jsx("div", { style: { flex: 1 } }), activeTab === 'kitchen' && (_jsx("div", { style: { fontSize: 9, color: '#475569', paddingBottom: 6 }, children: "Recipes\u2122 \u00B7 Meal planning \u00B7 Cooperative kitchen" })), activeTab === 'trails' && (_jsx("div", { style: { fontSize: 9, color: '#475569', paddingBottom: 6 }, children: "Pawn Phase 3 outputs \u00B7 TRAILS eblet store" })), activeTab === 'bounty-board' && (_jsx("div", { style: { fontSize: 9, color: '#475569', paddingBottom: 6 }, children: "Pawn Phase 3 \u00B7 accept Trails \u00B7 earn Marks" }))] }), _jsxs("div", { style: { flex: 1, overflow: 'hidden' }, children: [activeTab === 'kitchen' && (_jsxs("div", { style: { display: 'flex', height: '100%', overflow: 'hidden' }, children: [_jsx("div", { style: { flex: 1, overflow: 'hidden', borderRight: '1px solid rgba(100,116,139,0.1)' }, children: _jsx(RecipesView, { onScheduleMeal: onScheduleMeal }) }), _jsxs("div", { style: { width: 220, display: 'flex', flexDirection: 'column', overflow: 'hidden' }, children: [_jsx("div", { style: { padding: '8px 10px 4px', fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }, children: "Network" }), _jsxs("div", { style: { padding: '0 10px 10px', flex: 1, overflowY: 'auto' }, children: [_jsx(WanStatusBar, {}), _jsx(P2PDiscoveryPanel, {})] })] })] })), activeTab === 'trails' && _jsx(TrailEbletViewer, {}), activeTab === 'bounty-board' && _jsx(BountyBrowser, {})] })] }));
}
