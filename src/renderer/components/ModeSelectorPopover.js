import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// BP041 SAGA 3 — Mode Selector Popover
// Replaces read-only "AI Burst" label with a clickable 3-mode selector.
//
// Three modes (AI Burst / Normal / Fallback) — SAGA 01 BP046B brand sweep:
//   "user should be able to click it and choose which of the three to use."
//
// Canon: project_mnemosyne_mode_selector_and_ollama_bundling_bp041.md
// Brick Wall: R16 NO-API-KEY-EXPOSURE · R17 SHOW-RESULTS · R18 R-FOREMAN-FIRST
//             NO-FIAT-CONVERSION (mode selector makes cost visible at glance)
//             SSPL · Pledge #2260 · 8-dim accessibility (aria-labels, keyboard)
import React, { useCallback, useEffect, useRef } from 'react';
export const ModeSelectorPopover = ({ currentMode, onSelect, onClose, ollamaAvailable = false, apiKeyAvailable = false, }) => {
    const popoverRef = useRef(null);
    const [selected, setSelected] = React.useState(currentMode);
    // BP065: showApiKeyPanel removed — AI Burst works key-free by default.
    // Key is optional; never block the user with a key-wall. Apply is unconditional.
    // Mode definitions — SAGA 01 BP046B brand sweep: AI Burst / Normal / Fallback
    // BP065: AI Burst prereq reframed — works key-free by default (local Ollama + substrate).
    // API key is optional enhancement, never a wall. per canon_ai_burst_works_key_free_bp065.
    const modes = [
        {
            mode: 'ai_burst',
            icon: '🔥',
            label: 'AI Burst',
            stack: 'Local AI + Substrate (+ Cloud if key set)',
            cost: apiKeyAvailable ? 'Cloud-enhanced (~$0.054/artifact)' : 'Free, local — works without a key',
            prereq: 'Works free and local. Add an API key in Settings for cloud-frontier results.',
            prereqMet: true,
        },
        {
            mode: 'normal',
            icon: '🪵',
            label: 'Normal',
            stack: 'Local Ollama + Substrate',
            cost: 'Zero marginal (after Ollama install)',
            prereq: 'Requires Ollama installed',
            prereqMet: ollamaAvailable,
        },
        {
            mode: 'fallback',
            icon: '❄️',
            label: 'Fallback',
            stack: 'Substrate cache only',
            cost: 'Zero — always. Offline-capable.',
            prereq: 'Always available',
            prereqMet: true,
        },
    ];
    // Mode colors mirror the triple-channel CSS accessibility spec
    const modeColors = {
        ai_burst: { primary: '#facc15', bg: 'rgba(250, 204, 21, 0.12)', border: 'rgba(250, 204, 21, 0.45)' },
        normal: { primary: '#22c55e', bg: 'rgba(34, 197, 94, 0.12)', border: 'rgba(34, 197, 94, 0.45)' },
        fallback: { primary: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.45)' },
    };
    // Close on Escape or outside click
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape')
            onClose(); };
        const onOutside = (e) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target))
                onClose();
        };
        document.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', onOutside);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('mousedown', onOutside);
        };
    }, [onClose]);
    // Focus trap: keep focus inside popover
    useEffect(() => {
        const firstBtn = popoverRef.current?.querySelector('button');
        firstBtn?.focus();
    }, []);
    const handleApply = useCallback(() => {
        // BP055 W4 Founder direct: align dashboard to tray-menu behavior.
        // Mode switch is unconditional — the tray right-click menu already lets
        // users flip to AI Burst without a key check; the dashboard must match.
        // The API key prompt surfaces naturally at first-actual-use downstream.
        if (selected !== currentMode) {
            onSelect(selected);
        }
        onClose();
    }, [selected, currentMode, onSelect, onClose]);
    return (_jsx("div", { ref: popoverRef, role: "dialog", "aria-modal": "true", "aria-label": "Choose MnemosyneC substrate mode", style: styles.overlay, children: _jsxs("div", { style: styles.popover, children: [_jsxs("div", { style: styles.header, children: [_jsx("span", { style: styles.headerTitle, children: "Choose substrate mode" }), _jsx("button", { style: styles.closeBtn, onClick: onClose, "aria-label": "Close mode selector", title: "Close (Esc)", children: "\u2715" })] }), _jsx("div", { style: styles.modeList, role: "radiogroup", "aria-label": "Substrate modes", children: modes.map((opt) => {
                        const isSelected = selected === opt.mode;
                        const colors = modeColors[opt.mode];
                        // Bug #3 v0.1.10: AI Burst is always clickable; prereqMet only affects display hint
                        const isDisabled = opt.mode !== 'ai_burst' && !opt.prereqMet;
                        return (_jsxs("button", { role: "radio", "aria-checked": isSelected, "aria-disabled": isDisabled, disabled: isDisabled, onClick: () => {
                                if (!isDisabled) {
                                    setSelected(opt.mode);
                                }
                            }, style: {
                                ...styles.modeRow,
                                background: isSelected ? colors.bg : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${isSelected ? colors.border : 'rgba(255,255,255,0.1)'}`,
                                opacity: isDisabled ? 0.45 : 1,
                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                            }, title: isDisabled ? `${opt.prereq} — unavailable` : `Select ${opt.label} mode`, children: [_jsxs("div", { style: styles.modeLeft, children: [_jsx("span", { style: { fontSize: 20 }, children: opt.icon }), _jsxs("div", { style: styles.modeInfo, children: [_jsx("span", { style: { ...styles.modeLabel, color: isSelected ? colors.primary : 'rgba(255,255,255,0.85)' }, children: opt.label }), _jsx("span", { style: styles.modeStack, children: opt.stack }), _jsx("span", { style: { ...styles.modeCost, color: opt.prereqMet ? 'rgba(255,255,255,0.5)' : '#f87171' }, children: opt.prereqMet ? opt.cost : `⚠ ${opt.prereq}` })] })] }), _jsx("div", { style: {
                                        ...styles.radioIndicator,
                                        borderColor: isSelected ? colors.primary : 'rgba(255,255,255,0.25)',
                                        background: isSelected ? colors.primary : 'transparent',
                                    } })] }, opt.mode));
                    }) }), selected === 'ai_burst' && !apiKeyAvailable && (_jsxs("div", { style: {
                        margin: '0 12px 10px',
                        padding: '8px 12px',
                        background: 'rgba(34,197,94,0.07)',
                        border: '1px solid rgba(34,197,94,0.25)',
                        borderRadius: 7,
                        fontSize: 10,
                        color: 'rgba(255,255,255,0.55)',
                        lineHeight: 1.6,
                    }, children: ["\u2713 ", _jsx("strong", { style: { color: '#22c55e' }, children: "AI Burst works now, free, local." }), ' ', "Add an Anthropic API key in Settings \u2192 API Keys for cloud-frontier results (optional)."] })), _jsxs("div", { style: styles.footer, children: [_jsx("button", { style: styles.cancelBtn, onClick: onClose, "aria-label": "Cancel \u2014 keep current mode", children: "Cancel" }), _jsx("button", { style: {
                                ...styles.applyBtn,
                                background: modeColors[selected].bg,
                                borderColor: modeColors[selected].border,
                                color: modeColors[selected].primary,
                            }, onClick: handleApply, "aria-label": `Apply ${modes.find(m => m.mode === selected)?.label ?? selected} mode`, children: "Apply" })] })] }) }));
};
const styles = {
    overlay: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        padding: 12,
    },
    popover: {
        background: '#0f111a',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 10,
        width: 340,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.03)',
    },
    headerTitle: {
        fontSize: 12,
        fontWeight: 600,
        color: 'rgba(255,255,255,0.7)',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        color: 'rgba(255,255,255,0.4)',
        cursor: 'pointer',
        fontSize: 14,
        padding: '2px 4px',
        borderRadius: 4,
        lineHeight: 1,
    },
    modeList: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '10px 12px',
    },
    modeRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        borderRadius: 7,
        textAlign: 'left',
        width: '100%',
        transition: 'background 0.15s ease, border-color 0.15s ease',
        fontFamily: 'inherit',
    },
    modeLeft: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        flex: 1,
    },
    modeInfo: {
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
    },
    modeLabel: {
        fontSize: 13,
        fontWeight: 700,
        lineHeight: 1.2,
    },
    modeStack: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.55)',
        lineHeight: 1.3,
    },
    modeCost: {
        fontSize: 10,
        lineHeight: 1.3,
    },
    radioIndicator: {
        width: 14,
        height: 14,
        borderRadius: '50%',
        border: '2px solid',
        flexShrink: 0,
        transition: 'background 0.15s ease, border-color 0.15s ease',
    },
    footer: {
        display: 'flex',
        gap: 8,
        padding: '10px 12px',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        justifyContent: 'flex-end',
    },
    cancelBtn: {
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.12)',
        color: 'rgba(255,255,255,0.6)',
        padding: '7px 16px',
        borderRadius: 6,
        cursor: 'pointer',
        fontSize: 12,
        fontFamily: 'inherit',
    },
    applyBtn: {
        border: '1px solid',
        padding: '7px 20px',
        borderRadius: 6,
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'inherit',
        transition: 'background 0.15s ease',
    },
};
export default ModeSelectorPopover;
