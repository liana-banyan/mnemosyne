import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// compass/MoreTab.tsx -- BP138 Yoke 0.9.14: Compass nav tab 5 (More, overflow).
//
// Menu of destinations not promoted to a top-level Compass tab: Kitchen Table, Atlas,
// Diagnosis, Frame, LB Account, Settings, Membership, Help, Power/Diagnostics (Phase 2).
//
// Two destinations here (Diagnosis, Frame) are NOT explicitly named anywhere in this Yoke's
// Phase 1 "More" list -- see this Yoke's final report, "decisions I had to make" section, for
// why they landed here rather than being silently dropped (Rule: reorganize, never delete
// function).
//
// Kitchen Table and Atlas are ALSO reachable directly from the Ask home's quick-starts
// (Phase 3) -- their presence here is supplementary, not their primary front door, per the
// Yoke's own instruction.
//
// Help and Substrate here are small LOCAL composers mirroring CleanShell.tsx's own
// HelpFaqTab/CombinedSubstrateTab sub-tab pattern exactly, rather than importing those private
// (non-exported) functions from CleanShell.tsx -- this keeps CleanShell.tsx byte-for-byte
// untouched, which is this Yoke's hard acceptance gate.
import React from 'react';
import { KitchenTableView } from '../../kitchen_table/KitchenTableView';
import { AtlasView } from '../../kitchen_table/AtlasView';
import { TheDiagnosisTab } from '../TheDiagnosisTab';
import { FrameTab } from '../FrameTab';
import { LBAccountTab } from '../LBAccountTab';
import { SettingsTab } from '../SettingsTab';
import { MembershipTab } from '../MembershipTab';
import { LeanHelpTab } from '../LeanHelpTab';
import { DiagnosticModeTab } from '../DiagnosticModeTab';
import { MeshTestTerminalTab } from '../MeshTestTerminalTab';
import { PowerDiagnosticsPanel } from './PowerDiagnosticsPanel';
import { AuthorizationsPanel } from './AuthorizationsPanel';
function HelpComposer() {
    const [sub, setSub] = React.useState('faq');
    return (_jsxs("div", { style: { height: '100%', display: 'flex', flexDirection: 'column' }, children: [_jsx("div", { style: { display: 'flex', gap: 4, padding: '10px 16px 0', flexShrink: 0 }, children: ['faq', 'diagnostic', 'terminal'].map((id) => (_jsx("button", { onClick: () => setSub(id), style: {
                        background: 'none', border: 'none',
                        color: sub === id ? '#f0fdf4' : '#64748b',
                        fontSize: 12, fontWeight: sub === id ? 700 : 400,
                        padding: '4px 10px', cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
                        borderBottom: sub === id ? '2px solid #6ee7b7' : '2px solid transparent',
                    }, children: id === 'faq' ? 'FAQ' : id === 'diagnostic' ? '🩺 Remote Diagnostics' : '💻 Terminal' }, id))) }), _jsxs("div", { style: { flex: 1, overflowY: 'auto', padding: sub === 'diagnostic' || sub === 'terminal' ? 16 : 0 }, children: [sub === 'faq' && _jsx(LeanHelpTab, {}), sub === 'diagnostic' && _jsx(DiagnosticModeTab, {}), sub === 'terminal' && _jsx(MeshTestTerminalTab, {})] })] }));
}
const MENU = [
    { id: 'kitchen-table', icon: '🍽️', label: 'Kitchen Table', desc: 'Recipes, trail eblets, bounty board' },
    { id: 'atlas', icon: '🗓️', label: 'Atlas', desc: 'Scheduling, meal planning, shared calendar' },
    { id: 'diagnosis', icon: '🧂', label: 'Diagnosis', desc: 'Post an open question to the community' },
    { id: 'frame', icon: '🖼️', label: 'Frame', desc: 'LB Frame overlay border + mode indicator' },
    { id: 'lb-account', icon: '🔑', label: 'LB Account', desc: 'Your Liana Banyan account' },
    { id: 'settings', icon: '⚙️', label: 'Settings', desc: 'App preferences, models, updates' },
    { id: 'membership', icon: '💎', label: 'Membership', desc: '$5/year cooperative membership' },
    { id: 'help', icon: '❓', label: 'Help', desc: 'FAQ, remote diagnostics, terminal' },
    { id: 'power', icon: '🧪', label: 'Power / Diagnostics', desc: 'Advanced mesh + substrate controls' },
    // D-BP148-038: one place for every permission MnemosyneC holds or grants -- automatic
    // updates, mesh trust/peer verification, paid cloud escalation, Nexus authorities, and any
    // active benchmark/long-running task.
    { id: 'authorizations', icon: '🔐', label: 'Authorizations', desc: 'Permissions the app holds: updates, mesh trust, paid escalation, Nexus' },
];
export function MoreTab({ subView, onSubViewChange, authState, currentMode, onModeChange }) {
    if (subView !== 'menu') {
        const entry = MENU.find((m) => m.id === subView);
        return (_jsxs("div", { style: { height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }, children: [_jsxs("div", { style: {
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                        borderBottom: '1px solid #1e2a38', flexShrink: 0,
                    }, children: [_jsx("button", { onClick: () => onSubViewChange('menu'), style: {
                                background: 'none', border: '1px solid rgba(100,116,139,0.3)', borderRadius: 6,
                                color: '#64748b', fontSize: 11, padding: '4px 10px', cursor: 'pointer',
                                fontFamily: 'system-ui, sans-serif',
                            }, children: "\u2190 More" }), _jsx("span", { style: { fontSize: 13, fontWeight: 700, color: '#e2e8f0' }, children: entry ? `${entry.icon} ${entry.label}` : '' })] }), _jsxs("div", { style: { flex: 1, overflow: 'hidden' }, children: [subView === 'kitchen-table' && _jsx(KitchenTableView, {}), subView === 'atlas' && _jsx(AtlasView, {}), subView === 'diagnosis' && _jsx(TheDiagnosisTab, {}), subView === 'frame' && _jsx(FrameTab, { currentMode: currentMode, onModeChange: onModeChange, authState: authState }), subView === 'lb-account' && _jsx(LBAccountTab, {}), subView === 'settings' && _jsx(SettingsTab, { authState: authState }), subView === 'membership' && _jsx(MembershipTab, {}), subView === 'help' && _jsx(HelpComposer, {}), subView === 'power' && _jsx(PowerDiagnosticsPanel, { authState: authState }), subView === 'authorizations' && _jsx(AuthorizationsPanel, { onSubViewChange: onSubViewChange })] })] }));
    }
    return (_jsxs("div", { style: {
            height: '100%', overflowY: 'auto', padding: '16px 20px',
            background: '#0a0f1a', color: '#f0fdf4', fontFamily: 'system-ui, -apple-system, sans-serif',
        }, children: [_jsx("div", { style: { marginBottom: 12, fontSize: 16, fontWeight: 700, color: '#f0fdf4' }, children: "More" }), _jsx("div", { style: {
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12,
                }, children: MENU.map((entry) => (_jsxs("button", { onClick: () => onSubViewChange(entry.id), style: {
                        background: '#111827', border: '1px solid rgba(100,116,139,0.2)', borderRadius: 10,
                        padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 4,
                        cursor: 'pointer', textAlign: 'left', fontFamily: 'system-ui, sans-serif',
                    }, children: [_jsx("div", { style: { fontSize: 20 }, children: entry.icon }), _jsx("div", { style: { fontSize: 13, fontWeight: 600, color: '#e2e8f0' }, children: entry.label }), _jsx("div", { style: { fontSize: 10, color: '#64748b' }, children: entry.desc })] }, entry.id))) })] }));
}
export default MoreTab;
