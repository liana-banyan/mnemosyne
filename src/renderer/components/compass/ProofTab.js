import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ProveItWorksTab } from '../standard/ProveItWorksTab';
import { OneClickMeshTestPanel } from '../OneClickMeshTestPanel';
export function ProofTab({ onNavigate, authState }) {
    return (_jsxs("div", { style: {
            height: '100%', overflowY: 'auto', padding: '16px 20px',
            background: '#0a0f1a', color: '#f0fdf4', fontFamily: 'system-ui, -apple-system, sans-serif',
        }, children: [_jsx("div", { style: { marginBottom: 4, fontSize: 16, fontWeight: 700, color: '#f0fdf4' }, children: "Proof" }), _jsx("div", { style: { marginBottom: 16, fontSize: 11, color: '#64748b', lineHeight: 1.5 }, children: "Third-party proofs, benchmark results, and provenance -- nothing here is a reasoning claim; every number is either a real counter from this machine's own log, or a receipt from a named independent source." }), _jsx(ProveItWorksTab, { onSwitchTab: () => onNavigate('ask') }), _jsx("div", { style: { marginTop: 20, marginBottom: 8, fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }, children: "Sourced-Knowledge Benchmark -- run controls + results" }), _jsx(OneClickMeshTestPanel, { authState: authState, onShareResult: () => { window.dispatchEvent(new CustomEvent('mnemo-jump-to-social')); } })] }));
}
export default ProofTab;
