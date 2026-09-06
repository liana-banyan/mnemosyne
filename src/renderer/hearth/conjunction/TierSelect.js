import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// SAGA 4 BP041 — TierSelect component
// Inline tier dropdown per In Conjunction agent row.
// Founder rule "3 options always": flagship · balanced · cheap
// NO-FIAT-CONVERSION: model spend is opt-in via tier choice (cheap = minimize spend)
// Persists to ~/.lb_substrate/in_conjunction_tiers.json via parent context.
import { useState, useRef, useEffect } from 'react';
const TIER_ICON = {
    flagship: '🔥',
    balanced: '⚖️',
    cheap: '💰',
};
const TIER_COLOR = {
    flagship: '#fc8181',
    balanced: '#f6ad55',
    cheap: '#68d391',
};
export function TierSelect({ agentId, tiers, selectedTierId, onSelect, disabled }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const selected = tiers.find((t) => t.id === selectedTierId) ?? tiers[0];
    useEffect(() => {
        function handleOutside(e) {
            if (ref.current && !ref.current.contains(e.target)) {
                setOpen(false);
            }
        }
        if (open)
            document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [open]);
    if (!selected)
        return null;
    return (_jsxs("div", { ref: ref, style: styles.wrapper, children: [_jsxs("button", { style: {
                    ...styles.trigger,
                    ...(disabled ? styles.triggerDisabled : {}),
                    borderColor: open ? TIER_COLOR[selected.tierClass] : '#4a5568',
                }, onClick: (e) => {
                    e.stopPropagation();
                    if (!disabled)
                        setOpen((v) => !v);
                }, title: `${agentId} tier: ${selected.label}`, "aria-haspopup": "listbox", "aria-expanded": open, children: [_jsx("span", { style: { color: TIER_COLOR[selected.tierClass], fontSize: '0.75rem' }, children: TIER_ICON[selected.tierClass] }), _jsx("span", { style: styles.triggerLabel, children: selected.modelId }), _jsx("span", { style: { ...styles.chevron, transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }, children: "\u25BE" })] }), open && (_jsx("div", { style: styles.dropdown, role: "listbox", children: tiers.map((tier) => {
                    const isActive = tier.id === selectedTierId;
                    return (_jsxs("button", { role: "option", "aria-selected": isActive, style: {
                            ...styles.option,
                            ...(isActive ? styles.optionActive : {}),
                        }, onClick: (e) => {
                            e.stopPropagation();
                            onSelect(tier.id);
                            setOpen(false);
                        }, children: [_jsx("span", { style: { color: TIER_COLOR[tier.tierClass], fontSize: '0.8rem', minWidth: '1.1rem' }, children: TIER_ICON[tier.tierClass] }), _jsxs("div", { style: styles.optionText, children: [_jsx("span", { style: styles.optionLabel, children: tier.label }), _jsx("span", { style: { ...styles.optionClass, color: TIER_COLOR[tier.tierClass] }, children: tier.tierClass })] }), isActive && _jsx("span", { style: styles.checkmark, children: "\u2713" })] }, tier.id));
                }) }))] }));
}
const styles = {
    wrapper: {
        position: 'relative',
        display: 'inline-flex',
        flexShrink: 0,
    },
    trigger: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem',
        background: '#1a202c',
        border: '1px solid #4a5568',
        borderRadius: '5px',
        padding: '2px 6px',
        color: '#e2e8f0',
        cursor: 'pointer',
        fontSize: '0.68rem',
        transition: 'border-color 0.15s',
        whiteSpace: 'nowrap',
    },
    triggerDisabled: {
        opacity: 0.45,
        cursor: 'default',
    },
    triggerLabel: {
        fontSize: '0.68rem',
        color: '#a0aec0',
        maxWidth: '80px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    chevron: {
        fontSize: '0.6rem',
        color: '#718096',
        transition: 'transform 0.15s',
        display: 'inline-block',
    },
    dropdown: {
        position: 'absolute',
        top: 'calc(100% + 4px)',
        right: 0,
        background: '#2d3748',
        border: '1px solid #4a5568',
        borderRadius: '8px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        zIndex: 100,
        minWidth: '160px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
    },
    option: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        background: 'transparent',
        border: 'none',
        borderBottom: '1px solid #4a5568',
        padding: '0.45rem 0.6rem',
        color: '#e2e8f0',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.1s',
    },
    optionActive: {
        background: '#1a2744',
    },
    optionText: {
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
    },
    optionLabel: {
        fontSize: '0.75rem',
        fontWeight: 600,
    },
    optionClass: {
        fontSize: '0.62rem',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        opacity: 0.8,
    },
    checkmark: {
        color: '#68d391',
        fontSize: '0.75rem',
        flexShrink: 0,
    },
};
