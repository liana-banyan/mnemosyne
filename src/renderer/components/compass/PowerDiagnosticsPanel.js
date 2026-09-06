import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// compass/PowerDiagnosticsPanel.tsx -- BP138 Yoke 0.9.14: Phase 2 (Power/Diagnostics, under
// More).
//
// Scoped EXACTLY to the already-live OneClickMeshTestPanel.tsx controls, per Founder decision
// #2 (reconfirmed in-session): the unrouted TestItOutTab.tsx ("Plow the Field") /
// BenchmarkModal.tsx ("Beat-Google Benchmark") surface is NOT resurrected here, and is NOT
// folded into Proof either -- both files are left completely untouched and unrouted. That
// surface is flagged only as a candidate to evaluate for Proof in a LATER build (see this
// Yoke's final report, open questions).
//
// BP140-K5 MOVE 1: the Sourced-Knowledge Benchmark's OneClickMeshTestPanel run controls +
// results (previously rendered here) have been RELOCATED to compass/ProofTab.tsx, directly
// under its Test Authority panel -- see that file's header. This is a placement change, not a
// removal of functionality: same component, same props, same IPC handlers, only mounted from a
// different parent now. Nothing below duplicates it.
//
// Composes (all reused as-is, relocated not duplicated):
//  - LeanFederationPanel (from LeanGauntletTab.tsx) -- peer scan, same collapsible-toggle
//    pattern the old Package Store tab used.
//  - Substrate (Tools & Panels / Stats / Console) -- moved here per the Founder's explicit
//    "Substrate stays out of Library, moves to Power/More as internal/advanced vocabulary"
//    decision. Mirrors CleanShell.tsx's CombinedSubstrateTab sub-tab pattern exactly, but is
//    its own small local composer (not an import from CleanShell.tsx) so the existing
//    '#/clean-shell' fork's file is never touched by this Yoke.
import { useState } from 'react';
import { LeanFederationPanel } from '../LeanGauntletTab';
import { SubstrateTab } from '../SubstrateTab';
import { SubstrateStatsTab } from '../SubstrateStatsTab';
import { UnifiedSubstrateConsole } from '../UnifiedSubstrateConsole';
function SubstrateComposer() {
    const [sub, setSub] = useState('panels');
    return (_jsxs("div", { style: { border: '1px solid #1e2a38', borderRadius: 8, overflow: 'hidden' }, children: [_jsx("div", { style: { display: 'flex', gap: 4, padding: '10px 12px 0', background: '#0d1117' }, children: ['panels', 'stats', 'console'].map((id) => (_jsx("button", { onClick: () => setSub(id), style: {
                        background: 'none', border: 'none',
                        color: sub === id ? '#f0fdf4' : '#64748b',
                        fontSize: 12, fontWeight: sub === id ? 700 : 400,
                        padding: '4px 10px', cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
                        borderBottom: sub === id ? '2px solid #6ee7b7' : '2px solid transparent',
                    }, children: id === 'panels' ? 'Tools & Panels' : id === 'stats' ? '📊 Stats' : '🌉 Console' }, id))) }), _jsxs("div", { style: { height: 420 }, children: [sub === 'panels' && _jsx(SubstrateTab, {}), sub === 'stats' && _jsx(SubstrateStatsTab, {}), sub === 'console' && _jsx(UnifiedSubstrateConsole, {})] })] }));
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept on the props interface so
// MoreTab.tsx's existing `<PowerDiagnosticsPanel authState={authState} />` call site needs no
// change (BP140-K5 MOVE 1); no longer read here now that OneClickMeshTestPanel moved to Proof.
export function PowerDiagnosticsPanel({ authState: _authState }) {
    const [showPeerScan, setShowPeerScan] = useState(false);
    const [showSubstrate, setShowSubstrate] = useState(false);
    return (_jsxs("div", { style: {
            height: '100%', overflowY: 'auto', padding: '16px 20px',
            background: '#0a0f1a', color: '#f0fdf4', fontFamily: 'system-ui, -apple-system, sans-serif',
        }, children: [_jsx("div", { style: { marginBottom: 4, fontSize: 16, fontWeight: 700, color: '#f0fdf4' }, children: "Power / Diagnostics" }), _jsx("div", { style: { marginBottom: 16, fontSize: 11, color: '#64748b', lineHeight: 1.5 }, children: "Advanced, internal controls -- mesh dispatch and substrate internals. Not part of the new-user product promise; that's why this lives only here, under More. The Sourced-Knowledge Benchmark's run controls moved to the Proof tab (BP140-K5) -- see it there, directly under Test Authority." }), _jsxs("div", { style: { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }, children: [_jsxs("button", { onClick: () => setShowPeerScan((v) => !v), style: pillBtn(showPeerScan), children: ["\u2B21 ", showPeerScan ? 'Hide' : 'Scan for Peers'] }), _jsxs("button", { onClick: () => setShowSubstrate((v) => !v), style: pillBtn(showSubstrate), children: ["\uD83E\uDDEC ", showSubstrate ? 'Hide' : 'Substrate'] })] }), showPeerScan && (_jsx("div", { style: { marginBottom: 16 }, children: _jsx(LeanFederationPanel, {}) })), showSubstrate && (_jsx("div", { style: { marginBottom: 16 }, children: _jsx(SubstrateComposer, {}) }))] }));
}
function pillBtn(active) {
    return {
        background: active ? '#1e3a5c' : 'none',
        color: active ? '#e2e8f0' : '#6ee7b7',
        border: '1px solid #1e4038',
        borderRadius: 6,
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'system-ui, sans-serif',
    };
}
export default PowerDiagnosticsPanel;
