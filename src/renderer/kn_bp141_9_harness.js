import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// KN-BP141-9 verification harness (scratch, not part of the shipped app) -- mounts the REAL
// OneClickMeshTestPanel component standalone (no Electron main process) purely for screenshot
// verification of D1/D3. Adds one harness-only button that feeds the run 031 receipt JSON
// through the panel's own existing "Load a receipt (.json)" file-input handler (simulated file
// select via DataTransfer, no CDP Input.* used) -- this is a REPLAY of a saved receipt through
// real rendering/classification code, never a live scored run. Additive-only per Rule 66; not
// wired into any production entry point or build target.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { OneClickMeshTestPanel } from './components/OneClickMeshTestPanel';
function HarnessLoadReceiptButton() {
    const onClick = async () => {
        const res = await fetch('/kn_bp141_9_receipt_031.json');
        const text = await res.text();
        const file = new File([text], '031mnemo_mesh_test_receipt_2026-08-01T18-13-04-045Z.json', {
            type: 'application/json',
        });
        const input = document.querySelector('input[type="file"]');
        if (!input) {
            alert('harness: file input not found in panel DOM');
            return;
        }
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    return (_jsx("button", { onClick: () => void onClick(), style: {
            display: 'block', width: '100%', marginBottom: 10, padding: '8px 12px',
            background: '#7c2d12', color: '#fed7aa', border: '2px dashed #ea580c', borderRadius: 8,
            fontFamily: 'system-ui, sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }, children: "[HARNESS ONLY, not shipped] Replay run 031 receipt through panel's real \"Load a receipt\" path" }));
}
const root = createRoot(document.getElementById('root'));
root.render(_jsxs(React.StrictMode, { children: [_jsx(HarnessLoadReceiptButton, {}), _jsx(OneClickMeshTestPanel, {})] }));
