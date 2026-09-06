import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// SubstrateTab — BP060 Application 002 Step 1
// Container for all 5 substrate UI surfaces (UI-1, UI-3, UI-4, UI-5, UI-6).
// UI-2 (ShirleyTempleToggles) is at chamber root in MnemosyneTabView, not here.
// Sub-panels accessible via pill tabs at top.
import { useState } from 'react';
import { SubstrateToolsPane } from './SubstrateToolsPane';
import { MarkerReportingFlow } from './MarkerReportingFlow';
import { SecondDoorStamps } from './SecondDoorStamps';
import { AreopagusQueryPane } from './AreopagusQueryPane';
import { SubstraceViz } from './SubstraceViz';
const PANELS = [
    {
        id: 'tools',
        label: 'Tools',
        icon: '⚙',
        tooltip: 'UI-1 · Substrate Tools — 9 caithedral-core@0.2.0 operations',
    },
    {
        id: 'markers',
        label: 'Markers',
        icon: '🔖',
        tooltip: 'UI-3 · Marker Reporting — chess.com-adapted content marking · Harper Guild custody',
    },
    {
        id: 'seconddoor',
        label: 'Second Door',
        icon: '🚪',
        tooltip: 'UI-4 · Second Door — threshold stamps · Coming/Going · Tower of Peace',
    },
    {
        id: 'areopagus',
        label: 'Areopagus',
        icon: '🏛',
        tooltip: 'UI-5 · Areopagus — substrate query · signed sealed delivered always maintained',
    },
    {
        id: 'theorem',
        label: 'Theorem',
        icon: '🧮',
        tooltip: 'UI-6 · Substrace Theorem — Pearl→Eblit→Substrace→Quilt visual proof',
    },
];
// ─── Component ────────────────────────────────────────────────────────────────
export function SubstrateTab() {
    const [activePanel, setActivePanel] = useState('tools');
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }, children: [_jsxs("div", { style: {
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 12px',
                    background: 'rgba(110,231,183,0.04)',
                    borderBottom: '1px solid rgba(110,231,183,0.12)',
                    flexShrink: 0,
                }, children: [_jsx("div", { style: { fontSize: 10, fontWeight: 700, color: '#6ee7b7' }, children: "Substrate\u2122 \u00B7 Application 002 Step 1 \u00B7 BP060" }), _jsx("div", { style: { fontSize: 8, color: '#334155' }, children: "caithedral-core@0.2.0 \u00B7 decay_class: BETWEEN" })] }), _jsx("div", { style: {
                    display: 'flex',
                    gap: 3,
                    padding: '6px 10px 0',
                    borderBottom: '1px solid rgba(100,116,139,0.15)',
                    flexShrink: 0,
                    overflowX: 'auto',
                }, children: PANELS.map((p) => (_jsxs("button", { onClick: () => setActivePanel(p.id), title: p.tooltip, style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '5px 12px',
                        background: activePanel === p.id ? 'rgba(110,231,183,0.1)' : 'transparent',
                        border: `1px solid ${activePanel === p.id ? 'rgba(110,231,183,0.3)' : 'transparent'}`,
                        borderBottom: 'none',
                        borderRadius: '5px 5px 0 0',
                        color: activePanel === p.id ? '#6ee7b7' : '#475569',
                        fontSize: 10,
                        fontWeight: activePanel === p.id ? 700 : 400,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.12s ease',
                        userSelect: 'none',
                    }, children: [_jsx("span", { style: { fontSize: 11 }, children: p.icon }), p.label] }, p.id))) }), _jsxs("div", { style: { flex: 1, overflow: 'hidden' }, children: [activePanel === 'tools' && _jsx(SubstrateToolsPane, {}), activePanel === 'markers' && _jsx(MarkerReportingFlow, {}), activePanel === 'seconddoor' && _jsx(SecondDoorStamps, {}), activePanel === 'areopagus' && _jsx(AreopagusQueryPane, {}), activePanel === 'theorem' && _jsx(SubstraceViz, {})] })] }));
}
export default SubstrateTab;
